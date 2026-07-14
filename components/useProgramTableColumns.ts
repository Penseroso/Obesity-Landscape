"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  clampProgramTableColumnWidth,
  defaultColumnOrder,
  defaultColumnVisibility,
  defaultColumnWidths,
  isKnownColumnId,
  isLockedColumn,
  lockedColumnIds,
  programTableColumnById,
  type ProgramTableColumn,
  type ProgramTableColumnId,
} from "@/config/program-table";

export const COLUMN_PREFS_STORAGE_KEY =
  "obesity-landscape.program-register.columns.v2";

const LOCKED_COUNT = lockedColumnIds.length;

// Module 3's initial Register widths totaled 1,275px, which pushed the last
// default-visible column beyond the content area on common desktop screens.
// Recognize that exact default set so stored, uncustomized widths migrate to
// the compact defaults without discarding a user's column choices.
const previousDefaultColumnWidths: Record<ProgramTableColumnId, number> = {
  company: 180,
  asset: 210,
  mechanism: 200,
  indications: 220,
  route: 130,
  dosingInterval: 155,
  development: 180,
  status: 130,
  dosageForm: 140,
  platform: 180,
  companyCountry: 165,
};

type ColumnPreferences = {
  order: ProgramTableColumnId[];
  visible: Record<ProgramTableColumnId, boolean>;
  widths: Record<ProgramTableColumnId, number>;
};

function getDefaultPreferences(): ColumnPreferences {
  return {
    order: [...defaultColumnOrder],
    visible: { ...defaultColumnVisibility },
    widths: { ...defaultColumnWidths },
  };
}

function countVisibleAdditional(prefs: ColumnPreferences): number {
  return prefs.order.filter(
    (id) => !isLockedColumn(id) && prefs.visible[id],
  ).length;
}

function hasPreviousDefaultWidths(rawWidths: Record<string, unknown>) {
  return defaultColumnOrder.every(
    (id) => rawWidths[id] === previousDefaultColumnWidths[id],
  );
}

/**
 * Coerce an arbitrary (possibly persisted, possibly hand-edited) value into a
 * safe, complete preference object:
 * - keep only known column ids, in their stored relative order, deduped
 * - append any known columns missing from the stored order (newly supported
 *   columns) in their canonical default position order
 * - force the locked columns (Company, Asset) to the front, always visible
 * - default the visibility of any column not explicitly stored
 * - guarantee at least one additional column stays visible
 */
function normalizePreferences(raw: unknown): ColumnPreferences {
  const fallback = getDefaultPreferences();

  const rawOrder = Array.isArray((raw as ColumnPreferences)?.order)
    ? (raw as ColumnPreferences).order
    : [];
  const rawVisible =
    raw && typeof (raw as ColumnPreferences).visible === "object"
      ? (raw as ColumnPreferences).visible
      : {};
  const rawWidths =
    raw && typeof (raw as ColumnPreferences).widths === "object"
      ? (raw as ColumnPreferences).widths
      : {};
  const shouldMigrateDefaultWidths = hasPreviousDefaultWidths(
    rawWidths as Record<string, unknown>,
  );

  const seen = new Set<ProgramTableColumnId>();
  const storedOrder: ProgramTableColumnId[] = [];
  for (const id of rawOrder) {
    if (isKnownColumnId(id) && !seen.has(id)) {
      seen.add(id);
      storedOrder.push(id);
    }
  }
  // Append newly supported / missing columns in canonical order.
  for (const id of defaultColumnOrder) {
    if (!seen.has(id)) {
      storedOrder.push(id);
    }
  }

  // Locked columns first, in their canonical order, then the rest.
  const nonLocked = storedOrder.filter((id) => !isLockedColumn(id));
  const order = [...lockedColumnIds, ...nonLocked];

  const visible = {} as Record<ProgramTableColumnId, boolean>;
  const widths = {} as Record<ProgramTableColumnId, number>;
  for (const id of order) {
    if (isLockedColumn(id)) {
      visible[id] = true;
    } else {
      const storedValue = (rawVisible as Record<string, unknown>)[id];
      visible[id] =
        typeof storedValue === "boolean"
          ? storedValue
          : defaultColumnVisibility[id];
    }
    const storedWidth = shouldMigrateDefaultWidths
      ? undefined
      : (rawWidths as Record<string, unknown>)[id];
    widths[id] = clampProgramTableColumnWidth(
      id,
      typeof storedWidth === "number" && Number.isFinite(storedWidth)
        ? storedWidth
        : defaultColumnWidths[id],
    );
  }

  const normalized: ColumnPreferences = { order, visible, widths };

  // Enforce the "at least one additional visible column" invariant. If a
  // corrupt/hand-edited value hides everything optional, fall back to the
  // default visibility rather than rendering a Company/Asset-only table.
  if (countVisibleAdditional(normalized) === 0) {
    normalized.visible = { ...defaultColumnVisibility };
  }

  return normalized.order.length > 0 ? normalized : fallback;
}

function parseStoredPreferences(value: string | null): ColumnPreferences | null {
  if (!value) {
    return null;
  }
  try {
    return normalizePreferences(JSON.parse(value));
  } catch {
    return null;
  }
}

export type ProgramColumnControls = {
  hydrated: boolean;
  orderedColumns: ProgramTableColumn[];
  visibleColumns: ProgramTableColumn[];
  isVisible: (id: ProgramTableColumnId) => boolean;
  isLocked: (id: ProgramTableColumnId) => boolean;
  canToggle: (id: ProgramTableColumnId) => boolean;
  canMoveUp: (id: ProgramTableColumnId) => boolean;
  canMoveDown: (id: ProgramTableColumnId) => boolean;
  toggleColumn: (id: ProgramTableColumnId) => void;
  moveColumnUp: (id: ProgramTableColumnId) => void;
  moveColumnDown: (id: ProgramTableColumnId) => void;
  getColumnWidth: (id: ProgramTableColumnId) => number;
  setColumnWidth: (id: ProgramTableColumnId, width: number) => void;
  resetColumnWidth: (id: ProgramTableColumnId) => void;
  resetColumns: () => void;
  isDefault: boolean;
};

export function useProgramTableColumns(): ProgramColumnControls {
  const [prefs, setPrefs] = useState<ColumnPreferences>(getDefaultPreferences);
  const [hydrated, setHydrated] = useState(false);
  const hydratedRef = useRef(false);

  // Load persisted preferences on the client only, after the first render, so
  // server and initial client markup both use defaults (no hydration mismatch).
  // Syncing once from an external store (localStorage) into state on mount is
  // the intended hydration-safe pattern here, hence the targeted disable.
  useEffect(() => {
    const stored = parseStoredPreferences(
      window.localStorage.getItem(COLUMN_PREFS_STORAGE_KEY),
    );
    if (stored) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPrefs(stored);
    }
    hydratedRef.current = true;
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydratedRef.current) {
      return;
    }
    try {
      window.localStorage.setItem(
        COLUMN_PREFS_STORAGE_KEY,
        JSON.stringify(prefs),
      );
    } catch {
      // Ignore storage failures (private mode, quota); UI state still works.
    }
  }, [prefs]);

  const orderedColumns = useMemo(
    () => prefs.order.map((id) => programTableColumnById[id]),
    [prefs.order],
  );

  const visibleColumns = useMemo(
    () => orderedColumns.filter((column) => prefs.visible[column.id]),
    [orderedColumns, prefs.visible],
  );

  const isVisible = useCallback(
    (id: ProgramTableColumnId) => prefs.visible[id],
    [prefs.visible],
  );

  const getColumnWidth = useCallback(
    (id: ProgramTableColumnId) => prefs.widths[id],
    [prefs.widths],
  );

  const canToggle = useCallback(
    (id: ProgramTableColumnId) => {
      if (isLockedColumn(id)) {
        return false;
      }
      // Prevent hiding the last remaining additional column.
      if (prefs.visible[id] && countVisibleAdditional(prefs) <= 1) {
        return false;
      }
      return true;
    },
    [prefs],
  );

  const canMoveUp = useCallback(
    (id: ProgramTableColumnId) => {
      if (isLockedColumn(id)) {
        return false;
      }
      return prefs.order.indexOf(id) > LOCKED_COUNT;
    },
    [prefs.order],
  );

  const canMoveDown = useCallback(
    (id: ProgramTableColumnId) => {
      if (isLockedColumn(id)) {
        return false;
      }
      const index = prefs.order.indexOf(id);
      return index >= LOCKED_COUNT && index < prefs.order.length - 1;
    },
    [prefs.order],
  );

  const toggleColumn = useCallback((id: ProgramTableColumnId) => {
    setPrefs((current) => {
      if (isLockedColumn(id)) {
        return current;
      }
      const nextVisible = current.visible[id]
        ? countVisibleAdditional(current) <= 1
          ? current.visible[id] // guard: keep last additional column visible
          : false
        : true;

      if (nextVisible === current.visible[id]) {
        return current;
      }
      return {
        ...current,
        visible: { ...current.visible, [id]: nextVisible },
      };
    });
  }, []);

  const move = useCallback(
    (id: ProgramTableColumnId, direction: -1 | 1) => {
      setPrefs((current) => {
        if (isLockedColumn(id)) {
          return current;
        }
        const index = current.order.indexOf(id);
        const target = index + direction;
        // Never move into the locked zone or off the ends.
        if (target < LOCKED_COUNT || target >= current.order.length) {
          return current;
        }
        const nextOrder = [...current.order];
        [nextOrder[index], nextOrder[target]] = [
          nextOrder[target],
          nextOrder[index],
        ];
        return { ...current, order: nextOrder };
      });
    },
    [],
  );

  const moveColumnUp = useCallback(
    (id: ProgramTableColumnId) => move(id, -1),
    [move],
  );
  const moveColumnDown = useCallback(
    (id: ProgramTableColumnId) => move(id, 1),
    [move],
  );

  const setColumnWidth = useCallback(
    (id: ProgramTableColumnId, width: number) => {
      setPrefs((current) => {
        const nextWidth = clampProgramTableColumnWidth(id, width);
        if (nextWidth === current.widths[id]) return current;
        return {
          ...current,
          widths: { ...current.widths, [id]: nextWidth },
        };
      });
    },
    [],
  );

  const resetColumnWidth = useCallback((id: ProgramTableColumnId) => {
    setColumnWidth(id, defaultColumnWidths[id]);
  }, [setColumnWidth]);

  const resetColumns = useCallback(() => {
    setPrefs(getDefaultPreferences());
  }, []);

  const isDefault = useMemo(() => {
    const sameOrder = prefs.order.every(
      (id, index) => id === defaultColumnOrder[index],
    );
    const sameVisibility = defaultColumnOrder.every(
      (id) => prefs.visible[id] === defaultColumnVisibility[id],
    );
    const sameWidths = defaultColumnOrder.every(
      (id) => prefs.widths[id] === defaultColumnWidths[id],
    );
    return sameOrder && sameVisibility && sameWidths;
  }, [prefs]);

  return {
    hydrated,
    orderedColumns,
    visibleColumns,
    isVisible,
    isLocked: isLockedColumn,
    canToggle,
    canMoveUp,
    canMoveDown,
    toggleColumn,
    moveColumnUp,
    moveColumnDown,
    getColumnWidth,
    setColumnWidth,
    resetColumnWidth,
    resetColumns,
    isDefault,
  };
}
