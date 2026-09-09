/* eslint-disable @typescript-eslint/no-require-imports -- Standalone Node benchmark. */
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const Module = require('node:module');
const { execFileSync } = require('node:child_process');
const routePath = 'src/app/api/music/search/route.ts';
const baselineFile = process.argv[2];
const oldSource = baselineFile ? fs.readFileSync(baselineFile, 'utf8') : execFileSync('git', ['show', `HEAD:${routePath}`], { encoding: 'utf8' });
const newSource = fs.readFileSync(routePath, 'utf8');
function compile(source) {
  const filename = path.resolve(routePath);
  const mod = new Module(filename, module);
  mod.filename = filename;
  mod.paths = module.paths;
  mod._compile(ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
  } }).outputText, filename);
  return mod.exports.GET;
}
const handlers = { before: compile(oldSource), after: compile(newSource) };
const nativeFetch = global.fetch;
const report = {
  startedAt: new Date().toISOString(),
  baselineFile: baselineFile ?? null,
  baselineCommit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  method: 'Actual route handlers transpiled and invoked in Node with real upstream fetch. No Next.js server/Data Cache or browser cache. Repeats also use the network; provider/CDN and connection reuse may affect timings. 20s safety timeout on legacy fetch, any censored runs flagged. Alternating version order; 10s pause between runs.',
  samples: [],
};
const output = path.resolve(process.argv[3] ?? 'docs/music-search-benchmark.json');
const queries = ['NewJeans', '자몽살구클럽', 'Radiohead Creep'];
async function main() {
  for (let round = 1; round <= 2; round++) {
    for (let index = 0; index < queries.length; index++) {
      const query = queries[index];
      const order = (round + index) % 2 ? ['before', 'after'] : ['after', 'before'];
      for (const version of order) {
        const calls = [];
        global.fetch = async (url, options = {}) => {
          const call = { url: String(url) };
          calls.push(call);
          const start = performance.now();
          const { next: ignoredNext, ...nativeOptions } = options;
          void ignoredNext;
          try {
            const res = await nativeFetch(url, { ...nativeOptions, signal: options.signal ?? AbortSignal.timeout(20000) });
            call.status = res.status;
            const body = await res.text();
            call.bytes = Buffer.byteLength(body);
            return new Response(body, { status: res.status, headers: res.headers });
          } catch (error) {
            call.error = `${error.name}: ${error.message}`;
            call.safetyTimeout = !options.signal && error.name === 'TimeoutError';
            throw error;
          } finally { call.ms = Math.round(performance.now() - start); }
        };
        const params = new URLSearchParams({ q: query, country: 'KR', limit: '8' });
        const start = performance.now();
        const response = await handlers[version](new Request(`http://localhost/api/music/search?${params}`));
        const body = await response.json();
        const sample = { round, query, country: 'KR', limit: 8, version, ms: Math.round(performance.now() - start), status: response.status, count: body.results?.length ?? 0, titles: (body.results ?? []).map(r => `${r.artist} — ${r.title}`), calls };
        report.samples.push(sample);
        fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
        console.log(JSON.stringify(sample));
        await new Promise(resolve => setTimeout(resolve, 10000));
      }
    }
  }
  report.finishedAt = new Date().toISOString();
  fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
