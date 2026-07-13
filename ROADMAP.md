# 設計師工具箱 · 開發進度

> 每次收工更新此檔。下次接續時，這裡是進度的單一真實來源。
> 架構決策、設計 token、新增工具標準步驟另存於 project skill（`.claude/skills/designer-toolbox`）。
> 收工更新方式：改「最後更新」一行＋在工具總覽補一列；實作細節寫進 git commit 與程式碼註解，不要貼進本檔。

最後更新：2026-07-13 — 完成 **41 Regex 測試器**（輸入正規表達式與 g/i/m/s 旗標，即時高亮所有匹配並列出擷取群組，附 12 組常用 pattern 速查）。原生 `RegExp`，零相依；沒有 `g` 旗標時比照原生行為只回傳第一筆，避免使用者誤以為工具壞掉。找匹配用 `exec` + `lastIndex` 迴圈，零寬匹配時手動 `lastIndex++` 避免無窮迴圈，並設 2000 筆匹配上限防病態 pattern 撐爆 DOM（無法防 ReDoS 級的災難性回溯，屬原生 regex engine 的固有限制，不在自寫範圍內）。高亮沿用 40 號 text-diff 的 `createElement`＋`textContent` 組 DOM 手法，不經 `innerHTML`。擷取群組同時列出數字群組（`m[1..]`）與具名群組（`m.groups`），未匹配到的群組顯示「（未匹配）」。常用 pattern（Email／URL／IPv4／Hex 色碼／台灣手機／日期／時間／中文字元／HTML 標籤／數字／多餘空白／英數帳號）為工具內建常數，非外部 JSON（資料量小且不重用）。範圍拍板時已確認**不做替換（replace）功能**，先聚焦匹配＋擷取＋速查。用 Playwright 實際跑過瀏覽器驗證：初始空狀態、載入範例自動帶入 Email pattern 並正確高亮、切換 Hex 色碼 pattern、具名群組擷取正確對應、錯誤 pattern 顯示語法錯誤訊息、關閉 g 旗標後只回傳第一筆匹配、複製所有匹配、清空恢復空狀態，console 皆無錯誤。

## 工具總覽（41 個，全數上線）

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
| 37 | 特殊符號複製器（`special-chars`） | text | 讀 special-chars.json（12 分類、185 個符號：中西標點、箭頭、數學、貨幣、勾選、星形、圈碼數字、希臘字母、版權、生活雜項、框線繪製），搜尋＋分類篩選，點卡複製符號 |
| 38 | JSON 格式化／校驗（`json-formatter`） | text | 貼上自動排版＋即時校驗，`SyntaxError` 訊息解析行號欄號並可點擊跳到錯誤字元；縮排 2／4／Tab 切換＋壓縮成單行 |
| 39 | 時間戳轉換（`timestamp-convert`） | reference | Unix timestamp（秒／毫秒）↔ 日期時間雙向即時互轉＋時區切換，另提供目前時間戳速查；`Intl.DateTimeFormat`／`Intl.RelativeTimeFormat` 零相依換算，沿用 23 號 `unit-convert` 的速查換算版面 |
| 40 | 文字差異比對（`text-diff`） | text | 貼上 A／B 兩段文字，逐行／逐字比對並高亮新增／刪除（自寫 LCS diff，零相依），雙欄輸入沿用 26 號 `pangu`／13 號 `word-count` 的 editor-pane 架構 |
| 41 | Regex 測試器（`regex-tester`） | text | 輸入正規表達式＋g/i/m/s 旗標，即時高亮匹配並列出數字／具名擷取群組，附 12 組常用 pattern 速查；原生 RegExp，零相依 |

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

## 排入排程（已拍板，待實作）

2026-07-13 拍板，依下表順序開發；正式工具編號於上線時連續分配（Regex 測試器已於 41 號上線，見上方工具總覽）。

| 順序 | 工具（資料夾） | 分類 | 方向 |
|---|---|---|---|
| 1 | CSV ↔ Markdown/JSON 表格轉換（`table-convert`） | text | 貼 Excel／CSV 轉 Markdown 表格與 JSON；自寫 CSV parser（處理引號跳脫），零相依 |
| 2 | 字型檔預覽器（`font-preview`） | assets | 拖入 TTF/OTF/WOFF 即時預覽字重、字符集、waterfall 字級瀑布；原生 `FontFace` API，零相依 |
| 3 | 佔位圖產生器（`placeholder-image`） | image | 自訂尺寸／底色／文字輸出 PNG/SVG 佔位圖，可一鍵套 03 號社群版位尺寸；Canvas＋SVG 序列化。自動標註尺寸：置中文字＋藍圖標註線兩種樣式切換，字級取短邊等比縮放，文字顏色依底色亮度自動反轉（複用 27 號 WCAG 相對亮度算法） |
| 4 | CSS clip-path 產生器（`clip-path`） | css | 多邊形拖曳控制點＋預設形狀（三角、箭頭、對話框），輸出 `clip-path`；拖曳互動沿用 28 號 cubic-bezier |
| 5 | SVG Blob／波浪產生器（`blob-generator`） | assets | 隨機有機形狀＋波浪分隔線，調複雜度與隨機種子，輸出 SVG；貝茲曲線數學自寫 |
| 6 | 噪點／紋理產生器（`noise-texture`） | assets | grain、dot grid、格線紋理，輸出可平鋪 PNG/SVG；Canvas＋`crypto.getRandomValues` |
| 7 | EXIF 檢視與移除（`exif-viewer`） | image | 拖入照片看 EXIF（GPS、機型），一鍵去除後下載；自寫 EXIF parser（JPEG APP1 段），去除走 01 號 Canvas 重編碼管線 |
| 8 | 九宮格切圖（`grid-splitter`） | image | 長圖或方圖切成 IG 九宮格／輪播分頁，ZIP 打包下載；Canvas 切片＋沿用 07 號 favicon 的手寫 ZIP 容器 |
| 9 | 裝置外框截圖（`device-mockup`） | image | 截圖套進手機／瀏覽器外框輸出提案用 mockup；外框 SVG 自繪＋Canvas 合成，與 04 號 device-size 資料互通 |
| 10 | LINE Rich Menu 預覽模擬器（`richmenu-preview`） | image | 拖入選單圖驗證規格（尺寸／格式／≤1MB，規格存 JSON 比照 03 號）＋疊分格模板 overlay＋自繪去識別化聊天室 mockup 預覽展開／收合；緊接第 9 順位共用自繪手機外框技術。**實作前先查證 LINE 官方文件現行規格** |
| 11 | 日期計算器（`date-calc`） | reference | 日期差、加減天數、倒數日；原生 `Date`＋`Intl`，沿用 39 號 timestamp 版面 |
| 12 | PPI 計算器（`ppi-calc`） | reference | 解析度＋螢幕吋數 → PPI／設備像素比速查；純算式 |
| 13 | 我的螢幕資訊（`screen-info`） | reference | 偵測本機解析度／視窗大小／DPR／觸控／目前斷點，resize 即時更新＋「複製診斷報告」；定位為丟給客戶的診斷頁，與 04 號（查別人的裝置）互補。**偵測值只留本機顯示，不送 Umami、不進 URL** |
| 14 | 亂數密碼／字串產生器（`password-generator`） | assets | 長度、字元集、排除易混淆字元；複用 34 號抽籤器的 `crypto` 拒絕採樣 |
| 15 | 倒數計時器／碼表（`countdown-timer`） | focus | 通用倒數＋碼表，補 focus 類缺口；沿用 21 號 pomodoro 的 SVG 環＋Web Audio |
| 16 | Emoji 查找複製（`emoji-picker`） | reference | 分類＋中英關鍵字搜尋，點卡複製；複製 37 號 special-chars 架構，只換 JSON 資料 |
| 17 | 繁簡轉換（`zh-convert`） | text | 繁↔簡＋台灣／中國用語提示；需準備對照 JSON，零相依 |
| 18 | Mermaid 流程圖預覽器（`mermaid-preview`） | text | 貼 Mermaid 語法即時預覽＋匯出 SVG/PNG；**需本機 vendor mermaid.js（約 2–3MB）**，實作前先確認版本與 CSP 影響（先例：20 號 pdf-compress） |

## 後續可選（未做，留待提出）

- 單位換算：自訂單位／我的最愛
- 入口頁：記住排序選擇（localStorage）、分類 chip 複選、熱門度改本機使用次數
- 意見回饋入口（footer）已於 2026-06-07 完成

## 接續備忘

- 下次接續：提到本專案會自動載入 project skill；先讀本檔看進度。
- 每個工具自包含，互不依賴；做新工具不會動到既有工具。
