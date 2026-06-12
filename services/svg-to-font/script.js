// ============================================================
// 02 SVG 轉 Font — 把多個 SVG 在瀏覽器端組成圖示字型
// 流程：SVG → 路徑指令(svg-to-path) → opentype 字符 → TTF/WOFF → 即時預覽 + CSS
// opentype.js 由 CDN 載入為全域 `opentype`
// ============================================================
import { downloadBlob, copyText, bindDropzone, track } from '../../shared/scripts/shared.js?v=202606121631';
import { svgToCommands } from './svg-to-path.js?v=202606121631';

const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('file-input');
const familyInput = document.getElementById('family-name');
const prefixInput = document.getElementById('class-prefix');
const results = document.getElementById('results');
const resultsSummary = document.getElementById('results-summary');
const iconGrid = document.getElementById('icon-grid');
const codeBlock = document.getElementById('css-code');
const downloadTtfBtn = document.getElementById('download-ttf');
const downloadWoffBtn = document.getElementById('download-woff');
const copyCssBtn = document.getElementById('copy-css');
const clearAllBtn = document.getElementById('clear-all');

// 圖示起始碼位（私用區 PUA）
const START_CODEPOINT = 0xe001;

// 每筆：{ id, name, commands, advanceWidth, codepoint, className }
let items = [];
let nextId = 1;

// 本次建出的字型成品
let built = { family: '', ttf: null, woff: null, css: '' };
let previewFace = null; // 目前掛在 document.fonts 的預覽字體
let buildToken = 0;     // 避免非同步建置競態

init();

function init() {
  bindDropzone(dropzone, handleFiles);
  dropzone.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    if (fileInput.files.length) handleFiles(fileInput.files);
    fileInput.value = '';
  });

  // 改字型名／前綴：即時重建（輕量 debounce）
  let timer;
  const onSetting = () => { clearTimeout(timer); timer = setTimeout(build, 250); };
  familyInput.addEventListener('input', onSetting);
  prefixInput.addEventListener('input', onSetting);

  downloadTtfBtn.addEventListener('click', () => {
    if (built.ttf) { downloadBlob(built.ttf, `${built.family}.ttf`); track('use'); }
  });
  downloadWoffBtn.addEventListener('click', () => {
    if (built.woff) { downloadBlob(built.woff, `${built.family}.woff`); track('use'); }
  });
  copyCssBtn.addEventListener('click', async () => {
    if (await copyText(built.css)) { flash(copyCssBtn, '已複製'); track('use'); }
  });
  clearAllBtn.addEventListener('click', clearAll);
}

// — 接收檔案：過濾 SVG、逐個解析成路徑指令 —
async function handleFiles(fileList) {
  const files = [...fileList].filter(
    (f) => f.type === 'image/svg+xml' || /\.svg$/i.test(f.name)
  );
  if (!files.length) return;

  for (const file of files) {
    try {
      const text = await file.text();
      const { commands, advanceWidth } = svgToCommands(text);
      items.push({
        id: nextId++,
        name: uniqueName(baseName(file.name)),
        commands,
        advanceWidth,
      });
    } catch {
      // 單檔失敗就略過，不影響其他
    }
  }
  build();
}

// — 組字型：指定碼位 → opentype 字型 → TTF/WOFF → 預覽 + CSS —
async function build() {
  const token = ++buildToken;

  if (!items.length) {
    results.hidden = true;
    return;
  }
  if (typeof opentype === 'undefined') return; // CDN 尚未就緒

  const family = sanitizeFamily(familyInput.value) || 'icon-font';
  const prefix = sanitizePrefix(prefixInput.value);

  // 依序指定碼位與 class 名
  items.forEach((it, i) => {
    it.codepoint = START_CODEPOINT + i;
    it.className = prefix + it.name;
  });

  // .notdef 為必備的第 0 個字符
  const notdef = new opentype.Glyph({
    name: '.notdef', unicode: 0, advanceWidth: 1000, path: new opentype.Path(),
  });
  const glyphs = [notdef].concat(
    items.map((it) => new opentype.Glyph({
      name: it.name,
      unicode: it.codepoint,
      advanceWidth: it.advanceWidth,
      path: toOtPath(it.commands),
    }))
  );

  const font = new opentype.Font({
    familyName: family,
    styleName: 'Regular',
    unitsPerEm: 1000,
    ascender: 800,
    descender: -200,
    glyphs,
  });

  const ttfBuffer = font.toArrayBuffer();
  const ttfBlob = new Blob([ttfBuffer], { type: 'font/ttf' });
  const woffBlob = await ttfToWoff(ttfBuffer);
  if (token !== buildToken) return; // 已有更新的建置，丟棄本次

  built = {
    family,
    ttf: ttfBlob,
    woff: woffBlob,
    css: buildCss(family, prefix),
  };

  await loadPreviewFont(family, ttfBuffer);
  if (token !== buildToken) return;

  render(family);
}

// — 指令陣列 → opentype.Path —
function toOtPath(commands) {
  const p = new opentype.Path();
  for (const c of commands) {
    const a = c.args;
    if (c.type === 'M') p.moveTo(a[0], a[1]);
    else if (c.type === 'L') p.lineTo(a[0], a[1]);
    else if (c.type === 'C') p.curveTo(a[0], a[1], a[2], a[3], a[4], a[5]);
    else if (c.type === 'Q') p.quadTo(a[0], a[1], a[2], a[3]);
    else if (c.type === 'Z') p.close();
  }
  return p;
}

// — 把 TTF 載入為預覽字體（opentype 產出的 TTF 必為合法）—
async function loadPreviewFont(family, ttfBuffer) {
  if (previewFace) {
    document.fonts.delete(previewFace);
    previewFace = null;
  }
  try {
    const face = new FontFace(`${family}-preview`, ttfBuffer);
    await face.load();
    document.fonts.add(face);
    previewFace = face;
  } catch {
    // 預覽載入失敗不阻斷下載
  }
}

// — 渲染預覽格與 CSS —
function render(family) {
  results.hidden = false;
  resultsSummary.innerHTML = `共 <strong>${items.length}</strong> 個圖示 · em 1000 · 碼位起於 U+E001`;

  iconGrid.innerHTML = items.map((it) => {
    const hex = it.codepoint.toString(16).toUpperCase();
    return `
      <button type="button" class="icon-card" data-id="${it.id}" title="點擊複製 .${it.className}">
        <span class="icon-glyph" style="font-family:'${family}-preview'">${String.fromCodePoint(it.codepoint)}</span>
        <span class="icon-name">${it.className}</span>
        <span class="icon-code">U+${hex}</span>
      </button>`;
  }).join('');

  bindCards();
  codeBlock.textContent = built.css;
}

// 點圖示卡 → 複製 class 名；點移除鈕 → 刪除該圖示
function bindCards() {
  iconGrid.querySelectorAll('.icon-card').forEach((card) => {
    card.addEventListener('click', async () => {
      const it = items.find((x) => x.id === Number(card.dataset.id));
      if (it && (await copyText(`.${it.className}`))) {
        flash(card.querySelector('.icon-name'), '已複製');
      }
    });
  });
}

// — 產生 @font-face + .icon-* CSS 供複製 —
function buildCss(family, prefix) {
  const head = `@font-face {
  font-family: '${family}';
  src: url('${family}.woff') format('woff'),
       url('${family}.ttf') format('truetype');
  font-weight: normal;
  font-style: normal;
  font-display: block;
}

[class^="${prefix}"], [class*=" ${prefix}"] {
  font-family: '${family}' !important;
  font-style: normal;
  font-weight: normal;
  font-variant: normal;
  text-transform: none;
  line-height: 1;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}`;

  const rules = items
    .map((it) => `.${it.className}::before { content: "\\${it.codepoint.toString(16)}"; }`)
    .join('\n');

  return `${head}\n\n${rules}\n`;
}

// — 清空 —
function clearAll() {
  items = [];
  if (previewFace) {
    document.fonts.delete(previewFace);
    previewFace = null;
  }
  results.hidden = true;
}

// ── 命名清洗 ─────────────────────────────────────────────

function baseName(filename) {
  return filename.replace(/\.svg$/i, '');
}

// 圖示名：小寫、非英數轉連字號、去頭尾連字號、確保開頭為字母
function sanitizeName(name) {
  let s = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  if (!s) s = 'icon';
  if (!/^[a-z]/.test(s)) s = `i-${s}`;
  return s;
}

// 名稱衝突時自動加序號
function uniqueName(raw) {
  const base = sanitizeName(raw);
  let name = base;
  let n = 2;
  while (items.some((it) => it.name === name)) name = `${base}-${n++}`;
  return name;
}

function sanitizeFamily(v) {
  return (v || '').trim().replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
}

// class 前綴：保證以字母開頭、僅含安全字元、結尾帶連字號
function sanitizePrefix(v) {
  let s = (v || '').trim().toLowerCase().replace(/[^a-z0-9-]+/g, '');
  if (!s) s = 'icon-';
  if (!/^[a-z]/.test(s)) s = `i${s}`;
  if (!s.endsWith('-')) s += '-';
  return s;
}

// 短暫顯示提示文字後還原
function flash(el, text) {
  const original = el.textContent;
  el.textContent = text;
  el.classList.add('is-flash');
  setTimeout(() => {
    el.textContent = original;
    el.classList.remove('is-flash');
  }, 900);
}

// ── TTF → WOFF1（用原生 CompressionStream 做 zlib 壓縮）─────

async function ttfToWoff(ttf) {
  const dv = new DataView(ttf);
  const flavor = dv.getUint32(0);
  const numTables = dv.getUint16(4);

  // 讀 sfnt table 目錄
  const tables = [];
  for (let i = 0; i < numTables; i++) {
    const o = 12 + i * 16;
    tables.push({
      tag: dv.getUint32(o),
      checksum: dv.getUint32(o + 4),
      offset: dv.getUint32(o + 8),
      length: dv.getUint32(o + 12),
    });
  }

  // 逐表壓縮（壓不小就原樣存放）
  const entries = [];
  for (const t of tables) {
    const orig = new Uint8Array(ttf, t.offset, t.length);
    const comp = await deflate(orig);
    const stored = comp.length < t.length ? comp : orig;
    entries.push({
      tag: t.tag,
      checksum: t.checksum,
      origLength: t.length,
      data: stored,
      compLength: stored.length,
    });
  }

  const pad4 = (n) => (n + 3) & ~3;
  const headerSize = 44;
  const dirSize = numTables * 20;

  // 排定各表在 WOFF 內的位移
  let offset = headerSize + dirSize;
  entries.forEach((e) => { e.woffOffset = offset; offset += pad4(e.compLength); });
  const totalSize = offset;

  // 解壓後 sfnt 的總大小
  let sfntSize = 12 + numTables * 16;
  entries.forEach((e) => { sfntSize += pad4(e.origLength); });

  const out = new ArrayBuffer(totalSize);
  const odv = new DataView(out);
  const ou8 = new Uint8Array(out);

  // WOFFHeader
  odv.setUint32(0, 0x774f4646);   // 'wOFF'
  odv.setUint32(4, flavor);
  odv.setUint32(8, totalSize);
  odv.setUint16(12, numTables);
  odv.setUint16(14, 0);           // reserved
  odv.setUint32(16, sfntSize);
  odv.setUint16(20, 1);           // majorVersion
  odv.setUint16(22, 0);           // minorVersion
  odv.setUint32(24, 0);           // metaOffset
  odv.setUint32(28, 0);           // metaLength
  odv.setUint32(32, 0);           // metaOrigLength
  odv.setUint32(36, 0);           // privOffset
  odv.setUint32(40, 0);           // privLength

  // table 目錄
  let p = headerSize;
  entries.forEach((e) => {
    odv.setUint32(p, e.tag);
    odv.setUint32(p + 4, e.woffOffset);
    odv.setUint32(p + 8, e.compLength);
    odv.setUint32(p + 12, e.origLength);
    odv.setUint32(p + 16, e.checksum);
    p += 20;
  });

  // table 資料（pad 區段保持為 0）
  entries.forEach((e) => { ou8.set(e.data, e.woffOffset); });

  return new Blob([out], { type: 'font/woff' });
}

// zlib 壓縮（WOFF1 規定使用 zlib；CompressionStream('deflate') 即 zlib 格式）
async function deflate(bytes) {
  const cs = new CompressionStream('deflate');
  const stream = new Blob([bytes]).stream().pipeThrough(cs);
  const buf = await new Response(stream).arrayBuffer();
  return new Uint8Array(buf);
}
