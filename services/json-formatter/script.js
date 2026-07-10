// ============================================================
// 38 JSON 格式化／校驗 — 貼上自動排版、即時語法校驗＋錯誤定位
// 純 JSON.parse / JSON.stringify 字串處理，零相依，全程瀏覽器端
// ============================================================
import { copyText, formatBytes, track } from '../../shared/scripts/shared.js?v=202607101719';

const SAMPLE = '{"name":"設計師工具箱","edition":38,"categories":["image","color","css","text","reference","assets","focus","fun"],"isOpenSource":false,"meta":{"author":"Andrew","tags":["design","frontend",null]}}';

// ── DOM 元素 ────────────────────────────────────────────────
const inputEl      = document.getElementById('text-input');
const liveCount    = document.getElementById('live-count');
const sampleBtn    = document.getElementById('sample-btn');
const copyBtn      = document.getElementById('copy-btn');
const clearBtn     = document.getElementById('clear-btn');
const copyHint     = document.getElementById('copy-hint');
const formatBtn    = document.getElementById('format-btn');
const minifyBtn    = document.getElementById('minify-btn');
const indentGroup  = document.getElementById('indent-group');
const statusEl     = document.getElementById('json-status');
const statusBadge  = document.getElementById('status-badge');
const statusMsg    = document.getElementById('status-msg');
const statChars    = document.getElementById('stat-chars');
const statBytes    = document.getElementById('stat-bytes');

let currentIndent = '2'; // '2' | '4' | 'tab'
let lastErrorPos = null;
let debounceTimer = null;

function getIndentValue() {
  return currentIndent === 'tab' ? '\t' : ' '.repeat(Number(currentIndent));
}

// 嘗試解析 JSON，成功回傳資料，失敗回傳原始錯誤訊息
function parseJson(text) {
  try {
    return { ok: true, data: JSON.parse(text) };
  } catch (err) {
    return { ok: false, message: err.message };
  }
}

// 從瀏覽器的 SyntaxError 訊息推算行號／欄號（跨引擎相容 Chromium 的 position 與 Firefox 的 line/column 兩種格式）
function locateError(text, message) {
  const lc = message.match(/line (\d+) column (\d+)/i);
  if (lc) {
    return { line: Number(lc[1]), col: Number(lc[2]), pos: null };
  }

  const p = message.match(/position (\d+)/i);
  const pos = Math.min(p ? Number(p[1]) : text.length, text.length);

  let line = 1, col = 1;
  for (let i = 0; i < pos; i++) {
    if (text[i] === '\n') { line++; col = 1; }
    else col++;
  }
  return { line, col, pos };
}

// ── 即時字元／位元組統計 ─────────────────────────────────────
function updateStats(text) {
  liveCount.textContent = `${text.length.toLocaleString()} 字元`;
  statChars.textContent = text.length.toLocaleString();
  statBytes.textContent = formatBytes(new TextEncoder().encode(text).length);
}

// ── 校驗狀態顯示 ─────────────────────────────────────────────
function setStatus(state, badgeText, msg, errorPos = null) {
  statusEl.dataset.state = state;
  statusBadge.textContent = badgeText;
  statusMsg.textContent = msg;
  lastErrorPos = errorPos;
  statusMsg.classList.toggle('is-clickable', errorPos !== null);
}

function setActionsEnabled(enabled) {
  formatBtn.disabled = !enabled;
  minifyBtn.disabled = !enabled;
}

function validate() {
  const text = inputEl.value;
  updateStats(text);

  if (!text.trim()) {
    setStatus('empty', '尚未輸入', '貼上或輸入 JSON 內容開始使用。');
    setActionsEnabled(false);
    return;
  }

  const result = parseJson(text);
  if (result.ok) {
    setStatus('valid', '有效 JSON', '語法正確，可以格式化或壓縮。');
    setActionsEnabled(true);
  } else {
    const { line, col, pos } = locateError(text, result.message);
    setStatus('invalid', '語法錯誤', `第 ${line} 行、第 ${col} 欄 — ${result.message}（點此定位）`, pos);
    setActionsEnabled(false);
  }
}

// ── 事件綁定 ─────────────────────────────────────────────────
inputEl.addEventListener('input', () => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(validate, 200);
});

// 貼上內容若為合法 JSON，立即依目前縮排設定自動排版
inputEl.addEventListener('paste', () => {
  setTimeout(() => {
    const result = parseJson(inputEl.value);
    if (result.ok) {
      inputEl.value = JSON.stringify(result.data, null, getIndentValue());
      track('use');
    }
    validate();
  }, 0);
});

// 點擊錯誤訊息：跳到錯誤字元位置
statusMsg.addEventListener('click', () => {
  if (lastErrorPos === null) return;
  inputEl.focus();
  const end = Math.min(lastErrorPos + 1, inputEl.value.length);
  inputEl.setSelectionRange(lastErrorPos, end);
});

// 縮排切換
indentGroup.addEventListener('click', (e) => {
  const chip = e.target.closest('.indent-chip');
  if (!chip) return;
  indentGroup.querySelectorAll('.indent-chip').forEach((c) => c.classList.remove('is-active'));
  chip.classList.add('is-active');
  currentIndent = chip.dataset.indent;
});

sampleBtn.addEventListener('click', () => {
  const result = parseJson(SAMPLE);
  inputEl.value = result.ok ? JSON.stringify(result.data, null, getIndentValue()) : SAMPLE;
  validate();
  copyHint.textContent = '';
});

clearBtn.addEventListener('click', () => {
  inputEl.value = '';
  validate();
  copyHint.textContent = '';
});

copyBtn.addEventListener('click', async () => {
  if (!inputEl.value) return;
  const ok = await copyText(inputEl.value);
  if (ok) {
    copyHint.textContent = '已複製！';
    setTimeout(() => { copyHint.textContent = ''; }, 2000);
  }
});

formatBtn.addEventListener('click', () => {
  const result = parseJson(inputEl.value);
  if (!result.ok) return;
  inputEl.value = JSON.stringify(result.data, null, getIndentValue());
  validate();
  track('use');
});

minifyBtn.addEventListener('click', () => {
  const result = parseJson(inputEl.value);
  if (!result.ok) return;
  inputEl.value = JSON.stringify(result.data);
  validate();
  track('use');
});

validate();
