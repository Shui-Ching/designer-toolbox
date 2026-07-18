// ============================================================
// 16 圖片格式轉換 — Canvas 客戶端重新編碼：PNG / JPEG / WebP / AVIF 任意對轉
// 與 01 共用「解碼→canvas→toBlob」流程，但聚焦格式互轉：保留原尺寸、顯示來源→目標格式
// ============================================================
import { downloadBlob, formatBytes, bindDropzone, escapeHtml, track } from '../../shared/scripts/shared.js?v=202607181532';

const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('file-input');
const formatGroup = document.getElementById('format-group');
const qualityRow = document.getElementById('quality-row');
const qualitySlider = document.getElementById('quality');
const qualityValue = document.getElementById('quality-value');
const results = document.getElementById('results');
const resultsSummary = document.getElementById('results-summary');
const resultList = document.getElementById('result-list');
const downloadAllBtn = document.getElementById('download-all');
const clearAllBtn = document.getElementById('clear-all');

// 轉換設定（任一改動就全部重轉）
const settings = {
  format: 'image/jpeg',
  quality: 0.8,
};

// 每筆：{ id, name, srcMime, originalSize, bitmap, width, height, blob, outName }
let items = [];
let nextId = 1;

// 副檔名與顯示標籤對照
const EXT = { 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/png': 'png', 'image/avif': 'avif' };
const LABEL = { 'image/jpeg': 'JPEG', 'image/webp': 'WebP', 'image/png': 'PNG', 'image/avif': 'AVIF' };

init();

async function init() {
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
    if (!btn || btn.disabled) return;
    settings.format = btn.dataset.format;
    setActive(formatGroup, btn);
    // PNG 無損：停用品質滑桿
    qualityRow.classList.toggle('is-disabled', settings.format === 'image/png');
    reconvertAll();
  });

  // 品質滑桿
  qualitySlider.addEventListener('input', () => {
    settings.quality = Number(qualitySlider.value) / 100;
    qualityValue.textContent = `${qualitySlider.value}%`;
  });
  qualitySlider.addEventListener('change', reconvertAll); // 放開才重轉，拖曳時不卡

  downloadAllBtn.addEventListener('click', downloadAll);
  clearAllBtn.addEventListener('click', clearAll);

  // 偵測瀏覽器是否支援以 canvas 編碼 WebP / AVIF，不支援就停用該按鈕（避免靜默退回 PNG）
  await markUnsupportedFormats();
}

// — 試編碼一張 1×1 圖，比對回傳 blob.type 是否真為該格式 —
function canEncode(mime) {
  return new Promise((resolve) => {
    const c = document.createElement('canvas');
    c.width = c.height = 1;
    c.toBlob((blob) => resolve(!!blob && blob.type === mime), mime);
  });
}

// — 標記不支援的格式按鈕（停用＋說明）—
async function markUnsupportedFormats() {
  for (const mime of ['image/webp', 'image/avif']) {
    const supported = await canEncode(mime);
    if (supported) continue;
    const btn = formatGroup.querySelector(`[data-format="${mime}"]`);
    if (!btn) continue;
    btn.disabled = true;
    btn.classList.add('is-unavailable');
    btn.title = '此瀏覽器不支援輸出這個格式';
    btn.insertAdjacentHTML('beforeend', '<span class="format-note">不支援</span>');
  }
}

// — 切換按鈕群組的 is-active —
function setActive(group, activeBtn) {
  group.querySelectorAll('button').forEach((b) => b.classList.toggle('is-active', b === activeBtn));
}

// — 接收檔案：過濾出圖片、解碼為點陣圖、逐張轉換 —
async function handleFiles(fileList) {
  const files = [...fileList].filter((f) => f.type.startsWith('image/'));
  if (!files.length) return;

  for (const file of files) {
    try {
      const bitmap = await createImageBitmap(file);
      const item = {
        id: nextId++,
        name: file.name,
        srcMime: file.type,
        originalSize: file.size,
        bitmap,
        width: bitmap.width,
        height: bitmap.height,
        blob: null,
        outName: '',
      };
      items.push(item);
      await convert(item);
    } catch {
      // 單張解碼失敗就跳過，不影響其他檔案
    }
  }
  render();
}

// — 把一張點陣圖以目前目標格式重新編碼成 blob（保留原尺寸）—
function convert(item) {
  return new Promise((resolve) => {
    const { width, height } = item;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    // 不帶透明通道的格式（JPEG）先鋪白底，避免透明區變黑
    if (settings.format === 'image/jpeg') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
    }
    ctx.drawImage(item.bitmap, 0, 0, width, height);

    const quality = settings.format === 'image/png' ? undefined : settings.quality;
    canvas.toBlob(
      (blob) => {
        item.blob = blob;
        item.outMime = blob ? blob.type : settings.format;
        item.outName = buildName(item.name, settings.format);
        resolve();
      },
      settings.format,
      quality
    );
  });
}

// — 重轉全部（設定變更時）—
async function reconvertAll() {
  if (!items.length) return;
  for (const item of items) await convert(item);
  render();
}

// — 換上目標格式的副檔名 —
function buildName(name, format) {
  const base = name.replace(/\.[^.]+$/, '');
  return `${base}.${EXT[format]}`;
}

// — 從 MIME 取顯示標籤（未知就取斜線後段大寫）—
function fmtLabel(mime) {
  return LABEL[mime] || (mime?.split('/')[1] || '?').toUpperCase();
}

// — 渲染結果列表與總計 —
function render() {
  if (!items.length) {
    results.hidden = true;
    return;
  }
  results.hidden = false;

  const totalOriginal = items.reduce((s, it) => s + it.originalSize, 0);
  const totalOut = items.reduce((s, it) => s + (it.blob?.size || 0), 0);
  const saved = totalOriginal - totalOut;
  const savedPct = totalOriginal ? Math.round((saved / totalOriginal) * 100) : 0;
  const sign = saved >= 0 ? '省下' : '增加';
  resultsSummary.innerHTML =
    `共 <strong>${items.length}</strong> 張 · 轉為 <strong>${fmtLabel(settings.format)}</strong> · ` +
    `${formatBytes(totalOriginal)} → <strong>${formatBytes(totalOut)}</strong> · ` +
    `${sign} <strong class="${saved >= 0 ? 'text-accent' : 'text-warn'}">${Math.abs(savedPct)}%</strong>`;

  resultList.innerHTML = items.map(renderItem).join('');
  bindItems();
}

function renderItem(it) {
  const out = it.blob?.size || 0;
  const diff = it.originalSize - out;
  const pct = it.originalSize ? Math.round((diff / it.originalSize) * 100) : 0;
  const up = diff < 0; // 轉完反而變大
  const thumb = URL.createObjectURL(it.blob || new Blob());

  return `
    <li class="result-item" data-id="${it.id}">
      <img class="result-thumb" src="${thumb}" alt="${escapeHtml(it.name)}" loading="lazy">
      <div class="result-info">
        <p class="result-name" title="${escapeHtml(it.name)}">${escapeHtml(it.name)}</p>
        <p class="result-conv">
          <span class="fmt-from">${escapeHtml(fmtLabel(it.srcMime))}</span>
          <span class="fmt-arrow">→</span>
          <span class="fmt-to">${escapeHtml(fmtLabel(it.outMime))}</span>
          <span class="result-dim">${it.width}×${it.height}</span>
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
