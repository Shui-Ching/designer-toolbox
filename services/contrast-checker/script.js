// ============================================================
// 27 對比度檢查器 — 前景 × 背景 → WCAG 對比值與 AA／AAA 判定
// 附四種色盲模擬。零相依：對比與色彩換算全部自寫，
// 維持 CSP script-src 'self'
// ============================================================
import { track } from '../../shared/scripts/shared.js?v=202607181532';

// — DOM —
const fgPicker = document.getElementById('fg-picker');
const bgPicker = document.getElementById('bg-picker');
const fgHex = document.getElementById('fg-hex');
const bgHex = document.getElementById('bg-hex');
const swapBtn = document.getElementById('swap-btn');
const randomBtn = document.getElementById('random-btn');
const preview = document.getElementById('preview');
const previewChip = document.getElementById('preview-chip');
const ratioValue = document.getElementById('ratio-value');
const verdictRows = document.querySelectorAll('.verdict-row');
const cvdCards = document.querySelectorAll('.cvd-card');
const suggestBox = document.getElementById('suggest');
const suggestList = document.getElementById('suggest-list');

// 建議色碼以「AA · 一般文字」門檻為達標基準
const AA_NORMAL = 4.5;

// 單一真實來源：前景／背景各以整數 RGB 保存
const state = {
  fg: { r: 28, g: 27, b: 24 },   // #1c1b18
  bg: { r: 244, g: 241, b: 232 }, // #f4f1e8
};

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

// ============================================================
// HEX ↔ RGB（沿用工具箱既有換算寫法）
// ============================================================
function hexToRgb(hex) {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function rgbToHex({ r, g, b }) {
  const to = (v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`.toUpperCase();
}

function rgbToCss({ r, g, b }) {
  return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
}

// ============================================================
// RGB ↔ HSL：建議色碼只調亮度、保留色相與飽和度，
// 讓替代色與原色維持同一色系
// ============================================================
function rgbToHsl({ r, g, b }) {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const d = max - min;
  let h = 0;
  let s = 0;
  if (d !== 0) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rn: h = (gn - bn) / d + (gn < bn ? 6 : 0); break;
      case gn: h = (bn - rn) / d + 2; break;
      default: h = (rn - gn) / d + 4;
    }
    h /= 6;
  }
  return { h, s, l };
}

function hslToRgb(h, s, l) {
  if (s === 0) {
    const v = Math.round(l * 255);
    return { r: v, g: v, b: v };
  }
  const hue2rgb = (p, q, t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return {
    r: Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
    g: Math.round(hue2rgb(p, q, h) * 255),
    b: Math.round(hue2rgb(p, q, h - 1 / 3) * 255),
  };
}

// ============================================================
// 建議色碼：固定色相／飽和度，往某方向（extremeL＝0 調暗、1 調亮）
// 二分搜尋出「最接近原亮度且達標」的顏色；該方向推到底仍不達標則回傳 null
// ============================================================
function candidateTowards(color, other, target, extremeL) {
  const { h, s, l } = rgbToHsl(color);

  // 推到極端仍不達標 → 此方向無解
  if (contrastRatio(hslToRgb(h, s, extremeL), other) < target) return null;

  // 二分：fail 端為原亮度（未達標）、pass 端為極端（已達標）
  let fail = l;
  let pass = extremeL;
  for (let i = 0; i < 30; i += 1) {
    const mid = (fail + pass) / 2;
    if (contrastRatio(hslToRgb(h, s, mid), other) >= target) pass = mid;
    else fail = mid;
  }

  // 整數化後可能微幅低於門檻，往極端方向微調確保實際達標
  const step = extremeL > l ? 0.003 : -0.003;
  let cursorL = pass;
  for (let i = 0; i < 40; i += 1) {
    const rgb = hslToRgb(h, s, cursorL);
    if (contrastRatio(rgb, other) >= target) return rgb;
    cursorL = clamp(cursorL + step, 0, 1);
  }
  return hslToRgb(h, s, extremeL);
}

// 調暗、調亮各取一個候選，回傳視覺變動（亮度差）最小的達標色
function nearestPassing(color, other, target) {
  const { l } = rgbToHsl(color);
  const options = [
    candidateTowards(color, other, target, 0),
    candidateTowards(color, other, target, 1),
  ].filter(Boolean);
  if (!options.length) return null;
  options.sort((a, b) => Math.abs(rgbToHsl(a).l - l) - Math.abs(rgbToHsl(b).l - l));
  return options[0];
}

// 組一顆可套用的建議按鈕（縮圖以建議配色實際上色）
function buildSuggestion({ label, applyKey, applyRgb, fg, bg }) {
  const ratio = contrastRatio(fg, bg);
  const hexStr = rgbToHex(applyRgb);

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'suggest-item';
  btn.setAttribute('aria-label', `套用建議：${label}為 ${hexStr}，對比值 ${ratio.toFixed(2)} 比 1`);

  const swatch = document.createElement('span');
  swatch.className = 'suggest-swatch';
  swatch.style.background = rgbToCss(bg);
  swatch.style.color = rgbToCss(fg);
  swatch.setAttribute('aria-hidden', 'true');
  swatch.textContent = 'Aa';

  const meta = document.createElement('span');
  meta.className = 'suggest-meta';

  const head = document.createElement('span');
  head.className = 'suggest-label';
  head.textContent = label;

  const detail = document.createElement('span');
  detail.className = 'suggest-detail';
  detail.textContent = `${hexStr} · ${ratio.toFixed(2)}:1`;

  meta.append(head, detail);
  btn.append(swatch, meta);

  btn.addEventListener('click', () => {
    state[applyKey] = applyRgb;
    render();
    track('use');
  });

  return btn;
}

// 依目前對比值決定是否顯示建議，並填入「調前景／調背景」兩種達標配色
function renderSuggestions(ratio) {
  suggestList.replaceChildren();

  // 已達 AA 一般文字門檻 → 不需要建議
  if (ratio >= AA_NORMAL) {
    suggestBox.hidden = true;
    return;
  }
  suggestBox.hidden = false;

  const newFg = nearestPassing(state.fg, state.bg, AA_NORMAL);
  const newBg = nearestPassing(state.bg, state.fg, AA_NORMAL);

  if (newFg) {
    suggestList.append(buildSuggestion({
      label: '調整前景',
      applyKey: 'fg',
      applyRgb: newFg,
      fg: newFg,
      bg: state.bg,
    }));
  }
  if (newBg) {
    suggestList.append(buildSuggestion({
      label: '調整背景',
      applyKey: 'bg',
      applyRgb: newBg,
      fg: state.fg,
      bg: newBg,
    }));
  }
}

// ============================================================
// WCAG 相對亮度與對比值
// 相對亮度 L = 0.2126 R + 0.7152 G + 0.0722 B（R/G/B 為線性化通道）
// 對比值 = (L_亮 + 0.05) / (L_暗 + 0.05)，範圍 1–21
// ============================================================
function channelLinear(v) {
  v /= 255;
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance({ r, g, b }) {
  return 0.2126 * channelLinear(r) + 0.7152 * channelLinear(g) + 0.0722 * channelLinear(b);
}

function contrastRatio(c1, c2) {
  const l1 = relativeLuminance(c1);
  const l2 = relativeLuminance(c2);
  const light = Math.max(l1, l2);
  const dark = Math.min(l1, l2);
  return (light + 0.05) / (dark + 0.05);
}

// ============================================================
// 色盲模擬矩陣（套用於 sRGB 通道，數值為業界常用近似）
// achromatopsia 為亮度灰階；其餘為線性轉換矩陣
// ============================================================
const CVD_MATRIX = {
  protanopia: [
    [0.567, 0.433, 0],
    [0.558, 0.442, 0],
    [0, 0.242, 0.758],
  ],
  deuteranopia: [
    [0.625, 0.375, 0],
    [0.7, 0.3, 0],
    [0, 0.3, 0.7],
  ],
  tritanopia: [
    [0.95, 0.05, 0],
    [0, 0.433, 0.567],
    [0, 0.475, 0.525],
  ],
};

function simulateCvd({ r, g, b }, type) {
  if (type === 'achromatopsia') {
    // 全色盲：以亮度權重轉灰階
    const y = clamp(Math.round(0.299 * r + 0.587 * g + 0.114 * b), 0, 255);
    return { r: y, g: y, b: y };
  }
  const m = CVD_MATRIX[type];
  return {
    r: clamp(Math.round(m[0][0] * r + m[0][1] * g + m[0][2] * b), 0, 255),
    g: clamp(Math.round(m[1][0] * r + m[1][1] * g + m[1][2] * b), 0, 255),
    b: clamp(Math.round(m[2][0] * r + m[2][1] * g + m[2][2] * b), 0, 255),
  };
}

// ============================================================
// 渲染：把 state 反映到色票、欄位、預覽、判定與色盲模擬
// exceptKey：正在輸入的 HEX 欄位略過重填，避免游標跳動
// ============================================================
function render(exceptKey) {
  const fgHexStr = rgbToHex(state.fg);
  const bgHexStr = rgbToHex(state.bg);

  // 色票同步（type=color 只吃小寫 #rrggbb）
  fgPicker.value = fgHexStr.toLowerCase();
  bgPicker.value = bgHexStr.toLowerCase();

  // HEX 欄位（略過正在編輯的那一欄）
  if (exceptKey !== 'fg') { fgHex.value = fgHexStr; fgHex.classList.remove('is-invalid'); }
  if (exceptKey !== 'bg') { bgHex.value = bgHexStr; bgHex.classList.remove('is-invalid'); }

  // 大型預覽：背景為 bg、文字為 fg；UI chip 反過來示意
  const fgCss = rgbToCss(state.fg);
  const bgCss = rgbToCss(state.bg);
  preview.style.background = bgCss;
  preview.style.color = fgCss;
  previewChip.style.background = fgCss;
  previewChip.style.color = bgCss;

  // 對比值
  const ratio = contrastRatio(state.fg, state.bg);
  ratioValue.textContent = ratio.toFixed(2);

  // 逐條 WCAG 判定
  verdictRows.forEach((row) => {
    const min = parseFloat(row.dataset.min);
    const pass = ratio >= min;
    const chip = row.querySelector('.verdict-chip');
    row.classList.toggle('is-pass', pass);
    row.classList.toggle('is-fail', !pass);
    chip.textContent = pass ? '✓ 通過' : '✗ 未達';
  });

  // 未達 AA 一般文字門檻時，附上最接近原色的達標建議
  renderSuggestions(ratio);

  // 色盲模擬：各卡片以模擬後的 fg／bg 上色
  cvdCards.forEach((card) => {
    const type = card.dataset.type;
    const simFg = simulateCvd(state.fg, type);
    const simBg = simulateCvd(state.bg, type);
    const swatch = card.querySelector('.cvd-swatch');
    swatch.style.background = rgbToCss(simBg);
    swatch.style.color = rgbToCss(simFg);
  });
}

// ============================================================
// 互動
// ============================================================

// 色票挑色 → 更新對應狀態
fgPicker.addEventListener('input', () => {
  const rgb = hexToRgb(fgPicker.value);
  if (rgb) { state.fg = rgb; render(); }
});
bgPicker.addEventListener('input', () => {
  const rgb = hexToRgb(bgPicker.value);
  if (rgb) { state.bg = rgb; render(); }
});

// 編輯 HEX 欄位 → 解析後同步
[fgHex, bgHex].forEach((input) => {
  const key = input.dataset.color;
  input.addEventListener('input', () => {
    const rgb = hexToRgb(input.value);
    if (rgb) {
      state[key] = rgb;
      input.classList.remove('is-invalid');
      render(key);
    } else {
      input.classList.add('is-invalid');
    }
  });
  // 失焦時正規化（把簡寫補完整、清除錯誤態）
  input.addEventListener('blur', () => {
    input.classList.remove('is-invalid');
    render();
  });
});

// 對調前景／背景
swapBtn.addEventListener('click', () => {
  const tmp = state.fg;
  state.fg = state.bg;
  state.bg = tmp;
  render();
  track('use');
});

// 隨機配色
randomBtn.addEventListener('click', () => {
  const rand = () => ({
    r: Math.floor(Math.random() * 256),
    g: Math.floor(Math.random() * 256),
    b: Math.floor(Math.random() * 256),
  });
  state.fg = rand();
  state.bg = rand();
  render();
});

// 初次渲染
render();
