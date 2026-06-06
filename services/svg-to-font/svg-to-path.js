// ============================================================
// 02 SVG 轉 Font — SVG → 字型路徑轉換（純轉換，不依賴 opentype）
// 把一份 SVG 文字轉成 em 空間的繪圖指令（M/L/C/Q/Z）＋字寬，
// 由 script.js 再餵進 opentype.Path 組成字符。
// ============================================================

// 字型度量：1000 em，基線以上 800、以下 200，圖示填滿整個 em 高度
const UPM = 1000;
const ASCENT = 800;
const DESCENT = -200;

// — 對外主函式：SVG 文字 → { commands, advanceWidth } —
// commands 為 em 空間的絕對座標指令；advanceWidth 固定為整個 em（圖示置中）
export function svgToCommands(svgText) {
  const doc = new DOMParser().parseFromString(svgText, 'image/svg+xml');
  const svg = doc.querySelector('svg');
  if (!svg || doc.querySelector('parsererror')) {
    throw new Error('無法解析 SVG');
  }

  const viewBox = readViewBox(svg);

  // 逐個幾何元素：取出區域指令、套上累積 transform，匯入 viewBox 空間
  const selector = 'path, rect, circle, ellipse, line, polyline, polygon';
  let vbCommands = [];
  svg.querySelectorAll(selector).forEach((el) => {
    const local = shapeToCommands(el);
    if (!local.length) return;
    const matrix = accumulatedMatrix(el, svg);
    vbCommands = vbCommands.concat(transformCommands(local, matrix));
  });

  if (!vbCommands.length) throw new Error('SVG 內找不到可用的圖形');

  return { commands: mapToEm(vbCommands, viewBox), advanceWidth: UPM };
}

// ── viewBox 與座標系 ──────────────────────────────────────

// 讀 viewBox；缺則退回 width/height；再缺則預設 24×24
function readViewBox(svg) {
  const vb = svg.getAttribute('viewBox');
  if (vb) {
    const [x, y, w, h] = vb.trim().split(/[\s,]+/).map(Number);
    if (w > 0 && h > 0) return { x, y, w, h };
  }
  const w = parseFloat(svg.getAttribute('width')) || 24;
  const h = parseFloat(svg.getAttribute('height')) || 24;
  return { x: 0, y: 0, w, h };
}

// viewBox 空間 → em 空間：等比縮放填滿 em 高度、水平置中、Y 軸翻轉（SVG y 向下 → 字型 y 向上）
function mapToEm(commands, vb) {
  const scale = UPM / vb.h;
  const xShift = (UPM - vb.w * scale) / 2;
  const fx = (x) => (x - vb.x) * scale + xShift;
  const fy = (y) => ASCENT - (y - vb.y) * scale;
  return commands.map((c) => mapPairs(c, fx, fy));
}

// ── 幾何元素 → 區域指令（區域座標，未套 transform）────────

function shapeToCommands(el) {
  const tag = el.tagName.toLowerCase();
  const num = (name, fallback = 0) => {
    const v = parseFloat(el.getAttribute(name));
    return Number.isFinite(v) ? v : fallback;
  };

  switch (tag) {
    case 'path':
      return parsePathData(el.getAttribute('d') || '');
    case 'rect':
      return rectToCommands(num('x'), num('y'), num('width'), num('height'), num('rx', NaN), num('ry', NaN));
    case 'circle':
      return ellipseToCommands(num('cx'), num('cy'), num('r'), num('r'));
    case 'ellipse':
      return ellipseToCommands(num('cx'), num('cy'), num('rx'), num('ry'));
    case 'line':
      return [cmd('M', num('x1'), num('y1')), cmd('L', num('x2'), num('y2'))];
    case 'polyline':
      return pointsToCommands(el.getAttribute('points'), false);
    case 'polygon':
      return pointsToCommands(el.getAttribute('points'), true);
    default:
      return [];
  }
}

const cmd = (type, ...args) => ({ type, args });

// 圓角矩形（rx/ry 缺一補另一；皆缺則直角）
function rectToCommands(x, y, w, h, rx, ry) {
  if (w <= 0 || h <= 0) return [];
  if (!Number.isFinite(rx) && !Number.isFinite(ry)) { rx = 0; ry = 0; }
  else if (!Number.isFinite(rx)) rx = ry;
  else if (!Number.isFinite(ry)) ry = rx;
  rx = Math.min(rx, w / 2);
  ry = Math.min(ry, h / 2);

  if (rx === 0 && ry === 0) {
    return [cmd('M', x, y), cmd('L', x + w, y), cmd('L', x + w, y + h), cmd('L', x, y + h), cmd('Z')];
  }
  // 圓角以貝茲近似
  const k = 0.5522847498;
  return [
    cmd('M', x + rx, y),
    cmd('L', x + w - rx, y),
    cmd('C', x + w - rx + rx * k, y, x + w, y + ry - ry * k, x + w, y + ry),
    cmd('L', x + w, y + h - ry),
    cmd('C', x + w, y + h - ry + ry * k, x + w - rx + rx * k, y + h, x + w - rx, y + h),
    cmd('L', x + rx, y + h),
    cmd('C', x + rx - rx * k, y + h, x, y + h - ry + ry * k, x, y + h - ry),
    cmd('L', x, y + ry),
    cmd('C', x, y + ry - ry * k, x + rx - rx * k, y, x + rx, y),
    cmd('Z'),
  ];
}

// 橢圓 / 圓：四段貝茲近似
function ellipseToCommands(cx, cy, rx, ry) {
  if (rx <= 0 || ry <= 0) return [];
  const k = 0.5522847498;
  const ox = rx * k;
  const oy = ry * k;
  return [
    cmd('M', cx + rx, cy),
    cmd('C', cx + rx, cy + oy, cx + ox, cy + ry, cx, cy + ry),
    cmd('C', cx - ox, cy + ry, cx - rx, cy + oy, cx - rx, cy),
    cmd('C', cx - rx, cy - oy, cx - ox, cy - ry, cx, cy - ry),
    cmd('C', cx + ox, cy - ry, cx + rx, cy - oy, cx + rx, cy),
    cmd('Z'),
  ];
}

function pointsToCommands(str, close) {
  if (!str) return [];
  const nums = str.trim().split(/[\s,]+/).map(Number).filter(Number.isFinite);
  const out = [];
  for (let i = 0; i + 1 < nums.length; i += 2) {
    out.push(cmd(i === 0 ? 'M' : 'L', nums[i], nums[i + 1]));
  }
  if (close && out.length) out.push(cmd('Z'));
  return out;
}

// ── SVG path "d" 解析 → 絕對 M/L/C/Q/Z ────────────────────

// 各指令的參數個數
const ARGC = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7, Z: 0 };

function parsePathData(d) {
  const tokens = tokenizePath(d);
  const out = [];
  let i = 0;
  // 目前點、子路徑起點、上一條曲線控制點（供 S/T 平滑）
  let cx = 0, cy = 0, sx = 0, sy = 0;
  let prevCtrl = null;   // 上一條三次曲線的第二控制點
  let prevQCtrl = null;  // 上一條二次曲線的控制點
  let prevType = '';

  while (i < tokens.length) {
    let letter = tokens[i];
    if (typeof letter !== 'string') break; // 異常：期待指令字母
    i++;
    const upper = letter.toUpperCase();
    const rel = letter !== upper;
    const n = ARGC[upper];

    // Z 無參數
    if (upper === 'Z') {
      out.push(cmd('Z'));
      cx = sx; cy = sy;
      prevCtrl = prevQCtrl = null;
      prevType = 'Z';
      continue;
    }

    // 同一指令字母後可接續多組參數（隱含重複；M 之後的重複視為 L）
    let first = true;
    while (i + n <= tokens.length && typeof tokens[i] === 'number') {
      const a = tokens.slice(i, i + n);
      i += n;
      let effective = upper;
      if (upper === 'M' && !first) effective = 'L';

      switch (effective) {
        case 'M': {
          cx = rel ? cx + a[0] : a[0];
          cy = rel ? cy + a[1] : a[1];
          sx = cx; sy = cy;
          out.push(cmd('M', cx, cy));
          break;
        }
        case 'L': {
          cx = rel ? cx + a[0] : a[0];
          cy = rel ? cy + a[1] : a[1];
          out.push(cmd('L', cx, cy));
          break;
        }
        case 'H': {
          cx = rel ? cx + a[0] : a[0];
          out.push(cmd('L', cx, cy));
          break;
        }
        case 'V': {
          cy = rel ? cy + a[0] : a[0];
          out.push(cmd('L', cx, cy));
          break;
        }
        case 'C': {
          const c1x = rel ? cx + a[0] : a[0];
          const c1y = rel ? cy + a[1] : a[1];
          const c2x = rel ? cx + a[2] : a[2];
          const c2y = rel ? cy + a[3] : a[3];
          cx = rel ? cx + a[4] : a[4];
          cy = rel ? cy + a[5] : a[5];
          out.push(cmd('C', c1x, c1y, c2x, c2y, cx, cy));
          prevCtrl = [c2x, c2y];
          break;
        }
        case 'S': {
          // 第一控制點為上一條三次曲線第二控制點對目前點的反射
          const r = (prevType === 'C' || prevType === 'S') && prevCtrl
            ? [2 * cx - prevCtrl[0], 2 * cy - prevCtrl[1]]
            : [cx, cy];
          const c2x = rel ? cx + a[0] : a[0];
          const c2y = rel ? cy + a[1] : a[1];
          cx = rel ? cx + a[2] : a[2];
          cy = rel ? cy + a[3] : a[3];
          out.push(cmd('C', r[0], r[1], c2x, c2y, cx, cy));
          prevCtrl = [c2x, c2y];
          break;
        }
        case 'Q': {
          const qx = rel ? cx + a[0] : a[0];
          const qy = rel ? cy + a[1] : a[1];
          cx = rel ? cx + a[2] : a[2];
          cy = rel ? cy + a[3] : a[3];
          out.push(cmd('Q', qx, qy, cx, cy));
          prevQCtrl = [qx, qy];
          break;
        }
        case 'T': {
          const q = (prevType === 'Q' || prevType === 'T') && prevQCtrl
            ? [2 * cx - prevQCtrl[0], 2 * cy - prevQCtrl[1]]
            : [cx, cy];
          cx = rel ? cx + a[0] : a[0];
          cy = rel ? cy + a[1] : a[1];
          out.push(cmd('Q', q[0], q[1], cx, cy));
          prevQCtrl = [q[0], q[1]];
          break;
        }
        case 'A': {
          const rx = a[0], ry = a[1], rot = a[2], large = a[3], sweep = a[4];
          const ex = rel ? cx + a[5] : a[5];
          const ey = rel ? cy + a[6] : a[6];
          arcToCubics(cx, cy, rx, ry, rot, large, sweep, ex, ey).forEach((seg) =>
            out.push(cmd('C', seg[0], seg[1], seg[2], seg[3], seg[4], seg[5]))
          );
          cx = ex; cy = ey;
          break;
        }
        default:
          break;
      }

      // 維護平滑指令所需的「上一條類型」
      if (effective !== 'C' && effective !== 'S') prevCtrl = null;
      if (effective !== 'Q' && effective !== 'T') prevQCtrl = null;
      prevType = effective;
      first = false;
    }
  }
  return out;
}

// 把 d 字串切成指令字母與數字序列
function tokenizePath(d) {
  const re = /([MmLlHhVvCcSsQqTtAaZz])|(-?\d*\.?\d+(?:[eE][-+]?\d+)?)/g;
  const tokens = [];
  let m;
  while ((m = re.exec(d)) !== null) {
    tokens.push(m[1] !== undefined ? m[1] : parseFloat(m[2]));
  }
  return tokens;
}

// 橢圓弧 → 多段三次貝茲（端點參數轉中心參數，標準演算法）
function arcToCubics(x1, y1, rx, ry, phiDeg, large, sweep, x2, y2) {
  if (rx === 0 || ry === 0) return [[x1, y1, x2, y2, x2, y2]]; // 退化成直線
  rx = Math.abs(rx); ry = Math.abs(ry);
  const phi = (phiDeg * Math.PI) / 180;
  const cosP = Math.cos(phi), sinP = Math.sin(phi);

  const dx = (x1 - x2) / 2, dy = (y1 - y2) / 2;
  const x1p = cosP * dx + sinP * dy;
  const y1p = -sinP * dx + cosP * dy;

  // 半徑不足時等比放大
  let lambda = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
  if (lambda > 1) {
    const s = Math.sqrt(lambda);
    rx *= s; ry *= s;
  }

  const sign = large !== sweep ? 1 : -1;
  let num = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p;
  num = Math.max(num, 0);
  const den = rx * rx * y1p * y1p + ry * ry * x1p * x1p;
  const co = sign * Math.sqrt(num / den || 0);
  const cxp = (co * rx * y1p) / ry;
  const cyp = (-co * ry * x1p) / rx;

  const cx = cosP * cxp - sinP * cyp + (x1 + x2) / 2;
  const cy = sinP * cxp + cosP * cyp + (y1 + y2) / 2;

  const angle = (ux, uy, vx, vy) => {
    const dot = ux * vx + uy * vy;
    const len = Math.sqrt((ux * ux + uy * uy) * (vx * vx + vy * vy));
    let a = Math.acos(Math.min(Math.max(dot / len, -1), 1));
    if (ux * vy - uy * vx < 0) a = -a;
    return a;
  };

  const theta1 = angle(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
  let dTheta = angle((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
  if (!sweep && dTheta > 0) dTheta -= 2 * Math.PI;
  if (sweep && dTheta < 0) dTheta += 2 * Math.PI;

  // 每段不超過 90°
  const segs = Math.max(1, Math.ceil(Math.abs(dTheta) / (Math.PI / 2)));
  const delta = dTheta / segs;
  const t = (4 / 3) * Math.tan(delta / 4);
  const out = [];
  let theta = theta1;

  for (let i = 0; i < segs; i++) {
    const cos1 = Math.cos(theta), sin1 = Math.sin(theta);
    const theta2 = theta + delta;
    const cos2 = Math.cos(theta2), sin2 = Math.sin(theta2);

    // 起點（已知）與終點（橢圓上）
    const e1x = cx + rx * cosP * cos1 - ry * sinP * sin1;
    const e1y = cy + rx * sinP * cos1 + ry * cosP * sin1;
    const e2x = cx + rx * cosP * cos2 - ry * sinP * sin2;
    const e2y = cy + rx * sinP * cos2 + ry * cosP * sin2;

    // 切線方向 → 控制點
    const d1x = -rx * cosP * sin1 - ry * sinP * cos1;
    const d1y = -rx * sinP * sin1 + ry * cosP * cos1;
    const d2x = -rx * cosP * sin2 - ry * sinP * cos2;
    const d2y = -rx * sinP * sin2 + ry * cosP * cos2;

    out.push([
      e1x + t * d1x, e1y + t * d1y,
      e2x - t * d2x, e2y - t * d2y,
      e2x, e2y,
    ]);
    theta = theta2;
  }
  return out;
}

// ── transform 矩陣 ───────────────────────────────────────

// 從 svg 根往下累積到 el 的轉換矩陣 [a,b,c,d,e,f]
function accumulatedMatrix(el, root) {
  const chain = [];
  let node = el;
  while (node && node !== root.parentNode) {
    const t = node.getAttribute && node.getAttribute('transform');
    if (t) chain.unshift(t); // 根在前、元素在後
    if (node === root) break;
    node = node.parentNode;
  }
  let m = [1, 0, 0, 1, 0, 0];
  chain.forEach((t) => parseTransform(t).forEach((sub) => { m = multiply(m, sub); }));
  return m;
}

// 兩個 [a,b,c,d,e,f] 矩陣相乘（先套 m2 再套 m1）
function multiply(m1, m2) {
  return [
    m1[0] * m2[0] + m1[2] * m2[1],
    m1[1] * m2[0] + m1[3] * m2[1],
    m1[0] * m2[2] + m1[2] * m2[3],
    m1[1] * m2[2] + m1[3] * m2[3],
    m1[0] * m2[4] + m1[2] * m2[5] + m1[4],
    m1[1] * m2[4] + m1[3] * m2[5] + m1[5],
  ];
}

// 解析 transform 屬性 → 一串矩陣（依出現順序）
function parseTransform(str) {
  const out = [];
  const re = /(matrix|translate|scale|rotate|skewX|skewY)\s*\(([^)]*)\)/g;
  let m;
  while ((m = re.exec(str)) !== null) {
    const fn = m[1];
    const v = m[2].trim().split(/[\s,]+/).map(Number);
    switch (fn) {
      case 'matrix':
        out.push([v[0], v[1], v[2], v[3], v[4], v[5]]);
        break;
      case 'translate':
        out.push([1, 0, 0, 1, v[0] || 0, v[1] || 0]);
        break;
      case 'scale':
        out.push([v[0] || 0, 0, 0, v.length > 1 ? v[1] : v[0], 0, 0]);
        break;
      case 'rotate': {
        const a = ((v[0] || 0) * Math.PI) / 180;
        const cos = Math.cos(a), sin = Math.sin(a);
        if (v.length > 2) {
          // 繞 (cx,cy) 旋轉：T(c) · R · T(-c)
          out.push([1, 0, 0, 1, v[1], v[2]]);
          out.push([cos, sin, -sin, cos, 0, 0]);
          out.push([1, 0, 0, 1, -v[1], -v[2]]);
        } else {
          out.push([cos, sin, -sin, cos, 0, 0]);
        }
        break;
      }
      case 'skewX':
        out.push([1, 0, Math.tan(((v[0] || 0) * Math.PI) / 180), 1, 0, 0]);
        break;
      case 'skewY':
        out.push([1, Math.tan(((v[0] || 0) * Math.PI) / 180), 0, 1, 0, 0]);
        break;
      default:
        break;
    }
  }
  return out;
}

// 以矩陣轉換一組指令的所有座標對
function transformCommands(commands, m) {
  const tx = (x, y) => m[0] * x + m[2] * y + m[4];
  const ty = (x, y) => m[1] * x + m[3] * y + m[5];
  return commands.map((c) => mapPairs(c, null, null, tx, ty));
}

// 把指令內的座標對逐一映射；提供 fx/fy（單變數）或 tx/ty（雙變數）兩種形式
function mapPairs(c, fx, fy, tx, ty) {
  if (c.type === 'Z') return c;
  const args = [];
  for (let i = 0; i < c.args.length; i += 2) {
    const x = c.args[i], y = c.args[i + 1];
    if (tx) { args.push(tx(x, y), ty(x, y)); }
    else { args.push(fx(x), fy(y)); }
  }
  return { type: c.type, args };
}
