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
- `--color-paper` oklch(0.982 0.008 159)
- `--color-paper-2` oklch(0.968 0.011 160)
- `--color-ink` oklch(0.262 0.036 171)
- `--color-ink-2` oklch(0.52 0.025 171)
- `--color-rule` oklch(0.864 0.023 166)
- `--color-accent` oklch(0.684 0.102 166)
- `--color-focus` oklch(0.67 0.089 166)

## Typography
- Display: Space Grotesk, weight 600, style normal
- Body: Noto Sans Thai, weight 400/500
- Mono: system ui-monospace
- Display tracking: neutral
- Type scale anchor: page heading uses compact editorial sizing, not landing-page hero sizing

## Spacing
4-point named scale, expressed through the app token layer in `globals.css`.

## Motion
- Easings: restrained ease-out only
- Reveal pattern: none by default
- Reduced-motion fallback: opacity-only, 150ms or less

## Microinteractions stance
- Silent success by default
- No decorative hover lift as the primary signal
- Focus states visible immediately
- Menus, filters, and drawers read as clinical controls, not promo UI

## CTA voice
- Primary CTA: solid green, rounded, direct verb copy
- Secondary CTA: white surface with clinical border, same radius rhythm

## Per-page allowances
- Marketing pages: not applicable
- App pages: no decorative enrichment
- Content pages: typography first, same shell language

## What pages MUST share
- WardFlow wordmark and logo
- Green accent family and restrained danger/warning colors
- Space Grotesk + Noto Sans Thai pairing
- Rounded clinical control language
- Calm panel rhythm, minimal glass, visible borders

## What pages MAY differ on
- Density and panel grouping by workflow
- Overview pages may use more patient/task summary cards
- Read-only pages may feel more document-like, but keep the same tokens
