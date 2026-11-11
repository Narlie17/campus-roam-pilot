// Campus Roam Pilot Run — offline + freshness.
// Network-first with a short timeout: students get today's data when they have signal,
// and the last good copy right away when the network is slow, down, or returns an error
// (so the home-screen app never opens to a blank screen). BUILD is bumped by the
// refresh workflow so old caches are cleared after each data update.
const BUILD = "202611112215";
const CACHE = "roam-" + BUILD;
const SHELL = ["./", "index.html", "styles.css", "config.js", "data.js", "shared.js", "student.js", "manifest.webmanifest", "icons/icon-192.png", "icons/compass.svg"];
const TIMEOUT_MS = 2500;

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => {}).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("roam-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

async function fromCache(req) {
  const hit = await caches.match(req, { ignoreSearch: true });
  if (hit) return hit;
  if (req.mode === "navigate") {
    const scope = new URL(self.registration.scope);
    return (await caches.match(new URL("index.html", scope).href)) || (await caches.match(scope.href));
  }
  return undefined;
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== location.origin) return;
  e.respondWith((async () => {
    const network = fetch(req, { cache: "no-cache" }).then((res) => {
      if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
      return res;
    });
    e.waitUntil(network.catch(() => {}));
    const timeout = new Promise((r) => setTimeout(() => r("timeout"), TIMEOUT_MS));
    let res;
    try { res = await Promise.race([network, timeout]); } catch { res = null; }
    if (res && res !== "timeout" && res.ok) return res;
    const cached = await fromCache(req);
    if (cached) return cached;
    if (res === "timeout") { try { return await network; } catch {} }
    if (res && res !== "timeout") return res;
    return new Response("Campus Roam is offline. Reconnect and reopen the app.", { status: 503, headers: { "Content-Type": "text/plain" } });
  })());
});
