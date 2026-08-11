import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

// Read-model boundary (ADR: Clinical Evidence data access):
// - Generated Clinical Evidence JSON may be imported only from the canonical
//   domains/clinical-evidence/lib/data.ts loader.
// - That canonical loader may be imported only by the canonical Application/UI
//   read model, domains/app/lib/clinical-evidence/selectors.ts, which is the
//   sole consumer of the loader.
// Every other file, including files in the Clinical Evidence library root, is
// restricted from both. Each block fully restates its restriction set because
// ESLint flat config replaces a rule value per matching config.
const clinicalGeneratedJsonRestriction = {
  group: ["**/generated/clinical-evidence*.json"],
  message:
    "Import the generated Clinical Evidence JSON only from domains/clinical-evidence/lib/data.ts.",
};
const clinicalCanonicalDataModuleRestriction = {
  group: [
    "@/domains/clinical-evidence/lib/data",
    "**/clinical-evidence/lib/data",
  ],
  message:
    "Read clinical evidence through @/domains/app/lib/clinical-evidence/selectors, not the raw data layer.",
};
const clinicalDataModuleSameDirRestriction = {
  group: ["./data"],
  message:
    "Read clinical evidence through @/domains/app/lib/clinical-evidence/selectors, not the raw data layer.",
};
const newsSnapshotRestriction = {
  group: ["**/news/data/news.json", "**/news/data/sources.json"],
  message:
    "Import News data only from domains/news/lib/data.ts, then consume it through the Application News read model.",
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
            clinicalCanonicalDataModuleRestriction,
            newsSnapshotRestriction,
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
            clinicalCanonicalDataModuleRestriction,
            clinicalDataModuleSameDirRestriction,
            newsSnapshotRestriction,
          ],
        },
      ],
    },
  },
  {
    // The canonical Application/UI selectors alone consume the loader.
    files: ["domains/app/lib/clinical-evidence/selectors.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [clinicalGeneratedJsonRestriction, newsSnapshotRestriction],
        },
      ],
    },
  },
  {
    // All other Clinical Evidence library siblings get the full boundary.
    files: ["domains/clinical-evidence/lib/**"],
    ignores: ["domains/clinical-evidence/lib/data.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            clinicalGeneratedJsonRestriction,
            clinicalCanonicalDataModuleRestriction,
            clinicalDataModuleSameDirRestriction,
            newsSnapshotRestriction,
          ],
        },
      ],
    },
  },
  {
    // The canonical News loader alone may import the validated snapshot and registry.
    files: ["domains/news/lib/data.ts"],
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
];

export default eslintConfig;
