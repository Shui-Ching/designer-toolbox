// ============================================================
// 25 影片壓縮 — WebCodecs 重新編碼
// mediabunny 拆軌（demux）→ 瀏覽器原生 VideoDecoder/VideoEncoder 硬體加速
// 重編 H.264 → 重組 MP4；聲音在格式允許時直接複製、不重新編碼
// mediabunny 為本機 vendor（維持 CSP script-src 'self'），首次拖檔才動態載入
// ============================================================
import { downloadBlob, formatBytes, bindDropzone, escapeHtml, track } from '../../shared/scripts/shared.js?v=202607140956';

const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('file-input');
const resGroup = document.getElementById('res-group');
const qualitySlider = document.getElementById('quality');
const qualityValue = document.getElementById('quality-value');
const engineStatus = document.getElementById('engine-status');
const unsupported = document.getElementById('unsupported');
const results = document.getElementById('results');
const resultsSummary = document.getElementById('results-summary');
const resultList = document.getElementById('result-list');
const downloadAllBtn = document.getElementById('download-all');
const clearAllBtn = document.getElementById('clear-all');

// 大檔提示門檻：超過即在該列標註「檔案較大，處理需要一些時間」
const BIG_FILE = 300 * 1024 * 1024; // 300 MB

// 壓縮設定（任一改動就把所有項目重壓）
// res：輸出短邊上限（0 = 維持原始，不放大）；quality 映射成目標位元率
const settings = {
  res: 0,
  quality: 0.7,
};

// 每筆：{ id, name, originalSize, file, input, videoTrack, width, height,
//        duration, fps, srcBitrate, blob, outName, outW, outH,
//        status, error, progress, thumb, big, audioDropped, conversion }
// status：parsing｜queued｜processing｜done｜error
let items = [];
let nextId = 1;

// — 重壓佇列控制 —
// runToken 一變更代表設定已換，進行中的轉換會被取消，由 finally 重新開跑
let runToken = 0;
let running = false;

// 動態載入的函式庫（首次拖檔才載）
let libs = null;

init();

function init() {
  // WebCodecs 功能偵測：不支援就亮出提示、停用拖放區
  if (typeof VideoEncoder === 'undefined' || typeof VideoDecoder === 'undefined') {
    unsupported.hidden = false;
    dropzone.classList.add('is-disabled');
    dropzone.setAttribute('aria-disabled', 'true');
    return;
  }

  bindDropzone(dropzone, addFiles);
  dropzone.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    if (fileInput.files.length) addFiles(fileInput.files);
    fileInput.value = ''; // 清空以便重選同檔
  });

  // 解析度（改動即重壓全部）
  resGroup.addEventListener('click', (e) => {
    const btn = e.target.closest('.res-chip');
    if (!btn) return;
    settings.res = Number(btn.dataset.res);
    setActive(resGroup, btn);
    reprocessAll();
  });

  // 品質滑桿：拖曳即時更新數字、放開才重壓（避免每格都重編整支影片）
  qualitySlider.addEventListener('input', () => {
    settings.quality = Number(qualitySlider.value) / 100;
    qualityValue.textContent = `${qualitySlider.value}%`;
  });
  qualitySlider.addEventListener('change', reprocessAll);

  downloadAllBtn.addEventListener('click', downloadAll);
  clearAllBtn.addEventListener('click', clearAll);
}

// — 首次載入 mediabunny（本機 vendor）—
async function loadLibs() {
  if (libs) return libs;
  engineStatus.hidden = false;
  try {
    libs = await import('./vendor/mediabunny.min.mjs');
    return libs;
  } finally {
    engineStatus.hidden = true;
  }
}

// — 切換按鈕群組的 is-active —
function setActive(group, activeBtn) {
  group.querySelectorAll('button').forEach((b) => b.classList.toggle('is-active', b === activeBtn));
}

// — 接收檔案：過濾影片、逐支解析、排入壓縮佇列 —
async function addFiles(fileList) {
  const files = [...fileList].filter(
    (f) => f.type.startsWith('video/') || /\.(mp4|mov|m4v|webm|mkv)$/i.test(f.name)
  );
  if (!files.length) return;

  await loadLibs(); // 首次會下載壓縮引擎

  for (const file of files) {
    const item = {
      id: nextId++,
      name: file.name,
      originalSize: file.size,
      file,
      input: null,
      videoTrack: null,
      width: 0,
      height: 0,
      duration: 0,
      fps: 0,
      srcBitrate: 0,
      blob: null,
      outName: file.name.replace(/\.[^.]+$/, '') + '-compressed.mp4',
      outW: 0,
      outH: 0,
      status: 'parsing',
      error: '',
      progress: null,
      thumb: '',
      big: file.size > BIG_FILE,
      audioDropped: false,
      conversion: null,
    };
    items.push(item);
    render();

    try {
      // BlobSource 直接從磁碟串流讀取，不會把整支影片塞進記憶體
      item.input = new libs.Input({ source: new libs.BlobSource(file), formats: libs.ALL_FORMATS });
      const video = await item.input.getPrimaryVideoTrack();
      if (!video) throw new Error('找不到視訊軌，請確認這是影片檔');
      if (!(await video.canDecode())) throw new Error('此影片的編碼格式無法在這個瀏覽器解碼');

      item.videoTrack = video;
      item.width = video.displayWidth;
      item.height = video.displayHeight;
      item.duration = await item.input.computeDuration();
      // 取樣前段封包估 fps 與來源視訊位元率（供目標位元率計算），不必掃完整支
      const stats = await video.computePacketStats(120);
      item.fps = stats.averagePacketRate || 30;
      item.srcBitrate = stats.averageBitrate || 0;
      item.thumb = await makeThumb(video);
      item.status = 'queued';
    } catch (e) {
      item.status = 'error';
      item.error = e?.message || '無法解析此影片';
    }
    render();
  }

  run();
}

// — 首格縮圖（固定小尺寸，僅供清單預覽；不隨設定重繪）—
async function makeThumb(videoTrack) {
  try {
    const sink = new libs.CanvasSink(videoTrack, { width: 112 });
    const first = await videoTrack.getFirstTimestamp();
    const wrapped = await sink.getCanvas(Math.max(first, 0));
    if (!wrapped) return '';
    const canvas = document.createElement('canvas');
    canvas.width = wrapped.canvas.width;
    canvas.height = wrapped.canvas.height;
    canvas.getContext('2d').drawImage(wrapped.canvas, 0, 0);
    return canvas.toDataURL('image/jpeg', 0.7);
  } catch {
    return ''; // 縮圖失敗不影響壓縮
  }
}

// — 輸出尺寸：解析度檔位限制「短邊」，等比縮小、絕不放大；取偶數符合 H.264 —
function outputSize(item) {
  const preset = settings.res;
  const shortSide = Math.min(item.width, item.height);
  if (!preset || shortSide <= preset) {
    return { outW: item.width, outH: item.height };
  }
  const k = preset / shortSide;
  return {
    outW: Math.round((item.width * k) / 2) * 2,
    outH: Math.round((item.height * k) / 2) * 2,
  };
}

// — 目標位元率：品質映射 bits-per-pixel，再以輸出像素 × fps 換算 —
// 70% 約 0.11 bpp（1080p/30fps ≈ 6.9 Mbps）；同時不超過來源位元率的 85%，
// 避免「重編碼後反而變大」的徒勞
function targetBitrate(item, outW, outH) {
  const bpp = 0.02 + settings.quality * 0.13;
  let bitrate = outW * outH * item.fps * bpp;
  if (item.srcBitrate) bitrate = Math.min(bitrate, item.srcBitrate * 0.85);
  return Math.max(Math.round(bitrate), 150_000);
}

// — 設定變更：取消進行中的轉換、把可重壓的項目重新排隊、重新開跑 —
function reprocessAll() {
  runToken++;
  items.forEach((it) => {
    it.conversion?.cancel().catch(() => {});
    if (it.status !== 'error' && it.status !== 'parsing') it.status = 'queued';
  });
  run();
}

// — 佇列主迴圈：依序壓縮所有 queued 項目；設定中途變更即中止並重啟 —
async function run() {
  if (running) return;
  running = true;
  const token = runToken;
  try {
    for (const item of items) {
      if (token !== runToken) break; // 設定已變更，放棄這輪
      if (item.status !== 'queued') continue;
      await compress(item, token);
    }
  } finally {
    running = false;
    if (token !== runToken) run(); // 中途有變更 → 重新開跑
  }
}

// — 壓縮單支：mediabunny Conversion 全包 demux→重編→mux，回報整體進度 —
async function compress(item, token) {
  item.status = 'processing';
  item.progress = 0;
  render();

  try {
    const { outW, outH } = outputSize(item);
    const target = new libs.BufferTarget();
    const output = new libs.Output({
      format: new libs.Mp4OutputFormat({ fastStart: 'in-memory' }),
      target,
    });

    const conversion = await libs.Conversion.init({
      input: item.input,
      output,
      video: {
        codec: 'avc', // 輸出統一 H.264，相容性最廣
        width: outW,
        height: outH,
        fit: 'fill', // 寬高已等比換算，fill 不會變形
        bitrate: targetBitrate(item, outW, outH),
      },
      // audio 不設定 → 能複製就原樣複製，不行才自動轉碼
      showWarnings: false,
    });

    if (!conversion.isValid) {
      throw new Error('此影片無法以 H.264 重新編碼');
    }
    // 聲音軌若因瀏覽器限制被捨棄，完成後在該列提醒
    item.audioDropped = (conversion.discardedTracks || []).some(
      (d) => d.track?.type === 'audio'
    );

    item.conversion = conversion;
    conversion.onProgress = (p) => {
      if (token !== runToken) {
        conversion.cancel().catch(() => {});
        return;
      }
      const pct = Math.floor(p * 100);
      if (pct !== item.progress) {
        item.progress = pct;
        render();
      }
    };

    await conversion.execute();
    if (token !== runToken) return;

    item.blob = new Blob([target.buffer], { type: 'video/mp4' });
    item.outW = outW;
    item.outH = outH;
    item.status = 'done';
  } catch (e) {
    // 設定變更導致的取消不算錯誤，由新一輪接手重壓
    if (token !== runToken || e?.name === 'ConversionCanceledError') return;
    item.status = 'error';
    item.error = '壓縮失敗：' + (e?.message || '未知錯誤');
  } finally {
    item.conversion = null;
  }
  item.progress = null;
  render();
}

// — 渲染結果列表與總計 —
function render() {
  if (!items.length) {
    results.hidden = true;
    return;
  }
  results.hidden = false;

  // 總計只納入已完成的項目
  const done = items.filter((it) => it.status === 'done' && it.blob);
  if (done.length) {
    const totalOriginal = done.reduce((s, it) => s + it.originalSize, 0);
    const totalOut = done.reduce((s, it) => s + it.blob.size, 0);
    const saved = totalOriginal - totalOut;
    const savedPct = totalOriginal ? Math.round((saved / totalOriginal) * 100) : 0;
    const sign = saved >= 0 ? '省下' : '增加';
    resultsSummary.innerHTML =
      `已完成 <strong>${done.length}</strong> / ${items.length} 支 · ` +
      `${formatBytes(totalOriginal)} → <strong>${formatBytes(totalOut)}</strong> · ` +
      `${sign} <strong class="${saved >= 0 ? 'text-accent' : 'text-warn'}">${Math.abs(savedPct)}%</strong>`;
  } else {
    resultsSummary.innerHTML = `共 <strong>${items.length}</strong> 支 · 處理中…`;
  }

  resultList.innerHTML = items.map(renderItem).join('');
  bindItems();
}

function renderItem(it) {
  const thumb = it.thumb
    ? `<img class="result-thumb" src="${it.thumb}" alt="${escapeHtml(it.name)} 首格畫面" loading="lazy">`
    : `<span class="result-thumb result-thumb-empty" aria-hidden="true">影片</span>`;

  return `
    <li class="result-item is-${it.status}" data-id="${it.id}">
      ${thumb}
      <div class="result-info">
        <p class="result-name" title="${escapeHtml(it.name)}">${escapeHtml(it.name)}</p>
        ${renderMeta(it)}
      </div>
      <div class="result-size">${renderSize(it)}</div>
      <div class="result-actions">
        ${it.status === 'done'
          ? `<button type="button" class="btn result-download" data-id="${it.id}">下載</button>`
          : ''}
        <button type="button" class="result-remove" data-id="${it.id}" aria-label="移除">✕</button>
      </div>
    </li>`;
}

// — 中段：依狀態顯示尺寸／時長／進度／錯誤 —
function renderMeta(it) {
  if (it.status === 'error') {
    return `<p class="result-meta is-error">${escapeHtml(it.error)}</p>`;
  }
  if (it.status === 'parsing') {
    return `<p class="result-meta">解析中…</p>`;
  }
  if (it.status === 'processing') {
    const pct = it.progress || 0;
    return `
      <p class="result-meta">壓縮中… ${pct}%</p>
      <div class="progress" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100">
        <span class="progress-bar" style="width:${pct}%"></span>
      </div>`;
  }
  // queued / done
  const src = `${it.width}×${it.height} · ${formatDuration(it.duration)}`;
  const big = it.big ? `<span class="result-warn">檔案較大，處理需要一些時間</span>` : '';
  const audio = it.audioDropped ? `<span class="result-warn">聲音軌無法保留</span>` : '';
  const tail = it.status === 'queued'
    ? '等待壓縮'
    : `輸出 ${it.outW}×${it.outH} · 品質 ${Math.round(settings.quality * 100)}%`;
  return `<p class="result-meta">${src} · ${tail}${[big, audio].filter(Boolean).map((s) => ' · ' + s).join('')}</p>`;
}

// — 右段：完成才顯示大小對比 —
function renderSize(it) {
  if (it.status !== 'done' || !it.blob) return '';
  const out = it.blob.size;
  const diff = it.originalSize - out;
  const pct = it.originalSize ? Math.round((diff / it.originalSize) * 100) : 0;
  const up = diff < 0; // 壓完反而變大
  return `
    <span class="size-from">${formatBytes(it.originalSize)}</span>
    <span class="size-arrow">→</span>
    <span class="size-to">${formatBytes(out)}</span>
    <span class="reduction ${up ? 'is-up' : ''}">${up ? '+' : '−'}${Math.abs(pct)}%</span>`;
}

// — 秒數轉 m:ss 顯示 —
function formatDuration(sec) {
  const s = Math.round(sec || 0);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// — 綁定單支的下載 / 移除 —
function bindItems() {
  resultList.querySelectorAll('.result-download').forEach((btn) => {
    btn.addEventListener('click', () => {
      const it = items.find((x) => x.id === Number(btn.dataset.id));
      if (it?.blob) { downloadBlob(it.blob, it.outName); track('use'); }
    });
  });
  resultList.querySelectorAll('.result-remove').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = Number(btn.dataset.id);
      const it = items.find((x) => x.id === id);
      it?.conversion?.cancel().catch(() => {}); // 移除進行中項目先取消轉換
      items = items.filter((x) => x.id !== id);
      render();
    });
  });
}

// — 全部下載（只下載已完成者，依序觸發避免被瀏覽器擋）—
function downloadAll() {
  const done = items.filter((it) => it.status === 'done' && it.blob);
  done.forEach((it, i) => setTimeout(() => downloadBlob(it.blob, it.outName), i * 150));
  if (done.length) track('use');
}

// — 清空 —
function clearAll() {
  runToken++; // 中止任何進行中的壓縮
  items.forEach((it) => it.conversion?.cancel().catch(() => {}));
  items = [];
  render();
}
