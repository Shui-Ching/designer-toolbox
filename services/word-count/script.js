// ============================================================
// 13 字數／字元統計 — 即時統計字數・字元・行・段・句與閱讀時間
// 零相依、純前端計算；維持 CSP script-src 'self'
// ============================================================
import { copyText, track } from '../../shared/scripts/shared.js?v=202607172333';

// — DOM —
const textInput = document.getElementById('text-input');
const liveChars = document.getElementById('live-chars');
const sampleBtn = document.getElementById('sample-btn');
const copyBtn = document.getElementById('copy-btn');
const clearBtn = document.getElementById('clear-btn');
const copyHint = document.getElementById('copy-hint');
const composeBar = document.getElementById('compose-bar');
const composeLegend = document.getElementById('compose-legend');

// 各統計數字格
const out = {
  words: document.getElementById('stat-words'),
  chars: document.getElementById('stat-chars'),
  charsNoSpace: document.getElementById('stat-chars-nospace'),
  lines: document.getElementById('stat-lines'),
  paragraphs: document.getElementById('stat-paragraphs'),
  sentences: document.getElementById('stat-sentences'),
  bytes: document.getElementById('stat-bytes'),
  read: document.getElementById('stat-read'),
  speak: document.getElementById('stat-speak'),
};

// ============================================================
// 字元組成分類（顏色取自設計 token 的 CSS 變數，維持單一真實來源）
// ============================================================
const COMPOSE_DEF = [
  { key: 'cjk',     name: '中文',   color: 'var(--color-accent)' },
  { key: 'letters', name: '英文字母', color: 'var(--color-ink)' },
  { key: 'digits',  name: '數字',   color: 'var(--color-mark)' },
  { key: 'puncts',  name: '標點符號', color: 'var(--color-ink-soft)' },
  { key: 'spaces',  name: '空白',   color: 'var(--color-line)' },
];

// 閱讀／朗讀速度（每分鐘）：中文計字、英數計詞
const SPEED = {
  read:  { cjk: 300, word: 200 },
  speak: { cjk: 180, word: 130 },
};

const SAMPLE = `設計是一種無聲的溝通，好的版面會替你說話。
留白不是空洞，而是節奏；對齊不是死板，而是秩序。

Good design is obvious. Great design is transparent.
排版時，先決定層次，再決定細節 —— 字級、間距、顏色都是手段，閱讀才是目的。`;

// ============================================================
// 統計
// ============================================================
function analyze(text) {
  // 以「碼位」為單位計字元，正確處理 emoji 等星象平面字元
  const cps = Array.from(text);
  const chars = cps.length;
  const spaces = (text.match(/\s/g) || []).length;
  const charsNoSpace = chars - spaces;

  // 中文（漢字）逐字計，英數連續串各算一詞
  const cjk = (text.match(/\p{Script=Han}/gu) || []).length;
  const words = cjk + (text.match(/[A-Za-z0-9]+(?:['’\-][A-Za-z0-9]+)*/gu) || []).length;
  const enWords = words - cjk;

  // 行：以換行切；空字串視為 0 行
  const lines = text === '' ? 0 : text.split(/\r\n|\r|\n/).length;
  // 段落：以空行分隔，去除空白段
  const paragraphs = text.split(/\n\s*\n/).filter((p) => p.trim() !== '').length;
  // 句子：以中英句末標點切，保留無標點的殘句
  const sentences = text.split(/[.!?。！？…]+/).filter((s) => s.trim() !== '').length;

  const bytes = new TextEncoder().encode(text).length;

  // 字元組成：中文／字母（非漢字）／數字／空白／其餘標點符號
  const letters = (text.match(/\p{Letter}/gu) || []).length - cjk; // 全部字母扣掉漢字
  const digits = (text.match(/[0-9]/g) || []).length;
  const puncts = Math.max(0, chars - cjk - letters - digits - spaces);

  // 閱讀／朗讀時間（分鐘）
  const readMin = cjk / SPEED.read.cjk + enWords / SPEED.read.word;
  const speakMin = cjk / SPEED.speak.cjk + enWords / SPEED.speak.word;

  return {
    words, chars, charsNoSpace, lines, paragraphs, sentences, bytes,
    readMin, speakMin,
    compose: { cjk, letters, digits, puncts, spaces },
  };
}

// ============================================================
// 格式化
// ============================================================
const fmt = (n) => n.toLocaleString('en-US');

// 把分鐘數轉成易讀的「分秒」字串
function formatDuration(min) {
  const sec = Math.round(min * 60);
  if (sec <= 0) return '0 秒';
  if (sec < 60) return `${sec} 秒`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s === 0 ? `${m} 分鐘` : `${m} 分 ${s} 秒`;
}

// ============================================================
// 渲染
// ============================================================
let current = null;

function render() {
  const text = textInput.value;
  const r = analyze(text);
  current = r;

  liveChars.textContent = `${fmt(r.chars)} 字元`;

  out.words.textContent = fmt(r.words);
  out.chars.textContent = fmt(r.chars);
  out.charsNoSpace.textContent = fmt(r.charsNoSpace);
  out.lines.textContent = fmt(r.lines);
  out.paragraphs.textContent = fmt(r.paragraphs);
  out.sentences.textContent = fmt(r.sentences);
  out.bytes.textContent = fmt(r.bytes);
  out.read.textContent = formatDuration(r.readMin);
  out.speak.textContent = formatDuration(r.speakMin);

  renderCompose(r.compose);
}

// 字元組成長條與圖例
function renderCompose(compose) {
  const total = COMPOSE_DEF.reduce((sum, d) => sum + compose[d.key], 0);

  // 長條：依比例給寬度（無內容時整條留白）
  composeBar.replaceChildren(...COMPOSE_DEF.map((d) => {
    const seg = document.createElement('div');
    seg.className = 'compose-seg';
    seg.style.width = total ? `${(compose[d.key] / total) * 100}%` : '0';
    seg.style.background = d.color;
    return seg;
  }));

  // 圖例：色塊 + 名稱 + 數量
  composeLegend.replaceChildren(...COMPOSE_DEF.map((d) => {
    const li = document.createElement('li');
    li.className = 'compose-item';

    const sw = document.createElement('span');
    sw.className = 'compose-swatch';
    sw.style.background = d.color;

    const name = document.createElement('span');
    name.className = 'compose-item-name';
    name.textContent = d.name;

    const val = document.createElement('span');
    val.className = 'compose-item-value';
    val.textContent = fmt(compose[d.key]);

    li.append(sw, name, val);
    return li;
  }));
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

textInput.addEventListener('input', render);

// 載入範例
sampleBtn.addEventListener('click', () => {
  textInput.value = SAMPLE;
  render();
  textInput.focus();
});

// 清空
clearBtn.addEventListener('click', () => {
  textInput.value = '';
  render();
  textInput.focus();
});

// 複製統計摘要
copyBtn.addEventListener('click', async () => {
  if (!current) return;
  const r = current;
  const summary = [
    `字數：${fmt(r.words)}`,
    `字元（含空白）：${fmt(r.chars)}`,
    `字元（不含空白）：${fmt(r.charsNoSpace)}`,
    `行數：${fmt(r.lines)}`,
    `段落：${fmt(r.paragraphs)}`,
    `句子：${fmt(r.sentences)}`,
    `UTF-8 位元組：${fmt(r.bytes)}`,
    `閱讀時間：約 ${formatDuration(r.readMin)}`,
    `朗讀時間：約 ${formatDuration(r.speakMin)}`,
  ].join('\n');

  if (await copyText(summary)) {
    flashHint('已複製統計摘要');
    track('use');
  } else {
    flashHint('複製失敗，請手動選取');
  }
});

// 初次渲染（空字串）
render();
