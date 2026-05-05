// SW kill-switch v2: replaces any previous Workbox/PWA worker.
// Steps: claim clients → delete caches → navigate clients with cleanup param → unregister.
self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    try { await self.clients.claim(); } catch {}
    try {
      const names = await caches.keys();
      await Promise.all(names.map((n) => caches.delete(n)));
    } catch {}
    try {
      const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      await Promise.all(clients.map((c) => {
        try {
          const u = new URL(c.url);
          u.searchParams.set('sw-cleanup', String(Date.now()));
          return c.navigate(u.toString());
        } catch {
          return null;
        }
      }));
    } catch {}
    try { await self.registration.unregister(); } catch {}
  })());
});

self.addEventListener('fetch', () => {
  // No-op: never intercept requests. Browser hits the network directly.
});
