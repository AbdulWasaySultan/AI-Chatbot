# 10 — Design System and Visual Identity

## 1. Current state

- Look: generic AI SaaS dashboard — electric indigo `#635BFF` + cyan `#21C8D8` "brand-gradient", navy sidebar, rounded white cards with soft shadows, badge pills in pastel lavender/mint/amber/rose, Plus Jakarta Sans. It is the pattern the brief asks us to avoid.
- Tokens exist in `app/globals.css` (`--bg-canvas`, `--text-primary`, …) but most components hardcode colors inline (`#635BFF` appears hundreds of times).
- Tailwind runs from the CDN in the browser; the `fj` palette config from the legacy `frontend/index.html` is not active in the Next app.
- The whole dashboard is recolored with each tenant's primary/accent colors, so the product's own look changes per client and contrast is not guaranteed.
- Density is inconsistent: many 10–11 px labels next to 24 px headings; heavy use of uppercase micro-labels ("MULTI-TENANT SUB-ACCOUNT").
- Text encoding bugs render `â€¢`, `ðŸš€` in the UI.

## 2. Concept: the operator console

The product is where a business supervises staff who happen to be AI. The people using it every day are front-desk managers and agency operators. They need to scan, decide and act. The design should feel like a calm, precise operations console with the warmth of good paper stationery: **trustworthy, legible, quietly confident**.

Design words: *calm, exact, warm, accountable.* Not: futuristic, glowing, magical.

Visual metaphors used with restraint:
- **Paper and ink** for the canvas and text: warm off-white, near-black ink. Reads like a well-set document, not a neon cockpit.
- **Status lamps** for state: small, solid colored dots and bars that mean something specific (P0 red, P1/P2 orange, ok green). Color is reserved for meaning.
- **Ledger and transcript** for conversations and actions: monospaced metadata, clear timestamps, aligned columns.

## 3. Color

### 3.1 Principles

1. The interface is mostly neutral. Color appears only to signal state, priority or the single primary action.
2. One identity accent, **Brass**, used for brand moments, selection and focus — never for status.
3. Status colors are a closed set and never decorative.
4. No gradients on UI surfaces. No glassmorphism. Shadows only for elevation that matters (menus, dialogs).

### 3.2 Palette (light theme)

| Token | Value | Use |
|-------|-------|-----|
| `--paper` | `#F6F4EF` | App canvas |
| `--surface` | `#FFFFFF` | Panels, tables, inputs |
| `--surface-sunken` | `#EFECE5` | Wells, code blocks, inactive tabs |
| `--line` | `#E2DED4` | Hairline borders, dividers |
| `--line-strong` | `#CFC9BC` | Input borders, table header rule |
| `--ink` | `#16171A` | Primary text, primary buttons |
| `--ink-2` | `#4A4B4F` | Secondary text |
| `--ink-3` | `#76756F` | Tertiary text, placeholders (AA on `--surface` at ≥ 14 px) |
| `--brass` | `#8A6A35` | Accent text/icons on light (AA ≥ 4.5:1 on paper) |
| `--brass-fill` | `#C9A86A` | Selection bars, focus ring, brand mark |
| `--brass-wash` | `#F3EBDC` | Selected row, active nav item background |

### 3.3 Palette (dark theme)

| Token | Value |
|-------|-------|
| `--paper` | `#121315` |
| `--surface` | `#1A1B1E` |
| `--surface-sunken` | `#0E0F11` |
| `--line` | `#2A2B2F` |
| `--line-strong` | `#3A3B40` |
| `--ink` | `#EDEBE6` |
| `--ink-2` | `#B5B3AC` |
| `--ink-3` | `#8A8880` |
| `--brass` | `#D4B47A` |
| `--brass-fill` | `#B8955A` |
| `--brass-wash` | `#2A2418` |

Primary buttons invert: ink on paper in light mode, paper on ink in dark mode. This is deliberately unlike typical AI products and keeps the primary action unmistakable without needing a hue.

### 3.4 Status colors (both themes, tuned per theme)

| Meaning | Token | Light | Dark | Used for |
|---------|-------|-------|------|---------|
| Critical / P0 | `--critical` | `#B42318` | `#F04438` | Emergencies, failures, destructive confirm |
| Urgent / P1–P2 | `--urgent` | `#C2410C` | `#FB923C` | Handoffs, callbacks (solid); complaints, warnings, nearing quota (outlined) |
| Positive | `--positive` | `#067647` | `#47CD89` | Resolved, connected, published |
| Neutral info | `--info` | `--ink-2` | `--ink-2` | Informational notices use ink, not blue |

There is deliberately no yellow/amber status color: it would sit too close to brass and blur the line between identity and meaning. P1 and P2 share the orange hue and are separated by weight (solid vs outlined indicator) and label.

Every status is shown with **icon + label + color**, never color alone. P0 items additionally get a left rule and are pinned to the top of lists.

All pairs must meet WCAG 2.2 AA (4.5:1 for body text, 3:1 for large text and UI components). Final values are validated with an automated contrast check in CI before implementation sign-off; the values above are starting points.

## 4. Typography

| Role | Typeface | Why |
|------|----------|-----|
| UI text | **IBM Plex Sans** | Engineered, neutral, excellent at small sizes; feels like professional tooling rather than consumer SaaS |
| Data, IDs, timestamps, transcripts metadata | **IBM Plex Mono** | Same family as the UI text so the two sit well together; tabular alignment |
| Display (onboarding, empty states, marketing only) | **Instrument Serif** | A single warm, editorial counterpoint for moments that should feel human; never in dense UI |

Self-hosted through `next/font` (no runtime Google Fonts request). Scale (rem, 16 px base): 12 / 13 / 14 (body) / 16 / 18 / 22 / 28 / 36. Minimum UI text 12 px, body 14 px. Numbers in tables use tabular figures. Sentence case everywhere; uppercase micro-labels removed.

## 5. Space, layout and shape

- 4 px base grid; spacing tokens 4, 8, 12, 16, 20, 24, 32, 48, 64.
- Radius: 6 px for controls, 8 px for panels, 12 px for dialogs. No pill-shaped cards.
- Panels are separated primarily by hairline rules and spacing, not by stacks of shadowed cards. Lists and tables are first-class; cards are used only for genuinely independent objects (e.g. templates in a picker).
- Density: comfortable default; a compact mode for Inbox and Action Queue power users.
- Layout: left navigation rail (240 px, collapsible to 64 px), content max width 1280 px for forms and settings, full width for Inbox/Action Queue three-pane layouts.

## 6. Iconography

- Lucide icon set (consistent 1.5 px stroke, open license), 16 px in dense UI, 20 px in navigation.
- Replace the custom inline SVG map in `frontend/components/Icons.jsx` with the library to remove maintenance.
- Every icon-only button has an accessible name and a tooltip.

## 7. Components (owned library, built on Radix primitives)

Foundations: Button (primary/secondary/ghost/destructive; sizes sm/md), IconButton, Input, Textarea, Select, Combobox, Checkbox, Switch, RadioGroup, Slider, DatePicker, TimeRangePicker (for hours), PhoneInput (country-aware), Tag, Badge (status), Avatar, Tooltip, Popover, DropdownMenu, Dialog, Drawer (side sheet), Tabs, Toast, Skeleton, EmptyState, Banner (inline notices), Kbd.

Data: DataTable (sortable, filterable, column visibility, keyboard row navigation, cursor pagination), FilterBar (chips), Pagination, Stat (metric with comparison), Sparkline, BarChart, LineChart (built with Visx or Recharts, styled with tokens).

Domain: ConversationList, Transcript (message bubbles with role, timestamps, intents, tool call disclosures, citations), ActionCard, PriorityIndicator, WorkflowStepper (shows current workflow state in a conversation), CapabilityToggle (with requirement checklist), HoursEditor, LocationEditor, KnowledgeSourceRow (with indexing status), AgentStatusPill, IntegrationTile, CodeSnippet (copyable), WidgetPreview.

Each component: documented in a Storybook (or Ladle) with light/dark, all states, keyboard behavior; visual regression snapshots.

## 8. Motion

Purposeful only:
- 120–160 ms ease-out for hover/press/expand; 200 ms for drawers and dialogs; nothing longer in daily flows.
- New messages and new actions slide in 8 px and fade; P0 actions get one brief attention pulse on arrival, then stay static.
- Streaming text appears as it arrives; a subtle caret, no typewriter effect.
- Respect `prefers-reduced-motion`: disable translation, keep opacity changes only.
- No ambient animations (pinging dots, animated gradients, floating orbs). The current `animate-ping` toast dot and voice orb are removed from the dashboard (orb may remain only in the voice preview).

## 9. Data visualization

- Charts use ink and brass for the primary series, `--ink-3` for comparison; status colors only when the series is a status.
- Always show units, ranges and comparison period; empty and partial-data states explicit ("Collecting data — 2 days so far").
- No vanity metrics. Every number on Overview links to the list it summarizes.

## 10. White-label boundaries

| Surface | Whose brand |
|---------|------------|
| Operator dashboard | Platform identity (agencies may add their logo in the top-left in a later phase; colors stay platform tokens) |
| Web widget, hosted chat page | Workspace branding (logo, primary color, launcher text, avatar), contrast-checked |
| Customer-facing emails (booking confirmations) | Workspace branding |
| Staff notification emails | Platform identity with workspace name |

The branding editor previews the widget, not the dashboard, and warns when chosen colors fail contrast.

## 11. Accessibility

- WCAG 2.2 AA target across the dashboard and widget.
- Full keyboard operation; visible brass focus ring (2 px, offset 2 px); skip link; logical heading order.
- Forms: labels always visible, errors described in text and linked with `aria-describedby`.
- Live regions for streaming replies and new P0 actions (polite vs assertive appropriately).
- Destructive actions use an accessible confirm dialog, not `window.confirm`.
- Automated checks (axe) in component tests and E2E; manual screen-reader pass (VoiceOver, NVDA) on key flows before launch.

## 12. Product name and mark

The current brand "FJ-Tech Solutions / AI Command Center" reads as an agency name. The design system works with any name; choosing the product name is a business decision listed in 15. The mark should be a simple monogram that works at 16 px in ink and brass.

## Verification

- Token file is the only place colors are defined; a lint rule forbids hex literals in components.
- Contrast CI check passes for all token pairs in both themes.
- Storybook covers 100% of shared components with light/dark and keyboard stories.
- Design review against the "avoid" list in the brief: no purple/blue gradients, no glow, no glass, no decorative animation, no random accent colors.
