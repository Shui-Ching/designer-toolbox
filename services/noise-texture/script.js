// ============================================================
// 49 噪點／紋理產生器 — 可平鋪的噪點／點陣／格線紋理磚
// 零相依、全在瀏覽器端運算，維持 CSP script-src 'self'
// 核心運算（PRNG／幾何／SVG 組裝）抽在 texture-core.js，零 DOM 供 Node 測試
// ============================================================
import { downloadBlob, copyText, track } from '../../shared/scripts/shared.js?v=202607181532';
import {
  renderGrainRGBA, dotsGeometry, linesGeometry,
  buildTileSvg, normalizeHex, hexToRgb,
} from './texture-core.js?v=202607181532';

// — DOM —
const typeGroup = document.getElementById('type-group');
const seedInput = document.getElementById('seed-input');
const rerollBtn = document.getElementById('reroll-btn');
const fillPicker = document.getElementById('fill-picker');
const fillHex = document.getElementById('fill-hex');
const bgModeGroup = document.getElementById('bg-mode-group');
const bgColorRow = document.getElementById('bg-color-row');
const bgPicker = document.getElementById('bg-picker');
const bgHex = document.getElementById('bg-hex');
const stageTiled = document.getElementById('stage-tiled');
const tileOutline = document.getElementById('tile-outline');
const stageHint = document.getElementById('stage-hint');
const codeTag = document.getElementById('code-tag');
const codeOut = document.getElementById('code-out');
const codeNote = document.getElementById('code-note');
const copyBtn = document.getElementById('copy-btn');
const downloadPngBtn = document.getElementById('download-png-btn');
const downloadSvgBtn = document.getElementById('download-svg-btn');
const copyHint = document.getElementById('copy-hint');

// 各類型的滑桿：id 對應 state 欄位，統一掛事件
const SLIDERS = [
  { id: 'grain-tile', type: 'grain', key: 'tile' },
  { id: 'grain-density', type: 'grain', key: 'density' },
  { id: 'grain-size', type: 'grain', key: 'size' },
  { id: 'grain-strength', type: 'grain', key: 'strength' },
  { id: 'dots-spacing', type: 'dots', key: 'spacing' },
  { id: 'dots-size', type: 'dots', key: 'dotSize' },
  { id: 'lines-spacing', type: 'lines', key: 'spacing' },
  { id: 'lines-width', type: 'lines', key: 'width' },
];

// — 單一真實來源 state（各類型參數分開保存，切換互不干擾）—
const state = {
  type: 'grain',
  seed: newSeed(),
  fill: '#1c1b18',
  bgMode: 'transparent', // 'transparent' | 'custom'
  bgColor: '#f4f1e8',
  grain: { tile: 128, density: 50, size: 1, strength: 60 },
  dots: { spacing: 24, dotSize: 4, stagger: false },
  lines: { spacing: 24, width: 1, mode: 'grid' },
};

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

// 擲一顆新種子（0–999999）：取 crypto 亂數源，僅需視覺隨機非公平性用途，取模即可
function newSeed() {
  return crypto.getRandomValues(new Uint32Array(1))[0] % 1000000;
}

// ============================================================
// 磚塊繪製：state → canvas（單一磚）
// 重複使用同兩顆 canvas，滑桿連續拖動時不狂建物件
// ============================================================
const tileCanvas = document.createElement('canvas');
const tileCtx = tileCanvas.getContext('2d');
const grainCanvas = document.createElement('canvas');
const grainCtx = grainCanvas.getContext('2d');

function buildTile() {
  const { type, seed, fill, bgMode, bgColor } = state;
  const bg = bgMode === 'custom' ? bgColor : null;

  if (type === 'grain') {
    const { tile, density, size, strength } = state.grain;
    tileCanvas.width = tileCanvas.height = tile;
    if (bg) {
      tileCtx.fillStyle = bg;
      tileCtx.fillRect(0, 0, tile, tile);
    }
    // putImageData 會整塊覆寫（含透明），先畫到暫存層再合成，背景色才留得住
    grainCanvas.width = grainCanvas.height = tile;
    const rgba = renderGrainRGBA(seed, tile, size, density, strength, hexToRgb(fill));
    grainCtx.putImageData(new ImageData(rgba, tile, tile), 0, 0);
    tileCtx.drawImage(grainCanvas, 0, 0);
    return { w: tile, h: tile, svg: null };
  }

  const geo = type === 'dots'
    ? dotsGeometry(state.dots.spacing, state.dots.dotSize, state.dots.stagger)
    : linesGeometry(state.lines.spacing, state.lines.width, state.lines.mode);

  tileCanvas.width = geo.w;
  tileCanvas.height = geo.h;
  if (bg) {
    tileCtx.fillStyle = bg;
    tileCtx.fillRect(0, 0, geo.w, geo.h);
  }
  tileCtx.fillStyle = fill;
  for (const [cx, cy, r] of geo.circles || []) {
    tileCtx.beginPath();
    tileCtx.arc(cx, cy, r, 0, Math.PI * 2);
    tileCtx.fill();
  }
  for (const [x, y, w, h] of geo.rects || []) {
    tileCtx.fillRect(x, y, w, h);
  }
  const svg = buildTileSvg({ ...geo, fill, bg });
  return { w: geo.w, h: geo.h, svg };
}

// ============================================================
// 渲染：磚塊 → 平鋪預覽 + 輸出程式碼
// ============================================================
// 目前輸出的完整內容（複製／下載時取用；畫面上的 data URI 只顯示截斷版）
const current = { css: '', svg: '', dataUrl: '', w: 0, h: 0 };

function render() {
  const { w, h, svg } = buildTile();
  const dataUrl = tileCanvas.toDataURL('image/png');
  const isGrain = state.type === 'grain';

  current.svg = svg || '';
  current.dataUrl = dataUrl;
  current.w = w;
  current.h = h;
  current.css = [
    `background-image: url(${dataUrl});`,
    `background-size: ${w}px ${h}px;`,
    'background-repeat: repeat;',
  ].join('\n');

  // 平鋪預覽：紋理磚疊在棋盤格上（透明背景時看得出穿透）
  stageTiled.style.backgroundImage =
    `url(${dataUrl}), repeating-conic-gradient(color-mix(in srgb, var(--color-ink) 7%, transparent) 0% 25%, transparent 0% 50%)`;
  stageTiled.style.backgroundSize = `${w}px ${h}px, 24px 24px`;
  stageTiled.classList.toggle('is-grain', isGrain);
  tileOutline.style.width = `${w}px`;
  tileOutline.style.height = `${h}px`;
  // 磚塊小於標籤字寬時只畫框不顯示字，避免文字溢出虛線框
  tileOutline.textContent = w >= 64 && h >= 32 ? 'tile' : '';

  stageHint.textContent = `磚塊 ${w}×${h}px · 以 CSS repeat 平鋪驗證無縫`;

  // 輸出區：噪點給 CSS data URI 背景（像素亂數無法無損轉向量，不出 SVG）；
  // 點陣／格線給 SVG 原始碼
  codeTag.textContent = isGrain ? 'CSS' : 'SVG';
  codeOut.textContent = isGrain ? truncatedCss(dataUrl, w, h) : current.svg;
  codeNote.hidden = !isGrain;
  downloadSvgBtn.hidden = isGrain;
}

// 畫面顯示用：data URI 截斷成頭尾＋大小標示，避免幾十 KB 的 base64 塞爆畫面
function truncatedCss(dataUrl, w, h) {
  const kb = (dataUrl.length * 0.75 / 1024).toFixed(1); // base64 → bytes 約 3/4
  const shown = dataUrl.length > 96
    ? `${dataUrl.slice(0, 64)}⋯（PNG 約 ${kb} KB）⋯${dataUrl.slice(-8)}`
    : dataUrl;
  return `background-image: url(${shown});\nbackground-size: ${w}px ${h}px;\nbackground-repeat: repeat;`;
}

// 依目前類型顯示對應的控制區塊
function syncControlVisibility() {
  document.querySelectorAll('[data-show]').forEach((el) => {
    el.hidden = el.dataset.show !== state.type;
  });
}

// ============================================================
// 控制項事件
// ============================================================
typeGroup.addEventListener('click', (e) => {
  const chip = e.target.closest('.chip');
  if (!chip) return;
  state.type = chip.dataset.type;
  typeGroup.querySelectorAll('.chip').forEach((c) => c.classList.toggle('is-active', c === chip));
  syncControlVisibility();
  render();
});

rerollBtn.addEventListener('click', () => {
  state.seed = newSeed();
  seedInput.value = state.seed;
  seedInput.classList.remove('is-invalid');
  render();
});

seedInput.addEventListener('input', () => {
  const n = parseInt(seedInput.value, 10);
  if (Number.isFinite(n)) {
    state.seed = clamp(n, 0, 999999);
    seedInput.classList.remove('is-invalid');
    render();
  } else {
    seedInput.classList.add('is-invalid');
  }
});
seedInput.addEventListener('blur', () => {
  seedInput.value = state.seed;
  seedInput.classList.remove('is-invalid');
});

// 滑桿統一掛法：值進對應 state 欄位＋更新讀數
for (const { id, type, key } of SLIDERS) {
  const input = document.getElementById(id);
  const val = document.getElementById(`${id}-val`);
  input.addEventListener('input', () => {
    state[type][key] = parseInt(input.value, 10);
    val.textContent = input.value;
    render();
  });
}

// 點陣排列／格線樣式 chip
document.getElementById('dots-layout-group').addEventListener('click', (e) => {
  const chip = e.target.closest('.chip');
  if (!chip) return;
  state.dots.stagger = chip.dataset.stagger === 'true';
  chip.parentElement.querySelectorAll('.chip').forEach((c) => c.classList.toggle('is-active', c === chip));
  render();
});

document.getElementById('lines-mode-group').addEventListener('click', (e) => {
  const chip = e.target.closest('.chip');
  if (!chip) return;
  state.lines.mode = chip.dataset.mode;
  chip.parentElement.querySelectorAll('.chip').forEach((c) => c.classList.toggle('is-active', c === chip));
  render();
});

// — 顏色：色票與 HEX 欄雙向同步，HEX 先過 normalizeHex 白名單才入 state —
function bindColorPair(picker, hexInput, apply) {
  picker.addEventListener('input', () => {
    apply(picker.value);
    hexInput.value = picker.value;
    hexInput.classList.remove('is-invalid');
    render();
  });
  hexInput.addEventListener('input', () => {
    const hex = normalizeHex(hexInput.value);
    if (hex) {
      apply(hex);
      picker.value = hex;
      hexInput.classList.remove('is-invalid');
      render();
    } else {
      hexInput.classList.add('is-invalid');
    }
  });
}

bindColorPair(fillPicker, fillHex, (hex) => { state.fill = hex; });
fillHex.addEventListener('blur', () => {
  fillHex.value = state.fill;
  fillHex.classList.remove('is-invalid');
});

bindColorPair(bgPicker, bgHex, (hex) => { state.bgColor = hex; });
bgHex.addEventListener('blur', () => {
  bgHex.value = state.bgColor;
  bgHex.classList.remove('is-invalid');
});

bgModeGroup.addEventListener('click', (e) => {
  const chip = e.target.closest('.chip');
  if (!chip) return;
  state.bgMode = chip.dataset.bg;
  bgModeGroup.querySelectorAll('.chip').forEach((c) => c.classList.toggle('is-active', c === chip));
  bgColorRow.hidden = state.bgMode !== 'custom';
  render();
});

// ============================================================
// 複製與下載
// ============================================================
let hintTimer = null;
function showHint(text) {
  copyHint.textContent = text;
  clearTimeout(hintTimer);
  hintTimer = setTimeout(() => { copyHint.textContent = ''; }, 1600);
}

// 檔名：噪點帶種子可重現，點陣／格線帶間距好辨識
function baseFilename() {
  if (state.type === 'grain') return `grain-${state.seed}`;
  if (state.type === 'dots') return `dots-${state.dots.spacing}px`;
  return `lines-${state.lines.spacing}px`;
}

copyBtn.addEventListener('click', async () => {
  const isGrain = state.type === 'grain';
  if (await copyText(isGrain ? current.css : current.svg)) {
    showHint(isGrain ? '已複製完整 CSS 背景到剪貼簿' : '已複製 SVG 原始碼到剪貼簿');
    track('use');
  }
});

downloadPngBtn.addEventListener('click', () => {
  tileCanvas.toBlob((blob) => {
    if (!blob) return;
    downloadBlob(blob, `${baseFilename()}.png`);
    showHint('已下載 PNG 紋理磚');
    track('use');
  }, 'image/png');
});

downloadSvgBtn.addEventListener('click', () => {
  const blob = new Blob([current.svg], { type: 'image/svg+xml' });
  downloadBlob(blob, `${baseFilename()}.svg`);
  showHint('已下載 SVG 紋理磚');
  track('use');
});

// — 首次渲染 —
seedInput.value = state.seed;
fillHex.value = state.fill;
bgHex.value = state.bgColor;
syncControlVisibility();
render();
