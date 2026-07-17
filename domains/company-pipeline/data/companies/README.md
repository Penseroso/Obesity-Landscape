# Company Source Data

Company folders here are the human-edited Company/Pipeline operating source of
truth. Each folder contains:

- `company.json`
- `pipeline-programs.json`
- `regimens.json`

Do not edit `data/generated/*.json` directly. Research and entry rules live in
[`docs/data-protocol/`](../../docs/data-protocol/README.md); run
`npm run data:generate` after valid source changes.
