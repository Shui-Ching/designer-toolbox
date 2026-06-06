// ============================================================
// 首頁工具搜尋 — 依關鍵字即時篩選工具卡
// 比對範圍：卡片可見文字（標題／英文名／說明）＋ data-keywords
// ============================================================
(function () {
  const input = document.getElementById('tool-search');
  const count = document.getElementById('tool-count');
  const empty = document.getElementById('index-empty');
  const emptyQuery = document.getElementById('empty-query');
  const cards = Array.from(document.querySelectorAll('.tool-card'));

  // 預先建立每張卡的可搜尋字串，避免每次輸入重算
  const items = cards.map((card) => ({
    el: card,
    text: (card.textContent + ' ' + (card.dataset.keywords || '')).toLowerCase(),
  }));

  // 依關鍵字篩選並更新計數／空狀態
  function apply() {
    const query = input.value.trim().toLowerCase();
    let shown = 0;

    items.forEach(({ el, text }) => {
      const match = query === '' || text.includes(query);
      el.hidden = !match; // 配合 .tool-card[hidden] 規則隱藏
      if (match) shown++;
    });

    count.textContent = shown + ' 項工具';
    empty.hidden = shown !== 0;
    if (shown === 0) emptyQuery.textContent = input.value.trim();
  }

  input.addEventListener('input', apply);
})();
