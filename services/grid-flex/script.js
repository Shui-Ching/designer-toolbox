// ============================================================
// 05 Grid / Flex 模擬器 — 互動邏輯
// 調整容器屬性 → 即時套用到預覽舞台 → 同步產生 CSS
// ============================================================
import { copyText, track } from '../../shared/scripts/shared.js?v=202607172333';

// — 控制項結構：每個模式有哪些可調屬性與選項 —
// type 'seg' = 分段按鈕（列舉值）；type 'range' = 滑桿（數值）
const SCHEMA = {
  flex: [
    { prop: 'flex-direction', type: 'seg', options: ['row', 'row-reverse', 'column', 'column-reverse'] },
    { prop: 'justify-content', type: 'seg', options: ['flex-start', 'center', 'flex-end', 'space-between', 'space-around', 'space-evenly'] },
    { prop: 'align-items', type: 'seg', options: ['stretch', 'flex-start', 'center', 'flex-end'] },
    { prop: 'flex-wrap', type: 'seg', options: ['nowrap', 'wrap', 'wrap-reverse'] },
    { prop: 'gap', type: 'range', min: 0, max: 48, step: 4, unit: 'px' },
  ],
  grid: [
    { prop: 'columns', type: 'range', min: 1, max: 6, step: 1, unit: '' }, // 對應 grid-template-columns: repeat(n, 1fr)
    { prop: 'gap', type: 'range', min: 0, max: 48, step: 4, unit: 'px' },
    { prop: 'justify-items', type: 'seg', options: ['stretch', 'start', 'center', 'end'] },
    { prop: 'align-items', type: 'seg', options: ['stretch', 'start', 'center', 'end'] },
  ],
};

// — 狀態：兩模式各自保留設定，切換不互相覆蓋 —
const state = {
  mode: 'flex',
  count: 4,
  flex: { 'flex-direction': 'row', 'justify-content': 'flex-start', 'align-items': 'stretch', 'flex-wrap': 'nowrap', gap: 12 },
  grid: { columns: 3, gap: 12, 'justify-items': 'stretch', 'align-items': 'stretch' },
};

const COUNT_MIN = 1;
const COUNT_MAX = 12;

// — DOM —
const tabs = document.getElementById('mode-tabs');
const controlsEl = document.getElementById('sim-controls');
const stageEl = document.getElementById('sim-stage');
const codeOut = document.getElementById('code-out');
const countValue = document.getElementById('count-value');

// — 渲染控制面板（依當前模式）—
function renderControls() {
  const conf = state[state.mode];
  controlsEl.innerHTML = SCHEMA[state.mode].map((field) => {
    if (field.type === 'seg') {
      const buttons = field.options.map((opt) => {
        const active = conf[field.prop] === opt ? ' is-active' : '';
        return `<button class="seg-btn${active}" data-prop="${field.prop}" data-value="${opt}">${opt}</button>`;
      }).join('');
      return `
        <div class="control-group">
          <span class="control-label">${field.prop}</span>
          <div class="seg">${buttons}</div>
        </div>`;
    }
    // range
    const val = conf[field.prop];
    return `
      <div class="control-group">
        <span class="control-label">${field.prop}<span class="control-value">${val}${field.unit}</span></span>
        <input type="range" class="control-range" data-prop="${field.prop}"
               min="${field.min}" max="${field.max}" step="${field.step}" value="${val}">
      </div>`;
  }).join('');
}

// — 套用樣式到預覽舞台 —
function applyStage() {
  const conf = state[state.mode];
  // 先清掉兩模式可能殘留的行內樣式
  stageEl.removeAttribute('style');

  if (state.mode === 'flex') {
    stageEl.style.display = 'flex';
    stageEl.style.flexDirection = conf['flex-direction'];
    stageEl.style.justifyContent = conf['justify-content'];
    stageEl.style.alignItems = conf['align-items'];
    stageEl.style.flexWrap = conf['flex-wrap'];
    stageEl.style.gap = `${conf.gap}px`;
  } else {
    stageEl.style.display = 'grid';
    stageEl.style.gridTemplateColumns = `repeat(${conf.columns}, 1fr)`;
    stageEl.style.gap = `${conf.gap}px`;
    stageEl.style.justifyItems = conf['justify-items'];
    stageEl.style.alignItems = conf['align-items'];
  }
}

// — 重畫子項目色塊 —
function renderBoxes() {
  stageEl.innerHTML = Array.from({ length: state.count }, (_, i) =>
    `<div class="stage-box">${i + 1}</div>`
  ).join('');
}

// — 依當前狀態產生 CSS 字串 —
function buildCss() {
  const conf = state[state.mode];
  const lines = ['.container {'];
  if (state.mode === 'flex') {
    lines.push('  display: flex;');
    lines.push(`  flex-direction: ${conf['flex-direction']};`);
    lines.push(`  justify-content: ${conf['justify-content']};`);
    lines.push(`  align-items: ${conf['align-items']};`);
    lines.push(`  flex-wrap: ${conf['flex-wrap']};`);
    lines.push(`  gap: ${conf.gap}px;`);
  } else {
    lines.push('  display: grid;');
    lines.push(`  grid-template-columns: repeat(${conf.columns}, 1fr);`);
    lines.push(`  gap: ${conf.gap}px;`);
    lines.push(`  justify-items: ${conf['justify-items']};`);
    lines.push(`  align-items: ${conf['align-items']};`);
  }
  lines.push('}');
  return lines.join('\n');
}

// — 統一刷新：套用 + 產生 CSS —
function refresh() {
  applyStage();
  codeOut.textContent = buildCss();
}

// 完整重建（切換模式時）：控制面板 + 舞台 + CSS
function rebuild() {
  renderControls();
  refresh();
}

// — 事件：模式切換 —
tabs.addEventListener('click', (e) => {
  const tab = e.target.closest('.mode-tab');
  if (!tab) return;
  state.mode = tab.dataset.mode;
  tabs.querySelectorAll('.mode-tab').forEach((t) =>
    t.classList.toggle('is-active', t === tab)
  );
  rebuild();
});

// — 事件：控制面板（分段按鈕 + 滑桿）委派 —
controlsEl.addEventListener('click', (e) => {
  const btn = e.target.closest('.seg-btn');
  if (!btn) return;
  const { prop, value } = btn.dataset;
  state[state.mode][prop] = value;
  btn.parentElement.querySelectorAll('.seg-btn').forEach((b) =>
    b.classList.toggle('is-active', b === btn)
  );
  refresh();
});

controlsEl.addEventListener('input', (e) => {
  const range = e.target.closest('.control-range');
  if (!range) return;
  const { prop } = range.dataset;
  const num = Number(range.value);
  state[state.mode][prop] = num;
  // 即時更新該滑桿旁的數值標籤
  const field = SCHEMA[state.mode].find((f) => f.prop === prop);
  range.previousElementSibling.querySelector('.control-value').textContent = `${num}${field.unit}`;
  refresh();
});

// — 事件：子項目數量增減 —
function setCount(next) {
  state.count = Math.min(COUNT_MAX, Math.max(COUNT_MIN, next));
  countValue.textContent = state.count;
  renderBoxes();
}
document.getElementById('count-plus').addEventListener('click', () => setCount(state.count + 1));
document.getElementById('count-minus').addEventListener('click', () => setCount(state.count - 1));

// — 事件：複製 CSS —
const copyBtn = document.getElementById('code-copy');
copyBtn.addEventListener('click', async () => {
  const ok = await copyText(buildCss());
  if (ok) track('use');
  const original = copyBtn.textContent;
  copyBtn.textContent = ok ? '已複製 ✓' : '複製失敗';
  setTimeout(() => { copyBtn.textContent = original; }, 1400);
});

// — 初始化 —
renderBoxes();
rebuild();
