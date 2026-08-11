import {
  getMechanismFamilyId,
  getScopeClassEntry,
  getStageBucketId,
} from "./constants";
import type { PipelineProgram, ProgramFilters } from "./types";

export const emptyProgramFilters: ProgramFilters = {
  company: "All",
  indication: "All",
  route: "All",
  stage: "All",
  stageBucket: "All",
  status: "All",
  scopeClass: "All",
  mechanismFamily: "All",
  keyword: "",
};

export function filterPrograms(
  programs: PipelineProgram[],
  filters: ProgramFilters,
) {
  const keyword = filters.keyword.trim().toLowerCase();

  return programs.filter((program) => {
    const companyName = program.company?.name ?? "";
    const matchesCompany =
      filters.company === "All" || companyName === filters.company;
    const matchesIndication =
      filters.indication === "All" ||
      program.indications.includes(filters.indication);
    const matchesRoute =
      filters.route === "All" || program.administration.route === filters.route;
    const matchesStage =
      filters.stage === "All" || program.development.stage === filters.stage;
    // Bucket match reuses the same getStageBucketId mapping as the Company ×
    // Development Stage Matrix, so a drill-down reproduces the clicked cell's
    // set exactly (no regrouping). Independent of the label-level `stage`.
    const matchesStageBucket =
      filters.stageBucket === "All" ||
      getStageBucketId(program.development.stage) === filters.stageBucket;
    const matchesStatus =
      filters.status === "All" || program.development.status === filters.status;
    const matchesScopeClass =
      filters.scopeClass === "All" || program.scopeClass === filters.scopeClass;
    // Mirrors the Company × Development Stage Matrix's stageBucket drill-down:
    // resolved by registry family, not the raw mechanism string, so this
    // reproduces the Mechanism Mix donut's slice exactly (several raw
    // mechanism strings can share one family).
    const matchesMechanismFamily =
      filters.mechanismFamily === "All" ||
      (filters.mechanismFamily === "undisclosed"
        ? program.technical.mechanism === null
        : program.technical.mechanism !== null &&
          getMechanismFamilyId(program.technical.mechanism) ===
            filters.mechanismFamily);

    // Keyword search is limited to fields a user can actually see somewhere
    // in the UI (company, asset, code name, mechanism, platform, indication,
    // route, dosage form, dosing interval, stage, status, scope class label) -
    // internal identifiers such as id/assetId/companyId are never matched.
    const searchable = [
      companyName,
      program.assetName,
      program.codeName,
      program.technical.mechanism,
      program.technical.platform,
      program.administration.route,
      program.administration.dosageForm,
      program.administration.dosingInterval,
      program.indications.join(" "),
      program.development.stage,
      program.development.status,
      getScopeClassEntry(program.scopeClass).label,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return (
      matchesCompany &&
      matchesIndication &&
      matchesRoute &&
      matchesStage &&
      matchesStageBucket &&
      matchesStatus &&
      matchesScopeClass &&
      matchesMechanismFamily &&
      (!keyword || searchable.includes(keyword))
    );
  });
}
