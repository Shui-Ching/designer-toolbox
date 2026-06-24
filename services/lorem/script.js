// ============================================================
// 12 Lorem 假文產生器 — 中文／拉丁假文，依段落・句子・字數產生
// 零相依、純前端隨機組字；維持 CSP script-src 'self'
// ============================================================
import { downloadBlob, copyText, track } from '../../shared/scripts/shared.js?v=202606241628';

// — DOM —
const langGroup = document.getElementById('lang-group');
const modeGroup = document.getElementById('mode-group');
const modeWordsBtn = document.getElementById('mode-words');
const countInput = document.getElementById('count-input');
const countUnit = document.getElementById('count-unit');
const classicBlock = document.getElementById('classic-block');
const classicGroup = document.getElementById('classic-group');
const loremStat = document.getElementById('lorem-stat');
const loremOutput = document.getElementById('lorem-output');
const copyHint = document.getElementById('copy-hint');
const copyBtn = document.getElementById('copy-btn');
const regenBtn = document.getElementById('regen-btn');
const downloadBtn = document.getElementById('download-btn');

// — 狀態 —
const state = {
  lang: 'zh',          // 'zh' | 'en'
  mode: 'paragraphs',  // 'paragraphs' | 'sentences' | 'words'
  count: 3,
  classic: true,       // 僅拉丁文有效：以 Lorem ipsum… 起頭
};

// 各模式的數量上限與預設值（切換模式時套用合理預設）
const MODE_CONFIG = {
  paragraphs: { max: 100, def: 3, label: { zh: '段', en: '段' } },
  sentences: { max: 200, def: 5, label: { zh: '句', en: '句' } },
  words: { max: 2000, def: 50, label: { zh: '字', en: '詞' } },
};

// ============================================================
// 詞庫
// ============================================================

// 拉丁 Lorem ipsum 常用字（經典詞庫）
const EN_WORDS = (
  'lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor ' +
  'incididunt ut labore et dolore magna aliqua enim ad minim veniam quis nostrud ' +
  'exercitation ullamco laboris nisi aliquip ex ea commodo consequat duis aute irure ' +
  'in reprehenderit voluptate velit esse cillum eu fugiat nulla pariatur excepteur sint ' +
  'occaecat cupidatat non proident sunt culpa qui officia deserunt mollit anim id est ' +
  'laborum perspiciatis unde omnis iste natus error voluptatem accusantium doloremque ' +
  'laudantium totam rem aperiam eaque ipsa quae ab illo inventore veritatis quasi ' +
  'architecto beatae vitae dicta explicabo nemo ipsam quia voluptas aspernatur odit ' +
  'sequi nesciunt neque porro quisquam dolorem adipisci numquam eius modi tempora ' +
  'magnam quaerat ratione voluptatibus nostrum exercitationem ullam corporis suscipit'
).split(' ');

// 拉丁文經典開頭句
const LOREM_OPENER =
  'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor ' +
  'incididunt ut labore et dolore magna aliqua.';

// 中文常用詞（雙字為主，少量三四字），組成讀得通的佔位文字
const ZH_WORDS = (
  '設計 排版 版面 色彩 字體 字級 留白 構圖 視覺 層次 對齊 間距 節奏 風格 質感 細節 ' +
  '系統 元件 介面 體驗 流程 互動 動態 回饋 操作 邏輯 結構 框架 模組 規格 文件 標準 ' +
  '內容 資訊 文字 段落 標題 圖像 影像 素材 資源 品牌 識別 主題 概念 方向 策略 目標 ' +
  '使用者 設計師 工程師 團隊 專案 需求 場景 情境 觀點 想法 靈感 創意 美感 平衡 和諧 ' +
  '清晰 簡潔 直覺 一致 完整 精準 優雅 沉穩 俐落 溫潤 紮實 自然 流暢 細膩 鮮明 飽滿'
).split(/\s+/);

// 中文句末標點（句號加權偏多，偶爾驚嘆或問號）
const ZH_ENDINGS = ['。', '。', '。', '。', '！', '？'];

// ============================================================
// 隨機工具
// ============================================================
const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const clampInt = (v, min, max) => Math.min(max, Math.max(min, Math.round(v || 0)));

// ============================================================
// 造句
// ============================================================

// 一句拉丁文：9–18 字，插入 0–2 個逗號，首字大寫、結尾句號
function enSentence() {
  const len = rand(9, 18);
  const words = Array.from({ length: len }, () => pick(EN_WORDS));
  const commaCount = len > 12 ? rand(1, 2) : (Math.random() < 0.4 ? 1 : 0);
  const positions = new Set();
  while (positions.size < commaCount) positions.add(rand(2, len - 3));
  let out = words.map((w, i) => (positions.has(i) ? `${w},` : w)).join(' ');
  return out.charAt(0).toUpperCase() + out.slice(1) + '.';
}

// 一句中文：2–4 個短語（各 2–5 詞）以逗號連接，結尾隨機標點
function zhSentence() {
  const clauses = rand(2, 4);
  const parts = [];
  for (let c = 0; c < clauses; c++) {
    const wc = rand(2, 5);
    parts.push(Array.from({ length: wc }, () => pick(ZH_WORDS)).join(''));
  }
  return parts.join('，') + pick(ZH_ENDINGS);
}

// 連續中文字：填詞到指定字數後裁切
function zhChars(n) {
  let s = '';
  while (s.length < n) s += pick(ZH_WORDS);
  return s.slice(0, n);
}

// ============================================================
// 產生（每次呼叫皆重新隨機）
// ============================================================
function generate() {
  const { lang, mode, count, classic } = state;
  const cfg = MODE_CONFIG[mode];
  const n = clampInt(count, 1, cfg.max);
  const useClassic = lang === 'en' && classic;
  const blocks = [];
  const stats = { paragraphs: 0, sentences: 0, units: 0, chars: 0 };

  if (mode === 'paragraphs') {
    for (let p = 0; p < n; p++) {
      const sc = rand(3, 6);
      const sents = Array.from({ length: sc }, () => (lang === 'en' ? enSentence() : zhSentence()));
      stats.sentences += sc;
      blocks.push(lang === 'en' ? sents.join(' ') : sents.join(''));
    }
    stats.paragraphs = n;
    if (useClassic) blocks[0] = `${LOREM_OPENER} ${blocks[0]}`;

  } else if (mode === 'sentences') {
    const sents = Array.from({ length: n }, () => (lang === 'en' ? enSentence() : zhSentence()));
    if (useClassic) sents[0] = LOREM_OPENER;
    stats.sentences = n;
    stats.paragraphs = 1;
    blocks.push(lang === 'en' ? sents.join(' ') : sents.join(''));

  } else { // words
    if (lang === 'en') {
      const words = Array.from({ length: n }, () => pick(EN_WORDS));
      if (useClassic) {
        const opener = ['lorem', 'ipsum', 'dolor', 'sit', 'amet'];
        for (let i = 0; i < Math.min(opener.length, n); i++) words[i] = opener[i];
      }
      const s = words.join(' ');
      blocks.push(s.charAt(0).toUpperCase() + s.slice(1));
    } else {
      blocks.push(zhChars(n));
    }
    stats.paragraphs = 1;
  }

  const plain = blocks.join(mode === 'paragraphs' ? '\n\n' : '');

  // 統計字／詞數：拉丁文數單字、中文數漢字
  stats.units = lang === 'en'
    ? (plain.match(/[A-Za-z]+/g) || []).length
    : (plain.match(/[一-鿿]/g) || []).length;
  stats.chars = plain.length;

  return { blocks, plain, stats };
}

// ============================================================
// 渲染
// ============================================================
let currentPlain = '';

function render() {
  const { blocks, plain, stats } = generate();
  currentPlain = plain;

  // 段落區
  loremOutput.replaceChildren(...blocks.map((text) => {
    const p = document.createElement('p');
    p.className = 'lorem-para' + (state.lang === 'en' ? ' is-en' : '');
    p.textContent = text; // textContent 安全，無 XSS 風險
    return p;
  }));

  // 統計列
  const unitLabel = state.lang === 'en' ? '詞' : '字';
  loremStat.textContent =
    `${stats.paragraphs} 段 · ${stats.sentences} 句 · ${stats.units} ${unitLabel} · 共 ${stats.chars} 字元`;
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

// 將某群組內指定 chip 設為唯一高亮
function setActive(group, active) {
  group.querySelectorAll('.chip').forEach((c) => c.classList.toggle('is-active', c === active));
}

// 套用目前模式的數量單位標籤、上限與預設值
function applyMode() {
  const cfg = MODE_CONFIG[state.mode];
  modeWordsBtn.textContent = state.lang === 'en' ? '單字' : '字數';
  countUnit.textContent = cfg.label[state.lang];
  countInput.max = cfg.max;
  if (state.count > cfg.max) {
    state.count = cfg.max;
    countInput.value = cfg.max;
  }
}

// 中文模式停用「經典開頭」區塊
function applyClassicAvailability() {
  classicBlock.classList.toggle('is-disabled', state.lang !== 'en');
}

// 語言切換
langGroup.addEventListener('click', (e) => {
  const chip = e.target.closest('.chip');
  if (!chip) return;
  state.lang = chip.dataset.lang;
  setActive(langGroup, chip);
  applyMode();
  applyClassicAvailability();
  render();
});

// 產生單位切換：套用該模式的預設數量
modeGroup.addEventListener('click', (e) => {
  const chip = e.target.closest('.chip');
  if (!chip) return;
  state.mode = chip.dataset.mode;
  setActive(modeGroup, chip);
  state.count = MODE_CONFIG[state.mode].def;
  countInput.value = state.count;
  applyMode();
  render();
});

// 數量
countInput.addEventListener('input', () => {
  state.count = clampInt(countInput.value, 1, MODE_CONFIG[state.mode].max);
  render();
});

// 經典開頭切換
classicGroup.addEventListener('click', (e) => {
  const chip = e.target.closest('.chip');
  if (!chip) return;
  state.classic = chip.dataset.classic === 'on';
  setActive(classicGroup, chip);
  render();
});

// 重新產生（重新隨機）
regenBtn.addEventListener('click', () => {
  render();
  flashHint('已重新產生');
});

// 複製
copyBtn.addEventListener('click', async () => {
  if (await copyText(currentPlain)) {
    flashHint('已複製假文');
    track('use');
  }
});

// 下載 .txt
downloadBtn.addEventListener('click', () => {
  const blob = new Blob([currentPlain + '\n'], { type: 'text/plain;charset=utf-8' });
  downloadBlob(blob, `lorem-${state.lang}-${state.mode}.txt`);
  flashHint('已下載 .txt');
  track('use');
});

// 初次渲染
applyMode();
applyClassicAvailability();
render();
