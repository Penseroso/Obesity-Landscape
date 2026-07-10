# Agent Entry Instructions

This file routes natural-language requests to the correct workflow. It is a
router only - it does not restate the research protocol. The authoritative
routing boundary is [`docs/research-routing.md`](docs/research-routing.md).

## Company research router

Any natural-language request whose intent is to **research, investigate,
review, refresh, or update** a named company must execute the complete
workflow in [`prompts/research-company.md`](prompts/research-company.md), unless
the request contains explicit clinical-evidence intent reserved by
[`docs/research-routing.md`](docs/research-routing.md).

This applies to variations such as:

- `Research Zealand Pharma.`
- `Investigate Zealand Pharma.`
- `Update Zealand Pharma.`
- equivalent natural-language requests in other languages.

When such a request is received:

- The company name is the only required input. Do not ask for or expect any
  other parameter.
- The agent decides automatically whether to perform an initial investigation
  or a refresh, based on the existing data - not on the request wording.
- Executing the workflow includes external research, operating-record creation
  or update, aggregate regeneration, the required validation, and final
  reporting.
- The detailed rules remain authoritative in
  [`prompts/research-company.md`](prompts/research-company.md) and its
  referenced documents ([`docs/data-protocol/README.md`](docs/data-protocol/README.md)
  and [`docs/research-workflow.md`](docs/research-workflow.md)). Follow those; do
  not reimplement the workflow from this router.

## Reserved clinical-evidence router

Requests with explicit clinical-evidence intent, such as `임상`, `clinical`,
`trial`, `시험`, `endpoint`, `results`, or `결과`, are reserved for a future
Clinical Evidence Research workflow. Until that workflow is implemented, do not
route those requests to the Company Research workflow as a substitute, do not
claim clinical-evidence research was completed, and report the clinical route as
reserved but not yet implemented.
