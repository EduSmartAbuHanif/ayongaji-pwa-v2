
"use strict";

/*
 * AYO NGAJI LEVEL 1
 * Cache aplikasi dan cache audio dipisahkan.
 * Perubahan versi aplikasi tidak menghapus cache audio.
 */

const APP_CACHE_NAME = "ayo-ngaji-level1-app-v2";
const AUDIO_CACHE_PREFIX = "ayongaji-audio-";

const APP_FILES = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./manifest.json"
];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(APP_CACHE_NAME);
    await cache.addAll(APP_FILES);
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();

    // Hanya cache aplikasi versi lama yang dihapus.
    // Cache audio peserta dibiarkan tetap utuh.
    await Promise.all(names
      .filter(name =>
        name.startsWith("ayo-ngaji-level1-app-") &&
        name !== APP_CACHE_NAME
      )
      .map(name => caches.delete(name)));

    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Jangan menangani permintaan ke domain lain.
  if (url.origin !== self.location.origin) return;

  event.respondWith((async () => {
    const appCache = await caches.open(APP_CACHE_NAME);

    // Halaman: jaringan lebih dahulu, lalu cache jika offline.
    if (request.mode === "navigate") {
      try {
        const response = await fetch(request);
        if (response && response.ok) {
          appCache.put("./index.html", response.clone()).catch(() => {});
        }
        return response;
      } catch (error) {
        return (await appCache.match("./index.html")) ||
          new Response("Ayo Ngaji belum tersedia secara offline. Buka aplikasi saat terhubung internet terlebih dahulu.", {
            status: 503,
            headers: { "Content-Type": "text/plain; charset=utf-8" }
          });
      }
    }

    // Audio yang sudah disimpan oleh aplikasi dicari di cache audio.
    if (url.pathname.includes("/audio/")) {
      const names = await caches.keys();
      for (const name of names.filter(n => n.startsWith(AUDIO_CACHE_PREFIX))) {
        const cache = await caches.open(name);
        const saved = await cache.match(request);
        if (saved) return saved;
      }
    }

    // File aplikasi: gunakan cache jika tersedia.
    const cached = await appCache.match(request);
    if (cached) return cached;

    try {
      return await fetch(request);
    } catch (error) {
      return new Response("Konten tidak tersedia saat offline.", {
        status: 503,
        headers: { "Content-Type": "text/plain; charset=utf-8" }
      });
    }
  })());
});
