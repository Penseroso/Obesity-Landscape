# Obesity Landscape — V1 UI Audit

> Diagnostic-only audit of the V1 UI after Modules 1–3.1A. No implementation,
> data, registry, validator, generator, contract, or workflow file was changed
> as part of this audit. The only repository change is this report.

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

### UI-V1-006 — "Clinical-phase" count vs matrix Filed/Approved bucketing
- **Severity:** Minor · **Surface:** Overview · **Category:** semantic accuracy / consistency
- **Observed:** `getClinicalStageProgramCount` counts every stage with `sortRank ≥ 40`, which includes `Filed` (70) and `Approved` (80). The Company × Stage matrix places those same stages in a distinct **Filed / Approved** bucket, separate from the Phase columns. So a Filed/Approved program would be counted as "clinical-phase" in the metadata strip while shown as post-clinical in the matrix. No `Filed`/`Approved` programs exist in the current dataset, so there is **no live impact**; the `6` clinical-phase count is correct today (Phase 2×4 + Phase 1b + Phase 3), correctly excluding the 3 IND milestones.
- **Expected:** A single, consistent definition of "clinical-phase" across both Overview surfaces (e.g. Phase 1–3 only, excluding Filed/Approved), matching the "Clinical-phase" label.
- **Repro:** Add a hypothetical `Filed` program → it increments the "Clinical-phase" count but appears in the matrix's Filed/Approved bucket.
- **Files:** `lib/programs/constants.ts` (`clinicalDevelopmentStages` rank≥40; `stageBuckets`), `lib/programs/selectors.ts`
- **Probable cause:** Two independent stage groupings (rank threshold vs family bucket) with no shared "clinical phases" definition.
- **Confidence:** Probable (latent; depends on future data)
- **Remediation scope:** Small–Medium (unify the definition).
- **Blocks V1 closure:** No · **Fix before V2:** Recommended (do not reopen frozen registry data — this is a UI selector decision).

### UI-V1-007 — Overview mini-table header "Asset / Code" vs Register "Asset"
- **Severity:** Polish · **Surface:** Overview vs Register · **Category:** visual consistency
- **Observed:** `MostAdvancedProgramsTable` header reads **"Asset / Code"**; the Program Register deliberately uses **"Asset"** (Module 3 removed "/ Code" from that header). Same underlying concept, two headers.
- **Expected:** Consistent asset-column header wording across surfaces.
- **Files:** `components/MostAdvancedProgramsTable.tsx`, `config/program-table.ts`
- **Confidence:** Confirmed
- **Remediation scope:** Trivial.
- **Blocks V1 closure:** No · **Fix before V2:** Optional.

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

### UI-V1-009 — Company column truncates even when space is available
- **Severity:** Polish · **Surface:** Program Register · **Category:** visual consistency
- **Observed:** The Company cell truncates at `max-w-[140px]`, cutting "Ascletis Pharma Inc." to "Ascletis Pharma I…" even where horizontal room exists. A `title` tooltip preserves the full value.
- **Expected:** Company names fit at common widths, or truncate less aggressively.
- **Files:** `components/PipelineTable.tsx` (`truncatedCellClassName.company`)
- **Confidence:** Confirmed
- **Remediation scope:** Trivial (raise max-width).
- **Blocks V1 closure:** No · **Fix before V2:** Optional.

### UI-V1-010 — Milestone vs clinical stage badges not visually differentiated in the Register
- **Severity:** Minor · **Surface:** Program Register · **Category:** visual consistency / semantic accuracy
- **Observed:** In the Development Stage column, regulatory milestones (`IND submitted`, `IND cleared`) use the identical `StageBadge` style as clinical phases (`Phase 2`, `Phase 3`). Distinction relies entirely on the label text. (The Overview matrix *does* separate them via a dedicated column + color legend.)
- **Expected:** Consistent with Module 3's "keep regulatory milestones visually and semantically distinct from clinical phases" — some non-text differentiation (tone/border) in the register badge.
- **Files:** `components/StageBadge.tsx`, `components/PipelineTable.tsx`
- **Probable cause:** `StageBadge` is a single style for all stage values.
- **Confidence:** Probable (semantically distinct by label; visually uniform)
- **Remediation scope:** Small (variant by stage family, reusing registry `family`).
- **Blocks V1 closure:** No · **Fix before V2:** Recommended.

### UI-V1-011 — Keyword search matches internal identifiers
- **Severity:** Polish · **Surface:** Filters · **Category:** functionality / maintainability
- **Observed:** Keyword matching includes internal tokens (`id`, `assetId`, `companyId`) not shown in the UI; e.g. typing the company slug `zealand-pharma` returns 5 rows. Placeholder ("Search programs, mechanisms, platforms") understates the true scope.
- **Expected:** Either match only user-visible fields, or document the broad scope; keep placeholder honest.
- **Files:** `lib/programs/filters.ts` (`searchable` array)
- **Confidence:** Confirmed (behavior is intentional/broad, not a crash)
- **Remediation scope:** Small.
- **Blocks V1 closure:** No · **Fix before V2:** Optional.

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

### UI-V1-015 — Background not scroll-locked while drawer is open
- **Severity:** Minor · **Surface:** Drawer integration · **Category:** UX
- **Observed:** With the drawer open, `document.body` overflow stays `visible`; the page behind the overlay still scrolls.
- **Expected:** Background scroll is locked while the modal is open.
- **Repro:** Open drawer on a short viewport → scroll → page behind moves.
- **Files:** `components/ProgramDetailDrawer.tsx`
- **Confidence:** Confirmed
- **Remediation scope:** Small.
- **Blocks V1 closure:** No · **Fix before V2:** Optional (pairs with drawer a11y work).

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

- **Module 4.1 — Responsive & layout fixes:** UI-V1-004, UI-V1-008, UI-V1-009. (Grid `min-w-0`; register table width vs. page gutter; company truncation.) Small, self-contained, high user-visible value.
- **Module 4.2 — Drawer accessibility hardening:** UI-V1-012, UI-V1-013, UI-V1-014, UI-V1-015. Dialog role + `aria-modal` + label, focus trap/restore, Escape, scroll-lock. May be merged into the deferred V2 drawer redesign if that lands first, but the a11y basics should not wait on content depth.
- **Module 4.3 — Copy & semantic accuracy:** UI-V1-002, UI-V1-003, UI-V1-005, UI-V1-006, UI-V1-007, UI-V1-010. Nav/label/title consistency, "Latest verified" vs `updatedAt`, unified clinical-phase definition (UI-only; do not reopen the frozen registry), asset-header consistency, milestone badge differentiation.
- **Module 4.4 — Navigation & filter polish (optional):** UI-V1-001 (active nav + `aria-current`), UI-V1-011 (keyword scope / placeholder honesty).

## Validation results (post-report)

Re-run after writing this report (report is the only working-tree change):

| Command | Result |
| --- | --- |
| `git diff --check` | Clean (exit 0) |
| `npm run lint` | Pass (exit 0) |
| `npm run build` | Pass — 3 static routes (`/`, `/_not-found`, `/assets`) |

No implementation, data, registry, validator, generator, contract, or workflow
file was changed by this audit.
