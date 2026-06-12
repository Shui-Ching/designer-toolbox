# 設計師工具箱 · 開發進度

> 每次收工更新此檔。下次接續時，這裡是進度的單一真實來源。
> 架構決策與設計 token 另存於 project skill（見最下方）。

最後更新：2026-06-12（完成 **23 浮水印**：替圖片壓上客製化浮水印，全程瀏覽器端、檔案不上傳。沿用 01／06／16 的「解碼→canvas→toBlob」圖片管線。兩種浮水印——**文字**（內容／顏色／粗體）或**上傳 logo 圖**（建議去背 PNG）；**單顆**走九宮格定位或直接在預覽上拖曳（拖曳即把 `anchor` 設為 `free`、存正規化 0..1 中心座標），**平鋪整張**則旋轉後以對角線範圍鋪滿、間距可調；大小／透明度／旋轉皆可調。**關鍵設計：所有尺寸性參數一律以「佔圖寬比例（sizePct／gapPct）」與 0..1 座標儲存**，故同一組設定能一致套用到尺寸不同的批次圖片——預覽用縮放畫布（長邊 ≤720px）、輸出用原圖尺寸，兩者共用同一套 `drawTo()` 數學。支援**批次**（縮圖列切換 active 預覽、單張移除、清空、新增）；輸出 PNG／JPEG／WebP（JPEG 鋪白底），「下載這張」與「全部下載」皆埋 `track('use')`。首繪前 `await document.fonts.ready` 避免 canvas 量到 fallback 字寬。入口頁卡片顯示編號 **22**（接在番茄鐘 21 之後）＋`data-category="image"`＋搜尋計數 21→22、package.json 補編譯映射、tool-head 標 `Tool / 23`）

前次更新：2026-06-12（入口頁將 21 環境音卡片**暫時隱藏**：整張 `.tool-card` 以 HTML 註解包起（保留原始碼，日後拿掉註解即可復活），不採 `hidden` 屬性——因 `home.js` 篩選時會對每張 `.tool-card` 重設 `el.hidden`，加屬性會在使用者一點分類／搜尋後被 JS 重新顯示。22 番茄鐘編號往前遞補為 **21**，搜尋計數初始值由 22 改 **21**（有 JS 後仍由 home.js 動態算）。工具本體 `services/white-noise/` 與其分析串接保留不動，僅入口頁不再露出）

再前次更新：2026-06-11（完成 21 環境音 + 22 番茄鐘，並新增「效率」(focus) 分類 chip。21 原為「白噪音混音台」、規劃 8 軌，但使用者驗收後判定白／粉紅／棕噪音、海浪、溪流、咖啡廳的純合成擬真度不足、名實不符，全數移除，只留雨聲、風聲兩軌並更名為「環境音」。聲音全部用 Web Audio API 即時合成、零外部音檔維持 CSP script-src 'self'：雨＝粉紅噪音（Paul Kellet）過高通留沙沙聲，風＝棕噪音（積分白噪音）過帶通＋兩組慢 LFO 調音量／頻率營造陣風。每頻道 source→濾波→textureGain(調性)→userGain(音量)→masterGain；首次互動才建 AudioContext、所有 source 一次 start 靠 gain 開關。UI：大播放鈕、主音量、自動停止（15/30/60/90 分）、3 組快速情境（綿綿細雨／狂風／風雨交加）、頻道卡（點擊開關＋拖曳音量＋等化器動畫）；首次出聲埋 track('use')。folder／data-tool 仍沿用 white-noise 維持路徑與分析連續性。22：番茄鐘專注／短休／長休三模式，SVG 進度環倒數（rAF 以時間戳計算避免分頁節流誤差）、document.title 同步倒數可在背景分頁看；時間到自動接續（每 interval 輪長休息）、Web Audio 合成提示音（專注結束上行三音、休息兩音）、可選桌面通知；設定與今日番茄數存 localStorage（跨日自動歸零）。兩工具入口頁卡片 is-live＋data-category="focus"＋搜尋計數改 22、package.json 補編譯映射）

---

## 專案定位

一個工具箱型 monorepo：一個入口頁 + 多個彼此獨立的純前端微型工具，共用一套設計系統。
零後端、零安裝，直接開 `index.html` 或丟到任何靜態空間即可運行。

## 技術約定

- 技術棧：原生 HTML / SCSS / JS（無框架）
- SCSS 編譯：Sass CLI（已列入 `devDependencies`；跑過一次 `npm install` 後直接用 `npm run build:css`，不需 `npx` 或全域安裝）
- 設計風格：手冊風（暖白紙感 × 硃紅，編號式工具索引）
- 命名：kebab-case；CSS class 語意化、反映父子層級
- 註解繁中、命名英文

## 開發指令

```bash
# 部署用：編譯 SCSS + 蓋版本戳記（防瀏覽器快取）
npm run build:css
# 開發用：監看自動編譯（只編譯、不戳記，存檔即重編）
npm run dev
```

> 新增工具時，記得在 `package.json` 的 `compile:css` 補上該工具的 `style.scss:style.css`。

### 防快取版本戳記（2026-06-06 建立）

- `stamp-version.js`：為**本地** css/js 引用補上 `?v=<YYYYMMDDHHmm>`，外部 URL（字體／Umami／jsdelivr CDN）一律略過。涵蓋兩處：
  1. 各 HTML 的 `<link href>` / `<script src>`
  2. 工具頁 `script.js`（ES Module）內 `import` 的本地模組（`shared.js`、`qr-encode.js`、`svg-to-path.js`、`pack.js`…）
- 戳記為**冪等**：重跑只會把舊 `?v=` 換成新值，不會疊加。
- 指令結構：`compile:css`（純 sass）／`stamp`（跑腳本）／`build:css = compile:css && stamp`／`watch:css = compile:css --watch`。
- **工作流程**：本機開發用 `npm run dev`（監看不戳記，搭配瀏覽器硬重整即可）；**要部署／推上線前跑 `npm run build:css`**，戳記才會更新成當下時間，回訪者才會抓到新檔。
- 新增工具時無需改腳本：`stamp-version.js` 自動掃描 `services/*/`，新頁面會被一併涵蓋。

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
- [x] 17 等等吃喝什麼（決策轉盤）：使用者自訂選項清單（新增／刪除，可命名，至少 2 項才能轉）；點「轉！」觸發轉盤旋轉動畫，緩速停止後高亮結果；轉盤以 Canvas 繪製扇形，依選項數均分角度、12 色自動配色（左側清單色塊與扇形同色對應）；四次方緩出 3.2–4 秒動畫；選項可清空並重設；入口頁徽章 is-live＋新增「趣味」分類 chip＋搜尋計數改 17、package.json 補編譯映射；data-category="fun"
- [x] 18 偷懶神器（假更新螢幕）：全螢幕假更新畫面，Mac（Apple logo + 細白進度條 + 剩餘時間倒數）/ Windows 11（彩色 Windows logo + 大字百分比 + 脈衝點點）雙款；非線性進度分三段，28%、77% 自動暫停仿真實更新行為；ESC 退出；入口頁徽章 is-live＋搜尋計數改 18、package.json 補編譯映射；data-category="fun"
- [x] 19 我的留言板：三種訊息選擇（開會去／廁所去／自訂，60 字上限）；一鍵全螢幕顯示大字訊息；capture phase 鍵盤鎖定（僅允許 ESC 解除）；fullscreenchange 事件同步關閉 overlay；入口頁徽章 is-live＋搜尋計數改 19、package.json 補編譯映射；data-category="fun"
- [x] 20 PDF 壓縮：純前端拖放上傳 PDF，**單一有損「光柵化」路線**（2026-06-11 使用者拍板）——pdf.js 逐頁 render→canvas→重新編碼 JPEG→pdf-lib 重組，保留各頁實體尺寸（point）；代價是文字變影像、不可選取（頁面以 .notice 明示。原規格的「pdf-lib 去 metadata 無損模式」因省幅過小、且 pdf-lib 無法重編內嵌圖片而捨棄）。兩根品質槓桿：解析度 96／150／300 DPI（scale=dpi/72）＋ JPEG 品質滑桿（放開才重壓）；改設定即 runToken 作廢進行中迴圈並重壓全部、保留 pdf.js 文件不重新解析。pdf.js@6 + pdf-lib + cmaps + standard_fonts 全本機 vendor 至 `services/pdf-compress/vendor/`（維持 CSP script-src 'self'，另補 worker-src 'self' blob:），首次拖檔才動態 import。第一頁縮圖、逐頁進度條、加密 PDF 偵測友善報錯、>30MB 大檔提示、JPEG 鋪白底；下載埋 track('use')；入口頁徽章 is-live＋data-category="image"＋搜尋計數改 20、package.json 補編譯映射
  - 備註：vendor 約 4.5MB（核心 2.1MB + cmaps 1.6MB + standard_fonts 0.8MB）。cmaps／fonts 由 pdf.js 按需抓取、不會一次全載；保留它們是為了沒嵌入字型的 PDF（尤其中文）光柵化不缺字。`.mjs` 不在 stamp-version.js 的 `?v=` 戳記範圍（只戳 .js），vendor 走動態 import／runtime URL 故無妨
- [x] 21 環境音：聲音用 **Web Audio API 即時合成**、零外部音檔維持 CSP `script-src 'self'`；**僅保留雨聲、風聲兩軌**——雨＝粉紅噪音（Paul Kellet）過高通留沙沙聲，風＝棕噪音（積分白噪音）過帶通＋兩組慢 LFO 調音量／頻率營造陣風。每頻道 `source→濾波→textureGain(調性)→userGain(音量)→masterGain`，首次互動才建 AudioContext、所有 source 一次 start 後靠 gain 開關；UI 含大播放鈕／主音量／自動停止（15/30/60/90 分）／3 組快速情境（綿綿細雨／狂風／風雨交加）／頻道卡（點擊開關＋拖曳音量＋等化器動畫）；首次出聲埋 `track('use')`；入口頁徽章 is-live＋`data-category="focus"`＋搜尋計數改 22、package.json 補編譯映射
  - 備註（2026-06-11 使用者驗收後收斂）：原規劃 8 軌，但白／粉紅／棕噪音、海浪、溪流、咖啡廳的純合成擬真度不足、名實不符，全數移除；只留下實聽夠像的雨聲與風聲。工具因此從「白噪音混音台」更名為「環境音」（folder／`data-tool` 仍沿用 `white-noise` 以維持路徑與分析連續性）
  - **2026-06-12 入口頁暫時隱藏**：`index.html` 中整張卡片已用 HTML 註解包起、不再露出（工具本體與分析串接保留）。要復活時：拿掉 `index.html` 的卡片註解、把編號改回 21（屆時番茄鐘改回 22）、搜尋計數初始值改回 22
- [x] 22 番茄鐘（環境音隱藏後，入口頁編號往前遞補為 21）：專注／短休／長休三模式，SVG 進度環倒數（rAF 以時間戳計算避免分頁節流誤差）、`document.title` 同步倒數可在背景分頁看；時間到自動接續（每 interval 輪走長休息）、**Web Audio 合成提示音**（專注結束上行三音、休息兩音）、可選桌面通知（`Notification` 權限）；設定與今日番茄數存 localStorage（跨日自動歸零）；專注段完成埋 `track('use')`；入口頁徽章 is-live＋`data-category="focus"`＋package.json 補編譯映射
- [x] 23 浮水印（入口頁顯示編號 22）：替圖片壓上客製化浮水印，沿用「解碼→canvas→toBlob」管線、全程瀏覽器端不上傳。**文字**（內容／顏色／粗體）或**上傳 logo 圖**兩種；**單顆**走九宮格定位或直接在預覽拖曳（拖曳即 `anchor='free'`、存 0..1 中心座標），**平鋪整張**旋轉後以對角線範圍鋪滿、間距可調；大小／透明度／旋轉可調。**所有尺寸性參數以「佔圖寬比例」與 0..1 座標儲存**，故同一組設定能一致套到尺寸不同的批次圖（預覽縮放畫布長邊 ≤720px、輸出原圖尺寸，共用同一 `drawTo()`）；批次縮圖列切換 active、單張移除／清空／新增；輸出 PNG／JPEG／WebP（JPEG 鋪白底），下載埋 `track('use')`；首繪前 `await document.fonts.ready`。`data-category="image"`＋搜尋計數改 22、package.json 補編譯映射
  - 後續可選：文字描邊／陰影增強深色背景上的可讀性、平鋪密度的更細控制、輸出時保留原始格式自動對應——目前皆未做，留待使用者提出

## 入口頁功能

### 工具搜尋（既有）
- [x] 關鍵字即時篩選：比對卡片可見文字 ＋ `data-keywords`，更新計數與空狀態

### 分類篩選 chip（2026-06-06 新增）
- [x] 各工具依「對象領域」分類，每張 `.tool-card` 標 `data-category`：
  - **image** 圖片：01 壓縮、06 裁切／改尺寸、16 格式轉換、20 PDF 壓縮、23 浮水印
  - **color** 色彩：09 調色盤、10 色彩格式轉換
  - **css** CSS：05 Grid／Flex、14 陰影、15 漸層
  - **text** 文字：11 字級比例、12 Lorem、13 字數統計
  - **reference** 速查：03 社群尺寸、04 裝置尺寸
  - **assets** 資產：02 SVG 轉 Font、07 favicon、08 QR Code
  - **focus** 效率：番茄鐘（入口頁編號 21；環境音已於 2026-06-12 暫時隱藏）
  - **fun** 趣味：17 決策轉盤、18 假更新、19 留言板
- [x] 搜尋列下方一排 `.filter-chip`（全部／圖片／色彩／CSS／文字／速查／資產／效率／趣味），手冊風：銳利邊角、等寬大寫標籤、選取態 `.is-active` 填硃紅
- [x] `home.js` 改為**分類 × 關鍵字交集篩選**：先選分類再搜尋會在該領域內再過濾；chip 為單選＋「全部」，切換時同步 `aria-pressed`
- [x] 無障礙：chip 用 `<button>`、外層 `role="group"`、`:focus-visible` 焦點框
- 備註：新增工具時，除既有步驟外，記得替入口頁卡片補對應 `data-category`；若開新領域，於 `index.html` chip 列與 `home.js`（邏輯自動支援任意 filter 值）對齊即可

> 目前 chip 為單選。若日後要可複選多領域，需改 `home.js` 的 `activeCategory`（單值）為集合並調整 active 切換邏輯。

### 未來擴充
- [ ] （待定）其他工具，新增 `services/<name>/` 資料夾即可

### 回饋管道（全站功能）
- [x] 在入口頁 footer 加「意見回饋」入口（Bug 回報 / 優化建議 / 功能許願池，2026-06-07 完成）

## 接續備忘

- 下次接續：提到本專案會自動載入 project skill；先讀本檔看進度。
- 每個工具自包含，互不依賴；做新工具不會動到既有工具。
