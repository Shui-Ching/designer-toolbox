// ============================================================
// 09 調色盤產生器 — 由單一主色推導色階與調和色
// 零相依：色彩換算（hex ↔ rgb ↔ hsl）全部自寫，維持 CSP script-src 'self'
// ============================================================
import { downloadBlob, copyText, track } from '../../shared/scripts/shared.js?v=202606261147';

// — DOM —
const baseInput = document.getElementById('base-input');
const hexInput = document.getElementById('hex-input');
const prefixInput = document.getElementById('prefix-input');
const formatGroup = document.getElementById('format-group');
const scaleStrip = document.getElementById('scale-strip');
const harmonyGrid = document.getElementById('harmony-grid');
const codeOutput = document.getElementById('code-output');
const copyHint = document.getElementById('copy-hint');
const copyBtn = document.getElementById('copy-vars');
const downloadBtn = document.getElementById('download-vars');

// — 狀態 —
const state = {
  base: '#2d6cdf',
  prefix: 'primary',
  format: 'scss', // 'scss' | 'css'
};

// 色階定義：固定亮度梯度 + 飽和度曲線（淺端／深端略降飽和，避免死白或螢光）
// l 為目標亮度（HSL 的 L，0–100）；sMul 為主色飽和度的乘數
const SCALE = [
  { step: 50,  l: 97, sMul: 0.55 },
  { step: 100, l: 93, sMul: 0.70 },
  { step: 200, l: 85, sMul: 0.82 },
  { step: 300, l: 76, sMul: 0.90 },
  { step: 400, l: 66, sMul: 0.97 },
  { step: 500, l: 55, sMul: 1.00 },
  { step: 600, l: 47, sMul: 1.00 },
  { step: 700, l: 39, sMul: 0.96 },
  { step: 800, l: 31, sMul: 0.88 },
  { step: 900, l: 23, sMul: 0.80 },
];

// ============================================================
// 色彩換算工具
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
  const to = (v) => Math.round(v).toString(16).padStart(2, '0');
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

// HSL → HEX 捷徑
function hslToHex(hsl) {
  return rgbToHex(hslToRgb(hsl));
}

// 相對亮度（WCAG），用來決定色塊上的文字要用深或淺
function luminance({ r, g, b }) {
  const lin = (v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

// 依底色明度回傳適合的文字色（手冊風的墨黑或紙白）
function readableInk(hex) {
  const rgb = hexToRgb(hex);
  return rgb && luminance(rgb) > 0.45 ? '#1c1b18' : '#f4f1e8';
}

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

// ============================================================
// 推導
// ============================================================

// 由主色 hex 推導 50–900 色階；同時標出最接近主色明度的階級
function buildScale(baseHex) {
  const baseHsl = rgbToHsl(hexToRgb(baseHex));

  const rows = SCALE.map(({ step, l, sMul }) => ({
    step,
    hex: hslToHex({ h: baseHsl.h, s: clamp(baseHsl.s * sMul, 0, 100), l }),
    l,
  }));

  // 最接近主色明度者標記為 base
  let baseIdx = 0;
  let minDiff = Infinity;
  rows.forEach((row, i) => {
    const diff = Math.abs(row.l - baseHsl.l);
    if (diff < minDiff) { minDiff = diff; baseIdx = i; }
  });
  rows[baseIdx].isBase = true;

  return rows;
}

// 互補（H+180）與類比（H±30）；保留主色的 s/l
function buildHarmony(baseHex) {
  const { h, s, l } = rgbToHsl(hexToRgb(baseHex));
  const at = (deg) => hslToHex({ h: (h + deg + 360) % 360, s, l });
  return [
    { role: 'complementary', label: '互補 +180°', hex: at(180) },
    { role: 'analogous-1', label: '類比 −30°', hex: at(-30) },
    { role: 'analogous-2', label: '類比 +30°', hex: at(30) },
  ];
}

// ============================================================
// 變數碼產生
// ============================================================
function buildCode(scale, harmony, prefix, format) {
  const p = (prefix || 'color').trim().replace(/[^a-z0-9-]/gi, '-') || 'color';
  const lines = [];

  if (format === 'scss') {
    lines.push(`// 主色色階 · 由 ${state.base.toUpperCase()} 推導`);
    scale.forEach(({ step, hex }) => {
      lines.push(`$${p}-${step}: ${hex.toLowerCase()};`);
    });
    lines.push('');
    lines.push('// 調和色');
    harmony.forEach(({ role, hex }) => {
      lines.push(`$${p}-${role}: ${hex.toLowerCase()};`);
    });
  } else {
    lines.push(`:root {`);
    lines.push(`  /* 主色色階 · 由 ${state.base.toUpperCase()} 推導 */`);
    scale.forEach(({ step, hex }) => {
      lines.push(`  --${p}-${step}: ${hex.toLowerCase()};`);
    });
    lines.push('');
    lines.push(`  /* 調和色 */`);
    harmony.forEach(({ role, hex }) => {
      lines.push(`  --${p}-${role}: ${hex.toLowerCase()};`);
    });
    lines.push(`}`);
  }

  return lines.join('\n');
}

// ============================================================
// 渲染
// ============================================================
let currentCode = '';

function render() {
  const scale = buildScale(state.base);
  const harmony = buildHarmony(state.base);

  // 色階色塊
  scaleStrip.replaceChildren(...scale.map(({ step, hex, isBase }) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'swatch' + (isBase ? ' is-base' : '');
    btn.style.background = hex;
    btn.style.color = readableInk(hex);
    btn.title = `點擊複製 ${hex}`;

    const stepEl = document.createElement('span');
    stepEl.className = 'swatch-step';
    stepEl.textContent = isBase ? `${step} ·` : String(step);

    const hexEl = document.createElement('span');
    hexEl.className = 'swatch-hex';
    hexEl.textContent = hex;

    btn.append(stepEl, hexEl);
    btn.addEventListener('click', () => copySwatch(hex));
    return btn;
  }));

  // 調和色卡
  harmonyGrid.replaceChildren(...harmony.map(({ label, hex }) => {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'harmony-card';
    card.title = `點擊複製 ${hex}`;

    const chip = document.createElement('span');
    chip.className = 'harmony-chip';
    chip.style.background = hex;

    const meta = document.createElement('span');
    meta.className = 'harmony-meta';
    const role = document.createElement('span');
    role.className = 'harmony-role';
    role.textContent = label;
    const hexEl = document.createElement('span');
    hexEl.className = 'harmony-hex';
    hexEl.textContent = hex;
    meta.append(role, hexEl);

    card.append(chip, meta);
    card.addEventListener('click', () => copySwatch(hex));
    return card;
  }));

  // 變數碼
  currentCode = buildCode(scale, harmony, state.prefix, state.format);
  codeOutput.textContent = currentCode;
}

// ============================================================
// 互動
// ============================================================

// 顯示一則短暫提示
let hintTimer = null;
function flashHint(msg) {
  copyHint.textContent = msg;
  clearTimeout(hintTimer);
  hintTimer = setTimeout(() => { copyHint.textContent = ''; }, 1600);
}

// 點色塊複製單一 HEX
async function copySwatch(hex) {
  if (await copyText(hex)) {
    flashHint(`已複製 ${hex}`);
    track('use');
  }
}

// 主色色票 → 同步文字框
baseInput.addEventListener('input', () => {
  state.base = baseInput.value;
  hexInput.value = baseInput.value.toUpperCase();
  hexInput.classList.remove('is-invalid');
  render();
});

// 文字框 → 驗證後同步色票
hexInput.addEventListener('input', () => {
  const rgb = hexToRgb(hexInput.value);
  if (rgb) {
    hexInput.classList.remove('is-invalid');
    state.base = rgbToHex(rgb).toLowerCase();
    baseInput.value = state.base;
    render();
  } else {
    hexInput.classList.add('is-invalid');
  }
});

// 變數前綴
prefixInput.addEventListener('input', () => {
  state.prefix = prefixInput.value;
  render();
});

// 輸出格式切換
formatGroup.addEventListener('click', (e) => {
  const chip = e.target.closest('.chip');
  if (!chip) return;
  state.format = chip.dataset.format;
  formatGroup.querySelectorAll('.chip').forEach((c) =>
    c.classList.toggle('is-active', c === chip)
  );
  render();
});

// 複製全部變數
copyBtn.addEventListener('click', async () => {
  if (await copyText(currentCode)) {
    flashHint('已複製全部變數');
    track('use');
  }
});

// 下載檔案（副檔名隨格式）
downloadBtn.addEventListener('click', () => {
  const p = (state.prefix || 'color').trim().replace(/[^a-z0-9-]/gi, '-') || 'color';
  const ext = state.format === 'scss' ? 'scss' : 'css';
  const mime = state.format === 'scss' ? 'text/x-scss' : 'text/css';
  const blob = new Blob([currentCode + '\n'], { type: `${mime};charset=utf-8` });
  downloadBlob(blob, `${p}-palette.${ext}`);
  flashHint(`已下載 ${p}-palette.${ext}`);
  track('use');
});

// 初次渲染
render();
