import { copyText, track } from '../../shared/scripts/shared.js?v=202607172333';

// ——————————————————————————————————————————
// 狀態（px 為單位）
// ——————————————————————————————————————————
const state = {
  wMin: 320,   // 最小螢幕寬度
  wMax: 1440,  // 最大螢幕寬度
  sMin: 16,    // 最小字級
  sMax: 20,    // 最大字級
  base: 16,    // 根字級（用於 px → rem 換算）
};

// ——————————————————————————————————————————
// 快速預設
// ——————————————————————————————————————————
const PRESETS = {
  sm:      { wMin: 320, wMax: 1440, sMin: 12, sMax: 14 },
  body:    { wMin: 320, wMax: 1440, sMin: 16, sMax: 20 },
  h3:      { wMin: 320, wMax: 1440, sMin: 20, sMax: 28 },
  h2:      { wMin: 320, wMax: 1440, sMin: 24, sMax: 40 },
  h1:      { wMin: 320, wMax: 1440, sMin: 32, sMax: 56 },
  display: { wMin: 320, wMax: 1440, sMin: 48, sMax: 96 },
};

// ——————————————————————————————————————————
// 計算核心
// clamp(sMin, slope*100vw + interceptRem, sMax)
// ——————————————————————————————————————————
function compute() {
  const { wMin, wMax, sMin, sMax, base } = state;
  // 每 1px 螢幕寬度對應幾 px 字級變化
  const slope = (sMax - sMin) / (wMax - wMin);
  // 截距（px 單位）
  const intercept = sMin - slope * wMin;
  return {
    slope,
    intercept,
    slopeVw:      slope * 100,         // 轉成 vw 係數（1vw = viewport/100）
    interceptRem: intercept / base,    // 截距轉 rem
    sMinRem:      sMin / base,
    sMaxRem:      sMax / base,
  };
}

// 去尾零，最多 d 位小數
function fmt(n, d = 4) {
  return parseFloat(n.toFixed(d)).toString();
}

// ——————————————————————————————————————————
// CSS 輸出
// font-size: clamp(min, slope vw + intercept rem, max);
// ——————————————————————————————————————————
function buildCSS(r) {
  const minStr  = `${fmt(r.sMinRem)}rem`;
  const maxStr  = `${fmt(r.sMaxRem)}rem`;
  // 截距正負決定 + / - 符號
  const prefStr = r.interceptRem >= 0
    ? `${fmt(r.slopeVw)}vw + ${fmt(r.interceptRem)}rem`
    : `${fmt(r.slopeVw)}vw - ${fmt(Math.abs(r.interceptRem))}rem`;
  return `font-size: clamp(${minStr}, ${prefStr}, ${maxStr});`;
}

// ——————————————————————————————————————————
// SCSS 輸出（附變數與用法範例）
// ——————————————————————————————————————————
function buildSCSS(r) {
  const { wMin, wMax, sMin, sMax, base } = state;
  const sign   = r.interceptRem >= 0 ? '+' : '-';
  const absInt = fmt(Math.abs(r.interceptRem));
  return `// Viewport ${wMin}px → ${wMax}px  |  Font ${sMin}px → ${sMax}px  (base ${base}px)
$fs-fluid-min:  ${fmt(r.sMinRem)}rem;   // ${sMin}px
$fs-fluid-max:  ${fmt(r.sMaxRem)}rem;   // ${sMax}px

.element {
  font-size: clamp($fs-fluid-min, ${fmt(r.slopeVw)}vw ${sign} ${absInt}rem, $fs-fluid-max);
}`;
}

// ——————————————————————————————————————————
// SVG 圖表
// ——————————————————————————————————————————
const VB_W = 500, VB_H = 260;
const PAD  = { t: 24, r: 20, b: 48, l: 54 };
const CW   = VB_W - PAD.l - PAD.r;  // 圖表寬度
const CH   = VB_H - PAD.t - PAD.b;  // 圖表高度

function drawChart() {
  const svg = document.getElementById('clamp-chart');
  const { wMin, wMax, sMin, sMax } = state;
  const r = compute();

  // X / Y 定義域：各向外展開 25% / 35% 以顯示平坦段
  const wSpan = wMax - wMin;
  const sSpan = (sMax - sMin) || 1;
  const xD = [Math.max(0, wMin - wSpan * 0.25), wMax + wSpan * 0.25];
  const yD = [Math.max(0, sMin - sSpan * 0.35), sMax + sSpan * 0.35];

  // 座標映射
  const toX = w => PAD.l + ((w - xD[0]) / (xD[1] - xD[0])) * CW;
  const toY = s => PAD.t + CH - ((s - yD[0]) / (yD[1] - yD[0])) * CH;

  // clamp 函式（任意 viewport 寬度 → 字級）
  const clampVal = w => Math.min(sMax, Math.max(sMin, r.slope * w + r.intercept));

  // 取 80 個點描繪折線路徑
  const N   = 80;
  const pts = [];
  for (let i = 0; i <= N; i++) {
    const w = xD[0] + (i / N) * (xD[1] - xD[0]);
    pts.push(`${toX(w).toFixed(1)},${toY(clampVal(w)).toFixed(1)}`);
  }
  const pathD = `M${pts.join(' L')}`;

  // 從 CSS 變數取色（無硬編碼顏色）
  const cs       = getComputedStyle(document.documentElement);
  const accent   = cs.getPropertyValue('--color-accent').trim();
  const ink      = cs.getPropertyValue('--color-ink').trim();
  const inkSoft  = cs.getPropertyValue('--color-ink-soft').trim();
  const lineClr  = cs.getPropertyValue('--color-line').trim();

  // 轉折點（clamp 啟動 / 結束位置）
  const x1 = toX(wMin).toFixed(1), y1 = toY(sMin).toFixed(1);
  const x2 = toX(wMax).toFixed(1), y2 = toY(sMax).toFixed(1);

  // Y 軸格線（sMin、中點、sMax）
  const yTicks = [sMin, (sMin + sMax) / 2, sMax];
  const yLines = yTicks.map(s =>
    `<line x1="${PAD.l}" y1="${toY(s).toFixed(1)}" x2="${PAD.l + CW}" y2="${toY(s).toFixed(1)}" stroke="${lineClr}" stroke-width="1"/>`
  ).join('');

  // 中間值 Y 格線標籤（只在 sSpan 夠大才顯示避免重疊）
  const midLabel = sSpan > 4
    ? `<text x="${PAD.l - 8}" y="${(toY((sMin + sMax) / 2) + 4).toFixed(1)}" text-anchor="end" font-size="10" fill="${inkSoft}" font-family="Inter, sans-serif" opacity="0.7">${fmt((sMin + sMax) / 2, 1)}</text>`
    : '';

  svg.innerHTML = `
    <!-- Y 格線 -->
    ${yLines}

    <!-- 轉折點垂直虛線 -->
    <line x1="${x1}" y1="${PAD.t}" x2="${x1}" y2="${PAD.t + CH}"
          stroke="${inkSoft}" stroke-width="1" stroke-dasharray="4 3" opacity="0.6"/>
    <line x1="${x2}" y1="${PAD.t}" x2="${x2}" y2="${PAD.t + CH}"
          stroke="${inkSoft}" stroke-width="1" stroke-dasharray="4 3" opacity="0.6"/>

    <!-- clamp 曲線（折線：平-斜-平）-->
    <path d="${pathD}" fill="none" stroke="${accent}" stroke-width="2.5"
          stroke-linecap="round" stroke-linejoin="round"/>

    <!-- 轉折端點 -->
    <circle cx="${x1}" cy="${y1}" r="5" fill="${accent}"/>
    <circle cx="${x2}" cy="${y2}" r="5" fill="${accent}"/>

    <!-- X 軸 -->
    <line x1="${PAD.l}" y1="${PAD.t + CH}" x2="${PAD.l + CW}" y2="${PAD.t + CH}"
          stroke="${ink}" stroke-width="1.5"/>
    <!-- Y 軸 -->
    <line x1="${PAD.l}" y1="${PAD.t}" x2="${PAD.l}" y2="${PAD.t + CH}"
          stroke="${ink}" stroke-width="1.5"/>

    <!-- X 軸刻度與標籤（wMin / wMax）-->
    <line x1="${x1}" y1="${PAD.t + CH}" x2="${x1}" y2="${PAD.t + CH + 5}" stroke="${ink}" stroke-width="1"/>
    <line x1="${x2}" y1="${PAD.t + CH}" x2="${x2}" y2="${PAD.t + CH + 5}" stroke="${ink}" stroke-width="1"/>
    <text x="${x1}" y="${PAD.t + CH + 18}" text-anchor="middle"
          font-size="11" fill="${ink}" font-family="Inter, sans-serif">${wMin}</text>
    <text x="${x2}" y="${PAD.t + CH + 18}" text-anchor="middle"
          font-size="11" fill="${ink}" font-family="Inter, sans-serif">${wMax}</text>
    <text x="${PAD.l + CW}" y="${PAD.t + CH + 38}" text-anchor="end"
          font-size="10" fill="${inkSoft}" font-family="Inter, sans-serif">viewport width (px)</text>

    <!-- Y 軸刻度與標籤（sMin / sMax）-->
    <text x="${PAD.l - 8}" y="${(+y1 + 4).toFixed(1)}" text-anchor="end"
          font-size="11" fill="${ink}" font-family="Inter, sans-serif">${sMin}</text>
    <text x="${PAD.l - 8}" y="${(+y2 + 4).toFixed(1)}" text-anchor="end"
          font-size="11" fill="${ink}" font-family="Inter, sans-serif">${sMax}</text>
    ${midLabel}
    <text x="${PAD.l - 44}" y="${(PAD.t + CH / 2).toFixed(1)}"
          text-anchor="middle" font-size="10" fill="${inkSoft}" font-family="Inter, sans-serif"
          transform="rotate(-90 ${PAD.l - 44} ${(PAD.t + CH / 2).toFixed(1)})">font-size (px)</text>

    <!-- 轉折點旁的 min / max 標籤 -->
    <text x="${(+x1 - 8).toFixed(1)}" y="${(+y1 - 9).toFixed(1)}" text-anchor="end"
          font-size="10" fill="${accent}" font-family="Inter, sans-serif">min ${sMin}px</text>
    <text x="${(+x2 + 8).toFixed(1)}" y="${(+y2 - 9).toFixed(1)}" text-anchor="start"
          font-size="10" fill="${accent}" font-family="Inter, sans-serif">max ${sMax}px</text>
  `;
}

// ——————————————————————————————————————————
// 即時預覽：以當前視窗寬度算出字級並套用
// ——————————————————————————————————————————
function updatePreview(r) {
  const vw   = window.innerWidth;
  const live = Math.min(state.sMax, Math.max(state.sMin, r.slope * vw + r.intercept));
  document.getElementById('preview-text').style.fontSize = `${live.toFixed(1)}px`;
  document.getElementById('live-w').textContent    = vw;
  document.getElementById('live-size').textContent = live.toFixed(1);
}

// ——————————————————————————————————————————
// 主更新函式：驗證 → 計算 → 更新所有輸出
// ——————————————————————————————————————————
function update() {
  const { wMin, wMax, sMin, sMax } = state;
  const isValid = wMin > 0 && wMax > wMin && sMin > 0 && sMax > sMin;

  if (!isValid) {
    const errMsg = '— 請確認最大值大於最小值';
    document.getElementById('code-css').textContent  = errMsg;
    document.getElementById('code-scss').textContent = errMsg;
    document.getElementById('val-slope').textContent     = '—';
    document.getElementById('val-intercept').textContent = '—';
    return;
  }

  const r = compute();

  // 摘要
  document.getElementById('val-slope').textContent     = `${fmt(r.slopeVw)}vw`;
  document.getElementById('val-intercept').textContent = `${fmt(r.interceptRem)}rem`;

  // 程式碼輸出
  document.getElementById('code-css').textContent  = buildCSS(r);
  document.getElementById('code-scss').textContent = buildSCSS(r);

  // 預覽文字字級
  updatePreview(r);

  // SVG 圖表
  drawChart();
}

// ——————————————————————————————————————————
// 綁定數字輸入框
// ——————————————————————————————————————————
function bindInputs() {
  const numMap = {
    'w-min': 'wMin',
    'w-max': 'wMax',
    's-min': 'sMin',
    's-max': 'sMax',
  };

  Object.entries(numMap).forEach(([id, key]) => {
    document.getElementById(id).addEventListener('input', (e) => {
      const v = parseFloat(e.target.value);
      if (!isNaN(v)) {
        state[key] = v;
        update();
      }
    });
  });

  // 根字級滑桿
  const baseEl = document.getElementById('base-size');
  baseEl.addEventListener('input', () => {
    state.base = parseInt(baseEl.value, 10);
    document.getElementById('base-display').textContent = `${state.base}px`;
    update();
  });
}

// ——————————————————————————————————————————
// 套用預設
// ——————————————————————————————————————————
function applyPreset(key) {
  const p = PRESETS[key];
  if (!p) return;
  Object.assign(state, p);
  // 同步回 input 欄位
  document.getElementById('w-min').value = state.wMin;
  document.getElementById('w-max').value = state.wMax;
  document.getElementById('s-min').value = state.sMin;
  document.getElementById('s-max').value = state.sMax;
  highlightPreset(key);
  update();
}

function highlightPreset(key) {
  document.querySelectorAll('#preset-group .chip').forEach(btn =>
    btn.classList.toggle('is-active', btn.dataset.preset === key)
  );
}

// ——————————————————————————————————————————
// 複製按鈕
// ——————————————————————————————————————————
function bindCopy(btnId, codeId, hintId) {
  document.getElementById(btnId).addEventListener('click', async () => {
    const text = document.getElementById(codeId).textContent;
    const ok   = await copyText(text);
    const hint = document.getElementById(hintId);
    hint.textContent = ok ? '已複製！' : '複製失敗，請手動選取';
    if (ok) track('use');
    setTimeout(() => { hint.textContent = ''; }, 1800);
  });
}

// ——————————————————————————————————————————
// 初始化
// ——————————————————————————————————————————
document.querySelectorAll('#preset-group .chip').forEach(btn =>
  btn.addEventListener('click', () => applyPreset(btn.dataset.preset))
);
bindInputs();
bindCopy('copy-css',  'code-css',  'hint-css');
bindCopy('copy-scss', 'code-scss', 'hint-scss');
// 視窗 resize 時重算即時預覽字級
window.addEventListener('resize', update, { passive: true });
update();
