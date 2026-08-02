"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";

export function WardVisibilityToggle({ wardName, contentId }: { wardName: string; contentId: string }) {
  const [isHidden, setIsHidden] = useState(true);
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
      className="button-secondary inline-flex h-8 w-8 items-center justify-center rounded-full"
    >
      {isHidden ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
    </button>
  );
}
