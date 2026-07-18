// ============================================================
// 03 社群尺寸建議 — 載入資料、平台篩選、點卡片複製尺寸
// ============================================================
import { copyText, track } from '../../shared/scripts/shared.js?v=202607181201';

const filterBar = document.getElementById('filter-bar');
const platformList = document.getElementById('platform-list');

// 目前選中的平台 id，'all' 代表全部
let activePlatform = 'all';
let platforms = [];

// 比例預覽塊的最大尺寸（px）：以較長邊塞滿，維持原比例
const PREVIEW_MAX_W = 120;
const PREVIEW_MAX_H = 76;

init();

async function init() {
  try {
    const res = await fetch('../../shared/data/social-sizes.json');
    const data = await res.json();
    platforms = data.platforms || [];
  } catch {
    platformList.innerHTML =
      '<p class="empty-state">資料載入失敗，請確認以本機伺服器或靜態空間開啟（file:// 直開會被瀏覽器擋下 fetch）。</p>';
    return;
  }
  renderFilter();
  renderPlatforms();
}

// — 篩選列：全部 + 各平台 —
function renderFilter() {
  const chips = [{ id: 'all', name: '全部' }, ...platforms];
  filterBar.innerHTML = chips
    .map(
      (p) =>
        `<button type="button" class="filter-chip${p.id === activePlatform ? ' is-active' : ''}" data-platform="${p.id}">${p.name}</button>`
    )
    .join('');

  filterBar.querySelectorAll('.filter-chip').forEach((btn) => {
    btn.addEventListener('click', () => {
      activePlatform = btn.dataset.platform;
      filterBar
        .querySelectorAll('.filter-chip')
        .forEach((b) => b.classList.toggle('is-active', b === btn));
      renderPlatforms();
    });
  });
}

// — 平台分區 —
function renderPlatforms() {
  const shown =
    activePlatform === 'all'
      ? platforms
      : platforms.filter((p) => p.id === activePlatform);

  platformList.innerHTML = shown.map(renderBlock).join('');
  bindCards();
}

function renderBlock(p) {
  const cards = p.formats.map((f) => renderCard(f)).join('');
  return `
    <section class="platform-block">
      <div class="platform-head">
        <h2 class="platform-name">${p.name}</h2>
        <span class="platform-count">${p.formats.length} 版位</span>
      </div>
      ${p.note ? `<p class="platform-note">${p.note}</p>` : ''}
      <div class="size-grid">${cards}</div>
    </section>`;
}

function renderCard(f) {
  const dim = `${f.width}×${f.height}`;
  const { w, h } = previewSize(f.width, f.height);
  return `
    <article class="size-card" data-dim="${dim}">
      <div class="ratio-preview">
        <span class="ratio-shape" style="width:${w}px;height:${h}px;"></span>
      </div>
      <div class="size-card-body">
        <span class="size-card-label">${f.label}</span>
        <span class="size-card-dim">${dim}</span>
      </div>
      <div class="size-card-foot">
        <span class="badge">${f.ratio}</span>
        <span class="size-card-copy">點擊複製</span>
      </div>
    </article>`;
}

// 依原始寬高換算預覽塊尺寸：較長邊塞滿上限，維持比例
function previewSize(width, height) {
  const scale = Math.min(PREVIEW_MAX_W / width, PREVIEW_MAX_H / height);
  return {
    w: Math.max(8, Math.round(width * scale)),
    h: Math.max(8, Math.round(height * scale)),
  };
}

// — 點卡片複製尺寸 —
function bindCards() {
  platformList.querySelectorAll('.size-card').forEach((card) => {
    card.addEventListener('click', async () => {
      const dim = card.dataset.dim;
      const ok = await copyText(dim);
      if (ok) track('use');
      const hint = card.querySelector('.size-card-copy');
      card.classList.add('is-copied');
      hint.textContent = ok ? '已複製 ✓' : '複製失敗';
      setTimeout(() => {
        card.classList.remove('is-copied');
        hint.textContent = '點擊複製';
      }, 1400);
    });
  });
}
