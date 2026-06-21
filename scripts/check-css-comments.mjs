#!/usr/bin/env node
//
// Guard against a stray comment-closer inside a CSS comment (WSM-000156).
//
// A comment-closing token (asterisk + slash) written inside CSS comment text
// (e.g. a doc line listing "bg-", "text-" and "border-" utilities with slashes)
// closes the comment early; the remainder is then parsed as CSS. Turbopack's dev
// CSS pipeline throws ("Unexpected token Delim") and 500s every route, but the
// production minifier tolerates it -- so it slips past `next build` / CI and only
// breaks local `next dev`. This scanner reproduces the parse semantics and fails
// when a comment-closer appears outside any open comment.
//
// Uses line comments only (no block comments) so the guard can never trip itself.
// Zero dependencies -- runs on plain `node`.
//
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

const ROOTS = ["apps/web/src"];
const REPO = process.cwd();

/** Recursively collect .css files under a directory. */
function cssFiles(dir) {
  const out = [];
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out; // missing root -> nothing to scan
  }
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === "node_modules" || e.name === ".next") continue;
      out.push(...cssFiles(p));
    } else if (e.isFile() && e.name.endsWith(".css")) {
      out.push(p);
    }
  }
  return out;
}

const OPEN = "/" + "*";
const CLOSE = "*" + "/";

/**
 * Scan one stylesheet. Returns positions where a comment-closer appears outside
 * any open comment -- the signature of a comment closed early by an inner closer.
 * String literals are skipped so `content: "a" + CLOSE + "b"` is not flagged.
 */
function findStrayCommentClosers(src) {
  const issues = [];
  let inComment = false;
  let inString = false;
  let quote = "";
  let line = 1;
  let col = 0;

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (ch === "\n") {
      line++;
      col = 0;
      continue;
    }
    col++;
    const two = ch + (src[i + 1] ?? "");

    if (inComment) {
      if (two === CLOSE) {
        inComment = false;
        i++;
        col++;
      }
      continue;
    }
    if (inString) {
      if (ch === "\\") {
        i++;
        col++;
      } else if (ch === quote) {
        inString = false;
      }
      continue;
    }

    if (ch === '"' || ch === "'") {
      inString = true;
      quote = ch;
      continue;
    }
    if (two === OPEN) {
      inComment = true;
      i++;
      col++;
      continue;
    }
    if (two === CLOSE) {
      issues.push({ line, col });
      i++;
      col++;
    }
  }
  return issues;
}

const files = ROOTS.flatMap((r) => cssFiles(join(REPO, r)));
let failures = 0;

for (const file of files) {
  const src = readFileSync(file, "utf8");
  const issues = findStrayCommentClosers(src);
  if (issues.length > 0) {
    failures += issues.length;
    const rel = relative(REPO, file);
    for (const { line, col } of issues) {
      console.error(
        `x ${rel}:${line}:${col} - stray comment-closer outside a comment. ` +
          `An earlier closer inside a comment likely closed it early ` +
          `(see WSM-000156). Reword the comment to drop the slash.`,
      );
    }
  }
}

if (failures > 0) {
  console.error(
    `\nCSS comment guard: ${failures} stray comment-closer(s) found across ${files.length} file(s).`,
  );
  process.exit(1);
}
console.log(`CSS comment guard: OK (${files.length} CSS file(s) scanned).`);
