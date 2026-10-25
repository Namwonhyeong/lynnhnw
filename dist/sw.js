const CACHE = 'field-note-voice-v5';
const ASSETS = ['./', './index.html', './manifest.webmanifest'];

self.addEventListener('install', event => {
    self.skipWaiting();
    event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)));
});

self.addEventListener('activate', event => {
    event.waitUntil(caches.keys()
        .then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
        .then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
    if (event.request.method !== 'GET')
        return;
    event.respondWith(fetch(event.request).then(response => {
        if (response.ok && new URL(event.request.url).origin === self.location.origin)
            caches.open(CACHE).then(cache => cache.put(event.request, response.clone()));
        return response;
    }).catch(() => caches.match(event.request).then(hit => hit || caches.match('./index.html'))));
});
