// ============================================================
// 41 Regex 測試器 — 輸入正規表達式即時高亮匹配並列出擷取群組
// 原生 RegExp，零相依；高亮沿用 40 號 text-diff 的 createElement + textContent 手法（不經 innerHTML）
// ============================================================
import { copyText, track } from '../../shared/scripts/shared.js?v=202607131927';

// — DOM —
const patternInput = document.getElementById('pattern-input');
const patternStatus = document.getElementById('pattern-status');
const flagsGroup = document.getElementById('flags-group');
const quickPatternBar = document.getElementById('quick-pattern-bar');
const testInput = document.getElementById('test-input');
const liveCount = document.getElementById('live-count');
const sampleBtn = document.getElementById('sample-btn');
const clearBtn = document.getElementById('clear-btn');
const matchStat = document.getElementById('match-stat');
const regexHighlight = document.getElementById('regex-highlight');
const matchList = document.getElementById('match-list');
const copyMatchesBtn = document.getElementById('copy-matches-btn');
const copyHint = document.getElementById('copy-hint');

// 找到過多匹配時直接截斷，避免病態 pattern（如比對每個字元）撐爆 DOM
const MAX_MATCHES = 2000;

let lastMatches = null; // 供「複製所有匹配」使用

// ============================================================
// 常用 pattern 速查（隱私／設計／開發常見情境，點卡即套用到上方輸入框）
// ============================================================
const QUICK_PATTERNS = [
  { label: 'Email', pattern: String.raw`[\w.+-]+@[\w-]+\.[\w.-]+`, flags: 'g', desc: '電子郵件地址' },
  { label: 'URL', pattern: String.raw`https?:\/\/[^\s]+`, flags: 'g', desc: 'http／https 網址' },
  { label: 'IPv4', pattern: String.raw`\b(?:\d{1,3}\.){3}\d{1,3}\b`, flags: 'g', desc: 'IPv4 位址' },
  { label: 'Hex 色碼', pattern: String.raw`#(?:[0-9a-fA-F]{3}){1,2}\b`, flags: 'g', desc: '十六進位色碼' },
  { label: '台灣手機', pattern: String.raw`09\d{2}-?\d{3}-?\d{3}`, flags: 'g', desc: '台灣手機號碼' },
  { label: '日期', pattern: String.raw`\d{4}-\d{2}-\d{2}`, flags: 'g', desc: 'YYYY-MM-DD 日期格式' },
  { label: '時間', pattern: String.raw`\d{2}:\d{2}(?::\d{2})?`, flags: 'g', desc: 'HH:mm 或 HH:mm:ss 時間格式' },
  { label: '中文字元', pattern: String.raw`[一-鿿]+`, flags: 'g', desc: '連續中文字元' },
  { label: 'HTML 標籤', pattern: String.raw`<\/?[a-z][^>]*>`, flags: 'gi', desc: 'HTML 標籤' },
  { label: '數字', pattern: String.raw`-?\d+(?:\.\d+)?`, flags: 'g', desc: '整數或小數（含負號）' },
  { label: '多餘空白', pattern: String.raw`[ \t]{2,}`, flags: 'g', desc: '連續兩個以上空白／Tab' },
  { label: '英數帳號', pattern: String.raw`^[A-Za-z0-9_]{3,16}$`, flags: 'gm', desc: '3–16 碼英數／底線帳號' },
];

const SAMPLE_TEXT = `聯絡信箱：hello@example.com，備援信箱 support@toolbox.dev
官網 https://example.com/docs，備用連結 http://192.168.1.1:8080
主色 #D8442A，輔色 #1c1b18
客服專線 0912-345-678，市話 (02)2345-6789
活動日期 2026-07-13，開場時間 14:30:00
測試帳號  demo_user01   密碼請勿外流`;

function renderQuickPatterns() {
  quickPatternBar.replaceChildren();
  for (const item of QUICK_PATTERNS) {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'filter-chip';
    chip.textContent = item.label;
    chip.title = item.desc;
    chip.addEventListener('click', () => {
      patternInput.value = item.pattern;
      setFlags(item.flags);
      renderNow();
      patternInput.focus();
    });
    quickPatternBar.appendChild(chip);
  }
}

// ============================================================
// 旗標（多選 chip，沿用全站 filter-chip 語彙）
// ============================================================
function getFlags() {
  return [...flagsGroup.querySelectorAll('.filter-chip')]
    .filter((chip) => chip.classList.contains('is-active'))
    .map((chip) => chip.dataset.flag)
    .join('');
}

function setFlags(flags) {
  flagsGroup.querySelectorAll('.filter-chip').forEach((chip) => {
    chip.classList.toggle('is-active', flags.includes(chip.dataset.flag));
  });
}

flagsGroup.addEventListener('click', (e) => {
  const chip = e.target.closest('.filter-chip');
  if (!chip) return;
  chip.classList.toggle('is-active');
  renderNow();
});

// ============================================================
// 找出所有匹配；沒有 g 旗標時比照原生 RegExp 行為，只回傳第一筆
// ============================================================
function findMatches(re, text) {
  if (!re.global) {
    const m = re.exec(text);
    return m ? [m] : [];
  }

  const matches = [];
  re.lastIndex = 0;
  let m;
  while ((m = re.exec(text)) !== null) {
    matches.push(m);
    if (matches.length >= MAX_MATCHES) break;
    if (m[0].length === 0) re.lastIndex++; // 避免零寬匹配造成無窮迴圈
  }
  return matches;
}

// ============================================================
// 渲染：高亮測試文字（沿用 40 號 text-diff 的 DOM API 組裝手法，天生免疫 XSS）
// ============================================================
function renderHighlight(text, matches) {
  regexHighlight.replaceChildren();
  let cursor = 0;

  matches.forEach((m, i) => {
    if (m.index > cursor) {
      regexHighlight.append(document.createTextNode(text.slice(cursor, m.index)));
    }
    const mark = document.createElement('mark');
    mark.className = 'regex-match';
    mark.dataset.index = i + 1;
    if (m[0].length === 0) {
      mark.classList.add('is-zero');
      mark.textContent = '‸';
    } else {
      mark.textContent = m[0];
    }
    regexHighlight.appendChild(mark);
    cursor = m.index + m[0].length;
  });

  if (cursor < text.length) {
    regexHighlight.append(document.createTextNode(text.slice(cursor)));
  }
}

function showHighlightEmpty(msg) {
  regexHighlight.replaceChildren();
  const p = document.createElement('p');
  p.className = 'regex-empty';
  p.textContent = msg;
  regexHighlight.appendChild(p);
}

// ============================================================
// 渲染：擷取群組清單
// ============================================================
function renderMatchList(matches) {
  matchList.replaceChildren();

  if (matches.length === 0) {
    const p = document.createElement('p');
    p.className = 'regex-empty';
    p.textContent = '沒有找到符合的內容。';
    matchList.appendChild(p);
    return;
  }

  matches.forEach((m, i) => {
    const card = document.createElement('div');
    card.className = 'match-card';

    const head = document.createElement('div');
    head.className = 'match-card-head';
    const indexTag = document.createElement('span');
    indexTag.className = 'tag tag-accent';
    indexTag.textContent = `# ${i + 1}`;
    const posTag = document.createElement('span');
    posTag.className = 'match-pos';
    posTag.textContent = `位置 ${m.index}–${m.index + m[0].length}`;
    head.append(indexTag, posTag);

    const full = document.createElement('p');
    full.className = 'match-full';
    full.textContent = m[0] === '' ? '（零寬匹配）' : m[0];

    card.append(head, full);

    // 數字擷取群組
    if (m.length > 1) {
      const groups = document.createElement('div');
      groups.className = 'match-groups';
      for (let g = 1; g < m.length; g++) {
        groups.appendChild(buildGroupRow(`第 ${g} 組`, m[g]));
      }
      card.appendChild(groups);
    }

    // 具名擷取群組
    if (m.groups) {
      const named = document.createElement('div');
      named.className = 'match-groups';
      for (const [name, value] of Object.entries(m.groups)) {
        named.appendChild(buildGroupRow(name, value));
      }
      card.appendChild(named);
    }

    matchList.appendChild(card);
  });
}

function buildGroupRow(label, value) {
  const row = document.createElement('div');
  row.className = 'match-group-row';
  const labelEl = document.createElement('span');
  labelEl.className = 'match-group-label';
  labelEl.textContent = label;
  const valueEl = document.createElement('span');
  valueEl.className = 'match-group-value';
  if (value === undefined) {
    valueEl.classList.add('is-empty');
    valueEl.textContent = '（未匹配）';
  } else {
    valueEl.textContent = value;
  }
  row.append(labelEl, valueEl);
  return row;
}

// ============================================================
// 主流程
// ============================================================
function render() {
  const pattern = patternInput.value;
  const text = testInput.value;
  const flags = getFlags();

  lastMatches = null;
  matchStat.hidden = true;

  if (pattern === '') {
    patternStatus.textContent = '';
    patternStatus.classList.remove('is-invalid');
    showHighlightEmpty('輸入正規表達式並貼上文字，這裡會即時顯示比對結果。');
    matchList.replaceChildren();
    return;
  }

  let re;
  try {
    re = new RegExp(pattern, flags);
    patternStatus.textContent = '';
    patternStatus.classList.remove('is-invalid');
  } catch (err) {
    patternStatus.textContent = `正規表達式錯誤：${err.message}`;
    patternStatus.classList.add('is-invalid');
    showHighlightEmpty('正規表達式有誤，請修正後再試。');
    matchList.replaceChildren();
    return;
  }

  if (text === '') {
    showHighlightEmpty('貼上測試文字後，這裡會即時顯示比對結果。');
    matchList.replaceChildren();
    return;
  }

  const matches = findMatches(re, text);
  renderHighlight(text, matches);
  renderMatchList(matches);

  matchStat.hidden = false;
  matchStat.textContent = matches.length >= MAX_MATCHES
    ? `共 ${matches.length}+ 筆匹配（已達顯示上限）`
    : `共 ${matches.length} 筆匹配`;

  lastMatches = matches;
}

let debounceTimer = null;
function scheduleRender() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(render, 150);
}

function renderNow() {
  clearTimeout(debounceTimer);
  render();
}

function syncCount() {
  liveCount.textContent = `${Array.from(testInput.value).length} 字元`;
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

patternInput.addEventListener('input', renderNow);

testInput.addEventListener('input', () => {
  syncCount();
  scheduleRender();
});

sampleBtn.addEventListener('click', () => {
  testInput.value = SAMPLE_TEXT;
  if (patternInput.value === '') {
    patternInput.value = QUICK_PATTERNS[0].pattern;
    setFlags(QUICK_PATTERNS[0].flags);
  }
  syncCount();
  renderNow();
});

clearBtn.addEventListener('click', () => {
  testInput.value = '';
  syncCount();
  renderNow();
});

copyMatchesBtn.addEventListener('click', async () => {
  if (!lastMatches || lastMatches.length === 0) return;
  const text = lastMatches.map((m) => m[0]).join('\n');
  if (await copyText(text)) {
    flashHint('已複製所有匹配');
    track('use');
  } else {
    flashHint('複製失敗，請手動選取');
  }
});

// 初始化
renderQuickPatterns();
syncCount();
renderNow();
