import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

// Read-model boundary (ADR: Clinical Evidence data access):
// - The generated Clinical Evidence JSON may be imported only from data.ts —
//   via the "@/" alias or any relative path.
// - The data.ts module may be imported only from selectors.ts — via the "@/"
//   alias, a cross-directory relative path, or the same-directory "./data".
// Every other file, including other files inside lib/clinical-evidence/, is
// restricted from both — there is no wholesale directory exemption. Each
// block below fully restates its own complete restriction set rather than
// relying on partial cascading, since ESLint flat config replaces (not
// merges) a rule's value per matching config object.
const clinicalGeneratedJsonRestriction = {
  // Matches the alias form (@/data/generated/...) and any relative form
  // (./data/generated/..., ../../data/generated/...) by matching on the
  // path suffix only, independent of how the file reaches lib/data/generated.
  group: ["**/generated/clinical-evidence*.json"],
  message:
    "Import the generated Clinical Evidence JSON only from lib/clinical-evidence/data.ts.",
};
const clinicalDataModuleRestriction = {
  // Alias form, plus any relative form that crosses into the directory from
  // outside it (e.g. "../clinical-evidence/data").
  group: ["@/lib/clinical-evidence/data", "**/clinical-evidence/data"],
  message:
    "Read clinical evidence through @/lib/clinical-evidence/selectors, not the raw data layer.",
};
const clinicalDataModuleSameDirRestriction = {
  // The same-directory relative form. Only a file literally inside
  // lib/clinical-evidence/ can write this specifier, so it is scoped to that
  // directory below rather than applied project-wide (an unrelated "./data"
  // sibling elsewhere, e.g. lib/programs/, must stay unaffected).
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
    // Default: nothing may import the generated JSON or the data module, in
    // any form. This is the project-wide fallback (app/, components/,
    // lib/programs/, etc.) and also covers any new lib/clinical-evidence/
    // file that isn't given a more specific override below.
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
    // clinical data only through itself, never re-import the data module in
    // any form.
    files: ["lib/clinical-evidence/data.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            clinicalDataModuleRestriction,
            clinicalDataModuleSameDirRestriction,
          ],
        },
      ],
    },
  },
  {
    // selectors.ts is the sole owner of the data module (imported as
    // "./data"); it must never import the raw generated JSON directly, in
    // any form.
    files: ["lib/clinical-evidence/selectors.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        { patterns: [clinicalGeneratedJsonRestriction] },
      ],
    },
  },
  {
    // Every other file inside lib/clinical-evidence/ (e.g. types.ts, or any
    // future sibling) gets the full restriction, including the
    // same-directory "./data" form that only files at this location could
    // even attempt to write.
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
            clinicalDataModuleRestriction,
            clinicalDataModuleSameDirRestriction,
          ],
        },
      ],
    },
  },
];

export default eslintConfig;
