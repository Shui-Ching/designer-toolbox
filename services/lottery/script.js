// ============================================================
// 34 抽籤器 — 密碼學等級亂數不重複抽出 + 逐一揭曉動畫
// ============================================================
import { track } from '../../shared/scripts/shared.js?v=202607101402';

// 範例名單
const SAMPLE_NAMES = ['王小明', '陳大文', '林美麗', '張志豪', '李雅婷', '黃建宏', '吳佩珊', '劉俊傑', '蔡依玲', '鄭家豪', '謝宜君', '許文彥'];

// ============================================================
// 狀態
// ============================================================
let allNames  = [];      // 解析後的完整名單（保留重複的同名，以位置區分）
let remaining = [];       // 尚未抽出的名字
let drawnCount = 0;       // 已抽出總數（用於結果排名連號）
let isRevealing = false;  // 揭曉動畫進行中，鎖住按鈕

// ============================================================
// DOM 參考
// ============================================================
const namesInput    = document.getElementById('names-input');
const namesCount     = document.getElementById('names-count');
const drawCountInput = document.getElementById('draw-count');
const drawPool       = document.getElementById('draw-pool');
const sampleBtn      = document.getElementById('sample-btn');
const clearBtn       = document.getElementById('clear-btn');
const drawBtn        = document.getElementById('draw-btn');
const statusEl       = document.getElementById('lottery-status');
const resultGrid     = document.getElementById('result-grid');
const lotteryActions = document.getElementById('lottery-actions');
const resetBtn       = document.getElementById('reset-btn');

// ============================================================
// 亂數：用 crypto.getRandomValues 取均勻整數，拒絕採樣去除模偏差
// ============================================================
function randomInt(max) {
  if (max <= 0) return 0;
  const range = 0x100000000;             // 2^32
  const limit = range - (range % max);   // 超過此界的值丟棄，避免模偏差
  const buf = new Uint32Array(1);
  let x;
  do {
    crypto.getRandomValues(buf);
    x = buf[0];
  } while (x >= limit);
  return x % max;
}

// 從陣列中不重複抽出 n 個（Fisher-Yates 部分洗牌），回傳抽中者並就地移除
function drawFrom(pool, n) {
  const picked = [];
  for (let i = 0; i < n && pool.length > 0; i++) {
    const idx = randomInt(pool.length);
    picked.push(pool[idx]);
    pool.splice(idx, 1);
  }
  return picked;
}

// ============================================================
// 解析名單：逐行 trim、略過空行
// ============================================================
function parseNames() {
  allNames = namesInput.value
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

// 名單變動時：重置抽籤進度與結果
function refreshFromInput() {
  parseNames();
  remaining = [...allNames];
  drawnCount = 0;
  resultGrid.innerHTML = '';
  lotteryActions.hidden = true;
  syncControls();
}

// ============================================================
// 同步控制項狀態（人數上限、可抽人數、按鈕啟用）
// ============================================================
function syncControls() {
  const total = allNames.length;
  const left  = remaining.length;

  namesCount.textContent = `${total} 個名字`;
  drawPool.textContent   = `可抽 ${left} 人`;

  // 抽出人數上限 = 剩餘人數（至少 1）
  drawCountInput.max = Math.max(1, left);
  let want = parseInt(drawCountInput.value, 10);
  if (!Number.isFinite(want) || want < 1) want = 1;
  if (want > left && left > 0) want = left;
  drawCountInput.value = String(want);

  // 沒有名字、剩餘抽完、或正在揭曉時停用主按鈕
  drawBtn.disabled = total === 0 || left === 0 || isRevealing;
  // 抽過至少一輪、還有剩餘時，主按鈕語意改為「繼續抽」
  drawBtn.textContent = drawnCount > 0 && left > 0 ? '繼續抽' : '抽籤';

  if (total === 0) {
    statusEl.textContent = '先貼上名單，再開始抽籤。';
  } else if (left === 0 && drawnCount > 0) {
    statusEl.textContent = '名單已全部抽完，按「重新開始」可再來一輪。';
  } else if (drawnCount > 0) {
    statusEl.textContent = `已抽出 ${drawnCount} 人，剩餘 ${left} 人。`;
  } else {
    statusEl.textContent = `名單共 ${total} 人，準備就緒。`;
  }
}

// ============================================================
// 抽籤：從剩餘名單抽出，結果接在現有揭曉之後（連按即「繼續抽」）
// ============================================================
function draw() {
  if (isRevealing || remaining.length === 0) return;

  let n = parseInt(drawCountInput.value, 10);
  if (!Number.isFinite(n) || n < 1) n = 1;
  n = Math.min(n, remaining.length);

  const winners = drawFrom(remaining, n);
  const rankBase = drawnCount;
  drawnCount += winners.length;

  reveal(winners, rankBase);
}

// ============================================================
// 逐一揭曉：每張卡先輪播名字（拉霸感），再依序鎖定
// ============================================================
function reveal(winners, rankBase) {
  isRevealing = true;
  syncControls();
  lotteryActions.hidden = true;

  // 輪播取樣來源：完整名單，視覺更熱鬧（至少有自己可滾）
  const rollPool = allNames.length ? allNames : winners;
  // 抽得多時縮短每張間隔，避免整體等太久
  const stagger = Math.min(420, Math.max(160, Math.round(2400 / winners.length)));

  const cards = winners.map((name, i) => {
    const card = document.createElement('div');
    card.className = 'result-card is-rolling';
    card.style.setProperty('--i', i);
    card.innerHTML =
      `<span class="result-rank">${rankBase + i + 1}</span>` +
      `<span class="result-name"></span>`;
    resultGrid.appendChild(card);
    return { card, name, nameEl: card.querySelector('.result-name') };
  });

  let locked = 0;
  cards.forEach((c, i) => {
    const lockAt = 650 + i * stagger;
    let rafId;
    let last = 0;

    // 用 rAF 輪播：每 ~55ms 換一個隨機名字
    const roll = (ts) => {
      if (ts - last > 55) {
        c.nameEl.textContent = rollPool[randomInt(rollPool.length)];
        last = ts;
      }
      rafId = requestAnimationFrame(roll);
    };
    rafId = requestAnimationFrame(roll);

    setTimeout(() => {
      cancelAnimationFrame(rafId);
      c.nameEl.textContent = c.name;
      c.card.classList.remove('is-rolling');
      c.card.classList.add('is-locked');

      locked += 1;
      if (locked === cards.length) {
        isRevealing = false;
        lotteryActions.hidden = false;
        syncControls();
        track('use'); // 一輪抽籤完成
      }
    }, lockAt);
  });
}

// ============================================================
// 事件綁定
// ============================================================
namesInput.addEventListener('input', refreshFromInput);

drawCountInput.addEventListener('input', () => {
  // 即時夾住上限，但允許暫時為空讓使用者打字
  if (drawCountInput.value === '') return;
  let v = parseInt(drawCountInput.value, 10);
  const left = remaining.length;
  if (Number.isFinite(v)) {
    if (v < 1) drawCountInput.value = '1';
    else if (left > 0 && v > left) drawCountInput.value = String(left);
  }
});

drawBtn.addEventListener('click', () => draw());

resetBtn.addEventListener('click', () => {
  remaining = [...allNames];
  drawnCount = 0;
  resultGrid.innerHTML = '';
  lotteryActions.hidden = true;
  syncControls();
});

sampleBtn.addEventListener('click', () => {
  namesInput.value = SAMPLE_NAMES.join('\n');
  refreshFromInput();
});

clearBtn.addEventListener('click', () => {
  namesInput.value = '';
  refreshFromInput();
  namesInput.focus();
});

// ============================================================
// 初始
// ============================================================
refreshFromInput();
