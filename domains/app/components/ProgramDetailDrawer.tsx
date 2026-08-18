"use client";

import Link from "next/link";
import { ArrowRight, X } from "lucide-react";
import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { SourceList } from "@/domains/app/components/SourceList";
import { StudyPreviewList } from "@/domains/app/components/clinical/StudyPreviewList";
import type {
  AssetClinicalRollup,
  ProgramStudyPreview,
} from "@/domains/app/lib/clinical-evidence/selectors";
import { getScopeClassEntry } from "@/domains/company-pipeline/lib/constants";
import { formatInlineValues, formatNullableValue } from "@/domains/app/lib/format";
import type { PipelineProgram } from "@/domains/company-pipeline/lib/types";

type ProgramDetailDrawerProps = {
  program: PipelineProgram | null;
  /**
   * Explicit programId-scoped clinical preview, or null when no Study names
   * this program. Precomputed server-side without inference.
   */
  clinicalPreview?: ProgramStudyPreview | null;
  /** Asset-wide focal/linked context. This is intentionally not program-scoped. */
  clinicalContext?: AssetClinicalRollup | null;
  /** True while the on-demand clinical fetch for the open program is in flight. */
  clinicalLoading?: boolean;
  onClose: () => void;
};

function DetailRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="grid gap-1 border-b border-border px-4 py-3 last:border-b-0 sm:grid-cols-[10rem_1fr] sm:gap-4">
      <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </dt>
      <dd className="text-sm text-foreground">{formatNullableValue(value)}</dd>
    </div>
  );
}

function DetailGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-md border border-border bg-card">
      <h3 className="border-b border-border bg-muted/40 px-4 py-3 text-sm font-semibold text-foreground">
        {title}
      </h3>
      <dl>{children}</dl>
    </section>
  );
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

function AssetClinicalContext({
  clinicalPreview,
  clinicalContext,
  clinicalLoading,
}: {
  clinicalPreview?: ProgramStudyPreview | null;
  clinicalContext?: AssetClinicalRollup | null;
  clinicalLoading?: boolean;
}) {
  const hasAssetStudies = clinicalContext?.hasStudies ?? false;

  return (
    <section aria-label="Asset-level clinical context" className="mb-5 border-b border-border pb-5">
      <h3 className="text-sm font-semibold text-foreground">
        Broader clinical context for this asset
      </h3>
      {clinicalLoading ? (
        <p className="mt-2 text-sm text-muted-foreground">
          Loading clinical evidence…
        </p>
      ) : hasAssetStudies && clinicalContext ? (
        <>
          <p className="mt-2 text-sm text-muted-foreground">
            {clinicalContext.focalStudyCount} focal{" "}
            {clinicalContext.focalStudyCount === 1 ? "study" : "studies"}
            {clinicalContext.linkedStudyCount > 0
              ? ` and ${clinicalContext.linkedStudyCount} linked ${
                  clinicalContext.linkedStudyCount === 1 ? "study" : "studies"
                }`
              : ""}
            .
          </p>
          {!clinicalPreview ? (
            <p className="mt-2 text-sm text-muted-foreground">
              No Study is explicitly mapped to this Program.
            </p>
          ) : null}
          <Link
            href={clinicalContext.href}
            className="mt-3 inline-flex items-center gap-1 rounded-md border border-border bg-accent px-3 py-2 text-sm font-semibold text-accent-foreground transition hover:bg-accent/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            View Asset Clinical Studies
            <ArrowRight aria-hidden="true" className="h-4 w-4" />
          </Link>
        </>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">
          {clinicalPreview
            ? "No additional focal or linked clinical context is recorded for this asset."
            : "No clinical studies are recorded for this Program or asset yet."}
        </p>
      )}
    </section>
  );
}

export function ProgramDetailDrawer({
  program,
  clinicalPreview,
  clinicalContext,
  clinicalLoading,
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
    const previousPaddingRight = document.body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = "hidden";
    if (scrollbarWidth > 0) {
      const paddingRight = Number.parseFloat(
        window.getComputedStyle(document.body).paddingRight,
      );
      document.body.style.paddingRight = `${paddingRight + scrollbarWidth}px`;
    }

    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.paddingRight = previousPaddingRight;
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

  if (!program || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-50 m-0 h-dvh overflow-hidden p-0">
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
        className="absolute inset-y-0 right-0 m-0 flex h-dvh w-full max-w-2xl flex-col border-l border-border bg-card p-0 shadow-soft"
      >
        <div className="border-b border-border px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Link
                href={`/companies/${program.companyId}`}
                className="rounded-sm text-sm font-medium text-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                {formatNullableValue(program.company?.name)}
              </Link>
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
              aria-label="Close program detail"
              title="Close"
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <X aria-hidden="true" className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {clinicalPreview ? (
            <StudyPreviewList preview={clinicalPreview} />
          ) : null}
          <AssetClinicalContext
            clinicalPreview={clinicalPreview}
            clinicalContext={clinicalContext}
            clinicalLoading={clinicalLoading}
          />
          <div className="space-y-5">
            <DetailGroup title="Identity">
            <div className="grid gap-1 border-b border-border px-4 py-3 sm:grid-cols-[10rem_1fr] sm:gap-4">
              <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Company
              </dt>
              <dd className="text-sm text-foreground">
                <Link
                  href={`/companies/${program.companyId}`}
                  className="rounded-sm text-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  {formatNullableValue(program.company?.name)}
                </Link>
              </dd>
            </div>
            <DetailRow
              label="Company country"
              value={program.company?.headquartersCountry}
            />
            <DetailRow label="Mechanism" value={program.technical.mechanism} />
            <DetailRow label="Platform" value={program.technical.platform} />
            <DetailRow
              label="Indications"
              value={formatInlineValues(program.indications)}
            />
            <DetailRow
              label="Scope class"
              value={getScopeClassEntry(program.scopeClass).label}
            />
            </DetailGroup>

            <DetailGroup title="Administration">
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
            </DetailGroup>

            <DetailGroup title="Clinical status">
            <DetailRow label="Stage" value={program.development.stage} />
            <DetailRow label="Status" value={program.development.status} />
            </DetailGroup>

            <DetailGroup title="Record metadata">
            <DetailRow
              label="Last verified"
              value={program.metadata.lastVerifiedAt}
            />
            <DetailRow label="Updated" value={program.metadata.updatedAt} />
            <div className="grid gap-1 px-4 py-3 sm:grid-cols-[10rem_1fr] sm:gap-4">
              <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Sources
              </dt>
              <dd className="space-y-2 text-sm">
                <SourceList sources={program.metadata.sources} emptyLabel="N/A" />
              </dd>
            </div>
            </DetailGroup>
          </div>
        </div>
      </aside>
    </div>,
    document.body,
  );
}
