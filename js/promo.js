// Manual quality selection keeps the same video element and its sound settings.
export function initPromo(L) {
  const video = document.getElementById("promo-video");
  const select = document.getElementById("promo-quality");
  const tools = document.getElementById("promo-tools");
  const status = document.getElementById("promo-status");
  if (!video || !select || !tools || !status) return;

  const autoOption = Array.from(select.options).find((option) => option.value === "auto");
  let automatic = select.value === "auto";
  let quality = automatic ? "1080" : select.value;
  let stallTimer = null;
  let recentStalls = [];
  let initialAutoplay = video.paused && video.currentTime === 0;
  let phase = initialAutoplay && video.readyState < 2 ? "loading" : "", resume = null, change = null;
  const failedCodecs = new Set();
  const showStatus = () => {
    select.setAttribute("aria-label", L("Video quality", "视频清晰度"));
    const autoQuality = automatic ? quality : "1080";
    if (autoOption) autoOption.textContent = L(`Auto · ${autoQuality}p`, `自动 · ${autoQuality}p`);
    const label = quality + "p";
    status.textContent = phase === "loading" ? L(`Loading ${label}…`, `正在加载 ${label}…`)
      : phase === "rebuffering" ? L(`Buffering ${label}…`, `正在缓冲 ${label}…`)
      : phase === "error" ? L("Could not load. Try another quality.", "加载失败，请切换其他清晰度。")
      : phase === "blocked" ? L("Ready. Press play to continue.", "已就绪，点击播放继续。") : "";
  };
  const start = () => {
    if (!initialAutoplay || document.hidden) return;
    video.muted = true;
    video.play().catch((error) => {
      if (initialAutoplay && error.name !== "AbortError") {
        phase = "blocked";
        showStatus();
      }
    });
  };
  const observer = new IntersectionObserver((entries) => {
    if (entries.some((entry) => entry.isIntersecting)) start();
  }, { threshold: 0.1 });
  const stopInitialAutoplay = () => {
    initialAutoplay = false;
    observer.disconnect();
    video.removeEventListener("canplay", start);
    video.removeEventListener("playing", stopInitialAutoplay);
    document.removeEventListener("visibilitychange", start);
    if (phase === "loading" || phase === "blocked") { phase = ""; showStatus(); }
  };
  if (initialAutoplay) {
    video.defaultMuted = true;
    video.muted = true;
    video.addEventListener("playing", stopInitialAutoplay, { once: true });
    video.addEventListener("canplay", start);
    document.addEventListener("visibilitychange", start);
    observer.observe(video);
    start();
  }

  const switchQuality = () => {
    clearTimeout(stallTimer);
    const option = automatic && quality === "1080" ? autoOption
      : Array.from(select.options).find((item) => item.value === quality);
    const src = !failedCodecs.has("av1") && option?.dataset.av1 && video.canPlayType('video/mp4; codecs="av01.0.08M.08"')
      ? option.dataset.av1
      : !failedCodecs.has("hevc") && option?.dataset.hevc && video.canPlayType('video/mp4; codecs="hvc1"')
        ? option.dataset.hevc : option?.dataset.src;
    if (!src || (video.currentSrc || video.src) === new URL(src, document.baseURI).href) return;
    const saved = resume || {
      time: video.currentTime || 0,
      playing: initialAutoplay || !video.paused,
      rate: video.playbackRate
    };
    resume = saved;
    stopInitialAutoplay();
    change?.abort();
    const controller = new AbortController();
    change = controller;
    const options = { signal: controller.signal };
    let restored = false, complete = false;
    phase = "loading";
    showStatus();
    // Native autoplay must not restart a video the visitor has paused.
    video.autoplay = false;
    const restorePosition = () => {
      if (restored || video.readyState < 1) return;
      const end = Number.isFinite(video.duration) ? Math.max(0, video.duration - 0.05) : saved.time;
      const target = Math.min(saved.time, end);
      let seekable = target < 0.1;
      for (let i = 0; i < video.seekable.length; i++) {
        if (video.seekable.start(i) <= target && video.seekable.end(i) >= target) seekable = true;
      }
      if (!seekable) return;
      video.currentTime = target;
      // Some progressive responses expose metadata before they allow seeking.
      if (Math.abs(video.currentTime - target) > 0.1) return;
      restored = true;
      video.playbackRate = saved.rate;
      if (saved.playing) {
        video.play().catch((error) => {
          if (!controller.signal.aborted && error.name !== "AbortError") {
            phase = "blocked";
            showStatus();
          }
        });
      } else video.pause();
    };
    const ready = () => {
      if (complete) return;
      restorePosition();
      if (restored && video.readyState >= 3) {
        complete = true;
        resume = null;
        if (phase === "loading") phase = "";
        showStatus();
      }
    };
    ["loadedmetadata", "progress", "canplay", "seeked"].forEach((event) => video.addEventListener(event, ready, options));
    video.addEventListener("error", () => {
      phase = "error";
      showStatus();
    }, options);
    video.src = src;
    video.load();
  };
  select.addEventListener("change", () => {
    clearTimeout(stallTimer);
    automatic = select.value === "auto";
    quality = automatic ? "1080" : select.value;
    recentStalls = [];
    showStatus();
    switchQuality();
  });
  video.addEventListener("waiting", () => {
    // Only react to an interruption after playback has begun, not startup or a seek.
    if (video.paused || video.seeking || video.currentTime <= 0 || phase === "loading" || phase === "error") return;
    phase = "rebuffering";
    showStatus();
    clearTimeout(stallTimer);
    const now = performance.now();
    recentStalls = recentStalls.filter((time) => now - time < 10000);
    recentStalls.push(now);
    stallTimer = setTimeout(() => {
      if (!automatic || quality !== "1080" || video.paused || video.seeking || document.hidden || video.readyState >= 3) return;
      quality = "720";
      // Keep 720p for this playback to avoid oscillating between two large files.
      // Refreshing the page or choosing Auto again starts at 1080p.
      switchQuality();
    }, recentStalls.length >= 2 ? 0 : 1200);
  });
  video.addEventListener("playing", () => {
    clearTimeout(stallTimer);
    if (phase === "rebuffering") { phase = ""; showStatus(); }
  });
  const cancelStall = () => {
    clearTimeout(stallTimer);
    if (phase === "rebuffering") { phase = ""; showStatus(); }
  };
  video.addEventListener("pause", cancelStall);
  video.addEventListener("seeking", cancelStall);
  video.addEventListener("error", () => {
    const current = video.currentSrc || video.src;
    const codec = current.includes("_av1.mp4") ? "av1" : current.includes("_hevc.mp4") ? "hevc" : "";
    if (codec && !failedCodecs.has(codec)) {
      failedCodecs.add(codec);
      switchQuality();
    } else {
      stopInitialAutoplay();
      phase = "error";
      showStatus();
    }
  });
  addEventListener("langchange", showStatus);
  showStatus();
  tools.hidden = false;
}
