// ============================================================
// QR 編碼器 — 純前端、零相依、位元組模式（UTF-8）
// 依 ISO/IEC 18004 規格實作：自動選版本（1–40）、L/M/Q/H 容錯、
// Reed-Solomon 錯誤更正、8 種遮罩自動挑選最佳。
// 僅用位元組模式即可涵蓋任意文字／網址（中英數符號皆可）。
// 演算法結構參考 Project Nayuki 的 QR Code generator（MIT），以繁中重寫。
// ============================================================

// 容錯等級對應索引
const ECC = { L: 0, M: 1, Q: 2, H: 3 };

// 各版本（1–40）、各容錯等級「每區塊的 ECC 碼字數」。索引 0 為佔位（不合法）。
const ECC_CODEWORDS_PER_BLOCK = [
  [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30], // L
  [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28], // M
  [-1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30], // Q
  [-1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30], // H
];

// 各版本、各容錯等級的「錯誤更正區塊數」。
const NUM_ERROR_CORRECTION_BLOCKS = [
  [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25], // L
  [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49], // M
  [-1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68], // Q
  [-1, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81], // H
];

// 取整數 x 第 i 位（由低位起算）是否為 1
function getBit(x, i) {
  return ((x >>> i) & 1) !== 0;
}

// 某版本所有「資料模組」的位元數（扣掉功能圖樣後可放資料的格子數）
function getNumRawDataModules(ver) {
  let result = (16 * ver + 128) * ver + 64;
  if (ver >= 2) {
    const numAlign = Math.floor(ver / 7) + 2;
    result -= (25 * numAlign - 10) * numAlign - 55;
    if (ver >= 7) result -= 36; // 版本資訊區
  }
  return result;
}

// 某版本＋容錯等級可放的「資料碼字數」
function getNumDataCodewords(ver, ecl) {
  return Math.floor(getNumRawDataModules(ver) / 8)
    - ECC_CODEWORDS_PER_BLOCK[ecl][ver] * NUM_ERROR_CORRECTION_BLOCKS[ecl][ver];
}

// GF(256) 乘法，原始多項式 0x11d
function reedSolomonMultiply(x, y) {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z & 0xff;
}

// 產生指定次數的 Reed-Solomon 除式（生成多項式係數）
function reedSolomonComputeDivisor(degree) {
  const result = new Array(degree).fill(0);
  result[degree - 1] = 1; // 起始為單項式 x^degree
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < result.length; j++) {
      result[j] = reedSolomonMultiply(result[j], root);
      if (j + 1 < result.length) result[j] ^= result[j + 1];
    }
    root = reedSolomonMultiply(root, 0x02);
  }
  return result;
}

// 以除式計算資料的 ECC 餘式
function reedSolomonComputeRemainder(data, divisor) {
  const result = divisor.map(() => 0);
  for (const b of data) {
    const factor = b ^ result.shift();
    result.push(0);
    divisor.forEach((coef, i) => { result[i] ^= reedSolomonMultiply(coef, factor); });
  }
  return result;
}

// 把資料碼字加上 ECC 並依規格交錯排列成最終碼字序列
function addEccAndInterleave(data, version, ecl) {
  const numBlocks = NUM_ERROR_CORRECTION_BLOCKS[ecl][version];
  const blockEccLen = ECC_CODEWORDS_PER_BLOCK[ecl][version];
  const rawCodewords = Math.floor(getNumRawDataModules(version) / 8);
  const numShortBlocks = numBlocks - rawCodewords % numBlocks;
  const shortBlockLen = Math.floor(rawCodewords / numBlocks);

  const blocks = [];
  const rsDiv = reedSolomonComputeDivisor(blockEccLen);
  for (let i = 0, k = 0; i < numBlocks; i++) {
    const datLen = shortBlockLen - blockEccLen + (i < numShortBlocks ? 0 : 1);
    const dat = data.slice(k, k + datLen);
    k += dat.length;
    const ecc = reedSolomonComputeRemainder(dat, rsDiv);
    if (i < numShortBlocks) dat.push(0); // 短區塊補一個佔位碼字，交錯時跳過
    blocks.push(dat.concat(ecc));
  }

  const result = [];
  for (let i = 0; i < blocks[0].length; i++) {
    blocks.forEach((block, j) => {
      // 跳過短區塊的佔位碼字
      if (i !== shortBlockLen - blockEccLen || j >= numShortBlocks) result.push(block[i]);
    });
  }
  return result;
}

// 對齊圖樣中心座標表
function getAlignmentPatternPositions(ver) {
  if (ver === 1) return [];
  const numAlign = Math.floor(ver / 7) + 2;
  const step = (ver === 32) ? 26 : Math.ceil((ver * 4 + 4) / (numAlign * 2 - 2)) * 2;
  const result = [6];
  for (let pos = ver * 4 + 10; result.length < numAlign; pos -= step) result.splice(1, 0, pos);
  return result;
}

// ============================================================
// 主流程：把文字編碼成 QR 模組矩陣（boolean[][]，true = 黑點）
// ============================================================
export function encodeQr(text, eclName = 'M') {
  const ecl = ECC[eclName] ?? ECC.M;
  const dataBytes = new TextEncoder().encode(text); // UTF-8 位元組

  // 1) 選最小可容納的版本
  let version = -1;
  let dataCapacityBits = 0;
  for (let v = 1; v <= 40; v++) {
    const capacityBits = getNumDataCodewords(v, ecl) * 8;
    const charCountBits = v <= 9 ? 8 : 16; // 位元組模式字元數欄位寬度
    const usedBits = 4 + charCountBits + dataBytes.length * 8;
    if (usedBits <= capacityBits) { version = v; dataCapacityBits = capacityBits; break; }
  }
  if (version === -1) throw new Error('資料太長，超過 QR Code 最大容量');

  // 2) 組位元緩衝：模式指示 + 字元數 + 資料 + 終止 + 補齊
  const bits = [];
  const appendBits = (val, len) => { for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
  appendBits(0x4, 4); // 位元組模式指示子
  appendBits(dataBytes.length, version <= 9 ? 8 : 16);
  for (const b of dataBytes) appendBits(b, 8);
  appendBits(0, Math.min(4, dataCapacityBits - bits.length)); // 終止符
  appendBits(0, (8 - bits.length % 8) % 8); // 補齊到位元組邊界
  for (let pad = 0xEC; bits.length < dataCapacityBits; pad ^= 0xEC ^ 0x11) appendBits(pad, 8); // 補齊碼字

  // 3) 打包成位元組
  const dataCodewords = new Array(bits.length >>> 3).fill(0);
  bits.forEach((bit, i) => { dataCodewords[i >>> 3] |= bit << (7 - (i & 7)); });

  // 4) 加 ECC 並交錯
  const allCodewords = addEccAndInterleave(dataCodewords, version, ecl);

  // 5) 畫矩陣
  return drawMatrix(version, ecl, allCodewords);
}

// 依碼字畫出完整 QR 矩陣（含功能圖樣、資料、最佳遮罩）
function drawMatrix(version, ecl, allCodewords) {
  const size = version * 4 + 17;
  const modules = Array.from({ length: size }, () => new Array(size).fill(false));
  const isFunction = Array.from({ length: size }, () => new Array(size).fill(false));

  const setFn = (x, y, dark) => { modules[y][x] = dark; isFunction[y][x] = true; };

  // — 計時圖樣 —
  for (let i = 0; i < size; i++) { setFn(6, i, i % 2 === 0); setFn(i, 6, i % 2 === 0); }

  // — 三個定位圖樣（含分隔白邊）—
  const drawFinder = (cx, cy) => {
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const dist = Math.max(Math.abs(dx), Math.abs(dy));
        const x = cx + dx;
        const y = cy + dy;
        if (x >= 0 && x < size && y >= 0 && y < size) setFn(x, y, dist !== 2 && dist !== 4);
      }
    }
  };
  drawFinder(3, 3); drawFinder(size - 4, 3); drawFinder(3, size - 4);

  // — 對齊圖樣 —
  const alignPos = getAlignmentPatternPositions(version);
  const numAlign = alignPos.length;
  const drawAlign = (cx, cy) => {
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        setFn(cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
      }
    }
  };
  for (let i = 0; i < numAlign; i++) {
    for (let j = 0; j < numAlign; j++) {
      // 三個角落已被定位圖樣占用，跳過
      if (!((i === 0 && j === 0) || (i === 0 && j === numAlign - 1) || (i === numAlign - 1 && j === 0))) {
        drawAlign(alignPos[i], alignPos[j]);
      }
    }
  }

  // — 畫格式資訊（含遮罩）；先以遮罩 0 佔位，挑出最佳遮罩後再覆寫 —
  const drawFormatBits = (mask) => {
    const eclFormatBits = [1, 0, 3, 2][ecl]; // L,M,Q,H → 格式位元
    const data = (eclFormatBits << 3) | mask;
    let rem = data;
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    const formatBits = ((data << 10) | rem) ^ 0x5412;

    // 第一份：左上角
    for (let i = 0; i <= 5; i++) setFn(8, i, getBit(formatBits, i));
    setFn(8, 7, getBit(formatBits, 6));
    setFn(8, 8, getBit(formatBits, 7));
    setFn(7, 8, getBit(formatBits, 8));
    for (let i = 9; i < 15; i++) setFn(14 - i, 8, getBit(formatBits, i));
    // 第二份：右上 + 左下
    for (let i = 0; i < 8; i++) setFn(size - 1 - i, 8, getBit(formatBits, i));
    for (let i = 8; i < 15; i++) setFn(8, size - 15 + i, getBit(formatBits, i));
    setFn(8, size - 8, true); // 固定黑點
  };

  // — 版本資訊（version ≥ 7）—
  const drawVersionInfo = () => {
    if (version < 7) return;
    let rem = version;
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
    const versionBits = (version << 12) | rem;
    for (let i = 0; i < 18; i++) {
      const bit = getBit(versionBits, i);
      const a = size - 11 + i % 3;
      const b = Math.floor(i / 3);
      setFn(a, b, bit);
      setFn(b, a, bit);
    }
  };

  drawFormatBits(0);
  drawVersionInfo();

  // — 鋪資料碼字（從右下沿 Z 字往上）—
  let bitIdx = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5; // 跳過計時圖樣那一欄
    for (let vert = 0; vert < size; vert++) {
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        const upward = ((right + 1) & 2) === 0;
        const y = upward ? size - 1 - vert : vert;
        if (!isFunction[y][x] && bitIdx < allCodewords.length * 8) {
          modules[y][x] = getBit(allCodewords[bitIdx >>> 3], 7 - (bitIdx & 7));
          bitIdx++;
        }
      }
    }
  }

  // — 遮罩公式 —
  const maskCondition = (mask, x, y) => {
    switch (mask) {
      case 0: return (x + y) % 2 === 0;
      case 1: return y % 2 === 0;
      case 2: return x % 3 === 0;
      case 3: return (x + y) % 3 === 0;
      case 4: return (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0;
      case 5: return (x * y) % 2 + (x * y) % 3 === 0;
      case 6: return ((x * y) % 2 + (x * y) % 3) % 2 === 0;
      case 7: return ((x + y) % 2 + (x * y) % 3) % 2 === 0;
      default: return false;
    }
  };
  const applyMask = (mask) => {
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (!isFunction[y][x] && maskCondition(mask, x, y)) modules[y][x] = !modules[y][x];
      }
    }
  };

  // — 罰分（用於挑選最不易誤判的遮罩）—
  const penaltyScore = () => {
    let result = 0;
    const addHistory = (run, hist) => {
      if (hist[0] === 0) run += size; // 起始 run 補上淺色邊
      hist.pop();
      hist.unshift(run);
    };
    const countPatterns = (hist) => {
      const n = hist[1];
      const core = n > 0 && hist[2] === n && hist[3] === n * 3 && hist[4] === n && hist[5] === n;
      return (core && hist[0] >= n * 4 && hist[6] >= n ? 1 : 0)
        + (core && hist[6] >= n * 4 && hist[0] >= n ? 1 : 0);
    };
    const terminateAndCount = (runColor, runLen, hist) => {
      if (runColor) { addHistory(runLen, hist); runLen = 0; }
      runLen += size; // 末端淺色邊
      addHistory(runLen, hist);
      return countPatterns(hist);
    };

    // 規則一＋三：列方向連續同色 + 類定位圖樣
    for (let y = 0; y < size; y++) {
      let runColor = false; let runLen = 0;
      const hist = [0, 0, 0, 0, 0, 0, 0];
      for (let x = 0; x < size; x++) {
        if (modules[y][x] === runColor) {
          runLen++;
          if (runLen === 5) result += 3; else if (runLen > 5) result++;
        } else {
          addHistory(runLen, hist);
          if (!runColor) result += countPatterns(hist) * 40;
          runColor = modules[y][x]; runLen = 1;
        }
      }
      result += terminateAndCount(runColor, runLen, hist) * 40;
    }
    // 欄方向
    for (let x = 0; x < size; x++) {
      let runColor = false; let runLen = 0;
      const hist = [0, 0, 0, 0, 0, 0, 0];
      for (let y = 0; y < size; y++) {
        if (modules[y][x] === runColor) {
          runLen++;
          if (runLen === 5) result += 3; else if (runLen > 5) result++;
        } else {
          addHistory(runLen, hist);
          if (!runColor) result += countPatterns(hist) * 40;
          runColor = modules[y][x]; runLen = 1;
        }
      }
      result += terminateAndCount(runColor, runLen, hist) * 40;
    }
    // 規則二：2×2 同色塊
    for (let y = 0; y < size - 1; y++) {
      for (let x = 0; x < size - 1; x++) {
        const c = modules[y][x];
        if (c === modules[y][x + 1] && c === modules[y + 1][x] && c === modules[y + 1][x + 1]) result += 3;
      }
    }
    // 規則四：黑白比例平衡
    let dark = 0;
    for (const row of modules) for (const c of row) if (c) dark++;
    const total = size * size;
    const k = Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1;
    result += k * 10;
    return result;
  };

  // — 試遍 8 種遮罩，挑罰分最低者 —
  let bestMask = 0;
  let minPenalty = Infinity;
  for (let m = 0; m < 8; m++) {
    applyMask(m);
    drawFormatBits(m);
    const p = penaltyScore();
    if (p < minPenalty) { minPenalty = p; bestMask = m; }
    applyMask(m); // 還原（再 XOR 一次）
  }
  applyMask(bestMask);
  drawFormatBits(bestMask);

  return modules;
}
