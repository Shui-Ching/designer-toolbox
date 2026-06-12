// ============================================================
// 10 色彩格式轉換 — HEX ↔ RGB ↔ HSL ↔ OKLCH 即時互轉
// 零相依：所有色彩換算（含 OKLCH 的 sRGB↔OKLab 矩陣）全部自寫，
// 維持 CSP script-src 'self'
// ============================================================
import { copyText, track } from '../../shared/scripts/shared.js?v=202606121911';

// — DOM —
const picker = document.getElementById('picker');
const preview = document.getElementById('preview');
const previewHex = document.getElementById('preview-hex');
const copyHint = document.getElementById('copy-hint');
const randomBtn = document.getElementById('random-btn');
const eyedropperBtn = document.getElementById('eyedropper-btn');
const inputs = {}; // format → input 元素
document.querySelectorAll('.format-input').forEach((el) => {
  inputs[el.dataset.format] = el;
});

// 單一真實來源：以整數 RGB（0–255）保存目前色彩
const state = { r: 45, g: 108, b: 223 };

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
const round = (v, d = 0) => {
  const f = 10 ** d;
  return Math.round(v * f) / f;
};

// ============================================================
// HEX ↔ RGB ↔ HSL（沿用工具箱既有的換算寫法）
// ============================================================

// HEX → RGB；接受 #rgb / #rrggbb，失敗回 null
function hexToRgb(hex) {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

// RGB → HEX（大寫，#rrggbb）
function rgbToHex({ r, g, b }) {
  const to = (v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`.toUpperCase();
}

// RGB → HSL（h 0–360、s/l 0–100）
function rgbToHsl({ r, g, b }) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  const l = (max + min) / 2;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  return { h, s: s * 100, l: l * 100 };
}

// HSL → RGB（h 0–360、s/l 0–100）
function hslToRgb({ h, s, l }) {
  s /= 100; l /= 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return { r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255 };
}

// ============================================================
// OKLCH（Björn Ottosson 的 OKLab）— 自寫矩陣換算
// 流程：sRGB(0–255) ↔ 線性 RGB ↔ OKLab ↔ OKLCH
// L 以 0–1 內部運算、顯示為百分比；C 約 0–0.4；H 為角度
// ============================================================

// sRGB 通道（0–1）→ 線性
function srgbToLinear(c) {
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}
// 線性 → sRGB 通道（0–1）
function linearToSrgb(c) {
  return c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
}

// RGB(0–255) → OKLCH { l, c, h }（h 0–360）
function rgbToOklch({ r, g, b }) {
  const lr = srgbToLinear(r / 255);
  const lg = srgbToLinear(g / 255);
  const lb = srgbToLinear(b / 255);

  // 線性 RGB → LMS
  const l_ = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m_ = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s_ = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);

  // LMS → OKLab
  const L = 0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_;
  const a = 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_;
  const bb = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_;

  // OKLab → OKLCH
  const c = Math.sqrt(a * a + bb * bb);
  let h = Math.atan2(bb, a) * 180 / Math.PI;
  if (h < 0) h += 360;
  return { l: L, c, h };
}

// OKLCH { l, c, h(0–360) } → RGB(0–255)；超出色域則夾到 0–255
function oklchToRgb({ l: L, c, h }) {
  const hr = h * Math.PI / 180;
  const a = c * Math.cos(hr);
  const bb = c * Math.sin(hr);

  // OKLab → LMS
  const l_ = (L + 0.3963377774 * a + 0.2158037573 * bb) ** 3;
  const m_ = (L - 0.1055613458 * a - 0.0638541728 * bb) ** 3;
  const s_ = (L - 0.0894841775 * a - 1.2914855480 * bb) ** 3;

  // LMS → 線性 RGB
  const lr = 4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_;
  const lg = -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_;
  const lb = -0.0041960863 * l_ - 0.7034186147 * m_ + 1.7076147010 * s_;

  return {
    r: clamp(linearToSrgb(lr) * 255, 0, 255),
    g: clamp(linearToSrgb(lg) * 255, 0, 255),
    b: clamp(linearToSrgb(lb) * 255, 0, 255),
  };
}

// 相對亮度（WCAG），決定預覽色塊上的文字深淺
function readableInk({ r, g, b }) {
  const lin = (v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const lum = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return lum > 0.45 ? '#1c1b18' : '#f4f1e8';
}

// ============================================================
// 格式化：RGB → 各格式字串
// ============================================================
function formatHex(rgb) {
  return rgbToHex(rgb);
}
function formatRgb(rgb) {
  return `rgb(${Math.round(rgb.r)}, ${Math.round(rgb.g)}, ${Math.round(rgb.b)})`;
}
function formatHsl(rgb) {
  const { h, s, l } = rgbToHsl(rgb);
  return `hsl(${round(h)}, ${round(s)}%, ${round(l)}%)`;
}
function formatOklch(rgb) {
  const { l, c, h } = rgbToOklch(rgb);
  return `oklch(${round(l * 100, 1)}% ${round(c, 3)} ${round(h, 1)})`;
}

const FORMATTERS = {
  hex: formatHex,
  rgb: formatRgb,
  hsl: formatHsl,
  oklch: formatOklch,
};

// ============================================================
// 解析：各格式字串 → RGB；失敗回 null
// ============================================================

// 從字串抓出所有數字（含小數、負號）
function nums(str) {
  return (str.match(/-?\d*\.?\d+/g) || []).map(Number);
}

function parseRgb(str) {
  const n = nums(str);
  if (n.length < 3) return null;
  return {
    r: clamp(n[0], 0, 255),
    g: clamp(n[1], 0, 255),
    b: clamp(n[2], 0, 255),
  };
}

function parseHsl(str) {
  const n = nums(str);
  if (n.length < 3) return null;
  return hslToRgb({
    h: ((n[0] % 360) + 360) % 360,
    s: clamp(n[1], 0, 100),
    l: clamp(n[2], 0, 100),
  });
}

function parseOklch(str) {
  const n = nums(str);
  if (n.length < 3) return null;
  // L 允許百分比或 0–1：含 % 或數值 > 1 都視為百分比
  let l = n[0];
  if (/%/.test(str.split(/\s|,/)[0] || '') || l > 1) l = l / 100;
  return oklchToRgb({
    l: clamp(l, 0, 1),
    c: Math.max(0, n[1]),
    h: ((n[2] % 360) + 360) % 360,
  });
}

const PARSERS = {
  hex: hexToRgb,
  rgb: parseRgb,
  hsl: parseHsl,
  oklch: parseOklch,
};

// ============================================================
// 渲染：把 state 反映到預覽與各格式欄位
// exceptKey：正在輸入的欄位略過重填，避免游標跳動
// ============================================================
function render(exceptKey) {
  const hex = rgbToHex(state);

  // 色票挑色（type=color 只吃 #rrggbb）
  picker.value = hex.toLowerCase();

  // 預覽
  preview.style.background = hex;
  const ink = readableInk(state);
  previewHex.textContent = hex;
  previewHex.style.color = ink;

  // 各格式欄位
  Object.keys(FORMATTERS).forEach((key) => {
    if (key === exceptKey) return;
    inputs[key].value = FORMATTERS[key](state);
    inputs[key].classList.remove('is-invalid');
  });
}

// ============================================================
// 互動
// ============================================================
let hintTimer = null;
function flashHint(msg) {
  copyHint.textContent = msg;
  clearTimeout(hintTimer);
  hintTimer = setTimeout(() => { copyHint.textContent = ''; }, 1600);
}

// 編輯任一格式欄位 → 解析後同步其餘
Object.keys(inputs).forEach((key) => {
  inputs[key].addEventListener('input', () => {
    const rgb = PARSERS[key](inputs[key].value);
    if (rgb) {
      state.r = rgb.r; state.g = rgb.g; state.b = rgb.b;
      inputs[key].classList.remove('is-invalid');
      render(key);
    } else {
      inputs[key].classList.add('is-invalid');
    }
  });
  // 失焦時把該欄位也正規化（例如把簡寫補完整）
  inputs[key].addEventListener('blur', () => {
    inputs[key].classList.remove('is-invalid');
    render();
  });
});

// 色票挑色
picker.addEventListener('input', () => {
  const rgb = hexToRgb(picker.value);
  if (rgb) {
    state.r = rgb.r; state.g = rgb.g; state.b = rgb.b;
    render();
  }
});

// 複製單一格式
document.querySelectorAll('.format-copy').forEach((btn) => {
  btn.addEventListener('click', async () => {
    const key = btn.dataset.copyFormat;
    const text = FORMATTERS[key](state);
    if (await copyText(text)) {
      flashHint(`已複製 ${key.toUpperCase()}：${text}`);
      track('use');
    }
  });
});

// 隨機色
randomBtn.addEventListener('click', () => {
  state.r = Math.floor(Math.random() * 256);
  state.g = Math.floor(Math.random() * 256);
  state.b = Math.floor(Math.random() * 256);
  render();
});

// 螢幕取色（EyeDropper API，僅部分瀏覽器支援，不支援則隱藏按鈕）
if ('EyeDropper' in window) {
  eyedropperBtn.hidden = false;
  eyedropperBtn.addEventListener('click', async () => {
    try {
      const { sRGBHex } = await new window.EyeDropper().open();
      const rgb = hexToRgb(sRGBHex);
      if (rgb) {
        state.r = rgb.r; state.g = rgb.g; state.b = rgb.b;
        render();
        track('use');
      }
    } catch {
      // 使用者按 Esc 取消取色，忽略即可
    }
  });
}

// 初次渲染
render();
