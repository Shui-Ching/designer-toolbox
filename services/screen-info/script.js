// ============================================================
// 45 我的螢幕資訊 — 偵測本機解析度／視窗大小／DPR／觸控／目前斷點
// 純本機讀值，resize 即時更新；偵測值不送 Umami、不進 URL。
// 斷點沿用 04 號 device-size 的 shared/data/device-sizes.json 同一組
// Bootstrap 5 預設值，直接內建常數（此頁定位是「隨開即用的診斷頁」，
// 不因額外 fetch 而在 file:// 或離線時失效）。
// ============================================================
import { copyText, track } from '../../shared/scripts/shared.js?v=202607140956';

const valResolution = document.getElementById('val-resolution');
const valWindow = document.getElementById('val-window');
const valDpr = document.getElementById('val-dpr');
const valTouch = document.getElementById('val-touch');
const valBreakpoint = document.getElementById('val-breakpoint');
const valBreakpointNote = document.getElementById('val-breakpoint-note');
const copyReportBtn = document.getElementById('copy-report-btn');
const copyHint = document.getElementById('copy-hint');

// Bootstrap 5 預設斷點（min-width 由小到大），與 04 號 device-size 資料一致
const BREAKPOINTS = [
  { name: 'xs', min: 0, label: '手機（直向）' },
  { name: 'sm', min: 576, label: '手機（橫向）' },
  { name: 'md', min: 768, label: '平板' },
  { name: 'lg', min: 992, label: '小筆電 / 桌機' },
  { name: 'xl', min: 1200, label: '桌機' },
  { name: 'xxl', min: 1400, label: '大螢幕桌機' },
];

function currentBreakpoint(width) {
  let match = BREAKPOINTS[0];
  for (const bp of BREAKPOINTS) {
    if (width >= bp.min) match = bp;
  }
  return match;
}

function hasTouch() {
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}

function pad(n) { return String(n).padStart(2, '0'); }

// — 取得目前狀態（渲染與診斷報告共用同一份數值，避免兩處算出不一致）—
function measure() {
  const winW = window.innerWidth;
  return {
    screenW: screen.width,
    screenH: screen.height,
    winW,
    winH: window.innerHeight,
    dpr: window.devicePixelRatio,
    touch: hasTouch(),
    bp: currentBreakpoint(winW),
  };
}

function render() {
  const d = measure();
  valResolution.textContent = `${d.screenW} × ${d.screenH} px`;
  valWindow.textContent = `${d.winW} × ${d.winH} px`;
  valDpr.textContent = `${d.dpr}×`;
  valTouch.textContent = d.touch ? '支援' : '不支援';
  valBreakpoint.textContent = `${d.bp.name.toUpperCase()}`;
  valBreakpointNote.textContent = `${d.bp.label}，≥ ${d.bp.min}px`;
}

function buildReport() {
  const d = measure();
  const now = new Date();
  const ts = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
  return [
    '【我的螢幕資訊 診斷報告】',
    `螢幕解析度：${d.screenW} × ${d.screenH} px`,
    `視窗大小：${d.winW} × ${d.winH} px（CSS px）`,
    `裝置像素比（DPR）：${d.dpr}×`,
    `觸控支援：${d.touch ? '是' : '否'}`,
    `目前斷點：${d.bp.name.toUpperCase()}（${d.bp.label}，≥ ${d.bp.min}px）`,
    '—',
    `產生時間：${ts}`,
  ].join('\n');
}

let hintTimer = null;
function flashHint(msg) {
  copyHint.textContent = msg;
  clearTimeout(hintTimer);
  hintTimer = setTimeout(() => { copyHint.textContent = ''; }, 1600);
}

copyReportBtn.addEventListener('click', async () => {
  const ok = await copyText(buildReport());
  if (ok) track('use');
  flashHint(ok ? '已複製診斷報告 ✓' : '複製失敗');
});

window.addEventListener('resize', render);
render();
