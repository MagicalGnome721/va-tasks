// ============================================================================
// Bạn đồng hành (mascot) — chào khi vào app, gợi ý việc tiếp theo, phản ứng theo
// thao tác. Câu thoại viết sẵn + số liệu thật (không tốn lượt AI). VA hỏi tự do
// thì chuyển sang Trợ lý AI (DeepSeek).
// Ảnh nhân vật do team cung cấp (ASSETS.*); chỉ dùng nội bộ.
// ============================================================================
// Cún = quản gia của team VA, nói chuyện kiểu GenZ. Chỉ dùng nội bộ.
const BUDDY_NAME = 'Cún';
const Buddy = {
  el: null, open: false, mood: 'wave', line: '', sub: '', chips: [], typing: null, hideTimer: null, idleTimer: null,
  snacked: false, greetedSession: '', busy: false, answer: null,
};
const MOOD_IMG = () => ({ wave: ASSETS.mascotWave, smile: ASSETS.mascotSmile, tired: ASSETS.mascotTired, snack: ASSETS.mascotSnack });
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
// "Xáo bài": nói hết cả nhóm câu (thứ tự ngẫu nhiên) rồi mới lặp lại; nhớ qua lần tải trang.
const BAG_MEM = {};
function say(key, vars) {
  const pool = BUDDY_LINES[key] || [];
  if (!pool.length) return '';
  const lk = 'va.buddy.bag.' + key;
  let bag = BAG_MEM[key];
  if (!bag) { try { bag = JSON.parse(LS.raw(lk) || 'null'); } catch (e) { bag = null; } }
  if (!bag || !Array.isArray(bag.q) || bag.n !== pool.length) bag = { n: pool.length, q: [], last: -1 };
  if (!bag.q.length) {
    bag.q = pool.map((_, i) => i);
    for (let i = bag.q.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [bag.q[i], bag.q[j]] = [bag.q[j], bag.q[i]]; }
    if (bag.q.length > 1 && bag.q[0] === bag.last) bag.q.push(bag.q.shift()); // không lặp câu vừa nói khi sang vòng mới
  }
  const i = bag.q.shift(); bag.last = i; BAG_MEM[key] = bag;
  try { LS.setRaw(lk, JSON.stringify(bag)); } catch (e) { /* bộ nhớ trình duyệt bị chặn: vẫn chạy trong phiên */ }
  return pool[i].replace(/\{(\w+)\}/g, (m, k) => (vars && vars[k] != null ? String(vars[k]) : ''));
}
const buddyOff = () => LS.raw('va.buddy.off') === '1';
const reducedMotion = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function firstName(n) { const p = trim(n).split(/\s+/); return p[p.length - 1] || 'bạn'; }
function timeGreeting() {
  const h = new Date().getHours();
  return say(h < 5 ? 'night' : h < 11 ? 'morning' : h < 13 ? 'noon' : h < 18 ? 'afternoon' : h < 22 ? 'evening' : 'night');
}
function hello(u) {
  const n = firstName(u.name);
  return `${say('hello', { n })} ${timeGreeting()}`;
}

// ---------- what to say, from real data ----------
function buddyContext() {
  const u = S.user;
  const out = { mood: 'wave', line: '', sub: '', chips: [] };
  if (!u) return out;
  const mine = S.tasks.filter((t) => isMine(t) && ['in_progress', 'changes_requested'].includes(statusKey(t)));
  const fix = mine.filter((t) => statusKey(t) === 'changes_requested');
  const overdue = S.tasks.filter((t) => Rules.isOpen(t) && dlState(t).state === 'overdue' && (isVA() ? (isMine(t) || colKey(t) === 'new') : isOwnOrder(t)));
  if (isVA()) {
    let queue = [];
    try { queue = Rules.queueSort(S.tasks.filter((t) => !t._tmp && !onHold(t)), today(), S.config.priorities) || []; } catch (e) { queue = []; }
    const top = queue[0];
    if (overdue.length) { out.mood = 'tired'; out.sub = say('overdue', { c: overdue.length }); }
    else if (fix.length) { out.mood = 'smile'; out.sub = say('fix', { c: fix.length }); }
    else if (top) { out.mood = 'smile'; out.sub = say('top', { id: top.id, name: top.name }); }
    else { out.mood = 'snack'; out.sub = say('empty'); }
    if (u.isOwner && S.aiEnabled === false) out.sub += say('nokey');
    out.chips = [];
    if (top) out.chips.push({ k: 'claim-top', t: 'Hôm nay làm gì trước?' });
    out.chips.push({ k: 'my-tasks', t: 'Check task của tôi' });
    if (S.aiEnabled !== false) out.chips.push({ k: 'ai-plan', t: 'Nhờ AI xếp lịch' });
    out.chips.push({ k: 'new', t: 'Giao task mới' });
  } else {
    const own = S.tasks.filter(isOwnOrder);
    const review = own.filter((t) => statusKey(t) === 'review');
    const waiting = own.filter((t) => colKey(t) === 'new');
    if (review.length) { out.mood = 'smile'; out.sub = say('req_review', { c: review.length }); }
    else if (waiting.length) { const pos = Math.min(...waiting.map((t) => (queueInfoOf(t) || {}).position || 999)); out.sub = say('req_waiting', { c: waiting.length, pos: pos < 999 ? `, sớm nhất ở vị trí #${pos}` : '' }); }
    else out.sub = say('req_idle');
    out.chips = [{ k: 'new', t: 'Giao task mới' }, { k: 'mine', t: 'Kiểm tra task' }];
    if (review.length) out.chips.unshift({ k: 'review', t: `Duyệt ${review.length} đơn ngay` });
  }
  out.chips.push({ k: 'later', t: 'Để sau nha' });
  return out;
}

// ---------- render ----------
function buddyHtml() {
  const B = Buddy;
  const img = MOOD_IMG()[B.mood] || ASSETS.mascotWave;
  return `<button type="button" class="buddy-ava" data-buddy="toggle" aria-expanded="${B.open}" aria-label="${B.open ? 'Thu nhỏ' : 'Mở'} ${BUDDY_NAME} — quản gia của team VA" title="${BUDDY_NAME}"><img src="${img}" alt="" draggable="false"></button>
    ${B.open ? `<aside class="buddy-bubble" aria-label="${BUDDY_NAME} nói" data-testid="buddy-bubble">
      <button type="button" class="icon-btn icon-btn-sm buddy-x" data-buddy="close" aria-label="Đóng">${ICONS.x}</button>
      <p class="buddy-line" aria-live="polite"><b>${esc(B.line)}</b></p>
      ${B.sub ? `<p class="buddy-sub" data-buddy-sub>${esc(B.sub)}</p>` : ''}
      ${B.answer ? `<div class="buddy-answer">${B.answer}</div>` : ''}
      ${B.chips.length ? `<div class="buddy-chips">${B.chips.map((c) => `<button type="button" class="buddy-chip" data-buddy-chip="${esc(c.k)}">${esc(c.t)}</button>`).join('')}</div>` : ''}
      ${isVA() && S.aiEnabled !== false ? `<form class="buddy-ask" data-buddy-form><input type="text" id="buddy-q" placeholder="Hỏi ${BUDDY_NAME} gì cũng được…" maxlength="300" autocomplete="off" ${B.busy ? 'disabled' : ''}><button type="submit" class="btn btn-sm btn-primary" ${B.busy ? 'disabled' : ''}>${B.busy ? '<span class="saving-spin" aria-hidden="true"></span>' : 'Hỏi'}</button></form>` : ''}
    </aside>` : ''}`;
}
function renderBuddy() {
  if (!Buddy.el) return;
  const show = !!S.user && !buddyOff() && !document.body.classList.contains('is-login');
  Buddy.el.hidden = !show;
  if (!show) return;
  const hadFocus = Buddy.el.contains(document.activeElement) ? document.activeElement.id : '';
  Buddy.el.innerHTML = buddyHtml();
  Buddy.el.dataset.open = String(Buddy.open);
  Buddy.el.dataset.mood = Buddy.mood;
  if (hadFocus) { const f = document.getElementById(hadFocus); if (f) f.focus(); }
}
// Typewriter for the sub line (skipped with reduced motion).
function typeSub() {
  clearInterval(Buddy.typing);
  const p = Buddy.el && Buddy.el.querySelector('[data-buddy-sub]');
  if (!p || reducedMotion()) return;
  const full = Buddy.sub; let i = 0;
  p.textContent = '';
  Buddy.typing = setInterval(() => { i += 2; p.textContent = full.slice(0, i); if (i >= full.length) clearInterval(Buddy.typing); }, 18);
}
function buddySay(o) {
  if (buddyOff() || !S.user) return;
  Object.assign(Buddy, { open: true, answer: null }, o);
  Buddy.el.classList.remove('is-pop'); void Buddy.el.offsetWidth; Buddy.el.classList.add('is-pop');
  renderBuddy(); typeSub();
  clearTimeout(Buddy.hideTimer);
  if (o.autoHide) Buddy.hideTimer = setTimeout(() => { if (!Buddy.el.contains(document.activeElement)) buddyClose(); }, o.autoHide);
}
function buddyClose() { clearTimeout(Buddy.hideTimer); Buddy.open = false; Buddy.answer = null; Buddy.mood = idleMood(); renderBuddy(); }
function idleMood() {
  const overdue = S.tasks.some((t) => Rules.isOpen(t) && dlState(t).state === 'overdue' && (isVA() ? isMine(t) : isOwnOrder(t)));
  return overdue ? 'tired' : 'smile';
}

// ---------- entry greeting ----------
async function buddyGreet() {
  if (!S.user || buddyOff()) return;
  const key = S.user.email + '|' + today();
  if (Buddy.greetedSession === key + '|' + S.session.token) return;
  Buddy.greetedSession = key + '|' + S.session.token;
  for (let i = 0; i < 40 && !S.loaded; i++) await sleep(100);
  if (!S.user) return;
  const ctx = buddyContext();
  const firstToday = LS.raw('va.buddy.day') !== key;
  LS.setRaw('va.buddy.day', key);
  buddySay({ mood: firstToday ? 'wave' : ctx.mood, line: hello(S.user), sub: ctx.sub, chips: firstToday ? ctx.chips : ctx.chips.slice(0, 2).concat([{ k: 'later', t: 'Ok' }]), autoHide: firstToday ? 20000 : 9000 });
  armIdle();
}
function armIdle() {
  clearTimeout(Buddy.idleTimer);
  if (Buddy.snacked) return;
  Buddy.idleTimer = setTimeout(() => {
    if (!S.user || Buddy.open || document.hidden) { armIdle(); return; }
    Buddy.snacked = true;
    buddySay({ mood: 'snack', line: say('idle'), sub: '', chips: [], autoHide: 7000 });
  }, 4 * 60 * 1000);
}

// ---------- reactions to what just happened ----------
const REACT = {
  in_progress: { mood: 'smile', key: 'st_in_progress' }, review: { mood: 'smile', key: 'st_review' },
  done: { mood: 'snack', key: 'st_done' }, changes_requested: { mood: 'tired', key: 'st_changes' },
  cancelled: { mood: 'tired', key: 'st_cancelled' }, created: { mood: 'wave', key: 'st_created' },
  error: { mood: 'tired', key: 'st_error' },
};
function buddyReact(kind) {
  const r = REACT[kind]; if (!r || buddyOff() || !S.user) return;
  buddySay({ mood: r.mood, line: say(r.key), sub: '', chips: [], autoHide: 4500 });
  armIdle();
}

// Người order vừa mở form tạo đơn: nhắc điền kỹ vì AI dùng thông tin để xếp ưu tiên.
function buddyOrderTip() {
  if (isVA() || buddyOff() || !S.user) return;
  buddyClose();
  let d = document.getElementById('buddy-pop');
  if (d) d.remove();
  d = document.createElement('dialog');
  d.id = 'buddy-pop'; d.className = 'buddy-pop'; d.dataset.testid = 'buddy-pop';
  d.setAttribute('aria-labelledby', 'buddy-pop-title');
  d.innerHTML = `<div class="buddy-pop-card">
    <img src="${ASSETS.mascotWave}" alt="" draggable="false">
    <button type="button" class="icon-btn buddy-pop-x" data-pop-close aria-label="Đóng">${ICONS.x}</button>
    <h2 class="buddy-pop-title" id="buddy-pop-title">Gâu! Khoan đã, nghe ${BUDDY_NAME} dặn nè ✍️</h2>
    <p class="buddy-pop-text">Điền thông tin <b>thật kỹ</b> nha — AI sẽ đọc đơn của bạn để sắp xếp <b>mức độ ưu tiên</b>.</p>
    <p class="buddy-pop-boss">Tuy nhiên, yêu cầu của sếp vẫn là nhất 👑</p>
    <button type="button" class="btn btn-brand buddy-pop-ok" data-pop-close>Ok, mình hiểu rồi!</button>
  </div>`;
  document.body.appendChild(d);
  const close = () => { if (d.open) d.close(); };
  d.addEventListener('click', (e) => { if (e.target === d || e.target.closest('[data-pop-close]')) close(); });
  d.addEventListener('close', () => { d.remove(); const f = document.querySelector('#main input, #main textarea'); if (f) f.focus(); });
  d.showModal();
  d.querySelector('.buddy-pop-ok').focus();
}

// ---------- chips & questions ----------
function myTasksAnswer() {
  const list = isVA()
    ? (Rules.myWorkSort(S.tasks, myName(), today(), S.config.priorities) || [])
    : S.tasks.filter((t) => isOwnOrder(t) && Rules.isOpen(t));
  if (!list.length) return { sub: isVA() ? 'Sếp chưa nhận việc nào nè. Đơn đầu hàng đang đợi đó!' : 'Bạn chưa có đơn nào đang chạy.', answer: null };
  const rows = list.slice(0, 4).map((t) => `<li><button type="button" class="id-link" data-buddy-open="${esc(t.id)}">${esc(t.id)}</button> ${esc(t.name)} <span class="muted">· ${esc(statusLabelOf(t))}${trim(t.deadline) ? ' · hạn ' + esc(fmtDM(t.deadline)) : ''}</span></li>`).join('');
  return { sub: `Bạn có ${list.length} đơn đang chạy:`, answer: `<ul>${rows}</ul>${list.length > 4 ? `<p class="muted">…và ${list.length - 4} đơn nữa</p>` : ''}` };
}
function onBuddyChip(k) {
  switch (k) {
    case 'later': buddyClose(); return;
    case 'new': buddyClose(); App.openNew(); return;
    case 'mine': buddyClose(); location.hash = '#/mine'; return;
    case 'review': buddyClose(); location.hash = '#/mine'; return;
    case 'ai-plan': buddyClose(); AiUi.tab = 'plan'; location.hash = '#/ai'; return;
    case 'claim-top': {
      buddyClose(); location.hash = '#/queue';
      setTimeout(() => { const r = document.querySelector('[data-testid^="queue-row-"]'); if (r) { r.scrollIntoView({ block: 'center', behavior: reducedMotion() ? 'auto' : 'smooth' }); r.classList.add('is-spot'); r.focus({ preventScroll: true }); setTimeout(() => r.classList.remove('is-spot'), 2400); } }, 120);
      return;
    }
    case 'my-tasks': { const a = myTasksAnswer(); Object.assign(Buddy, { mood: 'smile', line: say('checking'), sub: a.sub, chips: [{ k: 'later', t: 'Ok' }] }); renderBuddy(); if (a.answer) { Buddy.answer = a.answer; renderBuddy(); } return; }
    default: break;
  }
}
async function buddyAsk(q) {
  if (Buddy.busy || q.length < 3 || !guardOnline()) return;
  Buddy.busy = true; Buddy.line = say('thinking'); Buddy.sub = q; Buddy.answer = null; Buddy.chips = []; renderBuddy();
  try {
    const r = await S.api.aiAssist({ mode: 'ask', question: q }, auth());
    AiUi.thread.push({ role: 'user', text: q }, { role: 'ai', r });
    const txt = trim(r.answer);
    Buddy.mood = (r.risks || []).some((x) => x.level === 'high') ? 'tired' : 'smile';
    Buddy.line = 'Nè:'; Buddy.sub = '';
    Buddy.answer = aiTextHtml(txt.length > 420 ? txt.slice(0, 420) + '…' : txt);
    Buddy.chips = [{ k: 'ai-full', t: 'Xem đầy đủ' }, { k: 'later', t: 'Oke cảm ơn' }];
  } catch (e0) {
    const e = toApiError(e0);
    if (e.code === 'UNAUTHORIZED') { Buddy.busy = false; App.onUnauthorized(); return; }
    Buddy.mood = 'tired'; Buddy.line = say('stuck'); Buddy.sub = e.message; Buddy.chips = [{ k: 'later', t: 'Ok' }];
  }
  Buddy.busy = false; renderBuddy();
}
function bindBuddy() {
  const el = document.createElement('div');
  el.className = 'buddy'; el.id = 'buddy'; el.hidden = true; el.dataset.testid = 'buddy';
  document.body.appendChild(el);
  Buddy.el = el;
  el.addEventListener('click', (e) => {
    const t = e.target;
    const b = t.closest('[data-buddy]');
    if (b) {
      if (b.dataset.buddy === 'close') { buddyClose(); return; }
      if (Buddy.open) { buddyClose(); return; }
      const ctx = buddyContext();
      buddySay({ mood: ctx.mood, line: say('peek'), sub: ctx.sub, chips: ctx.chips });
      return;
    }
    const c = t.closest('[data-buddy-chip]');
    if (c) { if (c.dataset.buddyChip === 'ai-full') { buddyClose(); AiUi.tab = 'ask'; location.hash = '#/ai'; } else onBuddyChip(c.dataset.buddyChip); return; }
    const o = t.closest('[data-buddy-open]'); if (o) { buddyClose(); App.openTask(o.dataset.buddyOpen); }
  });
  el.addEventListener('submit', (e) => { e.preventDefault(); const i = $('#buddy-q'); if (i) buddyAsk(trim(i.value)); });
  el.addEventListener('keydown', (e) => { if (e.key === 'Escape' && Buddy.open) { e.stopPropagation(); buddyClose(); el.querySelector('.buddy-ava').focus(); } });
  ['pointerdown', 'keydown'].forEach((ev) => document.addEventListener(ev, () => armIdle(), { passive: true }));
  // the bubble overlays content, so a click elsewhere dismisses it
  document.addEventListener('pointerdown', (e) => {
    if (Buddy.open && !el.contains(e.target)) buddyClose();
  }, true);
}

// ---------- màn hình đăng nhập: bấm vào Cún → câu trêu, càng chọc càng gắt ----------
const LoginPoke = { n: 0, reset: null };
document.addEventListener('click', (e) => {
  const btn = e.target.closest && e.target.closest('[data-lg-poke]');
  if (!btn) return;
  const box = btn.closest('.lg-mascot'); const bubble = box && box.querySelector('.lg-say'); const img = btn.querySelector('img');
  LoginPoke.n += 1;
  const lvl = LoginPoke.n <= 2 ? 1 : LoginPoke.n <= 4 ? 2 : 3;
  if (bubble) {
    bubble.textContent = say('poke' + lvl);
    bubble.classList.remove('is-pop'); void bubble.offsetWidth; bubble.classList.add('is-pop');
    bubble.classList.toggle('is-angry', lvl === 3);
  }
  if (img) {
    img.src = lvl === 1 ? ASSETS.mascotSmile : ASSETS.mascotTired;
    btn.classList.remove('is-shake', 'is-bite'); void btn.offsetWidth; btn.classList.add(lvl === 3 ? 'is-bite' : 'is-shake');
  }
  clearTimeout(LoginPoke.reset); LoginPoke.reset = setTimeout(() => { LoginPoke.n = 0; }, 8000); // để yên 8 giây là Cún nguôi
});
