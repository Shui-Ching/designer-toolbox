// ============================================================
// 47 CSS clip-path 產生器 — 拖曳多邊形頂點調裁切形狀，輸出 polygon()
// 零相依、全在瀏覽器端運算，維持 CSP script-src 'self'
// 拖曳互動沿用 28 號 cubic-bezier 的 pointer capture 手法
// ============================================================
import { copyText, track } from '../../shared/scripts/shared.js?v=202607181532';

// — DOM —
const stage = document.getElementById('stage');
const demo = document.getElementById('clip-demo');
const outline = document.getElementById('clip-outline');
const handleLayer = document.getElementById('handle-layer');
const pointList = document.getElementById('point-list');
const pointCount = document.getElementById('point-count');
const presetGroup = document.getElementById('preset-group');
const aspectGroup = document.getElementById('aspect-group');
const codeOut = document.getElementById('code-out');
const copyBtn = document.getElementById('copy-btn');
const copyHint = document.getElementById('copy-hint');

const MIN_POINTS = 3; // polygon 至少三點才成形

// 常用形狀預設（座標單位＝%，順時針）
const PRESETS = {
  triangle: [[50, 0], [0, 100], [100, 100]],
  trapezoid: [[20, 0], [80, 0], [100, 100], [0, 100]],
  parallelogram: [[25, 0], [100, 0], [75, 100], [0, 100]],
  rhombus: [[50, 0], [100, 50], [50, 100], [0, 50]],
  pentagon: [[50, 0], [100, 38], [82, 100], [18, 100], [0, 38]],
  hexagon: [[25, 0], [75, 0], [100, 50], [75, 100], [25, 100], [0, 50]],
  octagon: [[30, 0], [70, 0], [100, 30], [100, 70], [70, 100], [30, 100], [0, 70], [0, 30]],
  star: [[50, 0], [61, 35], [98, 35], [68, 57], [79, 91], [50, 70], [21, 91], [32, 57], [2, 35], [39, 35]],
  'arrow-right': [[0, 20], [60, 20], [60, 0], [100, 50], [60, 100], [60, 80], [0, 80]],
  'arrow-left': [[100, 20], [40, 20], [40, 0], [0, 50], [40, 100], [40, 80], [100, 80]],
  chevron: [[75, 0], [100, 50], [75, 100], [0, 100], [25, 50], [0, 0]],
  message: [[0, 0], [100, 0], [100, 75], [75, 75], [75, 100], [50, 75], [0, 75]],
};

// 單一真實來源：頂點座標陣列（[x, y]，單位 %，皆限 0–100）
let points = PRESETS.triangle.map((p) => [...p]);

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
// 數字收斂：最多一位小數、去尾零（37.0 → 37）
const fmt = (v) => parseFloat(v.toFixed(1));

// 目前的 clip-path 值字串
function clipValue() {
  return `polygon(${points.map(([x, y]) => `${fmt(x)}% ${fmt(y)}%`).join(', ')})`;
}

// ============================================================
// 結構重建：頂點數量變動時重新產生把手、中點鈕與座標列
// （拖曳中只跑 render() 更新位置，避免重建打斷 pointer capture 與輸入焦點）
// ============================================================
function rebuild() {
  handleLayer.textContent = '';
  pointList.textContent = '';

  points.forEach((_, i) => {
    // 頂點把手（可拖曳、可鍵盤微調、雙擊刪除）
    const handle = document.createElement('button');
    handle.type = 'button';
    handle.className = 'vertex-handle';
    handle.dataset.index = i;
    handle.setAttribute('aria-label', `頂點 ${i + 1}`);
    bindHandle(handle);
    handleLayer.appendChild(handle);

    // 邊線中點的插入鈕（邊 i → i+1）
    const mid = document.createElement('button');
    mid.type = 'button';
    mid.className = 'vertex-add';
    mid.dataset.index = i;
    mid.textContent = '+';
    mid.setAttribute('aria-label', `在頂點 ${i + 1} 之後插入頂點`);
    mid.addEventListener('click', () => insertAfter(i));
    handleLayer.appendChild(mid);

    // 控制台座標列
    const row = document.createElement('div');
    row.className = 'point-row';

    const no = document.createElement('span');
    no.className = 'point-no';
    no.textContent = i + 1;
    row.appendChild(no);

    ['x', 'y'].forEach((axis, ai) => {
      const input = document.createElement('input');
      input.className = 'text-input point-input';
      input.type = 'number';
      input.min = 0;
      input.max = 100;
      input.step = 1;
      input.dataset.index = i;
      input.dataset.axis = ai;
      input.setAttribute('aria-label', `頂點 ${i + 1} ${axis}`);
      input.addEventListener('input', () => {
        const n = parseFloat(input.value);
        if (Number.isFinite(n)) {
          points[i][ai] = clamp(n, 0, 100);
          input.classList.remove('is-invalid');
          render(input);
        } else {
          input.classList.add('is-invalid');
        }
      });
      input.addEventListener('blur', () => { input.classList.remove('is-invalid'); render(); });
      row.appendChild(input);
    });

    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'point-del';
    del.textContent = '×';
    del.setAttribute('aria-label', `刪除頂點 ${i + 1}`);
    del.disabled = points.length <= MIN_POINTS;
    del.addEventListener('click', () => removeAt(i));
    row.appendChild(del);

    pointList.appendChild(row);
  });

  render();
}

// ============================================================
// 渲染：把 points 反映到示範層、外框線、把手位置、座標欄與輸出
// exceptInput：正在輸入的欄位略過重填，避免游標跳動
// ============================================================
function render(exceptInput) {
  const css = clipValue();

  demo.style.clipPath = css;
  outline.setAttribute('points', points.map(([x, y]) => `${x},${y}`).join(' '));

  // 把手與中點鈕位置（百分比定位，容器比例改變也不用重算）
  const handles = handleLayer.querySelectorAll('.vertex-handle');
  const mids = handleLayer.querySelectorAll('.vertex-add');
  points.forEach(([x, y], i) => {
    handles[i].style.left = `${x}%`;
    handles[i].style.top = `${y}%`;
    const [nx, ny] = points[(i + 1) % points.length];
    mids[i].style.left = `${(x + nx) / 2}%`;
    mids[i].style.top = `${(y + ny) / 2}%`;
  });

  // 座標欄位
  pointList.querySelectorAll('.point-input').forEach((input) => {
    if (input === exceptInput) return;
    input.value = fmt(points[input.dataset.index][input.dataset.axis]);
    input.classList.remove('is-invalid');
  });

  pointCount.textContent = points.length;
  codeOut.textContent = `clip-path: ${css};`;
  highlightPreset();
}

// 目前座標若完全等於某預設，高亮該 chip
function highlightPreset() {
  let matched = null;
  for (const [name, preset] of Object.entries(PRESETS)) {
    if (preset.length === points.length &&
        preset.every((p, i) => fmt(p[0]) === fmt(points[i][0]) && fmt(p[1]) === fmt(points[i][1]))) {
      matched = name;
      break;
    }
  }
  presetGroup.querySelectorAll('.chip').forEach((chip) => {
    chip.classList.toggle('is-active', chip.dataset.preset === matched);
  });
}

// ============================================================
// 增刪頂點
// ============================================================
function insertAfter(i) {
  const [x, y] = points[i];
  const [nx, ny] = points[(i + 1) % points.length];
  points.splice(i + 1, 0, [(x + nx) / 2, (y + ny) / 2]);
  rebuild();
}

function removeAt(i) {
  if (points.length <= MIN_POINTS) return;
  points.splice(i, 1);
  rebuild();
}

// ============================================================
// 拖曳頂點（pointer capture，含鍵盤微調與雙擊刪除）
// ============================================================
function bindHandle(handle) {
  const idx = () => parseInt(handle.dataset.index, 10);

  handle.addEventListener('pointerdown', (e) => {
    handle.setPointerCapture(e.pointerId);
    handle.classList.add('is-active');
    e.preventDefault();
  });
  handle.addEventListener('pointermove', (e) => {
    if (!handle.hasPointerCapture(e.pointerId)) return;
    // 螢幕座標 → 舞台百分比座標
    const rect = stage.getBoundingClientRect();
    const i = idx();
    points[i][0] = clamp(((e.clientX - rect.left) / rect.width) * 100, 0, 100);
    points[i][1] = clamp(((e.clientY - rect.top) / rect.height) * 100, 0, 100);
    render();
  });
  handle.addEventListener('pointerup', (e) => {
    handle.releasePointerCapture(e.pointerId);
    handle.classList.remove('is-active');
  });
  // 雙擊刪除該頂點
  handle.addEventListener('dblclick', () => removeAt(idx()));
  // 鍵盤微調（方向鍵 ±1%，Shift ±5%）
  handle.addEventListener('keydown', (e) => {
    const step = e.shiftKey ? 5 : 1;
    const i = idx();
    let handled = true;
    if (e.key === 'ArrowLeft') points[i][0] = clamp(points[i][0] - step, 0, 100);
    else if (e.key === 'ArrowRight') points[i][0] = clamp(points[i][0] + step, 0, 100);
    else if (e.key === 'ArrowUp') points[i][1] = clamp(points[i][1] - step, 0, 100);
    else if (e.key === 'ArrowDown') points[i][1] = clamp(points[i][1] + step, 0, 100);
    else handled = false;
    if (handled) { e.preventDefault(); render(); }
  });
}

// ============================================================
// 預設形狀、預覽比例、複製
// ============================================================
presetGroup.addEventListener('click', (e) => {
  const chip = e.target.closest('.chip');
  if (!chip) return;
  points = PRESETS[chip.dataset.preset].map((p) => [...p]);
  rebuild();
});

aspectGroup.addEventListener('click', (e) => {
  const chip = e.target.closest('.chip');
  if (!chip) return;
  stage.style.aspectRatio = chip.dataset.aspect;
  aspectGroup.querySelectorAll('.chip').forEach((c) => c.classList.toggle('is-active', c === chip));
});

let hintTimer = null;
copyBtn.addEventListener('click', async () => {
  if (await copyText(codeOut.textContent)) {
    copyHint.textContent = '已複製 clip-path 到剪貼簿';
    clearTimeout(hintTimer);
    hintTimer = setTimeout(() => { copyHint.textContent = ''; }, 1600);
    track('use');
  }
});

// 首次建構
rebuild();
