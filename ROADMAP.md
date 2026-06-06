# 設計師工具箱 · 開發進度

> 每次收工更新此檔。下次接續時，這裡是進度的單一真實來源。
> 架構決策與設計 token 另存於 project skill（見最下方）。

最後更新：2026-06-06（完成 16 圖片格式轉換：與 01 共用「拖放→createImageBitmap 解碼→canvas→toBlob 重新編碼」批次流程，但聚焦格式互轉、保留原尺寸；目標格式 PNG／JPEG／WebP／AVIF，啟動時以 1×1 canvas 試編碼比對 blob.type 偵測 WebP／AVIF 支援度，不支援即停用該按鈕並標「不支援」（避免靜默退回 PNG）；品質滑桿只對有損格式有效、PNG 自動停用，JPEG 先鋪白底避免透明變黑；每列顯示「來源格式→目標格式」徽章＋原尺寸＋前後大小對比與增減%，單張下載／全部下載／移除／清空，下載埋 track('use')；檔名以 escapeHtml 跳脫；入口頁卡片 is-live＋搜尋計數改 16、package.json 補編譯映射）

---

## 專案定位

一個工具箱型 monorepo：一個入口頁 + 多個彼此獨立的純前端微型工具，共用一套設計系統。
零後端、零安裝，直接開 `index.html` 或丟到任何靜態空間即可運行。

## 技術約定

- 技術棧：原生 HTML / SCSS / JS（無框架）
- SCSS 編譯：Sass CLI（`npx sass`，本機未全域安裝）
- 設計風格：手冊風（暖白紙感 × 硃紅，編號式工具索引）
- 命名：kebab-case；CSS class 語意化、反映父子層級
- 註解繁中、命名英文

## 開發指令

```bash
# 編譯一次
npm run build:css
# 監看自動編譯（開發時）
npm run dev
```

> 新增工具時，記得在 `package.json` 的 `build:css` 補上該工具的 `style.scss:style.css`。

## 分析與資安基線（2026-06-05 建立）

放上 GitHub Pages 前導入的全站基線。分析採 **Umami**（`cloud.umami.is`，cookieless、免同意橫幅），
追蹤三件事：各頁訪客數（自動 pageview）、使用工具（`track('use')`）、分享工具（`track('share')`）。

**已套用（首頁 + 01～06 工具）：**
- 各頁 `<head>`：載入 Umami 腳本（`data-website-id` 待填）＋ 嚴格 CSP meta（`script-src 'self'`，白名單字體與 Umami）
- `shared.js` 新增：`track(event)`（自動帶 `body[data-tool]`，**只送工具代號、不送檔名或檔案內容**）、
  `escapeHtml()`、帶 `[data-share]` 按鈕的分享自動綁定（優先系統分享、否則複製網址）
- 各工具於「下載／複製」動作埋 `track('use')`；`tool-head` 加分享按鈕（按下埋 `track('share')`）
- 安全修補：image-compress 檔名 XSS 已 `escapeHtml` 跳脫；svg-to-font 的 opentype.js（CDN）補 SRI；
  `.gitignore` 含 `.env` / `node_modules`

**上線前待辦：**
- [ ] 註冊 https://cloud.umami.is，把全部 HTML 的 `YOUR-UMAMI-WEBSITE-ID` 換成實際 Website ID
- [ ] 若 Umami 腳本網域非 `cloud.umami.is`（如 EU 區 `eu.umami.is`），同步改各頁 CSP 的 `script-src` / `connect-src`
- [x] **07 favicon 已套基線**：補上 `data-tool="favicon"`、CSP meta、Umami 腳本、分享按鈕、下載時 `track('use')`；
  並把 `services/favicon/script.js` 卡片 `${r.name}` 改為 `escapeHtml(r.name)`（修掉同類檔名 XSS）
- [ ] （選配）首頁 footer 加一行隱私揭露：使用 Umami 匿名統計、不放 cookie、不蒐集個資

**新增工具時，除既有步驟外，務必同步加上這 5 項：**
1. `<body data-tool="<name>">`
2. `<head>` 複製既有頁面的 CSP meta ＋ Umami `<script>`（含 jsdelivr 等額外 CDN 時，記得加進 CSP 的 `script-src`）
3. `tool-head` 內加分享按鈕，包進 `.tool-head-actions`：
   `<button type="button" class="back-link share-btn" data-share>↗ 分享工具</button>`
4. 核心動作（下載／複製成功）呼叫 `track('use')`（從 `shared.js` import）
5. 任何把使用者輸入（檔名等）塞進 `innerHTML` 之處，一律先 `escapeHtml()`

## 目錄結構

```
tool/
├── index.html / index.scss / index.css   # 入口頁
├── package.json                          # sass 編譯腳本
├── ROADMAP.md                            # 本檔
├── shared/
│   ├── styles/ (_tokens, _reset, _components, shared.scss → shared.css)
│   ├── scripts/shared.js                 # 共用函式
│   └── data/ (social-sizes.json, device-sizes.json)
└── services/
    ├── image-compress/   # 01
    ├── svg-to-font/      # 02
    ├── social-size/      # 03
    └── device-size/      # 04
```

## 進度看板

### Phase 1 — 骨架 + 入口頁
- [x] 目錄結構
- [x] 共享設計系統（tokens / reset / components）
- [x] 共用函式 shared.js（下載、複製、formatBytes、拖放）
- [x] 入口頁（手冊風索引，4 張工具卡）
- [x] 4 個工具佔位頁（施工中）
- [x] sass 編譯流程 + package.json

### Phase 2 — 資料型工具（最快見成果）
- [x] 03 社群尺寸建議：讀 social-sizes.json，卡片展示 + 平台篩選
  - [x] 補齊各平台版位資料（IG / FB / Threads / X / LinkedIn / YouTube / TikTok / LINE，共 8 平台 29 版位）
  - [x] 比例預覽塊、點卡片複製尺寸、黏頂篩選列
  - [x] 入口頁徽章改 is-live；package.json 補編譯映射
- [x] 04 裝置尺寸查詢：讀 device-sizes.json，可搜尋表格 + 斷點標示
  - [x] 補齊裝置資料（手機 7 / 平板 5 / 桌機 6，共 18 款；含 categories 與 breakpoints label）
  - [x] 即時搜尋 + 類型篩選鈕 + 表頭點擊排序（升降冪）
  - [x] 換算實體解析度（viewport × dpr）與長寬比（長:短）；點列複製 viewport
  - [x] Bootstrap 5 斷點視覺刻度尺（窄螢幕改直列堆疊）
  - [x] 入口頁徽章改 is-live；package.json 補編譯映射

### Phase 3 — 圖片壓縮（互動型）
- [x] 01 Canvas 壓縮：可調品質（JPEG/WebP）／PNG 無損兩模式
  - [x] 輸出格式切換（JPEG / WebP / PNG）；PNG 自動停用品質滑桿
  - [x] 品質滑桿（放開才重壓，拖曳不卡）、最大寬度等比縮放（原始/2048/1600/1200/800）
  - [x] 批次拖放與點擊選檔；createImageBitmap 解碼、canvas.toBlob 重新編碼
  - [x] 壓縮前後大小即時對比（單張縮減幅度 + 總計節省%）、縮圖預覽
  - [x] 單張下載 / 全部下載 / 移除 / 清空；非 PNG 鋪白底避免透明變黑
  - [x] 入口頁徽章改 is-live；package.json 補編譯映射

### Phase 4 — SVG 轉 Font（技術最深）
- [x] 02 opentype.js 組字型，輸出 woff/ttf
  - [x] 自寫 SVG 解析模組 svg-to-path.js：path d 全指令（含相對／平滑 S,T／圓弧 A→貝茲）、基本圖形（rect/circle/ellipse/line/poly*）轉路徑、transform 矩陣累積、viewBox→em 座標翻轉
  - [x] opentype.js（CDN）組字型：1000 em、ascent 800／descent -200、PUA 碼位起於 U+E001、圖示水平置中
  - [x] TTF 由 opentype 直出；WOFF 自寫封裝（原生 CompressionStream zlib，壓不小則原樣存放）
  - [x] FontFace 載入 TTF 即時預覽圖示格，點卡片複製 class 名
  - [x] 自動產生 @font-face + .icon-* CSS（字型名／class 前綴可調），一鍵複製
  - [x] 入口頁徽章改 is-live；package.json 補編譯映射

### Phase 5 — 擴充工具（已排定開發順序）

> 2026-06-05 使用者排定的開發順序。每收工一個回來勾選並更新最上方「最後更新」。

- [x] 05 grid / flex 模擬器：Flex / Grid 雙模式分頁；分段按鈕調列舉屬性、滑桿調 gap／欄數；子項目可增減；棋盤底紋舞台即時預覽；自動產生並複製 CSS
- [x] 06 圖片裁切／改尺寸：互動裁切框（拖曳移動／八向控制點縮放、三分構圖線、框外壓暗）；比例分段鈕（自由 / 1:1 / 4:5 / 3:4 / 16:9 / 3:2，鎖比例時只留四角維持比例）；串 03 社群版位下拉，選版位即鎖比例並指定精確輸出像素；輸出裁切原寸／指定寬度等比；格式 JPEG / PNG / WebP；Canvas drawImage 輸出下載；入口頁徽章改 is-live、package.json 補編譯映射
- [x] 07 favicon 產生器：上傳一張圖，Canvas 多尺寸縮放輸出整組圖示（16/32/48/180/192/512）；背景透明或純色、形狀方形／圓角／圓形、可調內距；手寫 ICO 容器（PNG 內嵌）併 16/32/48 為 favicon.ico、手寫 store-only ZIP 打包；產生 site.webmanifest 與 <head> 嵌入碼可一鍵複製；單張下載；入口頁徽章改 is-live、package.json 補編譯映射
- [x] 08 QR Code 產生器：自寫本地 QR 編碼模組 `qr-encode.js`（位元組模式 UTF-8、自動選版本 1–40、L/M/Q/H 容錯、Reed-Solomon ECC、8 種遮罩自動挑最佳，零相依、維持 CSP `script-src 'self'`）；即時預覽 SVG，前景／背景色＋對比過低提醒、容錯等級、外框留白可調；下載 SVG／PNG（整數倍率銳利）、複製 SVG 原始碼，下載／複製埋 `track('use')`；入口頁徽章 is-live＋搜尋計數改 8、package.json 補編譯映射
- [x] 09 調色盤產生器：主色（色票＋HEX 雙向同步）推導 50–900 色階（固定亮度梯度＋飽和度曲線、標記最接近主色的階級）與互補（H+180）／類比（H±30）調和色；點任一色塊複製 HEX；變數前綴可調、SCSS／CSS 變數格式切換、即時碼塊一鍵複製或下載 `.scss`／`.css`；自寫零相依色彩換算（hex↔rgb↔hsl）維持 CSP `script-src 'self'`；複製／下載埋 `track('use')`；入口頁徽章 is-live＋搜尋計數改 9、package.json 補編譯映射
- [x] 10 色彩格式轉換：HEX ↔ RGB ↔ HSL ↔ OKLCH 四格式雙向即時互轉（單一真實來源為 RGB，編輯任一欄即時換算其餘並跳過輸入中欄位避免游標跳動）；自寫零相依 OKLab 矩陣（sRGB↔線性↔OKLab↔OKLCH），Node 驗證往返精確、純紅符合 CSS 規範值；左側大型預覽＋色票挑色＋隨機色＋EyeDropper 螢幕取色（功能偵測，不支援自動隱藏）；各格式單獨複製埋 `track('use')`；入口頁徽章 is-live＋搜尋計數改 10、package.json 補編譯映射
- [x] 11 字級比例計算：基準字級（滑桿）× 比例（6 種預設音程＋自訂）推導 type scale，向上／向下階數可調；右側字級海報以真實 px 渲染樣本字（可自訂預覽字），基準階以硃紅標線標記；階名依 Tailwind／既有 `_tokens.scss` 慣例自動命名（base 上下展開 sm/xs/2xs…、lg/xl/2xl…）；輸出 `$fs-*` SCSS／CSS 變數，rem／px 單位切換、變數前綴可調，rem 模式於註解附 px 對照；複製／下載埋 `track('use')`；入口頁徽章 is-live＋搜尋計數改 11、package.json 補編譯映射
- [x] 12 Lorem 假文產生器：中文／拉丁 Lorem 雙語言；段落／句子／字數三種產生單位，數量可調（各模式套合理上限與預設）；拉丁文可選以經典「Lorem ipsum…」起頭，中文模式自動停用此選項；零相依本地詞庫隨機組字（中文常用雙字詞＋全形標點造句、拉丁文經典詞庫＋隨機逗號）；右側可讀稿件區即時渲染，統計段／句／字數與字元數，「重新產生」重新隨機；複製／下載 .txt 埋 `track('use')`；入口頁徽章 is-live＋搜尋計數改 12、package.json 補編譯映射
- [x] 13 字數／字元統計：稿紙輸入＋黏頂統計面板即時計算；中文逐字、英數計詞為「字數」，另含字元（含／不含空白）、行數、段落、句子、UTF-8 位元組；碼位計字元（正確處理 emoji）、句末標點切句、空行切段；閱讀／朗讀時間（中文 300／180、英數 200／130 每分）；字元組成堆疊長條＋圖例（中文／字母／數字／標點／空白，加總＝字元數）；載入範例／清空／複製統計摘要（埋 track('use')）；零相依維持 CSP script-src 'self'；入口頁徽章 is-live＋搜尋計數改 13、package.json 補編譯映射
- [x] 14 陰影產生器：左控制台＋右棋盤舞台即時預覽；多層 box-shadow 清單可新增／刪除／點選，選取層滑桿調 X／Y 位移、模糊、擴散、不透明度，色票＋HEX 雙向同步、inset 內陰影切換；5 組預設樣式整組替換；預覽可調方塊色／圓角／舞台底色（淺／深／棋盤）；hex→rgba 輸出、多層逐層換行；複製 CSS 埋 track('use')；入口頁徽章 is-live＋搜尋計數改 14、package.json 補編譯映射
- [x] 15 漸層產生器：linear／radial／conic 三種漸層；linear/conic 調角度（滑桿＋快捷鈕）、radial 選 circle/ellipse；棋盤底漸層條點空白新增色標、拖曳把手調位置（新增色標自動內插接續漸層色）；選取色標調位置、色票＋HEX 雙向同步、可刪除（至少 2 個）；6 組預設一鍵替換；CSS 依位置排序輸出、複製埋 track('use')；自寫零相依 hex↔rgb 內插維持 CSP script-src 'self'；入口頁徽章 is-live＋搜尋計數改 15、package.json 補編譯映射
- [x] 16 圖片格式轉換：PNG ↔ WebP ↔ JPEG ↔ AVIF（與 01 共用解碼→toBlob 流程，聚焦格式互轉、保留原尺寸）；目標格式 4 選 1，啟動偵測 WebP／AVIF 編碼支援不支援即停用；品質滑桿有損格式才啟用、PNG 停用，JPEG 鋪白底；每列顯示來源→目標格式徽章＋原尺寸＋前後大小對比；單張／全部下載、移除、清空，下載埋 track('use')；入口頁徽章 is-live＋搜尋計數改 16、package.json 補編譯映射

### 未來擴充
- [ ] （待定）其他工具，新增 `services/<name>/` 資料夾即可

## 接續備忘

- 下次接續：提到本專案會自動載入 project skill；先讀本檔看進度。
- 每個工具自包含，互不依賴；做新工具不會動到既有工具。
