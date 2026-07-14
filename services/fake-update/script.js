import { track } from '../../shared/scripts/shared.js?v=202607140956';

// ── 狀態 ──────────────────────────────────────────
let selectedOS = 'mac';
let overlay = null;
let progressInterval = null;
let timeoutIds = [];

// ── OS 選擇卡片 ───────────────────────────────────
document.querySelectorAll('.os-card').forEach(card => {
  card.addEventListener('click', () => {
    document.querySelectorAll('.os-card').forEach(c => {
      c.classList.remove('is-selected');
      c.setAttribute('aria-pressed', 'false');
    });
    card.classList.add('is-selected');
    card.setAttribute('aria-pressed', 'true');
    selectedOS = card.dataset.os;
  });
});

// ── 啟動按鈕 ─────────────────────────────────────
document.getElementById('launch-btn').addEventListener('click', () => {
  track('use');
  launchFakeUpdate(selectedOS);
});

// ── 建立並顯示全螢幕覆蓋層 ───────────────────────
function launchFakeUpdate(os) {
  overlay = document.createElement('div');
  overlay.className = `fuo-overlay ${os}-mode`;
  overlay.id = 'fuo-overlay';
  overlay.innerHTML = buildOverlayHTML(os);
  document.body.appendChild(overlay);

  // 嘗試進入全螢幕
  document.documentElement.requestFullscreen?.().catch(() => {});

  // ESC 提示 3 秒後淡出
  const hint = overlay.querySelector('.fuo-esc-hint');
  const hintTimer = setTimeout(() => hint?.classList.add('is-hidden'), 3000);
  timeoutIds.push(hintTimer);

  // 開始進度動畫
  if (os === 'mac') startMacProgress();
  else startWinProgress();

  // 監聽 ESC 鍵
  document.addEventListener('keydown', handleKeydown);

  // 全螢幕意外退出時也關閉 overlay
  document.addEventListener('fullscreenchange', handleFullscreenChange);

  // 手機：點擊任意處關閉
  overlay.addEventListener('click', closeOverlay, { once: true });
}

// ── 關閉 overlay ─────────────────────────────────
function closeOverlay() {
  if (!overlay) return;

  clearInterval(progressInterval);
  progressInterval = null;
  timeoutIds.forEach(id => clearTimeout(id));
  timeoutIds = [];

  document.removeEventListener('keydown', handleKeydown);
  document.removeEventListener('fullscreenchange', handleFullscreenChange);

  overlay.remove();
  overlay = null;

  if (document.fullscreenElement) {
    document.exitFullscreen?.();
  }
}

function handleKeydown(e) {
  if (e.key === 'Escape') closeOverlay();
}

function handleFullscreenChange() {
  // 使用者透過瀏覽器 UI（F11/ESC）退出全螢幕，同步關閉 overlay
  if (!document.fullscreenElement && overlay) closeOverlay();
}

// ── 建立 overlay HTML ─────────────────────────────
function buildOverlayHTML(os) {
  const escHint = `<div class="fuo-esc-hint">點擊畫面或按 ESC 離開</div>`;

  if (os === 'mac') {
    return `
      ${escHint}
      <div class="fuo-mac">
        <svg class="fuo-apple-logo" viewBox="0 0 814 1000" fill="currentColor" aria-hidden="true">
          <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76.5 0-103.7 40.8-165.9 40.8s-105-37.5-155.5-127.4C46 790.9 0 663.1 0 541.8c0-207.4 135.4-316.8 268.7-316.8 70.1 0 128.4 46.4 172.5 46.4 42.8 0 109.2-49 191.5-49 30.8 0 133.9 2.6 198.2 100.3zm-234-181.5c31.1-36.9 53.1-88.1 53.1-139.3 0-7.1-.6-14.3-1.9-20.1-50.6 1.9-110.8 33.7-147.1 75.8-28.5 32.4-55.1 83.6-55.1 135.5 0 7.8 1.3 15.6 1.9 18.1 3.2.6 8.4 1.3 13.6 1.3 45.4 0 102.5-30.4 135.5-71.3z"/>
        </svg>
        <span class="fuo-mac-os-name">macOS Sequoia</span>
        <span class="fuo-mac-status">正在安裝更新...</span>
        <div class="fuo-mac-bar-track">
          <div class="fuo-mac-bar-fill" id="fuo-mac-bar"></div>
        </div>
        <span class="fuo-mac-time" id="fuo-mac-time">剩餘時間：計算中...</span>
        <div class="fuo-mac-footer">
          <span class="fuo-mac-note">更新完成後，您的 Mac 將會重新啟動。</span>
          <span class="fuo-mac-copyright">Copyright © 2024 Apple Inc. 版權所有。</span>
        </div>
      </div>
      <div class="fuo-win" style="display:none"></div>
    `;
  }

  return `
    ${escHint}
    <div class="fuo-mac" style="display:none"></div>
    <div class="fuo-win">
      <svg class="fuo-win-logo" viewBox="0 0 100 100" fill="none" aria-hidden="true">
        <rect x="0"  y="0"  width="46" height="46" fill="#f25022" rx="2"/>
        <rect x="54" y="0"  width="46" height="46" fill="#7fba00" rx="2"/>
        <rect x="0"  y="54" width="46" height="46" fill="#00a4ef" rx="2"/>
        <rect x="54" y="54" width="46" height="46" fill="#ffb900" rx="2"/>
      </svg>
      <span class="fuo-win-percent" id="fuo-win-percent">0%</span>
      <span class="fuo-win-title">Working on updates</span>
      <span class="fuo-win-sub">正在更新，請稍候...</span>
      <div class="fuo-win-dots">
        <div class="fuo-win-dot"></div>
        <div class="fuo-win-dot"></div>
        <div class="fuo-win-dot"></div>
        <div class="fuo-win-dot"></div>
        <div class="fuo-win-dot"></div>
      </div>
      <div class="fuo-win-footer">
        <div class="fuo-win-note">請保持電腦電源開啟。Don't turn off your PC.</div>
      </div>
    </div>
  `;
}

// ── macOS 進度模擬 ────────────────────────────────
// 總時長約 13 分鐘，分三段並在 28%、77% 設暫停點
function startMacProgress() {
  const bar = overlay.querySelector('#fuo-mac-bar');
  const timeEl = overlay.querySelector('#fuo-mac-time');
  if (!bar || !timeEl) return;

  // 各段：[目標%, 推進速度 % per sec]，速度會隨機抖動
  const stages = [
    { target: 28,  rate: 0.55 },  // 快速起跑
    { target: 28,  rate: 0,    pause: 22 }, // 28% 暫停 22 秒
    { target: 77,  rate: 0.18 },  // 緩慢推進
    { target: 77,  rate: 0,    pause: 38 }, // 77% 長暫停
    { target: 99,  rate: 0.10 },  // 收尾，極慢
  ];

  let progress = 0;
  let stageIdx = 0;
  let pauseRemaining = 0;
  let pauseActive = false;

  // 總剩餘時間估算（秒）
  const totalSec = 780;
  let elapsed = 0;

  progressInterval = setInterval(() => {
    elapsed += 1;

    if (stageIdx >= stages.length) return;

    const stage = stages[stageIdx];

    if (stage.pause && !pauseActive) {
      // 開始暫停
      pauseActive = true;
      pauseRemaining = stage.pause;
    }

    if (pauseActive) {
      pauseRemaining -= 1;
      if (pauseRemaining <= 0) {
        pauseActive = false;
        stageIdx += 1;
      }
      // 暫停中進度不動，只更新時間顯示
      updateMacTime(timeEl, progress, elapsed, totalSec);
      return;
    }

    // 隨機抖動讓進度更自然
    const jitter = (Math.random() * 0.3 - 0.1);
    const delta = Math.max(0, stage.rate + jitter);
    progress = Math.min(stage.target, progress + delta);

    bar.style.width = progress.toFixed(2) + '%';
    updateMacTime(timeEl, progress, elapsed, totalSec);

    if (progress >= stage.target) {
      stageIdx += 1;
    }
  }, 1000);
}

function updateMacTime(el, progress, elapsed, totalSec) {
  if (progress >= 99) {
    el.textContent = '正在完成更新...';
    return;
  }
  // 剩餘秒數估算（根據進度比例）
  const done = progress / 99;
  const remaining = Math.max(10, Math.round(totalSec * (1 - done)));
  const min = Math.floor(remaining / 60);
  const sec = remaining % 60;

  // 偶爾顯示「分 秒」格式，更逼真
  if (min >= 2 || (elapsed % 7 < 4)) {
    el.textContent = min >= 1
      ? `剩餘時間：約 ${min} 分鐘`
      : `剩餘時間：少於 1 分鐘`;
  } else {
    el.textContent = `剩餘時間：約 ${min} 分 ${sec} 秒`;
  }
}

// ── Windows 進度模擬 ──────────────────────────────
// 整數百分比，在 32%、75% 暫停，總時長約 12 分鐘
function startWinProgress() {
  const percentEl = overlay.querySelector('#fuo-win-percent');
  if (!percentEl) return;

  const stages = [
    { target: 32,  rate: 0.45 },
    { target: 32,  rate: 0,   pause: 28 },
    { target: 75,  rate: 0.16 },
    { target: 75,  rate: 0,   pause: 50 },
    { target: 99,  rate: 0.09 },
  ];

  let progress = 0;
  let displayProgress = 0;
  let stageIdx = 0;
  let pauseRemaining = 0;
  let pauseActive = false;

  progressInterval = setInterval(() => {
    if (stageIdx >= stages.length) return;

    const stage = stages[stageIdx];

    if (stage.pause && !pauseActive) {
      pauseActive = true;
      pauseRemaining = stage.pause;
    }

    if (pauseActive) {
      pauseRemaining -= 1;
      if (pauseRemaining <= 0) {
        pauseActive = false;
        stageIdx += 1;
      }
      return;
    }

    const jitter = Math.random() * 0.25;
    const delta = Math.max(0, stage.rate + jitter);
    progress = Math.min(stage.target, progress + delta);

    // Windows 顯示整數，緩慢跳動一格
    const newDisplay = Math.floor(progress);
    if (newDisplay !== displayProgress) {
      displayProgress = newDisplay;
      percentEl.textContent = displayProgress + '%';
    }

    if (progress >= stage.target) {
      stageIdx += 1;
    }
  }, 1000);
}
