// check-dead-css.mjs — fail when the app stylesheet (src/styles/, split by
// section under dom/) styles a .dom-* class that nothing under src/ mentions
// any more (the rule outlived its markup). Runs as part of `npm run lint`.
//
// A class counts as used if its exact name appears anywhere in a .ts/.tsx file.
// If markup ever builds class names at runtime (`dom-btn-${variant}`), that
// prefix is treated as used too.

import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const CSS_DIR = join(ROOT, "src/styles");

function filesUnder(dir, keep) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return filesUnder(path, keep);
    return keep(entry.name) ? [path] : [];
  });
}

const sourceFiles = (dir) =>
  filesUnder(dir, (name) => /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name));

const source = sourceFiles(join(ROOT, "src"))
  .map((path) => readFileSync(path, "utf8"))
  .join("\n");
const mentioned = new Set(source.match(/dom-[\w-]+/g));
const dynamicPrefixes = [...source.matchAll(/(dom-[\w-]*-)\$\{/g)].map((m) => m[1]);

const dead = new Map();
for (const file of filesUnder(CSS_DIR, (name) => name.endsWith(".css"))) {
  // Selectors only: comments can name classes that no longer exist.
  const css = readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, (c) =>
    c.replace(/[^\n]/g, " "),
  );
  css.split("\n").forEach((line, i) => {
    for (const [, name] of line.matchAll(/\.(dom-[\w-]+)/g)) {
      if (mentioned.has(name) || dynamicPrefixes.some((p) => name.startsWith(p))) continue;
      dead.set(name, [...(dead.get(name) ?? []), `${relative(ROOT, file)}:${i + 1}`]);
    }
  });
}

if (dead.size) {
  console.error(`${dead.size} class(es) in src/styles are not used anywhere in src/:`);
  for (const [name, at] of [...dead].sort()) console.error(`  .${name}  (${at.join(", ")})`);
  console.error("Delete the rules, or the selector from its list if it shares one.");
  process.exit(1);
}
