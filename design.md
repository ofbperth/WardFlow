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

## Motion
- Easings: restrained ease-out and ease-in-out only
- Reveal pattern: none by default
- Reduced-motion fallback: opacity-only, 150ms or less

## Microinteractions stance
- Silent success by default
- No decorative hover lift as the primary signal
- Focus states visible immediately
- Menus, filters, and drawers read as clinical controls, not promo UI

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

## What pages MAY differ on
- Density and panel grouping by workflow
- Overview pages may use more patient/task summary cards
- Read-only pages may feel more document-like, but keep the same tokens
