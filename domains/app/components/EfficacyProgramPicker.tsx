"use client";

import { Modal } from "@/domains/app/components/Modal";
import { Button } from "@/domains/app/components/ui/Button";
import type { EfficacyFamilyGroup } from "@/domains/app/lib/efficacy-comparison/read-model";

export const EFFICACY_COMPARE_MAX_SELECTION = 5;

type EfficacyProgramPickerProps = {
  families: EfficacyFamilyGroup[];
  selected: Set<string>;
  onToggle: (unitKey: string) => void;
  onClose: () => void;
  onCompare: () => void;
};

/**
 * Selection dialog for the compare chart. Lists every row already eligible for
 * the main comparison view, grouped by mechanism family in the same curated
 * order as the page itself (never re-sorted by magnitude). Selection is capped
 * at `EFFICACY_COMPARE_MAX_SELECTION` so the chart modal stays legible; once at
 * the cap, unchecked boxes disable rather than silently doing nothing on click.
 */
export function EfficacyProgramPicker({
  families,
  selected,
  onToggle,
  onClose,
  onCompare,
}: EfficacyProgramPickerProps) {
  const atLimit = selected.size >= EFFICACY_COMPARE_MAX_SELECTION;

  return (
    <Modal title="Compare programs" onClose={onClose} maxWidthClassName="max-w-2xl">
      <p className="text-sm text-muted-foreground">
        Select up to {EFFICACY_COMPARE_MAX_SELECTION} programs to chart together.
        Selection can span mechanism families.
      </p>
      <div className="mt-4 space-y-6">
        {families.map((group) => (
          <fieldset key={group.family.id}>
            <legend className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              {group.family.label}
            </legend>
            <ul className="mt-2 space-y-0.5">
              {group.rows.map((row) => {
                const checked = selected.has(row.unitKey);
                const disabled = !checked && atLimit;
                return (
                  <li key={row.unitKey}>
                    <label
                      className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm ${
                        disabled ? "opacity-50" : "cursor-pointer hover:bg-muted"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={disabled}
                        onChange={() => onToggle(row.unitKey)}
                        className="h-4 w-4 shrink-0 rounded border-border text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                      />
                      <span className="min-w-0">
                        <span className="block leading-5 text-card-foreground">
                          {row.name}
                        </span>
                        <span className="block text-xs leading-4 text-muted-foreground">
                          {row.companyName}
                        </span>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </fieldset>
        ))}
      </div>
      <div className="sticky bottom-0 -mx-6 -mb-5 mt-6 flex items-center justify-between border-t border-border bg-card px-6 py-4">
        <span className="text-sm text-muted-foreground">
          {selected.size} / {EFFICACY_COMPARE_MAX_SELECTION} selected
        </span>
        <Button
          variant="primary"
          onClick={onCompare}
          disabled={selected.size === 0}
          className="disabled:cursor-not-allowed disabled:opacity-50"
        >
          Compare
        </Button>
      </div>
    </Modal>
  );
}
