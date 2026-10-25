"use client";

import { useEffect, useEffectEvent, useRef, useState, useSyncExternalStore } from "react";
import { ProgressNoteEditor } from "@/components/progress-note-editor";
import { autosaveProblemNoteAction } from "@/app/actions";
import type { ProgressSaveInput, ProgressSnapshot } from "@/lib/progress-autosave";
import { acknowledgeProgressDraft, progressDraftKey, readProgressDraft, removeProgressDraft, writeProgressDraft } from "@/lib/progress-draft";

const subscribeHydration = () => () => {};
const clientReady = () => true;
const serverReady = () => false;

export function ProgressNoteAutosave({ ownerId, patientId, problemId, initial, readOnly = false }: {
  ownerId: string; patientId: string; problemId: string; initial: ProgressSnapshot; readOnly?: boolean;
}) {
  const draftKey = progressDraftKey(ownerId, patientId, problemId);
  const hydrated = useSyncExternalStore(subscribeHydration, clientReady, serverReady);
  const [value, setValue] = useState(initial.note);
  const [status, setStatus] = useState(initial.id ? "บันทึกแล้ว" : "พร้อมพิมพ์");
  const [failed, setFailed] = useState(false);
  const [restored, setRestored] = useState(false);
  const [storageAvailable, setStorageAvailable] = useState(true);
  const current = useRef(initial.note);
  const saved = useRef(initial);
  const sending = useRef(false);
  const blocked = useRef(false);
  const composing = useRef(false);
  const request = useRef<ProgressSaveInput | null>(null);
  const schedule = useRef<(delay?: number) => void>(() => {});

  const persistDraft = () => {
    if (!request.current && current.current === saved.current.note) { removeProgressDraft(draftKey); return; }
    setStorageAvailable(writeProgressDraft(draftKey, { note: current.current, base: saved.current, request: request.current }));
  };
  const restoreDraft = useEffectEvent(() => {
    const draft = readProgressDraft(draftKey);
    if (draft && !readOnly) {
      current.current = draft.note;
      saved.current = draft.base;
      request.current = draft.request;
      setValue(draft.note);
      setStatus("กู้คืนข้อความที่ยังไม่บันทึกแล้ว");
    }
    setRestored(true);
  });
  // sessionStorage is browser-only external state. Restore once before enabling input.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { restoreDraft(); }, [draftKey]);

  const acceptRemote = useEffectEvent(() => {
    // Realtime refresh must never replace local typing or advance its base version.
    if (restored && !sending.current && !request.current && current.current === saved.current.note) {
      saved.current = initial;
      current.current = initial.note;
      setValue(initial.note);
    }
  });
  useEffect(() => { acceptRemote(); }, [initial.id, initial.updatedAt, initial.note, restored]);

  useEffect(() => {
    if (readOnly || !restored) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let disposed = false;
    const dirty = () => sending.current || Boolean(request.current) || current.current !== saved.current.note;
    const save = async () => {
      if (sending.current || blocked.current || composing.current || !dirty()) return;
      sending.current = true;
      setStatus("กำลังบันทึก…");
      setFailed(false);
      // Keep the exact request for retries after a lost response.
      request.current ??= {
        patientId, problemId, requestId: crypto.randomUUID(),
        expectedId: saved.current.id, expectedUpdatedAt: saved.current.updatedAt, note: current.current,
      };
      writeProgressDraft(draftKey, { note: current.current, base: saved.current, request: request.current });
      const sentRequest = request.current;
      try {
        const result = await autosaveProblemNoteAction(sentRequest);
        if (result.ok) acknowledgeProgressDraft(draftKey, sentRequest.requestId, result.snapshot);
        if (disposed) return;
        if (!result.ok) {
          blocked.current = Boolean(result.conflict) || result.retryable === false;
          setStatus(result.message);
          setFailed(true);
        } else {
          saved.current = result.snapshot;
          request.current = null;
          setStatus(current.current === saved.current.note ? "บันทึกแล้ว" : "รอบันทึก…");
        }
      } catch {
        if (disposed) return;
        setStatus("ยังบันทึกไม่สำเร็จ ข้อความยังอยู่ในช่องนี้ กำลังรอลองใหม่");
        setFailed(true);
      } finally {
        sending.current = false;
        if (!disposed && dirty() && !blocked.current) {
          timer = setTimeout(save, request.current ? 5000 : 1000);
        }
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
        event.preventDefault();
        event.stopPropagation();
        if (!blocked.current) { setStatus("กำลังบันทึกก่อนออกจากหน้า กรุณารอสักครู่"); schedule.current(0); }
      }
    };
    const online = () => schedule.current(0);
    if (dirty()) schedule.current(0);
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", beforeNavigate, true);
    window.addEventListener("online", online);
    return () => {
      disposed = true;
      clearTimeout(timer);
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("click", beforeNavigate, true);
      window.removeEventListener("online", online);
    };
  }, [patientId, problemId, readOnly, draftKey, restored]);

  return (
    <div className="rounded-[14px] border clinical-divider bg-[color:var(--color-paper-3)] p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <label htmlFor={`progress-${problemId}`} className="text-sm font-semibold">Progress note</label>
        <span role="status" aria-live="polite" className={`text-xs ${failed ? "text-red-700" : "text-[color:var(--color-accent-strong)]"}`}>
          {readOnly ? "อ่านอย่างเดียว" : status}
        </span>
      </div>
      <ProgressNoteEditor
        id={`progress-${problemId}`} value={value} readOnly={readOnly || !hydrated || !restored}
        onChange={(note) => {
          current.current = note;
          setValue(note);
          persistDraft();
          if (!blocked.current) setStatus(note === saved.current.note && !request.current ? "บันทึกแล้ว" : "รอบันทึก…");
          schedule.current();
        }}
        onCompositionStart={() => { composing.current = true; }}
        onCompositionEnd={() => { composing.current = false; schedule.current(); }}
        onBlur={() => schedule.current(0)}
      />
      {!readOnly && !storageAvailable ? <p role="alert" className="mt-2 text-xs text-red-700">เบราว์เซอร์ไม่อนุญาตเก็บ draft กรุณารอให้บันทึกแล้วก่อนรีโหลดหรือปิดแท็บ</p> : null}
    </div>
  );
}
