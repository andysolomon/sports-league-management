import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/*
 * Convex rejects a module path component containing anything but alphanumerics,
 * underscores and periods. A file named `job-security.ts` is a perfectly good
 * TypeScript module and a perfectly invalid Convex one, so nothing local fails:
 * `tsc` is happy, vitest is happy, and the push dies at
 *
 *   InvalidConfig: lib/job-security.js is not a valid path to a Convex module
 *
 * which surfaces ~15 minutes into CI as an e2e failure with no stack trace.
 *
 * The convention under `convex/` is therefore camelCase — `offseasonPhases.ts`,
 * `dynastyConfig.ts`, `teamRecords.ts`. Files under `src/` are unaffected and
 * may keep kebab-case; only the Convex side is constrained.
 */

const CONVEX_ROOT = fileURLToPath(new URL("..", import.meta.url));
const IGNORED = new Set(["_generated", "node_modules", "__tests__"]);

function collectModulePaths(dir: string, prefix = ""): string[] {
  return readdirSync(dir).flatMap((entry) => {
    if (IGNORED.has(entry)) return [];
    const full = join(dir, entry);
    const rel = prefix ? `${prefix}/${entry}` : entry;
    if (statSync(full).isDirectory()) return collectModulePaths(full, rel);
    return entry.endsWith(".ts") ? [rel] : [];
  });
}

describe("convex module naming", () => {
  it("uses no path component Convex would reject", () => {
    const offenders = collectModulePaths(CONVEX_ROOT).filter((path) =>
      path.split("/").some((part) => !/^[A-Za-z0-9_.]+$/.test(part)),
    );

    expect(offenders).toEqual([]);
  });
});
