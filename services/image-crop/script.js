// ============================================================
// 06 圖片裁切／改尺寸 — 互動裁切框 + Canvas drawImage 輸出
// 裁切座標一律以「原圖像素」為準，顯示時再乘上縮放比例 scale
// ============================================================
import { downloadBlob, bindDropzone, track } from '../../shared/scripts/shared.js?v=202607092241';

const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('file-input');
const editor = document.getElementById('editor');
const stage = document.getElementById('crop-stage');
const imageEl = document.getElementById('crop-image');
const frame = document.getElementById('crop-frame');
const ratioGroup = document.getElementById('ratio-group');
const socialBlock = document.getElementById('social-block');
const socialSelect = document.getElementById('social-select');
const sizeGroup = document.getElementById('size-group');
const widthRow = document.getElementById('width-row');
const widthInput = document.getElementById('width-input');
const formatGroup = document.getElementById('format-group');
const readoutCrop = document.getElementById('readout-crop');
const readoutOut = document.getElementById('readout-out');
const downloadBtn = document.getElementById('download-btn');
const resetBtn = document.getElementById('reset-btn');
const changeBtn = document.getElementById('change-btn');

const MIN_SIZE = 16; // 裁切框最小邊長（原圖像素）
const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

// 狀態
const state = {
  fileName: 'image',
  natW: 0,            // 原圖寬（px）
  natH: 0,            // 原圖高（px）
  scale: 1,           // 顯示尺寸 / 原圖尺寸
  crop: { x: 0, y: 0, w: 0, h: 0 }, // 裁切框（原圖像素座標）
  ratio: null,        // 鎖定比例（w/h）；null = 自由
  sizeMode: 'natural',// natural | width
  targetExact: null,  // 社群版位指定的精確輸出 {w,h}；非 null 時優先
  format: 'image/jpeg',
};

init();

function init() {
  bindDropzone(dropzone, handleFiles);
  dropzone.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    if (fileInput.files.length) handleFiles(fileInput.files);
    fileInput.value = '';
  });

  ratioGroup.addEventListener('click', onRatioClick);
  sizeGroup.addEventListener('click', onSizeClick);
  formatGroup.addEventListener('click', onFormatClick);
  socialSelect.addEventListener('change', onSocialChange);
  widthInput.addEventListener('input', () => { clearTarget(); updateReadout(); });

  downloadBtn.addEventListener('click', exportImage);
  resetBtn.addEventListener('click', () => { resetCropToRatio(); render(); });
  changeBtn.addEventListener('click', changeImage);

  bindCropInteraction();
  window.addEventListener('resize', () => { if (state.natW) { measure(); render(); } });

  loadSocialPresets();
}

// — 載入第一張圖片 —
function handleFiles(fileList) {
  const file = [...fileList].find((f) => f.type.startsWith('image/'));
  if (!file) return;

  state.fileName = file.name.replace(/\.[^.]+$/, '') || 'image';
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    state.natW = img.naturalWidth;
    state.natH = img.naturalHeight;
    imageEl.src = url;
    dropzone.hidden = true;
    editor.hidden = false;
    measure();
    resetCropToRatio();
    render();
  };
  img.src = url;
}

// — 量測舞台可用寬度，算出顯示縮放比例 —
function measure() {
  const maxW = stage.parentElement.clientWidth || state.natW;
  const dispW = Math.min(state.natW, maxW);
  state.scale = dispW / state.natW;
  imageEl.style.width = `${dispW}px`;
  imageEl.style.height = `${state.natH * state.scale}px`;
}

// ============================================================
// 控制項
// ============================================================
function onRatioClick(e) {
  const btn = e.target.closest('.chip');
  if (!btn) return;
  setActive(ratioGroup, btn);
  state.ratio = btn.dataset.ratio === 'free' ? null : Number(btn.dataset.ratio);
  stage.classList.toggle('is-locked', state.ratio !== null);
  clearTarget();
  resetCropToRatio();
  render();
}

function onSizeClick(e) {
  const btn = e.target.closest('.chip');
  if (!btn) return;
  setActive(sizeGroup, btn);
  state.sizeMode = btn.dataset.size;
  widthRow.hidden = state.sizeMode !== 'width';
  clearTarget();
  updateReadout();
}

function onFormatClick(e) {
  const btn = e.target.closest('.chip');
  if (!btn) return;
  setActive(formatGroup, btn);
  state.format = btn.dataset.format;
}

// 套用社群版位：鎖比例 + 指定精確輸出像素
function onSocialChange() {
  const opt = socialSelect.selectedOptions[0];
  const w = Number(opt.dataset.w);
  const h = Number(opt.dataset.h);
  if (!w || !h) { clearTarget(); updateReadout(); return; }

  state.ratio = w / h;
  state.targetExact = { w, h };
  stage.classList.add('is-locked');
  // 比例分段鈕取消高亮（改由社群版位主導）
  ratioGroup.querySelectorAll('.chip').forEach((b) => b.classList.remove('is-active'));
  resetCropToRatio();
  render();
}

// 清掉社群版位指定（使用者手動改了比例／尺寸時）
function clearTarget() {
  if (state.targetExact) {
    state.targetExact = null;
    socialSelect.value = '';
  }
}

function setActive(group, activeBtn) {
  group.querySelectorAll('.chip').forEach((b) => b.classList.toggle('is-active', b === activeBtn));
}

// ============================================================
// 裁切框：預設、渲染、互動
// ============================================================
// 依目前比例給一個置中、儘量大的裁切框
function resetCropToRatio() {
  const { natW, natH, ratio } = state;
  if (!ratio) {
    state.crop = { x: 0, y: 0, w: natW, h: natH };
    return;
  }
  let w = natW;
  let h = w / ratio;
  if (h > natH) { h = natH; w = h * ratio; }
  state.crop = { x: (natW - w) / 2, y: (natH - h) / 2, w, h };
}

// 把裁切框位置畫到畫面（顯示像素）
function render() {
  const { crop, scale } = state;
  frame.style.left = `${crop.x * scale}px`;
  frame.style.top = `${crop.y * scale}px`;
  frame.style.width = `${crop.w * scale}px`;
  frame.style.height = `${crop.h * scale}px`;
  updateReadout();
}

function updateReadout() {
  const cw = Math.round(state.crop.w);
  const ch = Math.round(state.crop.h);
  readoutCrop.textContent = `${cw} × ${ch} px`;
  const { w, h } = getOutputDims();
  const sameAsCrop = w === cw && h === ch;
  readoutOut.textContent = `${w} × ${h} px${sameAsCrop ? '' : ' ↩'}`;
}

// 依輸出設定算出最終輸出像素
function getOutputDims() {
  const cw = state.crop.w;
  const ch = state.crop.h;
  if (state.targetExact) return { ...state.targetExact };
  if (state.sizeMode === 'width') {
    const w = Math.max(1, Math.round(Number(widthInput.value) || 0));
    const h = Math.max(1, Math.round(w * ch / cw));
    return { w, h };
  }
  return { w: Math.round(cw), h: Math.round(ch) };
}

// — 拖曳互動（pointer events，滑鼠／觸控通用）—
function bindCropInteraction() {
  let active = null; // { type:'move'|'resize', dir, startX, startY, startCrop }

  const toNatural = (e) => {
    const rect = imageEl.getBoundingClientRect();
    return {
      x: clamp((e.clientX - rect.left) / state.scale, 0, state.natW),
      y: clamp((e.clientY - rect.top) / state.scale, 0, state.natH),
    };
  };

  const onDown = (e, type, dir) => {
    e.preventDefault();
    active = {
      type,
      dir,
      startX: e.clientX,
      startY: e.clientY,
      startCrop: { ...state.crop },
    };
    frame.setPointerCapture?.(e.pointerId);
  };

  // 框內拖曳 = 移動
  frame.addEventListener('pointerdown', (e) => {
    if (e.target.classList.contains('crop-handle')) return;
    onDown(e, 'move');
  });
  // 控制點拖曳 = 縮放
  frame.querySelectorAll('.crop-handle').forEach((h) => {
    h.addEventListener('pointerdown', (e) => { e.stopPropagation(); onDown(e, 'resize', h.dataset.dir); });
  });

  frame.addEventListener('pointermove', (e) => {
    if (!active) return;
    if (active.type === 'move') {
      const dx = (e.clientX - active.startX) / state.scale;
      const dy = (e.clientY - active.startY) / state.scale;
      const c = active.startCrop;
      state.crop = {
        x: clamp(c.x + dx, 0, state.natW - c.w),
        y: clamp(c.y + dy, 0, state.natH - c.h),
        w: c.w,
        h: c.h,
      };
    } else {
      const p = toNatural(e);
      state.ratio ? resizeLocked(active.dir, p) : resizeFree(active.dir, p);
    }
    render();
  });

  const end = (e) => { active = null; frame.releasePointerCapture?.(e.pointerId); };
  frame.addEventListener('pointerup', end);
  frame.addEventListener('pointercancel', end);
}

// 自由比例：八向，各邊獨立
function resizeFree(dir, p) {
  const c = state.crop;
  let left = c.x, top = c.y, right = c.x + c.w, bottom = c.y + c.h;
  if (dir.includes('w')) left = Math.min(p.x, right - MIN_SIZE);
  if (dir.includes('e')) right = Math.max(p.x, left + MIN_SIZE);
  if (dir.includes('n')) top = Math.min(p.y, bottom - MIN_SIZE);
  if (dir.includes('s')) bottom = Math.max(p.y, top + MIN_SIZE);
  state.crop = { x: left, y: top, w: right - left, h: bottom - top };
}

// 鎖定比例：只用四角，對角固定、維持比例並貼齊邊界
function resizeLocked(dir, p) {
  const ratio = state.ratio;
  const c = state.crop;
  // 對角錨點（不動的那一角）
  const ax = dir.includes('e') ? c.x : c.x + c.w;
  const ay = dir.includes('s') ? c.y : c.y + c.h;

  let dw = Math.abs(p.x - ax);
  let dh = Math.abs(p.y - ay);
  // 取較貼近指標的一軸主導，另一軸依比例換算
  if (dw / dh > ratio) dh = dw / ratio; else dw = dh * ratio;

  // 不可超出錨點到邊界的可用空間（維持比例縮回）
  const maxW = p.x >= ax ? state.natW - ax : ax;
  const maxH = p.y >= ay ? state.natH - ay : ay;
  if (dw > maxW) { dw = maxW; dh = dw / ratio; }
  if (dh > maxH) { dh = maxH; dw = dh * ratio; }
  dw = Math.max(MIN_SIZE, dw);
  dh = dw / ratio;

  const left = p.x >= ax ? ax : ax - dw;
  const top = p.y >= ay ? ay : ay - dh;
  state.crop = { x: left, y: top, w: dw, h: dh };
}

// ============================================================
// 輸出
// ============================================================
function exportImage() {
  if (!state.natW) return;
  const { w, h } = getOutputDims();
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  // 非 PNG 無透明通道，先鋪白底避免透明變黑
  if (state.format !== 'image/png') {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
  }
  const { x, y, w: cw, h: ch } = state.crop;
  ctx.drawImage(imageEl, x, y, cw, ch, 0, 0, w, h);

  const quality = state.format === 'image/png' ? undefined : 0.92;
  canvas.toBlob(
    (blob) => { downloadBlob(blob, `${state.fileName}-crop.${EXT[state.format]}`); track('use'); },
    state.format,
    quality
  );
}

// — 換一張圖：回到上傳狀態 —
function changeImage() {
  editor.hidden = true;
  dropzone.hidden = false;
  imageEl.removeAttribute('src');
  state.natW = state.natH = 0;
}

// ============================================================
// 社群版位下拉（讀 03 的 social-sizes.json，失敗則隱藏）
// ============================================================
async function loadSocialPresets() {
  try {
    const res = await fetch('../../shared/data/social-sizes.json');
    const data = await res.json();
    const frag = document.createDocumentFragment();
    data.platforms.forEach((p) => {
      const group = document.createElement('optgroup');
      group.label = p.name;
      p.formats.forEach((f) => {
        const opt = document.createElement('option');
        opt.value = `${p.id}:${f.label}`;
        opt.dataset.w = f.width;
        opt.dataset.h = f.height;
        opt.textContent = `${f.label} · ${f.width}×${f.height}`;
        group.appendChild(opt);
      });
      frag.appendChild(group);
    });
    socialSelect.appendChild(frag);
    socialBlock.hidden = false;
  } catch {
    // 直接以 file:// 開啟時 fetch 可能被擋；靜默隱藏此區，不影響核心功能
  }
}

// — 小工具 —
function clamp(v, min, max) {
  return Math.min(Math.max(v, min), max);
}
