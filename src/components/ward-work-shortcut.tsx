"use client";

import { useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { saveTaskAction } from "@/app/actions";
import type { UserProfile } from "@/lib/types";

export function WardWorkShortcut({ patientId, patientName, bed, wardName, profiles, defaultOwnerId }: {
  patientId: string; patientName: string; bed: string; wardName: string;
  profiles: UserProfile[]; defaultOwnerId: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const inputClass = "mt-1 block w-full rounded-xl border clinical-divider bg-white px-3 py-2.5 text-sm";
  return <>
    <button type="button" className="button-accent inline-flex min-h-11 items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold"
      aria-label={`Create ward work for ${patientName}, Bed ${bed}`} onClick={() => { setError(""); dialog.current?.showModal(); }}>
      <Plus className="h-4 w-4" /> Ward work
    </button>
    <dialog ref={dialog} aria-labelledby={`ward-work-${patientId}`} onCancel={(event) => { if (pending) event.preventDefault(); }}
      className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-xl overflow-y-auto rounded-3xl border clinical-divider bg-[color:var(--color-paper)] p-5 text-foreground shadow-xl backdrop:bg-black/30">
      <div className="mb-4 flex items-start justify-between gap-3 border-b clinical-divider pb-3">
        <div><h2 id={`ward-work-${patientId}`} className="text-lg font-semibold">Create ward work</h2>
          <p className="mt-1 font-semibold">{patientName}</p><p className="text-sm text-muted">{wardName} · Bed {bed}</p></div>
        <button type="button" aria-label="Close" disabled={pending} className="button-secondary rounded-full p-2" onClick={() => dialog.current?.close()}><X className="h-5 w-5" /></button>
      </div>
      <form onSubmit={async (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const data = new FormData(form);
        setPending(true); setError("");
        try { await saveTaskAction(data); form.reset(); dialog.current?.close(); router.refresh(); }
        catch { setError("สร้าง Ward work ไม่สำเร็จ กรุณาตรวจสอบสิทธิ์และลองใหม่ ข้อมูลในฟอร์มยังอยู่"); }
        finally { setPending(false); }
      }} className="space-y-3">
        <input type="hidden" name="patientId" value={patientId} />
        <input type="hidden" name="status" value="not_started" />
        <fieldset disabled={pending} className="space-y-3">
          <label className="block text-sm font-medium">Ward work title<input autoFocus name="title" required className={inputClass} placeholder="พิมพ์งานที่ต้องทำ" /></label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm font-medium">Owner<select name="ownerId" defaultValue={defaultOwnerId} className={inputClass}>
              <option value="">Unassigned</option>{profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.name}</option>)}
            </select></label>
            <label className="block text-sm font-medium">Priority<select name="priority" defaultValue="normal" className={inputClass}>
              <option value="normal">Normal</option><option value="urgent">Urgent</option><option value="emergency">Emergency</option>
            </select></label>
          </div>
          <label className="block text-sm font-medium">Type<select name="type" defaultValue="other" className={inputClass}>
            <option value="lab">Lab</option><option value="imaging">Imaging</option><option value="consult">Consult</option><option value="procedure">Procedure</option><option value="family_talk">Family talk</option><option value="discharge">Discharge</option><option value="medication">Medication</option><option value="other">Other</option>
          </select></label>
          <label className="block text-sm font-medium">Note<textarea name="note" rows={3} className={inputClass} /></label>
          {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
          <div className="flex justify-end"><button type="submit" className="button-accent min-h-11 rounded-full px-5 py-2 text-sm font-semibold">{pending ? "กำลังสร้าง…" : "Create ward work"}</button></div>
        </fieldset>
      </form>
    </dialog>
  </>;
}
