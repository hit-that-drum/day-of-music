/* eslint-disable @typescript-eslint/no-require-imports -- Node CommonJS test harness. */
// Exercise the route with deterministic upstream responses (no network required).
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const Module = require('node:module');
const filename = require('node:path').resolve('src/app/api/music/search/route.ts');
const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText;
const mod = new Module(filename, module);
mod.filename = filename;
mod.paths = module.paths;
mod._compile(compiled, filename);
const { GET } = mod.exports;
const song = { wrapperType: 'track', kind: 'song', trackId: 22, trackName: 'Wanted song', collectionId: 11, collectionName: '한글 앨범', artistName: 'Artist' };
const album = { wrapperType: 'collection', collectionId: 11, collectionName: 'Romanized album' };
async function run() {
  let calls = [];
  global.fetch = async (url, opts) => {
    calls.push(url);
    assert(opts.signal instanceof AbortSignal);
    return Response.json({ results: [album, song] });
  };
  const request = (params) => new Request(`http://localhost/api/music/search?${params}`);
  let response = await GET(request('q=Wanted&country=KR'));
  let body = await response.json();
  assert.equal(calls.length, 1);
  assert.equal(calls[0].searchParams.get('entity'), 'song,album');
  assert.equal(body.results.length, 1);
  assert.equal(body.results[0].title, '한글 앨범');
  assert.equal(body.results[0].id, 'itunes-11');
  global.fetch = async () => Response.json({ results: [song] });
  body = await (await GET(request('q=Wanted'))).json();
  assert.equal(body.results[0].id, 'itunes-11'); // Song-only hit resolves to its album.
  body = await (await GET(request('q=Wanted&type=track'))).json();
  assert.equal(body.results[0].id, 'itunes-22');
  assert.equal(body.results[0].title, 'Wanted song');
  calls = [];
  global.fetch = async (url) => {
    calls.push(url.searchParams.get('country'));
    return Response.json({ results: url.searchParams.get('country') === 'JP' ? [song] : [] });
  };
  body = await (await GET(request('q=Wanted&country=KR'))).json();
  assert.equal(body.results.length, 1);
  assert.equal(new Set(calls).size, calls.length);
  global.fetch = async () => Response.json({ results: [] });
  assert.deepEqual(await (await GET(request('q=absent'))).json(), { results: [] });
  global.fetch = async () => { throw new Error('upstream timeout'); };
  assert.equal((await GET(request('q=Wanted'))).status, 502);
  assert.equal((await GET(request('q='))).status, 400);
  // Slow regions never resolve until aborted: a successful US response must
  // still finish the route, and pending requests must be cancelled.
  const pendingSignals = [];
  global.fetch = async (url, { signal }) => {
    const store = url.searchParams.get('country');
    if (store === 'KR') return Response.json({ results: [] });
    if (store === 'US') return Response.json({ results: [song] });
    pendingSignals.push(signal);
    return new Promise((resolve, reject) => {
      signal.addEventListener('abort', () => reject(signal.reason), { once: true });
    });
  };
  let watchdog;
  try {
    response = await Promise.race([
      GET(request('q=Wanted&country=KR')),
      new Promise((resolve, reject) => { watchdog = setTimeout(() => reject(new Error('Waited for slow regions')), 500); }),
    ]);
  } finally { clearTimeout(watchdog); }
  assert.equal((await response.json()).results[0].id, 'itunes-11');
  assert.equal(pendingSignals.length, 2);
  assert(pendingSignals.every(signal => signal.aborted));

  // Empty/error responses that finish first must not mask a later match.
  global.fetch = async (url) => {
    const store = url.searchParams.get('country');
    if (store === 'US') throw new Error('US unavailable');
    if (store === 'JP') {
      await new Promise(resolve => setTimeout(resolve, 20));
      return Response.json({ results: [song] });
    }
    return Response.json({ results: [] });
  };
  assert.equal((await (await GET(request('q=Wanted&country=KR'))).json()).results.length, 1);

  // Cancellation during fallback is a cancellation, not an empty success.
  const controller = new AbortController();
  const activeSignals = [];
  global.fetch = async (url, { signal }) => {
    if (url.searchParams.get('country') === 'KR') return Response.json({ results: [] });
    activeSignals.push(signal);
    if (activeSignals.length === 3) queueMicrotask(() => controller.abort());
    return new Promise((resolve, reject) => {
      signal.addEventListener('abort', () => reject(signal.reason), { once: true });
    });
  };
  response = await GET(new Request('http://localhost/api/music/search?q=Wanted&country=KR', { signal: controller.signal }));
  assert.equal(response.status, 408);
  assert(activeSignals.every(signal => signal.aborted));
  console.log('Music search regression tests passed, including early return, loser cancellation, empty/error races, and caller cancellation.');
}
run().catch((error) => { console.error(error); process.exitCode = 1; });
