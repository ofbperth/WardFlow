// Isolated experiment only. No application imports, environment keys or database IO.
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const VERSION = 1;
const TAG_BYTES = 16;
const MAX_PAYLOAD_BYTES = 1024 * 1024;
export const protectedFields = Object.freeze([
  "hospitalNumber", "admissionNumber", "displayName", "underlyingDisease", "diagnosis",
]);

export class DecryptionError extends Error {
  constructor() {
    // Do not expose any failed partial plaintext, ciphertext or key material.
    super("Encrypted patient data could not be verified");
    this.name = "DecryptionError";
  }
}

function validateText(value) {
  if (value !== null && typeof value !== "string") {
    throw new TypeError("Patient fields must be strings or null; numeric conversion is forbidden");
  }
}

function validateKey(key) {
  if (!Buffer.isBuffer(key) || key.length !== 32) throw new TypeError("A 32-byte key is required");
}

function validateKeyId(keyId) {
  if (typeof keyId !== "string" || !/^[a-zA-Z0-9._-]{1,64}$/.test(keyId)) {
    throw new TypeError("Invalid key identifier");
  }
}

function additionalData(context, keyId) {
  if (!context || !protectedFields.includes(context.field)) throw new TypeError("Invalid field");
  for (const id of [context.scopeId, context.patientId]) {
    if (typeof id !== "string" || !id.length || id.length > 200) throw new TypeError("Invalid context");
  }
  // JSON array prevents ambiguity when identifiers contain punctuation/delimiters.
  return Buffer.from(JSON.stringify([
    "wardflow-patient-field-prototype", VERSION, ALGORITHM, keyId,
    context.scopeId, context.patientId, context.field,
  ]), "utf8");
}

function decodeCanonicalBase64(value, expectedLength) {
  if (typeof value !== "string" || value.length > Math.ceil(MAX_PAYLOAD_BYTES / 3) * 4 ||
      !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) {
    throw new DecryptionError();
  }
  const bytes = Buffer.from(value, "base64");
  if (bytes.toString("base64") !== value || !bytes.length ||
      (expectedLength !== undefined && bytes.length !== expectedLength)) throw new DecryptionError();
  return bytes;
}

export function sealText(value, context, { keyId, key }) {
  validateText(value);
  validateKey(key);
  validateKeyId(keyId);
  // JSON preserves null, whitespace, Thai and even escaped UTF-16 code units exactly.
  const plaintext = Buffer.from(JSON.stringify(value), "utf8");
  if (plaintext.length > MAX_PAYLOAD_BYTES) throw new RangeError("Patient field is too large");
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: TAG_BYTES });
  cipher.setAAD(additionalData(context, keyId));
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return Object.freeze({
    version: VERSION, algorithm: ALGORITHM, keyId,
    iv: iv.toString("base64"), ciphertext: ciphertext.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
  });
}

export function openText(envelope, context, keyring) {
  try {
    const expectedKeys = ["algorithm", "ciphertext", "iv", "keyId", "tag", "version"];
    if (!envelope || typeof envelope !== "object" || Array.isArray(envelope) ||
        JSON.stringify(Object.keys(envelope).sort()) !== JSON.stringify(expectedKeys) ||
        envelope.version !== VERSION || envelope.algorithm !== ALGORITHM) throw new DecryptionError();
    validateKeyId(envelope.keyId);
    if (!(keyring instanceof Map) || !keyring.has(envelope.keyId)) throw new DecryptionError();
    const key = keyring.get(envelope.keyId);
    validateKey(key);
    const decipher = createDecipheriv(ALGORITHM, key, decodeCanonicalBase64(envelope.iv, 12), {
      authTagLength: TAG_BYTES,
    });
    decipher.setAAD(additionalData(context, envelope.keyId));
    decipher.setAuthTag(decodeCanonicalBase64(envelope.tag, TAG_BYTES));
    // Nothing is returned until final() authenticates the entire payload and AAD.
    const plaintext = Buffer.concat([
      decipher.update(decodeCanonicalBase64(envelope.ciphertext)), decipher.final(),
    ]);
    const value = JSON.parse(plaintext.toString("utf8"));
    validateText(value);
    return value;
  } catch {
    throw new DecryptionError();
  }
}

export function sealRecord(row, scopeId, config) {
  if (typeof row.displayName !== "string") throw new TypeError("Patient name must be a string");
  return {
    id: row.id,
    fields: Object.fromEntries(protectedFields.map(field => [field,
      sealText(row[field], { scopeId, patientId: row.id, field }, config),
    ])),
  };
}

export function openRecord(encrypted, scopeId, expectedPatientId, keyring) {
  if (encrypted?.id !== expectedPatientId || !encrypted.fields ||
      JSON.stringify(Object.keys(encrypted.fields).sort()) !== JSON.stringify([...protectedFields].sort())) {
    throw new DecryptionError();
  }
  // Build the full object before returning it: one corrupt field blocks the whole record.
  return Object.fromEntries(protectedFields.map(field => [field,
    openText(encrypted.fields[field], { scopeId, patientId: expectedPatientId, field }, keyring),
  ]));
}
