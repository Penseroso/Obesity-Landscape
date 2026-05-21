"use client";

import type { ApproveResponse, CandidateFileRecord } from "@/lib/qa-types";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";

function displayValue(value: unknown) {
  if (Array.isArray(value)) {
    return value.length > 0 ? value.join(", ") : "-";
  }

  if (value === null || value === undefined || value === "") {
    return "-";
  }

  if (typeof value === "object") {
    return JSON.stringify(value);
  }

  return String(value);
}

function MetadataItem({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="rounded-md border border-border bg-background px-3 py-2">
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 break-words text-sm font-semibold text-foreground">
        {value ?? "-"}
      </dd>
    </div>
  );
}

function NotesList({ items }: { items?: string[] }) {
  if (!items || items.length === 0) {
    return <p className="text-sm text-muted-foreground">-</p>;
  }

  return (
    <ul className="space-y-2 text-sm text-muted-foreground">
      {items.map((item) => (
        <li key={item} className="rounded-md bg-background px-3 py-2">
          {item}
        </li>
      ))}
    </ul>
  );
}

export function QaReviewClient({ candidates }: { candidates: CandidateFileRecord[] }) {
  const [selectedFileName, setSelectedFileName] = useState(candidates[0]?.fileName ?? "");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isApproving, setIsApproving] = useState(false);
  const [approvalResult, setApprovalResult] = useState<ApproveResponse | null>(null);
  const [approvalError, setApprovalError] = useState<string | null>(null);

  const selectedCandidateFile = useMemo(
    () => candidates.find((candidateFile) => candidateFile.fileName === selectedFileName),
    [candidates, selectedFileName],
  );
  const candidate = selectedCandidateFile?.candidate;
  const assets = candidate?.assets ?? [];
  const diffs = candidate?.diffs ?? [];
  const isTemplate = candidate?.refreshMode === "template";
  const isEmpty = assets.length === 0 && diffs.length === 0;
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const approvalDisabled =
    !selectedCandidateFile || selectedIds.length === 0 || assets.length === 0 || isApproving;

  function handleSelectedFileChange(fileName: string) {
    setSelectedFileName(fileName);
    setSelectedIds([]);
    setApprovalResult(null);
    setApprovalError(null);
  }

  function toggleAsset(assetId: string) {
    setApprovalResult(null);
    setApprovalError(null);
    setSelectedIds((current) =>
      current.includes(assetId)
        ? current.filter((id) => id !== assetId)
        : [...current, assetId],
    );
  }

  async function approveSelected() {
    if (approvalDisabled || !selectedCandidateFile) {
      return;
    }

    setIsApproving(true);
    setApprovalResult(null);
    setApprovalError(null);

    try {
      const response = await fetch("/api/qa/approve", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          candidateFile: selectedCandidateFile.fileName,
          assetIds: selectedIds,
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Approval failed.");
      }

      setApprovalResult(payload as ApproveResponse);
      setSelectedIds([]);
    } catch (error) {
      setApprovalError(error instanceof Error ? error.message : "Approval failed.");
    } finally {
      setIsApproving(false);
    }
  }

  return (
    <div className="space-y-6 pb-10">
      <section>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
          Local QA
        </p>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              Pipeline Candidate Review
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
              Review local candidate files from 01 initial screening or 02 company
              refresh runs. Candidate data is not approved until it passes the
              local QA workflow.
            </p>
          </div>
          {isTemplate ? (
            <span className="inline-flex h-9 items-center rounded-md border border-border bg-muted px-3 text-sm font-semibold text-muted-foreground">
              Template
            </span>
          ) : null}
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card p-5 shadow-soft">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,24rem)_1fr] lg:items-end">
          <div>
            <label
              htmlFor="candidate-file"
              className="text-sm font-semibold text-card-foreground"
            >
              Candidate file
            </label>
            <select
              id="candidate-file"
              value={selectedFileName}
              onChange={(event) => handleSelectedFileChange(event.target.value)}
              className="mt-2 h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground"
              disabled={candidates.length === 0}
            >
              {candidates.length === 0 ? (
                <option value="">No candidate files found</option>
              ) : null}
              {candidates.map((candidateFile) => (
                <option key={candidateFile.fileName} value={candidateFile.fileName}>
                  {candidateFile.fileName}
                </option>
              ))}
            </select>
          </div>
          <p className="text-sm text-muted-foreground">
            Local approval writes to repository files during local development.
            Production persistence will require GitHub API or a database later.
          </p>
        </div>
        {candidates.length > 0 ? (
          <div className="mt-5 grid gap-3 lg:grid-cols-2">
            {candidates.map((candidateFile) => {
              const fileCandidate = candidateFile.candidate;
              const selected = candidateFile.fileName === selectedFileName;

              return (
                <button
                  key={candidateFile.fileName}
                  type="button"
                  onClick={() => handleSelectedFileChange(candidateFile.fileName)}
                  className={`rounded-md border px-4 py-3 text-left transition ${
                    selected
                      ? "border-primary bg-accent text-accent-foreground"
                      : "border-border bg-background text-foreground hover:bg-muted"
                  }`}
                >
                  <span className="block break-all text-sm font-semibold">
                    {candidateFile.fileName}
                  </span>
                  <span className="mt-2 grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                    <span>Company: {displayValue(fileCandidate.company)}</span>
                    <span>Company ID: {displayValue(fileCandidate.companyId)}</span>
                    <span>Mode: {displayValue(fileCandidate.refreshMode)}</span>
                    <span>Checked: {displayValue(fileCandidate.checkedAt)}</span>
                    <span className="sm:col-span-2">
                      Summary: {displayValue(fileCandidate.summary?.status)}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        ) : null}
      </section>

      {!candidate ? (
        <section className="rounded-lg border border-dashed border-border bg-card p-8 text-center shadow-soft">
          <p className="text-sm font-semibold text-foreground">
            No candidate files found under data/candidates.
          </p>
        </section>
      ) : (
        <>
          <section className="rounded-lg border border-border bg-card p-5 shadow-soft">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-semibold tracking-tight text-card-foreground">
                  Company Metadata
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Source and refresh context from the selected candidate file.
                </p>
              </div>
            </div>
            <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <MetadataItem label="Company" value={candidate.company} />
              <MetadataItem label="Company ID" value={candidate.companyId} />
              <MetadataItem
                label="Source URL"
                value={
                  candidate.sourceUrl ? (
                    <a
                      href={candidate.sourceUrl}
                      className="text-primary underline-offset-4 hover:underline"
                      target="_blank"
                      rel="noreferrer"
                    >
                      {candidate.sourceUrl}
                    </a>
                  ) : (
                    "-"
                  )
                }
              />
              <MetadataItem label="Checked At" value={candidate.checkedAt} />
              <MetadataItem label="Refresh Mode" value={candidate.refreshMode} />
              <MetadataItem label="Comparison Base" value={candidate.comparisonBase} />
            </dl>

            {candidate.summary ? (
              <div className="mt-5">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Summary
                </h3>
                <dl className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
                  <MetadataItem label="Status" value={candidate.summary.status} />
                  <MetadataItem label="New" value={candidate.summary.newAssets} />
                  <MetadataItem label="Updated" value={candidate.summary.updatedAssets} />
                  <MetadataItem
                    label="No Longer Listed"
                    value={candidate.summary.removedOrNoLongerListedAssets}
                  />
                  <MetadataItem
                    label="Unchanged"
                    value={candidate.summary.unchangedAssets}
                  />
                  <MetadataItem label="Notes" value={candidate.summary.notes} />
                </dl>
              </div>
            ) : null}
          </section>

          {isTemplate ? (
            <section className="rounded-lg border border-border bg-muted p-4">
              <p className="text-sm font-medium text-muted-foreground">
                This candidate file is a template state, not real research output.
              </p>
            </section>
          ) : null}

          {isEmpty ? (
            <section className="rounded-lg border border-dashed border-border bg-card p-8 text-center shadow-soft">
              <p className="text-sm font-semibold text-foreground">
                No candidate assets or diffs yet. Run 02 with a target company to
                generate review data.
              </p>
            </section>
          ) : null}

          <section className="rounded-lg border border-border bg-card shadow-soft">
            <div className="flex flex-col gap-4 border-b border-border px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-xl font-semibold tracking-tight text-card-foreground">
                  Asset Candidates
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {selectedIds.length} selected for local approval.
                </p>
              </div>
              <button
                type="button"
                onClick={approveSelected}
                disabled={approvalDisabled}
                className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground"
              >
                {isApproving ? "Approving..." : "Approve selected"}
              </button>
            </div>
            {approvalResult ? (
              <div className="border-b border-border bg-accent px-5 py-4 text-sm text-accent-foreground">
                <p className="font-semibold">
                  Approved {approvalResult.approvedCount} selected assets:{" "}
                  {approvalResult.insertedCount} inserted,{" "}
                  {approvalResult.updatedCount} updated, {approvalResult.skippedCount} skipped.
                </p>
                {approvalResult.warnings.length > 0 ? (
                  <ul className="mt-2 list-disc space-y-1 pl-5">
                    {approvalResult.warnings.map((warning) => (
                      <li key={warning}>{warning}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}
            {approvalError ? (
              <div className="border-b border-border bg-muted px-5 py-4 text-sm font-semibold text-foreground">
                {approvalError}
              </div>
            ) : null}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[88rem] border-collapse text-left text-sm">
                <thead className="bg-muted text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    {[
                      "Select",
                      "Asset",
                      "Code",
                      "Target",
                      "Indication",
                      "Route",
                      "Form",
                      "Interval",
                      "Stage",
                      "Stage Raw",
                      "Confidence",
                      "Source",
                      "Notes",
                    ].map((header) => (
                      <th key={header} className="px-4 py-3 font-semibold">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {assets.length > 0 ? (
                    assets.map((asset, index) => (
                      <tr key={`${asset.assetName ?? "asset"}-${index}`}>
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            aria-label={`Select ${asset.assetName ?? asset.id ?? "candidate asset"}`}
                            checked={Boolean(asset.id && selectedSet.has(asset.id))}
                            disabled={!asset.id}
                            onChange={() => {
                              if (asset.id) {
                                toggleAsset(asset.id);
                              }
                            }}
                            className="h-4 w-4 rounded border-border accent-[hsl(var(--primary))]"
                          />
                        </td>
                        <td className="px-4 py-3 font-semibold text-foreground">
                          {displayValue(asset.assetName)}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {displayValue(asset.codeName)}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {displayValue(asset.targetClass)}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {displayValue(asset.indication)}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {displayValue(asset.route)}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {displayValue(asset.dosageForm)}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {displayValue(asset.dosingInterval)}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {displayValue(asset.stage)}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {displayValue(asset.stageRaw)}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {displayValue(asset.confidence)}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {asset.sourceUrl ? (
                            <a
                              href={asset.sourceUrl}
                              className="text-primary underline-offset-4 hover:underline"
                              target="_blank"
                              rel="noreferrer"
                            >
                              Source
                            </a>
                          ) : (
                            "-"
                          )}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {displayValue(asset.notes)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={13}
                        className="px-4 py-6 text-center text-muted-foreground"
                      >
                        No asset candidates in this file.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-lg border border-border bg-card shadow-soft">
            <div className="border-b border-border px-5 py-4">
              <h2 className="text-xl font-semibold tracking-tight text-card-foreground">
                Diff Records
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[62rem] border-collapse text-left text-sm">
                <thead className="bg-muted text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    {[
                      "Type",
                      "Asset ID",
                      "Field",
                      "Approved",
                      "Candidate",
                      "Confidence",
                      "QA",
                      "Notes",
                    ].map((header) => (
                      <th key={header} className="px-4 py-3 font-semibold">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {diffs.length > 0 ? (
                    diffs.map((diff, index) => (
                      <tr key={`${diff.assetId ?? "diff"}-${index}`}>
                        <td className="px-4 py-3 font-semibold text-foreground">
                          {displayValue(diff.type)}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {displayValue(diff.assetId)}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {displayValue(diff.field)}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {displayValue(diff.approvedValue)}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {displayValue(diff.candidateValue)}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {displayValue(diff.confidence)}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {displayValue(diff.qaStatus)}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {displayValue(diff.notes)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={8}
                        className="px-4 py-6 text-center text-muted-foreground"
                      >
                        No diff records in this file.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-lg border border-border bg-card p-5 shadow-soft">
              <h2 className="text-xl font-semibold tracking-tight text-card-foreground">
                Extraction Notes
              </h2>
              <div className="mt-3">
                <NotesList items={candidate.extractionNotes} />
              </div>
            </div>
            <div className="rounded-lg border border-border bg-card p-5 shadow-soft">
              <h2 className="text-xl font-semibold tracking-tight text-card-foreground">
                Unresolved Questions
              </h2>
              <div className="mt-3">
                <NotesList items={candidate.unresolvedQuestions} />
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
