// Campus Roam Pilot Run — offline + freshness.
// Network-first for everything on this site, so students always get today's data when
// they have signal, and the last good copy when they don't. BUILD is bumped by the
// refresh workflow so old caches are cleared after each data update.
const BUILD = "202611111611";
const CACHE = "roam-" + BUILD;
const SHELL = ["./", "index.html", "styles.css", "config.js", "data.js", "shared.js", "student.js", "manifest.webmanifest", "icons/icon-192.png", "icons/compass.svg"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("roam-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  e.respondWith(
    fetch(e.request, { cache: "no-cache" })
      .then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); }
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || caches.match("index.html")))
  );
});
