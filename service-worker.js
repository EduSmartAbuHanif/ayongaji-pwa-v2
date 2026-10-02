
"use strict";

/*
 * AYO NGAJI - SERVICE WORKER
 *
 * Tugas:
 * 1. Menyimpan file inti aplikasi agar dapat dibuka offline.
 * 2. Menyediakan halaman aplikasi dari cache saat offline.
 * 3. Membantu mengambil audio yang telah diunduh.
 * 4. Tidak menghapus cache audio saat aplikasi diperbarui.
 */

const APP_CACHE_NAME = "ayo-ngaji-app-v1";
const AUDIO_CACHE_NAME = "ayo-ngaji-audio-v1";

const APP_FILES = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./manifest.json"
];


/* ----------------------------------------
   INSTALL
---------------------------------------- */

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(APP_CACHE_NAME);

      await cache.addAll(APP_FILES);

      await self.skipWaiting();
    })()
  );
});


/* ----------------------------------------
   ACTIVATE
---------------------------------------- */

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys();

      /*
       * Hanya cache aplikasi versi lama yang dihapus.
       * Cache audio peserta sengaja dipertahankan.
       */

      const oldAppCaches = cacheNames.filter((name) => {
        return (
          name.startsWith("ayo-ngaji-app-") &&
          name !== APP_CACHE_NAME
        );
      });

      await Promise.all(
        oldAppCaches.map((name) => caches.delete(name))
      );

      await self.clients.claim();
    })()
  );
});


/* ----------------------------------------
   FETCH
---------------------------------------- */

self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (request.method !== "GET") {
    return;
  }

  const requestUrl = new URL(request.url);

  /*
   * Jangan mengintervensi permintaan ke domain lain.
   */

  if (requestUrl.origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    (async () => {
      /*
       * Audio yang sudah diunduh diperiksa lebih dahulu.
       * Cache audio terpisah dari cache aplikasi.
       */

      const audioCache = await caches.open(AUDIO_CACHE_NAME);
      const savedAudio = await audioCache.match(request);

      if (savedAudio) {
        return savedAudio;
      }

      /*
       * Untuk navigasi halaman, coba jaringan terlebih dahulu.
       * Jika offline, tampilkan index.html dari cache.
       */

      if (request.mode === "navigate") {
        try {
          return await fetch(request);
        } catch (error) {
          const appCache = await caches.open(APP_CACHE_NAME);

          const cachedPage = await appCache.match("./index.html");

          if (cachedPage) {
            return cachedPage;
          }

          return new Response(
            "Ayo Ngaji belum tersedia secara offline. Buka aplikasi saat terhubung ke internet terlebih dahulu.",
            {
              status: 503,
              statusText: "Offline",
              headers: {
                "Content-Type": "text/plain; charset=utf-8"
              }
            }
          );
        }
      }

      /*
       * File inti aplikasi menggunakan strategi cache-first.
       * Jika tidak ditemukan, browser mencoba mengambilnya
       * dari jaringan.
       */

      const appCache = await caches.open(APP_CACHE_NAME);
      const cachedResponse = await appCache.match(request);

      if (cachedResponse) {
        return cachedResponse;
      }

      try {
        return await fetch(request);
      } catch (error) {
        return new Response(
          "Konten tidak tersedia saat offline.",
          {
            status: 503,
            statusText: "Offline",
            headers: {
              "Content-Type": "text/plain; charset=utf-8"
            }
          }
        );
      }
    })()
  );
});
