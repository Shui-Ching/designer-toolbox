// ============================================================
// 38 JSON 格式化／校驗 — 貼上自動排版、即時語法校驗＋錯誤定位
// 編輯區為 CodeMirror 6（本機 vendor，維持 CSP script-src 'self'），
// 摺疊與編輯同一介面：gutter 箭頭可收合物件／陣列，收合後照樣打字
// 校驗仍走原生 JSON.parse / JSON.stringify，全程瀏覽器端
// ============================================================
import { copyText, formatBytes, track } from '../../shared/scripts/shared.js?v=202607172223';
import {
  EditorState, Compartment,
  EditorView, keymap, lineNumbers, drawSelection, placeholder,
  highlightActiveLine, highlightActiveLineGutter,
  history, defaultKeymap, historyKeymap, indentWithTab,
  json,
  codeFolding, foldGutter, foldKeymap, foldAll, unfoldAll,
  syntaxHighlighting, HighlightStyle, bracketMatching, indentUnit,
  tags,
} from './vendor/codemirror.esm.min.js?v=202607172223';

const SAMPLE = '{"name":"設計師工具箱 🧰","edition":38,"categories":["image 🖼️","color 🎨","css","text ✍️","reference","assets","focus 🍅","fun 🎲"],"isOpenSource":false,"meta":{"author":"Andrew","mood":"☕️➡️💪","tags":["design","frontend",null]}}';

// ── DOM 元素 ────────────────────────────────────────────────
const editorHost   = document.getElementById('editor-host');
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
const expandAllBtn   = document.getElementById('expand-all-btn');
const collapseAllBtn = document.getElementById('collapse-all-btn');

let currentIndent = '2'; // '2' | '4' | 'tab'
let lastErrorPos = null;
let debounceTimer = null;

function getIndentValue() {
  return currentIndent === 'tab' ? '\t' : ' '.repeat(Number(currentIndent));
}

// ── CodeMirror 編輯器 ────────────────────────────────────────
// 語法著色對映設計 token（CSS 變數），維持手冊風的墨色層次＋單一硃紅
const almanacHighlight = HighlightStyle.define([
  { tag: tags.propertyName, color: 'var(--color-ink)', fontWeight: '600' },
  { tag: tags.string, color: 'var(--color-accent-deep)' },
  { tag: tags.number, color: 'var(--color-ink)' },
  { tag: [tags.bool, tags.null], color: 'var(--color-ink-soft)' },
  { tag: [tags.punctuation, tags.separator, tags.bracket], color: 'var(--color-ink-soft)' },
]);

// 縮排單位用 Compartment 包起來，切換縮排 chip 時可原地重設（影響自動縮排）
const indentCompartment = new Compartment();

const editor = new EditorView({
  parent: editorHost,
  state: EditorState.create({
    doc: '',
    extensions: [
      lineNumbers(),
      highlightActiveLineGutter(),
      highlightActiveLine(),
      history(),
      drawSelection(),
      bracketMatching(),
      codeFolding({ placeholderText: '⋯' }),
      foldGutter({ openText: '▾', closedText: '▸' }),
      json(),
      syntaxHighlighting(almanacHighlight),
      indentCompartment.of(indentUnit.of(getIndentValue())),
      keymap.of([...defaultKeymap, ...historyKeymap, ...foldKeymap, indentWithTab]),
      placeholder('在這裡貼上或輸入 JSON…'),
      // 輸入即時校驗（debounce 200ms）
      EditorView.updateListener.of((update) => {
        if (!update.docChanged) return;
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(validate, 200);
      }),
      // 貼上內容若整份為合法 JSON，立即依目前縮排設定自動排版
      EditorView.domEventHandlers({
        paste: () => {
          setTimeout(() => {
            const result = parseJson(getText());
            if (result.ok) {
              setText(JSON.stringify(result.data, null, getIndentValue()));
              track('use');
            }
            validate();
          }, 0);
        },
      }),
    ],
  }),
});

function getText() {
  return editor.state.doc.toString();
}

function setText(text) {
  editor.dispatch({ changes: { from: 0, to: editor.state.doc.length, insert: text } });
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
    const line = Number(lc[1]);
    const col = Number(lc[2]);
    // 由行號／欄號反推字元位置，讓「點此定位」在兩種引擎下都可用
    let pos = 0;
    const lines = text.split('\n');
    for (let i = 0; i < line - 1 && i < lines.length; i++) pos += lines[i].length + 1;
    return { line, col, pos: Math.min(pos + col - 1, text.length) };
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
  const text = getText();
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
// 點擊錯誤訊息：選取錯誤字元並捲動到可視範圍
statusMsg.addEventListener('click', () => {
  if (lastErrorPos === null) return;
  const end = Math.min(lastErrorPos + 1, editor.state.doc.length);
  editor.dispatch({
    selection: { anchor: lastErrorPos, head: end },
    scrollIntoView: true,
  });
  editor.focus();
});

// 縮排切換：同步更新編輯器的自動縮排單位
indentGroup.addEventListener('click', (e) => {
  const chip = e.target.closest('.indent-chip');
  if (!chip) return;
  indentGroup.querySelectorAll('.indent-chip').forEach((c) => c.classList.remove('is-active'));
  chip.classList.add('is-active');
  currentIndent = chip.dataset.indent;
  editor.dispatch({ effects: indentCompartment.reconfigure(indentUnit.of(getIndentValue())) });
});

// 全部展開／全部收合：直接操作編輯器的摺疊狀態
expandAllBtn.addEventListener('click', () => unfoldAll(editor));
collapseAllBtn.addEventListener('click', () => {
  foldAll(editor);
  track('use');
});

sampleBtn.addEventListener('click', () => {
  const result = parseJson(SAMPLE);
  setText(result.ok ? JSON.stringify(result.data, null, getIndentValue()) : SAMPLE);
  validate();
  copyHint.textContent = '';
});

clearBtn.addEventListener('click', () => {
  setText('');
  validate();
  copyHint.textContent = '';
});

copyBtn.addEventListener('click', async () => {
  const text = getText();
  if (!text) return;
  const ok = await copyText(text);
  if (ok) {
    copyHint.textContent = '已複製！';
    setTimeout(() => { copyHint.textContent = ''; }, 2000);
  }
});

formatBtn.addEventListener('click', () => {
  const result = parseJson(getText());
  if (!result.ok) return;
  setText(JSON.stringify(result.data, null, getIndentValue()));
  validate();
  track('use');
});

minifyBtn.addEventListener('click', () => {
  const result = parseJson(getText());
  if (!result.ok) return;
  setText(JSON.stringify(result.data));
  validate();
  track('use');
});

validate();
