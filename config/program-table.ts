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
  defaultWidth: number;
  minWidth: number;
  maxWidth: number;
};

export const programTableLocale: ProgramTableLocale = "en";

// Default-visible columns come first in register order. Indication replaces
// Dosage Form in the default set; all supported columns remain configurable.
export const programTableColumns: ProgramTableColumn[] = [
  {
    id: "company",
    labels: { ko: "회사", en: "Company" },
    defaultVisible: true,
    defaultWidth: 160,
    minWidth: 120,
    maxWidth: 320,
  },
  {
    id: "asset",
    labels: { ko: "자산", en: "Asset" },
    defaultVisible: true,
    defaultWidth: 185,
    minWidth: 140,
    maxWidth: 360,
  },
  {
    id: "mechanism",
    labels: { ko: "작용기전", en: "Mechanism" },
    defaultVisible: true,
    defaultWidth: 175,
    minWidth: 140,
    maxWidth: 360,
  },
  {
    id: "indications",
    labels: { ko: "적응증", en: "Indication" },
    defaultVisible: true,
    defaultWidth: 185,
    minWidth: 150,
    maxWidth: 420,
  },
  {
    id: "route",
    labels: { ko: "투여경로", en: "Route" },
    defaultVisible: true,
    defaultWidth: 115,
    minWidth: 95,
    maxWidth: 220,
  },
  {
    id: "dosingInterval",
    labels: { ko: "투여주기", en: "Dosing Interval" },
    defaultVisible: true,
    defaultWidth: 130,
    minWidth: 110,
    maxWidth: 260,
  },
  {
    id: "development",
    labels: { ko: "개발단계", en: "Development Stage" },
    defaultVisible: true,
    defaultWidth: 160,
    minWidth: 140,
    maxWidth: 280,
  },
  {
    id: "status",
    labels: { ko: "상태", en: "Status" },
    defaultVisible: false,
    defaultWidth: 130,
    minWidth: 100,
    maxWidth: 220,
  },
  {
    id: "dosageForm",
    labels: { ko: "제형", en: "Dosage Form" },
    defaultVisible: false,
    defaultWidth: 140,
    minWidth: 100,
    maxWidth: 240,
  },
  {
    id: "platform",
    labels: { ko: "플랫폼", en: "Platform" },
    defaultVisible: false,
    defaultWidth: 180,
    minWidth: 120,
    maxWidth: 320,
  },
  {
    id: "companyCountry",
    labels: { ko: "회사 국가", en: "Company Country" },
    defaultVisible: false,
    defaultWidth: 165,
    minWidth: 120,
    maxWidth: 300,
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

export const defaultColumnOrder: ProgramTableColumnId[] =
  programTableColumns.map((column) => column.id);

export const defaultColumnVisibility: Record<ProgramTableColumnId, boolean> =
  Object.fromEntries(
    programTableColumns.map((column) => [column.id, column.defaultVisible]),
  ) as Record<ProgramTableColumnId, boolean>;

export const defaultColumnWidths: Record<ProgramTableColumnId, number> =
  Object.fromEntries(
    programTableColumns.map((column) => [column.id, column.defaultWidth]),
  ) as Record<ProgramTableColumnId, number>;

export function clampProgramTableColumnWidth(
  id: ProgramTableColumnId,
  width: number,
): number {
  const column = programTableColumnById[id];
  return Math.min(column.maxWidth, Math.max(column.minWidth, Math.round(width)));
}

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
