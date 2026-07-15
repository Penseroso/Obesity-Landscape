---
role: historical-index
status: active
authority: non-authoritative
update-boundary: Update this catalog only when a completed artifact is added to or removed from the archive. The archived reports it indexes remain historical and frozen; do not rewrite archived findings.
---

# Historical Documentation

This catalog is an **active, maintained index** of archived documentation: it
stays current as artifacts enter or leave the archive, and may be updated **only
when a completed artifact is added to or removed from the archive**.

The **artifacts it indexes remain historical and frozen**. They preserve
point-in-time evidence and decisions, are excluded from ordinary reading paths,
active validation, and current-rule maintenance, and are never rewritten.
Audit-time statements in those artifacts may be stale; use the listed current
authority for rules.

| Artifact | Purpose at the time | Current authority |
| --- | --- | --- |
| [Expanded Decision Log through ADR-0039](./decisions/decision-log-full-through-adr-0039.md) | Full rationale and consequences before compaction | [Compact Decision Index](../data-protocol/decision-log.md) and its linked contracts |
| [Contract consistency audit](./company-pipeline/consistency-audit.md) | Point-in-time Contract 1.1 consistency check | [Data Protocol](../data-protocol/README.md) |
| [Ascletis stress-test bundle](./company-pipeline/ascletis-stress-test/findings.md) | Initial diagnostic evidence and model pressure test | [Data Protocol](../data-protocol/README.md); bundle is non-canonical and non-golden |
| [Clinical Architecture Preflight A](./clinical-evidence/architecture-preflight-a.md) | Pre-pilot readiness review | [Clinical Evidence contract](../clinical-evidence/README.md) |
| [Clinical v3 migration audit](./clinical-evidence/v3-migration-audit.md) | Point-in-time v3 migration record | [Clinical Evidence contract](../clinical-evidence/README.md) |
| [Evidence-to-Clinical gap audit](./clinical-evidence/evidence-to-clinical-gap-audit.md) | Local evidence-led entry audit | [Clinical workflow](../clinical-evidence-workflow.md) |
| [V1 UI audit](./ui/v1-ui-audit.md) | Closed V1 findings and remediation record | [UI reference](../ui/README.md) |

## Frozen-document rule

- Do not update a historical report to match current code or terminology.
- Correct current behavior in the active contract, workflow, or reference.
- If later work needs the old evidence, read only the selected artifact.
- The Ascletis bundle is initial diagnostic evidence only. No active validator,
  generator, research workflow, or UI consumes it.
