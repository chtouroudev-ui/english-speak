// Offline shell for the installable app. API calls always go to the network.
const CACHE = 'speak-v1'
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['/', '/icon.svg'])))
  self.skipWaiting()
})
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))),
  )
  self.clients.claim()
})
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url)
  if (e.request.method !== 'GET' || url.pathname.startsWith('/api/') || url.origin !== location.origin) return
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone()
        if (res.ok) caches.open(CACHE).then((c) => c.put(e.request, copy))
        return res
      })
      .catch(() => caches.match(e.request).then((r) => r || caches.match('/'))),
  )
})
self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  e.waitUntil(self.clients.openWindow('/'))
})
