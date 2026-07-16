import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

// Read-model boundary (ADR: Clinical Evidence data access):
// - Generated Clinical Evidence JSON may be imported only from the canonical
//   domains/clinical-evidence/lib/data.ts loader.
// - The canonical loader may be imported only by the legacy data shim;
//   selectors.ts remains the sole consumer of that compatibility entrypoint.
// Every other file, including files in either Clinical Evidence library root,
// is restricted from both. Each block fully restates its restriction set
// because ESLint flat config replaces a rule value per matching config.
const clinicalGeneratedJsonRestriction = {
  group: ["**/generated/clinical-evidence*.json"],
  message:
    "Import the generated Clinical Evidence JSON only from domains/clinical-evidence/lib/data.ts.",
};
const clinicalLegacyDataModuleRestriction = {
  group: ["@/lib/clinical-evidence/data", "**/clinical-evidence/data"],
  message:
    "Read clinical evidence through @/lib/clinical-evidence/selectors, not the raw data layer.",
};
const clinicalCanonicalDataModuleRestriction = {
  group: [
    "@/domains/clinical-evidence/lib/data",
    "**/clinical-evidence/lib/data",
  ],
  message:
    "Read clinical evidence through @/lib/clinical-evidence/selectors, not the raw data layer.",
};
const clinicalDataModuleSameDirRestriction = {
  group: ["./data"],
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
    // Project-wide fallback: no direct generated JSON or raw data access.
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            clinicalGeneratedJsonRestriction,
            clinicalLegacyDataModuleRestriction,
            clinicalCanonicalDataModuleRestriction,
          ],
        },
      ],
    },
  },
  {
    // The canonical loader alone may import the generated JSON.
    files: ["domains/clinical-evidence/lib/data.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            clinicalLegacyDataModuleRestriction,
            clinicalCanonicalDataModuleRestriction,
            clinicalDataModuleSameDirRestriction,
          ],
        },
      ],
    },
  },
  {
    // The legacy shim may re-export the canonical loader, but nothing else.
    files: ["lib/clinical-evidence/data.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            clinicalGeneratedJsonRestriction,
            clinicalLegacyDataModuleRestriction,
            clinicalDataModuleSameDirRestriction,
          ],
        },
      ],
    },
  },
  {
    // selectors.ts alone consumes the legacy data compatibility entrypoint.
    files: ["lib/clinical-evidence/selectors.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            clinicalGeneratedJsonRestriction,
            clinicalCanonicalDataModuleRestriction,
          ],
        },
      ],
    },
  },
  {
    // All other legacy Clinical Evidence files get the full boundary.
    files: ["lib/clinical-evidence/**"],
    ignores: [
      "lib/clinical-evidence/data.ts",
      "lib/clinical-evidence/selectors.ts",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            clinicalGeneratedJsonRestriction,
            clinicalLegacyDataModuleRestriction,
            clinicalCanonicalDataModuleRestriction,
            clinicalDataModuleSameDirRestriction,
          ],
        },
      ],
    },
  },
  {
    // Canonical Clinical Evidence siblings get the same boundary.
    files: ["domains/clinical-evidence/lib/**"],
    ignores: ["domains/clinical-evidence/lib/data.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            clinicalGeneratedJsonRestriction,
            clinicalLegacyDataModuleRestriction,
            clinicalCanonicalDataModuleRestriction,
            clinicalDataModuleSameDirRestriction,
          ],
        },
      ],
    },
  },
];

export default eslintConfig;
