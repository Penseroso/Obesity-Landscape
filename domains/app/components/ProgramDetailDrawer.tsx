"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { SourceList } from "@/domains/app/components/SourceList";
import { StudyPreviewList } from "@/domains/app/components/clinical/StudyPreviewList";
import type {
  AssetClinicalRollup,
  ProgramStudyPreview,
} from "@/domains/app/lib/clinical-evidence/selectors";
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
  onClose: () => void;
};

const DRAWER_TRANSITION_MS = 240;

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

function AssetClinicalContext({
  clinicalPreview,
  clinicalContext,
}: {
  clinicalPreview?: ProgramStudyPreview | null;
  clinicalContext?: AssetClinicalRollup | null;
}) {
  const hasAssetStudies = clinicalContext?.hasStudies ?? false;

  return (
    <section aria-label="Asset-level clinical context" className="mb-5 border-b border-border pb-5">
      <h3 className="text-sm font-semibold text-foreground">
        Broader clinical context for this asset
      </h3>
      {hasAssetStudies && clinicalContext ? (
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
            View Asset Clinical Studies →
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
  onClose,
}: ProgramDetailDrawerProps) {
  const panelRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const headingId = useId();
  const [renderedProgram, setRenderedProgram] = useState<PipelineProgram | null>(
    program,
  );
  const [renderedClinicalPreview, setRenderedClinicalPreview] =
    useState<ProgramStudyPreview | null>(clinicalPreview ?? null);
  const [renderedClinicalContext, setRenderedClinicalContext] =
    useState<AssetClinicalRollup | null>(clinicalContext ?? null);
  const [isOpen, setIsOpen] = useState(false);
  const renderedProgramRef = useRef<PipelineProgram | null>(program);

  // Retain the last selected program through the exit transition. A new
  // selection interrupts a close cleanly and opens the replacement drawer.
  useEffect(() => {
    if (program) {
      let openFrame: number | undefined;
      const mountFrame = window.requestAnimationFrame(() => {
        renderedProgramRef.current = program;
        setRenderedProgram(program);
        setRenderedClinicalPreview(clinicalPreview ?? null);
        setRenderedClinicalContext(clinicalContext ?? null);
        openFrame = window.requestAnimationFrame(() => setIsOpen(true));
      });
      return () => {
        window.cancelAnimationFrame(mountFrame);
        if (openFrame !== undefined) window.cancelAnimationFrame(openFrame);
      };
    }

    if (!renderedProgramRef.current) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)")
      .matches;
    const closeFrame = window.requestAnimationFrame(() => setIsOpen(false));
    const timeout = window.setTimeout(
      () => {
        renderedProgramRef.current = null;
        setRenderedProgram(null);
        setRenderedClinicalPreview(null);
        setRenderedClinicalContext(null);
      },
      reducedMotion ? 0 : DRAWER_TRANSITION_MS + 16,
    );
    return () => {
      window.cancelAnimationFrame(closeFrame);
      window.clearTimeout(timeout);
    };
  }, [program, clinicalPreview, clinicalContext]);

  // Lock background scroll while the drawer is open; always restore the
  // exact previous inline value, whether the drawer closes or the whole
  // component unmounts.
  useEffect(() => {
    if (!renderedProgram) {
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
  }, [renderedProgram]);

  // Move focus into the dialog when it opens (or when the displayed program
  // changes while it's already open).
  useEffect(() => {
    if (!isOpen || !renderedProgram) {
      return;
    }

    closeButtonRef.current?.focus();
  }, [isOpen, renderedProgram]);

  // Escape closes the dialog; Tab/Shift+Tab is trapped inside the panel.
  useEffect(() => {
    if (!isOpen || !renderedProgram) {
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
  }, [isOpen, renderedProgram, onClose]);

  if (!renderedProgram || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      aria-hidden={!isOpen}
      className={`fixed inset-0 z-50 m-0 h-dvh overflow-hidden p-0 ${
        isOpen ? "" : "pointer-events-none"
      }`}
    >
      <button
        aria-label="Close program detail"
        className={`absolute inset-0 cursor-default bg-foreground/30 transition-opacity duration-[240ms] ease-out motion-reduce:transition-none ${
          isOpen ? "opacity-100" : "opacity-0"
        }`}
        onClick={onClose}
      />
      <aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        className={`absolute inset-y-0 right-0 m-0 flex h-dvh w-full max-w-2xl flex-col border-l border-border bg-card p-0 shadow-soft transition-opacity duration-[240ms] ease-out motion-reduce:transition-none ${
          isOpen ? "opacity-100" : "opacity-0"
        }`}
      >
        <div className="border-b border-border px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Link
                href={`/companies/${renderedProgram.companyId}`}
                className="rounded-sm text-sm font-medium text-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                {formatNullableValue(renderedProgram.company?.name)}
              </Link>
              <h2
                id={headingId}
                className="mt-1 text-2xl font-semibold tracking-tight text-card-foreground"
              >
                {renderedProgram.assetName}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Code {formatNullableValue(renderedProgram.codeName)}
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
          {renderedClinicalPreview ? (
            <StudyPreviewList preview={renderedClinicalPreview} />
          ) : null}
          <AssetClinicalContext
            clinicalPreview={renderedClinicalPreview}
            clinicalContext={renderedClinicalContext}
          />
          <dl>
            <div className="grid gap-1 border-b border-border py-3 sm:grid-cols-[10rem_1fr] sm:gap-4">
              <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Company
              </dt>
              <dd className="text-sm text-foreground">
                <Link
                  href={`/companies/${renderedProgram.companyId}`}
                  className="rounded-sm text-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  {formatNullableValue(renderedProgram.company?.name)}
                </Link>
              </dd>
            </div>
            <DetailRow
              label="Company country"
              value={renderedProgram.company?.headquartersCountry}
            />
            <DetailRow label="Mechanism" value={renderedProgram.technical.mechanism} />
            <DetailRow label="Platform" value={renderedProgram.technical.platform} />
            <DetailRow
              label="Route"
              value={renderedProgram.administration.route}
            />
            <DetailRow
              label="Dosage form"
              value={renderedProgram.administration.dosageForm}
            />
            <DetailRow
              label="Interval"
              value={renderedProgram.administration.dosingInterval}
            />
            <DetailRow
              label="Indications"
              value={formatInlineValues(renderedProgram.indications)}
            />
            <DetailRow label="Stage" value={renderedProgram.development.stage} />
            <DetailRow label="Status" value={renderedProgram.development.status} />
            <DetailRow
              label="Last verified"
              value={renderedProgram.metadata.lastVerifiedAt}
            />
            <DetailRow label="Updated" value={renderedProgram.metadata.updatedAt} />
            <div className="grid gap-1 border-b border-border py-3 sm:grid-cols-[10rem_1fr] sm:gap-4">
              <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Sources
              </dt>
              <dd className="space-y-2 text-sm">
                <SourceList sources={renderedProgram.metadata.sources} emptyLabel="N/A" />
              </dd>
            </div>
          </dl>
        </div>
      </aside>
    </div>,
    document.body,
  );
}
