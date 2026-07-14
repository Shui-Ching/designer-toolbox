// ============================================================
// 44 佔位圖產生器 — 純運算模組：尺寸 → 版面幾何、自動反色、SVG 序列化
// 不碰 DOM、零 import（沿用 08 qr-code 的 qr-encode.js 風格），
// 供 script.js（畫面互動／canvas 繪製）與單元測試共用
// stamp-version.js 只掃 script.js 內的 import，此檔若引用 shared.js
// 版本號會無法隨部署更新，故 escapeHtml 在此自帶一份，不跨檔 import
// ============================================================

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

// 跳脫 HTML/XML 特殊字元（與 shared.js 的 escapeHtml 邏輯一致）
function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

// — HEX → RGB —
export function hexToRgb(hex) {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(hex).trim());
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

// ============================================================
// WCAG 相對亮度／對比值（沿用 27 對比度檢查器的算法）
// ============================================================
function channelLinear(v) {
  v /= 255;
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance({ r, g, b }) {
  return 0.2126 * channelLinear(r) + 0.7152 * channelLinear(g) + 0.0722 * channelLinear(b);
}

function contrastRatio(c1, c2) {
  const l1 = relativeLuminance(c1);
  const l2 = relativeLuminance(c2);
  const light = Math.max(l1, l2);
  const dark = Math.min(l1, l2);
  return (light + 0.05) / (dark + 0.05);
}

// 依底色自動選文字色：黑（墨黑 $color-ink）／白兩個候選，挑對比值較高者
export function autoTextColor(bgHex) {
  const bg = hexToRgb(bgHex) || { r: 255, g: 255, b: 255 };
  const ink = { r: 28, g: 27, b: 24 };
  const white = { r: 255, g: 255, b: 255 };
  return contrastRatio(bg, ink) >= contrastRatio(bg, white) ? '#1c1b18' : '#ffffff';
}

// 沒有自訂文字時的預設標註：尺寸字樣
export function defaultLabel(width, height) {
  return `${width} × ${height}`;
}

// ============================================================
// 版面幾何：全部依「短邊」等比例推導，兩種樣式共用同一份數值
// ============================================================
export function computeLayout(width, height) {
  const shorter = Math.min(width, height);
  const insetMargin = clamp(shorter * 0.035, 6, 48); // 藍圖邊框與畫布邊緣的留白
  const boxW = width - insetMargin * 2;
  const boxH = height - insetMargin * 2;
  const strokeWidth = clamp(shorter * 0.0025, 1, 5);

  return {
    fontSize: Math.round(clamp(shorter * 0.08, 12, 120)),
    insetMargin,
    strokeWidth,
    // 圖角標記臂長：不超過邊框內盒短邊的 4 成，避免小尺寸時左右／上下標記互撞
    cornerLen: Math.max(2, Math.min(shorter * 0.05, boxW * 0.4, boxH * 0.4, 64)),
    cornerStrokeWidth: strokeWidth * 1.8,
    diagonalOpacity: 0.25,
    borderOpacity: 0.8,
    cornerOpacity: 0.9,
  };
}

// 圖角標記：四角各兩段線（沿邊框內盒兩邊往內延伸，類似觀景窗對焦框）
function cornerMarkLines(x0, y0, x1, y1, len) {
  return [
    [x0, y0, x0 + len, y0], [x0, y0, x0, y0 + len], // 左上
    [x1, y0, x1 - len, y0], [x1, y0, x1, y0 + len], // 右上
    [x0, y1, x0 + len, y1], [x0, y1, x0, y1 - len], // 左下
    [x1, y1, x1 - len, y1], [x1, y1, x1, y1 - len], // 右下
  ];
}

// 組出這次渲染要用的完整規格：canvas 預覽／PNG／SVG 三種輸出共用同一份
export function buildSpec({ width, height, bg, customText, style }) {
  const w = Math.max(1, Math.round(width));
  const h = Math.max(1, Math.round(height));
  const textColor = autoTextColor(bg);
  const label = customText && customText.trim() ? customText.trim() : defaultLabel(w, h);
  return { width: w, height: h, bg, textColor, label, style, layout: computeLayout(w, h) };
}

// ============================================================
// Canvas 繪製（PNG 輸出與畫面預覽共用）
// ============================================================
export function drawToCanvas(ctx, spec) {
  const { width, height, bg, textColor, label, style, layout } = spec;
  const {
    fontSize, insetMargin, strokeWidth, cornerLen, cornerStrokeWidth,
    diagonalOpacity, borderOpacity, cornerOpacity,
  } = layout;

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  if (style === 'blueprint') {
    const x0 = insetMargin, y0 = insetMargin, x1 = width - insetMargin, y1 = height - insetMargin;

    ctx.strokeStyle = textColor;
    ctx.lineWidth = strokeWidth;

    // 邊框
    ctx.globalAlpha = borderOpacity;
    ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);

    // 對角交叉線
    ctx.globalAlpha = diagonalOpacity;
    ctx.beginPath();
    ctx.moveTo(x0, y0); ctx.lineTo(x1, y1);
    ctx.moveTo(x1, y0); ctx.lineTo(x0, y1);
    ctx.stroke();

    // 圖角標記（較粗、較不透明，做視覺重點）
    ctx.globalAlpha = cornerOpacity;
    ctx.lineWidth = cornerStrokeWidth;
    ctx.beginPath();
    cornerMarkLines(x0, y0, x1, y1, cornerLen).forEach(([lx1, ly1, lx2, ly2]) => {
      ctx.moveTo(lx1, ly1);
      ctx.lineTo(lx2, ly2);
    });
    ctx.stroke();

    ctx.globalAlpha = 1;
  }

  ctx.fillStyle = textColor;
  ctx.font = `700 ${fontSize}px Inter, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, width / 2, height / 2);
}

// ============================================================
// SVG 序列化（與 Canvas 繪製用同一份 spec，畫面應完全一致）
// ============================================================
export function buildSvgString(spec) {
  const { width, height, bg, textColor, label, style, layout } = spec;
  const {
    fontSize, insetMargin, strokeWidth, cornerLen, cornerStrokeWidth,
    diagonalOpacity, borderOpacity, cornerOpacity,
  } = layout;

  let extra = '';
  if (style === 'blueprint') {
    const x0 = insetMargin, y0 = insetMargin, x1 = width - insetMargin, y1 = height - insetMargin;
    extra += `<rect x="${x0}" y="${y0}" width="${x1 - x0}" height="${y1 - y0}" fill="none" stroke="${textColor}" stroke-width="${strokeWidth}" opacity="${borderOpacity}"/>`;
    extra += `<line x1="${x0}" y1="${y0}" x2="${x1}" y2="${y1}" stroke="${textColor}" stroke-width="${strokeWidth}" opacity="${diagonalOpacity}"/>`;
    extra += `<line x1="${x1}" y1="${y0}" x2="${x0}" y2="${y1}" stroke="${textColor}" stroke-width="${strokeWidth}" opacity="${diagonalOpacity}"/>`;
    cornerMarkLines(x0, y0, x1, y1, cornerLen).forEach(([lx1, ly1, lx2, ly2]) => {
      extra += `<line x1="${lx1}" y1="${ly1}" x2="${lx2}" y2="${ly2}" stroke="${textColor}" stroke-width="${cornerStrokeWidth}" opacity="${cornerOpacity}"/>`;
    });
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="佔位圖 ${width}×${height}">`
    + `<rect width="${width}" height="${height}" fill="${bg}"/>`
    + extra
    + `<text x="${width / 2}" y="${height / 2}" fill="${textColor}" font-family="Inter, sans-serif" font-weight="700" font-size="${fontSize}" text-anchor="middle" dominant-baseline="central">${escapeHtml(label)}</text>`
    + `</svg>`;
}
