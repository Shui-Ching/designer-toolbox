// ============================================================
// GIF Codec — 純原生零依賴的 GIF 解碼器 + 編碼器
// 瀏覽器無法用 Canvas 拆出動畫每一幀（只拿得到第一幀），故自行：
//   解碼（含 LZW）→ 依 disposal 合成每幀完整畫面 → 中位切割減色 → LZW 重新編碼
// 符合工具箱 CSP `script-src 'self'`：不依賴任何外部函式庫。
// ============================================================

// ── 解碼 ─────────────────────────────────────────────────

// 解碼 GIF 位元組，回傳 { width, height, loopCount, frames: [{ rgba, delayCs }] }
// rgba 為與整張畫布同尺寸、已依 disposal 合成的 Uint8ClampedArray（RGBA）
export function decodeGif(bytes) {
  let p = 0;
  const rd8 = () => bytes[p++];
  const rd16 = () => { const v = bytes[p] | (bytes[p + 1] << 8); p += 2; return v; };

  // 讀取指定筆數的色表（每色 3 bytes）
  const readColorTable = (size) => {
    const table = new Uint8Array(size * 3);
    for (let i = 0; i < size * 3; i++) table[i] = bytes[p++];
    return table;
  };

  // 略過（或收集）以長度為前綴、以 0 結尾的資料子區塊
  const skipSubBlocks = () => { let s; while ((s = rd8()) !== 0) p += s; };
  const readSubBlocksData = () => {
    const chunks = [];
    let total = 0, s;
    while ((s = rd8()) !== 0) { chunks.push(bytes.subarray(p, p + s)); p += s; total += s; }
    const out = new Uint8Array(total);
    let off = 0;
    for (const c of chunks) { out.set(c, off); off += c.length; }
    return out;
  };

  // 檔頭：GIF87a / GIF89a
  if (bytes[0] !== 0x47 || bytes[1] !== 0x49 || bytes[2] !== 0x46) {
    throw new Error('不是有效的 GIF 檔');
  }
  p = 6;
  const width = rd16();
  const height = rd16();
  const packed = rd8();
  rd8(); // 背景色索引（略）
  rd8(); // 像素長寬比（略）
  const gct = (packed & 0x80) ? readColorTable(2 << (packed & 0x07)) : null;

  const frames = [];
  let loopCount = 0;
  let gce = null; // 待套用的圖形控制擴充：{ disposal, transparent, transIndex, delay }

  // 合成用畫布（全 0 = 透明），並記錄前一幀的處置方式
  const canvas = new Uint8ClampedArray(width * height * 4);
  let pending = null; // { method, left, top, iw, ih, saved }

  while (p < bytes.length) {
    const block = rd8();
    if (block === 0x3B || block === undefined) break; // 結束符

    if (block === 0x21) { // 擴充區塊
      const label = rd8();
      if (label === 0xF9) { // 圖形控制擴充
        rd8(); // 區塊大小（固定 4）
        const flags = rd8();
        const delay = rd16();
        const transIndex = rd8();
        rd8(); // 終止符
        gce = {
          disposal: (flags >> 2) & 0x07,
          transparent: (flags & 0x01) !== 0,
          transIndex,
          delay,
        };
      } else if (label === 0xFF) { // 應用程式擴充（偵測 NETSCAPE 迴圈次數）
        const size = rd8();
        let app = '';
        for (let i = 0; i < size; i++) app += String.fromCharCode(bytes[p++]);
        if (app === 'NETSCAPE2.0' || app === 'ANIMEXTS1.0') {
          let s;
          while ((s = rd8()) !== 0) {
            if (s === 3) { rd8(); loopCount = rd16(); } else { p += s; }
          }
        } else {
          skipSubBlocks();
        }
      } else {
        skipSubBlocks();
      }
    } else if (block === 0x2C) { // 影像描述子
      const left = rd16();
      const top = rd16();
      const iw = rd16();
      const ih = rd16();
      const ipacked = rd8();
      const lctFlag = (ipacked & 0x80) !== 0;
      const interlace = (ipacked & 0x40) !== 0;
      const colorTable = lctFlag ? readColorTable(2 << (ipacked & 0x07)) : gct;
      const minCodeSize = rd8();
      const data = readSubBlocksData();
      const indices = lzwDecode(minCodeSize, data, iw * ih);
      if (interlace) deinterlace(indices, iw, ih);

      // 先套用「前一幀」的處置方式，讓本幀畫在正確的底
      if (pending) {
        if (pending.method === 2) clearRect(canvas, width, pending);
        else if (pending.method === 3 && pending.saved) canvas.set(pending.saved);
      }
      // 若本幀處置為 3（還原到先前），先存一份底
      const saved = gce && gce.disposal === 3 ? canvas.slice() : null;

      // 疊上本幀（透明索引不覆蓋底層）
      const trans = gce && gce.transparent ? gce.transIndex : -1;
      if (colorTable) drawFrame(canvas, width, colorTable, indices, left, top, iw, ih, trans);

      frames.push({ rgba: canvas.slice(), delayCs: gce ? gce.delay : 0 });
      pending = { method: gce ? gce.disposal : 0, left, top, iw, ih, saved };
      gce = null;
    } else {
      break; // 未知區塊，停止
    }
  }

  return { width, height, loopCount, frames };
}

// 把子影像的索引依色表畫到整張畫布（跳過透明索引）
function drawFrame(canvas, W, ct, indices, left, top, iw, ih, trans) {
  const ctLen = ct.length / 3;
  for (let y = 0; y < ih; y++) {
    const cy = top + y;
    for (let x = 0; x < iw; x++) {
      const idx = indices[y * iw + x];
      if (idx === trans || idx >= ctLen) continue;
      const cx = left + x;
      const o = (cy * W + cx) * 4;
      const ci = idx * 3;
      canvas[o] = ct[ci];
      canvas[o + 1] = ct[ci + 1];
      canvas[o + 2] = ct[ci + 2];
      canvas[o + 3] = 255;
    }
  }
}

// 處置方式 2：把某矩形還原成背景（此處以透明表示）
function clearRect(canvas, W, r) {
  for (let y = 0; y < r.ih; y++) {
    for (let x = 0; x < r.iw; x++) {
      const o = ((r.top + y) * W + (r.left + x)) * 4;
      canvas[o] = canvas[o + 1] = canvas[o + 2] = canvas[o + 3] = 0;
    }
  }
}

// GIF 交錯掃描還原為逐列順序
function deinterlace(indices, w, h) {
  const out = new Uint8Array(indices.length);
  const passes = [[0, 8], [4, 8], [2, 4], [1, 2]];
  let srcRow = 0;
  for (const [start, step] of passes) {
    for (let row = start; row < h; row += step) {
      out.set(indices.subarray(srcRow * w, srcRow * w + w), row * w);
      srcRow++;
    }
  }
  indices.set(out);
}

// LZW 解碼（GIF 變動碼寬版本，標準實作）
function lzwDecode(minCodeSize, data, pixelCount) {
  const MAX = 4096;
  const clear = 1 << minCodeSize;
  const eoi = clear + 1;
  const out = new Uint8Array(pixelCount);
  const prefix = new Int32Array(MAX);
  const suffix = new Int32Array(MAX);
  const stack = new Uint8Array(MAX + 1);
  for (let c = 0; c < clear; c++) { prefix[c] = 0; suffix[c] = c; }

  let codeSize = minCodeSize + 1;
  let codeMask = (1 << codeSize) - 1;
  let available = clear + 2;
  let oldCode = -1;
  let bits = 0, datum = 0, bi = 0, top = 0, first = 0, pi = 0, i = 0;

  while (i < pixelCount) {
    if (top === 0) {
      if (bits < codeSize) {
        if (bi >= data.length) break;
        datum += data[bi++] << bits;
        bits += 8;
        continue;
      }
      let code = datum & codeMask;
      datum >>= codeSize;
      bits -= codeSize;

      if (code === clear) {
        codeSize = minCodeSize + 1;
        codeMask = (1 << codeSize) - 1;
        available = clear + 2;
        oldCode = -1;
        continue;
      }
      if (code === eoi) break;

      if (oldCode === -1) {
        stack[top++] = suffix[code];
        oldCode = code;
        first = code;
        continue;
      }
      const inCode = code;
      if (code >= available) { stack[top++] = first; code = oldCode; }
      while (code > clear) { stack[top++] = suffix[code]; code = prefix[code]; }
      first = suffix[code] & 0xff;
      stack[top++] = first;
      if (available < MAX) {
        prefix[available] = oldCode;
        suffix[available] = first;
        available++;
        if ((available & codeMask) === 0 && available < MAX) {
          codeSize++;
          codeMask += available;
        }
      }
      oldCode = inCode;
    }
    top--;
    out[pi++] = stack[top];
    i++;
  }
  return out;
}

// ── 減色（中位切割）─────────────────────────────────────

// 把一幀 RGBA 量化到 maxColors 內，回傳供編碼用的索引與色表
// { palette: Uint8Array(size*3), paletteSize, indices: Uint8Array, transparentIndex, colorDepth }
export function quantizeFrame(rgba, maxColors) {
  const n = rgba.length / 4;

  // 統計不重複的不透明顏色
  const hist = new Map();
  let hasTransparent = false;
  for (let i = 0; i < n; i++) {
    if (rgba[i * 4 + 3] < 128) { hasTransparent = true; continue; }
    const key = (rgba[i * 4] << 16) | (rgba[i * 4 + 1] << 8) | rgba[i * 4 + 2];
    hist.set(key, (hist.get(key) || 0) + 1);
  }

  const reserve = hasTransparent ? 1 : 0;
  const target = Math.max(1, maxColors - reserve);

  const colors = [];
  for (const [key, count] of hist) {
    colors.push({ r: (key >> 16) & 255, g: (key >> 8) & 255, b: key & 255, count });
  }

  let palette = colors.length <= target
    ? colors.map((c) => [c.r, c.g, c.b])
    : medianCut(colors, target);
  if (palette.length === 0) palette = [[0, 0, 0]];

  const opaqueCount = palette.length; // 最近色只在不透明色中比對，別誤配到透明格

  // 近似色查找（以顏色為 key 快取，減少重複計算）
  const cache = new Map();
  const nearest = (r, g, b) => {
    const key = (r << 16) | (g << 8) | b;
    const hit = cache.get(key);
    if (hit !== undefined) return hit;
    let best = 0, bestD = Infinity;
    for (let k = 0; k < opaqueCount; k++) {
      const dr = r - palette[k][0], dg = g - palette[k][1], db = b - palette[k][2];
      const d = dr * dr + dg * dg + db * db;
      if (d < bestD) { bestD = d; best = k; }
    }
    cache.set(key, best);
    return best;
  };

  let transparentIndex = -1;
  if (hasTransparent) { transparentIndex = palette.length; palette.push([0, 0, 0]); }

  // 色表補足到 2 的冪次（GIF 規定）
  let size = 2;
  while (size < palette.length) size *= 2;
  while (palette.length < size) palette.push([0, 0, 0]);
  const colorDepth = Math.max(2, Math.round(Math.log2(size)));

  const indices = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    if (rgba[i * 4 + 3] < 128 && transparentIndex >= 0) { indices[i] = transparentIndex; continue; }
    indices[i] = nearest(rgba[i * 4], rgba[i * 4 + 1], rgba[i * 4 + 2]);
  }

  const pal = new Uint8Array(size * 3);
  for (let k = 0; k < size; k++) {
    pal[k * 3] = palette[k][0];
    pal[k * 3 + 1] = palette[k][1];
    pal[k * 3 + 2] = palette[k][2];
  }

  return { palette: pal, paletteSize: size, indices, transparentIndex, colorDepth };
}

// 中位切割：反覆挑「顏色分佈最廣」的盒子，沿最長通道切成兩半
function medianCut(colors, target) {
  let boxes = [colors];
  while (boxes.length < target) {
    let pick = -1, widest = -1;
    for (let i = 0; i < boxes.length; i++) {
      if (boxes[i].length < 2) continue;
      const r = boxRange(boxes[i]);
      if (r.max > widest) { widest = r.max; pick = i; }
    }
    if (pick === -1) break;

    const box = boxes[pick];
    const ch = boxRange(box).channel;
    box.sort((a, b) => a[ch] - b[ch]);

    // 依累計像素數在中位處切開，讓兩側權重接近
    const total = box.reduce((s, c) => s + c.count, 0);
    let acc = 0, at = 1;
    for (let i = 0; i < box.length; i++) {
      acc += box[i].count;
      if (acc >= total / 2) { at = i + 1; break; }
    }
    at = Math.min(Math.max(1, at), box.length - 1);
    boxes.splice(pick, 1, box.slice(0, at), box.slice(at));
  }

  // 每盒取像素數加權平均色
  return boxes.map((box) => {
    let r = 0, g = 0, b = 0, t = 0;
    for (const c of box) { r += c.r * c.count; g += c.g * c.count; b += c.b * c.count; t += c.count; }
    return [Math.round(r / t), Math.round(g / t), Math.round(b / t)];
  });
}

// 盒子的最長通道與其跨距（綠通道略加權，貼近人眼敏感度）
function boxRange(box) {
  let rmin = 255, rmax = 0, gmin = 255, gmax = 0, bmin = 255, bmax = 0;
  for (const c of box) {
    if (c.r < rmin) rmin = c.r; if (c.r > rmax) rmax = c.r;
    if (c.g < gmin) gmin = c.g; if (c.g > gmax) gmax = c.g;
    if (c.b < bmin) bmin = c.b; if (c.b > bmax) bmax = c.b;
  }
  const rr = (rmax - rmin) * 1.0;
  const gr = (gmax - gmin) * 1.2;
  const br = (bmax - bmin) * 0.8;
  let channel = 'r', max = rr;
  if (gr > max) { max = gr; channel = 'g'; }
  if (br > max) { max = br; channel = 'b'; }
  return { channel, max };
}

// ── 編碼 ─────────────────────────────────────────────────

// 可自動擴充的位元組緩衝
class ByteBuffer {
  constructor() { this.buf = new Uint8Array(4096); this.len = 0; }
  ensure(n) {
    if (this.len + n <= this.buf.length) return;
    let cap = this.buf.length * 2;
    while (cap < this.len + n) cap *= 2;
    const nb = new Uint8Array(cap);
    nb.set(this.buf);
    this.buf = nb;
  }
  byte(b) { this.ensure(1); this.buf[this.len++] = b & 0xff; }
  bytes(arr, len) { this.ensure(len); for (let i = 0; i < len; i++) this.buf[this.len++] = arr[i]; }
  u16(v) { this.byte(v & 0xff); this.byte((v >> 8) & 0xff); }
  str(s) { for (let i = 0; i < s.length; i++) this.byte(s.charCodeAt(i)); }
  result() { return this.buf.subarray(0, this.len); }
}

// 組出完整多幀 GIF89a
// frames: [{ delayCs, palette, paletteSize, indices, transparentIndex, colorDepth }]
export function encodeGif({ width, height, loopCount = 0, frames }) {
  const out = new ByteBuffer();
  out.str('GIF89a');
  out.u16(width);
  out.u16(height);
  out.byte(0x00); // 不用全域色表（改用各幀區域色表）
  out.byte(0x00); // 背景色索引
  out.byte(0x00); // 像素長寬比

  // NETSCAPE 迴圈擴充（loopCount 0 = 無限循環）
  out.byte(0x21); out.byte(0xFF); out.byte(0x0B);
  out.str('NETSCAPE2.0');
  out.byte(0x03); out.byte(0x01);
  out.u16(loopCount);
  out.byte(0x00);

  for (const f of frames) {
    // 圖形控制擴充：處置方式 2（還原背景）以正確處理透明
    out.byte(0x21); out.byte(0xF9); out.byte(0x04);
    const transFlag = f.transparentIndex >= 0 ? 1 : 0;
    out.byte((2 << 2) | transFlag);
    out.u16(f.delayCs);
    out.byte(f.transparentIndex >= 0 ? f.transparentIndex : 0);
    out.byte(0x00);

    // 影像描述子（整張、含區域色表）
    out.byte(0x2C);
    out.u16(0); out.u16(0);
    out.u16(width); out.u16(height);
    out.byte(0x80 | (Math.round(Math.log2(f.paletteSize)) - 1));
    out.bytes(f.palette, f.paletteSize * 3);

    // 影像資料（LZW）
    encodeImageData(out, f.indices, f.colorDepth);
  }

  out.byte(0x3B); // 結束符
  return out.result();
}

// 寫入一張影像的 LZW 資料：最小碼寬 + 子區塊 + 終止符
function encodeImageData(out, indices, colorDepth) {
  const initCodeSize = Math.max(2, colorDepth);
  out.byte(initCodeSize);
  lzwEncode(out, indices, initCodeSize);
  out.byte(0x00);
}

// LZW 編碼（K. Weiner 的 GIF 壓縮實作，與標準解碼器碼寬時序相容）
function lzwEncode(out, pixels, initCodeSize) {
  const EOF = -1;
  const BITS = 12;
  const HSIZE = 5003;
  const masks = [0x0000, 0x0001, 0x0003, 0x0007, 0x000F, 0x001F, 0x003F, 0x007F,
    0x00FF, 0x01FF, 0x03FF, 0x07FF, 0x0FFF, 0x1FFF, 0x3FFF, 0x7FFF, 0xFFFF];

  const htab = new Int32Array(HSIZE);
  const codetab = new Int32Array(HSIZE);
  const accum = new Uint8Array(256);
  let aCount = 0;
  let curAccum = 0, curBits = 0;
  const initBits = initCodeSize + 1;
  const clearCode = 1 << initCodeSize;
  const eofCode = clearCode + 1;
  let nBits = initBits;
  let maxcode = (1 << nBits) - 1;
  let freeEnt = clearCode + 2;
  let clearFlg = false;
  let curPixel = 0;

  const flushChar = () => {
    if (aCount > 0) { out.byte(aCount); out.bytes(accum, aCount); aCount = 0; }
  };
  const charOut = (c) => { accum[aCount++] = c; if (aCount >= 254) flushChar(); };
  const clHash = () => { for (let i = 0; i < HSIZE; i++) htab[i] = -1; };

  const output = (code) => {
    curAccum &= masks[curBits];
    curAccum = curBits > 0 ? (curAccum | (code << curBits)) : code;
    curBits += nBits;
    while (curBits >= 8) { charOut(curAccum & 0xff); curAccum >>= 8; curBits -= 8; }
    if (freeEnt > maxcode || clearFlg) {
      if (clearFlg) { maxcode = (1 << (nBits = initBits)) - 1; clearFlg = false; }
      else { nBits++; maxcode = nBits === BITS ? (1 << BITS) : (1 << nBits) - 1; }
    }
    if (code === eofCode) {
      while (curBits > 0) { charOut(curAccum & 0xff); curAccum >>= 8; curBits -= 8; }
      flushChar();
    }
  };
  const clBlock = () => { clHash(); freeEnt = clearCode + 2; clearFlg = true; output(clearCode); };
  const nextPixel = () => (curPixel >= pixels.length ? EOF : pixels[curPixel++] & 0xff);

  let hshift = 0;
  for (let f = HSIZE; f < 65536; f *= 2) hshift++;
  hshift = 8 - hshift;
  clHash();
  output(clearCode);

  let ent = nextPixel();
  let c;
  outer: while ((c = nextPixel()) !== EOF) {
    const fcode = (c << BITS) + ent;
    let i = (c << hshift) ^ ent;
    if (htab[i] === fcode) { ent = codetab[i]; continue; }
    if (htab[i] >= 0) {
      let disp = i === 0 ? 1 : HSIZE - i;
      do {
        i -= disp;
        if (i < 0) i += HSIZE;
        if (htab[i] === fcode) { ent = codetab[i]; continue outer; }
      } while (htab[i] >= 0);
    }
    output(ent);
    ent = c;
    if (freeEnt < (1 << BITS)) { codetab[i] = freeEnt++; htab[i] = fcode; }
    else clBlock();
  }
  output(ent);
  output(eofCode);
}
