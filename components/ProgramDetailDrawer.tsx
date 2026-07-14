"use client";

import { useEffect, useId, useRef } from "react";
import { SourceList } from "@/components/SourceList";
import { StudyPreviewList } from "@/components/clinical/StudyPreviewList";
import type { AssetStudyPreview } from "@/lib/clinical-evidence/selectors";
import { formatInlineValues, formatNullableValue } from "@/lib/format";
import type { PipelineProgram } from "@/lib/programs/types";

type ProgramDetailDrawerProps = {
  program: PipelineProgram | null;
  /**
   * Asset-scoped clinical preview when this asset has Clinical Evidence, else
   * null. Precomputed server-side so this client component never imports the
   * clinical data layer.
   */
  clinicalPreview?: AssetStudyPreview | null;
  onClose: () => void;
};

function DetailRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="grid gap-1 border-b border-border py-3 sm:grid-cols-[10rem_1fr] sm:gap-4">
      <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </dt>
      <dd className="text-sm text-foreground">{formatNullableValue(value)}</dd>
    </div>
  );
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

export function ProgramDetailDrawer({
  program,
  clinicalPreview,
  onClose,
}: ProgramDetailDrawerProps) {
  const panelRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const headingId = useId();

  // Lock background scroll while the drawer is open; always restore the
  // exact previous inline value, whether the drawer closes or the whole
  // component unmounts.
  useEffect(() => {
    if (!program) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [program]);

  // Move focus into the dialog when it opens (or when the displayed program
  // changes while it's already open).
  useEffect(() => {
    if (!program) {
      return;
    }

    closeButtonRef.current?.focus();
  }, [program]);

  // Escape closes the dialog; Tab/Shift+Tab is trapped inside the panel.
  useEffect(() => {
    if (!program) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== "Tab" || !panelRef.current) {
        return;
      }

      const focusable = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      ).filter((element) => element.offsetParent !== null);

      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      const activeIsInPanel = active instanceof Node && panelRef.current.contains(active);

      if (event.shiftKey) {
        if (!activeIsInPanel || active === first) {
          event.preventDefault();
          last.focus();
        }
      } else if (!activeIsInPanel || active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [program, onClose]);

  if (!program) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50">
      <button
        aria-label="Close program detail"
        className="absolute inset-0 cursor-default bg-foreground/30"
        onClick={onClose}
      />
      <aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        className="absolute right-0 top-0 flex h-full w-full max-w-2xl flex-col border-l border-border bg-card shadow-soft"
      >
        <div className="border-b border-border px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-primary">
                {formatNullableValue(program.company?.name)}
              </p>
              <h2
                id={headingId}
                className="mt-1 text-2xl font-semibold tracking-tight text-card-foreground"
              >
                {program.assetName}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Code {formatNullableValue(program.codeName)}
              </p>
            </div>
            <button
              ref={closeButtonRef}
              type="button"
              onClick={onClose}
              className="rounded-md border border-border px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              Close
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {clinicalPreview ? (
            <StudyPreviewList preview={clinicalPreview} />
          ) : null}
          <dl>
            <DetailRow label="Program ID" value={program.id} />
            <DetailRow label="Asset ID" value={program.assetId} />
            <DetailRow label="Company ID" value={program.companyId} />
            <DetailRow label="Company" value={program.company?.name} />
            <DetailRow
              label="Company country"
              value={program.company?.headquartersCountry}
            />
            <DetailRow label="Mechanism" value={program.technical.mechanism} />
            <DetailRow label="Platform" value={program.technical.platform} />
            <DetailRow
              label="Route"
              value={program.administration.route}
            />
            <DetailRow
              label="Dosage form"
              value={program.administration.dosageForm}
            />
            <DetailRow
              label="Interval"
              value={program.administration.dosingInterval}
            />
            <DetailRow
              label="Indications"
              value={formatInlineValues(program.indications)}
            />
            <DetailRow label="Stage" value={program.development.stage} />
            <DetailRow label="Status" value={program.development.status} />
            <DetailRow
              label="Last verified"
              value={program.metadata.lastVerifiedAt}
            />
            <DetailRow label="Updated" value={program.metadata.updatedAt} />
            <div className="grid gap-1 border-b border-border py-3 sm:grid-cols-[10rem_1fr] sm:gap-4">
              <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Sources
              </dt>
              <dd className="space-y-2 text-sm">
                <SourceList sources={program.metadata.sources} emptyLabel="N/A" />
              </dd>
            </div>
          </dl>
        </div>
      </aside>
    </div>
  );
}
