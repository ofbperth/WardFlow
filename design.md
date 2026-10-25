# Design — WardFlow

A locked design system for this app. Every page redesign reads this file before
emitting code. Do not regenerate per page — extend or amend this file when the
system needs to grow.

## Genre
modern-minimal

## Macrostructure family
- Marketing pages: not used in this app surface
- App pages: Workbench with stat-led overview variants
- Content pages: Long Document with the same typography and color system

## Theme
- `--color-paper` oklch(0.988 0.004 185)
- `--color-paper-2` oklch(0.972 0.005 185)
- `--color-ink` oklch(0.292 0.025 224)
- `--color-ink-2` oklch(0.53 0.016 224)
- `--color-rule` oklch(0.89 0.01 210)
- `--color-accent` oklch(0.49 0.072 205)
- `--color-focus` oklch(0.56 0.083 205)

## Typography
- Display: Space Grotesk, weight 500/600, style normal
- Body: Noto Sans Thai, weight 400/500
- Mono: system ui-monospace
- Display tracking: neutral
- Type scale anchor: page heading uses compact editorial sizing, not landing-page hero sizing

## Spacing
4-point named scale, expressed through the app token layer in `globals.css`.
- App pages default to compact vertical rhythm: 12-16px card padding on mobile,
  16-20px on desktop, and short section gaps unless a control needs more room.
- Problem and task surfaces should expose a one-line operational summary first;
  longer context moves behind expand/collapse.

## Motion
- Easings: restrained ease-out and ease-in-out only
- Reveal pattern: none by default
- Reduced-motion fallback: opacity-only, 150ms or less

## Microinteractions stance
- Silent success by default
- No decorative hover lift as the primary signal
- Focus states visible immediately
- Menus, filters, and drawers read as clinical controls, not promo UI
- Secondary actions default to icon-only when context is already obvious
- Expand/collapse is the main path to dense detail; default state stays short

## CTA voice
- Primary CTA: deep teal, compact pill, direct verb copy
- Secondary CTA: white surface with graphite border, same radius rhythm

## Per-page allowances
- Marketing pages: not applicable
- App pages: no decorative enrichment
- Content pages: typography first, same shell language

## What pages MUST share
- WardFlow wordmark and logo
- Deep teal accent family and restrained danger/warning colors
- Space Grotesk + Noto Sans Thai pairing
- Rounded clinical control language
- Calm panel rhythm, zero decorative glass, visible borders, document-grade spacing
- Compact header rhythm with action-first metadata and minimal descriptive copy
- Mobile-first hierarchy: sticky operational header, actionable list next, secondary detail later

## What pages MAY differ on
- Density and panel grouping by workflow
- Overview pages may use more patient/task summary cards
- Read-only pages may feel more document-like, but keep the same tokens
- Labeled primary CTAs may remain text when they unlock a high-value workflow


## Interaction refinements — 2026-10-26
- Navigation: Wards, Discharged, Handover, Ward work; Admin stays reachable below the desktop breakpoint. Quick entry is not a navigation item.
- One containment layer per work list; individual tasks use separators.
- Keep patient identity and safety alerts visible; put secondary demographic detail behind disclosure.
- Controls have at least 44px touch height. Use short action labels for consequential operations.
- Native modal dialogs trap focus, close on Escape, restore trigger focus, and check unsaved input before dismissal.
- Ward visibility is remembered within the browser tab.
- Surfaces are flat; avoid decorative gradients and success notices that move content.

## Exports

### tokens.css

```css
/* Hallmark · macrostructure: Workbench · tone: minimal-clinical · anchor hue: deep-teal */
:root {
  --color-white: oklch(1 0 0);
  --color-overlay: oklch(0.292 0.025 224 / 0.28);
  --color-surface-strong-token: oklch(0.996 0.002 185);
  --color-muted-soft-token: oklch(0.62 0.012 224);
  --color-selection: oklch(0.9 0.028 203);
  --color-paper: oklch(0.988 0.004 185);
  --color-paper-2: oklch(0.972 0.005 185);
  --color-paper-3: oklch(0.955 0.007 195);
  --color-ink: oklch(0.292 0.025 224);
  --color-ink-2: oklch(0.53 0.016 224);
  --color-rule: oklch(0.89 0.01 210);
  --color-rule-strong: oklch(0.81 0.015 213);
  --color-accent: oklch(0.49 0.072 205);
  --color-accent-strong: oklch(0.42 0.068 206);
  --color-accent-soft: oklch(0.94 0.022 201);
  --color-focus: oklch(0.56 0.083 205);
  --color-success: oklch(0.56 0.078 160);
  --color-warning: oklch(0.76 0.132 78);
  --color-danger: oklch(0.62 0.154 24);
  --color-danger-soft: oklch(0.95 0.022 24);
  --color-info-soft: oklch(0.95 0.015 226);
  --color-shadow: oklch(0.3 0.02 222 / 0.08);
  --color-shadow-soft: oklch(0.3 0.02 222 / 0.04);

  --font-display: "Space Grotesk", "Noto Sans Thai", ui-sans-serif, system-ui, sans-serif;
  --font-body: "Noto Sans Thai", ui-sans-serif, system-ui, sans-serif;
  --font-mono: ui-monospace, "SFMono-Regular", "Cascadia Code", monospace;

  --space-3xs: 0.25rem;
  --space-2xs: 0.5rem;
  --space-xs: 0.75rem;
  --space-sm: 1rem;
  --space-md: 1.5rem;
  --space-lg: 2rem;
  --space-xl: 2.75rem;
  --space-2xl: 4rem;
  --space-3xl: 5.5rem;

  --text-xs: 0.75rem;
  --text-sm: 0.875rem;
  --text-md: 1rem;
  --text-lg: 1.125rem;
  --text-xl: 1.375rem;
  --text-2xl: 1.75rem;
  --text-3xl: 2.2rem;
  --text-4xl: clamp(2.6rem, 4vw, 3.6rem);

  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-in: cubic-bezier(0.7, 0, 0.84, 0);
  --ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
  --dur-short: 160ms;
  --dur-base: 220ms;
  --dur-long: 320ms;

  --radius-xs: 0.875rem;
  --radius-sm: 1rem;
  --radius-md: 1.25rem;
  --radius-lg: 1.5rem;
  --radius-xl: 1.75rem;
  --radius-pill: 999px;

  --shadow-card: none;
  --shadow-floating: 0 20px 48px var(--color-shadow);
}

```

### Tailwind v4 @theme

```css
@theme {
  --color-white: oklch(1 0 0);
  --color-overlay: oklch(0.292 0.025 224 / 0.28);
  --color-surface-strong-token: oklch(0.996 0.002 185);
  --color-muted-soft-token: oklch(0.62 0.012 224);
  --color-selection: oklch(0.9 0.028 203);
  --color-paper: oklch(0.988 0.004 185);
  --color-paper-2: oklch(0.972 0.005 185);
  --color-paper-3: oklch(0.955 0.007 195);
  --color-ink: oklch(0.292 0.025 224);
  --color-ink-2: oklch(0.53 0.016 224);
  --color-rule: oklch(0.89 0.01 210);
  --color-rule-strong: oklch(0.81 0.015 213);
  --color-accent: oklch(0.49 0.072 205);
  --color-accent-strong: oklch(0.42 0.068 206);
  --color-accent-soft: oklch(0.94 0.022 201);
  --color-focus: oklch(0.56 0.083 205);
  --color-success: oklch(0.56 0.078 160);
  --color-warning: oklch(0.76 0.132 78);
  --color-danger: oklch(0.62 0.154 24);
  --color-danger-soft: oklch(0.95 0.022 24);
  --color-info-soft: oklch(0.95 0.015 226);
  --color-shadow: oklch(0.3 0.02 222 / 0.08);
  --color-shadow-soft: oklch(0.3 0.02 222 / 0.04);
  --font-display: "Space Grotesk", "Noto Sans Thai", ui-sans-serif, system-ui, sans-serif;
  --font-body: "Noto Sans Thai", ui-sans-serif, system-ui, sans-serif;
  --font-mono: ui-monospace, "SFMono-Regular", "Cascadia Code", monospace;
  --spacing-3xs: 0.25rem;
  --spacing-2xs: 0.5rem;
  --spacing-xs: 0.75rem;
  --spacing-sm: 1rem;
  --spacing-md: 1.5rem;
  --spacing-lg: 2rem;
  --spacing-xl: 2.75rem;
  --spacing-2xl: 4rem;
  --spacing-3xl: 5.5rem;
  --text-xs: 0.75rem;
  --text-sm: 0.875rem;
  --text-md: 1rem;
  --text-lg: 1.125rem;
  --text-xl: 1.375rem;
  --text-2xl: 1.75rem;
  --text-3xl: 2.2rem;
  --text-4xl: clamp(2.6rem, 4vw, 3.6rem);
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-in: cubic-bezier(0.7, 0, 0.84, 0);
  --ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
  --radius-xs: 0.875rem;
  --radius-sm: 1rem;
  --radius-md: 1.25rem;
  --radius-lg: 1.5rem;
  --radius-xl: 1.75rem;
  --radius-pill: 999px;
}
```

### DTCG color tokens

```json
{
  "color-white": {
    "$type": "color",
    "$value": "oklch(1 0 0)"
  },
  "color-overlay": {
    "$type": "color",
    "$value": "oklch(0.292 0.025 224 / 0.28)"
  },
  "color-surface-strong-token": {
    "$type": "color",
    "$value": "oklch(0.996 0.002 185)"
  },
  "color-muted-soft-token": {
    "$type": "color",
    "$value": "oklch(0.62 0.012 224)"
  },
  "color-selection": {
    "$type": "color",
    "$value": "oklch(0.9 0.028 203)"
  },
  "color-paper": {
    "$type": "color",
    "$value": "oklch(0.988 0.004 185)"
  },
  "color-paper-2": {
    "$type": "color",
    "$value": "oklch(0.972 0.005 185)"
  },
  "color-paper-3": {
    "$type": "color",
    "$value": "oklch(0.955 0.007 195)"
  },
  "color-ink": {
    "$type": "color",
    "$value": "oklch(0.292 0.025 224)"
  },
  "color-ink-2": {
    "$type": "color",
    "$value": "oklch(0.53 0.016 224)"
  },
  "color-rule": {
    "$type": "color",
    "$value": "oklch(0.89 0.01 210)"
  },
  "color-rule-strong": {
    "$type": "color",
    "$value": "oklch(0.81 0.015 213)"
  },
  "color-accent": {
    "$type": "color",
    "$value": "oklch(0.49 0.072 205)"
  },
  "color-accent-strong": {
    "$type": "color",
    "$value": "oklch(0.42 0.068 206)"
  },
  "color-accent-soft": {
    "$type": "color",
    "$value": "oklch(0.94 0.022 201)"
  },
  "color-focus": {
    "$type": "color",
    "$value": "oklch(0.56 0.083 205)"
  },
  "color-success": {
    "$type": "color",
    "$value": "oklch(0.56 0.078 160)"
  },
  "color-warning": {
    "$type": "color",
    "$value": "oklch(0.76 0.132 78)"
  },
  "color-danger": {
    "$type": "color",
    "$value": "oklch(0.62 0.154 24)"
  },
  "color-danger-soft": {
    "$type": "color",
    "$value": "oklch(0.95 0.022 24)"
  },
  "color-info-soft": {
    "$type": "color",
    "$value": "oklch(0.95 0.015 226)"
  },
  "color-shadow": {
    "$type": "color",
    "$value": "oklch(0.3 0.02 222 / 0.08)"
  },
  "color-shadow-soft": {
    "$type": "color",
    "$value": "oklch(0.3 0.02 222 / 0.04)"
  }
}
```

### shadcn/ui CSS variables

```css
:root {
  --background: var(--color-paper);
  --foreground: var(--color-ink);
  --primary: var(--color-accent);
  --primary-foreground: var(--color-white);
  --muted: var(--color-paper-3);
  --muted-foreground: var(--color-ink-2);
  --border: var(--color-rule);
  --input: var(--color-rule-strong);
  --ring: var(--color-focus);
  --radius: var(--radius-sm);
}
```
