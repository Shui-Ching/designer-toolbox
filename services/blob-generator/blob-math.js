// ============================================================
// 48 SVG Blob／波浪產生器 — 核心數學（零 DOM 依賴，供 Node 測試與畫面共用）
// 貝茲曲線平滑自寫：Catmull-Rom 樣條轉 cubic bezier 控制點
// 亂數採 seeded PRNG（mulberry32），同一種子必得同一形狀
// ============================================================

// — seeded PRNG：回傳 0–1 的確定性亂數函式 —
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 數字收斂：最多一位小數、去尾零（37.0 → 37）
const fmt = (v) => parseFloat(v.toFixed(1));

// 畫布常數（viewBox 座標系）
export const BLOB_SIZE = 480;   // blob 正方形畫布
export const WAVE_W = 960;      // 波浪畫布寬
export const WAVE_H = 240;      // 波浪畫布高

// ============================================================
// Catmull-Rom → cubic bezier
// 控制點公式：c1 = p1 + (p2 − p0) / 6、c2 = p2 − (p3 − p1) / 6
// ============================================================

// 封閉曲線（blob）：首尾相接，鄰點索引取模
export function closedCatmullRomPath(points) {
  const n = points.length;
  let d = `M ${fmt(points[0][0])} ${fmt(points[0][1])}`;
  for (let i = 0; i < n; i++) {
    const p0 = points[(i - 1 + n) % n];
    const p1 = points[i];
    const p2 = points[(i + 1) % n];
    const p3 = points[(i + 2) % n];
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C ${fmt(c1x)} ${fmt(c1y)}, ${fmt(c2x)} ${fmt(c2y)}, ${fmt(p2[0])} ${fmt(p2[1])}`;
  }
  return `${d} Z`;
}

// 開放曲線（波浪）：端點以自身補位（clamped 端點）
export function openCatmullRomPath(points) {
  const n = points.length;
  let d = `M ${fmt(points[0][0])} ${fmt(points[0][1])}`;
  for (let i = 0; i < n - 1; i++) {
    const p0 = points[Math.max(i - 1, 0)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(i + 2, n - 1)];
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C ${fmt(c1x)} ${fmt(c1y)}, ${fmt(c2x)} ${fmt(c2y)}, ${fmt(p2[0])} ${fmt(p2[1])}`;
  }
  return d;
}

// ============================================================
// Blob：圓周均分角度，半徑與角度依變化幅度抖動
// complexity＝頂點數（3–16）、variance＝變化幅度 0–100
// ============================================================
export function blobPoints(seed, complexity, variance) {
  const rand = mulberry32(seed);
  const v = Math.min(100, Math.max(0, variance)) / 100;
  const cx = BLOB_SIZE / 2;
  const cy = BLOB_SIZE / 2;
  const rMax = BLOB_SIZE * 0.44;           // 最大半徑，四周留白
  const rMin = rMax * (1 - v * 0.55);      // 變化幅度越大，半徑可縮得越深
  const spacing = (Math.PI * 2) / complexity;

  const points = [];
  for (let i = 0; i < complexity; i++) {
    // 角度抖動不超過均分間距的一半，避免頂點交錯造成自相交
    const angle = i * spacing + (rand() - 0.5) * spacing * 0.5 * v;
    const r = rMin + rand() * (rMax - rMin);
    points.push([cx + r * Math.cos(angle), cy + r * Math.sin(angle)]);
  }
  return points;
}

export function blobPath(seed, complexity, variance) {
  return closedCatmullRomPath(blobPoints(seed, complexity, variance));
}

// ============================================================
// 波浪：兩端固定在中線，內部錨點交替上下（波峰／波谷）
// complexity＝起伏數（2–12）、variance＝振幅與水平抖動 0–100
// flip＝false 填滿下方（頁尾分隔線）、true 填滿上方（頁首）
// ============================================================
export function wavePoints(seed, complexity, variance) {
  const rand = mulberry32(seed);
  const v = Math.min(100, Math.max(0, variance)) / 100;
  const mid = WAVE_H / 2;
  const baseAmp = WAVE_H * 0.32;
  const spacing = WAVE_W / (complexity + 1);

  const points = [[0, mid]];
  for (let i = 1; i <= complexity; i++) {
    // 水平抖動不超過間距的三成，確保 x 單調遞增不回頭
    const x = i * spacing + (rand() - 0.5) * spacing * 0.6 * v;
    // 變化幅度 0＝整齊等幅；越大振幅越參差（0 – 1.4 倍基準振幅）
    const amp = baseAmp * (1 - v + rand() * v * 1.4);
    const sign = i % 2 === 1 ? -1 : 1; // 交替波峰（上）／波谷（下）
    const y = Math.min(WAVE_H - 8, Math.max(8, mid + sign * amp));
    points.push([x, y]);
  }
  points.push([WAVE_W, mid]);
  return points;
}

export function wavePath(seed, complexity, variance, flip) {
  const curve = openCatmullRomPath(wavePoints(seed, complexity, variance));
  // 曲線終點在右緣中線，往上或往下把區域閉合成可填色的分隔線形狀
  return flip
    ? `${curve} L ${WAVE_W} 0 L 0 0 Z`
    : `${curve} L ${WAVE_W} ${WAVE_H} L 0 ${WAVE_H} Z`;
}

// ============================================================
// HEX 驗證與 SVG 字串組裝
// fill 一律先過 normalizeHex 白名單驗證，杜絕任意字串流入 SVG
// ============================================================
export function normalizeHex(input) {
  const m = String(input).trim().match(/^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/);
  if (!m) return null;
  let hex = m[1].toLowerCase();
  if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('');
  return `#${hex}`;
}

export function buildBlobSvg({ seed, complexity, variance, fill }) {
  const d = blobPath(seed, complexity, variance);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${BLOB_SIZE} ${BLOB_SIZE}">\n  <path fill="${fill}" d="${d}"/>\n</svg>`;
}

export function buildWaveSvg({ seed, complexity, variance, fill, flip }) {
  const d = wavePath(seed, complexity, variance, flip);
  // preserveAspectRatio="none"：分隔線通常要橫向撐滿容器，容許比例變形
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WAVE_W} ${WAVE_H}" preserveAspectRatio="none">\n  <path fill="${fill}" d="${d}"/>\n</svg>`;
}
