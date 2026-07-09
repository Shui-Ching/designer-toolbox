---
name: designer-toolbox
description: 設計師工具箱（Designer's Toolbox）的開發知識庫與架構規格。這是一個工具箱型 monorepo：一個入口頁加上 35+ 個彼此獨立的純前端微型工具（圖片、色彩、CSS、文字、速查、資產、效率、趣味八大類），共用一套手冊風設計系統，全站 CSP 零相依。當使用者提到「工具箱」、「designer toolbox」、「牛馬工具箱」、「繼續開發那個工具」、「新增一個微型工具」、任何工具名（圖片壓縮、SVG 轉 font、社群尺寸、抽籤器…），或在此專案目錄下進行任何開發、修改、除錯工作時，必須先載入此 skill 作為開發背景，不要依賴記憶重新設計架構、設計 token 或新增工具流程。
---

# 設計師工具箱 · 開發知識庫

> 本檔只放**穩定慣例**（架構、設計系統、標準流程）。易變資訊一律看真實來源，
> 不要相信任何快照：
>
> - 開發進度、各工具的實作細節與決策 → `ROADMAP.md`
> - 目前有哪些工具、分類與編號 → `index.html` 的 `.tool-card` 卡片
> - SCSS 編譯映射 → `package.json` 的 `compile:css`
>
> `ROADMAP.md` 超過 50KB：接續工作先讀**開頭的「最後更新」幾段**掌握現況即可；
> 需要某個工具的實作細節時，再用工具名或編號搜尋該檔對應段落。

## 專案定位

工具箱型 monorepo：一個入口頁（`index.html`）＋ 35+ 個彼此獨立的純前端微型工具
（數量持續增加，以入口頁卡片為準）。每個工具完全自包含，共用一套設計系統。
**零後端、零安裝、檔案不上傳**，直接開 `index.html` 或丟到任何靜態空間即可運行。

## 路徑

專案根目錄：`/Users/andrew/Desktop/專案：專業牛馬工具箱/designer-toolbox/`

```
designer-toolbox/
├── index.html / index.scss / index.css   # 入口頁（工具索引：搜尋×分類×排序）
├── home.js                               # 入口頁邏輯（篩選、排序、TOOL_POPULARITY 熱門度快照）
├── stamp-version.js                      # 版本戳記腳本（build 時自動執行）
├── package.json                          # 編譯腳本＋各工具 scss:css 映射
├── ROADMAP.md                            # 進度看板（每次收工更新）
├── images/                               # 全站靜態圖（favicon 等）
├── shared/
│   ├── styles/
│   │   ├── _tokens.scss      # 設計 token（單一真實來源）
│   │   ├── _reset.scss       # 基礎重置 + 紙張紋理
│   │   ├── _components.scss  # 共用元件（btn / badge / tag / dropzone / tool-head…）
│   │   └── shared.scss       # 進入點 → 編譯成 shared.css
│   ├── scripts/shared.js     # 共用函式（ES Module）
│   └── data/                 # social-sizes.json / device-sizes.json
└── services/<tool-name>/     # 每個工具一個資料夾，互不依賴
    ├── index.html / style.scss / script.js
    └── vendor/               # （少數工具）本地化的第三方庫
```

## 技術約定

- 技術棧：**原生 HTML / SCSS / JS**，無框架（對齊使用者主力交付格式）。
- **CSP 零相依（重要）**：每頁 `<head>` 都帶同一段 CSP meta，`script-src 'self'`
  只放行本站與 Umami。因此**不能用 CDN script**——需要第三方庫時，先讓使用者
  拍板，再把單檔 vendor 進該工具的 `vendor/`（例：video-compress 的 mediabunny）；
  能自寫就自寫（例：gif-compress 的 GIF codec、svg-optimizer 的 SVGO-lite）。
- SCSS 編譯：Sass CLI，本機未全域安裝，用 `npx sass`（npm scripts 已包好）。
- 命名：kebab-case；CSS class 語意化、反映父子層級（`.tool-card-title`），**不用 BEM 的 `__` / `--`**。
- 註解繁中、命名英文、對話繁中。
- 每個工具自包含於 `services/<name>/`，互不依賴；做新工具不會動到既有工具。
- 使用者輸入（檔名、貼上文字）要進 DOM 時，用 `textContent` 或 `escapeHtml()` 防 XSS。

## 建置與版本戳記

```bash
cd "/Users/andrew/Desktop/專案：專業牛馬工具箱/designer-toolbox"
npm run build:css   # = compile:css（sass 編譯全部映射）+ stamp（版本戳記）
npm run dev         # 監看自動編譯（不含 stamp）
```

- `stamp`（`stamp-version.js`）會把所有 HTML 的本地 css/js 引用、以及工具頁
  `script.js` 內 import 的本地模組，加上 `?v=YYYYMMDDHHmm` 防快取。
  它會**改寫 HTML 與 JS 檔**，看到 `?v=` 差異是正常的，不要手動移除。
- 新增工具務必到 `package.json` 的 **`compile:css`** 補該工具的
  `services/<name>/style.scss:services/<name>/style.css`，否則不會被編譯。

## 設計系統：手冊風（Technical Almanac）

視覺概念是「設計師的工作台 / 技術手冊」：暖白紙感背景、墨黑文字、單一硃紅強調色、
mono 角色標籤（靠字距與大寫營造技術感）。工具以編號像手冊目錄條目排列。

設計 token 全部在 `shared/styles/_tokens.scss`，**改樣式優先改 token，不要散落硬編碼**：

- 色彩：`$color-paper`（暖白紙 #f4f1e8）、`$color-paper-deep`、`$color-ink`（墨黑）、
  `$color-ink-soft`（淡墨）、`$color-line`、`$color-accent`（硃紅 #d8442a）、
  `$color-accent-deep`（hover）、`$color-mark`（芥黃，警示／點綴）。
- 字體：**全站統一單一 sans——Inter（英數）+ Noto Sans TC（中文）**。
  `$font-display` / `$font-body` / `$font-mono` 三個變數名保留（相容既有用法）
  但指向同一組字體堆疊。早期的 Fraunces / Space Mono 已廢，不要再引入。
- 字級：`$fs-*`，**全站最小字級下限 16px**（`$fs-xs` / `$fs-sm` 都等於 1rem）。
- 間距 `$space-*`（8px 節奏）、`$radius`（2px 偏銳利）、`$ease`/`$dur`、`$max-width`（1100px）。
- token 同時鏡射為 `:root` CSS 變數（`var(--color-accent)` 等），JS／行內樣式一律取變數，不硬編色碼。

字體透過 Google Fonts `<link>` 載入；每個 HTML 頁的 `<head>` 都帶同一組字體連結。

可直接複用的共用 class（定義於 `_components.scss`）：
`.container`、`.tag` / `.tag-accent`、`.badge`（`.is-live`）、`.btn` / `.btn-accent`、
`.back-link`、`.dropzone`（`.is-dragover`）/ `.dropzone-hint`、`.tool-head` / `.tool-head-title`、`.section-rule`。
工具內的控制列、chip、code-block 等語彙，先搜既有工具（如 gradient、color-convert）沿用，不重新發明。

## 共用函式（shared/scripts/shared.js，ES Module）

`downloadBlob(blob, filename)`、`copyText(text)`、`formatBytes(bytes)`、
`bindDropzone(el, onFiles)`、`escapeHtml(str)`、`track(event, data)`。
工具頁以 `<script type="module">` import 使用。

此外 shared.js 載入時會**自動掛載**：全站頁尾（意見回饋＋版權）與 `[data-share]` 分享按鈕。

## Umami 分析（隱私優先）

- 每頁 `<head>` 帶 Umami script 標籤；`<body data-tool="<name>">` 標記工具代號。
- 工具的**主要完成動作**（下載、複製結果）呼叫 `track('use')` 計數。
- **只送工具代號等中性資訊，絕不送使用者的檔名、檔案內容或輸入文字。**
- 入口頁「最熱門」排序讀 `home.js` 的 `TOOL_POPULARITY`（手動快照，key＝卡片 href）；
  不直接打 Umami API（金鑰會外洩、CSP 未放行）。更新方式：到 Umami 後台 Pages 報表抄數字。

## 新增工具的標準步驟

1. 建 `services/<name>/`，內含 `index.html`、`style.scss`、`script.js`。
2. `index.html` 的 `<head>` 比照最近完成的工具頁：同一段 CSP meta、favicon、
   Google Fonts、Umami script、`../../shared/styles/shared.css`、`./style.css`；
   `<body data-tool="<name>">`。
3. `style.scss` 開頭 `@use '../../shared/styles/tokens' as *;`，只寫該工具特有樣式，共用元件直接套 class。
4. 沿用 `.tool-head` 頁首（`Tool / NN` 編號）與 `.back-link`（連回 `../../index.html`）保持一致。
5. 主要完成動作埋 `track('use')`。
6. 入口頁 `index.html` 新增 `.tool-card` 卡片：`href`、`data-category`（八類：
   image / color / css / text / reference / assets / focus / fun）、`data-keywords`
   （中英關鍵字，供搜尋）、編號、`.badge.is-live`；並把 `#tool-count` 的初始文字 N→N+1。
7. `home.js` 的 `TOOL_POPULARITY` 補該工具 key（暫填 0）。
8. `package.json` 的 `compile:css` 補 scss:css 映射，跑 `npm run build:css`（自動戳版本）。
9. 更新 `ROADMAP.md`：在開頭新增「最後更新」段落記錄做了什麼與關鍵決策。

> 不確定某步驟長怎樣時，直接開最近完成的工具（看 ROADMAP 開頭是哪個）當範本。

## 注意

- 動手寫任何 UI 前，依使用者全局規則先呼叫 `frontend-design` skill。
- 保持程式碼直觀可讀，不過度封裝；不要修改使用者沒提問的地方、不自作主張重構。
- 若發現本檔描述與程式碼現況衝突，**以程式碼為準**，並在收工時順手更新本檔。
