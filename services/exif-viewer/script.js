// ============================================================
// 50 EXIF 檢視與移除 — 畫面互動：載入 JPEG → exif-core.js 純運算解析
// → 隱私檢點＋分組明細 → 無損剔除中繼資料下載
// 資安：EXIF 字串為不可信輸入，一律 textContent 進 DOM，不經 innerHTML
// ============================================================
import { bindDropzone, downloadBlob, copyText, formatBytes, track } from '../../shared/scripts/shared.js?v=202607181508';
import { parseJpeg, stripJpeg } from './exif-core.js?v=202607181508';

const $ = (id) => document.getElementById(id);

const dropzone = $('dropzone');
const fileInput = $('file-input');
const dropError = $('drop-error');
const editor = $('editor');
const changeBtn = $('change-btn');
const fileNameEl = $('file-name');
const fileDimEl = $('file-dim');
const checklistEl = $('privacy-checklist');
const stripBtn = $('strip-btn');
const stripHint = $('strip-hint');
const photoPreview = $('photo-preview');
const gpsCard = $('gps-card');
const gpsCoords = $('gps-coords');
const gpsCopyBtn = $('gps-copy-btn');
const gpsMapLink = $('gps-map-link');
const sectionsEl = $('exif-sections');
const emptyEl = $('exif-empty');
const emptyDescEl = $('exif-empty-desc');
const footnoteEl = $('exif-footnote');

const GROUP_TITLES = [
  ['camera', '相機與鏡頭'],
  ['exposure', '拍攝參數'],
  ['image', '影像與軟體'],
];

const META_KIND_LABELS = {
  exif: 'EXIF', xmp: 'XMP', 'app1-other': 'APP1', iptc: 'IPTC／Photoshop', comment: '註解（COM）',
};

let current = null; // { name, bytes: Uint8Array, parsed, width, height }
let objectUrl = null;

init();

function init() {
  bindDropzone(dropzone, handleFiles);
  dropzone.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    if (fileInput.files.length) handleFiles(fileInput.files);
    fileInput.value = '';
  });
  changeBtn.addEventListener('click', resetToDropzone);
  stripBtn.addEventListener('click', stripAndDownload);
  gpsCopyBtn.addEventListener('click', copyGpsCoords);
}

// ============================================================
// 載入與解析
// ============================================================
async function handleFiles(fileList) {
  const file = fileList[0];
  if (!file) return;

  const bytes = new Uint8Array(await file.arrayBuffer());
  const parsed = parseJpeg(bytes);
  if (!parsed.valid) {
    // 以檔案內容（magic bytes）判定，不信任副檔名
    dropError.textContent = `「${file.name}」不是 JPEG 檔——EXIF 是 JPEG 格式的中繼資料，請改用 JPG／JPEG 照片。`;
    dropError.hidden = false;
    return;
  }
  dropError.hidden = true;

  if (objectUrl) URL.revokeObjectURL(objectUrl);
  objectUrl = URL.createObjectURL(file);

  const img = new Image();
  img.onload = () => {
    current = { name: file.name, bytes, parsed, width: img.naturalWidth, height: img.naturalHeight };
    photoPreview.src = objectUrl;
    dropzone.hidden = true;
    editor.hidden = false;
    stripHint.textContent = '';
    renderAll();
  };
  img.src = objectUrl;
}

function resetToDropzone() {
  editor.hidden = true;
  dropzone.hidden = false;
  dropError.hidden = true;
  current = null;
  photoPreview.removeAttribute('src');
  if (objectUrl) { URL.revokeObjectURL(objectUrl); objectUrl = null; }
}

// ============================================================
// 畫面渲染
// ============================================================
function renderAll() {
  const { parsed, name, bytes, width, height } = current;

  fileNameEl.textContent = name;
  fileDimEl.textContent = `${width} × ${height} px · ${formatBytes(bytes.length)}`;

  renderChecklist();
  renderGpsCard();
  renderSections();
  renderFootnote();

  // 沒有任何可移除的中繼資料段時，移除鈕停用
  const removable = parsed.metaSegments.length > 0;
  stripBtn.disabled = !removable;
  stripBtn.textContent = removable ? '↓ 移除中繼資料並下載' : '沒有可移除的中繼資料';
}

// — 隱私檢點清單 —
function renderChecklist() {
  const { parsed } = current;
  const items = [];

  items.push(parsed.gps
    ? fail('內含 GPS 定位座標（可指出拍攝地點）')
    : pass('無 GPS 定位'));

  const timeEntries = parsed.entries.filter((e) => e.privacy === 'time');
  items.push(timeEntries.length
    ? warn(`內含時間資訊（${timeEntries.map((e) => e.label).join('、')}）`)
    : pass('無時間資訊'));

  const idEntries = parsed.entries.filter((e) => e.privacy === 'identity');
  items.push(idEntries.length
    ? warn(`內含可識別欄位（${idEntries.map((e) => e.label).join('、')}）`)
    : pass('無序號／作者等可識別欄位'));

  if (parsed.metaSegments.length) {
    const total = parsed.metaSegments.reduce((sum, s) => sum + s.size, 0);
    const kinds = [...new Set(parsed.metaSegments.map((s) => META_KIND_LABELS[s.kind] || s.kind))];
    items.push(warn(`中繼資料共 ${parsed.metaSegments.length} 段（${kinds.join('、')}，${formatBytes(total)}）`));
  } else {
    items.push(pass('檔案內無中繼資料段'));
  }

  checklistEl.replaceChildren(...items);

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

// — GPS 警示卡 —
function renderGpsCard() {
  const { gps } = current.parsed;
  gpsCard.hidden = !gps;
  if (!gps) return;

  const coordText = `${gps.lat}, ${gps.lon}`;
  gpsCoords.textContent = gps.alt !== null ? `${coordText}（海拔約 ${gps.alt} m）` : coordText;
  // 座標為解析出的數字（非字串），組 URL 前再驗一次型別當雙保險
  if (Number.isFinite(gps.lat) && Number.isFinite(gps.lon)) {
    gpsMapLink.href = `https://www.openstreetmap.org/?mlat=${gps.lat}&mlon=${gps.lon}#map=16/${gps.lat}/${gps.lon}`;
  } else {
    gpsMapLink.removeAttribute('href');
  }
}

async function copyGpsCoords() {
  const { gps } = current.parsed;
  if (!gps) return;
  if (await copyText(`${gps.lat}, ${gps.lon}`)) {
    stripHint.textContent = '已複製座標';
    setTimeout(() => { stripHint.textContent = ''; }, 1800);
  }
}

// — EXIF 分組明細 —
function renderSections() {
  const { parsed } = current;
  sectionsEl.replaceChildren();

  for (const [group, title] of GROUP_TITLES) {
    const entries = parsed.entries.filter((e) => e.group === group);
    if (!entries.length) continue;

    const section = document.createElement('div');
    section.className = 'exif-section';
    const head = document.createElement('div');
    head.className = 'exif-section-head';
    head.textContent = title;
    section.appendChild(head);

    for (const entry of entries) {
      const row = document.createElement('div');
      row.className = entry.privacy ? 'exif-row is-privacy' : 'exif-row';
      const label = document.createElement('span');
      label.className = 'exif-row-label';
      label.textContent = entry.label;
      const value = document.createElement('span');
      value.className = 'exif-row-value';
      value.textContent = entry.value; // EXIF 字串不可信，textContent 防 XSS
      row.append(label, value);
      section.appendChild(row);
    }
    sectionsEl.appendChild(section);
  }

  // 空狀態：連一條列得出的 EXIF 都沒有
  const isEmpty = parsed.entries.length === 0 && !parsed.gps;
  emptyEl.hidden = !isEmpty;
  if (isEmpty) {
    emptyDescEl.textContent = parsed.metaSegments.length
      ? '沒有可顯示的 EXIF 欄位，但檔案內仍有其他中繼資料段（見左側檢點），移除功能會一併剔除。'
      : '這張照片沒有任何中繼資料，可以放心分享。';
  }
}

// — 註腳：未列名標籤數、保留段說明、解析警告 —
function renderFootnote() {
  const { parsed } = current;
  const notes = [];
  if (parsed.unknownCount > 0) notes.push(`另有 ${parsed.unknownCount} 個未列名的 EXIF 標籤未逐條顯示（移除時一併剔除）。`);
  notes.push(...parsed.keptNotes.map((n) => `保留：${n}`));
  notes.push(...parsed.warnings);
  footnoteEl.textContent = notes.join(' ');
  footnoteEl.hidden = notes.length === 0;
}

// ============================================================
// 無損移除並下載
// ============================================================
function stripAndDownload() {
  if (!current) return;
  const result = stripJpeg(current.bytes);
  if (!result) {
    stripHint.textContent = '處理失敗：檔案結構無法解析';
    return;
  }

  const base = current.name.replace(/\.[^.]+$/, '') || 'photo';
  downloadBlob(new Blob([result.bytes], { type: 'image/jpeg' }), `${base}-clean.jpg`);
  track('use');

  const saved = current.bytes.length - result.bytes.length;
  const parts = [`已移除 ${result.removed.length} 段中繼資料（省下 ${formatBytes(Math.max(saved, 0))}）`];
  if (result.orientationKept) parts.push('已保留方向標籤');
  stripHint.textContent = parts.join('，');
}
