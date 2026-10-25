"use client";

import { useEffect, useEffectEvent, useRef, useState, useSyncExternalStore } from "react";
import { autosaveProblemNoteAction } from "@/app/actions";
import type { ProgressSaveInput, ProgressSnapshot } from "@/lib/progress-autosave";

const subscribeHydration = () => () => {};
const clientReady = () => true;
const serverReady = () => false;

export function ProgressNoteAutosave({ patientId, problemId, initial, readOnly = false }: {
  patientId: string; problemId: string; initial: ProgressSnapshot; readOnly?: boolean;
}) {
  const hydrated = useSyncExternalStore(subscribeHydration, clientReady, serverReady);
  const [value, setValue] = useState(initial.note);
  const [status, setStatus] = useState(initial.id ? "บันทึกแล้ว" : "พร้อมพิมพ์");
  const [failed, setFailed] = useState(false);
  const field = useRef<HTMLTextAreaElement>(null);
  const current = useRef(initial.note);
  const saved = useRef(initial);
  const sending = useRef(false);
  const blocked = useRef(false);
  const composing = useRef(false);
  const request = useRef<ProgressSaveInput | null>(null);
  const schedule = useRef<(delay?: number) => void>(() => {});

  const acceptRemote = useEffectEvent(() => {
    // Realtime refresh must never replace local typing or advance its base version.
    if (!sending.current && !request.current && current.current === saved.current.note) {
      saved.current = initial;
      current.current = initial.note;
      setValue(initial.note);
    }
  });
  useEffect(() => { acceptRemote(); }, [initial.id, initial.updatedAt, initial.note]);

  useEffect(() => {
    const textarea = field.current;
    if (!textarea) return;
    const resize = () => {
      if (!textarea.getClientRects().length) return;
      textarea.style.height = "auto";
      textarea.style.height = `${textarea.scrollHeight + 2}px`;
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(textarea);
    window.addEventListener("resize", resize);
    return () => { observer.disconnect(); window.removeEventListener("resize", resize); };
  }, [value]);

  useEffect(() => {
    if (readOnly) return;
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
      try {
        const result = await autosaveProblemNoteAction(request.current);
        if (!result.ok) {
          blocked.current = Boolean(result.conflict);
          setStatus(result.message);
          setFailed(true);
        } else {
          saved.current = result.snapshot;
          request.current = null;
          setStatus(current.current === saved.current.note ? "บันทึกแล้ว" : "รอบันทึก…");
        }
      } catch {
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
  }, [patientId, problemId, readOnly]);

  return (
    <div className="rounded-[14px] border clinical-divider bg-[color:var(--color-paper-3)] p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <label htmlFor={`progress-${problemId}`} className="text-sm font-semibold">Progress note</label>
        <span role="status" aria-live="polite" className={`text-xs ${failed ? "text-red-700" : "text-[color:var(--color-accent-strong)]"}`}>
          {readOnly ? "อ่านอย่างเดียว" : status}
        </span>
      </div>
      <textarea
        ref={field} id={`progress-${problemId}`} value={value} readOnly={readOnly || !hydrated} rows={5}
        placeholder="คลิกแล้วพิมพ์ข้อมูลต่อได้เลย…"
        className="block min-h-36 w-full resize-none overflow-hidden rounded-xl border clinical-divider bg-white px-3 py-3 text-sm leading-7 text-foreground focus:border-[color:var(--color-accent)] focus:outline-none focus:ring-1 focus:ring-[color:var(--color-accent)]"
        onChange={(event) => {
          current.current = event.target.value;
          setValue(event.target.value);
          if (!blocked.current) setStatus("รอบันทึก…");
          schedule.current();
        }}
        onCompositionStart={() => { composing.current = true; }}
        onCompositionEnd={() => { composing.current = false; schedule.current(); }}
        onBlur={() => schedule.current(0)}
      />
      {!readOnly ? <p className="mt-2 text-xs text-muted">บันทึกอัตโนมัติเมื่อหยุดพิมพ์ · ช่องขยายตามข้อความทั้งหมด</p> : null}
    </div>
  );
}
