
"use strict";

/*
 * AYO NGAJI PWA
 * Pengatur level, tema, unduhan audio, dan pemutaran.
 *
 * Catatan:
 * - Setiap level memiliki 20 tema.
 * - Data audio yang belum diketahui sengaja dikosongkan.
 * - Audio yang sudah diunduh disimpan di Cache Storage.
 * - Audio hanya dapat diputar setelah semua file dalam tema
 *   berhasil diunduh dan diverifikasi.
 */

const CONFIG = {
  totalLevels: 5,
  totalThemesPerLevel: 20,
  cacheName: "ayo-ngaji-audio-v1",
  audioBasePath: "./audio/"
};

/*
 * Daftar audio yang sudah diketahui.
 *
 * Struktur folder yang diharapkan:
 * audio/
 *   tema-01/
 *     107.mp3
 *     108.mp3
 *     109.mp3
 *   tema-02/
 *     110.mp3
 *     111.mp3
 *     112.mp3
 *
 * Untuk saat ini, daftar ini baru memuat data yang sudah
 * dipastikan. Jangan menambahkan nama file berdasarkan dugaan.
 */

const AUDIO_DATA = {
  1: {
    1: ["107.mp3", "108.mp3", "109.mp3"],
    2: ["110.mp3", "111.mp3", "112.mp3"]
  }
};

const elements = {
  participantName: document.getElementById("participant-name"),
  levelList: document.getElementById("level-list"),

  themeSection: document.getElementById("theme-section"),
  themeHeading: document.getElementById("theme-heading"),
  themeList: document.getElementById("theme-list"),

  audioSection: document.getElementById("audio-section"),
  audioHeading: document.getElementById("audio-heading"),
  audioList: document.getElementById("audio-list")
};

let selectedLevel = null;
let selectedTheme = null;
let activeAudio = null;
let activeObjectUrl = null;
let activeAudioButton = null;


/* ----------------------------------------
   UTILITAS
---------------------------------------- */

function getThemeFolder(themeNumber) {
  return `tema-${String(themeNumber).padStart(2, "0")}`;
}

function getAudioFiles(levelNumber, themeNumber) {
  return AUDIO_DATA[levelNumber]?.[themeNumber] || [];
}

function getAudioUrl(themeNumber, fileName) {
  return new URL(
    `${CONFIG.audioBasePath}${getThemeFolder(themeNumber)}/${fileName}`,
    document.baseURI
  ).href;
}

function createElement(tagName, className, textContent) {
  const element = document.createElement(tagName);

  if (className) {
    element.className = className;
  }

  if (textContent !== undefined) {
    element.textContent = textContent;
  }

  return element;
}

function showMessage(container, message, className = "status-message") {
  container.replaceChildren(
    createElement("p", className, message)
  );
}

function setButtonBusy(button, busy, label) {
  button.disabled = busy;
  button.textContent = label;
}


/* ----------------------------------------
   NAMA PESERTA
---------------------------------------- */

/*
 * Nama dapat diberikan oleh sistem pendaftaran melalui
 * parameter URL ?nama=NamaPeserta.
 *
 * Contoh:
 * https://alamat-aplikasi/?nama=Ahmad
 *
 * Nama hanya disimpan sebagai nama sapaan di perangkat.
 * Jangan memasukkan data sensitif ke URL.
 */

function getParticipantName() {
  const params = new URLSearchParams(window.location.search);
  const nameFromUrl = params.get("nama");

  if (nameFromUrl && nameFromUrl.trim()) {
    const cleanName = nameFromUrl.trim().slice(0, 80);

    try {
      localStorage.setItem("ayoNgajiParticipantName", cleanName);
    } catch (error) {
      console.warn("Nama tidak dapat disimpan di perangkat.", error);
    }

    return cleanName;
  }

  try {
    return localStorage.getItem("ayoNgajiParticipantName") || "";
  } catch (error) {
    console.warn("Nama peserta tidak dapat dibaca.", error);
    return "";
  }
}

function renderGreeting() {
  const name = getParticipantName();

  elements.participantName.textContent =
    name || "Sahabat Ayo Ngaji";
}


/* ----------------------------------------
   LEVEL DAN TEMA
---------------------------------------- */

function renderLevels() {
  elements.levelList.replaceChildren();

  for (let level = 1; level <= CONFIG.totalLevels; level++) {
    const button = createElement(
      "button",
      "level-button",
      `Level ${level}`
    );

    button.type = "button";
    button.setAttribute(
      "aria-label",
      `Buka daftar tema Level ${level}`
    );

    if (selectedLevel === level) {
      button.classList.add("is-selected");
      button.setAttribute("aria-pressed", "true");
    } else {
      button.setAttribute("aria-pressed", "false");
    }

    button.addEventListener("click", () => {
      selectLevel(level);
    });

    elements.levelList.appendChild(button);
  }
}

function selectLevel(level) {
  stopCurrentAudio();

  selectedLevel = level;
  selectedTheme = null;

  renderLevels();
  renderThemes();

  elements.audioSection.hidden = true;

  elements.themeSection.hidden = false;
  elements.themeSection.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}

function renderThemes() {
  elements.themeHeading.textContent =
    `Daftar Tema — Level ${selectedLevel}`;

  elements.themeList.replaceChildren();

  for (
    let theme = 1;
    theme <= CONFIG.totalThemesPerLevel;
    theme++
  ) {
    const button = createElement(
      "button",
      "theme-button",
      `Tema ${theme}`
    );

    button.type = "button";

    if (selectedTheme === theme) {
      button.classList.add("is-selected");
      button.setAttribute("aria-pressed", "true");
    } else {
      button.setAttribute("aria-pressed", "false");
    }

    button.addEventListener("click", () => {
      selectTheme(theme);
    });

    elements.themeList.appendChild(button);
  }
}

function selectTheme(theme) {
  stopCurrentAudio();

  selectedTheme = theme;

  renderThemes();
  renderAudioSection();

  elements.audioSection.hidden = false;
  elements.audioSection.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}


/* ----------------------------------------
   CACHE DAN STATUS UNDUHAN
---------------------------------------- */

async function getAudioCache() {
  if (!("caches" in window)) {
    throw new Error(
      "Browser ini belum mendukung penyimpanan audio offline."
    );
  }

  return caches.open(CONFIG.cacheName);
}

async function isThemeDownloaded(level, theme) {
  const files = getAudioFiles(level, theme);

  if (files.length === 0) {
    return false;
  }

  const cache = await getAudioCache();

  for (const fileName of files) {
    const url = getAudioUrl(theme, fileName);
    const response = await cache.match(url);

    if (!response) {
      return false;
    }

    if (!response.ok) {
      return false;
    }
  }

  return true;
}


/* ----------------------------------------
   TAMPILAN AUDIO
---------------------------------------- */

async function renderAudioSection() {
  const level = selectedLevel;
  const theme = selectedTheme;

  elements.audioHeading.textContent =
    `Audio — Level ${level}, Tema ${theme}`;

  elements.audioList.replaceChildren();

  const files = getAudioFiles(level, theme);

  if (files.length === 0) {
    showMessage(
      elements.audioList,
      "Daftar audio untuk tema ini belum tersedia. Audio akan ditambahkan setelah nama file dan lokasinya dipastikan.",
      "empty-message"
    );
    return;
  }

  const downloadButton = createElement(
    "button",
    "download-button",
    "Unduh semua audio tema"
  );

  downloadButton.type = "button";

  const status = createElement(
    "p",
    "download-status",
    "Memeriksa status unduhan..."
  );

  const progress = document.createElement("progress");
  progress.max = files.length;
  progress.value = 0;
  progress.className = "download-progress";
  progress.setAttribute("aria-label", "Kemajuan unduhan");

  const audioButtons = createElement(
    "div",
    "audio-buttons"
  );

  elements.audioList.append(
    downloadButton,
    status,
    progress,
    audioButtons
  );

  const buttons = [];

  for (let index = 0; index < files.length; index++) {
    const button = createElement(
      "button",
      "audio-button",
      `Audio ${index + 1}`
    );

    button.type = "button";
    button.disabled = true;
    button.title = files[index];

    button.addEventListener("click", () => {
      playAudio(
        level,
        theme,
        files[index],
        button
      );
    });

    audioButtons.appendChild(button);
    buttons.push(button);
  }

  try {
    const downloaded = await isThemeDownloaded(level, theme);

    if (downloaded) {
      status.textContent = "Semua audio sudah tersimpan di perangkat.";
      progress.value = files.length;

      downloadButton.textContent = "Unduh ulang semua audio";

      buttons.forEach((button) => {
        button.disabled = false;
      });
    } else {
      status.textContent =
        `${files.length} audio tersedia untuk diunduh.`;

      progress.value = 0;
    }
  } catch (error) {
    status.textContent = error.message;
  }

  downloadButton.addEventListener("click", async () => {
    await downloadTheme(
      level,
      theme,
      files,
      downloadButton,
      status,
      progress,
      buttons
    );
  });
}


/* ----------------------------------------
   UNDUH SELURUH AUDIO DALAM TEMA
---------------------------------------- */

async function downloadTheme(
  level,
  theme,
  files,
  downloadButton,
  status,
  progress,
  audioButtons
) {
  downloadButton.disabled = true;
  downloadButton.textContent = "Sedang mengunduh...";

  audioButtons.forEach((button) => {
    button.disabled = true;
  });

  progress.value = 0;
  status.textContent = "Menyiapkan unduhan...";

  let cache;

  try {
    cache = await getAudioCache();

    /*
     * Unduh dan verifikasi semua file terlebih dahulu.
     * Tombol audio baru diaktifkan setelah seluruh file
     * berhasil disimpan.
     */

    const downloadedResponses = [];

    for (let index = 0; index < files.length; index++) {
      const fileName = files[index];
      const url = getAudioUrl(theme, fileName);

      status.textContent =
        `Mengunduh audio ${index + 1} dari ${files.length}...`;

      const response = await fetch(url, {
        cache: "no-store"
      });

      if (!response.ok) {
        throw new Error(
          `Gagal mengunduh ${fileName}. Periksa lokasi file audio.`
        );
      }

      const blob = await response.blob();

      if (blob.size === 0) {
        throw new Error(
          `File ${fileName} kosong atau tidak valid.`
        );
      }

      downloadedResponses.push({
        url,
        response: new Response(blob, {
          status: 200,
          headers: {
            "Content-Type": blob.type || "audio/mpeg"
          }
        })
      });

      progress.value = index + 1;
    }

    status.textContent = "Menyimpan audio ke perangkat...";

    for (const item of downloadedResponses) {
      await cache.put(item.url, item.response);
    }

    /*
     * Verifikasi ulang hasil penyimpanan.
     */

    const allSaved = await isThemeDownloaded(level, theme);

    if (!allSaved) {
      throw new Error(
        "Sebagian audio belum berhasil tersimpan. Silakan coba lagi."
      );
    }

    status.textContent =
      "Berhasil! Semua audio tema sudah tersimpan dan siap diputar.";

    downloadButton.textContent = "Unduh ulang semua audio";

    audioButtons.forEach((button) => {
      button.disabled = false;
    });
  } catch (error) {
    console.error("Kesalahan unduhan:", error);

    status.textContent =
      `${error.message} Audio belum dapat diputar. Silakan periksa koneksi dan coba lagi.`;

    downloadButton.textContent = "Coba unduh lagi";

    audioButtons.forEach((button) => {
      button.disabled = true;
    });
  } finally {
    downloadButton.disabled = false;
  }
}


/* ----------------------------------------
   PEMUTARAN AUDIO 3 KALI
---------------------------------------- */

function stopCurrentAudio() {
  if (activeAudio) {
    activeAudio.pause();
    activeAudio.currentTime = 0;
    activeAudio.onended = null;
    activeAudio.onerror = null;
    activeAudio = null;
  }

  if (activeObjectUrl) {
    URL.revokeObjectURL(activeObjectUrl);
    activeObjectUrl = null;
  }

  if (activeAudioButton) {
    activeAudioButton.classList.remove("is-playing");
    activeAudioButton.textContent =
      activeAudioButton.dataset.originalLabel || "Audio";
    activeAudioButton = null;
  }
}

async function playAudio(level, theme, fileName, button) {
  try {
    const cache = await getAudioCache();
    const url = getAudioUrl(theme, fileName);
    const response = await cache.match(url);

    if (!response || !response.ok) {
      button.disabled = true;
      alert("Audio belum diunduh. Silakan unduh seluruh audio tema terlebih dahulu.");
      return;
    }

    stopCurrentAudio();

    const blob = await response.blob();
    activeObjectUrl = URL.createObjectURL(blob);

    const audio = new Audio(activeObjectUrl);

    activeAudio = audio;
    activeAudioButton = button;

    let playCount = 0;

    const originalLabel =
      button.dataset.originalLabel || button.textContent;

    button.dataset.originalLabel = originalLabel;
    button.classList.add("is-playing");

    async function playOneTime() {
      if (activeAudio !== audio) {
        return;
      }

      playCount++;

      button.textContent =
        `${originalLabel} · ${playCount}/3`;

      try {
        await audio.play();
      } catch (error) {
        console.error("Audio gagal diputar:", error);
        stopCurrentAudio();
        alert("Audio tidak dapat diputar. Silakan coba lagi.");
      }
    }

    audio.addEventListener("ended", async () => {
      if (activeAudio !== audio) {
        return;
      }

      if (playCount < 3) {
        audio.currentTime = 0;
        await playOneTime();
      } else {
        stopCurrentAudio();
      }
    });

    audio.addEventListener("error", () => {
      if (activeAudio === audio) {
        stopCurrentAudio();
        alert("Terjadi kesalahan saat memutar audio.");
      }
    });

    await playOneTime();
  } catch (error) {
    console.error("Kesalahan pemutaran:", error);
    alert("Audio belum dapat diputar. Silakan coba lagi.");
  }
}


/* ----------------------------------------
   MULAI APLIKASI
---------------------------------------- */

function initializeApp() {
  renderGreeting();
  renderLevels();

  elements.themeSection.hidden = true;
  elements.audioSection.hidden = true;
}

initializeApp();

/* ----------------------------------------
   PENDAFTARAN SERVICE WORKER
---------------------------------------- */

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("./service-worker.js")
      .then((registration) => {
        console.log(
          "Service worker aktif:",
          registration.scope
        );
      })
      .catch((error) => {
        console.error(
          "Service worker gagal didaftarkan:",
          error
        );
      });
  });
}
