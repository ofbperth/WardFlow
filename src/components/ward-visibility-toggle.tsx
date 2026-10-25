"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import { useEffect, useSyncExternalStore } from "react";

function subscribe(callback: () => void) {
  window.addEventListener("ward-visibility", callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener("ward-visibility", callback);
    window.removeEventListener("storage", callback);
  };
}

export function WardVisibilityToggle({ wardName, contentId, defaultOpen = false }: { wardName: string; contentId: string; defaultOpen?: boolean }) {
  const storageKey = `wardflow:visibility:${contentId}`;
  const isHidden = useSyncExternalStore(subscribe, () => {
    try {
      const saved = sessionStorage.getItem(storageKey);
      return saved === null ? !defaultOpen : saved === "hidden";
    } catch { return !defaultOpen; }
  }, () => !defaultOpen);
  const label = isHidden ? "Show ward" : "Hide ward";

  useEffect(() => {
    const content = document.getElementById(contentId);
    if (content) content.hidden = isHidden;
  }, [contentId, isHidden]);

  function toggleVisibility() {
    const content = document.getElementById(contentId);
    if (!content) return;

    const nextIsHidden = !isHidden;
    content.hidden = nextIsHidden;
    try { sessionStorage.setItem(storageKey, nextIsHidden ? "hidden" : "open"); } catch { /* Visibility still changes for this view. */ }
    window.dispatchEvent(new Event("ward-visibility"));
  }

  return (
    <button
      type="button"
      onClick={toggleVisibility}
      aria-controls={contentId}
      aria-expanded={!isHidden}
      aria-label={`${label}: ${wardName}`}
      title={label}
      className="button-secondary inline-flex h-11 w-11 items-center justify-center rounded-full"
    >
      {isHidden ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
    </button>
  );
}
