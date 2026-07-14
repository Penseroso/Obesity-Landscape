import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

// Read-model boundary (ADR: Clinical Evidence data access):
// - The generated Clinical Evidence JSON may be imported only from data.ts.
// - The data.ts module may be imported only from selectors.ts.
// Every other file, including other files inside lib/clinical-evidence/, is
// restricted from both — there is no wholesale directory exemption.
const clinicalGeneratedJsonPattern = "@/data/generated/clinical-evidence*.json";
const clinicalDataModuleGroup = [
  "@/lib/clinical-evidence/data",
  "**/clinical-evidence/data",
];
const clinicalGeneratedJsonRestriction = {
  group: [clinicalGeneratedJsonPattern],
  message:
    "Import the generated Clinical Evidence JSON only from lib/clinical-evidence/data.ts.",
};
const clinicalDataModuleRestriction = {
  group: clinicalDataModuleGroup,
  message:
    "Read clinical evidence through @/lib/clinical-evidence/selectors, not the raw data layer.",
};

const eslintConfig = [
  ...nextVitals,
  ...nextTypescript,
  {
    ignores: [".next/**", ".npm-cache/**", "node_modules/**"],
  },
  {
    // Default: nothing may import the generated JSON or the data module.
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            clinicalGeneratedJsonRestriction,
            clinicalDataModuleRestriction,
          ],
        },
      ],
    },
  },
  {
    // data.ts is the sole owner of the generated JSON; it must still reach
    // clinical data only through itself, never re-import the data module.
    files: ["lib/clinical-evidence/data.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        { patterns: [clinicalDataModuleRestriction] },
      ],
    },
  },
  {
    // selectors.ts is the sole owner of the data module; it must never import
    // the raw generated JSON directly.
    files: ["lib/clinical-evidence/selectors.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        { patterns: [clinicalGeneratedJsonRestriction] },
      ],
    },
  },
];

export default eslintConfig;
