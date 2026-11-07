// src/utils/password.js
// ฟังก์ชันช่วยเรื่องรหัสผ่านและ CSV ที่ใช้ใน Auth.jsx และ Dashboard.jsx

// ---------- ความแข็งแรงของรหัสผ่าน ----------
const COMMON_PASSWORDS = new Set([
  'password', 'passw0rd', 'p@ssword', 'p@ssw0rd', 'qwerty', 'qwerty123', 'qwertyuiop',
  'abc123', 'abcd1234', 'letmein', 'welcome', 'admin', 'admin123', 'iloveyou',
  'monkey', 'dragon', 'football', 'baseball', 'login', 'master', 'sunshine',
  '123456', '1234567', '12345678', '123456789', '1234567890', '111111', '000000',
  '123123', '654321', '112233', '987654321',
]);

/**
 * คืนค่า { score: 0-100, text, color, textColor }
 * - score <= 33 ถือว่า "อ่อนแอ" (Dashboard ใช้ค่านี้ตัดสินใน Watchtower)
 * - color / textColor เป็นคลาส Tailwind แบบเต็ม (เพื่อให้ Tailwind สแกนเจอ)
 */
export function getPasswordStrength(password = '') {
  const pw = String(password || '');
  if (!pw) {
    return { score: 0, text: '-', color: 'bg-slate-200', textColor: 'text-slate-400' };
  }

  const hasLower = /[a-z]/.test(pw);
  const hasUpper = /[A-Z]/.test(pw);
  const hasDigit = /\d/.test(pw);
  const hasSymbol = /[^A-Za-z0-9]/.test(pw);
  const variety = [hasLower, hasUpper, hasDigit, hasSymbol].filter(Boolean).length;

  let score = Math.min(40, pw.length * 3) + variety * 10;
  if (pw.length >= 12) score += 10;
  if (pw.length >= 16) score += 10;

  if (variety === 1) score -= 10;                 // ใช้ตัวอักษรชนิดเดียว
  if (/(.)\1{2,}/.test(pw)) score -= 10;          // ตัวซ้ำติดกัน 3 ตัวขึ้นไป
  if (new Set(pw).size <= 2) score = Math.min(score, 10); // เช่น aaaaaaaa

  const lower = pw.toLowerCase();
  const stripped = lower.replace(/[\d!@#$%^&*._-]+$/, ''); // ตัดเลข/สัญลักษณ์ท้ายคำ
  if (COMMON_PASSWORDS.has(lower) || COMMON_PASSWORDS.has(stripped)) {
    score = Math.min(score, 15);
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  if (score <= 33) return { score, text: 'อ่อนแอ', color: 'bg-rose-500', textColor: 'text-rose-500' };
  if (score <= 60) return { score, text: 'ปานกลาง', color: 'bg-amber-400', textColor: 'text-amber-500' };
  if (score <= 80) return { score, text: 'ดี', color: 'bg-lime-500', textColor: 'text-lime-600' };
  return { score, text: 'แข็งแรงมาก', color: 'bg-emerald-500', textColor: 'text-emerald-500' };
}

// ---------- สุ่มรหัสผ่าน ----------
const POOLS = {
  upper: 'ABCDEFGHJKLMNPQRSTUVWXYZ',
  lower: 'abcdefghijkmnopqrstuvwxyz',
  digits: '23456789',
  symbols: '!@#$%^&*()-_=+[]{}?',
};

// สุ่มเลข 0..max-1 ด้วย crypto (ไม่เอนเอียง)
function randInt(max) {
  const c = globalThis.crypto;
  if (!c || !c.getRandomValues) throw new Error('เบราว์เซอร์นี้ไม่รองรับการสุ่มแบบปลอดภัย');
  const limit = Math.floor(0x100000000 / max) * max;
  const buf = new Uint32Array(1);
  do { c.getRandomValues(buf); } while (buf[0] >= limit);
  return buf[0] % max;
}

export function generatePassword(opts = {}) {
  const { length = 16, upper = true, lower = true, digits = true, symbols = true } = opts;
  const len = Math.max(8, Math.min(64, Number(length) || 16));

  let keys = Object.entries({ upper, lower, digits, symbols })
    .filter(([, on]) => on)
    .map(([k]) => k);
  if (!keys.length) keys = ['lower', 'digits']; // ถ้าไม่เลือกอะไรเลย ใช้ค่าเริ่มต้น

  const all = keys.map((k) => POOLS[k]).join('');
  // บังคับให้มีอย่างน้อย 1 ตัวจากทุกชุดที่เลือก
  const chars = keys.map((k) => POOLS[k][randInt(POOLS[k].length)]);
  while (chars.length < len) chars.push(all[randInt(all.length)]);

  // สลับตำแหน่ง (Fisher-Yates)
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

// ---------- CSV ----------
/** แปลงข้อความ CSV เป็นอาร์เรย์ของแถว (รองรับ "..." , "" , ขึ้นบรรทัดใหม่ในช่อง, BOM, CRLF) */
export function parseCsv(text = '') {
  const src = String(text).replace(/^\uFEFF/, '');
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field); field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(field); field = '';
      rows.push(row); row = [];
    } else {
      field += ch;
    }
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }

  // ตัดแถวว่าง
  return rows.filter((r) => r.some((c) => String(c).trim() !== ''));
}

const CSV_COLUMNS = ['title', 'username', 'password', 'category', 'notes', 'tag'];

const escapeCsv = (v) => {
  const s = v == null ? '' : String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** สร้างข้อความ CSV จากรายการในตู้เซฟ (ใส่ BOM เพื่อให้ Excel อ่านภาษาไทยถูก) */
export function buildCsv(items = []) {
  const lines = [CSV_COLUMNS.join(',')];
  items.forEach((it) => {
    lines.push(CSV_COLUMNS.map((c) => escapeCsv(it[c])).join(','));
  });
  return '\uFEFF' + lines.join('\r\n');
}