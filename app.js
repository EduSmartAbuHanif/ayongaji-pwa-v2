
"use strict";

document.addEventListener("DOMContentLoaded", () => {
  const themeList = document.getElementById("theme-list");
  const detailPage = document.getElementById("detail-page");
  const detailTitle = document.getElementById("detail-title");
  const detailDescription = document.getElementById("detail-description");
  const audioGrid = document.getElementById("audio-grid");
  const audioNotice = document.getElementById("audio-notice");
  const backButton = document.getElementById("back-button");
  const participantName = document.getElementById("participant-name");

  const REPEAT_COUNT = 3;
  const CACHE_PREFIX = "ayongaji-audio-";

  /*
   * Daftar nama file berdasarkan tangkapan layar Hostinger.
   * Tema 3–20 belum diaktifkan karena daftar audio aslinya
   * belum terkonfirmasi.
   */
  const audioFiles = {
    1: ["087.mp3", "088.mp3", "093.mp3", "094.mp3", "107.mp3", "108.mp3", "109.mp3"],
    2: ["097.mp3", "098.mp3", "099.mp3", "100.mp3", "110.mp3", "111.mp3", "112.mp3"]
  };

  const themes = Array.from({ length: 20 }, (_, index) => ({
    id: index + 1,
    title: `Tema ${index + 1}`
  }));

  let currentTheme = null;
  let currentButton = null;
  let playCount = 0;
  let activeAudioPath = null;
  let detailCheckId = 0;

  const downloading = new Set();
  const player = new Audio();
  player.preload = "none";

  // Nama dapat disediakan oleh proses pendaftaran pada tahap berikutnya.
  // Jika belum ada, gunakan sapaan umum.
  try {
    const savedName = localStorage.getItem("ayongaji-participant-name");
    if (savedName && savedName.trim()) {
      participantName.textContent = savedName.trim();
    }
  } catch (_) {}

  function themeFolder(id) {
    return `tema-${String(id).padStart(2, "0")}`;
  }

  function audioPath(id, file) {
    return `audio/${themeFolder(id)}/${file}`;
  }

  function audioUrl(id, file) {
    return new URL(audioPath(id, file), document.baseURI).href;
  }

  function cacheName(id) {
    return `${CACHE_PREFIX}${themeFolder(id)}`;
  }

  function filesFor(id) {
    return audioFiles[id] || null;
  }

  async function countSaved(id) {
    const files = filesFor(id);
    if (!files || !("caches" in window)) return 0;

    const cache = await caches.open(cacheName(id));
    let count = 0;

    for (const file of files) {
      const response = await cache.match(audioUrl(id, file));
      if (response && response.ok) count++;
    }

    return count;
  }

  async function isThemeReady(id) {
    const files = filesFor(id);
    if (!files || !("caches" in window)) return false;

    const cache = await caches.open(cacheName(id));

    for (const file of files) {
      const response = await cache.match(audioUrl(id, file));
      if (!response || !response.ok) return false;
    }

    return true;
  }

  function makeElement(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }

  function renderThemes() {
    themeList.innerHTML = "";

    themes.forEach(theme => {
      const files = filesFor(theme.id);
      const card = makeElement("article", "theme-card");
      card.style.setProperty("--card-index", theme.id - 1);

      const info = makeElement("div", "theme-info");
      const number = makeElement("span", "theme-number",
        String(theme.id).padStart(2, "0"));
      const title = makeElement("h3", "theme-title", theme.title);
      const detail = makeElement("p", "theme-count",
        files ? `${files.length} audio pembelajaran` : "Materi sedang disiapkan");

      info.append(number, title, detail);

      const action = makeElement("div", "theme-action");
      const status = makeElement("p", "status-text", "Memeriksa audio...");
      const download = makeElement("button", "action-button", "↓");
      download.type = "button";
      download.setAttribute("aria-label", `Unduh semua audio ${theme.title}`);

      const open = makeElement("button", "open-theme-button", "Menyimak Contoh Bacaan");
      open.type = "button";
      open.hidden = true;

      action.append(status, download, open);
      card.append(info, action);
      themeList.append(card);

      if (!files) {
        status.textContent = "Audio belum tersedia";
        download.disabled = true;
        download.title = "Daftar audio tema ini belum dikonfirmasi";
        return;
      }

      download.addEventListener("click", () => downloadTheme(theme, status, download, open));
      open.addEventListener("click", () => openTheme(theme));

      refreshCard(theme, status, download, open);
    });
  }

  async function refreshCard(theme, status, download, open) {
    const files = filesFor(theme.id);
    if (!files) return;

    try {
      const ready = await isThemeReady(theme.id);
      if (ready) {
        status.textContent = "Audio sudah siap";
        status.classList.add("ready-status");
        download.hidden = true;
        open.hidden = false;
        open.disabled = false;
      } else {
        const saved = await countSaved(theme.id);
        status.classList.remove("ready-status");
        status.textContent = saved > 0
          ? `${saved} dari ${files.length} audio tersimpan`
          : "Belum diunduh";
        download.hidden = false;
        download.disabled = downloading.has(theme.id);
        download.textContent = downloading.has(theme.id) ? "…" : "↓";
        open.hidden = true;
      }
    } catch (error) {
      console.error("Pemeriksaan cache gagal:", error);
      status.textContent = "Tidak dapat memeriksa audio";
      download.disabled = true;
    }
  }

  async function downloadTheme(theme, status, download, open) {
    const id = theme.id;
    const files = filesFor(id);

    if (!files || downloading.has(id)) return;

    if (!("caches" in window)) {
      status.textContent = "Browser belum mendukung unduhan offline";
      return;
    }

    if (!navigator.onLine) {
      status.textContent = "Hubungkan internet untuk mengunduh audio";
      return;
    }

    downloading.add(id);
    download.disabled = true;
    download.textContent = "…";
    status.textContent = "Menyiapkan unduhan…";

    try {
      const cache = await caches.open(cacheName(id));

      for (let index = 0; index < files.length; index++) {
        const file = files[index];
        const url = audioUrl(id, file);

        // Lewati file yang sudah tersimpan dan lolos pemeriksaan.
        const existing = await cache.match(url);
        if (existing && existing.ok) {
          status.textContent = `Memeriksa ${index + 1} dari ${files.length}…`;
          continue;
        }

        status.textContent = `Mengunduh audio ${index + 1} dari ${files.length}…`;

        const response = await fetch(url, { cache: "no-store" });

        if (!response.ok) {
          throw new Error(`File ${file} tidak ditemukan (HTTP ${response.status})`);
        }

        const contentType = response.headers.get("content-type") || "";
        if (contentType.includes("text/html")) {
          throw new Error(`File ${file} tidak valid. Periksa lokasi audio di server.`);
        }

        await cache.put(url, response.clone());
      }

      const ready = await isThemeReady(id);
      if (!ready) {
        throw new Error("Verifikasi belum berhasil. Sebagian audio belum tersimpan.");
      }

      status.textContent = "Alhamdulillah, audio sudah siap!";
      status.classList.add("ready-status");
      cardCelebrate(download.closest(".theme-card"));
    } catch (error) {
      console.error("Unduhan tema gagal:", error);
      status.textContent = `Unduhan belum lengkap: ${error.message}`;
    } finally {
      downloading.delete(id);
      await refreshCard(theme, status, download, open);
    }
  }

  function cardCelebrate(card) {
    if (!card) return;
    card.classList.remove("celebrate");
    void card.offsetWidth;
    card.classList.add("celebrate");
    window.setTimeout(() => card.classList.remove("celebrate"), 900);
  }

  function stopAudio() {
    player.pause();
    player.currentTime = 0;

    if (currentButton) {
      currentButton.classList.remove("is-playing");
      currentButton.setAttribute("aria-pressed", "false");
    }

    currentButton = null;
    activeAudioPath = null;
    playCount = 0;
  }

  function playTrack(themeId, trackIndex, button) {
    const files = filesFor(themeId);
    if (!files || !files[trackIndex]) return;

    stopAudio();

    const file = files[trackIndex];
    const path = audioPath(themeId, file);

    activeAudioPath = path;
    currentButton = button;
    playCount = 1;

    player.src = path;
    button.classList.add("is-playing");
    button.setAttribute("aria-pressed", "true");

    audioNotice.textContent =
      `Menyimak audio ${trackIndex + 1}. Pemutaran 1 dari ${REPEAT_COUNT}.`;

    player.play().catch(error => {
      console.error("Audio tidak dapat diputar:", error);
      stopAudio();
      audioNotice.textContent =
        "Audio gagal diputar. Pastikan unduhan tema sudah lengkap.";
    });
  }

  player.addEventListener("ended", () => {
    if (!activeAudioPath) return;

    if (playCount < REPEAT_COUNT) {
      playCount++;
      audioNotice.textContent =
        `Menyimak bacaan. Pemutaran ${playCount} dari ${REPEAT_COUNT}.`;
      player.currentTime = 0;
      player.play().catch(error => {
        console.error("Pengulangan gagal:", error);
        stopAudio();
        audioNotice.textContent = "Pemutaran terhenti.";
      });
      return;
    }

    if (currentButton) {
      currentButton.classList.remove("is-playing");
      currentButton.setAttribute("aria-pressed", "false");
    }

    currentButton = null;
    activeAudioPath = null;
    playCount = 0;
    audioNotice.textContent =
      "MasyaAllah, selesai! Silakan pilih bacaan lain jika ingin melanjutkan.";
    audioNotice.classList.add("success-notice");
  });

  function openTheme(theme) {
    if (!filesFor(theme.id)) return;

    stopAudio();
    currentTheme = theme;
    detailCheckId++;

    detailTitle.textContent = theme.title;
    detailDescription.textContent =
      "Pilih nomor bacaan. Setiap audio akan diputar tiga kali.";

    themeList.closest(".learning-section").hidden = true;
    detailPage.hidden = false;
    audioNotice.classList.remove("success-notice");
    renderAudioButtons(theme, detailCheckId);

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function renderAudioButtons(theme, checkId) {
    audioGrid.innerHTML = "";
    audioNotice.textContent = "Memeriksa kelengkapan audio…";

    const files = filesFor(theme.id);
    if (!files) return;

    files.forEach((file, index) => {
      const button = makeElement("button", "audio-button");
      button.type = "button";
      button.disabled = true;
      button.setAttribute("aria-pressed", "false");
      button.setAttribute("aria-label", `Audio ${index + 1}`);

      const number = makeElement("span", "audio-number", String(index + 1));
      const icon = makeElement("span", "audio-icon", "♫");
      const caption = makeElement("span", "audio-caption", `Bacaan ${index + 1}`);

      button.append(number, icon, caption);
      button.addEventListener("click", () => {
        if (button.disabled) return;
        audioNotice.classList.remove("success-notice");
        playTrack(theme.id, index, button);
      });

      audioGrid.append(button);
    });

    try {
      const ready = await isThemeReady(theme.id);
      if (checkId !== detailCheckId || currentTheme?.id !== theme.id) return;

      [...audioGrid.querySelectorAll(".audio-button")].forEach(button => {
        button.disabled = !ready;
      });

      audioNotice.textContent = ready
        ? "Audio siap. Dengarkan setiap bacaan dengan saksama."
        : "Audio belum lengkap. Kembali ke beranda dan unduh seluruh audio tema.";
    } catch (error) {
      console.error(error);
      audioNotice.textContent = "Tidak dapat memeriksa audio.";
    }
  }

  function showThemes() {
    stopAudio();
    detailCheckId++;
    currentTheme = null;
    detailPage.hidden = true;
    themeList.closest(".learning-section").hidden = false;
    renderThemes();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  backButton.addEventListener("click", showThemes);

  // Daftarkan service worker yang benar.
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./service-worker.js")
        .then(registration => {
          console.log("Service worker aktif:", registration.scope);
        })
        .catch(error => {
          console.error("Pendaftaran service worker gagal:", error);
        });
    });
  }

  renderThemes();
});
