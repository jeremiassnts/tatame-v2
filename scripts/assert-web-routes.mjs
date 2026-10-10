#!/usr/bin/env node
/**
 * Boundary check for the app-router routes this project must serve.
 *
 *   pnpm --filter @tatame/web build && node scripts/assert-web-routes.mjs
 *
 * `apps/web`'s vitest proofs call page components and route handlers directly,
 * so none of them assembles the Next app. That leaves one failure invisible to
 * the whole suite: a route that never gets registered — a directory Next
 * ignores, a file named something it does not recognise, a build that drops it.
 * The route manifest is produced by a real build, so reading it is the one
 * place that failure shows.
 *
 * `/.well-known/apple-app-site-association` is the reason this exists. Apple
 * requires it with no file extension, under a dot-prefixed directory, and a
 * build that quietly skipped either would leave Universal Links falling back to
 * the browser with every test still green.
 *
 * `/assinatura-confirmada` is in the list as a live sibling: an empty manifest
 * and a manifest missing one path have to be distinguishable.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const MANIFEST = join(
  REPO_ROOT,
  "apps/web/.next/app-path-routes-manifest.json",
);

const REQUIRED = [
  "/.well-known/apple-app-site-association",
  "/.well-known/assetlinks.json",
  "/baixar",
  "/convite/[academyId]",
  "/assinatura-confirmada",
];

let manifest;
try {
  manifest = JSON.parse(readFileSync(MANIFEST, "utf-8"));
} catch (err) {
  console.error(
    `assert-web-routes: cannot read ${MANIFEST}\n` +
      "Run `pnpm --filter @tatame/web build` first.\n" +
      String(err),
  );
  process.exit(1);
}

const served = new Set(Object.values(manifest));
const missing = REQUIRED.filter((route) => !served.has(route));

if (missing.length > 0) {
  console.error(
    `assert-web-routes: ${missing.length} route(s) the build did not produce:`,
  );
  for (const route of missing) console.error(`  - ${route}`);
  console.error(`\nServed routes:\n  ${[...served].sort().join("\n  ")}`);
  process.exit(1);
}

// Apple's no-extension requirement is carried by the exact-string match above:
// `/.well-known/apple-app-site-association` is in REQUIRED spelled without
// one, so a build serving it as `…-association.json` fails the check rather
// than passing a looser pattern.
console.log(`assert-web-routes: ${REQUIRED.length} route(s) served`);
