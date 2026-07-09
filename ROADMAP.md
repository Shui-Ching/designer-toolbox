# 設計師工具箱 · 開發進度

> 每次收工更新此檔。下次接續時，這裡是進度的單一真實來源。
> 架構決策、設計 token、新增工具標準步驟另存於 project skill（`.claude/skills/designer-toolbox`）。
> 收工更新方式：改「最後更新」一行＋在工具總覽補一列；實作細節寫進 git commit 與程式碼註解，不要貼進本檔。

最後更新：2026-07-09 — 完成 **36 Claude 指令查找器**（讀 `shared/data/claude-commands.json`，搜尋×分類篩選＋依分類分區卡片，點卡複製指令名稱；資料整理自 Claude Code 官方文件）。

## 工具總覽（36 個，全數上線）

| # | 工具（資料夾） | 分類 | 核心做法一句話 |
|---|---|---|---|
| 01 | 壓縮圖片（`image-compress`） | image | Canvas 重編碼 JPEG/WebP/PNG，品質滑桿＋最大寬度縮放，批次 |
| 02 | SVG 轉 Font（`svg-to-font`） | assets | 自寫 SVG 解析＋opentype.js（CDN＋SRI）組字型，輸出 TTF/WOFF＋@font-face CSS |
| 03 | 社群尺寸建議（`social-size`） | reference | 讀 social-sizes.json（8 平台 29 版位），篩選＋點卡複製 |
| 04 | 裝置尺寸查詢（`device-size`） | reference | 讀 device-sizes.json（18 款），搜尋／排序＋Bootstrap 斷點刻度尺 |
| 05 | Grid / Flex 模擬器（`grid-flex`） | css | 雙模式即時預覽，自動產生可複製 CSS |
| 06 | 圖片裁切／改尺寸（`image-crop`） | image | 互動裁切框＋比例鎖定，可串 03 社群版位精確輸出 |
| 07 | Favicon 產生器（`favicon`） | assets | 多尺寸縮放輸出，手寫 ICO／ZIP 容器＋webmanifest |
| 08 | QR Code 產生器（`qr-code`） | assets | 自寫 qr-encode.js（版本 1–40、RS ECC、遮罩自選），SVG/PNG |
| 09 | 調色盤產生器（`color-palette`） | color | 主色推導 50–900 色階＋調和色，輸出 SCSS/CSS 變數 |
| 10 | 色彩格式轉換（`color-convert`） | color | HEX↔RGB↔HSL↔OKLCH 即時互轉（自寫 OKLab 矩陣） |
| 11 | 字級比例計算（`type-scale`） | text | 基準字級 × 音程比例推導 type scale，輸出 `$fs-*` 變數 |
| 12 | Lorem 假文（`lorem`） | text | 中文／拉丁雙語言，段／句／字數三種產生單位 |
| 13 | 字數／字元統計（`word-count`） | text | 中文逐字英數計詞，閱讀時間＋字元組成長條 |
| 14 | 陰影產生器（`shadow`） | css | 多層 box-shadow 清單即時預覽 |
| 15 | 漸層產生器（`gradient`） | css | linear/radial/conic，漸層條拖曳色標 |
| 16 | 圖片格式轉換（`image-convert`） | image | PNG↔WebP↔JPEG↔AVIF（沿用 01 管線，保留原尺寸） |
| 17 | 決策轉盤（`decision-spinner`） | fun | Canvas 扇形轉盤，自訂選項清單 |
| 18 | 偷懶神器（`fake-update`） | fun | Mac／Win11 全螢幕假更新，非線性進度 |
| 19 | 我的留言板（`message-board`) | fun | 全螢幕大字訊息＋capture phase 鍵盤鎖定 |
| 20 | PDF 壓縮（`pdf-compress`） | image | pdf.js 逐頁光柵化→JPEG→pdf-lib 重組（有損、文字變影像）；vendor 約 4.5MB 本機、首次拖檔才動態 import |
| 21 | 番茄鐘（`pomodoro`） | focus | SVG 進度環＋Web Audio 提示音，設定存 localStorage |
| 22 | 浮水印（`watermark`） | image | 文字／logo，單顆九宮格或平鋪；參數以比例儲存故批次一致；輸出可保留原始格式 |
| 23 | 單位換算（`unit-convert`） | reference | 9 類別即時雙向互轉（ratio factor＋溫度 special），基準單位單一真實來源 |
| 24 | 大小寫轉換（`text-case`） | text | 七種轉換含 Title Case（略過小詞） |
| 25 | 金額轉大寫（`amount-words`） | text | 中文大寫（元角分整、支援至兆）＋英文支票格式；字串切位避免浮點誤差 |
| 26 | 盤古之白（`pangu`） | text | CJK 與半形英數間插入／移除半角空格（純 Regex） |
| 27 | 對比度檢查器（`contrast-checker`） | color | 自寫 WCAG 相對亮度＋對比值，AA/AAA 判定＋四種色盲模擬 |
| 28 | Cubic Bezier 產生器（`cubic-bezier`） | css | SVG 拖曳控制點（Y 容許超出）＋動畫球預覽，九組預設 |
| 29 | CSS Clamp 計算器（`clamp-calc`） | css | 流體字級 `clamp()` 產生＋SVG 曲線圖＋即時預覽 |
| 30 | 圖片萃取調色盤（`color-extractor`） | color | Canvas 取樣＋自寫 k-means++，輸出 3–10 主色 |
| 31 | 印刷紙張尺寸速查（`paper-size`） | reference | ISO A/B、JIS B、美規、常用共 30 筆；單位＋DPI 切換、比例縮圖 |
| 32 | Base64 編解碼（`base64`） | assets | 文字（UTF-8 正確處理、URL-safe）＋圖片 Data URI 兩模式 |
| 33 | SVG 壓縮器（`svg-optimizer`） | image | 自寫 SVGO-lite（DOMParser），可開關規則＋數字精度收斂，保留 title/desc |
| 34 | 抽籤器（`lottery`） | fun | `crypto.getRandomValues`＋拒絕採樣去模偏差，不重複抽出＋拉霸式逐一揭曉 |
| 35 | GIF 動畫壓縮（`gif-compress`） | image | 自寫零相依 GIF codec（LZW 解／編碼、disposal 合成、中位切割減色），縮放＋色彩數量兩槓桿 |
| 36 | Claude 指令查找器（`claude-commands`） | reference | 讀 claude-commands.json（21 分類、96 個指令），搜尋＋分類篩選＋依分類分區卡片，點卡複製 |

共同約定：全部零後端、檔案不上傳；除 02（opentype.js CDN＋SRI）與 20（本機 vendor）外零相依，維持 CSP `script-src 'self'`。

### 已移除／隱藏

- **環境音**（原 white-noise）：2026-06-24 已完全刪除，不再列入。
- **影片壓縮**（`video-compress`）：入口頁卡片已移除、資料夾保留於磁碟未對外。WebCodecs 硬體重編 H.264，vendor `mediabunny@1.46`（MPL-2.0）。要復活時：入口頁補卡片＋編號＋搜尋計數＋`home.js` 熱門度 key。
- 兩工具移除後全站編號已於 2026-06-24 重排對齊（入口頁卡片編號＝內頁 `Tool / XX`，01–35 連續一致）。

## 開發指令

```bash
npm run build:css   # 部署用：編譯 SCSS + 蓋版本戳記（防快取）
npm run dev         # 開發用：監看自動編譯（不戳記，搭配硬重整）
```

- `stamp-version.js` 為本地 css/js 引用補 `?v=<YYYYMMDDHHmm>`（含工具頁 ES Module import），冪等、外部 URL 略過、自動掃描 `services/*/` 無需維護。
- `.mjs` 不在戳記範圍（只戳 `.js`）；vendor 走動態 import 故無妨。
- **部署前務必跑 `npm run build:css`**，回訪者才會抓到新檔。

## 新增工具 checklist

skill 已載標準步驟（建資料夾、共用樣式、tool-head），以下為本專案額外必做：

1. `<body data-tool="<name>">`；`<head>` 複製既有頁的 CSP meta＋Umami `<script>`（有額外 CDN 記得加進 `script-src`）
2. `tool-head` 加分享按鈕：`<button type="button" class="back-link share-btn" data-share>↗ 分享工具</button>`
3. 核心動作（下載／複製成功）呼叫 `track('use')`（自 `shared.js` import）
4. 使用者輸入塞進 `innerHTML` 前一律 `escapeHtml()`
5. 入口頁卡片：補 `data-category`＋`data-keywords`、更新搜尋計數
6. `home.js` 的 `TOOL_POPULARITY` 補 key（暫填 0）
7. `package.json` 的 `compile:css` 補 `style.scss:style.css` 映射，跑 `npm run build:css`

## 入口頁功能

- **搜尋**：關鍵字比對卡片可見文字＋`data-keywords`，即時更新計數與空狀態。
- **分類 chip**（單選＋全部）：image／color／css／text／reference／assets／focus／fun，與搜尋交集篩選。開新分類時到 `index.html` 補 chip 即可（`home.js` 自動支援任意值）。
- **排序**：由舊到新（預設，DOM 原序）／由新到舊／最熱門。
  - 最熱門讀 `home.js` 的 `TOOL_POPULARITY` 手動快照（key＝卡片 `href`；不直接打 Umami API：金鑰會外洩、CSP 未放行、`file://` 下 fetch 失敗）。
  - **維護**：到 Umami 後台 Pages 報表抄各工具瀏覽量更新數字（現值為 2026-06-24 真實數據）。

## 分析與資安基線

Umami（`cloud.umami.is`，cookieless）＋各頁嚴格 CSP meta 已全站套用；追蹤 pageview、`track('use')`、`track('share')`，只送工具代號不送內容。首頁 footer 有隱私揭露。

- [ ] 若 Umami 腳本網域改為非 `cloud.umami.is`（如 EU 區），同步改各頁 CSP 的 `script-src` / `connect-src`

## 後續可選（未做，留待提出）

- 單位換算：自訂單位／我的最愛
- 入口頁：記住排序選擇（localStorage）、分類 chip 複選、熱門度改本機使用次數
- 意見回饋入口（footer）已於 2026-06-07 完成

## 接續備忘

- 下次接續：提到本專案會自動載入 project skill；先讀本檔看進度。
- 每個工具自包含，互不依賴；做新工具不會動到既有工具。
