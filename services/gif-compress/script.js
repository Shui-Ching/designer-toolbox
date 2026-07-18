// ============================================================
// 35 GIF 動畫壓縮 — 自寫 GIF 解碼／減色／重編碼，縮放 + 減色降容量 + 前後對比
// ============================================================
import { downloadBlob, formatBytes, bindDropzone, track } from '../../shared/scripts/shared.js?v=202607181532';
import { decodeGif, quantizeFrame, encodeGif } from './gif-codec.js?v=202607181532';

const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('file-input');
const scaleSlider = document.getElementById('scale');
const scaleValue = document.getElementById('scale-value');
const colorsGroup = document.getElementById('colors-group');
const results = document.getElementById('results');
const summary = document.getElementById('results-summary');
const downloadBtn = document.getElementById('download');
const clearBtn = document.getElementById('clear');

// 前後對比面板
const beforeImg = document.getElementById('before-img');
const beforeMeta = document.getElementById('before-meta');
const afterImg = document.getElementById('after-img');
const afterMeta = document.getElementById('after-meta');
const afterPanel = document.getElementById('after-panel');

// 壓縮設定
const settings = { scale: 1, colors: 128 };

// 目前載入的來源 GIF
let source = null; // { name, size, url, width, height, frames, loopCount }
let outBlob = null;
let outUrl = null;
let runId = 0; // 讓過期的處理程序自動作廢

init();

function init() {
  bindDropzone(dropzone, handleFiles);
  dropzone.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    if (fileInput.files.length) handleFiles(fileInput.files);
    fileInput.value = '';
  });

  // 縮放比例：拖曳即時更新標籤與預估尺寸，放開才重壓
  scaleSlider.addEventListener('input', () => {
    settings.scale = Number(scaleSlider.value) / 100;
    scaleValue.textContent = `${scaleSlider.value}%`;
    updateScaleHint();
  });
  scaleSlider.addEventListener('change', process);

  // 色彩數量
  colorsGroup.addEventListener('click', (e) => {
    const btn = e.target.closest('.colors-chip');
    if (!btn) return;
    settings.colors = Number(btn.dataset.colors);
    colorsGroup.querySelectorAll('button').forEach((b) => b.classList.toggle('is-active', b === btn));
    process();
  });

  downloadBtn.addEventListener('click', () => {
    if (!outBlob || !source) return;
    downloadBlob(outBlob, buildName(source.name));
    track('use');
  });
  clearBtn.addEventListener('click', clearAll);
}

// — 接收檔案：只取第一個 GIF，解碼後進入前後對比 —
async function handleFiles(fileList) {
  const file = [...fileList].find((f) => f.type === 'image/gif' || /\.gif$/i.test(f.name));
  if (!file) {
    alert('請丟入 GIF 檔（.gif）。其他圖片格式沒有動畫，請用「壓縮圖片」工具。');
    return;
  }

  try {
    const buf = new Uint8Array(await file.arrayBuffer());
    const decoded = decodeGif(buf);
    if (!decoded.frames.length) throw new Error('沒有可用的影格');

    revokeSource();
    source = {
      name: file.name,
      size: file.size,
      url: URL.createObjectURL(file),
      width: decoded.width,
      height: decoded.height,
      frames: decoded.frames,
      loopCount: decoded.loopCount,
    };

    // 原始面板直接播原檔
    beforeImg.src = source.url;
    beforeMeta.innerHTML =
      `${source.width}×${source.height} · ${source.frames.length} 幀 · <strong>${formatBytes(source.size)}</strong>`;

    // 縮放滑桿歸零回 100%，色數維持
    scaleSlider.value = 100;
    settings.scale = 1;
    scaleValue.textContent = '100%';

    results.hidden = false;
    updateScaleHint();
    await process();
  } catch (err) {
    alert(`無法解析這個 GIF：${err.message}`);
  }
}

// — 依目前設定重新壓縮，並更新「壓縮後」面板 —
async function process() {
  if (!source) return;
  const my = ++runId; // 標記本次執行

  const outW = Math.max(1, Math.round(source.width * settings.scale));
  const outH = Math.max(1, Math.round(source.height * settings.scale));

  afterPanel.classList.add('is-working');
  downloadBtn.disabled = true;

  const encFrames = [];
  for (let i = 0; i < source.frames.length; i++) {
    const f = source.frames[i];
    const rgba = settings.scale === 1
      ? f.rgba
      : resizeRgba(f.rgba, source.width, source.height, outW, outH);
    const q = quantizeFrame(rgba, settings.colors);
    encFrames.push({ ...q, delayCs: f.delayCs });

    // 每幀之間讓出主執行緒，避免畫面凍結；期間若有新設定則作廢本次
    afterPanel.style.setProperty('--progress', `${Math.round(((i + 1) / source.frames.length) * 100)}%`);
    if (source.frames.length > 4) await tick();
    if (my !== runId) return;
  }

  const bytes = encodeGif({ width: outW, height: outH, loopCount: source.loopCount, frames: encFrames });
  if (my !== runId) return;

  if (outUrl) URL.revokeObjectURL(outUrl);
  outBlob = new Blob([bytes], { type: 'image/gif' });
  outUrl = URL.createObjectURL(outBlob);

  afterImg.src = outUrl;
  afterMeta.innerHTML =
    `${outW}×${outH} · ${settings.colors} 色 · <strong>${formatBytes(outBlob.size)}</strong>`;

  renderSummary(outW, outH);
  afterPanel.classList.remove('is-working');
  downloadBtn.disabled = false;
}

// — 前後總計列 —
function renderSummary(outW, outH) {
  const diff = source.size - outBlob.size;
  const pct = source.size ? Math.round((diff / source.size) * 100) : 0;
  const up = diff < 0;
  const resized = outW !== source.width || outH !== source.height;
  summary.innerHTML =
    `${source.frames.length} 幀動畫 · ` +
    (resized ? `${source.width}×${source.height} → ${outW}×${outH} · ` : '') +
    `${formatBytes(source.size)} → <strong>${formatBytes(outBlob.size)}</strong> · ` +
    `${up ? '增加' : '省下'} <strong class="${up ? 'text-warn' : 'text-accent'}">${Math.abs(pct)}%</strong>`;
}

// — 縮放提示：即時顯示預估輸出尺寸（不必等重壓）—
function updateScaleHint() {
  if (!source) return;
  const outW = Math.max(1, Math.round(source.width * settings.scale));
  const outH = Math.max(1, Math.round(source.height * settings.scale));
  scaleValue.textContent = `${Math.round(settings.scale * 100)}% · ${outW}×${outH}`;
}

// — 用 Canvas 等比縮放一幀 RGBA —
function resizeRgba(rgba, w, h, nw, nh) {
  const src = document.createElement('canvas');
  src.width = w; src.height = h;
  src.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(rgba), w, h), 0, 0);

  const dst = document.createElement('canvas');
  dst.width = nw; dst.height = nh;
  const ctx = dst.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, 0, 0, nw, nh);
  return ctx.getImageData(0, 0, nw, nh).data;
}

const tick = () => new Promise((r) => setTimeout(r, 0));

// — 檔名：原名加 -min —
function buildName(name) {
  return `${name.replace(/\.gif$/i, '')}-min.gif`;
}

// — 清除 —
function clearAll() {
  revokeSource();
  source = null;
  outBlob = null;
  results.hidden = true;
  beforeImg.removeAttribute('src');
  afterImg.removeAttribute('src');
}

function revokeSource() {
  if (source?.url) URL.revokeObjectURL(source.url);
  if (outUrl) { URL.revokeObjectURL(outUrl); outUrl = null; }
}
