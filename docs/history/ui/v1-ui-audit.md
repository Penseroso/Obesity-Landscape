---
role: historical-audit
status: historical
authority: non-authoritative
update-boundary: Frozen closed audit; current UI behavior belongs in docs/ui/README.md.
---

# Obesity Landscape — V1 UI Audit

> Diagnostic-only audit of the V1 UI after Modules 1–3.1A. No implementation,
> data, registry, validator, generator, contract, or workflow file was changed
> as part of this audit. The only repository change is this report.
>
> **Update (Module 4.1, 2026-07-10):** UI-V1-004, UI-V1-008, and UI-V1-009 have
> been fixed. See the "Remediation status" line on each finding below and the
> updated Module 4.1 entry in section F. All other findings are unchanged from
> the original audit.
>
> **Update (Module 4.2, 2026-07-10):** UI-V1-012, UI-V1-013, UI-V1-014, and
> UI-V1-015 (drawer dialog semantics, focus management, Escape-to-close,
> scroll-lock) have been fixed. See the "Remediation status" line on each
> finding below and the updated Module 4.2 entry in section F. All other
> findings, including the deferred drawer *content-depth* limitation, are
> unchanged from the original audit.
>
> **Update (Module 4.3, 2026-07-10):** UI-V1-002, UI-V1-003, UI-V1-005,
> UI-V1-006, UI-V1-007, and UI-V1-010 (nav/title/description consistency,
> Overview date label, unified clinical-phase definition, Overview asset
> header, milestone-vs-clinical badge styling) have been fixed. See the
> "Remediation status" line on each finding below and the updated Module 4.3
> entry in section F. All other findings are unchanged from the original
> audit.
>
> **Update (Module 4.4, 2026-07-10):** UI-V1-001 (active navigation state)
> and UI-V1-011 (keyword search scope) have been fixed. See the
> "Remediation status" line on each finding below and the updated Module 4.4
> entry in section F. All findings are now remediated except the items
> explicitly marked as deferred/intentional V1 limitations in section E.

## A. Audit metadata

| Field | Value |
| --- | --- |
| Date | 2026-07-10 |
| Branch | `claude/v1-ui-audit` |
| Starting HEAD | `ab592af2d90042304d6071e72c4343dcd227d8c1` (merge of PR #24) |
| Working tree | Clean; identical to merged `main` for all `app/`, `components/`, `config/`, `lib/` files |
| Scope | Global shell, Overview, Program Register, Filters, Column customization, Program Detail Drawer (current integration only), responsive behavior, empty/sparse states, dataset integration |
| Framework | Next.js 16.2.6 (App Router), React 18.3.1, Tailwind 3.4.17, TypeScript 5.7.2, ESLint 9.17.0 |
| Dataset | 2 companies, 15 programs, 3 regimens (generated aggregates) |
| Commands run | `npm run lint`, `npm run build`, `git diff --check`, `data:validate:{registries,companies,generated,stress,synthetic}`; headless Chromium interaction + responsive checks at 390/768/1280/1600 px |

### Baseline verification (Task 1)

- Current branch at audit: `claude/v1-ui-audit`, cut from `main` at the expected commit.
- HEAD `ab592af…` matches the expected merged baseline exactly. **Audit is running from the correct baseline.**
- Working tree clean; PR #24 changes (Module 3 + Module 3.1A) are present.
- No open/unmerged local work affects the audit.

## B. Executive result

**Ready with non-blocking remediation.**

The app builds, lints, and passes all data validators; it reads generated data
read-only; core flows (filtering, column customization, register sort/interaction,
drawer open/close) work correctly. There are **no blockers**. Three **Major**
findings (mobile page-overflow on Overview, and two drawer accessibility gaps)
should be remediated before V2 depth work but do not block V1 as an internal
release.

## C. Surface summary

| Surface | Result | Notes |
| --- | --- | --- |
| Global shell / navigation | Minor issues | No active-nav state; nav/route/heading naming diverges; static document title + stale meta description. |
| Overview | 1 Major + minor | Horizontal page overflow at mobile; a latent label/semantic mismatch and cross-surface inconsistency, no live data impact. |
| Program Register | Minor | Correct columns/order/sort; table slightly exceeds page gutter (stage badges clipped by ~26px); milestone vs clinical badges not visually differentiated. |
| Filters | Clean | Options data-derived; combined filters, reset, and result count correct; IND/CTA milestones filter correctly and stay labeled as milestones. |
| Column customization | Clean | All Module 3.1A guarantees verified (locked Company/Asset, min-visible guard, reorder, reset, persistence, invalid-fallback, keyboard, Escape, focus, no overflow). |
| Drawer integration | 2 Major + minor | Opens on click/Enter/Space; Close button + backdrop work; **but** missing dialog semantics, no focus management, no Escape-to-close, no background scroll-lock. |
| Responsive | 1 Major | Overview overflows page at ≤~430px; Register table clips at ≥1280px (internal scroll). Tablet/wide fine. |
| Accessibility | Mixed | Strong on register table / column panel; drawer is the main gap. |
| Data / contract boundary | Clean | Read-only, registry-backed ordering, no maturity score, milestones not treated as clinical phases, admin fields kept distinct, sparse fields → N/A. |
| Static / build validation | Pass | lint ✅, build ✅, diff-check ✅, 5/5 data validators ✅. |

## D. Findings register

Severity legend: **Blocker** (release-stopping) · **Major** (fix before V2) ·
**Minor** (should fix) · **Polish** (optional).

---

### UI-V1-001 — No active/current navigation state
- **Severity:** Minor · **Surface:** Global shell · **Category:** accessibility / navigation
- **Observed:** Both header nav links (`Overview`, `Programs`) render identically on every route; no visual active state and no `aria-current="page"`.
- **Expected:** The link for the current route is visually indicated and exposes `aria-current="page"`.
- **Repro:** Visit `/` then `/assets`; nav appearance is unchanged.
- **Files:** `app/layout.tsx`
- **Probable cause:** Nav links are static `next/link` with hover-only styling; no `usePathname` active logic.
- **Confidence:** Confirmed
- **Remediation scope:** Small (add active class + `aria-current` via a client nav component).
- **Blocks V1 closure:** No · **Fix before V2:** Optional.
- **Remediation status (Module 4.4, 2026-07-10):** **Fixed.** Extracted the nav into a new small client component, `components/PrimaryNav.tsx`, using `usePathname()` to compare the current route against each nav item's `href`. The active link gets `aria-current="page"` and a persistent `bg-muted font-semibold text-foreground` treatment (the same tone vocabulary already used for hover states elsewhere, just persistent instead of hover-only); the inactive link keeps its original hover-only style. `app/layout.tsx` itself stays a server component - only the nav was extracted. Nav labels and routes are unchanged. Verified: on `/`, the Overview link has `aria-current="page"` and the active class, Program Register does not; on `/assets`, the reverse; Tab/Enter keyboard navigation through both links still works and still navigates correctly.

### UI-V1-002 — Destination named three different ways
- **Severity:** Minor · **Surface:** Global shell / Register · **Category:** semantic accuracy / consistency
- **Observed:** The same destination is the nav label `Programs`, the route `/assets`, and the page H1 `Program Register`.
- **Expected:** Consistent product naming across nav label, heading, and (ideally) route.
- **Repro:** Compare header nav ("Programs") with the page H1 ("Program Register").
- **Files:** `app/layout.tsx`, `app/assets/page.tsx`
- **Probable cause:** Nav label and route predate the Module 3 rename to "Program Register"; route path `/assets` is legacy.
- **Confidence:** Confirmed
- **Remediation scope:** Small for label; route rename is larger (redirects) — treat route as optional.
- **Blocks V1 closure:** No · **Fix before V2:** Recommended (label only).
- **Remediation status (Module 4.3, 2026-07-10):** **Fixed (label only, as scoped).** Changed the nav link text in `app/layout.tsx` from "Programs" to "Program Register", matching the page H1. The `/assets` route itself is unchanged (route rename was explicitly out of scope). Verified: nav label and H1 both read "Program Register".

### UI-V1-003 — Static document title and stale meta description
- **Severity:** Minor · **Surface:** Global shell · **Category:** semantic accuracy
- **Observed:** `metadata.title` is `"Obesity Landscape"` for every route (no per-page title); `metadata.description` is `"Frontend skeleton for obesity/incretin competitive programs."` — internal/dev-oriented copy exposed in the public `<meta name="description">`.
- **Expected:** Per-route titles (e.g. "Program Register — Obesity Landscape") and a product-facing description without "skeleton".
- **Repro:** Inspect `<head>` on `/` and `/assets`; both share the same title/description.
- **Files:** `app/layout.tsx`
- **Probable cause:** Root metadata never revisited after Module 1.
- **Confidence:** Confirmed
- **Remediation scope:** Small (per-route `metadata` / `generateMetadata`).
- **Blocks V1 closure:** No · **Fix before V2:** Recommended.
- **Remediation status (Module 4.3, 2026-07-10):** **Fixed.** Root layout metadata now uses a title template (`{ default: "Obesity Landscape", template: "%s — Obesity Landscape" }`) and a product-facing description ("A searchable register of obesity/incretin development programs and competitive landscape data.", no "skeleton"). `app/assets/page.tsx` adds `metadata.title = "Program Register"`, which correctly resolves through the template to "Program Register — Obesity Landscape" since `/assets` is a true child segment. `app/page.tsx` (the root Overview page) sits in the *same* route segment as the root layout, so Next.js's title template does not apply there (a real, verified Next.js metadata-resolution quirk — templates only apply across parent→child segment boundaries, not within the same segment); Overview's `metadata.title` is set to the full string `"Overview — Obesity Landscape"` directly to get the same distinct-title behavior. Verified: `document.title` is `"Overview — Obesity Landscape"` on `/` and `"Program Register — Obesity Landscape"` on `/assets`; `<meta name="description">` no longer contains "skeleton".

### UI-V1-004 — Overview page overflows horizontally on mobile
- **Severity:** **Major** · **Surface:** Overview / Responsive · **Category:** responsiveness
- **Observed:** At 390px viewport the document scrolls horizontally (`documentElement.scrollWidth` ≈ 718 > 390). The Route Mix and Most Advanced Programs panels — single-column grid items — are ~698px wide and drive a body-level horizontal scrollbar. Hero, metadata strip, and the matrix card stay contained.
- **Expected:** No page-level horizontal scroll at mobile widths; secondary panels shrink to the viewport (their inner tables may scroll internally).
- **Repro:** Open `/` at 390px width → page scrolls sideways; Route Mix / Most Advanced panels extend past the right edge.
- **Files:** `app/page.tsx` (the `grid items-stretch gap-6 md:grid-cols-2` section), `components/RouteMixPanel.tsx`, `components/MostAdvancedProgramsTable.tsx`
- **Probable cause:** Grid items default to `min-width: auto`; the inner tables' intrinsic min-widths (`min-w-[420px]` mini-table; fixed `DistributionBar` track/label widths) propagate up and stretch the single-column track beyond the viewport. The Register avoids this because its table wrapper is a block child, not a grid item.
- **Confidence:** Confirmed
- **Remediation scope:** Small (`min-w-0` on the grid items / panel roots; ensure inner scroll wrappers set `min-w-0`).
- **Blocks V1 closure:** No (functionality intact) · **Fix before V2:** **Yes.**
- **Remediation status (Module 4.1, 2026-07-10):** **Fixed.** Added `min-w-0` to the `RouteMixPanel` and `MostAdvancedProgramsTable` root `<section>` elements so they can shrink below their content's intrinsic min-width instead of stretching the single-column grid track. Verified: `documentElement.scrollWidth === clientWidth` (no page overflow) at 390/768/1280/1600px; desktop 2-column layout at ≥768px unchanged (screenshot-verified).

### UI-V1-005 — "Latest verified" label shows `updatedAt`, not `lastVerifiedAt`
- **Severity:** Minor · **Surface:** Overview · **Category:** semantic accuracy
- **Observed:** `OverviewMetadataStrip` labels the date metric **"Latest verified"**, but the value is `getLatestUpdateDate()`, which reads `metadata.updatedAt`. In the current dataset `updatedAt === lastVerifiedAt` for all 15 programs (0 divergence), so the displayed `2026-07-08` is coincidentally correct.
- **Expected:** Either read `metadata.lastVerifiedAt` to match the label, or relabel to "Latest updated".
- **Repro:** Code inspection; would surface if any program's `updatedAt` differs from `lastVerifiedAt`.
- **Files:** `components/OverviewMetadataStrip.tsx`, `lib/programs/selectors.ts` (`getLatestUpdateDate`), `app/page.tsx`
- **Probable cause:** Label wording ("verified") diverged from the selector's field (`updatedAt`).
- **Confidence:** Confirmed (latent; no current visual impact)
- **Remediation scope:** Small (one selector field or one label word).
- **Blocks V1 closure:** No · **Fix before V2:** Recommended.
- **Remediation status (Module 4.3, 2026-07-10):** **Fixed (relabel, not reread).** Changed the `OverviewMetadataStrip` label from "Latest verified" to "Latest updated" so it matches the actual field the selector reads (`metadata.updatedAt` via `getLatestUpdateDate`), rather than switching the data source to `lastVerifiedAt` (lower risk; no selector-return-value change). Verified: the metadata strip now reads "... LATEST UPDATED" with the same date value as before.

### UI-V1-006 — "Clinical-phase" count vs matrix Filed/Approved bucketing
- **Severity:** Minor · **Surface:** Overview · **Category:** semantic accuracy / consistency
- **Observed:** `getClinicalStageProgramCount` counts every stage with `sortRank ≥ 40`, which includes `Filed` (70) and `Approved` (80). The Company × Stage matrix places those same stages in a distinct **Filed / Approved** bucket, separate from the Phase columns. So a Filed/Approved program would be counted as "clinical-phase" in the metadata strip while shown as post-clinical in the matrix. No `Filed`/`Approved` programs exist in the current dataset, so there is **no live impact**; the `6` clinical-phase count is correct today (Phase 2×4 + Phase 1b + Phase 3), correctly excluding the 3 IND milestones.
- **Expected:** A single, consistent definition of "clinical-phase" across both Overview surfaces (e.g. Phase 1–3 only, excluding Filed/Approved), matching the "Clinical-phase" label.
- **Repro:** Add a hypothetical `Filed` program → it increments the "Clinical-phase" count but appears in the matrix's Filed/Approved bucket.
- **Files:** `lib/programs/constants.ts` (`clinicalDevelopmentStages` rank≥40; `stageBuckets`), `lib/programs/selectors.ts`
- **Probable cause:** Two independent stage groupings (rank threshold vs family bucket) with no shared "clinical phases" definition.
- **Confidence:** Probable (latent; depends on future data)
- **Remediation scope:** Small–Medium (unify the definition).
- **Blocks V1 closure:** No · **Fix before V2:** Recommended (do not reopen the registry data — this is a UI selector decision).
- **Remediation status (Module 4.3, 2026-07-10):** **Fixed.** Redefined `clinicalDevelopmentStages` in `lib/programs/constants.ts` to derive from the same `phase-1`/`phase-2`/`phase-3` stage buckets used by the Company × Development Stage Matrix (via the existing `getStageBucketId`/`stageBuckets` machinery), instead of an independent `sortRank >= 40` threshold. Clinical-phase now means Phase 1–3 only (including sub-phases like "Phase 1b" and the combined "Phase 1/2" stage) and explicitly excludes Filed and Approved, eliminating the drift risk the finding described — both Overview surfaces now share one definition. The `data/registries/development-stages.json` registry data itself was not touched; only the UI-layer selector logic changed. Also added `isRegulatoryMilestoneStage()` (reused for UI-V1-010). Verified: current count is unchanged at 6 (Phase 2×4 + Phase 1b + Phase 3, still correctly excluding the 3 IND milestones); `npm run data:validate:registries` and the other 4 data validators still pass.

### UI-V1-007 — Overview mini-table header "Asset / Code" vs Register "Asset"
- **Severity:** Polish · **Surface:** Overview vs Register · **Category:** visual consistency
- **Observed:** `MostAdvancedProgramsTable` header reads **"Asset / Code"**; the Program Register deliberately uses **"Asset"** (Module 3 removed "/ Code" from that header). Same underlying concept, two headers.
- **Expected:** Consistent asset-column header wording across surfaces.
- **Files:** `components/MostAdvancedProgramsTable.tsx`, `config/program-table.ts`
- **Confidence:** Confirmed
- **Remediation scope:** Trivial.
- **Blocks V1 closure:** No · **Fix before V2:** Optional.
- **Remediation status (Module 4.3, 2026-07-10):** **Fixed.** Changed the Overview mini-table header in `components/MostAdvancedProgramsTable.tsx` from "Asset / Code" to "Asset", matching the Register. Verified: header now reads "ASSET" on both surfaces.

### UI-V1-008 — Register table clipped by the page gutter at ≥1280px
- **Severity:** Minor · **Surface:** Program Register / Responsive · **Category:** responsiveness
- **Observed:** The register table's natural content width is ~1240px; the `max-w-7xl` content column is ~1214px inner. The table's `overflow-x-auto` wrapper contains it (no page overflow), but the **Development Stage** column and its stage badges are clipped by ~26px and require internal horizontal scroll to read fully — at every width ≥1280 (identical at 1280 and 1600 because the page is width-capped).
- **Expected:** All 7 default columns, including the primary Development Stage badge, are fully visible at common laptop/desktop widths without horizontal scrolling.
- **Repro:** Open `/assets` at 1280 or 1600 → rightmost stage badges ("IND submitted", etc.) are cut at the card's right edge.
- **Files:** `components/PipelineTable.tsx` (table `w-full min-w-[980px]`, per-column truncation widths), `app/layout.tsx` (`max-w-7xl` shell)
- **Probable cause:** Sum of column min/padding widths (~1240) exceeds the shell content width; noted as a caveat in Module 3.
- **Confidence:** Confirmed
- **Remediation scope:** Small–Medium (tighten column widths, reduce padding, or widen the shell for this route).
- **Blocks V1 closure:** No · **Fix before V2:** Recommended (primary indicator partially hidden by default).
- **Remediation status (Module 4.1, 2026-07-10):** **Fixed.** Reduced header/cell padding from `px-4` to `px-3` and rebalanced per-column truncation max-widths in `components/PipelineTable.tsx` (no columns hidden or merged; same 7 default columns/order). Verified: at 1280px and 1600px the table's `scrollWidth` now exactly equals its wrapper's `clientWidth` (1214px, no clipping) — all 7 columns including full Development Stage badges ("IND submitted", "IND cleared", etc.) are visible with zero horizontal scroll. At 390/768px the table still scrolls internally within its own `overflow-x-auto` wrapper (page itself does not overflow) — the shell (`app/layout.tsx`) was not touched.

### UI-V1-009 — Company column truncates even when space is available
- **Severity:** Polish · **Surface:** Program Register · **Category:** visual consistency
- **Observed:** The Company cell truncates at `max-w-[140px]`, cutting "Ascletis Pharma Inc." to "Ascletis Pharma I…" even where horizontal room exists. A `title` tooltip preserves the full value.
- **Expected:** Company names fit at common widths, or truncate less aggressively.
- **Files:** `components/PipelineTable.tsx` (`truncatedCellClassName.company`)
- **Confidence:** Confirmed
- **Remediation scope:** Trivial (raise max-width).
- **Blocks V1 closure:** No · **Fix before V2:** Optional.
- **Remediation status (Module 4.1, 2026-07-10):** **Fixed.** Raised the Company column's truncation width from `max-w-[140px]` to `max-w-[175px]` (part of the same rebalance as UI-V1-008). Verified: "Ascletis Pharma Inc." (the longest current company name) now renders in full with no ellipsis at 1280/1600px, screenshot-confirmed; `title` tooltip retained as a fallback for longer names.

### UI-V1-010 — Milestone vs clinical stage badges not visually differentiated in the Register
- **Severity:** Minor · **Surface:** Program Register · **Category:** visual consistency / semantic accuracy
- **Observed:** In the Development Stage column, regulatory milestones (`IND submitted`, `IND cleared`) use the identical `StageBadge` style as clinical phases (`Phase 2`, `Phase 3`). Distinction relies entirely on the label text. (The Overview matrix *does* separate them via a dedicated column + color legend.)
- **Expected:** Consistent with Module 3's "keep regulatory milestones visually and semantically distinct from clinical phases" — some non-text differentiation (tone/border) in the register badge.
- **Files:** `components/StageBadge.tsx`, `components/PipelineTable.tsx`
- **Probable cause:** `StageBadge` is a single style for all stage values.
- **Confidence:** Probable (semantically distinct by label; visually uniform)
- **Remediation scope:** Small (variant by stage family, reusing registry `family`).
- **Blocks V1 closure:** No · **Fix before V2:** Recommended.
- **Remediation status (Module 4.3, 2026-07-10):** **Fixed.** `StageBadge` now renders a visually distinct variant for regulatory-development milestones — dashed border, muted background/text (`bg-muted`/`text-muted-foreground`) — versus the existing solid `bg-accent` treatment for clinical phases (and Preclinical/Filed/Approved). The distinction is derived from `isRegulatoryMilestoneStage()`, which reuses the existing registry-backed `family` classification (the same one driving the matrix's bucket columns), not a hardcoded stage-name list. Border style + tone differ (not hue alone), so the distinction doesn't rely on color perception. Verified in the Register: "IND submitted"/"IND cleared" render dashed/muted; "Phase 1b"/"Phase 2"/"Phase 3"/"Preclinical" render the original solid style (screenshot-confirmed). The Overview mini-table's separate inline badge markup was intentionally left as-is — out of scope (would be an Overview redesign) and not in this finding's file list.

### UI-V1-011 — Keyword search matches internal identifiers
- **Severity:** Polish · **Surface:** Filters · **Category:** functionality / maintainability
- **Observed:** Keyword matching includes internal tokens (`id`, `assetId`, `companyId`) not shown in the UI; e.g. typing the company slug `zealand-pharma` returns 5 rows. Placeholder ("Search programs, mechanisms, platforms") understates the true scope.
- **Expected:** Either match only user-visible fields, or document the broad scope; keep placeholder honest.
- **Files:** `lib/programs/filters.ts` (`searchable` array)
- **Confidence:** Confirmed (behavior is intentional/broad, not a crash)
- **Remediation scope:** Small.
- **Blocks V1 closure:** No · **Fix before V2:** Optional.
- **Remediation status (Module 4.4, 2026-07-10):** **Fixed (restricted to visible fields).** Removed `program.id`, `program.assetId`, `program.companyId`, and `companyCountry` from the `searchable` array in `lib/programs/filters.ts`; keyword matching now covers only company name, asset name, code name, mechanism, platform, route, dosage form, dosing interval, indications, development stage, and status - fields represented somewhere in the Register UI. Updated the FilterBar placeholder from "Search programs, mechanisms, platforms" to "Search company, asset, mechanism, indication" to stay truthful to the scope. Verified: the internal company slug `zealand-pharma` and an internal program-id fragment (`ascletis-pharma-asc30`) now return 0 results; company name, asset name, code name, mechanism, indication, route, dosage form, dosing interval, stage, and status terms all still return matches; combined structured-filter + keyword search and Reset filters still work correctly.

### UI-V1-012 — Drawer lacks dialog semantics
- **Severity:** **Major** · **Surface:** Drawer integration · **Category:** accessibility
- **Observed:** The drawer `<aside>` has no `role="dialog"` and no `aria-modal="true"`; it is not announced as a modal to assistive tech. The full-screen backdrop is a `<button aria-label="Close program detail">` in the tab order.
- **Expected:** The drawer is a labeled dialog (`role="dialog"`, `aria-modal`, `aria-labelledby` to the asset heading).
- **Repro:** Open a program → inspect `<aside>`; `role`/`aria-modal` are absent.
- **Files:** `components/ProgramDetailDrawer.tsx`
- **Probable cause:** V1 drawer implemented as a plain positioned panel; dialog semantics deferred with the drawer redesign.
- **Confidence:** Confirmed
- **Remediation scope:** Small (attributes), or fold into the deferred V2 drawer redesign.
- **Blocks V1 closure:** No · **Fix before V2:** **Yes** (basic a11y, independent of content depth).
- **Remediation status (Module 4.2, 2026-07-10):** **Fixed.** Added `role="dialog"`, `aria-modal="true"`, and `aria-labelledby` (pointing to the asset-name `<h2>` via `useId()`) on the `<aside>` in `components/ProgramDetailDrawer.tsx`. Verified: `getAttribute('role') === 'dialog'`, `aria-modal === 'true'`, and the `aria-labelledby` target's text matches the displayed asset name.

### UI-V1-013 — Drawer has no focus management
- **Severity:** **Major** · **Surface:** Drawer integration · **Category:** accessibility
- **Observed:** Opening the drawer does **not** move focus into it (focus stays on the triggering table row); focus is **not trapped** within the overlay; closing does **not** restore focus to the trigger. Keyboard/AT users can tab into content behind the overlay.
- **Expected:** On open, focus moves into the dialog (e.g. Close button/heading); Tab is trapped; on close, focus returns to the originating row.
- **Repro:** Open drawer via Enter on a row → `document.activeElement` remains the `<tr>`; Tab reaches page content behind the panel.
- **Files:** `components/ProgramDetailDrawer.tsx`, `components/PipelineTable.tsx` (row activation)
- **Probable cause:** No focus lifecycle implemented for the V1 drawer.
- **Confidence:** Confirmed
- **Remediation scope:** Small–Medium (focus-on-open, trap, restore-on-close), or fold into the V2 drawer redesign.
- **Blocks V1 closure:** No · **Fix before V2:** **Yes.**
- **Remediation status (Module 4.2, 2026-07-10):** **Fixed.** `ProgramDetailDrawer` now focuses the Close button on open (or when the displayed program changes), traps Tab/Shift+Tab within the panel via a `keydown` listener (redirects to the first/last focusable element at the boundary, or whenever focus is found outside the panel), and `PipelineTable` now tracks the exact triggering `<tr>` in a ref and calls `.focus()` on it from a single `closeDrawer` handler used by every close path. Verified: focus lands on the Close button on open; Tab and Shift+Tab both stay inside the `<aside>` across repeated presses; after closing via Escape, the Close button, and the backdrop, focus returns to the exact row that opened the drawer in each case (asserted by DOM node identity, not just tag name).

### UI-V1-014 — Escape does not close the drawer
- **Severity:** Minor · **Surface:** Drawer integration · **Category:** accessibility / UX
- **Observed:** The drawer closes via the Close button and a backdrop click, but **not** via the Escape key.
- **Expected:** Escape dismisses the modal (standard dialog behavior).
- **Repro:** Open drawer → press Escape → drawer stays open.
- **Files:** `components/ProgramDetailDrawer.tsx`
- **Probable cause:** No `keydown`/Escape handler in the drawer.
- **Confidence:** Confirmed
- **Remediation scope:** Small.
- **Blocks V1 closure:** No · **Fix before V2:** Recommended (pairs with UI-V1-012/013).
- **Remediation status (Module 4.2, 2026-07-10):** **Fixed.** The same `keydown` listener added for the focus trap also handles `Escape`, calling the drawer's `onClose` prop. Verified: pressing Escape while the drawer is open closes it (previously it stayed open).

### UI-V1-015 — Background not scroll-locked while drawer is open
- **Severity:** Minor · **Surface:** Drawer integration · **Category:** UX
- **Observed:** With the drawer open, `document.body` overflow stays `visible`; the page behind the overlay still scrolls.
- **Expected:** Background scroll is locked while the modal is open.
- **Repro:** Open drawer on a short viewport → scroll → page behind moves.
- **Files:** `components/ProgramDetailDrawer.tsx`
- **Confidence:** Confirmed
- **Remediation scope:** Small.
- **Blocks V1 closure:** No · **Fix before V2:** Optional (pairs with drawer a11y work).
- **Remediation status (Module 4.2, 2026-07-10):** **Fixed.** An effect sets `document.body.style.overflow = "hidden"` while a program is displayed, saving the prior inline value first and restoring exactly that value on close or unmount (not a hardcoded `"visible"`, so any future pre-existing inline override is preserved). Verified: `getComputedStyle(document.body).overflow === "hidden"` while open, `"visible"` after close, and a mouse-wheel event while open produces no `window.scrollY` change.

---

### Verified-correct areas (no findings)

- **Program Register defaults:** exact columns/order — Company, Asset, Mechanism, Dosage Form, Route, Dosing Interval, Development Stage — confirmed; header/cell alignment correct.
- **Default sort:** development-stage registry rank (most advanced first), then company, then asset. Verified live: Phase 3 → Phase 2 (Ascletis before Zealand, ASC30 grouped) → Phase 1b → **IND cleared (32) before IND submitted (31)** → Preclinical.
- **Filters:** all-option labels ("All companies/indications/routes/stages/statuses"); options data-derived; combined filtering, reset, and `{filtered} of {total} programs shown` count all correct; Stage filter includes IND milestones as stage options and filters them correctly, badges remain "IND submitted"/"IND cleared" (never mislabeled clinical); Status derives from data independently of Stage.
- **Empty states:** distinct dataset-empty vs filtered-zero messaging; filtered-zero offers a Reset filters action (verified restores 15 rows).
- **Column customization (Module 3.1A):** Company/Asset locked (visible + first/second, checkbox & move disabled); optional columns show/hide/reorder; ≥1 optional column enforced (last one's checkbox disables); Reset columns restores exact default; Reset filters leaves columns untouched; refresh preserves valid prefs; invalid JSON → defaults; unknown IDs ignored; missing IDs appended predictably; keyboard-only operation, Escape-close, focus-return-to-trigger all work; panel stays within the viewport at 390px; storage key `obesity-landscape.program-register.columns.v1` used, no hydration errors.
- **Drawer (working parts):** correct program opens; click/Enter/Space activation; Close button and backdrop-click close; inner content scrolls; source links open in a new tab with `rel="noreferrer"` and title/URL fallback; sparse fields render "N/A".
- **Data / contract boundary:** UI reads generated aggregates read-only; registry-backed stage ordering; no maturity score invented; IND/CTA never counted or filtered as clinical phases; Route / Dosage Form / Dosing Interval kept as three distinct columns; sparse `platform` (5 nulls) and `dosingInterval` (1 null) render "N/A"; no data mutation.
- **Static/build:** `npm run lint` ✅, `npm run build` ✅ (3 static routes), `git diff --check` ✅, and all 5 `data:validate:*` scripts ✅.

## E. V1 closure recommendation

- **Blockers:** none.
- **Required before V2 depth work:** UI-V1-004 (mobile overflow), UI-V1-012 & UI-V1-013 (drawer dialog semantics + focus management), UI-V1-014 (Escape-to-close), UI-V1-005 (verified/updated label), UI-V1-008 (register stage-badge clipping). UI-V1-002/003/006/010 recommended.
- **Optional polish:** UI-V1-001 (active nav), UI-V1-007 (header wording), UI-V1-009 (company truncation), UI-V1-011 (keyword scope/placeholder), UI-V1-015 (scroll-lock).
- **Intentional V1 limitations (not defects):** shallow Program Detail Drawer *content depth*; sparse optional fields shown as "N/A"; single-locale English UI. Note: the drawer *accessibility* gaps (012–015) are implementation defects, distinct from the deferred content-depth limitation.
- **Deferred V2 items (correctly absent — the UI does not falsely imply they exist):** full drawer redesign, deep clinical-trial/efficacy/safety views, program profile pages, company profile pages, company comparison dashboard, regimen relationship visualization, timeline/change history, saved named views, CSV export, server-side preference storage.

## F. Recommended remediation sequence

Grouped into the smallest reasonable follow-up modules:

- **Module 4.1 — Responsive & layout fixes:** UI-V1-004, UI-V1-008, UI-V1-009. (Grid `min-w-0`; register table width vs. page gutter; company truncation.) Small, self-contained, high user-visible value. **Status: done (2026-07-10)** — see per-finding "Remediation status" entries above.
- **Module 4.2 — Drawer accessibility hardening:** UI-V1-012, UI-V1-013, UI-V1-014, UI-V1-015. Dialog role + `aria-modal` + label, focus trap/restore, Escape, scroll-lock. May be merged into the deferred V2 drawer redesign if that lands first, but the a11y basics should not wait on content depth. **Status: done (2026-07-10)** — see per-finding "Remediation status" entries above.
- **Module 4.3 — Copy & semantic accuracy:** UI-V1-002, UI-V1-003, UI-V1-005, UI-V1-006, UI-V1-007, UI-V1-010. Nav/label/title consistency, "Latest verified" vs `updatedAt`, unified clinical-phase definition (UI-only; do not reopen the registry data), asset-header consistency, milestone badge differentiation. **Status: done (2026-07-10)** — see per-finding "Remediation status" entries above.
- **Module 4.4 — Navigation & filter polish (optional):** UI-V1-001 (active nav + `aria-current`), UI-V1-011 (keyword scope / placeholder honesty). **Status: done (2026-07-10)** — see per-finding "Remediation status" entries above.

## Validation results (post-report)

Re-run after writing this report (report is the only working-tree change):

| Command | Result |
| --- | --- |
| `git diff --check` | Clean (exit 0) |
| `npm run lint` | Pass (exit 0) |
| `npm run build` | Pass — 3 static routes (`/`, `/_not-found`, `/assets`) |

No implementation, data, registry, validator, generator, contract, or workflow
file was changed by this audit.

---

## G. Module 4.5 — V1 UI Closure

- **Closure date:** 2026-07-10
- **Final branch:** `claude/responsive-layout-remediation`
- **Final HEAD:** `24bea7c25bce3e8d7504d5a372e2d08f41d84811` (Module 4.4; unchanged by this closure pass — no implementation change was needed)
- **Final verdict: `V1 UI closed`**

### Finding disposition summary

All 15 findings (UI-V1-001 through UI-V1-015) carry a "Remediation status: **Fixed**" entry, dated and attributed to the module that fixed them (4.1: 004/008/009; 4.2: 012/013/014/015; 4.3: 002/003/005/006/007/010; 4.4: 001/011). Re-verification below confirms none remain reproducible. No finding was rewritten, renumbered, or reinterpreted to reach this disposition — the original observed/expected/repro text for every finding is unchanged from the baseline audit (`claude/v1-ui-audit`); only "Remediation status" lines were appended.

### Re-verification performed for closure (2026-07-10)

All re-run live against a freshly built dev server (cache cleared) at 390/768/1280/1600px:

- **Overview responsive:** no page-level horizontal overflow at any of the four widths (390px: `scrollWidth === clientWidth`); 2-column `RouteMixPanel`/`MostAdvancedProgramsTable` grid confirmed active at 768px and wider.
- **Program Register responsive:** no page-level overflow at any width; table fits its wrapper exactly at 1280/1600px (`scrollWidth === clientWidth`, zero clipping) — all 7 default columns and every Development Stage badge fully visible; at 390/768px the table correctly scrolls internally within its own wrapper instead of overflowing the page.
- **Default columns/order/sort:** Company, Asset, Mechanism, Dosage Form, Route, Dosing Interval, Development Stage, in that order; sort confirmed Phase 3 → Phase 2 (company/asset tiebreak) → Phase 1b → IND cleared (rank 32) → IND submitted (rank 31) → Preclinical.
- **Filters/result count/reset:** Stage=`IND submitted` → 2/15, badges stay labeled "IND submitted" (never relabeled clinical); Reset filters restores 15/15.
- **Keyword search scope:** internal company slug `zealand-pharma` → 0 results (previously 5); visible company name, mechanism, and other UI-represented terms still match.
- **Column customization:** showing an optional column persists after a hard refresh; Reset to default restores the exact default set; deliberately corrupt `localStorage` JSON falls back safely to defaults — all via the `obesity-landscape.program-register.columns.v1` key.
- **Drawer:** opens via click, Enter, and Space; `role="dialog"`, `aria-modal="true"`, `aria-labelledby` all present; focus lands on the Close button on open; Tab remains trapped inside the panel; Escape closes it; body `overflow` is `hidden` while open and restored to `visible` after close; focus returns to the exact triggering row (DOM-node-identity check) after close.
- **Navigation:** `aria-current="page"` present only on the active route's link (Overview on `/`, Program Register on `/assets`), with matching active styling.
- **Metadata/copy:** `document.title` is `"Overview — Obesity Landscape"` on `/` and `"Program Register — Obesity Landscape"` on `/assets`; meta description no longer contains "skeleton"; Overview metadata strip reads "LATEST UPDATED" (not "verified").
- **Clinical-phase semantics:** metadata strip shows `6` clinical-phase programs (Phase 2×4 + Phase 1b + Phase 3), unified with the matrix's Phase 1/2/3 buckets; a hypothetical Filed/Approved record is excluded by definition (`clinicalDevelopmentStages` no longer uses a `sortRank >= 40` threshold that swept them in); IND/CTA milestones are never counted as clinical phases and now render with a visually distinct dashed/muted badge in the Register.
- **No V2 feature introduced:** `git diff ab592af..HEAD --stat` (the full Module 4 remediation range) touches exactly 13 implementation files plus this report — no company-comparison, clinical-results, regimen-relationship, CSV-export, saved-view, or authentication code exists anywhere in the diff; no new route was added; `package.json`/`package-lock.json` are byte-identical to `ab592af` (no new dependency).

### Final validation results

| Command | Result |
| --- | --- |
| `npm run lint` | Pass (exit 0) |
| `npm run build` | Pass — 3 static routes (`/`, `/_not-found`, `/assets`) |
| `git diff --check` | Clean (exit 0) |
| `npm run data:validate:registries` | Pass — "Validated registries." |
| `npm run data:validate:companies` | Pass — "Validated 2 company source folder(s)." |
| `npm run data:validate:generated` | Pass — "Validated generated aggregate with 2 company record(s), 15 program record(s), and 3 regimen record(s)." |
| `npm run data:validate:stress` | Pass — "Validated 1 stress-test diagnostic archive(s)." |
| `npm run data:validate:synthetic` | Pass — "Validated synthetic fixtures." |

All checks passed; no implementation change was required or made during this
closure pass.

### Remaining intentional V1 limitations

Unchanged from section E — these are deliberate V1 scope boundaries, not
defects: shallow Program Detail Drawer *content depth* (record fields only,
no clinical-trial detail); sparse optional fields (`platform`,
`dosingInterval`, etc.) rendered as "N/A" rather than inferred; single-locale
English UI (the underlying i18n label structure in
`config/program-table.ts` still supports Korean labels, just not switched on
by default).

### Deferred V2 scope

Unchanged from section E — confirmed still correctly absent from the UI, and
the UI does not imply any of these exist: full Program Detail Drawer
redesign/deeper content; clinical-trial efficacy/safety result views;
dedicated program or company profile pages; company comparison dashboard;
regimen relationship visualization; timeline/change history; saved named
views; CSV export; server-side preference storage.

**V1 UI phase closed.**
