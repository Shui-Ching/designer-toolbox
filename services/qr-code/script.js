// ============================================================
// 08 QR Code 產生器 — 互動邏輯
// 即時把內容編碼成 QR 矩陣，預覽 SVG，並可下載 SVG / PNG。
// 全程瀏覽器端；track 只送中性的工具代號，不送使用者輸入內容。
// ============================================================
import { downloadBlob, copyText, track } from '../../shared/scripts/shared.js?v=202607101402';
import { encodeQr } from './qr-encode.js?v=202607101402';

// — 設定狀態 —
const state = {
  text: 'https://github.com',
  ecl: 'M',
  fg: '#1c1b18',
  bg: '#ffffff',
  quiet: 4,
  pngSize: 512,
};

// — 元素 —
const $ = (id) => document.getElementById(id);
const textInput = $('text-input');
const byteCount = $('byte-count');
const eclGroup = $('ecl-group');
const fgInput = $('fg-input');
const bgInput = $('bg-input');
const fgValue = $('fg-value');
const bgValue = $('bg-value');
const contrastWarn = $('contrast-warn');
const quietInput = $('quiet-input');
const quietValue = $('quiet-value');
const sizeGroup = $('size-group');
const previewFrame = $('preview-frame');
const previewEmpty = $('preview-empty');
const statVersion = $('stat-version');
const statModules = $('stat-modules');
const statEcl = $('stat-ecl');
const downloadPngBtn = $('download-png');
const downloadSvgBtn = $('download-svg');
const copySvgBtn = $('copy-svg');

// 目前算好的矩陣（供下載／複製複用，避免重複編碼）
let currentMatrix = null;

// — 由矩陣組出 SVG 字串；每個黑點畫成 1×1 方格，外加留白邊 —
function buildSvgString(matrix) {
  const n = matrix.length;
  const total = n + state.quiet * 2;
  let path = '';
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (matrix[y][x]) path += `M${x + state.quiet} ${y + state.quiet}h1v1h-1z`;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" `
    + `shape-rendering="crispEdges" role="img" aria-label="QR Code">`
    + `<rect width="${total}" height="${total}" fill="${state.bg}"/>`
    + `<path d="${path}" fill="${state.fg}"/></svg>`;
}

// — 相對亮度與對比比（WCAG），用來提醒前景／背景對比過低 —
function relativeLuminance(hex) {
  const c = hex.replace('#', '');
  const rgb = [0, 1, 2].map((i) => {
    const v = parseInt(c.substr(i * 2, 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
}

function contrastRatio(a, b) {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

// — 主渲染：重新編碼並更新預覽與統計 —
function render() {
  const text = state.text;
  const hasText = text.length > 0;

  // 對比提醒：比例 < 3 或前景比背景亮（淺底深點才好掃）都警示
  const lowContrast = contrastRatio(state.fg, state.bg) < 3
    || relativeLuminance(state.fg) > relativeLuminance(state.bg);
  contrastWarn.hidden = !lowContrast;

  if (!hasText) {
    currentMatrix = null;
    previewFrame.innerHTML = '';
    previewFrame.hidden = true;
    previewEmpty.hidden = false;
    statVersion.textContent = '—';
    statModules.textContent = '—';
    statEcl.textContent = '—';
    setActionsEnabled(false);
    return;
  }

  try {
    const matrix = encodeQr(text, state.ecl);
    currentMatrix = matrix;
    const n = matrix.length;
    previewFrame.innerHTML = buildSvgString(matrix);
    previewFrame.hidden = false;
    previewEmpty.hidden = true;
    statVersion.textContent = `v${(n - 17) / 4}`;
    statModules.textContent = `${n}×${n}`;
    statEcl.textContent = state.ecl;
    setActionsEnabled(true);
  } catch (err) {
    // 內容超過 QR 最大容量
    currentMatrix = null;
    previewFrame.innerHTML = '';
    previewFrame.hidden = true;
    previewEmpty.hidden = false;
    previewEmpty.textContent = err.message || '無法產生 QR Code';
    setActionsEnabled(false);
  }
}

function setActionsEnabled(enabled) {
  [downloadPngBtn, downloadSvgBtn, copySvgBtn].forEach((b) => { b.disabled = !enabled; });
}

// — 下載 SVG —
function downloadSvg() {
  if (!currentMatrix) return;
  const blob = new Blob([buildSvgString(currentMatrix)], { type: 'image/svg+xml' });
  downloadBlob(blob, 'qrcode.svg');
  track('use');
}

// — 下載 PNG：以整數倍率把模組畫到 canvas，邊緣銳利 —
function downloadPng() {
  if (!currentMatrix) return;
  const n = currentMatrix.length;
  const total = n + state.quiet * 2;
  const scale = Math.max(1, Math.floor(state.pngSize / total));
  const dim = total * scale;

  const canvas = document.createElement('canvas');
  canvas.width = dim;
  canvas.height = dim;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = state.bg;
  ctx.fillRect(0, 0, dim, dim);
  ctx.fillStyle = state.fg;
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (currentMatrix[y][x]) {
        ctx.fillRect((x + state.quiet) * scale, (y + state.quiet) * scale, scale, scale);
      }
    }
  }
  canvas.toBlob((blob) => {
    downloadBlob(blob, 'qrcode.png');
    track('use');
  }, 'image/png');
}

// — 複製 SVG 原始碼 —
async function copySvg() {
  if (!currentMatrix) return;
  const ok = await copyText(buildSvgString(currentMatrix));
  if (ok) {
    const original = copySvgBtn.textContent;
    copySvgBtn.textContent = '已複製';
    setTimeout(() => { copySvgBtn.textContent = original; }, 1600);
    track('use');
  }
}

// ============================================================
// 事件綁定
// ============================================================

// 內容輸入（即時，輕量防抖避免快速打字時頻繁重編）
let inputTimer = null;
textInput.addEventListener('input', () => {
  state.text = textInput.value;
  byteCount.textContent = new TextEncoder().encode(state.text).length;
  clearTimeout(inputTimer);
  inputTimer = setTimeout(render, 120);
});

// 容錯等級
eclGroup.addEventListener('click', (e) => {
  const chip = e.target.closest('[data-ecl]');
  if (!chip) return;
  state.ecl = chip.dataset.ecl;
  eclGroup.querySelectorAll('.chip').forEach((c) => c.classList.toggle('is-active', c === chip));
  render();
});

// PNG 尺寸
sizeGroup.addEventListener('click', (e) => {
  const chip = e.target.closest('[data-size]');
  if (!chip) return;
  state.pngSize = Number(chip.dataset.size);
  sizeGroup.querySelectorAll('.chip').forEach((c) => c.classList.toggle('is-active', c === chip));
});

// 顏色
fgInput.addEventListener('input', () => {
  state.fg = fgInput.value;
  fgValue.textContent = fgInput.value.toUpperCase();
  render();
});
bgInput.addEventListener('input', () => {
  state.bg = bgInput.value;
  bgValue.textContent = bgInput.value.toUpperCase();
  render();
});

// 留白
quietInput.addEventListener('input', () => {
  state.quiet = Number(quietInput.value);
  quietValue.textContent = quietInput.value;
  render();
});

// 動作鈕
downloadPngBtn.addEventListener('click', downloadPng);
downloadSvgBtn.addEventListener('click', downloadSvg);
copySvgBtn.addEventListener('click', copySvg);

// — 初始化 —
textInput.value = state.text;
byteCount.textContent = new TextEncoder().encode(state.text).length;
fgValue.textContent = state.fg.toUpperCase();
bgValue.textContent = state.bg.toUpperCase();
render();
