// ============================================================
// 首頁工具篩選 — 分類 chip × 關鍵字搜尋（交集）＋ 排序
// 比對範圍：卡片可見文字（標題／英文名／說明）＋ data-keywords
// 分類來源：每張卡片的 data-category
// 排序：由舊到新（預設，DOM 原序）／由新到舊／最熱門
// ============================================================

// ── Umami 瀏覽量快照（手動更新，非即時）────────────────────
// 純前端靜態站不能直接打 Umami API：金鑰會外洩、且 CSP 會擋，
// 故改用快照——到 Umami 後台「Pages」報表抄各工具瀏覽量填到這裡。
// key = 卡片 href；數字越大越熱門；沒列到的工具視為 0，排在最後。
// ⚠️ 下列為「範例數字」，請換成真實數據。
const TOOL_POPULARITY = {
  'services/image-compress/index.html': 4200,
  'services/svg-to-font/index.html': 1500,
  'services/social-size/index.html': 3100,
  'services/device-size/index.html': 2600,
  'services/grid-flex/index.html': 1800,
  'services/image-crop/index.html': 2900,
  'services/favicon/index.html': 2200,
  'services/qr-code/index.html': 3600,
  'services/color-palette/index.html': 2400,
  'services/color-convert/index.html': 2000,
  'services/type-scale/index.html': 1200,
  'services/lorem/index.html': 1600,
  'services/word-count/index.html': 2700,
  'services/shadow/index.html': 1900,
  'services/gradient/index.html': 2100,
  'services/image-convert/index.html': 3300,
  'services/decision-spinner/index.html': 2800,
  'services/fake-update/index.html': 3400,
  'services/message-board/index.html': 1400,
  'services/pdf-compress/index.html': 3000,
  'services/pomodoro/index.html': 2500,
  'services/watermark/index.html': 1700,
  'services/unit-convert/index.html': 2300,
  'services/text-case/index.html': 0,
  'services/amount-words/index.html': 0,
  'services/video-compress/index.html': 0,
};

(function () {
  const input = document.getElementById('tool-search');
  const count = document.getElementById('tool-count');
  const empty = document.getElementById('index-empty');
  const emptyQuery = document.getElementById('empty-query');
  const sortSelect = document.getElementById('tool-sort');
  const grid = document.querySelector('.index-grid');
  const chips = Array.from(document.querySelectorAll('.filter-chip'));
  const cards = Array.from(document.querySelectorAll('.tool-card'));

  // 預先建立每張卡的可搜尋字串、分類與排序鍵，避免每次互動重算
  // order：DOM 原始索引 = 加入順序（小→大 = 舊→新）
  const items = cards.map((card, i) => ({
    el: card,
    order: i,
    popularity: TOOL_POPULARITY[card.getAttribute('href')] || 0,
    category: card.dataset.category || '',
    text: (card.textContent + ' ' + (card.dataset.keywords || '')).toLowerCase(),
  }));

  // 目前選取的分類與排序，預設為「全部」「由舊到新」
  let activeCategory = 'all';
  let activeSort = 'old';

  // 依排序模式重排 DOM：appendChild 會搬移既有節點，達到重新排列
  // 熱門度相同時退回原始順序（穩定）
  function applySort() {
    const sorted = items.slice();
    if (activeSort === 'new') {
      sorted.sort((a, b) => b.order - a.order);
    } else if (activeSort === 'hot') {
      sorted.sort((a, b) => b.popularity - a.popularity || a.order - b.order);
    } else {
      sorted.sort((a, b) => a.order - b.order);
    }
    sorted.forEach(({ el }) => grid.appendChild(el));
  }

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

  // 切換排序：重排 DOM 後維持目前的篩選結果
  sortSelect.addEventListener('change', () => {
    activeSort = sortSelect.value;
    applySort();
  });

  input.addEventListener('input', apply);
})();

// — 回到頂端 —
(function () {
  const btn = document.getElementById('go-top');
  if (!btn) return;

  window.addEventListener('scroll', function () {
    btn.classList.toggle('is-visible', window.scrollY > 300);
  }, { passive: true });

  btn.addEventListener('click', function () {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
})();
