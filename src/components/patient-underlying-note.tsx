"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import { ChevronDown, NotebookPen } from "lucide-react";
import { autosaveUnderlyingDiseaseAction } from "@/app/actions";
import {
  acknowledgeUnderlyingDraft, readUnderlyingDraft, removeUnderlyingDraft,
  underlyingDraftKey, writeUnderlyingDraft, type UnderlyingDraft,
} from "@/lib/underlying-draft";

export function PatientUnderlyingNote({ ownerId, patientId, initial, readOnly }: {
  ownerId: string; patientId: string; initial: string | null; readOnly: boolean;
}) {
  const draftKey = underlyingDraftKey(ownerId, patientId);
  const panelId = `underlying-panel-${patientId}`;
  const inputId = `underlying-${patientId}`;
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(initial ?? "");
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState(initial ? "บันทึกแล้ว" : "พร้อมพิมพ์");
  const [failed, setFailed] = useState(false);
  const [storageAvailable, setStorageAvailable] = useState(true);
  const current = useRef(initial ?? "");
  const saved = useRef(initial);
  const request = useRef<UnderlyingDraft["request"]>(null);
  const sending = useRef(false);
  const blocked = useRef(false);
  const composing = useRef(false);
  const schedule = useRef<(delay?: number) => void>(() => {});

  const persist = () => {
    if (!request.current && current.current === (saved.current ?? "")) { removeUnderlyingDraft(draftKey); return; }
    setStorageAvailable(writeUnderlyingDraft(draftKey, { note: current.current, base: saved.current, request: request.current }));
  };
  const restore = useEffectEvent(() => {
    const draft = readUnderlyingDraft(draftKey);
    if (draft && !readOnly) {
      current.current = draft.note;
      saved.current = draft.base;
      request.current = draft.request;
      setValue(draft.note);
      setStatus("กู้คืนข้อความที่ยังไม่บันทึกแล้ว");
    }
    setReady(true);
  });
  // Browser-only draft restoration must finish before editing is enabled.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { restore(); }, [draftKey]);
  const acceptRemote = useEffectEvent(() => {
    if (ready && !sending.current && !request.current && current.current === (saved.current ?? "")) {
      saved.current = initial;
      current.current = initial ?? "";
      setValue(initial ?? "");
    }
  });
  useEffect(() => { acceptRemote(); }, [initial, ready]);

  useEffect(() => {
    if (!ready || readOnly) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let disposed = false;
    const dirty = () => sending.current || Boolean(request.current) || current.current !== (saved.current ?? "");
    const save = async () => {
      if (sending.current || blocked.current || composing.current || !dirty()) return;
      sending.current = true;
      setStatus("กำลังบันทึก…");
      setFailed(false);
      request.current ??= { patientId, note: current.current, expectedValue: saved.current, requestId: crypto.randomUUID() };
      setStorageAvailable(writeUnderlyingDraft(draftKey, { note: current.current, base: saved.current, request: request.current }));
      const sent = request.current;
      try {
        const result = await autosaveUnderlyingDiseaseAction({ patientId: sent.patientId, expectedValue: sent.expectedValue, note: sent.note });
        // A response can arrive after navigation; acknowledge only its own draft request.
        if (result.ok) acknowledgeUnderlyingDraft(draftKey, sent.requestId, result.value);
        if (disposed) return;
        if (result.ok) {
          saved.current = result.value;
          request.current = null;
          setStatus(current.current === (result.value ?? "") ? "บันทึกแล้ว" : "รอบันทึก…");
        } else {
          blocked.current = Boolean(result.conflict) || result.retryable === false;
          setFailed(true);
          setStatus(result.message);
        }
      } catch {
        if (disposed) return;
        setFailed(true);
        setStatus("ยังบันทึกไม่สำเร็จ ระบบจะลองใหม่อัตโนมัติ");
      } finally {
        sending.current = false;
        if (!disposed && dirty() && !blocked.current) timer = setTimeout(save, request.current ? 5000 : 1000);
      }
    };
    schedule.current = (delay = 1000) => {
      clearTimeout(timer);
      if (!blocked.current) timer = setTimeout(save, delay);
    };
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (dirty()) { event.preventDefault(); event.returnValue = ""; }
    };
    const beforeNavigate = (event: MouseEvent) => {
      if (dirty() && event.target instanceof Element && event.target.closest("a[href]")) {
        event.preventDefault(); event.stopPropagation();
        if (!blocked.current) { setStatus("กำลังบันทึกก่อนออกจากหน้า กรุณารอสักครู่"); schedule.current(0); }
      }
    };
    const online = () => schedule.current(0);
    if (dirty()) schedule.current(0);
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", beforeNavigate, true);
    window.addEventListener("online", online);
    return () => {
      disposed = true; clearTimeout(timer);
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("click", beforeNavigate, true);
      window.removeEventListener("online", online);
    };
  }, [draftKey, patientId, ready, readOnly]);

  return (
    <section className="rounded-[18px] border clinical-divider bg-[color:var(--color-surface-strong)]" aria-label="Underlying diseases">
      <button type="button" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen(!open)}
        className="flex min-h-12 w-full items-center justify-between gap-3 rounded-[18px] px-4 py-3 text-left text-sm font-semibold text-[color:var(--color-accent-strong)]">
        <span className="inline-flex items-center gap-2"><NotebookPen className="h-4 w-4" aria-hidden="true" />U/D</span>
        <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
      </button>
      {/* Keep the editor and autosave mounted when collapsed. */}
      <div id={panelId} hidden={!open} className="px-4 pb-4">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-sm">
          <label htmlFor={inputId} className="font-medium">Underlying diseases</label>
          <span id={`${inputId}-status`} role="status" aria-live="polite" className={`text-xs ${failed ? "text-red-700" : "text-[color:var(--color-ink-2)]"}`}>
            {readOnly ? "อ่านอย่างเดียว" : status}
          </span>
        </div>
        <textarea id={inputId} rows={6} value={value} readOnly={readOnly || !ready} aria-describedby={`${inputId}-status`}
          className="min-h-36 w-full resize-y rounded-[14px] border clinical-divider bg-[color:var(--color-paper-3)] px-3 py-3 text-base leading-7 text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-focus)] md:text-sm"
          placeholder={readOnly ? undefined : "พิมพ์ U/D…"}
          onChange={event => {
            current.current = event.target.value; setValue(event.target.value); persist();
            if (!blocked.current) setStatus(event.target.value === (saved.current ?? "") && !request.current ? "บันทึกแล้ว" : "รอบันทึก…");
            schedule.current();
          }}
          onCompositionStart={() => { composing.current = true; }}
          onCompositionEnd={() => { composing.current = false; schedule.current(); }}
          onBlur={() => schedule.current(0)}
        />
        {!readOnly && !storageAvailable ? <p role="alert" className="mt-2 text-xs text-red-700">เก็บ draft ในเบราว์เซอร์ไม่ได้ กรุณารอให้บันทึกแล้วก่อนปิดแท็บ</p> : null}
      </div>
      {!open && failed ? <p role="alert" className="px-4 pb-3 text-xs text-red-700">U/D ยังไม่บันทึก เปิดเพื่อตรวจสอบ</p> : null}
    </section>
  );
}
