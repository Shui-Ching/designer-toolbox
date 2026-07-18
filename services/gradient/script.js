// ============================================================
// 15 漸層產生器 — 視覺化編輯漸層色標，即時預覽並輸出 CSS
// 零相依、純前端運算；維持 CSP script-src 'self'
// ============================================================
import { copyText, track as trackEvent } from '../../shared/scripts/shared.js?v=202607181508';

// — DOM —
const presetGroup = document.getElementById('preset-group');
const typeGroup   = document.getElementById('type-group');
const shapeGroup  = document.getElementById('shape-group');
const angleBlock  = document.getElementById('angle-block');
const shapeBlock  = document.getElementById('shape-block');
const anglePresets = document.getElementById('angle-presets');

const angleEl   = document.getElementById('angle');
const valAngle  = document.getElementById('val-angle');

const track     = document.getElementById('gradient-track');
const trackFill = document.getElementById('track-fill');

const posEl     = document.getElementById('stop-pos');
const valPos    = document.getElementById('val-pos');
const colorEl   = document.getElementById('stop-color');
const colorHex  = document.getElementById('stop-color-hex');
const delStopBtn = document.getElementById('del-stop');

const stage    = document.getElementById('gradient-stage');
const codeOut  = document.getElementById('code-out');
const copyBtn  = document.getElementById('copy-btn');
const copyHint = document.getElementById('copy-hint');

// — 狀態 —
// 每個色標：顏色（hex）與位置（0–100%）
const state = {
  type: 'linear',   // linear / radial / conic
  angle: 135,
  shape: 'circle',  // radial 用：circle / ellipse
  stops: [
    { color: '#d8442a', pos: 0 },
    { color: '#1c1b18', pos: 100 },
  ],
  selected: 0,
};

// — 預設樣式：整組替換 —
const presets = {
  dusk:   { type: 'linear', angle: 135, stops: [{ color: '#2b1055', pos: 0 }, { color: '#7597de', pos: 100 }] },
  citrus: { type: 'linear', angle: 90,  stops: [{ color: '#ff8008', pos: 0 }, { color: '#ffc837', pos: 100 }] },
  ocean:  { type: 'linear', angle: 160, stops: [{ color: '#2e86de', pos: 0 }, { color: '#48dbfb', pos: 50 }, { color: '#00d2d3', pos: 100 }] },
  ember:  { type: 'linear', angle: 135, stops: [{ color: '#d8442a', pos: 0 }, { color: '#e6b800', pos: 100 }] },
  ink:    { type: 'linear', angle: 180, stops: [{ color: '#f4f1e8', pos: 0 }, { color: '#1c1b18', pos: 100 }] },
  aurora: { type: 'conic',  angle: 0,   stops: [{ color: '#d8442a', pos: 0 }, { color: '#e6b800', pos: 33 }, { color: '#2e86de', pos: 66 }, { color: '#d8442a', pos: 100 }] },
};

// ============================================================
// 色彩工具：hex ↔ rgb，線性內插
// ============================================================
function hexToRgb(hex) {
  let h = hex.replace('#', '').trim();
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  const n = parseInt(h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function rgbToHex(r, g, b) {
  const to = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return '#' + to(r) + to(g) + to(b);
}

// 在已排序色標中，取位置 pos 處的內插顏色（新增色標時用，讓顏色接續漸層）
function colorAt(pos) {
  const sorted = sortedStops();
  if (pos <= sorted[0].pos) return sorted[0].color;
  if (pos >= sorted[sorted.length - 1].pos) return sorted[sorted.length - 1].color;
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i], b = sorted[i + 1];
    if (pos >= a.pos && pos <= b.pos) {
      const t = (pos - a.pos) / (b.pos - a.pos || 1);
      const ca = hexToRgb(a.color), cb = hexToRgb(b.color);
      return rgbToHex(ca.r + (cb.r - ca.r) * t, ca.g + (cb.g - ca.g) * t, ca.b + (cb.b - ca.b) * t);
    }
  }
  return sorted[0].color;
}

// — 依位置排序（不改動原陣列，輸出 CSS 與漸層條都要照位置順序）—
function sortedStops() {
  return [...state.stops].sort((a, b) => a.pos - b.pos);
}

// ============================================================
// 組出 CSS
// ============================================================
function stopsCss() {
  return sortedStops().map(s => `${s.color} ${s.pos}%`).join(', ');
}

// 漸層條與 radial／conic 預覽都先用一條 90deg 線性表示色標分佈
function trackGradient() {
  return `linear-gradient(90deg, ${stopsCss()})`;
}

function gradientValue() {
  const stops = stopsCss();
  if (state.type === 'radial') return `radial-gradient(${state.shape} at center, ${stops})`;
  if (state.type === 'conic')  return `conic-gradient(from ${state.angle}deg at center, ${stops})`;
  return `linear-gradient(${state.angle}deg, ${stops})`;
}

// ============================================================
// 渲染
// ============================================================
// 漸層條上的色標把手
function renderTrack() {
  // 移除舊把手（保留 fill 元素）
  track.querySelectorAll('.stop-handle').forEach(el => el.remove());
  trackFill.style.background = trackGradient();

  state.stops.forEach((s, i) => {
    const handle = document.createElement('button');
    handle.type = 'button';
    handle.className = 'stop-handle' + (i === state.selected ? ' is-active' : '');
    handle.style.left = s.pos + '%';
    handle.style.setProperty('--stop-color', s.color);
    handle.title = `${s.color} · ${s.pos}%`;
    handle.dataset.index = i;
    track.appendChild(handle);
  });
}

// 把選取色標的值同步到編輯器
function syncEditor() {
  const s = state.stops[state.selected];
  if (!s) return;
  posEl.value = s.pos;        valPos.textContent = s.pos;
  colorEl.value = s.color;
  colorHex.value = s.color.toUpperCase();
  delStopBtn.disabled = state.stops.length <= 2;
}

// 套用到預覽與輸出
function apply() {
  const value = gradientValue();
  stage.style.background = value;
  codeOut.textContent = `background: ${value};`;
}

// 類型切換時，顯示對應的角度／形狀控制
function syncTypeUi() {
  typeGroup.querySelectorAll('.chip').forEach(c =>
    c.classList.toggle('is-active', c.dataset.type === state.type));
  const isRadial = state.type === 'radial';
  angleBlock.hidden = isRadial;
  shapeBlock.hidden = !isRadial;
  anglePresets.querySelectorAll('.chip').forEach(c =>
    c.classList.toggle('is-active', Number(c.dataset.angle) === state.angle));
}

// 全部重畫
function renderAll() {
  renderTrack();
  syncEditor();
  syncTypeUi();
  apply();
}

// ============================================================
// 互動：漸層條 — 點空白處新增、拖曳把手調位置
// ============================================================
// 由滑鼠 x 換算成 0–100 的位置
function posFromEvent(clientX) {
  const rect = track.getBoundingClientRect();
  const ratio = (clientX - rect.left) / rect.width;
  return Math.max(0, Math.min(100, Math.round(ratio * 100)));
}

let dragIndex = -1;

track.addEventListener('pointerdown', (e) => {
  const handle = e.target.closest('.stop-handle');
  if (handle) {
    // 拖曳既有色標
    dragIndex = Number(handle.dataset.index);
    state.selected = dragIndex;
    track.setPointerCapture(e.pointerId);
    renderTrack(); syncEditor();
  } else {
    // 點漸層條空白：在該位置新增色標，顏色接續當前漸層
    const pos = posFromEvent(e.clientX);
    state.stops.push({ color: colorAt(pos), pos });
    state.selected = state.stops.length - 1;
    renderAll();
  }
});

track.addEventListener('pointermove', (e) => {
  if (dragIndex < 0) return;
  const pos = posFromEvent(e.clientX);
  state.stops[dragIndex].pos = pos;
  posEl.value = pos; valPos.textContent = pos;
  renderTrack(); apply();
});

function endDrag() { dragIndex = -1; }
track.addEventListener('pointerup', endDrag);
track.addEventListener('pointercancel', endDrag);

// ============================================================
// 互動：編輯器控制項
// ============================================================
// 位置滑桿
posEl.addEventListener('input', () => {
  const s = state.stops[state.selected];
  if (!s) return;
  s.pos = Number(posEl.value);
  valPos.textContent = posEl.value;
  renderTrack(); apply();
});

// 顏色：色票與 hex 文字雙向同步
colorEl.addEventListener('input', () => {
  const s = state.stops[state.selected];
  if (!s) return;
  s.color = colorEl.value;
  colorHex.value = colorEl.value.toUpperCase();
  renderTrack(); apply();
});
colorHex.addEventListener('input', () => {
  const v = colorHex.value.trim();
  if (/^#?[0-9a-fA-F]{6}$/.test(v)) {
    const hex = (v.startsWith('#') ? v : '#' + v).toLowerCase();
    const s = state.stops[state.selected];
    if (!s) return;
    s.color = hex;
    colorEl.value = hex;
    renderTrack(); apply();
  }
});

// 刪除色標（至少保留兩個）
delStopBtn.addEventListener('click', () => {
  if (state.stops.length <= 2) return;
  state.stops.splice(state.selected, 1);
  if (state.selected >= state.stops.length) state.selected = state.stops.length - 1;
  renderAll();
});

// ============================================================
// 互動：類型 / 角度 / 形狀 / 預設
// ============================================================
typeGroup.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-type]');
  if (!btn) return;
  state.type = btn.dataset.type;
  syncTypeUi(); apply();
});

angleEl.addEventListener('input', () => {
  state.angle = Number(angleEl.value);
  valAngle.textContent = angleEl.value;
  anglePresets.querySelectorAll('.chip').forEach(c =>
    c.classList.toggle('is-active', Number(c.dataset.angle) === state.angle));
  apply();
});

anglePresets.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-angle]');
  if (!btn) return;
  state.angle = Number(btn.dataset.angle);
  angleEl.value = state.angle;
  valAngle.textContent = state.angle;
  syncTypeUi(); apply();
});

shapeGroup.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-shape]');
  if (!btn) return;
  state.shape = btn.dataset.shape;
  shapeGroup.querySelectorAll('.chip').forEach(c =>
    c.classList.toggle('is-active', c === btn));
  apply();
});

presetGroup.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-preset]');
  if (!btn) return;
  const p = presets[btn.dataset.preset];
  if (!p) return;
  state.type = p.type;
  state.angle = p.angle;
  state.stops = p.stops.map(s => ({ ...s }));
  state.selected = 0;
  angleEl.value = state.angle;
  valAngle.textContent = state.angle;
  presetGroup.querySelectorAll('.chip').forEach(c => c.classList.toggle('is-active', c === btn));
  renderAll();
});

// — 複製 CSS —
copyBtn.addEventListener('click', async () => {
  const ok = await copyText(`background: ${gradientValue()};`);
  copyHint.textContent = ok ? '✓ 已複製漸層 CSS' : '複製失敗，請手動選取';
  if (ok) trackEvent('use');
  setTimeout(() => { copyHint.textContent = ''; }, 2400);
});

// — 初始化 —
renderAll();
