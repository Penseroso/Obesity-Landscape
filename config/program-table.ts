export type ProgramTableLocale = "ko" | "en";

export type ProgramTableColumnId =
  | "company"
  | "asset"
  | "route"
  | "dosageForm"
  | "dosingInterval"
  | "indications"
  | "development"
  | "mechanism"
  | "platform"
  | "companyCountry";

export type ProgramTableColumn = {
  id: ProgramTableColumnId;
  labels: Record<ProgramTableLocale, string>;
  defaultVisible: boolean;
};

export const programTableLocale: ProgramTableLocale = "en";

export const programTableColumns: ProgramTableColumn[] = [
  {
    id: "company",
    labels: { ko: "\uac1c\ubc1c\uc0ac", en: "Company" },
    defaultVisible: true,
  },
  {
    id: "asset",
    labels: { ko: "\uc790\uc0b0", en: "Asset" },
    defaultVisible: true,
  },
  {
    id: "route",
    labels: { ko: "\ud22c\uc5ec\uacbd\ub85c", en: "Route" },
    defaultVisible: true,
  },
  {
    id: "dosageForm",
    labels: { ko: "\uc81c\ud615", en: "Dosage Form" },
    defaultVisible: true,
  },
  {
    id: "dosingInterval",
    labels: { ko: "\ud22c\uc5ec\uc8fc\uae30", en: "Dosing Interval" },
    defaultVisible: true,
  },
  {
    id: "indications",
    labels: { ko: "\uc801\uc751\uc99d", en: "Indication" },
    defaultVisible: true,
  },
  {
    id: "development",
    labels: { ko: "\uac1c\ubc1c\ub2e8\uacc4", en: "Development Stage" },
    defaultVisible: true,
  },
  {
    id: "mechanism",
    labels: { ko: "\uc791\uc6a9\uae30\uc804", en: "Mechanism of Action" },
    defaultVisible: false,
  },
  {
    id: "platform",
    labels: { ko: "\ud50c\ub7ab\ud3fc", en: "Platform" },
    defaultVisible: false,
  },
  {
    id: "companyCountry",
    labels: { ko: "\ud68c\uc0ac \uad6d\uac00", en: "Company Country" },
    defaultVisible: false,
  },
];

export const defaultProgramTableColumns = programTableColumns.filter(
  (column) => column.defaultVisible,
);

export function getProgramTableColumnLabel(column: ProgramTableColumn) {
  return column.labels[programTableLocale];
}
