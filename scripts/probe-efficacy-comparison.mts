/**
 * Deterministic probe for the Efficacy Comparison read model.
 *
 * Distinct from `data:probe:efficacy-population-coverage`, which reads the generated
 * aggregate directly and freezes the accepted 11-of-15 gate. This one drives the
 * **TypeScript read model** and asserts it reaches the same disposition, so the two
 * implementations of the eligibility ladder cannot drift apart silently.
 *
 * It pins the full **evidence identity** of every row, not just row counts: which
 * study, endpoint, comparison group, and outcome ids each row was built from. A
 * ranking change that silently swapped one study for another would otherwise pass.
 */
import { readFileSync } from "node:fs";

import { getEfficacyComparison } from "@/domains/app/lib/efficacy-comparison/read-model";
import { EFFICACY_OVERVIEW_UNIT } from "@/domains/app/lib/efficacy-comparison/policy";
import { screenStudy } from "@/domains/app/lib/efficacy-comparison/candidates";
import { findHeadToHeadGroups } from "@/domains/app/lib/efficacy-comparison/head-to-head";
import {
  efficacyMechanismFamilies,
  getRegimenDisplay,
  resolveMechanismFamilyFromMechanisms,
} from "@/domains/app/lib/efficacy-comparison/mechanism-family";
import type { StudyDetailView } from "@/domains/app/lib/clinical-evidence/selectors";

type StoredOutcome = {
  id: string;
  result: { value: string; unit: string; resultType: string };
};

const aggregate = JSON.parse(
  readFileSync("data/generated/clinical-evidence.json", "utf8"),
) as { outcomes: StoredOutcome[] };

const outcomeById = new Map(aggregate.outcomes.map((outcome) => [outcome.id, outcome]));

/**
 * The reviewed gate. `novo-nordisk/liraglutide` moved from a gap to an eligible row
 * (10/5 -> 11/4): its SCALE Obesity and Prediabetes result at
 * `scaleobesity-weight-lira30` was corrected from a stored `kg` value to a directly
 * reported `percent` value in the "Backfill clinical efficacy and safety evidence"
 * change, which is exactly the metric this overview requires — confirmed against the
 * source publication, not assumed. ADR-0058 reviewed the same change for
 * `data:probe:efficacy-population-coverage` and synchronized its separately frozen
 * snapshot without relaxing the eligibility policy.
 */
const REVIEWED_TOTALS = {
  eligibleUnits: 11,
  gapUnits: 4,
  totalUnits: 15,
  headToHeadStudies: 5,
  headToHeadGroups: 5,
};

const REVIEWED_GAPS: Record<string, string> = {
  "asset:amgen/maridebart-cafraglutide": "population-mixed-diabetes-status",
  "asset:novo-nordisk/cagrilintide": "population-diabetes-status-not-specified",
  "asset:novo-nordisk/ubt251": "population-diabetes-status-not-specified",
  "asset:roche/ct-996": "population-mixed-diabetes-status",
};

/**
 * Reviewed evidence identity per unit. Changing any entry means the selection rule
 * changed — review the rule alongside the diff rather than refreshing these values
 * to make the probe pass.
 */
const REVIEWED_EVIDENCE: Record<
  string,
  {
    familyId: string;
    studyId: string;
    endpointId: string;
    comparisonGroupKey: string;
    treatmentOutcomeIds: string[];
    placeboOutcomeIds: string[];
    activeComparatorOutcomeIds: string[];
    betweenArmOutcomeIds: string[];
  }
> = {
  "asset:ascletis-pharma/asc30": {
    familyId: "glp1-agonist",
    studyId: "ascletis-pharma-asc30-nct06680440",
    endpointId: "asc30-102-body-weight-percent-change-day-29",
    comparisonGroupKey:
      "arm-level|participants with reported day 29 body weight data(mad cohort 1 n=7)|",
    treatmentOutcomeIds: ["asc30-102-mad-1-body-weight-day-29"],
    placeboOutcomeIds: [],
    activeComparatorOutcomeIds: [],
    betweenArmOutcomeIds: [],
  },
  "asset:eli-lilly-and-company/ly3502970": {
    familyId: "glp1-agonist",
    studyId: "eli-lilly-and-company-orforglipron-attain-1-nct05869903",
    endpointId: "attain1-weight-week72",
    comparisonGroupKey: "arm-level|full analysis set(overall)|treatment regimen",
    treatmentOutcomeIds: [
      "attain1-weight-orfor6",
      "attain1-weight-orfor12",
      "attain1-weight-orfor36",
    ],
    placeboOutcomeIds: ["attain1-weight-placebo"],
    activeComparatorOutcomeIds: [],
    betweenArmOutcomeIds: [],
  },
  "asset:novo-nordisk/liraglutide": {
    familyId: "glp1-agonist",
    studyId: "novo-nordisk-liraglutide-scale-obesity-nct01272219",
    endpointId: "scaleobesity-weight-week56",
    comparisonGroupKey: "arm-level|full analysis set(overall)|",
    treatmentOutcomeIds: ["scaleobesity-weight-lira30"],
    placeboOutcomeIds: ["scaleobesity-weight-placebo"],
    activeComparatorOutcomeIds: [],
    betweenArmOutcomeIds: [],
  },
  "asset:novo-nordisk/semaglutide": {
    familyId: "glp1-agonist",
    studyId: "novo-nordisk-semaglutide-step-8-nct04074161",
    endpointId: "step8-weight-week68",
    comparisonGroupKey: "arm-level|full analysis set(overall)|",
    treatmentOutcomeIds: ["step8-weight-semaglutide"],
    placeboOutcomeIds: [],
    activeComparatorOutcomeIds: ["step8-weight-liraglutide"],
    betweenArmOutcomeIds: ["step8-weight-between"],
  },
  "asset:eli-lilly-and-company/ly3298176": {
    familyId: "glp1-gip-agonist",
    studyId: "eli-lilly-and-company-tirzepatide-surmount-5-nct05822830",
    endpointId: "sm5-weight-week72",
    comparisonGroupKey:
      "arm-level|full analysis set(overall)|modified treatment regimen",
    treatmentOutcomeIds: ["sm5-weight-tirz"],
    placeboOutcomeIds: [],
    activeComparatorOutcomeIds: ["sm5-weight-sema"],
    betweenArmOutcomeIds: ["sm5-weight-between"],
  },
  "asset:roche/enicepatide": {
    familyId: "glp1-gip-agonist",
    studyId: "roche-enicepatide-ct388-103-nct06525935",
    endpointId: "en103-weight-w48",
    comparisonGroupKey: "arm-level|not reported|efficacy",
    treatmentOutcomeIds: [
      "en103-weight-efficacy-4mg",
      "en103-weight-efficacy-8mg",
      "en103-weight-efficacy-12mg",
      "en103-weight-efficacy-16mg",
      "en103-weight-efficacy-24mg",
    ],
    placeboOutcomeIds: ["en103-weight-efficacy-placebo"],
    activeComparatorOutcomeIds: [],
    betweenArmOutcomeIds: ["en103-weight-efficacy"],
  },
  "asset:eli-lilly-and-company/ly3305677": {
    familyId: "glp1-glucagon-agonist",
    studyId: "eli-lilly-and-company-mazdutide-glory-1-nct05607680",
    // Week 32 (co-primary) beats week 48 (secondary) under getEndpointRoleRank: GLORY-1's
    // week-32 co-primary endpoints were added from the NEJM publication by "Fix two
    // primary/co-primary endpoint gaps found in a full role-coverage sweep" - the
    // week-48 endpoint was already, and remains, correctly secondary.
    endpointId: "glory1-weight-week32",
    comparisonGroupKey: "arm-level|full analysis set(overall)|treatment policy",
    treatmentOutcomeIds: ["glory1-weight32-maz4", "glory1-weight32-maz6"],
    placeboOutcomeIds: ["glory1-weight32-placebo"],
    activeComparatorOutcomeIds: [],
    betweenArmOutcomeIds: [],
  },
  "asset:eli-lilly-and-company/ly3437943": {
    familyId: "glp1-gip-glucagon-agonist",
    studyId: "eli-lilly-and-company-retatrutide-phase-2-nct04881760",
    endpointId: "reta-p2-weight-week24",
    comparisonGroupKey: "arm-level|efficacy analysis set(overall)|efficacy",
    treatmentOutcomeIds: [
      "reta-p2-weight24-1mg",
      "reta-p2-weight24-4mg-start2",
      "reta-p2-weight24-4mg-start4",
      "reta-p2-weight24-8mg-start2",
      "reta-p2-weight24-8mg-start4",
      "reta-p2-weight24-12mg",
      "reta-p2-weight24-4mg",
      "reta-p2-weight24-8mg",
    ],
    placeboOutcomeIds: ["reta-p2-weight24-placebo"],
    activeComparatorOutcomeIds: [],
    betweenArmOutcomeIds: [
      "reta-p2-weight24-vs-placebo-1mg",
      "reta-p2-weight24-vs-placebo-4mg-start2",
      "reta-p2-weight24-vs-placebo-4mg-start4",
      "reta-p2-weight24-vs-placebo-8mg-start2",
      "reta-p2-weight24-vs-placebo-8mg-start4",
      "reta-p2-weight24-vs-placebo-12mg",
    ],
  },
  "asset:eli-lilly-and-company/ly3841136": {
    familyId: "amylin-agonist",
    studyId: "eli-lilly-and-company-eloralintide-phase-2-nct06230523",
    endpointId: "elora-p2-weight-week48",
    comparisonGroupKey: "arm-level|intention to treat(overall)|treatment regimen",
    treatmentOutcomeIds: [
      "elora-p2-weight-1mg-treatment-regimen",
      "elora-p2-weight-3mg-treatment-regimen",
      "elora-p2-weight-6mg-treatment-regimen",
      "elora-p2-weight-9mg-treatment-regimen",
      "elora-p2-weight-6to9-treatment-regimen",
      "elora-p2-weight-3to9-treatment-regimen",
    ],
    placeboOutcomeIds: ["elora-p2-weight-placebo-treatment-regimen"],
    activeComparatorOutcomeIds: [],
    betweenArmOutcomeIds: [],
  },
  "asset:novo-nordisk/amycretin": {
    familyId: "glp1-amylin-agonist",
    studyId: "novo-nordisk-amycretin-oral-phase1-nct05369390",
    endpointId: "amyoral-weight-week12",
    comparisonGroupKey: "arm-level|full analysis set(overall)|",
    // The MAD study (pubmed.ncbi.nlm.nih.gov/40550229) ran three escalation parts:
    // C1 to 50 mg, C2 to 2x50 mg (100 mg), and D to 2x25 mg (also 50 mg total, by a
    // different tablet split) - the "225" outcome id names the tablet count/split,
    // not a 225 mg dose. Source order is the study's own C1/C2/D part sequence, not a
    // numeric sort on the id. The 50 mg and 225 mg (2x25 mg) arms were backfilled
    // from the same source as the pre-existing 100 mg arm.
    treatmentOutcomeIds: ["amyoral-weight-50", "amyoral-weight-100", "amyoral-weight-225"],
    placeboOutcomeIds: ["amyoral-weight-placebo"],
    activeComparatorOutcomeIds: [],
    betweenArmOutcomeIds: [],
  },
  "asset:novo-nordisk/cagrisema": {
    familyId: "amylin-plus-glp1-combination",
    studyId: "novo-nordisk-cagrisema-redefine-4-nct06131437",
    endpointId: "redefine4-weight-week84",
    comparisonGroupKey: "arm-level|full analysis set(overall)|treatment regimen",
    treatmentOutcomeIds: ["redefine4-weight-cagrisema"],
    placeboOutcomeIds: [],
    activeComparatorOutcomeIds: ["redefine4-weight-tirzepatide"],
    betweenArmOutcomeIds: [],
  },
};

const failures: string[] = [];
const check = (condition: boolean, message: string) => {
  if (!condition) failures.push(message);
};

/**
 * Selection, never calculation — verified against the **same outcome id**, not
 * against "some value somewhere in the aggregate". A loose string search would pass
 * even if a row rendered another study's number.
 */
function checkStoredValue(
  context: string,
  value: { value: string; unit: string; resultType: string; outcomeId: string },
) {
  const stored = outcomeById.get(value.outcomeId);
  if (!stored) {
    failures.push(`${context}: outcomeId "${value.outcomeId}" is not in the aggregate`);
    return;
  }
  check(
    stored.result.value === value.value,
    `${context}: ${value.outcomeId} value "${value.value}" != stored "${stored.result.value}"`,
  );
  check(
    stored.result.unit === value.unit,
    `${context}: ${value.outcomeId} unit "${value.unit}" != stored "${stored.result.unit}"`,
  );
  check(
    stored.result.resultType === value.resultType,
    `${context}: ${value.outcomeId} resultType "${value.resultType}" != stored "${stored.result.resultType}"`,
  );
}

const view = getEfficacyComparison();
const rows = view.families.flatMap((group) =>
  group.rows.map((row) => ({ familyId: group.family.id, row })),
);

console.log("Efficacy Comparison read model");
console.log(
  `  units: ${view.totalUnits}  rows: ${rows.length}  families: ${view.families.length}  gaps: ${view.gaps.length}`,
);
for (const group of view.families) {
  console.log(`    ${group.family.label} [${group.family.composition}]`);
  for (const row of group.rows) {
    console.log(
      `      ${row.name} (${row.companyName}) — ${row.evidence.studyTitle} [${row.evidence.phase}] ` +
        `${row.evidence.endpointRole} @ ${row.evidence.assessmentTimepoint}`,
    );
    console.log(
      `         treatment: ${row.evidence.treatmentValues.map((v) => `${v.value} ${v.unit} (${v.label})`).join("; ")}`,
    );
    console.log(
      `         placebo:   ${row.evidence.placeboValues.map((v) => `${v.value} ${v.unit}`).join("; ") || "(none in group)"}`,
    );
    console.log(
      `         activeComp: ${row.evidence.activeComparatorValues.map((v) => `${v.value} ${v.unit} (${v.label})`).join("; ") || "(none in group)"}`,
    );
    console.log(
      `         betweenArm: ${row.evidence.storedBetweenArmValues.length}   maturity: ${row.evidence.maturity}`,
    );
  }
}
console.log("  coverage gaps:");
for (const gap of view.gaps) console.log(`    ${gap.unitKey} — ${gap.reason}`);

const h2hStudies = new Set(view.headToHead.map((group) => group.studyId));
console.log(`  head-to-head: ${h2hStudies.size} studies, ${view.headToHead.length} groups`);
for (const group of view.headToHead) {
  const entities = group.entities
    .map((item) => `${item.entity.label} ${item.values.map((v) => v.value).join("/") || "—"}`)
    .join(" · ");
  const betweenArm = group.betweenArm.length > 0 ? `  + between-arm x${group.betweenArm.length}` : "";
  console.log(`    ${group.studyTitle}: ${entities}${betweenArm}`);
}

// --- totals and dispositions ---------------------------------------------

check(rows.length === REVIEWED_TOTALS.eligibleUnits, `rows ${rows.length}`);
check(view.gaps.length === REVIEWED_TOTALS.gapUnits, `gaps ${view.gaps.length}`);
check(view.totalUnits === REVIEWED_TOTALS.totalUnits, `units ${view.totalUnits}`);
for (const [unitKey, reason] of Object.entries(REVIEWED_GAPS)) {
  const gap = view.gaps.find((candidate) => candidate.unitKey === unitKey);
  check(Boolean(gap), `reviewed gap ${unitKey} is missing`);
  if (gap) check(gap.reason === reason, `${unitKey} reason ${gap.reason}, reviewed ${reason}`);
}
for (const gap of view.gaps) {
  check(Boolean(REVIEWED_GAPS[gap.unitKey]), `unreviewed new gap ${gap.unitKey}`);
}

// --- evidence identity ----------------------------------------------------

for (const { familyId, row } of rows) {
  const reviewed = REVIEWED_EVIDENCE[row.unitKey];
  if (!reviewed) {
    failures.push(`${row.unitKey}: no reviewed evidence snapshot`);
    continue;
  }
  const context = row.unitKey;
  check(familyId === reviewed.familyId, `${context}: family ${familyId} != ${reviewed.familyId}`);
  check(
    row.evidence.studyId === reviewed.studyId,
    `${context}: study ${row.evidence.studyId} != ${reviewed.studyId}`,
  );
  check(
    row.evidence.endpointId === reviewed.endpointId,
    `${context}: endpoint ${row.evidence.endpointId} != ${reviewed.endpointId}`,
  );
  check(
    row.evidence.comparisonGroupKey === reviewed.comparisonGroupKey,
    `${context}: group "${row.evidence.comparisonGroupKey}" != "${reviewed.comparisonGroupKey}"`,
  );

  const actual = {
    treatment: row.evidence.treatmentValues.map((value) => value.outcomeId),
    placebo: row.evidence.placeboValues.map((value) => value.outcomeId),
    activeComparator: row.evidence.activeComparatorValues.map((value) => value.outcomeId),
    betweenArm: row.evidence.storedBetweenArmValues.map((value) => value.outcomeId),
  };
  check(
    actual.treatment.join(",") === reviewed.treatmentOutcomeIds.join(","),
    `${context}: treatment ids [${actual.treatment}] != [${reviewed.treatmentOutcomeIds}]`,
  );
  check(
    actual.placebo.join(",") === reviewed.placeboOutcomeIds.join(","),
    `${context}: placebo ids [${actual.placebo}] != [${reviewed.placeboOutcomeIds}]`,
  );
  check(
    actual.activeComparator.join(",") === reviewed.activeComparatorOutcomeIds.join(","),
    `${context}: active-comparator ids [${actual.activeComparator}] != [${reviewed.activeComparatorOutcomeIds}]`,
  );
  check(
    actual.betweenArm.join(",") === reviewed.betweenArmOutcomeIds.join(","),
    `${context}: between-arm ids [${actual.betweenArm}] != [${reviewed.betweenArmOutcomeIds}]`,
  );

  for (const value of [
    ...row.evidence.treatmentValues,
    ...row.evidence.placeboValues,
    ...row.evidence.activeComparatorValues,
    ...row.evidence.storedBetweenArmValues,
  ]) {
    checkStoredValue(context, value);
  }
  for (const value of [
    ...row.evidence.treatmentValues,
    ...row.evidence.placeboValues,
    ...row.evidence.activeComparatorValues,
  ]) {
    check(value.unit === EFFICACY_OVERVIEW_UNIT, `${context}: overview unit "${value.unit}"`);
    check(value.resultType === "arm-level", `${context}: overview value is ${value.resultType}`);
  }
  for (const value of row.evidence.activeComparatorValues) {
    check(
      value.armRole === "active comparator",
      `${context}: activeComparatorValues holds armRole ${value.armRole}`,
    );
  }
  for (const value of row.evidence.storedBetweenArmValues) {
    check(
      value.resultType === "between-arm",
      `${context}: storedBetweenArmValues holds ${value.resultType}`,
    );
  }
  check(row.evidence.treatmentValues.length > 0, `${context}: no treatment value`);
  // Disclosed maturity must be the one the ranking used: the group's best.
  check(
    row.evidence.maturity === row.evidence.groupMaturities[0],
    `${context}: disclosed maturity ${row.evidence.maturity} is not the group best`,
  );
}

// --- head-to-head ---------------------------------------------------------

check(h2hStudies.size === REVIEWED_TOTALS.headToHeadStudies, `h2h studies ${h2hStudies.size}`);
check(
  view.headToHead.length === REVIEWED_TOTALS.headToHeadGroups,
  `h2h groups ${view.headToHead.length}`,
);
for (const group of view.headToHead) {
  // A group is a real comparison only with two or more distinct entities.
  const entityKeys = new Set(group.entities.map((item) => item.entity.key));
  check(
    entityKeys.size === group.entities.length,
    `${group.studyTitle}: duplicate entity in group`,
  );
  check(group.entities.length >= 2, `${group.studyTitle}: group has < 2 entities`);

  const armLevelValues = group.entities.flatMap((item) => item.values);
  const betweenArmValues = group.betweenArm.flatMap((pair) => pair.values);
  check(
    armLevelValues.length > 0 || betweenArmValues.length > 0,
    `${group.studyTitle}: no Outcome proof`,
  );
  for (const value of [...armLevelValues, ...betweenArmValues]) {
    checkStoredValue(`h2h ${group.studyTitle}`, value);
  }
  // Every between-arm estimate names two entities that belong to the group.
  for (const pair of group.betweenArm) {
    check(pair.left.key !== pair.right.key, `${group.studyTitle}: between-arm identical entities`);
    check(
      entityKeys.has(pair.left.key) && entityKeys.has(pair.right.key),
      `${group.studyTitle}: between-arm names an entity outside the group`,
    );
  }
}

// --- synthetic: a 3-entity between-arm Outcome must fail loud --------------

function syntheticThreeEntityStudy(): StudyDetailView {
  const study = {
    id: "synthetic-3-entity",
    companyId: "fixture-co",
    assetId: "alpha",
    officialTitle: "Synthetic three-entity between-arm study",
    phase: "Phase 2",
    design: { randomization: "Randomized", masking: "Open-label", comparator: "Two actives" },
    population: "Adults with obesity.",
  };
  const arms = [
    { id: "a1", studyId: study.id, role: "experimental", label: "Alpha", intervention: "Alpha" },
    {
      id: "a2",
      studyId: study.id,
      role: "active comparator",
      label: "Beta",
      intervention: "Beta",
      linkedAssetRef: { companyId: "fixture-co", assetId: "beta" },
      linkedAssetName: "Beta",
    },
    {
      id: "a3",
      studyId: study.id,
      role: "active comparator",
      label: "Gamma",
      intervention: "Gamma",
      linkedAssetRef: { companyId: "fixture-co", assetId: "gamma" },
      linkedAssetName: "Gamma",
    },
  ];
  const endpoint = {
    id: "e1",
    studyId: study.id,
    name: "Percentage change from baseline in body weight",
    role: "primary",
    domain: "body weight",
    assessmentTimepoint: "Week 24",
  };
  const outcome = {
    id: "o1",
    studyId: study.id,
    endpointId: "e1",
    armIds: ["a1", "a2", "a3"],
    analysisPopulation: "Full analysis set (overall)",
    result: {
      value: "-5.0",
      numericValue: -5,
      unit: "percentage points",
      resultType: "between-arm",
      effectMeasure: "Estimated treatment difference",
      comparisonType: "Alpha minus comparators",
    },
    maturity: "topline",
    metadata: { lastVerifiedAt: "2026-07-22", updatedAt: "2026-07-22", sources: [] },
  };
  return {
    study,
    asset: { companyId: "fixture-co", assetId: "alpha", assetName: "Alpha" },
    arms,
    analysisGroups: [],
    endpointGroups: [{ endpoint, outcomes: [{ outcome, endpoint, armLabels: [] }] }],
    linkedFromAssets: [],
  } as unknown as StudyDetailView;
}

let threeEntityRejected = false;
try {
  findHeadToHeadGroups(syntheticThreeEntityStudy());
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  threeEntityRejected = /cannot be attributed to more than one entity pair/.test(message);
  check(threeEntityRejected, `3-entity probe rejected for the wrong reason: ${message}`);
}
check(
  threeEntityRejected,
  "3-entity between-arm Outcome was accepted; it must fail loud rather than fan out into pairs",
);
console.log("  synthetic 3-entity between-arm Outcome: rejected as expected");

// --- synthetic: a responder-proportion outcome is not the change metric ----
//
// A body-weight endpoint whose arm-level percent outcomes are responder rates
// ("% achieving >=5% reduction") shares unit and domain with the change metric.
// Every overview gate but the responder exclusion passes, so this pins that the
// exclusion — and nothing else — keeps a 92% responder rate out of the column.

function syntheticResponderStudy(withThreshold: boolean): StudyDetailView {
  const study = {
    id: "synthetic-responder",
    companyId: "fixture-co",
    assetId: "delta",
    officialTitle: "Synthetic responder-proportion study",
    phase: "Phase 2",
    design: { randomization: "Randomized", masking: "Double-blind", comparator: "Placebo" },
    population: "Adults with obesity, without diabetes.",
    populationProfile: {
      ageGroup: "adult",
      diabetesStatus: "without-type-2-diabetes",
      requiresAdditionalCondition: false,
      treatmentContext: "initial-treatment",
    },
  };
  const arms = [
    { id: "d1", studyId: study.id, role: "experimental", label: "Delta", intervention: "Delta" },
    { id: "dp", studyId: study.id, role: "placebo", label: "Placebo", intervention: "Placebo" },
  ];
  const endpoint = {
    id: "re",
    studyId: study.id,
    name: "Percentage of participants achieving >=5% body-weight reduction",
    role: "secondary",
    domain: "body weight",
    assessmentTimepoint: "Week 48",
  };
  const responderThreshold = withThreshold ? ">=5%" : undefined;
  const mkOutcome = (id: string, armId: string, value: string) => ({
    outcome: {
      id,
      studyId: study.id,
      endpointId: "re",
      armIds: [armId],
      analysisPopulation: "Full analysis set (overall)",
      estimand: "Efficacy estimand",
      result: { value, numericValue: Number(value), unit: "percent", resultType: "arm-level", responderThreshold },
      maturity: "peer-reviewed publication",
      metadata: { lastVerifiedAt: "2026-07-23", updatedAt: "2026-07-23", sources: [] },
    },
    endpoint,
    armLabels: [],
  });
  return {
    study,
    asset: { companyId: "fixture-co", assetId: "delta", assetName: "Delta" },
    arms,
    analysisGroups: [],
    endpointGroups: [
      {
        endpoint,
        outcomes: [mkOutcome("ro-exp", "d1", "92"), mkOutcome("ro-pbo", "dp", "27")],
      },
    ],
    linkedFromAssets: [],
  } as unknown as StudyDetailView;
}

// Control: identical study without the threshold is otherwise eligible, proving the
// responder flag — not some other gate — is what excludes it.
const responderControl = screenStudy(syntheticResponderStudy(false), 0);
check(
  responderControl.candidates.length > 0,
  "responder control (no threshold) should be an eligible change-metric candidate",
);

const responderScreen = screenStudy(syntheticResponderStudy(true), 0);
check(
  responderScreen.candidates.length === 0 &&
    responderScreen.reason === "metric-unavailable-percent",
  `responder-only study must yield no overview candidate (got ${responderScreen.candidates.length} candidates, reason ${responderScreen.reason})`,
);
check(
  findHeadToHeadGroups(syntheticResponderStudy(true)).length === 0,
  "responder-only study must not form a head-to-head group",
);
console.log(
  "  synthetic responder-proportion outcome: excluded from overview and head-to-head",
);

// --- synthetic: mechanism-family resolution compares families, not wording -
//
// ADR-0057: an asset's program rows must agree on the *resolved* mechanism
// family, never on verbatim wording. Regression-pins the fix for
// sciwind-biosciences/ecnoglutide's two rows, which carry different published
// wording for the same molecule.

{
  // Two different verbatim wordings that resolve to the same family must not
  // throw. Sourced from the live registry rather than hardcoded, so this stays
  // valid if mechanism-families.json is edited.
  const familyWithTwoWordings = efficacyMechanismFamilies.find(
    (family) => family.mechanisms.length >= 2,
  );
  check(
    familyWithTwoWordings !== undefined,
    "self-check setup: no mechanism family in the live registry has 2+ wordings to test same-family resolution",
  );
  if (familyWithTwoWordings) {
    const [wordingA, wordingB] = familyWithTwoWordings.mechanisms;
    const resolution = resolveMechanismFamilyFromMechanisms(
      [wordingA, wordingB],
      "synthetic same-family asset",
    );
    check(
      resolution.family !== null && resolution.family.id === familyWithTwoWordings.id,
      "two different verbatim wordings resolving to the same family must not throw",
    );
  }
}

// Families that only regimens reach carry an empty `mechanisms` array (see
// `MechanismFamilyRegistryEntry.mechanisms`) - filter those out before picking
// asset-reachable families for the remaining synthetic cases.
const assetReachableFamilies = efficacyMechanismFamilies.filter(
  (family) => family.mechanisms.length > 0,
);
check(
  assetReachableFamilies.length >= 2,
  "self-check setup: fewer than 2 asset-reachable mechanism families exist to test cross-family resolution",
);

if (assetReachableFamilies.length >= 2) {
  // Two mechanisms resolving to different families is a genuine pharmacological
  // conflict and must still throw.
  const [familyA, familyB] = assetReachableFamilies;
  let threw = false;
  try {
    resolveMechanismFamilyFromMechanisms(
      [familyA.mechanisms[0], familyB.mechanisms[0]],
      "synthetic cross-family asset",
    );
  } catch {
    threw = true;
  }
  check(threw, "two mechanisms resolving to different families must throw");
}

if (assetReachableFamilies.length >= 1) {
  // A mix of a disclosed and an undisclosed mechanism across rows is a distinct
  // inconsistency from a family conflict, and must also throw.
  const anyMechanism = assetReachableFamilies[0].mechanisms[0];
  let threw = false;
  try {
    resolveMechanismFamilyFromMechanisms([anyMechanism, null], "synthetic mixed-disclosure asset");
  } catch {
    threw = true;
  }
  check(threw, "a mix of disclosed and undisclosed mechanism across rows must throw");
}

console.log(
  "  synthetic mechanism-family resolution: same-family wording accepted, cross-family and mixed-disclosure rejected",
);

// --- regimen display ------------------------------------------------------

const regimenProbeId = "eli-lilly-and-company-eloralintide-tirzepatide-obesity";
const regimenDisplay = getRegimenDisplay(regimenProbeId);
console.log(
  `  regimen display: ${regimenDisplay.name} / ${regimenDisplay.companyName} / ${regimenDisplay.mechanismFamilyId}`,
);
check(
  regimenDisplay.companyName === "Eli Lilly and Company",
  `regimen company name is "${regimenDisplay.companyName}", expected the registered company name`,
);
check(
  regimenDisplay.companyName !== "eli-lilly-and-company",
  "regimen display fell back to the companyId slug instead of the registered name",
);
check(
  regimenDisplay.mechanismFamilyId === "amylin-plus-glp1-gip-combination",
  `regimen family is "${regimenDisplay.mechanismFamilyId}"`,
);
check(regimenDisplay.mechanism === null, "a regimen must not report a mechanism string");

if (failures.length > 0) {
  console.error(`\n${failures.length} assertion(s) failed:`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
console.log("\nAll read-model assertions passed.");
