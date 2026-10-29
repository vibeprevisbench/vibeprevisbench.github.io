import { initPromo } from "./promo.js?v=20261102c";

// Keep the long film off the network while the fullscreen opening is visible.
const startPromo = () => {
  const video = document.getElementById("promo-video");
  if (video.dataset.poster) video.poster = video.dataset.poster;
  video.querySelectorAll("source[data-src]").forEach((source) => { source.src = source.dataset.src; });
  video.load();
  initPromo((en, zh) => document.documentElement.lang.startsWith("zh") ? zh : en);
};
if (document.documentElement.classList.contains("opening-active")) {
  document.addEventListener("openingfinished", startPromo, { once: true });
} else startPromo();
