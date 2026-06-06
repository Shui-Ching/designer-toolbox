// ============================================================
// 首頁工具篩選 — 分類 chip × 關鍵字搜尋（兩者交集）
// 比對範圍：卡片可見文字（標題／英文名／說明）＋ data-keywords
// 分類來源：每張卡片的 data-category
// ============================================================
(function () {
  const input = document.getElementById('tool-search');
  const count = document.getElementById('tool-count');
  const empty = document.getElementById('index-empty');
  const emptyQuery = document.getElementById('empty-query');
  const chips = Array.from(document.querySelectorAll('.filter-chip'));
  const cards = Array.from(document.querySelectorAll('.tool-card'));

  // 預先建立每張卡的可搜尋字串與分類，避免每次輸入重算
  const items = cards.map((card) => ({
    el: card,
    category: card.dataset.category || '',
    text: (card.textContent + ' ' + (card.dataset.keywords || '')).toLowerCase(),
  }));

  // 目前選取的分類，預設為「全部」
  let activeCategory = 'all';

  // 依分類與關鍵字交集篩選，並更新計數／空狀態
  function apply() {
    const query = input.value.trim().toLowerCase();
    let shown = 0;

    items.forEach(({ el, category, text }) => {
      const matchCategory = activeCategory === 'all' || category === activeCategory;
      const matchQuery = query === '' || text.includes(query);
      const match = matchCategory && matchQuery;
      el.hidden = !match; // 配合 .tool-card[hidden] 規則隱藏
      if (match) shown++;
    });

    count.textContent = shown + ' 項工具';
    empty.hidden = shown !== 0;
    if (shown === 0) emptyQuery.textContent = input.value.trim();
  }

  // 點分類 chip：切換 active 樣式與 aria 狀態，再重新篩選
  chips.forEach((chip) => {
    chip.addEventListener('click', () => {
      activeCategory = chip.dataset.filter || 'all';
      chips.forEach((c) => {
        const on = c === chip;
        c.classList.toggle('is-active', on);
        c.setAttribute('aria-pressed', String(on));
      });
      apply();
    });
  });

  input.addEventListener('input', apply);
})();
