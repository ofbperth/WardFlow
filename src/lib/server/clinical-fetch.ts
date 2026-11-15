import { anchorColumn, ClinicalEncryptionError, protectedColumns, type ClinicalCodec, type ClinicalRow } from "./clinical-crypto.mjs";

/** A per-client boundary: RLS/auth still execute in Supabase with the user's JWT. */
export function createClinicalFetch(baseUrl: string, codec: ClinicalCodec, underlyingFetch: typeof fetch = fetch): typeof fetch {
  const origin = new URL(baseUrl).origin;
  // Request-scoped raw snapshots let U/D retain its existing atomic field CAS.
  const snapshots = new Map<string, { raw: unknown; plain: unknown }>();
  const snapshotKey = (table: string, id: string, column: string) => JSON.stringify([table, id, column]);

  return async (input, init) => {
    const request = new Request(input, init);
    const url = new URL(request.url);
    if (url.origin !== origin || !url.pathname.startsWith("/rest/v1/")) return underlyingFetch(request);
    const parts = url.pathname.slice("/rest/v1/".length).split("/");
    const rpc = parts[0] === "rpc" ? parts[1] : null;
    const table = rpc ? null : parts[0];
    if ((!table || !Object.hasOwn(protectedColumns, table)) && rpc !== "autosave_problem_note") {
      return underlyingFetch(request);
    }

    let body: ClinicalRow | ClinicalRow[] | undefined;
    if (request.method !== "GET" && request.method !== "HEAD" && request.method !== "DELETE") {
      body = JSON.parse(await request.clone().text());
    }

    if (table) {
      const anchor = anchorColumn(table);
      const columns = protectedColumns[table];
      const selection = url.searchParams.get("select");
      // Decryption must always have a trusted row binding, even on narrow selects.
      if (selection && !selection.split(",").includes("*") &&
          columns.some(column => selection.split(",").includes(column)) && !selection.split(",").includes(anchor)) {
        url.searchParams.set("select", `${selection},${anchor}`);
      }
      const anchorFilter = url.searchParams.get(anchor);
      const expectedAnchor = anchorFilter?.startsWith("eq.") ? anchorFilter.slice(3) : undefined;
      for (const column of columns) {
        const filter = url.searchParams.get(column);
        if (!filter || filter === "is.null") continue;
        const snapshot = expectedAnchor ? snapshots.get(snapshotKey(table, expectedAnchor, column)) : undefined;
        if (!filter.startsWith("eq.") || !snapshot || filter.slice(3) !== snapshot.plain || typeof snapshot.raw !== "string") {
          throw new ClinicalEncryptionError();
        }
        url.searchParams.set(column, `eq.${snapshot.raw}`);
      }
      for (const order of (url.searchParams.get("order") ?? "").split(",")) {
        if (columns.includes(order.split(".")[0])) throw new ClinicalEncryptionError();
      }
      if (body) {
        const protect = (row: ClinicalRow) => {
          const binding = row[anchor] ?? expectedAnchor;
          if (expectedAnchor && row[anchor] && expectedAnchor !== row[anchor]) throw new ClinicalEncryptionError();
          return codec.encryptRow(table, row, typeof binding === "string" ? binding : undefined);
        };
        body = Array.isArray(body) ? body.map(protect) : protect(body);
      }
    } else if (rpc === "autosave_problem_note" && body && !Array.isArray(body)) {
      if (typeof body.p_problem_id !== "string") throw new ClinicalEncryptionError();
      body = { ...body, p_note: codec.encryptValue("problem_progress_entries", body.p_problem_id, "note", body.p_note) };
    }

    let outbound = new Request(url, request);
    if (body) {
      const headers = new Headers(outbound.headers);
      headers.delete("content-length");
      outbound = new Request(outbound, { headers, body: JSON.stringify(body) });
    }
    const response = await underlyingFetch(outbound);
    if (!response.ok || response.status === 204 || request.method === "HEAD") return response;
    const text = await response.text();
    if (!text) return new Response(null, response);
    let data: unknown = JSON.parse(text);
    if (table) {
      const restore = (raw: ClinicalRow) => {
        const plain = codec.decryptRow(table, raw);
        const id = raw[anchorColumn(table)];
        if (typeof id === "string") {
          for (const column of protectedColumns[table]) {
            if (Object.hasOwn(raw, column)) snapshots.set(snapshotKey(table, id, column), { raw: raw[column], plain: plain[column] });
          }
        }
        return plain;
      };
      if (data !== null) data = Array.isArray(data) ? data.map(restore) : restore(data as ClinicalRow);
    } else if (rpc === "autosave_problem_note" && body && !Array.isArray(body)) {
      const result = data as { ok?: boolean; snapshot?: { note?: unknown } };
      if (result.ok && result.snapshot) {
        result.snapshot.note = codec.decryptValue("problem_progress_entries", String(body.p_problem_id), "note", result.snapshot.note);
      }
    }
    const headers = new Headers(response.headers);
    headers.delete("content-length");
    headers.delete("content-encoding");
    return new Response(JSON.stringify(data), { status: response.status, statusText: response.statusText, headers });
  };
}
