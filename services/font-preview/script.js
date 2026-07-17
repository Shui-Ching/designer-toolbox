// ============================================================
// 43 字型檔預覽器 — 拖入 TTF/OTF/WOFF 即時預覽字重、字符集、字級瀑布
// 原生 FontFace API 載入字型渲染；中繼資料與字符涵蓋率由 font-parser.js 自寫解析
// ============================================================
import { formatBytes, bindDropzone, copyText, track } from '../../shared/scripts/shared.js?v=202607172333';
import { analyzeFont, isCodepointSupported } from './font-parser.js?v=202607172333';

const WATERFALL_SIZES = [96, 72, 60, 48, 36, 30, 24, 20, 18, 16, 14];
const DEFAULT_WATERFALL_TEXT = 'The quick brown fox jumps over the lazy dog 永安字型預覽 0123456789';
const CARD_PREVIEW_TEXT = 'Ag 永安 09';

const dropzone      = document.getElementById('dropzone');
const fileInput     = document.getElementById('file-input');
const fontGrid      = document.getElementById('font-grid');
const fontGridEmpty = document.getElementById('font-grid-empty');
const detailPanel   = document.getElementById('detail-panel');
const detailEmpty   = document.getElementById('detail-empty');
const metaGrid      = document.getElementById('meta-grid');
const copyMetaBtn   = document.getElementById('copy-meta-btn');
const copyHint      = document.getElementById('copy-hint');
const waterfallText = document.getElementById('waterfall-text');
const waterfallRows = document.getElementById('waterfall-rows');
const coverageList  = document.getElementById('coverage-list');
const charInput     = document.getElementById('charcheck-input');
const charResult    = document.getElementById('charcheck-result');
const charSummary   = document.getElementById('charcheck-summary');

let seq = 0;
const fonts = []; // { id, familyName, name, analysis, face, error }
let activeId = null;

// ── 上傳與解析 ───────────────────────────────────────────────
async function handleFiles(fileList) {
  const files = Array.from(fileList).filter((f) => /\.(ttf|otf|woff)$/i.test(f.name));
  for (const file of files) {
    const id = ++seq;
    const familyName = `fp-font-${id}`;
    const entry = { id, familyName, name: file.name, analysis: null, face: null, error: null };
    fonts.push(entry);
    if (activeId == null) activeId = id;
    renderFontGrid();

    try {
      const analysis = await analyzeFont(file);
      const face = new FontFace(familyName, analysis.buf);
      await face.load();
      document.fonts.add(face);
      entry.analysis = analysis;
      entry.face = face;
      track('use');
    } catch (err) {
      entry.error = err.message || '字型載入失敗，檔案可能已損毀或格式不支援';
    }
    renderFontGrid();
    if (activeId === id) renderDetail();
  }
}

function removeFont(id) {
  const idx = fonts.findIndex((f) => f.id === id);
  if (idx === -1) return;
  const [removed] = fonts.splice(idx, 1);
  if (removed.face) document.fonts.delete(removed.face);
  if (activeId === id) activeId = fonts.length ? fonts[0].id : null;
  renderFontGrid();
  renderDetail();
}

// ── 已上傳字型：卡片網格（各自用自身字型渲染預覽字樣，方便一眼比較字重） ──
function renderFontGrid() {
  fontGrid.innerHTML = '';
  fontGridEmpty.hidden = fonts.length > 0;

  fonts.forEach((entry) => {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'font-card' + (entry.id === activeId ? ' is-active' : '');
    card.dataset.id = String(entry.id);

    const top = document.createElement('div');
    top.className = 'font-card-top';
    const fileName = document.createElement('span');
    fileName.className = 'font-card-filename';
    fileName.textContent = entry.name;
    const removeBtn = document.createElement('span');
    removeBtn.className = 'font-card-remove';
    removeBtn.textContent = '✕';
    removeBtn.title = '移除';
    top.append(fileName, removeBtn);
    card.appendChild(top);

    if (entry.error) {
      const errEl = document.createElement('p');
      errEl.className = 'font-card-error';
      errEl.textContent = entry.error;
      card.appendChild(errEl);
    } else if (entry.analysis) {
      const preview = document.createElement('p');
      preview.className = 'font-card-preview';
      preview.style.fontFamily = `'${entry.familyName}'`;
      preview.textContent = CARD_PREVIEW_TEXT;
      card.appendChild(preview);

      const meta = document.createElement('p');
      meta.className = 'font-card-meta';
      meta.textContent = `${entry.analysis.weightClass} ${entry.analysis.weightName}${entry.analysis.italic ? ' · Italic' : ''} · ${entry.analysis.format.toUpperCase()}`;
      card.appendChild(meta);
    } else {
      const loading = document.createElement('p');
      loading.className = 'font-card-meta';
      loading.textContent = '解析中…';
      card.appendChild(loading);
    }

    card.addEventListener('click', (e) => {
      if (e.target === removeBtn) { removeFont(entry.id); return; }
      activeId = entry.id;
      renderFontGrid();
      renderDetail();
    });

    fontGrid.appendChild(card);
  });
}

// ── 詳細面板：中繼資料 / 字級瀑布 / 涵蓋率 / 缺字檢查 ─────────────
function renderDetail() {
  const entry = fonts.find((f) => f.id === activeId);
  const ready = entry && entry.analysis && !entry.error;

  detailEmpty.hidden = !!ready;
  detailPanel.hidden = !ready;
  if (!ready) return;

  renderMeta(entry);
  renderWaterfall(entry);
  renderCoverage(entry);
  renderCharCheck(entry);
}

function renderMeta(entry) {
  const a = entry.analysis;
  metaGrid.innerHTML = '';
  const rows = [
    ['家族名稱 Family', a.family],
    ['樣式 Subfamily', a.subfamily],
    ['完整名稱', a.fullName || '—'],
    ['PostScript 名稱', a.postScriptName || '—'],
    ['字重 Weight', `${a.weightClass} · ${a.weightName}`],
    ['斜體', a.italic ? '是' : '否'],
    ['格式', a.format.toUpperCase()],
    ['檔案大小', formatBytes(a.file.size)],
    ['字符數（cmap 涵蓋估算）', a.totalCodepoints.toLocaleString('zh-Hant')],
  ];
  rows.forEach(([label, value]) => {
    const dt = document.createElement('div');
    dt.className = 'meta-label';
    dt.textContent = label;
    const dd = document.createElement('div');
    dd.className = 'meta-value';
    dd.textContent = value;
    metaGrid.append(dt, dd);
  });
}

function renderWaterfall(entry) {
  waterfallRows.innerHTML = '';
  const text = waterfallText.value || DEFAULT_WATERFALL_TEXT;
  WATERFALL_SIZES.forEach((size) => {
    const row = document.createElement('div');
    row.className = 'waterfall-row';
    const label = document.createElement('span');
    label.className = 'waterfall-size';
    label.textContent = `${size}px`;
    const sample = document.createElement('span');
    sample.className = 'waterfall-sample';
    sample.style.fontFamily = `'${entry.familyName}'`;
    sample.style.fontSize = `${size}px`;
    sample.textContent = text;
    row.append(label, sample);
    waterfallRows.appendChild(row);
  });
}

function renderCoverage(entry) {
  coverageList.innerHTML = '';
  const blocks = entry.analysis.blocks;
  if (!blocks.length) {
    const empty = document.createElement('p');
    empty.className = 'coverage-empty';
    empty.textContent = '未能從此字型解析出字符對照表（cmap），無法統計涵蓋率。';
    coverageList.appendChild(empty);
    return;
  }
  blocks.forEach((b) => {
    const row = document.createElement('div');
    row.className = 'coverage-row';

    const label = document.createElement('span');
    label.className = 'coverage-label';
    label.textContent = b.name;

    const bar = document.createElement('div');
    bar.className = 'coverage-bar';
    const fill = document.createElement('div');
    fill.className = 'coverage-fill';
    fill.style.width = `${Math.round((b.count / b.total) * 100)}%`;
    bar.appendChild(fill);

    const count = document.createElement('span');
    count.className = 'coverage-count';
    count.textContent = `${b.count} / ${b.total}`;

    row.append(label, bar, count);
    coverageList.appendChild(row);
  });
}

function renderCharCheck(entry) {
  const text = charInput.value;
  charResult.innerHTML = '';
  if (!text) {
    charSummary.textContent = '';
    return;
  }
  const missing = [];
  Array.from(text).forEach((ch) => {
    const cp = ch.codePointAt(0);
    const supported = isCodepointSupported(entry.analysis.ranges, cp);
    const span = document.createElement('span');
    span.className = supported ? 'char-ok' : 'char-missing';
    span.textContent = ch;
    charResult.appendChild(span);
    if (!supported && ch.trim()) missing.push(ch);
  });
  const uniqueMissing = [...new Set(missing)];
  charSummary.textContent = uniqueMissing.length
    ? `缺字 ${uniqueMissing.length} 種：${uniqueMissing.join(' ')}`
    : '全部字元皆已收錄於此字型。';
}

// ── 事件綁定 ─────────────────────────────────────────────────
bindDropzone(dropzone, handleFiles);
dropzone.addEventListener('click', (e) => {
  if (e.target.tagName !== 'INPUT') fileInput.click();
});
fileInput.addEventListener('change', () => {
  if (fileInput.files.length) handleFiles(fileInput.files);
  fileInput.value = '';
});

waterfallText.addEventListener('input', () => {
  const entry = fonts.find((f) => f.id === activeId);
  if (entry && entry.analysis) renderWaterfall(entry);
});

charInput.addEventListener('input', () => {
  const entry = fonts.find((f) => f.id === activeId);
  if (entry && entry.analysis) renderCharCheck(entry);
});

copyMetaBtn.addEventListener('click', async () => {
  const entry = fonts.find((f) => f.id === activeId);
  if (!entry || !entry.analysis) return;
  const a = entry.analysis;
  const summary = [
    `家族名稱：${a.family}`,
    `樣式：${a.subfamily}`,
    `字重：${a.weightClass}（${a.weightName}）${a.italic ? '，Italic' : ''}`,
    `格式：${a.format.toUpperCase()}`,
    `字符數（cmap 涵蓋估算）：${a.totalCodepoints}`,
  ].join('\n');
  const ok = await copyText(summary);
  if (ok) {
    copyHint.textContent = '已複製！';
    track('use');
    setTimeout(() => { copyHint.textContent = ''; }, 2000);
  }
});

renderFontGrid();
renderDetail();
