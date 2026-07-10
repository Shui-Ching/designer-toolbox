// ============================================================
// 17 決策轉盤 — Canvas 轉盤 + 選項管理
// ============================================================
import { track, escapeHtml } from '../../shared/scripts/shared.js?v=202607101559';

// 預設選項
const DRINKS_PRESET = ['50嵐', '清心良品', '一芳水果茶', 'CoCo都可', '茶湯會', '迷客夏', '大苑子', '日出茶太'];
const FOOD_PRESET   = ['麥當勞', '肯德基', '摩斯漢堡', '吉野家', '爭鮮', '鬍鬚張', '八方雲集', '池上便當'];

// 轉盤配色：與設計系統呼應的暖色系，最多 12 個不重複
const PALETTE = [
  '#d8442a', // 硃紅
  '#4a7c6f', // 松石綠
  '#e0a92e', // 芥黃
  '#5c7abf', // 靛藍
  '#8c5c40', // 磚棕
  '#5c8c4a', // 橄欖
  '#bf3a6e', // 玫瑰
  '#3a8c8c', // 青
  '#7c5cbf', // 丁香紫
  '#6b8c3a', // 草綠
  '#bf8040', // 琥珀
  '#3a7fbf', // 鋼藍
];

// ============================================================
// 狀態
// ============================================================
let options = [...FOOD_PRESET];
let currentAngle = 0; // 目前轉盤旋轉角度（度）
let isSpinning = false;

// ============================================================
// DOM 參考
// ============================================================
const canvas      = document.getElementById('wheel');
const ctx         = canvas.getContext('2d');
const optionsList = document.getElementById('options-list');
const countEl     = document.getElementById('options-count');
const optionInput = document.getElementById('option-input');
const addBtn      = document.getElementById('add-btn');
const spinBtn     = document.getElementById('spin-btn');
const presetDrinkBtn = document.getElementById('preset-drink-btn');
const presetFoodBtn  = document.getElementById('preset-food-btn');
const clearBtn    = document.getElementById('clear-btn');
const spinResult  = document.getElementById('spin-result');
const resultValue = document.getElementById('result-value');

// ============================================================
// 工具函式
// ============================================================
function getColor(i) {
  return PALETTE[i % PALETTE.length];
}

// 計算旋轉 finalAngle 度後，指針（正上方）對應的選項索引
function getWinnerIndex(finalAngle) {
  const n = options.length;
  const sectorDeg = 360 / n;
  // 指針在頂（0°），wheel 順時針旋轉 angle 後，頂部對應原始位置 = (360 - angle%360)%360
  const normalizedAngle = ((360 - (finalAngle % 360)) % 360 + 360) % 360;
  return Math.floor(normalizedAngle / sectorDeg) % n;
}

// ============================================================
// 繪製轉盤
// ============================================================
function drawWheel(angle) {
  const w  = canvas.width;
  const h  = canvas.height;
  const cx = w / 2;
  const cy = h / 2;
  const r  = cx - 4; // 邊留 4px 給 canvas border

  ctx.clearRect(0, 0, w, h);

  // 空狀態
  if (options.length === 0) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = '#ece7d9';
    ctx.fill();
    ctx.strokeStyle = '#d9d3c3';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#6b665b';
    ctx.font = "16px Inter, 'Noto Sans TC', sans-serif";
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('請先新增選項', cx, cy);
    return;
  }

  const n           = options.length;
  const sectorRad   = (Math.PI * 2) / n;
  const rotationRad = (angle * Math.PI) / 180;

  // 繪製外圈背景（白邊）
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  ctx.lineWidth = 4;
  ctx.stroke();

  for (let i = 0; i < n; i++) {
    const startAngle = rotationRad + i * sectorRad - Math.PI / 2;
    const endAngle   = startAngle + sectorRad;

    // 填色扇形
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, startAngle, endAngle);
    ctx.closePath();
    ctx.fillStyle = getColor(i);
    ctx.fill();

    // 扇形分隔線（淺白）
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // 標籤文字：在扇形中心偏外側
    const midAngle = startAngle + sectorRad / 2;
    const textR    = r * 0.62;
    const tx       = cx + textR * Math.cos(midAngle);
    const ty       = cy + textR * Math.sin(midAngle);
    const fontSize = Math.max(16, Math.min(20, 120 / n));

    ctx.save();
    ctx.translate(tx, ty);
    // 文字轉向：沿半徑方向、向外朝上閱讀
    ctx.rotate(midAngle + Math.PI / 2);
    ctx.fillStyle = '#ffffff';
    ctx.font = `700 ${fontSize}px Inter, 'Noto Sans TC', sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // 超過 8 字截斷
    const label = options[i].length > 8 ? options[i].slice(0, 7) + '…' : options[i];
    ctx.fillText(label, 0, 0);
    ctx.restore();
  }

  // 中心圓蓋（墨黑底，白邊）
  ctx.beginPath();
  ctx.arc(cx, cy, 22, 0, Math.PI * 2);
  ctx.fillStyle = '#1c1b18';
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2.5;
  ctx.stroke();
}

// ============================================================
// 選項清單 UI 同步渲染
// ============================================================
function renderList() {
  optionsList.innerHTML = '';
  options.forEach((opt, i) => {
    const li = document.createElement('li');
    li.className = 'option-item';
    li.innerHTML =
      `<span class="option-color" style="background:${getColor(i)}"></span>` +
      `<span class="option-name">${escapeHtml(opt)}</span>` +
      `<button type="button" class="option-delete" data-index="${i}" aria-label="刪除 ${escapeHtml(opt)}">×</button>`;
    optionsList.appendChild(li);
  });

  countEl.textContent = `${options.length} 個選項`;
  // 少於 2 個選項時不能轉
  spinBtn.disabled = options.length < 2 || isSpinning;
  drawWheel(currentAngle);
}

// ============================================================
// 新增選項
// ============================================================
function addOption() {
  const val = optionInput.value.trim();
  if (!val) return;
  options.push(val);
  optionInput.value = '';
  optionInput.focus();
  renderList();
  spinResult.classList.remove('is-visible');
}

// ============================================================
// 旋轉動畫
// ============================================================
function spin() {
  if (isSpinning || options.length < 2) return;

  isSpinning = true;
  spinBtn.disabled = true;
  spinResult.classList.remove('is-visible');

  // 5–8 圈 + 隨機額外角度，確保落點真正隨機
  const extraRotations = 5 + Math.random() * 3;
  const extraDeg       = Math.random() * 360;
  const targetAngle    = currentAngle + extraRotations * 360 + extraDeg;
  const duration       = 3200 + Math.random() * 800; // 3.2–4 秒

  const startAngle = currentAngle;
  let startTime    = null;

  // 四次方緩出：前段快速、尾段自然減速
  function easeOutQuart(t) {
    return 1 - Math.pow(1 - t, 4);
  }

  function animate(timestamp) {
    if (!startTime) startTime = timestamp;
    const elapsed = timestamp - startTime;
    const t       = Math.min(elapsed / duration, 1);

    currentAngle = startAngle + (targetAngle - startAngle) * easeOutQuart(t);
    drawWheel(currentAngle);

    if (t < 1) {
      requestAnimationFrame(animate);
    } else {
      currentAngle = targetAngle % 360; // 保持角度在 0–360 範圍
      drawWheel(currentAngle);
      showResult(targetAngle);
      isSpinning = false;
      spinBtn.disabled = false;
    }
  }

  requestAnimationFrame(animate);
}

// ============================================================
// 顯示結果
// ============================================================
function showResult(finalAngle) {
  const idx   = getWinnerIndex(finalAngle);
  const color = getColor(idx);

  resultValue.textContent = options[idx];
  resultValue.style.color = color;

  // 短暫延遲再浮出，讓轉盤停止後有節奏感
  setTimeout(() => {
    spinResult.classList.add('is-visible');
  }, 120);

  track('use');
}

// ============================================================
// 事件綁定
// ============================================================
addBtn.addEventListener('click', addOption);

optionInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') addOption();
});

spinBtn.addEventListener('click', spin);

function loadPreset(preset) {
  options = [...preset];
  currentAngle = 0;
  renderList();
  spinResult.classList.remove('is-visible');
}

presetDrinkBtn.addEventListener('click', () => loadPreset(DRINKS_PRESET));
presetFoodBtn.addEventListener('click',  () => loadPreset(FOOD_PRESET));
clearBtn.addEventListener('click', () => {
  options = [];
  currentAngle = 0;
  renderList();
  spinResult.classList.remove('is-visible');
});

// 點刪除按鈕：事件代理
optionsList.addEventListener('click', (e) => {
  const btn = e.target.closest('.option-delete');
  if (!btn) return;
  const idx = Number(btn.dataset.index);
  options.splice(idx, 1);
  renderList();
  spinResult.classList.remove('is-visible');
});

// ============================================================
// 初始渲染
// ============================================================
renderList();
