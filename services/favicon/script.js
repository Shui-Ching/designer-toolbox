// ============================================================
// 07 favicon 產生器 — Canvas 多尺寸縮放 + ICO / ZIP / manifest 打包
// 每次控制項變動就重算整組圖示（6 個尺寸，量小可全量重算）
// ============================================================
import { downloadBlob, copyText, bindDropzone, escapeHtml, track } from '../../shared/scripts/shared.js?v=202606121702';
import { buildIco, buildZip } from './pack.js?v=202606121702';

// 要產生的尺寸清單。inIco 標記的併入 favicon.ico
const SIZES = [
  { name: 'favicon-16x16.png',   size: 16,  inIco: true,  rel: 'icon' },
  { name: 'favicon-32x32.png',   size: 32,  inIco: true,  rel: 'icon' },
  { name: 'favicon-48x48.png',   size: 48,  inIco: true,  rel: 'icon' },
  { name: 'apple-touch-icon.png', size: 180, rel: 'apple' },
  { name: 'icon-192.png',        size: 192, rel: 'manifest' },
  { name: 'icon-512.png',        size: 512, rel: 'manifest' },
];

const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('file-input');
const editor = document.getElementById('editor');
const sourceImg = document.getElementById('source-img');
const sourceName = document.getElementById('source-name');
const sourceDim = document.getElementById('source-dim');
const sourceWarn = document.getElementById('source-warn');
const bgGroup = document.getElementById('bg-group');
const colorRow = document.getElementById('color-row');
const colorInput = document.getElementById('color-input');
const colorValue = document.getElementById('color-value');
const shapeGroup = document.getElementById('shape-group');
const padInput = document.getElementById('pad-input');
const padValue = document.getElementById('pad-value');
const iconGrid = document.getElementById('icon-grid');
const downloadBtn = document.getElementById('download-btn');
const changeBtn = document.getElementById('change-btn');
const htmlSnippet = document.getElementById('html-snippet');
const manifestSnippet = document.getElementById('manifest-snippet');

const state = {
  fileName: 'image',
  image: null,      // 已載入的 HTMLImageElement
  bg: 'transparent',// transparent | solid
  color: '#ffffff',
  shape: 'square',  // square | rounded | circle
  pad: 0,           // 內距百分比（0–30）
  results: [],      // [{ name, size, blob, url }]
};

init();

function init() {
  bindDropzone(dropzone, handleFiles);
  dropzone.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    if (fileInput.files.length) handleFiles(fileInput.files);
    fileInput.value = '';
  });

  bgGroup.addEventListener('click', onBgClick);
  shapeGroup.addEventListener('click', onShapeClick);
  colorInput.addEventListener('input', () => {
    state.color = colorInput.value;
    colorValue.textContent = colorInput.value.toUpperCase();
    regenerate();
  });
  padInput.addEventListener('input', () => {
    state.pad = Number(padInput.value);
    padValue.textContent = `${state.pad}%`;
    regenerate();
  });

  downloadBtn.addEventListener('click', downloadAll);
  changeBtn.addEventListener('click', changeImage);

  // 嵌入碼／manifest 文字固定，先填好；複製鈕事件代理
  htmlSnippet.textContent = buildHtmlSnippet();
  manifestSnippet.textContent = buildManifest();
  document.querySelectorAll('.copy-btn').forEach((btn) => {
    btn.addEventListener('click', () => onCopy(btn));
  });
}

// — 載入圖片 —
function handleFiles(fileList) {
  const file = [...fileList].find((f) => f.type.startsWith('image/'));
  if (!file) return;

  state.fileName = file.name.replace(/\.[^.]+$/, '') || 'image';
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    state.image = img;
    sourceImg.src = url;
    sourceName.textContent = file.name;
    sourceDim.textContent = `${img.naturalWidth} × ${img.naturalHeight} px`;
    sourceWarn.hidden = img.naturalWidth === img.naturalHeight;
    dropzone.hidden = true;
    editor.hidden = false;
    regenerate();
  };
  img.src = url;
}

// ============================================================
// 控制項
// ============================================================
function onBgClick(e) {
  const btn = e.target.closest('.chip');
  if (!btn) return;
  setActive(bgGroup, btn);
  state.bg = btn.dataset.bg;
  colorRow.hidden = state.bg !== 'solid';
  regenerate();
}

function onShapeClick(e) {
  const btn = e.target.closest('.chip');
  if (!btn) return;
  setActive(shapeGroup, btn);
  state.shape = btn.dataset.shape;
  regenerate();
}

function setActive(group, activeBtn) {
  group.querySelectorAll('.chip').forEach((b) => b.classList.toggle('is-active', b === activeBtn));
}

// ============================================================
// 產生整組圖示
// ============================================================
async function regenerate() {
  if (!state.image) return;
  // 釋放上一輪的預覽 URL
  state.results.forEach((r) => URL.revokeObjectURL(r.url));

  const results = [];
  for (const def of SIZES) {
    const blob = await renderIcon(def.size);
    results.push({ ...def, blob, url: URL.createObjectURL(blob) });
  }
  state.results = results;
  renderGrid();
  // theme_color 跟著背景設定走，這裡同步刷新 manifest 預覽
  manifestSnippet.textContent = buildManifest();
}

// 單一尺寸渲染：背景 → 形狀裁切 → 等比 contain 置中貼圖
function renderIcon(size) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingQuality = 'high';

  // 形狀遮罩（背景與圖片都受其裁切）
  clipShape(ctx, size);

  if (state.bg === 'solid') {
    ctx.fillStyle = state.color;
    ctx.fillRect(0, 0, size, size);
  }

  // 內距後的可繪區域
  const inset = size * (state.pad / 100);
  const box = size - inset * 2;
  const img = state.image;
  const scale = Math.min(box / img.naturalWidth, box / img.naturalHeight);
  const dw = img.naturalWidth * scale;
  const dh = img.naturalHeight * scale;
  ctx.drawImage(img, (size - dw) / 2, (size - dh) / 2, dw, dh);

  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}

// 依形狀設定裁切路徑
function clipShape(ctx, size) {
  if (state.shape === 'square') return;
  ctx.beginPath();
  if (state.shape === 'circle') {
    ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
  } else {
    // 圓角：半徑取邊長的 ~22%（接近 iOS / Android 圖示圓角觀感）
    const r = size * 0.22;
    roundRect(ctx, 0, 0, size, size, r);
  }
  ctx.clip();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// — 畫出預覽卡片 —
function renderGrid() {
  iconGrid.innerHTML = '';
  const frag = document.createDocumentFragment();
  state.results.forEach((r) => {
    const card = document.createElement('div');
    card.className = 'icon-card';
    // 顯示尺寸上限 96px：小圖原寸清晰、大圖縮放呈現
    const shown = Math.min(r.size, 96);
    card.innerHTML = `
      <div class="icon-swatch">
        <img src="${r.url}" width="${shown}" height="${shown}" alt="${r.size} 像素圖示">
      </div>
      <div class="icon-meta">
        <span class="icon-size">${r.size} × ${r.size}</span>
        <span class="icon-file">${escapeHtml(r.name)}</span>
      </div>
      <button class="icon-dl" type="button" aria-label="下載 ${escapeHtml(r.name)}">↓</button>`;
    card.querySelector('.icon-dl').addEventListener('click', () => { downloadBlob(r.blob, r.name); track('use'); });
    frag.appendChild(card);
  });
  iconGrid.appendChild(frag);
}

// ============================================================
// 下載 ZIP（整組）
// ============================================================
async function downloadAll() {
  if (!state.results.length) return;
  downloadBtn.disabled = true;
  downloadBtn.textContent = '打包中…';
  try {
    const ico = await buildIco(state.results.filter((r) => r.inIco));
    const files = [
      { name: 'favicon.ico', blob: ico },
      ...state.results.map((r) => ({ name: r.name, blob: r.blob })),
      { name: 'site.webmanifest', blob: new Blob([buildManifest()], { type: 'application/manifest+json' }) },
      { name: 'snippet.html', blob: new Blob([buildHtmlSnippet()], { type: 'text/html' }) },
    ];
    const zip = await buildZip(files);
    downloadBlob(zip, `${state.fileName}-favicons.zip`);
    track('use');
  } finally {
    downloadBtn.disabled = false;
    downloadBtn.textContent = '下載 ZIP';
  }
}

// — 換一張圖：回到上傳狀態 —
function changeImage() {
  state.results.forEach((r) => URL.revokeObjectURL(r.url));
  state.results = [];
  state.image = null;
  iconGrid.innerHTML = '';
  editor.hidden = true;
  dropzone.hidden = false;
  sourceImg.removeAttribute('src');
}

// ============================================================
// 文字產物
// ============================================================
function buildHtmlSnippet() {
  return [
    '<link rel="icon" href="/favicon.ico" sizes="any">',
    '<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">',
    '<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">',
    '<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">',
    '<link rel="manifest" href="/site.webmanifest">',
  ].join('\n');
}

function buildManifest() {
  const theme = state.bg === 'solid' ? state.color : '#ffffff';
  return JSON.stringify({
    name: '',
    short_name: '',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    theme_color: theme,
    background_color: theme,
    display: 'standalone',
  }, null, 2);
}

// — 複製鈕：成功後短暫回饋 —
async function onCopy(btn) {
  const text = btn.dataset.copy === 'manifest' ? buildManifest() : buildHtmlSnippet();
  if (await copyText(text)) {
    const original = btn.textContent;
    btn.textContent = '已複製';
    setTimeout(() => { btn.textContent = original; }, 1600);
  }
}
