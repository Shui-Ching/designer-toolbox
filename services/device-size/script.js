// ============================================================
// 04 裝置尺寸查詢 — 載入資料、搜尋、類型篩選、欄位排序、點列複製 viewport
// ============================================================
import { copyText, track } from '../../shared/scripts/shared.js?v=202606261147';

const searchInput = document.getElementById('search');
const filterBar = document.getElementById('filter-bar');
const resultCount = document.getElementById('result-count');
const tableHead = document.getElementById('table-head');
const tableBody = document.getElementById('table-body');
const bpScale = document.getElementById('bp-scale');

// 資料與狀態
let devices = [];
let categories = [];
let breakpoints = [];
let activeCategory = 'all'; // 'all' 或 category id
let keyword = '';
let sort = { key: 'category', dir: 'asc' }; // 預設依類型排序

// 表頭欄位定義：key 對應 row 取值，sortable 標示是否可排序
const COLUMNS = [
  { key: 'name',     label: '裝置',           sortable: true },
  { key: 'category', label: '類型',           sortable: true },
  { key: 'viewport', label: 'Viewport (CSS px)', sortable: true },
  { key: 'dpr',      label: 'DPR',            sortable: true },
  { key: 'physical', label: '實體解析度 (px)', sortable: true },
  { key: 'ratio',    label: '長寬比',         sortable: true },
];

init();

async function init() {
  try {
    const res = await fetch('../../shared/data/device-sizes.json');
    const data = await res.json();
    categories = data.categories || [];
    breakpoints = data.breakpoints || [];
    // 預先換算實體解析度與長寬比，後續搜尋／排序／渲染共用
    devices = (data.devices || []).map(normalize);
  } catch {
    tableBody.innerHTML =
      '<tr><td colspan="7" class="empty-state">資料載入失敗，請以本機伺服器或靜態空間開啟（file:// 直開會被瀏覽器擋下 fetch）。</td></tr>';
    return;
  }
  renderFilter();
  renderHead();
  renderBreakpoints();
  render();
}

// — 將一筆裝置補上換算欄位 —
function normalize(d) {
  const [w, h] = d.viewport;
  return {
    ...d,
    vw: w,
    vh: h,
    // 實體解析度 = viewport × dpr，四捨五入避免 2.625 之類產生小數
    pw: Math.round(w * d.dpr),
    ph: Math.round(h * d.dpr),
    // 長寬比以「長邊 : 短邊」的小數呈現，對設計最直觀
    ratioValue: Math.max(w, h) / Math.min(w, h),
  };
}

function categoryName(id) {
  return categories.find((c) => c.id === id)?.name || id;
}

// — 類型篩選列 —
function renderFilter() {
  const chips = [{ id: 'all', name: '全部' }, ...categories];
  filterBar.innerHTML = chips
    .map(
      (c) =>
        `<button type="button" class="filter-chip${c.id === activeCategory ? ' is-active' : ''}" data-category="${c.id}">${c.name}</button>`
    )
    .join('');

  filterBar.querySelectorAll('.filter-chip').forEach((btn) => {
    btn.addEventListener('click', () => {
      activeCategory = btn.dataset.category;
      filterBar
        .querySelectorAll('.filter-chip')
        .forEach((b) => b.classList.toggle('is-active', b === btn));
      render();
    });
  });
}

// — 搜尋輸入 —
searchInput.addEventListener('input', () => {
  keyword = searchInput.value.trim().toLowerCase();
  render();
});

// — 表頭（含排序）—
function renderHead() {
  tableHead.innerHTML = COLUMNS.map((col) => {
    const isActive = sort.key === col.key;
    const arrow = isActive ? (sort.dir === 'asc' ? '↑' : '↓') : '';
    return `<th class="${col.sortable ? 'is-sortable' : ''}${isActive ? ' is-sorted' : ''}" data-key="${col.key}">
        <span class="th-label">${col.label}</span>
        <span class="th-arrow">${arrow}</span>
      </th>`;
  }).join('') + '<th class="th-copy" aria-hidden="true"></th>'; // 複製欄無標題

  tableHead.querySelectorAll('th.is-sortable').forEach((th) => {
    th.addEventListener('click', () => {
      const key = th.dataset.key;
      // 點同欄切換升降冪，點他欄則重置為升冪
      if (sort.key === key) {
        sort.dir = sort.dir === 'asc' ? 'desc' : 'asc';
      } else {
        sort = { key, dir: 'asc' };
      }
      renderHead();
      render();
    });
  });
}

// — 取得目前條件下、排序後的列 —
function getRows() {
  let rows = devices.filter((d) => {
    const matchCat = activeCategory === 'all' || d.category === activeCategory;
    const matchKey = !keyword || d.name.toLowerCase().includes(keyword);
    return matchCat && matchKey;
  });

  const dir = sort.dir === 'asc' ? 1 : -1;
  rows.sort((a, b) => compare(a, b, sort.key) * dir);
  return rows;
}

// 依排序鍵取可比較的值（字串走 localeCompare、數值走相減）
function compare(a, b, key) {
  switch (key) {
    case 'name':     return a.name.localeCompare(b.name, 'zh-Hant');
    case 'category': return categoryName(a.category).localeCompare(categoryName(b.category), 'zh-Hant');
    case 'viewport': return a.vw - b.vw || a.vh - b.vh;
    case 'dpr':      return a.dpr - b.dpr;
    case 'physical': return a.pw - b.pw || a.ph - b.ph;
    case 'ratio':    return a.ratioValue - b.ratioValue;
    default:         return 0;
  }
}

// — 渲染表身 —
function render() {
  const rows = getRows();
  resultCount.textContent = `共 ${rows.length} 款裝置`;

  if (!rows.length) {
    tableBody.innerHTML =
      '<tr><td colspan="7" class="empty-state">找不到符合的裝置，換個關鍵字或類型試試。</td></tr>';
    return;
  }

  tableBody.innerHTML = rows.map(renderRow).join('');
  bindRows();
}

function renderRow(d) {
  const viewport = `${d.vw}×${d.vh}`;
  const physical = `${d.pw}×${d.ph}`;
  const ratio = `${d.ratioValue.toFixed(2)} : 1`;
  return `
    <tr data-viewport="${viewport}">
      <td class="cell-name">${d.name}</td>
      <td><span class="cat-pill cat-${d.category}">${categoryName(d.category)}</span></td>
      <td class="cell-mono cell-accent">${viewport}</td>
      <td class="cell-mono">${d.dpr}×</td>
      <td class="cell-mono">${physical}</td>
      <td class="cell-mono">${ratio}</td>
      <td class="cell-copy"><span class="copy-hint">複製</span></td>
    </tr>`;
}

// — 點列複製 viewport —
function bindRows() {
  tableBody.querySelectorAll('tr[data-viewport]').forEach((tr) => {
    tr.addEventListener('click', async () => {
      const ok = await copyText(tr.dataset.viewport);
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

// — 斷點刻度尺 —
function renderBreakpoints() {
  // 以最大斷點下限的 1.25 倍作刻度總長，讓最後一段也有可視寬度
  const maxMin = Math.max(...breakpoints.map((b) => b.min));
  const scaleMax = maxMin * 1.25 || 1;

  bpScale.innerHTML = breakpoints
    .map((b) => {
      const left = (b.min / scaleMax) * 100;
      return `
        <div class="bp-tick" style="left:${left}%;">
          <span class="bp-name">${b.name}</span>
          <span class="bp-min">${b.min === 0 ? '0' : '≥ ' + b.min}</span>
          <span class="bp-label">${b.label}</span>
        </div>`;
    })
    .join('');
}
