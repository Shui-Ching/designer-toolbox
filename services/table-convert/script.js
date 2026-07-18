// ============================================================
// 42 CSV ↔ Markdown/JSON 表格轉換
// 自寫 CSV/TSV 解析器（處理引號跳脫、跨行欄位），零相依，全程瀏覽器端
// 分隔符號可自動偵測或手動指定；首列可選作標題列或視為純資料
// ============================================================
import { copyText, track } from '../../shared/scripts/shared.js?v=202607181532';

const SAMPLE = '姓名,部門,備註\n王小明,設計,"擅長 UI, UX"\n陳美麗,工程,"負責前端，含 CSS／SCSS"\n李大同,行銷,';

// ── DOM 元素 ────────────────────────────────────────────────
const inputEl      = document.getElementById('csv-input');
const parseStat    = document.getElementById('parse-stat');
const sampleBtn    = document.getElementById('sample-btn');
const clearBtn     = document.getElementById('clear-btn');
const delimGroup   = document.getElementById('delim-group');
const headerGroup  = document.getElementById('header-group');
const formatGroup  = document.getElementById('format-group');
const copyBtn      = document.getElementById('copy-output-btn');
const copyHint     = document.getElementById('copy-hint');
const outputArea   = document.getElementById('output-area');
const previewWrap  = document.getElementById('preview-wrap');
const previewEmpty = document.getElementById('preview-empty');
const previewTable = document.getElementById('preview-table');

let delimMode = 'auto';   // 'auto' | ',' | 'tab' | ';'
let hasHeader = true;
let outputFormat = 'markdown'; // 'markdown' | 'json'
let debounceTimer = null;

// ── 解析：CSV/TSV，支援雙引號跳脫（含跨行、內含分隔符與雙引號的欄位）──
function parseDelimited(text, delimiter) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  let i = 0;
  const len = text.length;

  while (i < len) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQuotes = false; i++; continue;
      }
      field += ch; i++; continue;
    }

    if (ch === '"') { inQuotes = true; i++; continue; }
    if (ch === delimiter) { row.push(field); field = ''; i++; continue; }
    if (ch === '\r') { i++; continue; }
    if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; i++; continue; }
    field += ch; i++;
  }
  if (field !== '' || row.length > 0) { row.push(field); rows.push(row); }

  // 過濾純粹的空白行（貼上時常見的格式雜訊，非資料）
  return rows.filter((r) => !(r.length === 1 && r[0].trim() === ''));
}

// 依前 5 行的字元分布猜分隔符：忽略引號內的字元，Tab 優先（Excel／試算表複製貼上最常見）
function detectDelimiter(text) {
  const sample = text.split(/\r\n|\r|\n/).slice(0, 5).join('\n');
  const counts = { ',': 0, '\t': 0, ';': 0 };
  let inQuotes = false;
  for (const ch of sample) {
    if (ch === '"') { inQuotes = !inQuotes; continue; }
    if (!inQuotes && ch in counts) counts[ch]++;
  }
  if (counts['\t'] > 0) return '\t';
  return counts[','] >= counts[';'] ? ',' : ';';
}

function resolveDelimiter(text) {
  if (delimMode === 'auto') return detectDelimiter(text);
  return delimMode === 'tab' ? '\t' : delimMode;
}

// 補齊每列欄位數到最大欄數，回傳等寬的二維陣列
function normalizeRows(rows) {
  const colCount = rows.reduce((max, r) => Math.max(max, r.length), 0);
  return rows.map((r) => {
    const cells = r.slice(0, colCount);
    while (cells.length < colCount) cells.push('');
    return cells;
  });
}

// ── 輸出：Markdown 表格 ──────────────────────────────────────
function escapeMdCell(cell) {
  return cell.replace(/\\/g, '\\\\').replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>').trim();
}

function toMarkdown(norm, header) {
  if (norm.length === 0) return '';
  const colCount = norm[0].length;
  const headRow = (header || Array.from({ length: colCount }, (_, i) => `欄位 ${i + 1}`)).map(escapeMdCell);
  const bodyRows = (header ? norm.slice(1) : norm).map((r) => r.map(escapeMdCell));

  const lines = [
    '| ' + headRow.join(' | ') + ' |',
    '| ' + headRow.map(() => '---').join(' | ') + ' |',
    ...bodyRows.map((r) => '| ' + r.join(' | ') + ' |'),
  ];
  return lines.join('\n');
}

// ── 輸出：JSON（有標題列 → 物件陣列；無標題列 → 陣列的陣列） ──
function toJson(norm, header) {
  if (norm.length === 0) return '[]';
  if (!header) return JSON.stringify(norm, null, 2);

  const keys = header.map((h, i) => h.trim() || `欄位 ${i + 1}`);
  const body = norm.slice(1);
  const data = body.map((r) => {
    const obj = {};
    keys.forEach((k, i) => { obj[k] = r[i]; });
    return obj;
  });
  return JSON.stringify(data, null, 2);
}

// ── 預覽表格（DOM 組裝，textContent 防 XSS） ──────────────────
function renderPreview(norm, header) {
  previewTable.innerHTML = '';

  if (norm.length === 0) {
    previewTable.hidden = true;
    previewEmpty.hidden = false;
    return;
  }
  previewTable.hidden = false;
  previewEmpty.hidden = true;

  const colCount = norm[0].length;
  const headRow = header || Array.from({ length: colCount }, (_, i) => `欄位 ${i + 1}`);
  const bodyRows = header ? norm.slice(1) : norm;

  const thead = document.createElement('thead');
  const headTr = document.createElement('tr');
  headRow.forEach((cell) => {
    const th = document.createElement('th');
    th.textContent = cell;
    headTr.appendChild(th);
  });
  thead.appendChild(headTr);

  const tbody = document.createElement('tbody');
  bodyRows.forEach((r) => {
    const tr = document.createElement('tr');
    r.forEach((cell) => {
      const td = document.createElement('td');
      td.textContent = cell;
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });

  previewTable.appendChild(thead);
  previewTable.appendChild(tbody);
}

// ── 主流程：解析 → 轉換 → 渲染 ─────────────────────────────────
let lastMarkdown = '';
let lastJson = '';

function render() {
  const text = inputEl.value;

  if (!text.trim()) {
    parseStat.textContent = '尚未輸入';
    lastMarkdown = '';
    lastJson = '';
    outputArea.value = '';
    renderPreview([], null);
    return;
  }

  const delimiter = resolveDelimiter(text);
  const rows = parseDelimited(text, delimiter);
  const norm = normalizeRows(rows);
  const header = hasHeader ? norm[0] : null;
  const bodyCount = hasHeader ? Math.max(norm.length - 1, 0) : norm.length;
  const colCount = norm.length ? norm[0].length : 0;

  const delimLabel = delimiter === '\t' ? 'Tab' : delimiter === ';' ? '分號' : '逗號';
  parseStat.textContent = `${bodyCount} 列 × ${colCount} 欄（分隔符號：${delimLabel}）`;

  lastMarkdown = toMarkdown(norm, header);
  lastJson = toJson(norm, header);
  outputArea.value = outputFormat === 'markdown' ? lastMarkdown : lastJson;
  renderPreview(norm, header);
}

// ── 事件綁定 ─────────────────────────────────────────────────
inputEl.addEventListener('input', () => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(render, 200);
});

delimGroup.addEventListener('click', (e) => {
  const chip = e.target.closest('.opt-chip');
  if (!chip) return;
  delimGroup.querySelectorAll('.opt-chip').forEach((c) => c.classList.remove('is-active'));
  chip.classList.add('is-active');
  delimMode = chip.dataset.delim;
  render();
});

headerGroup.addEventListener('click', (e) => {
  const chip = e.target.closest('.opt-chip');
  if (!chip) return;
  headerGroup.querySelectorAll('.opt-chip').forEach((c) => c.classList.remove('is-active'));
  chip.classList.add('is-active');
  hasHeader = chip.dataset.header === 'yes';
  render();
});

formatGroup.addEventListener('click', (e) => {
  const chip = e.target.closest('.opt-chip');
  if (!chip) return;
  formatGroup.querySelectorAll('.opt-chip').forEach((c) => c.classList.remove('is-active'));
  chip.classList.add('is-active');
  outputFormat = chip.dataset.format;
  outputArea.value = outputFormat === 'markdown' ? lastMarkdown : lastJson;
});

sampleBtn.addEventListener('click', () => {
  inputEl.value = SAMPLE;
  render();
  copyHint.textContent = '';
});

clearBtn.addEventListener('click', () => {
  inputEl.value = '';
  render();
  copyHint.textContent = '';
});

copyBtn.addEventListener('click', async () => {
  if (!outputArea.value) return;
  const ok = await copyText(outputArea.value);
  if (ok) {
    copyHint.textContent = '已複製！';
    track('use');
    setTimeout(() => { copyHint.textContent = ''; }, 2000);
  }
});

render();
