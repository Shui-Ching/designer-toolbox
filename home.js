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
// 資料來源：Umami 後台 Pages 報表，pageviews 欄位（截至 2026-06-24）
const TOOL_POPULARITY = {
  'services/fake-update/index.html': 292,
  'services/decision-spinner/index.html': 220,
  'services/message-board/index.html': 218,
  'services/social-size/index.html': 193,
  'services/image-compress/index.html': 187,
  'services/image-crop/index.html': 115,
  'services/device-size/index.html': 113,
  'services/image-convert/index.html': 106,
  'services/grid-flex/index.html': 94,
  'services/qr-code/index.html': 90,
  'services/color-palette/index.html': 88,
  'services/lorem/index.html': 81,
  'services/favicon/index.html': 76,
  'services/type-scale/index.html': 71,
  'services/shadow/index.html': 70,
  'services/svg-to-font/index.html': 69,
  'services/gradient/index.html': 60,
  'services/pomodoro/index.html': 58,
  'services/word-count/index.html': 49,
  'services/color-convert/index.html': 43,
  'services/watermark/index.html': 29,
  'services/unit-convert/index.html': 26,
  'services/pdf-compress/index.html': 18,
  'services/amount-words/index.html': 9,
  'services/text-case/index.html': 6,
  'services/pangu/index.html': 0,
  'services/contrast-checker/index.html': 0,
  'services/cubic-bezier/index.html': 0,
  'services/clamp-calc/index.html': 0,
  'services/color-extractor/index.html': 0,
  'services/paper-size/index.html': 0,
  'services/base64/index.html': 0,
  'services/svg-optimizer/index.html': 0,
  'services/lottery/index.html': 0,
  'services/gif-compress/index.html': 0,
  'services/claude-commands/index.html': 0,
  'services/special-chars/index.html': 0,
  'services/json-formatter/index.html': 0,
  'services/timestamp-convert/index.html': 0,
  'services/text-diff/index.html': 0,
  'services/regex-tester/index.html': 0,
  'services/table-convert/index.html': 0,
  'services/font-preview/index.html': 0,
  'services/placeholder-image/index.html': 0,
  'services/screen-info/index.html': 0,
  'services/richmenu-preview/index.html': 0,
  'services/clip-path/index.html': 0,
  'services/blob-generator/index.html': 0,
  'services/noise-texture/index.html': 0,
  'services/exif-viewer/index.html': 0,
  'services/emoji-picker/index.html': 0,
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

  // 目前選取的分類與排序，預設為「全部」「由新到舊」（最新功能在前）
  let activeCategory = 'all';
  let activeSort = 'new';

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

  // 初始化：套用預設排序（由新到舊），讓最新功能在進站時就排在最前
  applySort();
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
