/**
 * Deterministic probe for the Efficacy Comparison read model.
 *
 * Distinct from `data:probe:efficacy-population-coverage`, which reads the generated
 * aggregate directly and freezes the accepted 10-of-15 gate. This one drives the
 * **TypeScript read model** and asserts it reaches the same disposition, so the two
 * implementations of the eligibility ladder cannot drift apart silently.
 *
 * It also proves the property the whole page rests on: every number rendered is a
 * stored `result.value`, never a computed one.
 */
import { readFileSync } from "node:fs";

import { getEfficacyComparison } from "@/domains/app/lib/efficacy-comparison/read-model";
import { EFFICACY_OVERVIEW_UNIT } from "@/domains/app/lib/efficacy-comparison/policy";

const aggregate = JSON.parse(
  readFileSync("data/generated/clinical-evidence.json", "utf8"),
) as {
  outcomes: {
    id: string;
    result: { value: string; resultType: string };
  }[];
};

const storedValues = new Set(aggregate.outcomes.map((outcome) => outcome.result.value));
const resultTypeById = new Map(
  aggregate.outcomes.map((outcome) => [outcome.id, outcome.result.resultType]),
);

/** The reviewed gate, mirroring the JS coverage probe (ADR-0045). */
const REVIEWED = {
  eligibleUnits: 10,
  gapUnits: 5,
  totalUnits: 15,
  headToHeadStudies: 5,
  headToHeadPairs: 7,
  gaps: {
    "asset:amgen/maridebart-cafraglutide": "population-mixed-diabetes-status",
    "asset:novo-nordisk/cagrilintide": "population-diabetes-status-not-specified",
    "asset:novo-nordisk/liraglutide": "metric-unavailable-percent",
    "asset:novo-nordisk/ubt251": "population-diabetes-status-not-specified",
    "asset:roche/ct-996": "population-mixed-diabetes-status",
  } as Record<string, string>,
};

const failures: string[] = [];
const check = (condition: boolean, message: string) => {
  if (!condition) failures.push(message);
};

const view = getEfficacyComparison();
const rows = view.families.flatMap((group) => group.rows);

console.log("Efficacy Comparison read model");
console.log(`  units: ${view.totalUnits}  rows: ${rows.length}  gaps: ${view.gaps.length}`);
console.log("  families and rows:");
for (const group of view.families) {
  console.log(`    ${group.family.label} [${group.family.composition}]`);
  for (const row of group.rows) {
    const treatment = row.evidence.treatmentValues
      .map((value) => `${value.value} ${value.unit} (${value.label})`)
      .join("; ");
    const placebo = row.evidence.placeboValues
      .map((value) => `${value.value} ${value.unit}`)
      .join("; ");
    console.log(
      `      ${row.name} — ${row.evidence.studyTitle} [${row.evidence.phase}] ` +
        `${row.evidence.endpointName} @ ${row.evidence.assessmentTimepoint}`,
    );
    console.log(`         treatment: ${treatment}`);
    console.log(`         placebo:   ${placebo || "(none in group)"}`);
    console.log(
      `         betweenArm: ${row.evidence.storedBetweenArmValues.length} stored`,
    );
  }
}
console.log("  coverage gaps:");
for (const gap of view.gaps) console.log(`    ${gap.unitKey} — ${gap.reason}`);

const h2hStudies = new Set(view.headToHead.map((pair) => pair.studyId));
console.log(
  `  head-to-head: ${h2hStudies.size} studies, ${view.headToHead.length} pairs`,
);
for (const pair of view.headToHead) {
  console.log(
    `    ${pair.studyTitle}: ${pair.left.label} :: ${pair.right.label}` +
      `  <- ${pair.evidence.kind === "between-arm" ? `between-arm ${pair.evidence.outcomeId}` : `arm-level group ${pair.evidence.groupKey.split("|")[0]}`}`,
  );
}

// --- assertions -----------------------------------------------------------

check(
  rows.length === REVIEWED.eligibleUnits,
  `eligible rows ${rows.length}, reviewed ${REVIEWED.eligibleUnits}`,
);
check(
  view.gaps.length === REVIEWED.gapUnits,
  `gaps ${view.gaps.length}, reviewed ${REVIEWED.gapUnits}`,
);
check(
  view.totalUnits === REVIEWED.totalUnits,
  `units ${view.totalUnits}, reviewed ${REVIEWED.totalUnits}`,
);
for (const [unitKey, reason] of Object.entries(REVIEWED.gaps)) {
  const gap = view.gaps.find((candidate) => candidate.unitKey === unitKey);
  check(Boolean(gap), `reviewed gap ${unitKey} is missing`);
  if (gap) check(gap.reason === reason, `${unitKey} reason ${gap.reason}, reviewed ${reason}`);
}
for (const gap of view.gaps) {
  check(Boolean(REVIEWED.gaps[gap.unitKey]), `unreviewed new gap ${gap.unitKey}`);
}

// Selection, never calculation.
for (const row of rows) {
  const all = [
    ...row.evidence.treatmentValues,
    ...row.evidence.placeboValues,
    ...row.evidence.storedBetweenArmValues,
  ];
  for (const value of all) {
    check(
      storedValues.has(value.value),
      `${row.name}: emitted value "${value.value}" is not a stored result.value`,
    );
  }
  for (const value of [...row.evidence.treatmentValues, ...row.evidence.placeboValues]) {
    check(
      value.unit === EFFICACY_OVERVIEW_UNIT,
      `${row.name}: overview value carries unit "${value.unit}"`,
    );
  }
  for (const value of row.evidence.storedBetweenArmValues) {
    check(
      resultTypeById.get(value.outcomeId) === "between-arm",
      `${row.name}: storedBetweenArmValues holds a non between-arm outcome`,
    );
  }
  check(
    row.evidence.treatmentValues.length > 0,
    `${row.name}: representative evidence has no treatment value`,
  );
}

// Head-to-head: entity pairs proven from the Outcome graph, never Arm co-presence.
check(
  h2hStudies.size === REVIEWED.headToHeadStudies,
  `head-to-head studies ${h2hStudies.size}, reviewed ${REVIEWED.headToHeadStudies}`,
);
check(
  view.headToHead.length === REVIEWED.headToHeadPairs,
  `head-to-head pairs ${view.headToHead.length}, reviewed ${REVIEWED.headToHeadPairs}`,
);
for (const pair of view.headToHead) {
  check(
    pair.left.key !== pair.right.key,
    `${pair.studyTitle}: pair has two identical entities`,
  );
  check(
    pair.evidence.kind === "between-arm"
      ? Boolean(pair.evidence.outcomeId)
      : Boolean(pair.evidence.groupKey),
    `${pair.studyTitle}: pair cites no Outcome proof`,
  );
}

if (failures.length > 0) {
  console.error(`\n${failures.length} assertion(s) failed:`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
console.log("\nAll read-model assertions passed.");
