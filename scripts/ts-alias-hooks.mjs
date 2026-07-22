/**
 * Resolves the project's `@/…` TypeScript path alias for scripts run directly by
 * node, and fills in the extension that TypeScript imports omit.
 *
 * The app itself gets this from the Next.js/tsconfig toolchain, but a probe run as
 * a plain node process does not. Rather than duplicate the read model in JavaScript
 * — which would let the probe and the shipped code drift apart, defeating the point
 * of probing — this teaches node the one resolution rule it is missing.
 */
import { existsSync } from "node:fs";
import { registerHooks } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const extensions = [".ts", ".tsx", ".mts", ".js", ".mjs"];

function resolveFile(absolutePath) {
  if (path.extname(absolutePath) && existsSync(absolutePath)) return absolutePath;
  for (const extension of extensions) {
    const candidate = `${absolutePath}${extension}`;
    if (existsSync(candidate)) return candidate;
  }
  for (const extension of extensions) {
    const candidate = path.join(absolutePath, `index${extension}`);
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

/**
 * The app imports generated JSON as a plain module, which the bundler handles.
 * Bare ESM instead requires an explicit `type: "json"` attribute, so supply it here
 * rather than adding build-tool-specific syntax to the shipped data layer.
 */
function resolution(absolutePath) {
  const result = { url: pathToFileURL(absolutePath).href, shortCircuit: true };
  if (absolutePath.endsWith(".json")) {
    result.importAttributes = { type: "json" };
  }
  return result;
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("@/")) {
      const resolved = resolveFile(path.join(projectRoot, specifier.slice(2)));
      if (resolved) return resolution(resolved);
    }

    // Relative specifiers between the feature modules are extensionless too.
    if (specifier.startsWith(".") && context.parentURL?.startsWith("file:")) {
      const parentDir = path.dirname(fileURLToPath(context.parentURL));
      const resolved = resolveFile(path.resolve(parentDir, specifier));
      if (resolved) return resolution(resolved);
    }

    return nextResolve(specifier, context);
  },
});
