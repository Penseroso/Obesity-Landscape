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
 * Every name a Program or Regimen row is itself known by, for asset-identity
 * matching only - never for the company-name resolution that
 * `RECIPROCAL_RELATIONSHIP_ROLES` accompanies. Accepts either shape
 * directly:
 *
 *   - a raw `PipelineProgramRecord`-like object (`kind: "program"`):
 *     `assetId`, `assetName`, `codeName`, `aliases[].value`, and a
 *     combination row's own `components[].assetName`/`codeName` text.
 *   - a raw `RegimenRecord`-like object, or an internally-renamed
 *     equivalent (`kind` anything else): `assetId` (falling back to `id`),
 *     `assetName` (falling back to `name`, then `assetLabel` for callers
 *     that pre-normalize a Regimen's `name` under that key), and the same
 *     `components[]` text a Regimen also carries.
 *
 * `components[].companyId`/`assetId` are deliberately excluded: Company/
 * Pipeline's validator restricts them to the row's own company only (never
 * a genuine cross-company reference), so they carry no cross-company signal
 * here - only a component's free-text `assetName`/`codeName` might name a
 * partner's own asset (for example a fixed-dose-combination row naming a
 * partner's molecule by its own code).
 */
/**
 * The same names as `buildRowIdentityKeys`, but as an original-case array
 * (not normalized, not deduplicated) - what a caller building an actual
 * search-query string (rather than comparing identity) needs.
 */
export function collectRowIdentityTerms(row, kind = row?.kind) {
  const isProgram = kind === "program";
  const names = isProgram
    ? [row.assetId, row.assetName, row.codeName, ...(row.aliases ?? []).map((alias) => alias?.value)]
    : [row.assetId ?? row.id, row.assetName ?? row.name ?? row.assetLabel];

  names.push(...(row.components ?? []).flatMap((component) => [component?.assetName, component?.codeName]));

  return names.filter(isNonEmptyString);
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
