// ============================================================
// 30 圖片萃取調色盤 — k-means++ 萃取圖片主色，零相依
// 全程瀏覽器端，圖片不上傳；維持 CSP script-src 'self'
// ============================================================
import { bindDropzone, copyText, track } from '../../shared/scripts/shared.js?v=202607131927';

// ── DOM ──────────────────────────────────────────────────────
const dropzone        = document.getElementById('dropzone');
const fileInput       = document.getElementById('file-input');
const imagePreview    = document.getElementById('image-preview');
const previewImg      = document.getElementById('preview-img');
const imageMeta       = document.getElementById('image-meta');
const clearBtn        = document.getElementById('clear-btn');
const controlsBlock   = document.getElementById('controls-block');
const colorCount      = document.getElementById('color-count');
const countOutput     = document.getElementById('count-output');
const extractBtn      = document.getElementById('extract-btn');
const palettePlaceholder = document.getElementById('palette-placeholder');
const paletteComputing   = document.getElementById('palette-computing');
const paletteOutput      = document.getElementById('palette-output');
const paletteList        = document.getElementById('palette-list');
const copyAllBtn         = document.getElementById('copy-all-btn');
const sampleNote         = document.getElementById('sample-note');

// ── 狀態 ─────────────────────────────────────────────────────
let currentImage   = null;  // HTMLImageElement
let currentBlobUrl = null;  // 供 revokeObjectURL 用
let currentColors  = [];    // 最後一次萃取結果

// ── 離屏 Canvas（不插入 DOM）────────────────────────────────
const canvas = document.createElement('canvas');
const ctx    = canvas.getContext('2d', { willReadFrequently: true });

// ============================================================
// 色彩工具
// ============================================================
function rgbToHex(r, g, b) {
  const h = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`.toUpperCase();
}

// ============================================================
// 像素取樣
// 動態步長：目標取樣數約 30K，使 k-means 既快且具代表性
// 略過透明度 < 128 的像素（適用 PNG 透明底、GIF 透明色等）
// ============================================================
function samplePixels(imageData) {
  const { data, width, height } = imageData;
  const step = Math.max(1, Math.ceil(Math.sqrt((width * height) / 30000)));
  const pixels = [];

  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const i = (y * width + x) * 4;
      if (data[i + 3] < 128) continue;
      pixels.push([data[i], data[i + 1], data[i + 2]]);
    }
  }

  return pixels;
}

// ============================================================
// k-means++ 分群演算法
// initCentroids：以加權機率散布初始中心，比純隨機收斂更穩定
// kmeans：指派 → 更新中心，反覆至收斂或達 maxIter
// 回傳依群大小降冪排列的結果（最主要色排最前）
// ============================================================
function sqDist(a, b) {
  return (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
}

function initCentroids(pixels, k) {
  const n = pixels.length;
  const centers = [pixels[Math.floor(Math.random() * n)].slice()];

  for (let c = 1; c < k; c++) {
    // 各像素到最近中心的距離平方，作為挑選下一個中心的機率權重
    const dists = pixels.map((px) => {
      let min = Infinity;
      for (const ct of centers) {
        const d = sqDist(px, ct);
        if (d < min) min = d;
      }
      return min;
    });

    let remaining = Math.random() * dists.reduce((s, d) => s + d, 0);
    let chosen = n - 1;
    for (let i = 0; i < n; i++) {
      remaining -= dists[i];
      if (remaining <= 0) { chosen = i; break; }
    }
    centers.push(pixels[chosen].slice());
  }

  return centers;
}

function kmeans(pixels, k, maxIter = 25) {
  const n = pixels.length;
  const centers = initCentroids(pixels, k);
  const assign  = new Int32Array(n);

  for (let iter = 0; iter < maxIter; iter++) {
    // 指派每個像素到最近的中心
    let changed = false;
    for (let i = 0; i < n; i++) {
      let best = 0;
      let bestD = Infinity;
      for (let j = 0; j < k; j++) {
        const d = sqDist(pixels[i], centers[j]);
        if (d < bestD) { bestD = d; best = j; }
      }
      if (assign[i] !== best) { assign[i] = best; changed = true; }
    }
    if (!changed) break; // 收斂

    // 以各群平均值更新中心
    const sums = Array.from({ length: k }, () => [0, 0, 0, 0]);
    for (let i = 0; i < n; i++) {
      const j = assign[i];
      sums[j][0] += pixels[i][0];
      sums[j][1] += pixels[i][1];
      sums[j][2] += pixels[i][2];
      sums[j][3]++;
    }
    for (let j = 0; j < k; j++) {
      if (sums[j][3] > 0) {
        centers[j] = [
          sums[j][0] / sums[j][3],
          sums[j][1] / sums[j][3],
          sums[j][2] / sums[j][3],
        ];
      }
    }
  }

  // 統計各群像素數，依頻率降冪排序
  const counts = new Int32Array(k);
  for (let i = 0; i < n; i++) counts[assign[i]]++;

  return centers
    .map((c, j) => ({
      r: Math.round(c[0]),
      g: Math.round(c[1]),
      b: Math.round(c[2]),
      count: counts[j],
    }))
    .sort((a, b) => b.count - a.count);
}

// ============================================================
// 萃取主流程（async 讓 "分析中" 狀態有機會渲染）
// 縮放至最大 800px 再取樣：降低資料量同時保留足夠色彩資訊
// ============================================================
async function extract() {
  if (!currentImage) return;

  // 顯示計算中狀態
  palettePlaceholder.hidden = true;
  paletteOutput.hidden      = true;
  paletteComputing.hidden   = false;
  extractBtn.disabled       = true;

  // 讓瀏覽器繪製一幀，使 "分析中" 動畫實際顯示
  await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));

  // 縮放繪製到離屏 canvas（僅縮小，不放大）
  const maxSide = 800;
  const nat     = { w: currentImage.naturalWidth, h: currentImage.naturalHeight };
  const scale   = Math.min(1, maxSide / Math.max(nat.w, nat.h));
  canvas.width  = Math.round(nat.w * scale);
  canvas.height = Math.round(nat.h * scale);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(currentImage, 0, 0, canvas.width, canvas.height);

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const pixels    = samplePixels(imageData);

  if (pixels.length === 0) {
    // 全透明圖（罕見，但優雅處理）
    paletteComputing.hidden  = true;
    palettePlaceholder.hidden = false;
    extractBtn.disabled       = false;
    return;
  }

  const k = Math.min(parseInt(colorCount.value, 10), pixels.length);
  currentColors = kmeans(pixels, k);

  renderPalette(currentColors, pixels.length);

  paletteComputing.hidden = true;
  paletteOutput.hidden    = false;
  extractBtn.disabled     = false;
}

// ============================================================
// 渲染調色盤
// 橫條寬度為「相對於最大群」，標籤顯示「相對於總取樣」的百分比
// ============================================================
function renderPalette(colors, totalSampled) {
  paletteList.innerHTML = '';
  const maxCount = Math.max(...colors.map((c) => c.count));

  colors.forEach((color, i) => {
    const hex   = rgbToHex(color.r, color.g, color.b);
    const rgb   = `rgb(${color.r}, ${color.g}, ${color.b})`;
    const pct   = ((color.count / totalSampled) * 100).toFixed(1);
    const barW  = ((color.count / maxCount) * 100).toFixed(1);

    const row   = document.createElement('div');
    row.className = 'palette-row';
    row.setAttribute('role', 'listitem');
    row.style.setProperty('--i', i);

    row.innerHTML = `
      <div class="palette-swatch" style="background:${hex}" aria-label="${hex} 色票"></div>
      <div class="palette-info">
        <div class="palette-value-row">
          <span class="palette-format-tag">HEX</span>
          <code class="palette-value">${hex}</code>
          <button type="button" class="palette-copy-btn" data-copy="${hex}"
                  aria-label="複製 HEX ${hex}">複製</button>
        </div>
        <div class="palette-value-row">
          <span class="palette-format-tag">RGB</span>
          <code class="palette-value">${rgb}</code>
          <button type="button" class="palette-copy-btn" data-copy="${rgb}"
                  aria-label="複製 RGB ${rgb}">複製</button>
        </div>
        <div class="palette-pct">
          <div class="palette-pct-bar" role="progressbar"
               aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"
               aria-label="佔比 ${pct}%">
            <div class="palette-pct-fill" style="width:${barW}%"></div>
          </div>
          <span class="palette-pct-label">${pct}%</span>
        </div>
      </div>
    `;

    paletteList.appendChild(row);
  });

  sampleNote.textContent = `取樣 ${totalSampled.toLocaleString()} px`;

  // 綁定各行複製按鈕
  paletteList.querySelectorAll('.palette-copy-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const ok = await copyText(btn.dataset.copy);
      if (!ok) return;
      const orig = btn.textContent;
      btn.textContent = '✓';
      btn.classList.add('is-copied');
      setTimeout(() => { btn.textContent = orig; btn.classList.remove('is-copied'); }, 1400);
      track('use');
    });
  });
}

// ============================================================
// 圖片載入
// ============================================================
function loadFile(file) {
  if (!file || !file.type.startsWith('image/')) return;

  const url = URL.createObjectURL(file);
  const img = new Image();

  img.onload = () => {
    // 釋放上一張圖的 Blob URL
    if (currentBlobUrl) URL.revokeObjectURL(currentBlobUrl);
    currentBlobUrl = url;
    currentImage   = img;

    previewImg.src         = url;
    imageMeta.textContent  = `${img.naturalWidth} × ${img.naturalHeight} px`;
    imagePreview.hidden    = false;
    dropzone.hidden        = true;
    controlsBlock.hidden   = false;
    extractBtn.disabled    = false;

    extract();
  };

  img.onerror = () => URL.revokeObjectURL(url);
  img.src = url;
}

// ============================================================
// 互動
// ============================================================

// 拖放（共用函式）
bindDropzone(dropzone, (files) => loadFile(files[0]));

// 點擊拖放區開啟選檔對話框
dropzone.addEventListener('click', () => fileInput.click());
dropzone.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); }
});

// 選檔
fileInput.addEventListener('change', () => {
  if (fileInput.files[0]) loadFile(fileInput.files[0]);
  fileInput.value = ''; // 清除，使重選同一檔仍能觸發 change
});

// 移除圖片，回到初始狀態
clearBtn.addEventListener('click', () => {
  if (currentBlobUrl) { URL.revokeObjectURL(currentBlobUrl); currentBlobUrl = null; }
  currentImage   = null;
  currentColors  = [];
  previewImg.src = '';

  imagePreview.hidden       = true;
  dropzone.hidden           = false;
  controlsBlock.hidden      = true;
  extractBtn.disabled       = true;
  palettePlaceholder.hidden = false;
  paletteOutput.hidden      = true;
  paletteComputing.hidden   = true;
  paletteList.innerHTML     = '';
});

// 數量滑桿：拖曳即時顯示數字，放開才重算（避免每幀都跑 k-means）
colorCount.addEventListener('input', () => {
  countOutput.value = colorCount.value;
});
colorCount.addEventListener('change', () => {
  if (currentImage) extract();
});

// 重新萃取（k-means++ 隨機初始化，每次結果略有差異）
extractBtn.addEventListener('click', () => {
  if (currentImage) extract();
});

// 複製全部 HEX（換行分隔，方便貼進設計軟體）
copyAllBtn.addEventListener('click', async () => {
  if (!currentColors.length) return;
  const text = currentColors.map((c) => rgbToHex(c.r, c.g, c.b)).join('\n');
  const ok   = await copyText(text);
  if (!ok) return;
  const orig = copyAllBtn.textContent;
  copyAllBtn.textContent = '✓ 已複製';
  setTimeout(() => { copyAllBtn.textContent = orig; }, 1400);
  track('use');
});
