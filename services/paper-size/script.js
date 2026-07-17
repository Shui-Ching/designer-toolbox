// ============================================================
// 31 印刷紙張尺寸速查 — 系列篩選、單位切換（mm/cm/inch/px）、點列複製
// 資料內嵌，零相依，維持 CSP script-src 'self'
// ============================================================
import { copyText, track } from '../../shared/scripts/shared.js?v=202607172333';

// ── 紙張資料（mm: [寬, 高]）────────────────────────────────
// 直式以短邊為寬；名片與明信片為橫式使用，以長邊為寬
const PAPERS = [
  // ISO A 系列（直式）
  { name: 'A0',                series: 'iso-a', mm: [841, 1189] },
  { name: 'A1',                series: 'iso-a', mm: [594, 841]  },
  { name: 'A2',                series: 'iso-a', mm: [420, 594]  },
  { name: 'A3',                series: 'iso-a', mm: [297, 420]  },
  { name: 'A4',                series: 'iso-a', mm: [210, 297]  },
  { name: 'A5',                series: 'iso-a', mm: [148, 210]  },
  { name: 'A6',                series: 'iso-a', mm: [105, 148]  },
  { name: 'A7',                series: 'iso-a', mm: [74, 105]   },
  { name: 'A8',                series: 'iso-a', mm: [52, 74]    },
  // ISO B 系列（直式）
  { name: 'B0',                series: 'iso-b', mm: [1000, 1414] },
  { name: 'B1',                series: 'iso-b', mm: [707, 1000]  },
  { name: 'B2',                series: 'iso-b', mm: [500, 707]   },
  { name: 'B3',                series: 'iso-b', mm: [353, 500]   },
  { name: 'B4',                series: 'iso-b', mm: [250, 353]   },
  { name: 'B5',                series: 'iso-b', mm: [176, 250]   },
  { name: 'B6',                series: 'iso-b', mm: [125, 176]   },
  { name: 'B7',                series: 'iso-b', mm: [88, 125]    },
  { name: 'B8',                series: 'iso-b', mm: [62, 88]     },
  // JIS B 系列（日本工業規格，直式；與 ISO B 略不同）
  { name: 'JIS B4',            series: 'jis-b', mm: [257, 364] },
  { name: 'JIS B5',            series: 'jis-b', mm: [182, 257] },
  { name: 'JIS B6',            series: 'jis-b', mm: [128, 182] },
  // 美規
  { name: 'Letter',            series: 'us', mm: [216, 279] },
  { name: 'Legal',             series: 'us', mm: [216, 356] },
  { name: 'Ledger / Tabloid',  series: 'us', mm: [279, 432] },
  { name: 'Half Letter',       series: 'us', mm: [140, 216] },
  // 常用尺寸
  { name: '名片（台灣）',      series: 'common', mm: [90, 54]   },
  { name: '名片（美規）',      series: 'common', mm: [89, 51]   },
  { name: '明信片',            series: 'common', mm: [148, 100] },
  { name: '海報 Small（A3）',  series: 'common', mm: [297, 420] },
  { name: '海報 Medium（A2）', series: 'common', mm: [420, 594] },
  { name: '海報 Large（A1）',  series: 'common', mm: [594, 841] },
];

const SERIES = [
  { id: 'all',    name: '全部'      },
  { id: 'iso-a',  name: 'ISO A 系列' },
  { id: 'iso-b',  name: 'ISO B 系列' },
  { id: 'jis-b',  name: 'JIS B 系列' },
  { id: 'us',     name: '美規'      },
  { id: 'common', name: '常用'      },
];

const UNITS = [
  { id: 'mm',   label: 'mm'   },
  { id: 'cm',   label: 'cm'   },
  { id: 'inch', label: 'inch' },
  { id: 'px',   label: 'px'   },
];

const DPIS = [72, 96, 150, 300];

let activeSeries = 'all';
let activeUnit   = 'mm';
let activeDpi    = 96;

const filterBar = document.getElementById('filter-bar');
const unitChips = document.getElementById('unit-chips');
const dpiBar    = document.getElementById('dpi-bar');
const dpiChips  = document.getElementById('dpi-chips');
const tableBody = document.getElementById('table-body');
const thSize    = document.getElementById('th-size');

// ── 單位換算（以 mm 為真實來源）─────────────────────────────
function convert(mmVal, unit, dpi) {
  switch (unit) {
    case 'mm':   return mmVal;
    case 'cm':   return mmVal / 10;
    case 'inch': return mmVal / 25.4;
    case 'px':   return Math.round(mmVal / 25.4 * dpi);
    default:     return mmVal;
  }
}

// 格式化顯示值（去尾零，px 為整數）
function fmt(v, unit) {
  if (unit === 'px')   return v.toString();
  if (unit === 'inch') return parseFloat(v.toFixed(2)).toString();
  if (unit === 'cm')   return parseFloat(v.toFixed(1)).toString();
  return v.toString(); // mm 原始為整數
}

// 表頭單位標籤
function unitLabel(unit, dpi) {
  return unit === 'px' ? `px（${dpi} DPI）` : unit;
}

// 複製用的字串
function copyStr(cw, ch, unit) {
  const u = unit === 'px' ? 'px' : unit;
  return `${fmt(cw, unit)} × ${fmt(ch, unit)} ${u}`;
}

// 比例縮圖：以 SVG rect 呈現紙張寬高比，最大邊 32px、最小邊 6px
function ratioSvg(w, h) {
  const MAX = 32;
  const MIN = 6;
  const isLandscape = w > h;
  const sw = isLandscape ? MAX : Math.max(MIN, Math.round(MAX * w / h));
  const sh = isLandscape ? Math.max(MIN, Math.round(MAX * h / w)) : MAX;
  // stroke-width 0.75 使細小縮圖也清晰可見
  return `<svg class="ratio-thumb" width="${sw}" height="${sh}" viewBox="0 0 ${sw} ${sh}" aria-hidden="true"><rect x="0.75" y="0.75" width="${sw - 1.5}" height="${sh - 1.5}" /></svg>`;
}

// ── 渲染系列篩選 ──────────────────────────────────────────────
function renderFilter() {
  filterBar.innerHTML = SERIES.map((s) =>
    `<button type="button" class="filter-chip${s.id === activeSeries ? ' is-active' : ''}"
      data-series="${s.id}" aria-pressed="${s.id === activeSeries ? 'true' : 'false'}">${s.name}</button>`
  ).join('');

  filterBar.querySelectorAll('.filter-chip').forEach((btn) => {
    btn.addEventListener('click', () => {
      activeSeries = btn.dataset.series;
      filterBar.querySelectorAll('.filter-chip').forEach((b) => {
        b.classList.toggle('is-active', b === btn);
        b.setAttribute('aria-pressed', b === btn ? 'true' : 'false');
      });
      render();
    });
  });
}

// ── 渲染單位切換 ──────────────────────────────────────────────
function renderUnitChips() {
  unitChips.innerHTML = UNITS.map((u) =>
    `<button type="button" class="unit-chip${u.id === activeUnit ? ' is-active' : ''}"
      data-unit="${u.id}" aria-pressed="${u.id === activeUnit ? 'true' : 'false'}">${u.label}</button>`
  ).join('');

  unitChips.querySelectorAll('.unit-chip').forEach((btn) => {
    btn.addEventListener('click', () => {
      activeUnit = btn.dataset.unit;
      unitChips.querySelectorAll('.unit-chip').forEach((b) => {
        b.classList.toggle('is-active', b === btn);
        b.setAttribute('aria-pressed', b === btn ? 'true' : 'false');
      });
      dpiBar.hidden = activeUnit !== 'px';
      thSize.textContent = `寬 × 高（${unitLabel(activeUnit, activeDpi)}）`;
      render();
    });
  });
}

// ── 渲染 DPI 切換 ─────────────────────────────────────────────
function renderDpiChips() {
  dpiChips.innerHTML = DPIS.map((d) =>
    `<button type="button" class="unit-chip${d === activeDpi ? ' is-active' : ''}"
      data-dpi="${d}" aria-pressed="${d === activeDpi ? 'true' : 'false'}">${d}</button>`
  ).join('');

  dpiChips.querySelectorAll('.unit-chip').forEach((btn) => {
    btn.addEventListener('click', () => {
      activeDpi = Number(btn.dataset.dpi);
      dpiChips.querySelectorAll('.unit-chip').forEach((b) => {
        b.classList.toggle('is-active', b === btn);
        b.setAttribute('aria-pressed', b === btn ? 'true' : 'false');
      });
      thSize.textContent = `寬 × 高（${unitLabel(activeUnit, activeDpi)}）`;
      render();
    });
  });
}

// ── 渲染表身 ─────────────────────────────────────────────────
function render() {
  const rows = activeSeries === 'all'
    ? PAPERS
    : PAPERS.filter((p) => p.series === activeSeries);

  if (!rows.length) {
    tableBody.innerHTML = '<tr><td colspan="5" class="empty-state">找不到符合的紙張。</td></tr>';
    return;
  }

  tableBody.innerHTML = rows.map((p) => {
    const [rawW, rawH] = p.mm;
    const cw = convert(rawW, activeUnit, activeDpi);
    const ch = convert(rawH, activeUnit, activeDpi);
    const copy = copyStr(cw, ch, activeUnit);
    const seriesName = SERIES.find((s) => s.id === p.series)?.name ?? p.series;
    return `
      <tr data-copy="${copy}">
        <td class="cell-name">${p.name}</td>
        <td><span class="series-pill series-${p.series}">${seriesName}</span></td>
        <td class="cell-ratio">${ratioSvg(rawW, rawH)}</td>
        <td class="cell-mono">${fmt(cw, activeUnit)} × ${fmt(ch, activeUnit)}</td>
        <td class="cell-copy"><span class="copy-hint">複製</span></td>
      </tr>`;
  }).join('');

  bindRows();
}

// 點列複製
function bindRows() {
  tableBody.querySelectorAll('tr[data-copy]').forEach((tr) => {
    tr.addEventListener('click', async () => {
      const ok = await copyText(tr.dataset.copy);
      if (ok) track('use');
      const hint = tr.querySelector('.copy-hint');
      tr.classList.add('is-copied');
      if (hint) hint.textContent = ok ? '已複製 ✓' : '失敗';
      setTimeout(() => {
        tr.classList.remove('is-copied');
        if (hint) hint.textContent = '複製';
      }, 1400);
    });
  });
}

// ── 初始化 ────────────────────────────────────────────────────
renderFilter();
renderUnitChips();
renderDpiChips();
render();
