// ============================================================
// 26 盤古之白 — 在中文字符與英數之間插入／移除半角空格
// 純 Regex，零相依，全程瀏覽器端
// ============================================================
import { copyText, track } from '../../shared/scripts/shared.js?v=202607131651';

// CJK 主要字符區塊（Unicode 跳脫序列，BMP 範圍）
// 不含全形標點（︰-￯）以避免與原有標點後空格衝突
const CJK = '⺀-⻿'  // CJK Radicals Supplement
          + '⼀-⿟'  // Kangxi Radicals
          + '぀-ゟ'  // Hiragana（日文平假名）
          + '゠-ヿ'  // Katakana（日文片假名）
          + '㄀-ㄯ'  // Bopomofo（注音）
          + '㈀-㋿'  // Enclosed CJK Letters
          + '㐀-䶿'  // CJK Extension A
          + '一-鿿'  // CJK Unified Ideographs（主區塊）
          + 'ꥠ-꥿'  // Hangul Jamo Extended-A
          + '가-퟿'  // Hangul Syllables（韓文）
          + '豈-﫿'; // CJK Compatibility Ideographs

// 加入空格：CJK 緊接半形英數、或半形英數緊接 CJK
const RE_ADD_BEFORE = new RegExp(`([${CJK}])([A-Za-z0-9])`, 'g');
const RE_ADD_AFTER  = new RegExp(`([A-Za-z0-9])([${CJK}])`, 'g');

// 移除空格：CJK 與半形英數之間的單一空格
const RE_RM_BEFORE  = new RegExp(`([${CJK}]) ([A-Za-z0-9])`, 'g');
const RE_RM_AFTER   = new RegExp(`([A-Za-z0-9]) ([${CJK}])`, 'g');

function addPanguSpaces(text) {
  return text
    .replace(RE_ADD_BEFORE, '$1 $2')
    .replace(RE_ADD_AFTER,  '$1 $2');
}

function removePanguSpaces(text) {
  return text
    .replace(RE_RM_BEFORE, '$1$2')
    .replace(RE_RM_AFTER,  '$1$2');
}

// ── DOM 元素 ────────────────────────────────────────────────
const inputEl   = document.getElementById('text-input');
const liveCount = document.getElementById('live-count');
const copyBtn   = document.getElementById('copy-btn');
const clearBtn  = document.getElementById('clear-btn');
const sampleBtn = document.getElementById('sample-btn');
const addBtn    = document.getElementById('add-btn');
const removeBtn = document.getElementById('remove-btn');
const statEl    = document.getElementById('pangu-stat');
const copyHint  = document.getElementById('copy-hint');

// — 範例文字（刻意不加空格，便於示範效果）—
const SAMPLE = `我用iPhone拍了1個月，發現Blade Runner 2049真的很好看！
設計師常用Figma和Adobe XD做原型，工程師喜歡用VS Code寫程式碼。
2024年的AI發展讓ChatGPT和Claude變得家喻戶曉，每個人都在用LLM處理日常工作。
這個網站支援HTML、CSS和JavaScript，也有Vue和React的元件庫可以使用。`;

// ── 即時字元計數 ─────────────────────────────────────────────
function updateCount() {
  liveCount.textContent = `${inputEl.value.length.toLocaleString()} 字元`;
}

// ── 顯示執行結果 ─────────────────────────────────────────────
function showStat(msg, type = 'normal') {
  statEl.textContent  = msg;
  statEl.dataset.type = type;
  statEl.hidden       = false;
}

function clearStat() {
  statEl.hidden = true;
}

// ── 事件綁定 ─────────────────────────────────────────────────
inputEl.addEventListener('input', () => { updateCount(); clearStat(); });
updateCount();

sampleBtn.addEventListener('click', () => {
  inputEl.value = SAMPLE;
  updateCount();
  clearStat();
  copyHint.textContent = '';
});

clearBtn.addEventListener('click', () => {
  inputEl.value = '';
  updateCount();
  clearStat();
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

// 加入盤古空格
addBtn.addEventListener('click', () => {
  const before = inputEl.value;
  if (!before) { showStat('請先輸入或貼上文字', 'none'); return; }
  const after = addPanguSpaces(before);
  if (before === after) {
    showStat('文字已符合規範，無需插入空格', 'none');
    return;
  }
  inputEl.value = after;
  updateCount();
  const n = after.length - before.length;
  showStat(`已插入 ${n} 個盤古空格`, 'added');
  track('use');
});

// 移除盤古空格
removeBtn.addEventListener('click', () => {
  const before = inputEl.value;
  if (!before) { showStat('請先輸入或貼上文字', 'none'); return; }
  const after = removePanguSpaces(before);
  if (before === after) {
    showStat('未偵測到盤古空格，無需移除', 'none');
    return;
  }
  inputEl.value = after;
  updateCount();
  const n = before.length - after.length;
  showStat(`已移除 ${n} 個盤古空格`, 'removed');
  track('use');
});
