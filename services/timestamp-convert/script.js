// ============================================================
// 39 時間戳轉換 — Unix timestamp ↔ 日期時間雙向互轉＋時區
// 單一真實來源：state.epochMs（毫秒 UTC 絕對時刻）。
// 時區換算靠「格式化到目的時區的牆上時鐘 → 與 UTC 相減求出偏移分鐘數」
// 這個標準 trick（見 getTzOffsetMinutes），零相依、原生 Intl API 全包辦。
// 換算模式沿用 23 號 unit-convert：settings（時區）→ section-rule → unit-list。
// Timestamp 輸入框同時接受貼上日期文字（例：Jul 30, 2026 8:00 AM SGT），
// 解析邏輯見「日期文字解析」段落。
// ============================================================
import { copyText, track } from '../../shared/scripts/shared.js?v=202607172333';

// — DOM —
const tzSelect = document.getElementById('tz-select');
const nowList = document.getElementById('now-list');
const tsInput = document.getElementById('ts-input');
const tsNowBtn = document.getElementById('ts-now-btn');
const tsUnitToggle = document.getElementById('ts-unit-toggle');
const tsToDateList = document.getElementById('ts-to-date-list');
const dateInput = document.getElementById('date-input');
const timeInput = document.getElementById('time-input');
const dateNowBtn = document.getElementById('date-now-btn');
const dateToTsList = document.getElementById('date-to-ts-list');
const parseHint = document.getElementById('parse-hint');
const copyHint = document.getElementById('copy-hint');

// ============================================================
// 時區清單：本機時區置頂，其餘為常用城市
// ============================================================
const LOCAL_TZ = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
const NAMED_TZS = [
  { id: 'UTC', label: 'UTC（世界協調時間）' },
  { id: 'Asia/Taipei', label: '台北 Asia/Taipei' },
  { id: 'Asia/Hong_Kong', label: '香港 Asia/Hong_Kong' },
  { id: 'Asia/Shanghai', label: '上海 Asia/Shanghai' },
  { id: 'Asia/Tokyo', label: '東京 Asia/Tokyo' },
  { id: 'Asia/Seoul', label: '首爾 Asia/Seoul' },
  { id: 'Asia/Singapore', label: '新加坡 Asia/Singapore' },
  { id: 'Asia/Bangkok', label: '曼谷 Asia/Bangkok' },
  { id: 'Asia/Kolkata', label: '新德里 Asia/Kolkata' },
  { id: 'Asia/Dubai', label: '杜拜 Asia/Dubai' },
  { id: 'Europe/London', label: '倫敦 Europe/London' },
  { id: 'Europe/Paris', label: '巴黎 Europe/Paris' },
  { id: 'Europe/Moscow', label: '莫斯科 Europe/Moscow' },
  { id: 'America/New_York', label: '紐約 America/New_York' },
  { id: 'America/Chicago', label: '芝加哥 America/Chicago' },
  { id: 'America/Denver', label: '丹佛 America/Denver' },
  { id: 'America/Los_Angeles', label: '洛杉磯 America/Los_Angeles' },
  { id: 'America/Sao_Paulo', label: '聖保羅 America/Sao_Paulo' },
  { id: 'Australia/Sydney', label: '雪梨 Australia/Sydney' },
  { id: 'Pacific/Auckland', label: '奧克蘭 Pacific/Auckland' },
];
const TZ_OPTIONS = [
  { id: LOCAL_TZ, label: `本機時區・${LOCAL_TZ}` },
  ...NAMED_TZS.filter((t) => t.id !== LOCAL_TZ),
];

// ============================================================
// 狀態
// ============================================================
const state = {
  tz: LOCAL_TZ,
  tsUnit: 'auto', // auto / s / ms
};

// ============================================================
// 時區換算核心
// ============================================================

// 給定某 UTC 毫秒時刻，回傳該時刻在 timeZone 的「偏移分鐘數」（東正西負）
function getTzOffsetMinutes(epochMs, timeZone) {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone, hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  const map = {};
  dtf.formatToParts(new Date(epochMs)).forEach((p) => { map[p.type] = p.value; });
  const hour = map.hour === '24' ? 0 : Number(map.hour);
  const asUTC = Date.UTC(Number(map.year), Number(map.month) - 1, Number(map.day), hour, Number(map.minute), Number(map.second));
  return (asUTC - epochMs) / 60000;
}

// 把「timeZone 裡的牆上時鐘」(y, mo, d, h, mi, s) 換算成 UTC 毫秒
function zonedTimeToUtc(y, mo, d, h, mi, s, timeZone) {
  const guessMs = Date.UTC(y, mo - 1, d, h, mi, s);
  let offsetMin = getTzOffsetMinutes(guessMs, timeZone);
  let utcMs = guessMs - offsetMin * 60000;
  offsetMin = getTzOffsetMinutes(utcMs, timeZone); // 修正 DST 邊界誤差
  utcMs = guessMs - offsetMin * 60000;
  return utcMs;
}

// 把 UTC 毫秒格式化成 timeZone 的日期時間欄位
function formatInTz(epochMs, timeZone) {
  const dtf = new Intl.DateTimeFormat('zh-Hant', {
    timeZone, hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', weekday: 'long',
  });
  const map = {};
  dtf.formatToParts(new Date(epochMs)).forEach((p) => { map[p.type] = p.value; });
  return {
    y: Number(map.year), mo: Number(map.month), d: Number(map.day),
    h: map.hour === '24' ? 0 : Number(map.hour), mi: Number(map.minute), s: Number(map.second),
    weekday: map.weekday,
  };
}

function pad(n, len = 2) { return String(n).padStart(len, '0'); }

function offsetString(epochMs, timeZone) {
  const min = Math.round(getTzOffsetMinutes(epochMs, timeZone));
  if (min === 0) return 'Z';
  const sign = min > 0 ? '+' : '-';
  const abs = Math.abs(min);
  return `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
}

function isoString(epochMs, timeZone) {
  const t = formatInTz(epochMs, timeZone);
  return `${t.y}-${pad(t.mo)}-${pad(t.d)}T${pad(t.h)}:${pad(t.mi)}:${pad(t.s)}${offsetString(epochMs, timeZone)}`;
}

function dateTimeString(epochMs, timeZone) {
  const t = formatInTz(epochMs, timeZone);
  return `${t.y}-${pad(t.mo)}-${pad(t.d)} ${pad(t.h)}:${pad(t.mi)}:${pad(t.s)}`;
}

const RTF = new Intl.RelativeTimeFormat('zh-Hant', { numeric: 'auto' });
const REL_UNITS = [
  ['year', 31536000], ['month', 2592000], ['week', 604800],
  ['day', 86400], ['hour', 3600], ['minute', 60], ['second', 1],
];
function relativeString(epochMs) {
  const diffSec = (epochMs - Date.now()) / 1000;
  const abs = Math.abs(diffSec);
  for (const [unit, secs] of REL_UNITS) {
    if (abs >= secs || unit === 'second') {
      return RTF.format(Math.round(diffSec / secs), unit);
    }
  }
  return RTF.format(0, 'second');
}

// ============================================================
// 通用列渲染（唯讀輸出列：標籤／唯讀輸入／複製鈕）
// ============================================================
function buildOutputRow(label, id) {
  const row = document.createElement('div');
  row.className = 'unit-row';

  const labelEl = document.createElement('span');
  labelEl.className = 'unit-label';
  labelEl.textContent = label;

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'unit-input is-readonly';
  input.id = `out-${id}`;
  input.readOnly = true;
  input.setAttribute('aria-label', label);
  input.addEventListener('focus', () => input.select());

  const copy = document.createElement('button');
  copy.type = 'button';
  copy.className = 'unit-copy';
  copy.textContent = '複製';
  copy.setAttribute('aria-label', `複製${label}`);
  copy.addEventListener('click', async () => {
    if (await copyText(input.value)) {
      flashHint(`已複製 ${input.value}`);
      track('use');
    }
  });

  row.append(labelEl, input, copy);
  return row;
}

function setOutput(id, value) {
  const el = document.getElementById(`out-${id}`);
  if (el) el.value = value;
}

// ============================================================
// 目前時間戳（即時，每秒刷新）
// ============================================================
nowList.append(
  buildOutputRow('Unix（秒）', 'now-s'),
  buildOutputRow('Unix（毫秒）', 'now-ms'),
  buildOutputRow('日期時間', 'now-dt'),
  buildOutputRow('ISO 8601', 'now-iso'),
);

function renderNow() {
  const nowMs = Date.now();
  setOutput('now-s', String(Math.floor(nowMs / 1000)));
  setOutput('now-ms', String(nowMs));
  setOutput('now-dt', dateTimeString(nowMs, state.tz));
  setOutput('now-iso', isoString(nowMs, state.tz));
}

// ============================================================
// Timestamp → 日期時間
// ============================================================
tsToDateList.append(
  buildOutputRow('日期時間', 'ts-dt'),
  buildOutputRow('星期', 'ts-weekday'),
  buildOutputRow('ISO 8601', 'ts-iso'),
  buildOutputRow('相對時間', 'ts-rel'),
);

function parseTsInput() {
  const raw = tsInput.value.trim();
  if (!/^-?\d+$/.test(raw)) return null;
  const n = Number(raw);
  let unit = state.tsUnit;
  if (unit === 'auto') unit = Math.abs(n) >= 1e12 ? 'ms' : 's';
  return unit === 's' ? n * 1000 : n;
}

// ============================================================
// 日期文字解析：貼上「Jul 30, 2026 8:00 AM SGT」這類文字 → epochMs
// 時區縮寫本身就代表固定偏移（PST 恆為 -8，夏令時會寫成 PDT），
// 故縮寫直接查表換偏移；IANA 名稱與未標時區才走 zonedTimeToUtc。
// ============================================================

// 常見時區縮寫 → 相對 UTC 的偏移分鐘數（東正西負）
// 注意：CST 同時是中國標準時間（+8）與美國中部標準時間（-6），
// 這裡採中文圈慣用的前者；美中部來源請貼 CDT 或 UTC-6
const TZ_ABBR_MIN = {
  UTC: 0, GMT: 0,
  BST: 60, CET: 60, CEST: 120, EET: 120, EEST: 180, MSK: 180,
  GST: 240, IST: 330, ICT: 420, WIB: 420,
  CST: 480, SGT: 480, HKT: 480, MYT: 480, PHT: 480, AWST: 480,
  JST: 540, KST: 540, ACST: 570, AEST: 600, AEDT: 660, NZST: 720, NZDT: 780,
  EST: -300, EDT: -240, CDT: -300, MST: -420, MDT: -360,
  PST: -480, PDT: -420, AKST: -540, HST: -600, BRT: -180,
};

const MONTH_BY_NAME = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };

function utcOffsetLabel(min) {
  if (min === 0) return 'UTC';
  const sign = min > 0 ? '+' : '-';
  const abs = Math.abs(min);
  return `UTC${sign}${Math.floor(abs / 60)}${abs % 60 ? `:${pad(abs % 60)}` : ''}`;
}

// 從文字結尾抽出時區資訊，回傳 { rest, offsetMin, ianaTz, label }
// offsetMin / ianaTz 皆為 null 代表未標時區
function extractTimeZone(text) {
  let m;
  // IANA 名稱（例：Asia/Taipei），用 Intl 驗證是否真的存在
  if ((m = text.match(/\s([A-Za-z]+\/[A-Za-z_]+)$/))) {
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: m[1] });
      return { rest: text.slice(0, m.index), offsetMin: null, ianaTz: m[1], label: m[1] };
    } catch { /* 不是有效 IANA 名稱，往下嘗試其他形式 */ }
  }
  // UTC+8 / GMT-5 / UTC+05:30 / GMT+0800
  if ((m = text.match(/\s(?:UTC|GMT)\s?([+-])(\d{1,2})(?::?(\d{2}))?$/i))) {
    const min = (Number(m[2]) * 60 + Number(m[3] || 0)) * (m[1] === '-' ? -1 : 1);
    return { rest: text.slice(0, m.index), offsetMin: min, ianaTz: null, label: utcOffsetLabel(min) };
  }
  // ISO 8601 的 Z 結尾（2026-07-30T08:00:00Z）
  if (/\dZ$/.test(text)) {
    return { rest: text.slice(0, -1), offsetMin: 0, ianaTz: null, label: 'UTC' };
  }
  // ISO 8601 的 ±HH:MM / ±HHMM 偏移（可緊貼在時間後）
  if ((m = text.match(/([+-])(\d{2}):?(\d{2})$/))) {
    const min = (Number(m[2]) * 60 + Number(m[3])) * (m[1] === '-' ? -1 : 1);
    return { rest: text.slice(0, m.index), offsetMin: min, ianaTz: null, label: utcOffsetLabel(min) };
  }
  // 縮寫（SGT、PST…）；AM/PM 不在表內，會自然落到「未標時區」
  if ((m = text.match(/\s([A-Za-z]{2,5})$/))) {
    const abbr = m[1].toUpperCase();
    if (abbr in TZ_ABBR_MIN) {
      const min = TZ_ABBR_MIN[abbr];
      let label = min === 0 ? abbr : `${abbr}, ${utcOffsetLabel(min)}`;
      if (abbr === 'CST') label += '，採中國標準時間';
      return { rest: text.slice(0, m.index), offsetMin: min, ianaTz: null, label };
    }
  }
  return { rest: text, offsetMin: null, ianaTz: null, label: '' };
}

// 把去掉時區後的文字解析成牆上時鐘欄位，失敗回傳 null
// 支援：2026-07-30 08:00:00／2026/7/30 20:00／Jul 30, 2026 8:00 AM／30 July 2026 20:00
function parseWallClock(rest) {
  let text = rest.trim().replace(/,\s*$/, '');
  // 抽出結尾的 AM / PM（含 a.m. 寫法；前面須是數字或空白，避免誤吃單字結尾）
  let ampm = null;
  let m = text.match(/([\d\s])([ap])\.?\s?m\.?$/i);
  if (m) {
    ampm = m[2].toLowerCase();
    text = text.slice(0, m.index + 1).trim();
  }
  let y; let mo; let d; let h = 0; let mi = 0; let s = 0;
  const timePart = '(?:,?\\s+(\\d{1,2})(?::(\\d{2}))?(?::(\\d{2}))?)?$';
  if ((m = text.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[T\s](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/))) {
    [y, mo, d, h, mi, s] = [+m[1], +m[2], +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0)];
  } else if ((m = text.match(new RegExp(`^([A-Za-z]{3,9})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s*(\\d{4})${timePart}`, 'i')))) {
    // 月份名開頭：Jul 30, 2026 8:00
    mo = MONTH_BY_NAME[m[1].slice(0, 3).toLowerCase()];
    [d, y, h, mi, s] = [+m[2], +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0)];
  } else if ((m = text.match(new RegExp(`^(\\d{1,2})(?:st|nd|rd|th)?\\.?\\s+([A-Za-z]{3,9})\\.?,?\\s*(\\d{4})${timePart}`, 'i')))) {
    // 日開頭：30 July 2026 20:00
    mo = MONTH_BY_NAME[m[2].slice(0, 3).toLowerCase()];
    [d, y, h, mi, s] = [+m[1], +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0)];
  } else {
    return null;
  }
  if (!mo) return null; // 月份名稱不認得
  if (ampm) {
    if (h < 1 || h > 12) return null;
    if (ampm === 'p' && h !== 12) h += 12;
    if (ampm === 'a' && h === 12) h = 0;
  }
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59 || s > 59) return null;
  // 檢查日期真實存在（擋掉 Feb 30 這類 Date.UTC 會自動進位的輸入）
  const check = new Date(Date.UTC(y, mo - 1, d));
  if (check.getUTCMonth() !== mo - 1 || check.getUTCDate() !== d) return null;
  return { y, mo, d, h, mi, s };
}

function parseDateText(raw) {
  // 統一空白（Apple 系統複製的時間常帶 U+202F 窄空白）再解析
  const normalized = raw.trim().replace(/[\u00A0\u2009\u202F]/g, ' ').replace(/\s+/g, ' ');
  if (!normalized) return null;
  const tz = extractTimeZone(normalized);
  const wall = parseWallClock(tz.rest);
  if (!wall) return null;
  const { y, mo, d, h, mi, s } = wall;
  let epochMs;
  let srcLabel;
  if (tz.offsetMin !== null) {
    epochMs = Date.UTC(y, mo - 1, d, h, mi, s) - tz.offsetMin * 60000;
    srcLabel = tz.label;
  } else if (tz.ianaTz) {
    epochMs = zonedTimeToUtc(y, mo, d, h, mi, s, tz.ianaTz);
    srcLabel = tz.label;
  } else {
    epochMs = zonedTimeToUtc(y, mo, d, h, mi, s, state.tz);
    srcLabel = `未標時區，依時區設定 ${state.tz} 解讀`;
  }
  const wallText = `${y}-${pad(mo)}-${pad(d)} ${pad(h)}:${pad(mi)}:${pad(s)}`;
  return { epochMs, wallText, srcLabel };
}

function renderTsToDate() {
  const raw = tsInput.value.trim();
  let epochMs = parseTsInput();
  let hint = '';
  if (epochMs === null && raw) {
    const parsed = parseDateText(raw);
    if (parsed) {
      epochMs = parsed.epochMs;
      hint = `已解讀：${parsed.wallText}（${parsed.srcLabel}）`;
    }
  }
  const invalid = epochMs === null;
  parseHint.classList.toggle('is-error', invalid && raw !== '');
  parseHint.textContent = invalid && raw !== ''
    ? '無法解讀，可輸入 Unix timestamp 或日期文字（例：Jul 30, 2026 8:00 AM SGT）'
    : hint;
  tsInput.classList.toggle('is-invalid', invalid && raw !== '');
  if (invalid) {
    ['ts-dt', 'ts-weekday', 'ts-iso', 'ts-rel'].forEach((id) => setOutput(id, ''));
    return;
  }
  const t = formatInTz(epochMs, state.tz);
  setOutput('ts-dt', dateTimeString(epochMs, state.tz));
  setOutput('ts-weekday', t.weekday);
  setOutput('ts-iso', isoString(epochMs, state.tz));
  setOutput('ts-rel', relativeString(epochMs));
}

// ============================================================
// 日期時間 → Timestamp
// ============================================================
dateToTsList.append(
  buildOutputRow('Unix（秒）', 'date-s'),
  buildOutputRow('Unix（毫秒）', 'date-ms'),
  buildOutputRow('ISO 8601', 'date-iso'),
);

function renderDateToTs() {
  const dateVal = dateInput.value; // YYYY-MM-DD
  const timeVal = timeInput.value || '00:00:00'; // HH:MM 或 HH:MM:SS
  if (!dateVal) {
    ['date-s', 'date-ms', 'date-iso'].forEach((id) => setOutput(id, ''));
    return;
  }
  const [y, mo, d] = dateVal.split('-').map(Number);
  const timeParts = timeVal.split(':').map(Number);
  const [h, mi, s] = [timeParts[0] || 0, timeParts[1] || 0, timeParts[2] || 0];
  const epochMs = zonedTimeToUtc(y, mo, d, h, mi, s, state.tz);
  setOutput('date-s', String(Math.floor(epochMs / 1000)));
  setOutput('date-ms', String(epochMs));
  setOutput('date-iso', isoString(epochMs, state.tz));
}

// ============================================================
// 提示訊息
// ============================================================
let hintTimer = null;
function flashHint(msg) {
  copyHint.textContent = msg;
  clearTimeout(hintTimer);
  hintTimer = setTimeout(() => { copyHint.textContent = ''; }, 1600);
}

// ============================================================
// 事件綁定
// ============================================================
TZ_OPTIONS.forEach((tz) => {
  const opt = document.createElement('option');
  opt.value = tz.id;
  opt.textContent = tz.label;
  tzSelect.append(opt);
});
tzSelect.value = state.tz;
tzSelect.addEventListener('change', () => {
  state.tz = tzSelect.value;
  renderNow();
  renderTsToDate();
  renderDateToTs();
});

tsInput.addEventListener('input', renderTsToDate);
tsNowBtn.addEventListener('click', () => {
  tsInput.value = String(Date.now());
  state.tsUnit = 'ms';
  tsUnitToggle.querySelectorAll('.unit-tab').forEach((b) => {
    const on = b.dataset.unit === 'ms';
    b.classList.toggle('is-active', on);
    b.setAttribute('aria-selected', String(on));
  });
  renderTsToDate();
});
tsUnitToggle.addEventListener('click', (e) => {
  const btn = e.target.closest('.unit-tab');
  if (!btn || btn.dataset.unit === state.tsUnit) return;
  state.tsUnit = btn.dataset.unit;
  tsUnitToggle.querySelectorAll('.unit-tab').forEach((b) => {
    const on = b === btn;
    b.classList.toggle('is-active', on);
    b.setAttribute('aria-selected', String(on));
  });
  renderTsToDate();
});

dateInput.addEventListener('input', renderDateToTs);
timeInput.addEventListener('input', renderDateToTs);
dateNowBtn.addEventListener('click', () => {
  const t = formatInTz(Date.now(), state.tz);
  dateInput.value = `${t.y}-${pad(t.mo)}-${pad(t.d)}`;
  timeInput.value = `${pad(t.h)}:${pad(t.mi)}:${pad(t.s)}`;
  renderDateToTs();
});

// ============================================================
// 初次渲染
// ============================================================
{
  const t = formatInTz(Date.now(), state.tz);
  dateInput.value = `${t.y}-${pad(t.mo)}-${pad(t.d)}`;
  timeInput.value = `${pad(t.h)}:${pad(t.mi)}:${pad(t.s)}`;
  tsInput.value = String(Math.floor(Date.now() / 1000));
}
renderNow();
renderTsToDate();
renderDateToTs();
setInterval(renderNow, 1000);
