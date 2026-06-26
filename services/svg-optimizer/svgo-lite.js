// ============================================================
// 33 SVG 壓縮器 — 自寫 SVGO-lite 優化模組（零相依、維持 CSP script-src 'self'）
// 以瀏覽器原生 DOMParser/XMLSerializer 解析與輸出，逐項套用可開關的優化規則：
//   移除註解、移除 <metadata>、移除空群組、移除編輯器資料（Inkscape/Sodipodi）、
//   數字精度收斂、壓掉標籤間多餘空白。
// 不更動 <title>／<desc>（無障礙資訊保留）與顏色／id 等非幾何屬性。
// ============================================================

// 編輯器專屬命名空間（Inkscape / Sodipodi），這些元素與屬性對最終渲染無作用
const EDITOR_NS = [
  'http://www.inkscape.org/namespaces/inkscape',
  'http://sodipodi.sourceforge.net/DTD/sodipodi-0.0.dtd',
];

// 只對「幾何／數值」屬性做精度收斂，避免動到 #hex 顏色、id、class 等含數字的字串
const NUMERIC_ATTRS = new Set([
  'd', 'points', 'transform', 'viewBox', 'gradientTransform',
  'x', 'y', 'x1', 'y1', 'x2', 'y2', 'dx', 'dy',
  'width', 'height', 'cx', 'cy', 'r', 'rx', 'ry',
  'offset', 'stroke-width', 'stroke-dashoffset', 'stroke-miterlimit',
  'opacity', 'fill-opacity', 'stroke-opacity', 'stop-opacity',
  'font-size', 'letter-spacing', 'word-spacing',
]);

// 比對一段字串裡的數字（含小數、負號、科學記號）
const NUM_RE = /-?\d*\.?\d+(?:e[-+]?\d+)?/gi;

// 把單一數字收斂到指定小數位；整數與已夠短者原樣回傳（toString 自動去尾零）
function roundNum(value, precision) {
  const n = Number(value);
  if (!Number.isFinite(n)) return value;
  const factor = 10 ** precision;
  return String(Math.round(n * factor) / factor);
}

// 收斂屬性值中所有數字，並把連續空白壓成單一空格
function shrinkNumbers(value, precision) {
  return value
    .replace(NUM_RE, (num) => roundNum(num, precision))
    .replace(/\s+/g, ' ')
    .trim();
}

// 判斷一個 <g> 是否「空到可移除」：沒有元素子節點、沒有非空文字、且沒有任何屬性
function isRemovableGroup(el) {
  if (el.attributes.length > 0) return false;
  for (const node of el.childNodes) {
    if (node.nodeType === 1) return false; // 元素子節點
    if (node.nodeType === 3 && node.nodeValue.trim() !== '') return false; // 有意義文字
  }
  return true;
}

// 後序走訪（先處理子節點，子節點清乾淨後才判斷父節點是否變空）
function walk(node, opts) {
  // 先收集子節點快照，因為過程中會增刪
  const children = [...node.childNodes];

  for (const child of children) {
    // 註解節點
    if (child.nodeType === 8) {
      if (opts.removeComments) child.remove();
      continue;
    }

    if (child.nodeType !== 1) continue; // 只處理元素節點，文字節點留待序列化壓白

    // 移除 <metadata>
    if (opts.removeMetadata && child.localName === 'metadata') {
      child.remove();
      continue;
    }

    // 移除編輯器命名空間下的整個元素（如 sodipodi:namedview）
    if (opts.removeEditorData && EDITOR_NS.includes(child.namespaceURI)) {
      child.remove();
      continue;
    }

    // 遞迴處理子層
    walk(child, opts);

    // 屬性層級清理
    cleanAttributes(child, opts);

    // 子層清完後，若 <g> 已變空則移除
    if (opts.removeEmptyGroups && child.localName === 'g' && isRemovableGroup(child)) {
      child.remove();
    }
  }
}

// 逐一檢視元素屬性：移除編輯器屬性、收斂數值
function cleanAttributes(el, opts) {
  for (const attr of [...el.attributes]) {
    // 移除 Inkscape/Sodipodi 命名空間屬性，以及宣告它們的 xmlns:* 與 xml:space
    if (opts.removeEditorData) {
      if (EDITOR_NS.includes(attr.namespaceURI)) { el.removeAttributeNode(attr); continue; }
      if (EDITOR_NS.includes(attr.value) && attr.name.startsWith('xmlns:')) { el.removeAttributeNode(attr); continue; }
      if (attr.name === 'xml:space') { el.removeAttributeNode(attr); continue; }
    }

    // 數值精度收斂
    if (opts.precision != null && NUMERIC_ATTRS.has(attr.localName)) {
      attr.value = shrinkNumbers(attr.value, opts.precision);
    }
  }
}

// 對外主函式：吃 SVG 原始字串與選項，回傳優化後字串；解析失敗丟錯
export function optimizeSvg(source, opts = {}) {
  const options = {
    removeComments: true,
    removeMetadata: true,
    removeEmptyGroups: true,
    removeEditorData: true,
    precision: 2,
    ...opts,
  };

  const doc = new DOMParser().parseFromString(source, 'image/svg+xml');
  if (doc.querySelector('parsererror') || doc.documentElement.localName !== 'svg') {
    throw new Error('不是有效的 SVG');
  }

  walk(doc.documentElement, options);
  // 根 <svg> 自身的屬性也要清（移除 Inkscape/Sodipodi 的 xmlns 宣告、收斂 viewBox 精度）
  cleanAttributes(doc.documentElement, options);

  let out = new XMLSerializer().serializeToString(doc.documentElement);
  // 壓掉標籤之間的縮排空白與換行（不動標籤內文字內容）
  out = out.replace(/>\s+</g, '><').trim();
  return out;
}
