/**
 * scripts/dose-narrative-consistency.mjs
 *
 * Pure, dependency-free logic for a narrow advisory check: does a Clinical Evidence
 * Study's free-text `design.description` state a single, specific target dose that
 * disagrees with its own structured Arm data for the same trial?
 *
 * This module intentionally does no file I/O and no console output - it is imported by
 * `scripts/data-registry.mjs`'s `probe:dose-narrative-consistency` command, which loads
 * the live corpus and prints findings. Keeping the detection logic here, pure and
 * dependency-free, is what makes it directly unit-testable with synthetic fixtures in
 * `test/dose-narrative-consistency.test.mjs`, mirroring `scripts/research-preflight.mjs`'s
 * exported-pure-function style.
 *
 * Scope (deliberately narrow - see the design plan for the corpus research behind these
 * boundaries):
 *   - Only fires when a Study has exactly one non-placebo Arm with a populated dose-bearing
 *     field. Multi-arm dose-ranging Studies (the common, safe idiom) never enter the
 *     comparison.
 *   - The narrative claim must be unambiguous: if `design.description` contains zero or
 *     more than one distinct dose value near a titration/target anchor phrase, that Study
 *     is skipped rather than guessed at.
 *   - The structured side is resolved through a fallback chain (dose -> titration's
 *     terminal value -> label -> intervention); if none of those yield an extractable
 *     number, the Study is skipped - missing structured data is a separate coverage
 *     problem, not this check's scope.
 *   - There is deliberately NO keyword-based suppression (e.g. "superseded", "unresolved
 *     conflict"). A Study that has previously and correctly documented one superseded
 *     design remains fully checkable for any other, future contradiction.
 */

const UNIT_TO_MG = {
  mg: 1,
  mcg: 0.001,
  "µg": 0.001, // µg
  ug: 0.001,
  g: 1000,
};

// Matches a number immediately followed by a dose unit, e.g. "120 mg", "1000mcg".
const DOSE_TOKEN_PATTERN = /(\d+(?:\.\d+)?)\s?(mg|mcg|µg|ug|g)\b/gi;

// A narrative dose claim is only ever read from the neighborhood of one of these anchor
// words - "titrated to X mg" / "target dose of X mg" / "X mg target dose". Anything without
// an anchor is a plain mention (e.g. a multi-arm summary), not a singular claim to check.
const ANCHOR_PATTERN = /titrat\w*|target\w*/gi;
const ANCHOR_WINDOW_BEFORE = 30;
const ANCHOR_WINDOW_AFTER = 60;
// When a Study names a second drug (an active comparator from a different asset), an anchor
// is only read as describing the focal asset's own dose if one of the focal asset's own name
// tokens appears in this much text immediately before the anchor - the common
// "<drug name> (titrated to X mg)" shape. This lets a head-to-head narrative like "mazdutide
// (titrated up to 9 mg) or semaglutide (titrated up to 1.0 mg)" resolve to only the focal
// drug's own clause instead of reading both as one ambiguous claim.
const FOCAL_NAME_LOOKBACK = 45;

const DOSE_BEARING_ROLES = new Set(["experimental", "active comparator"]);

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function toMg(value, unit) {
  const factor = UNIT_TO_MG[unit.toLowerCase()];
  return factor === undefined ? null : value * factor;
}

function allDoseTokens(text) {
  if (typeof text !== "string") return [];
  const tokens = [];
  for (const match of text.matchAll(DOSE_TOKEN_PATTERN)) {
    const mg = toMg(parseFloat(match[1]), match[2]);
    if (mg !== null) tokens.push({ mg, raw: `${match[1]} ${match[2]}` });
  }
  return tokens;
}

function extractFirstDoseMg(text) {
  const tokens = allDoseTokens(text);
  return tokens.length > 0 ? tokens[0] : null;
}

function extractLastDoseMg(text) {
  const tokens = allDoseTokens(text);
  return tokens.length > 0 ? tokens[tokens.length - 1] : null;
}

const WORD_TOKEN_PATTERN = /[a-z0-9]{4,}/gi;

/**
 * Derives lowercase name tokens (generic name, code name) that identify an Arm's own drug in
 * free text, drawn from its short `label` field plus the Study's own asset id - deliberately
 * NOT from `intervention`, which is a full descriptive sentence ("... administered
 * subcutaneously once weekly ...") whose generic method words would otherwise also match near
 * an unrelated comparator drug's own clause. Used only to disambiguate which clause of a
 * multi-drug narrative sentence an anchor belongs to - never used as a dose value itself.
 */
function armNameTokens(arm, assetId) {
  const tokens = new Set();
  for (const source of [arm?.label, assetId]) {
    if (typeof source !== "string") continue;
    for (const match of source.matchAll(WORD_TOKEN_PATTERN)) {
      tokens.add(match[0].toLowerCase());
    }
  }
  return tokens;
}

/**
 * Extracts the single, unambiguous dose claim anchored to a titration/target phrase in a
 * narrative string. Returns null when there is no anchor, or when the anchors' surrounding
 * windows collectively imply more than one distinct dose value (ambiguous - never guessed).
 *
 * `focalNameTokens`, when non-empty, additionally requires one of those tokens to appear
 * immediately before the anchor (see FOCAL_NAME_LOOKBACK) - this is what lets a head-to-head
 * "drug A (titrated to X mg) or drug B (titrated to Y mg)" sentence resolve to only drug A's
 * clause instead of being read as one ambiguous two-candidate claim.
 */
export function extractSingleDoseMg(text, focalNameTokens = new Set()) {
  if (typeof text !== "string" || text.trim().length === 0) return null;

  const anchors = [...text.matchAll(ANCHOR_PATTERN)];
  if (anchors.length === 0) return null;

  const found = new Map(); // key: mg rounded to 3 decimal places -> {mg, raw}
  for (const anchor of anchors) {
    if (focalNameTokens.size > 0) {
      const lookback = text.slice(Math.max(0, anchor.index - FOCAL_NAME_LOOKBACK), anchor.index).toLowerCase();
      const hasFocalName = [...focalNameTokens].some((token) => lookback.includes(token));
      if (!hasFocalName) continue;
    }
    const start = Math.max(0, anchor.index - ANCHOR_WINDOW_BEFORE);
    const end = Math.min(text.length, anchor.index + anchor[0].length + ANCHOR_WINDOW_AFTER);
    const window = text.slice(start, end);
    for (const token of allDoseTokens(window)) {
      const key = Math.round(token.mg * 1000);
      if (!found.has(key)) found.set(key, token);
    }
  }

  if (found.size !== 1) return null;
  return [...found.values()][0];
}

/**
 * Resolves a single Arm's dose to a comparable mg value via the fallback chain
 * dose -> titration (terminal value) -> label -> intervention, returning the first field
 * in that order that yields an extractable number, tagged with which field it came from.
 * Returns null when nothing in the chain has an extractable dose - this is the "skip,
 * don't flag" case for missing/unparsable structured data.
 */
export function extractArmDoseMg(arm) {
  if (!arm) return null;

  const dose = extractFirstDoseMg(arm.dose);
  if (dose) return { ...dose, field: "dose" };

  const titration = extractLastDoseMg(arm.titration);
  if (titration) return { ...titration, field: "titration" };

  const label = extractFirstDoseMg(arm.label);
  if (label) return { ...label, field: "label" };

  const intervention = extractFirstDoseMg(arm.intervention);
  if (intervention) return { ...intervention, field: "intervention" };

  return null;
}

/**
 * Runs the full precondition + comparison for one Study against its own Arms. Returns a
 * finding object when a genuine, unambiguous narrative-vs-structured dose contradiction is
 * found, or null when the Study doesn't meet the trigger preconditions, is ambiguous, has
 * no comparable structured value, or the values agree.
 */
export function checkStudyDoseNarrativeConsistency(study, arms) {
  const studyArms = arms.filter((arm) => arm.studyId === study.id);

  // An Arm whose linkedAsset names a different company/asset (e.g. a head-to-head active
  // comparator drug from another sponsor) is never the Study's own focal-asset arm, and is
  // excluded from the "exactly one dosed arm" precondition below. An Arm with no linkedAsset
  // at all is treated as belonging to the Study's own asset by default (the common case for
  // a single-asset trial that doesn't bother stamping its own drug's identity).
  const isForeignAsset = (arm) =>
    arm.linkedAsset != null &&
    (arm.linkedAsset.companyId !== study.companyId || arm.linkedAsset.assetId !== study.assetId);

  const qualifying = studyArms.filter(
    (arm) =>
      DOSE_BEARING_ROLES.has(arm.role) &&
      (isNonEmptyString(arm.dose) || isNonEmptyString(arm.titration)) &&
      !isForeignAsset(arm),
  );
  if (qualifying.length !== 1) return null;
  const arm = qualifying[0];

  // Only meaningful when the narrative also names another drug (see armNameTokens/
  // FOCAL_NAME_LOOKBACK) - resolves which clause of a multi-drug sentence is the focal
  // asset's own claim, rather than reading a head-to-head sentence as one ambiguous claim.
  const otherDosedArms = studyArms.filter(
    (other) => other.id !== arm.id && DOSE_BEARING_ROLES.has(other.role),
  );
  const focalNameTokens = otherDosedArms.length > 0 ? armNameTokens(arm, study.assetId) : new Set();

  const narrative = extractSingleDoseMg(study.design?.description, focalNameTokens);
  if (!narrative) return null;

  const resolved = extractArmDoseMg(arm);
  if (!resolved) return null;

  if (Math.abs(narrative.mg - resolved.mg) < 0.0005) return null;

  return {
    studyId: study.id,
    armId: arm.id,
    narrativeMg: narrative.mg,
    narrativeRaw: narrative.raw,
    resolvedMg: resolved.mg,
    resolvedRaw: resolved.raw,
    resolvedField: resolved.field,
  };
}

/** Runs the check across every Study in a Clinical Evidence aggregate. */
export function runDoseNarrativeConsistencyChecks(studies, arms) {
  const findings = [];
  for (const study of studies) {
    const finding = checkStudyDoseNarrativeConsistency(study, arms);
    if (finding) findings.push(finding);
  }
  return findings;
}

function assert(condition, message) {
  if (!condition) throw new Error(`self-check: ${message}`);
}

/**
 * Self-check against synthetic fixtures only (never against live corpus data), mirroring
 * scripts/data-registry.mjs's selfCheckRegistryCitations pattern. This is what the probe
 * asserts against; live-data findings are always advisory (see probeDoseNarrativeConsistency).
 */
export function selfCheckDoseNarrativeConsistency() {
  const study = (id, description) => ({ id, design: { description } });
  const arm = (overrides) => ({
    id: `${overrides.studyId}-arm`,
    role: "experimental",
    ...overrides,
  });

  // 1: direct incident replay - single arm, narrative "120 mg", Arm.dose "180 mg".
  {
    const s = study("s1", "Participants initiate treatment and titrate monthly to a 120 mg target dose.");
    const arms = [arm({ studyId: "s1", dose: "180 mg target dose" })];
    const finding = checkStudyDoseNarrativeConsistency(s, arms);
    assert(finding && finding.narrativeMg === 120 && finding.resolvedMg === 180 && finding.resolvedField === "dose",
      "direct incident replay must be flagged with the correct narrative/resolved values");
  }

  // 2: titration-ceiling replay (DREAMS-3 shape) - "titrated up to 9 mg" vs. Arm.dose "6 mg"
  // and a titration schedule that itself ends at 6 mg.
  {
    const s = study("s2", "Once-weekly mazdutide, titrated up to 9 mg, versus placebo.");
    const arms = [
      arm({
        studyId: "s2",
        dose: "6 mg target dose",
        titration: "2 mg for 4 weeks; 4 mg for 4 weeks; 6 mg for the remaining 24 weeks",
      }),
    ];
    const finding = checkStudyDoseNarrativeConsistency(s, arms);
    assert(finding && finding.narrativeMg === 9 && finding.resolvedMg === 6,
      "titration-ceiling replay must be flagged");
  }

  // 2b: the real DREAMS-3 shape - a head-to-head active-comparator Study naming two drugs in
  // one narrative sentence. The comparator's foreign-asset Arm must not count toward the
  // "exactly one dosed arm" precondition, and its own dose (1.0 mg) must not be read as the
  // focal asset's ambiguous second candidate.
  {
    const s = {
      id: "s2b",
      companyId: "acme-biologics",
      assetId: "acmetide",
      design: {
        description:
          "Open-label study randomizing participants to once-weekly acmetide (titrated up to 9 mg) " +
          "or once-weekly semaglutide (titrated up to 1.0 mg) for 32 weeks.",
      },
    };
    const focalArm = {
      id: "s2b-focal",
      studyId: "s2b",
      role: "experimental",
      label: "Acmetide",
      intervention: "Acmetide titrated to a target of 6 mg",
      linkedAsset: { companyId: "acme-biologics", assetId: "acmetide" },
      dose: "6 mg target dose",
    };
    const comparatorArm = {
      id: "s2b-comparator",
      studyId: "s2b",
      role: "active comparator",
      label: "Semaglutide",
      intervention: "Semaglutide titrated to 1.0 mg",
      linkedAsset: { companyId: "novo-nordisk", assetId: "semaglutide" },
      dose: "Titrated to 1.0 mg",
    };
    const finding = checkStudyDoseNarrativeConsistency(s, [focalArm, comparatorArm]);
    assert(
      finding && finding.armId === "s2b-focal" && finding.narrativeMg === 9 && finding.resolvedMg === 6,
      "a head-to-head active-comparator Study must resolve to the focal asset's own clause, not be treated as ambiguous or multi-arm-excluded",
    );
  }

  // 3: unit-normalized true positive (1000 mcg vs. 1.5 mg), plus a matching case after
  // conversion that must NOT be flagged.
  {
    const s = study("s3a", "Titrated to a target dose of 1000 mcg.");
    const arms = [arm({ studyId: "s3a", dose: "1.5 mg" })];
    const finding = checkStudyDoseNarrativeConsistency(s, arms);
    assert(finding && Math.abs(finding.narrativeMg - 1) < 0.0005,
      "unit conversion (mcg) must be applied before comparing");

    const sMatch = study("s3b", "Titrated to a target dose of 1000 mcg.");
    const armsMatch = [arm({ studyId: "s3b", dose: "1 mg" })];
    assert(checkStudyDoseNarrativeConsistency(sMatch, armsMatch) === null,
      "matching values after unit conversion must not be flagged");
  }

  // 4: multi-arm dose summary - two dosed active arms - must never enter comparison.
  {
    const s = study("s4", "Randomized to cohorts titrated to 100 mg or 300 mg.");
    const arms = [
      arm({ studyId: "s4", id: "s4-a", dose: "100 mg" }),
      arm({ studyId: "s4", id: "s4-b", dose: "300 mg" }),
    ];
    assert(checkStudyDoseNarrativeConsistency(s, arms) === null,
      "a Study with more than one dosed active arm must be skipped");
  }

  // 5: missing Arm.dose, but Arm.label agrees with the narrative - resolved via fallback.
  {
    const s = study("s5", "Titrated to a target dose of 2.4 mg.");
    const arms = [arm({ studyId: "s5", label: "Semaglutide 2.4 mg QW" })];
    assert(checkStudyDoseNarrativeConsistency(s, arms) === null,
      "a label that agrees with the narrative via the fallback chain must not be flagged");
  }

  // 6: dose, titration, label, and intervention all absent/non-numeric - skip, not flagged.
  {
    const s = study("s6", "Titrated to a target dose of 9 mg.");
    const arms = [arm({ studyId: "s6", label: "Investigational product" })];
    assert(checkStudyDoseNarrativeConsistency(s, arms) === null,
      "no extractable structured value anywhere in the fallback chain must be skipped, not flagged");
  }

  // 7: ambiguous narrative (two distinct dose candidates near anchors) - skip.
  {
    const s = study("s7", "Titrated to a target dose of 6 mg or 9 mg depending on tolerability.");
    const arms = [arm({ studyId: "s7", dose: "6 mg" })];
    assert(checkStudyDoseNarrativeConsistency(s, arms) === null,
      "an ambiguous narrative with two distinct dose candidates must be skipped, never guessed");
  }

  // 8: a Study whose prose documents a past superseded design (contains "superseded") must
  // still be checked for a different, newly-introduced contradiction - no keyword
  // suppression exists anywhere in this module.
  {
    const s = study(
      "s8",
      "Current design, superseding an earlier design: titrated to a target dose of 120 mg.",
    );
    const arms = [arm({ studyId: "s8", dose: "180 mg" })];
    const finding = checkStudyDoseNarrativeConsistency(s, arms);
    assert(finding && finding.narrativeMg === 120 && finding.resolvedMg === 180,
      "superseded/conflict language must never suppress detection of an unrelated mismatch");
  }

  // 9: agreeing values are never flagged.
  {
    const s = study("s9", "Titrated to a target dose of 45 mg.");
    const arms = [arm({ studyId: "s9", dose: "45 mg target dose" })];
    assert(checkStudyDoseNarrativeConsistency(s, arms) === null,
      "agreeing narrative and structured values must not be flagged");
  }
}

/**
 * The probe entry point. Takes an already-loaded `{ studies, arms }` (dependency injection,
 * matching the research-preflight.mjs pattern of accepting context/fetchFn rather than doing
 * its own I/O) so this stays a pure, directly-testable function. Always exits advisory: it
 * never throws on live-data findings, only from `selfCheckDoseNarrativeConsistency()` if the
 * detection logic itself regresses against its own fixtures.
 */
export function probeDoseNarrativeConsistency({ studies, arms }) {
  selfCheckDoseNarrativeConsistency();

  const findings = runDoseNarrativeConsistencyChecks(studies, arms);

  console.log(
    findings.length > 0
      ? `REVIEW_REQUIRED: ${findings.length} dose narrative contradiction(s) found`
      : "CLEAN: 0 dose narrative contradictions found",
  );
  for (const finding of findings) {
    console.log(
      `  ${finding.studyId}: design.description states ~${finding.narrativeRaw}, Arm ${finding.armId} ${finding.resolvedField} states ~${finding.resolvedRaw}`,
    );
  }
  console.log(
    "This is an advisory probe only: it never blocks the build. It checks only Studies with " +
      "exactly one dose-bearing active Arm and an unambiguous single narrative dose claim; " +
      "missing structured data, multi-arm dose summaries, and ambiguous narratives are " +
      "silently skipped by design, not evidence of correctness elsewhere.",
  );

  return findings;
}
