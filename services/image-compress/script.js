// ============================================================
// 01 壓縮圖片 — Canvas 客戶端壓縮：格式 / 品質 / 最大寬度，批次處理與前後對比
// ============================================================
import { downloadBlob, formatBytes, bindDropzone, escapeHtml, track } from '../../shared/scripts/shared.js?v=202607241400';

const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('file-input');
const formatGroup = document.getElementById('format-group');
const qualityRow = document.getElementById('quality-row');
const qualitySlider = document.getElementById('quality');
const qualityValue = document.getElementById('quality-value');
const maxwGroup = document.getElementById('maxw-group');
const results = document.getElementById('results');
const resultsSummary = document.getElementById('results-summary');
const resultList = document.getElementById('result-list');
const downloadAllBtn = document.getElementById('download-all');
const clearAllBtn = document.getElementById('clear-all');

// 壓縮設定（任一改動就全部重壓）
const settings = {
  format: 'image/jpeg',
  quality: 0.8,
  maxWidth: 0, // 0 = 不限制
};

// 每筆：{ id, name, srcType, originalSize, bitmap, width, height, blob, outName }
let items = [];
let nextId = 1;

// 副檔名對照
const EXT = { 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/png': 'png' };

init();

function init() {
  // 拖放與點擊選檔
  bindDropzone(dropzone, handleFiles);
  dropzone.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    if (fileInput.files.length) handleFiles(fileInput.files);
    fileInput.value = ''; // 清空以便重選同檔
  });

  // 輸出格式
  formatGroup.addEventListener('click', (e) => {
    const btn = e.target.closest('.format-chip');
    if (!btn) return;
    settings.format = btn.dataset.format;
    setActive(formatGroup, btn);
    // PNG 無損：停用品質滑桿
    qualityRow.classList.toggle('is-disabled', settings.format === 'image/png');
    recompressAll();
  });

  // 品質滑桿
  qualitySlider.addEventListener('input', () => {
    settings.quality = Number(qualitySlider.value) / 100;
    qualityValue.textContent = `${qualitySlider.value}%`;
  });
  qualitySlider.addEventListener('change', recompressAll); // 放開才重壓，拖曳時不卡

  // 最大寬度
  maxwGroup.addEventListener('click', (e) => {
    const btn = e.target.closest('.maxw-chip');
    if (!btn) return;
    settings.maxWidth = Number(btn.dataset.maxw);
    setActive(maxwGroup, btn);
    recompressAll();
  });

  downloadAllBtn.addEventListener('click', downloadAll);
  clearAllBtn.addEventListener('click', clearAll);
}

// — 切換按鈕群組的 is-active —
function setActive(group, activeBtn) {
  group.querySelectorAll('button').forEach((b) => b.classList.toggle('is-active', b === activeBtn));
}

// — 接收檔案：過濾出圖片、解碼為點陣圖、逐張壓縮 —
async function handleFiles(fileList) {
  const files = [...fileList].filter((f) => f.type.startsWith('image/'));
  if (!files.length) return;

  for (const file of files) {
    try {
      const bitmap = await createImageBitmap(file);
      const item = {
        id: nextId++,
        name: file.name,
        originalSize: file.size,
        bitmap,
        width: bitmap.width,
        height: bitmap.height,
        blob: null,
        outName: '',
      };
      items.push(item);
      await compress(item);
    } catch {
      // 單張解碼失敗就跳過，不影響其他檔案
    }
  }
  render();
}

// — 把一張點陣圖依目前設定畫到 canvas 並輸出 blob —
function compress(item) {
  return new Promise((resolve) => {
    // 依最大寬度等比縮放（只縮不放）
    let { width, height } = item;
    if (settings.maxWidth && width > settings.maxWidth) {
      height = Math.round(height * (settings.maxWidth / width));
      width = settings.maxWidth;
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    // PNG 以外的格式不帶透明通道，先鋪白底避免透明變黑
    if (settings.format !== 'image/png') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
    }
    ctx.drawImage(item.bitmap, 0, 0, width, height);

    const quality = settings.format === 'image/png' ? undefined : settings.quality;
    canvas.toBlob(
      (blob) => {
        item.blob = blob;
        item.outWidth = width;
        item.outHeight = height;
        item.outName = buildName(item.name, settings.format);
        resolve();
      },
      settings.format,
      quality
    );
  });
}

// — 重壓全部（設定變更時）—
async function recompressAll() {
  if (!items.length) return;
  for (const item of items) await compress(item);
  render();
}

// — 依輸出格式換副檔名，並加上 -min 標記 —
function buildName(name, format) {
  const base = name.replace(/\.[^.]+$/, '');
  return `${base}-min.${EXT[format]}`;
}

// — 渲染結果列表與總計 —
function render() {
  if (!items.length) {
    results.hidden = true;
    return;
  }
  results.hidden = false;

  const totalOriginal = items.reduce((s, it) => s + it.originalSize, 0);
  const totalCompressed = items.reduce((s, it) => s + (it.blob?.size || 0), 0);
  const saved = totalOriginal - totalCompressed;
  const savedPct = totalOriginal ? Math.round((saved / totalOriginal) * 100) : 0;
  const sign = saved >= 0 ? '省下' : '增加';
  resultsSummary.innerHTML =
    `共 <strong>${items.length}</strong> 張 · ` +
    `${formatBytes(totalOriginal)} → <strong>${formatBytes(totalCompressed)}</strong> · ` +
    `${sign} <strong class="${saved >= 0 ? 'text-accent' : 'text-warn'}">${Math.abs(savedPct)}%</strong>`;

  resultList.innerHTML = items.map(renderItem).join('');
  bindItems();
}

function renderItem(it) {
  const out = it.blob?.size || 0;
  const diff = it.originalSize - out;
  const pct = it.originalSize ? Math.round((diff / it.originalSize) * 100) : 0;
  const up = diff < 0; // 壓完反而變大
  const thumb = URL.createObjectURL(it.blob || new Blob());
  const resized = it.outWidth !== it.width || it.outHeight !== it.height;

  return `
    <li class="result-item" data-id="${it.id}">
      <img class="result-thumb" src="${thumb}" alt="${escapeHtml(it.name)}" loading="lazy">
      <div class="result-info">
        <p class="result-name" title="${escapeHtml(it.name)}">${escapeHtml(it.name)}</p>
        <p class="result-dim">
          ${it.width}×${it.height}${resized ? ` → ${it.outWidth}×${it.outHeight}` : ''}
        </p>
      </div>
      <div class="result-size">
        <span class="size-from">${formatBytes(it.originalSize)}</span>
        <span class="size-arrow">→</span>
        <span class="size-to">${formatBytes(out)}</span>
        <span class="reduction ${up ? 'is-up' : ''}">${up ? '+' : '−'}${Math.abs(pct)}%</span>
      </div>
      <div class="result-actions">
        <button type="button" class="btn result-download" data-id="${it.id}">下載</button>
        <button type="button" class="result-remove" data-id="${it.id}" aria-label="移除">✕</button>
      </div>
    </li>`;
}

// — 綁定單張的下載 / 移除 —
function bindItems() {
  resultList.querySelectorAll('.result-download').forEach((btn) => {
    btn.addEventListener('click', () => {
      const it = items.find((x) => x.id === Number(btn.dataset.id));
      if (it?.blob) { downloadBlob(it.blob, it.outName); track('use'); }
    });
  });
  resultList.querySelectorAll('.result-remove').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = Number(btn.dataset.id);
      const it = items.find((x) => x.id === id);
      it?.bitmap?.close?.(); // 釋放點陣圖記憶體
      items = items.filter((x) => x.id !== id);
      render();
    });
  });
}

// — 全部下載（依序觸發，間隔避免被瀏覽器擋）—
function downloadAll() {
  items.forEach((it, i) => {
    if (it.blob) setTimeout(() => downloadBlob(it.blob, it.outName), i * 120);
  });
  if (items.some((it) => it.blob)) track('use');
}

// — 清空 —
function clearAll() {
  items.forEach((it) => it.bitmap?.close?.());
  items = [];
  render();
}
