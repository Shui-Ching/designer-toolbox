// ============================================================
// 26 大小寫轉換 — 句首大寫／全大寫／全小寫／標題式…一鍵切換
// 零相依、純前端處理；維持 CSP script-src 'self'
// ============================================================
import { copyText, track } from '../../shared/scripts/shared.js?v=202606262323';

// — DOM —
const textInput = document.getElementById('text-input');
const liveCount = document.getElementById('live-count');
const sampleBtn = document.getElementById('sample-btn');
const copyBtn = document.getElementById('copy-btn');
const clearBtn = document.getElementById('clear-btn');
const copyHint = document.getElementById('copy-hint');
const caseActions = document.getElementById('case-actions');

const SAMPLE = 'the quick brown FOX jumps over a lazy dog. good design is obvious; great design is transparent.';

// 標題式（Title Case）不大寫的英文小詞——介系詞、冠詞、連接詞。
// 但首尾字一律大寫，故套用時會特別保留第一與最後一個字。
const MINOR_WORDS = new Set([
  'a', 'an', 'and', 'as', 'at', 'but', 'by', 'en', 'for', 'if', 'in', 'nor',
  'of', 'on', 'or', 'per', 'the', 'to', 'v', 'via', 'vs',
]);

// ============================================================
// 轉換函式 — 每個都吃字串、回字串
// ============================================================

// 把單一英文詞首字母大寫、其餘小寫（保留非字母前綴，如引號）
function capitalizeWord(word) {
  return word.replace(/[A-Za-z]/, (c) => c.toUpperCase());
}

const transforms = {
  // 全部大寫
  upper: (text) => text.toUpperCase(),

  // 全部小寫
  lower: (text) => text.toLowerCase(),

  // 句首大寫：先全小寫，再把每個句子的第一個字母大寫
  // 句子邊界＝字串開頭或 . ! ? 後接空白
  sentence: (text) =>
    text.toLowerCase().replace(/(^\s*|[.!?]\s+)([a-z])/g, (m, lead, ch) => lead + ch.toUpperCase()),

  // 每字首大寫：所有單字首字母大寫，其餘小寫
  capitalized: (text) =>
    text.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase()),

  // 標題式：小詞維持小寫，首尾字與其餘字大寫
  title: (text) => {
    // 以「含空白的分隔」切，保留原本空白寬度
    const tokens = text.toLowerCase().split(/(\s+)/);
    // 找出第一個與最後一個「實字」索引（非空白），確保首尾一定大寫
    const wordIdx = tokens
      .map((t, i) => (t.trim() === '' ? -1 : i))
      .filter((i) => i !== -1);
    const first = wordIdx[0];
    const last = wordIdx[wordIdx.length - 1];

    return tokens
      .map((tok, i) => {
        if (tok.trim() === '') return tok; // 空白原樣保留
        const bare = tok.replace(/[^a-z]/g, ''); // 去標點後的純字，用來比對小詞
        if (i !== first && i !== last && MINOR_WORDS.has(bare)) return tok;
        return capitalizeWord(tok);
      })
      .join('');
  },

  // 交替大小寫：從小寫起，逐個「字母」交替（非字母不計入節奏）
  alternating: (text) => {
    let upperNext = false;
    return Array.from(text)
      .map((ch) => {
        if (!/[A-Za-z]/.test(ch)) return ch;
        const out = upperNext ? ch.toUpperCase() : ch.toLowerCase();
        upperNext = !upperNext;
        return out;
      })
      .join('');
  },

  // 反轉大小寫：大寫變小寫、小寫變大寫
  inverse: (text) =>
    Array.from(text)
      .map((ch) =>
        ch === ch.toLowerCase() ? ch.toUpperCase() : ch.toLowerCase()
      )
      .join(''),
};

// ============================================================
// 計數與提示
// ============================================================
const fmt = (n) => n.toLocaleString('en-US');

// 即時更新字元數與字數（中文逐字、英數連續串各算一詞）
function updateCount() {
  const text = textInput.value;
  const chars = Array.from(text).length;
  const cjk = (text.match(/\p{Script=Han}/gu) || []).length;
  const words = cjk + (text.match(/[A-Za-z0-9]+(?:['’\-][A-Za-z0-9]+)*/gu) || []).length;
  liveCount.textContent = `${fmt(chars)} 字元 · ${fmt(words)} 字`;
}

let hintTimer = null;
function flashHint(msg) {
  copyHint.textContent = msg;
  clearTimeout(hintTimer);
  hintTimer = setTimeout(() => { copyHint.textContent = ''; }, 1600);
}

// ============================================================
// 互動
// ============================================================
textInput.addEventListener('input', updateCount);

// 點轉換鈕：套用對應轉換並更新計數（事件委派）
caseActions.addEventListener('click', (e) => {
  const btn = e.target.closest('.case-btn');
  if (!btn) return;
  const fn = transforms[btn.dataset.case];
  if (!fn || textInput.value === '') {
    if (textInput.value === '') flashHint('請先輸入文字');
    return;
  }
  textInput.value = fn(textInput.value);
  updateCount();
  textInput.focus();
  track('use', { case: btn.dataset.case });
});

// 載入範例
sampleBtn.addEventListener('click', () => {
  textInput.value = SAMPLE;
  updateCount();
  textInput.focus();
});

// 清空
clearBtn.addEventListener('click', () => {
  textInput.value = '';
  updateCount();
  textInput.focus();
});

// 複製文字
copyBtn.addEventListener('click', async () => {
  if (textInput.value === '') {
    flashHint('沒有可複製的文字');
    return;
  }
  if (await copyText(textInput.value)) {
    flashHint('已複製文字');
    track('copy');
  } else {
    flashHint('複製失敗，請手動選取');
  }
});

// 初次計數（空字串）
updateCount();
