// v3: bumped when the app icons were replaced (favicon.ico removed in favour of
// app/icon.png; the vinyl PWA icons regenerated). Activating a new version
// deletes the older cache, so clients re-fetch the new icons instead of serving
// the old cache-first snapshot — the same mechanism that clears stale dev-server
// chunks (dev chunk URLs aren't content-hashed).
const CACHE_NAME = "day-of-music-v3";
const PRECACHE_URLS = [
  "/",
  "/icons/apple-touch-icon.png",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-maskable-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);

  if (url.origin !== self.location.origin) {
    return;
  }

  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/")
  ) {
    event.respondWith(cacheFirst(request));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(networkFirstPage(request));
  }
});

// Stale-while-revalidate. Production /_next/static/ URLs are content-hashed so
// the revalidate is a no-op there, but if this worker ever controls a dev
// origin (chunk URLs stay the same while their content changes), the refetch
// keeps the cache converging on the current build instead of pinning the first
// response forever.
async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);

  const refresh = fetch(request)
    .then((response) => {
      if (response.ok) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => undefined);

  if (cached) {
    return cached;
  }

  const response = await refresh;
  if (!response) {
    throw new Error("offline and not cached");
  }
  return response;
}

async function networkFirstPage(request) {
  const cache = await caches.open(CACHE_NAME);

  try {
    const response = await fetch(request);

    if (response.ok) {
      cache.put(request, response.clone());
    }

    return response;
  } catch {
    return (await cache.match(request)) ?? cache.match("/");
  }
}
