// font toggle
document.addEventListener("DOMContentLoaded", () => {
const toggleBtn = document.getElementById("fontToggle");
const body = document.body;

  // load the font
const savedFont = localStorage.getItem("jpFontEnabled");

  if (savedFont === "true") {
    body.classList.add("jp-font");
    toggleBtn?.classList.add("active");
  }

  if (!toggleBtn) return;
  // toggle button 
  toggleBtn.addEventListener("click", () => {
    const isEnabled = body.classList.toggle("jp-font");
    toggleBtn.classList.toggle("active", isEnabled);

    // keep font while of diff pages  
    localStorage.setItem("jpFontEnabled", isEnabled);
  });
});

// video controls
const video = document.querySelector("video");
const playPauseBtn = document.querySelector(".play-pause");
const vidContainer = document.querySelector(".vid-container");
const miniplayer = document.querySelector(".mini-player-btn");
const fullscreenBtn = document.querySelector(".fullscreen-btn");
const theaterBtn = document.querySelector(".theater-btn");
const muteBtn = document.querySelector(".mute-btn");
const volumeSlider = document.querySelector(".volume-slider");
const currentTimeElem = document.querySelector(".current-time");
const totalTimeElem = document.querySelector(".total-time");
const speedBtn = document.querySelector(".speed-btn");

  document.addEventListener("keydown", e => {
    const tag = document.activeElement.tagName.toLowerCase();
    if (tag === "input") return;
    switch (e.key.toLowerCase()) {
      case " ":
        if (tag === "button") return;
        case "k":
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
            video.currentTime -= 5;
            break;
          case "arrowright":
            video.currentTime += 5;
            break;
          case "j":
            video.currentTime -= 10;
            break;
          case "l":
            video.currentTime += 10;
            break;
    }
  });

// speed controls
speedBtn.addEventListener("click", () => {
  const speeds = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
  let currentSpeedIndex = speeds.indexOf(video.playbackRate);
  currentSpeedIndex = (currentSpeedIndex + 1) % speeds.length;
  video.playbackRate = speeds[currentSpeedIndex];
  speedBtn.textContent = `${speeds[currentSpeedIndex]}x`;
});


// volume controls
muteBtn.addEventListener("click", toggleMute)
volumeSlider.addEventListener("input", e => {
  video.volume = e.target.value
  video.muted = e.target.value === 0
})

function toggleMute() {
  video.muted = !video.muted
}

video.addEventListener("volumechange", () => {
  volumeSlider.value = video.volume
  let volumeLevel
  if (video.muted || video.volume === 0) {
    volumeSlider.value = 0
    volumeLevel = "muted"
  } else if (video.volume >= 0.5) {
    volumeLevel = "high"
  } else {
    volumeLevel = "low"
  }

  vidContainer.dataset.volumeLevel = volumeLevel
})

// theater, fullscreen, miniplayer
theaterBtn.addEventListener("click", toggleTheaterMode);
fullscreenBtn.addEventListener("click", toggleFullScreen);
miniplayer.addEventListener("click", toggleMiniPlayer);

function toggleTheaterMode() {
  vidContainer.classList.toggle("theater");
}

function toggleFullScreen() {
  if (document.fullscreenElement == null) {
    vidContainer.requestFullscreen(); 
  } else {
    document.exitFullscreen();
  } 
}

document.addEventListener("fullscreenchange", () => {
  vidContainer.classList.toggle("fullscreen", document.fullscreenElement != null);
});

function toggleMiniPlayer() {
  if (video !== document.pictureInPictureElement) {
    video.requestPictureInPicture();
  } else {
    document.exitPictureInPicture();
  }
}

document.addEventListener("enterpictureinpicture", () => {
  vidContainer.classList.add("mini-player");
});

document.addEventListener("leavepictureinpicture", () => {
  vidContainer.classList.remove("mini-player");
});

// play/pause
playPauseBtn.addEventListener("click", togglePlayPause)
video.addEventListener("click", togglePlayPause)

function togglePlayPause() {
  video.paused ? video.play() : video.pause();
}

video.addEventListener("play", () => {
  vidContainer.classList.remove("paused");
});

video.addEventListener("pause", () => {
  vidContainer.classList.add("paused");
});

//time update
video.addEventListener("timeupdate", () => {
  const currentTime = video.currentTime;
  const duration = video.duration;
  const hours = Math.floor(currentTime / 3600);
  const minutes = Math.floor(currentTime / 60);
  const seconds = Math.floor(currentTime % 60);
  currentTimeElem.textContent = `${hours > 0 ? `${hours}:` : ''}${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  
  if (duration) {
    const totalMinutes = Math.floor(duration / 60);
    const totalSeconds = Math.floor(duration % 60);
    totalTimeElem.textContent = `${totalMinutes}:${totalSeconds < 10 ? '0' : ''}${totalSeconds}`;
  }
});

