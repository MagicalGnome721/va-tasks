// ============================================================================
// Entry points
// ============================================================================
var PENDING_MAIL_ = [];
var LOCK_DEPTH_ = 0;
var SESSION_ACTIONS_ = ['me', 'logout', 'list', 'getConfig', 'log', 'create', 'update', 'delete', 'addComment',
  'saveConfig', 'split', 'aiIntake', 'aiAssist', 'buddyChat', 'adminGet', 'adminSave', 'adminTestAi'];

function doGet(e) {
  return respond_(function () {
    var p = (e && e.parameter) || {};
    if (String(p.action || '') === 'ping') return { data: actionPing_() };
    throw Rules.err('BAD_REQUEST', 'Yêu cầu không hợp lệ: chỉ hỗ trợ action=ping qua GET');
  });
}

function doPost(e) {
  PENDING_MAIL_ = [];
  LOCK_DEPTH_ = 0;
  var out = respond_(function () {
    var body;
    try { body = JSON.parse((e && e.postData && e.postData.contents) || ''); }
    catch (x) { throw Rules.err('BAD_REQUEST', 'Yêu cầu không hợp lệ: JSON hỏng'); }
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw Rules.err('BAD_REQUEST', 'Yêu cầu không hợp lệ');
    var action = String(body.action || '');
    if (action === 'ping') return { data: actionPing_() };
    if (action === 'requestCode') return { data: actionRequestCode_(body) };
    if (action === 'verifyCode') return { data: actionVerifyCode_(body) };
    if (action === 'googleSignIn') return { data: actionGoogleSignIn_(body) };
    if (SESSION_ACTIONS_.indexOf(action) < 0) throw Rules.err('BAD_REQUEST', 'Yêu cầu không hợp lệ: action "' + action + '" không tồn tại');
    var s = auth_(body.sessionToken);
    var user = s.user, cfg = s.cfg;
    switch (action) {
      case 'me': return { data: { user: publicUser_(user), aiEnabled: aiEnabled_(), expiresAt: isoOf_(s.exp) } };
      case 'logout': PropertiesService.getScriptProperties().deleteProperty(s.key); return { data: { loggedOut: true } };
      case 'list': return actionList_(user, cfg);
      case 'getConfig': return { data: configFor_(user, cfg) };
      case 'log': return { data: actionLog_(body.id, user, cfg) };
      case 'create': return { data: actionCreate_(body, user, cfg) };
      case 'update': {
        var u = actionUpdate_(body, user, cfg);
        return { data: u.task, meta: u.cascade ? { cascade: u.cascade } : null };
      }
      case 'delete': return { data: actionDelete_(body, user, cfg) };
      case 'addComment': return { data: actionAddComment_(body, user, cfg) };
      case 'saveConfig': return { data: actionSaveConfig_(body, user) };
      case 'split': return { data: actionSplit_(body, user, cfg) };
      case 'aiIntake': return { data: actionAiIntake_(body, user, cfg) };
      case 'aiAssist': return { data: actionAiAssist_(body, user, cfg) };
      case 'buddyChat': return { data: actionBuddyChat_(body, user) };
      case 'adminGet': return { data: actionAdminGet_(user) };
      case 'adminSave': return { data: actionAdminSave_(body, user) };
      case 'adminTestAi': return { data: actionAdminTestAi_(user) };
    }
    throw Rules.err('BAD_REQUEST', 'Yêu cầu không hợp lệ');
  });
  flushMail_();
  return out;
}

/** Chạy sau khi dán code: kiểm tra tab dữ liệu, thêm cột mới, tạo _Config/_Log, OWNER_EMAIL, trigger hằng ngày. */
function setup() {
  var sh;
  try { sh = getDataSheet_(); }
  catch (e) {
    if (!e || e.code !== 'HEADER_MISSING' || props_().getProperty('DATA_SHEET_NAME')) throw e;
    sh = createDataSheet_();
  }
  var added = withLock_(function () { return ensureHeaders_(sh); });
  var hm = headerMap_(sh);
  logSheet_();
  var cfg = getConfig_();
  var owner = ownerEmail_();
  var trig = installDailyTrigger_();
  var res = readAll_(sh, hm);
  var scriptTz = Session.getScriptTimeZone();
  var tzNote = scriptTz && scriptTz !== tz_()
    ? ' ⚠ Múi giờ script (' + scriptTz + ') khác múi giờ bảng tính (' + tz_() + '): nên đặt Project Settings › Time zone = ' + tz_() + '.'
    : '';
  var noMail = cfg.members.filter(function (m) { return m.active !== false && !m.email; }).map(function (m) { return m.name; });
  var msg = 'VA Tasks v2 sẵn sàng. Tab dữ liệu: "' + sh.getName() + '", ' + res.tasks.length + ' đơn, ' +
    cfg.members.length + ' thành viên. Quản trị viên: ' + owner + '. Đăng nhập Google: ' + (googleClientId_() ? 'bật' : 'tắt (chưa có GOOGLE_CLIENT_ID)') + '. ' +
    'Cột mới đã thêm: ' + (added.length ? added.join(', ') : 'không có') + '. ' +
    'Tác vụ hằng ngày: ' + trig + '. AI: ' + (aiEnabled_() ? 'bật' : 'tắt (chưa có DEEPSEEK_API_KEY)') + '. ' +
    (noMail.length ? 'Thành viên chưa có Gmail (chưa đăng nhập được): ' + noMail.join(', ') + '. ' : '') +
    'Cảnh báo: ' + (res.warnings.join('; ') || 'không có') + tzNote;
  Logger.log(msg);
  return msg;
}

// ============================================================================
// Infrastructure
// ============================================================================
function respond_(fn) {
  var out;
  try {
    var r = fn();
    out = { ok: true, data: r.data };
    if (r.meta) out.meta = r.meta;
  } catch (e) {
    var known = e && e.code && /^[A-Z_]+$/.test(String(e.code));
    out = { ok: false, error: { code: known ? e.code : 'INTERNAL', message: known ? e.message : 'Lỗi máy chủ: ' + (e && e.message ? e.message : String(e)) } };
    if (known && e.details !== undefined) out.error.details = e.details;
  }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

/** Script lock, re-entrant within one execution. */
function withLock_(fn) {
  if (LOCK_DEPTH_ > 0) return fn();
  var lock = LockService.getScriptLock();
  try { lock.waitLock(20000); }
  catch (e) { throw Rules.err('LOCK_TIMEOUT', 'Hệ thống đang bận, thử lại sau'); }
  LOCK_DEPTH_++;
  try {
    var r = fn();
    SpreadsheetApp.flush();
    return r;
  } finally { LOCK_DEPTH_--; lock.releaseLock(); }
}

function props_() { return PropertiesService.getScriptProperties(); }
function cache_() { return CacheService.getScriptCache(); }
function ss_() { return SpreadsheetApp.getActiveSpreadsheet(); }
/** Time zone used for every Date ↔ yyyy-MM-dd conversion: the SPREADSHEET's zone (falls back to script zone). */
function tz_() {
  var tz = '';
  try { tz = ss_().getSpreadsheetTimeZone(); } catch (e) { tz = ''; }
  return tz || Session.getScriptTimeZone() || 'Asia/Ho_Chi_Minh';
}
/** Midnight of yyyy-MM-dd in time zone tz, as a Date (independent of the script's own zone). */
function dateAtMidnight_(ymd, tz) {
  var p = String(ymd).trim().split('-');
  var guess = Date.UTC(Number(p[0]), Number(p[1]) - 1, Number(p[2]), 0, 0, 0);
  var offMin = function (ms) {
    var m = /([+-])(\d{2}):?(\d{2})/.exec(Utilities.formatDate(new Date(ms), tz, 'XXX'));
    return m ? (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3])) : 0;
  };
  var t = guess - offMin(guess) * 60000;
  t = guess - offMin(t) * 60000; // second pass handles DST boundaries
  return new Date(t);
}
function isoOf_(ms) { return Utilities.formatDate(new Date(Number(ms)), tz_(), "yyyy-MM-dd'T'HH:mm:ssXXX"); }
function nowIso_() { return isoOf_(Date.now()); }
function today_() { return Utilities.formatDate(new Date(), tz_(), 'yyyy-MM-dd'); }
function ctxFor_(user, cfg) {
  var now = new Date(), tz = tz_();
  return {
    user: user,
    actor: user.name,
    today: Utilities.formatDate(now, tz, 'yyyy-MM-dd'),
    todayDmy: Utilities.formatDate(now, tz, 'dd/MM/yyyy'),
    hhmm: Utilities.formatDate(now, tz, 'HH:mm'),
    priorities: cfg.priorities,
    vaNames: Rules.vaNamesOf(cfg, Rules.roleOf(ownerEmail_(), cfg, ownerEmail_()))
  };
}
function isDate_(v) { return Object.prototype.toString.call(v) === '[object Date]'; }
function colLetter_(n) {
  var s = '';
  while (n > 0) { var m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); }
  return s;
}
function safeText_(v) {
  var s = v === null || v === undefined ? '' : String(v);
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}
function sameId_(a, b) { return Rules.trim(a).toLowerCase() === Rules.trim(b).toLowerCase() && Rules.trim(a) !== ''; }
function parseJson_(s, dflt) { if (s === null || s === undefined || s === '') return dflt; try { return JSON.parse(s); } catch (e) { return dflt; } }
function sha256Hex_(s) {
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(s), Utilities.Charset.UTF_8);
  var out = '';
  for (var i = 0; i < bytes.length; i++) { var b = (bytes[i] + 256) % 256; out += (b < 16 ? '0' : '') + b.toString(16); }
  return out;
}
function uuidHex_() { return Utilities.getUuid().replace(/-/g, '').toLowerCase(); }
function randomToken_() { return uuidHex_() + uuidHex_(); }
function randomCode_() {
  var n = parseInt(uuidHex_().replace(/[^0-9a-f]/g, '').slice(0, 12), 16) % 1000000;
  return ('000000' + n).slice(-6);
}
function notFound_(id) { return Rules.err('NOT_FOUND', 'Không tìm thấy task ' + Rules.trim(id)); }
function unauthorized_() { return Rules.err('UNAUTHORIZED', 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại'); }
function forbidden_(reason) { return Rules.err('FORBIDDEN', Rules.FORBIDDEN_MSG + (reason && reason !== Rules.FORBIDDEN_MSG ? ': ' + reason : '')); }
function aiEnabled_() { return !!Rules.trim(props_().getProperty('DEEPSEEK_API_KEY')); }

/** Quản trị viên cố định (FIXED_OWNER_EMAIL). Script Property OWNER_EMAIL bị bỏ qua. */
function ownerEmail_() { return Rules.normEmail(FIXED_OWNER_EMAIL); }
function googleClientId_() { return Rules.trim(props_().getProperty('GOOGLE_CLIENT_ID')); }

// ============================================================================
// Auth (OTP + sessions)
// ============================================================================
function publicUser_(u) { return { email: u.email, name: u.name, role: u.role, team: u.team || '', isOwner: !!u.isOwner }; }
function otpKey_(email) { return email.length <= 200 ? 'otp_' + email : 'otp_h' + sha256Hex_(email); }

function auth_(token) {
  token = String(token || '');
  if (token.length < 32 || token.length > 200) throw unauthorized_();
  var key = 'sess_' + sha256Hex_(token);
  var p = props_();
  var s = parseJson_(p.getProperty(key), null);
  if (!s || !s.email || !(Number(s.exp) > Date.now())) {
    if (s) p.deleteProperty(key);
    throw unauthorized_();
  }
  var cfg = getConfig_();
  var user = Rules.roleOf(s.email, cfg, ownerEmail_());
  if (!user) throw unauthorized_();
  return { user: user, key: key, cfg: cfg, exp: Number(s.exp) };
}

function actionRequestCode_(body) {
  var email = Rules.normEmail(body.email);
  if (!Rules.isValidEmail(email)) throw Rules.err('VALIDATION', 'Dữ liệu không hợp lệ: Gmail không hợp lệ', { fields: { email: 'Gmail không hợp lệ' } });
  var cache = cache_();
  var now = Date.now();
  var rlKey = 'otprl_' + sha256Hex_(email).slice(0, 40);
  var gKey = 'otpg_' + Math.floor(now / 3600000);
  var code = withLock_(function () {
    var list = (parseJson_(cache.get(rlKey), []) || []).filter(function (ts) { return now - Number(ts) < 3600000; });
    if (list.length && now - Number(list[list.length - 1]) < OTP_MIN_INTERVAL_MS) throw Rules.err('RATE_LIMITED', 'Vui lòng đợi 60 giây rồi xin mã mới');
    if (list.length >= OTP_MAX_PER_HOUR) throw Rules.err('RATE_LIMITED', 'Bạn đã xin quá ' + OTP_MAX_PER_HOUR + ' mã trong 1 giờ, vui lòng thử lại sau');
    var g = Number(cache.get(gKey) || 0);
    if (g >= OTP_GLOBAL_PER_HOUR) throw Rules.err('RATE_LIMITED', 'Hệ thống đang nhận quá nhiều yêu cầu, vui lòng thử lại sau');
    list.push(now);
    cache.put(rlKey, JSON.stringify(list), 3600);
    cache.put(gKey, String(g + 1), 3600);
    var user = Rules.roleOf(email, getConfig_(), ownerEmail_());
    if (!user) return '';
    var c = randomCode_(), salt = uuidHex_();
    cache.put(otpKey_(email), JSON.stringify({ h: sha256Hex_(salt + ':' + c), s: salt, tries: 0, exp: now + OTP_TTL_SEC * 1000 }), OTP_TTL_SEC);
    return c;
  });
  if (!code) {
    // unknown email: same response; small random delay so timing does not reveal membership
    try { Utilities.sleep(300 + Math.floor(Math.random() * 500)); } catch (x) { /* ignore */ }
  } else {
    try {
      MailApp.sendEmail({ to: email, name: 'VA Tasks', subject: 'Mã đăng nhập VA Tasks: ' + code,
        body: 'Mã đăng nhập VA Tasks của bạn là: ' + code + '\n\nMã có hiệu lực 10 phút. Nếu bạn không yêu cầu mã này, hãy bỏ qua email.' });
    } catch (e) {
      try { withLock_(function () { appendLogs_([logEntry_(Rules.SYSTEM_ACTOR, '', 'mail_error', '', '', '', 'Không gửi được mã đăng nhập: ' + e.message)]); }); } catch (x) { /* ignore */ }
    }
  }
  return { sent: true, message: OTP_MESSAGE };
}

function actionVerifyCode_(body) {
  var email = Rules.normEmail(body.email);
  var code = String(body.code === undefined || body.code === null ? '' : body.code).replace(/\s+/g, '');
  var bad = function () { return Rules.err('INVALID_CODE', 'Mã không đúng hoặc đã hết hạn'); };
  if (!Rules.isValidEmail(email) || !/^\d{6}$/.test(code)) throw bad();
  var cache = cache_(), key = otpKey_(email), now = Date.now();
  return withLock_(function () {
    var rec = parseJson_(cache.get(key), null);
    if (!rec || !(Number(rec.exp) > now)) { cache.remove(key); throw bad(); }
    if (sha256Hex_(rec.s + ':' + code) !== rec.h) {
      rec.tries = (Number(rec.tries) || 0) + 1;
      if (rec.tries >= OTP_MAX_TRIES) cache.remove(key);
      else cache.put(key, JSON.stringify(rec), Math.max(1, Math.ceil((Number(rec.exp) - now) / 1000)));
      throw bad();
    }
    cache.remove(key);
    var user = Rules.roleOf(email, getConfig_(), ownerEmail_());
    if (!user) throw bad();
    return newSession_(email, user);
  });
}
function newSession_(email, user) {
  var token = randomToken_();
  var exp = Date.now() + SESSION_DAYS * 86400000;
  props_().setProperty('sess_' + sha256Hex_(token), JSON.stringify({ email: email, exp: exp }));
  return { sessionToken: token, expiresAt: isoOf_(exp), user: publicUser_(user), aiEnabled: aiEnabled_() };
}

/** Đăng nhập bằng Google: client gửi ID token (JWT) của Google Identity Services; server xác minh với Google. */
function actionGoogleSignIn_(body) {
  var clientId = googleClientId_();
  if (!clientId) throw Rules.err('GOOGLE_DISABLED', 'Đăng nhập Google chưa được bật, vui lòng dùng mã gửi qua Gmail');
  var idToken = String(body.idToken || '');
  var bad = function () { return Rules.err('INVALID_GOOGLE', 'Đăng nhập Google không hợp lệ hoặc đã hết hạn, vui lòng thử lại'); };
  if (idToken.length < 100 || idToken.length > 4096 || !/^[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+$/.test(idToken)) throw bad();
  var info = null;
  try {
    var resp = UrlFetchApp.fetch(GOOGLE_TOKENINFO_URL + encodeURIComponent(idToken), { muteHttpExceptions: true });
    if (resp.getResponseCode() === 200) info = parseJson_(resp.getContentText(), null);
  } catch (e) { throw Rules.err('INVALID_GOOGLE', 'Không xác minh được với Google, vui lòng thử lại'); }
  if (!info || String(info.aud) !== clientId) throw bad();
  if (['accounts.google.com', 'https://accounts.google.com'].indexOf(String(info.iss)) < 0) throw bad();
  if (!(Number(info.exp) * 1000 > Date.now())) throw bad();
  if (String(info.email_verified) !== 'true') throw Rules.err('INVALID_GOOGLE', 'Gmail này chưa được Google xác minh');
  var email = Rules.normEmail(info.email);
  var user = Rules.roleOf(email, getConfig_(), ownerEmail_());
  if (!user) throw Rules.err('NOT_MEMBER', 'Gmail ' + email + ' chưa có trong danh sách thành viên. Nhờ quản trị viên thêm bạn (Cài đặt › Thành viên).');
  return withLock_(function () { return newSession_(email, user); });
}

// ============================================================================
// Quản trị (chỉ chủ app)
// ============================================================================
function requireAdmin_(user) {
  var p = Rules.can(user, 'admin');
  if (!p.ok) throw forbidden_(p.reason);
}
function maskKey_(k) { k = Rules.trim(k); return k ? (k.slice(0, 3) + '••••' + k.slice(-4)) : ''; }
function actionAdminGet_(user) {
  requireAdmin_(user);
  var p = props_();
  return {
    ownerEmail: ownerEmail_(),
    deepseekKeySet: aiEnabled_(), deepseekKeyMasked: maskKey_(p.getProperty('DEEPSEEK_API_KEY')),
    googleClientId: googleClientId_(), appUrl: Rules.trim(p.getProperty('APP_URL')),
    weeklyReport: p.getProperty('WEEKLY_REPORT') !== 'off', version: API_VERSION
  };
}
function actionAdminSave_(body, user) {
  requireAdmin_(user);
  var p = props_(), fields = {};
  var has = function (k) { return Object.prototype.hasOwnProperty.call(body, k); };
  if (has('deepseekKey')) {
    var k = Rules.trim(body.deepseekKey);
    if (k && !/^sk-[A-Za-z0-9_\-]{16,200}$/.test(k)) fields.deepseekKey = 'API key DeepSeek có dạng sk-…';
  }
  if (has('googleClientId')) {
    var g = Rules.trim(body.googleClientId);
    if (g && !/^[0-9]+-[a-z0-9]+\.apps\.googleusercontent\.com$/.test(g)) fields.googleClientId = 'Client ID có dạng 1234-abc.apps.googleusercontent.com';
  }
  if (has('appUrl')) {
    var u = Rules.trim(body.appUrl);
    if (u && !/^https:\/\/\S{3,300}$/.test(u)) fields.appUrl = 'Link app phải bắt đầu bằng https://';
  }
  if (Object.keys(fields).length) throw Rules.err('VALIDATION', 'Dữ liệu không hợp lệ: ' + Rules.firstMessage(fields), { fields: fields });
  var setOrDel = function (name, v) { if (v) p.setProperty(name, v); else p.deleteProperty(name); };
  if (has('deepseekKey')) setOrDel('DEEPSEEK_API_KEY', Rules.trim(body.deepseekKey));
  if (has('googleClientId')) setOrDel('GOOGLE_CLIENT_ID', Rules.trim(body.googleClientId));
  if (has('appUrl')) setOrDel('APP_URL', Rules.trim(body.appUrl));
  if (has('weeklyReport')) p.setProperty('WEEKLY_REPORT', body.weeklyReport === false ? 'off' : 'on');
  withLock_(function () {
    appendLogs_([logEntry_(user.name, '', 'admin', Object.keys(body).filter(function (k) { return k !== 'action' && k !== 'sessionToken'; }).join(', '), '', '', 'Quản trị viên cập nhật cài đặt')]);
  });
  return actionAdminGet_(user);
}
function actionAdminTestAi_(user) {
  requireAdmin_(user);
  var key = Rules.trim(props_().getProperty('DEEPSEEK_API_KEY'));
  if (!key) throw Rules.err('AI_UNAVAILABLE', 'Chưa có API key DeepSeek');
  var resp;
  try {
    resp = UrlFetchApp.fetch(DEEPSEEK_URL, {
      method: 'post', contentType: 'application/json', headers: { Authorization: 'Bearer ' + key },
      payload: JSON.stringify({ model: 'deepseek-chat', max_tokens: 5, messages: [{ role: 'user', content: 'ping' }] }),
      muteHttpExceptions: true
    });
  } catch (e) { throw Rules.err('AI_UNAVAILABLE', 'Không kết nối được DeepSeek: ' + e.message); }
  var c = resp.getResponseCode();
  if (c === 401) throw Rules.err('AI_UNAVAILABLE', 'API key DeepSeek sai hoặc đã bị thu hồi');
  if (c === 402) throw Rules.err('AI_UNAVAILABLE', 'Tài khoản DeepSeek hết số dư');
  if (c !== 200) throw Rules.err('AI_UNAVAILABLE', 'DeepSeek trả lỗi HTTP ' + c);
  return { ok: true, message: 'Kết nối DeepSeek hoạt động' };
}

// ============================================================================
// Trợ lý AI quản lý dự án (VA + quản trị viên)
// ============================================================================
function assistQuotaTake_(email) {
  var key = 'aiq_' + today_().replace(/-/g, '') + '_a' + sha256Hex_(email).slice(0, 15);
  return withLock_(function () {
    var p = props_();
    var n = Number(p.getProperty(key) || 0);
    if (n >= ASSIST_DAILY_LIMIT) return false;
    p.setProperty(key, String(n + 1));
    return true;
  });
}
function deepseekJson_(key, messages, maxTokens, temperature) {
  var resp = UrlFetchApp.fetch(DEEPSEEK_URL, {
    method: 'post', contentType: 'application/json', headers: { Authorization: 'Bearer ' + key },
    payload: JSON.stringify({ model: 'deepseek-chat', temperature: temperature == null ? 0.3 : temperature, max_tokens: maxTokens || 1800,
      response_format: { type: 'json_object' }, messages: messages }),
    muteHttpExceptions: true
  });
  if (resp.getResponseCode() !== 200) throw Rules.err('AI_HTTP', 'DeepSeek HTTP ' + resp.getResponseCode());
  var j = parseJson_(resp.getContentText(), null);
  var content = j && j.choices && j.choices[0] && j.choices[0].message ? j.choices[0].message.content : null;
  if (typeof content !== 'string') throw Rules.err('AI_BAD_OUTPUT', 'AI không trả nội dung');
  return Rules.parseAiJson(content);
}
function runAssist_(mode, question, tasks, cfg, ownerUser) {
  var key = Rules.trim(props_().getProperty('DEEPSEEK_API_KEY'));
  if (!key) throw Rules.err('AI_UNAVAILABLE', 'AI chưa được bật — quản trị viên dán API key DeepSeek ở Cài đặt › Quản trị');
  var today = today_();
  var snap = Rules.assistSnapshot(tasks, cfg, today, ownerUser);
  var stats = mode === 'weekly' ? Rules.weeklyStats(tasks, cfg, today, ownerUser) : null;
  var messages = Rules.buildAssistMessages(mode, question, snap, stats);
  var out;
  try { out = Rules.sanitizeAssist(deepseekJson_(key, messages), snap); }
  catch (e1) {
    try { out = Rules.sanitizeAssist(deepseekJson_(key, messages.concat([{ role: 'user', content: Rules.AI_RETRY_PROMPT }])), snap); }
    catch (e2) { throw Rules.err('AI_UNAVAILABLE', 'AI tạm thời không khả dụng, vui lòng thử lại sau'); }
  }
  out.mode = mode;
  out.generatedAt = nowIso_();
  if (stats) { out.stats = stats; }
  return out;
}
function actionAiAssist_(body, user, cfg) {
  var p = Rules.can(user, 'aiAssist');
  if (!p.ok) throw forbidden_(p.reason);
  var mode = Rules.ASSIST_MODES.indexOf(String(body.mode)) >= 0 ? String(body.mode) : 'ask';
  var q = Rules.trim(body.question);
  if (mode === 'ask' && q.length < 3) throw Rules.err('VALIDATION', 'Dữ liệu không hợp lệ: Hãy nhập câu hỏi', { fields: { question: 'Hãy nhập câu hỏi' } });
  if (q.length > Rules.ASSIST_MAX_QUESTION) throw Rules.err('VALIDATION', 'Dữ liệu không hợp lệ: Tối đa ' + Rules.ASSIST_MAX_QUESTION + ' ký tự', { fields: { question: 'Quá dài' } });
  if (!aiEnabled_()) throw Rules.err('AI_UNAVAILABLE', 'AI chưa được bật — quản trị viên dán API key DeepSeek ở Cài đặt › Quản trị');
  if (!assistQuotaTake_(user.email)) throw Rules.err('AI_UNAVAILABLE', 'Bạn đã dùng hết ' + ASSIST_DAILY_LIMIT + ' lượt trợ lý AI hôm nay');
  var sh = getDataSheet_();
  var tasks = readAll_(sh, headerMap_(sh)).tasks;
  return runAssist_(mode, q, tasks, cfg, null);  // chỉ VA trong danh sách thành viên mới được AI phân việc
}

/** Cún chat: hội thoại ngắn kiểu GenZ, trả {text, mood}. Dùng chung hạn mức lượt AI/ngày. */
function actionBuddyChat_(body, user) {
  var p = Rules.can(user, 'buddyChat');
  if (!p.ok) throw forbidden_(p.reason);
  var hist = Array.isArray(body.history) ? body.history : [];
  var last = hist.length ? Rules.trim(hist[hist.length - 1] && hist[hist.length - 1].text) : '';
  if (last.length < 1) throw Rules.err('VALIDATION', 'Dữ liệu không hợp lệ: Hãy nhập tin nhắn', { fields: { text: 'Hãy nhập tin nhắn' } });
  if (last.length > Rules.BUDDY_MAX_TEXT) throw Rules.err('VALIDATION', 'Dữ liệu không hợp lệ: Tối đa ' + Rules.BUDDY_MAX_TEXT + ' ký tự', { fields: { text: 'Quá dài' } });
  var key = Rules.trim(props_().getProperty('DEEPSEEK_API_KEY'));
  if (!key) throw Rules.err('AI_UNAVAILABLE', 'AI chưa được bật — quản trị viên dán API key DeepSeek ở Cài đặt › Quản trị');
  if (!assistQuotaTake_(user.email)) throw Rules.err('AI_UNAVAILABLE', 'Hôm nay Cún nói nhiều quá rồi, mai nói tiếp nha (hết ' + ASSIST_DAILY_LIMIT + ' lượt AI)');
  var messages = Rules.buildBuddyMessages(hist, { summary: body.summary, time: body.time, name: user.name });
  try { return Rules.sanitizeBuddy(deepseekJson_(key, messages, 300, 0.9)); }
  catch (e1) {
    try { return Rules.sanitizeBuddy(deepseekJson_(key, messages.concat([{ role: 'user', content: Rules.AI_RETRY_PROMPT }]), 300, 0.9)); }
    catch (e2) { throw Rules.err('AI_UNAVAILABLE', 'AI tạm thời không khả dụng, vui lòng thử lại sau'); }
  }
}

/** Báo cáo tuần: gửi email thứ Hai cho quản trị viên + VA (gọi từ dailyJob). AI lỗi → gửi bản số liệu. */
function weeklyReport_(sum) {
  if (props_().getProperty('WEEKLY_REPORT') === 'off') return;
  var cfg = getConfig_();
  var sh = getDataSheet_();
  var tasks = readAll_(sh, headerMap_(sh)).tasks;
  var owner = null;
  var stats = Rules.weeklyStats(tasks, cfg, today_(), owner);
  var text = Rules.weeklyReportText(stats);
  if (aiEnabled_()) {
    try { var r = runAssist_('weekly', '', tasks, cfg, owner); if (r.answer) text = r.answer + '\n\n— Số liệu —\n' + text; }
    catch (e) { sum.errors.push('weekly AI: ' + e.message); }
  }
  var to = vaEmails_(cfg);
  var url = Rules.trim(props_().getProperty('APP_URL'));
  to.forEach(function (e) {
    PENDING_MAIL_.push({ to: e, taskId: '', subject: '[VA Tasks] Báo cáo tuần ' + Rules.ymdToDmy(stats.to),
      body: text + (url ? '\n\nMở app: ' + url + '#/ai' : '') });
  });
  sum.weekly = to.length;
}

// ============================================================================
// Sheet mapping
// ============================================================================
var HEADER_KEYS_ = (function () {
  var m = {};
  Object.keys(Rules.HEADERS).forEach(function (k) { m[Rules.normText(Rules.HEADERS[k])] = k; });
  return m;
})();

function getDataSheet_() {
  var ss = ss_();
  var name = props_().getProperty('DATA_SHEET_NAME');
  if (name) {
    var named = ss.getSheetByName(name);
    if (!named) throw Rules.err('HEADER_MISSING', 'Không tìm thấy cột bắt buộc: không có tab "' + name + '"');
    return named;
  }
  var sheets = ss.getSheets();
  for (var i = 0; i < sheets.length; i++) {
    var s = sheets[i];
    var nm = s.getName();
    if (nm === CONFIG_SHEET || nm === LOG_SHEET || nm.indexOf(BACKUP_PREFIX) === 0) continue;
    var lc = s.getLastColumn();
    if (lc < 1) continue;
    var hdr = s.getRange(1, 1, 1, lc).getValues()[0].map(function (h) { return Rules.normText(h); });
    if (hdr.indexOf(Rules.normText('ID')) >= 0 && hdr.indexOf(Rules.normText('Tên yêu cầu')) >= 0) return s;
  }
  throw Rules.err('HEADER_MISSING', 'Không tìm thấy cột bắt buộc: ID, Tên yêu cầu');
}

/** Append missing v2 headers AFTER the last used column (never touches other columns). Returns added headers. */
/** Sheet mới tinh: tạo tab "All Tasks" với đủ cột (dùng tab trống đầu tiên nếu có). */
var DATA_TAB_DEFAULT = 'All Tasks';
var DATA_COLUMNS_ = ['id', 'team', 'project', 'assetType', 'name', 'description', 'briefLink', 'outputSpec', 'quantity',
  'priority', 'requester', 'assignee', 'requestDate', 'deadline', 'status', 'progress', 'deliveryLink', 'notes'];
function createDataSheet_() {
  var ss = ss_();
  var sh = ss.getSheetByName(DATA_TAB_DEFAULT);
  if (!sh) {
    var first = ss.getSheets()[0];
    if (first && first.getLastRow() === 0 && first.getLastColumn() === 0 && first.getName() !== CONFIG_SHEET && first.getName() !== LOG_SHEET) {
      sh = first; sh.setName(DATA_TAB_DEFAULT);
    } else sh = ss.insertSheet(DATA_TAB_DEFAULT, 0);
  }
  if (sh.getLastColumn() > 0) throw Rules.err('HEADER_MISSING', 'Tab "' + DATA_TAB_DEFAULT + '" đã có dữ liệu nhưng thiếu cột ID / Tên yêu cầu');
  var headers = DATA_COLUMNS_.concat(Rules.NEW_KEYS).map(function (k) { return Rules.HEADERS[k]; });
  if (sh.getMaxColumns() < headers.length) sh.insertColumnsAfter(sh.getMaxColumns(), headers.length - sh.getMaxColumns());
  sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
  sh.setFrozenRows(1);
  var dateCols = ['requestDate', 'deadline', 'reviewDate'];
  dateCols.forEach(function (k) { var c = headers.indexOf(Rules.HEADERS[k]) + 1; if (c > 0) sh.getRange(2, c, sh.getMaxRows() - 1, 1).setNumberFormat('dd/MM/yyyy'); });
  return sh;
}
function ensureHeaders_(sh) {
  var lc = Math.max(sh.getLastColumn(), 1);
  var hdr = sh.getRange(1, 1, 1, lc).getValues()[0].map(function (h) { return Rules.normText(h); });
  var missing = Rules.NEW_KEYS.filter(function (k) { return hdr.indexOf(Rules.normText(Rules.HEADERS[k])) < 0; });
  if (!missing.length) return [];
  var start = sh.getLastColumn() + 1;
  var need = start + missing.length - 1;
  if (sh.getMaxColumns() < need) sh.insertColumnsAfter(sh.getMaxColumns(), need - sh.getMaxColumns());
  sh.getRange(1, start, 1, missing.length).setValues([missing.map(function (k) { return Rules.HEADERS[k]; })]);
  return missing.map(function (k) { return Rules.HEADERS[k]; });
}

/** Build { map: key → column (1-based), headers, lastCol, warnings } from row 1. */
function headerMap_(sheet) {
  var lc = Math.max(sheet.getLastColumn(), 1);
  var headers = sheet.getRange(1, 1, 1, lc).getValues()[0];
  var map = {};
  headers.forEach(function (h, i) {
    var k = HEADER_KEYS_[Rules.normText(h)];
    if (k && !map[k]) map[k] = i + 1;
  });
  if (!map.id) throw Rules.err('HEADER_MISSING', 'Không tìm thấy cột bắt buộc: ID');
  if (!map.name) throw Rules.err('HEADER_MISSING', 'Không tìm thấy cột bắt buộc: Tên yêu cầu');
  var warnings = [];
  Object.keys(Rules.HEADERS).forEach(function (k) { if (!map[k] && k !== 'progress') warnings.push('Thiếu cột: ' + Rules.HEADERS[k]); });
  return { map: map, headers: headers, lastCol: lc, warnings: warnings };
}

var NUM_KEYS_ = ['quantity', 'progress', 'revisionCount'];

/** Sheet cell → JSON value. */
function fromCell_(k, v, fmt, tz, warnings, id) {
  var empty = v === '' || v === null || v === undefined;
  if (NUM_KEYS_.indexOf(k) >= 0) {
    if (empty) return null;
    if (k === 'progress') {
      if (typeof v === 'number') return String(fmt || '').indexOf('%') >= 0 ? Math.round(v * 100) : Math.round(v);
      var m = /^\s*(-?\d+(?:[.,]\d+)?)\s*%?\s*$/.exec(String(v));
      if (m) return Math.round(Number(m[1].replace(',', '.')));
      return null;
    }
    if (typeof v === 'number') return Math.round(v);
    var q = Number(String(v).trim());
    return String(v).trim() !== '' && isFinite(q) ? Math.round(q) : null;
  }
  if (empty) return '';
  if (Rules.DATE_KEYS.indexOf(k) >= 0) {
    if (isDate_(v)) return isNaN(v.getTime()) ? '' : Utilities.formatDate(v, tz, 'yyyy-MM-dd');
    var s = String(v).trim();
    if (Rules.isValidYmd(s)) return s;
    var d = Rules.dmyToYmd(s);
    if (d) return d;
    warnings.push('Ngày không hợp lệ ở ' + (id || '?') + '.' + k + ': "' + s + '"');
    return '';
  }
  if (isDate_(v)) return Utilities.formatDate(v, tz, 'yyyy-MM-dd');
  return String(v).replace(/\s+$/, '');
}

/** Read rows [startRow, startRow+n) → array of {task|null}. */
function readRows_(sheet, hm, startRow, n, warnings) {
  if (n <= 0) return [];
  var rng = sheet.getRange(startRow, 1, n, hm.lastCol);
  var values = rng.getValues();
  var formats = rng.getNumberFormats();
  var displays = rng.getDisplayValues();
  var tz = tz_();
  var out = [];
  for (var r = 0; r < n; r++) {
    var row = values[r];
    var empty = true;
    Rules.OWNED_KEYS.forEach(function (k) {
      var c = hm.map[k];
      if (c && row[c - 1] !== '' && row[c - 1] !== null) empty = false;
    });
    if (empty) { out.push(null); continue; }
    var t = {};
    var idRaw = hm.map.id ? row[hm.map.id - 1] : '';
    var idStr = Rules.trim(isDate_(idRaw) ? '' : idRaw);
    Rules.OWNED_KEYS.forEach(function (k) {
      var c = hm.map[k];
      if (!c) { t[k] = NUM_KEYS_.indexOf(k) >= 0 ? null : ''; return; }
      t[k] = fromCell_(k, row[c - 1], formats[r][c - 1], tz, warnings, idStr || ('dòng ' + (startRow + r)));
    });
    t.id = Rules.trim(t.id);
    t.status = Rules.trim(t.status);
    t.requesterEmail = Rules.normEmail(t.requesterEmail);
    t.size = Rules.normSize(t.size) || Rules.trim(t.size);
    t.parentId = Rules.trim(t.parentId);
    t.sheetDeadlineWarning = hm.map.sheetDeadlineWarning ? String(displays[r][hm.map.sheetDeadlineWarning - 1]) : '';
    t._row = startRow + r;
    out.push(t);
  }
  return out;
}

function readAll_(sheet, hm) {
  var warnings = hm.warnings.slice();
  var lastRow = sheet.getLastRow();
  var rows = readRows_(sheet, hm, 2, lastRow - 1, warnings);
  var tasks = [], lastDataRow = 1;
  rows.forEach(function (t) { if (t) { tasks.push(t); lastDataRow = t._row; } });
  var seen = {}, order = [];
  tasks.forEach(function (t) {
    var k = t.id.toLowerCase(); if (!k) return;
    if (!seen[k]) { seen[k] = []; order.push(k); }
    seen[k].push(t._row);
  });
  order.forEach(function (k) {
    if (seen[k].length > 1) {
      var t = findTask_(tasks, k);
      warnings.push('ID trùng: ' + t.id + ' (dòng ' + seen[k].join(', ') + ')');
    }
  });
  return { tasks: tasks, warnings: warnings, lastDataRow: lastDataRow };
}

function readRow_(sheet, hm, row) { return readRows_(sheet, hm, row, 1, [])[0]; }

function findTask_(tasks, id) {
  for (var i = 0; i < tasks.length; i++) if (sameId_(tasks[i].id, id)) return tasks[i];
  return null;
}

/** JSON value → one sheet cell. */
function writeCell_(sheet, row, col, k, v) {
  var cell = sheet.getRange(row, col);
  if (Rules.DATE_KEYS.indexOf(k) >= 0) {
    if (!Rules.trim(v)) { cell.clearContent(); return; }
    cell.setValue(dateAtMidnight_(String(v).trim(), tz_()));
    cell.setNumberFormat('dd/MM/yyyy');
    return;
  }
  if (k === 'progress') {
    if (v === null || v === undefined || v === '') { cell.clearContent(); return; }
    var pct = String(cell.getNumberFormat() || '').indexOf('%') >= 0;
    cell.setValue(pct ? Number(v) / 100 : Math.round(Number(v)));
    return;
  }
  if (k === 'quantity' || k === 'revisionCount') {
    if (v === null || v === undefined || v === '') { cell.clearContent(); return; }
    cell.setValue(Math.round(Number(v)));
    return;
  }
  var s = v === null || v === undefined ? '' : String(v);
  if (s === '') { cell.clearContent(); return; }
  cell.setValue(safeText_(s));
}

/** Write given keys of task into row; on error restore cells already written. */
function writeChanges_(sheet, row, hm, task, keys) {
  var done = [];
  try {
    keys.forEach(function (k) {
      var c = hm.map[k];
      if (!c || Rules.WRITE_KEYS.indexOf(k) < 0) return;
      var cell = sheet.getRange(row, c);
      done.push({ cell: cell, value: cell.getValue(), formula: cell.getFormula(), fmt: cell.getNumberFormat() });
      try { writeCell_(sheet, row, c, k, task[k]); }
      catch (e) {
        var f = {}; f[k] = e.message;
        throw Rules.err('VALIDATION', 'Dữ liệu không hợp lệ: ' + e.message, { fields: f });
      }
    });
  } catch (err) {
    for (var i = done.length - 1; i >= 0; i--) {
      try {
        var d = done[i];
        if (d.formula) d.cell.setFormula(d.formula); else d.cell.setValue(d.value);
        d.cell.setNumberFormat(d.fmt);
      } catch (ignore) { /* best effort */ }
    }
    throw err;
  }
}

/** Append a new task at the row after the last data row; copies formulas of non-owned columns. Returns row. */
function appendTaskRow_(sh, hm, lastDataRow, task) {
  var row = lastDataRow + 1;
  var owned = {};
  Rules.OWNED_KEYS.forEach(function (k) { if (hm.map[k]) owned[hm.map[k]] = true; });
  if (lastDataRow >= 2) {
    for (var c = 1; c <= hm.lastCol; c++) {
      if (owned[c]) continue;
      var src = sh.getRange(lastDataRow, c);
      var dst = sh.getRange(row, c);
      if (src.getFormula() !== '' && dst.getFormula() === '') src.copyTo(dst, SpreadsheetApp.CopyPasteType.PASTE_FORMULA, false);
    }
  }
  var keys = Rules.WRITE_KEYS.filter(function (k) { return hm.map[k] && !(task[k] === '' || task[k] === null || task[k] === undefined); });
  writeChanges_(sh, row, hm, task, keys);
  return row;
}

/** All tasks annotated (queue, children…) — what list/update/create return. */
function annotatedAll_(sh, hm, cfg) {
  var res = readAll_(sh, hm);
  return { res: res, tasks: Rules.annotateTasks(res.tasks, today_(), cfg.priorities) };
}
function annotatedTask_(sh, hm, cfg, id) { return findTask_(annotatedAll_(sh, hm, cfg).tasks, id); }

// ============================================================================
// _Log
// ============================================================================
function logSheet_() {
  var ss = ss_();
  var sh = ss.getSheetByName(LOG_SHEET);
  if (!sh) {
    sh = ss.insertSheet(LOG_SHEET);
    sh.getRange(1, 1, 1, LOG_HEADERS.length).setValues([LOG_HEADERS]);
    sh.setFrozenRows(1);
    sh.getRange('A:H').setNumberFormat('@');
  }
  return sh;
}
function appendLogs_(entries) {
  if (!entries || !entries.length) return;
  var sh = logSheet_();
  var rows = entries.map(function (e) {
    return [e.ts, e.taskId, e.actor, e.action, e.field, e.oldValue, e.newValue, e.text].map(function (v) { return v === null || v === undefined ? '' : String(v); });
  });
  var rng = sh.getRange(sh.getLastRow() + 1, 1, rows.length, LOG_HEADERS.length);
  rng.setNumberFormat('@');
  rng.setValues(rows);
}
function logEntry_(actor, taskId, action, field, oldValue, newValue, text) {
  return { ts: nowIso_(), taskId: taskId || '', actor: actor, action: action, field: field || '', oldValue: oldValue || '', newValue: newValue || '', text: text || '' };
}

// ============================================================================
// _Config
// ============================================================================
function readConfigRaw_() {
  var sh = ss_().getSheetByName(CONFIG_SHEET);
  if (!sh) return null;
  var obj = {};
  var lr = sh.getLastRow();
  if (lr >= 2) {
    sh.getRange(2, 1, lr - 1, 2).getValues().forEach(function (r) {
      var k = String(r[0]).trim();
      if (Rules.CONFIG_KEYS.indexOf(k) < 0) return;
      try { obj[k] = JSON.parse(String(r[1])); } catch (e) { /* keep default */ }
    });
  }
  return Rules.mergeConfig(obj);
}
function writeConfig_(cfg) {
  var ss = ss_();
  var sh = ss.getSheetByName(CONFIG_SHEET);
  if (!sh) {
    sh = ss.insertSheet(CONFIG_SHEET);
    sh.getRange(1, 1, 1, 2).setValues([['key', 'value']]);
    sh.setFrozenRows(1);
    sh.getRange('A:B').setNumberFormat('@');
  }
  var lr = sh.getLastRow();
  var idx = {};
  if (lr >= 2) sh.getRange(2, 1, lr - 1, 1).getValues().forEach(function (r, i) { var k = String(r[0]).trim(); if (k && !idx[k]) idx[k] = i + 2; });
  Rules.CONFIG_KEYS.forEach(function (k) {
    var row = idx[k];
    if (!row) { row = sh.getLastRow() + 1; idx[k] = row; sh.getRange(row, 1).setNumberFormat('@').setValue(k); }
    sh.getRange(row, 2).setNumberFormat('@').setValue(JSON.stringify(cfg[k] === undefined ? null : cfg[k]));
  });
}
/** Default _Config: default catalogs; members = names already on the sheet (no Gmail yet). */
function createDefaultConfig_() {
  var cfg = Rules.mergeConfig({});
  var byKey = {}, order = [];
  try {
    var sh = getDataSheet_();
    var res = readAll_(sh, headerMap_(sh));
    res.tasks.forEach(function (t) {
      [['requester', false], ['assignee', true]].forEach(function (p) {
        var n = Rules.trim(t[p[0]]).replace(/\s+/g, ' ');
        if (n.length < 2 || n.length > 50) return;
        var key = Rules.normText(n);
        if (!byKey[key]) { byKey[key] = { name: n, email: '', team: '', isArtist: false, active: true }; order.push(key); }
        if (p[1]) byKey[key].isArtist = true;
      });
    });
  } catch (e) { /* no data sheet yet */ }
  cfg.members = order.map(function (k) { return byKey[k]; });
  cfg.version = 1;
  cfg.updatedAt = nowIso_();
  writeConfig_(cfg);
  return cfg;
}
function getConfig_() {
  var c = readConfigRaw_();
  if (c) return c;
  return withLock_(function () { return readConfigRaw_() || createDefaultConfig_(); });
}
function configFor_(user, cfg) {
  var c = Rules.sanitizeConfigFor(user, cfg);
  c.aiEnabled = aiEnabled_();
  return c;
}

// ============================================================================
// Email notifications (never break the main action)
// ============================================================================
function emailOfName_(cfg, name) {
  var n = Rules.normText(name);
  if (!n) return '';
  for (var i = 0; i < cfg.members.length; i++) {
    var m = cfg.members[i];
    if (Rules.normText(m.name) === n && m.active !== false && Rules.isValidEmail(m.email)) return Rules.normEmail(m.email);
  }
  var owner = Rules.roleOf(ownerEmail_(), cfg, ownerEmail_());
  if (owner && Rules.normText(owner.name) === n) return owner.email;
  return '';
}
function vaEmails_(cfg) {
  var out = [];
  cfg.members.forEach(function (m) {
    var e = Rules.normEmail(m.email);
    if (m.isArtist === true && m.active !== false && Rules.isValidEmail(e) && out.indexOf(e) < 0) out.push(e);
  });
  var o = ownerEmail_();
  if (o && out.indexOf(o) < 0) out.push(o);
  return out;
}
function oneLine_(s, n) { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; }
function taskLink_(id) {
  var base = Rules.trim(props_().getProperty('APP_URL'));
  return base ? base.replace(/#.*$/, '') + '#/task/' + encodeURIComponent(id) : '';
}
function queueMail_(to, task, subject, lines) {
  if (!to) return;
  var link = taskLink_(task.id);
  var body = lines.concat(['', 'Mã đơn: ' + task.id, 'Tên đơn: ' + oneLine_(task.name, 200)])
    .concat(link ? ['Mở đơn: ' + link] : [])
    .concat(['', '— VA Tasks (email tự động, vui lòng không trả lời)']).join('\n');
  PENDING_MAIL_.push({ to: to, subject: oneLine_('[VA Tasks] ' + task.id + ' · ' + subject + ': ' + task.name, 180), body: body, taskId: task.id });
}
function notifyNew_(task, cfg) {
  var to = vaEmails_(cfg).join(',');
  queueMail_(to, task, 'Đơn mới', ['Có đơn mới từ ' + task.requester + (task.team ? ' (' + task.team + ')' : '') + '.',
    'Ưu tiên: ' + (task.priority || '—') + ' · Độ nặng: ' + (task.size || 'chưa chấm') + ' · Hạn: ' + (Rules.ymdToDmy(task.deadline) || 'chưa có')]);
}
function notifyReview_(task) {
  var ad = Rules.autoApproveDate(task);
  queueMail_(task.requesterEmail, task, 'Chờ bạn duyệt', [task.assignee + ' đã gửi kết quả. Vui lòng vào app bấm "Đạt" hoặc "Chưa đạt".',
    'Link kết quả: ' + (task.deliveryLink || '—'), ad ? 'Nếu không phản hồi, đơn sẽ tự duyệt vào ' + Rules.ymdToDmy(ad) + '.' : '']);
}
function notifyChanges_(task, cfg, note) {
  queueMail_(emailOfName_(cfg, task.assignee), task, 'Cần sửa', [task.requester + ' yêu cầu sửa lại.', 'Nội dung: ' + oneLine_(note, 1000)]);
}
function notifyDone_(task, cfg, auto) {
  queueMail_(emailOfName_(cfg, task.assignee), task, auto ? 'Đã tự duyệt' : 'Đã duyệt',
    [auto ? 'Đơn đã được tự duyệt sau 3 ngày làm việc không có phản hồi.' : task.requester + ' đã duyệt Đạt.']);
}
function notifyRemind_(task) {
  queueMail_(task.requesterEmail, task, 'Nhắc duyệt', ['Đơn đang chờ bạn duyệt. Nếu không phản hồi, đơn sẽ tự duyệt vào ' +
    Rules.ymdToDmy(Rules.autoApproveDate(task)) + '.', 'Link kết quả: ' + (task.deliveryLink || '—')]);
}
function flushMail_() {
  var list = PENDING_MAIL_;
  PENDING_MAIL_ = [];
  var errs = [];
  (list || []).forEach(function (m) {
    try {
      if (MailApp.getRemainingDailyQuota() < 1) throw new Error('Đã hết hạn mức gửi email hôm nay');
      MailApp.sendEmail({ to: m.to, subject: m.subject, body: m.body, name: 'VA Tasks' });
    } catch (e) {
      errs.push(logEntry_(Rules.SYSTEM_ACTOR, m.taskId, 'mail_error', '', '', '', 'Không gửi được email "' + m.subject + '": ' + (e && e.message ? e.message : String(e))));
    }
  });
  if (errs.length) { try { withLock_(function () { appendLogs_(errs); }); } catch (x) { /* ignore */ } }
}

// ============================================================================
// Actions
// ============================================================================
function actionPing_() {
  var sh = getDataSheet_();
  var hm = headerMap_(sh);
  var n = readAll_(sh, hm).tasks.length;
  return { sheetName: sh.getName(), taskCount: n, serverTime: nowIso_(), version: API_VERSION, googleClientId: googleClientId_() };
}

function actionList_(user, cfg) {
  var sh = getDataSheet_();
  var hm = headerMap_(sh);
  var res = readAll_(sh, hm);
  if (res.tasks.some(function (t) { return !t.id; })) {
    res = withLock_(function () {
      var hm2 = headerMap_(sh);
      var r2 = readAll_(sh, hm2);
      var ids = r2.tasks.map(function (t) { return t.id; });
      var logs = [];
      r2.tasks.forEach(function (t) {
        if (t.id) return;
        t.id = Rules.nextId(ids);
        ids.push(t.id);
        writeCell_(sh, t._row, hm2.map.id, 'id', t.id);
        logs.push(logEntry_(Rules.SYSTEM_ACTOR, t.id, 'create', '', '', '', 'Cấp ID cho dòng nhập tay'));
      });
      appendLogs_(logs);
      return r2;
    });
  }
  var all = Rules.annotateTasks(res.tasks, today_(), cfg.priorities);
  var va = Rules.can(user, 'viewAllConfig').ok;
  return {
    data: { tasks: Rules.visibleTasks(user, all) },
    meta: { serverTime: nowIso_(), sheetName: sh.getName(), configVersion: cfg.version, warnings: va ? res.warnings : [], aiEnabled: aiEnabled_() }
  };
}

function actionLog_(id, user, cfg) {
  if (!Rules.trim(id)) throw Rules.err('BAD_REQUEST', 'Yêu cầu không hợp lệ: thiếu id');
  var sh = getDataSheet_();
  var cur = findTask_(readAll_(sh, headerMap_(sh)).tasks, id);
  if (!cur || !Rules.can(user, 'view', cur).ok) throw notFound_(id);
  var va = Rules.can(user, 'viewAllConfig').ok;
  var lsh = ss_().getSheetByName(LOG_SHEET);
  if (!lsh || lsh.getLastRow() < 2) return [];
  var rows = lsh.getRange(2, 1, lsh.getLastRow() - 1, LOG_HEADERS.length).getDisplayValues();
  var out = [];
  for (var i = rows.length - 1; i >= 0 && out.length < 200; i--) {
    var r = rows[i];
    if (!sameId_(r[1], cur.id)) continue;
    if (!va && (r[3] === 'mail_error' || r[3] === 'delete')) continue;
    out.push({ ts: r[0], taskId: r[1], actor: r[2], action: r[3], field: r[4], oldValue: r[5], newValue: r[6], text: r[7] });
  }
  return out;
}

function draftKey_(id) { return 'draft_' + id; }
function validDraftId_(id) { return /^[0-9a-f]{32}$/.test(String(id || '')); }

function actionCreate_(body, user, cfg) {
  var p = Rules.can(user, 'create');
  if (!p.ok) throw forbidden_(p.reason);
  var cid = Rules.trim(body.clientRequestId);
  var cache = cache_();
  var crKey = cid ? 'va_cr_' + sha256Hex_(user.email + '|' + cid).slice(0, 40) : '';
  var draftId = Rules.trim(body.draftId);
  var draft = null;
  if (draftId) {
    if (!validDraftId_(draftId)) throw Rules.err('NOT_FOUND', 'Không tìm thấy bản nháp');
    draft = parseJson_(cache.get(draftKey_(draftId)), null);
    if (draft && draft.email !== user.email) throw Rules.err('NOT_FOUND', 'Không tìm thấy bản nháp');
  }
  var input = body.task && typeof body.task === 'object' ? body.task : {};
  var out = withLock_(function () {
    var sh = getDataSheet_();
    ensureHeaders_(sh);
    var hm = headerMap_(sh);
    var res = readAll_(sh, hm);
    if (crKey) {
      var prevId = cache.get(crKey);
      var prev = prevId ? findTask_(res.tasks, prevId) : null;
      if (prev && Rules.can(user, 'view', prev).ok) return { id: prev.id, fresh: false, sh: sh, hm: hm };
    }
    var ctx = ctxFor_(user, cfg);
    ctx.aiResult = draft && draft.last ? draft.last : null; // trusted: stored server-side by aiIntake
    var task = Rules.buildNewTask(input, ctx, res.tasks.map(function (t) { return t.id; }));
    var row = appendTaskRow_(sh, hm, res.lastDataRow, task);
    if (crKey) cache.put(crKey, task.id, 600);
    appendLogs_([logEntry_(user.name, task.id, 'create', '', '', '', task.name)]);
    SpreadsheetApp.flush();
    return { id: task.id, fresh: true, sh: sh, hm: hm, saved: readRow_(sh, hm, row) };
  });
  if (out.fresh) {
    if (draftId) cache.remove(draftKey_(draftId));
    notifyNew_(out.saved, cfg);
  }
  return annotatedTask_(out.sh, out.hm, cfg, out.id);
}

function actionUpdate_(body, user, cfg) {
  var id = Rules.trim(body.id);
  if (!id) throw Rules.err('BAD_REQUEST', 'Yêu cầu không hợp lệ: thiếu id');
  var changes = body.changes;
  if (!changes || typeof changes !== 'object' || Array.isArray(changes)) throw Rules.err('BAD_REQUEST', 'Yêu cầu không hợp lệ: thiếu changes');
  var base = body.base && typeof body.base === 'object' ? body.base : {};
  return withLock_(function () {
    var sh = getDataSheet_();
    ensureHeaders_(sh);
    var hm = headerMap_(sh);
    var ctx = ctxFor_(user, cfg);
    var all = annotatedAll_(sh, hm, cfg).tasks;
    var cur = findTask_(all, id);
    if (!cur || !Rules.can(user, 'view', cur).ok) throw notFound_(id);
    var opts = { note: body.note, force: !!body.force, skipTransitionCheck: !!body.skipTransitionCheck };
    var r = Rules.applyUpdate(cur, changes, base, opts, ctx);
    var keys = r.changedKeys.filter(function (k) { return !!hm.map[k]; });
    if (!keys.length) return { task: cur };
    writeChanges_(sh, cur._row, hm, r.task, keys);
    var ts = nowIso_();
    appendLogs_(r.logs.filter(function (l) { return l.action === 'status' || hm.map[l.field]; }).map(function (l) {
      return { ts: ts, taskId: cur.id, actor: user.name, action: l.action, field: l.field, oldValue: l.oldValue, newValue: l.newValue, text: l.text };
    }));
    SpreadsheetApp.flush();
    var after = readRow_(sh, hm, cur._row);
    var extra = afterStatusChange_(sh, hm, cfg, after, r.statusTo, Rules.trim(body.note), false, r.statusFrom);
    return { task: annotatedTask_(sh, hm, cfg, cur.id), cascade: extra && extra.cascade ? extra.cascade : null };
  });
}

/** Status change by "Hệ thống" (skips the matrix). Writes changed cells + status log. Returns the applyUpdate result or null. */
function systemStatus_(sh, hm, cfg, task, label, note, logText) {
  var r = Rules.applyUpdate(task, { status: label }, {}, { skipTransitionCheck: true, note: note || '' }, ctxFor_(Rules.systemUser(), cfg));
  var keys = r.changedKeys.filter(function (x) { return !!hm.map[x]; });
  if (!keys.length) return null;
  writeChanges_(sh, task._row, hm, r.task, keys);
  appendLogs_([logEntry_(Rules.SYSTEM_ACTOR, task.id, 'status', 'status', Rules.rawStatusLabel(task.status), label, logText || note || '')]);
  return r;
}

/** Notifications + parent auto-complete after a status change. */
function afterStatusChange_(sh, hm, cfg, task, to, note, auto, from) {
  if (!to) return null;
  if (to === 'review') notifyReview_(task);
  else if (to === 'changes_requested') notifyChanges_(task, cfg, note);
  else if (to === 'done') notifyDone_(task, cfg, auto);
  if ((to === 'done' || to === 'cancelled') && task.parentId) maybeCompleteParent_(sh, hm, cfg, task.parentId);
  if (to === 'changes_requested' && task.parentId) maybeReopenParent_(sh, hm, cfg, task, from, to);
  if (to === 'cancelled') return { cascade: cascadeCancel_(sh, hm, cfg, task) };
  return null;
}

/** Parent cancelled → cancel children still Mới (Hệ thống); report started ones. null when the task has no children. */
function cascadeCancel_(sh, hm, cfg, parent) {
  var res = readAll_(sh, hm);
  var kids = Rules.splitChildren(res.tasks, parent.id);
  if (!kids.length) return null;
  var plan = Rules.parentCancelCascade(parent, kids);
  var done = [];
  plan.cancel.forEach(function (id) {
    var c = findTask_(kids, id);
    if (c && systemStatus_(sh, hm, cfg, c, Rules.labelOf('cancelled'), plan.note)) done.push(c.id);
  });
  return { cancelled: done, kept: plan.kept };
}

/** Child of a completed parent reopened (done → changes_requested) → parent back to Mới. */
function maybeReopenParent_(sh, hm, cfg, child, from, to) {
  var parent = findTask_(readAll_(sh, hm).tasks, child.parentId);
  var plan = Rules.parentReopenPlan(parent, child, from, to);
  if (plan) systemStatus_(sh, hm, cfg, parent, plan.status, plan.note);
}

function maybeCompleteParent_(sh, hm, cfg, parentId) {
  var res = readAll_(sh, hm);
  var parent = findTask_(res.tasks, parentId);
  if (!parent) return;
  var k = Rules.normalizeStatus(parent.status);
  if (k === 'done' || k === 'cancelled') return;
  var pc = Rules.parentCompletion(parent, Rules.splitChildren(res.tasks, parent.id));
  if (!pc.allDone) return;
  systemStatus_(sh, hm, cfg, parent, Rules.labelOf('done'), '', 'Tất cả ' + pc.total + ' đợt đã hoàn thành');
}

function actionDelete_(body, user, cfg) {
  var id = Rules.trim(body.id);
  if (!id) throw Rules.err('BAD_REQUEST', 'Yêu cầu không hợp lệ: thiếu id');
  return withLock_(function () {
    var sh = getDataSheet_();
    var hm = headerMap_(sh);
    var res = readAll_(sh, hm);
    var cur = findTask_(res.tasks, id);
    if (!cur || !Rules.can(user, 'view', cur).ok) throw notFound_(id);
    var p = Rules.can(user, 'delete', cur);
    if (!p.ok) throw forbidden_(p.reason);
    if (Rules.splitChildren(res.tasks, cur.id).length) {
      var dm = 'Đơn này đã chia đợt — hãy xử lý/xóa các đợt con trước';
      throw Rules.err('VALIDATION', dm, { fields: { id: dm } });
    }
    var check = sh.getRange(cur._row, hm.map.id).getValue();
    if (!sameId_(check, cur.id)) throw Rules.err('CONFLICT', 'Dữ liệu đã thay đổi trên Google Sheet', { fields: ['id'], current: cur });
    var values = sh.getRange(cur._row, 1, 1, hm.lastCol).getValues()[0];
    var snap = {};
    var tz = tz_();
    values.forEach(function (v, i) {
      var h = Rules.trim(hm.headers[i]);
      var key = h ? h : '(col ' + colLetter_(i + 1) + ')';
      if (Object.prototype.hasOwnProperty.call(snap, key)) key = key + ' (col ' + colLetter_(i + 1) + ')';
      snap[key] = isDate_(v) ? Utilities.formatDate(v, tz, 'yyyy-MM-dd') : v;
    });
    sh.deleteRow(cur._row);
    props_().deleteProperty('rem_' + cur.id);
    appendLogs_([logEntry_(user.name, cur.id, 'delete', '', '', '', JSON.stringify(snap))]);
    return { id: cur.id };
  });
}

function actionAddComment_(body, user, cfg) {
  var id = Rules.trim(body.id);
  var text = Rules.trim(body.text);
  if (!id) throw Rules.err('BAD_REQUEST', 'Yêu cầu không hợp lệ: thiếu id');
  if (!text || text.length > 5000) throw Rules.err('VALIDATION', 'Dữ liệu không hợp lệ: bình luận cần 1–5000 ký tự', { fields: { text: 'Bình luận cần 1–5000 ký tự' } });
  return withLock_(function () {
    var sh = getDataSheet_();
    var cur = findTask_(readAll_(sh, headerMap_(sh)).tasks, id);
    if (!cur || !Rules.can(user, 'comment', cur).ok) throw notFound_(id);
    var e = logEntry_(user.name, cur.id, 'comment', '', '', '', text);
    appendLogs_([e]);
    return e;
  });
}

function actionSaveConfig_(body, user) {
  var p = Rules.can(user, 'saveConfig');
  if (!p.ok) throw forbidden_(p.reason);
  return withLock_(function () {
    var cur = readConfigRaw_() || createDefaultConfig_();
    if (Number(body.baseVersion) !== Number(cur.version)) {
      throw Rules.err('CONFLICT', 'Dữ liệu đã thay đổi trên Google Sheet', { fields: ['version'], current: configFor_(user, cur) });
    }
    var next = Rules.mergeConfig(body.config || {});
    var msg = Rules.validateConfig(next);
    if (msg) throw Rules.err('VALIDATION', 'Dữ liệu không hợp lệ: ' + msg, { fields: { config: msg } });
    next.version = Number(cur.version) + 1;
    next.updatedAt = nowIso_();
    writeConfig_(next);
    appendLogs_([logEntry_(user.name, '', 'config', '', '', '', 'Cập nhật danh mục')]);
    return configFor_(user, next);
  });
}

function actionSplit_(body, user, cfg) {
  var id = Rules.trim(body.id);
  if (!id) throw Rules.err('BAD_REQUEST', 'Yêu cầu không hợp lệ: thiếu id');
  return withLock_(function () {
    var sh = getDataSheet_();
    ensureHeaders_(sh);
    var hm = headerMap_(sh);
    var a = annotatedAll_(sh, hm, cfg);
    var parent = findTask_(a.tasks, id);
    if (!parent || !Rules.can(user, 'view', parent).ok) throw notFound_(id);
    var kids = Rules.planSplit(parent, body.parts, ctxFor_(user, cfg), a.res.tasks.map(function (t) { return t.id; }));
    var last = a.res.lastDataRow;
    kids.forEach(function (k) { last = appendTaskRow_(sh, hm, last, k); });
    var logs = [logEntry_(user.name, parent.id, 'split', '', '', '', 'Chia thành ' + kids.length + ' đợt: ' + kids.map(function (k) { return k.id; }).join(', '))];
    kids.forEach(function (k) { logs.push(logEntry_(user.name, k.id, 'create', '', '', '', k.name + ' (đợt của ' + parent.id + ')')); });
    appendLogs_(logs);
    SpreadsheetApp.flush();
    var all = annotatedAll_(sh, hm, cfg).tasks;
    return { parent: findTask_(all, parent.id), children: kids.map(function (k) { return findTask_(all, k.id); }) };
  });
}

// ---------- AI intake ----------
function aiQuotaTake_(email) {
  var key = 'aiq_' + today_().replace(/-/g, '') + '_' + sha256Hex_(email).slice(0, 16);
  return withLock_(function () {
    var p = props_();
    var n = Number(p.getProperty(key) || 0);
    if (n >= AI_DAILY_LIMIT) return false;
    p.setProperty(key, String(n + 1));
    return true;
  });
}
function deepseekAttempt_(key, messages, cfg, sctx) {
  var content = '';
  try {
    var resp = UrlFetchApp.fetch(DEEPSEEK_URL, {
      method: 'post', contentType: 'application/json', headers: { Authorization: 'Bearer ' + key },
      payload: JSON.stringify({ model: 'deepseek-chat', temperature: 0.2, max_tokens: 900, response_format: { type: 'json_object' }, messages: messages }),
      muteHttpExceptions: true
    });
    var code = resp.getResponseCode();
    if (code !== 200) throw Rules.err('AI_HTTP', 'DeepSeek HTTP ' + code);
    var j = parseJson_(resp.getContentText(), null);
    content = j && j.choices && j.choices[0] && j.choices[0].message ? j.choices[0].message.content : null;
    if (typeof content !== 'string') throw Rules.err('AI_BAD_OUTPUT', 'AI không trả nội dung');
    return { content: content, result: Rules.sanitizeAiResult(Rules.parseAiJson(content), cfg, sctx) };
  } catch (e) {
    e.aiContent = typeof content === 'string' ? content : '';
    throw e;
  }
}
function actionAiIntake_(body, user, cfg) {
  var p = Rules.can(user, 'create');
  if (!p.ok) throw forbidden_(p.reason);
  var key = Rules.trim(props_().getProperty('DEEPSEEK_API_KEY'));
  if (!key) throw Rules.err('AI_UNAVAILABLE', 'AI chưa được bật, vui lòng điền form thủ công');
  var cache = cache_();
  var draftId = Rules.trim(body.draftId);
  var draft = null;
  if (draftId) {
    draft = validDraftId_(draftId) ? parseJson_(cache.get(draftKey_(draftId)), null) : null;
    if (!draft || draft.email !== user.email) throw Rules.err('NOT_FOUND', 'Bản nháp đã hết hạn, vui lòng gửi lại');
  } else {
    draftId = uuidHex_();
    draft = { email: user.email, rounds: 0, history: [], last: null, input: {} };
  }
  var prev = draft.input || {};
  var pick = function (k) { return body[k] !== undefined ? body[k] : prev[k]; };
  var input = {
    message: Rules.trim(body.message), answers: Array.isArray(body.answers) ? body.answers.slice(0, 10).map(function (a) { return Rules.trim(a).slice(0, 1000); }) : [],
    team: user.team, project: Rules.trim(pick('project')), urgent: pick('urgent') === true,
    urgentReason: Rules.trim(pick('urgentReason')), briefLink: Rules.trim(pick('briefLink')), deadline: Rules.trim(pick('deadline'))
  };
  var fields = {};
  if (!draft.rounds && !input.message) fields.message = 'Hãy mô tả bạn cần team VA làm gì';
  if (input.message.length > Rules.MAX_ORDER_CHARS) fields.message = 'Tối đa ' + Rules.MAX_ORDER_CHARS + ' ký tự';
  if (draft.rounds && !input.message && !input.answers.some(function (a) { return !!a; })) fields.answers = 'Hãy trả lời ít nhất một câu hỏi';
  if (!input.project || input.project.length > 100) fields.project = 'Bắt buộc chọn Dự án';
  if (input.urgent && input.urgentReason.length < 5) fields.urgentReason = 'Cần lý do gấp (ít nhất 5 ký tự)';
  if (input.urgentReason.length > 500) fields.urgentReason = 'Tối đa 500 ký tự';
  if (input.deadline && !Rules.isValidYmd(input.deadline)) fields.deadline = 'Ngày không hợp lệ';
  if (Object.keys(fields).length) throw Rules.err('VALIDATION', 'Dữ liệu không hợp lệ: ' + Rules.firstMessage(fields), { fields: fields });
  if (!aiQuotaTake_(user.email)) throw Rules.err('AI_UNAVAILABLE', 'Bạn đã dùng hết ' + AI_DAILY_LIMIT + ' lượt AI hôm nay, vui lòng điền form thủ công');

  var round = (Number(draft.rounds) || 0) + 1;
  var today = today_();
  var mctx = { today: today, round: round, maxRounds: Rules.MAX_AI_ROUNDS, history: draft.history || [],
    lastQuestions: draft.last ? draft.last.questions || [] : [] };
  var sctx = { today: today, urgent: input.urgent, round: round, maxRounds: Rules.MAX_AI_ROUNDS };
  var messages = Rules.buildAiMessages(input, cfg, mctx);
  var out;
  try { out = deepseekAttempt_(key, messages, cfg, sctx); }
  catch (e1) {
    var retry = messages.slice();
    if (e1.aiContent) retry.push({ role: 'assistant', content: String(e1.aiContent).slice(0, 4000) });
    retry.push({ role: 'user', content: Rules.AI_RETRY_PROMPT });
    try { out = deepseekAttempt_(key, retry, cfg, sctx); }
    catch (e2) { throw Rules.err('AI_UNAVAILABLE', 'AI tạm thời không khả dụng, vui lòng điền form thủ công'); }
  }
  draft.rounds = round;
  draft.last = out.result;
  draft.input = { project: input.project, urgent: input.urgent, urgentReason: input.urgentReason, briefLink: input.briefLink, deadline: input.deadline };
  draft.history = messages.slice(1).concat([{ role: 'assistant', content: JSON.stringify(out.result) }]);
  var s = JSON.stringify(draft);
  while (s.length > 90000 && draft.history.length > 2) { draft.history.splice(1, 2); s = JSON.stringify(draft); }
  cache.put(draftKey_(draftId), s, DRAFT_TTL_SEC);
  return { draftId: draftId, status: out.result.status, round: round, questions: out.result.questions, result: out.result };
}

// ============================================================================
// Daily job (trigger 8h): auto-approve, reminders, cleanup
// ============================================================================
function installDailyTrigger_() {
  var ts = ScriptApp.getProjectTriggers().filter(function (t) { return t.getHandlerFunction() === 'dailyJob'; });
  for (var i = 1; i < ts.length; i++) ScriptApp.deleteTrigger(ts[i]);
  if (ts.length) return 'đã có (8h hằng ngày)';
  ScriptApp.newTrigger('dailyJob').timeBased().everyDays(1).atHour(8).create();
  return 'đã cài (8h hằng ngày)';
}

function dailyJob() {
  PENDING_MAIL_ = [];
  LOCK_DEPTH_ = 0;
  var sum = { approved: [], reminded: [], remCleared: 0, sessionsRemoved: 0, quotaRemoved: 0, errors: [] };
  // whole pass under the script lock (sheet writes + rem_/sess_ property bookkeeping); mail is sent after release
  try { withLock_(function () { dailyJobLocked_(sum); }); }
  catch (e0) { sum.errors.push('lock: ' + e0.message); }
  // Thứ Hai: báo cáo tuần cho quản trị viên + VA
  try { if (new Date(today_() + 'T12:00:00Z').getUTCDay() === 1) weeklyReport_(sum); }
  catch (e1) { sum.errors.push('weekly: ' + e1.message); }
  flushMail_();
  Logger.log('dailyJob ' + today_() + ': ' + JSON.stringify(sum));
  return sum;
}

function dailyJobLocked_(sum) {
  var cfg = getConfig_();
  var today = today_();
  var p = props_();
  var all = p.getProperties();
  try {
    var sh = getDataSheet_();
    var hm = headerMap_(sh);
    var tasks = readAll_(sh, hm).tasks;
    var inReview = {};
    tasks.forEach(function (t) {
      if (Rules.normalizeStatus(t.status) !== 'review') return;
      inReview[t.id] = t.reviewDate;
      var st = Rules.autoApproveState(t, today);
      try {
        if (st === 'approve') {
          var done = withLock_(function () {
            var hm2 = headerMap_(sh);
            var cur = findTask_(readAll_(sh, hm2).tasks, t.id);
            if (!cur || Rules.autoApproveState(cur, today) !== 'approve') return null;
            var r = Rules.applyUpdate(cur, { status: Rules.labelOf('done') }, {}, { note: 'Tự duyệt sau 3 ngày làm việc' }, ctxFor_(Rules.systemUser(), cfg));
            var keys = r.changedKeys.filter(function (k) { return !!hm2.map[k]; });
            writeChanges_(sh, cur._row, hm2, r.task, keys);
            appendLogs_(r.logs.map(function (l) { return logEntry_(Rules.SYSTEM_ACTOR, cur.id, l.action, l.field, l.oldValue, l.newValue, l.text); }));
            SpreadsheetApp.flush();
            var after = readRow_(sh, hm2, cur._row);
            afterStatusChange_(sh, hm2, cfg, after, 'done', '', true);
            return after;
          });
          if (done) { sum.approved.push(done.id); delete inReview[t.id]; }
        } else if (st === 'remind') {
          var rk = 'rem_' + t.id;
          if (all[rk] !== t.reviewDate) {
            notifyRemind_(t);
            p.setProperty(rk, t.reviewDate);
            all[rk] = t.reviewDate;
            sum.reminded.push(t.id);
          }
        }
      } catch (e) { sum.errors.push(t.id + ': ' + e.message); }
    });
    Object.keys(all).forEach(function (k) {
      if (k.indexOf('rem_') !== 0) return;
      var id = k.slice(4);
      if (!Object.prototype.hasOwnProperty.call(inReview, id) || inReview[id] !== all[k]) { p.deleteProperty(k); sum.remCleared++; }
    });
  } catch (e) { sum.errors.push('autoApprove: ' + e.message); }
  try {
    var now = Date.now(), todayKey = today.replace(/-/g, '');
    Object.keys(all).forEach(function (k) {
      if (k.indexOf('sess_') === 0) {
        var s = parseJson_(all[k], null);
        if (!s || !(Number(s.exp) > now)) { p.deleteProperty(k); sum.sessionsRemoved++; }
      } else if (k.indexOf('aiq_') === 0) {
        if (k.slice(4, 12) < todayKey) { p.deleteProperty(k); sum.quotaRemoved++; }
      }
    });
  } catch (e2) { sum.errors.push('cleanup: ' + e2.message); }
}

// ============================================================================
// migrateV2 — run once by hand (safe to re-run)
// ============================================================================
function migrateV2() {
  LOCK_DEPTH_ = 0;
  return withLock_(function () {
    var ss = ss_();
    var sh = getDataSheet_();
    var tz = tz_();
    var bname = BACKUP_PREFIX + Utilities.formatDate(new Date(), tz, 'yyyyMMdd_HHmm'); // + '_2', '_3'… if run twice in a minute
    var nm = bname, i = 2;
    while (ss.getSheetByName(nm)) nm = bname + '_' + (i++);
    sh.copyTo(ss).setName(nm);
    var added = ensureHeaders_(sh);
    SpreadsheetApp.flush();
    var hm = headerMap_(sh);
    var cfg = getConfig_();
    var res = readAll_(sh, hm);
    var cnt = { assignedToNew: 0, holdToInProgress: 0, holdToNew: 0, revisionCountSet: 0, requesterEmailSet: 0, rowsChanged: 0 };
    var logs = [];
    var emailByName = {};
    cfg.members.forEach(function (m) { if (Rules.isValidEmail(m.email) && !emailByName[Rules.normText(m.name)]) emailByName[Rules.normText(m.name)] = Rules.normEmail(m.email); });
    var revRows = [];
    res.tasks.forEach(function (t) {
      var ch = {}, notes = [];
      var k = Rules.normalizeStatus(t.status);
      if (k === 'legacy_assigned') { ch.status = Rules.labelOf('new'); cnt.assignedToNew++; notes.push('Đã giao → Mới (giữ assignee)'); }
      else if (k === 'legacy_on_hold') {
        if (Rules.trim(t.assignee)) { ch.status = Rules.labelOf('in_progress'); cnt.holdToInProgress++; }
        else { ch.status = Rules.labelOf('new'); cnt.holdToNew++; }
        notes.push('Tạm dừng → ' + ch.status);
        if (!Rules.trim(t.holdReason) && hm.map.holdReason) ch.holdReason = 'Tạm dừng (dữ liệu cũ)';
      }
      if (hm.map.requesterEmail && !Rules.trim(t.requesterEmail) && Rules.trim(t.requester)) {
        var em = emailByName[Rules.normText(t.requester)];
        if (em) { ch.requesterEmail = em; cnt.requesterEmailSet++; notes.push('Gmail người order = ' + em); }
      }
      var revNeeded = hm.map.revisionCount && (t.revisionCount === null || t.revisionCount === undefined || t.revisionCount === '');
      if (revNeeded) { revRows.push(t._row); cnt.revisionCountSet++; notes.push('Số lần sửa = 0'); }
      var keys = Object.keys(ch).filter(function (x) { return !!hm.map[x]; });
      if (keys.length) writeChanges_(sh, t._row, hm, ch, keys);
      if (keys.length || revNeeded) {
        cnt.rowsChanged++;
        logs.push(logEntry_(Rules.SYSTEM_ACTOR, t.id, 'migrate', keys.concat(revNeeded ? ['revisionCount'] : []).join(','),
          ch.status ? Rules.trim(t.status) : '', ch.status || '', notes.join('; ')));
      }
    });
    if (revRows.length) {
      var col = hm.map.revisionCount;
      var first = revRows[0], last = revRows[revRows.length - 1];
      var rng = sh.getRange(first, col, last - first + 1, 1);
      var hasFormula = rng.getFormulas().some(function (r) { return r[0] !== ''; });
      if (hasFormula) {
        revRows.forEach(function (r) { var c = sh.getRange(r, col); if (c.getFormula() === '') writeCell_(sh, r, col, 'revisionCount', 0); });
      } else {
        var vals = rng.getValues();
        var set = {}; revRows.forEach(function (r) { set[r] = true; });
        for (var j = 0; j < vals.length; j++) if (set[first + j]) vals[j][0] = 0;
        rng.setValues(vals);
      }
    }
    appendLogs_(logs);
    var msg = 'migrateV2 xong. Sao lưu: "' + nm + '". Cột mới: ' + (added.join(', ') || 'không có') + '. ' +
      'Đã giao→Mới: ' + cnt.assignedToNew + ', Tạm dừng→Đang làm: ' + cnt.holdToInProgress + ', Tạm dừng→Mới: ' + cnt.holdToNew +
      ', điền Số lần sửa: ' + cnt.revisionCountSet + ', điền Gmail người order: ' + cnt.requesterEmailSet + ', tổng dòng đổi: ' + cnt.rowsChanged + '.';
    Logger.log(msg);
    return { message: msg, backup: nm, addedHeaders: added, counts: cnt };
  });
}
