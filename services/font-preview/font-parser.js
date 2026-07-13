// ============================================================
// 字型檔解析（TTF / OTF / WOFF）— 自寫 OpenType 表格讀取
// 只解析 name / OS2 / head / cmap 四張表，足夠支撐中繼資料與字符涵蓋率
// WOFF（v1）表格採 zlib 壓縮，用瀏覽器原生 DecompressionStream('deflate') 解壓
// （對稱於 02 svg-to-font 用 CompressionStream('deflate') 寫出 WOFF）；
// WOFF2 採 Brotli 壓縮整檔，瀏覽器原生串流 API 不支援解壓，故不在支援格式內
// ============================================================

const WEIGHT_NAMES = {
  100: 'Thin', 200: 'Extra Light', 300: 'Light', 400: 'Regular',
  500: 'Medium', 600: 'Semi Bold', 700: 'Bold', 800: 'Extra Bold', 900: 'Black',
};

export const UNICODE_BLOCKS = [
  ['Basic Latin', 0x0000, 0x007f],
  ['Latin-1 Supplement', 0x0080, 0x00ff],
  ['Latin Extended-A', 0x0100, 0x017f],
  ['Latin Extended-B', 0x0180, 0x024f],
  ['IPA Extensions', 0x0250, 0x02af],
  ['Greek and Coptic', 0x0370, 0x03ff],
  ['Cyrillic', 0x0400, 0x04ff],
  ['Hebrew', 0x0590, 0x05ff],
  ['Arabic', 0x0600, 0x06ff],
  ['Devanagari', 0x0900, 0x097f],
  ['Thai', 0x0e00, 0x0e7f],
  ['General Punctuation', 0x2000, 0x206f],
  ['Currency Symbols', 0x20a0, 0x20cf],
  ['Letterlike Symbols', 0x2100, 0x214f],
  ['Arrows', 0x2190, 0x21ff],
  ['Mathematical Operators', 0x2200, 0x22ff],
  ['Box Drawing', 0x2500, 0x257f],
  ['CJK Symbols and Punctuation', 0x3000, 0x303f],
  ['Hiragana', 0x3040, 0x309f],
  ['Katakana', 0x30a0, 0x30ff],
  ['CJK Unified Ideographs Ext A', 0x3400, 0x4dbf],
  ['CJK Unified Ideographs', 0x4e00, 0x9fff],
  ['Hangul Syllables', 0xac00, 0xd7a3],
  ['Private Use Area', 0xe000, 0xf8ff],
  ['Halfwidth and Fullwidth Forms', 0xff00, 0xffef],
];

// ── 格式判斷（讀檔頭前 4 bytes 簽章） ──────────────────────────
export function detectFormat(buf) {
  const dv = new DataView(buf);
  const tag = dv.getUint32(0, false);
  if (tag === 0x774f4646) return 'woff'; // 'wOFF'
  if (tag === 0x4f54544f) return 'otf';  // 'OTTO'（CFF 輪廓）
  if (tag === 0x00010000 || tag === 0x74727565) return 'ttf'; // sfnt 1.0 或 'true'
  return null;
}

function readTag(dv, offset) {
  let s = '';
  for (let i = 0; i < 4; i++) s += String.fromCharCode(dv.getUint8(offset + i));
  return s;
}

// sfnt（TTF/OTF）表格目錄：偏移量與長度皆指向未壓縮的原始資料
function readSfntTables(buf) {
  const dv = new DataView(buf);
  const numTables = dv.getUint16(4);
  const tables = new Map();
  for (let i = 0; i < numTables; i++) {
    const rec = 12 + i * 16;
    const tag = readTag(dv, rec);
    const offset = dv.getUint32(rec + 8);
    const length = dv.getUint32(rec + 12);
    tables.set(tag, buf.slice(offset, offset + length));
  }
  return tables;
}

async function inflateZlib(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate'));
  return new Response(stream).arrayBuffer();
}

// WOFF1 表格目錄：每筆記錄有壓縮／原始長度，相等代表未壓縮，否則需 zlib 解壓
async function readWoffTables(buf) {
  const dv = new DataView(buf);
  const numTables = dv.getUint16(12);
  const tables = new Map();
  for (let i = 0; i < numTables; i++) {
    const rec = 44 + i * 20;
    const tag = readTag(dv, rec);
    const offset = dv.getUint32(rec + 4);
    const compLength = dv.getUint32(rec + 8);
    const origLength = dv.getUint32(rec + 12);
    const slice = buf.slice(offset, offset + compLength);
    tables.set(tag, compLength === origLength ? slice : await inflateZlib(slice));
  }
  return tables;
}

export function readTables(buf, format) {
  return format === 'woff' ? readWoffTables(buf) : Promise.resolve(readSfntTables(buf));
}

// ── name 表：家族名／樣式名／完整名／PostScript 名 ─────────────
function decodeNameString(dv, offset, length, platformID) {
  const bytes = new Uint8Array(dv.buffer, dv.byteOffset + offset, length);
  // Windows(3) 與 Unicode(0) 平台為 UTF-16BE；Macintosh(1) 多為 MacRoman，取 latin1 近似解碼即可涵蓋常見英數字元
  return platformID === 1
    ? new TextDecoder('windows-1252').decode(bytes)
    : new TextDecoder('utf-16be').decode(bytes);
}

export function parseName(tableBuf) {
  if (!tableBuf) return {};
  const dv = new DataView(tableBuf);
  const count = dv.getUint16(2);
  const stringOffset = dv.getUint16(4);
  const wanted = new Set([1, 2, 4, 6, 16, 17]);
  const picks = {};

  for (let i = 0; i < count; i++) {
    const rec = 6 + i * 12;
    const platformID = dv.getUint16(rec);
    const nameID = dv.getUint16(rec + 6);
    const length = dv.getUint16(rec + 8);
    const strOff = dv.getUint16(rec + 10);
    if (!wanted.has(nameID)) continue;

    // 記錄優先序：Windows(3) > Unicode(0) > 其他平台（如 Macintosh）
    const priority = platformID === 3 ? 2 : platformID === 0 ? 1 : 0;
    if (picks[nameID] && picks[nameID].priority >= priority) continue;
    try {
      const text = decodeNameString(dv, stringOffset + strOff, length, platformID).trim();
      if (text) picks[nameID] = { text, priority };
    } catch { /* 單筆記錄解碼失敗就跳過，不影響其他記錄 */ }
  }

  const get = (id) => picks[id]?.text || null;
  return {
    family: get(16) || get(1),
    subfamily: get(17) || get(2),
    fullName: get(4),
    postScriptName: get(6),
  };
}

// ── OS/2 表：字重／寬度／斜體粗體旗標 ───────────────────────────
export function parseOS2(tableBuf) {
  if (!tableBuf || tableBuf.byteLength < 64) return {};
  const dv = new DataView(tableBuf);
  const fsSelection = dv.getUint16(62);
  return {
    weightClass: dv.getUint16(4),
    widthClass: dv.getUint16(6),
    italic: !!(fsSelection & 0x01),
    bold: !!(fsSelection & 0x20),
  };
}

// ── head 表：macStyle 作為 OS/2 缺席時的粗體／斜體備援 ──────────
export function parseHead(tableBuf) {
  if (!tableBuf || tableBuf.byteLength < 46) return {};
  const dv = new DataView(tableBuf);
  const macStyle = dv.getUint16(44);
  return { bold: !!(macStyle & 0x01), italic: !!(macStyle & 0x02) };
}

export function weightName(weightClass) {
  if (!weightClass) return '—';
  if (WEIGHT_NAMES[weightClass]) return WEIGHT_NAMES[weightClass];
  const nearest = Object.keys(WEIGHT_NAMES).map(Number)
    .sort((a, b) => Math.abs(a - weightClass) - Math.abs(b - weightClass))[0];
  return WEIGHT_NAMES[nearest];
}

// ── cmap 表：找最佳子表並解出字符涵蓋範圍 ───────────────────────
function scoreCmapSubtable(platformID, encodingID) {
  if (platformID === 3 && encodingID === 10) return 5; // Windows，完整 Unicode（含輔助平面）
  if (platformID === 0 && (encodingID === 4 || encodingID === 6)) return 4; // Unicode 完整
  if (platformID === 3 && encodingID === 1) return 3; // Windows，BMP
  if (platformID === 0) return 2; // 其他 Unicode 編碼
  if (platformID === 1 && encodingID === 0) return 1; // Macintosh Roman
  return 0;
}

function parseCmapFormat0(dv, offset) {
  const ranges = [];
  let start = -1;
  for (let c = 0; c < 256; c++) {
    const gid = dv.getUint8(offset + 6 + c);
    if (gid !== 0) {
      if (start === -1) start = c;
    } else if (start !== -1) {
      ranges.push([start, c - 1]);
      start = -1;
    }
  }
  if (start !== -1) ranges.push([start, 255]);
  return ranges;
}

function parseCmapFormat4(dv, offset) {
  const segCountX2 = dv.getUint16(offset + 6);
  const segCount = segCountX2 / 2;
  const endCodeOff = offset + 14;
  const startCodeOff = endCodeOff + segCountX2 + 2; // +2 跳過 reservedPad
  const ranges = [];
  for (let i = 0; i < segCount; i++) {
    const endCode = dv.getUint16(endCodeOff + i * 2);
    const startCode = dv.getUint16(startCodeOff + i * 2);
    if (startCode > endCode) continue; // 規格保留的結尾佔位區段
    ranges.push([startCode, endCode]);
  }
  return ranges;
}

function parseCmapFormat12(dv, offset) {
  const nGroups = dv.getUint32(offset + 12);
  const ranges = [];
  for (let i = 0; i < nGroups; i++) {
    const rec = offset + 16 + i * 12;
    ranges.push([dv.getUint32(rec), dv.getUint32(rec + 4)]);
  }
  return ranges;
}

export function parseCmap(tableBuf) {
  if (!tableBuf) return [];
  const dv = new DataView(tableBuf);
  const numTables = dv.getUint16(2);
  let bestOffset = -1;
  let bestScore = -1;
  for (let i = 0; i < numTables; i++) {
    const rec = 4 + i * 8;
    const score = scoreCmapSubtable(dv.getUint16(rec), dv.getUint16(rec + 2));
    if (score > bestScore) { bestScore = score; bestOffset = dv.getUint32(rec + 4); }
  }
  if (bestOffset < 0) return [];

  const format = dv.getUint16(bestOffset);
  if (format === 4) return parseCmapFormat4(dv, bestOffset);
  if (format === 12) return parseCmapFormat12(dv, bestOffset);
  if (format === 0) return parseCmapFormat0(dv, bestOffset);
  return [];
}

// 合併重疊／相鄰區段：後續二分搜尋與加總的基礎
export function mergeRanges(ranges) {
  if (!ranges.length) return [];
  const sorted = [...ranges].sort((a, b) => a[0] - b[0]);
  const merged = [sorted[0].slice()];
  for (let i = 1; i < sorted.length; i++) {
    const last = merged[merged.length - 1];
    const [s, e] = sorted[i];
    if (s <= last[1] + 1) last[1] = Math.max(last[1], e);
    else merged.push([s, e]);
  }
  return merged;
}

export function rangesCoverage(ranges) {
  return ranges.reduce((sum, [s, e]) => sum + (e - s + 1), 0);
}

// 二分搜尋合併後的區段，判斷單一 code point 是否落在字型涵蓋範圍內
export function isCodepointSupported(ranges, cp) {
  let lo = 0;
  let hi = ranges.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const [s, e] = ranges[mid];
    if (cp < s) hi = mid - 1;
    else if (cp > e) lo = mid + 1;
    else return true;
  }
  return false;
}

export function computeBlockCoverage(ranges) {
  return UNICODE_BLOCKS.map(([name, start, end]) => {
    let count = 0;
    for (const [s, e] of ranges) {
      const os = Math.max(s, start);
      const oe = Math.min(e, end);
      if (os <= oe) count += oe - os + 1;
    }
    return { name, start, end, count, total: end - start + 1 };
  }).filter((b) => b.count > 0).sort((a, b) => b.count - a.count);
}

// ── 主流程：讀檔 → 解析表格 → 組成單一字型的分析結果 ────────────
export async function analyzeFont(file) {
  const buf = await file.arrayBuffer();
  const format = detectFormat(buf);
  if (!format) throw new Error('無法辨識的字型格式（僅支援 TTF / OTF / WOFF）');

  const tables = await readTables(buf, format);
  const name = parseName(tables.get('name'));
  const os2 = parseOS2(tables.get('OS/2'));
  const head = parseHead(tables.get('head'));
  const ranges = mergeRanges(parseCmap(tables.get('cmap')));

  const bold = os2.bold ?? head.bold ?? false;
  const italic = os2.italic ?? head.italic ?? false;
  const weightClass = os2.weightClass || (bold ? 700 : 400);

  return {
    file,
    format,
    buf,
    family: name.family || file.name.replace(/\.[^.]+$/, ''),
    subfamily: name.subfamily || (bold && italic ? 'Bold Italic' : bold ? 'Bold' : italic ? 'Italic' : 'Regular'),
    fullName: name.fullName,
    postScriptName: name.postScriptName,
    weightClass,
    weightName: weightName(weightClass),
    italic,
    bold,
    ranges,
    totalCodepoints: rangesCoverage(ranges),
    blocks: computeBlockCoverage(ranges),
  };
}
