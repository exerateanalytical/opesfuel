# OpesFuel Enterprise Design System Specification

> Reference specification for every public page, operations dashboard, modal form, data table, and mobile screen in OpesFuel.

---

## 1. Color System (Zero Color Collision · Zero Glow · Pure White Canvas)

| Token | Value | Strict Usage Rule |
| --- | --- | --- |
| **Page Canvas** | `#FFFFFF` | Pure crisp white across all public pages and operational dashboards. No green, yellow, or ash ambient background tints. |
| **Pure Glass White** | `rgba(255, 255, 255, 0.92)` + `backdrop-filter: blur(12px)` | Sticky headers, floating drawers, modal backdrops, and elevated summary strips. |
| **Obsidian Navy (Primary Brand Ink)** | `#0F172A` | Display headings, active navigation, **all Table Headers (`thead`)**, dark buttons, and modal headers. |
| **Brand Amber (Intentional Accent)** | `#D97706` (hover `#B45309`) | Primary CTA buttons, active tab underlines, slider accents, and focused input rings. Never used as a glowing shadow or background tint wash. |
| **Hairline Border** | `#E2E8F0` | 1px solid borders for cards, tables, and form inputs. |
| **Body Ink / Muted Ink** | `#1E293B` / `#64748B` | High-contrast readable text (WCAG AAA / AA+). |
| **Semantic Status (Text & Subtle Border Only)** | Emerald `#047857` / Red `#B91C1C` | Text indicators and compact status badges only—never full-section background glows. |

### Prohibited Anti-Patterns
- No glowing box-shadows (`shadow-amber-*`, `shadow-emerald-*`, neon halos)
- No colored background washes (no greenish, yellowish, or muddy ash ambient backgrounds)
- No solid color-filled icon boxes — all icons are crisp monochrome stroke icons (`#334155`, `#0F172A`, or `#FFFFFF` on dark headers)
- No overlapping double-white card-inside-card layers

---

## 2. Unified Typography (Identical on Landing Page & Dashboards)

| Role | Font Family | Weights | Tracking |
| --- | --- | --- | --- |
| **Display & Headings (`--font-display`)** | `Manrope` | `600`, `700`, `800` | `-0.02em` |
| **UI, Body, Forms & Tables (`--font-sans`)** | `Inter` | `400`, `500`, `600`, `700` | Normal (`cv02, cv03, cv04, cv11`) |
| **Financial FCFA, Litres & Codes (`--font-mono`)** | `IBM Plex Mono` | `400`, `500`, `600` | `tabular-nums` |

---

## 3. Data Tables Specification
- **Header (`thead`)**: Obsidian Navy (`#0F172A`) with crisp white uppercase labels (`text-[11px] font-semibold tracking-wider text-white`) and `12px 16px` cell padding.
- **Rows (`tbody tr`)**: Pure white `#FFFFFF` with `1px solid #E2E8F0` horizontal dividers and subtle `#F8FAFC` hover feedback.
- **Numeric Columns**: Always right-aligned using `IBM Plex Mono` (`font-mono tabular-nums`).

---

## 4. Popup Form Modal Specification (`FormModal`)
- **Action-First Pages**: Operational pages display clean, descriptive action buttons (e.g., `Onboard Station Employee`, `Record 20L Calibration`, `Log Cash Safe Drop`, `Add HR Contract`) — never sprawling inline forms cluttering tables.
- **Modal Anatomy**:
  - Obsidian Navy (`#0F172A`) header with title, concise 1-line subtitle, and accessible close (`X` + `Escape`) button.
  - Pure white (`#FFFFFF`) gap-free responsive 1-column / 2-column form grid with consistent `40px` height inputs, `#CBD5E1` borders, and `#D97706` focus ring.
  - Clean footer bar with `Cancel` and Primary Submit CTA that saves and closes the modal automatically.
