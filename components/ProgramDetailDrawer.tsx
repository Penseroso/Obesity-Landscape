"use client";

import { formatInlineValues, formatNullableValue } from "@/lib/format";
import type { PipelineProgram } from "@/lib/programs/types";

type ProgramDetailDrawerProps = {
  program: PipelineProgram | null;
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

export function ProgramDetailDrawer({
  program,
  onClose,
}: ProgramDetailDrawerProps) {
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
      <aside className="absolute right-0 top-0 flex h-full w-full max-w-2xl flex-col border-l border-border bg-card shadow-soft">
        <div className="border-b border-border px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-primary">
                {formatNullableValue(program.company?.name)}
              </p>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight text-card-foreground">
                {program.assetName}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Code {formatNullableValue(program.codeName)}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-border px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              Close
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
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
                {program.metadata.sources.length > 0 ? (
                  program.metadata.sources.map((source) => (
                    <a
                      key={`${source.url}-${source.checkedAt}`}
                      href={source.url}
                      target="_blank"
                      rel="noreferrer"
                      className="block font-medium text-primary underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    >
                      {source.title ?? source.url}
                    </a>
                  ))
                ) : (
                  <span className="text-foreground">N/A</span>
                )}
              </dd>
            </div>
          </dl>
        </div>
      </aside>
    </div>
  );
}
