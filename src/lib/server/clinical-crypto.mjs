import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const PREFIX = "wfphi:1:";
const ALGORITHM = "aes-256-gcm";
const MAX_BYTES = 4 * 1024 * 1024;
const JSON_MARKER = "__wardflow_encrypted";

// Routing, relations, CAS timestamps and bed uniqueness remain database-readable.
export const protectedColumns = Object.freeze({
  patients: ["hospital_number", "admission_number", "display_name", "underlying_disease", "diagnosis", "allergy", "code_status"],
  problems: ["title", "problem_name", "current_status_summary", "current_status", "evidence", "treatment", "reasoning", "today_plan", "key_data", "plan", "pending", "watch_out"],
  problem_progress_entries: ["note", "status_update", "new_evidence", "treatment_change", "reasoning_update", "today_plan"],
  ward_tasks: ["title", "note", "blocked_reason"],
  task_updates: ["note"],
  handover_notes: ["note", "escalation_instruction"],
  discharge_summaries: ["primary_diagnosis", "hospital_course", "plan", "home_medication"],
  activity_logs: ["before_json", "after_json"],
});

export class ClinicalEncryptionError extends Error {
  constructor() {
    super("Clinical data could not be verified. Access is blocked; contact the administrator.");
    this.name = "ClinicalEncryptionError";
  }
}

export function anchorColumn(table) {
  // The current progress entry ID changes on every autosave; problem_id is stable.
  return table === "problem_progress_entries" ? "problem_id" : "id";
}

function keyIdIsValid(value) {
  return typeof value === "string" && /^[a-zA-Z0-9._-]{1,64}$/.test(value);
}

function decodeBase64(value, expectedBytes, maximumBytes = MAX_BYTES) {
  if (typeof value !== "string" || value.length % 4 !== 0 || value.length > Math.ceil(maximumBytes / 3) * 4 ||
      !/^[A-Za-z0-9+/]*={0,2}$/.test(value)) {
    throw new ClinicalEncryptionError();
  }
  const result = Buffer.from(value, "base64");
  if (!result.length || result.toString("base64") !== value ||
      (expectedBytes !== undefined && result.length !== expectedBytes)) throw new ClinicalEncryptionError();
  return result;
}

export function clinicalConfigFromEnv(env = process.env) {
  try {
    const activeKeyId = env.WARDFLOW_ENCRYPTION_KEY_ID;
    const values = JSON.parse(env.WARDFLOW_ENCRYPTION_KEYS || "null");
    if (!keyIdIsValid(activeKeyId) || !values || typeof values !== "object" || Array.isArray(values)) throw new Error();
    const keys = new Map(Object.entries(values).map(([id, value]) => {
      if (!keyIdIsValid(id)) throw new Error();
      return [id, decodeBase64(value, 32)];
    }));
    if (!keys.has(activeKeyId)) throw new Error();
    const legacy = env.WARDFLOW_ENCRYPTION_ALLOW_LEGACY_READS;
    if (legacy !== undefined && legacy !== "" && legacy !== "true" && legacy !== "false") throw new Error();
    return { activeKeyId, keys, allowLegacyReads: legacy === "true" };
  } catch {
    // Never include the environment value or JSON parse error in logs/responses.
    throw new Error("Clinical encryption keys are missing or invalid; live clinical access is blocked.");
  }
}

export function isEncryptedValue(value) {
  return typeof value === "string" ? value.startsWith("wfphi:") :
    Boolean(value && typeof value === "object" && Object.hasOwn(value, JSON_MARKER));
}

function isEncryptedPatientSnapshot(nested, entityId) {
  return Boolean(nested && typeof nested === "object" && !Array.isArray(nested) && !isEncryptedValue(nested) &&
    nested.id === entityId && protectedColumns.patients.some(column => isEncryptedValue(nested[column])) &&
    protectedColumns.patients.every(column => !Object.hasOwn(nested, column) || nested[column] === null || isEncryptedValue(nested[column])));
}

export function isProtectedStoredValue(table, row, column) {
  return row[column] === null || isEncryptedValue(row[column]) ||
    (table === "activity_logs" && row.entity_type === "patient" && isEncryptedPatientSnapshot(row[column], row.entity_id));
}

export function createClinicalCodec({ activeKeyId, keys, allowLegacyReads = false }) {
  if (!keyIdIsValid(activeKeyId) || !(keys instanceof Map) || !keys.has(activeKeyId)) throw new ClinicalEncryptionError();
  for (const [id, key] of keys) {
    if (!keyIdIsValid(id) || !Buffer.isBuffer(key) || key.length !== 32) throw new ClinicalEncryptionError();
  }

  function aad(table, anchor, column, keyId) {
    if (!protectedColumns[table]?.includes(column) || typeof anchor !== "string" || !anchor.length || anchor.length > 200) {
      throw new ClinicalEncryptionError();
    }
    return Buffer.from(JSON.stringify(["wardflow-clinical", 1, ALGORITHM, keyId, table, anchor, column]), "utf8");
  }

  function seal(table, anchor, column, value) {
    if (value === null) return null;
    const isJson = table === "activity_logs";
    if (!isJson && typeof value !== "string") throw new ClinicalEncryptionError();
    const plaintext = Buffer.from(JSON.stringify(value), "utf8");
    if (plaintext.length > MAX_BYTES) throw new ClinicalEncryptionError();
    const iv = randomBytes(12);
    const cipher = createCipheriv(ALGORITHM, keys.get(activeKeyId), iv, { authTagLength: 16 });
    cipher.setAAD(aad(table, anchor, column, activeKeyId));
    const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const envelope = {
      keyId: activeKeyId, iv: iv.toString("base64"),
      ciphertext: encrypted.toString("base64"), tag: cipher.getAuthTag().toString("base64"),
    };
    const token = PREFIX + Buffer.from(JSON.stringify(envelope), "utf8").toString("base64");
    return isJson ? { [JSON_MARKER]: token } : token;
  }

  function open(table, anchor, column, value) {
    if (value === null) return null;
    try {
      const isJson = table === "activity_logs";
      if (!isEncryptedValue(value)) {
        if (!allowLegacyReads || (!isJson && typeof value !== "string")) throw new ClinicalEncryptionError();
        return value;
      }
      if (isJson && (!value || typeof value !== "object" ||
          Object.keys(value).length !== 1 || !Object.hasOwn(value, JSON_MARKER))) throw new ClinicalEncryptionError();
      const token = isJson ? value[JSON_MARKER] : value;
      if (typeof token !== "string" || !token.startsWith(PREFIX)) throw new ClinicalEncryptionError();
      const envelope = JSON.parse(decodeBase64(token.slice(PREFIX.length), undefined, Math.ceil(MAX_BYTES * 4 / 3) + 1024).toString("utf8"));
      if (!envelope || JSON.stringify(Object.keys(envelope).sort()) !== JSON.stringify(["ciphertext", "iv", "keyId", "tag"]) ||
          !keyIdIsValid(envelope.keyId) || !keys.has(envelope.keyId)) throw new ClinicalEncryptionError();
      const decipher = createDecipheriv(ALGORITHM, keys.get(envelope.keyId), decodeBase64(envelope.iv, 12), { authTagLength: 16 });
      decipher.setAAD(aad(table, anchor, column, envelope.keyId));
      decipher.setAuthTag(decodeBase64(envelope.tag, 16));
      // Do not release update() output until final() authenticates the entire value.
      const plaintext = Buffer.concat([decipher.update(decodeBase64(envelope.ciphertext)), decipher.final()]);
      const result = JSON.parse(plaintext.toString("utf8"));
      if (!isJson && typeof result !== "string") throw new ClinicalEncryptionError();
      return result;
    } catch {
      throw new ClinicalEncryptionError();
    }
  }

  function transformRow(table, row, transform, explicitAnchor) {
    const columns = protectedColumns[table];
    if (!columns || !row || typeof row !== "object" || Array.isArray(row)) throw new ClinicalEncryptionError();
    const result = { ...row };
    for (const column of columns) {
      if (Object.hasOwn(row, column) && row[column] !== null) {
        result[column] = transform(table, explicitAnchor ?? row[anchorColumn(table)], column, row[column]);
      }
    }
    return result;
  }

  function decryptRow(table, row, explicitAnchor) {
    // SQL transfer logs contain a structured copy of an encrypted patient row.
    // Accept that shape only when every non-null protected field is encrypted.
    const staged = { ...row };
    const structuredSnapshots = new Map();
    if (table === "activity_logs" && row.entity_type === "patient") {
      for (const field of ["before_json", "after_json"]) {
        const nested = row[field];
        if (isEncryptedPatientSnapshot(nested, row.entity_id)) {
          structuredSnapshots.set(field, transformRow("patients", nested, open));
          staged[field] = null;
        }
      }
    }
    const result = transformRow(table, staged, open, explicitAnchor);
    for (const [field, value] of structuredSnapshots) result[field] = value;
    // Wrapped audit payloads are plaintext only after their own authentication.
    // Never reinterpret a user's literal text as another ciphertext envelope.
    return result;
  }

  return {
    encryptValue: seal, decryptValue: open,
    encryptRow: (table, row, explicitAnchor) => transformRow(table, row, seal, explicitAnchor),
    decryptRow,
  };
}
