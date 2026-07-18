// ============================================================
// 49 噪點／紋理產生器 — 核心運算（零 DOM 依賴，供 Node 測試與畫面共用）
// 三種可平鋪紋理：噪點 grain（像素亂數）、點陣 dots、格線 lines
// 亂數採 seeded PRNG（mulberry32，沿用 48 blob-generator），同種子必得同紋理
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

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

// ============================================================
// HEX 驗證：填色一律先過白名單，杜絕任意字串流入 SVG／CSS
// ============================================================
export function normalizeHex(input) {
  const m = String(input).trim().match(/^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/);
  if (!m) return null;
  let hex = m[1].toLowerCase();
  if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('');
  return `#${hex}`;
}

// 已驗證的 HEX → RGB 陣列（供 ImageData 上色）
export function hexToRgb(hex) {
  const h = normalizeHex(hex);
  if (!h) return null;
  return [
    parseInt(h.slice(1, 3), 16),
    parseInt(h.slice(3, 5), 16),
    parseInt(h.slice(5, 7), 16),
  ];
}

// ============================================================
// 噪點 grain：把磚塊切成 grainSize 見方的格子，逐格擲亂數決定
// 是否落點與透明度。回傳 RGBA 位元組（Uint8ClampedArray），
// 畫面端直接 new ImageData 使用；磚塊邊界即格子邊界，天然無縫平鋪。
//   tile＝磚塊邊長 px、grainSize＝顆粒大小 1–4、
//   density＝密度 0–100（落點比例）、strength＝強度 0–100（透明度上限）
// ============================================================
export function renderGrainRGBA(seed, tile, grainSize, density, strength, rgb) {
  const size = clamp(Math.round(grainSize), 1, 8);
  const d = clamp(density, 0, 100) / 100;
  const s = clamp(strength, 0, 100) / 100;
  const rand = mulberry32(seed);
  const data = new Uint8ClampedArray(tile * tile * 4);
  const cells = Math.ceil(tile / size);

  for (let by = 0; by < cells; by++) {
    for (let bx = 0; bx < cells; bx++) {
      if (rand() >= d) continue;
      // 透明度在強度上限內再抖動（35%–100%），讓顆粒有深淺層次
      const alpha = Math.round(255 * s * (0.35 + rand() * 0.65));
      const xEnd = Math.min((bx + 1) * size, tile);
      const yEnd = Math.min((by + 1) * size, tile);
      for (let y = by * size; y < yEnd; y++) {
        for (let x = bx * size; x < xEnd; x++) {
          const i = (y * tile + x) * 4;
          data[i] = rgb[0];
          data[i + 1] = rgb[1];
          data[i + 2] = rgb[2];
          data[i + 3] = alpha;
        }
      }
    }
  }
  return data;
}

// ============================================================
// 點陣 dots：點畫在格子正中央，直徑不超過間距即完整落在磚內。
// 交錯排列磚高為兩倍間距，第二列的點跨左右邊界（x=0 與 x=間距各畫半顆），
// 平鋪時左右互補拼成整顆。
//   回傳 { w, h, circles: [[cx, cy, r], …] }
// ============================================================
export function dotsGeometry(spacing, dotSize, stagger) {
  const r = clamp(dotSize, 1, spacing) / 2;
  const half = spacing / 2;
  if (!stagger) {
    return { w: spacing, h: spacing, circles: [[half, half, r]] };
  }
  return {
    w: spacing,
    h: spacing * 2,
    circles: [
      [half, half, r],
      [0, spacing * 1.5, r],
      [spacing, spacing * 1.5, r],
    ],
  };
}

// ============================================================
// 格線 lines：線貼齊磚塊上／左緣，平鋪時每隔一個間距重複一條。
//   mode：'grid'（十字格）、'h'（橫線）、'v'（直線）
//   回傳 { w, h, rects: [[x, y, w, h], …] }
// ============================================================
export function linesGeometry(spacing, lineWidth, mode) {
  const lw = clamp(lineWidth, 1, spacing);
  const rects = [];
  if (mode === 'grid' || mode === 'h') rects.push([0, 0, spacing, lw]);
  if (mode === 'grid' || mode === 'v') rects.push([0, 0, lw, spacing]);
  return { w: spacing, h: spacing, rects };
}

// ============================================================
// SVG 組裝（點陣／格線用；噪點是像素亂數，向量無法無損表達故只出 PNG）
// fill／bg 由呼叫端先過 normalizeHex，這裡再驗一次雙保險
// ============================================================
const fmt = (v) => parseFloat(v.toFixed(2));

export function buildTileSvg({ w, h, circles = [], rects = [], fill, bg = null }) {
  const safeFill = normalizeHex(fill) || '#000000';
  const safeBg = bg ? normalizeHex(bg) : null;
  const parts = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`,
  ];
  if (safeBg) parts.push(`  <rect width="${w}" height="${h}" fill="${safeBg}"/>`);
  for (const [cx, cy, r] of circles) {
    parts.push(`  <circle cx="${fmt(cx)}" cy="${fmt(cy)}" r="${fmt(r)}" fill="${safeFill}"/>`);
  }
  for (const [x, y, rw, rh] of rects) {
    parts.push(`  <rect x="${fmt(x)}" y="${fmt(y)}" width="${fmt(rw)}" height="${fmt(rh)}" fill="${safeFill}"/>`);
  }
  parts.push('</svg>');
  return parts.join('\n');
}
