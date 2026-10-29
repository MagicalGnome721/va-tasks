// ============================================================================
// Utilities
// ============================================================================
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const clone = (o) => (o == null ? o : JSON.parse(JSON.stringify(o)));
const trim = (v) => (v == null ? '' : String(v)).trim();
const sameName = (a, b) => trim(a) !== '' && trim(a).toLowerCase() === trim(b).toLowerCase();
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

const LS = {
  raw(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  setRaw(k, v) { try { if (v == null || v === '') localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { /* ignore */ } },
  get(k, def) { try { const v = localStorage.getItem(k); return v == null ? def : JSON.parse(v); } catch (e) { return def; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* ignore */ } },
  del(k) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } },
};

const PARAMS = new URLSearchParams(location.search);
const pad2 = (n) => String(n).padStart(2, '0');
function localYmd(d = new Date()) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
function isoLocal(d = new Date()) {
  const off = -d.getTimezoneOffset();
  const sign = off >= 0 ? '+' : '-';
  const a = Math.abs(off);
  return localYmd(d) + 'T' + pad2(d.getHours()) + ':' + pad2(d.getMinutes()) + ':' + pad2(d.getSeconds()) + sign + pad2(Math.floor(a / 60)) + ':' + pad2(a % 60);
}
function hhmm(d = new Date()) { return pad2(d.getHours()) + ':' + pad2(d.getMinutes()); }
const fmtDate = (ymd) => Rules.ymdToDmy(ymd) || '';
const fmtDM = (ymd) => { const s = Rules.ymdToDmy(ymd); return s ? s.slice(0, 5) : ''; };
function fmtDateTime(d) { return pad2(d.getDate()) + '/' + pad2(d.getMonth() + 1) + '/' + d.getFullYear() + ' ' + hhmm(d); }
function relTime(ts) {
  const d = new Date(ts);
  if (isNaN(d)) return String(ts || '');
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 0) return fmtDateTime(d);
  if (diff < 60) return 'vừa xong';
  if (diff < 3600) return Math.floor(diff / 60) + ' phút trước';
  const today = localYmd();
  const dy = localYmd(d);
  if (dy === today) return Math.floor(diff / 3600) + ' giờ trước';
  const y = new Date(); y.setDate(y.getDate() - 1);
  if (dy === localYmd(y)) return 'hôm qua ' + hhmm(d);
  return fmtDateTime(d);
}
function initials(name) {
  const w = trim(name).split(/\s+/).filter(Boolean);
  if (!w.length) return '?';
  const pick = w.length >= 2 ? w.slice(-2) : w;
  return pick.map((x) => x[0]).join('').toUpperCase();
}
const AV_COLORS = ['#7c3aed', '#2563eb', '#0d9488', '#c2410c', '#be185d', '#4d7c0f', '#0369a1', '#9333ea', '#b45309', '#0f766e', '#dc2626', '#475569'];
function avColor(name) { let h = 0; for (const ch of trim(name)) h = (h * 31 + ch.codePointAt(0)) >>> 0; return AV_COLORS[h % AV_COLORS.length]; }
function avatar(name, cls = '') {
  if (!trim(name)) return `<span class="avatar avatar-empty ${cls}" aria-hidden="true">–</span>`;
  return `<span class="avatar ${cls}" style="--av:${avColor(name)}" aria-hidden="true">${esc(initials(name))}</span>`;
}
function linkify(text) {
  return esc(text).replace(/(https?:\/\/[^\s<]+)/g, (u) => `<a href="${u}" target="_blank" rel="noopener">${u}</a>`);
}
const ICONS = {
  dots: '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.3" fill="currentColor"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/><circle cx="19" cy="12" r="1.3" fill="currentColor"/></svg>',
  close: '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  chev: '<svg class="ico chev" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>',
  chevDown: '<svg class="ico chev" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>',
  up: '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 15 6-6 6 6"/></svg>',
  down: '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>',
  edit: '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4z"/><path d="m14 6 4 4"/></svg>',
  trash: '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>',
  link: '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true" style="width:13px;height:13px"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></svg>',
  filter: '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16l-6 8v6l-4-2v-4z"/></svg>',
  sun: '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
  moon: '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/></svg>',
  copy: '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/></svg>',
  open: '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>',
  move: '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
  user: '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 20c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg>',
  cal: '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg>',
  logout: '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l5-5-5-5M15 12H4"/></svg>',
  pause: '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6v12M15 6v12"/></svg>',
  play: '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10-6.5z"/></svg>',
  split: '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v6M12 9l-6 6v5M12 9l6 6v5"/></svg>',
  spark: '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/></svg>',
  flag: '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 21V4M5 4h11l-2 4 2 4H5"/></svg>',
  check: '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7"/></svg>',
  x: '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7l10 10M17 7 7 17"/></svg>',
  chat: '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v11H9l-5 4z"/></svg>',
};
const EMPTY_ART = `<svg viewBox="0 0 120 90" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2"><rect x="14" y="16" width="56" height="62" rx="6"/><rect x="34" y="8" width="56" height="62" rx="6" fill="var(--surface)"/><path d="M44 26h36M44 36h28M44 46h32" stroke-linecap="round"/><circle cx="92" cy="66" r="12" fill="var(--surface)"/><path d="M92 54v24M80 66h24" stroke="var(--brand)" stroke-width="2"/><circle cx="92" cy="66" r="5" stroke="var(--brand)"/></svg>`;

class ApiError extends Error {
  constructor(code, message, details) { super(message); this.code = code; this.details = details; }
}
const ERR_MSG = {
  BAD_REQUEST: 'Yêu cầu không hợp lệ', UNAUTHORIZED: 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại', VALIDATION: 'Dữ liệu không hợp lệ',
  FORBIDDEN: 'Bạn không có quyền thực hiện thao tác này', RATE_LIMITED: 'Bạn thao tác quá nhanh, vui lòng thử lại sau ít phút',
  INVALID_CODE: 'Mã không đúng hoặc đã hết hạn', AI_UNAVAILABLE: 'AI tạm thời không khả dụng',
  NOT_FOUND: 'Không tìm thấy đơn', CONFLICT: 'Dữ liệu đã thay đổi trên Google Sheet', INVALID_TRANSITION: 'Không thể chuyển trạng thái',
  HEADER_MISSING: 'Không tìm thấy cột bắt buộc', LOCK_TIMEOUT: 'Hệ thống đang bận, thử lại sau', INTERNAL: 'Lỗi máy chủ',
  NETWORK: 'Không kết nối được máy chủ', TIMEOUT: 'Máy chủ phản hồi quá lâu',
};
function toApiError(e) {
  if (e instanceof ApiError) return e;
  if (e && e.code) return new ApiError(e.code, e.message || ERR_MSG[e.code] || e.code, e.details);
  return new ApiError('INTERNAL', 'Lỗi máy chủ: ' + ((e && e.message) || e));
}

// ============================================================================
// Mode & "today"
// ============================================================================
// Canonical Apps Script Web App URL: https://script.google.com/macros/s/<id>/(exec|dev), nothing else.
// Parsed with URL() so "..", encodings, credentials, query and hash can't disguise the real target.
function normApiUrl(raw) {
  const s = trim(raw);
  if (!s || /\s/.test(s)) return '';
  let u;
  try { u = new URL(s); } catch (e) { return ''; }
  if (u.protocol !== 'https:' || u.hostname !== 'script.google.com' || u.port || u.username || u.password) return '';
  if (!/^\/macros\/s\/[A-Za-z0-9_-]+\/(exec|dev)$/.test(u.pathname)) return '';
  return u.origin + u.pathname;
}
const API_PARAM_INVALID = !!trim(PARAMS.get('api')) && !normApiUrl(PARAMS.get('api'));
// ?api=<web app url> lets a team share one link that configures the app. It is NEVER applied
// silently: a value that differs from the saved URL needs explicit confirmation (see init),
// and sessions are bound to the URL that issued them, so a token can't follow a new URL.
// Bản phát hành (publish/index.html) gắn cứng máy chủ: không có Demo, không có ô kết nối.
const BUILT_API = normApiUrl('__BUILT_API__');
if (BUILT_API && trim(LS.raw('va.apiUrl')) !== BUILT_API) { LS.setRaw('va.apiUrl', BUILT_API); LS.del('va.session'); }
const PENDING_API = (() => {
  if (BUILT_API) return '';
  const a = normApiUrl(PARAMS.get('api'));
  if (!a) return '';
  if (a === trim(LS.raw('va.apiUrl'))) return '';
  return a;
})();
const savedApiUrl = () => trim(LS.raw('va.apiUrl'));
const FORCE_DEMO = !BUILT_API && PARAMS.get('demo') === '1';   // bản phát hành: không có Demo
function configuredMode() { return (!FORCE_DEMO && trim(LS.raw('va.apiUrl'))) ? 'remote' : 'demo'; }
function realToday() { return localYmd(); }
const DEMO_TODAY = Rules.isValidYmd(PARAMS.get('demoToday') || '') ? PARAMS.get('demoToday') : null;
let demoTodayOverride = null;
function today() { return (S.mode === 'demo' && (demoTodayOverride || DEMO_TODAY)) ? (demoTodayOverride || DEMO_TODAY) : realToday(); }

// ============================================================================
// Session (localStorage['va.session'])
// ============================================================================
const SESSION_KEY = 'va.session';
// the URL a session belongs to: 'demo' for the demo adapter, else the exact Web App URL
const sessionScope = (mode) => (mode === 'demo' ? 'demo' : savedApiUrl());
function loadSession(mode) {
  const s = LS.get(SESSION_KEY, null);
  if (!s || typeof s !== 'object' || !s.token || !s.user) return null;
  if ((s.mode || 'remote') !== mode) return null;
  if (!s.apiUrl || s.apiUrl !== sessionScope(mode)) { clearSession(); return null; }
  if (s.expiresAt && Date.parse(s.expiresAt) && Date.parse(s.expiresAt) < Date.now()) return null;
  return s;
}
function storeSession(mode, r) {
  const s = { mode, apiUrl: sessionScope(mode), token: r.sessionToken, expiresAt: r.expiresAt || '', user: r.user };
  LS.set(SESSION_KEY, s);
  return s;
}
function clearSession() { LS.del(SESSION_KEY); }

// ============================================================================
// Demo adapter — an in-browser copy of the server, built on the same Rules
// ============================================================================
const DEMO_OTP = '000000';
const FIXED_OWNER_EMAIL = 'khuonglun69@gmail.com';   // quản trị viên toàn app — không đổi
const SPLIT_MARK = 'Gợi ý chia đợt (AI):';
const DEMO_SYSTEM = 'Hệ thống';
function createDemoApi() {
  const mem = {};
  const store = {
    get(k) { const v = LS.raw(k); if (v != null) { try { return JSON.parse(v); } catch (e) { /* fallthrough */ } } return k in mem ? clone(mem[k]) : null; },
    set(k, v) { mem[k] = clone(v); LS.set(k, v); },
    del(k) { delete mem[k]; LS.del(k); },
  };
  const latency = (() => { const n = parseInt(PARAMS.get('latency'), 10); return isFinite(n) && n >= 0 ? n : 150; })();
  const failMap = {};
  const idem = new Map();
  let aiMode = 'ok';
  const dToday = () => demoTodayOverride || DEMO_TODAY || realToday();
  const KEYS = ['va.demo.tasks', 'va.demo.config', 'va.demo.log', 'va.demo.seededFor', 'va.demo.sessions', 'va.demo.drafts', 'va.demo.aiCount', 'va.demo.reminders'];

  // ---------- seed ----------
  function prevBusinessDays(ymd, n) { let d = ymd; let k = 0; while (k < n) { d = Rules.addDays(d, -1); if (Rules.isBusinessDay(d)) k++; } return d; }
  function seed() {
    const T = dToday();
    const D = (n) => Rules.addDays(T, n);
    const dmy = (n) => Rules.ymdToDmy(D(n));
    const base = (o) => Object.assign({
      id: '', team: '', project: 'N108', assetType: '', name: '', description: '', briefLink: '', outputSpec: '', quantity: 1, priority: 'Trung bình',
      requester: '', assignee: '', requestDate: D(-1), deadline: '', status: 'Mới', progress: null, deliveryLink: '', notes: '',
      requesterEmail: '', usage: '', acceptance: '', size: '', urgentReason: '', aiSummary: '', reviewDate: '', revisionCount: 0, holdReason: '', parentId: '',
      sheetDeadlineWarning: '',
    }, o);
    const VA = { team: 'UI', requester: 'Vân Anh', requesterEmail: 'vananh@demo.local' };
    const TH = { team: 'Marketing', requester: 'Thu Hà', requesterEmail: 'thuha@demo.local' };
    const HN = { team: 'Game Design', requester: 'Hoàng Nam', requesterEmail: 'hoangnam@demo.local' };
    const rv1 = prevBusinessDays(T, 1), rv2 = prevBusinessDays(T, 2);
    const tasks = [
      base(Object.assign({}, VA, { id: 'AI-001', assetType: 'Icon', name: 'Icon kỹ năng hệ Lửa', description: '12 icon kỹ năng hệ Lửa cho cây kỹ năng mới.', usage: 'Màn hình cây kỹ năng', quantity: 12, outputSpec: 'PNG 256×256, nền trong', acceptance: 'Đồng bộ style với bộ icon hệ Băng hiện có', priority: 'Cao', size: 'M', requestDate: D(-1), deadline: D(4), aiSummary: '12 icon kỹ năng hệ Lửa, style giống bộ hệ Băng. Khối lượng khoảng 1 ngày.' })),
      base(Object.assign({}, HN, { id: 'AI-002', assetType: 'Art', name: 'Art 8 class nhân vật', description: 'Vẽ art đại diện cho 8 class.', usage: 'Màn hình chọn class', quantity: 8, priority: 'Trung bình', size: '', requestDate: D(-23), sheetDeadlineWarning: 'Chưa có deadline' })),
      base(Object.assign({}, HN, { id: 'AI-003', assetType: 'Background', name: 'Gen 200 map cho chế độ Thám hiểm', description: 'Gen 200 map nền theo 4 biome (rừng, sa mạc, băng, núi lửa), mỗi biome 50 map.', usage: 'Chế độ Thám hiểm', quantity: 200, outputSpec: 'PNG 2048×1024', acceptance: 'Đúng palette biome, không lặp bố cục', priority: 'Trung bình', size: 'XL', requestDate: D(-4), deadline: D(25),
        aiSummary: '200 map nền cho 4 biome, mỗi biome 50 map.\nĐộ nặng XL: Khối lượng rất lớn (> 3 ngày), cần chia đợt.\nƯu tiên Trung bình: Hạn còn hơn 3 tuần.\n' + SPLIT_MARK + ' Biome Rừng (50 map) [L]; Biome Sa mạc (50 map) [L]; Biome Băng (50 map) [L]; Biome Núi lửa (50 map) [L]' })),
      base(Object.assign({}, TH, { id: 'AI-004', assetType: 'Banner', name: 'Banner sự kiện Halloween', description: 'Banner 1920×1080 cho event 31/10, 3 phiên bản.', usage: 'Trang chủ game + fanpage', quantity: 3, outputSpec: '1920×1080 PNG + PSD', acceptance: 'Có logo event, chữ đọc rõ trên mobile', priority: 'Khẩn cấp', urgentReason: 'Event lên sóng 31/10, đã chốt lịch với đối tác', size: 'L', assignee: 'Minh Tuấn', requestDate: D(-6), deadline: D(2), status: 'Đang làm' })),
      base(Object.assign({}, VA, { id: 'AI-005', assetType: 'UI Element', name: 'Bộ nút bấm v2', description: 'Thiết kế lại bộ nút chính / phụ / disabled.', usage: 'Toàn bộ UI', quantity: 6, outputSpec: 'PNG @2x, 9-slice', acceptance: 'Đủ 3 trạng thái, 9-slice không vỡ', priority: 'Trung bình', size: 'M', assignee: 'Lan Chi', requestDate: D(-7), deadline: D(5), status: 'Chờ duyệt', deliveryLink: 'https://example.com/deliver/buttons-v2', reviewDate: rv1 })),
      base(Object.assign({}, TH, { id: 'AI-006', assetType: 'Illustration', name: 'Key visual trang store', project: 'Chung', description: 'Key visual cho trang store mùa đông.', usage: 'App Store / Google Play', priority: 'Cao', size: 'L', assignee: 'Minh Tuấn', requestDate: D(-8), deadline: D(3), status: 'Cần sửa', deliveryLink: 'https://example.com/deliver/kv-store-v1', revisionCount: 1, reviewDate: D(-2), notes: `[${dmy(-1)} 10:00] Thu Hà – Cần sửa: Tăng độ sáng nền, đổi màu logo` })),
      base(Object.assign({}, VA, { id: 'AI-007', assetType: 'Icon', name: 'Icon tiền tệ mới', priority: 'Trung bình', size: 'S', assignee: 'Lan Chi', requestDate: D(-15), deadline: D(-5), status: 'Hoàn thành', deliveryLink: 'https://example.com/deliver/currency-icons', quantity: 6, reviewDate: D(-9) })),
      base(Object.assign({}, HN, { id: 'AI-008', assetType: 'VFX', name: 'Hiệu ứng nâng cấp vũ khí', priority: 'Trung bình', assignee: 'Lan Chi', requestDate: D(-2), deadline: D(10), status: 'Đã giao' })),
      base(Object.assign({}, HN, { id: 'AI-009', assetType: 'Animation', name: 'Animation idle boss', priority: 'Thấp', assignee: 'Minh Tuấn', requestDate: D(-10), deadline: D(7), status: 'Tạm dừng', notes: `[${dmy(-3)} 09:00] Hoàng Nam – Tạm dừng: Chờ chốt thiết kế boss` })),
      base(Object.assign({}, TH, { id: 'AI-010', assetType: 'Banner', name: 'Banner Tết (bản cũ)', project: 'Chung', priority: 'Thấp', requestDate: D(-30), deadline: D(-20), status: 'Đã hủy' })),
      base(Object.assign({}, VA, { id: 'AI-011', assetType: 'Background', name: 'Background màn hình loading', priority: 'Cao', size: 'S', requestDate: D(-3), deadline: D(6), holdReason: 'Chờ file PSD gốc từ team UI' })),
      base(Object.assign({}, TH, { id: 'AI-012', assetType: 'Avatar/Frame', name: 'Khung avatar VIP', project: 'Chung', priority: 'Trung bình', size: 'M', assignee: 'Lan Chi', requestDate: D(-12), deadline: D(1), status: 'Đang làm', revisionCount: 3, deliveryLink: 'https://example.com/deliver/vip-frame-v3', notes: `[${dmy(-2)} 15:20] Thu Hà – Cần sửa: Vẫn chưa đúng tông vàng` })),
      base(Object.assign({}, TH, { id: 'AI-013', assetType: 'UI Element', name: 'Sửa màu nút Mua ngay', description: 'Chỉnh màu nút Mua ngay sang cam theo brand mới.', usage: 'Shop', quantity: 1, priority: 'Trung bình', size: 'S', requestDate: D(-2), deadline: '' })),
      base(Object.assign({}, TH, { id: 'AI-014', assetType: 'Banner', name: 'Banner khuyến mãi cuối tuần', description: 'Banner 1200×628 cho fanpage.', usage: 'Fanpage', priority: 'Trung bình', size: 'S', assignee: 'Minh Tuấn', requestDate: D(-6), deadline: D(2), status: 'Chờ duyệt', deliveryLink: 'https://example.com/deliver/weekend-sale', reviewDate: rv2 })),
    ];
    tasks.forEach((t, i) => { t._row = i + 2; });
    const at = (ymd, h, m) => { const [y, mo, d] = ymd.split('-').map(Number); return isoLocal(new Date(y, mo - 1, d, h, m, 0)); };
    const L = (ts, taskId, actor, action, field, oldValue, newValue, text) => ({ ts, taskId, actor, action, field: field || '', oldValue: oldValue || '', newValue: newValue || '', text: text || '' });
    const log = [];
    tasks.forEach((t) => {
      log.push(L(at(t.requestDate || T, 9, 0), t.id, t.requester || DEMO_SYSTEM, 'create', '', '', '', t.name));
      if (t.id === 'AI-005') log.push(L(at(rv1, 16, 0), t.id, 'Lan Chi', 'status', 'status', 'Đang làm', 'Chờ duyệt', ''));
      if (t.id === 'AI-014') log.push(L(at(rv2, 11, 0), t.id, 'Minh Tuấn', 'status', 'status', 'Đang làm', 'Chờ duyệt', ''));
      if (t.id === 'AI-006') {
        log.push(L(at(D(-1), 10, 0), t.id, 'Thu Hà', 'status', 'status', 'Chờ duyệt', 'Cần sửa', 'Tăng độ sáng nền, đổi màu logo'));
        log.push(L(at(D(-1), 10, 30), t.id, 'Minh Tuấn', 'comment', '', '', '', 'Ok chị, chiều nay em gửi lại'));
      }
      if (t.id === 'AI-011') log.push(L(at(D(-2), 14, 0), t.id, 'Lan Chi', 'update', 'holdReason', '', t.holdReason, ''));
    });
    const config = Rules.mergeConfig(Object.assign(clone(Rules.DEFAULT_CONFIG), {
      members: [
        { name: 'Minh Tuấn', email: 'minhtuan@demo.local', team: '', isArtist: true, active: true },
        { name: 'Lan Chi', email: 'lanchi@demo.local', team: '', isArtist: true, active: true },
        { name: 'Vân Anh', email: 'vananh@demo.local', team: 'UI', isArtist: false, active: true },
        { name: 'Thu Hà', email: 'thuha@demo.local', team: 'Marketing', isArtist: false, active: true },
        { name: 'Hoàng Nam', email: 'hoangnam@demo.local', team: 'Game Design', isArtist: false, active: true },
        { name: 'Quốc Bảo', email: '', team: 'Dev', isArtist: false, active: true },
      ],
      version: 1, updatedAt: isoLocal(),
    }));
    store.set('va.demo.tasks', tasks);
    store.set('va.demo.config', config);
    store.set('va.demo.log', log);
    store.set('va.demo.seededFor', T);
    store.set('va.demo.sessions', {});
    store.set('va.demo.drafts', {});
  }
  function clearAll() { KEYS.forEach((k) => store.del(k)); }
  function ensure() { if (!Array.isArray(store.get('va.demo.tasks')) || !store.get('va.demo.config')) { clearAll(); seed(); } }
  const tasksGet = () => store.get('va.demo.tasks') || [];
  const tasksSet = (t) => { t.forEach((x, i) => { x._row = i + 2; }); store.set('va.demo.tasks', t); };
  const cfgGet = () => Rules.mergeConfig(store.get('va.demo.config') || {});
  const logGet = () => store.get('va.demo.log') || [];
  const logAppend = (entries) => { const l = logGet(); entries.forEach((e) => l.push(e)); store.set('va.demo.log', l); };
  const findIdx = (tasks, id) => tasks.findIndex((t) => trim(t.id).toLowerCase() === trim(id).toLowerCase());
  const ctxFor = (user) => { const now = new Date(); const cfg = cfgGet(); return { actor: user ? user.name : DEMO_SYSTEM, user: user || null, today: dToday(), todayDmy: Rules.ymdToDmy(dToday()), hhmm: hhmm(now), priorities: cfg.priorities, vaNames: Rules.vaNamesOf(cfg, null) }; };
  const entry = (taskId, actor, action, field, oldValue, newValue, text) => ({ ts: isoLocal(), taskId: taskId || '', actor, action, field: field || '', oldValue: oldValue == null ? '' : String(oldValue), newValue: newValue == null ? '' : String(newValue), text: text || '' });
  const SYSTEM_USER = Rules.systemUser();

  // ---------- auth ----------
  const OWNER_EMAIL = FIXED_OWNER_EMAIL;
  function sessions() { return store.get('va.demo.sessions') || {}; }
  function userFor(token) {
    const s = sessions()[trim(token)];
    if (!s || (s.exp && s.exp < Date.now())) throw Rules.err('UNAUTHORIZED', ERR_MSG.UNAUTHORIZED);
    const u = Rules.roleOf(s.email, cfgGet(), OWNER_EMAIL);
    if (!u) throw Rules.err('UNAUTHORIZED', ERR_MSG.UNAUTHORIZED);
    return u;
  }
  function forbid(r) { if (!r || !r.ok) throw Rules.err('FORBIDDEN', (r && r.reason) || ERR_MSG.FORBIDDEN); }

  async function run(action, fn) {
    if (latency) await sleep(latency); else await Promise.resolve();
    if (failMap[action]) {
      const code = failMap[action]; delete failMap[action];
      throw new ApiError(code, ERR_MSG[code] || code);
    }
    try { return clone(fn()); } catch (e) { throw toApiError(e); }
  }
  function warnings(tasks) {
    const w = []; const seen = {};
    tasks.forEach((t) => { const k = trim(t.id).toLowerCase(); if (!k) return; (seen[k] = seen[k] || []).push(t._row); });
    Object.keys(seen).forEach((k) => { if (seen[k].length > 1) w.push(`ID trùng: ${k.toUpperCase()} (dòng ${seen[k].join(', ')})`); });
    return w;
  }
  // list/create/update responses carry the same derived fields as Code.gs (Rules.annotateTasks)
  function decorate(tasks, all) {
    const ann = Rules.annotateTasks(all, dToday(), cfgGet().priorities);
    const byId = {}; ann.forEach((t) => { byId[trim(t.id).toLowerCase()] = t; });
    return tasks.map((t) => byId[trim(t.id).toLowerCase()] || t);
  }
  const ANN_KEYS = ['childCount', 'childTotal', 'childDone', 'queuePosition', 'queueTotal', 'queueReasons', 'autoApproveDate', 'needsDiscussion', 'onHold', 'effectivePriority', 'priorityEscalated'];
  const strip = (t) => { const o = Object.assign({}, t); ANN_KEYS.forEach((k) => { delete o[k]; }); return o; };
  // parent auto-complete when its last live child is done (contract §2.2)
  function completeParents(tasks, childIds, logs) {
    const parents = new Set();
    childIds.forEach((id) => { const c = tasks.find((t) => sameName(t.id, id)); if (c && trim(c.parentId)) parents.add(trim(c.parentId)); });
    parents.forEach((pid) => {
      const pi = findIdx(tasks, pid); if (pi < 0) return;
      const parent = tasks[pi];
      const children = tasks.filter((t) => sameName(t.parentId, parent.id));
      const pc = Rules.parentCompletion(parent, children);
      const pk = Rules.normalizeStatus(parent.status);
      if (!pc.allDone || pk === 'done' || pk === 'cancelled') return;
      // Mới → Hoàn thành is outside the matrix: only the system may do it (skipTransitionCheck)
      const res = Rules.applyUpdate(parent, { status: Rules.labelOf('done') }, {}, { force: true, skipTransitionCheck: true }, ctxFor(SYSTEM_USER));
      tasks[pi] = Object.assign(strip(res.task), { _row: parent._row, sheetDeadlineWarning: parent.sheetDeadlineWarning });
      res.logs.forEach((l) => logs.push(Object.assign(entry(parent.id, DEMO_SYSTEM, l.action, l.field, l.oldValue, l.newValue, l.text || 'Tất cả đợt đã hoàn thành'))));
    });
  }

  // ---------- fake AI (deterministic, no network) ----------
  const NUM_RE = /\d+/g;
  function fakeAi(input) {
    const msg = trim(input.message);
    const answers = (input.allAnswers || []).map(trim).filter(Boolean);
    const all = [msg].concat(answers).join('\n');
    const low = Rules.stripDiacritics(all);
    const nums = (all.match(NUM_RE) || []).map(Number).filter((n) => n > 0 && n < 100000);
    const qty = nums.find((n) => n >= 1 && n <= 9999) || 0;
    const cfg = input.config;
    const needs = [];
    if (!qty) needs.push('Bạn cần bao nhiêu sản phẩm (số lượng cụ thể)?');
    if (all.length < 40) {
      needs.push('Sản phẩm sẽ được dùng ở đâu (màn hình, sự kiện, kênh nào)?');
      needs.push('Thế nào thì coi là đạt (tiêu chí nghiệm thu)?');
    }
    const name = (msg.split(/\n/)[0] || 'Yêu cầu mới').replace(/[.!?,;:\s]+$/, '').slice(0, 80);
    let size = 'M', sizeReason = 'Khối lượng vừa, khoảng 1 ngày làm.';
    const bigBatch = /\bhang loat\b/.test(low) || /\b200\b/.test(all) || (/\bbo\b/.test(low) && nums.some((n) => n >= 50));
    if (bigBatch) { size = 'XL'; sizeReason = 'Khối lượng lớn (nhiều hơn 3 ngày làm), cần chia đợt.'; }
    else if (/\bsua\b|\bfix\b|chinh mau/.test(low)) { size = 'S'; sizeReason = 'Việc chỉnh sửa nhỏ, dưới 2 giờ.'; }
    const prios = cfg.priorities || [];
    let priority = prios[2] || prios[prios.length - 1] || '';
    let priorityReason = 'Không có hạn gấp, xếp mức bình thường.';
    if (input.urgent) { priority = prios[0]; priorityReason = 'Người order đánh dấu Gấp: ' + trim(input.urgentReason).slice(0, 150); }
    else if (Rules.isValidYmd(input.deadline) && Rules.diffDays(input.deadline, input.today) <= 3) { priority = prios[1] || priority; priorityReason = 'Hạn cần trong 3 ngày tới.'; }
    const typeMap = [[/icon/, 'Icon'], [/banner/, 'Banner'], [/nhan vat|character/, 'Character'], [/\bmap\b|background|\bnen\b/, 'Background'], [/vfx|hieu ung/, 'VFX'], [/animation|\banim\b/, 'Animation'], [/avatar|khung/, 'Avatar/Frame'], [/\bnut\b|\bui\b/, 'UI Element'], [/minh hoa|illustration|key visual/, 'Illustration']];
    let assetType = '';
    for (const [re, v] of typeMap) if (re.test(low) && (cfg.assetTypes || []).some((x) => Rules.normText(x) === Rules.normText(v))) { assetType = v; break; }
    const spec = (all.match(/\d{2,5}\s*[x×]\s*\d{2,5}/) || [''])[0].replace(/\s+/g, '');
    const usageAns = answers.find((a) => /dung|cho|man hinh|su kien|fanpage|store/.test(Rules.stripDiacritics(a))) || '';
    const accAns = answers.find((a) => /dat|giong|dung|ro|chuan/.test(Rules.stripDiacritics(a)) && a !== usageAns) || '';
    const fields = {
      name, description: all.slice(0, 5000), usage: usageAns, quantity: qty || 1, outputSpec: spec,
      acceptance: accAns, assetType, deadline: Rules.isValidYmd(input.deadline) ? input.deadline : '',
    };
    let splitSuggestion = [];
    if (size === 'XL') {
      const q = qty >= 50 ? qty : 200;
      const n = Math.max(2, Math.min(10, Math.ceil(q / 50)));
      const per = Math.ceil(q / n);
      splitSuggestion = Array.from({ length: n }, (_, i) => ({ name: `Phần ${i + 1}: ${Math.min(per, q - per * i)} sản phẩm`, size: 'L' }));
    }
    const missing = ['usage', 'acceptance', 'outputSpec'].filter((k) => !trim(fields[k]));
    const status = needs.length ? 'need_info' : 'ready';
    return {
      status, questions: needs.slice(0, 3), fields, priority, priorityReason, size, sizeReason, splitSuggestion,
      summary: `${name}. Số lượng ${fields.quantity}${spec ? ', ' + spec : ''}. Cỡ ${size}: ${sizeReason}`, missing,
    };
  }
  function callAi(input) {
    if (aiMode === 'fail') throw Rules.err('AI_UNAVAILABLE', 'AI tạm thời không khả dụng (Demo: aiMode fail). Vui lòng điền form thủ công.');
    if (aiMode === 'bad_json') return '{"status": "ready", "fields": {"name": "Thiếu ngoặc';
    return JSON.stringify(fakeAi(input));
  }

  if (PARAMS.get('reset') === '1') clearAll();
  ensure();

  const session = (opts) => userFor(opts && opts.sessionToken);
  const api = {
    mode: 'demo',
    ping: () => run('ping', () => ({ sheetName: 'Demo', taskCount: tasksGet().length, serverTime: isoLocal(), version: '2.1-demo', aiEnabled: aiMode !== 'fail', googleClientId: '' })),
    googleSignIn: () => run('googleSignIn', () => { throw Rules.err('GOOGLE_DISABLED', 'Chế độ Demo không dùng đăng nhập Google — chọn tài khoản mẫu bên dưới'); }),
    requestCode: (email) => run('requestCode', () => {
      if (!Rules.isValidEmail(email)) throw Rules.err('VALIDATION', 'Gmail không hợp lệ', { fields: { email: 'Gmail không hợp lệ' } });
      return { sent: true, message: 'Nếu Gmail này có trong danh sách, mã đã được gửi. Mã có hiệu lực 10 phút.' };
    }),
    verifyCode: (email, code) => run('verifyCode', () => {
      const em = Rules.normEmail(email);
      const u = Rules.roleOf(em, cfgGet(), OWNER_EMAIL);
      if (!u || trim(code) !== DEMO_OTP) throw Rules.err('INVALID_CODE', ERR_MSG.INVALID_CODE);
      const token = (uid() + uid() + uid()).slice(0, 40);
      const exp = Date.now() + 30 * 86400000;
      const ss = sessions(); ss[token] = { email: em, exp }; store.set('va.demo.sessions', ss);
      return { sessionToken: token, expiresAt: new Date(exp).toISOString(), user: u };
    }),
    me: (opts) => run('me', () => ({ user: session(opts), aiEnabled: aiMode !== 'fail' })),
    logout: (opts) => run('logout', () => { const ss = sessions(); delete ss[trim(opts && opts.sessionToken)]; store.set('va.demo.sessions', ss); return { ok: true }; }),
    list: (opts) => run('list', () => {
      const user = session(opts);
      const tasks = tasksGet();
      let changed = false;
      tasks.forEach((t) => {
        const hasData = Rules.OWNED_KEYS.some((k) => k !== 'id' && trim(t[k]) !== '');
        if (!trim(t.id) && hasData) {
          t.id = Rules.nextId(tasks.map((x) => x.id)); changed = true;
          logAppend([entry(t.id, DEMO_SYSTEM, 'create', '', '', '', 'Cấp ID cho dòng nhập tay')]);
        }
      });
      if (changed) tasksSet(tasks);
      const cfg = cfgGet();
      const visible = Rules.visibleTasks(user, tasks);
      return { tasks: decorate(visible, tasks), meta: { serverTime: isoLocal(), sheetName: 'Demo', configVersion: cfg.version, warnings: user.role === 'va' ? warnings(tasks) : [], today: dToday() } };
    }),
    getConfig: (opts) => run('getConfig', () => { const user = session(opts); return Object.assign(Rules.sanitizeConfigFor(user, cfgGet()), { aiEnabled: aiMode !== 'fail' }); }),
    create: (input, opts) => run('create', () => {
      const user = session(opts);
      forbid(Rules.can(user, 'create', null, input));
      if (opts.clientRequestId && idem.has(opts.clientRequestId)) {
        const id = idem.get(opts.clientRequestId); const t = tasksGet().find((x) => x.id === id); if (t) return decorate([t], tasksGet())[0];
      }
      const tasks = tasksGet();
      let ai = null;
      if (opts.draftId) {
        // like Code.gs: AI size/summary come from the stored draft, never from the client; an expired draft just drops them
        const drafts = store.get('va.demo.drafts') || {};
        const d = drafts[opts.draftId];
        if (d && d.email !== Rules.normEmail(user.email)) throw Rules.err('NOT_FOUND', 'Không tìm thấy bản nháp AI');
        ai = (d && d.last) || null;
      }
      const task = Rules.buildNewTask(input, Object.assign(ctxFor(user), { aiResult: ai }), tasks.map((t) => t.id));
      tasks.push(task); tasksSet(tasks);
      if (opts.clientRequestId) idem.set(opts.clientRequestId, task.id);
      if (opts.draftId) { const drafts = store.get('va.demo.drafts') || {}; delete drafts[opts.draftId]; store.set('va.demo.drafts', drafts); }
      logAppend([entry(task.id, user.name, 'create', '', '', '', task.name)]);
      return decorate([task], tasksGet())[0];
    }),
    update: (id, changes, base, opts) => run('update', () => {
      const user = session(opts);
      const tasks = tasksGet(); const i = findIdx(tasks, id);
      if (i < 0 || !Rules.can(user, 'view', tasks[i]).ok) throw Rules.err('NOT_FOUND', 'Không tìm thấy đơn ' + id);
      const prev = tasks[i];
      const res = Rules.applyUpdate(decorate([prev], tasks)[0], changes, base, { note: opts.note, force: !!opts.force }, ctxFor(user));
      if (!res.changedKeys.length) return decorate([tasks[i]], tasks)[0];
      tasks[i] = Object.assign(strip(res.task), { sheetDeadlineWarning: prev.sheetDeadlineWarning, _row: prev._row });
      const ts = isoLocal();
      const logs = res.logs.map((l) => Object.assign({ ts, taskId: tasks[i].id, actor: user.name }, l));
      if (res.statusTo === 'done') completeParents(tasks, [tasks[i].id], logs);
      const sysCtx = ctxFor(SYSTEM_USER);
      const sysApply = (j, ch, note) => {
        const t0 = tasks[j];
        const r2 = Rules.applyUpdate(t0, ch, {}, { force: true, skipTransitionCheck: true, note }, sysCtx);
        tasks[j] = Object.assign(strip(r2.task), { _row: t0._row, sheetDeadlineWarning: t0.sheetDeadlineWarning });
        r2.logs.forEach((l) => logs.push(entry(t0.id, DEMO_SYSTEM, l.action, l.field, l.oldValue, l.newValue, l.text || note)));
      };
      let meta = null;
      // like Code.gs: cancelling a split parent cancels its unstarted children (Hệ thống), keeps started ones
      if (res.statusTo === 'cancelled') {
        const kids = tasks.filter((x) => sameName(x.parentId, tasks[i].id));
        if (kids.length) {
          const plan = Rules.parentCancelCascade(tasks[i], kids);
          (plan.cancel || []).forEach((cid) => { const j = findIdx(tasks, cid); if (j >= 0) sysApply(j, { status: Rules.labelOf('cancelled') }, plan.note); });
          meta = { cascade: { cancelled: plan.cancel || [], kept: plan.kept || [] } };
        }
      }
      // reopening a done child (→ Cần sửa) moves a completed parent back to Mới
      if (res.statusTo === 'changes_requested' && trim(tasks[i].parentId)) {
        const pj = findIdx(tasks, tasks[i].parentId);
        if (pj >= 0) {
          const plan = Rules.parentReopenPlan(tasks[pj], tasks[i], res.statusFrom, res.statusTo);
          if (plan) sysApply(pj, { status: plan.status }, plan.note);
        }
      }
      tasksSet(tasks);
      logAppend(logs);
      const out = decorate([tasks[i]], tasks)[0];
      if (meta) out._meta = meta;
      return out;
    }),
    remove: (id, opts) => run('remove', () => {
      const user = session(opts);
      const tasks = tasksGet(); const i = findIdx(tasks, id);
      if (i < 0) throw Rules.err('NOT_FOUND', 'Không tìm thấy đơn ' + id);
      forbid(Rules.can(user, 'delete', tasks[i]));
      const t = tasks[i]; const snap = {};
      Rules.OWNED_KEYS.forEach((k) => { snap[Rules.HEADERS[k] || k] = t[k] == null ? '' : t[k]; });
      tasks.splice(i, 1); tasksSet(tasks);
      logAppend([entry(t.id, user.name, 'delete', '', '', '', JSON.stringify(snap))]);
      return { id: t.id };
    }),
    addComment: (id, text, opts) => run('addComment', () => {
      const user = session(opts);
      const tx = trim(text);
      if (!tx || tx.length > 5000) throw Rules.err('VALIDATION', 'Dữ liệu không hợp lệ: Bình luận cần 1–5000 ký tự', { fields: { text: 'Bình luận cần 1–5000 ký tự' } });
      const t = tasksGet().find((x) => sameName(x.id, id));
      if (!t || !Rules.can(user, 'view', t).ok) throw Rules.err('NOT_FOUND', 'Không tìm thấy đơn ' + id);
      forbid(Rules.can(user, 'comment', t));
      const e = entry(t.id, user.name, 'comment', '', '', '', tx);
      logAppend([e]);
      return e;
    }),
    getLog: (id, opts) => run('getLog', () => {
      const user = session(opts);
      const t = tasksGet().find((x) => sameName(x.id, id));
      if (!t || !Rules.can(user, 'view', t).ok) throw Rules.err('NOT_FOUND', 'Không tìm thấy đơn ' + id);
      return logGet().filter((l) => sameName(l.taskId, id)).reverse().slice(0, 200);
    }),
    saveConfig: (config, opts) => run('saveConfig', () => {
      const user = session(opts);
      forbid(Rules.can(user, 'saveConfig', null));
      const cur = cfgGet();
      if (Number(opts.baseVersion) !== Number(cur.version)) throw Rules.err('CONFLICT', 'Dữ liệu đã thay đổi trên Google Sheet', { fields: ['version'], current: cur });
      const next = Rules.mergeConfig(config);
      const msg = Rules.validateConfig(next);
      if (msg) throw Rules.err('VALIDATION', msg, { fields: { config: msg } });
      next.version = Number(cur.version) + 1; next.updatedAt = isoLocal();
      store.set('va.demo.config', next);
      logAppend([entry('', user.name, 'config', '', '', '', 'Cập nhật danh mục')]);
      return Object.assign(clone(next), { aiEnabled: aiMode !== 'fail' });
    }),
    split: (id, parts, opts) => run('split', () => {
      const user = session(opts);
      const tasks = tasksGet(); const i = findIdx(tasks, id);
      if (i < 0) throw Rules.err('NOT_FOUND', 'Không tìm thấy đơn ' + id);
      const parent = decorate([tasks[i]], tasks)[0];
      forbid(Rules.can(user, 'split', parent));
      const children = Rules.planSplit(parent, parts, ctxFor(user), tasks.map((t) => t.id));
      children.forEach((c) => tasks.push(c));
      tasksSet(tasks);
      const logs = [entry(parent.id, user.name, 'split', '', '', '', 'Chia ' + children.length + ' đợt: ' + children.map((c) => c.id).join(', '))];
      children.forEach((c) => logs.push(entry(c.id, user.name, 'create', '', '', '', c.name)));
      logAppend(logs);
      const all = tasksGet();
      return { parent: decorate([all.find((t) => sameName(t.id, parent.id))], all)[0], children: decorate(children.map((c) => all.find((t) => sameName(t.id, c.id))), all) };
    }),
    aiIntake: (body, opts) => run('aiIntake', () => {
      const user = session(opts);
      forbid(Rules.can(user, 'create', null));
      const cfg = cfgGet();
      const em = Rules.normEmail(user.email);
      const counts = store.get('va.demo.aiCount') || {};
      const ck = em + '|' + dToday();
      if ((counts[ck] || 0) >= 30) throw Rules.err('AI_UNAVAILABLE', 'Bạn đã dùng hết 30 lượt AI hôm nay. Vui lòng điền form thủ công.');
      counts[ck] = (counts[ck] || 0) + 1; store.set('va.demo.aiCount', counts);
      const drafts = store.get('va.demo.drafts') || {};
      let draftId = trim(body.draftId);
      let d;
      if (draftId) {
        d = drafts[draftId];
        if (!d || d.email !== em) throw Rules.err('NOT_FOUND', 'Không tìm thấy bản nháp AI');
      } else {
        draftId = 'd' + uid(); d = { email: em, rounds: 0, history: [], last: null, message: trim(body.message), answers: [] };
        if (!trim(body.message)) throw Rules.err('VALIDATION', 'Dữ liệu không hợp lệ: Cần mô tả yêu cầu', { fields: { message: 'Cần mô tả yêu cầu' } });
      }
      d.rounds += 1;
      const answers = (body.answers || []).map(trim);
      if (answers.length) d.answers = d.answers.concat(answers);
      const ctx = { today: dToday(), urgent: !!body.urgent, round: d.rounds, maxRounds: Rules.MAX_AI_ROUNDS || 3 };
      const aiInput = { message: d.rounds === 1 ? d.message : trim(body.message), answers, project: body.project, team: user.team || '', urgent: !!body.urgent, urgentReason: body.urgentReason, briefLink: body.briefLink, deadline: body.deadline };
      const messages = Rules.buildAiMessages(aiInput, cfg, Object.assign({ history: d.history, lastQuestions: d.last ? d.last.questions : [] }, ctx));
      const fakeInput = { message: d.message, allAnswers: d.answers, urgent: !!body.urgent, urgentReason: body.urgentReason, deadline: body.deadline, today: dToday(), config: cfg };
      let result = null;
      for (let attempt = 0; attempt < 2 && !result; attempt++) {
        const text = callAi(fakeInput, messages);
        let raw;
        try { raw = Rules.parseAiJson(text); } catch (e) { continue; }
        try { result = Rules.sanitizeAiResult(raw, cfg, ctx); } catch (e) { result = null; }
      }
      if (!result) throw Rules.err('AI_UNAVAILABLE', 'AI trả kết quả không hợp lệ. Vui lòng thử lại hoặc điền form thủ công.');
      d.history = (d.history || []).concat([{ role: 'user', content: messages[messages.length - 1].content }, { role: 'assistant', content: JSON.stringify(result) }]).slice(-12);
      d.last = result;
      drafts[draftId] = d; store.set('va.demo.drafts', drafts);
      return { draftId, status: result.status, round: d.rounds, questions: result.questions || [], result };
    }),
    aiAssist: (body, opts) => run('aiAssist', () => {
      const user = session(opts);
      forbid(Rules.can(user, 'aiAssist'));
      const mode = (Rules.ASSIST_MODES || []).indexOf(body.mode) >= 0 ? body.mode : 'ask';
      const q = trim(body.question);
      if (mode === 'ask' && q.length < 3) throw Rules.err('VALIDATION', 'Dữ liệu không hợp lệ: Hãy nhập câu hỏi', { fields: { question: 'Hãy nhập câu hỏi' } });
      if (aiMode === 'fail') throw Rules.err('AI_UNAVAILABLE', 'AI tạm thời không khả dụng, vui lòng thử lại sau');
      const cfg = cfgGet(); const tasks = tasksGet(); const day = dToday();
      const owner = null;   // AI chỉ phân việc cho VA trong danh sách thành viên
      const snap = Rules.assistSnapshot(tasks, cfg, day, owner);
      const stats = mode === 'weekly' ? Rules.weeklyStats(tasks, cfg, day, owner) : null;
      Rules.buildAssistMessages(mode, q, snap, stats);
      const out = Rules.sanitizeAssist(fakeAssist(mode, q, snap, stats || Rules.weeklyStats(tasks, cfg, day, owner)), snap);
      out.mode = mode; out.generatedAt = isoLocal();
      if (stats) out.stats = stats;
      return out;
    }),
    buddyChat: (body, opts) => run('buddyChat', () => {
      const user = session(opts);
      forbid(Rules.can(user, 'buddyChat'));
      if (aiMode === 'fail') throw Rules.err('AI_UNAVAILABLE', 'AI tạm thời không khả dụng, vui lòng thử lại sau');
      const hist = Array.isArray(body.history) ? body.history : [];
      Rules.buildBuddyMessages(hist, { summary: body.summary, time: body.time, name: user.name });
      // Demo: không gọi DeepSeek — trả câu viết sẵn + cảm xúc ngẫu nhiên để thử giao diện
      // Demo: đoán cảm xúc bằng từ khóa trong tin mới nhất (bản thật để DeepSeek tự đọc cảm xúc)
      const last = Rules.normText((hist[hist.length - 1] || {}).text).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd');
      const KW = [['gian', /ngu|dot|xau|ghet|cut|im di|cho chet|bat nat/], ['met', /met|ot|buon ngu|deadline|qua tai|luoi|duoi/],
        ['buon', /buon|chan|that vong|bi tra|chua dat|khoc|tui than/], ['vui', /vui|xong|dat roi|cam on|tuyet|gioi|hay qua|yeah|dinh/]];
      const hit = KW.find(([, re]) => re.test(last));
      const mood = hit ? hit[0] : 'che';
      const text = { vui: 'Đỉnh nóc kịch trần luôn sếp ơi 🎉', buon: 'Thôi mà, có Cún đây, buồn xíu rồi thôi nha', gian: 'Ủa nói vậy là Cún giận á nha 😤',
        met: 'Mệt thì nghỉ xíu đi sếp, việc để Cún canh', che: 'Hmm… câu này Cún xin phép cà khịa nhẹ 🙄' }[mood] + ' (demo)';
      return Rules.sanitizeBuddy({ text, mood });
    }),
    adminGet: (opts) => run('adminGet', () => { forbid(Rules.can(session(opts), 'admin')); return adminView(); }),
    adminSave: (body, opts) => run('adminSave', () => {
      forbid(Rules.can(session(opts), 'admin'));
      const a = store.get('va.demo.admin') || {};
      const fields = {};
      if ('deepseekKey' in body && trim(body.deepseekKey) && !/^sk-[A-Za-z0-9_\-]{16,200}$/.test(trim(body.deepseekKey))) fields.deepseekKey = 'API key DeepSeek có dạng sk-…';
      if ('googleClientId' in body && trim(body.googleClientId) && !/^[0-9]+-[a-z0-9]+\.apps\.googleusercontent\.com$/.test(trim(body.googleClientId))) fields.googleClientId = 'Client ID có dạng 1234-abc.apps.googleusercontent.com';
      if ('appUrl' in body && trim(body.appUrl) && !/^https:\/\/\S{3,300}$/.test(trim(body.appUrl))) fields.appUrl = 'Link app phải bắt đầu bằng https://';
      if (Object.keys(fields).length) throw Rules.err('VALIDATION', 'Dữ liệu không hợp lệ: ' + Rules.firstMessage(fields), { fields });
      ['deepseekKey', 'googleClientId', 'appUrl'].forEach((k) => { if (k in body) a[k] = trim(body[k]); });
      if ('weeklyReport' in body) a.weeklyReport = body.weeklyReport !== false;
      store.set('va.demo.admin', a);
      return adminView();
    }),
    adminTestAi: (opts) => run('adminTestAi', () => {
      forbid(Rules.can(session(opts), 'admin'));
      if (!trim((store.get('va.demo.admin') || {}).deepseekKey)) throw Rules.err('AI_UNAVAILABLE', 'Chưa có API key DeepSeek');
      return { ok: true, message: 'Kết nối DeepSeek hoạt động (Demo: không gọi mạng)' };
    }),
  };
  function adminView() {
    const a = store.get('va.demo.admin') || {};
    const k = trim(a.deepseekKey);
    return { ownerEmail: OWNER_EMAIL, deepseekKeySet: !!k, deepseekKeyMasked: k ? k.slice(0, 3) + '••••' + k.slice(-4) : '',
      googleClientId: trim(a.googleClientId), appUrl: trim(a.appUrl), weeklyReport: a.weeklyReport !== false, version: '2.1-demo' };
  }
  // Demo AI trợ lý: mô phỏng xác định (không gọi mạng) — cân tải theo độ nặng, hạn gần làm trước.
  function fakeAssist(mode, q, snap, stats) {
    const W = { S: 1, M: 2, L: 4, XL: 8, '?': 2 };
    const vas = snap.vaNames.slice();
    const load = {}; vas.forEach((n) => { load[n] = 0; });
    const st = (t) => t.status;
    const active = snap.tasks.filter((t) => [Rules.labelOf('in_progress'), Rules.labelOf('changes_requested')].indexOf(st(t)) >= 0);
    active.forEach((t) => { if (t.assignee in load) load[t.assignee] += W[t.size] || 2; });
    const work = snap.tasks.filter((t) => !t.onHold && [Rules.labelOf('new'), Rules.labelOf('in_progress'), Rules.labelOf('changes_requested')].indexOf(st(t)) >= 0);
    work.sort((a, b) => (st(a) === Rules.labelOf('changes_requested') ? -1 : 0) - (st(b) === Rules.labelOf('changes_requested') ? -1 : 0)
      || (a.deadline || '9999') .localeCompare(b.deadline || '9999') || (a.queuePos || 99) - (b.queuePos || 99));
    const days = {}; vas.forEach((n) => { days[n] = 0; });
    const plan = work.slice(0, 20).map((t) => {
      let who = t.assignee && t.assignee in load ? t.assignee : vas.slice().sort((x, y) => load[x] - load[y])[0] || '';
      if (!t.assignee && who) load[who] += W[t.size] || 2;
      const need = Math.max(1, Math.ceil((W[t.size] || 2) / 2));
      days[who] = (days[who] || 0) + need;
      const eta = Rules.addBusinessDays(snap.today, days[who]);
      const late = t.deadline && eta > t.deadline;
      return { id: t.id, assignee: who, eta, reason: (t.assignee ? 'Đang làm dở' : 'Người đang nhẹ việc hơn') + (t.deadline ? ' · hạn ' + Rules.ymdToDm(t.deadline) : '') + (late ? ' · có thể trễ' : '') };
    });
    const risks = plan.filter((p) => { const t = snap.tasks.find((x) => x.id === p.id); return t && t.deadline && p.eta > t.deadline; })
      .map((p) => ({ id: p.id, level: 'high', text: 'Dự kiến xong ' + Rules.ymdToDm(p.eta) + ', sau hạn. Cân nhắc chia đợt hoặc báo người order dời hạn.' }));
    (stats.overdue || []).forEach((o) => { if (!risks.some((r) => r.id === o.id)) risks.push({ id: o.id, level: 'high', text: 'Đã trễ ' + o.days + ' ngày.' }); });
    const loadLine = vas.map((n) => n + ': ' + load[n] + ' điểm tải').join(' · ');
    if (mode === 'weekly') return { answer: 'Tóm tắt tuần (Demo)\n' + Rules.weeklyReportText(stats) + '\n\nĐề xuất tuần tới\n- Ưu tiên xử lý đơn trễ / sắp đến hạn trước.\n- Cân lại tải: ' + loadLine, plan: [], risks };
    if (mode === 'plan') return { answer: 'Kế hoạch ' + plan.length + ' đơn cho ' + vas.length + ' VA (Demo).\n- Đơn Cần sửa làm trước, sau đó theo hạn và vị trí hàng đợi.\n- Đơn mới giao cho người đang nhẹ việc hơn.\n- Tải hiện tại: ' + loadLine, plan, risks };
    const lq = Rules.normText(q);
    if (/tre|han|rui ro/.test(Rules.stripDiacritics(lq))) return { answer: risks.length ? 'Có ' + risks.length + ' đơn cần chú ý về hạn:\n' + risks.map((r) => '- ' + r.id + ': ' + r.text).join('\n') : 'Hiện không có đơn nào có nguy cơ trễ hạn.', plan: [], risks };
    return { answer: 'Hàng đợi có ' + (stats.queue || 0) + ' đơn chờ, ' + (stats.inProgress || 0) + ' đang làm, ' + (stats.review || 0) + ' chờ duyệt.\n- Nên làm tiếp: ' + (plan[0] ? plan[0].id + ' (' + (snap.tasks.find((t) => t.id === plan[0].id) || {}).name + ')' : 'không có') + '\n- Tải: ' + loadLine + '\n(Demo: câu trả lời mô phỏng, không gọi DeepSeek.)', plan: [], risks };
  }
  function runDailyJob(ymd) {
    const day = Rules.isValidYmd(ymd) ? ymd : dToday();
    const tasks = tasksGet();
    const rem = store.get('va.demo.reminders') || {};
    const logs = []; const approved = []; const reminded = [];
    tasks.forEach((t, i) => {
      const k = Rules.normalizeStatus(t.status);
      if (k !== 'review') { delete rem[t.id]; return; }
      const st = Rules.autoApproveState(t, day);
      if (st === 'approve') {
        const res = Rules.applyUpdate(t, { status: Rules.labelOf('done') }, {}, { force: true }, Object.assign(ctxFor(SYSTEM_USER), { today: day, todayDmy: Rules.ymdToDmy(day) }));
        tasks[i] = Object.assign(strip(res.task), { _row: t._row, sheetDeadlineWarning: t.sheetDeadlineWarning });
        res.logs.forEach((l) => logs.push(entry(t.id, DEMO_SYSTEM, l.action, l.field, l.oldValue, l.newValue, l.text || 'Tự duyệt sau 3 ngày làm việc')));
        logs.push(entry(t.id, DEMO_SYSTEM, 'mail', '', '', '', 'Email tự duyệt → ' + (t.assignee || 'VA')));
        approved.push(t.id); delete rem[t.id];
      } else if (st === 'remind' && rem[t.id] !== t.reviewDate) {
        rem[t.id] = t.reviewDate; reminded.push(t.id);
        logs.push(entry(t.id, DEMO_SYSTEM, 'remind', '', '', '', 'Đã gửi email nhắc người order duyệt'));
      }
    });
    if (approved.length) completeParents(tasks, approved, logs);
    tasksSet(tasks); logAppend(logs); store.set('va.demo.reminders', rem);
    return { date: day, approved, reminded };
  }
  const ACTIONS = Object.keys(api).filter((k) => k !== 'mode');
  window.__vaDemo = {
    failNext(action, code = 'NETWORK') { if (ACTIONS.indexOf(action) < 0) throw new Error('Unknown action ' + action); failMap[action] = code; },
    externalEdit(id, fields) {
      const tasks = tasksGet(); const i = findIdx(tasks, id); if (i < 0) return null;
      Object.assign(tasks[i], fields || {}); tasksSet(tasks); return clone(tasks[i]);
    },
    reset() { clearAll(); seed(); idem.clear(); aiMode = 'ok'; App.logoutLocal(); },
    today(ymd) { if (ymd !== undefined) { demoTodayOverride = Rules.isValidYmd(ymd) ? ymd : null; } return dToday(); },
    refresh() { return App.syncNow(); },
    aiMode(m) { if (m !== undefined) { if (['ok', 'fail', 'bad_json'].indexOf(m) < 0) throw new Error('aiMode: ok | fail | bad_json'); aiMode = m; } return aiMode; },
    ai(input) { const cfg = cfgGet(); return fakeAi(Object.assign({ message: '', allAnswers: [], today: dToday(), config: cfg }, typeof input === 'string' ? { message: input } : input || {})); },
    runDailyJob(ymd) { const r = runDailyJob(ymd); App.syncNow(); return r; },
    accounts() {
      const list = cfgGet().members.filter((m) => m.active !== false && trim(m.email)).map((m) => ({ name: m.name, email: m.email, role: m.isArtist ? 'va' : 'requester' }));
      if (!list.some((a) => Rules.normEmail(a.email) === OWNER_EMAIL)) list.push({ name: 'Quản trị viên', email: OWNER_EMAIL, role: 'va', isOwner: true });
      return list;
    },
    otp: DEMO_OTP,
  };
  api._reseed = () => { clearAll(); seed(); idem.clear(); };
  api._hook = window.__vaDemo;
  api._accounts = () => window.__vaDemo.accounts();
  return api;
}

// ============================================================================
// Remote adapter (Google Apps Script) — every data action is a text/plain POST
// ============================================================================
function createRemoteApi(url) {
  async function req(method, body) {
    const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; if (ctrl) ctrl.abort(); }, 45000);
    try {
      let res;
      if (method === 'GET') {
        const u = new URL(url);
        u.searchParams.set('action', 'ping');
        res = await fetch(u.toString(), { method: 'GET', redirect: 'follow', signal: ctrl && ctrl.signal });
      } else {
        res = await fetch(url, { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'text/plain;charset=utf-8' }, redirect: 'follow', signal: ctrl && ctrl.signal });
      }
      if (!res.ok) throw new ApiError('NETWORK', ERR_MSG.NETWORK + ' (HTTP ' + res.status + ')');
      let j;
      try { j = await res.json(); } catch (e) { throw new ApiError('NETWORK', ERR_MSG.NETWORK + ' (phản hồi không phải JSON)'); }
      if (!j || j.ok !== true) {
        const er = (j && j.error) || {};
        throw new ApiError(er.code || 'INTERNAL', er.message || ERR_MSG[er.code] || 'Lỗi máy chủ', er.details);
      }
      return j;
    } catch (e) {
      if (e instanceof ApiError) throw e;
      if (timedOut) throw new ApiError('TIMEOUT', ERR_MSG.TIMEOUT);
      throw new ApiError('NETWORK', ERR_MSG.NETWORK);
    } finally { clearTimeout(timer); }
  }
  // the token is only ever attached when this adapter's URL is exactly the one that issued the session
  const tokenFor = (opts) => {
    const tok = (opts && opts.sessionToken) || '';
    if (!tok) return '';
    const s = LS.get(SESSION_KEY, null);
    if (!s || s.token !== tok || s.apiUrl !== url) { clearSession(); return ''; }
    return tok;
  };
  const post = async (action, opts, extra) => req('POST', Object.assign({ action, sessionToken: tokenFor(opts) }, extra || {}));
  return {
    mode: 'remote',
    ping: async () => (await req('GET')).data,
    requestCode: async (email) => (await post('requestCode', null, { email })).data,
    verifyCode: async (email, code) => (await post('verifyCode', null, { email, code })).data,
    me: async (opts) => (await post('me', opts)).data,
    logout: async (opts) => (await post('logout', opts)).data,
    list: async (opts) => { const j = await post('list', opts); return { tasks: (j.data && j.data.tasks) || [], meta: j.meta || (j.data && j.data.meta) || { warnings: [] } }; },
    getConfig: async (opts) => (await post('getConfig', opts)).data,
    create: async (task, opts) => (await post('create', opts, { task, clientRequestId: opts.clientRequestId, draftId: opts.draftId || undefined })).data,
    update: async (id, changes, base, opts) => {
      const j = await post('update', opts, { id, changes, base, note: opts.note || undefined, force: opts.force || undefined });
      const d = j.data;
      if (d && j.meta && typeof d === 'object') d._meta = j.meta;   // e.g. meta.cascade after cancelling a split parent
      return d;
    },
    remove: async (id, opts) => (await post('delete', opts, { id })).data,
    addComment: async (id, text, opts) => (await post('addComment', opts, { id, text })).data,
    getLog: async (id, opts) => (await post('log', opts, { id })).data || [],
    saveConfig: async (config, opts) => (await post('saveConfig', opts, { config, baseVersion: opts.baseVersion })).data,
    split: async (id, parts, opts) => (await post('split', opts, { id, parts })).data,
    aiIntake: async (body, opts) => (await post('aiIntake', opts, body)).data,
    googleSignIn: async (idToken) => (await post('googleSignIn', null, { idToken })).data,
    aiAssist: async (body, opts) => (await post('aiAssist', opts, body)).data,
    buddyChat: async (body, opts) => (await post('buddyChat', opts, body)).data,
    adminGet: async (opts) => (await post('adminGet', opts)).data,
    adminSave: async (body, opts) => (await post('adminSave', opts, body)).data,
    adminTestAi: async (opts) => (await post('adminTestAi', opts)).data,
  };
}

// ============================================================================
// State
// ============================================================================
const S = {
  mode: 'demo',
  api: null,
  session: null,
  user: null,
  aiEnabled: null,
  tasks: [],
  config: Rules.mergeConfig({}),
  meta: { warnings: [] },
  loaded: false,
  loadError: null,
  stale: false,
  sync: { state: 'syncing', lastAt: 0, error: null },
  pending: new Set(),
  online: navigator.onLine !== false,
  view: 'queue',
  settingsTab: 'general',
  prefs: null,
  selectedId: null,
  logCache: new Map(),
  collapsed: { cancelled: true },
  groupCollapsed: {},
  qi: {},
};
const auth = () => ({ sessionToken: S.session && S.session.apiUrl === sessionScope(S.mode) ? S.session.token : '' });

const DEFAULT_PREFS = () => ({ qf: 'all', q: '', filters: { status: [], team: [], project: [], assetType: [], priority: [], size: [], assignee: [], requester: [] }, hideClosed: true, sortKey: '', sortDir: 'asc', groupBy: '' });
const FILTER_KEYS = ['status', 'team', 'project', 'assetType', 'priority', 'size', 'assignee', 'requester'];
const QUICK_FILTERS = [
  { key: 'all', label: 'Tất cả' }, { key: 'mine', label: 'Việc của tôi' }, { key: 'queue', label: 'Trong hàng' },
  { key: 'review', label: 'Chờ duyệt' }, { key: 'changes', label: 'Cần sửa' }, { key: 'overdue', label: 'Quá hạn' },
  { key: 'hold', label: 'Tạm dừng' }, { key: 'discuss', label: 'Cần thảo luận' },
];
function loadPrefs() {
  const p = DEFAULT_PREFS();
  const saved = LS.get('va.ui.listPrefs.v2', null);
  if (saved && typeof saved === 'object') {
    Object.assign(p, saved);
    p.filters = Object.assign(DEFAULT_PREFS().filters, saved.filters || {});
    if (!QUICK_FILTERS.some((f) => f.key === p.qf)) p.qf = 'all';
  }
  return p;
}
function savePrefs() { LS.set('va.ui.listPrefs.v2', S.prefs); }
function prefsToQuery(p) {
  const q = new URLSearchParams();
  if (p.q) q.set('q', p.q);
  if (p.qf && p.qf !== 'all') q.set('qf', p.qf);
  FILTER_KEYS.forEach((k) => { if (p.filters[k].length) q.set(k, p.filters[k].join(',')); });
  if (!p.hideClosed) q.set('closed', '1');
  if (p.sortKey) { q.set('sort', p.sortKey); q.set('dir', p.sortDir); }
  if (p.groupBy) q.set('group', p.groupBy);
  return q.toString();
}
function prefsFromQuery(qs) {
  const q = new URLSearchParams(qs);
  const p = DEFAULT_PREFS();
  p.q = q.get('q') || '';
  p.qf = QUICK_FILTERS.some((f) => f.key === q.get('qf')) ? q.get('qf') : 'all';
  FILTER_KEYS.forEach((k) => { const v = q.get(k); p.filters[k] = v ? v.split(',').filter(Boolean) : []; });
  p.hideClosed = q.get('closed') !== '1';
  p.sortKey = q.get('sort') || '';
  p.sortDir = q.get('dir') === 'desc' ? 'desc' : 'asc';
  p.groupBy = q.get('group') || '';
  return p;
}

// ----- roles & permissions (always through Rules) -----
const me = () => S.user;
const myName = () => (S.user ? S.user.name : '');
const isVA = () => !!(S.user && S.user.role === 'va');
// "Nhận làm" gán người làm = chính mình → chỉ thành viên VA (isArtist) mới nhận được; máy chủ cũng chặn y như vậy.
const isVAMember = () => !!S.user && (S.config.members || []).some((m) => m.isArtist && m.active !== false && sameName(m.name, S.user.name));
const claimBlocked = (t) => !!t && statusKey(t) === 'new' && !trim(t.assignee) && !isVAMember();
const CLAIM_BLOCK_REASON = 'Chỉ thành viên VA mới nhận làm được';
function can(action, task, changes) {
  if (!S.user) return { ok: false, reason: 'Chưa đăng nhập' };
  if (action === 'transition:in_progress' && claimBlocked(task)) return { ok: false, reason: CLAIM_BLOCK_REASON };
  try { return Rules.can(S.user, action, task || null, changes) || { ok: false, reason: '' }; } catch (e) { return { ok: false, reason: e.message }; }
}
// "Nhận làm" on an XL order in Mới opens the split dialog (Rules.can denies the claim itself)
function claimViaSplit(t) { return !!t && statusKey(t) === 'new' && trim(t.size) === 'XL' && can('split', t).ok; }
function allowedTo(t) {
  if (!S.user || !t || t._tmp) return [];
  let list; try { list = Rules.allowedTransitions(S.user, t) || []; } catch (e) { return []; }
  return claimBlocked(t) ? list.filter((k) => k !== 'in_progress') : list;
}

// ----- selectors -----
const getTask = (id) => S.tasks.find((t) => sameName(t.id, id)) || null;
const statusKey = (t) => Rules.normalizeStatus(t.status);
const isLegacy = (k) => k === 'legacy_assigned' || k === 'legacy_on_hold';
// key used for columns / colours: legacy rows and unknown labels sit with "Mới"
const colKey = (t) => { const k = statusKey(t); return (isLegacy(k) || k === 'unknown') ? 'new' : k; };
const dlState = (t) => Rules.deadlineState(t, today(), S.config.dueSoonDays);
const isMine = (t) => sameName(t.assignee, myName());
const isOwnOrder = (t) => !!S.user && Rules.normEmail(t.requesterEmail) !== '' && Rules.normEmail(t.requesterEmail) === Rules.normEmail(S.user.email);
const members = () => S.config.members || [];
const memberOf = (name) => members().find((m) => sameName(m.name, name));
const onHold = (t) => Rules.isOnHold(t);
const discuss = (t) => Rules.needsDiscussion(t);
const childrenOf = (t) => S.tasks.filter((x) => trim(x.parentId) && sameName(x.parentId, t.id));
const isSplitParent = (t) => Number(t.childCount) > 0 || childrenOf(t).length > 0;
// {total, done} of a split parent — from local children when we can see them, else server-annotated counts
function splitProgress(t) {
  const kids = childrenOf(t);
  if (kids.length) return Rules.parentCompletion(t, kids);
  if (Number(t.childCount) > 0) return { total: Number(t.childTotal) || 0, done: Number(t.childDone) || 0, allDone: false };
  return null;
}
function priorityIndex(p) { const i = (S.config.priorities || []).findIndex((x) => sameName(x, p)); return i < 0 ? 99 : i; }
function prColorIdx(i) { return i === 0 ? 'var(--pr-1)' : i === 1 ? 'var(--pr-2)' : i === 2 ? 'var(--pr-3)' : 'var(--pr-4)'; }
function priorityColor(p) { return prColorIdx(priorityIndex(p)); }
function defaultPriority() { const p = S.config.priorities || []; return p.length >= 3 ? p[2] : p[p.length - 1] || ''; }
const idNum = (id) => { const m = /^AI-(\d+)$/i.exec(trim(id)); return m ? parseInt(m[1], 10) : Number.MAX_SAFE_INTEGER; };
function effPrio(t) {
  try { return Rules.effectivePriority(t, today(), S.config.priorities) || { index: priorityIndex(t.priority), label: t.priority, escalated: false }; }
  catch (e) { return { index: priorityIndex(t.priority), label: t.priority, escalated: false }; }
}
function queueInfoOf(t) {
  if (isVA()) { const q = S.qi[t.id]; if (q) return q; }
  if (t.queuePosition) return { position: t.queuePosition, total: t.queueTotal, reasons: t.queueReasons || [] };
  return null;
}
function recomputeQueue() {
  try { S.qi = isVA() ? (Rules.queueInfo(S.tasks.filter((t) => !t._tmp), today(), S.config.priorities) || {}) : {}; } catch (e) { S.qi = {}; }
}
function autoApproveOn(t) { try { return Rules.autoApproveDate(t) || ''; } catch (e) { return ''; } }
// AI split suggestion: the server stores it as the last line of aiSummary,
// "Gợi ý chia đợt (AI): name [L]; name [M]" (older orders may carry it in the description).
function splitSuggestionOf(t) {
  if (Array.isArray(t.splitSuggestion) && t.splitSuggestion.length) return t.splitSuggestion;
  const m = /Gợi ý chia đợt(?: \(AI\))?:\s*(.+)$/m.exec(trim(t.description) + '\n' + trim(t.aiSummary));
  if (!m) return [];
  return m[1].split(/;\s*/).map((s) => {
    const mm = /^(?:Đợt\s*\d+\/\d+\s*[—–-]\s*)?(.*?)\s*(?:\[(S|M|L)\])?$/.exec(trim(s));
    return mm ? { name: trim(mm[1]), size: mm[2] || 'M' } : null;
  }).filter((x) => x && x.name).slice(0, 10);
}

function matchesQuick(t, qf) {
  const k = statusKey(t); const ck = colKey(t); const open = Rules.isOpenKey(k);
  switch (qf) {
    case 'mine': return open && isMine(t);
    case 'queue': return ck === 'new';
    case 'review': return k === 'review';
    case 'changes': return k === 'changes_requested';
    case 'overdue': return open && dlState(t).state === 'overdue';
    case 'hold': return open && onHold(t);
    case 'discuss': return open && discuss(t);
    default: return true;
  }
}
function matchesSearch(t, q) {
  const toks = Rules.stripDiacritics(q).split(/\s+/).filter(Boolean);
  if (!toks.length) return true;
  const hay = Rules.stripDiacritics([t.id, t.name, t.description, t.usage, t.notes, t.requester, t.assignee, t.project, t.requesterEmail].join(' \u0001 '));
  return toks.every((x) => hay.indexOf(x) >= 0);
}
function matchesFilters(t, f) {
  for (const k of FILTER_KEYS) {
    const sel = f[k]; if (!sel || !sel.length) continue;
    if (k === 'status') { if (sel.indexOf(colKey(t)) < 0) return false; }
    else if (k === 'assignee') { const a = trim(t.assignee); if (!sel.some((v) => (v === '__none__' ? !a : sameName(v, a)))) return false; }
    else if (k === 'size') { const s = trim(t.size); if (!sel.some((v) => (v === '__none__' ? !s : v === s))) return false; }
    else { const v = trim(t[k]); if (!sel.some((x) => sameName(x, v) || (x === '' && !v))) return false; }
  }
  return true;
}
function filterTasks(p, opts = {}) {
  return S.tasks.filter((t) => {
    if (!opts.ignoreQf && !matchesQuick(t, p.qf)) return false;
    if (!matchesFilters(t, p.filters)) return false;
    if (!matchesSearch(t, p.q)) return false;
    if (!opts.board && p.hideClosed) {
      const k = statusKey(t);
      if (!Rules.isOpenKey(k) && p.filters.status.indexOf(k) < 0) return false;
    }
    return true;
  });
}
const URGENCY = { overdue: 0, dueSoon: 1, ok: 2, none: 3, done: 4, cancelled: 5 };
function cmpDeadline(a, b) {
  const da = trim(a.deadline), db = trim(b.deadline);
  const va = Rules.isValidYmd(da), vb = Rules.isValidYmd(db);
  if (va && vb) return da < db ? -1 : da > db ? 1 : 0;
  if (va) return -1; if (vb) return 1; return 0;
}
const SIZE_ORDER = { S: 0, M: 1, L: 2, XL: 3 };
const STATUS_ORDER = ['new', 'in_progress', 'review', 'changes_requested', 'done', 'cancelled'];
function sortTasks(list, key, dir) {
  const arr = list.slice();
  const m = dir === 'desc' ? -1 : 1;
  const byId = (a, b) => idNum(a.id) - idNum(b.id) || String(a.id).localeCompare(String(b.id));
  const str = (f) => (a, b) => trim(a[f]).localeCompare(trim(b[f]), 'vi', { sensitivity: 'base' });
  let cmp;
  switch (key) {
    case 'id': cmp = byId; break;
    case 'name': cmp = str('name'); break;
    case 'priority': cmp = (a, b) => effPrio(a).index - effPrio(b).index; break;
    case 'size': cmp = (a, b) => (trim(a.size) in SIZE_ORDER ? SIZE_ORDER[trim(a.size)] : 9) - (trim(b.size) in SIZE_ORDER ? SIZE_ORDER[trim(b.size)] : 9); break;
    case 'requester': cmp = str('requester'); break;
    case 'assignee': cmp = str('assignee'); break;
    case 'deadline': cmp = cmpDeadline; break;
    case 'status': cmp = (a, b) => STATUS_ORDER.indexOf(colKey(a)) - STATUS_ORDER.indexOf(colKey(b)); break;
    case 'revisionCount': cmp = (a, b) => (Number(a.revisionCount) || 0) - (Number(b.revisionCount) || 0); break;
    default:
      return arr.sort((a, b) => (URGENCY[dlState(a).state] - URGENCY[dlState(b).state]) || cmpDeadline(a, b) || byId(a, b));
  }
  return arr.sort((a, b) => (cmp(a, b) * m) || byId(a, b));
}
function boardSort(list) { return list.slice().sort((a, b) => (effPrio(a).index - effPrio(b).index) || cmpDeadline(a, b) || idNum(a.id) - idNum(b.id)); }

// ============================================================================
// Sync chip / offline
// ============================================================================
function setSync(state, error) {
  S.sync.state = state; if (error !== undefined) S.sync.error = error;
  renderSyncChip();
}
function effectiveSyncState() {
  if (!S.online) return 'offline';
  return S.sync.state;
}
function renderSyncChip() {
  const el = $('#sync-status'); if (!el) return;
  const st = effectiveSyncState();
  const text = {
    demo: 'Demo – dữ liệu cục bộ', syncing: 'Đang đồng bộ…', idle: 'Đã đồng bộ ' + (S.sync.lastAt ? hhmm(new Date(S.sync.lastAt)) : ''),
    error: 'Lỗi đồng bộ', offline: 'Ngoại tuyến',
  }[st];
  el.dataset.state = st;
  el.querySelector('.sync-text').textContent = text;
  el.setAttribute('aria-label', 'Trạng thái đồng bộ: ' + text);
  el.title = st === 'error' && S.sync.error ? 'Lỗi đồng bộ: ' + S.sync.error.message + ' — bấm để xem chi tiết' : text;
}
let writeCount = 0;
function beginWrite() { writeCount++; if (S.online) setSync('syncing'); }
function endWrite() { writeCount = Math.max(0, writeCount - 1); if (!writeCount && S.sync.state === 'syncing') setSync(S.mode === 'demo' ? 'demo' : 'idle'); }
function applyOffline() {
  document.body.classList.toggle('is-offline', !S.online);
  $('#offline-banner').hidden = S.online;
  $$('[data-write]').forEach((b) => {
    if (!S.online) { if (!b.disabled) { b.disabled = true; b.dataset.offlineDisabled = '1'; b.dataset.prevTitle = b.title || ''; b.title = 'Đang ngoại tuyến'; } }
    else if (b.dataset.offlineDisabled) { b.disabled = false; delete b.dataset.offlineDisabled; b.title = b.dataset.prevTitle || ''; }
  });
  renderSyncChip();
}
function guardOnline() { if (!S.online) { toast('Đang ngoại tuyến – thay đổi sẽ không được lưu', { type: 'error' }); return false; } return true; }

// ============================================================================
// Loading & sync
// ============================================================================
let loadSeq = 0;
async function loadAll(opts = {}) {
  if (!S.user) return;
  const seq = ++loadSeq;
  if (!S.online && S.mode === 'remote') { renderSyncChip(); return; }
  setSync('syncing');
  try {
    const [cfg, lst] = await Promise.all([S.api.getConfig(auth()), S.api.list(auth())]);
    if (seq !== loadSeq || !S.user) return;
    if (cfg && typeof cfg.aiEnabled === 'boolean') S.aiEnabled = cfg.aiEnabled;
    S.config = Rules.mergeConfig(cfg);
    const incoming = lst.tasks || [];
    const pendingLocal = S.tasks.filter((t) => S.pending.has(t.id));
    S.tasks = incoming.map((t) => pendingLocal.find((p) => p.id === t.id) || t).concat(pendingLocal.filter((p) => String(p.id).startsWith('tmp-')));
    S.meta = lst.meta || { warnings: [] };
    if (typeof S.meta.aiEnabled === 'boolean') S.aiEnabled = S.meta.aiEnabled;
    S.loaded = true; S.loadError = null; S.stale = false;
    S.sync.lastAt = Date.now(); S.sync.error = null;
    setSync(S.mode === 'demo' ? 'demo' : 'idle');
    if (S.mode === 'remote') LS.set('va.cache.v2', { email: S.user.email, apiUrl: savedApiUrl(), tasks: S.tasks, config: S.config, fetchedAt: Date.now() });
    App.onDataChanged({ fromServer: true });
  } catch (e0) {
    if (seq !== loadSeq) return;
    const e = toApiError(e0);
    if (e.code === 'UNAUTHORIZED') { App.onUnauthorized(); return; }
    S.sync.error = e;
    setSync('error', e);
    if (!S.loaded) { S.loadError = e; App.onDataChanged({}); }
    else if (!opts.silent) toast('Không tải được dữ liệu mới', { type: 'error', retry: () => syncNow() });
  }
}
function syncNow() { return loadAll({}); }

let pollTimer = null;
function setupPolling() {
  if (pollTimer) clearInterval(pollTimer);
  const sec = Number(S.config.pollSeconds) || 0;
  if (!sec) return;
  pollTimer = setInterval(() => {
    if (S.user && document.visibilityState === 'visible' && S.online && !writeCount) loadAll({ silent: true });
  }, sec * 1000);
}
