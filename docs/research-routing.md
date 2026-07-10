# Research Routing

Authoritative routing boundary for research requests. This document decides
which research workflow a natural-language request may enter. It does not define
the Company/Pipeline Research protocol and does not create a Clinical Evidence
Research workflow.

## Current executable route

The only currently executable research workflow is **Company/Pipeline
Research**, implemented by [`../prompts/research-company.md`](../prompts/research-company.md)
and governed by [`research-workflow.md`](./research-workflow.md) and the data
protocol.

Generic company requests route to Company/Pipeline Research, including:

- `<COMPANY_NAME> 조사`
- `<COMPANY_NAME> 업데이트`
- `<COMPANY_NAME> refresh`
- natural-language equivalents such as research, investigate, review, update,
  or refresh a named company.

The existing Company/Pipeline Research behavior is unchanged. A generic company
request must not automatically expand into detailed clinical-trial design,
endpoint, result, efficacy, or safety extraction.

## Reserved clinical-evidence route

Requests with explicit clinical-evidence intent are reserved for a future
**Clinical Evidence Research** workflow. This route is not implemented.

Explicit clinical-evidence intent includes terms such as:

- `임상`
- `clinical`
- `trial`
- `시험`
- `endpoint`
- `results`
- `결과`

Examples:

- `semaglutide 임상 조사`
- `Novo Nordisk 주요 임상시험 조사`

Until the Clinical Evidence Research workflow exists:

- do not route explicit clinical-evidence requests to
  [`../prompts/research-company.md`](../prompts/research-company.md) as a
  substitute.
- do not claim clinical-evidence research was completed.
- identify the route as reserved but not yet implemented.
- do not create study, arm, endpoint, outcome, efficacy, or safety schemas as
  part of routing.

## Combined company and clinical intent

If a request explicitly contains both company and clinical-evidence intent, the
Company/Pipeline Research portion may run using the existing company workflow.
The clinical-evidence portion must be reported as pending implementation.

The intended future combined execution order is:

1. Company/Pipeline Research.
2. Clinical Evidence Research.

This is a routing contract only. It does not implement the Clinical Evidence
Research workflow.

## Ambiguous input default

When clinical-evidence intent is not explicit, route ambiguous research,
investigation, review, refresh, or update requests for a named company to
Company/Pipeline Research.

Never infer Clinical Evidence Research from a generic company request.
