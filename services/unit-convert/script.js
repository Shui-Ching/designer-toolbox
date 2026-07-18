// ============================================================
// 24 單位換算 — 多類別即時雙向互轉
// 單一真實來源：每個類別以「基準單位」保存目前數值（state.bases[cat]），
// 編輯任一欄即換算回基準、再回填其餘欄位。零相依、全在瀏覽器端運算。
// ============================================================
import { copyText, track } from '../../shared/scripts/shared.js?v=202607181532';

// — DOM —
const tabsEl = document.getElementById('unit-tabs');
const settingsEl = document.getElementById('settings');
const listEl = document.getElementById('unit-list');
const catTag = document.getElementById('cat-tag');
const copyHint = document.getElementById('copy-hint');
const noteEl = document.getElementById('unit-note');

// ============================================================
// 共用設定（跨類別共享）：根字級／參考字級供網頁類別，DPI 供印刷類別
// ============================================================
const settings = { root: 16, context: 16, dpi: 96 };

// ============================================================
// 類別定義
// — ratio 類別：每個單位給「換算到基準單位的倍率」factor，
//   基準值 = 數值 × factor[來源]，各欄 = 基準值 ÷ factor[該欄]。
// — special 類別（溫度）：自訂 toBase／fromBase，因換算含位移非純倍率。
// units 寫成函式以吃進 settings（網頁／印刷的倍率隨設定變動）。
// 各類別的 default 以「基準單位」表示，作為初次載入的數值。
// ============================================================
const CATEGORIES = {
  css: {
    label: '網頁字級', tag: 'CSS 字級單位', base: 'px', default: 16,
    note: 'CSS 規範 1pt = 96/72 px ≈ 1.333px（與裝置 DPI 無關）；rem 相對「根字級」、em 與 % 相對「參考字級（父層）」。',
    settings: [
      { id: 'root', label: '根字級 root（rem 基準）', suffix: 'px' },
      { id: 'context', label: '參考字級 context（em／% 基準）', suffix: 'px' },
    ],
    units: (s) => [
      { id: 'px', name: '像素', sym: 'px', factor: 1 },
      { id: 'rem', name: 'rem（相對根字級）', sym: 'rem', factor: s.root },
      { id: 'em', name: 'em（相對父層）', sym: 'em', factor: s.context },
      { id: 'pt', name: '點', sym: 'pt', factor: 96 / 72 },
      { id: 'pct', name: '百分比', sym: '%', factor: s.context / 100 },
    ],
  },
  print: {
    label: '印刷／物理', tag: '印刷 · 長度', base: 'mm', default: 10,
    note: '1in = 25.4mm；印刷點 1pt = 1/72in ≈ 0.3528mm；px 依下方 DPI 換算（1px = 25.4 ÷ DPI mm）。',
    settings: [
      { id: 'dpi', label: '解析度 DPI（px 基準）', suffix: 'dpi', presets: [72, 96, 150, 300] },
    ],
    units: (s) => [
      { id: 'mm', name: '公釐', sym: 'mm', factor: 1 },
      { id: 'cm', name: '公分', sym: 'cm', factor: 10 },
      { id: 'inch', name: '英吋', sym: 'in', factor: 25.4 },
      { id: 'pt', name: '點', sym: 'pt', factor: 25.4 / 72 },
      { id: 'px', name: '像素', sym: 'px', factor: 25.4 / s.dpi },
    ],
  },
  length: {
    label: '長度', tag: '長度', base: 'm', default: 1,
    note: '以公尺為基準。1in = 0.0254m、1ft = 0.3048m、1yd = 0.9144m、1mi = 1609.344m。',
    units: () => [
      { id: 'mm', name: '公釐', sym: 'mm', factor: 0.001 },
      { id: 'cm', name: '公分', sym: 'cm', factor: 0.01 },
      { id: 'm', name: '公尺', sym: 'm', factor: 1 },
      { id: 'km', name: '公里', sym: 'km', factor: 1000 },
      { id: 'inch', name: '英吋', sym: 'in', factor: 0.0254 },
      { id: 'ft', name: '英尺', sym: 'ft', factor: 0.3048 },
      { id: 'yd', name: '碼', sym: 'yd', factor: 0.9144 },
      { id: 'mi', name: '英里', sym: 'mi', factor: 1609.344 },
    ],
  },
  weight: {
    label: '重量', tag: '重量', base: 'g', default: 100,
    note: '以公克為基準。1oz = 28.3495g、1lb = 453.592g。',
    units: () => [
      { id: 'mg', name: '毫克', sym: 'mg', factor: 0.001 },
      { id: 'g', name: '公克', sym: 'g', factor: 1 },
      { id: 'kg', name: '公斤', sym: 'kg', factor: 1000 },
      { id: 't', name: '公噸', sym: 't', factor: 1e6 },
      { id: 'oz', name: '盎司', sym: 'oz', factor: 28.349523125 },
      { id: 'lb', name: '磅', sym: 'lb', factor: 453.59237 },
    ],
  },
  temp: {
    label: '溫度', tag: '溫度', base: '°C', default: 25, special: true,
    note: '溫度換算含位移：°F =°C×9/5+32、K =°C+273.15。',
    units: () => [
      { id: 'c', name: '攝氏', sym: '°C' },
      { id: 'f', name: '華氏', sym: '°F' },
      { id: 'k', name: '克耳文', sym: 'K' },
    ],
    // 各單位 → 基準（攝氏）
    toBase: (v, id) => (id === 'c' ? v : id === 'f' ? (v - 32) * 5 / 9 : v - 273.15),
    // 基準（攝氏）→ 各單位
    fromBase: (c, id) => (id === 'c' ? c : id === 'f' ? c * 9 / 5 + 32 : c + 273.15),
  },
  area: {
    label: '面積', tag: '面積', base: 'm²', default: 1,
    note: '以平方公尺為基準。1坪 ≈ 3.3058m²、1公頃 = 10000m²。',
    units: () => [
      { id: 'mm2', name: '平方公釐', sym: 'mm²', factor: 1e-6 },
      { id: 'cm2', name: '平方公分', sym: 'cm²', factor: 1e-4 },
      { id: 'm2', name: '平方公尺', sym: 'm²', factor: 1 },
      { id: 'ping', name: '坪', sym: '坪', factor: 3.305785 },
      { id: 'ha', name: '公頃', sym: 'ha', factor: 1e4 },
      { id: 'km2', name: '平方公里', sym: 'km²', factor: 1e6 },
      { id: 'in2', name: '平方英吋', sym: 'in²', factor: 0.00064516 },
      { id: 'ft2', name: '平方英尺', sym: 'ft²', factor: 0.09290304 },
    ],
  },
  data: {
    label: '資料量', tag: '資料量', base: 'B', default: 1048576,
    note: '採 1 KB = 1024 B（二進位制，常見於檔案大小與記憶體描述）。1 MB = 1024 KB、1 GB = 1024 MB、1 TB = 1024 GB。',
    units: () => [
      { id: 'b', name: '位元組', sym: 'B', factor: 1 },
      { id: 'kb', name: '千位元組', sym: 'KB', factor: 1024 },
      { id: 'mb', name: '百萬位元組', sym: 'MB', factor: 1024 ** 2 },
      { id: 'gb', name: '十億位元組', sym: 'GB', factor: 1024 ** 3 },
      { id: 'tb', name: '兆位元組', sym: 'TB', factor: 1024 ** 4 },
    ],
  },
  angle: {
    label: '角度', tag: '角度', base: '°', default: 180,
    note: '1 rad = 180/π° ≈ 57.296°；1 turn = 360°；1 grad = 0.9°（公制百分度，直角 = 100 grad）。',
    units: () => [
      { id: 'deg', name: '度', sym: '°', factor: 1 },
      { id: 'rad', name: '弧度', sym: 'rad', factor: 180 / Math.PI },
      { id: 'turn', name: '圈', sym: 'turn', factor: 360 },
      { id: 'grad', name: '百分度', sym: 'grad', factor: 0.9 },
    ],
  },
  time: {
    label: '時間', tag: '時間', base: 's', default: 60,
    note: '以秒為基準：1min = 60s、1hr = 3600s、1day = 86400s、1week = 604800s。',
    units: () => [
      { id: 'ms', name: '毫秒', sym: 'ms', factor: 0.001 },
      { id: 's', name: '秒', sym: 's', factor: 1 },
      { id: 'min', name: '分', sym: 'min', factor: 60 },
      { id: 'hr', name: '時', sym: 'hr', factor: 3600 },
      { id: 'day', name: '天', sym: 'day', factor: 86400 },
      { id: 'week', name: '週', sym: 'week', factor: 604800 },
    ],
  },
};

// — 狀態：目前類別、各類別保存的基準值 —
const state = {
  cat: 'css',
  bases: Object.fromEntries(Object.keys(CATEGORIES).map((k) => [k, CATEGORIES[k].default])),
};

// ============================================================
// 數字格式化：去掉浮點雜訊與多餘的 0，極大／極小才用科學記數
// ============================================================
function fmt(v) {
  if (v === 0) return '0';
  if (!isFinite(v)) return '';
  const r = Number(v.toFixed(6)); // 先收斂到 6 位小數，Number() 會自動去尾零
  if (r === 0) return v.toPrecision(4); // 太小被收成 0 時改用有效位數表示
  const abs = Math.abs(r);
  if (abs >= 1e9 || abs < 1e-4) return Number(v.toPrecision(6)).toString();
  return String(r);
}

// 從字串抓出第一個數字（含小數、負號），失敗回 null
function parseNum(str) {
  const m = String(str).match(/-?\d*\.?\d+/);
  return m ? Number(m[0]) : null;
}

// 目前類別的單位清單（吃進現行設定）
function currentUnits() {
  return CATEGORIES[state.cat].units(settings);
}

// 把某單位的數值換算成基準值
function toBase(value, unit) {
  const cat = CATEGORIES[state.cat];
  if (cat.special) return cat.toBase(value, unit.id);
  return value * unit.factor;
}

// 把基準值換算成某單位的數值
function fromBase(base, unit) {
  const cat = CATEGORIES[state.cat];
  if (cat.special) return cat.fromBase(base, unit.id);
  return base / unit.factor;
}

// ============================================================
// 渲染：設定列
// ============================================================
function renderSettings() {
  const cat = CATEGORIES[state.cat];
  settingsEl.innerHTML = '';
  if (!cat.settings) { settingsEl.hidden = true; return; }
  settingsEl.hidden = false;

  cat.settings.forEach((cfg) => {
    const block = document.createElement('div');
    block.className = 'setting-block';

    const label = document.createElement('label');
    label.className = 'setting-label';
    label.textContent = cfg.label;
    label.htmlFor = `set-${cfg.id}`;

    const field = document.createElement('div');
    field.className = 'setting-field';

    const input = document.createElement('input');
    input.type = 'text';
    input.inputMode = 'decimal';
    input.id = `set-${cfg.id}`;
    input.className = 'setting-input';
    input.value = settings[cfg.id];
    input.autocomplete = 'off';
    input.addEventListener('input', () => {
      const n = parseNum(input.value);
      if (n && n > 0) { settings[cfg.id] = n; renderList(); }
    });

    const suffix = document.createElement('span');
    suffix.className = 'setting-suffix';
    suffix.textContent = cfg.suffix;

    field.append(input, suffix);
    block.append(label, field);

    // 選配：常用值快捷鈕（如 DPI 72／96／150／300）
    if (cfg.presets) {
      const row = document.createElement('div');
      row.className = 'preset-row';
      cfg.presets.forEach((p) => {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'preset-chip';
        chip.textContent = p;
        chip.addEventListener('click', () => {
          settings[cfg.id] = p;
          input.value = p;
          renderList();
        });
        row.append(chip);
      });
      block.append(row);
    }

    settingsEl.append(block);
  });
}

// ============================================================
// 渲染：單位欄位列表
// exceptId：正在輸入的欄位略過重填，避免游標跳動
// ============================================================
function renderList(exceptId) {
  const cat = CATEGORIES[state.cat];
  const base = state.bases[state.cat];
  const units = currentUnits();
  catTag.textContent = cat.tag;
  noteEl.textContent = cat.note;

  // 既有欄位就地更新；類別切換時重建整個列表
  const exists = listEl.dataset.cat === state.cat;
  if (!exists) {
    listEl.dataset.cat = state.cat;
    listEl.innerHTML = '';
    units.forEach((u) => listEl.append(buildRow(u)));
  }

  units.forEach((u) => {
    if (u.id === exceptId) return;
    const input = listEl.querySelector(`.unit-input[data-unit="${u.id}"]`);
    if (input) {
      input.value = fmt(fromBase(base, u));
      input.classList.remove('is-invalid');
    }
  });
}

// 建一列：名稱＋單位符號 / 可編輯輸入 / 複製鈕
function buildRow(u) {
  const row = document.createElement('div');
  row.className = 'unit-row';

  const label = document.createElement('span');
  label.className = 'unit-label';
  label.textContent = u.name;
  const sym = document.createElement('span');
  sym.className = 'unit-sym';
  sym.textContent = u.sym;
  label.append(' ', sym);

  const input = document.createElement('input');
  input.type = 'text';
  input.inputMode = 'decimal';
  input.className = 'unit-input';
  input.dataset.unit = u.id;
  input.spellcheck = false;
  input.autocomplete = 'off';
  input.setAttribute('aria-label', `${u.name}（${u.sym}）`);
  input.addEventListener('input', () => {
    const n = parseNum(input.value);
    if (n === null) { input.classList.add('is-invalid'); return; }
    input.classList.remove('is-invalid');
    state.bases[state.cat] = toBase(n, u);
    renderList(u.id);
  });
  // 失焦時把該欄也正規化（例如把 16. 補成 16）
  input.addEventListener('blur', () => {
    input.classList.remove('is-invalid');
    renderList();
  });

  const copy = document.createElement('button');
  copy.type = 'button';
  copy.className = 'unit-copy';
  copy.dataset.unit = u.id;
  copy.textContent = '複製';
  copy.setAttribute('aria-label', `複製 ${u.sym} 數值`);
  copy.addEventListener('click', async () => {
    const val = fmt(fromBase(state.bases[state.cat], u));
    if (await copyText(val)) {
      flashHint(`已複製 ${val} ${u.sym}`);
      track('use');
    }
  });

  row.append(label, input, copy);
  return row;
}

// ============================================================
// 提示訊息
// ============================================================
let hintTimer = null;
function flashHint(msg) {
  copyHint.textContent = msg;
  clearTimeout(hintTimer);
  hintTimer = setTimeout(() => { copyHint.textContent = ''; }, 1600);
}

// ============================================================
// 類別切換
// ============================================================
tabsEl.addEventListener('click', (e) => {
  const btn = e.target.closest('.unit-tab');
  if (!btn || btn.dataset.cat === state.cat) return;

  state.cat = btn.dataset.cat;
  tabsEl.querySelectorAll('.unit-tab').forEach((b) => {
    const on = b === btn;
    b.classList.toggle('is-active', on);
    b.setAttribute('aria-selected', String(on));
  });

  renderSettings();
  renderList();
});

// 初次渲染
renderSettings();
renderList();
