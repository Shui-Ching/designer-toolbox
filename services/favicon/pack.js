// ============================================================
// 07 favicon 產生器 — 純前端封裝工具
// 以原生方式手寫 ICO 容器與 store-only ZIP，維持零依賴
// （PNG 本身已壓縮，ZIP 不再二次壓縮，採 store 即可）
// ============================================================

// — 把多個 PNG（不同尺寸）封裝成單一 .ico —
// 現代瀏覽器與 Windows 都支援 ICO 內嵌 PNG，免再轉 BMP。
// 結構：ICONDIR(6) + N×ICONDIRENTRY(16) + 各 PNG 資料
export async function buildIco(entries) {
  // entries: [{ size, blob }]，size 為邊長（16/32/48…）
  const pngs = await Promise.all(entries.map((e) => e.blob.arrayBuffer()));
  const count = entries.length;
  const headerSize = 6 + count * 16;
  const totalSize = headerSize + pngs.reduce((s, b) => s + b.byteLength, 0);

  const buffer = new ArrayBuffer(totalSize);
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);

  // ICONDIR
  view.setUint16(0, 0, true);     // reserved
  view.setUint16(2, 1, true);     // type：1 = 圖示
  view.setUint16(4, count, true); // 圖片數

  let offset = headerSize;
  entries.forEach((e, i) => {
    const png = pngs[i];
    const dim = e.size >= 256 ? 0 : e.size; // 256 以 0 表示
    const base = 6 + i * 16;
    view.setUint8(base, dim);          // width
    view.setUint8(base + 1, dim);      // height
    view.setUint8(base + 2, 0);        // 調色盤色數（PNG 用 0）
    view.setUint8(base + 3, 0);        // reserved
    view.setUint16(base + 4, 1, true); // color planes
    view.setUint16(base + 6, 32, true);// bits per pixel
    view.setUint32(base + 8, png.byteLength, true); // 資料長度
    view.setUint32(base + 12, offset, true);        // 資料位移
    bytes.set(new Uint8Array(png), offset);
    offset += png.byteLength;
  });

  return new Blob([buffer], { type: 'image/x-icon' });
}

// ============================================================
// store-only ZIP（無壓縮）
// ============================================================
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes) {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

// files: [{ name, blob }]；回傳一個可下載的 zip Blob
export async function buildZip(files) {
  const enc = new TextEncoder();
  const records = await Promise.all(
    files.map(async (f) => {
      const data = new Uint8Array(await f.blob.arrayBuffer());
      return { name: enc.encode(f.name), data, crc: crc32(data) };
    })
  );

  const chunks = [];     // 依序寫入的位元組片段
  const central = [];    // 中央目錄項
  let offset = 0;

  const u16 = (n) => { const b = new Uint8Array(2); new DataView(b.buffer).setUint16(0, n, true); return b; };
  const u32 = (n) => { const b = new Uint8Array(4); new DataView(b.buffer).setUint32(0, n >>> 0, true); return b; };

  records.forEach((r) => {
    const size = r.data.length;
    // — Local file header —
    const local = concat(
      u32(0x04034b50), u16(20), u16(0), u16(0), u16(0), u16(0),
      u32(r.crc), u32(size), u32(size),
      u16(r.name.length), u16(0), r.name
    );
    chunks.push(local, r.data);

    // — 對應的中央目錄項 —
    central.push(concat(
      u32(0x02014b50), u16(20), u16(20), u16(0), u16(0), u16(0), u16(0),
      u32(r.crc), u32(size), u32(size),
      u16(r.name.length), u16(0), u16(0), u16(0), u16(0), u32(0),
      u32(offset), r.name
    ));
    offset += local.length + size;
  });

  const centralStart = offset;
  let centralSize = 0;
  central.forEach((c) => { chunks.push(c); centralSize += c.length; });

  // — End of central directory —
  chunks.push(concat(
    u32(0x06054b50), u16(0), u16(0),
    u16(records.length), u16(records.length),
    u32(centralSize), u32(centralStart), u16(0)
  ));

  return new Blob(chunks, { type: 'application/zip' });
}

// 串接多個 Uint8Array
function concat(...parts) {
  const total = parts.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(total);
  let pos = 0;
  parts.forEach((p) => { out.set(p, pos); pos += p.length; });
  return out;
}
