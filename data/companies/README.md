# Company Source Data

Company folders under this directory are the human-edited source of truth for
operating data. Each company folder must contain:

- `company.json`
- `pipeline-programs.json`
- `regimens.json`

Do not edit `data/generated/*.json` directly. Run the aggregate generation
script to rebuild generated files from company folders.
