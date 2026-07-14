import Link from "next/link";
import { formatNullableValue } from "@/lib/format";
import type {
  ArmView,
  EndpointGroupView,
  StudyDetailView,
} from "@/lib/clinical-evidence/selectors";

function MetaRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="grid gap-1 border-b border-border py-3 sm:grid-cols-[12rem_1fr] sm:gap-4">
      <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </dt>
      <dd className="text-sm text-foreground">{formatNullableValue(value)}</dd>
    </div>
  );
}

function ArmInterventionCell({ arm }: { arm: ArmView }) {
  if (arm.linkedAssetRef) {
    return (
      <Link
        href={`/assets/${arm.linkedAssetRef.companyId}/${arm.linkedAssetRef.assetId}`}
        className="font-medium text-primary underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        {arm.linkedAssetName ?? arm.intervention}
      </Link>
    );
  }
  return <span>{formatNullableValue(arm.intervention)}</span>;
}

function ArmsTable({ arms }: { arms: ArmView[] }) {
  if (arms.length === 0) {
    return <p className="text-sm text-muted-foreground">No arms recorded.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-md border border-border bg-card shadow-soft">
      <table className="w-full min-w-[720px] border-collapse text-left text-sm">
        <thead className="bg-muted/70 text-xs uppercase tracking-[0.12em] text-muted-foreground">
          <tr>
            <th className="px-3 py-2.5 font-semibold">Arm</th>
            <th className="px-3 py-2.5 font-semibold">Role</th>
            <th className="px-3 py-2.5 font-semibold">Intervention</th>
            <th className="px-3 py-2.5 font-semibold">Dose</th>
            <th className="px-3 py-2.5 font-semibold">Route</th>
            <th className="px-3 py-2.5 font-semibold">Frequency</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {arms.map((arm) => (
            <tr key={arm.id} className="bg-card text-muted-foreground">
              <td className="px-3 py-2.5 font-medium text-foreground">
                {arm.label}
              </td>
              <td className="px-3 py-2.5">{arm.role}</td>
              <td className="px-3 py-2.5">
                <ArmInterventionCell arm={arm} />
              </td>
              <td className="px-3 py-2.5">{formatNullableValue(arm.dose)}</td>
              <td className="px-3 py-2.5">{formatNullableValue(arm.route)}</td>
              <td className="px-3 py-2.5">
                {formatNullableValue(arm.dosingFrequency)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EndpointCard({ group }: { group: EndpointGroupView }) {
  const { endpoint, outcomes } = group;
  return (
    <div className="rounded-md border border-border bg-card p-4 shadow-soft">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-card-foreground">
          {endpoint.name}
        </h3>
        <span className="whitespace-nowrap rounded-sm border border-border bg-accent px-2 py-0.5 text-xs font-semibold text-accent-foreground">
          {endpoint.role}
        </span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        {formatNullableValue(endpoint.assessmentTimepoint)}
      </p>
      {outcomes.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {outcomes.map((outcome) => {
            const anchor =
              outcome.groupLabel ??
              (outcome.armLabels.length > 0
                ? outcome.armLabels.join(" vs ")
                : "N/A");
            return (
              <li
                key={outcome.outcome.id}
                className="border-t border-border pt-2 text-sm first:border-t-0 first:pt-0"
              >
                <p className="text-foreground">{outcome.outcome.result.value}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {anchor} · {outcome.outcome.maturity}
                </p>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">
          No reported results.
        </p>
      )}
    </div>
  );
}

export function StudyDetail({ detail }: { detail: StudyDetailView }) {
  const { study, asset, arms, endpointGroups, linkedFromAssets } = detail;

  return (
    <div className="space-y-6 pb-10">
      <section>
        <Link
          href={`/assets/${asset.companyId}/${asset.assetId}`}
          className="text-sm font-medium text-primary underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          ← {asset.assetName}
        </Link>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          {study.acronym?.trim() || study.officialTitle}
        </h1>
        {study.acronym ? (
          <p className="mt-2 text-sm text-muted-foreground">
            {study.officialTitle}
          </p>
        ) : null}
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <span className="rounded-sm border border-border bg-accent px-2.5 py-1 font-semibold text-accent-foreground">
            {study.phase}
          </span>
          <span className="rounded-sm border border-border bg-muted px-2.5 py-1 font-semibold text-muted-foreground">
            {study.status}
          </span>
        </div>
      </section>

      <section>
        <dl>
          <MetaRow
            label="Registry ID"
            value={study.registryIdentifiers
              .map((registry) => registry.id)
              .join(" / ")}
          />
          <MetaRow label="Population" value={study.population} />
          <MetaRow label="Randomization" value={study.design.randomization} />
          <MetaRow label="Masking" value={study.design.masking} />
          <MetaRow label="Comparator" value={study.design.comparator} />
          <MetaRow label="Overall duration" value={study.overallDuration} />
          <MetaRow label="Follow-up" value={study.followUpDuration} />
          <MetaRow label="Safety summary" value={study.safetySummary} />
        </dl>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-foreground">Arms</h2>
        <ArmsTable arms={arms} />
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-foreground">
          Endpoints &amp; outcomes
        </h2>
        {endpointGroups.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-2">
            {endpointGroups.map((group) => (
              <EndpointCard key={group.endpoint.id} group={group} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No endpoints recorded.
          </p>
        )}
      </section>

      {linkedFromAssets.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-base font-semibold text-foreground">
            Linked from assets
          </h2>
          <p className="text-sm text-muted-foreground">
            This study is also surfaced as a comparator / head-to-head study for:
          </p>
          <ul className="flex flex-wrap gap-2">
            {linkedFromAssets.map((linkedAsset) => (
              <li key={`${linkedAsset.companyId}/${linkedAsset.assetId}`}>
                <Link
                  href={`/assets/${linkedAsset.companyId}/${linkedAsset.assetId}`}
                  className="inline-flex rounded-sm border border-border bg-card px-2.5 py-1 text-xs font-medium text-primary transition hover:bg-accent/45 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  {linkedAsset.assetName}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
