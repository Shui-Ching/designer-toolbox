# 設計師工具箱 · 開發進度

> 每次收工更新此檔。下次接續時，這裡是進度的單一真實來源。
> 架構決策與設計 token 另存於 project skill（見最下方）。

最後更新：2026-07-04（完成 **35 GIF 動畫壓縮**（`services/gif-compress`，`data-category="image"`，卡片顯示編號 **35**、tool-head `Tool / 35`）：**自寫零相依 GIF codec**（`gif-codec.js`，維持 CSP `script-src 'self'`）。瀏覽器無法用 Canvas 拆 GIF 動畫每幀（只拿得到第一幀），故自行實作：**解碼**（`decodeGif`：解析 Logical Screen／GCT／各區塊，含**變動碼寬 LZW 解碼**、GIF 交錯掃描還原、NETSCAPE 迴圈次數）→ 依 **disposal 處置方式**（1 保留／2 還原背景／3 還原先前）＋透明索引**合成每幀完整 RGBA 畫面**；**減色**（`quantizeFrame`：不透明色直方圖→**中位切割**沿最長通道以像素數加權中位切分、綠通道略加權，近似色以顏色 key 快取比對，透明另保留一格且不參與最近色匹配，色表補足 2 的冪次）；**編碼**（`encodeGif`：GIF89a＋NETSCAPE 迴圈＋各幀區域色表＋ GCE 處置方式 2，**K. Weiner LZW 壓縮**與標準解碼器碼寬時序相容）。Node 驗證：8 色圖編→解往返**單通道誤差 0（完全無損）**、透明／延遲／幀數皆正確；產出 GIF 經 macOS `file`／`sips`（系統 ImageIO）與 Read 影像渲染確認為合規可播、透明正確。**UI**＝單檔前後對比：拖放／點選單一 `.gif`→`file.arrayBuffer()` 解碼→左「原始」面板播原檔、右「壓縮後」面板播重編碼結果，棋盤格底透出透明、`image-rendering: pixelated` 保留像素邊緣。設定：**縮放比例**滑桿 25–100%（拖曳即時預估輸出尺寸、放開才重壓，用離屏 Canvas `drawImage` 等比縮放每幀）＋**色彩數量** chip 256／128／64／32（減色降容量，預設 128）。設定變更即重壓，以 `runId` 讓過期程序作廢、逐幀 `await` 讓出主執行緒＋進度條（`--progress`）＋「處理中…」遮罩，幀數 >4 才讓步。總計列 原始→壓縮後 大小與縮減%（變大走芥黃警示）；下載 `-min.gif` 埋 `track('use')`；保留原始每幀延遲與迴圈次數。`data-category="image"`＋卡片編號 34→**35**＋`home.js` 熱門度表補 key（暫填 0）＋`package.json` 補編譯映射＋`npm run build:css` 戳記 v=202607041135）

前次更新：2026-06-26（完成 **34 抽籤器**（`services/lottery`，`data-category="fun"`，卡片顯示編號 **34**、tool-head `Tool / 34`）：左名單面板（`textarea` 逐行 trim／略過空行＝一行一名，即時顯示名字數）＋抽出人數 `number` 輸入（即時夾在 1～剩餘人數）＋載入範例／清空；右抽籤舞台。**亂數採 `crypto.getRandomValues`＋拒絕採樣**（`randomInt`：算 `limit=2^32-(2^32%max)`、超界丟棄，去除模偏差；Node 驗證 60 萬次抽 1/6 各面≈10 萬均勻、抽 4/10 五千次零重複、抽超量自動夾到池大小）。`drawFrom` 以 Fisher-Yates 部分洗牌就地 `splice` 不重複抽出。**狀態**：`allNames`（完整名單，保留同名以位置區分）／`remaining`（未抽池）／`drawnCount`（連號排名）；名單一變動即 `refreshFromInput` 重置池與結果。**逐一揭曉動畫**：每位抽中者一張結果卡，先以 rAF 每 ~55ms 輪播完整名單的隨機名字（拉霸感、`is-rolling` 淡化微模糊），再依 `lockAt=650+i*stagger`（`stagger=clamp(2400/n,160,420)` 抽多時自動縮短）依序 `is-locked`：硃紅左框＋`result-lock` 彈跳定格動畫；最後一張鎖定才解鎖按鈕、顯示動作列並 `track('use')`。**主按鈕一律附加**＝連按即「從剩餘繼續抽」（抽過一輪且仍有剩餘時文字改「繼續抽」、抽完停用）；動作列只留「重新開始（放回全部）」做重抽（`remaining` 還原、清結果、`drawnCount` 歸零）。名字以 `textContent` 注入天然防 XSS、零相依維持 CSP `script-src 'self'`。`data-category="fun"`＋搜尋計數 33→**34**＋`home.js` 熱門度表補 key（暫填 0）＋`package.json` 補編譯映射＋`npm run build:css` 戳記 v=202606262323）

前次更新：2026-06-26（完成 **33 SVG 壓縮器**（`services/svg-optimizer`，`data-category="image"`，卡片顯示編號 **33**、tool-head `Tool / 33`）：自寫 **SVGO-lite** 優化模組 `svgo-lite.js`（零相依維持 CSP `script-src 'self'`），以瀏覽器原生 `DOMParser`／`XMLSerializer` 解析輸出。可開關優化規則：移除 HTML 註解、移除 `<metadata>`、移除空 `<g>`（無子元素、無有意義文字、無屬性才移）、移除編輯器資料（Inkscape／Sodipodi 命名空間的元素與屬性、`xmlns:inkscape`／`xmlns:sodipodi` 宣告、`xml:space`），以及**數字精度收斂**（單選 整數／1／2／3 位，預設 2 位）。精度只套用於白名單幾何／數值屬性（`d`／`points`／`transform`／`viewBox`／`x,y,cx,cy,r…`／`*-opacity` 等），用 `NUM_RE` 比對含小數／負號／科學記號的數字逐一 `Math.round`（toString 自動去尾零），刻意不碰 `fill`／`stroke` 等含 hex 顏色與 `id`／`class` 字串以免破壞。根 `<svg>` 自身屬性也清理。輸出再壓掉標籤間縮排空白。**保留 `<title>`／`<desc>`** 維持無障礙。UI 沿用 01 壓縮圖片語彙：拖放／點選（`accept=".svg,image/svg+xml"`、批次）→讀 `file.text()`→逐檔優化；設定變更即全部重壓。結果列＝優化後 SVG 直接當縮圖預覽（`data:image/svg+xml;utf8,encodeURIComponent`，受 CSP `img-src data:` 允許）＋原始→優化大小對比＋縮減%徽章（變大走芥黃）＋每筆 複製原始碼／下載（`-min.svg`）／移除＋全部下載／清空；總計只計成功檔。解析失敗單獨顯示錯誤列不給下載。複製／下載埋 `track('use')`。`data-category="image"`＋搜尋計數 32→**33**＋`home.js` 熱門度表補 key（暫填 0）＋`package.json` 補編譯映射＋`npm run build:css` 戳記 v=202606262305）

前次更新：2026-06-26（完成 **32 Base64 編解碼**（`services/base64`，`data-category="assets"`，卡片顯示編號 **32**、tool-head `Tool / 32`）：**文字模式**＝純文字 ↔ Base64 兩欄即時雙向互轉，編純文字欄即編碼回填、編 Base64 欄即解碼回填（解碼失敗欄位邊框轉硃紅、不動另一欄）。**正確處理 UTF-8**：`TextEncoder`→bytes→`bytesToBase64`（分塊 0x8000 避免 apply 參數爆量）、解碼 `atob`→bytes→`TextDecoder`，中文與 emoji 往返驗證無誤。**URL-safe 切換**（`+/`→`-_`、去除尾端 `=`，解碼自動正規化補回 padding，4n+1 長度判為不合法）。「⇅ 對調」把 Base64 內容當新純文字續編、「清空」、兩欄各自複製鈕（埋 `track('use')`，1.6 秒提示）、各欄即時字元數。**圖片模式**＝拖放／點選單張圖片→`FileReader.readAsDataURL`→輸出 `data:image/...;base64,...`：棋盤底預覽框、資訊列（檔名以 `escapeHtml` 注入防 XSS／類型／原始大小／data URI 長度）、Data URI 與 `background-image: url(...)` 兩個 code-block 各附複製鈕。非圖片檔友善提醒。零相依維持 CSP `script-src 'self'`。模式以手冊風分段頁籤切換。`data-category="assets"`＋搜尋計數 31→**32**＋`home.js` 熱門度表補 key（暫填 0）＋`package.json` 補編譯映射＋`npm run build:css` 戳記 v=202606262224）

前次更新：2026-06-26（完成 **31 印刷紙張尺寸速查**（`services/paper-size`，`data-category="reference"`，卡片顯示編號 **31**、tool-head `Tool / 31`）：ISO A 系列（A0–A8）、ISO B 系列（B0–B8）、JIS B 系列（B4/B5/B6）、美規（Letter/Legal/Ledger/Half Letter）、常用（名片台灣／美規／明信片／海報 Small–Large）共 30 筆資料內嵌於 `script.js`，零相依維持 CSP `script-src 'self'`。單位切換列（mm／cm／inch／px，`unit-chip` 同 filter-chip 語彙）；選 px 才顯示的 DPI 列（72／96／150／300），改 DPI 即時更新表頭標籤與全列數值。系列篩選 chip 六組（全部／ISO A／ISO B／JIS B／美規／常用）。比例縮圖：每列以 SVG `<rect>` 呈現實際寬高比，最大邊 32px、最小邊 6px、stroke 0.75。系列膠囊五色：ISO A 硃紅、ISO B 芥黃、JIS B 墨黑、美規淡墨、常用橙紅混色。點列複製含單位字串（如 `210 × 297 mm`），埋 `track('use')` 複製成功顯示 ✓ 1.4 秒。`data-category="reference"`＋搜尋計數 30→**31**＋`home.js` 熱門度表補 key（暫填 0）＋`package.json` 補編譯映射＋`npm run build:css` 戳記 v=202606261147）

前次更新：2026-06-26（完成 **30 圖片萃取調色盤**（`services/color-extractor`，`data-category="color"`，卡片顯示編號 **30**、tool-head `Tool / 30`）：上傳圖片→離屏 Canvas 縮放至最大 800px→動態步長取樣（目標 30K px）→自寫 **k-means++ 分群**（加權距離平方機率初始化中心、Int32Array 指派陣列、25 次迭代或提早收斂）→依群大小降冪排列輸出 3–10 主色。每色列顯示左側色塊（`background` inline）＋右側 HEX／RGB 兩列各附「複製」按鈕（埋 `track('use')`，複製成功顯示 ✓ 1.4 秒）＋相對佔比橫條（寬度＝該群／最大群；標籤顯示相對於總取樣的 %）。底部「複製全部 HEX」換行分隔（埋 `track('use')`）＋取樣像素數說明。數量滑桿 3–10（拖曳即時更新數字、放開才重算）；「重新萃取」按鈕用不同隨機種子再跑一次。略過透明度 < 128 的像素（PNG／GIF 透明底友善處理）。色票列以 `--i` CSS 變數驅動 `palette-row-in` 錯落進場動畫（每列 delay 45ms）、hover 右移＋陰影。「分析中」三點跳動動畫。`data-category="color"`＋搜尋計數 28→**30**（同時補修 clamp-calc 漏更新的 bug）＋`home.js` 熱門度表補 key（暫填 0）＋`package.json` 補編譯映射＋`npm run build:css` 戳記 v=202606261120）

前次更新：2026-06-26（完成 **29 CSS Clamp 流體排版計算器**（`services/clamp-calc`，`data-category="css"`，卡片顯示編號 **29**、tool-head `Tool / 29`）：輸入「最小／最大螢幕寬度」與「最小／最大字級」，以公式 `slope=(sMax-sMin)/(wMax-wMin)`、`intercept=sMin-slope*wMin` 計算出 `clamp(sMinRem, slopeVw * 1vw ± interceptRem * 1rem, sMaxRem)` 語法；六組快速預設（小字／內文／H3／H2／H1／Display，預設套入「內文」16px→20px）；根字級 10–20px 滑桿即時同步 rem 換算。**SVG 曲線圖**（viewBox 0 0 500 260）以折線（平坦→線性上升→平坦）呈現 clamp 縮放行為，自動展開 X/Y 定義域 25%/35% 以顯示兩端平坦段；轉折點以硃紅實心圓標記，轉折垂直虛線與 min/max 標籤貼合；Y 軸格線三條（sMin／中點／sMax），X/Y 軸標示單位與數值；從 CSS 變數取色無硬編碼。**即時字級預覽**：依當前視窗寬度算出字級套用到預覽文字，resize 事件更新。**CSS 輸出**：`font-size: clamp(Xrem, Yvw + Zrem, Wrem)` 截距負數自動改 `-`；**SCSS 輸出**：含 `$fs-fluid-min`、`$fs-fluid-max` 變數與用法範例。計算摘要顯示 slope / intercept（vw / rem）。複製埋 `track('use')`。`data-category="css"`＋搜尋計數 28→**29**＋`home.js` 熱門度表補 key（暫填 0）＋`package.json` 補編譯映射＋`npm run build:css` 戳記 v=202606261044）

前次更新：2026-06-25（完成 **28 Cubic Bezier 產生器**（`services/cubic-bezier`，`data-category="css"`，卡片顯示編號 **28**、tool-head `Tool / 28`）：**SVG 曲線編輯器**（viewBox 0 0 300 630，0–1 主框 300×300、上下各留 165 緩衝容納回彈超出）拖曳兩個控制點即時改 `cubic-bezier()`，附對角 linear 參考線、刻度格線與把手導引線；X 限 0–1、Y 容許 ±0.55 超出（`OVER = PAD/BOX`）。座標映射 `toPx`／`toPy` 雙向，四個座標輸入框與拖曳雙向同步（編輯欄位略過重填防游標跳）。拖曳用 `pointerdown`＋`setPointerCapture` 確保超出把手仍追蹤、放手埋 `track('use')`；把手支援鍵盤方向鍵微調（±0.02、Shift ±0.1）。九組緩動預設（linear／ease／ease-in/out／swift／back-in/out/in-out）一鍵套用，座標完全相符時自動高亮該 chip。**動畫預覽**：球以 `@keyframes bezier-move`（left 0→100%）套 `var(--bz-ease)` `infinite alternate` 往返，改緩動／時長強制 reflow 立即重啟；預覽時長滑桿 0.3–3s。CSS 輸出 `cubic-bezier(x1, y1, x2, y2)`（`fmt()` 去尾零、最多三位小數）複製埋 `track('use')`。沿用 15 漸層的 `.controls`／`.chip`／`.code-block` 語彙。`data-category="css"`＋搜尋計數 27→**28**＋`home.js` 熱門度表補 key（暫填 0）＋`package.json` 補編譯映射＋`npm run build:css` 戳記 v=202606252340）

前次更新：2026-06-25（完成 **27 對比度檢查器**（`services/contrast-checker`，`data-category="color"`，卡片顯示編號 **27**、tool-head `Tool / 27`）：前景／背景各一組色票＋HEX 輸入雙向同步，沿用 10 色彩格式轉換的 `.controls`／`.color-row` 語彙與 hexToRgb 換算。**自寫 WCAG 相對亮度（線性化通道 0.2126/0.7152/0.0722）＋對比值 (L亮+0.05)/(L暗+0.05)**，Node 驗證黑/白＝21.00、#777/白＝4.48、預設墨黑/紙＝15.25。逐條判定 AA 一般(≥4.5)／AA 大型(≥3)／AAA 一般(≥7)／AAA 大型(≥4.5)／UI 元件(≥3)，**通過＝墨黑實心徽章、未達＝硃紅描邊**，附 ✓／✗＋文字不單靠顏色傳達。大型預覽以背景色鋪底、前景色寫大標／內文／UI chip；色盲模擬以業界常用近似矩陣（protan／deuteran／tritan 線性矩陣、achromat 亮度灰階）渲染四張預覽卡。「⇅ 對調」「隨機配色」兩動作鈕（對調埋 `track('use')`）。`data-category="color"`＋搜尋計數 26→**27**＋`home.js` 熱門度表補 key（暫填 0）＋`package.json` 補編譯映射＋`npm run build:css` 戳記 v=202606252333）

前次更新：2026-06-24（完成 **26 盤古之白**（`services/pangu`，`data-category="text"`，卡片顯示編號 **26**、tool-head `Tool / 26`）：輸入中英混排文字，「加入空格」按鈕以純 Regex 在 CJK 字符（中日韓及注音等各主要 Unicode 區塊）與半形英文字母／阿拉伯數字之間插入半角空格；「移除空格」做反向操作；按鈕視覺以「中·A」／「中A」示範差異；執行後以 `.pangu-stat` 顯示插入／移除數量，無需調整時亦有提示；右側面板黏頂，窄螢幕改上下堆疊；`data-category="text"`＋搜尋計數 25→**26**＋`home.js` 熱門度表補 key＋`package.json` 補編譯映射＋`npm run stamp` 更新版本戳記至 v=202606241628）

前次更新：2026-06-24（**單位換算新增三個類別**：**資料量**（B／KB／MB／GB／TB，1 KB = 1024 B 二進位制）、**角度**（°／rad／turn／grad）、**時間**（ms／s／min／hr／day／week）。三個類別全走既有 ratio 模式，直接插入 `CATEGORIES` 物件渲染，工具分頁從 6 個擴充為 9 個。工具頁 intro 與主頁 `data-keywords`／卡片描述同步更新，`npm run stamp` 更新版本戳記至 v=202606241609。）

前次更新：2026-06-24（**`TOOL_POPULARITY` 換成 Umami 真實數據**：到 Umami 後台 Pages 報表，將 `home.js` 的 `TOOL_POPULARITY` 快照表由範例數字全部換成真實 pageviews（截至 2026-06-24），熱門排序前五名：偷懶神器 292、決策轉盤 220、我的留言板 218、社群尺寸建議 193、壓縮圖片 187。）

前次更新：2026-06-24（**浮水印三項選配功能**完成。①**文字描邊**（stroke toggle + 顏色 + 粗細滑桿 1–30，以 `W/1000` 比例縮放）：描邊先於填色繪製（`strokeText` → 清 shadow → `fillText`），平鋪迴圈每格都重設 shadow 確保一致；②**文字陰影**（shadow toggle + 顏色 + 模糊 0–50 + 位移 0–30）：只在描邊前套用，讓填色不重複出現陰影層；③**平鋪間距細控**：單一 `gapPct` 拆成 `gapXPct`（水平）／`gapYPct`（垂直）兩個獨立滑桿，最大值 40→**60%**，加 `Math.max(5, step)` 防 step≤0 無限迴圈；④**輸出保留原始格式**：格式選項新增「原始格式」（預設），載入時 `normalizeFormat(file.type)` 存 `origFormat`（AVIF／GIF fallback PNG），`resolveFormat(it)` 在輸出時決定實際格式，批次下載各圖各用自己的格式，`exportItem` 改回傳 `{ blob, fmt }` 確保檔名副檔名正確。）

前次更新：2026-06-24（兩項維護作業。①**移除 環境音、影片壓縮**：兩工具的入口頁卡片（含原 HTML 註解區塊）與 `home.js` `TOOL_POPULARITY` 項目完全移除，資料夾 `services/video-compress/` 保留於磁碟但不對外開放；`services/white-noise/` 已於 2026-06-24 完全刪除，現有工具數由 25 項維持不變（環境音、影片壓縮本已隱藏，移除不影響計數）。②**內頁 Tool / 編號對齊**：兩工具移除後，入口頁卡片編號 21–25 與各內頁 `Tool / XX` 標籤出現落差（原始開發流水號仍含已移除的兩項），修正 pomodoro（22→21）、watermark（23→22）、unit-convert（24→23）、text-case（26→24）、amount-words（27→25），全站 25 個工具的列表編號與內頁標籤現已完全一致）

前次更新：2026-06-19（完成 **26 大小寫轉換** 與 **27 金額轉大寫** 兩個文字工具，皆零相依、純前端、文字不上傳，沿用手冊風設計系統。**26 大小寫轉換**（`services/text-case`，`data-category="text"`，卡片顯示編號 **24**、tool-head `Tool / 26`）：左輸入框 + 右轉換面板（沿用字數統計 13 的 `.editor-pane`／`.text-area`／黏頂面板語彙），七種轉換直接套用到輸入框可連續切換——句首大寫、全大寫、全小寫、每字首大寫、**標題式 Title Case**（略過 a/the/of 等小詞但首尾字一定大寫）、交替大小寫、反轉大小寫；即時字元／字數計數沿用 13 的中文逐字、英數連續串各算一詞規則。**27 金額轉大寫**（`services/amount-words`，`data-category="text"`，卡片顯示編號 **25**、tool-head `Tool / 27`）：使用者拍板**正式財務格式**（含元角分與「整」、零的正確處理）。**關鍵：以字串切整數／小數處理，避免浮點誤差**；中文用 4 位一節 + 萬億兆大單位（支援到 16 位數＝兆級），節內前導零與整節為零都補單一「零」隔開、最後修剪結尾多餘零（已 Node 驗證 12345.67→壹萬貳仟參佰肆拾伍元陸角柒分、10005→壹萬零伍元整、100000005→壹億零伍元整、100.05→壹佰元零伍分、0.56→伍角陸分 等案例）；英文用 BigInt 每 3 位一組 + thousand～quadrillion，支票格式整數 + 小數 `XX/100`，一律大寫呈現。三列結果（阿拉伯數字千分位／中文大寫／英文大寫）各附複製鈕、解析失敗輸入框轉硃紅並提示。共同收尾：入口頁 `index.html` 補兩張卡片（接在單位換算卡 23 之後）＋搜尋計數 23→**25**、`home.js` 熱門度表補兩個 key（暫填 0）、`package.json` 補兩條 scss:css 編譯映射並 `npm run build:css`、隱藏的影片壓縮註解編號順移為 26）

前次更新：2026-06-12（完成 **25 影片壓縮**：純前端拖放上傳影片，**WebCodecs 硬體加速重新編碼**（2026-06-12 使用者拍板方案一，捨棄 ffmpeg.wasm——30MB 下載、純軟編慢、SharedArrayBuffer 需 COOP/COEP 靜態主機做不到）。`mediabunny@1.46`（MPL-2.0，附授權檔）單檔 0.6MB vendor 至 `services/video-compress/vendor/`（維持 CSP script-src 'self'，首次拖檔才動態 import），負責 demux→原生 VideoDecoder/VideoEncoder 重編 H.264→重組 MP4（`fastStart: 'in-memory'`）；**聲音能複製就原樣複製、不行才自動轉碼，被捨棄時該列以芥黃提醒**。兩根槓桿沿用 20 PDF 壓縮的 UI 語彙：解析度檔位（原始／1080p／720p／480p，**限制「短邊」等比縮小、絕不放大、取偶數**）＋品質滑桿（放開才重壓）。**目標位元率＝輸出像素 × fps × bpp（品質 10–100% 映射 0.033–0.15 bpp），並 clamp 在來源視訊位元率的 85% 以下**避免重編反而變大；fps／來源位元率以 `computePacketStats(120)` 取樣前段封包估算。runToken 佇列邏輯與 20 相同，另對進行中的 `Conversion.cancel()`；首格縮圖走 `CanvasSink`；`BlobSource` 從磁碟串流不佔記憶體、>300MB 大檔提示；啟動偵測 `VideoEncoder`，不支援即亮硃紅 notice 並停用拖放區（Chrome/Edge 94+、Safari 16.4+、Firefox 130+）。輸出 `*-compressed.mp4`，下載埋 `track('use')`；入口頁卡片顯示編號 **24**（接在單位換算 23 之後）＋`data-category="image"`＋搜尋計數 23→24、home.js 熱門度表補 key、package.json 補編譯映射、tool-head 標 `Tool / 25`）

再前次更新：2026-06-12（入口頁新增**工具排序**：搜尋列加原生 `<select>`（由舊到新／由新到舊／最熱門），與既有搜尋／分類篩選並存（排序重排 DOM、篩選只切 `hidden`，互不干擾）。**由舊到新**＝DOM 原序（預設，不動載入外觀與 01→23 編號）、**由新到舊**＝反序、**最熱門**＝讀 `home.js` 的 `TOOL_POPULARITY` 快照表降冪排序。**關鍵決策：純前端靜態站不直接打 Umami API**——金鑰寫進公開原始碼會外洩、且 CSP `connect-src` 沒放行 `api.umami.is`、又常以 `file://` 開啟 fetch 會失敗，故改用「手動快照」：到 Umami 後台 Pages 報表抄各工具瀏覽量填進 `TOOL_POPULARITY`（key＝卡片 `href`，數字大者排前、未列者視為 0 排最後）；**目前填的是範例數字，待換成真實數據**。排序以 `appendChild` 重排既有節點、熱門度相同退回原序（穩定）；`.index-sort` 樣式沿用 filter-chip 的 mono／細框語彙、`<label>`＋`aria-label` 維持無障礙。改動僅 `index.html`／`index.scss`／`home.js`）

前前次更新：2026-06-12（完成 **24 單位換算**：多類別即時雙向互轉，沿用 10 色彩格式轉換的「單一真實來源＋即時互算」手法、零相依全在瀏覽器端。以分頁切換 6 類別（**網頁字級** px／rem／em／pt／%、**印刷物理** mm／cm／in／pt／px、**長度／重量／溫度／面積**），每類別以一個「基準單位」存目前數值，編輯哪欄就換算回基準、再回填其餘。**關鍵設計：ratio 類別每單位給「對基準的倍率」factor，溫度為含位移的 special 類別自訂 toBase／fromBase**；網頁類別的 rem／em／% 倍率隨「根字級／參考字級」設定即時變動、印刷類別的 px 倍率隨「DPI」設定變動（72／96／150／300 快捷鈕），改設定保留基準值只重算欄位。CSS 規範 1pt=96/72px≈1.333px；印刷 1pt=1/72in≈0.3528mm，**滿足使用者要的 pt↔cm／mm 換算**（72pt=2.54cm、1cm=28.35pt）。數字以 `fmt()` 收斂浮點雜訊去尾零、極大／極小才用有效位數。每欄附複製鈕（埋 `track('use')`）、解析失敗欄位邊框轉硃紅。入口頁卡片顯示編號 **23**（接在浮水印 22 之後）＋`data-category="reference"`＋搜尋計數 22→23、package.json 補編譯映射、tool-head 標 `Tool / 24`）


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
- [x] 註冊 https://cloud.umami.is，把全部 HTML 的 `YOUR-UMAMI-WEBSITE-ID` 換成實際 Website ID
- [ ] 若 Umami 腳本網域非 `cloud.umami.is`（如 EU 區 `eu.umami.is`），同步改各頁 CSP 的 `script-src` / `connect-src`
- [x] **07 favicon 已套基線**：補上 `data-tool="favicon"`、CSP meta、Umami 腳本、分享按鈕、下載時 `track('use')`；
  並把 `services/favicon/script.js` 卡片 `${r.name}` 改為 `escapeHtml(r.name)`（修掉同類檔名 XSS）
- [x] （選配）首頁 footer 加一行隱私揭露：使用 Umami 匿名統計、不放 cookie、不蒐集個資

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
  - ✅ 後續選配（2026-06-24 完成）：文字描邊（顏色＋粗細）、文字陰影（顏色＋模糊＋位移）、平鋪水平／垂直間距分離（最大 60%）、輸出保留原始格式（auto 選項，各圖按自己 MIME 下載）
- [x] 24 單位換算（入口頁顯示編號 23）：多類別即時雙向互轉，沿用 10 色彩格式轉換的「單一真實來源＋即時互算」手法、零相依全在瀏覽器端。分頁切換 6 類別——**網頁字級**（px／rem／em／pt／%）、**印刷物理**（mm／cm／in／pt／px）、**長度**、**重量**、**溫度**、**面積**（含坪／公頃）。每類別以一個「基準單位」存目前數值（`state.bases[cat]`），編輯哪欄即換算回基準、再回填其餘（略過正在輸入的欄位避免游標跳動）。**ratio 類別每單位給「對基準的倍率」factor、`base=值×factor`／`欄=base÷factor`；溫度為含位移的 special 類別、自訂 `toBase`／`fromBase`**。網頁類別 rem／em／% 倍率隨「根字級／參考字級」設定變動、印刷類別 px 倍率隨「DPI」設定變動（72／96／150／300 快捷鈕），改設定保留基準值只重算欄位。CSS 規範 1pt=96/72px≈1.333px（與裝置 DPI 無關）、印刷 1pt=1/72in≈0.3528mm，**滿足 pt↔cm／mm 換算**（72pt=2.54cm、1cm=28.35pt）。數字以 `fmt()` 收斂浮點雜訊去尾零、極大／極小才用有效位數；每欄附複製鈕（埋 `track('use')`）、解析失敗欄位邊框轉硃紅。`data-category="reference"`＋搜尋計數改 23、package.json 補編譯映射、tool-head 標 `Tool / 24`
  - ✅ 後續選配（2026-06-24 完成）：資料量（B／KB／MB／GB／TB）、角度（°／rad／turn／grad）、時間（ms／s／min／hr／day／week）
  - 後續可選：自訂單位／我的最愛——目前未做，留待使用者提出
- [x] 25 影片壓縮（入口頁顯示編號 24）：純前端拖放上傳影片，**WebCodecs 硬體加速重新編碼**（2026-06-12 使用者拍板方案一，捨棄 ffmpeg.wasm：30MB 下載、純軟編慢、SharedArrayBuffer 需 COOP/COEP 靜態主機做不到）。`mediabunny@1.46`（MPL-2.0，附授權檔）單檔 0.6MB vendor 至 `services/video-compress/vendor/`（維持 CSP script-src 'self'，首次拖檔才動態 import），demux→原生 VideoDecoder/VideoEncoder 重編 H.264→重組 MP4（`fastStart: 'in-memory'`）；聲音能複製就原樣複製、不行才自動轉碼，被捨棄時該列芥黃提醒。解析度檔位（原始／1080p／720p／480p，限制「短邊」等比縮小、不放大、取偶數）＋品質滑桿（放開才重壓）；目標位元率＝輸出像素 × fps × bpp（品質映射 0.033–0.15 bpp）並 clamp 在來源視訊位元率 85% 以下，fps／來源位元率以 `computePacketStats(120)` 估算。runToken 佇列同 20，另對進行中 `Conversion.cancel()`；`CanvasSink` 首格縮圖；`BlobSource` 串流讀檔、>300MB 大檔提示；啟動偵測 `VideoEncoder` 不支援即亮硃紅 notice 並停用拖放區。輸出 `*-compressed.mp4`，下載埋 `track('use')`；入口頁卡片編號 24＋`data-category="image"`＋搜尋計數 23→24、home.js 熱門度表補 key（暫填 0，待 Umami 快照）、package.json 補編譯映射、tool-head 標 `Tool / 25`

## 入口頁功能

### 工具搜尋（既有）
- [x] 關鍵字即時篩選：比對卡片可見文字 ＋ `data-keywords`，更新計數與空狀態

### 分類篩選 chip（2026-06-06 新增）
- [x] 各工具依「對象領域」分類，每張 `.tool-card` 標 `data-category`：
  - **image** 圖片：01 壓縮、06 裁切／改尺寸、16 格式轉換、20 PDF 壓縮、23 浮水印
  - **color** 色彩：09 調色盤、10 色彩格式轉換、27 對比度檢查器
  - **css** CSS：05 Grid／Flex、14 陰影、15 漸層、28 Cubic Bezier
  - **text** 文字：11 字級比例、12 Lorem、13 字數統計
  - **reference** 速查：03 社群尺寸、04 裝置尺寸、24 單位換算（入口頁編號 23）
  - **assets** 資產：02 SVG 轉 Font、07 favicon、08 QR Code、32 Base64 編解碼
  - **focus** 效率：番茄鐘（入口頁編號 21；環境音已於 2026-06-12 暫時隱藏）
  - **fun** 趣味：17 決策轉盤、18 假更新、19 留言板、34 抽籤器
- [x] 搜尋列下方一排 `.filter-chip`（全部／圖片／色彩／CSS／文字／速查／資產／效率／趣味），手冊風：銳利邊角、等寬大寫標籤、選取態 `.is-active` 填硃紅
- [x] `home.js` 改為**分類 × 關鍵字交集篩選**：先選分類再搜尋會在該領域內再過濾；chip 為單選＋「全部」，切換時同步 `aria-pressed`
- [x] 無障礙：chip 用 `<button>`、外層 `role="group"`、`:focus-visible` 焦點框
- 備註：新增工具時，除既有步驟外，記得替入口頁卡片補對應 `data-category`；若開新領域，於 `index.html` chip 列與 `home.js`（邏輯自動支援任意 filter 值）對齊即可

> 目前 chip 為單選。若日後要可複選多領域，需改 `home.js` 的 `activeCategory`（單值）為集合並調整 active 切換邏輯。

### 工具排序（2026-06-12 新增）
- [x] 搜尋列加 `.index-sort`（`<label>` 包原生 `<select id="tool-sort">`），三種模式：
  - **由舊到新**（預設）：DOM 原始順序（`order`＝卡片在 grid 的索引＝加入順序），載入外觀與 01→23 編號不變
  - **由新到舊**：`order` 反序
  - **最熱門**：依 `TOOL_POPULARITY` 降冪；相同退回 `order`（穩定排序）
- [x] 切換時以 `appendChild` 重排 grid 內既有 `.tool-card` 節點；與搜尋／分類**並存**（排序只動順序、篩選只切 `hidden`）
- [x] `.index-sort-select` 樣式沿用 filter-chip 的 mono／細框／硃紅 focus；`aria-label` 維持無障礙
- **「最熱門」資料來源＝Umami 手動快照**（`home.js` 的 `TOOL_POPULARITY`，key＝卡片 `href`）：
  - 不直接打 Umami API 的原因——金鑰寫進公開靜態站會外洩、CSP `connect-src` 未放行 `api.umami.is`、且常以 `file://` 開啟 fetch 會失敗
  - **維護方式**：到 Umami 後台 Pages 報表抄各工具瀏覽量，更新 `TOOL_POPULARITY` 的數字即可（未列到的工具視為 0 排最後）
  - ⚠️ **目前是範例數字，上線前／要讓排序有意義時請換成真實瀏覽量**
- 後續可選：記住使用者上次選的排序（localStorage）、把熱門度改為「本機使用次數」自動累積——目前皆未做

### 未來擴充
- [x] 26 盤古之白（入口頁顯示編號 26）：輸入中英混排文字，自動在 CJK 字符與半形英數／數字之間插入半角空格；支援反向操作（移除已插入的空格）；純 Regex 實作、零相依，維持 CSP `script-src 'self'`；`data-category="text"`

### Phase 6 — 新增工具（已排定開發順序，2026-06-25 規劃）

> 三個核心工具完成後，接續製作潛在缺口工具。

#### 核心工具（優先做）
- [x] 27 對比度檢查器（`services/contrast-checker`，`data-category="color"`，入口頁顯示編號 **27**，tool-head `Tool / 27`）：前景色 × 背景色 → WCAG AA/AAA 對比值即時判定；色票＋HEX 雙向同步；附色盲模擬（deuteranopia／protanopia／tritanopia／achromatopsia 四種）；自寫零相依色彩換算維持 CSP `script-src 'self'`；`data-category="color"`（2026-06-25 完成）
- [x] 28 CSS Cubic Bezier 產生器（`services/cubic-bezier`，`data-category="css"`，入口頁顯示編號 **28**，tool-head `Tool / 28`）：可視化拖曳兩個控制點，即時預覽動畫球；輸出 `cubic-bezier(...)` 語法；附常用預設（ease-in-out、回彈 back 等九組）；零相依維持 CSP `script-src 'self'`；`data-category="css"`（2026-06-25 完成）
- [x] 29 CSS Clamp 流體排版計算器（`services/clamp-calc`，`data-category="css"`，入口頁顯示編號 **29**，tool-head `Tool / 29`）：輸入「最小螢幕寬度 × 最小字級」＋「最大螢幕寬度 × 最大字級」，自動產出 `clamp(min, vw + rem, max)` 語法；附預覽曲線；零相依；`data-category="css"`

#### 潛在缺口工具（核心完成後接續）
- [x] 30 圖片萃取調色盤（`services/color-extractor`，`data-category="color"`，入口頁顯示編號 **30**，tool-head `Tool / 30`）：上傳圖片 → Canvas 取樣 → k-means 群聚輸出 3–10 主色；每色附 HEX/RGB 複製；`data-category="color"`（2026-06-26 完成）
- [x] 31 印刷紙張尺寸速查（`services/paper-size`，`data-category="reference"`，入口頁顯示編號 **31**，tool-head `Tool / 31`）：A0–A8、ISO B、JIS B、美規、名片、明信片、海報標準尺寸；可選 mm/cm/inch/px（依 DPI 72/96/150/300）；系列篩選 chip；比例縮圖 SVG；點列複製；`data-category="reference"`（2026-06-26 完成）
- [x] 32 Base64 編解碼（`services/base64`，`data-category="assets"`，入口頁顯示編號 **32**，tool-head `Tool / 32`）：文字 / 圖片兩模式；文字＝純文字 ↔ Base64 兩欄即時雙向互轉（`TextEncoder`/`TextDecoder` 正確處理 UTF-8 中文、URL-safe 切換、解碼失敗標紅、⇅ 對調、各欄複製）；圖片＝`FileReader.readAsDataURL` 轉 `data:image/...;base64,...`，輸出 Data URI 與 `background-image: url(...)` 兩個可複製 code-block（棋盤底預覽、檔名 `escapeHtml` 防 XSS）；零相依維持 CSP `script-src 'self'`；`data-category="assets"`（2026-06-26 完成）
- [x] 33 SVG 壓縮器（`services/svg-optimizer`，`data-category="image"`，入口頁顯示編號 **33**，tool-head `Tool / 33`）：純前端 SVGO-lite；移除 metadata／comments／空 group、數字精度收斂；顯示壓縮前後 KB 對比，直接下載；`data-category="image"`（2026-06-26 完成）
- [x] 34 抽籤器（`services/lottery`，`data-category="fun"`，入口頁顯示編號 **34**，tool-head `Tool / 34`）：貼上名單（每行一名，空行忽略）、設定抽出人數；以 `crypto.getRandomValues`＋拒絕採樣不重複隨機抽出（Fisher-Yates 部分洗牌）；結果卡先輪播隨機名字再依序鎖定（拉霸式逐一揭曉、硃紅左框彈跳定格）；主按鈕連按＝從剩餘繼續抽、「重新開始」放回全部重抽；零相依維持 CSP `script-src 'self'`；`data-category="fun"`（2026-06-26 完成）

### 回饋管道（全站功能）
- [x] 在入口頁 footer 加「意見回饋」入口（Bug 回報 / 優化建議 / 功能許願池，2026-06-07 完成）

## 接續備忘

- 下次接續：提到本專案會自動載入 project skill；先讀本檔看進度。
- 每個工具自包含，互不依賴；做新工具不會動到既有工具。
