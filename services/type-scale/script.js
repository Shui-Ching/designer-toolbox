// ============================================================
// 11 字級比例計算 — 基準字級 × 比例推導整套 type scale
// 零相依、純數值運算；維持 CSP script-src 'self'
// ============================================================
import { downloadBlob, copyText, track } from '../../shared/scripts/shared.js?v=202607101402';

// — DOM —
const baseRange = document.getElementById('base-range');
const baseValue = document.getElementById('base-value');
const ratioGroup = document.getElementById('ratio-group');
const ratioCustom = document.getElementById('ratio-custom');
const stepsUpInput = document.getElementById('steps-up');
const stepsDownInput = document.getElementById('steps-down');
const sampleInput = document.getElementById('sample-input');
const prefixInput = document.getElementById('prefix-input');
const unitGroup = document.getElementById('unit-group');
const formatGroup = document.getElementById('format-group');
const scalePreview = document.getElementById('scale-preview');
const codeOutput = document.getElementById('code-output');
const copyHint = document.getElementById('copy-hint');
const copyBtn = document.getElementById('copy-vars');
const downloadBtn = document.getElementById('download-vars');

// rem 換算的根字級（瀏覽器預設 html 為 16px）
const REM_ROOT = 16;

// — 狀態 —
const state = {
  base: 16,
  ratio: 1.25,
  up: 4,
  down: 2,
  sample: '設計 Design 永 Ag',
  prefix: 'fs',
  unit: 'rem',   // 'rem' | 'px'
  format: 'scss', // 'scss' | 'css'
};

// 預設比例的名稱（用於碼塊註解；自訂則略過）
const RATIO_NAMES = {
  1.125: 'Major Second',
  1.2: 'Minor Third',
  1.25: 'Major Third',
  1.333: 'Perfect Fourth',
  1.5: 'Perfect Fifth',
  1.618: 'Golden Ratio',
};

// ============================================================
// 數值工具
// ============================================================

// 去掉多餘小數零（1.2500 → 1.25、16.00 → 16）
function trimNum(n, dp) {
  return parseFloat(n.toFixed(dp)).toString();
}

const clampInt = (v, min, max) => Math.min(max, Math.max(min, Math.round(v || 0)));

// 階名：0 = base，向下 sm / xs / 2xs…，向上 lg / xl / 2xl…（對齊 Tailwind 慣例）
function stepName(offset) {
  if (offset === 0) return 'base';
  const abs = Math.abs(offset);
  if (offset < 0) {
    if (abs === 1) return 'sm';
    if (abs === 2) return 'xs';
    return `${abs - 1}xs`; // -3 → 2xs、-4 → 3xs
  }
  if (abs === 1) return 'lg';
  if (abs === 2) return 'xl';
  return `${abs - 1}xl`; // 3 → 2xl、4 → 3xl
}

// 依單位回傳變數值字串
function unitValue(px) {
  return state.unit === 'rem'
    ? `${trimNum(px / REM_ROOT, 4)}rem`
    : `${trimNum(px, 2)}px`;
}

// ============================================================
// 推導：由大到小排列（海報感，最大階在頂）
// ============================================================
function buildScale() {
  const rows = [];
  for (let o = state.up; o >= -state.down; o--) {
    const px = state.base * Math.pow(state.ratio, o);
    rows.push({
      offset: o,
      name: stepName(o),
      px,
      isBase: o === 0,
    });
  }
  return rows;
}

// ============================================================
// 變數碼產生（由小到大，對齊既有 _tokens.scss 的排列）
// ============================================================
function buildCode(scale) {
  const p = (state.prefix || 'fs').trim().replace(/[^a-z0-9-]/gi, '-') || 'fs';
  const ordered = [...scale].reverse(); // 由小到大
  const ratioLabel = RATIO_NAMES[state.ratio] ? `${state.ratio}（${RATIO_NAMES[state.ratio]}）` : String(state.ratio);
  const header = `字級比例 · base ${state.base}px × ratio ${ratioLabel}`;
  const lines = [];

  if (state.format === 'scss') {
    lines.push(`// ${header}`);
    ordered.forEach(({ name, px }) => {
      const note = state.unit === 'rem' ? `  // ${trimNum(px, 2)}px` : '';
      lines.push(`$${p}-${name}: ${unitValue(px)};${note}`);
    });
  } else {
    lines.push(`:root {`);
    lines.push(`  /* ${header} */`);
    ordered.forEach(({ name, px }) => {
      const note = state.unit === 'rem' ? `  /* ${trimNum(px, 2)}px */` : '';
      lines.push(`  --${p}-${name}: ${unitValue(px)};${note}`);
    });
    lines.push(`}`);
  }

  return lines.join('\n');
}

// ============================================================
// 渲染
// ============================================================
let currentCode = '';

function render() {
  const scale = buildScale();

  scalePreview.replaceChildren(...scale.map(({ name, px, isBase }) => {
    const row = document.createElement('div');
    row.className = 'scale-row' + (isBase ? ' is-base' : '');

    const info = document.createElement('div');
    info.className = 'scale-info';
    const nameEl = document.createElement('span');
    nameEl.className = 'scale-name';
    nameEl.textContent = isBase ? `${name} ·` : name;
    const valEl = document.createElement('span');
    valEl.className = 'scale-val';
    valEl.textContent = `${trimNum(px, 2)}px · ${trimNum(px / REM_ROOT, 3)}rem`;
    info.append(nameEl, valEl);

    const sample = document.createElement('div');
    sample.className = 'scale-sample';
    sample.style.fontSize = `${px}px`;
    sample.textContent = state.sample || '設計 Design';

    row.append(info, sample);
    return row;
  }));

  currentCode = buildCode(scale);
  codeOutput.textContent = currentCode;
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

// 基準字級滑桿
baseRange.addEventListener('input', () => {
  state.base = Number(baseRange.value);
  baseValue.textContent = state.base;
  render();
});

// 比例預設按鈕
ratioGroup.addEventListener('click', (e) => {
  const chip = e.target.closest('.chip');
  if (!chip) return;
  state.ratio = Number(chip.dataset.ratio);
  ratioCustom.value = state.ratio;
  setActive(ratioGroup, chip);
  render();
});

// 自訂比例
ratioCustom.addEventListener('input', () => {
  const v = Number(ratioCustom.value);
  if (!Number.isFinite(v) || v <= 1) return; // 比例需大於 1 才有意義
  state.ratio = v;
  // 取消預設按鈕高亮（除非數值剛好等於某個預設）
  ratioGroup.querySelectorAll('.chip').forEach((c) =>
    c.classList.toggle('is-active', Number(c.dataset.ratio) === v)
  );
  render();
});

// 升／降階數
stepsUpInput.addEventListener('input', () => {
  state.up = clampInt(stepsUpInput.value, 0, 10);
  render();
});
stepsDownInput.addEventListener('input', () => {
  state.down = clampInt(stepsDownInput.value, 0, 10);
  render();
});

// 樣本字
sampleInput.addEventListener('input', () => {
  state.sample = sampleInput.value;
  render();
});

// 變數前綴
prefixInput.addEventListener('input', () => {
  state.prefix = prefixInput.value;
  render();
});

// 單位切換
unitGroup.addEventListener('click', (e) => {
  const chip = e.target.closest('.chip');
  if (!chip) return;
  state.unit = chip.dataset.unit;
  setActive(unitGroup, chip);
  render();
});

// 輸出格式切換
formatGroup.addEventListener('click', (e) => {
  const chip = e.target.closest('.chip');
  if (!chip) return;
  state.format = chip.dataset.format;
  setActive(formatGroup, chip);
  render();
});

// 將某群組內指定 chip 設為唯一高亮
function setActive(group, active) {
  group.querySelectorAll('.chip').forEach((c) =>
    c.classList.toggle('is-active', c === active)
  );
}

// 複製全部變數
copyBtn.addEventListener('click', async () => {
  if (await copyText(currentCode)) {
    flashHint('已複製全部變數');
    track('use');
  }
});

// 下載檔案（副檔名隨格式）
downloadBtn.addEventListener('click', () => {
  const p = (state.prefix || 'fs').trim().replace(/[^a-z0-9-]/gi, '-') || 'fs';
  const ext = state.format === 'scss' ? 'scss' : 'css';
  const mime = state.format === 'scss' ? 'text/x-scss' : 'text/css';
  const blob = new Blob([currentCode + '\n'], { type: `${mime};charset=utf-8` });
  downloadBlob(blob, `${p}-type-scale.${ext}`);
  flashHint(`已下載 ${p}-type-scale.${ext}`);
  track('use');
});

// 初次渲染
render();
