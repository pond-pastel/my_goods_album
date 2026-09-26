const CACHE_NAME = "my-goods-album-cache-v0-0-25";
const APP_SHELL = [
    "./",
    "./index.html",
    "./style.css",
    "./main.js",
    "./apply.js",
    "./add_edit.js",
    "./svg.js",
    "./manifest.webmanifest",
    "./icon-192.png",
    "./icon-512.png"
];

self.addEventListener("install", (event) => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(APP_SHELL);
        })
    );
});

self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
        }).then(() => {
            return self.clients.claim();
        })
    )
});

self.addEventListener("fetch", (event) => {
    if(event.request.method !== "GET") return;
    event.respondWith(
        fetch(event.request).then((response) => {
            if(new URL(event.request.url).origin === location.origin) {
                const copy = response.clone();
                caches.open(CACHE_NAME).then((cache) => {
                    cache.put(event.request, copy);
                });
            }
            return response;
        }).catch(() => caches.match(event.request))
    )
});