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

// ── 減色（全域色盤，中位切割）───────────────────────────

// 掃描整段動畫的所有幀，建立「單一共用色盤」。
// 全片共用一張色表，除了避免逐幀量化造成的閃爍，也讓後續幀間差分能在一致的
// 索引空間比對「像素有沒有變」。永遠保留一格透明索引：差分時未變動的像素會
// 指向它（靠 disposal「不清除」讓前一幀透出），genuine 透明像素也用它。
// 回傳：{ palette, paletteSize, colorDepth, transparentIndex, opaqueCount, hasTransparent, _palArr }
export function buildPalette(rgbaFrames, maxColors) {
  const hist = new Map();
  let hasTransparent = false;
  for (const rgba of rgbaFrames) {
    const n = rgba.length / 4;
    for (let i = 0; i < n; i++) {
      if (rgba[i * 4 + 3] < 128) { hasTransparent = true; continue; }
      const key = (rgba[i * 4] << 16) | (rgba[i * 4 + 1] << 8) | rgba[i * 4 + 2];
      hist.set(key, (hist.get(key) || 0) + 1);
    }
  }

  const target = Math.max(1, maxColors - 1); // 恆留 1 格給透明
  const colors = [];
  for (const [key, count] of hist) {
    colors.push({ r: (key >> 16) & 255, g: (key >> 8) & 255, b: key & 255, count });
  }

  let palArr = colors.length <= target
    ? colors.map((c) => [c.r, c.g, c.b])
    : medianCut(colors, target);
  if (palArr.length === 0) palArr = [[0, 0, 0]];

  const opaqueCount = palArr.length;      // 最近色只在不透明色中比對
  const transparentIndex = opaqueCount;   // 緊接在不透明色後的那一格
  palArr = palArr.slice();
  palArr.push([0, 0, 0]);                 // 透明格

  // 色表補足到 2 的冪次；GIF 最小碼寬需要 ≥ 4 色的色表
  let size = 2;
  while (size < palArr.length) size *= 2;
  if (size < 4) size = 4;
  while (palArr.length < size) palArr.push([0, 0, 0]);
  const colorDepth = Math.round(Math.log2(size)); // size ≥ 4 → colorDepth ≥ 2

  const palette = new Uint8Array(size * 3);
  for (let k = 0; k < size; k++) {
    palette[k * 3] = palArr[k][0];
    palette[k * 3 + 1] = palArr[k][1];
    palette[k * 3 + 2] = palArr[k][2];
  }

  return { palette, paletteSize: size, colorDepth, transparentIndex, opaqueCount, hasTransparent, _palArr: palArr };
}

// 建立「RGB → 最近色索引」查找器；快取跨幀共用（全域色盤才做得到）以加速。
function makeNearest(pal) {
  const { _palArr, opaqueCount } = pal;
  const cache = new Map();
  return (r, g, b) => {
    const key = (r << 16) | (g << 8) | b;
    const hit = cache.get(key);
    if (hit !== undefined) return hit;
    let best = 0, bestD = Infinity;
    for (let k = 0; k < opaqueCount; k++) {
      const dr = r - _palArr[k][0], dg = g - _palArr[k][1], db = b - _palArr[k][2];
      const d = dr * dr + dg * dg + db * db;
      if (d < bestD) { bestD = d; best = k; }
    }
    cache.set(key, best);
    return best;
  };
}

// 把一整張畫布的 RGBA 對映成全域色盤的索引（透明像素→透明索引）
function mapFrame(rgba, transparentIndex, nearest) {
  const n = rgba.length / 4;
  const indices = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    if (rgba[i * 4 + 3] < 128) { indices[i] = transparentIndex; continue; }
    indices[i] = nearest(rgba[i * 4], rgba[i * 4 + 1], rgba[i * 4 + 2]);
  }
  return indices;
}

// 幀間差分：比對本幀與前一幀（皆為整張畫布的索引），
// 只保留變動像素、其餘設透明，並裁切到變動範圍的最小外接矩形。
// disposal 用 1（不清除），未變動處靠前一幀透出，達成「只重畫變動區塊」。
function diffFrame(prev, cur, width, height, transparentIndex, delayCs) {
  let minX = width, minY = height, maxX = -1, maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (cur[y * width + x] !== prev[y * width + x]) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  // 與前幀完全相同：輸出 1×1 透明佔位幀，只為保留這一格的延遲時間
  if (maxX < 0) {
    return {
      left: 0, top: 0, iw: 1, ih: 1,
      indices: Uint8Array.of(transparentIndex),
      disposal: 1, transparent: true, transparentIndex, delayCs,
    };
  }

  const iw = maxX - minX + 1;
  const ih = maxY - minY + 1;
  const sub = new Uint8Array(iw * ih);
  for (let y = 0; y < ih; y++) {
    const sy = minY + y;
    for (let x = 0; x < iw; x++) {
      const si = sy * width + (minX + x);
      sub[y * iw + x] = cur[si] === prev[si] ? transparentIndex : cur[si];
    }
  }
  return {
    left: minX, top: minY, iw, ih,
    indices: sub, disposal: 1, transparent: true, transparentIndex, delayCs,
  };
}

// 把每幀 RGBA 規劃成「編碼就緒」的幀陣列。
// - 全不透明動畫：首幀完整、其後逐幀差分（disposal 1），這是壓縮率的主要來源。
// - 含透明的動畫：為求正確（透明會牽涉「抹除已顯示像素」需要 disposal 前瞻），
//   維持逐幀完整重畫（disposal 2），不做差分。
// onStep(i) 為選用的每幀回呼（讓出主執行緒／回報進度）；回傳 true 代表中止。
export async function planFrames(rgbaFrames, width, height, delays, pal, { onStep } = {}) {
  const { transparentIndex, hasTransparent } = pal;
  const nearest = makeNearest(pal);
  const frames = [];
  let prev = null;

  for (let i = 0; i < rgbaFrames.length; i++) {
    const cur = mapFrame(rgbaFrames[i], transparentIndex, nearest);
    if (hasTransparent) {
      // Path B：含透明，完整重畫 + disposal 2（還原背景 = 透明）
      frames.push({
        left: 0, top: 0, iw: width, ih: height,
        indices: cur, disposal: 2, transparent: true, transparentIndex, delayCs: delays[i],
      });
    } else if (i === 0) {
      // Path A 首幀：完整、disposal 1（迴圈回捲時由它整張重繪）
      frames.push({
        left: 0, top: 0, iw: width, ih: height,
        indices: cur, disposal: 1, transparent: true, transparentIndex, delayCs: delays[i],
      });
    } else {
      frames.push(diffFrame(prev, cur, width, height, transparentIndex, delays[i]));
    }
    prev = cur;
    if (onStep && (await onStep(i))) return null;
  }
  return frames;
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

// 組出完整多幀 GIF89a（單一全域色表）
// 參數：{ width, height, loopCount, palette, paletteSize, colorDepth, transparentIndex,
//        frames: [{ left, top, iw, ih, indices, disposal, transparent, transparentIndex, delayCs }] }
export function encodeGif({ width, height, loopCount = 0, palette, paletteSize, colorDepth, transparentIndex, frames }) {
  const out = new ByteBuffer();
  out.str('GIF89a');
  out.u16(width);
  out.u16(height);
  // 邏輯螢幕描述子：啟用全域色表（0x80）、色彩解析度 7、色表大小 = colorDepth-1
  out.byte(0xF0 | (colorDepth - 1));
  out.byte(transparentIndex & 0xff); // 背景色索引 → 透明格（disposal 2 還原背景即透明）
  out.byte(0x00);                     // 像素長寬比
  out.bytes(palette, paletteSize * 3);

  // NETSCAPE 迴圈擴充（loopCount 0 = 無限循環）
  out.byte(0x21); out.byte(0xFF); out.byte(0x0B);
  out.str('NETSCAPE2.0');
  out.byte(0x03); out.byte(0x01);
  out.u16(loopCount);
  out.byte(0x00);

  for (const f of frames) {
    // 圖形控制擴充：每幀自帶處置方式與透明旗標
    out.byte(0x21); out.byte(0xF9); out.byte(0x04);
    const transFlag = f.transparent ? 1 : 0;
    out.byte((f.disposal << 2) | transFlag);
    out.u16(f.delayCs);
    out.byte(f.transparent ? f.transparentIndex : 0);
    out.byte(0x00);

    // 影像描述子：本幀的位移與尺寸（差分幀只覆蓋變動矩形），不帶區域色表
    out.byte(0x2C);
    out.u16(f.left); out.u16(f.top);
    out.u16(f.iw); out.u16(f.ih);
    out.byte(0x00);

    // 影像資料（LZW）
    encodeImageData(out, f.indices, colorDepth);
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
