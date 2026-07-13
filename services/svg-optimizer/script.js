// ============================================================
// 33 SVG 壓縮器 — 純前端 SVGO-lite：批次優化 SVG，壓縮前後大小對比與下載
// ============================================================
import { downloadBlob, copyText, formatBytes, bindDropzone, escapeHtml, track } from '../../shared/scripts/shared.js?v=202607131742';
import { optimizeSvg } from './svgo-lite.js?v=202607131742';

const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('file-input');
const precisionGroup = document.getElementById('precision-group');
const optionGroup = document.getElementById('option-group');
const results = document.getElementById('results');
const resultsSummary = document.getElementById('results-summary');
const resultList = document.getElementById('result-list');
const downloadAllBtn = document.getElementById('download-all');
const clearAllBtn = document.getElementById('clear-all');

// 優化設定（任一改動就全部重壓）
const settings = {
  precision: 2,
  removeComments: true,
  removeMetadata: true,
  removeEmptyGroups: true,
  removeEditorData: true,
};

// 每筆：{ id, name, source, originalSize, output, optimizedSize, error }
let items = [];
let nextId = 1;

init();

function init() {
  // 拖放與點擊選檔
  bindDropzone(dropzone, handleFiles);
  dropzone.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    if (fileInput.files.length) handleFiles(fileInput.files);
    fileInput.value = ''; // 清空以便重選同檔
  });

  // 數字精度（單選）
  precisionGroup.addEventListener('click', (e) => {
    const btn = e.target.closest('.opt-chip');
    if (!btn) return;
    settings.precision = Number(btn.dataset.precision);
    precisionGroup.querySelectorAll('.opt-chip').forEach((b) => b.classList.toggle('is-active', b === btn));
    reoptimizeAll();
  });

  // 優化項目（可多選切換）
  optionGroup.addEventListener('click', (e) => {
    const btn = e.target.closest('.opt-chip');
    if (!btn) return;
    const on = !btn.classList.contains('is-active');
    btn.classList.toggle('is-active', on);
    btn.setAttribute('aria-pressed', String(on));
    settings[btn.dataset.opt] = on;
    reoptimizeAll();
  });

  downloadAllBtn.addEventListener('click', downloadAll);
  clearAllBtn.addEventListener('click', clearAll);
}

// — 接收檔案：過濾出 SVG、讀成文字、逐個優化 —
async function handleFiles(fileList) {
  const files = [...fileList].filter(
    (f) => f.type === 'image/svg+xml' || f.name.toLowerCase().endsWith('.svg')
  );
  if (!files.length) return;

  for (const file of files) {
    try {
      const source = await file.text();
      const item = {
        id: nextId++,
        name: file.name,
        source,
        originalSize: file.size,
        output: '',
        optimizedSize: 0,
        error: '',
      };
      items.push(item);
      optimize(item);
    } catch {
      // 單檔讀取失敗就跳過，不影響其他檔案
    }
  }
  render();
}

// — 依目前設定優化單筆，把結果與大小寫回 item —
function optimize(item) {
  try {
    item.output = optimizeSvg(item.source, settings);
    item.optimizedSize = new Blob([item.output]).size;
    item.error = '';
  } catch (err) {
    item.output = '';
    item.optimizedSize = item.originalSize;
    item.error = err.message || '優化失敗';
  }
}

// — 重壓全部（設定變更時）—
function reoptimizeAll() {
  if (!items.length) return;
  items.forEach(optimize);
  render();
}

// — 渲染結果列表與總計 —
function render() {
  if (!items.length) {
    results.hidden = true;
    return;
  }
  results.hidden = false;

  // 只統計成功優化的檔案
  const ok = items.filter((it) => !it.error);
  const totalOriginal = ok.reduce((s, it) => s + it.originalSize, 0);
  const totalOptimized = ok.reduce((s, it) => s + it.optimizedSize, 0);
  const saved = totalOriginal - totalOptimized;
  const savedPct = totalOriginal ? Math.round((saved / totalOriginal) * 100) : 0;
  const sign = saved >= 0 ? '省下' : '增加';
  resultsSummary.innerHTML =
    `共 <strong>${items.length}</strong> 個 · ` +
    `${formatBytes(totalOriginal)} → <strong>${formatBytes(totalOptimized)}</strong> · ` +
    `${sign} <strong class="${saved >= 0 ? 'text-accent' : 'text-warn'}">${Math.abs(savedPct)}%</strong>`;

  resultList.innerHTML = items.map(renderItem).join('');
  bindItems();
}

function renderItem(it) {
  // 解析失敗：只顯示錯誤列，不給下載
  if (it.error) {
    return `
      <li class="result-item is-error" data-id="${it.id}">
        <div class="result-thumb result-thumb-fail" aria-hidden="true">!</div>
        <div class="result-info">
          <p class="result-name" title="${escapeHtml(it.name)}">${escapeHtml(it.name)}</p>
          <p class="result-dim">${escapeHtml(it.error)}</p>
        </div>
        <div class="result-size"><span class="size-from">${formatBytes(it.originalSize)}</span></div>
        <div class="result-actions">
          <button type="button" class="result-remove" data-id="${it.id}" aria-label="移除">✕</button>
        </div>
      </li>`;
  }

  const diff = it.originalSize - it.optimizedSize;
  const pct = it.originalSize ? Math.round((diff / it.originalSize) * 100) : 0;
  const up = diff < 0; // 壓完反而變大
  // 優化後的 SVG 直接當縮圖預覽（data URI，受 CSP img-src data: 允許）
  const thumb = `data:image/svg+xml;utf8,${encodeURIComponent(it.output)}`;

  return `
    <li class="result-item" data-id="${it.id}">
      <img class="result-thumb" src="${thumb}" alt="${escapeHtml(it.name)} 預覽" loading="lazy">
      <div class="result-info">
        <p class="result-name" title="${escapeHtml(it.name)}">${escapeHtml(it.name)}</p>
        <p class="result-dim">SVG 向量圖</p>
      </div>
      <div class="result-size">
        <span class="size-from">${formatBytes(it.originalSize)}</span>
        <span class="size-arrow">→</span>
        <span class="size-to">${formatBytes(it.optimizedSize)}</span>
        <span class="reduction ${up ? 'is-up' : ''}">${up ? '+' : '−'}${Math.abs(pct)}%</span>
      </div>
      <div class="result-actions">
        <button type="button" class="btn result-copy" data-id="${it.id}">複製</button>
        <button type="button" class="btn result-download" data-id="${it.id}">下載</button>
        <button type="button" class="result-remove" data-id="${it.id}" aria-label="移除">✕</button>
      </div>
    </li>`;
}

// — 綁定單筆的複製 / 下載 / 移除 —
function bindItems() {
  resultList.querySelectorAll('.result-copy').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const it = items.find((x) => x.id === Number(btn.dataset.id));
      if (it?.output && (await copyText(it.output))) {
        flash(btn, '已複製');
        track('use');
      }
    });
  });
  resultList.querySelectorAll('.result-download').forEach((btn) => {
    btn.addEventListener('click', () => {
      const it = items.find((x) => x.id === Number(btn.dataset.id));
      if (it?.output) {
        downloadBlob(new Blob([it.output], { type: 'image/svg+xml' }), buildName(it.name));
        track('use');
      }
    });
  });
  resultList.querySelectorAll('.result-remove').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = Number(btn.dataset.id);
      items = items.filter((x) => x.id !== id);
      render();
    });
  });
}

// — 在加上 -min 標記的同時保留 .svg 副檔名 —
function buildName(name) {
  const base = name.replace(/\.svg$/i, '');
  return `${base}-min.svg`;
}

// — 暫時改按鈕文字回饋（複製成功）—
function flash(btn, text) {
  const original = btn.textContent;
  btn.textContent = text;
  setTimeout(() => { btn.textContent = original; }, 1400);
}

// — 全部下載（依序觸發，間隔避免被瀏覽器擋）—
function downloadAll() {
  const ok = items.filter((it) => it.output);
  ok.forEach((it, i) => {
    setTimeout(() => downloadBlob(new Blob([it.output], { type: 'image/svg+xml' }), buildName(it.name)), i * 120);
  });
  if (ok.length) track('use');
}

// — 清空 —
function clearAll() {
  items = [];
  render();
}
