---
name: designer-toolbox
description: 設計師工具箱（Designer's Toolbox）的開發知識庫與架構規格。這是一個工具箱型 monorepo：一個入口頁加上多個彼此獨立的純前端微型工具（圖片壓縮、SVG 轉 Font、社群尺寸建議、裝置尺寸查詢…），共用一套手冊風設計系統。當使用者提到「工具箱」、「designer toolbox」、「繼續開發那個工具」、「新增一個微型工具」、「圖片壓縮工具」、「SVG 轉 font」、「社群尺寸」、「裝置尺寸查詢」，或在此專案目錄下工作時，必須先載入此 skill 作為開發背景，不要依賴記憶重新設計架構或設計 token。
---

# 設計師工具箱 · 開發知識庫

> 這是專案的架構與慣例規格（穩定資訊）。**即時開發進度**請讀專案內的
> `ROADMAP.md` —— 那裡才是進度看板的真實來源。

## 專案定位

工具箱型 monorepo：一個入口頁（`index.html`）＋ 多個彼此獨立的純前端微型工具。
每個工具完全自包含，共用一套設計系統。**零後端、零安裝、檔案不上傳**，直接開
`index.html` 或丟到任何靜態空間即可運行。

接續工作的第一步：讀 `ROADMAP.md` 看目前在哪個 Phase、哪些工具已完成。

## 路徑

專案根目錄：`/Users/andrew/Desktop/專案：專業牛馬工具箱/designer-toolbox/`

```
designer-toolbox/
├── index.html / index.scss / index.css   # 入口頁（手冊風工具索引）
├── package.json                          # sass 編譯腳本
├── ROADMAP.md                            # 進度看板（每次收工更新）
├── shared/
│   ├── styles/
│   │   ├── _tokens.scss      # 設計 token（單一真實來源）
│   │   ├── _reset.scss       # 基礎重置 + 紙張紋理
│   │   ├── _components.scss  # 共用元件（btn / badge / tag / dropzone / tool-head…）
│   │   └── shared.scss       # 進入點 → 編譯成 shared.css
│   ├── scripts/shared.js     # 共用函式（ES Module）
│   └── data/                 # social-sizes.json / device-sizes.json
└── services/
    ├── image-compress/   # 01 壓縮圖片
    ├── svg-to-font/      # 02 SVG 轉 Font
    ├── social-size/      # 03 社群尺寸建議
    └── device-size/      # 04 裝置尺寸查詢
```

## 技術約定

- 技術棧：**原生 HTML / SCSS / JS**，無框架（對齊使用者主力交付格式）。
- SCSS 編譯：Sass CLI，**本機未全域安裝**，用 `npx sass`。
- 命名：kebab-case；CSS class 語意化、反映父子層級（`.tool-card-title`），**不用 BEM 的 `__` / `--`**。
- 註解繁中、命名英文、對話繁中。
- 每個工具自包含於 `services/<name>/`，互不依賴；做新工具不會動到既有工具。

## 開發指令

```bash
cd "/Users/andrew/Desktop/專案：專業牛馬工具箱/designer-toolbox"
npm run build:css   # 編譯一次
npm run dev         # 監看自動編譯（= watch:css）
```

新增工具時，務必到 `package.json` 的 `build:css` 補上該工具的
`services/<name>/style.scss:services/<name>/style.css`，否則它的 SCSS 不會被編譯。

## 設計系統：手冊風（Technical Almanac）

視覺概念是「設計師的工作台 / 技術手冊」：暖白紙感背景、墨黑文字、單一硃紅強調色、
等寬字當技術標籤、襯線顯示字當標題。工具以編號（01–04）像手冊目錄條目排列。

設計 token 全部在 `shared/styles/_tokens.scss`，**改樣式優先改 token，不要散落硬編碼**：

- 色彩：`$color-paper`（暖白紙 #f4f1e8）、`$color-ink`（墨黑）、`$color-accent`（硃紅 #d8442a）、`$color-mark`（芥黃）等。
- 字體：`$font-display`（Fraunces / Noto Serif TC，標題）、`$font-body`（Hanken Grotesk / Noto Sans TC，內文）、`$font-mono`（Space Mono / Noto Sans TC，技術標籤）。
- 字級 `$fs-*`、間距 `$space-*`（8px 節奏）、`$radius`（2px，偏銳利）、`$ease`/`$dur`（動態）。
- token 同時鏡射為 `:root` 的 CSS 變數（`var(--color-accent)` 等），供 JS／行內樣式取用。

字體透過 Google Fonts `<link>` 載入；每個 HTML 頁的 `<head>` 都帶同一組字體連結。

可直接複用的共用 class（定義於 `_components.scss`）：
`.container`、`.tag` / `.tag-accent`、`.badge`（`.is-live`）、`.btn` / `.btn-accent`、
`.back-link`、`.dropzone`（`.is-dragover`）/ `.dropzone-hint`、`.tool-head` / `.tool-head-title`、`.section-rule`。

## 共用函式（shared/scripts/shared.js，ES Module）

`downloadBlob(blob, filename)`、`copyText(text)`、`formatBytes(bytes)`、
`bindDropzone(el, onFiles)`。工具頁以 `<script type="module">` import 使用。

## 各工具技術選型

| # | 工具 | 資料夾 | 做法 | Phase |
|---|------|--------|------|-------|
| 01 | 壓縮圖片 | `image-compress` | Canvas API 客戶端壓縮，無損／可調品質兩模式，壓縮前後大小即時對比，輸出 JPEG/WebP/PNG | 3 |
| 02 | SVG 轉 Font | `svg-to-font` | 瀏覽器端用 opentype.js 把多個 SVG 組成 woff/ttf，自動產生 @font-face + `.icon-*` CSS 供複製 | 4 |
| 03 | 社群尺寸建議 | `social-size` | 讀 `shared/data/social-sizes.json`，卡片展示各平台版位尺寸與比例，可依平台篩選 | 2 |
| 04 | 裝置尺寸查詢 | `device-size` | 讀 `shared/data/device-sizes.json`，可搜尋表格列出 viewport / DPR / 斷點 | 2 |

建議開發順序：Phase 1 骨架（已完成）→ Phase 2 兩個資料型工具（最快見成果）→ Phase 3 圖片壓縮 → Phase 4 SVG 轉 Font。

## 新增工具的標準步驟

1. 建 `services/<name>/`，內含 `index.html`、`style.scss`、`script.js`。
2. `index.html` 的 `<head>` 載入同組 Google Fonts、`../../shared/styles/shared.css`、`./style.css`。
3. `style.scss` 開頭 `@use '../../shared/styles/tokens' as *;`，只寫該工具特有樣式，共用元件直接套 class。
4. 沿用 `.tool-head` 頁首與 `.back-link`（連回 `../../index.html`）保持一致。
5. 到 `package.json` 的 `build:css` 補該工具的 scss:css 映射，跑 `npm run build:css`。
6. 入口頁 `index.html` 對應卡片的 `.badge` 由「即將推出」改為 `is-live`。
7. 更新 `ROADMAP.md` 勾選進度。

## 注意

- 動手寫任何 UI 前，依使用者全局規則先呼叫 `frontend-design` skill。
- 保持程式碼直觀可讀，不過度封裝；不要修改使用者沒提問的地方、不自作主張重構。
