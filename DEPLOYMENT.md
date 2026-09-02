---
role: deployment-runbook
status: active
authority: authoritative
update-boundary: Update when the deployment target, adapter, resource limits, or deploy/rollback procedure change.
---

# Deployment

## Target

This app runs in production as a **Cloudflare Worker**. That target was previously
undocumented in this repository — it was recovered from the commit message of
`a20fa95` ("Cache Efficacy Comparison read model to avoid recomputing per
request"), which describes a real production incident: the Efficacy Comparison
read model was recomputing its full ranking on every request, exhausting the
Worker's per-request CPU budget and causing 404s where static generation
didn't complete in time. This file exists so that incident, its cause, and the
deploy path are reproducible by anyone working on this repo, not only whoever
holds Cloudflare dashboard access.

## Adapter

Deployment uses [`@opennextjs/cloudflare`](https://opennext.js.org/cloudflare)
(OpenNext's Cloudflare adapter), added to this repo on 2026-09-01. This was a
deliberate choice over Cloudflare's newer `vinext` project: as of this writing
`vinext` is `1.0.0-beta.x` and explicitly documented as experimental and not
battle-tested with production traffic, while OpenNext is the mature, proven
path for running a full Next.js App Router app (dynamic routes, API routes,
Node.js runtime) on Workers. Re-evaluate this choice only once `vinext` reaches
a stable release with documented production usage.

Relevant files:

- `wrangler.jsonc` — Worker name, compatibility date/flags, static-asset
  binding, and the `WORKER_SELF_REFERENCE` service binding OpenNext needs for
  internal fetches.
- `open-next.config.ts` — OpenNext build configuration (currently defaults;
  no R2/KV overrides configured — see **Known gaps** below).
- `next.config.ts` — calls `initOpenNextCloudflareForDev()` so `npm run dev`
  gets Cloudflare-compatible bindings in local development.

## First-time setup (whoever holds Cloudflare account access)

This configuration was authored and build/dry-run verified in this repo, but
nobody running it here has Cloudflare account access, so it has **not** been
verified against the actual live Worker. Before the first deploy from this
config:

1. `npx wrangler login` (or set `CLOUDFLARE_API_TOKEN`) against the account
   that owns the existing production Worker.
2. Confirm `wrangler.jsonc`'s `name` (`obesity-landscape`) matches the
   **existing** Worker's name in the Cloudflare dashboard. If the live Worker
   uses a different name, change `name` in `wrangler.jsonc` to match before
   deploying — deploying under the wrong name creates a second, separate
   Worker instead of updating production.
3. Confirm custom domain / route bindings (if any) in the dashboard; they are
   not captured in this repo and must be reconciled by hand or added to
   `wrangler.jsonc`'s `routes` once known.
4. In the Worker project's **Build configuration** (Cloudflare Workers Builds,
   the git-integrated CI that runs on every push), the build and deploy
   commands are dashboard settings, not something this repo can set for you.
   They must be:
   - Build command: `npx opennextjs-cloudflare build`
   - Deploy command: `npx wrangler deploy`

   This is not optional — see the incident below.

### Incident: git-push deploy failed on default dashboard settings (2026-09-02)

Commit `9e8b7c18` failed to deploy via Cloudflare's git-integrated Workers
Builds with `ERROR Could not find compiled Open Next config, did you run the
build command?`. The build log showed the dashboard was still on its
auto-detected defaults:

- Build command: `npm run build` (plain `next build`)
- Deploy command: `npx wrangler deploy`

`wrangler deploy` auto-detects this as an OpenNext project (from
`wrangler.jsonc`'s `main: ".open-next/worker.js"`) and hands off to
`opennextjs-cloudflare deploy`, which requires the compiled OpenNext output.
Plain `next build` never produces `.open-next/` — only
`opennextjs-cloudflare build` does — so the deploy step had nothing to deploy.
`npm run build` succeeding and even `npm run cf:deploy` working locally does
not mean the dashboard is configured correctly; the dashboard's own build
command is a separate setting that this repo cannot override. Fix: set the
Build command explicitly per step 4 above.

## Deploy

```bash
npm run gate          # full local validation — see README
npm run cf:deploy      # opennextjs-cloudflare build && opennextjs-cloudflare deploy
```

To test the Workers build locally before deploying:

```bash
npm run cf:preview     # opennextjs-cloudflare build && opennextjs-cloudflare preview
```

`npm run cf:deploy` was verified in this session up through `wrangler deploy
--dry-run` (build succeeds, 268 routes generate, bindings resolve, asset
upload totals ~11 MB / ~1.5 MB gzip) — the actual authenticated deploy step
was not run, since no Cloudflare credentials are available in this
environment.

## The CPU-limit constraint (why the 2026-08-27 outage happened)

Cloudflare Workers enforce a **per-request CPU time limit** (plan-dependent;
consult the current limit in the Cloudflare dashboard for this account's
plan — do not assume a specific number here, as it is a Cloudflare account
setting, not a repo setting). A request that recomputes a full dataset
ranking, join, or aggregation on every hit — rather than reading a
precomputed or cached result — can burn through that budget once the dataset
is large enough, which is exactly what happened to `/efficacy-comparison`.

Two read models have already needed this fix (see the audit at
[`domains/company-pipeline/docs/decision-log.md`](domains/company-pipeline/docs/decision-log.md)
for related history):

- `domains/app/lib/efficacy-comparison/read-model.ts` — now caches its
  computed ranking at module scope instead of recomputing per request.
- Program Register clinical data — moved from an eager per-program join to
  an on-demand fetch (`/api/programs/[programId]/clinical`).

When adding a new dynamic route or read model over `data/generated/*.json`
(the largest of which, `clinical-evidence.json`, is ~2 MB), default to the
same pattern: compute once at module load or cache the result, rather than
recomputing per request. Do not wait for a third production outage to notice
a third instance of this pattern.

## `dynamicParams = false` requires a persistent incremental cache — do not use it here (2026-09-02 incident)

`/companies/abbvie` (and every other `/companies/[companyId]` page) 404'd in
production while working locally. Root cause, reproduced with
`npx opennextjs-cloudflare preview` and confirmed via
`.wrangler`'s local observability logs (`Error: Internal: NoFallbackError` in
OpenNext's `handleRevalidate`): the page had `export const dynamicParams =
false`. On this Worker, a statically generated App Router page's prerendered
HTML lives only in OpenNext's incremental cache (`.open-next/cache/**/*.cache`)
— it is **not** copied into `.open-next/assets`, and this repo has no
persistent cache store configured (see the gap below), so that cache is empty
on every isolate. With `dynamicParams = false`, Next.js is forbidden from
falling back to on-demand rendering when the cache misses, so the request
throws and OpenNext returns 404 — for every param, unconditionally, not just
cold-start ones. `/assets/[companyId]/[assetId]` and `/studies/[studyId]`
never had this flag and render fine from the same cold cache, because
`dynamicParams` defaults to `true` and they fall back to SSR on a miss; both
already guard unknown params with `notFound()` in the component body, same as
the companies page. Fix applied: removed the flag from
`app/companies/[companyId]/page.tsx` — `notFound()` still 404s unknown company
IDs correctly, verified locally in the actual Worker runtime with
`npx opennextjs-cloudflare preview`. **Do not add `dynamicParams = false` to
any route on this deploy target unless a persistent `incrementalCache` (R2) is
configured** — otherwise it will 404 every param, not just invalid ones.

## Known gaps / follow-ups

- **No persistent ISR/data cache.** `open-next.config.ts` uses OpenNext's
  default cache (in-memory, per-isolate — not shared across Worker instances
  or persisted across deploys). Cross-instance caching would need an R2
  bucket bound via `incrementalCache` in `open-next.config.ts`; not set up
  here because it requires provisioning a bucket in the live account. This is
  not just a latency concern — see the incident above: any route with
  `dynamicParams = false` depends on this cache being populated to serve
  anything at all. Every route in this app currently avoids that flag, so the
  known failure mode is contained, but re-check this the moment a new SSG
  route adds it.
- **No verified authenticated deploy.** See **First-time setup** above.
- **No custom domain / route config captured.** Add to `wrangler.jsonc` once
  known.
- **Observability** is enabled in `wrangler.jsonc`
  (`observability.enabled: true`), so Worker logs should already be visible
  under the Cloudflare dashboard's Workers Observability view (or
  `npx wrangler tail` for a live authenticated tail) once deployed — confirm
  this is actually where the account owner is looking when investigating a
  production issue.
