/**
 * Shared cross-company relationship identity authority (ADR-0072, ADR-0073).
 *
 * Both `scripts/data-registry.mjs` (the ADR-0072 relationship-reciprocity
 * probe) and `scripts/research-preflight.mjs` (the ADR-0073 partner-aware
 * Clinical Evidence discovery preflight) need to answer the same two
 * questions about a Company/Pipeline `relationships[]` entry: which roles
 * are semantically reciprocal, and whether a counterpart's own row denotes
 * the *same* real-world asset as the row making the claim. Implementing
 * these independently in two scripts risked exactly the drift this module
 * exists to prevent - one script's identity rule silently diverging from
 * the other's over time. This is the single, shared source for both.
 *
 * Kept intentionally small and dependency-free (plain ESM, no I/O) so it is
 * trivially importable from either script without pulling in unrelated
 * validator or preflight machinery.
 */

/**
 * A relationship role pair counts as reciprocal only when both companies
 * would be expected to record it, each naming the other. `originator` and
 * every acquisition/historical-transfer-flavored role are deliberately
 * excluded: those are one-directional by meaning (an originator does not
 * "reciprocally" originate anything back), so requiring or expecting a
 * mirror entry for them would manufacture false gaps, not real ones. Any
 * code that iterates `relationships[]` for cross-company reciprocity or
 * partner-aware purposes must gate on this map, never process every role.
 */
export const RECIPROCAL_RELATIONSHIP_ROLES = new Map([
  ["licensor", ["licensee"]],
  ["licensee", ["licensor"]],
  ["co-developer", ["co-developer"]],
]);

/**
 * Trim/lowercase/collapse-whitespace normalization for exact-match company
 * and identity-term comparison. Deliberately not fuzzy: no punctuation
 * stripping, no subsidiary/legal-entity-name resolution, no tokenization.
 */
export function normalizeIdentityText(value) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.length > 0;
}

/**
 * A Program or Regimen row's own direct name/code - never a component's.
 * This is the row's identity as *itself*: a fixed-dose-combination row's own
 * `assetName`/`codeName` (for example "Petrelintide / CT-388") counts, but a
 * listed component's `assetName`/`codeName` does not, because a component
 * names a *different* real-world thing the row combines with, not another
 * name for the row's own asset.
 *
 * Two shapes are accepted directly:
 *   - a raw `PipelineProgramRecord`-like object (`kind: "program"`):
 *     `assetId`, `assetName`, `codeName`, `aliases[].value`.
 *   - a raw `RegimenRecord`-like object, or an internally-renamed
 *     equivalent (`kind` anything else): `assetId` (falling back to `id`),
 *     `assetName` (falling back to `name`, then `assetLabel` for callers
 *     that pre-normalize a Regimen's `name` under that key).
 *
 * This is what a caller building an actual search-query string (rather than
 * comparing identity) must use - see `collectRowIdentityTerms` for the
 * broader, components-inclusive variant reserved for identity resolution.
 */
export function collectRowOwnSearchTerms(row, kind = row?.kind) {
  const isProgram = kind === "program";
  const names = isProgram
    ? [row.assetId, row.assetName, row.codeName, ...(row.aliases ?? []).map((alias) => alias?.value)]
    : [row.assetId ?? row.id, row.assetName ?? row.name ?? row.assetLabel];

  return names.filter(isNonEmptyString);
}

/**
 * `collectRowOwnSearchTerms` plus a combination row's own
 * `components[].assetName`/`codeName` text - for **identity resolution
 * only** (confirming a relationship's counterpart, or an FDC's listed
 * partner molecule, denotes a specific real-world asset), never for
 * generating a search-query term list. `components[].companyId`/`assetId`
 * are excluded even here: Company/Pipeline's validator restricts them to
 * the row's own company only (never a genuine cross-company reference), so
 * they carry no cross-company signal - only a component's free-text
 * `assetName`/`codeName` might name a partner's own asset.
 *
 * Deliberately kept separate from `collectRowOwnSearchTerms`: a component
 * named inside a combination row is a *different* real-world asset than the
 * row itself (a fixed-dose combination's own petrelintide component is not
 * "another name for" the CT-388 component, or vice versa), so turning a
 * component's standalone name into a direct search term would pull in that
 * component's own, otherwise-unrelated trials - see `buildRowOwnIdentityKeys`
 * for the check that keeps this distinction meaningful at the call site.
 */
export function collectRowIdentityTerms(row, kind = row?.kind) {
  return [
    ...collectRowOwnSearchTerms(row, kind),
    ...(row.components ?? []).flatMap((component) => [component?.assetName, component?.codeName]),
  ].filter(isNonEmptyString);
}

export function buildRowOwnIdentityKeys(row, kind = row?.kind) {
  return new Set(collectRowOwnSearchTerms(row, kind).map(normalizeIdentityText));
}

export function buildRowIdentityKeys(row, kind = row?.kind) {
  return new Set(collectRowIdentityTerms(row, kind).map(normalizeIdentityText));
}

/**
 * Whether two identity-key sets denote the same asset by any shared,
 * exact-normalized name/code - never a fuzzy or partial match.
 */
export function identityKeysIntersect(keysA, keysB) {
  for (const key of keysA) {
    if (keysB.has(key)) return true;
  }
  return false;
}
