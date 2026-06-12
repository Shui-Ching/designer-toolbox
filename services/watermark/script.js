// ============================================================
// 23 浮水印 — 文字／logo 浮水印，九宮格或拖曳定位、單顆或平鋪、可調大小／透明度／旋轉
// 與 01／06／16 共用「解碼→canvas→toBlob」圖片管線；浮水印參數一律以「佔圖寬比例」儲存，
// 故同一組設定可一致套用到尺寸不同的批次圖片（預覽用縮放畫布、輸出用原圖尺寸，數學相同）
// ============================================================
import { downloadBlob, bindDropzone, escapeHtml, track } from '../../shared/scripts/shared.js?v=202606121244';

const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('file-input');
const editor = document.getElementById('editor');

const typeGroup = document.getElementById('type-group');
const textBlock = document.getElementById('text-block');
const logoBlock = document.getElementById('logo-block');
const textInput = document.getElementById('text-input');
const textColor = document.getElementById('text-color');
const textColorHex = document.getElementById('text-color-hex');
const logoPick = document.getElementById('logo-pick');
const logoInput = document.getElementById('logo-input');
const logoName = document.getElementById('logo-name');

const sizeSlider = document.getElementById('size');
const opacitySlider = document.getElementById('opacity');
const rotateSlider = document.getElementById('rotate');
const gapSlider = document.getElementById('gap');
const valSize = document.getElementById('val-size');
const valOpacity = document.getElementById('val-opacity');
const valRotate = document.getElementById('val-rotate');
const valGap = document.getElementById('val-gap');

const modeGroup = document.getElementById('mode-group');
const posBlock = document.getElementById('pos-block');
const posGrid = document.getElementById('pos-grid');
const gapBlock = document.getElementById('gap-block');
const formatGroup = document.getElementById('format-group');

const downloadBtn = document.getElementById('download-btn');
const downloadAllBtn = document.getElementById('download-all');
const addBtn = document.getElementById('add-btn');
const clearBtn = document.getElementById('clear-btn');

const stage = document.getElementById('wm-stage');
const stageHint = document.getElementById('stage-hint');
const canvas = document.getElementById('wm-canvas');
const ctx = canvas.getContext('2d');
const thumbStrip = document.getElementById('thumb-strip');

const PREVIEW_MAX = 720; // 預覽畫布長邊上限（px）
const EXT = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };

// — 浮水印設定（所有尺寸性參數皆為「佔圖寬比例」或 0..1，故與圖片實際尺寸無關）—
const settings = {
  type: 'text',          // text | logo
  text: '© 你的品牌',
  color: '#ffffff',
  sizePct: 6,            // 文字字級／logo 寬度 = 圖寬的 N%
  opacity: 0.35,
  rotate: 0,             // 角度
  mode: 'single',        // single | tile
  anchor: 'br',          // 九宮格鍵；'free' = 拖曳後的自訂位置
  pos: { x: 0.92, y: 0.92 }, // anchor='free' 時的浮水印中心（0..1）
  gapPct: 10,            // 平鋪間距 = 圖寬的 N%
  format: 'image/png',
};

let logoImg = null;       // 已載入的 logo 圖（Image）
let items = [];           // 批次：{ id, name, img }
let activeId = null;
let nextId = 1;

init();

async function init() {
  bindDropzone(dropzone, handleFiles);
  dropzone.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    if (fileInput.files.length) handleFiles(fileInput.files);
    fileInput.value = '';
  });
  addBtn.addEventListener('click', () => fileInput.click());

  // 類型切換
  typeGroup.addEventListener('click', (e) => {
    const btn = e.target.closest('.chip');
    if (!btn) return;
    settings.type = btn.dataset.type;
    setActive(typeGroup, btn);
    textBlock.hidden = settings.type !== 'text';
    logoBlock.hidden = settings.type !== 'logo';
    paint();
  });

  // 文字內容
  textInput.addEventListener('input', () => { settings.text = textInput.value; paint(); });

  // 顏色：色票 ↔ hex 雙向同步
  textColor.addEventListener('input', () => {
    settings.color = textColor.value;
    textColorHex.value = textColor.value.toUpperCase();
    paint();
  });
  textColorHex.addEventListener('input', () => {
    const v = textColorHex.value.trim();
    if (/^#[0-9a-fA-F]{6}$/.test(v)) {
      settings.color = v;
      textColor.value = v;
      paint();
    }
  });

  // logo 上傳
  logoPick.addEventListener('click', () => logoInput.click());
  logoInput.addEventListener('change', () => {
    const file = [...logoInput.files].find((f) => f.type.startsWith('image/'));
    logoInput.value = '';
    if (!file) return;
    const img = new Image();
    img.onload = () => { logoImg = img; paint(); };
    img.src = URL.createObjectURL(file);
    logoName.textContent = file.name;
    logoName.hidden = false;
  });

  // 滑桿
  sizeSlider.addEventListener('input', () => { settings.sizePct = Number(sizeSlider.value); valSize.textContent = sizeSlider.value; paint(); });
  opacitySlider.addEventListener('input', () => { settings.opacity = Number(opacitySlider.value) / 100; valOpacity.textContent = opacitySlider.value; paint(); });
  rotateSlider.addEventListener('input', () => { settings.rotate = Number(rotateSlider.value); valRotate.textContent = rotateSlider.value; paint(); });
  gapSlider.addEventListener('input', () => { settings.gapPct = Number(gapSlider.value); valGap.textContent = gapSlider.value; paint(); });

  // 排列方式
  modeGroup.addEventListener('click', (e) => {
    const btn = e.target.closest('.chip');
    if (!btn) return;
    settings.mode = btn.dataset.mode;
    setActive(modeGroup, btn);
    posBlock.hidden = settings.mode !== 'single';
    gapBlock.hidden = settings.mode !== 'tile';
    paint();
  });

  // 九宮格定位
  posGrid.addEventListener('click', (e) => {
    const cell = e.target.closest('.pos-cell');
    if (!cell) return;
    settings.anchor = cell.dataset.anchor;
    setActivePos(cell);
    paint();
  });

  // 輸出格式
  formatGroup.addEventListener('click', (e) => {
    const btn = e.target.closest('.chip');
    if (!btn) return;
    settings.format = btn.dataset.format;
    setActive(formatGroup, btn);
  });

  downloadBtn.addEventListener('click', downloadActive);
  downloadAllBtn.addEventListener('click', downloadAll);
  clearBtn.addEventListener('click', clearAll);

  bindDrag();
  window.addEventListener('resize', () => { if (activeId) { measure(); paint(); } });

  // 等字體就緒再首繪，避免 canvas 量到 fallback 字體寬度
  if (document.fonts?.ready) await document.fonts.ready;
}

// ============================================================
// 載入圖片（可批次）
// ============================================================
function handleFiles(fileList) {
  const files = [...fileList].filter((f) => f.type.startsWith('image/'));
  if (!files.length) return;

  let settled = 0;
  // 每張圖（成功或失敗）都推進計數，全部就緒後才顯示編輯區
  const done = () => {
    if (++settled < files.length) { renderThumbs(); return; }
    if (!items.length) return; // 全部解碼失敗，維持上傳狀態
    dropzone.hidden = true;
    editor.hidden = false;
    renderThumbs();
    measure();
    paint();
  };

  files.forEach((file) => {
    const img = new Image();
    img.onload = () => {
      const item = { id: nextId++, name: file.name.replace(/\.[^.]+$/, '') || 'image', img };
      items.push(item);
      if (activeId === null) activeId = item.id;
      done();
    };
    img.onerror = done; // 單張失敗就跳過，不卡住其他檔案
    img.src = URL.createObjectURL(file);
  });
}

function activeItem() {
  return items.find((it) => it.id === activeId) || null;
}

// — 依舞台可用寬與圖片比例算出預覽畫布尺寸 —
function measure() {
  const it = activeItem();
  if (!it) return;
  const { naturalWidth: w, naturalHeight: h } = it.img;
  const maxW = stage.clientWidth || w;
  const scale = Math.min(1, maxW / w, PREVIEW_MAX / Math.max(w, h));
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
}

// ============================================================
// 繪製（預覽與輸出共用同一套數學）
// drawTo(c, base) 把 base 圖鋪滿 c，再依目前設定壓上浮水印
// ============================================================
function paint() {
  const it = activeItem();
  if (!it) return;
  if (!canvas.width) measure();
  drawTo(ctx, it.img, canvas.width, canvas.height);
  stageHint.textContent = `${it.img.naturalWidth} × ${it.img.naturalHeight} px`;
}

function drawTo(c, base, W, H) {
  c.clearRect(0, 0, W, H);
  c.drawImage(base, 0, 0, W, H);

  c.save();
  c.globalAlpha = settings.opacity;
  if (settings.type === 'logo') {
    if (logoImg) drawMark(c, W, H, logoMetrics(W), drawLogoAt.bind(null, c));
  } else if (settings.text.trim()) {
    applyFont(c, W);
    c.fillStyle = settings.color;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    drawMark(c, W, H, textMetrics(c, W), (x, y) => c.fillText(settings.text, x, y));
  }
  c.restore();
}

// — 字型：字級 = 圖寬 × sizePct%，粗體增強可讀性 —
function applyFont(c, W) {
  const px = (settings.sizePct / 100) * W;
  c.font = `700 ${px}px 'Inter', 'Noto Sans TC', sans-serif`;
}

// — 量測文字浮水印的半寬高（未旋轉）—
function textMetrics(c, W) {
  const px = (settings.sizePct / 100) * W;
  const tw = c.measureText(settings.text).width;
  return { hw: tw / 2, hh: px / 2, stepX: tw, stepY: px * 1.8 };
}

// — 量測 logo 浮水印的半寬高 —
function logoMetrics(W) {
  const lw = (settings.sizePct / 100) * W;
  const lh = lw * (logoImg.naturalHeight / logoImg.naturalWidth);
  return { hw: lw / 2, hh: lh / 2, stepX: lw, stepY: lh, lw, lh };
}

function drawLogoAt(c, x, y, m) {
  c.drawImage(logoImg, x - m.lw / 2, y - m.lh / 2, m.lw, m.lh);
}

// — 單顆或平鋪的共同骨架；single 走九宮格／拖曳定位，tile 旋轉後鋪滿 —
function drawMark(c, W, H, m, draw) {
  const rad = (settings.rotate * Math.PI) / 180;
  const gap = (settings.gapPct / 100) * W;

  if (settings.mode === 'tile') {
    const stepX = m.stepX + gap;
    const stepY = m.stepY + gap;
    const diag = Math.hypot(W, H);
    c.translate(W / 2, H / 2);
    c.rotate(rad);
    for (let y = -diag; y <= diag; y += stepY) {
      for (let x = -diag; x <= diag; x += stepX) {
        draw(x, y, m);
      }
    }
  } else {
    const { x, y } = anchorPos(W, H, m);
    c.translate(x, y);
    c.rotate(rad);
    draw(0, 0, m);
  }
}

// — 依 anchor 算出浮水印中心（px）；'free' 用拖曳存下的比例座標 —
function anchorPos(W, H, m) {
  if (settings.anchor === 'free') {
    return { x: settings.pos.x * W, y: settings.pos.y * H };
  }
  const margin = 0.04 * Math.min(W, H);
  const a = settings.anchor;
  let x = W / 2;
  let y = H / 2;
  if (a.includes('l')) x = margin + m.hw;
  if (a.includes('r')) x = W - margin - m.hw;
  if (a.startsWith('t')) y = margin + m.hh;
  if (a.startsWith('b')) y = H - margin - m.hh;
  return { x, y };
}

// ============================================================
// 在預覽上拖曳浮水印（單顆模式）
// ============================================================
function bindDrag() {
  let dragging = false;

  const toNorm = (e) => {
    const rect = canvas.getBoundingClientRect();
    return {
      x: clamp((e.clientX - rect.left) / rect.width, 0, 1),
      y: clamp((e.clientY - rect.top) / rect.height, 0, 1),
    };
  };

  canvas.addEventListener('pointerdown', (e) => {
    if (settings.mode !== 'single' || !activeId) return;
    dragging = true;
    canvas.setPointerCapture?.(e.pointerId);
    stage.classList.add('is-dragging');
    settings.anchor = 'free';
    setActivePos(null);
    settings.pos = toNorm(e);
    paint();
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    settings.pos = toNorm(e);
    paint();
  });
  const end = (e) => {
    if (!dragging) return;
    dragging = false;
    stage.classList.remove('is-dragging');
    canvas.releasePointerCapture?.(e.pointerId);
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
}

// ============================================================
// 縮圖列
// ============================================================
function renderThumbs() {
  thumbStrip.innerHTML = items.map((it) => `
    <li class="thumb ${it.id === activeId ? 'is-active' : ''}" data-id="${it.id}">
      <img src="${it.img.src}" alt="${escapeHtml(it.name)}" loading="lazy">
      <button type="button" class="thumb-del" data-id="${it.id}" aria-label="移除">✕</button>
    </li>`).join('');

  thumbStrip.querySelectorAll('.thumb').forEach((el) => {
    el.addEventListener('click', (e) => {
      if (e.target.closest('.thumb-del')) return;
      activeId = Number(el.dataset.id);
      renderThumbs();
      measure();
      paint();
    });
  });
  thumbStrip.querySelectorAll('.thumb-del').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      removeItem(Number(btn.dataset.id));
    });
  });
}

function removeItem(id) {
  items = items.filter((it) => it.id !== id);
  if (activeId === id) activeId = items[0]?.id ?? null;
  if (!items.length) return backToDropzone();
  renderThumbs();
  measure();
  paint();
}

function clearAll() {
  items = [];
  activeId = null;
  backToDropzone();
}

function backToDropzone() {
  editor.hidden = true;
  dropzone.hidden = false;
  thumbStrip.innerHTML = '';
}

// ============================================================
// 輸出：以原圖尺寸重繪（數學與預覽相同），再 toBlob 下載
// ============================================================
function exportItem(it) {
  return new Promise((resolve) => {
    const W = it.img.naturalWidth;
    const H = it.img.naturalHeight;
    const out = document.createElement('canvas');
    out.width = W;
    out.height = H;
    const octx = out.getContext('2d');
    // JPEG 無透明通道：先鋪白底避免透明區變黑
    if (settings.format === 'image/jpeg') {
      octx.fillStyle = '#ffffff';
      octx.fillRect(0, 0, W, H);
    }
    drawTo(octx, it.img, W, H);
    const quality = settings.format === 'image/png' ? undefined : 0.92;
    out.toBlob((blob) => resolve(blob), settings.format, quality);
  });
}

async function downloadActive() {
  const it = activeItem();
  if (!it) return;
  const blob = await exportItem(it);
  if (blob) { downloadBlob(blob, `${it.name}-watermark.${EXT[settings.format]}`); track('use'); }
}

async function downloadAll() {
  if (!items.length) return;
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const blob = await exportItem(it);
    if (blob) setTimeout(() => downloadBlob(blob, `${it.name}-watermark.${EXT[settings.format]}`), i * 150);
  }
  track('use');
}

// ============================================================
// 小工具
// ============================================================
function setActive(group, activeBtn) {
  group.querySelectorAll('.chip').forEach((b) => b.classList.toggle('is-active', b === activeBtn));
}

function setActivePos(cell) {
  posGrid.querySelectorAll('.pos-cell').forEach((c) => c.classList.toggle('is-active', c === cell));
}

function clamp(v, min, max) {
  return Math.min(Math.max(v, min), max);
}
