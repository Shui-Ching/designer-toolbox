import { track } from '../../shared/scripts/shared.js?v=202606121244';

// ============================================================
// 番茄鐘 — 番茄工作法計時器
// 設定與今日統計存 localStorage；提示音用 Web Audio 即時合成（零外部音檔）
// ============================================================

const BASE_TITLE = document.title;

// ── 設定（含預設值）──────────────────────────────
const DEFAULTS = {
  focus: 25, short: 5, long: 15, interval: 4,
  autostart: true, sound: true, notify: false,
};
const SETTINGS_KEY = 'pomodoro-settings';
const STATS_KEY = 'pomodoro-stats';

function loadSettings() {
  try {
    return { ...DEFAULTS, ...(JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {}) };
  } catch {
    return { ...DEFAULTS };
  }
}
function saveSettings() {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch { /* 隱私模式忽略 */ }
}

// 今日統計：跨日自動歸零；cycle 為當前長休息週期內已完成的專注數
function loadStats() {
  const today = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD
  try {
    const s = JSON.parse(localStorage.getItem(STATS_KEY));
    if (s && s.date === today) return s;
  } catch { /* 解析失敗就重來 */ }
  return { date: today, count: 0, cycle: 0 };
}
function saveStats() {
  try { localStorage.setItem(STATS_KEY, JSON.stringify(stats)); } catch { /* 忽略 */ }
}

const settings = loadSettings();
const stats = loadStats();

// ── 模式 ──────────────────────────────────────────
const MODE_LABEL = { focus: '專注', short: '短休息', long: '長休息' };
const MODE_PHASE = { focus: '專注中', short: '短休息', long: '長休息' };

let mode = 'focus';
let totalMs = settings[mode] * 60000;
let remainingMs = totalMs;
let endAt = 0;
let running = false;
let rafId = null;

// ── DOM ──────────────────────────────────────────
const modeBtns = document.querySelectorAll('.pm-mode');
const ringFill = document.getElementById('pm-ring-fill');
const timeEl = document.getElementById('pm-time');
const phaseEl = document.getElementById('pm-phase');
const startBtn = document.getElementById('pm-start');
const resetBtn = document.getElementById('pm-reset');
const countEl = document.getElementById('pm-count');
const clock = document.getElementById('pm-clock');

const inputs = {
  focus: document.getElementById('pm-focus'),
  short: document.getElementById('pm-short'),
  long: document.getElementById('pm-long'),
  interval: document.getElementById('pm-interval'),
  autostart: document.getElementById('pm-autostart'),
  sound: document.getElementById('pm-sound'),
  notify: document.getElementById('pm-notify'),
};

// 進度環周長（r = 110）
const CIRCUMFERENCE = 2 * Math.PI * 110;
ringFill.style.strokeDasharray = String(CIRCUMFERENCE);

// ── 渲染 ──────────────────────────────────────────
function fmt(ms) {
  const total = Math.ceil(ms / 1000);
  const m = String(Math.floor(total / 60)).padStart(2, '0');
  const s = String(total % 60).padStart(2, '0');
  return `${m}:${s}`;
}

function render() {
  const text = fmt(remainingMs);
  timeEl.textContent = text;
  phaseEl.textContent = running ? MODE_PHASE[mode] : (mode === 'focus' ? '準備專注' : MODE_PHASE[mode]);

  const frac = totalMs > 0 ? remainingMs / totalMs : 0;
  ringFill.style.strokeDashoffset = String(CIRCUMFERENCE * (1 - frac));

  document.title = running ? `${text} · ${MODE_LABEL[mode]} — 番茄鐘` : BASE_TITLE;
}

function renderStats() {
  countEl.textContent = String(stats.count);
}

function updateStartBtn() {
  startBtn.textContent = running ? '暫停' : (remainingMs < totalMs ? '繼續' : '開始');
}

// ── 計時迴圈（以時間戳計算，避免分頁節流造成誤差）──
function loop() {
  remainingMs = Math.max(0, endAt - Date.now());
  render();
  if (remainingMs <= 0) {
    running = false;
    rafId = null;
    complete();
    return;
  }
  rafId = requestAnimationFrame(loop);
}

// ── 控制 ──────────────────────────────────────────
function start() {
  if (running) return;
  if (remainingMs <= 0) remainingMs = totalMs;
  endAt = Date.now() + remainingMs;
  running = true;
  clock.classList.add('is-running');
  rafId = requestAnimationFrame(loop);
  updateStartBtn();
}

function pause() {
  if (!running) return;
  remainingMs = Math.max(0, endAt - Date.now());
  running = false;
  if (rafId) cancelAnimationFrame(rafId);
  rafId = null;
  clock.classList.remove('is-running');
  render();
  updateStartBtn();
}

function setMode(m, { autoStart = false } = {}) {
  mode = m;
  totalMs = settings[m] * 60000;
  remainingMs = totalMs;
  running = false;
  if (rafId) cancelAnimationFrame(rafId);
  rafId = null;
  clock.classList.remove('is-running');

  modeBtns.forEach((b) => {
    const on = b.dataset.mode === m;
    b.classList.toggle('is-active', on);
    b.setAttribute('aria-selected', String(on));
  });
  clock.dataset.mode = m;

  render();
  updateStartBtn();
  if (autoStart) start();
}

// 一段結束：提示、統計、接續
function complete() {
  clock.classList.remove('is-running');
  flash();
  if (settings.sound) playChime(mode === 'focus');
  if (settings.notify) notify();

  let next;
  if (mode === 'focus') {
    stats.count += 1;
    stats.cycle += 1;
    saveStats();
    renderStats();
    track('use');
    next = (stats.cycle % settings.interval === 0) ? 'long' : 'short';
  } else {
    next = 'focus';
  }
  setMode(next, { autoStart: settings.autostart });
}

// 完成瞬間的視覺提示
function flash() {
  clock.classList.add('is-done');
  setTimeout(() => clock.classList.remove('is-done'), 900);
}

// ── 提示音（Web Audio 合成，無外部檔）──────────────
function playChime(isFocusEnd) {
  try {
    const ac = new (window.AudioContext || window.webkitAudioContext)();
    const now = ac.currentTime;
    // 專注結束用上行三音，休息結束用較柔的兩音
    const notes = isFocusEnd ? [880, 1175, 1568] : [784, 988];
    notes.forEach((f, i) => {
      const o = ac.createOscillator();
      const g = ac.createGain();
      o.type = 'sine';
      o.frequency.value = f;
      o.connect(g);
      g.connect(ac.destination);
      const t = now + i * 0.16;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.25, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.9);
      o.start(t);
      o.stop(t + 1);
    });
    setTimeout(() => ac.close(), 1600);
  } catch { /* 不支援就靜默 */ }
}

// ── 桌面通知 ──────────────────────────────────────
function notify() {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const body = mode === 'focus' ? '專注時段結束，休息一下！' : '休息結束，回到專注。';
  new Notification('番茄鐘', { body });
}

// ── 事件綁定 ──────────────────────────────────────
startBtn.addEventListener('click', () => { running ? pause() : start(); });
resetBtn.addEventListener('click', () => setMode(mode));

modeBtns.forEach((btn) => {
  btn.addEventListener('click', () => setMode(btn.dataset.mode));
});

// 設定：數字欄位
['focus', 'short', 'long', 'interval'].forEach((key) => {
  const el = inputs[key];
  el.value = settings[key];
  el.addEventListener('change', () => {
    const min = Number(el.min), max = Number(el.max);
    let v = Math.round(Number(el.value));
    if (!Number.isFinite(v)) v = DEFAULTS[key];
    v = Math.min(max, Math.max(min, v));
    el.value = v;
    settings[key] = v;
    saveSettings();
    // 改到目前模式且未在計時 → 即時套用新長度
    if (!running && (key === mode)) setMode(mode);
  });
});

// 設定：勾選項
inputs.autostart.checked = settings.autostart;
inputs.sound.checked = settings.sound;
inputs.notify.checked = settings.notify;

inputs.autostart.addEventListener('change', () => {
  settings.autostart = inputs.autostart.checked;
  saveSettings();
});
inputs.sound.addEventListener('change', () => {
  settings.sound = inputs.sound.checked;
  saveSettings();
});
inputs.notify.addEventListener('change', async () => {
  if (inputs.notify.checked && 'Notification' in window && Notification.permission !== 'granted') {
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') inputs.notify.checked = false;
  }
  settings.notify = inputs.notify.checked;
  saveSettings();
});

// ── 初始 ──────────────────────────────────────────
setMode('focus');
renderStats();
