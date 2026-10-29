// Case gallery and viewer: data/cases.json (made by scripts/build_cases.py). Three.js is imported only when a 3D scene is opened.
import { L, modName, subName, dimName, caseTitle } from "./i18n.js?v=20261030i";
const DIMS = ["A1", "A2", "A3", "P1", "B1", "B2", "C1", "C2", "D1"];
let C, ctx, cur = null, agentId = null, mode = "video";
const st = { group: "all", task: "all" };
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

export async function initCases(c) {
  ctx = c;
  C = await (await fetch(`data/cases.json?v=${c.v}`)).json();
  C.forEach((k) => k.agents.sort((a, b) => b.total - a.total));
  filters(); grid();
  $("cv-close").onclick = close;
  $("cv-prev").onclick = () => step(-1);
  $("cv-next").onclick = () => step(1);
  addEventListener("keydown", (e) => {
    if ($("cv").hidden) return;
    if (e.key === "Escape") close();
    if (e.key === "ArrowLeft" && e.target.tagName !== "INPUT") step(-1);
    if (e.key === "ArrowRight" && e.target.tagName !== "INPUT") step(1);
  });
  addEventListener("resize", () => three.resize && three.resize());
  addEventListener("themechange", () => three.retheme && three.retheme());
  // a language switch redraws the gallery and, if open, the viewer (keeping the agent and the 3D / video mode)
  addEventListener("langchange", () => { filters(); grid(); if (cur && !$("cv").hidden) renderCase(); });
}

// ------------------------------------------------------------- gallery
function filters() {
  const G = ctx.scenes, n = (f) => C.filter(f).length;
  ctx.seg("cg-group", { all: `${L("All", "全部")} <small>${C.length}</small>`, ...Object.fromEntries(G.map((g) => [g.key, `${ctx.short[g.key] || g.name} <small>${n((k) => k.group === g.key)}</small>`])) },
    st.group, (k) => { st.group = k; filters(); grid(); });
  const T = ctx.mods.filter((m) => n((k) => k.task === m));
  ctx.seg("cg-task", { all: L("All inputs", "全部输入"), ...Object.fromEntries(T.map((m) => [m, `${mname(m)} <small>${n((k) => k.task === m)}</small>`])) },
    st.task, (k) => { st.task = k; filters(); grid(); });
}

const mname = (m) => modName(m, ctx.MOD[m].name);
const sname = (key) => { const x = ctx.subs.find((s) => s.key === key); return x ? subName(x.key, x.name) : ""; };
const title = (k) => caseTitle(k.id, k.title);
const shown = () => C.filter((k) => (st.group === "all" || k.group === st.group) && (st.task === "all" || k.task === st.task));

function grid() {
  $("cg-grid").innerHTML = shown().map((k) => {
    const best = k.agents[0], lo = k.agents[k.agents.length - 1], M = ctx.MOD[k.task];
    return `<button type="button" class="ccard" data-id="${k.id}">
      <span class="cthumb"><img src="${k.thumb}" alt="" loading="lazy"><span class="cbadge" style="--c:${M.color}">${mname(k.task)}</span></span>
      <span class="cbody"><b>${esc(title(k))}</b><span class="ctag">${esc(sname(k.sub))} · ${k.id}</span>
      <span class="cscore">${ctx.logo(ctx.vendor(best.id), 15)}<span>${L("best", "最高")} ${best.total.toFixed(1)}</span><span class="note">· ${L("spread", "分差")} ${(best.total - lo.total).toFixed(1)}</span></span></span></button>`;
  }).join("") || `<div class="placeholder">${L("No case matches this filter.", "没有符合筛选条件的案例。")}</div>`;
  $("cg-grid").querySelectorAll(".ccard").forEach((b) => (b.onclick = () => open(b.dataset.id)));
}

// ------------------------------------------------------------- viewer
function open(id) {
  cur = C.find((k) => k.id === id);
  agentId = cur.agents[0].id;
  $("cv").hidden = false; document.body.classList.add("cv-open");
  renderCase();
}

function close() {
  $("cv").hidden = true; document.body.classList.remove("cv-open");
  document.querySelectorAll("#cv video").forEach((v) => v.pause());
  three.stop && three.stop();
}

function step(d) {
  const list = shown(), i = list.findIndex((k) => k.id === cur.id);
  open(list[(i + d + list.length) % list.length].id);
}

function renderCase() {
  const k = cur, M = ctx.MOD[k.task];
  const list = shown(), i = list.findIndex((x) => x.id === k.id);
  $("cv-title").innerHTML = `<span class="cbadge" style="--c:${M.color}">${mname(k.task)}</span> ${esc(title(k))}`;
  $("cv-meta").textContent = L(`${k.id} · ${sname(k.sub)} · ${(k.frames / k.fps).toFixed(1)} s at ${k.fps} fps · case ${i + 1} of ${list.length}`,
    `${k.id} · ${sname(k.sub)} · ${(k.frames / k.fps).toFixed(1)} 秒，${k.fps} fps · 第 ${i + 1} / ${list.length} 个案例`);
  // input
  let inp = "";
  if (k.input.video) inp = `<video id="cv-ref" src="${k.input.video}" controls muted playsinline preload="metadata"></video>`;
  else if (k.input.images?.length) inp = `<div class="cv-pics n${Math.min(k.input.images.length, 4)}">${k.input.images.map((p, j) => `<a href="${p}" target="_blank" rel="noopener"><img src="${p}" alt="${k.task === "continuation" ? L("Input first frame", "输入首帧") : L("Input photo " + (j + 1), "输入照片 " + (j + 1))}"></a>`).join("")}</div>`;
  else inp = `<div class="cv-script"><pre>${esc(k.prompt)}</pre></div>`;
  const label = { video: L("Reference video", "参考视频"), image: k.input.images?.length > 1 ? L(`${k.input.images.length} photos of the place`, `该地点的 ${k.input.images.length} 张照片`) : L("Photo of the place", "该地点的照片"),
    continuation: L("First frame", "首帧"), text: L("The script", "剧本") }[k.task];
  const srcLink = k.src ? `<a class="cv-src" href="${esc(k.src)}" target="_blank" rel="noopener noreferrer">${L("Source", "来源")} ↗</a>` : "";
  $("cv-input").innerHTML = `<div class="cv-h cv-h-row">${label}${srcLink}</div>${inp}` +
    (k.task !== "text" ? `<details class="cv-brief"><summary>${L("The brief the agent got", "智能体拿到的任务说明")}</summary><pre>${esc(k.prompt)}</pre></details>` : "");
  agents();
  renderAgent();
}

function agents() {
  $("cv-agents").innerHTML = cur.agents.map((a, j) => {
    const m = ctx.model(a.id);
    return `<button type="button" class="cv-ag${a.id === agentId ? " on" : ""}" data-id="${a.id}" title="${esc(m.name)} (${m.effort})">${ctx.logo(m.vendor, 16)}<span>${esc(m.name)}</span><b>${a.total.toFixed(1)}</b>${j < 3 ? `<i class="md m${j}">${j + 1}</i>` : ""}</button>`;
  }).join("");
  $("cv-agents").querySelectorAll(".cv-ag").forEach((b) => (b.onclick = () => { agentId = b.dataset.id; agents(); renderAgent(); }));
}

function renderAgent() {
  const a = cur.agents.find((x) => x.id === agentId), m = ctx.model(a.id);
  $("cv-gen").textContent = L("Generated by", "生成者");
  ctx.seg("cv-mode", { video: L("Proxy video ▷", "预演视频 ▷"), three: L("Interactive 3D ◇", "可交互 3D ◇") }, mode, (k) => { mode = k; renderAgent(); });
  const pane = $("cv-pane");
  three.stop && three.stop();
  if (!a.video) pane.innerHTML = `<div class="placeholder">${L(`${esc(m.name)} delivered no valid scene for this task (scored 0).`, `${esc(m.name)} 在这道题上没有交付有效场景（记 0 分）。`)}</div>`;
  else if (mode === "video") {
    const ref = $("cv-ref");
    pane.innerHTML = `<video id="cv-proxy" src="${a.video}" controls muted playsinline${ref ? ' preload="auto"' : " autoplay loop"}></video>` +
      (ref ? `<div class="cv-sync"><button type="button" id="cv-syncb" class="sync-btn"></button><span class="note">${L("reference and greybox, in step", "参考视频与白模同步")}</span></div>` : "");
    if (ref) syncPair(ref, $("cv-proxy"), $("cv-syncb"));
  } else {
    pane.innerHTML = `<div class="cv-3d" id="cv-3d"><div class="cv-load" id="cv-load">${L("Loading scene…", "正在加载场景…")}</div></div>
      <div class="cv-bar"><button type="button" id="t-play" aria-label="Play">▶</button><input type="range" id="t-time" min="0" max="${(cur.frames - 1) / cur.fps}" step="${1 / cur.fps}" value="0" aria-label="Time">
      <span id="t-lab" class="note">0.0 s</span><button type="button" id="t-ov" class="tog">${L("Overview", "全景")}</button><button type="button" id="t-cut" class="tog">${L("Cut away ceiling", "掀开屋顶")}</button><div class="seg" id="t-cam"></div></div>
      <p class="note cv-hint">${L("Drag to orbit, scroll to zoom, right-drag to pan; Overview returns to the view from outside. Director view follows the agent's own shot cameras and cuts; switching back to Free view starts from the current shot.",
      "拖动旋转，滚轮缩放，右键拖动平移；「全景」回到外部视角。「导演机位」跟随智能体自己设置的镜头和剪辑；切回「自由视角」时从当前镜头接着看。")}</p>`;
    three.load(a);
  }
  scores(a, m);
}

// one button plays or pauses the reference and the greybox together; it shows pause while they play, play while they are paused
function syncPair(ref, prx, btn) {
  ref.pause();
  const playing = () => !ref.paused || !prx.paused;
  const label = () => {
    const on = playing();
    btn.textContent = on ? L("❚❚  Pause both", "❚❚  一起暂停") : L("▶  Play both in sync", "▶  同步播放");
    btn.setAttribute("aria-label", on ? L("Pause reference and greybox", "暂停参考视频和白模") : L("Play reference and greybox together", "参考视频和白模一起播放"));
    btn.classList.toggle("on", on);
  };
  btn.onclick = () => {
    if (playing()) { ref.pause(); prx.pause(); }
    else {
      if (ref.ended || prx.ended || ref.currentTime >= ref.duration - 0.05) ref.currentTime = 0;
      prx.currentTime = Math.min(ref.currentTime, (prx.duration || Infinity) - 0.05);
      Promise.all([ref.play(), prx.play()]).catch(() => {});
    }
  };
  const stopBoth = () => { ref.pause(); prx.pause(); };
  [ref, prx].forEach((v) => { v.onplay = label; v.onpause = label; v.onended = stopBoth; });
  // keep the greybox on the reference clock while both play; a seek on the reference moves the greybox too
  ref.ontimeupdate = () => { if (!ref.paused && !prx.paused && Math.abs(prx.currentTime - ref.currentTime) > 0.15) prx.currentTime = ref.currentTime; };
  ref.onseeked = () => { prx.currentTime = Math.min(ref.currentTime, (prx.duration || Infinity) - 0.05); };
  label();
}

function scores(a, m) {
  const D = Object.fromEntries(ctx.dims.map((d) => [d.key, dimName(d.key, d.name)]));
  const bars = DIMS.filter((d) => a.dims[d] != null).map((d) =>
    `<div class="cv-dim" title="${D[d]}"><span>${d} <small>${D[d]}</small></span><i><em style="width:${a.dims[d]}%"></em></i><b>${Math.round(a.dims[d])}</b></div>`).join("");
  const recap = a.recap?.length ? `<div class="cv-h">${L("What the VLM judge saw", "VLM 裁判看到了什么")} <span class="note">${L("(blind recap of this proxy)", "（对这段预演视频的盲复述）")}</span></div><ol class="cv-recap">${a.recap.map((r) => `<li><span>${esc(r.t)}</span>${esc(r.text)}</li>`).join("")}</ol>` : "";
  $("cv-score").innerHTML = `<div class="cv-tot"><div><span class="note">${L("Overall", "总分")}</span><b>${a.total.toFixed(1)}</b></div><div><span class="note">${L("Rule", "规则分")}</span><b>${a.rule.toFixed(1)}</b></div><div><span class="note">${L("VLM", "VLM 分")}</span><b>${a.vlm.toFixed(1)}</b></div>` +
    `<div class="cv-facts"><span class="note">${L("Facts checked", "检查的事实数")}</span><b>${a.checks}</b><span class="note">${L(`${a.checks ? Math.round((100 * a.passed) / a.checks) : 0}% credit`, `得分率 ${a.checks ? Math.round((100 * a.passed) / a.checks) : 0}%`)}</span></div></div>` +
    `<div class="cv-dims">${bars}</div>${recap}`;
}

// ------------------------------------------------------------- 3D (three.js, loaded on demand)
const three = {
  async lib() {
    if (!this.T) {
      const [T, { GLTFLoader }, { DRACOLoader }, { OrbitControls }] = await Promise.all([
        import("three"), import("three/addons/loaders/GLTFLoader.js"), import("three/addons/loaders/DRACOLoader.js"), import("three/addons/controls/OrbitControls.js")]);
      const dl = new DRACOLoader(); dl.setDecoderPath("https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/libs/draco/gltf/");
      this.T = T; this.loader = new GLTFLoader(); this.loader.setDRACOLoader(dl); this.Orbit = OrbitControls;
    }
    return this.T;
  },
  async load(a) {
    const token = (this.token = {}), T = await this.lib(), box = $("cv-3d");
    if (token !== this.token || !box) return;
    const r = new T.WebGLRenderer({ antialias: true }); r.setPixelRatio(Math.min(2, devicePixelRatio));
    box.appendChild(r.domElement);
    const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
    const scene = new T.Scene(); scene.background = new T.Color(css("--three-bg") || "#15161c");
    scene.add(new T.HemisphereLight(0xffffff, 0x3a3d4a, 2.4));
    const sun = new T.DirectionalLight(0xffffff, 1.5); sun.position.set(0.5, 1, 0.7); scene.add(sun);
    const free = new T.PerspectiveCamera(50, 16 / 9, 0.05, 20000);
    const ctl = new this.Orbit(free, r.domElement); ctl.enableDamping = true;
    this.r = r;
    let g;
    try { g = await new Promise((ok, no) => this.loader.load(a.glb, ok, (e) => { const l = $("cv-load"); if (l && e.total) l.textContent = `${L("Loading scene…", "正在加载场景…")} ${Math.round((100 * e.loaded) / e.total)}%`; }, no)); }
    catch (e) { const l = $("cv-load"); if (l) l.textContent = L("Could not load this scene.", "无法加载这个场景。"); return; }
    if (token !== this.token) { r.dispose(); return; }
    $("cv-load")?.remove();
    scene.add(g.scene);
    const mix = new T.AnimationMixer(g.scene); g.animations.forEach((c) => mix.clipAction(c).play());
    // frame the scene on its meshes (robust to stray far-away helpers): use the 10th-90th percentile of mesh centres
    const cs = [], mins = []; g.scene.traverse((o) => { if (o.isMesh) { const b = new T.Box3().setFromObject(o); cs.push(b.getCenter(new T.Vector3())); mins.push(b.min.y); } });
    const q = (arr, p) => arr.sort((x, y) => x - y)[Math.floor(p * (arr.length - 1))] ?? 0;
    const lo = new T.Vector3(q(cs.map((v) => v.x), 0.1), q(cs.map((v) => v.y), 0.1), q(cs.map((v) => v.z), 0.1));
    const hi = new T.Vector3(q(cs.map((v) => v.x), 0.9), q(cs.map((v) => v.y), 0.9), q(cs.map((v) => v.z), 0.9));
    const c = lo.clone().add(hi).multiplyScalar(0.5), sz = Math.max(6, hi.clone().sub(lo).length());
    const floor = q(mins, 0.05);
    const mkGrid = () => { const gh = new T.GridHelper(sz * 3, 30, new T.Color(css("--three-grid") || "#2c2f3a"), new T.Color(css("--three-grid2") || "#22242c")); gh.position.set(c.x, floor - 0.01, c.z); scene.add(gh); return gh; };
    let grid = mkGrid();
    // cut-away: hide everything above 2.2 m over the floor, as the evaluator's orbit renders do. A scene counts as roofed
    // when most low meshes have another mesh above them (covering them in plan, starting at least 1.5 m higher).
    const cut = new T.Plane(new T.Vector3(0, -1, 0), floor + 2.2);
    const meshes = [], bx = [];
    g.scene.traverse((o) => { if (o.isMesh) { meshes.push(o); bx.push(new T.Box3().setFromObject(o)); } });
    const low = bx.map((b) => b.getCenter(new T.Vector3())).filter((p) => p.y < floor + 2).slice(0, 400);
    const covered = low.filter((p) => bx.some((b) => b.min.y > p.y + 1.5 && b.min.x <= p.x && b.max.x >= p.x && b.min.z <= p.z && b.max.z >= p.z)).length;
    const roofed = low.length > 0 && covered / low.length > 0.5;
    let cutOn = roofed || cur.task === "image";
    const san = (n) => n.replace(/\s/g, "_").replace(/[\[\]\.:\/]/g, "");
    const shots = (a.scene?.shots || []).map((s) => ({ ...s, cam: g.cameras.find((k) => k.name === san(s.camera)) })).filter((s) => s.cam);
    const fps = a.scene?.fps || cur.fps;
    const ray = new T.Raycaster();
    // free view placed at a shot camera: same pose and lens, orbiting the first thing that camera looks at
    const fromCam = (sc) => {
      g.scene.updateMatrixWorld(true);
      const p = sc.getWorldPosition(new T.Vector3()), d = sc.getWorldDirection(new T.Vector3());
      ray.set(p, d); ray.far = 60;
      const hit = ray.intersectObjects(meshes, false).find((h) => h.distance > 0.5);
      free.position.copy(p); free.fov = sc.fov; free.updateProjectionMatrix();
      ctl.target.copy(p).addScaledVector(d, hit ? Math.min(40, Math.max(2, hit.distance)) : 8); ctl.update();
      setCut(false);
    };
    // overview: the whole scene from outside; a scene spread over many sets (> 80 m) frames the main set instead,
    // the place its longest shot looks at, within about 40 m
    let oc = c, osz = sz;
    const overview = () => {
      free.fov = 50; free.updateProjectionMatrix();
      free.position.copy(oc).add(new T.Vector3(osz * 0.6, osz * 0.55, osz * 0.6)); ctl.target.copy(oc); ctl.update();
      setCut(roofed || cur.task === "image");
    };
    let t = 0, playing = true, view = "free", last = performance.now(), sh = null;
    const tl = $("t-time"), lab = $("t-lab"), pb = $("t-play"), max = +tl.max;
    const cams = shots.length ? { free: L("Free view", "自由视角"), director: L("Director view", "导演机位") } : { free: L("Free view", "自由视角") };
    const setCam = (k) => {
      if (view === "director" && k === "free" && sh) fromCam(sh.cam);  // keep looking where the shot was looking
      view = k; ctx.seg("t-cam", cams, view, setCam);
      $("t-cut").hidden = $("t-ov").hidden = view !== "free";
    };
    const cb = $("t-cut"), setCut = (on) => { cutOn = on; cb.classList.toggle("on", on); cb.setAttribute("aria-pressed", on); };
    cb.onclick = () => setCut(!cutOn);
    $("t-ov").onclick = overview;
    // the agent's longest shot: usually the main action rather than a title card
    const end = a.scene?.frame_end || cur.frames;
    const long = shots.map((x, i) => ({ x, len: (shots[i + 1]?.frame ?? end + 1) - x.frame })).sort((p, q2) => q2.len - p.len)[0]?.x;
    if (long && sz > 80) {
      mix.setTime(Math.max(0, (long.frame - 1) / fps)); g.scene.updateMatrixWorld(true);
      const p = long.cam.getWorldPosition(new T.Vector3()), d = long.cam.getWorldDirection(new T.Vector3());
      ray.set(p, d); ray.far = 60;
      const hit = ray.intersectObjects(meshes, false).find((h) => h.distance > 0.5);
      oc = hit ? hit.point.clone() : p.clone().addScaledVector(d, 10); osz = 40;
    }
    mix.setTime(0); overview();
    setCam(view);
    pb.onclick = () => { playing = !playing; pb.textContent = playing ? "❚❚" : "▶"; last = performance.now(); };
    pb.textContent = "❚❚";
    tl.oninput = () => { t = +tl.value; };
    const size = () => { const w = box.clientWidth, h = Math.round(w * 9 / 16); r.setSize(w, h); free.aspect = w / h; free.updateProjectionMatrix(); };
    this.resize = size; size();
    const loop = (now) => {
      if (token !== this.token) return;
      if (playing) { t += (now - last) / 1000; if (t > max) t = 0; tl.value = t; }
      last = now;
      mix.setTime(t);
      let cam = free; sh = null;
      if (view === "director") {
        const fr = 1 + t * fps; sh = [...shots].reverse().find((s) => s.frame <= fr) || shots[0];
        cam = sh.cam; cam.aspect = free.aspect; cam.updateProjectionMatrix();
      } else ctl.update();
      lab.textContent = `${t.toFixed(1)} s${sh ? " · " + sh.camera.split("|").pop().trim() : ""}`;
      r.clippingPlanes = view === "free" && cutOn ? [cut] : [];
      r.render(scene, cam);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
    this.retheme = () => { scene.background = new T.Color(css("--three-bg")); scene.remove(grid); grid.geometry.dispose(); grid.material.dispose(); grid = mkGrid(); };
    this.dispose = () => { mix.stopAllAction(); scene.traverse((o) => { o.geometry?.dispose(); [].concat(o.material || []).forEach((m) => m.dispose()); }); ctl.dispose(); r.dispose(); };
  },
  stop() {
    this.token = {}; cancelAnimationFrame(this.raf);
    if (this.dispose) { this.dispose(); this.dispose = null; }
    this.resize = null; this.retheme = null;
  },
};
