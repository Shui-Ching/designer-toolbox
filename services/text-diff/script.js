// ============================================================
// 40 文字差異比對 — 逐行／逐字比對兩段文字，高亮新增／刪除
// 自寫 LCS diff 演算法（動態規劃求最長共同子序列，回溯還原編輯序列），零相依
// 全程用 DOM API（createElement + textContent）組出結果，不經 innerHTML，天生免疫 XSS
// ============================================================
import { copyText, track } from '../../shared/scripts/shared.js?v=202607131602';

// — DOM —
const textA = document.getElementById('text-a');
const textB = document.getElementById('text-b');
const countA = document.getElementById('live-count-a');
const countB = document.getElementById('live-count-b');
const modeToggle = document.getElementById('mode-toggle');
const diffResult = document.getElementById('diff-result');
const diffStat = document.getElementById('diff-stat');
const copyBtn = document.getElementById('copy-btn');
const copyHint = document.getElementById('copy-hint');
const sampleBtn = document.getElementById('sample-btn');
const swapBtn = document.getElementById('swap-btn');
const clearBtn = document.getElementById('clear-btn');

let mode = 'line'; // 'line' | 'char'
let lastResult = null; // { ops, mode } 供複製結果使用

const SAMPLE_A = `設計是一種無聲的溝通，好的版面會替你說話。
留白不是空洞，而是節奏；對齊不是死板，而是秩序。
排版時，先決定層次，再決定細節。`;

const SAMPLE_B = `設計是一種無聲的溝通，好的版面會主動替使用者說話。
留白不是空洞，而是節奏；對齊不是死板，而是秩序與呼吸。
排版時，先決定層次，再決定細節，最後才是裝飾。
好的設計禁得起放大檢視。`;

// ============================================================
// LCS diff 核心：token 可以是「行」或「字元」陣列
// 逆向 DP 求最長共同子序列長度表，再從 (0,0) 正向回溯還原成 equal／add／del 序列
// n×m 過大時直接放棄計算（回傳 null），避免卡死瀏覽器
// ============================================================
const MAX_CELLS = 4_000_000;

function diffTokens(a, b) {
  const n = a.length, m = b.length;
  if (n * m > MAX_CELLS) return null;

  const dp = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    const cur = dp[i], next = dp[i + 1];
    for (let j = m - 1; j >= 0; j--) {
      cur[j] = a[i] === b[j] ? next[j + 1] + 1 : Math.max(next[j], cur[j + 1]);
    }
  }

  const ops = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) { ops.push({ type: 'equal', value: a[i] }); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { ops.push({ type: 'del', value: a[i] }); i++; }
    else { ops.push({ type: 'add', value: b[j] }); j++; }
  }
  while (i < n) { ops.push({ type: 'del', value: a[i] }); i++; }
  while (j < m) { ops.push({ type: 'add', value: b[j] }); j++; }
  return ops;
}

const splitLines = (text) => (text === '' ? [] : text.split(/\r\n|\r|\n/));
const splitChars = (text) => Array.from(text); // 以碼位切，正確處理 emoji 等星象平面字元

// 合併相鄰同型別 token，逐字模式下大幅壓縮 DOM 節點數
function mergeRuns(ops) {
  const runs = [];
  for (const op of ops) {
    const last = runs[runs.length - 1];
    if (last && last.type === op.type) last.value += op.value;
    else runs.push({ type: op.type, value: op.value });
  }
  return runs;
}

// ============================================================
// 渲染：逐行模式（新舊行號雙欄 gutter）
// ============================================================
function renderLineDiff(ops) {
  diffResult.replaceChildren();
  let oldNo = 0, newNo = 0, add = 0, del = 0;

  for (const op of ops) {
    if (op.type === 'equal') { oldNo++; newNo++; }
    else if (op.type === 'del') { oldNo++; del++; }
    else { newNo++; add++; }

    const row = document.createElement('div');
    row.className = 'diff-line';
    row.dataset.type = op.type;

    const gutter = document.createElement('span');
    gutter.className = 'diff-gutter';
    const gOld = document.createElement('span');
    gOld.className = 'diff-gutter-old';
    gOld.textContent = op.type === 'add' ? '' : oldNo;
    const gNew = document.createElement('span');
    gNew.className = 'diff-gutter-new';
    gNew.textContent = op.type === 'del' ? '' : newNo;
    gutter.append(gOld, gNew);

    const marker = document.createElement('span');
    marker.className = 'diff-marker';
    marker.textContent = op.type === 'add' ? '+' : op.type === 'del' ? '－' : '';

    const content = document.createElement('span');
    content.className = 'diff-content';
    content.textContent = op.value === '' ? ' ' : op.value; // 空行也要看得見一行高度

    row.append(gutter, marker, content);
    diffResult.appendChild(row);
  }

  return { add, del, unit: '行' };
}

// ============================================================
// 渲染：逐字模式（單一流動段落，內嵌新增／刪除色塊）
// ============================================================
function renderCharDiff(ops) {
  const runs = mergeRuns(ops);
  const flow = document.createElement('div');
  flow.className = 'diff-charflow';

  let add = 0, del = 0;
  for (const run of runs) {
    if (run.type === 'add') add += run.value.length;
    else if (run.type === 'del') del += run.value.length;

    if (run.type === 'equal') {
      flow.append(document.createTextNode(run.value));
    } else {
      const span = document.createElement('span');
      span.className = 'diff-run';
      span.dataset.type = run.type;
      span.textContent = run.value;
      flow.appendChild(span);
    }
  }

  diffResult.replaceChildren(flow);
  return { add, del, unit: '字元' };
}

// ============================================================
// 主流程
// ============================================================
function showEmpty(msg) {
  diffResult.replaceChildren();
  const p = document.createElement('p');
  p.className = 'diff-empty';
  p.textContent = msg;
  diffResult.appendChild(p);
  diffStat.hidden = true;
  lastResult = null;
}

function renderDiff() {
  const a = textA.value;
  const b = textB.value;

  if (a === '' && b === '') {
    showEmpty('在上方輸入或貼上文字，這裡會即時顯示差異。');
    return;
  }

  const tokensA = mode === 'line' ? splitLines(a) : splitChars(a);
  const tokensB = mode === 'line' ? splitLines(b) : splitChars(b);
  const ops = diffTokens(tokensA, tokensB);

  if (ops === null) {
    showEmpty('文字量過大，暫時無法即時比對，請縮短內容或切換比對模式。');
    return;
  }

  const stat = mode === 'line' ? renderLineDiff(ops) : renderCharDiff(ops);

  if (stat.add === 0 && stat.del === 0) {
    showEmpty('兩段文字完全相同，沒有差異。');
    return;
  }

  diffStat.hidden = false;
  diffStat.replaceChildren();
  const addEl = document.createElement('span');
  addEl.className = 'diff-stat-add';
  addEl.textContent = `＋${stat.add} ${stat.unit}`;
  const delEl = document.createElement('span');
  delEl.className = 'diff-stat-del';
  delEl.textContent = `－${stat.del} ${stat.unit}`;
  diffStat.append(addEl, delEl);

  lastResult = { ops, mode };
}

// 依目前比對結果組出可複製的純文字：逐行模式用 +/- 前綴，逐字模式用 {+...+} / {-...-} 標記
function buildCopyText() {
  if (!lastResult) return '';
  const { ops, mode: resultMode } = lastResult;

  if (resultMode === 'line') {
    return ops.map((op) => {
      const prefix = op.type === 'add' ? '+ ' : op.type === 'del' ? '- ' : '  ';
      return prefix + op.value;
    }).join('\n');
  }

  return mergeRuns(ops).map((run) => {
    if (run.type === 'add') return `{+${run.value}+}`;
    if (run.type === 'del') return `{-${run.value}-}`;
    return run.value;
  }).join('');
}

// ============================================================
// 互動
// ============================================================
let hintTimer = null;
function flashHint(msg) {
  copyHint.textContent = msg;
  clearTimeout(hintTimer);
  hintTimer = setTimeout(() => { copyHint.textContent = ''; }, 1600);
}

function syncCounts() {
  countA.textContent = `${Array.from(textA.value).length} 字元`;
  countB.textContent = `${Array.from(textB.value).length} 字元`;
}

let debounceTimer = null;
function scheduleRender() {
  syncCounts();
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(renderDiff, 150);
}

function renderNow() {
  syncCounts();
  clearTimeout(debounceTimer);
  renderDiff();
}

textA.addEventListener('input', scheduleRender);
textB.addEventListener('input', scheduleRender);

modeToggle.addEventListener('click', (e) => {
  const tab = e.target.closest('.unit-tab');
  if (!tab || tab.classList.contains('is-active')) return;
  modeToggle.querySelectorAll('.unit-tab').forEach((t) => {
    t.classList.remove('is-active');
    t.setAttribute('aria-selected', 'false');
  });
  tab.classList.add('is-active');
  tab.setAttribute('aria-selected', 'true');
  mode = tab.dataset.mode;
  renderNow();
});

sampleBtn.addEventListener('click', () => {
  textA.value = SAMPLE_A;
  textB.value = SAMPLE_B;
  renderNow();
});

swapBtn.addEventListener('click', () => {
  [textA.value, textB.value] = [textB.value, textA.value];
  renderNow();
});

clearBtn.addEventListener('click', () => {
  textA.value = '';
  textB.value = '';
  renderNow();
});

copyBtn.addEventListener('click', async () => {
  const text = buildCopyText();
  if (!text) return;
  if (await copyText(text)) {
    flashHint('已複製比對結果');
    track('use');
  } else {
    flashHint('複製失敗，請手動選取');
  }
});

// 初次渲染
renderNow();
