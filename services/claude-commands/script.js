// ============================================================
// 36 Claude 指令查找器 — 載入資料、搜尋、分類篩選、依分類分區、點卡複製指令名稱
// ============================================================
import { copyText, escapeHtml, track } from '../../shared/scripts/shared.js?v=202607131742';

const searchInput = document.getElementById('search');
const filterBar = document.getElementById('filter-bar');
const resultCount = document.getElementById('result-count');
const commandList = document.getElementById('command-list');

// 資料與狀態
let commands = [];
let categories = [];
let activeCategory = 'all';
let keyword = '';

init();

async function init() {
  try {
    const res = await fetch('../../shared/data/claude-commands.json');
    const data = await res.json();
    categories = data.categories || [];
    commands = data.commands || [];
  } catch {
    commandList.innerHTML =
      '<p class="empty-state">資料載入失敗，請以本機伺服器或靜態空間開啟（file:// 直開會被瀏覽器擋下 fetch）。</p>';
    return;
  }
  renderFilter();
  render();
}

function categoryName(id) {
  return categories.find((c) => c.id === id)?.name || id;
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

// — 取得目前條件下符合的指令 —
function getMatches() {
  return commands.filter((c) => {
    const matchCat = activeCategory === 'all' || c.category === activeCategory;
    const haystack = (c.name + ' ' + (c.alias || '') + ' ' + c.desc).toLowerCase();
    const matchKey = !keyword || haystack.includes(keyword);
    return matchCat && matchKey;
  });
}

// — 渲染：依分類分區 + 每區一個卡片網格 —
function render() {
  const matches = getMatches();
  resultCount.textContent = `共 ${matches.length} 個指令`;

  if (!matches.length) {
    commandList.innerHTML = '<p class="empty-state">找不到符合的指令，換個關鍵字或分類試試。</p>';
    return;
  }

  // 依 categories 原始順序分組，只顯示有資料的分類
  const blocks = categories
    .map((cat) => ({ cat, items: matches.filter((c) => c.category === cat.id) }))
    .filter((b) => b.items.length);

  commandList.innerHTML = blocks.map(renderBlock).join('');
  bindCards();
}

function renderBlock({ cat, items }) {
  return `
    <div class="category-block">
      <div class="category-head">
        <span class="category-name">${escapeHtml(cat.name)}</span>
        <span class="category-count">${items.length} 個</span>
      </div>
      <div class="command-grid">
        ${items.map(renderCard).join('')}
      </div>
    </div>`;
}

function renderCard(c) {
  const alias = c.alias ? `<div class="cmd-alias">別名：${escapeHtml(c.alias)}</div>` : '';
  const usage = c.usage ? `<div class="cmd-usage">用法：${escapeHtml(c.name)} ${escapeHtml(c.usage)}</div>` : '';
  const deprecated = c.deprecated ? ' is-deprecated' : '';
  return `
    <div class="command-card${deprecated}" data-copy="${escapeHtml(c.name)}">
      <div class="cmd-name">${escapeHtml(c.name)}</div>
      ${alias}
      <div class="cmd-desc">${escapeHtml(c.desc)}</div>
      ${usage}
      <div class="cmd-foot"><span class="copy-hint">複製</span></div>
    </div>`;
}

// — 點卡複製指令名稱 —
function bindCards() {
  commandList.querySelectorAll('.command-card[data-copy]').forEach((card) => {
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
