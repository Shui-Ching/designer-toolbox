// ============================================================
// 共用函式 — 各工具共享的小工具，無框架、原生 ES Module
// ============================================================

// 觸發瀏覽器下載一個 Blob
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// 複製文字到剪貼簿，回傳是否成功
export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

// 把 bytes 轉成易讀的檔案大小字串
export function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

// 跳脫 HTML 特殊字元 — 把使用者輸入（如上傳檔名）安全插進 innerHTML，避免 XSS
export function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

// 送出一筆分析事件給 Umami；未載入時靜默略過，自動帶上本頁的工具代號（body[data-tool]）
// 注意：只送工具代號等中性資訊，切勿把使用者的檔名或檔案內容當參數送出
export function track(event, data = {}) {
  const tool = document.body?.dataset.tool;
  window.umami?.track(event, tool ? { tool, ...data } : data);
}

// 掛載全站共用頁尾（所有頁面統一，包含隱私說明）
function mountFooter() {
  const el = document.querySelector('footer.site-foot');
  if (!el) return;
  el.innerHTML =
    '<a href="https://forms.gle/VAFZCfakxrVvpTdq6" target="_blank" rel="noopener noreferrer" class="btn btn-accent">意見回饋</a>' +
    '<span class="site-foot-copy">© 2026 Andrew Cheng. All rights reserved.</span>';
}

// 為帶 data-share 的按鈕綁定「分享此工具」：優先用系統分享，否則退回複製網址
function wireShareButtons() {
  document.querySelectorAll('[data-share]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      try {
        if (navigator.share) {
          await navigator.share({ title: document.title, url: location.href });
        } else if (await copyText(location.href)) {
          const original = btn.textContent;
          btn.textContent = '已複製連結';
          setTimeout(() => { btn.textContent = original; }, 1600);
        }
        track('share'); // 分享成功才計數；使用者取消系統分享會走到 catch
      } catch {
        // 使用者取消系統分享，不需處理
      }
    });
  });
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { wireShareButtons(); mountFooter(); });
  } else {
    wireShareButtons();
    mountFooter();
  }
}

// 為拖放區綁定拖曳事件，檔案就緒時呼叫 onFiles(FileList)
export function bindDropzone(el, onFiles) {
  const stop = (e) => { e.preventDefault(); e.stopPropagation(); };

  ['dragenter', 'dragover'].forEach((type) =>
    el.addEventListener(type, (e) => { stop(e); el.classList.add('is-dragover'); })
  );
  ['dragleave', 'drop'].forEach((type) =>
    el.addEventListener(type, (e) => { stop(e); el.classList.remove('is-dragover'); })
  );
  el.addEventListener('drop', (e) => {
    if (e.dataTransfer?.files?.length) onFiles(e.dataTransfer.files);
  });
}
