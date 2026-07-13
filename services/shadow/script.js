// ============================================================
// 14 陰影產生器 — 視覺化堆疊多層 box-shadow，即時預覽並輸出 CSS
// 零相依、純前端運算；維持 CSP script-src 'self'
// ============================================================
import { copyText, track } from '../../shared/scripts/shared.js?v=202607131602';

// — DOM —
const layerList   = document.getElementById('layer-list');
const addLayerBtn = document.getElementById('add-layer');
const presetGroup = document.getElementById('preset-group');
const stageGroup  = document.getElementById('stage-group');
const editor      = document.getElementById('layer-editor');

const insetEl   = document.getElementById('layer-inset');
const xEl       = document.getElementById('layer-x');
const yEl       = document.getElementById('layer-y');
const blurEl    = document.getElementById('layer-blur');
const spreadEl  = document.getElementById('layer-spread');
const opacityEl = document.getElementById('layer-opacity');
const colorEl   = document.getElementById('layer-color');
const colorHex  = document.getElementById('layer-color-hex');

const boxColorEl = document.getElementById('box-color');
const radiusEl   = document.getElementById('box-radius');

const stage   = document.getElementById('shadow-stage');
const box     = document.getElementById('shadow-box');
const codeOut = document.getElementById('code-out');
const copyBtn = document.getElementById('copy-btn');
const copyHint = document.getElementById('copy-hint');

// 各滑桿對應的數值顯示
const valEls = {
  x: document.getElementById('val-x'),
  y: document.getElementById('val-y'),
  blur: document.getElementById('val-blur'),
  spread: document.getElementById('val-spread'),
  opacity: document.getElementById('val-opacity'),
  radius: document.getElementById('val-radius'),
};

// — 狀態 —
// 每層陰影：inset / 位移 / 模糊 / 擴散 / 顏色（hex）/ 不透明度（0–1）
function makeLayer(over = {}) {
  return { inset: false, x: 0, y: 8, blur: 24, spread: 0, color: '#1c1b18', opacity: 0.25, ...over };
}

const state = {
  layers: [makeLayer()],
  selected: 0,
  box: { color: '#f4f1e8', radius: 12 },
};

// — 預設樣式：整組替換圖層 —
const presets = {
  soft: [makeLayer({ y: 8, blur: 24, spread: -4, opacity: 0.18 })],
  hard: [makeLayer({ x: 6, y: 6, blur: 0, spread: 0, color: '#1c1b18', opacity: 1 })],
  layered: [
    makeLayer({ y: 1, blur: 2, spread: 0, opacity: 0.12 }),
    makeLayer({ y: 4, blur: 8, spread: -1, opacity: 0.14 }),
    makeLayer({ y: 12, blur: 24, spread: -3, opacity: 0.16 }),
  ],
  glow: [makeLayer({ x: 0, y: 0, blur: 28, spread: 4, color: '#d8442a', opacity: 0.5 })],
  inset: [makeLayer({ inset: true, y: 4, blur: 12, spread: -2, color: '#1c1b18', opacity: 0.35 })],
};

// — 工具：hex → rgb —
function hexToRgb(hex) {
  let h = hex.replace('#', '').trim();
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  const n = parseInt(h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

// — 工具：單層陰影 → CSS 字串 —
function layerToCss(l) {
  const { r, g, b } = hexToRgb(l.color);
  const a = Math.round(l.opacity * 100) / 100;
  const color = `rgba(${r}, ${g}, ${b}, ${a})`;
  const parts = [`${l.x}px`, `${l.y}px`, `${l.blur}px`, `${l.spread}px`, color];
  return (l.inset ? 'inset ' : '') + parts.join(' ');
}

// — 組出完整 box-shadow 值 —
function shadowValue() {
  if (state.layers.length === 0) return 'none';
  return state.layers.map(layerToCss).join(', ');
}

// — 渲染圖層清單 —
function renderLayers() {
  layerList.replaceChildren();
  state.layers.forEach((l, i) => {
    const li = document.createElement('li');
    li.className = 'layer-item' + (i === state.selected ? ' is-active' : '');

    const { r, g, b } = hexToRgb(l.color);
    const swatch = document.createElement('span');
    swatch.className = 'layer-swatch';
    swatch.style.background = `rgba(${r}, ${g}, ${b}, ${Math.round(l.opacity * 100) / 100})`;

    const label = document.createElement('span');
    label.className = 'layer-summary';
    label.textContent = `${l.inset ? 'inset · ' : ''}${l.x},${l.y} · 模糊 ${l.blur}`;

    const pick = document.createElement('button');
    pick.type = 'button';
    pick.className = 'layer-pick';
    pick.append(swatch, label);
    pick.addEventListener('click', () => { state.selected = i; syncEditor(); renderLayers(); });

    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'layer-del';
    del.textContent = '✕';
    del.title = '刪除此層';
    del.disabled = state.layers.length <= 1;
    del.addEventListener('click', (e) => {
      e.stopPropagation();
      state.layers.splice(i, 1);
      if (state.selected >= state.layers.length) state.selected = state.layers.length - 1;
      syncEditor(); renderLayers(); apply();
    });

    li.append(pick, del);
    layerList.appendChild(li);
  });
}

// — 把選取圖層的值同步到編輯器控制項 —
function syncEditor() {
  const l = state.layers[state.selected];
  if (!l) return;
  insetEl.checked = l.inset;
  xEl.value = l.x;            valEls.x.textContent = l.x;
  yEl.value = l.y;            valEls.y.textContent = l.y;
  blurEl.value = l.blur;      valEls.blur.textContent = l.blur;
  spreadEl.value = l.spread;  valEls.spread.textContent = l.spread;
  const pct = Math.round(l.opacity * 100);
  opacityEl.value = pct;      valEls.opacity.textContent = pct;
  colorEl.value = l.color;
  colorHex.value = l.color.toUpperCase();
}

// — 套用到預覽與輸出 —
function apply() {
  const value = shadowValue();
  box.style.boxShadow = value;
  box.style.background = state.box.color;
  box.style.borderRadius = state.box.radius + 'px';
  codeOut.textContent = formatCss(value);
}

// — 輸出排版：多層時逐層換行對齊 —
function formatCss(value) {
  if (value === 'none') return 'box-shadow: none;';
  const layers = state.layers.map(layerToCss);
  if (layers.length === 1) return `box-shadow: ${layers[0]};`;
  return 'box-shadow:\n' + layers.map((l, i) =>
    '  ' + l + (i === layers.length - 1 ? ';' : ',')
  ).join('\n');
}

// — 編輯器：滑桿與輸入綁定到選取圖層 —
function bindRange(el, key, valEl, transform = (v) => v) {
  el.addEventListener('input', () => {
    const l = state.layers[state.selected];
    if (!l) return;
    l[key] = transform(Number(el.value));
    if (valEl) valEl.textContent = el.value;
    renderLayers(); apply();
  });
}

bindRange(xEl, 'x', valEls.x);
bindRange(yEl, 'y', valEls.y);
bindRange(blurEl, 'blur', valEls.blur);
bindRange(spreadEl, 'spread', valEls.spread);
bindRange(opacityEl, 'opacity', valEls.opacity, (v) => v / 100);

insetEl.addEventListener('change', () => {
  const l = state.layers[state.selected];
  if (l) { l.inset = insetEl.checked; renderLayers(); apply(); }
});

// 顏色：色票與 hex 文字雙向同步
colorEl.addEventListener('input', () => {
  const l = state.layers[state.selected];
  if (l) { l.color = colorEl.value; colorHex.value = colorEl.value.toUpperCase(); renderLayers(); apply(); }
});
colorHex.addEventListener('input', () => {
  const v = colorHex.value.trim();
  if (/^#?[0-9a-fA-F]{6}$/.test(v)) {
    const hex = v.startsWith('#') ? v : '#' + v;
    const l = state.layers[state.selected];
    if (l) { l.color = hex.toLowerCase(); colorEl.value = hex; renderLayers(); apply(); }
  }
});

// — 預覽外觀 —
boxColorEl.addEventListener('input', () => { state.box.color = boxColorEl.value; apply(); });
radiusEl.addEventListener('input', () => {
  state.box.radius = Number(radiusEl.value);
  valEls.radius.textContent = radiusEl.value;
  apply();
});

// — 新增圖層 —
addLayerBtn.addEventListener('click', () => {
  state.layers.push(makeLayer({ y: 4, blur: 12, opacity: 0.2 }));
  state.selected = state.layers.length - 1;
  syncEditor(); renderLayers(); apply();
});

// — 預設樣式 —
presetGroup.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-preset]');
  if (!btn) return;
  const key = btn.dataset.preset;
  if (!presets[key]) return;
  state.layers = presets[key].map(l => ({ ...l }));
  state.selected = 0;
  presetGroup.querySelectorAll('.chip').forEach(c => c.classList.toggle('is-active', c === btn));
  syncEditor(); renderLayers(); apply();
});

// — 舞台底色切換 —
stageGroup.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-stage]');
  if (!btn) return;
  stage.classList.remove('is-light', 'is-dark', 'is-check');
  stage.classList.add('is-' + btn.dataset.stage);
  stageGroup.querySelectorAll('.chip').forEach(c => c.classList.toggle('is-active', c === btn));
});

// — 複製 CSS —
copyBtn.addEventListener('click', async () => {
  const ok = await copyText(formatCss(shadowValue()));
  copyHint.textContent = ok ? '✓ 已複製 box-shadow CSS' : '複製失敗，請手動選取';
  if (ok) track('use');
  setTimeout(() => { copyHint.textContent = ''; }, 2400);
});

// — 初始化 —
syncEditor();
renderLayers();
apply();
