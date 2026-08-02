"use client";

import { useEffect, useState } from "react";
import { Loader2, Save, X } from "lucide-react";
import { EmptyState, GlassPanel, Pill } from "@/components/wardflow-ui";
import type { ResidentWardAssignmentBoardData, UserProfile } from "@/lib/types";

type Notice = { tone: "success" | "error"; message: string } | null;

export function ResidentWardAssignmentBoard() {
  const [data, setData] = useState<ResidentWardAssignmentBoardData | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [savingWardId, setSavingWardId] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);

  async function load() {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/resident-ward-assignment", { cache: "no-store" });
      const payload = await response.json() as { ok: boolean; data?: ResidentWardAssignmentBoardData; error?: string };
      if (!response.ok || !payload.ok || !payload.data) throw new Error(payload.error ?? "Unable to load Resident assignments");
      setData(payload.data);
      setDrafts(Object.fromEntries(payload.data.wards.map((entry) => [entry.ward.id, entry.residentIds])));
    } catch (error) {
      setNotice({ tone: "error", message: error instanceof Error ? error.message : "Unable to load assignments" });
    } finally { setLoading(false); }
  }
  useEffect(() => { void Promise.resolve().then(load); }, []);

  function residentName(id: string) { return data?.residents.find((resident) => resident.id === id)?.name ?? "Unknown resident"; }
  function addResident(wardId: string, residentId: string) {
    if (!residentId) return;
    setDrafts((current) => ({ ...current, [wardId]: [...new Set([...(current[wardId] ?? []), residentId])] }));
  }
  function removeResident(wardId: string, residentId: string) {
    setDrafts((current) => ({ ...current, [wardId]: (current[wardId] ?? []).filter((id) => id !== residentId) }));
  }
  async function save(wardId: string) {
    const residentIds = drafts[wardId] ?? [];
    if (new Set(residentIds).size !== residentIds.length) { setNotice({ tone: "error", message: "Duplicate Resident selection is not allowed" }); return; }
    setSavingWardId(wardId);
    try {
      const response = await fetch("/api/admin/resident-ward-assignment", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ wardId, residentIds }) });
      const payload = await response.json() as { ok: boolean; error?: string };
      if (!response.ok || !payload.ok) throw new Error(payload.error ?? "Unable to save assignments");
      setNotice({ tone: "success", message: "Resident assignments saved" });
      await load();
    } catch (error) { setNotice({ tone: "error", message: error instanceof Error ? error.message : "Unable to save assignments" }); }
    finally { setSavingWardId(null); }
  }

  if (loading) return <GlassPanel title="Resident Ward Assignment"><div className="flex items-center gap-2 text-sm text-muted"><Loader2 className="h-4 w-4 animate-spin" /> Loading assignments…</div></GlassPanel>;
  if (!data) return <EmptyState title="Resident assignments unavailable" body="Refresh and try again." />;
  return <div className="space-y-3">
    {notice ? <div aria-live="polite" className={notice.tone === "success" ? "rounded-2xl bg-[color:var(--color-accent-soft)] px-3 py-2 text-sm text-[color:var(--color-accent-strong)]" : "rounded-2xl bg-[color:var(--color-danger-soft)] px-3 py-2 text-sm text-[color:var(--color-danger)]"}>{notice.message}</div> : null}
    <div className="grid gap-3 md:grid-cols-2">
      {data.wards.map(({ ward }) => {
        const selected = drafts[ward.id] ?? [];
        const isSaving = savingWardId === ward.id;
        return <section key={ward.id} className="panel-surface rounded-[24px] p-4">
          <div className="flex items-start justify-between gap-2"><div><p className="text-xs uppercase tracking-[0.16em] text-muted">Ward</p><h3 className="mt-1 font-semibold text-foreground">{ward.name}</h3></div><Pill tone="bg-[color:var(--color-accent-soft)] text-[color:var(--color-accent-strong)]">{selected.length} Residents</Pill></div>
          <div className="mt-3 flex flex-wrap gap-1.5">{selected.length ? selected.map((id) => <span key={id} className="inline-flex items-center gap-1 rounded-full bg-[color:var(--color-accent-soft)] px-2.5 py-1 text-xs font-medium text-[color:var(--color-accent-strong)]">{residentName(id)}<button type="button" aria-label={`Remove ${residentName(id)}`} onClick={() => removeResident(ward.id, id)} disabled={isSaving}><X className="h-3.5 w-3.5" /></button></span>) : <p className="text-sm text-muted">No Residents assigned</p>}</div>
          <select aria-label={`Add Resident to ${ward.name}`} defaultValue="" onChange={(event) => { addResident(ward.id, event.target.value); event.currentTarget.value = ""; }} disabled={isSaving} className="mt-3 w-full rounded-xl border clinical-divider bg-white px-3 py-2 text-sm"><option value="">Add Resident…</option>{data.residents.filter((resident: UserProfile) => !selected.includes(resident.id)).map((resident) => <option key={resident.id} value={resident.id}>{resident.name}</option>)}</select>
          <button type="button" onClick={() => void save(ward.id)} disabled={isSaving} className="button-accent mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold disabled:opacity-60">{isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{isSaving ? "Saving…" : "Save Residents"}</button>
        </section>;
      })}
    </div>
  </div>;
}
