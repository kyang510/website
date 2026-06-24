type PictureInPictureDocument = Document & {
  pictureInPictureElement?: Element | null;
  pictureInPictureEnabled?: boolean;
  exitPictureInPicture?: () => Promise<void>;
};

type PictureInPictureVideo = HTMLVideoElement & {
  requestPictureInPicture?: () => Promise<unknown>;
};

interface NavigateOptions {
  push?: boolean;
}

interface GitHubRepo {
  archived: boolean;
  description: string | null;
  fork: boolean;
  homepage: string | null;
  html_url: string;
  language: string | null;
  name: string;
  pushed_at: string;
  stargazers_count: number;
}

interface VideoState {
  currentTime?: number;
  muted?: boolean;
  paused?: boolean;
  playbackRate?: number;
  volume?: number;
}

interface VideoPlayer {
  container: HTMLDivElement;
  video: HTMLVideoElement;
  playPauseBtn: HTMLButtonElement;
  miniPlayerBtn: HTMLButtonElement;
  fullscreenBtn: HTMLButtonElement;
  theaterBtn: HTMLButtonElement;
  muteBtn: HTMLButtonElement;
  volumeSlider: HTMLInputElement;
  currentTimeElem: HTMLDivElement;
  totalTimeElem: HTMLDivElement;
  speedSelect: HTMLSelectElement;
  timeline: HTMLDivElement;
  seekTimeBox: HTMLDivElement;
  tooltip: HTMLDivElement;
  isScrubbing: boolean;
}

const VIDEO_STATE_KEY = "shortsVideoState";
const INTERNAL_PAGES = new Set<string>(["main.html", "project.html", "shorts.html", "contact.html"]);

let player: VideoPlayer | null = null;
let isNavigating = false;

document.addEventListener("DOMContentLoaded", () => {
  initFontToggle();
  initNavigation();
  initPage();

  document.addEventListener("keydown", handleVideoKeydown);
  window.addEventListener("pagehide", saveVideoState);
});

function initPage(): void {
  updateActiveNav();
  loadRepos();
  initVideoPlayer();
}

// font toggle
function initFontToggle(): void {
  const toggleBtn = document.getElementById("fontToggle");
  const body = document.body;
  const savedFont = localStorage.getItem("jpFontEnabled");

  if (savedFont === "true") {
    body.classList.add("jp-font");
    toggleBtn?.classList.add("active");
  }

  if (!toggleBtn || toggleBtn.dataset.ready === "true") return;

  toggleBtn.dataset.ready = "true";
  toggleBtn.addEventListener("click", () => {
    const isEnabled = body.classList.toggle("jp-font");
    toggleBtn.classList.toggle("active", isEnabled);
    localStorage.setItem("jpFontEnabled", String(isEnabled));
  });
}

// in-page navigation keeps the active video element alive
function initNavigation(): void {
  document.addEventListener("click", event => {
    const link = closestAnchor(event.target);
    if (!link || !isInternalPageLink(link)) return;

    event.preventDefault();
    navigateTo(link.href);
  });

  window.addEventListener("popstate", () => {
    navigateTo(window.location.href, { push: false });
  });
}

function closestAnchor(target: EventTarget | null): HTMLAnchorElement | null {
  return target instanceof Element ? target.closest<HTMLAnchorElement>("a") : null;
}

function isInternalPageLink(link: HTMLAnchorElement): boolean {
  if (link.target || link.hasAttribute("download")) return false;

  const url = new URL(link.href, window.location.href);
  if (url.origin !== window.location.origin) return false;

  return INTERNAL_PAGES.has(fileNameFromPath(url.pathname));
}

async function navigateTo(href: string, { push = true }: NavigateOptions = {}): Promise<void> {
  if (isNavigating) return;

  const url = new URL(href, window.location.href);
  const currentFile = fileNameFromPath(window.location.pathname);
  const nextFile = fileNameFromPath(url.pathname);

  if (push && currentFile === nextFile) return;

  isNavigating = true;

  try {
    const response = await fetch(url.href, { cache: "no-cache" });
    if (!response.ok) throw new Error(`Could not load ${url.href}`);

    const html = await response.text();
    const nextDocument = new DOMParser().parseFromString(html, "text/html");
    const nextMain = nextDocument.querySelector<HTMLElement>("[data-page-content]");
    const currentMain = document.querySelector<HTMLElement>("[data-page-content]");

    if (!nextMain || !currentMain) {
      window.location.href = url.href;
      return;
    }

    const keepMiniPlayer = shouldKeepMiniPlayerAlive();
    if (keepMiniPlayer) {
      movePlayerToPersistentHost();
    } else if (player && currentMain.contains(player.container)) {
      saveVideoState();
      player = null;
    }

    currentMain.replaceWith(nextMain);
    document.title = nextDocument.title || document.title;

    if (push) {
      history.pushState({}, "", url.href);
    }

    if (keepMiniPlayer && nextFile === "shorts.html") {
      const freshPlayer = nextMain.querySelector<HTMLDivElement>(".vid-container");
      if (freshPlayer && player) {
        freshPlayer.replaceWith(player.container);
        player.container.dataset.persisting = "false";
        removeEmptyPersistentHost();
      }
    }

    initPage();
    window.scrollTo({ top: 0 });
  } catch (error) {
    console.error(error);
    window.location.href = url.href;
  } finally {
    isNavigating = false;
  }
}

function shouldKeepMiniPlayerAlive(): boolean {
  if (!player || !document.body.contains(player.container)) return false;

  return (
    player.container.classList.contains("mini-player") ||
    (document as PictureInPictureDocument).pictureInPictureElement === player.video
  );
}

function getPersistentHost(): HTMLDivElement {
  let host = document.getElementById("persistent-player-host") as HTMLDivElement | null;

  if (!host) {
    host = document.createElement("div");
    host.id = "persistent-player-host";
    document.body.appendChild(host);
  }

  return host;
}

function movePlayerToPersistentHost(): void {
  if (!player) return;

  const host = getPersistentHost();
  player.container.dataset.persisting = "true";
  host.appendChild(player.container);
}

function removeEmptyPersistentHost(): void {
  const host = document.getElementById("persistent-player-host");
  if (host && host.children.length === 0) {
    host.remove();
  }
}

function fileNameFromPath(pathname: string): string {
  return pathname.split("/").filter(Boolean).pop() || "main.html";
}

function updateActiveNav(pathname: string = window.location.pathname): void {
  const currentFile = fileNameFromPath(pathname);

  document.querySelectorAll<HTMLAnchorElement>(".nav-bar a").forEach(link => {
    const linkFile = fileNameFromPath(new URL(link.href, window.location.href).pathname);
    link.classList.toggle("active", linkFile === currentFile);
  });
}

// github repos
async function loadRepos(): Promise<void> {
  const username = "kyang510";
  const reposContainer = document.getElementById("repos");
  const statusText = document.getElementById("status");

  if (!reposContainer || !statusText || reposContainer.dataset.loaded === "true") return;

  reposContainer.dataset.loaded = "true";

  try {
    const response = await fetch(
      `https://api.github.com/users/${username}/repos?per_page=100&sort=updated`
    );

    if (!response.ok) {
      statusText.textContent = "Error loading repositories.";
      return;
    }

    const repos = (await response.json()) as GitHubRepo[];

    const filteredRepos = repos
      .filter(repo => !repo.fork)
      .filter(repo => !repo.archived)
      .sort((a, b) => new Date(b.pushed_at).getTime() - new Date(a.pushed_at).getTime());

    statusText.textContent = `Showing ${filteredRepos.length} projects`;

    reposContainer.innerHTML = filteredRepos.map(repo => `
      <div class="repo">
        <h3>
          <a href="${repo.html_url}" target="_blank">
            ${repo.name}
          </a>
        </h3>
        <p>${repo.description ?? "No description provided."}</p>
        <p>
          ${repo.language ? `<strong>${repo.language}</strong> ` : ""}
          &#9733; ${repo.stargazers_count}
        </p>
        ${repo.homepage ? `
          <p>
            <a href="${repo.homepage}" target="_blank">Live Demo</a>
          </p>
        ` : ""}
      </div>
    `).join("");
  } catch (error) {
    statusText.textContent = "Something went wrong.";
    console.error(error);
  }
}

// video controls
function initVideoPlayer(): void {
  const container = document.querySelector<HTMLDivElement>(".vid-container");
  if (!container) return;

  if (player?.container === container) return;
  if (container.dataset.videoReady === "true") return;

  const video = container.querySelector<HTMLVideoElement>("video");
  const playPauseBtn = container.querySelector<HTMLButtonElement>(".play-pause");
  const miniPlayerBtn = container.querySelector<HTMLButtonElement>(".mini-player-btn");
  const fullscreenBtn = container.querySelector<HTMLButtonElement>(".fullscreen-btn");
  const theaterBtn = container.querySelector<HTMLButtonElement>(".theater-btn");
  const muteBtn = container.querySelector<HTMLButtonElement>(".mute-btn");
  const volumeSlider = container.querySelector<HTMLInputElement>(".volume-slider");
  const currentTimeElem = container.querySelector<HTMLDivElement>(".current-time");
  const totalTimeElem = container.querySelector<HTMLDivElement>(".total-time");
  const speedSelect = container.querySelector<HTMLSelectElement>(".speed-select");
  const timeline = container.querySelector<HTMLDivElement>(".timeline");
  const seekTimeBox = container.querySelector<HTMLDivElement>("#seekTimeBox");

  if (
    !video ||
    !playPauseBtn ||
    !miniPlayerBtn ||
    !fullscreenBtn ||
    !theaterBtn ||
    !muteBtn ||
    !volumeSlider ||
    !currentTimeElem ||
    !totalTimeElem ||
    !speedSelect ||
    !timeline ||
    !seekTimeBox
  ) {
    return;
  }

  const tooltip = document.createElement("div");
  tooltip.className = "time-tooltip";
  tooltip.textContent = "0:00";

  const thumb = document.createElement("div");
  thumb.className = "thumb-indicator";

  timeline.appendChild(tooltip);
  timeline.appendChild(thumb);

  player = {
    container,
    video,
    playPauseBtn,
    miniPlayerBtn,
    fullscreenBtn,
    theaterBtn,
    muteBtn,
    volumeSlider,
    currentTimeElem,
    totalTimeElem,
    speedSelect,
    timeline,
    seekTimeBox,
    tooltip,
    isScrubbing: false,
  };

  container.dataset.videoReady = "true";
  container.classList.toggle("paused", video.paused);

  restoreVideoState();
  updateVolumeDisplay();
  updateTimeDisplay();

  speedSelect.addEventListener("change", () => {
    video.playbackRate = parseFloat(speedSelect.value);
    saveVideoState();
  });

  muteBtn.addEventListener("click", toggleMute);
  volumeSlider.addEventListener("input", event => {
    const target = event.currentTarget as HTMLInputElement;
    video.volume = Number(target.value);
    video.muted = Number(target.value) === 0;
  });

  video.addEventListener("volumechange", () => {
    updateVolumeDisplay();
    saveVideoState();
  });

  theaterBtn.addEventListener("click", toggleTheaterMode);
  fullscreenBtn.addEventListener("click", toggleFullScreen);
  miniPlayerBtn.addEventListener("click", toggleMiniPlayer);

  video.addEventListener("enterpictureinpicture", () => {
    container.classList.add("mini-player", "native-pip");
  });

  video.addEventListener("leavepictureinpicture", () => {
    container.classList.remove("mini-player", "native-pip");
    removePersistentPlayerIfInactive();
  });

  playPauseBtn.addEventListener("click", togglePlayPause);
  video.addEventListener("click", togglePlayPause);

  video.addEventListener("play", () => {
    container.classList.remove("paused");
    saveVideoState();
  });

  video.addEventListener("pause", () => {
    container.classList.add("paused");
    saveVideoState();
  });

  video.addEventListener("loadedmetadata", updateTimeDisplay);
  video.addEventListener("timeupdate", () => {
    updateTimeDisplay();
    saveVideoState();
  });

  timeline.addEventListener("mousemove", updatePreview);
  timeline.addEventListener("mouseenter", updatePreview);
  timeline.addEventListener("mouseleave", hideSeekBox);

  timeline.addEventListener("mousedown", event => {
    if (!player) return;

    player.isScrubbing = true;
    scrubTo(event);

    document.addEventListener("mousemove", scrubTo);
    document.addEventListener("mouseup", stopScrubbing, { once: true });
  });

  timeline.addEventListener("click", scrubTo);
}

function handleVideoKeydown(event: KeyboardEvent): void {
  if (!player || !document.body.contains(player.container)) return;

  const activeElement = document.activeElement;
  const tag = activeElement?.tagName?.toLowerCase();
  if (
    tag === "input" ||
    tag === "textarea" ||
    tag === "select" ||
    (activeElement instanceof HTMLElement && activeElement.isContentEditable)
  ) {
    return;
  }

  switch (event.key.toLowerCase()) {
    case " ":
    case "k":
      event.preventDefault();
      togglePlayPause();
      break;
    case "f":
      toggleFullScreen();
      break;
    case "t":
      toggleTheaterMode();
      break;
    case "i":
      toggleMiniPlayer();
      break;
    case "m":
      toggleMute();
      break;
    case "arrowleft":
      event.preventDefault();
      player.video.currentTime -= 5;
      break;
    case "arrowright":
      event.preventDefault();
      player.video.currentTime += 5;
      break;
    case "j":
      player.video.currentTime -= 10;
      break;
    case "l":
      player.video.currentTime += 10;
      break;
  }
}

function toggleMute(): void {
  if (!player) return;
  player.video.muted = !player.video.muted;
}

function updateVolumeDisplay(): void {
  if (!player) return;

  const { video, volumeSlider, container } = player;
  volumeSlider.value = String(video.muted ? 0 : video.volume);

  let volumeLevel = "low";
  if (video.muted || video.volume === 0) {
    volumeLevel = "muted";
  } else if (video.volume >= 0.5) {
    volumeLevel = "high";
  }

  container.dataset.volumeLevel = volumeLevel;
}

function toggleTheaterMode(): void {
  if (!player) return;
  player.container.classList.toggle("theater");
}

function toggleFullScreen(): void {
  if (!player) return;

  if (document.fullscreenElement == null) {
    player.container.requestFullscreen?.();
  } else {
    document.exitFullscreen?.();
  }
}

document.addEventListener("fullscreenchange", () => {
  if (!player) return;
  player.container.classList.toggle("fullscreen", document.fullscreenElement === player.container);
});

async function toggleMiniPlayer(): Promise<void> {
  if (!player) return;

  const { video, container } = player;
  const pipDocument = document as PictureInPictureDocument;
  const pipVideo = video as PictureInPictureVideo;

  if (pipDocument.pictureInPictureEnabled && typeof pipVideo.requestPictureInPicture === "function") {
    try {
      if (pipDocument.pictureInPictureElement === video) {
        await pipDocument.exitPictureInPicture?.();
      } else {
        container.classList.add("mini-player");
        await pipVideo.requestPictureInPicture();
      }
    } catch (error) {
      container.classList.remove("mini-player", "native-pip");
      console.error(error);
    }

    return;
  }

  container.classList.toggle("mini-player");
  if (!container.classList.contains("mini-player")) {
    removePersistentPlayerIfInactive();
  }
}

function removePersistentPlayerIfInactive(): void {
  if (!player) return;

  const host = document.getElementById("persistent-player-host");
  const isInPersistentHost = host?.contains(player.container);
  const isMini = player.container.classList.contains("mini-player");

  if (isInPersistentHost && !isMini) {
    player.video.pause();
    saveVideoState();
    player.container.remove();
    player = null;
    removeEmptyPersistentHost();
  }
}

function togglePlayPause(): void {
  if (!player) return;
  player.video.paused ? player.video.play() : player.video.pause();
}

function updateTimeDisplay(): void {
  if (!player) return;

  const { video, timeline, currentTimeElem, totalTimeElem } = player;
  const currentTime = video.currentTime || 0;
  const duration = video.duration || 0;
  const progress = duration ? currentTime / duration : 0;

  timeline.style.setProperty("--progress-position", String(progress));
  currentTimeElem.textContent = formatTime(currentTime);
  totalTimeElem.textContent = duration ? formatTime(duration) : "0:00";
}

function formatTime(time: number): string {
  if (!Number.isFinite(time)) return "0:00";

  const hours = Math.floor(time / 3600);
  const minutes = Math.floor((time % 3600) / 60);
  const seconds = Math.floor(time % 60);
  const mm = hours > 0 ? String(minutes).padStart(2, "0") : String(minutes);
  const ss = String(seconds).padStart(2, "0");

  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}

function percentFromEvent(event: MouseEvent): number {
  if (!player) return 0;

  const rect = player.timeline.getBoundingClientRect();
  const x = Math.min(Math.max(0, event.clientX - rect.left), rect.width);

  return rect.width === 0 ? 0 : x / rect.width;
}

function updatePreview(event: MouseEvent): void {
  if (!player) return;

  const { video, timeline, tooltip, seekTimeBox } = player;
  const rect = timeline.getBoundingClientRect();
  const percent = percentFromEvent(event);
  const previewTime = (video.duration || 0) * percent;

  timeline.style.setProperty("--preview-position", String(percent));
  tooltip.textContent = formatTime(previewTime);
  showSeekBox(previewTime);
  seekTimeBox.style.left = `${percent * rect.width}px`;
}

function scrubTo(event: MouseEvent): void {
  if (!player) return;

  const { video, timeline, tooltip, seekTimeBox } = player;
  const rect = timeline.getBoundingClientRect();
  const percent = percentFromEvent(event);
  const time = (video.duration || 0) * percent;

  tooltip.textContent = formatTime(time);
  showSeekBox(time);
  seekTimeBox.style.left = `${percent * rect.width}px`;
  timeline.style.setProperty("--preview-position", String(percent));

  if (player.isScrubbing || event.type === "click") {
    video.currentTime = time;
  }
}

function showSeekBox(time: number): void {
  if (!player) return;

  player.seekTimeBox.textContent = formatTime(time);
  player.seekTimeBox.classList.add("show");
}

function hideSeekBox(): void {
  if (!player) return;
  player.seekTimeBox.classList.remove("show");
}

function stopScrubbing(): void {
  if (!player) return;

  player.isScrubbing = false;
  document.removeEventListener("mousemove", scrubTo);
  hideSeekBox();
}

function restoreVideoState(): void {
  if (!player) return;

  const state = readVideoState();
  if (!state) return;

  const { video, speedSelect } = player;

  if (isFiniteNumber(state.volume)) {
    video.volume = Math.min(Math.max(state.volume, 0), 1);
  }

  video.muted = Boolean(state.muted);

  if (isFiniteNumber(state.playbackRate)) {
    video.playbackRate = state.playbackRate;
    speedSelect.value = String(state.playbackRate);
  }

  const savedCurrentTime = state.currentTime;

  if (isFiniteNumber(savedCurrentTime) && savedCurrentTime > 0) {
    video.addEventListener("loadedmetadata", () => {
      if (savedCurrentTime < video.duration) {
        video.currentTime = savedCurrentTime;
      }
    }, { once: true });
  }
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function readVideoState(): VideoState | null {
  try {
    const rawState = localStorage.getItem(VIDEO_STATE_KEY);
    return rawState ? JSON.parse(rawState) as VideoState : null;
  } catch {
    return null;
  }
}

function saveVideoState(): void {
  if (!player) return;

  const { video } = player;
  localStorage.setItem(VIDEO_STATE_KEY, JSON.stringify({
    currentTime: video.currentTime || 0,
    muted: video.muted,
    playbackRate: video.playbackRate,
    paused: video.paused,
    volume: video.volume,
  }));
}
