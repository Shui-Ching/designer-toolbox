// ============================================================
// 28 Cubic Bezier 產生器 — 拖曳控制點調緩動曲線，輸出 cubic-bezier()
// 零相依、全在瀏覽器端運算，維持 CSP script-src 'self'
// ============================================================
import { copyText, track } from '../../shared/scripts/shared.js?v=202607101704';

// — 座標系常數（對應 SVG viewBox 0 0 300 630）—
const BOX = 300;       // 0–1 主框邊長（像素）
const PAD = 165;       // 上下緩衝高度，容納回彈時超出 0–1 的部分
const OVER = PAD / BOX; // 允許的超出量（Y 範圍 = [-OVER, 1+OVER]）

// — DOM —
const svg = document.getElementById('curve');
const path = document.getElementById('curve-path');
const guide1 = document.getElementById('guide1');
const guide2 = document.getElementById('guide2');
const handle1 = document.getElementById('handle1');
const handle2 = document.getElementById('handle2');
const presetGroup = document.getElementById('preset-group');
const durRange = document.getElementById('duration');
const durVal = document.getElementById('val-dur');
const replayBtn = document.getElementById('replay-btn');
const ball = document.getElementById('preview-ball');
const codeOut = document.getElementById('code-out');
const copyBtn = document.getElementById('copy-btn');
const copyHint = document.getElementById('copy-hint');
const coordInputs = {
  x1: document.getElementById('x1'),
  y1: document.getElementById('y1'),
  x2: document.getElementById('x2'),
  y2: document.getElementById('y2'),
};

// 單一真實來源：四個控制座標（x 限 0–1、y 可超出）
const state = { x1: 0.25, y1: 0.1, x2: 0.25, y2: 1 };

// 常用緩動預設（CSS 規範值 + 幾個回彈款）
const PRESETS = {
  linear: [0, 0, 1, 1],
  ease: [0.25, 0.1, 0.25, 1],
  'ease-in': [0.42, 0, 1, 1],
  'ease-out': [0, 0, 0.58, 1],
  'ease-in-out': [0.42, 0, 0.58, 1],
  swift: [0.4, 0, 0.2, 1],
  'back-in': [0.6, -0.28, 0.735, 0.045],
  'back-out': [0.175, 0.885, 0.32, 1.275],
  'back-in-out': [0.68, -0.55, 0.265, 1.55],
};

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
// 數字收斂：去尾零、最多三位小數
const fmt = (v) => parseFloat(v.toFixed(3));

// — 座標映射：資料值 ↔ SVG 像素 —
const toPx = (t) => t * BOX;                 // 時間 t(0–1) → x
const toPy = (v) => PAD + (1 - v) * BOX;     // 進度 v → y（翻轉，含上下緩衝）

// ============================================================
// 渲染：把 state 反映到曲線、把手、座標框、預覽與輸出
// exceptKey：正在輸入的座標欄位略過重填，避免游標跳動
// ============================================================
function render(exceptKey) {
  const { x1, y1, x2, y2 } = state;

  // SVG 曲線（起點 0,0 → 終點 1,1）
  const sx = toPx(0); const sy = toPy(0);
  const ex = toPx(1); const ey = toPy(1);
  const c1x = toPx(x1); const c1y = toPy(y1);
  const c2x = toPx(x2); const c2y = toPy(y2);
  path.setAttribute('d', `M ${sx} ${sy} C ${c1x} ${c1y} ${c2x} ${c2y} ${ex} ${ey}`);

  // 把手與導引線
  handle1.setAttribute('cx', c1x); handle1.setAttribute('cy', c1y);
  handle2.setAttribute('cx', c2x); handle2.setAttribute('cy', c2y);
  guide1.setAttribute('x2', c1x); guide1.setAttribute('y2', c1y);
  guide2.setAttribute('x2', c2x); guide2.setAttribute('y2', c2y);

  // 座標欄位
  Object.keys(coordInputs).forEach((key) => {
    if (key === exceptKey) return;
    coordInputs[key].value = fmt(state[key]);
    coordInputs[key].classList.remove('is-invalid');
  });

  // CSS 輸出
  const css = `cubic-bezier(${fmt(x1)}, ${fmt(y1)}, ${fmt(x2)}, ${fmt(y2)})`;
  codeOut.textContent = css;

  // 預覽動畫緩動
  ball.style.setProperty('--bz-ease', css);
  restartAnim();

  // 高亮符合的預設
  highlightPreset();
}

// 重啟預覽動畫（強制 reflow 讓新緩動立即生效）
function restartAnim() {
  ball.style.animation = 'none';
  void ball.offsetWidth;
  ball.style.animation = `bezier-move var(--bz-dur, 1.2s) var(--bz-ease) infinite alternate`;
}

// 目前座標若完全等於某預設，高亮該 chip
function highlightPreset() {
  const cur = [state.x1, state.y1, state.x2, state.y2].map((v) => fmt(v));
  let matched = null;
  for (const [name, val] of Object.entries(PRESETS)) {
    if (val.every((v, i) => v === cur[i])) { matched = name; break; }
  }
  presetGroup.querySelectorAll('.chip').forEach((chip) => {
    chip.classList.toggle('is-active', chip.dataset.preset === matched);
  });
}

// ============================================================
// 拖曳控制點
// ============================================================
let dragging = null; // '1' | '2' | null

// 螢幕座標 → SVG viewBox 座標
function clientToView(clientX, clientY) {
  const rect = svg.getBoundingClientRect();
  return {
    vx: ((clientX - rect.left) / rect.width) * 300,
    vy: ((clientY - rect.top) / rect.height) * 630,
  };
}

function moveHandle(clientX, clientY) {
  const { vx, vy } = clientToView(clientX, clientY);
  const t = clamp(vx / BOX, 0, 1);              // x 限 0–1
  const v = clamp(1 - (vy - PAD) / BOX, -OVER, 1 + OVER); // y 容許超出
  if (dragging === '1') { state.x1 = t; state.y1 = v; }
  else { state.x2 = t; state.y2 = v; }
  render();
}

[handle1, handle2].forEach((handle) => {
  handle.addEventListener('pointerdown', (e) => {
    dragging = handle.dataset.handle;
    handle.setPointerCapture(e.pointerId);
    handle.classList.add('is-active');
    e.preventDefault();
  });
  handle.addEventListener('pointermove', (e) => {
    if (dragging) moveHandle(e.clientX, e.clientY);
  });
  handle.addEventListener('pointerup', (e) => {
    if (dragging) { dragging = null; handle.releasePointerCapture(e.pointerId); handle.classList.remove('is-active'); track('use'); }
  });
  // 鍵盤微調（方向鍵 ±0.02）
  handle.addEventListener('keydown', (e) => {
    const step = e.shiftKey ? 0.1 : 0.02;
    const isP1 = handle.dataset.handle === '1';
    const xk = isP1 ? 'x1' : 'x2';
    const yk = isP1 ? 'y1' : 'y2';
    let handled = true;
    if (e.key === 'ArrowLeft') state[xk] = clamp(state[xk] - step, 0, 1);
    else if (e.key === 'ArrowRight') state[xk] = clamp(state[xk] + step, 0, 1);
    else if (e.key === 'ArrowUp') state[yk] = clamp(state[yk] + step, -OVER, 1 + OVER);
    else if (e.key === 'ArrowDown') state[yk] = clamp(state[yk] - step, -OVER, 1 + OVER);
    else handled = false;
    if (handled) { e.preventDefault(); render(); }
  });
});

// ============================================================
// 座標欄位輸入
// ============================================================
Object.keys(coordInputs).forEach((key) => {
  const input = coordInputs[key];
  const isX = key.startsWith('x');
  input.addEventListener('input', () => {
    const n = parseFloat(input.value);
    if (Number.isFinite(n)) {
      state[key] = isX ? clamp(n, 0, 1) : clamp(n, -OVER, 1 + OVER);
      input.classList.remove('is-invalid');
      render(key);
    } else {
      input.classList.add('is-invalid');
    }
  });
  input.addEventListener('blur', () => { input.classList.remove('is-invalid'); render(); });
});

// ============================================================
// 預設、時長、重播、複製
// ============================================================
presetGroup.addEventListener('click', (e) => {
  const chip = e.target.closest('.chip');
  if (!chip) return;
  const [x1, y1, x2, y2] = PRESETS[chip.dataset.preset];
  Object.assign(state, { x1, y1, x2, y2 });
  render();
});

durRange.addEventListener('input', () => {
  durVal.textContent = parseFloat(durRange.value).toFixed(1);
  ball.style.setProperty('--bz-dur', `${durRange.value}s`);
  restartAnim();
});

replayBtn.addEventListener('click', restartAnim);

let hintTimer = null;
copyBtn.addEventListener('click', async () => {
  if (await copyText(codeOut.textContent)) {
    copyHint.textContent = `已複製：${codeOut.textContent}`;
    clearTimeout(hintTimer);
    hintTimer = setTimeout(() => { copyHint.textContent = ''; }, 1600);
    track('use');
  }
});

// 初始化時長與首次渲染
ball.style.setProperty('--bz-dur', `${durRange.value}s`);
render();
