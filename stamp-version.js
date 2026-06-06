// ============================================================
// 版本戳記 — 為本地 css/js 引用補上 ?v=<時間戳>，防止瀏覽器快取舊檔
// 由 npm run build:css 於 SCSS 編譯後自動執行（見 package.json）
// 處理範圍：
//   1. 各 HTML 的 <link href> / <script src> 指向本地 .css / .js 者
//   2. 工具頁 script.js（ES Module）內 import 的本地 .js（shared.js、qr-encode.js…）
// 外部資源（http/https/協定相對 URL）一律略過，避免動到 CDN 與字體連結。
// ============================================================
const fs = require('fs');
const path = require('path');

const root = __dirname;

// 版本戳記：YYYYMMDDHHmm（可排序、可讀，分鐘級已足夠辨識每次部署）
const now = new Date();
const pad = (n) => String(n).padStart(2, '0');
const VERSION =
  `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
  `${pad(now.getHours())}${pad(now.getMinutes())}`;

// 外部資源（協定開頭或協定相對）不加版本號
const isExternal = (url) => /^(https?:)?\/\//.test(url);

// 收集 HTML：首頁 + 各工具頁
const servicesDir = path.join(root, 'services');
const serviceNames = fs.readdirSync(servicesDir).filter((name) =>
  fs.statSync(path.join(servicesDir, name)).isDirectory()
);

const htmlFiles = ['index.html'];
const jsFiles = []; // 工具頁 script.js（內部 import 本地模組）
for (const name of serviceNames) {
  const html = path.join('services', name, 'index.html');
  const js = path.join('services', name, 'script.js');
  if (fs.existsSync(path.join(root, html))) htmlFiles.push(html);
  if (fs.existsSync(path.join(root, js))) jsFiles.push(js);
}

let touched = 0;

// — HTML：href/src 指向本地 .css / .js 者加（或更新）版本號 —
const attrRe = /\b(href|src)="([^"]+?\.(?:css|js))(?:\?v=[^"]*)?"/g;
for (const rel of htmlFiles) {
  const abs = path.join(root, rel);
  const src = fs.readFileSync(abs, 'utf8');
  const out = src.replace(attrRe, (m, attr, url) =>
    isExternal(url) ? m : `${attr}="${url}?v=${VERSION}"`
  );
  if (out !== src) {
    fs.writeFileSync(abs, out);
    touched++;
  }
}

// — script.js：import ... from '本地 .js' 加（或更新）版本號 —
const importRe = /(from\s+['"])([^'"]+?\.js)(?:\?v=[^'"]*)?(['"])/g;
for (const rel of jsFiles) {
  const abs = path.join(root, rel);
  const src = fs.readFileSync(abs, 'utf8');
  const out = src.replace(importRe, (m, pre, url, post) =>
    isExternal(url) ? m : `${pre}${url}?v=${VERSION}${post}`
  );
  if (out !== src) {
    fs.writeFileSync(abs, out);
    touched++;
  }
}

console.log(`[stamp] v=${VERSION} → 更新 ${touched} 個檔案`);
