// ============================================================
// 20 PDF 壓縮 — 逐頁光柵化重編碼
// pdf.js 把每頁 render 成 canvas → 重新編碼成 JPEG → pdf-lib 重組成新 PDF
// 代價：文字變影像、不可選取；換來大幅且可控的體積縮減
// pdf.js / pdf-lib 皆本機 vendor（維持 CSP script-src 'self'），首次拖檔才動態載入
// ============================================================
import { downloadBlob, formatBytes, bindDropzone, escapeHtml, track } from '../../shared/scripts/shared.js?v=202607181201';

const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('file-input');
const dpiGroup = document.getElementById('dpi-group');
const qualitySlider = document.getElementById('quality');
const qualityValue = document.getElementById('quality-value');
const engineStatus = document.getElementById('engine-status');
const results = document.getElementById('results');
const resultsSummary = document.getElementById('results-summary');
const resultList = document.getElementById('result-list');
const downloadAllBtn = document.getElementById('download-all');
const clearAllBtn = document.getElementById('clear-all');

// 大檔提示門檻：超過即在該列標註「檔案較大，處理需要一些時間」
const BIG_FILE = 30 * 1024 * 1024; // 30 MB

// 壓縮設定（任一改動就把所有項目重壓）
const settings = {
  dpi: 150,
  quality: 0.75,
};

// 每筆：{ id, name, originalSize, pdfDoc, pageCount, blob, outName,
//        status, error, progress, thumb, big }
// status：parsing｜queued｜processing｜done｜error
let items = [];
let nextId = 1;

// — 重壓佇列控制 —
// runToken 一變更代表設定已換，進行中的迴圈會自我中止，由 finally 重新開跑
let runToken = 0;
let running = false;

// 動態載入的函式庫（首次拖檔才載），含 cmaps／standard_fonts 路徑
let libs = null;

init();

function init() {
  bindDropzone(dropzone, addFiles);
  dropzone.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    if (fileInput.files.length) addFiles(fileInput.files);
    fileInput.value = ''; // 清空以便重選同檔
  });

  // 解析度（改動即重壓全部）
  dpiGroup.addEventListener('click', (e) => {
    const btn = e.target.closest('.dpi-chip');
    if (!btn) return;
    settings.dpi = Number(btn.dataset.dpi);
    setActive(dpiGroup, btn);
    reprocessAll();
  });

  // 品質滑桿：拖曳即時更新數字、放開才重壓（避免每格都重繪整份）
  qualitySlider.addEventListener('input', () => {
    settings.quality = Number(qualitySlider.value) / 100;
    qualityValue.textContent = `${qualitySlider.value}%`;
  });
  qualitySlider.addEventListener('change', reprocessAll);

  downloadAllBtn.addEventListener('click', downloadAll);
  clearAllBtn.addEventListener('click', clearAll);
}

// — 首次載入 pdf.js / pdf-lib（本機 vendor）；以 import.meta.url 為基準解析 worker 與資源路徑 —
async function loadLibs() {
  if (libs) return libs;
  engineStatus.hidden = false;
  try {
    const [pdfjs, PDFLib] = await Promise.all([
      import('./vendor/pdf.min.mjs'),
      import('./vendor/pdf-lib.esm.min.js'),
    ]);
    const base = new URL('./vendor/', import.meta.url).href;
    // worker、CMap（CJK 編碼）、標準 14 字型皆指向本機 vendor，維持同源
    pdfjs.GlobalWorkerOptions.workerSrc = base + 'pdf.worker.min.mjs';
    libs = {
      pdfjs,
      PDFLib,
      cMapUrl: base + 'cmaps/',
      standardFontDataUrl: base + 'standard_fonts/',
    };
    return libs;
  } finally {
    engineStatus.hidden = true;
  }
}

// — 切換按鈕群組的 is-active —
function setActive(group, activeBtn) {
  group.querySelectorAll('button').forEach((b) => b.classList.toggle('is-active', b === activeBtn));
}

// — 接收檔案：過濾 PDF、逐份解析、排入壓縮佇列 —
async function addFiles(fileList) {
  const files = [...fileList].filter((f) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name));
  if (!files.length) return;

  await loadLibs(); // 首次會下載壓縮引擎

  for (const file of files) {
    const item = {
      id: nextId++,
      name: file.name,
      originalSize: file.size,
      pdfDoc: null,
      pageCount: 0,
      blob: null,
      outName: '',
      status: 'parsing',
      error: '',
      progress: null,
      thumb: '',
      big: file.size > BIG_FILE,
    };
    items.push(item);
    render();

    try {
      const data = new Uint8Array(await file.arrayBuffer());
      const task = libs.pdfjs.getDocument({
        data,
        cMapUrl: libs.cMapUrl,
        cMapPacked: true,
        standardFontDataUrl: libs.standardFontDataUrl,
      });
      item.pdfDoc = await task.promise;
      item.pageCount = item.pdfDoc.numPages;
      item.outName = file.name.replace(/\.pdf$/i, '') + '-compressed.pdf';
      item.thumb = await makeThumb(item.pdfDoc);
      item.status = 'queued';
    } catch (e) {
      item.status = 'error';
      item.error = e?.name === 'PasswordException' ? '受密碼保護的 PDF 不支援' : '無法解析此 PDF';
    }
    render();
  }

  run();
}

// — 第一頁縮圖（固定小尺寸，僅供清單預覽；不隨設定重繪）—
async function makeThumb(pdfDoc) {
  try {
    const page = await pdfDoc.getPage(1);
    const target = 56 * (window.devicePixelRatio || 1);
    const raw = page.getViewport({ scale: 1 });
    const scale = target / Math.max(raw.width, raw.height);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport }).promise;
    page.cleanup();
    return canvas.toDataURL('image/jpeg', 0.7);
  } catch {
    return ''; // 縮圖失敗不影響壓縮
  }
}

// — 設定變更：作廢進行中的迴圈、把可重壓的項目重新排隊、重新開跑 —
function reprocessAll() {
  runToken++;
  items.forEach((it) => {
    if (it.status !== 'error' && it.status !== 'parsing') it.status = 'queued';
  });
  run();
}

// — 佇列主迴圈：依序壓縮所有 queued 項目；設定中途變更即中止並重啟 —
async function run() {
  if (running) return;
  running = true;
  const token = runToken;
  try {
    for (const item of items) {
      if (token !== runToken) break; // 設定已變更，放棄這輪
      if (item.status !== 'queued') continue;
      await compress(item, token);
    }
  } finally {
    running = false;
    if (token !== runToken) run(); // 中途有變更 → 重新開跑
  }
}

// — 壓縮單份：逐頁 render→JPEG→嵌入新 PDF；保留各頁實體尺寸（point）—
async function compress(item, token) {
  item.status = 'processing';
  item.progress = { cur: 0, total: item.pageCount };
  render();

  try {
    const outDoc = await libs.PDFLib.PDFDocument.create();
    const scale = settings.dpi / 72; // pdf.js scale 1 = 72 DPI，故以 dpi/72 放大
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    for (let p = 1; p <= item.pageCount; p++) {
      if (token !== runToken) return; // 設定已變更，放棄這份

      const page = await item.pdfDoc.getPage(p);
      const viewport = page.getViewport({ scale });
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      // JPEG 無透明通道，先鋪白底避免透明區變黑
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx, viewport }).promise;
      page.cleanup();

      const jpegBlob = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', settings.quality));
      const jpegBytes = new Uint8Array(await jpegBlob.arrayBuffer());
      const img = await outDoc.embedJpg(jpegBytes);

      // 還原成原頁實體尺寸（point），讓輸出 PDF 的頁面大小與來源一致
      const wPt = (canvas.width * 72) / settings.dpi;
      const hPt = (canvas.height * 72) / settings.dpi;
      const pdfPage = outDoc.addPage([wPt, hPt]);
      pdfPage.drawImage(img, { x: 0, y: 0, width: wPt, height: hPt });

      item.progress.cur = p;
      render();
    }

    if (token !== runToken) return;

    const bytes = await outDoc.save();
    item.blob = new Blob([bytes], { type: 'application/pdf' });
    item.status = 'done';
  } catch (e) {
    item.status = 'error';
    item.error = '壓縮失敗：' + (e?.message || '未知錯誤');
  }
  item.progress = null;
  render();
}

// — 渲染結果列表與總計 —
function render() {
  if (!items.length) {
    results.hidden = true;
    return;
  }
  results.hidden = false;

  // 總計只納入已完成的項目
  const done = items.filter((it) => it.status === 'done' && it.blob);
  if (done.length) {
    const totalOriginal = done.reduce((s, it) => s + it.originalSize, 0);
    const totalOut = done.reduce((s, it) => s + it.blob.size, 0);
    const saved = totalOriginal - totalOut;
    const savedPct = totalOriginal ? Math.round((saved / totalOriginal) * 100) : 0;
    const sign = saved >= 0 ? '省下' : '增加';
    resultsSummary.innerHTML =
      `已完成 <strong>${done.length}</strong> / ${items.length} 份 · ` +
      `${formatBytes(totalOriginal)} → <strong>${formatBytes(totalOut)}</strong> · ` +
      `${sign} <strong class="${saved >= 0 ? 'text-accent' : 'text-warn'}">${Math.abs(savedPct)}%</strong>`;
  } else {
    resultsSummary.innerHTML = `共 <strong>${items.length}</strong> 份 · 處理中…`;
  }

  resultList.innerHTML = items.map(renderItem).join('');
  bindItems();
}

function renderItem(it) {
  const thumb = it.thumb
    ? `<img class="result-thumb" src="${it.thumb}" alt="${escapeHtml(it.name)} 第一頁" loading="lazy">`
    : `<span class="result-thumb result-thumb-empty" aria-hidden="true">PDF</span>`;

  return `
    <li class="result-item is-${it.status}" data-id="${it.id}">
      ${thumb}
      <div class="result-info">
        <p class="result-name" title="${escapeHtml(it.name)}">${escapeHtml(it.name)}</p>
        ${renderMeta(it)}
      </div>
      <div class="result-size">${renderSize(it)}</div>
      <div class="result-actions">
        ${it.status === 'done'
          ? `<button type="button" class="btn result-download" data-id="${it.id}">下載</button>`
          : ''}
        <button type="button" class="result-remove" data-id="${it.id}" aria-label="移除">✕</button>
      </div>
    </li>`;
}

// — 中段：依狀態顯示頁數／進度／錯誤 —
function renderMeta(it) {
  if (it.status === 'error') {
    return `<p class="result-meta is-error">${escapeHtml(it.error)}</p>`;
  }
  if (it.status === 'parsing') {
    return `<p class="result-meta">解析中…</p>`;
  }
  if (it.status === 'processing') {
    const { cur, total } = it.progress || { cur: 0, total: it.pageCount };
    const pct = total ? Math.round((cur / total) * 100) : 0;
    return `
      <p class="result-meta">壓縮中… ${cur} / ${total} 頁</p>
      <div class="progress" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100">
        <span class="progress-bar" style="width:${pct}%"></span>
      </div>`;
  }
  // queued / done
  const big = it.big ? `<span class="result-warn">檔案較大，處理需要一些時間</span>` : '';
  const tail = it.status === 'queued'
    ? '等待壓縮'
    : `解析度 ${settings.dpi} · 品質 ${Math.round(settings.quality * 100)}%`;
  return `<p class="result-meta">${it.pageCount} 頁 · ${tail}${big ? ' · ' : ''}${big}</p>`;
}

// — 右段：完成才顯示大小對比 —
function renderSize(it) {
  if (it.status !== 'done' || !it.blob) return '';
  const out = it.blob.size;
  const diff = it.originalSize - out;
  const pct = it.originalSize ? Math.round((diff / it.originalSize) * 100) : 0;
  const up = diff < 0; // 壓完反而變大
  return `
    <span class="size-from">${formatBytes(it.originalSize)}</span>
    <span class="size-arrow">→</span>
    <span class="size-to">${formatBytes(out)}</span>
    <span class="reduction ${up ? 'is-up' : ''}">${up ? '+' : '−'}${Math.abs(pct)}%</span>`;
}

// — 綁定單份的下載 / 移除 —
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
      it?.pdfDoc?.destroy?.(); // 釋放 pdf.js 文件記憶體
      items = items.filter((x) => x.id !== id);
      render();
    });
  });
}

// — 全部下載（只下載已完成者，依序觸發避免被瀏覽器擋）—
function downloadAll() {
  const done = items.filter((it) => it.status === 'done' && it.blob);
  done.forEach((it, i) => setTimeout(() => downloadBlob(it.blob, it.outName), i * 150));
  if (done.length) track('use');
}

// — 清空 —
function clearAll() {
  runToken++; // 中止任何進行中的壓縮
  items.forEach((it) => it.pdfDoc?.destroy?.());
  items = [];
  render();
}
