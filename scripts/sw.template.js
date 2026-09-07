/* Ryan Games service worker | build: __BUILD_ID__ */
const BUILD_ID = "__BUILD_ID__";
const BASE = "__BASE__";
const CACHE_NAME = `ryan-games-${BUILD_ID}`;
const ORIGIN = self.location.origin;

const CORE_PAGES = [
  `${ORIGIN}${BASE}index.html`,
  `${ORIGIN}${BASE}snake-game/index.html`,
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await Promise.allSettled(CORE_PAGES.map((url) => cache.add(url)));
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== ORIGIN) return;

  if (request.mode === "navigate") {
    event.respondWith(navigationFetch(request, url));
    return;
  }

  event.respondWith(assetFetch(request));
});

async function navigationFetch(request, url) {
  const cache = await caches.open(CACHE_NAME);

  try {
    const fresh = await fetch(request);
    if (fresh.ok) {
      await cache.put(request, fresh.clone());
    }
    return fresh;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;

    if (!url.pathname.endsWith(".html")) {
      const candidate = url.pathname.endsWith("/")
        ? `${url.pathname}index.html`
        : `${url.pathname}/index.html`;
      const page = await cache.match(`${ORIGIN}${candidate}`);
      if (page) return page;
    }

    const home = await cache.match(`${ORIGIN}${BASE}index.html`);
    if (home) return home;

    return new Response("离线中，暂时无法打开", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}

async function assetFetch(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);

  const fromNetwork = fetch(request)
    .then((response) => {
      if (response && response.ok) {
        void cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => cached);

  return cached || fromNetwork;
}
