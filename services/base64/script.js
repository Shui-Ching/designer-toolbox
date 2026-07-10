// ============================================================
// 32 Base64 編解碼 — 文字雙向互轉 + 圖片轉 data URI
// 零相依，全程瀏覽器端，文字與圖片皆不上傳
// ============================================================
import { copyText, track, formatBytes, bindDropzone, escapeHtml } from '../../shared/scripts/shared.js?v=202607101402';

// ── Base64 核心：正確處理 UTF-8（中文等多位元組字元）────────────
const enc = new TextEncoder();
const dec = new TextDecoder('utf-8');

// bytes → 標準 Base64
function bytesToBase64(bytes) {
  let bin = '';
  const CHUNK = 0x8000; // 分塊避免 apply 參數過多
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  }
  return btoa(bin);
}

// 標準 Base64 → bytes
function base64ToBytes(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

// 標準 Base64 → URL-safe（+/ 換 -_、去除尾端 =）
function toUrlSafe(b64) {
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// 任意 Base64（含 URL-safe／含空白）→ 標準 Base64（補回 padding）
function normalizeBase64(s) {
  s = s.replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/');
  const pad = s.length % 4;
  if (pad === 1) throw new Error('長度不合法'); // 4n+1 不可能是有效 Base64
  if (pad) s += '='.repeat(4 - pad);
  return s;
}

function encodeText(str, urlSafe) {
  const b64 = bytesToBase64(enc.encode(str));
  return urlSafe ? toUrlSafe(b64) : b64;
}

function decodeText(b64) {
  return dec.decode(base64ToBytes(normalizeBase64(b64)));
}

// ── DOM ─────────────────────────────────────────────────────
const tabText   = document.getElementById('tab-text');
const tabImage  = document.getElementById('tab-image');
const textMode  = document.getElementById('text-mode');
const imageMode = document.getElementById('image-mode');

const plainEl   = document.getElementById('plain');
const b64El     = document.getElementById('b64');
const plainMeta = document.getElementById('plain-meta');
const b64Meta   = document.getElementById('b64-meta');
const urlsafeBtn = document.getElementById('urlsafe-toggle');
const swapBtn   = document.getElementById('swap-btn');
const textClear = document.getElementById('text-clear');
const textHint  = document.getElementById('text-hint');

let urlSafe = false;

// ── 模式切換 ─────────────────────────────────────────────────
function setMode(mode) {
  const isText = mode === 'text';
  tabText.classList.toggle('is-active', isText);
  tabImage.classList.toggle('is-active', !isText);
  tabText.setAttribute('aria-selected', String(isText));
  tabImage.setAttribute('aria-selected', String(!isText));
  textMode.hidden = !isText;
  imageMode.hidden = isText;
}
tabText.addEventListener('click', () => setMode('text'));
tabImage.addEventListener('click', () => setMode('image'));

// ── 文字模式：雙向即時互轉 ──────────────────────────────────
function fmtCount(n) {
  return `${n.toLocaleString()} 字元`;
}

// 編碼：以純文字為來源，回填 Base64
function encodeNow() {
  b64El.classList.remove('is-error');
  b64El.value = encodeText(plainEl.value, urlSafe);
  updateMeta();
}

// 解碼：以 Base64 為來源，回填純文字；失敗則標紅、不動純文字
function decodeNow() {
  const raw = b64El.value.trim();
  if (!raw) {
    plainEl.value = '';
    b64El.classList.remove('is-error');
    updateMeta();
    return;
  }
  try {
    plainEl.value = decodeText(raw);
    b64El.classList.remove('is-error');
  } catch {
    b64El.classList.add('is-error');
  }
  updateMeta();
}

function updateMeta() {
  plainMeta.textContent = fmtCount(plainEl.value.length);
  b64Meta.textContent   = fmtCount(b64El.value.length);
}

plainEl.addEventListener('input', encodeNow);
b64El.addEventListener('input', decodeNow);

// URL-safe 切換：純文字為來源重新編碼
urlsafeBtn.addEventListener('click', () => {
  urlSafe = !urlSafe;
  urlsafeBtn.classList.toggle('is-active', urlSafe);
  urlsafeBtn.setAttribute('aria-pressed', String(urlSafe));
  encodeNow();
});

// 對調：把 Base64 內容當成新的純文字（方便連續編碼）
swapBtn.addEventListener('click', () => {
  plainEl.value = b64El.value;
  encodeNow();
});

textClear.addEventListener('click', () => {
  plainEl.value = '';
  b64El.value = '';
  b64El.classList.remove('is-error');
  textHint.textContent = '';
  updateMeta();
  plainEl.focus();
});

// 兩欄各自的複製鈕
document.querySelectorAll('.pane-copy').forEach((btn) => {
  btn.addEventListener('click', async () => {
    const which = btn.dataset.copy;
    const text = which === 'plain' ? plainEl.value : b64El.value;
    if (!text) return;
    if (await copyText(text)) {
      textHint.textContent = which === 'plain' ? '已複製純文字！' : '已複製 Base64！';
      setTimeout(() => { textHint.textContent = ''; }, 1600);
      track('use');
    }
  });
});

updateMeta();

// ── 圖片模式：圖片 → data URI ───────────────────────────────
const imgDrop    = document.getElementById('img-drop');
const imgInput   = document.getElementById('img-input');
const imgNotice  = document.getElementById('img-notice');
const imgResult  = document.getElementById('img-result');
const imgPreview = document.getElementById('img-preview');
const imgInfo    = document.getElementById('img-info');
const outDatauri = document.getElementById('out-datauri');
const outCss     = document.getElementById('out-css');
const imgHint    = document.getElementById('img-hint');

function showNotice(msg) {
  imgNotice.textContent = msg;
  imgNotice.hidden = false;
}

function handleImage(file) {
  imgNotice.hidden = true;
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    showNotice('這不是圖片檔，請選擇 PNG / JPG / WebP / GIF / SVG / AVIF 等圖片。');
    return;
  }
  const reader = new FileReader();
  reader.onload = () => renderResult(file, reader.result);
  reader.onerror = () => showNotice('讀取檔案失敗，請再試一次。');
  reader.readAsDataURL(file); // 直接得到 data:image/...;base64,...
}

function renderResult(file, dataUri) {
  imgPreview.src = dataUri;

  // 資訊列：檔名以 textContent 注入避免 XSS；data URI 長度供估算
  imgInfo.innerHTML =
    `<div><dt>檔名</dt><dd>${escapeHtml(file.name)}</dd></div>` +
    `<div><dt>類型</dt><dd>${escapeHtml(file.type || '未知')}</dd></div>` +
    `<div><dt>原始大小</dt><dd>${formatBytes(file.size)}</dd></div>` +
    `<div><dt>Data URI 長度</dt><dd>${dataUri.length.toLocaleString()} 字元</dd></div>`;

  outDatauri.textContent = dataUri;
  outCss.textContent = `background-image: url("${dataUri}");`;

  imgResult.hidden = false;
  imgHint.textContent = '';
}

bindDropzone(imgDrop, (files) => handleImage(files[0]));
imgDrop.addEventListener('click', () => imgInput.click());
imgInput.addEventListener('change', () => {
  if (imgInput.files.length) handleImage(imgInput.files[0]);
  imgInput.value = ''; // 允許重選同一檔
});

document.getElementById('copy-datauri').addEventListener('click', async () => {
  if (await copyText(outDatauri.textContent)) {
    imgHint.textContent = '已複製 Data URI！';
    setTimeout(() => { imgHint.textContent = ''; }, 1600);
    track('use');
  }
});

document.getElementById('copy-css').addEventListener('click', async () => {
  if (await copyText(outCss.textContent)) {
    imgHint.textContent = '已複製 CSS！';
    setTimeout(() => { imgHint.textContent = ''; }, 1600);
    track('use');
  }
});
