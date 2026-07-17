// ============================================================
// 44 佔位圖產生器 — 畫面互動：狀態 → render.js 純運算 → canvas 預覽／PNG／SVG 輸出
// ============================================================
import { downloadBlob, copyText, track } from '../../shared/scripts/shared.js?v=202607172223';
import { buildSpec, buildSvgString, drawToCanvas, hexToRgb } from './render.js?v=202607172223';

const $ = (id) => document.getElementById(id);

const wInput = $('w-input');
const hInput = $('h-input');
const swapBtn = $('swap-btn');
const socialSelect = $('social-select');
const bgPicker = $('bg-picker');
const bgHex = $('bg-hex');
const textInput = $('text-input');
const styleGroup = $('style-group');
const formatGroup = $('format-group');
const readoutDim = $('readout-dim');
const downloadBtn = $('download-btn');
const copySvgBtn = $('copy-svg-btn');
const copyHint = $('copy-hint');
const canvas = $('preview-canvas');
const ctx = canvas.getContext('2d');

// 單一真實來源：畫面上的每個控制項都只是這份 state 的視圖
const state = {
  width: 1080,
  height: 1080,
  bg: '#d8442a',
  customText: '',
  style: 'centered',
  format: 'png',
};

let currentSpec = null; // 上次 render() 算出的完整規格，下載／複製直接複用

init();

function init() {
  bgHex.value = state.bg.toUpperCase();

  wInput.addEventListener('input', () => onSizeInput(wInput, 'width'));
  hInput.addEventListener('input', () => onSizeInput(hInput, 'height'));
  swapBtn.addEventListener('click', onSwap);

  bgPicker.addEventListener('input', () => {
    state.bg = bgPicker.value;
    bgHex.value = state.bg.toUpperCase();
    bgHex.classList.remove('is-invalid');
    render();
  });

  bgHex.addEventListener('input', () => {
    const rgb = hexToRgb(bgHex.value);
    if (!rgb) { bgHex.classList.add('is-invalid'); return; }
    bgHex.classList.remove('is-invalid');
    const raw = bgHex.value.trim();
    state.bg = raw.startsWith('#') ? raw : `#${raw}`;
    bgPicker.value = toPickerHex(rgb);
    render();
  });
  bgHex.addEventListener('blur', () => {
    bgHex.classList.remove('is-invalid');
    bgHex.value = state.bg.toUpperCase();
  });

  textInput.addEventListener('input', () => {
    state.customText = textInput.value;
    render();
  });

  styleGroup.addEventListener('click', (e) => {
    const chip = e.target.closest('[data-style]');
    if (!chip) return;
    state.style = chip.dataset.style;
    setActive(styleGroup, chip);
    render();
  });

  formatGroup.addEventListener('click', (e) => {
    const chip = e.target.closest('[data-format]');
    if (!chip) return;
    state.format = chip.dataset.format;
    setActive(formatGroup, chip);
    downloadBtn.textContent = state.format === 'png' ? '下載 PNG' : '下載 SVG';
    copySvgBtn.hidden = state.format !== 'svg';
  });

  socialSelect.addEventListener('change', onSocialChange);
  downloadBtn.addEventListener('click', download);
  copySvgBtn.addEventListener('click', copySvg);

  loadSocialPresets();
  render();

  // 首次進站時 Inter 字型可能還沒就緒，就緒後補畫一次避免 canvas 文字用到系統預設字型
  if (document.fonts) document.fonts.ready.then(render);
}

// ============================================================
// 控制項事件
// ============================================================

// 寬／高輸入：16–4000 內才視為有效並重繪，超出範圍標紅但不清空欄位
function onSizeInput(input, key) {
  const n = Math.round(Number(input.value));
  const valid = Number.isFinite(n) && n >= 16 && n <= 4000;
  input.classList.toggle('is-invalid', !valid);
  if (!valid) return;
  state[key] = n;
  socialSelect.value = '';
  render();
}

function onSwap() {
  [state.width, state.height] = [state.height, state.width];
  wInput.value = state.width;
  hInput.value = state.height;
  wInput.classList.remove('is-invalid');
  hInput.classList.remove('is-invalid');
  socialSelect.value = '';
  render();
}

function onSocialChange() {
  const opt = socialSelect.selectedOptions[0];
  const w = Number(opt?.dataset.w);
  const h = Number(opt?.dataset.h);
  if (!w || !h) return;
  state.width = w;
  state.height = h;
  wInput.value = w;
  hInput.value = h;
  wInput.classList.remove('is-invalid');
  hInput.classList.remove('is-invalid');
  render();
}

function setActive(group, activeBtn) {
  group.querySelectorAll('.chip').forEach((b) => b.classList.toggle('is-active', b === activeBtn));
}

// type="color" 只吃小寫 #rrggbb，把任意合法 HEX 正規化成這個形式
function toPickerHex({ r, g, b }) {
  const to = (v) => v.toString(16).padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`;
}

// ============================================================
// 渲染：算出規格、畫到 canvas、更新讀數
// ============================================================
function render() {
  currentSpec = buildSpec({
    width: state.width,
    height: state.height,
    bg: state.bg,
    customText: state.customText,
    style: state.style,
  });
  canvas.width = currentSpec.width;
  canvas.height = currentSpec.height;
  drawToCanvas(ctx, currentSpec);
  readoutDim.textContent = `${currentSpec.width} × ${currentSpec.height} px`;
}

// ============================================================
// 輸出：下載 PNG／SVG、複製 SVG 原始碼
// ============================================================
function download() {
  if (!currentSpec) return;
  const name = `placeholder-${currentSpec.width}x${currentSpec.height}`;
  if (state.format === 'png') {
    canvas.toBlob((blob) => {
      downloadBlob(blob, `${name}.png`);
      track('use');
    }, 'image/png');
  } else {
    const blob = new Blob([buildSvgString(currentSpec)], { type: 'image/svg+xml' });
    downloadBlob(blob, `${name}.svg`);
    track('use');
  }
}

async function copySvg() {
  if (!currentSpec) return;
  const ok = await copyText(buildSvgString(currentSpec));
  copyHint.textContent = ok ? '已複製 SVG 原始碼' : '複製失敗，請改用下載';
  if (ok) track('use');
  setTimeout(() => { copyHint.textContent = ''; }, 1800);
}

// ============================================================
// 社群版位下拉（讀 03 的 social-sizes.json，失敗則靜默略過）
// ============================================================
async function loadSocialPresets() {
  try {
    const res = await fetch('../../shared/data/social-sizes.json');
    const data = await res.json();
    const frag = document.createDocumentFragment();
    data.platforms.forEach((p) => {
      const group = document.createElement('optgroup');
      group.label = p.name;
      p.formats.forEach((f) => {
        const opt = document.createElement('option');
        opt.value = `${p.id}:${f.label}`;
        opt.dataset.w = f.width;
        opt.dataset.h = f.height;
        opt.textContent = `${f.label} · ${f.width}×${f.height}`;
        group.appendChild(opt);
      });
      frag.appendChild(group);
    });
    socialSelect.appendChild(frag);
  } catch {
    // file:// 直開時 fetch 可能被擋；靜默略過，不影響手動輸入尺寸
  }
}
