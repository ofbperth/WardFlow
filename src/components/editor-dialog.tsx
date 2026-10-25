"use client";

import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export function EditorDialog({ title, onClose, children, panelClassName, headerClassName, contentClassName }: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  panelClassName?: string;
  headerClassName?: string;
  contentClassName?: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const dirtyRef = useRef(false);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function warnOnLeave(event: BeforeUnloadEvent) {
      if (dirtyRef.current) { event.preventDefault(); event.returnValue = ""; }
    }
    window.addEventListener("beforeunload", warnOnLeave);
    return () => {
      dialog?.close();
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("beforeunload", warnOnLeave);
    };
  }, []);

  function requestClose() {
    if (dialogRef.current?.querySelector('[aria-busy="true"]')) return;
    if (dirtyRef.current && !window.confirm("Discard unsaved changes?")) return;
    onClose();
  }

  return createPortal(
    <dialog ref={dialogRef} aria-labelledby={titleId} aria-modal="true"
      className={cn("editor-dialog", panelClassName)}
      onCancel={(event) => { event.preventDefault(); requestClose(); }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const rect = event.currentTarget.getBoundingClientRect();
        if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) requestClose();
      }}
      onChangeCapture={() => { dirtyRef.current = true; }}
      onInputCapture={() => { dirtyRef.current = true; }}>
      <header className={cn("flex items-center justify-between gap-3 border-b clinical-divider pb-3", headerClassName)}>
        <h2 id={titleId} className="font-semibold">{title}</h2>
        <button type="button" aria-label="Close" className="button-secondary icon-control" onClick={requestClose}><X className="h-4 w-4" /></button>
      </header>
      <div className={cn("pt-4", contentClassName)}>{children}</div>
    </dialog>, document.body,
  );
}
