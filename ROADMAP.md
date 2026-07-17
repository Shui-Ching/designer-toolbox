# 設計師工具箱 · 開發進度

> 每次收工更新此檔。下次接續時，這裡是進度的單一真實來源。
> 架構決策、設計 token、新增工具標準步驟另存於 project skill（`.claude/skills/designer-toolbox`）。
> 收工更新方式：改「最後更新」一行＋在工具總覽補一列；實作細節寫進 git commit 與程式碼註解，不要貼進本檔。

最後更新：2026-07-17（晚）— **38 JSON 格式化／校驗**編輯區改為 **CodeMirror 6**，「摺疊」與「編輯」合併為同一介面（使用者反饋：不要「編輯 ↔ 折疊檢視」兩種模式分開）——行號 gutter 旁有摺疊箭頭，收合任一物件／陣列後照樣打字編輯，收合處顯示可點擊展開的 `⋯` 佔位符。**依賴決策（使用者拍板）**：textarea 無法原生折疊，兩案並陳（A：CodeMirror 6 vendor 進來；B：零相依唯讀樹加行內編輯）後使用者選 A；比照 pdf-lib／mediabunny 前例將 CodeMirror 以 esbuild 打成單檔 ESM（`vendor/codemirror.esm.min.js`，316KB min／103KB gzip，檔頭註明各套件版本：state@6.7.1 view@6.43.6 language@6.12.4 commands@6.10.4 lang-json@6.0.2 @lezer/highlight@1.2.3），CSP `script-src 'self'` 不需更動、不走 CDN；bundle 只匯出用到的 API（進入點見本段，重建時在任一暫存目錄 `npm i` 上述套件＋esbuild `--bundle --format=esm --minify` 即可）。整合方式：校驗仍走原生 `JSON.parse`（debounce 200ms 的 updateListener），語法著色用 `HighlightStyle` 對映設計 token 的 CSS 變數（鍵名墨黑粗體、字串硃紅深、標點淡墨），縮排 chip 透過 `Compartment` 原地重設 `indentUnit`，貼上自動排版改掛 `domEventHandlers.paste`，錯誤定位改為 dispatch selection＋scrollIntoView（`locateError` 同時支援 V8「(line x column y)」與 position 兩種訊息格式，並由行欄反推字元位置；注意新版 V8 對部分錯誤型態只給文字片段不給位置，此時退回文末定位，屬引擎限制）。舊的唯讀結構樹、view-toggle chip、AUTO_COLLAPSE_NODE_LIMIT 全數移除（大型文件效能改由 CodeMirror 視口渲染承擔，4000 筆物件陣列貼上＋自動排版約 830ms 含解析）。範例 JSON 依使用者要求加入 emoji（🧰🎨🍅⋯），順帶當多位元組字元測項。**資安把關**：新增第三方庫已由使用者明確核可；bundle 為本機打包非下載成品，來源為 npm 官方套件；CodeMirror 以 text node 渲染文件內容，實測注入 `<img onerror>`／`<script>` 鍵值僅純文字呈現不執行、無 DOM 節點生成。用 playwright-core 驅動系統 Chrome 實測（本機靜態伺服器）30 項全過：初始 disabled 狀態、載入範例（含 emoji）、gutter 箭頭收合單節點、**收合狀態下直接編輯（改壞→即時報錯→改好，佔位符不受影響）**、點 `⋯` 展開、全部展開／收合、壓縮＋切 4 空格格式化、錯誤行列號解析與點擊定位選中錯誤字元、貼上合法 JSON 自動排版、XSS 注入、剪貼簿複製一致、4000 筆大型 JSON、窄螢幕 390px 不破版，console 全程無錯誤。

最後更新：2026-07-17 — **38 JSON 格式化／校驗**新增左側輸入欄的「折疊檢視」（**本段做法已於同日稍晚被 CodeMirror 版取代，見上一段**）：textarea 無法原生折疊，故在編輯區加「編輯 ↔ 折疊檢視」chip 切換（沿用 indent-chip 樣式），折疊檢視是從 `JSON.parse` 結果渲染的唯讀結構樹——每個物件／陣列可各自收合（箭頭或點收合摘要切換），收合時顯示 `{ ⋯ }` 摘要＋鍵數／項數，另附「全部展開／全部收合」；chip 僅在 JSON 有效時可用，清空自動切回編輯模式，複製內容仍複製原始文字。效能：子節點延遲建置（收合狀態不先建 DOM，首次展開才建），節點總數 >3000 時預設收合第二層以下，4000 筆物件陣列初始渲染僅 4 行 DOM／22ms。**資安把關**：樹狀渲染全程 `createElement`＋`textContent`，不經 `innerHTML`，實測注入 `<img onerror>`／`<script>` 鍵值僅以純文字呈現不執行。用 playwright-core 驅動系統 Chrome 實測（本機靜態伺服器）27 項全過：初始 disabled 狀態、載入範例後進折疊檢視、單節點收合／展開、全部展開／收合、切回編輯、XSS 注入、清空重置、大型 JSON 延遲建置、原始值與空容器 root 邊界，console 全程無錯誤。

最後更新：2026-07-14 — 完成 **46 LINE Rich Menu 預覽模擬器**（拖入圖文選單設計稿，驗證尺寸／格式／檔案大小是否符合 LINE 官方規格，疊上分格模板 overlay 檢查版面是否對齊分格線，並用自繪的去識別化聊天室 mockup 預覽展開／收合的實際互動）。實作前先查證 LINE Developers 官方文件現行規格（2026-07-14）：官方尺寸僅 6 組（Large 2500×1686／1200×810／800×540，Compact 2500×843／1200×405／800×270）、格式限 JPEG／PNG、檔案 ≤1MB、tappable area 上限 20 個、自訂尺寸需寬 800–2500px、高 ≥250px、寬高比（寬÷高）≥1.45；因無法從官方頁面取得逐字的分格模板座標表，`shared/data/richmenu-specs.json` 的 `templates` 一律採等分幾何（1/2/3/4/6 格）並在說明文字誠實標註「常見等分版面，非 LINE 專屬座標資料」，不假裝是官方精確值。規格判斷抽成零 DOM 依賴的 `spec-check.js`（`checkFormat`／`checkFileSize`／`matchOfficialSize`／`checkDimensionRange`／`detectCategory`），供 Node 測試與畫面共用；large／compact 兩類官方尺寸的高寬比分別穩定落在 0.674 與 0.337 附近、差距夠大，故用「高／寬 > 0.5」當門檻即可可靠分類，即使是非官方自訂尺寸也能推斷設計意圖的版位類別。分格 overlay 用相對座標（0–1 分數）的絕對定位 `div` 疊在圖片上，不論實際圖片尺寸皆可直接乘算，下載時另外在 canvas 上重繪同一份格線燒錄成單張 PNG。聊天室 mockup 完全自繪（非擷取真實 LINE 畫面），採泛用文字與代稱頭像（「官方帳號」／「OA」）做去識別化；展開／收合高度用 JS 依圖片實際寬高比即時算出，切換時對明確的 px 數字做 CSS transition，避免對 `height:auto` 做動畫導致無法平滑過渡。**排程備忘**：原排程第 6 順位「裝置外框截圖」備註與此工具「共用自繪手機外框技術」，但第 6 號尚未實作；依專案慣例「每個工具自包含、互不依賴」，此工具改為自行內建輕量聊天室外框，不等候第 6 號，未來第 6 號上線後可再評估是否抽出共用。用 Playwright 實際跑過瀏覽器驗證（本機 http-server）：初始空狀態、上傳官方 Large／Compact 尺寸圖片皆正確判定並列出對應分類的分格模板選單、切換六宮格／三欄等分模板即時疊圖且格數正確、關閉「顯示分格線」隱藏 overlay、聊天室展開／收合高度正確切換（含由左側控制面板按鈕觸發）、下載疊圖檔名正確、更換圖片重置狀態、上傳 500×500 不符寬高比的圖片正確標示尺寸不符原因、窄螢幕（390px）版面正常上下堆疊不破版，全程 console 無錯誤；另跑 Node 單元測試（24 組斷言，涵蓋 6 組官方尺寸精確命中、large／compact 分類判斷、自訂尺寸範圍邊界、`evaluateSpec` 綜合案例）全數通過。

最後更新：2026-07-14 — 完成 **45 我的螢幕資訊**（偵測本機螢幕解析度、視窗大小、裝置像素比 DPR、觸控支援、目前響應式斷點共 5 項數值，調整視窗大小即時更新，並可一鍵「複製診斷報告」）。定位是丟給客戶或協作者的診斷頁，與 04 號 device-size（查別人的裝置規格）互補，這裡查的是「現在正在用的這台」。斷點判定改為在 `script.js` 內建 Bootstrap 5 預設斷點常數，不 fetch JSON——診斷頁的核心價值是隨開即用，不該因為額外的網路請求在 `file://` 或離線環境下失效（與 04 號可以依賴伺服器環境不同，那邊本來就假設是查表工具）。診斷報告是純文字組合（解析度／視窗大小／DPR／觸控／斷點＋產生時間戳），方便直接貼進聊天或工單。**資安把關**：偵測到的數值只在本機畫面顯示，不呼叫 Umami 回傳實際數值、不寫進網址列；唯一送出的分析事件是點擊複製報告時的 `track('use')`，只帶工具代號不帶內容，符合全站「只送中性資訊」的隱私基線。用 Playwright 實測（本機 http-server）：初始狀態五項數值正確、縮小視窗（500×800）斷點即時切換為 XS、放大回桌機尺寸（1920×1080）斷點跟著變回 XXL、複製診斷報告的剪貼簿內容與畫面顯示一致、分享按鈕與返回連結正常，console 全程無錯誤。

最後更新：2026-07-13 — 完成 **44 佔位圖產生器**（自訂寬高、底色、標註文字產生佔位圖，可套用 03 號社群版位尺寸，輸出 PNG 或 SVG）。核心運算抽成零 import 的 `render.js`（沿用 08 qr-code 的 qr-encode.js 風格，不碰 DOM），canvas 預覽與 PNG 輸出、SVG 序列化共用同一份「規格」物件（尺寸、底色、文字、樣式衍生出的版面幾何），避免兩種輸出對不齊。版面幾何全部依「短邊」等比例推導（字級、邊框留白、線寬、圖角標記臂長皆為短邊的固定比例並各自 clamp），小至 16px 大至 4000px 都不會產生負值或互撞。文字顏色依底色自動反黑／反白：複用 27 號對比度檢查器的 WCAG 相對亮度／對比值算法，黑白兩個候選取對比值較高者，不是單純亮度門檻判斷。兩種樣式：「置中文字」純底色＋置中標註（留空則顯示尺寸字樣，否則用自訂文字）；「藍圖標註線」在置中文字之外疊加邊框、對角交叉線與四角觀景窗式標記（皆用同一色但三種透明度／線寬營造層次），呼應全站手冊／藍圖美學。SVG 輸出將自訂文字跑過 `escapeHtml` 才嵌入 `<text>`，避免使用者輸入的 `<`、`&` 破壞 XML 或被當標籤解析。手動抽出 render.js 的核心函式跑 Node 測試（56 組斷言）：黑底／白底／硃紅／淡紙色／無效 HEX 的自動反色結果、8 組常見與極端尺寸（含 16×4000 極端長寬比）下版面幾何不產生 NaN／負值／四角互撞，另外驗證 `escapeHtml` 能擋下 `<script>` 等字元不讓它以原始標籤形式流入 SVG 字串。用 Playwright 實際跑過瀏覽器驗證（本機 http-server）：初始狀態、切換置中文字／藍圖標註線樣式、自訂標註文字、淺色底自動反黑字、無效 HEX／尺寸 <16 標紅且不套用、寬高對調、套用非正方形社群版位（Facebook 封面照片 851×315）同步寬高與讀數、PNG↔SVG 格式切換、複製 SVG 原始碼內容正確（`<svg>`、尺寸屬性皆對）、下載 PNG／SVG 檔名正確、4000×4000 邊界不崩潰，全程 console 無錯誤（23 項全數通過）。

最後更新：2026-07-13 — 完成 **43 字型檔預覽器**（拖入 TTF/OTF/WOFF 字型檔，即時預覽字重與樣式、字級瀑布，並檢視字符集涵蓋率與缺字，可一次上傳多檔互相比較）。自寫 OpenType/WOFF 表格解析（`font-parser.js`）：讀 sfnt／WOFF1 表格目錄取出 `name`（家族名／樣式名／完整名／PostScript 名，優先 Windows(3) 平台記錄、UTF-16BE 解碼）、`OS/2`（`usWeightClass` 字重、`fsSelection` 判斷粗體斜體）、`head`（macStyle 作 OS/2 缺席時備援）、`cmap`（format 0/4/12 子表解出字符涵蓋範圍，合併重疊區段後供二分搜尋）四張表；WOFF1 表格採 zlib 壓縮，比照 02 號 svg-to-font 用 `CompressionStream('deflate')` 寫出 WOFF 的反向操作，改用瀏覽器原生 `DecompressionStream('deflate')` 解壓（zlib 格式即 `'deflate'`），零相依。**WOFF2 因採 Brotli 壓縮整檔、瀏覽器原生串流 API 不支援解壓，不在支援格式內**（與排程方向列一致，僅列 TTF/OTF/WOFF）。字型渲染另走原生 `FontFace` API 動態載入（每個檔案配一個內部 family 名稱），與中繼資料解析互相獨立，故單純預覽渲染不受表格解析限制。多檔上傳時每張卡片各自用自身字型渲染「Ag 永安 09」預覽樣張＋字重標籤，方便一眼比較不同字重／樣式；點卡切換下方詳細面板（字型資訊、可編輯文字的字級瀑布、依 Unicode 區塊統計的字符涵蓋率長條、輸入文字逐字元核對的缺字檢查，未收錄字元標紅波浪底線）。字符涵蓋率為 cmap 區段推算（format 4 少數邊界字元可能對應 `.notdef`），標示為估算值。用 Playwright 實際跑過瀏覽器驗證（本機 http-server，file:// 下 ES Module 會被 CORS 擋下）：上傳 TTF 正體＋粗體＋OTF 三檔、卡片預覽與字重資訊正確、切換卡片後詳細面板同步更新、字級瀑布 11 級隨文字輸入即時更新、字符涵蓋率正確列出區塊、缺字檢查正確標出字型未收錄的中文與符號字元、複製字型資訊、移除卡片；另用瀏覽器原生 `CompressionStream` 現場把系統字型轉成 WOFF1 測試檔，確認 zlib 解壓路徑正確還原相同的家族名／字重／字符數；上傳偽裝副檔名的非字型檔案確認錯誤訊息不崩潰；全程 console 無錯誤。

最後更新：2026-07-13 — 完成 **42 CSV ↔ Markdown/JSON 表格轉換**（貼上 CSV 或從 Excel／Google 試算表複製的表格，即時轉換成 Markdown 表格與 JSON，並附即時預覽表格對照）。自寫 CSV/TSV 解析器（逐字元狀態機，非 split(',') ），正確處理雙引號跳脫（`""` → `"`）、引號內含分隔符與換行的跨行欄位；分隔符號可自動偵測（逗號／Tab／分號，取樣前 5 行、忽略引號內字元，偵測到 Tab 即優先判定，對應 Excel 複製貼上的常見情境）或手動指定。首列可選「作為標題列」（Markdown 表頭、JSON 物件陣列）或「純資料」（Markdown 補生成「欄位 N」表頭、JSON 陣列的陣列）。欄位數不一致的列一律補齊空字串到當次最大欄數，避免 Markdown 表格斷欄。Markdown 輸出跳脫儲存格內的 `\`、`|`，換行轉 `<br>`；預覽表格用 `createElement`＋`textContent` 組 DOM，不經 `innerHTML`。設定與格式切換沿用 33 號 svg-optimizer 的 `controls`／`chip-group`／`opt-chip` 語彙，輸入輸出框沿用 38 號 json-formatter 的 `editor-toolbar`／`text-area`。手動抽出核心解析／轉換函式跑 11 組 Node 單元測試（含引號跳脫、跨行欄位、分隔符偵測、Markdown pipe 跳脫、有無標題列的 JSON 形狀）全數通過；另用 Playwright 實際跑過瀏覽器驗證：初始空狀態、載入範例（含引號逗號／全形逗號／換行皆正確解析）、Markdown／JSON 切換、有無標題列切換、Tab／分號手動分隔符、未成對引號的畸形輸入（不崩潰、寬容處理）、複製結果到剪貼簿、清空恢復空狀態，console 皆無錯誤。

最後更新：2026-07-13 — 完成 **41 Regex 測試器**（輸入正規表達式與 g/i/m/s 旗標，即時高亮所有匹配並列出擷取群組，附 12 組常用 pattern 速查）。原生 `RegExp`，零相依；沒有 `g` 旗標時比照原生行為只回傳第一筆，避免使用者誤以為工具壞掉。找匹配用 `exec` + `lastIndex` 迴圈，零寬匹配時手動 `lastIndex++` 避免無窮迴圈，並設 2000 筆匹配上限防病態 pattern 撐爆 DOM（無法防 ReDoS 級的災難性回溯，屬原生 regex engine 的固有限制，不在自寫範圍內）。高亮沿用 40 號 text-diff 的 `createElement`＋`textContent` 組 DOM 手法，不經 `innerHTML`。擷取群組同時列出數字群組（`m[1..]`）與具名群組（`m.groups`），未匹配到的群組顯示「（未匹配）」。常用 pattern（Email／URL／IPv4／Hex 色碼／台灣手機／日期／時間／中文字元／HTML 標籤／數字／多餘空白／英數帳號）為工具內建常數，非外部 JSON（資料量小且不重用）。範圍拍板時已確認**不做替換（replace）功能**，先聚焦匹配＋擷取＋速查。用 Playwright 實際跑過瀏覽器驗證：初始空狀態、載入範例自動帶入 Email pattern 並正確高亮、切換 Hex 色碼 pattern、具名群組擷取正確對應、錯誤 pattern 顯示語法錯誤訊息、關閉 g 旗標後只回傳第一筆匹配、複製所有匹配、清空恢復空狀態，console 皆無錯誤。

## 工具總覽（46 個，全數上線）

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
| 38 | JSON 格式化／校驗（`json-formatter`） | text | CodeMirror 6 編輯器（本機 vendor），摺疊與編輯同一介面；貼上自動排版＋即時校驗，`SyntaxError` 訊息解析行號欄號並可點擊跳到錯誤字元；縮排 2／4／Tab 切換＋壓縮成單行 |
| 39 | 時間戳轉換（`timestamp-convert`） | reference | Unix timestamp（秒／毫秒）↔ 日期時間雙向即時互轉＋時區切換，另提供目前時間戳速查；`Intl.DateTimeFormat`／`Intl.RelativeTimeFormat` 零相依換算，沿用 23 號 `unit-convert` 的速查換算版面 |
| 40 | 文字差異比對（`text-diff`） | text | 貼上 A／B 兩段文字，逐行／逐字比對並高亮新增／刪除（自寫 LCS diff，零相依），雙欄輸入沿用 26 號 `pangu`／13 號 `word-count` 的 editor-pane 架構 |
| 41 | Regex 測試器（`regex-tester`） | text | 輸入正規表達式＋g/i/m/s 旗標，即時高亮匹配並列出數字／具名擷取群組，附 12 組常用 pattern 速查；原生 RegExp，零相依 |
| 42 | CSV ↔ Markdown/JSON 表格轉換（`table-convert`） | text | 自寫 CSV/TSV 解析器（狀態機，處理引號跳脫與跨行欄位），分隔符號自動偵測／手動指定，輸出 Markdown 表格與 JSON |
| 43 | 字型檔預覽器（`font-preview`） | assets | 拖入 TTF/OTF/WOFF 即時預覽字重、字符集涵蓋率、字級瀑布，可多檔比較；自寫 OpenType/WOFF 表格解析＋原生 FontFace API，零相依 |
| 44 | 佔位圖產生器（`placeholder-image`） | image | 自訂尺寸／底色／文字輸出 PNG/SVG 佔位圖，可套 03 號社群版位尺寸；置中文字／藍圖標註線兩種樣式，字級與線條依短邊等比例縮放，文字色依底色 WCAG 對比自動反黑／反白（複用 27 號算法），零相依 |
| 45 | 我的螢幕資訊（`screen-info`） | reference | 偵測本機螢幕解析度／視窗大小／DPR／觸控／目前斷點，resize 即時更新＋一鍵複製診斷報告；斷點內建 Bootstrap 5 常數（不 fetch，離線也能用），偵測值只留本機顯示不送 Umami、不進 URL |
| 46 | LINE Rich Menu 預覽模擬器（`richmenu-preview`） | image | 拖入圖文選單設計稿驗證尺寸／格式／≤1MB（規格存 `richmenu-specs.json`，比照 03 號），疊分格模板 overlay＋自繪去識別化聊天室 mockup 預覽展開／收合；規格判斷抽成零 DOM 的 `spec-check.js`，尺寸與模板皆查證 LINE 官方文件 |

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

2026-07-13 拍板，依下表順序開發；正式工具編號於上線時連續分配（Regex 測試器已於 41 號、CSV ↔ Markdown/JSON 表格轉換已於 42 號、字型檔預覽器已於 43 號、佔位圖產生器已於 44 號、我的螢幕資訊已於 45 號、LINE Rich Menu 預覽模擬器已於 46 號上線，見上方工具總覽）。

| 順序 | 工具（資料夾） | 分類 | 方向 |
|---|---|---|---|
| 1 | CSS clip-path 產生器（`clip-path`） | css | 多邊形拖曳控制點＋預設形狀（三角、箭頭、對話框），輸出 `clip-path`；拖曳互動沿用 28 號 cubic-bezier |
| 2 | SVG Blob／波浪產生器（`blob-generator`） | assets | 隨機有機形狀＋波浪分隔線，調複雜度與隨機種子，輸出 SVG；貝茲曲線數學自寫 |
| 3 | 噪點／紋理產生器（`noise-texture`） | assets | grain、dot grid、格線紋理，輸出可平鋪 PNG/SVG；Canvas＋`crypto.getRandomValues` |
| 4 | EXIF 檢視與移除（`exif-viewer`） | image | 拖入照片看 EXIF（GPS、機型），一鍵去除後下載；自寫 EXIF parser（JPEG APP1 段），去除走 01 號 Canvas 重編碼管線 |
| 5 | 九宮格切圖（`grid-splitter`） | image | 長圖或方圖切成 IG 九宮格／輪播分頁，ZIP 打包下載；Canvas 切片＋沿用 07 號 favicon 的手寫 ZIP 容器 |
| 6 | 裝置外框截圖（`device-mockup`） | image | 截圖套進手機／瀏覽器外框輸出提案用 mockup；外框 SVG 自繪＋Canvas 合成，與 04 號 device-size 資料互通 |
| 7 | 日期計算器（`date-calc`） | reference | 日期差、加減天數、倒數日；原生 `Date`＋`Intl`，沿用 39 號 timestamp 版面 |
| 8 | PPI 計算器（`ppi-calc`） | reference | 解析度＋螢幕吋數 → PPI／設備像素比速查；純算式 |
| 9 | 亂數密碼／字串產生器（`password-generator`） | assets | 長度、字元集、排除易混淆字元；複用 34 號抽籤器的 `crypto` 拒絕採樣 |
| 10 | 倒數計時器／碼表（`countdown-timer`） | focus | 通用倒數＋碼表，補 focus 類缺口；沿用 21 號 pomodoro 的 SVG 環＋Web Audio |
| 11 | Emoji 查找複製（`emoji-picker`） | reference | 分類＋中英關鍵字搜尋，點卡複製；複製 37 號 special-chars 架構，只換 JSON 資料 |
| 12 | 繁簡轉換（`zh-convert`） | text | 繁↔簡＋台灣／中國用語提示；需準備對照 JSON，零相依 |
| 13 | Mermaid 流程圖預覽器（`mermaid-preview`） | text | 貼 Mermaid 語法即時預覽＋匯出 SVG/PNG；**需本機 vendor mermaid.js（約 2–3MB）**，實作前先確認版本與 CSP 影響（先例：20 號 pdf-compress） |

## 後續可選（未做，留待提出）

- 單位換算：自訂單位／我的最愛
- 入口頁：記住排序選擇（localStorage）、分類 chip 複選、熱門度改本機使用次數
- 意見回饋入口（footer）已於 2026-06-07 完成

## 接續備忘

- 下次接續：提到本專案會自動載入 project skill；先讀本檔看進度。
- 每個工具自包含，互不依賴；做新工具不會動到既有工具。
