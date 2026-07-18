// ============================================================
// 51 Emoji 查找複製 — 載入資料、搜尋、分類篩選、依分類分區、點卡複製 Emoji
// 架構複製 37 號 special-chars，只換資料來源與語彙
// ============================================================
import { copyText, escapeHtml, track } from '../../shared/scripts/shared.js?v=202607181532';

const searchInput = document.getElementById('search');
const filterBar = document.getElementById('filter-bar');
const resultCount = document.getElementById('result-count');
const emojiList = document.getElementById('emoji-list');

// 資料與狀態
let emojis = [];
let categories = [];
let activeCategory = 'all';
let keyword = '';

init();

async function init() {
  try {
    const res = await fetch('../../shared/data/emoji.json');
    const data = await res.json();
    categories = data.categories || [];
    emojis = data.emojis || [];
  } catch {
    emojiList.innerHTML =
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

// — 取得目前條件下符合的 Emoji —
function getMatches() {
  return emojis.filter((e) => {
    const matchCat = activeCategory === 'all' || e.category === activeCategory;
    const haystack = (e.char + ' ' + e.name + ' ' + (e.keywords || '')).toLowerCase();
    const matchKey = !keyword || haystack.includes(keyword);
    return matchCat && matchKey;
  });
}

// — 渲染：依分類分區 + 每區一個 Emoji 網格 —
function render() {
  const matches = getMatches();
  resultCount.textContent = `共 ${matches.length} 個 Emoji`;

  if (!matches.length) {
    emojiList.innerHTML = '<p class="empty-state">找不到符合的 Emoji，換個關鍵字或分類試試。</p>';
    return;
  }

  // 依 categories 原始順序分組，只顯示有資料的分類
  const blocks = categories
    .map((cat) => ({ cat, items: matches.filter((e) => e.category === cat.id) }))
    .filter((b) => b.items.length);

  emojiList.innerHTML = blocks.map(renderBlock).join('');
  bindCards();
}

function renderBlock({ cat, items }) {
  return `
    <div class="category-block">
      <div class="category-head">
        <span class="category-name">${escapeHtml(cat.name)}</span>
        <span class="category-count">${items.length} 個</span>
      </div>
      <div class="emoji-grid">
        ${items.map(renderCard).join('')}
      </div>
    </div>`;
}

function renderCard(e) {
  return `
    <div class="emoji-card" data-copy="${escapeHtml(e.char)}">
      <div class="emoji-glyph">${escapeHtml(e.char)}</div>
      <div class="emoji-name">${escapeHtml(e.name)}</div>
      <div class="copy-hint">複製</div>
    </div>`;
}

// — 點卡複製 Emoji —
function bindCards() {
  emojiList.querySelectorAll('.emoji-card[data-copy]').forEach((card) => {
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
