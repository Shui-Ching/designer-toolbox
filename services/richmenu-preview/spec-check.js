// ============================================================
// 07 LINE Rich Menu 預覽模擬器 — 規格驗證純運算（零 DOM 依賴，供瀏覽器與 Node 測試共用）
// ============================================================

// 圖片格式是否為 LINE 允許的 JPEG／PNG
export function checkFormat(mimeType, specs) {
  return specs.allowedMimeTypes.includes(mimeType);
}

// 檔案大小是否在 1MB 限制內
export function checkFileSize(bytes, specs) {
  return bytes <= specs.maxFileSizeBytes;
}

// large／compact 兩種官方尺寸的高寬比分別落在 0.674 與 0.337 附近，兩者差距大，
// 取中間值 0.5 當門檻即可穩定分類，即使是非官方自訂尺寸也能推斷設計意圖的類別
export function detectCategory(width, height) {
  return height / width > 0.5 ? 'large' : 'compact';
}

// 是否精確符合官方 6 組預設尺寸之一
export function matchOfficialSize(width, height, specs) {
  return specs.officialSizes.find((s) => s.width === width && s.height === height) || null;
}

// 非官方預設尺寸時，是否仍落在 LINE 允許的自訂尺寸範圍內
export function checkDimensionRange(width, height, specs) {
  const { widthMin, widthMax, heightMin, aspectRatioMin } = specs.sizeRule;
  return {
    widthOk: width >= widthMin && width <= widthMax,
    heightOk: height >= heightMin,
    ratioOk: width / height >= aspectRatioMin,
  };
}

// 彙整成單一驗證結果，供畫面直接渲染檢查清單
export function evaluateSpec({ mimeType, bytes, width, height }, specs) {
  const matched = matchOfficialSize(width, height, specs);
  const range = checkDimensionRange(width, height, specs);
  return {
    formatOk: checkFormat(mimeType, specs),
    sizeOk: checkFileSize(bytes, specs),
    matched,
    range,
    dimensionOk: !!matched || (range.widthOk && range.heightOk && range.ratioOk),
    category: detectCategory(width, height),
  };
}
