import { track } from '../../shared/scripts/shared.js?v=202607101559';

// ── 預設訊息 ──────────────────────────────────────
const PRESETS = ['人不在，開會去', '人不在，廁所去'];

// ── 狀態 ──────────────────────────────────────────
let currentMessage = PRESETS[0];
let selectedPreset = '0';

// ── DOM ──────────────────────────────────────────
const presetBtns   = document.querySelectorAll('.mb-preset-btn');
const customArea   = document.getElementById('mb-custom-area');
const customInput  = document.getElementById('mb-custom-input');
const charCount    = document.getElementById('mb-char-count');
const previewText  = document.getElementById('mb-preview-text');
const launchBtn    = document.getElementById('mb-launch-btn');
const overlay      = document.getElementById('mb-overlay');
const overlayMsg   = document.getElementById('mb-overlay-message');

// ── 預設選擇 ──────────────────────────────────────
presetBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    presetBtns.forEach(b => {
      b.classList.remove('is-selected');
      b.setAttribute('aria-pressed', 'false');
    });
    btn.classList.add('is-selected');
    btn.setAttribute('aria-pressed', 'true');

    selectedPreset = btn.dataset.preset;

    if (selectedPreset === 'custom') {
      customArea.hidden = false;
      customInput.focus();
      currentMessage = customInput.value.trim();
    } else {
      customArea.hidden = true;
      currentMessage = PRESETS[parseInt(selectedPreset, 10)];
    }

    updatePreview();
  });
});

// ── 自訂輸入 ──────────────────────────────────────
customInput.addEventListener('input', () => {
  charCount.textContent = customInput.value.length;
  currentMessage = customInput.value.trim();
  updatePreview();
});

function updatePreview() {
  if (currentMessage) {
    previewText.textContent = currentMessage;
    previewText.classList.remove('is-empty');
    launchBtn.disabled = false;
  } else {
    previewText.textContent = '（請輸入訊息）';
    previewText.classList.add('is-empty');
    launchBtn.disabled = true;
  }
}

// ── 鍵盤鎖 ───────────────────────────────────────
// capture phase 攔截所有按鍵，僅放行 ESC
function handleKeyLock(e) {
  if (e.key === 'Escape') {
    closeOverlay();
    return;
  }
  e.preventDefault();
  e.stopPropagation();
}

// ── 開啟全螢幕留言 ────────────────────────────────
launchBtn.addEventListener('click', () => {
  if (!currentMessage) return;

  overlayMsg.textContent = currentMessage;
  overlay.classList.add('is-visible');
  overlay.setAttribute('aria-hidden', 'false');

  // 進入全螢幕模式
  document.documentElement.requestFullscreen?.().catch(() => {});

  // 鎖定鍵盤（capture phase，最優先攔截）
  document.addEventListener('keydown', handleKeyLock, true);

  // 全螢幕意外退出時同步關閉 overlay
  document.addEventListener('fullscreenchange', handleFullscreenChange);

  // 手機：點擊任意處關閉
  overlay.addEventListener('click', closeOverlay, { once: true });

  track('use');
});

// ── 關閉全螢幕留言 ────────────────────────────────
function closeOverlay() {
  overlay.classList.remove('is-visible');
  overlay.setAttribute('aria-hidden', 'true');

  document.removeEventListener('keydown', handleKeyLock, true);
  document.removeEventListener('fullscreenchange', handleFullscreenChange);
  overlay.removeEventListener('click', closeOverlay);

  if (document.fullscreenElement) {
    document.exitFullscreen?.();
  }
}

function handleFullscreenChange() {
  if (!document.fullscreenElement) closeOverlay();
}
