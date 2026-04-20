# DESIGN.md — Private Key & Account Manager

This file describes the full design system for this application. Use it as context when generating or refining UI with Google Stitch or implementing designs with Claude Code.

---

## App Overview

**Type:** Web SaaS app (desktop + mobile responsive)  
**Purpose:** Secure password, API key, and account credential manager  
**Target user:** Developers and power users managing many secrets  
**Platform:** React + TypeScript + Tailwind CSS, dark-first with light mode toggle

---

## Color Palette

### Background / Base
| Token | Hex | Usage |
|---|---|---|
| `base` | `#080812` | Page background (darkest) |
| `base-100` | `#0d0d1f` | Card backgrounds |
| `base-200` | `#111128` | Elevated card backgrounds |

### Surface
| Token | Hex | Usage |
|---|---|---|
| `surface` | `#14142b` | Input backgrounds, panels |
| `surface-100` | `#1c1c38` | Hover states on surfaces |
| `surface-200` | `#232345` | Borders, dividers |

### Brand / Accent
| Token | Hex | Usage |
|---|---|---|
| `primary` | `#7c6af7` | Primary buttons, active states, focus rings |
| `primary-hover` | `#6a57f0` | Button hover |
| `secondary` | `#38bdf8` | Cyan accent (Account entries, info) |
| `success` | `#34d399` | Positive states, strong passwords |
| `warning` | `#fbbf24` | Expiring items (within 30 days) |
| `error` | `#f87171` | Expired items, destructive actions |

### Text
| Token | Hex | Usage |
|---|---|---|
| `text` | `#e2e8f0` | Primary body text |
| `text-muted` | `#64748b` | Secondary text, labels |
| `text-dim` | `#475569` | Tertiary text, placeholders |

---

## Typography

- **Body / UI:** Inter (300–700) → fallback: system-ui
- **Monospace:** JetBrains Mono (400, 500) → fallback: Fira Code, Consolas
- Input font-size: 16px (prevents iOS zoom on focus)
- Secrets/passwords: font-mono, letter-spacing 0.18em

---

## Spacing & Layout

- Border radius: `12px` buttons/inputs, `16px` cards, `24px` modal tops
- Card padding: `16px`
- Grid: 1 col mobile → 2 col sm → 3 col lg
- Navigation: fixed top `~56px`, glass blur effect

---

## Component Patterns

### Buttons
- **Primary:** purple gradient `#7c6af7 → #6a57f0`, white text, glow on hover, lifts 1px
- **Secondary:** surface bg, border, muted text
- **Danger:** error tinted bg and text
- **Ghost:** transparent, surface bg on hover
- All: `rounded-xl`, `h-10` (40px), icon + text with `gap-2`

### Inputs
- bg: surface, border: surface-200, `rounded-xl`
- min-height: 48px (mobile tap targets)
- Focus: purple ring `ring-primary/40`

### Cards
- bg: `#0d0d1f`, subtle white inset border, `rounded-2xl`
- Hover: slight lift, inset purple glow

### Modals
- Mobile: bottom sheet slides up from bottom, rounded top corners
- Desktop: centered dialog, `max-w-lg`
- Overlay: `black/60` with backdrop blur

---

## Key Screens

### Dashboard (main)
- 4 stat cards at top (API Keys, Accounts, Expiring, Expired)
- Search + Filters + Add Entry button row
- Collapsible filter panel (type, sort, expired toggle)
- Category pill filter row
- Responsive entry card grid

### Login Page
- Centered glass card on dark background
- Master password input + Google/Apple OAuth buttons
- Subtle purple hero orb background effect

### Setup Page
- First-run wizard, centered card
- Password input with strength meter (4 colored bars)

### Entry Card
- Type badge (purple=API Key, cyan=Account)
- Masked secret value with reveal/copy actions
- Category pills, expiry indicator

---

## Stitch Prompt Template

```
A web SaaS application for developers to securely manage API keys and account credentials.
Dark theme: background #080812, primary purple #7c6af7, cyan accent #38bdf8.
Inter font for UI, JetBrains Mono for secrets.
Clean minimal aesthetic inspired by Linear and Vercel.

[DESCRIBE THE SPECIFIC SCREEN YOU WANT TO REDESIGN]

Maintain the purple/dark color palette. Glass card effects. 48px input min-height.
Purple gradient primary buttons with subtle glow.
```

---

## After Getting Stitch Designs

```
"Look at the Stitch design for [screen] and implement it as a React component
using Tailwind CSS. Use the color tokens from DESIGN.md. Keep existing TypeScript
types and API calls — only update the visual markup."
```
