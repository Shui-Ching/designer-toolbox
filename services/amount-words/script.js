// ============================================================
// 27 金額轉大寫 — 金額轉中文財務大寫與英文大寫
// 以字串處理整數／小數，避免浮點誤差；零相依，維持 CSP script-src 'self'
// ============================================================
import { copyText, track } from '../../shared/scripts/shared.js?v=202606252340';

// — DOM —
const input = document.getElementById('amount-input');
const inputWrap = input.closest('.amount-input-wrap');
const errorEl = document.getElementById('amount-error');
const copyHint = document.getElementById('copy-hint');
const out = {
  num: document.getElementById('out-num'),
  cn: document.getElementById('out-cn'),
  en: document.getElementById('out-en'),
};

// 整數位數上限：4 位一節，最多到「兆」節（10^12～10^15），共 16 位
const MAX_INT_DIGITS = 16;

// ============================================================
// 中文財務大寫
// ============================================================
const CN_DIGITS = ['零', '壹', '貳', '參', '肆', '伍', '陸', '柒', '捌', '玖'];
const CN_UNITS = ['', '拾', '佰', '仟'];      // 節內位數單位
const CN_BIG = ['', '萬', '億', '兆'];          // 節間大單位（每 4 位一節）

// 轉換 4 位數字字串為中文（節內），如 "2345" → 貳仟參佰肆拾伍
function convertGroup(group) {
  let str = '';
  let zeroPending = false; // 節內遇 0 先記下，待後面有非零數字才補一個「零」
  for (let i = 0; i < 4; i++) {
    const d = Number(group[i]);
    const unit = CN_UNITS[3 - i]; // i=0→仟、i=3→個位
    if (d === 0) {
      zeroPending = true;
    } else {
      if (zeroPending && str) str += '零';
      zeroPending = false;
      str += CN_DIGITS[d] + unit;
    }
  }
  return str;
}

// 整數字串轉中文大寫（不含「元」），如 "10005" → 壹萬零伍
function intToChinese(intStr) {
  intStr = intStr.replace(/^0+/, '') || '0';
  if (intStr === '0') return '零';

  const padLen = Math.ceil(intStr.length / 4) * 4;
  const padded = intStr.padStart(padLen, '0');
  const groupCount = padLen / 4;

  let result = '';
  for (let g = 0; g < groupCount; g++) {
    const group = padded.slice(g * 4, g * 4 + 4);
    const bigUnit = CN_BIG[groupCount - 1 - g];
    if (Number(group) === 0) {
      // 整節為零：若前面已有內容，補一個「零」當間隔（避免結尾多零，最後再修剪）
      if (result && !result.endsWith('零')) result += '零';
    } else {
      // 該節有前導零（不足千）且前面已有內容，需先補「零」隔開大單位
      if (result && group[0] === '0' && !result.endsWith('零')) result += '零';
      result += convertGroup(group) + bigUnit;
    }
  }
  return result.replace(/零+$/, ''); // 修掉結尾多餘的零
}

// 金額（已拆好的 sign／整數字串／兩位小數字串）轉中文財務大寫
function toChineseAmount(negative, intStr, jiao, fen) {
  const yuanWords = intToChinese(intStr);
  const hasYuan = intStr.replace(/^0+/, '') !== '';
  let result = '';

  if (hasYuan) result += yuanWords + '元';

  if (jiao === 0 && fen === 0) {
    // 無小數：整數金額後加「整」
    result += '整';
  } else {
    // 有元、但角為零而分不為零時，補「零」（如 壹佰元零伍分）
    if (hasYuan && jiao === 0 && fen > 0) result += '零';
    if (jiao > 0) result += CN_DIGITS[jiao] + '角';
    if (fen > 0) result += CN_DIGITS[fen] + '分';
    // 有角無分（如 伍角）補「整」收尾
    if (fen === 0) result += '整';
  }

  // 金額為 0：整數與小數皆無
  if (!hasYuan && jiao === 0 && fen === 0) result = '零元整';

  return (negative ? '負' : '') + result;
}

// ============================================================
// 英文大寫
// ============================================================
const EN_ONES = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
  'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen',
  'seventeen', 'eighteen', 'nineteen',
];
const EN_TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
const EN_SCALE = ['', 'thousand', 'million', 'billion', 'trillion', 'quadrillion'];

// 0–999 轉英文
function threeToEnglish(n) {
  let str = '';
  const h = Math.floor(n / 100);
  const rest = n % 100;
  if (h) str += EN_ONES[h] + ' hundred';
  if (rest) {
    if (str) str += ' ';
    if (rest < 20) {
      str += EN_ONES[rest];
    } else {
      str += EN_TENS[Math.floor(rest / 10)];
      if (rest % 10) str += '-' + EN_ONES[rest % 10];
    }
  }
  return str;
}

// 整數字串轉英文（用 BigInt 處理大數），如 "12345" → twelve thousand three hundred forty-five
function intToEnglish(intStr) {
  let num = BigInt(intStr.replace(/^0+/, '') || '0');
  if (num === 0n) return 'zero';

  // 由低位往高位每 3 位切成一組
  const groups = [];
  while (num > 0n) {
    groups.push(Number(num % 1000n));
    num /= 1000n;
  }

  const parts = [];
  for (let i = groups.length - 1; i >= 0; i--) {
    if (groups[i] === 0) continue;
    parts.push(threeToEnglish(groups[i]) + (EN_SCALE[i] ? ' ' + EN_SCALE[i] : ''));
  }
  return parts.join(' ');
}

// 金額轉英文（支票格式：整數 + 小數以 XX/100 表示）
function toEnglishAmount(negative, intStr, decStr) {
  const words = intToEnglish(intStr);
  const cents = Number(decStr); // 兩位小數
  let result = words;
  if (cents > 0) result += ` and ${decStr}/100`;
  return (negative ? 'negative ' : '') + result;
}

// ============================================================
// 解析輸入 → { ok, negative, intStr, decStr, jiao, fen } 或 { ok:false, error }
// ============================================================
function parse(raw) {
  const cleaned = raw.replace(/,/g, '').replace(/\s/g, '').trim();
  if (cleaned === '' || cleaned === '-' || cleaned === '.') return { ok: false, empty: true };

  // 僅允許可選負號、數字、最多一個小數點
  if (!/^-?\d*\.?\d*$/.test(cleaned)) return { ok: false, error: '請輸入有效的金額（數字、小數點與千分位逗號）' };

  let negative = false;
  let body = cleaned;
  if (body.startsWith('-')) { negative = true; body = body.slice(1); }

  let [intRaw = '0', decRaw = ''] = body.split('.');
  intRaw = intRaw.replace(/^0+(?=\d)/, '') || '0'; // 去前導零但保留單一 0

  if (intRaw.length > MAX_INT_DIGITS) {
    return { ok: false, error: `整數位數過多，目前支援最多到「兆」（${MAX_INT_DIGITS} 位數）` };
  }

  // 小數補滿／截斷到兩位（角分）
  const decStr = (decRaw + '00').slice(0, 2);
  const jiao = Number(decStr[0]);
  const fen = Number(decStr[1]);

  // -0 視為 0，不顯示「負」
  if (intRaw === '0' && jiao === 0 && fen === 0) negative = false;

  return { ok: true, negative, intStr: intRaw, decStr, jiao, fen };
}

// 整數加千分位逗號
function groupThousands(intStr) {
  return intStr.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// ============================================================
// 渲染
// ============================================================
let results = { num: '', cn: '', en: '' };

function setValue(el, text, empty) {
  el.textContent = empty ? '—' : text;
  el.classList.toggle('is-empty', !!empty);
}

function render() {
  const parsed = parse(input.value);

  if (!parsed.ok) {
    inputWrap.classList.toggle('is-invalid', !parsed.empty);
    errorEl.textContent = parsed.empty ? '' : parsed.error;
    results = { num: '', cn: '', en: '' };
    setValue(out.num, '', true);
    setValue(out.cn, '', true);
    setValue(out.en, '', true);
    return;
  }

  inputWrap.classList.remove('is-invalid');
  errorEl.textContent = '';

  const sign = parsed.negative ? '-' : '';
  const numText = sign + groupThousands(parsed.intStr) + (parsed.decStr === '00' ? '' : '.' + parsed.decStr);
  const cnText = toChineseAmount(parsed.negative, parsed.intStr, parsed.jiao, parsed.fen);
  const enText = toEnglishAmount(parsed.negative, parsed.intStr, parsed.decStr);

  results = { num: numText, cn: cnText, en: enText };
  setValue(out.num, numText, false);
  setValue(out.cn, cnText, false);
  setValue(out.en, enText.toUpperCase(), false); // 英文一律大寫呈現
}

// ============================================================
// 互動
// ============================================================
let hintTimer = null;
function flashHint(msg) {
  copyHint.textContent = msg;
  clearTimeout(hintTimer);
  hintTimer = setTimeout(() => { copyHint.textContent = ''; }, 1600);
}

input.addEventListener('input', render);

// 複製對應結果（事件委派）
document.querySelector('.result-list').addEventListener('click', async (e) => {
  const btn = e.target.closest('.result-copy');
  if (!btn) return;
  const key = btn.dataset.copy;
  const value = key === 'en' ? results.en.toUpperCase() : results[key];
  if (!value) {
    flashHint('還沒有可複製的結果');
    return;
  }
  if (await copyText(value)) {
    flashHint('已複製');
    track('copy', { field: key });
  } else {
    flashHint('複製失敗，請手動選取');
  }
});

// 初次渲染（空字串）
render();
