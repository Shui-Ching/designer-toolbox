// ============================================================
// 37 特殊符號複製器 — 載入資料、搜尋、分類篩選、依分類分區、點卡複製符號
// ============================================================
import { copyText, escapeHtml, track } from '../../shared/scripts/shared.js?v=202607172333';

const searchInput = document.getElementById('search');
const filterBar = document.getElementById('filter-bar');
const resultCount = document.getElementById('result-count');
const symbolList = document.getElementById('symbol-list');

// 資料與狀態
let symbols = [];
let categories = [];
let activeCategory = 'all';
let keyword = '';

init();

async function init() {
  try {
    const res = await fetch('../../shared/data/special-chars.json');
    const data = await res.json();
    categories = data.categories || [];
    symbols = data.symbols || [];
  } catch {
    symbolList.innerHTML =
      '<p class="empty-state">資料載入失敗，請以本機伺服器或靜態空間開啟（file:// 直開會被瀏覽器擋下 fetch）。</p>';
    return;
  }
  renderFilter();
  render();
}

// — 分類篩選列 —
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

// — 取得目前條件下符合的符號 —
function getMatches() {
  return symbols.filter((s) => {
    const matchCat = activeCategory === 'all' || s.category === activeCategory;
    const haystack = (s.char + ' ' + s.name + ' ' + (s.keywords || '')).toLowerCase();
    const matchKey = !keyword || haystack.includes(keyword);
    return matchCat && matchKey;
  });
}

// — 渲染：依分類分區 + 每區一個符號網格 —
function render() {
  const matches = getMatches();
  resultCount.textContent = `共 ${matches.length} 個符號`;

  if (!matches.length) {
    symbolList.innerHTML = '<p class="empty-state">找不到符合的符號，換個關鍵字或分類試試。</p>';
    return;
  }

  // 依 categories 原始順序分組，只顯示有資料的分類
  const blocks = categories
    .map((cat) => ({ cat, items: matches.filter((s) => s.category === cat.id) }))
    .filter((b) => b.items.length);

  symbolList.innerHTML = blocks.map(renderBlock).join('');
  bindCards();
}

function renderBlock({ cat, items }) {
  return `
    <div class="category-block">
      <div class="category-head">
        <span class="category-name">${escapeHtml(cat.name)}</span>
        <span class="category-count">${items.length} 個</span>
      </div>
      <div class="symbol-grid">
        ${items.map(renderCard).join('')}
      </div>
    </div>`;
}

function renderCard(s) {
  return `
    <div class="symbol-card" data-copy="${escapeHtml(s.char)}">
      <div class="symbol-glyph">${escapeHtml(s.char)}</div>
      <div class="symbol-name">${escapeHtml(s.name)}</div>
      <div class="copy-hint">複製</div>
    </div>`;
}

// — 點卡複製符號 —
function bindCards() {
  symbolList.querySelectorAll('.symbol-card[data-copy]').forEach((card) => {
    card.addEventListener('click', async () => {
      const ok = await copyText(card.dataset.copy);
      if (ok) track('use');
      const hint = card.querySelector('.copy-hint');
      card.classList.add('is-copied');
      if (hint) hint.textContent = ok ? '已複製 ✓' : '失敗';
      setTimeout(() => {
        card.classList.remove('is-copied');
        if (hint) hint.textContent = '複製';
      }, 1400);
    });
  });
}
