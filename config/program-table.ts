export type ProgramTableLocale = "ko" | "en";

export type ProgramTableColumnId =
  | "company"
  | "asset"
  | "mechanism"
  | "dosageForm"
  | "route"
  | "dosingInterval"
  | "development"
  | "status"
  | "indications"
  | "platform"
  | "companyCountry";

export type ProgramTableColumn = {
  id: ProgramTableColumnId;
  labels: Record<ProgramTableLocale, string>;
  defaultVisible: boolean;
};

export const programTableLocale: ProgramTableLocale = "en";

// Default-visible columns are listed first, in the exact required
// register order. Hidden-but-supported columns follow.
export const programTableColumns: ProgramTableColumn[] = [
  {
    id: "company",
    labels: { ko: "개발사", en: "Company" },
    defaultVisible: true,
  },
  {
    id: "asset",
    labels: { ko: "자산", en: "Asset" },
    defaultVisible: true,
  },
  {
    id: "mechanism",
    labels: { ko: "작용기전", en: "Mechanism" },
    defaultVisible: true,
  },
  {
    id: "dosageForm",
    labels: { ko: "제형", en: "Dosage Form" },
    defaultVisible: true,
  },
  {
    id: "route",
    labels: { ko: "투여경로", en: "Route" },
    defaultVisible: true,
  },
  {
    id: "dosingInterval",
    labels: { ko: "투여주기", en: "Dosing Interval" },
    defaultVisible: true,
  },
  {
    id: "development",
    labels: { ko: "개발단계", en: "Development Stage" },
    defaultVisible: true,
  },
  {
    id: "status",
    labels: { ko: "상태", en: "Status" },
    defaultVisible: false,
  },
  {
    id: "indications",
    labels: { ko: "적응증", en: "Indication" },
    defaultVisible: false,
  },
  {
    id: "platform",
    labels: { ko: "플랫폼", en: "Platform" },
    defaultVisible: false,
  },
  {
    id: "companyCountry",
    labels: { ko: "회사 국가", en: "Company Country" },
    defaultVisible: false,
  },
];

export const defaultProgramTableColumns = programTableColumns.filter(
  (column) => column.defaultVisible,
);

// Company and Asset are always shown, always first/second, and cannot be
// hidden or reordered. Everything else is user-customizable.
export const lockedColumnIds: ProgramTableColumnId[] = ["company", "asset"];

export const programTableColumnById: Record<
  ProgramTableColumnId,
  ProgramTableColumn
> = Object.fromEntries(
  programTableColumns.map((column) => [column.id, column]),
) as Record<ProgramTableColumnId, ProgramTableColumn>;

// Canonical ordering of every supported column, used as the default order
// and as the append order for newly supported columns loaded from older
// saved preferences.
export const defaultColumnOrder: ProgramTableColumnId[] =
  programTableColumns.map((column) => column.id);

export const defaultColumnVisibility: Record<ProgramTableColumnId, boolean> =
  Object.fromEntries(
    programTableColumns.map((column) => [column.id, column.defaultVisible]),
  ) as Record<ProgramTableColumnId, boolean>;

export function isLockedColumn(id: ProgramTableColumnId): boolean {
  return lockedColumnIds.includes(id);
}

export function isKnownColumnId(value: unknown): value is ProgramTableColumnId {
  return (
    typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(programTableColumnById, value)
  );
}

export function getProgramTableColumnLabel(column: ProgramTableColumn) {
  return column.labels[programTableLocale];
}
