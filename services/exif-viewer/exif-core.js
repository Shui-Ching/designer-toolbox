// ============================================================
// 50 EXIF 檢視與移除 — 核心運算（零 DOM，供畫面與 Node 測試共用）
// - walkSegments：走訪 JPEG 段結構（SOI → … → SOS 之後視為熵編碼資料原樣保留）
// - parseJpeg：解析 APP1 Exif（TIFF：IFD0 / Exif IFD / GPS IFD）成可顯示的條目
// - stripJpeg：無損剔除中繼資料段（不重新壓縮影像位元流）；
//   原方向 ≠ 1 時注入只含 Orientation 的迷你 APP1，避免直式照片躺平
// 所有讀取都做邊界檢查，畸形檔案回報警告、不丟未捕捉例外
// ============================================================

// — TIFF 資料型別的單位元組數 —
const TYPE_SIZE = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 6: 1, 7: 1, 8: 2, 9: 4, 10: 8 };

// — 展示用標籤字典（curated）：id → 所屬 IFD、群組、中文標籤、格式化方式 —
// group：camera（相機與鏡頭）/ exposure（拍攝參數）/ image（影像與軟體）
// privacy：gps（定位）/ time（時間）/ identity（可識別個人）
const TAG_DEFS = [
  // IFD0
  { id: 0x010f, ifd: 'ifd0', group: 'camera', label: '相機廠牌', format: 'text' },
  { id: 0x0110, ifd: 'ifd0', group: 'camera', label: '相機型號', format: 'text' },
  { id: 0x0112, ifd: 'ifd0', group: 'image', label: '方向', format: 'orientation' },
  { id: 0x0131, ifd: 'ifd0', group: 'image', label: '軟體', format: 'text' },
  { id: 0x0132, ifd: 'ifd0', group: 'image', label: '檔案修改時間', format: 'text', privacy: 'time' },
  { id: 0x013b, ifd: 'ifd0', group: 'image', label: '作者（Artist）', format: 'text', privacy: 'identity' },
  { id: 0x8298, ifd: 'ifd0', group: 'image', label: '版權宣告', format: 'text' },
  // Exif IFD
  { id: 0x829a, ifd: 'exif', group: 'exposure', label: '曝光時間', format: 'exposure' },
  { id: 0x829d, ifd: 'exif', group: 'exposure', label: '光圈', format: 'fnumber' },
  { id: 0x8827, ifd: 'exif', group: 'exposure', label: 'ISO 感光度', format: 'plain' },
  { id: 0x9003, ifd: 'exif', group: 'image', label: '拍攝時間', format: 'text', privacy: 'time' },
  { id: 0x9004, ifd: 'exif', group: 'image', label: '數位化時間', format: 'text', privacy: 'time' },
  { id: 0x9209, ifd: 'exif', group: 'exposure', label: '閃光燈', format: 'flash' },
  { id: 0x920a, ifd: 'exif', group: 'exposure', label: '焦距', format: 'mm' },
  { id: 0xa405, ifd: 'exif', group: 'exposure', label: '等效 35mm 焦距', format: 'mm' },
  { id: 0xa002, ifd: 'exif', group: 'image', label: '影像寬度', format: 'px' },
  { id: 0xa003, ifd: 'exif', group: 'image', label: '影像高度', format: 'px' },
  { id: 0xa430, ifd: 'exif', group: 'camera', label: '機主名稱', format: 'text', privacy: 'identity' },
  { id: 0xa431, ifd: 'exif', group: 'camera', label: '機身序號', format: 'text', privacy: 'identity' },
  { id: 0xa434, ifd: 'exif', group: 'camera', label: '鏡頭型號', format: 'text' },
  { id: 0xa435, ifd: 'exif', group: 'camera', label: '鏡頭序號', format: 'text', privacy: 'identity' },
];

const ORIENTATION_LABELS = {
  1: '正常', 2: '水平翻轉', 3: '旋轉 180°', 4: '垂直翻轉',
  5: '順時針 90° 後水平翻轉', 6: '需順時針旋轉 90°', 7: '逆時針 90° 後水平翻轉', 8: '需逆時針旋轉 90°',
};

// ============================================================
// JPEG 段走訪
// ============================================================

// 判斷該 marker 是否為「無長度欄位」的獨立 marker（SOI/EOI/RSTn/TEM）
function isStandalone(marker) {
  return marker === 0xd8 || marker === 0xd9 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7);
}

// 走訪段結構直到 SOS；回傳 { segments, sosOffset }。
// segments 每項：{ marker, offset, size }（size 含 FF xx 兩位元組與長度欄位）
// 非 JPEG 或結構壞掉時 throw（由呼叫端轉成友善結果）
export function walkSegments(bytes) {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) {
    throw new Error('不是 JPEG 檔（缺 SOI 標記）');
  }
  const segments = [];
  let p = 2;
  while (p < bytes.length) {
    if (bytes[p] !== 0xff) throw new Error(`位移 ${p} 處不是合法的段標記`);
    // 容許連續填充的 0xFF
    while (p < bytes.length && bytes[p + 1] === 0xff) p++;
    const marker = bytes[p + 1];
    if (marker === undefined) throw new Error('檔案在段標記處截斷');
    if (marker === 0xda) return { segments, sosOffset: p }; // SOS 之後為熵編碼資料，原樣保留
    if (marker === 0xd9) return { segments, sosOffset: p }; // 無影像資料就遇到 EOI（罕見但不崩潰）
    if (isStandalone(marker)) { segments.push({ marker, offset: p, size: 2 }); p += 2; continue; }
    if (p + 4 > bytes.length) throw new Error('段長度欄位超出檔尾');
    const len = (bytes[p + 2] << 8) | bytes[p + 3]; // 長度含自身 2 bytes
    if (len < 2 || p + 2 + len > bytes.length) throw new Error('段長度超出檔尾');
    segments.push({ marker, offset: p, size: 2 + len });
    p += 2 + len;
  }
  throw new Error('檔案在 SOS 之前截斷');
}

// 判斷段的中繼資料類別；回傳 null 代表不是可移除的中繼資料
export function metaKind(bytes, seg) {
  const start = seg.offset + 4; // 跳過 FF xx 與長度欄位
  const head = (n) => {
    let s = '';
    for (let i = 0; i < n && start + i < bytes.length; i++) s += String.fromCharCode(bytes[start + i]);
    return s;
  };
  if (seg.marker === 0xe1) {
    if (head(6) === 'Exif\0\0') return 'exif';
    if (head(29).startsWith('http://ns.adobe.com/xap/1.0/')) return 'xmp';
    return 'app1-other'; // 其他 APP1（如 XMP 延伸段）也一併視為中繼資料移除
  }
  if (seg.marker === 0xed) return 'iptc'; // APP13：Photoshop IRB／IPTC
  if (seg.marker === 0xfe) return 'comment'; // COM 註解
  return null;
}

// ============================================================
// EXIF（TIFF）解析
// ============================================================

// 在 tiff 範圍內讀取的小端／大端讀取器，一律做邊界檢查
function makeReader(bytes, tiffStart, tiffEnd, little) {
  const check = (off, size) => {
    if (off < tiffStart || off + size > tiffEnd) throw new Error('EXIF 內部位移超出範圍');
  };
  return {
    u16(off) {
      check(off, 2);
      return little ? bytes[off] | (bytes[off + 1] << 8) : (bytes[off] << 8) | bytes[off + 1];
    },
    u32(off) {
      check(off, 4);
      return little
        ? (bytes[off] | (bytes[off + 1] << 8) | (bytes[off + 2] << 16) | (bytes[off + 3] << 24)) >>> 0
        : ((bytes[off] << 24) | (bytes[off + 1] << 16) | (bytes[off + 2] << 8) | bytes[off + 3]) >>> 0;
    },
    bytesAt(off, n) { check(off, n); return bytes.subarray(off, off + n); },
  };
}

// 讀一個 IFD 的所有條目：回傳 Map(tagId → { type, count, values })
function readIfd(reader, tiffStart, ifdOffset) {
  const entries = new Map();
  const count = reader.u16(ifdOffset);
  for (let i = 0; i < count; i++) {
    const base = ifdOffset + 2 + i * 12;
    try {
      const tag = reader.u16(base);
      const type = reader.u16(base + 2);
      const num = reader.u32(base + 4);
      const unit = TYPE_SIZE[type];
      if (!unit || num > 65536) continue; // 未知型別或誇張數量：跳過該條
      const valueOffset = unit * num <= 4 ? base + 8 : tiffStart + reader.u32(base + 8);
      entries.set(tag, decodeValue(reader, type, num, valueOffset));
    } catch { /* 條目或值超出範圍：跳過該條，保留其餘 */ }
  }
  return entries;
}

// 依型別解出值：ASCII → 字串；RATIONAL → [num, den] 陣列；其餘 → 數字陣列
function decodeValue(reader, type, count, offset) {
  if (type === 2) {
    const raw = reader.bytesAt(offset, count);
    let end = raw.length;
    while (end > 0 && raw[end - 1] === 0) end--;
    return { type, text: new TextDecoder('utf-8', { fatal: false }).decode(raw.subarray(0, end)).trim() };
  }
  const values = [];
  for (let i = 0; i < count; i++) {
    if (type === 3) values.push(reader.u16(offset + i * 2));
    else if (type === 4) values.push(reader.u32(offset + i * 4));
    else if (type === 5) values.push([reader.u32(offset + i * 8), reader.u32(offset + i * 8 + 4)]);
    else if (type === 9) values.push(reader.u32(offset + i * 4) | 0);
    else if (type === 10) values.push([reader.u32(offset + i * 8) | 0, reader.u32(offset + i * 8 + 4) | 0]);
    else values.push(reader.bytesAt(offset + i, 1)[0]); // BYTE / UNDEFINED
  }
  return { type, values };
}

const ratio = ([num, den]) => (den === 0 ? NaN : num / den);

// 三段 DMS（度分秒 rational）→ 十進位度數
function dmsToDecimal(values, ref) {
  if (!Array.isArray(values) || values.length < 3) return null;
  const [d, m, s] = values.map(ratio);
  if ([d, m, s].some((v) => Number.isNaN(v))) return null;
  const dec = d + m / 60 + s / 3600;
  return (ref === 'S' || ref === 'W') ? -dec : dec;
}

// 把一個標籤值格式化成人類可讀字串；回傳 null 代表值無法解讀（該條不顯示）
function formatValue(def, value) {
  if (value.text !== undefined) return value.text || null;
  const v = value.values;
  if (!v || v.length === 0) return null;
  const first = v[0];
  switch (def.format) {
    case 'exposure': {
      const sec = Array.isArray(first) ? ratio(first) : first;
      if (!Number.isFinite(sec) || sec <= 0) return null;
      return sec < 1 ? `1/${Math.round(1 / sec)} 秒` : `${trimNum(sec)} 秒`;
    }
    case 'fnumber': {
      const f = Array.isArray(first) ? ratio(first) : first;
      return Number.isFinite(f) ? `f/${trimNum(f)}` : null;
    }
    case 'mm': {
      const mm = Array.isArray(first) ? ratio(first) : first;
      return Number.isFinite(mm) ? `${trimNum(mm)} mm` : null;
    }
    case 'px': return `${first} px`;
    case 'flash': return (first & 1) ? '有觸發' : '未觸發';
    case 'orientation': return ORIENTATION_LABELS[first] ? `${ORIENTATION_LABELS[first]}（${first}）` : String(first);
    default: return Array.isArray(first) ? trimNum(ratio(first)) : String(first);
  }
}

const trimNum = (n) => String(Math.round(n * 100) / 100);

// 解析單一 APP1 Exif 段的 TIFF 結構
function parseTiff(bytes, seg) {
  const tiffStart = seg.offset + 4 + 6; // FF E1 + len(2) + "Exif\0\0"
  const tiffEnd = seg.offset + seg.size;
  const order = String.fromCharCode(bytes[tiffStart] ?? 0, bytes[tiffStart + 1] ?? 0);
  if (order !== 'II' && order !== 'MM') throw new Error('TIFF 位元組序標記無效');
  const reader = makeReader(bytes, tiffStart, tiffEnd, order === 'II');
  if (reader.u16(tiffStart + 2) !== 42) throw new Error('TIFF magic 不是 42');

  const ifd0 = readIfd(reader, tiffStart, tiffStart + reader.u32(tiffStart + 4));
  // 子 IFD 指標壞掉時只放棄該子 IFD，不連帶丟棄 IFD0
  const subIfd = (ptrTag) => {
    const ptr = ifd0.get(ptrTag)?.values?.[0];
    if (!ptr) return new Map();
    try { return readIfd(reader, tiffStart, tiffStart + ptr); } catch { return new Map(); }
  };
  return { ifd0, exifIfd: subIfd(0x8769), gpsIfd: subIfd(0x8825) };
}

// ============================================================
// 對外：解析整個 JPEG
// ============================================================

// 回傳：
// {
//   valid, warnings: [],
//   metaSegments: [{ kind, size }],          // 可移除的中繼資料段
//   keptNotes: [],                            // 保留段的說明（ICC 等）
//   entries: [{ id, label, group, privacy, value }],
//   unknownCount,                             // EXIF 內未列名標籤數
//   orientation,                              // 數字（無則 null）
//   gps: { lat, lon, alt } | null,
// }
export function parseJpeg(bytes) {
  const result = {
    valid: false, warnings: [], metaSegments: [], keptNotes: [],
    entries: [], unknownCount: 0, orientation: null, gps: null,
  };
  let walked;
  try {
    walked = walkSegments(bytes);
  } catch (err) {
    result.warnings.push(err.message);
    return result;
  }
  result.valid = true;

  let exifSeg = null;
  for (const seg of walked.segments) {
    const kind = metaKind(bytes, seg);
    if (kind) {
      result.metaSegments.push({ kind, size: seg.size });
      if (kind === 'exif' && !exifSeg) exifSeg = seg;
    } else if (seg.marker === 0xe2) {
      result.keptNotes.push('ICC 色彩描述檔（影響顯色，保留不移除）');
    }
  }
  if (!exifSeg) return result;

  let tiff;
  try {
    tiff = parseTiff(bytes, exifSeg);
  } catch (err) {
    result.warnings.push(`EXIF 結構無法解析：${err.message}`);
    return result;
  }

  // curated 標籤 → 顯示條目
  const ifdMap = { ifd0: tiff.ifd0, exif: tiff.exifIfd };
  for (const def of TAG_DEFS) {
    const value = ifdMap[def.ifd].get(def.id);
    if (!value) continue;
    const text = formatValue(def, value);
    if (text === null || text === '') continue;
    result.entries.push({ id: def.id, label: def.label, group: def.group, privacy: def.privacy || null, value: text });
  }
  result.orientation = tiff.ifd0.get(0x0112)?.values?.[0] ?? null;

  // GPS：緯度／經度／海拔＋日期時間
  const g = tiff.gpsIfd;
  const latRef = g.get(0x0001)?.text;
  const lonRef = g.get(0x0003)?.text;
  const lat = dmsToDecimal(g.get(0x0002)?.values, latRef);
  const lon = dmsToDecimal(g.get(0x0004)?.values, lonRef);
  if (lat !== null && lon !== null) {
    const altVal = g.get(0x0006)?.values?.[0];
    const alt = altVal ? ratio(altVal) * (g.get(0x0005)?.values?.[0] === 1 ? -1 : 1) : null;
    result.gps = { lat: Math.round(lat * 1e6) / 1e6, lon: Math.round(lon * 1e6) / 1e6, alt: Number.isFinite(alt) ? Math.round(alt) : null };
  } else if (g.size > 0) {
    result.warnings.push('GPS 區塊存在但座標無法解讀（移除功能仍會整段剔除）');
  }

  // 未列名標籤數（不含 IFD 指標本身）
  const knownIfd0 = new Set(TAG_DEFS.filter((d) => d.ifd === 'ifd0').map((d) => d.id));
  const knownExif = new Set(TAG_DEFS.filter((d) => d.ifd === 'exif').map((d) => d.id));
  for (const tag of tiff.ifd0.keys()) if (!knownIfd0.has(tag) && tag !== 0x8769 && tag !== 0x8825) result.unknownCount++;
  for (const tag of tiff.exifIfd.keys()) if (!knownExif.has(tag)) result.unknownCount++;

  return result;
}

// ============================================================
// 對外：無損移除中繼資料
// ============================================================

// 只含 Orientation 標籤的迷你 APP1 Exif 段（36 bytes，小端）
export function buildOrientationApp1(orientation) {
  const seg = new Uint8Array(36);
  const tiff = [
    0x49, 0x49, 42, 0,      // "II" + magic 42
    8, 0, 0, 0,             // IFD0 位移 = 8
    1, 0,                   // 條目數 1
    0x12, 0x01, 3, 0,       // tag 0x0112, type SHORT
    1, 0, 0, 0,             // count 1
    orientation & 0xff, (orientation >> 8) & 0xff, 0, 0, // 值（inline）
    0, 0, 0, 0,             // 下一個 IFD = 無
  ];
  seg.set([0xff, 0xe1, 0, 34], 0); // APP1 + 長度 34（2 + 6 + 26）
  seg.set([0x45, 0x78, 0x69, 0x66, 0, 0], 4); // "Exif\0\0"
  seg.set(tiff, 10);
  return seg;
}

// 無損剔除中繼資料段；回傳 { bytes, removed: [{ kind, size }], orientationKept }
// 非 JPEG 或結構壞掉時回傳 null（呼叫端顯示錯誤）
export function stripJpeg(bytes) {
  let parsed, walked;
  try {
    parsed = parseJpeg(bytes);
    walked = walkSegments(bytes);
  } catch { return null; }
  if (!parsed.valid) return null;

  const removed = [];
  const parts = [new Uint8Array([0xff, 0xd8])]; // SOI

  // 原方向 ≠ 1 時，緊接 SOI 注入迷你方向段（方向值非個資，避免照片躺平）
  const orientationKept = parsed.orientation !== null && parsed.orientation !== 1;
  if (orientationKept) parts.push(buildOrientationApp1(parsed.orientation));

  for (const seg of walked.segments) {
    if (seg.marker === 0xd8) continue; // SOI 已寫入
    const kind = metaKind(bytes, seg);
    if (kind) { removed.push({ kind, size: seg.size }); continue; }
    parts.push(bytes.subarray(seg.offset, seg.offset + seg.size));
  }
  parts.push(bytes.subarray(walked.sosOffset)); // SOS 起原樣保留到檔尾

  const total = parts.reduce((sum, p) => sum + p.length, 0);
  const out = new Uint8Array(total);
  let p = 0;
  for (const part of parts) { out.set(part, p); p += part.length; }
  return { bytes: out, removed, orientationKept };
}
