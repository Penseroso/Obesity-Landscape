import type { PipelineProgram, ProgramFilters } from "./types";

export const emptyProgramFilters: ProgramFilters = {
  company: "All",
  indication: "All",
  route: "All",
  stage: "All",
  status: "All",
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
    const matchesStatus =
      filters.status === "All" || program.development.status === filters.status;

    // Keyword search is limited to fields a user can actually see somewhere
    // in the UI (company, asset, code name, mechanism, platform, indication,
    // route, dosage form, dosing interval, stage, status) - internal
    // identifiers such as id/assetId/companyId are never matched.
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
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return (
      matchesCompany &&
      matchesIndication &&
      matchesRoute &&
      matchesStage &&
      matchesStatus &&
      (!keyword || searchable.includes(keyword))
    );
  });
}
