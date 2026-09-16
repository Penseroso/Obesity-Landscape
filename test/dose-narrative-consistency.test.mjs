import assert from "node:assert";
import test from "node:test";

import {
  extractSingleDoseMg,
  extractArmDoseMg,
  checkStudyDoseNarrativeConsistency,
  runDoseNarrativeConsistencyChecks,
  selfCheckDoseNarrativeConsistency,
} from "../scripts/dose-narrative-consistency.mjs";

function study(id, description) {
  return { id, design: { description } };
}

function arm(overrides) {
  return { id: `${overrides.studyId}-arm`, role: "experimental", ...overrides };
}

test("Test 1: direct incident replay is flagged (NCT07169942 shape: narrative 120 mg vs. Arm.dose 180 mg)", async () => {
  const s = study("s1", "Participants initiate treatment and titrate monthly to a 120 mg target dose.");
  const arms = [arm({ studyId: "s1", dose: "180 mg target dose" })];
  const finding = checkStudyDoseNarrativeConsistency(s, arms);
  assert.ok(finding, "expected a finding");
  assert.strictEqual(finding.narrativeMg, 120);
  assert.strictEqual(finding.resolvedMg, 180);
  assert.strictEqual(finding.resolvedField, "dose");
});

test("Test 2: titration-ceiling replay is flagged (DREAMS-3 shape: narrative 9 mg vs. Arm.dose/titration ceiling 6 mg)", async () => {
  const s = study("s2", "Once-weekly mazdutide, titrated up to 9 mg, versus placebo.");
  const arms = [
    arm({
      studyId: "s2",
      dose: "6 mg target dose",
      titration: "2 mg for 4 weeks; 4 mg for 4 weeks; 6 mg for the remaining 24 weeks",
    }),
  ];
  const finding = checkStudyDoseNarrativeConsistency(s, arms);
  assert.ok(finding, "expected a finding");
  assert.strictEqual(finding.narrativeMg, 9);
  assert.strictEqual(finding.resolvedMg, 6);
});

test("Test 2b: a head-to-head active-comparator Study (real DREAMS-3 shape) resolves to the focal asset's own clause, ignoring the foreign comparator arm and its dose", async () => {
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
  assert.ok(finding, "expected the focal asset's own dose mismatch to be flagged");
  assert.strictEqual(finding.armId, "s2b-focal");
  assert.strictEqual(finding.narrativeMg, 9);
  assert.strictEqual(finding.resolvedMg, 6);
});

test("Test 3: unit normalization (mcg vs. mg) is applied before comparing, both for mismatch and for agreement", async () => {
  const sMismatch = study("s3a", "Titrated to a target dose of 1000 mcg.");
  const armsMismatch = [arm({ studyId: "s3a", dose: "1.5 mg" })];
  const finding = checkStudyDoseNarrativeConsistency(sMismatch, armsMismatch);
  assert.ok(finding, "expected a finding after unit conversion");
  assert.ok(Math.abs(finding.narrativeMg - 1) < 0.0005);

  const sMatch = study("s3b", "Titrated to a target dose of 1000 mcg.");
  const armsMatch = [arm({ studyId: "s3b", dose: "1 mg" })];
  assert.strictEqual(
    checkStudyDoseNarrativeConsistency(sMatch, armsMatch),
    null,
    "matching values after unit conversion must not be flagged",
  );
});

test("Test 4: a multi-arm dose-ranging Study (>=2 dosed active arms) never enters comparison", async () => {
  const s = study("s4", "Randomized to cohorts titrated to 100 mg or 300 mg.");
  const arms = [
    arm({ studyId: "s4", id: "s4-a", dose: "100 mg" }),
    arm({ studyId: "s4", id: "s4-b", dose: "300 mg" }),
  ];
  assert.strictEqual(checkStudyDoseNarrativeConsistency(s, arms), null);
});

test("Test 5: missing Arm.dose resolves via the label fallback and agrees with the narrative (no finding)", async () => {
  const s = study("s5", "Titrated to a target dose of 2.4 mg.");
  const arms = [arm({ studyId: "s5", label: "Semaglutide 2.4 mg QW" })];
  assert.strictEqual(checkStudyDoseNarrativeConsistency(s, arms), null);
});

test("Test 6: no extractable structured value anywhere in the fallback chain is skipped, not flagged", async () => {
  const s = study("s6", "Titrated to a target dose of 9 mg.");
  const arms = [arm({ studyId: "s6", label: "Investigational product" })];
  assert.strictEqual(
    checkStudyDoseNarrativeConsistency(s, arms),
    null,
    "missing structured data is a coverage gap, not a narrative contradiction",
  );
});

test("Test 7: extractArmDoseMg resolves through dose -> titration -> label -> intervention in that order", async () => {
  assert.strictEqual(extractArmDoseMg({ dose: "45 mg" }).field, "dose");
  assert.strictEqual(extractArmDoseMg({ titration: "up to 45 mg" }).field, "titration");
  assert.strictEqual(extractArmDoseMg({ label: "Drug 45 mg" }).field, "label");
  assert.strictEqual(extractArmDoseMg({ intervention: "Drug 45 mg SC" }).field, "intervention");
  assert.strictEqual(extractArmDoseMg({ label: "Investigational product" }), null);
});

test("Test 8: an ambiguous narrative with two distinct dose candidates near anchors is skipped, never guessed", async () => {
  const s = study("s8", "Titrated to a target dose of 6 mg or 9 mg depending on tolerability.");
  const arms = [arm({ studyId: "s8", dose: "6 mg" })];
  assert.strictEqual(extractSingleDoseMg(s.design.description), null);
  assert.strictEqual(checkStudyDoseNarrativeConsistency(s, arms), null);
});

test("Test 9: no keyword-based suppression exists — superseded/earlier-design language does not hide an unrelated mismatch", async () => {
  const s = study(
    "s9",
    "Current design, superseding an earlier design: titrated to a target dose of 120 mg.",
  );
  const arms = [arm({ studyId: "s9", dose: "180 mg" })];
  const finding = checkStudyDoseNarrativeConsistency(s, arms);
  assert.ok(finding, "superseded/conflict language must never suppress detection");
  assert.strictEqual(finding.narrativeMg, 120);
  assert.strictEqual(finding.resolvedMg, 180);
});

test("Test 10: agreeing narrative and structured values are never flagged", async () => {
  const s = study("s10", "Titrated to a target dose of 45 mg.");
  const arms = [arm({ studyId: "s10", dose: "45 mg target dose" })];
  assert.strictEqual(checkStudyDoseNarrativeConsistency(s, arms), null);
});

test("Test 11: runDoseNarrativeConsistencyChecks aggregates findings across multiple Studies", async () => {
  const studies = [
    study("s11a", "Titrated to a target dose of 120 mg."),
    study("s11b", "Titrated to a target dose of 45 mg."),
  ];
  const arms = [
    arm({ studyId: "s11a", dose: "180 mg" }),
    arm({ studyId: "s11b", dose: "45 mg" }),
  ];
  const findings = runDoseNarrativeConsistencyChecks(studies, arms);
  assert.strictEqual(findings.length, 1);
  assert.strictEqual(findings[0].studyId, "s11a");
});

test("Test 12: selfCheckDoseNarrativeConsistency runs clean against its own synthetic fixtures", async () => {
  assert.doesNotThrow(() => selfCheckDoseNarrativeConsistency());
});
