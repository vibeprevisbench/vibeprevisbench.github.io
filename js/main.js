// VibePrevisBench site: renders the Dataset and Results sections from data/*.json (made by scripts/export_site_data.py).
import { LOGO_SYMBOLS } from "./logos.js?v=20261030i";
import { initCases } from "./cases.js?v=20261030i";
import { L, LANG, setLang, modName, modDesc, sceneName, sceneShort, subName, dimName, dimDesc, axisName, bucketName, low } from "./i18n.js?v=20261030i";
const d3 = window.d3;

const MOD = {
  text: { name: "Script", color: "#3987e5", desc: "A shot-by-shot screenplay: places, people, actions, cameras and cuts, in words." },
  image: { name: "Photos", color: "#d95926", desc: "Photos of a real place. Rebuild its layout at metric scale and stage the scene in it." },
  continuation: { name: "Continuation", color: "#199e70", desc: "A first frame and a description. Continue the shot with the right people, motion and camera." },
  video: { name: "Video", color: "#c98500", desc: "Real footage, up to 60 s, with several interacting people and many shots. Rebuild it as a 4D scene." },
};
const MODS = ["text", "image", "continuation", "video"];
const mn = (k) => modName(k, MOD[k].name);
const state = { lb: "chart", score: "all", split: "total", sub: "media", view: "scores", sort: { col: "total", dir: -1 }, scn: "home", scSub: null, scScore: "all", ax: "shots" };
const SCORE_Q = ["all", "rule", "vlm"];
const _q = new URLSearchParams(location.search);
if (_q.get("lb") === "table") state.lb = "table";
if (SCORE_Q.includes(_q.get("score"))) state.score = _q.get("score");
if (_q.get("view") === "rollout") state.view = "rollout";
if (["total", "text", "media"].includes(_q.get("split"))) state.split = _q.get("split");
if (["media", "video", "image", "continuation"].includes(_q.get("sub"))) state.sub = _q.get("sub");
let DS, RS;

// Start the muted promo without a click, retrying until its first playback.
const promoVideo = document.getElementById("promo-video");
if (promoVideo && promoVideo.paused) {
  let pending = true;
  const startPromo = () => {
    if (!pending || document.hidden) return;
    promoVideo.muted = true;
    promoVideo.play().catch(() => {});
  };
  const promoObserver = new IntersectionObserver((entries) => {
    if (entries.some((entry) => entry.isIntersecting)) startPromo();
  }, { threshold: 0.1 });
  promoVideo.defaultMuted = true;
  promoVideo.muted = true;
  promoVideo.addEventListener("playing", () => {
    pending = false;
    promoObserver.disconnect();
    promoVideo.removeEventListener("canplay", startPromo);
    document.removeEventListener("visibilitychange", startPromo);
  }, { once: true });
  promoVideo.addEventListener("canplay", startPromo, { once: true });
  document.addEventListener("visibilitychange", startPromo);
  promoObserver.observe(promoVideo);
  startPromo();
}

// ---------------------------------------------------------------- utils
const tip = document.getElementById("tip");
function showTip(ev, html) {
  tip.innerHTML = html;
  tip.style.opacity = 1;
  const r = tip.getBoundingClientRect();
  let x = ev.clientX + 14, y = ev.clientY + 14;
  if (x + r.width > innerWidth - 8) x = ev.clientX - r.width - 14;
  if (y + r.height > innerHeight - 8) y = ev.clientY - r.height - 14;
  tip.style.left = x + "px"; tip.style.top = y + "px";
}
const hideTip = () => (tip.style.opacity = 0);
const fmt1 = (v) => (v == null ? "–" : v.toFixed(1));

function frame(el, height, m = { t: 8, r: 16, b: 30, l: 40 }) {
  const node = document.getElementById(el);
  node.innerHTML = "";
  const w = Math.max(280, node.clientWidth);
  const svg = d3.select(node).append("svg").attr("width", w).attr("height", height).attr("viewBox", `0 0 ${w} ${height}`);
  return { svg, w, h: height, m, iw: w - m.l - m.r, ih: height - m.t - m.b, g: svg.append("g").attr("transform", `translate(${m.l},${m.t})`) };
}
// ---------------------------------------------------------------- hero + task cards
function hero() {
  const t = DS.totals;
  const stats = [
    [t.tasks, L("tasks", "道题")], [DS.modalities.length, L("input types", "种输入")], [(t.facts_scorable / 1000).toFixed(1) + "k", L("scorable facts", "条可评分事实")],
    [t.facts_per_video_median, L("facts per video", "每段视频的事实数"), 1], [t.median_dur_s + L(" s", " 秒"), L("length", "时长"), 1],
    [t.median_shots_video, L("shots per video", "每段视频的镜头数"), 1],
  ];
  document.getElementById("hero-stats").innerHTML = stats.map(([b, s, m]) => `<div class="stat"><b>${b}</b><span>${s}${m ? "<sup>*</sup>" : ""}</span></div>`).join("");
  document.getElementById("hero-note").textContent = L("* Median over tasks.", "* 各题的中位数。");
  // the four briefs an agent can get: icon, name, one line (counts live in the stats row and the leaderboard)
  const ICON = {
    text: '<path d="M7 3h7l4 4v14H7z"/><path d="M14 3v4h4M9.5 11h6M9.5 14h6M9.5 17h4"/>',
    image: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="M4 18l5-5 4 4 3-3 4 4"/>',
    continuation: '<rect x="3" y="6" width="9" height="12" rx="1.5"/><path d="M15 12h6M18 9l3 3-3 3"/>',
    video: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 9h18M3 15h18M7 5v4M12 5v4M17 5v4M7 15v4M12 15v4M17 15v4"/>',
  };
  document.getElementById("intro-mods").innerHTML = DS.modalities.map((m) =>
    `<div class="imod" style="--c:${MOD[m.key].color}"><svg viewBox="0 0 24 24" aria-hidden="true">${ICON[m.key]}</svg><div><span>${mn(m.key)}</span><small>${modDesc(m.key, MOD[m.key].desc)}</small></div></div>`).join("");
}

// ---------------------------------------------------------------- dataset
const CAT_NAME = { layout: "Layout", person_position: "Person position", posture: "Posture", camera: "Camera", person_relation: "Person relations",
  locomotion: "Locomotion", interaction: "Interactions", visibility: "Visibility", event: "Events", timing: "Timing / cuts",
  scene_consistency: "Scene consistency", entity: "Entities" };
// ---------------------------------------------------------------- results
// leaderboard: score type (combined / rule / VLM) x task split; Multimodal has its own sub-splits
// display names follow the language (getters re-read LANG every time)
const SCORE = { all: { get name() { return L("Overall", "总分"); } }, rule: { get name() { return L("Rule", "规则分"); } }, vlm: { get name() { return L("VLM", "VLM 分"); } } };
const SPLIT = { get total() { return L("All tasks", "全部任务"); }, get text() { return L("Text", "文本"); }, get media() { return L("Multimodal", "多模态"); } };
const SUB = { get media() { return L("All", "全部"); }, get video() { return L("Video", "视频"); }, get image() { return L("Photos", "照片"); }, get continuation() { return L("Continuation", "续写"); } };
const key = (split, score = state.score) => (score === "all" ? split : `${score}_${split}`);
const curSplit = () => (state.split === "media" ? state.sub : state.split);
const splitName = (k) => (k === "total" || k === "text" || k === "media" ? SPLIT[k] : `${SPLIT.media} · ${SUB[k]}`);
// Solid provider colors match Artificial Analysis Code2Video-AA.
// ByteDance uses its model-leaderboard color; dark-mode exceptions improve contrast.
const vname = (v) => (v === "Zai" ? "Z.ai" : v);
const vcol = (v) => `var(--vendor-${v.toLowerCase()}, var(--text-muted))`;
const effort = (r) => `<span class="eff">${r.effort}</span>` + (r.ver ? `<span class="eff ver" title="${L(`snapshot ${r.ver}`, `${r.ver} 版本`)}">${r.ver}</span>` : "");
const logoUse = (v, sz = 20) => `<svg viewBox="0 0 24 24" width="${sz}" height="${sz}" aria-hidden="true"><use href="#logo-${v}" width="24" height="24"/></svg>`;
let _intro = true;

const sortedBy = (k) => [...RS.models].sort((a, b) => b[k] - a[k]);
// competition ranking (ties share a rank); low = smaller is better
const rankOf = (k, low = false) => {
  const v = RS.models.map((r) => r[k]), m = new Map();
  RS.models.forEach((r) => m.set(r.id, 1 + v.filter((x) => (low ? x < r[k] - 1e-9 : x > r[k] + 1e-9)).length));
  return m;
};
// movement of a rank against the overall rank: up is better
const move = (now, ovr) => {
  const d = ovr - now;
  return d > 0 ? `<span class="mv up" title="${L(`${d} above its overall rank`, `比总榜名次高 ${d} 名`)}">▲${d}</span>` : d < 0 ? `<span class="mv dn" title="${L(`${-d} below its overall rank`, `比总榜名次低 ${-d} 名`)}">▼${-d}</span>` : `<span class="mv eq" title="${L("same as its overall rank", "与总榜名次相同")}">–</span>`;
};

function seg(id, opts, cur, on) {
  const el = document.getElementById(id);
  el.innerHTML = Object.entries(opts).map(([k, v]) => `<button type="button" data-k="${k}" class="${cur === k ? "on" : ""}">${v}</button>`).join("");
  el.querySelectorAll("button").forEach((b) => (b.onclick = () => { if (b.dataset.k !== cur) on(b.dataset.k); }));
}

function lbControls() {
  seg("lb-mode", { chart: L("Chart", "图表"), table: L("Table", "表格") }, state.lb, (k) => { state.lb = k; _intro = true; lbRender(); });
  seg("lb-score", Object.fromEntries(Object.entries(SCORE).map(([k, v]) => [k, v.name])), state.score, (k) => { state.score = k; _intro = true; lbRender(); });
  document.getElementById("lb-score-tip").textContent = state.score === "all" ? L("= ½ rule + ½ VLM", "= ½ 规则分 + ½ VLM 分") : "";
  document.getElementById("lb-chart-pane").hidden = state.lb !== "chart";
  document.getElementById("lb-table-pane").hidden = state.lb !== "table";
}

function lbRender() {
  lbControls();
  if (state.lb === "chart") { metricTabs(); bars(); } else leaderboard();
  costChart();
}

// quality vs. cost per task (log x): vendor logos as markers, the cost-efficient frontier, the attractive quadrant
function costChart() {
  const sp = curSplit(), K = key(sp), C = `cost_${sp}`;
  document.getElementById("cq-title").textContent = L(`${SCORE[state.score].name} score vs. cost per task`, `${SCORE[state.score].name}与每题费用`);
  document.getElementById("cq-note").textContent = L(`${splitName(sp)} · ${RS.n[sp]} tasks · cost on a log scale`, `${splitName(sp)} · ${RS.n[sp]} 题 · 费用为对数坐标`);
  const el = document.getElementById("cq-chart"), W = Math.max(320, el.clientWidth), narrow = W < 640;
  const H = narrow ? 420 : 480, m = { t: 22, r: narrow ? 18 : 40, b: 54, l: 56 };
  const pts = RS.models.map((r) => ({ r, x: r[C], y: r[K] }));
  const xs = d3.scaleLog([d3.min(pts, (p) => p.x) / 1.5, d3.max(pts, (p) => p.x) * 1.5], [m.l, W - m.r]);
  const lo = Math.floor((d3.min(pts, (p) => p.y) - 4) / 5) * 5, hi = Math.ceil((d3.max(pts, (p) => p.y) + 3) / 5) * 5;
  const ys = d3.scaleLinear([lo, hi], [H - m.b, m.t]);
  const mx = d3.median(pts, (p) => p.x), my = d3.median(pts, (p) => p.y);
  // frontier: sorted by cost, keep each point that beats every cheaper one
  const fr = []; [...pts].sort((a, b) => a.x - b.x).forEach((p) => { if (!fr.length || p.y > fr[fr.length - 1].y) fr.push(p); });
  const s = [`<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${L("Score against cost per task for each agent", "各智能体的分数与每题费用")}">`];
  s.push(`<rect x="${m.l}" y="${m.t}" width="${xs(mx) - m.l}" height="${ys(my) - m.t}" style="fill:var(--up);fill-opacity:.07"/>` +
    `<text x="${m.l + 8}" y="${m.t + 18}" font-size="${narrow ? 10.5 : 12}" font-weight="700" style="fill:var(--up)">${narrow ? L("Most attractive", "最具吸引力") : L("Most attractive: higher score, lower cost", "最具吸引力：分数更高、费用更低")}</text>`);
  const ticks = [0.5, 1, 2, 5, 10, 20, 50, 100].filter((t) => t >= xs.domain()[0] && t <= xs.domain()[1]);
  ticks.forEach((t) => s.push(`<line x1="${xs(t)}" x2="${xs(t)}" y1="${m.t}" y2="${H - m.b}" style="stroke:var(--grid)"/><text x="${xs(t)}" y="${H - m.b + 18}" text-anchor="middle" font-size="12" style="fill:var(--text-muted)">$${t}</text>`));
  ys.ticks(6).forEach((t) => s.push(`<line x1="${m.l}" x2="${W - m.r}" y1="${ys(t)}" y2="${ys(t)}" style="stroke:var(--grid)"/><text x="${m.l - 8}" y="${ys(t) + 4}" text-anchor="end" font-size="12" style="fill:var(--text-muted)">${t}</text>`));
  s.push(`<line x1="${xs(mx)}" x2="${xs(mx)}" y1="${m.t}" y2="${H - m.b}" style="stroke:var(--line-strong)" stroke-dasharray="3 4"/><line x1="${m.l}" x2="${W - m.r}" y1="${ys(my)}" y2="${ys(my)}" style="stroke:var(--line-strong)" stroke-dasharray="3 4"/>`);
  s.push(`<path d="${fr.map((p, i) => `${i ? "L" : "M"}${xs(p.x)},${ys(p.y)}`).join("")}" fill="none" style="stroke:var(--accent)" stroke-width="2" stroke-dasharray="6 5" opacity=".75"/>`);
  s.push(`<text x="${(m.l + W - m.r) / 2}" y="${H - 10}" text-anchor="middle" font-size="12.5" style="fill:var(--text-secondary)">${L("Cost per task (USD, log scale)", "每题费用（美元，对数坐标）")}</text>` +
    `<text transform="translate(16,${(m.t + H - m.b) / 2}) rotate(-90)" text-anchor="middle" font-size="12.5" style="fill:var(--text-secondary)">${SCORE[state.score].name}</text>`);
  // labels: right of the marker unless that box would cover another marker, then left; then nudge apart vertically
  const lab = pts.map((p) => ({ p, x: xs(p.x), y: ys(p.y), w: 7 * (p.r.name.length + p.r.effort.length + 3), side: 1 }));
  const hits = (l, side) => lab.some((o) => o !== l && Math.abs(o.y - l.y) < 22 &&
    (side > 0 ? o.x + 16 > l.x + 18 && o.x - 16 < l.x + 22 + l.w : o.x - 16 < l.x - 18 && o.x + 16 > l.x - 22 - l.w));
  lab.forEach((l) => { if (hits(l, 1) || l.x + 22 + l.w > W - 4) l.side = hits(l, -1) && l.x + 22 + l.w <= W - 4 ? 1 : -1; l.ly = l.y; });
  for (let it = 0; it < 30; it++) lab.forEach((a1, i) => lab.forEach((b1, j) => {
    if (i < j && a1.side === b1.side && Math.abs(a1.x - b1.x) < Math.max(a1.w, b1.w) + 24 && Math.abs(a1.ly - b1.ly) < 15) {
      const d = (15 - Math.abs(a1.ly - b1.ly)) / 2; if (a1.ly <= b1.ly) { a1.ly -= d; b1.ly += d; } else { a1.ly += d; b1.ly -= d; } }
  }));
  lab.forEach(({ p, x, y, ly, side }) => {
    const onF = fr.includes(p), ca = vcol(p.r.vendor);
    s.push(`<g class="cq-pt" data-i="${p.r.id}"><circle cx="${x}" cy="${y}" r="15" style="fill:var(--surface-1)" stroke="${ca}" stroke-width="${onF ? 2.4 : 1.4}"/>` +
      `<g transform="translate(${x - 9},${y - 9})" style="color:var(--text-primary)"><use href="#logo-${p.r.vendor}" width="18" height="18"/></g>` +
      (narrow ? "" : `<text x="${x + 20 * side}" y="${ly + 4}" text-anchor="${side > 0 ? "start" : "end"}" font-size="12" font-weight="${onF ? 700 : 500}" style="fill:var(--text-primary)">${p.r.name}<tspan font-weight="500" style="fill:var(--text-muted)"> (${p.r.effort})</tspan></text>`) + "</g>");
  });
  s.push("</svg>");
  const list = narrow ? `<div class="cq-list">${[...pts].sort((a, b) => b.y - a.y).map((p) => `<span>${logoUse(p.r.vendor, 15)}<i>${p.r.name} <small>(${p.r.effort})</small></i><b>${p.y.toFixed(1)}</b><em>$${p.x.toFixed(2)}</em></span>`).join("")}</div>` : "";
  el.innerHTML = s.join("") + list + `<div class="legend"><span><span class="swatch" style="background:var(--accent);height:2px;width:18px;border-radius:0"></span>${L("cost-efficient frontier: no cheaper agent scores higher", "性价比前沿：没有更便宜且分数更高的智能体")}</span><span><span class="swatch" style="background:var(--line-strong);height:2px;width:18px;border-radius:0"></span>${L("medians", "中位数")}</span></div>`;
  el.querySelectorAll(".cq-pt").forEach((n) => {
    const r = RS.models.find((x) => x.id === n.dataset.i);
    n.onmousemove = (ev) => showTip(ev, `<b>${r.name}</b> (${r.effort})<br>${SCORE[state.score].name} ${r[K].toFixed(1)} · ${L("cost", "费用")} $${r[C].toFixed(2)} ${L("per task", "/ 题")}`);
    n.onmouseleave = hideTip;
  });
}

function metricTabs() {
  const card = (k) => {
    const kk = key(k), t = sortedBy(kk)[0];
    return `<button type="button" class="mtab" data-k="${k}" aria-pressed="${k === state.split}"><div class="k">${SPLIT[k]}<small>${L(`${RS.n[k]} tasks · best`, `${RS.n[k]} 题 · 最高`)}</small></div>` +
      `<div class="big">${t[kk].toFixed(2)}</div><div class="who">${t.name} <span style="color:var(--text-muted)">(${t.effort})</span></div></button>`;
  };
  document.getElementById("mtabs").innerHTML = `<div class="mtabs">${Object.keys(SPLIT).map(card).join("")}</div>` +
    (state.split === "media" ? `<div class="msub"><span class="note">${L("Multimodal split", "多模态细分")}</span><div class="seg" id="lb-sub"></div></div>` : "");
  if (state.split === "media")
    seg("lb-sub", Object.fromEntries(Object.entries(SUB).map(([k, v]) => [k, `${v} <small>${RS.n[k]}</small>`])), state.sub, (k) => { state.sub = k; _intro = true; metricTabs(); bars(); costChart(); });
  document.querySelectorAll("#mtabs .mtab").forEach((b) => (b.onclick = () => {
    if (state.split === b.dataset.k) return;
    state.split = b.dataset.k; _intro = true; metricTabs(); bars(); costChart();
  }));
}

function bars() {
  const K = key(curSplit()), rows = sortedBy(K), n = rows.length, LBL = `${SCORE[state.score].name} · ${splitName(curSplit())}`;
  const OK = key("total"), ovr = rankOf(OK), cur = rankOf(K), showMv = K !== OK;
  const box = document.querySelector(".lb-chart").clientWidth - 20;
  const LM = 70, R = 12, T = 76, plotH = 320, labelH = 140;
  const pitch = Math.max(66, Math.min(100, (box - LM - R) / n));
  const W = Math.round(LM + R + pitch * n), H = T + plotH + labelH, barW = Math.min(40, pitch * 0.50);
  const max = d3.max(rows, (r) => r[K]), min = d3.min(rows, (r) => r[K]);
  const yMax = Math.ceil((max + 3) / 5) * 5, yMin = Math.max(0, Math.floor((min - 6) / 10) * 10);
  const step = yMax - yMin <= 40 ? 5 : 10;
  const y = (v) => T + plotH - ((v - yMin) / (yMax - yMin)) * plotH, base = T + plotH;
  const s = [`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" class="${_intro ? "intro" : ""}" role="group" aria-label="${L(`${LBL} score per agent, sorted high to low`, `${LBL}：各智能体得分，从高到低`)}">`];
  for (let t = yMin; t <= yMax; t += step)
    s.push(`<line class="${t === yMin ? "chart-baseline" : "chart-grid"}" x1="${LM}" x2="${W - R}" y1="${y(t)}" y2="${y(t)}" style="stroke:var(${t === yMin ? "--line-strong" : "--grid"})"/><text x="${LM - 10}" y="${y(t) + 4}" text-anchor="end" font-size="12" style="fill:var(--text-muted)">${t}</text>`);
  rows.forEach((r, i) => {
    const ca = vcol(r.vendor), cx = LM + pitch * i + pitch / 2, top = y(r[K]), x0 = cx - barW / 2, rad = Math.min(5, (base - top) / 2);
    const path = `M${x0},${base}V${top + rad}Q${x0},${top} ${x0 + rad},${top}H${x0 + barW - rad}Q${x0 + barW},${top} ${x0 + barW},${top + rad}V${base}Z`;
    s.push(`<g class="bar-col" tabindex="0" role="img" aria-label="#${i + 1} ${r.name} (${r.effort}) ${LBL} ${r[K].toFixed(2)}" data-i="${r.id}">` +
      `<rect class="hit" x="${cx - pitch / 2 + 3}" y="${top - 74}" width="${pitch - 6}" height="${base - top + 74 + 20}" rx="8"/>` +
      `<path class="bar-body" d="${path}" fill="${ca}"/>` +
      `<g><text x="${cx}" y="${top - 10}" text-anchor="middle" font-size="13" font-weight="600" style="fill:var(--text-primary);font-variant-numeric:tabular-nums" font-family="Poppins, system-ui">${r[K].toFixed(1)}</text>` +
      (showMv ? (() => { const d = ovr.get(r.id) - cur.get(r.id); const col = d > 0 ? "var(--up)" : d < 0 ? "var(--dn)" : "var(--text-secondary)";
        return `<g transform="translate(${cx},${top + 17})"><rect x="-17" y="-10" width="34" height="19" rx="6" style="fill:var(--pill)"/><text y="4" text-anchor="middle" font-size="11.5" font-weight="800" style="fill:${col}">${d > 0 ? "▲" + d : d < 0 ? "▼" + -d : "–"}</text></g>`; })() : "") +
      `<g class="provider-badge" transform="translate(${cx},${top - 43})" style="color:var(--text-primary)"><circle r="16" style="fill:var(--surface-1);stroke:var(--line)"/><use href="#logo-${r.vendor}" x="-9" y="-9" width="18" height="18"/></g></g>` +
      `<text transform="translate(${cx + 4},${base + 16}) rotate(-42)" text-anchor="end" font-size="12" style="fill:var(--text-secondary)">${r.name}<tspan style="fill:var(--text-muted)"> (${r.effort})</tspan></text></g>`);
  });
  s.push("</svg>");
  const el = document.getElementById("bar-chart");
  el.innerHTML = s.join("");
  _intro = false;
  el.querySelectorAll(".bar-col").forEach((g) => {
    const r = RS.models.find((m) => m.id === g.dataset.i);
    const sp = curSplit();
    const html = () => `<b>${r.name}</b> (${r.effort}) · ${vname(r.vendor)}<br>${splitName(sp)}: ${r[sp].toFixed(2)} = ½ ${L("rule", "规则")} ${r[`rule_${sp}`].toFixed(2)} + ½ VLM ${r[`vlm_${sp}`].toFixed(2)}`;
    g.onmousemove = (ev) => showTip(ev, html());
    g.onmouseleave = hideTip;
    g.onfocus = () => { const b = g.getBoundingClientRect(); showTip({ clientX: b.left + b.width / 2, clientY: b.top }, html()); };
    g.onblur = hideTip;
  });
}

// table views: score columns and rollout resources
// table columns: c = column id, s = split (score follows state.score), or a fixed data key k; g = header group
function tableCols() {
  if (state.view === "rollout") {
    const sp = curSplit(), fx = (m) => `${m}_${sp}`;
    return [
      { c: "total", s: sp, l: SCORE[state.score].name, bar: 1 }, { c: "avg_rounds", k: fx("avg_rounds"), l: L("Turns", "轮数"), low: 1, f: (v) => v.toFixed(1) },
      { c: "avg_tool_calls", k: fx("avg_tool_calls"), l: L("Tool calls", "工具调用"), low: 1, f: (v) => v.toFixed(1) }, { c: "avg_in_tok", k: fx("avg_in_tok"), l: L("Input tokens", "输入 token"), low: 1, f: (v) => (v / 1e6).toFixed(1) + "M" },
      { c: "avg_out_tok", k: fx("avg_out_tok"), l: L("Output tokens", "输出 token"), low: 1, f: (v) => (v / 1e3).toFixed(0) + "k" },
      { c: "cost", k: fx("cost"), l: L("Cost / task", "每题费用"), low: 1, f: (v) => "$" + (v < 10 ? v.toFixed(2) : v.toFixed(1)) },
      { c: "fails", k: fx("fails"), l: L("Failed", "失败"), low: 1, int: 1 },
    ];
  }
  const ov = state.score === "all"
    ? [{ c: "total", s: "total", l: L("Score", "总分"), g: SCORE.all.name, bar: 1 }, { c: "rule", k: "rule_total", l: SCORE.rule.name, g: SCORE.all.name, n: "total" }, { c: "vlm", k: "vlm_total", l: SCORE.vlm.name, g: SCORE.all.name, n: "total" }]
    : [{ c: "total", s: "total", l: SCORE.all.name, bar: 1 }];
  return [...ov, { c: "text", s: "text", l: SPLIT.text },
    ...Object.keys(SUB).map((k) => ({ c: k, s: k, l: SUB[k], g: SPLIT.media })), { c: "fails", k: "fails", l: L("Failed", "失败"), low: 1, int: 1 }];
}
const colKey = (c) => c.k || key(c.s);
const HOWTO = () => [
  L(`Overall = ½ rule score + ½ VLM score (both 0–100), averaged over all ${RS.n.total} tasks; every task weighs the same and a run that delivers no valid scene counts 0 on both. Switch the score to Rule or VLM to see either half alone; Text and Multimodal follow the same switch.`,
    `总分 = ½ 规则分 + ½ VLM 分（均为 0–100），对全部 ${RS.n.total} 道题取平均；每道题权重相同，没有交付有效场景的运行两项都记 0。把分数切换到规则分或 VLM 分可以单独查看其中一半；文本和多模态也随之切换。`),
  L("Rule score: the deterministic scorer reads the delivered .blend and checks every fact of the ground truth (entities, layout, spaces, picture structure, routes, events, camera, cuts, physical validity).",
    "规则分：确定性的评分器读取交付的 .blend 文件，逐条检查真值中的每一条事实（实体、布局、场地、画面结构、走位、事件、机位、剪辑、物理合理性）。"),
  L("VLM score: a Gemini 4 judge watches the rendered proxy at 2 fps and checks whether the shapes and places, the actions, the key moments and the story can be seen.",
    "VLM 分：Gemini 4 裁判以每秒 2 帧观看渲染出的预演视频，检查形体与场所、动作、关键时刻和叙事能否在画面中看出来。"),
  L(`Text: the ${RS.n.text} script tasks. Multimodal: the ${RS.n.media} tasks with visual input (All), made of Video (${RS.n.video} real clips to rebuild), Photos (${RS.n.image} places to rebuild from photos) and Continuation (${RS.n.continuation} first frames to continue).`,
    `文本：${RS.n.text} 道剧本题。多模态：${RS.n.media} 道带视觉输入的题（全部），包括视频（${RS.n.video} 段待重建的真实视频）、照片（${RS.n.image} 个需按照片重建的地点）和续写（${RS.n.continuation} 个待续写的首帧）。`),
  L("Failed: tasks where the agent delivered no valid scene (scored 0).", "失败：智能体没有交付有效场景的题目（记 0 分）。"),
  L("Rollout resources are means per task over the tasks picked under Tasks (all, text, or a multimodal split): model requests (turns), tool calls, input tokens (including cache hits), output tokens and API cost; Overall and Failed follow the same tasks. Wall-clock time is not reported: it is dominated by API requests whose latency and retries differ by provider channel.",
    "运行资源是在所选任务（全部、文本或某个多模态细分）上的每题平均值：模型请求次数（轮数）、工具调用次数、输入 token（含缓存命中）、输出 token 和 API 费用；总分和失败数按同样的任务统计。不报告耗时：耗时主要由 API 请求决定，而各厂商接入通道的时延和重试差别很大。"),
  L("Effort in brackets is the reasoning setting that was actually applied for the agent. GPT agents run in Codex CLI, all others in Claude Code.",
    "括号里是该智能体实际使用的推理强度。GPT 系列在 Codex CLI 中运行，其余都在 Claude Code 中运行。"),
  L("DeepSeek V4.1 Flash is the 1017 snapshot (deepseek-v4-1-flash-261017).", "DeepSeek V4.1 Flash 使用的是 1017 版本（deepseek-v4-1-flash-261017）。"),
];

function leaderboard() {
  seg("lb-view", { scores: L("Scores", "分数"), rollout: L("Rollout resources", "运行资源") }, state.view, (k) => { state.view = k; leaderboard(); });
  taskPicker();
  const cols = tableCols();
  if (!cols.some((c) => c.c === state.sort.col)) state.sort = { col: "total", dir: -1 };
  const { col, dir } = state.sort, sc = cols.find((c) => c.c === col), sk = sc ? colKey(sc) : null;
  const ok = colKey(cols[0]);  // the overall column (its task split follows the rollout picker)
  const ovr = rankOf(ok), ranks = Object.fromEntries(cols.map((c) => [c.c, rankOf(colKey(c), c.low)]));
  // the # column ranks by the sorted column (1 = best in that metric, whatever the sort direction)
  const byCol = sc && col !== "fails" ? ranks[col] : ovr, moved = sc && col !== cols[0].c && col !== "fails";
  const rows = [...RS.models].sort((a, b) => (col === "name" ? dir * a.name.localeCompare(b.name) : dir * (a[sk] - b[sk])) || b[ok] - a[ok]);
  const best = {};
  cols.forEach((c) => (best[c.c] = (c.low ? d3.min : d3.max)(RS.models, (r) => r[colKey(c)])));
  const arrow = (c) => (col === c ? (dir < 0 ? " ↓" : " ↑") : "");
  const leaf = (c, rs) => `<th data-c="${c.c}"${rs ? ' rowspan="2"' : ""} class="${col === c.c ? "sorted " : ""}${c.g ? "in-g " : ""}${c.first ? "g0 " : ""}">${c.l}${arrow(c.c)}${c.int || c.f ? "" : `<span class="n">${L(`${RS.n[c.n || c.s]} tasks`, `${RS.n[c.n || c.s]} 题`)}</span>`}</th>`;
  const two = cols.some((c) => c.g);
  let h1 = `<th class="rank"${two ? ' rowspan="2"' : ""}>#</th><th data-c="name" class="l${col === "name" ? " sorted" : ""}"${two ? ' rowspan="2"' : ""}>${L("Agent", "智能体")}${arrow("name")}</th>${state.view === "rollout" ? "" : `<th class="l"${two ? ' rowspan="2"' : ""}>${L("Harness", "运行框架")}</th>`}`, h2 = "";
  cols.forEach((c, i) => {
    if (!c.g) { h1 += leaf(c, two); return; }
    if (cols[i - 1]?.g !== c.g) { c.first = 1; h1 += `<th class="grp" colspan="${cols.filter((x) => x.g === c.g).length}">${c.g}</th>`; }
    h2 += leaf(c);
  });
  let html = `<thead><tr>${h1}</tr>${two ? `<tr>${h2}</tr>` : ""}</thead><tbody>`;
  const medal = ["#facc15", "#cbd5e1", "#f59e0b"];
  rows.forEach((r) => {
    const rk = byCol.get(r.id);
    html += `<tr data-name="${r.name.toLowerCase()} ${vname(r.vendor).toLowerCase()}"><td class="rank"><span class="rk-wrap">${rk <= 3 ? `<span class="medal" style="background:${medal[rk - 1]}">${rk}</span>` : `<span class="rk-n">${rk}</span>`}${moved ? move(rk, ovr.get(r.id)) : ""}</span></td>` +
      `<td class="l"><span class="agent">${logoUse(r.vendor)}<span>${r.name}${effort(r)}</span></span></td>${state.view === "rollout" ? "" : `<td class="l note">${r.harness}</td>`}`;
    cols.forEach((c) => {
      const v = r[colKey(c)], txt = c.f ? c.f(v) : c.int ? String(v) : v.toFixed(2);
      const isBest = Math.abs(v - best[c.c]) < 1e-9 && c.c !== "fails";
      const bar = c.bar ? `<span class="bar" style="width:${(v * 1.1).toFixed(0)}px;background:${vcol(r.vendor)}"></span>` : "";
      const cr = c.c === "fails" ? "" : (() => { const k = ranks[c.c].get(r.id); return `<sup class="crk${k <= 3 ? " t" + k : ""}">#${k}</sup>`; })();
      html += `<td class="${c.bar ? "ov " : ""}${c.g ? "in-g " : ""}${c.first ? "g0 " : ""}${isBest ? "best " : ""}${col === c.c ? "sorted" : ""}">${bar}${c.c === "fails" && v === 0 ? '<span class="note">0</span>' : txt}${cr}</td>`;
    });
    html += "</tr>";
  });
  document.getElementById("lb").innerHTML = html + "</tbody>";
  document.getElementById("lb-hint").innerHTML = col === "name" || !sc || col === cols[0].c
    ? L("Click any column to rank the agents by it. #k in each cell is the agent's rank in that column.", "点击任意一列即可按该列排名；每格右上角的 #k 是该智能体在这一列的名次。")
    : L(`Ranked by <b>${sc.g ? sc.g + " · " : ""}${sc.l}</b>${sc.low ? " (lower is better)" : ""}. ▲ / ▼ = places gained or lost against the overall rank.`,
        `按 <b>${sc.g ? sc.g + " · " : ""}${sc.l}</b> 排名${sc.low ? "（越低越好）" : ""}。▲ / ▼ 表示相对总榜名次上升或下降的位数。`);
  document.querySelectorAll("#lb thead th[data-c]").forEach((t) => (t.onclick = () => {
    const c = t.dataset.c, low = cols.find((x) => x.c === c)?.low;
    state.sort = { col: c, dir: state.sort.col === c ? -state.sort.dir : c === "name" || low ? 1 : -1 };
    leaderboard();
  }));
  search();
}

// rollout view: which tasks the means run over (shared with the chart's split cards)
function taskPicker() {
  const el = document.getElementById("lb-task");
  el.hidden = state.view !== "rollout";
  if (el.hidden) return;
  el.innerHTML = `<span class="note">${L("Tasks", "任务")}</span><div class="seg" id="lb-tsplit"></div>` + (state.split === "media" ? `<div class="seg" id="lb-tsub"></div>` : "");
  seg("lb-tsplit", Object.fromEntries(Object.entries(SPLIT).map(([k, v]) => [k, `${v} <small>${RS.n[k]}</small>`])), state.split, (k) => { state.split = k; leaderboard(); costChart(); });
  if (state.split === "media")
    seg("lb-tsub", Object.fromEntries(Object.entries(SUB).map(([k, v]) => [k, `${v} <small>${RS.n[k]}</small>`])), state.sub, (k) => { state.sub = k; leaderboard(); costChart(); });
}

function search() {
  const q = document.getElementById("lb-search").value.trim().toLowerCase();
  document.querySelectorAll("#lb tbody tr").forEach((tr) => tr.classList.toggle("hide", !!q && !tr.dataset.name.includes(q)));
}

// ---------------------------------------------------------------- scenes: scores by scene type
const scKey = (g, score = state.scScore) => (score === "all" ? `sc_${g}` : `${score}_sc_${g}`);
const ssKey = (g, score = state.scScore) => (score === "all" ? `ss_${g}` : `${score}_ss_${g}`);
const axKey = (a, b, score = state.scScore) => (score === "all" ? `ax_${a}_${b}` : `${score}_ax_${a}_${b}`);
const SUB_MIN = 5;  // sub-types with fewer tasks are listed but not ranked
const ovKey = (score = state.scScore) => key("total", score);
const SC_SHORT_EN = { home: "Homes", public: "Offices & public", retail: "Shops & food", sport: "Sports", transit: "Industry & transit", street: "Streets", nature: "Nature & snow" };
const SC_SHORT = new Proxy(SC_SHORT_EN, { get: (o, k) => (k in o ? sceneShort(k, o[k]) : undefined) });
const scName = (g) => sceneName(g.key, g.name), sbName = (x) => subName(x.key, x.name);
const DIMNAME = () => Object.fromEntries(RS.dims.map((d) => [d.key, dimName(d.key, d.name)]));

function sceneScores() {
  const G = RS.scenes, g = G.find((x) => x.key === state.scn);
  seg("sc-pick", Object.fromEntries(G.map((x) => [x.key, `${SC_SHORT[x.key] || scName(x)} <small>${x.n}</small>`])), state.scn, (k) => { state.scn = k; state.scSub = null; sceneScores(); });
  const subs = RS.scene_subs.filter((x) => x.group === g.key).sort((a, b) => b.n - a.n);
  const sb = document.getElementById("sc-subbar");
  sb.innerHTML = `<span class="note">${L("Sub-type", "小类")}</span><div class="seg" id="sc-sub"></div>`;
  seg("sc-sub", { "": L(`All ${SC_SHORT[g.key] || scName(g)}`, `全部${SC_SHORT[g.key] || scName(g)}`), ...Object.fromEntries(subs.map((x) => [x.key, `${sbName(x)} <small>${x.n}</small>`])) }, state.scSub || "", (k) => { state.scSub = k || null; sceneScores(); });
  sb.querySelectorAll("#sc-sub button").forEach((b) => {
    const x = subs.find((y) => y.key === b.dataset.k);
    if (x && x.n < SUB_MIN) { b.disabled = true; b.classList.add("off"); b.title = L(`only ${x.n} tasks: listed, not ranked`, `只有 ${x.n} 题：列出但不排名`); }
  });
  seg("sc-score", Object.fromEntries(Object.entries(SCORE).map(([k, v]) => [k, v.name])), state.scScore, (k) => { state.scScore = k; sceneScores(); });
  scInfo(g); scBars(g); axes(); scNotes();
}

function scInfo(g) {
  const G = RS.scenes, DN = DIMNAME();
  // input mix of this scene
  const mix = MODS.filter((m) => g.by_task[m]).map((m) => [m, g.by_task[m].n]);
  const bar = mix.map(([m, n]) => `<span style="flex:${n};background:${MOD[m].color}" title="${mn(m)} ${n}"></span>`).join("");
  const leg = mix.map(([m, n]) => `<span><i style="background:${MOD[m].color}"></i>${mn(m)} ${n}</span>`).join("");
  // rule score per input here vs. the same input across all scenes (mean over their tasks)
  const allBy = (m, f) => { const xs = G.filter((x) => x.by_task[m]); return d3.sum(xs, (x) => x.by_task[m][f] * x.by_task[m].n) / d3.sum(xs, (x) => x.by_task[m].n); };
  const f = state.scScore === "vlm" ? "vlm" : "rule";
  const rows = mix.filter(([, n]) => n >= 3).map(([m]) => {
    const v = g.by_task[m][f], ref = allBy(m, f), d = v - ref;
    return `<tr><td><i style="background:${MOD[m].color}"></i>${mn(m)}</td><td>${v.toFixed(1)}</td><td class="${d >= 0 ? "up" : "dn"}">${d >= 0 ? "+" : ""}${d.toFixed(1)}</td></tr>`;
  }).join("");
  const dims = Object.entries(g.dims).filter(([, v]) => v != null).sort((a, b) => a[1] - b[1]);
  const chip = ([k, v]) => `<span class="dchip"><b>${k}</b> ${DN[k]} <em>${Math.round(v)}</em></span>`;
  document.getElementById("sc-info").innerHTML = `<h3>${scName(g)}</h3><div class="note">${L(`${g.n} tasks · mean over ${RS.models.length} agents: rule ${g.rule.toFixed(1)} · VLM ${g.vlm.toFixed(1)}`, `${g.n} 题 · ${RS.models.length} 个智能体的平均：规则分 ${g.rule.toFixed(1)} · VLM 分 ${g.vlm.toFixed(1)}`)}</div>` +
    `<div class="mixbar">${bar}</div><div class="mixleg">${leg}</div>` +
    (rows ? `<table class="sc-by"><thead><tr><th>${L(`${f === "vlm" ? "VLM" : "Rule"} score by input`, `按输入的${f === "vlm" ? " VLM 分" : "规则分"}`)}</th><th>${L("here", "本类")}</th><th>${L("vs. all scenes", "对比全部场景")}</th></tr></thead><tbody>${rows}</tbody></table>` : "") +
    scSubTable(g) +
    `<div class="dims-row"><span class="note">${L("Weakest", "最弱")}</span>${dims.slice(0, 2).map(chip).join("")}</div><div class="dims-row"><span class="note">${L("Strongest", "最强")}</span>${dims.slice(-1).map(chip).join("")}</div>`;
}

function scSubTable(g) {
  const subs = RS.scene_subs.filter((x) => x.group === g.key).sort((a, b) => b.n - a.n);
  const tr = subs.map((x) => {
    const k = ssKey(x.key), mean = d3.mean(RS.models, (r) => r[k]), top = sortedBy(k)[0], small = x.n < SUB_MIN;
    return `<tr class="${small ? "off" : ""}${state.scSub === x.key ? " on" : ""}"><td>${sbName(x)}</td><td>${x.n}</td><td>${mean.toFixed(1)}</td><td>${small ? "–" : top.name}</td></tr>`;
  }).join("");
  return `<table class="sc-by sc-subs"><thead><tr><th>${L("Sub-type", "小类")}</th><th>${L("tasks", "题数")}</th><th>${L("mean", "平均")}</th><th>${L("best", "最佳")}</th></tr></thead><tbody>${tr}</tbody></table>`;
}

function scBars(g) {
  const sub = state.scSub && RS.scene_subs.find((x) => x.key === state.scSub);
  const K = sub ? ssKey(sub.key) : scKey(g.key), O = ovKey(), rows = sortedBy(K), nT = sub ? sub.n : g.n, nm = sub ? sbName(sub) : scName(g);
  // rows stretch so the ranking card is as tall as the info card beside it (side-by-side layout only)
  const info = document.getElementById("sc-info"), side = info.getBoundingClientRect().top === document.querySelector(".sc-rank").getBoundingClientRect().top;
  const W = document.getElementById("sc-bars").clientWidth || 600, narrow = W < 520,
    rowH = side ? Math.max(34, Math.min(48, Math.floor((info.offsetHeight - 70) / RS.models.length))) : 34, LM = narrow ? 150 : 190, R = narrow ? 58 : 110, T = 8;
  const H = T + rows.length * rowH + 6, x0 = LM, max = Math.min(100, Math.ceil((d3.max(rows, (r) => r[K]) + 4) / 5) * 5), xw = W - LM - R - 44;
  const lo = Math.max(0, Math.floor((d3.min(rows, (r) => r[K]) - 8) / 10) * 10);
  const x = (v) => x0 + ((v - lo) / (max - lo)) * xw;
  const s = [`<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${nm}: ${SCORE[state.scScore].name}">`];
  rows.forEach((r, i) => {
    const y = T + i * rowH, v = r[K], d = v - r[O], bw = Math.max(4, x(v) - x0);
    s.push(`<g class="sc-row" data-i="${r.id}"><rect x="0" y="${y}" width="${W}" height="${rowH}" fill="transparent"/>` +
      `<g transform="translate(14,${y + rowH / 2 - 9})" style="color:var(--text-primary)"><use href="#logo-${r.vendor}" width="18" height="18"/></g>` +
      `<text x="40" y="${y + rowH / 2 + 4}" font-size="13" style="fill:var(--text-primary)">${i + 1}. ${r.name}</text>` +
      `<rect class="sc-bar-body grow-x" style="animation-delay:${i * 40}ms" x="${x0}" y="${y + rowH / 2 - 9}" width="${bw}" height="18" rx="2" fill="${vcol(r.vendor)}"/>` +
      `<text x="${x0 + bw + 8}" y="${y + rowH / 2 + 4}" font-size="13" font-weight="700" style="fill:var(--text-primary)">${v.toFixed(1)}</text>` +
      `<text x="${W - 8}" y="${y + rowH / 2 + 4}" text-anchor="end" font-size="12" font-weight="600" style="fill:var(${d >= 0 ? "--up" : "--dn"})">${d >= 0 ? "▲ +" : "▼ "}${d.toFixed(1)}</text></g>`);
  });
  s.push(`<text x="${W - 8}" y="${H}" text-anchor="end" font-size="10.5" style="fill:var(--text-muted)"></text></svg>`);
  const el = document.getElementById("sc-bars");
  el.innerHTML = `<div class="sc-rank-head"><span>${L(`${SCORE[state.scScore].name} score on ${nT} ${nm.toLowerCase()} tasks`, `${nT} 道${nm}题上的${SCORE[state.scScore].name}`)}</span><span>${L("vs. own average", "对比自身平均")}</span></div>` + s.join("");
  el.querySelectorAll(".sc-row").forEach((n) => {
    const r = RS.models.find((m) => m.id === n.dataset.i);
    const [p0, kk] = sub ? ["ss", sub.key] : ["sc", g.key];
    n.onmousemove = (ev) => showTip(ev, `<b>${r.name}</b> (${r.effort}) · ${nm}<br>${SCORE.all.name} ${r[`${p0}_${kk}`].toFixed(1)} = ½ ${L("rule", "规则")} ${r[`rule_${p0}_${kk}`].toFixed(1)} + ½ VLM ${r[`vlm_${p0}_${kk}`].toFixed(1)}<br><span class="t">${L("own average", "自身平均")}: ${r[O].toFixed(1)}</span>`);
    n.onmouseleave = hideTip;
  });
}

// real clips split by people, places, shots, length or setting: three buckets per axis, one row of dots per agent
const AXCOL = { ordinal: ["#bcd3ff", "#6f9bff", "#2f5fe0"], cat: ["#d95926", "#199e70", "#a78bfa"] };
function axes() {
  const A = RS.video_axes, a = A.find((x) => x.key === state.ax), B = a.buckets, cols = a.ordinal ? AXCOL.ordinal : AXCOL.cat;
  const an = (x) => axisName(x.key, x.name);
  seg("ax-pick", Object.fromEntries(A.map((x) => [x.key, an(x)])), state.ax, (k) => { state.ax = k; axes(); });
  const f = state.scScore === "vlm" ? "vlm" : "rule";
  document.getElementById("ax-cap").textContent = L(`The ${d3.sum(B, (b) => b.n)} video tasks split by ${a.name.toLowerCase()} in the ground truth. ${SCORE[state.scScore].name} score; ` +
    (a.ordinal ? "agents sorted by how much they drop from the first to the last bucket." : "agents sorted by their spread across settings."),
    `${d3.sum(B, (b) => b.n)} 道视频题按真值中的${an(a)}分档。${SCORE[state.scScore].name}；` + (a.ordinal ? "智能体按从第一档到最后一档的掉分幅度排序。" : "智能体按不同场景之间的分差排序。"));
  document.getElementById("ax-sum").innerHTML = B.map((b, i) => {
    const mean = d3.mean(RS.models, (r) => r[axKey(a.key, b.key)]);
    return `<div class="axb" style="--c:${cols[i]}"><span class="lab">${an(a)} ${bucketName(b.label)}</span><b>${mean.toFixed(1)}</b><span class="note">${L(`${b.n} tasks · rule ${b.rule.toFixed(1)} · VLM ${b.vlm.toFixed(1)}`, `${b.n} 题 · 规则分 ${b.rule.toFixed(1)} · VLM 分 ${b.vlm.toFixed(1)}`)}</span></div>`;
  }).join("");
  const val = (r, i) => r[axKey(a.key, B[i].key)];
  const drop = (r) => (a.ordinal ? val(r, 0) - val(r, B.length - 1) : d3.max(B, (_, i) => val(r, i)) - d3.min(B, (_, i) => val(r, i)));
  const rows = [...RS.models].sort((p, q) => drop(q) - drop(p));
  const el = document.getElementById("ax-dots"), W = el.clientWidth || 640, LM = W < 520 ? 146 : 160, R = W < 520 ? 40 : 70, T = 24, rowH = 26, H = T + rows.length * rowH + 22;
  const lo = Math.floor((d3.min(rows, (r) => d3.min(B, (_, i) => val(r, i))) - 3) / 5) * 5, hi = Math.ceil((d3.max(rows, (r) => d3.max(B, (_, i) => val(r, i))) + 3) / 5) * 5;
  const x = d3.scaleLinear([lo, hi], [LM, W - R]);
  const s = [`<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${an(a)}">`];
  x.ticks(6).forEach((t) => s.push(`<line x1="${x(t)}" x2="${x(t)}" y1="${T - 6}" y2="${H - 18}" style="stroke:var(--grid)"/><text x="${x(t)}" y="${H - 4}" text-anchor="middle" font-size="11" style="fill:var(--text-muted)">${t}</text>`));
  s.push(`<text x="${W - 6}" y="12" text-anchor="end" font-size="11" style="fill:var(--text-muted)">${a.ordinal ? L("drop", "掉分") : L("spread", "分差")}</text>`);
  rows.forEach((r, k) => {
    const y = T + k * rowH + rowH / 2, vs = B.map((_, i) => val(r, i)), d = drop(r);
    s.push(`<g class="ax-row" data-i="${r.id}"><rect x="0" y="${y - rowH / 2}" width="${W}" height="${rowH}" fill="transparent"/>` +
      `<text x="${LM - 10}" y="${y + 4}" text-anchor="end" font-size="${W < 520 ? 11 : 12.5}" style="fill:var(--text-primary)">${r.name}</text>` +
      `<line x1="${x(d3.min(vs))}" x2="${x(d3.max(vs))}" y1="${y}" y2="${y}" style="stroke:var(--line-strong)" stroke-width="3" stroke-linecap="round"/>` +
      vs.map((v, i) => `<circle cx="${x(v)}" cy="${y}" r="6" fill="${cols[i]}" stroke="var(--surface-1)" stroke-width="2"/>`).join("") +
      `<text x="${W - 6}" y="${y + 4}" text-anchor="end" font-size="12" font-weight="600" style="fill:var(${a.ordinal ? (d > 0 ? "--dn" : "--up") : "--text-secondary"})">${a.ordinal ? (d > 0 ? "−" : "+") + Math.abs(d).toFixed(1) : d.toFixed(1)}</text></g>`);
  });
  s.push("</svg>");
  el.innerHTML = s.join("") + `<div class="legend">${B.map((b, i) => `<span><span class="swatch" style="background:${cols[i]};border-radius:50%"></span>${an(a)} ${bucketName(b.label)}</span>`).join("")}</div>`;
  el.querySelectorAll(".ax-row").forEach((n) => {
    const r = RS.models.find((m) => m.id === n.dataset.i);
    n.onmousemove = (ev) => showTip(ev, `<b>${r.name}</b> · ${an(a)}<br>` + B.map((b, i) => `${bucketName(b.label)}: ${val(r, i).toFixed(1)}`).join(" · "));
    n.onmouseleave = hideTip;
  });
}

function scNotes() {
  const G = RS.scenes, DN = DIMNAME();
  // 1. the scene with the lowest rule score, its weakest dimensions and its VLM score
  const hard = [...G].sort((a, b) => a.rule - b.rule)[0];
  const hw = Object.entries(hard.dims).filter(([, v]) => v != null).sort((a, b) => a[1] - b[1]).slice(0, 2);
  // 2. within real footage (scenes with at least 5 video tasks): hardest vs. easiest scene on the rule score
  const vid = G.filter((g) => g.by_task.video && g.by_task.video.n >= 5).sort((a, b) => a.by_task.video.rule - b.by_task.video.rule);
  const vlo = vid[0], vhi = vid[vid.length - 1];
  // 3. ranks: how often the overall leader is first, and the agent whose rank moves most across scenes
  const ranks = RS.models.map((r) => ({ r, k: G.map((g) => [g, 1 + sortedBy(`sc_${g.key}`).findIndex((m) => m.id === r.id)]) }));
  const lead = sortedBy("total")[0], leadFirst = ranks.find((x) => x.r.id === lead.id).k.filter(([, k]) => k === 1).length;
  const sw = ranks.map((x) => { const s = [...x.k].sort((a, b) => a[1] - b[1]); return { r: x.r, best: s[0], worst: s[s.length - 1] }; })
    .sort((a, b) => (b.worst[1] - b.best[1]) - (a.worst[1] - a.best[1]))[0];
  const N = scName, d0 = DN[hw[0][0]], d1 = DN[hw[1][0]];
  const cards = [
    [L(`${hard.name} are the hardest to rebuild`, `${N(hard)}最难重建`),
      L(`Lowest rule score of all scenes (${hard.rule.toFixed(1)}), with ${d0.toLowerCase()} at ${Math.round(hw[0][1])} and ${d1.toLowerCase()} at ${Math.round(hw[1][1])}. Yet the VLM gives these proxies ${hard.vlm.toFixed(1)}: the proxies look plausible long before they are placed right.`,
        `所有场景里规则分最低（${hard.rule.toFixed(1)}），其中${d0}只有 ${Math.round(hw[0][1])}、${d1}只有 ${Math.round(hw[1][1])}。但 VLM 给这些预演视频打了 ${hard.vlm.toFixed(1)}：画面看起来像那么回事，位置却远没摆对。`)],
    [L(`Within real footage, ${vlo.name.toLowerCase()} is hardest`, `只看真实视频，${N(vlo)}最难`),
      L(`On video tasks alone, agents reach a rule score of ${vlo.by_task.video.rule.toFixed(1)} in ${vlo.name.toLowerCase()} against ${vhi.by_task.video.rule.toFixed(1)} in ${vhi.name.toLowerCase()}, so the scene matters even when the input type is the same.`,
        `只看视频题，智能体在${N(vlo)}上的规则分是 ${vlo.by_task.video.rule.toFixed(1)}，在${N(vhi)}上是 ${vhi.by_task.video.rule.toFixed(1)}：即使输入类型相同，场景本身也有影响。`)],
    axNote(),
    [L(`One leader, shuffled ranks below`, `第一名稳定，后面的排名有变化`),
      L(`${lead.name} ranks first in ${leadFirst} of ${G.length} scene types. Below the top, ranks move: ${sw.r.name} is ${ord(sw.best[1])} in ${sw.best[0].name.toLowerCase()} but ${ord(sw.worst[1])} in ${sw.worst[0].name.toLowerCase()}.`,
        `${lead.name} 在 ${G.length} 类场景中有 ${leadFirst} 类排第一。往下排名会变动：${sw.r.name} 在${N(sw.best[0])}排第 ${sw.best[1]}，在${N(sw.worst[0])}却排第 ${sw.worst[1]}。`)],
  ];
  document.getElementById("sc-notes").innerHTML = cards.map(([h, p], i) => `<div class="card finding"><span class="num">0${i + 1}</span><h3>${h}</h3><p>${p}</p></div>`).join("");
}
function axNote() {
  const O = RS.video_axes.filter((a) => a.ordinal).map((a) => ({ a, d: a.buckets[0].rule - a.buckets[a.buckets.length - 1].rule })).sort((p, q) => q.d - p.d);
  const top = O[0], lw = O[O.length - 1], b = (a, i) => a.buckets[i], an = (x) => axisName(x.key, x.name);
  return [L(`More ${top.a.name.toLowerCase()} cost more than more ${lw.a.name.toLowerCase()}`, `${an(top.a)}变多比${an(lw.a)}变多更难`),
    L(`On real clips, the rule score falls from ${b(top.a, 0).rule.toFixed(1)} to ${b(top.a, 2).rule.toFixed(1)} between ${b(top.a, 0).label} and ${b(top.a, 2).label} ${top.a.name.toLowerCase()}, but only from ${b(lw.a, 0).rule.toFixed(1)} to ${b(lw.a, 2).rule.toFixed(1)} between ${b(lw.a, 0).label} and ${b(lw.a, 2).label} ${lw.a.name.toLowerCase()}. On real footage, ${top.a.name.toLowerCase()} matter more than ${lw.a.name.toLowerCase()}.`,
      `在真实视频上，${an(top.a)}从 ${b(top.a, 0).label} 增加到 ${b(top.a, 2).label} 时，规则分从 ${b(top.a, 0).rule.toFixed(1)} 降到 ${b(top.a, 2).rule.toFixed(1)}；而${an(lw.a)}从 ${b(lw.a, 0).label} 增加到 ${b(lw.a, 2).label} 时，只从 ${b(lw.a, 0).rule.toFixed(1)} 降到 ${b(lw.a, 2).rule.toFixed(1)}。对真实视频来说，${an(top.a)}的影响大于${an(lw.a)}。`)];
}
const ord = (n) => n + (n % 10 === 1 && n !== 11 ? "st" : n % 10 === 2 && n !== 12 ? "nd" : n % 10 === 3 && n !== 13 ? "rd" : "th");

// evaluation: the nine rule dimensions in four groups
function evaluation() {
  const G = [[L("Space", "空间"), ["A1", "A2", "A3", "P1"]], [L("Action", "动作"), ["B1", "B2"]], [L("Camera", "镜头"), ["C1", "C2"]], [L("Physics", "物理"), ["D1"]]];
  const D = Object.fromEntries(RS.dims.map((d) => [d.key, d]));
  document.getElementById("ev-dims").innerHTML = G.map(([g, ks]) => `<div class="ev-grp"><span class="ev-grp-h">${g}</span><div>${ks.map((k) =>
    `<span class="ev-dchip" title="${dimDesc(k, D[k].desc)}"><b>${k}</b>${dimName(k, D[k].name)}</span>`).join("")}</div></div>`).join("") +
    `<p class="note ev-wnote">${L("Picture structure (P1) is not scored for scripts.", "剧本题不计画面结构（P1）。")}</p>`;
}

function renderResults() {
  document.getElementById("lb-lede").textContent = L(`${RS.models.length} agents on all ${RS.n.total} tasks, scored 0–100. Overall = ½ rule score + ½ VLM score; a run with no valid scene scores 0.`,
    `${RS.models.length} 个智能体在全部 ${RS.n.total} 道题上的成绩，满分 100。总分 = ½ 规则分 + ½ VLM 分；没有交付有效场景的运行记 0 分。`);
  document.getElementById("lb-howto").innerHTML = HOWTO().map((h) => `<li>${h}</li>`).join("");
  document.getElementById("lb-search").oninput = search;
  lbRender(); sceneScores(); evaluation();
}

// ---------------------------------------------------------------- theme: sun = light, moon = dark; default to dark
const SUN = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4.2"/><path d="M12 1.8v2.6M12 19.6v2.6M4.8 4.8l1.8 1.8M17.4 17.4l1.8 1.8M1.8 12h2.6M19.6 12h2.6M4.8 19.2l1.8-1.8M17.4 6.6l1.8-1.8"/></svg>';
const MOON = '<svg viewBox="0 0 24 24"><path d="M20.5 14.2A8.6 8.6 0 1 1 9.8 3.5a7 7 0 0 0 10.7 10.7z"/></svg>';
function themeNow() { return document.documentElement.dataset.theme === "light" ? "light" : "dark"; }
function themeShow() {
  const t = themeNow(), b = document.getElementById("theme-btn");
  b.innerHTML = t === "light" ? SUN : MOON;
  b.title = t === "light" ? L("Light mode (click for dark)", "白天模式（点击切换到黑夜）") : L("Dark mode (click for light)", "黑夜模式（点击切换到白天）");
  b.setAttribute("aria-label", b.title);
}
document.getElementById("theme-btn").onclick = () => {
  const t = themeNow() === "light" ? "dark" : "light";
  document.documentElement.dataset.theme = t;
  try { localStorage.setItem("vp-theme", t); } catch (e) {}
  themeShow(); dispatchEvent(new Event("themechange"));
};
themeShow();

// ---------------------------------------------------------------- language: EN (default) / 中文
function langShow() {
  document.querySelectorAll("#lang-seg button").forEach((b) => b.classList.toggle("on", b.dataset.k === LANG));
}
document.querySelectorAll("#lang-seg button").forEach((b) => (b.onclick = () => { if (b.dataset.k !== LANG) setLang(b.dataset.k); }));

// ---------------------------------------------------------------- citation
document.getElementById("cite-copy").onclick = async (e) => {
  const b = e.currentTarget, txt = document.getElementById("bib").textContent;
  try { await navigator.clipboard.writeText(txt); }
  catch { const r = document.createRange(); r.selectNodeContents(document.getElementById("bib")); getSelection().removeAllRanges(); getSelection().addRange(r); document.execCommand("copy"); }
  b.textContent = L("Copied ✓", "已复制 ✓"); b.classList.add("done");
  setTimeout(() => { b.textContent = L("Copy BibTeX", "复制 BibTeX"); b.classList.remove("done"); }, 1800);
};

// ---------------------------------------------------------------- boot
// static text switches at once; generated text follows after the data loads
setLang(LANG); langShow();

Promise.all([fetch("data/dataset.json?v=20261030i").then((r) => r.json()), fetch("data/results.json?v=20261030i").then((r) => r.json())]).then(([ds, rs]) => {
  DS = ds; RS = rs;
  document.body.insertAdjacentHTML("afterbegin", `<svg width="0" height="0" style="position:absolute" aria-hidden="true">${LOGO_SYMBOLS}</svg>`);
  hero(); renderResults();
  initCases({ v: "20261030i", scenes: RS.scenes, subs: RS.scene_subs, short: SC_SHORT, MOD, mods: MODS, dims: RS.dims, seg,
    logo: (v, sz) => logoUse(v, sz), model: (id) => RS.models.find((m) => m.id === id), vendor: (id) => RS.models.find((m) => m.id === id).vendor });
  let t;
  addEventListener("resize", () => { clearTimeout(t); t = setTimeout(() => { if (state.lb === "chart") bars(); costChart(); sceneScores(); }, 150); });
  addEventListener("langchange", () => { langShow(); themeShow(); hero(); _intro = false; renderResults(); });
});
