// Language: English (default) or Chinese. Static text carries data-zh (and data-zh-ph for placeholders) in index.html;
// generated text uses L(en, zh). Names that come from the data (inputs, scenes, dimensions, cases) map through the tables below.
export let LANG = (() => { try { return localStorage.getItem("vp-lang") === "zh" ? "zh" : "en"; } catch (e) { return "en"; } })();
export const L = (en, zh) => (LANG === "zh" ? zh : en);

export function setLang(l) {
  LANG = l === "zh" ? "zh" : "en";
  try { LANG === "zh" ? localStorage.setItem("vp-lang", "zh") : localStorage.removeItem("vp-lang"); } catch (e) {}
  document.documentElement.lang = LANG === "zh" ? "zh-CN" : "en";
  document.querySelectorAll("[data-zh]").forEach((el) => {
    if (el.dataset.en === undefined) el.dataset.en = el.innerHTML;
    el.innerHTML = LANG === "zh" ? el.dataset.zh : el.dataset.en;
  });
  document.querySelectorAll("[data-zh-ph]").forEach((el) => {
    if (el.dataset.enPh === undefined) el.dataset.enPh = el.placeholder;
    el.placeholder = LANG === "zh" ? el.dataset.zhPh : el.dataset.enPh;
  });
  dispatchEvent(new Event("langchange"));
}

const ZH = {
  mod: { text: "剧本", image: "照片", continuation: "续写", video: "视频" },
  modDesc: {
    text: "逐镜头的剧本：用文字写明场所、人物、动作、机位和剪辑。",
    image: "真实地点的照片：按真实尺寸重建布局，并在其中调度场景。",
    continuation: "一帧首帧加一段描述：用正确的人物、动作和镜头把画面续写下去。",
    video: "真实视频，最长 60 秒，多人互动、多个镜头：把它重建成 4D 场景。",
  },
  scene: { home: "家居与酒店", public: "办公与公共建筑", retail: "商店与餐饮", sport: "运动与场馆", transit: "工业与交通", street: "街道与老城", nature: "自然、雪地与水域" },
  sceneShort: { home: "家居", public: "办公公共", retail: "商店餐饮", sport: "运动", transit: "工业交通", street: "街道", nature: "自然雪地" },
  sub: {
    home_living: "客厅与住宅", home_kitchen: "厨房", home_bedroom: "卧室与书房", home_hotel: "酒店与旅舍",
    public_office: "办公室", public_school: "学校与实验室", public_hospital: "医院", public_civic: "大厅、银行与展馆",
    retail_store: "商店与商场", retail_food: "餐厅与咖啡馆", retail_leisure: "展厅与乐园",
    sport_ball: "球类", sport_board: "滑板、自行车与长板", sport_snow: "冰雪运动", sport_motor: "赛车", sport_water: "水上运动",
    sport_athletics: "田径、攀岩与健身", sport_animal: "动物与马术", sport_obstacle: "障碍与特技",
    transit_station: "车站与铁路", transit_airport: "机场", transit_port: "港口与船舶", transit_industrial: "工业场地",
    street_city: "城市街道", street_residential: "小巷与社区", street_oldtown: "古城与地标", street_rooftop: "屋顶",
    nature_snow: "雪地与滑雪", nature_mountain: "山地与森林", nature_water: "湖泊、河流与海",
  },
  dim: { A1: "实体", A2: "米制布局", A3: "场地结构", P1: "画面结构", B1: "走位", B2: "动作与事件", C1: "机位与取景", C2: "剪辑", D1: "物理合理性" },
  dimDesc: {
    A1: "该有的主体和物体是否存在", A2: "以米计的位置与距离", A3: "场所及其连通关系", P1: "每个镜头的取景与画面布局",
    B1: "谁在什么时候走到哪里", B2: "动作与互动是否在对应时间发生", C1: "机位、高度、方位、景别、运镜", C2: "镜头数量、剪辑时间与顺序",
    D1: "不漂浮、不下沉、不穿模",
  },
  axis: { people: "人数", places: "地点数", shots: "镜头数", length: "时长", setting: "场景" },
  bucket: { "< 30 s": "30 秒以内", "30–44 s": "30–44 秒", "≥ 45 s": "45 秒以上", Indoor: "室内", Outdoor: "室外", "In + out": "室内外" },
  caseTitle: {
    B250_241: "一镜到底的公寓，众生百态", M50_028: "开放式客厅、厨房与餐厅", B250_238: "办公室里的跑酷", TP183: "最后三个位置",
    B250_202: "商场保安大战跑酷", B250_244: "分享一瓶可乐：从超市到屋顶", B250_225: "台球厅打斗排练", M50_024: "聚光灯球场上的一次进攻",
    B250_211: "穿越伦敦地铁的跑酷追逐", TP160: "最后放行", B250_214: "巷子楼梯上的追逐", B250_218: "穿越巴黎地标的跑酷",
    B250_229: "峡谷桥上的追逐", B250_182: "从泥地空场离开",
    B250_236: "穿过办公室的生日惊喜", TP129: "我们选的地方", B250_223: "追到湖边栈桥的跑酷", M50_017: "树林旁的空地",
  },
};

export const modName = (k, en) => L(en, ZH.mod[k] || en);
export const modDesc = (k, en) => L(en, ZH.modDesc[k] || en);
export const sceneName = (k, en) => L(en, ZH.scene[k] || en);
export const sceneShort = (k, en) => L(en, ZH.sceneShort[k] || en);
export const subName = (k, en) => L(en, ZH.sub[k] || en);
export const dimName = (k, en) => L(en, ZH.dim[k] || en);
export const dimDesc = (k, en) => L(en, ZH.dimDesc[k] || en);
export const axisName = (k, en) => L(en, ZH.axis[k] || en);
export const bucketName = (b) => L(b, ZH.bucket[b] || b);
export const caseTitle = (id, en) => L(en, ZH.caseTitle[id] || en);
// "the" / lower-case only make sense in English sentences
export const low = (s) => (LANG === "zh" ? s : s.toLowerCase());
