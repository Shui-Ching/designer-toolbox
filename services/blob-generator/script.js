// ============================================================
// 48 SVG Blob／波浪產生器 — 隨機有機形狀＋波浪分隔線，輸出 SVG
// 零相依、全在瀏覽器端運算，維持 CSP script-src 'self'
// 核心數學（PRNG／Catmull-Rom）抽在 blob-math.js，零 DOM 供 Node 測試
// ============================================================
import { downloadBlob, copyText, track } from '../../shared/scripts/shared.js?v=202607181508';
import {
  BLOB_SIZE, WAVE_W, WAVE_H,
  blobPath, wavePath, normalizeHex, buildBlobSvg, buildWaveSvg,
} from './blob-math.js?v=202607181508';

// — DOM —
const typeGroup = document.getElementById('type-group');
const seedInput = document.getElementById('seed-input');
const rerollBtn = document.getElementById('reroll-btn');
const complexityInput = document.getElementById('complexity-input');
const complexityName = document.getElementById('complexity-name');
const complexityVal = document.getElementById('complexity-val');
const varianceInput = document.getElementById('variance-input');
const varianceVal = document.getElementById('variance-val');
const fillDirBlock = document.getElementById('fill-dir-block');
const fillDirGroup = document.getElementById('fill-dir-group');
const fillPicker = document.getElementById('fill-picker');
const fillHex = document.getElementById('fill-hex');
const stageSvg = document.getElementById('stage-svg');
const stagePath = document.getElementById('stage-path');
const stageHint = document.getElementById('stage-hint');
const codeOut = document.getElementById('code-out');
const copyBtn = document.getElementById('copy-btn');
const downloadBtn = document.getElementById('download-btn');
const copyHint = document.getElementById('copy-hint');

// 兩種類型的複雜度意義與範圍不同，各自記住設定，切換時互不干擾
const TYPE_CONFIG = {
  blob: { name: '頂點數', min: 3, max: 16 },
  wave: { name: '起伏數', min: 2, max: 12 },
};

// — 單一真實來源 state —
const state = {
  type: 'blob',
  seed: newSeed(),
  variance: 35,
  fill: '#d8442a',
  complexity: { blob: 8, wave: 5 }, // 依類型各自保存
  flip: false,                      // 僅波浪：true＝填滿上方
};

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

// 擲一顆新種子（0–999999，僅需視覺隨機，非安全用途）
function newSeed() {
  return Math.floor(Math.random() * 1000000);
}

// ============================================================
// 渲染：state → 預覽 SVG、輸出程式碼
// 預覽只 setAttribute，不經 innerHTML
// ============================================================
function render() {
  const { type, seed, variance, fill, flip } = state;
  const complexity = state.complexity[type];
  const isBlob = type === 'blob';

  const d = isBlob
    ? blobPath(seed, complexity, variance)
    : wavePath(seed, complexity, variance, flip);

  if (isBlob) {
    stageSvg.setAttribute('viewBox', `0 0 ${BLOB_SIZE} ${BLOB_SIZE}`);
    stageSvg.removeAttribute('preserveAspectRatio');
  } else {
    stageSvg.setAttribute('viewBox', `0 0 ${WAVE_W} ${WAVE_H}`);
    stageSvg.setAttribute('preserveAspectRatio', 'none');
  }
  stageSvg.classList.toggle('is-wave', !isBlob);
  stagePath.setAttribute('d', d);
  stagePath.setAttribute('fill', fill);

  codeOut.textContent = isBlob
    ? buildBlobSvg({ seed, complexity, variance, fill })
    : buildWaveSvg({ seed, complexity, variance, fill, flip });

  stageHint.textContent = isBlob
    ? 'Blob 會維持正方形比例；波浪可橫向撐滿任何容器'
    : '波浪以 preserveAspectRatio="none" 橫向撐滿容器';
}

// 依目前類型同步複雜度滑桿的名稱／範圍／數值
function syncComplexityControl() {
  const cfg = TYPE_CONFIG[state.type];
  complexityName.textContent = cfg.name;
  complexityInput.min = cfg.min;
  complexityInput.max = cfg.max;
  complexityInput.value = state.complexity[state.type];
  complexityVal.textContent = state.complexity[state.type];
}

// ============================================================
// 控制項事件
// ============================================================
typeGroup.addEventListener('click', (e) => {
  const chip = e.target.closest('.chip');
  if (!chip) return;
  state.type = chip.dataset.type;
  typeGroup.querySelectorAll('.chip').forEach((c) => c.classList.toggle('is-active', c === chip));
  fillDirBlock.hidden = state.type !== 'wave';
  syncComplexityControl();
  render();
});

rerollBtn.addEventListener('click', () => {
  state.seed = newSeed();
  seedInput.value = state.seed;
  seedInput.classList.remove('is-invalid');
  render();
});

seedInput.addEventListener('input', () => {
  const n = parseInt(seedInput.value, 10);
  if (Number.isFinite(n)) {
    state.seed = clamp(n, 0, 999999);
    seedInput.classList.remove('is-invalid');
    render();
  } else {
    seedInput.classList.add('is-invalid');
  }
});
seedInput.addEventListener('blur', () => {
  seedInput.value = state.seed;
  seedInput.classList.remove('is-invalid');
});

complexityInput.addEventListener('input', () => {
  state.complexity[state.type] = parseInt(complexityInput.value, 10);
  complexityVal.textContent = complexityInput.value;
  render();
});

varianceInput.addEventListener('input', () => {
  state.variance = parseInt(varianceInput.value, 10);
  varianceVal.textContent = varianceInput.value;
  render();
});

fillDirGroup.addEventListener('click', (e) => {
  const chip = e.target.closest('.chip');
  if (!chip) return;
  state.flip = chip.dataset.flip === 'true';
  fillDirGroup.querySelectorAll('.chip').forEach((c) => c.classList.toggle('is-active', c === chip));
  render();
});

// — 填色：色票與 HEX 欄雙向同步，HEX 先過 normalizeHex 白名單才入 state —
fillPicker.addEventListener('input', () => {
  state.fill = fillPicker.value;
  fillHex.value = fillPicker.value;
  fillHex.classList.remove('is-invalid');
  render();
});

fillHex.addEventListener('input', () => {
  const hex = normalizeHex(fillHex.value);
  if (hex) {
    state.fill = hex;
    fillPicker.value = hex;
    fillHex.classList.remove('is-invalid');
    render();
  } else {
    fillHex.classList.add('is-invalid');
  }
});
fillHex.addEventListener('blur', () => {
  fillHex.value = state.fill;
  fillHex.classList.remove('is-invalid');
});

// ============================================================
// 複製與下載
// ============================================================
let hintTimer = null;
function showHint(text) {
  copyHint.textContent = text;
  clearTimeout(hintTimer);
  hintTimer = setTimeout(() => { copyHint.textContent = ''; }, 1600);
}

copyBtn.addEventListener('click', async () => {
  if (await copyText(codeOut.textContent)) {
    showHint('已複製 SVG 原始碼到剪貼簿');
    track('use');
  }
});

downloadBtn.addEventListener('click', () => {
  const blob = new Blob([codeOut.textContent], { type: 'image/svg+xml' });
  downloadBlob(blob, `${state.type}-${state.seed}.svg`);
  showHint('已下載 SVG 檔案');
  track('use');
});

// — 首次渲染 —
seedInput.value = state.seed;
fillHex.value = state.fill;
syncComplexityControl();
render();
