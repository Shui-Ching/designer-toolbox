import { track } from '../../shared/scripts/shared.js?v=202606121702';

// ============================================================
// 環境音 — 雨聲與風聲，用 Web Audio API 即時合成
// 零外部音檔、零相依，維持 CSP script-src 'self'
// （白／粉紅／棕噪音、海浪、溪流、咖啡廳的合成擬真度不足，已移除）
// ============================================================

// ── 頻道圖示（描邊風，呼應全站手冊風 SVG）──────────────
const ICONS = {
  rain: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 13a4 4 0 010-8 5 5 0 019.6-1A3.5 3.5 0 0117 13z"/><path d="M8 17l-1 2M12 17l-1 2M16 17l-1 2"/></svg>',
  wind: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M3 8h11a2.5 2.5 0 10-2.5-2.5"/><path d="M3 12h16a2.5 2.5 0 11-2.5 2.5"/><path d="M3 16h8a2 2 0 11-2 2"/></svg>',
};

// ── 頻道定義 ──────────────────────────────────────
const CHANNELS = [
  { id: 'rain', name: '下雨', en: 'Rain' },
  { id: 'wind', name: '風聲', en: 'Wind' },
];

// ── 快速情境（id → 音量 0–1）──────────────────────
const PRESETS = [
  { name: '綿綿細雨', mix: { rain: 0.5 } },
  { name: '狂風', mix: { wind: 0.55 } },
  { name: '風雨交加', mix: { rain: 0.5, wind: 0.4 } },
];

// ── 音訊引擎 ──────────────────────────────────────
let ctx = null;
let masterGain = null;
let started = false;       // 是否已建好音訊圖、所有 source 已 start
let playing = false;       // 主控播放狀態
let trackedUse = false;    // 只在首次實際出聲時送一次分析事件
let masterVol = 0.8;

const graphs = {};         // id → { userGain, sources, lfos }
const state = {};          // id → { active, vol }
CHANNELS.forEach((c) => { state[c.id] = { active: false, vol: 0.6 }; });

const noiseBuffers = {};   // 噪音波形快取（合成濾波用的底料：pink / brown）

// 產生 4 秒可循環的噪音緩衝
function getNoiseBuffer(type) {
  if (noiseBuffers[type]) return noiseBuffers[type];
  const len = ctx.sampleRate * 4;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);

  if (type === 'pink') {
    // Paul Kellet 粉紅噪音近似（能量隨頻率遞減，當雨聲的沙沙底料）
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + w * 0.0555179;
      b1 = 0.99332 * b1 + w * 0.0750759;
      b2 = 0.96900 * b2 + w * 0.1538520;
      b3 = 0.86650 * b3 + w * 0.3104856;
      b4 = 0.55000 * b4 + w * 0.5329522;
      b5 = -0.7616 * b5 - w * 0.0168980;
      d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
      b6 = w * 0.115926;
    }
  } else { // brown：積分白噪音，低頻偏重，當風聲底料
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      last = (last + 0.02 * w) / 1.02;
      d[i] = last * 3.5;
    }
  }
  noiseBuffers[type] = buf;
  return buf;
}

function noiseSource(type) {
  const s = ctx.createBufferSource();
  s.buffer = getNoiseBuffer(type);
  s.loop = true;
  return s;
}

// 依頻道 id 組音訊圖：source → 濾波 → textureGain(調性／LFO) → userGain(使用者音量) → master
function buildGraph(id) {
  const userGain = ctx.createGain();
  userGain.gain.value = 0;
  userGain.connect(masterGain);

  const tex = ctx.createGain();
  tex.gain.value = 1;
  tex.connect(userGain);

  const sources = [];
  const lfos = [];

  // 接一個低頻振盪器（LFO）去調變某個參數，營造起伏
  const addLfo = (freq, depth, target, center) => {
    if (center != null) target.value = center;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = freq;
    const lg = ctx.createGain();
    lg.gain.value = depth;
    lfo.connect(lg);
    lg.connect(target);
    lfos.push(lfo);
  };

  if (id === 'rain') {
    // 雨：粉紅噪音去掉低頻，留下沙沙的高頻雨聲
    const src = noiseSource('pink');
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 800;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 9000;
    src.connect(hp); hp.connect(lp); lp.connect(tex);
    sources.push(src);
  } else if (id === 'wind') {
    // 風：棕噪音過帶通，陣風用兩組慢 LFO 調音量與頻率
    const src = noiseSource('brown');
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 500; bp.Q.value = 0.7;
    src.connect(bp); bp.connect(tex);
    sources.push(src);
    addLfo(0.13, 0.4, tex.gain, 0.5);
    addLfo(0.07, 300, bp.frequency);
  }

  return { userGain, sources, lfos };
}

// 首次互動才建立 AudioContext（瀏覽器自動播放政策要求）
function ensureAudio() {
  if (ctx) return;
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  masterGain = ctx.createGain();
  masterGain.gain.value = masterVol;
  masterGain.connect(ctx.destination);

  CHANNELS.forEach((c) => { graphs[c.id] = buildGraph(c.id); });
  Object.values(graphs).forEach((g) => {
    g.sources.forEach((s) => s.start());
    g.lfos.forEach((l) => l.start());
  });
  started = true;
}

function anyActive() {
  return CHANNELS.some((c) => state[c.id].active);
}

// 把某頻道的使用者音量平滑帶到目標值（未啟用即為 0）
function applyChannelGain(id) {
  if (!started) return;
  const target = state[id].active ? state[id].vol : 0;
  graphs[id].userGain.gain.setTargetAtTime(target, ctx.currentTime, 0.08);
}

function play() {
  ensureAudio();
  ctx.resume();
  playing = true;
  if (!trackedUse) { track('use'); trackedUse = true; }
  updatePlayUI();
}

function pause() {
  if (ctx) ctx.suspend();
  playing = false;
  updatePlayUI();
}

// ── DOM ──────────────────────────────────────────
const grid = document.getElementById('nz-grid');
const playBtn = document.getElementById('nz-play');
const masterSlider = document.getElementById('nz-master-vol');
const autostopSel = document.getElementById('nz-autostop');
const presetsBox = document.getElementById('nz-presets');

// 渲染頻道卡
grid.innerHTML = CHANNELS.map((c) => `
  <div class="nz-channel" data-id="${c.id}">
    <button type="button" class="nz-channel-toggle" aria-pressed="false">
      <span class="nz-channel-icon">${ICONS[c.id]}</span>
      <span class="nz-channel-meta">
        <span class="nz-channel-name">${c.name}</span>
        <span class="nz-channel-en">${c.en}</span>
      </span>
      <span class="nz-channel-bars" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
    </button>
    <input class="nz-channel-vol" type="range" min="0" max="100" value="${Math.round(state[c.id].vol * 100)}" aria-label="${c.name} 音量">
  </div>
`).join('');

// 渲染快速情境鈕
presetsBox.innerHTML = PRESETS.map((p, i) =>
  `<button type="button" class="nz-preset-btn" data-preset="${i}">${p.name}</button>`
).join('');

// 取得頻道卡內元素
function els(id) {
  const card = grid.querySelector(`.nz-channel[data-id="${id}"]`);
  return {
    card,
    toggle: card.querySelector('.nz-channel-toggle'),
    slider: card.querySelector('.nz-channel-vol'),
  };
}

function updateChannelUI(id) {
  const { card, toggle, slider } = els(id);
  card.classList.toggle('is-active', state[id].active);
  toggle.setAttribute('aria-pressed', String(state[id].active));
  slider.value = Math.round(state[id].vol * 100);
}

function updatePlayUI() {
  playBtn.classList.toggle('is-playing', playing);
  playBtn.setAttribute('aria-pressed', String(playing));
}

// ── 互動：開關頻道 ────────────────────────────────
function setActive(id, active) {
  state[id].active = active;
  applyChannelGain(id);
  updateChannelUI(id);
  // 啟用任一頻道時自動開始播放；全部關閉時自動暫停
  if (active && !playing) play();
  else if (!anyActive() && playing) pause();
}

grid.addEventListener('click', (e) => {
  const toggle = e.target.closest('.nz-channel-toggle');
  if (!toggle) return;
  const id = toggle.closest('.nz-channel').dataset.id;
  ensureAudio();
  setActive(id, !state[id].active);
});

// 拖曳音量：拉動即視為啟用，歸零則關閉
grid.addEventListener('input', (e) => {
  const slider = e.target.closest('.nz-channel-vol');
  if (!slider) return;
  const id = slider.closest('.nz-channel').dataset.id;
  ensureAudio();
  const v = Number(slider.value) / 100;
  state[id].vol = v;
  if (v > 0 && !state[id].active) setActive(id, true);
  else if (v === 0 && state[id].active) setActive(id, false);
  else applyChannelGain(id);
});

// ── 主控播放鈕 ────────────────────────────────────
playBtn.addEventListener('click', () => {
  if (playing) { pause(); return; }
  ensureAudio();
  // 若還沒選任何聲音，預設開雨聲當底
  if (!anyActive()) setActive('rain', true);
  else play();
});

// ── 主音量 ────────────────────────────────────────
masterSlider.addEventListener('input', () => {
  masterVol = Number(masterSlider.value) / 100;
  if (masterGain) masterGain.gain.setTargetAtTime(masterVol, ctx.currentTime, 0.05);
});

// ── 快速情境 ──────────────────────────────────────
presetsBox.addEventListener('click', (e) => {
  const btn = e.target.closest('.nz-preset-btn');
  if (!btn) return;
  ensureAudio();
  const { mix } = PRESETS[Number(btn.dataset.preset)];
  CHANNELS.forEach((c) => {
    const v = mix[c.id] || 0;
    state[c.id].active = v > 0;
    if (v > 0) state[c.id].vol = v;
    applyChannelGain(c.id);
    updateChannelUI(c.id);
  });
  presetsBox.querySelectorAll('.nz-preset-btn').forEach((b) => b.classList.remove('is-active'));
  btn.classList.add('is-active');
  play();
});

// 手動改動頻道時，取消快速情境的選取高亮
function clearPresetHighlight() {
  presetsBox.querySelectorAll('.nz-preset-btn.is-active').forEach((b) => b.classList.remove('is-active'));
}
grid.addEventListener('pointerdown', clearPresetHighlight);

// ── 自動停止計時 ──────────────────────────────────
let autostopTimer = null;
autostopSel.addEventListener('change', () => {
  if (autostopTimer) { clearTimeout(autostopTimer); autostopTimer = null; }
  const mins = Number(autostopSel.value);
  if (mins > 0) {
    autostopTimer = setTimeout(() => {
      pause();
      autostopSel.value = '0';
      autostopTimer = null;
    }, mins * 60 * 1000);
  }
});
