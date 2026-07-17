// ============================================================
// 46 LINE Rich Menu 預覽模擬器 — 畫面互動：載入圖片 → spec-check.js 純運算驗證
// → 分格 overlay 疊圖 → 去識別化聊天室 mockup 展開／收合
// ============================================================
import { bindDropzone, downloadBlob, copyText, formatBytes, track } from '../../shared/scripts/shared.js?v=202607172333';
import { evaluateSpec } from './spec-check.js?v=202607172333';

const $ = (id) => document.getElementById(id);

const dropzone = $('dropzone');
const fileInput = $('file-input');
const editor = $('editor');
const changeBtn = $('change-btn');
const fileNameEl = $('file-name');
const fileDimEl = $('file-dim');
const checklistEl = $('spec-checklist');
const templateGroup = $('template-group');
const gridToggle = $('grid-toggle');
const downloadBtn = $('download-btn');
const copyHint = $('copy-hint');
const rmStage = $('rm-stage');
const rmImage = $('rm-image');
const gridOverlay = $('grid-overlay');
const chatToggleAction = $('chat-toggle-action');
const chatMenu = $('chat-mock-menu');
const chatToggleBtn = $('chat-toggle-btn');
const chatMenuImg = $('chat-menu-img');

const COLLAPSED_HEIGHT = 36; // px，收合時的窄條高度

let specs = null;
let currentFile = null; // { name, width, height, bytes, mimeType }
let currentTemplate = null;
let objectUrl = null;
let expandedMenuHeight = 0;

init();

async function init() {
  specs = await loadSpecs();

  bindDropzone(dropzone, handleFiles);
  dropzone.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    if (fileInput.files.length) handleFiles(fileInput.files);
    fileInput.value = '';
  });

  changeBtn.addEventListener('click', changeImage);
  gridToggle.addEventListener('change', () => { gridOverlay.hidden = !gridToggle.checked; });
  templateGroup.addEventListener('click', onTemplateClick);
  chatToggleBtn.addEventListener('click', toggleChatMenu);
  chatToggleAction.addEventListener('click', toggleChatMenu);
  downloadBtn.addEventListener('click', downloadOverlay);

  window.addEventListener('resize', () => { if (currentFile) layoutMenuHeight(); });
}

// ============================================================
// 讀規格資料（比照 03/06 的 social-sizes.json 載入方式）
// ============================================================
async function loadSpecs() {
  const res = await fetch('../../shared/data/richmenu-specs.json');
  return res.json();
}

// ============================================================
// 載入圖片
// ============================================================
function handleFiles(fileList) {
  const file = [...fileList].find((f) => f.type.startsWith('image/'));
  if (!file) return;

  if (objectUrl) URL.revokeObjectURL(objectUrl);
  objectUrl = URL.createObjectURL(file);

  const img = new Image();
  img.onload = () => {
    currentFile = {
      name: file.name,
      width: img.naturalWidth,
      height: img.naturalHeight,
      bytes: file.size,
      mimeType: file.type,
    };
    rmImage.src = objectUrl;
    chatMenuImg.src = objectUrl;

    dropzone.hidden = true;
    editor.hidden = false;

    renderChecklist();
    renderTemplateOptions();
    // 圖片實際渲染尺寸要等瀏覽器排版完成才量得到，下一輪再排版選單高度
    requestAnimationFrame(layoutMenuHeight);
  };
  img.src = objectUrl;
}

function changeImage() {
  editor.hidden = true;
  dropzone.hidden = false;
  currentFile = null;
  currentTemplate = null;
  rmImage.removeAttribute('src');
  chatMenuImg.removeAttribute('src');
  gridOverlay.innerHTML = '';
}

// ============================================================
// 規格驗證清單
// ============================================================
function renderChecklist() {
  const result = evaluateSpec(currentFile, specs);
  const { width, height, bytes, name } = currentFile;

  fileNameEl.textContent = name;
  fileDimEl.textContent = `${width} × ${height} px · ${formatBytes(bytes)}`;

  const items = [];

  items.push(result.formatOk
    ? pass(`格式符合：${currentFile.mimeType.replace('image/', '').toUpperCase()}`)
    : fail(`格式應為 JPEG 或 PNG，目前為 ${currentFile.mimeType || '未知'}`));

  items.push(result.sizeOk
    ? pass(`檔案大小 ${formatBytes(bytes)}，未超過 1MB 上限`)
    : fail(`檔案大小 ${formatBytes(bytes)} 超過 1MB 上限`));

  if (result.matched) {
    items.push(pass(`符合官方預設尺寸：${result.matched.label}（${result.matched.width}×${result.matched.height}）`));
  } else if (result.dimensionOk) {
    items.push(warn('非官方預設尺寸，但符合自訂尺寸限制（寬 800–2500px、高 ≥ 250px、寬高比 ≥ 1.45）'));
  } else {
    const reasons = [];
    if (!result.range.widthOk) reasons.push('寬度需在 800–2500px 之間');
    if (!result.range.heightOk) reasons.push('高度需 ≥ 250px');
    if (!result.range.ratioOk) reasons.push('寬高比（寬 ÷ 高）需 ≥ 1.45');
    items.push(fail(`不符合尺寸限制：${reasons.join('；')}`));
  }

  items.push(pass(`版面類別：${result.category === 'large' ? 'Large（大版位）' : 'Compact（小版位）'}`));

  checklistEl.innerHTML = '';
  items.forEach((item) => checklistEl.appendChild(item));

  function pass(text) { return buildItem('is-pass', '✓', text); }
  function warn(text) { return buildItem('is-warn', '⚠', text); }
  function fail(text) { return buildItem('is-fail', '✕', text); }
  function buildItem(cls, icon, text) {
    const li = document.createElement('li');
    li.className = `spec-item ${cls}`;
    const iconEl = document.createElement('span');
    iconEl.className = 'spec-item-icon';
    iconEl.textContent = icon;
    const textEl = document.createElement('span');
    textEl.className = 'spec-item-text';
    textEl.textContent = text;
    li.append(iconEl, textEl);
    return li;
  }
}

// ============================================================
// 分格模板 overlay
// ============================================================
function renderTemplateOptions() {
  const category = evaluateSpec(currentFile, specs).category;
  const options = specs.templates.filter((t) => t.category === category);

  templateGroup.innerHTML = '';
  options.forEach((tpl, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `chip${i === 0 ? ' is-active' : ''}`;
    btn.dataset.templateId = tpl.id;
    btn.textContent = tpl.label;
    templateGroup.appendChild(btn);
  });

  currentTemplate = options[0] || null;
  renderGridOverlay();
}

function onTemplateClick(e) {
  const btn = e.target.closest('[data-template-id]');
  if (!btn) return;
  templateGroup.querySelectorAll('.chip').forEach((b) => b.classList.toggle('is-active', b === btn));
  currentTemplate = specs.templates.find((t) => t.id === btn.dataset.templateId) || null;
  renderGridOverlay();
}

function renderGridOverlay() {
  gridOverlay.innerHTML = '';
  gridOverlay.hidden = !gridToggle.checked;
  if (!currentTemplate) return;

  currentTemplate.cells.forEach(([x, y, w, h], i) => {
    const cell = document.createElement('div');
    cell.className = 'rm-grid-cell';
    cell.style.left = `${x * 100}%`;
    cell.style.top = `${y * 100}%`;
    cell.style.width = `${w * 100}%`;
    cell.style.height = `${h * 100}%`;
    const index = document.createElement('span');
    index.className = 'rm-grid-cell-index';
    index.textContent = String(i + 1);
    cell.appendChild(index);
    gridOverlay.appendChild(cell);
  });
}

// ============================================================
// 聊天室 mockup：展開／收合
// ============================================================
function layoutMenuHeight() {
  if (!currentFile) return;
  const menuWidth = chatMenu.clientWidth;
  expandedMenuHeight = Math.round(menuWidth * (currentFile.height / currentFile.width));
  if (!chatMenu.classList.contains('is-collapsed')) {
    chatMenu.style.height = `${expandedMenuHeight}px`;
  }
}

function toggleChatMenu() {
  const collapsed = chatMenu.classList.toggle('is-collapsed');
  chatMenu.style.height = `${collapsed ? COLLAPSED_HEIGHT : expandedMenuHeight}px`;
  chatToggleBtn.textContent = collapsed ? '⌃' : '⌄';
}

// ============================================================
// 下載疊圖（原圖 + 分格線 + 編號，燒錄成單張 PNG）
// ============================================================
function downloadOverlay() {
  if (!currentFile) return;

  const canvas = document.createElement('canvas');
  canvas.width = currentFile.width;
  canvas.height = currentFile.height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(rmImage, 0, 0, currentFile.width, currentFile.height);

  if (currentTemplate && gridToggle.checked) {
    const { width, height } = currentFile;
    ctx.lineWidth = Math.max(2, Math.round(Math.min(width, height) * 0.004));
    ctx.strokeStyle = '#d8442a';
    ctx.fillStyle = 'rgba(216, 68, 42, 0.12)';
    ctx.font = `${Math.round(Math.min(width, height) * 0.05)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    currentTemplate.cells.forEach(([x, y, w, h], i) => {
      const px = x * width, py = y * height, pw = w * width, ph = h * height;
      ctx.setLineDash([Math.round(width * 0.01), Math.round(width * 0.008)]);
      ctx.strokeRect(px, py, pw, ph);
      ctx.fillRect(px, py, pw, ph);
      ctx.fillStyle = '#f4f1e8';
      ctx.fillText(String(i + 1), px + pw / 2, py + ph / 2);
      ctx.fillStyle = 'rgba(216, 68, 42, 0.12)';
    });
  }

  canvas.toBlob((blob) => {
    downloadBlob(blob, `richmenu-overlay-${currentFile.width}x${currentFile.height}.png`);
    track('use');
    copyHint.textContent = '已下載疊圖';
    setTimeout(() => { copyHint.textContent = ''; }, 1800);
  }, 'image/png');
}
