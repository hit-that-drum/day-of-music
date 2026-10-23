// check-dead-css.mjs — fail when day-of-music.css styles a .dom-* class that
// nothing under src/ mentions any more (the rule outlived its markup). Runs as
// part of `npm run lint`.
//
// A class counts as used if its exact name appears anywhere in a .ts/.tsx file.
// If markup ever builds class names at runtime (`dom-btn-${variant}`), that
// prefix is treated as used too.

import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const CSS_FILE = join(ROOT, "src/styles/day-of-music.css");

function sourceFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

const source = sourceFiles(join(ROOT, "src"))
  .map((path) => readFileSync(path, "utf8"))
  .join("\n");
const mentioned = new Set(source.match(/dom-[\w-]+/g));
const dynamicPrefixes = [...source.matchAll(/(dom-[\w-]*-)\$\{/g)].map((m) => m[1]);

const css = readFileSync(CSS_FILE, "utf8");
// Selectors only: comments can name classes that no longer exist.
const lines = css.replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, " ")).split("\n");

const dead = new Map();
lines.forEach((line, i) => {
  for (const [, name] of line.matchAll(/\.(dom-[\w-]+)/g)) {
    if (mentioned.has(name) || dynamicPrefixes.some((p) => name.startsWith(p))) continue;
    dead.set(name, [...(dead.get(name) ?? []), i + 1]);
  }
});

if (dead.size) {
  const file = relative(ROOT, CSS_FILE);
  console.error(`${dead.size} class(es) in ${file} are not used anywhere in src/:`);
  for (const [name, at] of [...dead].sort()) console.error(`  .${name}  (line ${at.join(", ")})`);
  console.error("Delete the rules, or the selector from its list if it shares one.");
  process.exit(1);
}
