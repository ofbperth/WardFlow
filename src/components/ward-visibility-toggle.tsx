"use client";

import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";

export function WardVisibilityToggle({ wardName, contentId }: { wardName: string; contentId: string }) {
  const [isHidden, setIsHidden] = useState(false);
  const label = isHidden ? "Show ward" : "Hide ward";

  function toggleVisibility() {
    const content = document.getElementById(contentId);
    if (!content) return;

    const nextIsHidden = !isHidden;
    content.hidden = nextIsHidden;
    setIsHidden(nextIsHidden);
  }

  return (
    <button
      type="button"
      onClick={toggleVisibility}
      aria-controls={contentId}
      aria-expanded={!isHidden}
      aria-label={`${label}: ${wardName}`}
      title={label}
      className="button-secondary inline-flex h-8 items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold"
    >
      {isHidden ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
      <span>{label}</span>
    </button>
  );
}
