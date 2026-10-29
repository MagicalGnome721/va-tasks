// ============================================================================
// Toasts
// ============================================================================
function toast(message, opts = {}) {
  const type = opts.type || 'success';
  const root = $('#toast-root');
  const el = document.createElement('div');
  el.className = 'toast';
  el.setAttribute('data-testid', 'toast');
  el.dataset.type = type;
  el.setAttribute('role', type === 'error' ? 'alert' : 'status');
  el.setAttribute('aria-live', type === 'error' ? 'assertive' : 'polite');
  let html = `<span class="msg">${esc(message)}</span>`;
  if (opts.action) html += `<button type="button" data-act="action">${esc(opts.action.label)}</button>`;
  if (opts.undo) html += `<button type="button" data-testid="toast-undo" data-act="undo">Hoàn tác</button>`;
  if (opts.retry) html += `<button type="button" data-testid="toast-retry" data-act="retry">Thử lại</button>`;
  if (type === 'error') html += `<button type="button" class="toast-x" data-act="close" aria-label="Đóng thông báo">${ICONS.close}</button>`;
  el.innerHTML = html;
  const close = () => { if (el.parentNode) el.parentNode.removeChild(el); };
  el.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    const act = b.dataset.act; close();
    if (act === 'undo') opts.undo(); else if (act === 'retry') opts.retry(); else if (act === 'action') opts.action.fn();
  });
  root.appendChild(el);
  while (root.children.length > 3) root.removeChild(root.firstElementChild);
  if (type !== 'error') {
    const ms = opts.duration || (opts.undo ? 6000 : 4000);
    let t = setTimeout(close, ms);
    el.addEventListener('mouseenter', () => clearTimeout(t));
    el.addEventListener('mouseleave', () => { t = setTimeout(close, 2000); });
  }
  return el;
}

// ============================================================================
// Layers (modal stack): Esc handling, focus trap, return focus
// ============================================================================
const layers = [];
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]):not([tabindex="-1"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
function describeFocus(el) {
  if (!el || el === document.body) return null;
  const tid = el.getAttribute && el.getAttribute('data-testid');
  return { el, tid };
}
function restoreFocus(info) {
  if (!info) return;
  let el = info.el;
  if (!el || !document.body.contains(el)) el = info.tid ? document.querySelector(`[data-testid="${CSS.escape(info.tid)}"]`) : null;
  if (el && typeof el.focus === 'function') { try { el.focus({ preventScroll: false }); } catch (e) { /* ignore */ } }
}
function pushLayer(el, opts = {}) {
  const layer = { el, onEsc: opts.onEsc, returnFocus: opts.returnFocus !== undefined ? opts.returnFocus : describeFocus(document.activeElement), name: opts.name };
  layers.push(layer);
  return layer;
}
function removeLayer(el, focusBack = true) {
  const i = layers.findIndex((l) => l.el === el);
  if (i < 0) return;
  const [l] = layers.splice(i, 1);
  if (focusBack && i === layers.length) restoreFocus(l.returnFocus);
}
const topLayer = () => layers[layers.length - 1] || null;
function trapFocus(e) {
  const l = topLayer(); if (!l) return;
  const nodes = $$(FOCUSABLE, l.el).filter((n) => n.offsetParent !== null || n === document.activeElement);
  if (!nodes.length) { e.preventDefault(); return; }
  const first = nodes[0], last = nodes[nodes.length - 1];
  const inside = l.el.contains(document.activeElement);
  if (e.shiftKey) { if (!inside || document.activeElement === first) { e.preventDefault(); last.focus(); } }
  else if (!inside || document.activeElement === last) { e.preventDefault(); first.focus(); }
}
function closeAllLayers() {
  while (layers.length) {
    const l = layers[layers.length - 1];
    if (l.onEsc && l.name !== 'drawer') { try { l.onEsc(); } catch (e) { /* ignore */ } }
    if (layers.length && layers[layers.length - 1] === l) { layers.pop(); if (l.el && l.el.parentNode) { const w = l.el.closest('.modal-wrap'); (w || l.el).remove(); } }
  }
  $$('#layer-root > *').forEach((n) => n.remove());
  document.body.classList.remove('has-drawer');
}

// Generic modal
let modalSeq = 0;
function openModal(o) {
  const id = 'm' + (++modalSeq);
  const wrap = document.createElement('div');
  wrap.className = 'modal-wrap' + (o.top ? ' top' : '');
  const ov = document.createElement('div');
  ov.className = 'overlay'; ov.style.zIndex = o.top ? 69 : 59;
  wrap.innerHTML = `<div class="modal ${o.size === 'sm' ? 'modal-sm' : ''} ${o.size === 'lg' ? 'modal-lg' : ''} ${o.danger ? 'is-danger' : ''}" role="dialog" aria-modal="true" aria-labelledby="${id}-t" ${o.desc ? `aria-describedby="${id}-d"` : ''} ${o.testid ? `data-testid="${o.testid}"` : ''}>
    <div class="modal-head"><h2 class="modal-title" id="${id}-t">${esc(o.title)}</h2>${o.closable === false ? '' : `<button type="button" class="icon-btn" data-close aria-label="Đóng">${ICONS.close}</button>`}</div>
    ${o.desc ? `<p class="modal-desc" id="${id}-d">${o.descHtml ? o.desc : esc(o.desc)}</p>` : ''}
    ${o.body != null ? `<div class="modal-body">${o.body}</div>` : ''}
    ${o.foot != null ? `<div class="modal-foot">${o.foot}</div>` : ''}
  </div>`;
  const root = $('#layer-root');
  root.appendChild(ov); root.appendChild(wrap);
  const modal = wrap.firstElementChild;
  const api = {
    el: modal, wrap,
    close(focusBack = true) { if (!wrap.parentNode) return; removeLayer(modal, focusBack); wrap.remove(); ov.remove(); },
  };
  pushLayer(modal, { onEsc: () => { if (o.closable === false) return; (o.onCancel || api.close)(); }, name: o.name });
  wrap.addEventListener('mousedown', (e) => { if (e.target === wrap && o.closable !== false && o.backdropClose !== false) (o.onCancel || api.close)(); });
  modal.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) (o.onCancel || api.close)(); });
  if (o.onMount) o.onMount(api);
  const af = modal.querySelector('[autofocus]') || modal.querySelector('.modal-body ' + FOCUSABLE) || modal.querySelector('.modal-foot .btn-primary, .modal-foot .btn-danger, .modal-foot .btn-brand') || modal.querySelector(FOCUSABLE);
  if (af) setTimeout(() => { if (document.body.contains(af)) af.focus(); }, 0);
  return api;
}

function confirmDialog(o) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (v) => { if (done) return; done = true; m.close(); resolve(v); };
    const m = openModal({
      title: o.title, desc: o.desc, size: 'sm', danger: o.danger, top: true, testid: o.testid,
      body: o.body,
      foot: `<button type="button" class="btn" data-no>${esc(o.cancelText || 'Không')}</button>
             <button type="button" class="btn ${o.danger ? 'btn-danger' : 'btn-primary'}" data-yes ${o.confirmTestid ? `data-testid="${o.confirmTestid}"` : ''} autofocus>${esc(o.confirmText || 'Đồng ý')}</button>`,
      onCancel: () => finish(false),
      onMount: (api) => {
        api.el.querySelector('[data-yes]').addEventListener('click', () => finish(true));
        api.el.querySelector('[data-no]').addEventListener('click', () => finish(false));
      },
    });
  });
}

// show {field: message} errors inside a container whose fields carry data-f
function showErrors(el, errs) {
  $$('.field-error', el).forEach((x) => x.remove());
  $$('.field.has-error', el).forEach((x) => x.classList.remove('has-error'));
  $$('[aria-invalid="true"]', el).forEach((x) => x.removeAttribute('aria-invalid'));
  const keys = Object.keys(errs || {});
  let firstEl = null;
  const general = [];
  keys.forEach((k) => {
    const f = el.querySelector(`[data-f="${CSS.escape(k)}"]`);
    if (!f) { general.push(errs[k]); return; }
    f.classList.add('has-error');
    const d = document.createElement('div'); d.className = 'field-error'; d.setAttribute('role', 'alert'); d.textContent = errs[k];
    f.appendChild(d);
    const inp = f.querySelector('input:not([type="hidden"]):not([tabindex="-1"]), select, textarea');
    if (inp) { inp.setAttribute('aria-invalid', 'true'); if (!firstEl) firstEl = inp; }
  });
  const g = el.querySelector('[data-general-error]');
  if (g) { g.hidden = !general.length; g.textContent = general.join(' · '); }
  if (firstEl) firstEl.focus();
  return keys.length > 0;
}
function errFields(e) {
  if (!e) return {};
  if (e.details && e.details.fields && !Array.isArray(e.details.fields)) return e.details.fields;
  return { _: e.message };
}

// ============================================================================
// Date input: dd/MM/yyyy text with mask + hidden native picker (§8.4)
// ============================================================================
function dateInputHtml({ id, testid, value = '', min = '', disabled = false, label = 'Ngày' }) {
  const dmy = Rules.ymdToDmy(value) || '';
  return `<span class="date-input${disabled ? ' is-disabled' : ''}">
    <input type="text" id="${esc(id)}" class="date-text" ${testid ? `data-testid="${esc(testid)}"` : ''} value="${esc(dmy)}" placeholder="dd/mm/yyyy" inputmode="numeric" maxlength="10" autocomplete="off" data-ymd="${esc(Rules.isValidYmd(value) ? value : '')}" ${min ? `data-min="${esc(min)}"` : ''} ${disabled ? 'disabled' : ''} aria-describedby="${esc(id)}-fmt">
    <span class="sr-only" id="${esc(id)}-fmt">Định dạng ngày/tháng/năm</span>
    <button type="button" class="icon-btn icon-btn-sm date-pick" data-date-pick aria-label="Chọn ${esc(label)} trên lịch" ${disabled ? 'disabled' : ''}>${ICONS.cal}</button>
    <input type="date" class="date-native" tabindex="-1" aria-hidden="true" value="${esc(Rules.isValidYmd(value) ? value : '')}" ${min ? `min="${esc(min)}"` : ''}>
  </span>`;
}
function maskDmy(raw) {
  const d = String(raw).replace(/\D/g, '').slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return d.slice(0, 2) + '/' + d.slice(2);
  return d.slice(0, 2) + '/' + d.slice(2, 4) + '/' + d.slice(4);
}
// returns ymd ('' when empty) or null when typed text is not a valid date
function readDate(input) {
  if (!input) return '';
  const v = trim(input.value);
  if (!v) return '';
  const ymd = Rules.dmyToYmd(v);
  return ymd || null;
}
function bindDateInputs(root) {
  root.addEventListener('input', (e) => {
    const t = e.target;
    if (t.classList && t.classList.contains('date-text')) {
      const deleting = e.inputType && e.inputType.indexOf('delete') === 0;
      if (!deleting) {
        const pos = t.selectionStart; const before = t.value;
        const m = maskDmy(before);
        if (m !== before) { t.value = m; if (pos >= before.length) t.setSelectionRange(m.length, m.length); }
      }
      const ymd = Rules.dmyToYmd(t.value);
      t.dataset.ymd = ymd || '';
      const nat = t.parentNode.querySelector('.date-native'); if (nat) nat.value = ymd || '';
      if (ymd || !trim(t.value)) t.removeAttribute('aria-invalid');
    }
  }, true);
  root.addEventListener('focusout', (e) => {
    const t = e.target;
    if (t.classList && t.classList.contains('date-text')) {
      const v = trim(t.value);
      if (v && !Rules.dmyToYmd(v)) t.setAttribute('aria-invalid', 'true'); else t.removeAttribute('aria-invalid');
    }
  }, true);
  root.addEventListener('change', (e) => {
    const t = e.target;
    if (t.classList && t.classList.contains('date-native')) {
      const txt = t.parentNode.querySelector('.date-text');
      txt.value = Rules.ymdToDmy(t.value) || '';
      txt.dataset.ymd = Rules.isValidYmd(t.value) ? t.value : '';
      txt.removeAttribute('aria-invalid');
      txt.dispatchEvent(new Event('input', { bubbles: true }));
      txt.dispatchEvent(new Event('change', { bubbles: true }));
      txt.focus();
    }
  }, true);
  root.addEventListener('click', (e) => {
    const b = e.target.closest && e.target.closest('[data-date-pick]');
    if (!b) return;
    e.preventDefault(); e.stopPropagation();
    const nat = b.parentNode.querySelector('.date-native');
    const txt = b.parentNode.querySelector('.date-text');
    const ymd = Rules.dmyToYmd(txt.value); if (ymd) nat.value = ymd;
    try { if (typeof nat.showPicker === 'function') { nat.showPicker(); return; } } catch (er) { /* fall through */ }
    try { nat.focus(); nat.click(); } catch (er) { txt.focus(); }
  }, true);
}

// ============================================================================
// Write operations
// ============================================================================
const actor = () => myName() || 'Không rõ';
function localCtx() { const t = today(); return { actor: actor(), user: S.user, today: t, todayDmy: Rules.ymdToDmy(t), hhmm: hhmm(), priorities: S.config.priorities, vaNames: Rules.vaNamesOf(S.config, S.user && S.user.isOwner ? S.user : null) }; }
function replaceTask(id, t) {
  const i = S.tasks.findIndex((x) => sameName(x.id, id));
  if (i >= 0) S.tasks[i] = t; else S.tasks.push(t);
}
const queues = new Map();
function enqueue(id, fn) {
  const prev = queues.get(id) || Promise.resolve();
  const p = prev.catch(() => {}).then(fn);
  queues.set(id, p);
  const cleanup = () => { if (queues.get(id) === p) queues.delete(id); };
  p.then(cleanup, cleanup);
  return p;
}
function invalidateLog(id) { S.logCache.delete(String(id).toUpperCase()); App.onLogChanged(id); }
// validate a change locally with the same Rules the server uses; returns {} or {field: msg}
function dryRun(t, changes, opts = {}) {
  try { Rules.applyUpdate(t, changes, {}, Object.assign({ force: true }, opts), localCtx()); return {}; }
  catch (e) { return errFields(e); }
}

function handleWriteError(e, retry, ui = {}) {
  if (e.code === 'UNAUTHORIZED') { App.onUnauthorized(); return; }
  if (e.code !== 'CONFLICT') buddyReact('error');
  if (e.code === 'CONFLICT' && ui.onConflict) { ui.onConflict(e); return; }
  if (e.code === 'INVALID_TRANSITION') {
    if (e.details && e.details.current) { replaceTask(e.details.current.id, e.details.current); App.onDataChanged({ fromServer: true }); }
    toast(e.message + '. Dữ liệu đã được tải lại.', { type: 'error' });
    syncNow();
    return;
  }
  if (e.code === 'VALIDATION') {
    if (ui.onValidation && e.details && e.details.fields) ui.onValidation(e.details.fields);
    toast('Không lưu được: ' + e.message, { type: 'error' });
    return;
  }
  if (e.code === 'CONFLICT') {
    // e.g. another VA claimed the order first: show the server's message and the fresh row
    if (e.details && e.details.current && e.details.current.id) { replaceTask(e.details.current.id, e.details.current); App.onDataChanged({ fromServer: true }); }
    toast(e.message || ERR_MSG.CONFLICT, { type: 'error' });
    syncNow();
    return;
  }
  if (e.code === 'FORBIDDEN' || e.code === 'NOT_FOUND') {
    toast('Không lưu được: ' + e.message, { type: 'error' });
    syncNow();
    return;
  }
  toast('Không lưu được: ' + e.message, { type: 'error', retry });
}

const NO_UNDO_KEYS = ['status', 'size', 'priority', 'holdReason', 'revisionCount', 'reviewDate'];
function makeUndo(before, after, changes) {
  if (Object.keys(changes).some((k) => NO_UNDO_KEYS.indexOf(k) >= 0)) return null;
  const keys = Object.keys(changes).filter((k) => !Rules.strictEqual(before[k], after[k]) && k !== 'notes');
  if (!keys.length) return null;
  const ch = {}, base = {};
  keys.forEach((k) => { ch[k] = before[k]; base[k] = after[k]; });
  if (Object.keys(dryRun(after, ch)).length) return null;
  return () => runUpdate(after.id, ch, base, {}, { successToast: () => 'Đã hoàn tác', noUndo: true });
}

function runUpdate(id, changes, base, opts = {}, ui = {}) {
  if (!guardOnline()) return Promise.resolve(null);
  const before = getTask(id);
  if (!before) return Promise.resolve(null);
  let local;
  try { local = Rules.applyUpdate(before, changes, base, Object.assign({}, opts, { force: true }), localCtx()); }
  catch (e0) {
    const e = toApiError(e0);
    if (e.code === 'VALIDATION' && ui.onValidation && e.details) { ui.onValidation(e.details.fields || {}); }
    else toast('Không lưu được: ' + e.message, { type: 'error' });
    return Promise.resolve(null);
  }
  const optimistic = Object.assign({}, before, local.task, { _row: before._row, sheetDeadlineWarning: before.sheetDeadlineWarning });
  replaceTask(id, optimistic);
  S.pending.add(before.id);
  App.onDataChanged({ optimisticId: before.id });
  beginWrite();
  return enqueue(before.id, async () => {
    try {
      const server = await S.api.update(before.id, changes, base, Object.assign({}, auth(), opts));
      const meta = (server && server._meta) || null;
      if (server) delete server._meta;
      S.pending.delete(before.id);
      replaceTask(before.id, server);
      invalidateLog(before.id);
      App.onDataChanged({ savedId: before.id });
      if (ui.onSuccess) ui.onSuccess(server, meta);
      const cas = meta && meta.cascade;
      if (cas) {
        toast(`Đã hủy kèm ${(cas.cancelled || []).length} đợt chưa làm (${server.id})`);
        if ((cas.kept || []).length) toast('Các đợt đang làm vẫn giữ: ' + cas.kept.join(', '), { type: 'info', duration: 8000 });
      } else if (ui.successToast) toast(ui.successToast(server), { undo: ui.noUndo ? null : makeUndo(before, server, changes), action: ui.toastAction ? ui.toastAction(server) : null });
      // server-side side effects (queue positions, parent auto-complete) → refresh quietly
      if ('status' in changes || 'priority' in changes || 'size' in changes || 'holdReason' in changes || trim(server.parentId)) loadAll({ silent: true });
      return server;
    } catch (e0) {
      const e = toApiError(e0);
      S.pending.delete(before.id);
      replaceTask(before.id, before);
      App.onDataChanged({ rolledBack: before.id });
      if (ui.onError) ui.onError(e);
      handleWriteError(e, () => runUpdate(id, changes, base, opts, ui), ui);
      return null;
    } finally { endWrite(); }
  });
}

// --- transitions ---
const TRANSITION_TEXT = {
  'new>in_progress': ['claim', 'Nhận làm'], 'new>cancelled': ['cancel', 'Hủy đơn'],
  'in_progress>review': ['submit', 'Gửi duyệt'], 'in_progress>new': ['unclaim', 'Trả về hàng đợi'], 'in_progress>cancelled': ['cancel', 'Hủy đơn'],
  'review>done': ['approve', 'Đạt'], 'review>changes_requested': ['requestChanges', 'Chưa đạt'], 'review>in_progress': ['backToWork', 'Rút lại'],
  'changes_requested>in_progress': ['resume', 'Làm tiếp'], 'changes_requested>review': ['submit', 'Gửi duyệt lại'], 'changes_requested>cancelled': ['cancel', 'Hủy đơn'],
  'done>changes_requested': ['reopen', 'Mở lại'], 'cancelled>new': ['restore', 'Khôi phục'],
};
function transitionText(from, to) {
  const k = TRANSITION_TEXT[from + '>' + to];
  if (k) return { key: k[0], label: k[1] };
  return { key: 'to-' + to, label: 'Chuyển sang ' + Rules.labelOf(to) };
}
function transitionToast(from, to) {
  return (server) => {
    buddyReact(to);
    if (to === 'in_progress' && from === 'new') return `${server.id}: ${sameName(server.assignee, myName()) ? 'bạn đã nhận làm' : 'đã giao cho ' + trim(server.assignee)}`;
    if (to === 'done') return `${server.id}: đã duyệt Đạt`;
    if (to === 'changes_requested') return `${server.id}: đã gửi yêu cầu sửa`;
    if (to === 'review') return `${server.id}: đã gửi duyệt`;
    if (to === 'new' && from === 'in_progress') return `${server.id}: đã trả về hàng đợi`;
    return `${server.id}: đã chuyển sang ${Rules.labelOf(to)}`;
  };
}
function needsOf(to, from) { try { return Rules.transitionNeeds(to, from) || {}; } catch (e) { return {}; } }
const SIZES = () => Rules.SIZES || ['S', 'M', 'L', 'XL'];
const validWorkSize = (s) => ['S', 'M', 'L'].indexOf(trim(s)) >= 0;

// one transition per order at a time (dialog open or request pending) → no double Đạt / Chưa đạt
const transitionBusy = new Set();
async function transition(id, to, o = {}) {
  const t0 = getTask(id);
  if (!t0 || S.pending.has(t0.id) || transitionBusy.has(t0.id)) return null;
  transitionBusy.add(t0.id);
  try { return await transitionInner(id, to, o); } finally { transitionBusy.delete(t0.id); }
}
async function transitionInner(id, to, o = {}) {
  const t = getTask(id);
  if (!t || !guardOnline()) return null;
  const from = statusKey(t);
  if (from === to) return null;
  if (to === 'in_progress' && claimViaSplit(t)) return openSplitDialog(t);
  if (allowedTo(t).indexOf(to) < 0) {
    const r = can('transition:' + to, t);
    toast(r.reason || `Không thể chuyển ${Rules.statusDisplay(t.status)} → ${Rules.labelOf(to)}`, { type: 'error' });
    return null;
  }
  const needs = needsOf(to, from);
  // claiming: size must be S/M/L; XL must be split first
  if (to === 'in_progress' && from === 'new') {
    if (!validWorkSize(t.size) || o.ask) return openSizeDialog(t, { claim: true });
  }
  const changes = Object.assign({}, o.changes || {}, { status: Rules.labelOf(to) });
  if (to === 'in_progress' && (from === 'new' || isLegacy(from) || from === 'unknown') && !trim(t.assignee) && !trim(changes.assignee)) changes.assignee = myName();
  let note = o.note || '', reviewNote = '';
  const askNote = needs.note || to === 'cancelled' || to === 'changes_requested';
  const askLink = needs.link || to === 'review';
  if ((askNote && !note) || askLink) {
    const r = await openTransitionDialog(t, from, to, { note: askNote && !note, link: askLink }, changes);
    if (!r) return null;
    Object.assign(changes, r.changes); if (r.note) note = r.note; reviewNote = r.reviewNote;
  }
  return runUpdate(t.id, changes, o.base || {}, note ? { note } : {}, Object.assign({
    successToast: transitionToast(from, to),
    onSuccess: (srv) => { if (reviewNote) addComment(srv.id, reviewNote, { silent: true }); },
    noUndo: true,
  }, o.ui || {}));
}

function openTransitionDialog(t, from, to, need, baseChanges = {}) {
  return new Promise((resolve) => {
    const tt = transitionText(from, to);
    const fields = [];
    if (need.link) {
      fields.push(`<div class="field" data-f="deliveryLink"><label for="tf-link">Link kết quả <span class="req">*</span></label>
        <textarea id="tf-link" rows="2" data-testid="transition-field-deliveryLink" placeholder="https://…">${esc(t.deliveryLink || '')}</textarea>
        <div class="field-hint">Link Drive / Figma / thư mục kết quả. Nhiều link cách nhau bởi xuống dòng.</div></div>`);
      fields.push(`<div class="field"><label for="tf-rnote">Ghi chú cho người order (tùy chọn)</label>
        <textarea id="tf-rnote" rows="2" data-testid="transition-field-reviewNote" placeholder="VD: Đã chỉnh màu theo feedback"></textarea></div>`);
    }
    if (need.note) {
      const lab = to === 'changes_requested' ? (from === 'done' ? 'Vì sao cần mở lại?' : 'Chưa đạt ở điểm nào?') : to === 'cancelled' ? 'Lý do hủy' : 'Ghi chú';
      fields.push(`<div class="field" data-f="note"><label for="tf-note">${esc(lab)} <span class="req">*</span></label>
        <textarea id="tf-note" rows="4" data-testid="transition-field-note" placeholder="${to === 'changes_requested' ? 'Mô tả cụ thể điểm cần sửa…' : 'Ít nhất 3 ký tự'}"></textarea></div>`);
    }
    const desc = `${t.id} · ${t.name || ''}`;
    const kids = to === 'cancelled' ? childrenOf(t) : [];
    const cascadeNote = to === 'cancelled' && isSplitParent(t)
      ? `<div class="ai-note is-warn" data-testid="cancel-cascade-note"><span>Đơn này đã chia đợt: các đợt <b>chưa làm (Mới)</b>${kids.length ? ' — ' + esc(kids.filter((c) => Rules.isNewLike(c.status)).map((c) => c.id).join(', ')) : ''} sẽ bị hủy theo. Đợt đang làm vẫn giữ nguyên.</span></div>` : '';
    const isFail = to === 'changes_requested';
    const danger = to === 'cancelled';
    let done = false;
    const finish = (v) => { if (done) return; done = true; m.close(); resolve(v); };
    const m = openModal({
      title: isFail && from === 'review' ? 'Chưa đạt — cần sửa gì?' : tt.label, desc, testid: isFail && from === 'review' ? 'approve-fail-dialog' : 'transition-dialog', size: 'sm', top: true, danger,
      body: `<div class="stack">${cascadeNote}${fields.join('')}<div class="field-error" data-general-error hidden role="alert"></div>${isFail && Number(t.revisionCount) >= 2 ? '<div class="field-hint is-warn">Đơn đã sửa nhiều lần — sau lần này sẽ được đánh dấu “Cần thảo luận”.</div>' : ''}</div>`,
      foot: `<button type="button" class="btn" data-testid="transition-cancel">Quay lại</button>
             <button type="button" class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-testid="transition-confirm">${esc(danger ? 'Hủy đơn' : isFail ? 'Gửi yêu cầu sửa' : tt.label)}</button>`,
      onCancel: () => finish(null),
      onMount: (api) => {
        const el = api.el;
        const confirm = () => {
          const out = { changes: {}, note: '', reviewNote: '' };
          const sl = $('#tf-link', el); if (sl) out.changes.deliveryLink = trim(sl.value);
          const sn = $('#tf-note', el); if (sn) out.note = trim(sn.value);
          const sr = $('#tf-rnote', el); if (sr) out.reviewNote = trim(sr.value);
          const changes = Object.assign({}, baseChanges, out.changes);
          const errs = dryRun(getTask(t.id) || t, changes, out.note ? { note: out.note } : {});
          if (sl && trim(sl.value) && !Rules.isUrlList(sl.value)) errs.deliveryLink = 'Cần nhập link hợp lệ (http/https)';
          if (sl && !trim(sl.value)) errs.deliveryLink = errs.deliveryLink || 'Cần nhập link kết quả';
          if (sn && trim(sn.value).length < 3) errs.note = errs.note || 'Cần nhập ít nhất 3 ký tự';
          if (Object.keys(errs).length && showErrors(el, errs)) return;
          finish(out);
        };
        el.querySelector('[data-testid="transition-confirm"]').addEventListener('click', confirm);
        el.querySelector('[data-testid="transition-cancel"]').addEventListener('click', () => finish(null));
        el.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); confirm(); } });
      },
    });
  });
}

// ----- size / priority / hold (VA) -----
function sizeOptionsHtml(sel, allowEmpty) {
  const info = Rules.SIZE_INFO || {};
  return (allowEmpty ? `<option value="" ${!trim(sel) ? 'selected' : ''}>— Chọn độ nặng —</option>` : '') +
    SIZES().map((s) => `<option value="${s}" ${trim(sel) === s ? 'selected' : ''}>${s} — ${esc((info[s] && (info[s].hint || info[s].label)) || '')}</option>`).join('');
}
function vaOptions(selected) {
  const vas = members().filter((m) => m.isArtist && m.active !== false);
  let h = vas.map((m) => `<option value="${esc(m.name)}" ${sameName(m.name, selected) ? 'selected' : ''}>${esc(m.name)}${sameName(m.name, myName()) ? ' (Tôi)' : ''}</option>`).join('');
  if (!vas.some((m) => sameName(m.name, selected)) && trim(selected)) h = `<option value="${esc(selected)}" selected>${esc(selected)}</option>` + h;
  return h;
}
function openSizeDialog(t, o = {}) {
  const claim = !!o.claim;
  const hadSize = !!trim(t.size);
  const needReason = hadSize && !claim;
  return new Promise((resolve) => {
    let done = false;
    const finish = (v) => { if (done) return; done = true; m.close(); resolve(v); };
    const m = openModal({
      title: claim ? 'Nhận làm — chốt độ nặng' : 'Chỉnh độ nặng', desc: `${t.id} · ${t.name || ''}`, testid: 'size-dialog', size: 'sm', top: true,
      body: `<div class="stack">
        <div class="field" data-f="size"><label for="sz-select">Độ nặng <span class="req">*</span></label>
          <select id="sz-select" data-testid="size-select">${sizeOptionsHtml(claim && !validWorkSize(t.size) && trim(t.size) !== 'XL' ? '' : t.size, true)}</select>
          <div class="field-hint">S ≤ 2 giờ · M ≤ 1 ngày · L 2–3 ngày · XL &gt; 3 ngày (phải chia đợt)</div></div>
        ${claim ? `<div class="field" data-f="assignee"><label for="sz-assignee">Người thực hiện</label><select id="sz-assignee" data-testid="claim-assignee">${vaOptions(trim(t.assignee) || myName())}</select></div>` : ''}
        <div class="field" data-f="note" ${needReason ? '' : 'hidden'}><label for="sz-reason">Lý do đổi <span class="req">*</span></label>
          <textarea id="sz-reason" rows="2" data-testid="size-reason" placeholder="Ít nhất 3 ký tự"></textarea></div>
        <div class="field-error" data-general-error hidden role="alert"></div></div>`,
      foot: `<button type="button" class="btn" data-testid="size-cancel">Quay lại</button>
             <button type="button" class="btn btn-primary" data-testid="size-confirm">${claim ? 'Nhận làm' : 'Lưu'}</button>`,
      onCancel: () => finish(null),
      onMount: (api) => {
        const el = api.el;
        const sel = $('#sz-select', el);
        const btn = el.querySelector('[data-testid="size-confirm"]');
        const sync = () => { btn.textContent = claim ? (sel.value === 'XL' ? 'Tiếp tục: chia đợt' : 'Nhận làm') : 'Lưu'; };
        sel.addEventListener('change', sync); sync();
        const confirm = () => {
          const size = sel.value;
          const note = trim(($('#sz-reason', el) || {}).value || '');
          if (!size) { showErrors(el, { size: 'Cần chọn độ nặng' }); return; }
          if (claim && size === 'XL') {
            finish(null);
            const cur = getTask(t.id) || t;
            const base = { size: cur.size };
            runUpdate(cur.id, { size: 'XL' }, base, {}, { onSuccess: (srv) => openSplitDialog(srv) });
            return;
          }
          if (claim) {
            const assignee = $('#sz-assignee', el).value || myName();
            const changes = { size, status: Rules.labelOf('in_progress'), assignee };
            const errs = dryRun(getTask(t.id) || t, changes);
            if (Object.keys(errs).length) { showErrors(el, errs); return; }
            finish(true);
            runUpdate(t.id, changes, { size: t.size, assignee: t.assignee }, {}, { successToast: transitionToast('new', 'in_progress'), noUndo: true });
            return;
          }
          if (size === trim(t.size)) { finish(null); return; }
          if (needReason && note.length < 3) { showErrors(el, { note: 'Cần nhập lý do (ít nhất 3 ký tự)' }); return; }
          const errs = dryRun(getTask(t.id) || t, { size }, note ? { note } : {});
          if (Object.keys(errs).length) { showErrors(el, errs); return; }
          finish(true);
          runUpdate(t.id, { size }, { size: t.size }, note ? { note } : {}, { successToast: (s) => `${s.id}: độ nặng ${s.size}`, noUndo: true });
        };
        btn.addEventListener('click', confirm);
        el.querySelector('[data-testid="size-cancel"]').addEventListener('click', () => finish(null));
        el.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); confirm(); } });
      },
    });
  });
}
function openPriorityDialog(t) {
  const prios = S.config.priorities || [];
  const hadPrio = !!trim(t.priority);
  const ep = effPrio(t);
  return new Promise((resolve) => {
    let done = false;
    const finish = (v) => { if (done) return; done = true; m.close(); resolve(v); };
    const m = openModal({
      title: 'Chỉnh mức ưu tiên', desc: `${t.id} · ${t.name || ''}`, testid: 'priority-dialog', size: 'sm', top: true,
      body: `<div class="stack">
        <div class="field" data-f="priority"><label for="pr-select">Ưu tiên</label>
          <select id="pr-select" data-testid="priority-select">${prios.map((p) => `<option value="${esc(p)}" ${sameName(p, t.priority) ? 'selected' : ''}>${esc(p)}</option>`).join('')}</select>
          ${ep.escalated ? `<div class="field-hint is-info">Đang tự nâng lên “${esc(ep.label)}” sau ${esc(ep.waitedDays)} ngày chờ.</div>` : ''}</div>
        <div class="field" data-f="urgentReason" ${trim(t.urgentReason) ? '' : 'hidden'}><label for="pr-urgent">Lý do gấp</label>
          <input type="text" id="pr-urgent" data-testid="priority-urgent-reason" value="${esc(t.urgentReason)}" maxlength="500"></div>
        <div class="field" data-f="note" ${hadPrio ? '' : 'hidden'}><label for="pr-reason">Lý do đổi <span class="req">*</span></label>
          <textarea id="pr-reason" rows="2" data-testid="priority-reason" placeholder="Ít nhất 3 ký tự"></textarea></div>
        <div class="field-error" data-general-error hidden role="alert"></div></div>`,
      foot: `<button type="button" class="btn" data-testid="priority-cancel">Quay lại</button><button type="button" class="btn btn-primary" data-testid="priority-confirm">Lưu</button>`,
      onCancel: () => finish(null),
      onMount: (api) => {
        const el = api.el;
        const sel = $('#pr-select', el);
        const urg = el.querySelector('[data-f="urgentReason"]');
        const syncU = () => { if (prios.indexOf(sel.value) === 0) urg.hidden = false; };
        sel.addEventListener('change', syncU); syncU();
        const confirm = () => {
          const p = sel.value; const note = trim($('#pr-reason', el).value);
          if (sameName(p, t.priority)) { finish(null); return; }
          if (hadPrio && note.length < 3) { showErrors(el, { note: 'Cần nhập lý do (ít nhất 3 ký tự)' }); return; }
          const changes = { priority: p };
          const ur = $('#pr-urgent', el); if (ur && !urg.hidden && trim(ur.value) !== trim(t.urgentReason)) changes.urgentReason = trim(ur.value);
          const errs = dryRun(getTask(t.id) || t, changes, note ? { note } : {});
          if (Object.keys(errs).length) { showErrors(el, errs); return; }
          finish(true);
          const base = {}; Object.keys(changes).forEach((k) => { base[k] = t[k]; });
          runUpdate(t.id, changes, base, note ? { note } : {}, { successToast: (s) => `${s.id}: ưu tiên ${s.priority}`, noUndo: true });
        };
        el.querySelector('[data-testid="priority-confirm"]').addEventListener('click', confirm);
        el.querySelector('[data-testid="priority-cancel"]').addEventListener('click', () => finish(null));
      },
    });
  });
}
async function toggleHold(id) {
  const t = getTask(id); if (!t || !guardOnline()) return;
  if (!can('setHold', t).ok) { toast(can('setHold', t).reason || ERR_MSG.FORBIDDEN, { type: 'error' }); return; }
  if (onHold(t)) {
    runUpdate(t.id, { holdReason: '' }, { holdReason: t.holdReason }, {}, { successToast: (s) => `${s.id}: đã tiếp tục`, noUndo: true });
    return;
  }
  const reason = await promptDialog({
    title: 'Tạm dừng đơn', desc: `${t.id} · ${t.name || ''}`, testid: 'hold-dialog', inputTestid: 'hold-reason', label: 'Lý do tạm dừng', placeholder: 'VD: Chờ file PSD gốc',
    confirmText: 'Tạm dừng', hint: 'Đơn tạm dừng xếp cuối hàng và không bị tự duyệt.',
    validate: (v) => dryRun(getTask(id) || t, { holdReason: v }),
  });
  if (reason == null) return;
  runUpdate(t.id, { holdReason: reason }, { holdReason: t.holdReason }, {}, { successToast: (s) => `${s.id}: đã tạm dừng`, noUndo: true });
}
function promptDialog(o) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (v) => { if (done) return; done = true; m.close(); resolve(v); };
    const m = openModal({
      title: o.title, desc: o.desc, testid: o.testid, size: 'sm', top: true, danger: o.danger,
      body: `<div class="stack"><div class="field" data-f="${o.field || 'holdReason'}"><label for="pd-input">${esc(o.label)} <span class="req">*</span></label>
        <textarea id="pd-input" rows="3" data-testid="${esc(o.inputTestid || 'prompt-input')}" placeholder="${esc(o.placeholder || '')}" maxlength="500"></textarea>
        ${o.hint ? `<div class="field-hint">${esc(o.hint)}</div>` : ''}</div><div class="field-error" data-general-error hidden role="alert"></div></div>`,
      foot: `<button type="button" class="btn" data-testid="prompt-cancel">Quay lại</button><button type="button" class="btn ${o.danger ? 'btn-danger' : 'btn-primary'}" data-testid="prompt-confirm">${esc(o.confirmText || 'Xác nhận')}</button>`,
      onCancel: () => finish(null),
      onMount: (api) => {
        const el = api.el;
        const confirm = () => {
          const v = trim($('#pd-input', el).value);
          if (v.length < (o.minLen || 3)) { showErrors(el, { [o.field || 'holdReason']: `Cần nhập ít nhất ${o.minLen || 3} ký tự` }); return; }
          const errs = o.validate ? o.validate(v) : {};
          if (Object.keys(errs).length) { showErrors(el, errs); return; }
          finish(v);
        };
        el.querySelector('[data-testid="prompt-confirm"]').addEventListener('click', confirm);
        el.querySelector('[data-testid="prompt-cancel"]').addEventListener('click', () => finish(null));
        el.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); confirm(); } });
      },
    });
  });
}

// ----- split (XL → đợt) -----
function openSplitDialog(t0) {
  const t = getTask(t0.id) || t0;
  if (!can('split', t).ok) { toast(can('split', t).reason || 'Chỉ chia đợt được đơn Mới cỡ XL', { type: 'error' }); return Promise.resolve(null); }
  const sug = splitSuggestionOf(t);
  let parts = (sug.length >= 2 ? sug : [{ name: '', size: 'M' }, { name: '', size: 'M' }]).map((p) => ({ name: trim(p.name), size: validWorkSize(p.size) ? p.size : 'M', description: '', deadline: '' }));
  return new Promise((resolve) => {
    let done = false;
    const finish = (v) => { if (done) return; done = true; m.close(); resolve(v); };
    const rowHtml = (p, i, n) => `<div class="split-row" data-i="${i}">
      <span class="split-no">${i + 1}</span>
      <div class="field" data-f="parts.${i}.name"><label class="sr-only" for="sp-name-${i}">Tên đợt ${i + 1}</label>
        <input type="text" id="sp-name-${i}" data-testid="split-part-${i}-name" value="${esc(p.name)}" placeholder="${esc(trim(t.name) + ' — Đợt ' + (i + 1) + '/' + n)}" maxlength="200"></div>
      <div class="field" data-f="parts.${i}.size"><label class="sr-only" for="sp-size-${i}">Độ nặng đợt ${i + 1}</label>
        <select id="sp-size-${i}" data-testid="split-part-${i}-size">${['S', 'M', 'L'].map((s) => `<option ${p.size === s ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
      <div class="field split-dl" data-f="parts.${i}.deadline">${dateInputHtml({ id: 'sp-dl-' + i, testid: `split-part-${i}-deadline`, value: p.deadline, label: 'hạn đợt ' + (i + 1) })}</div>
      <button type="button" class="icon-btn icon-btn-sm" data-split-del="${i}" aria-label="Xóa đợt ${i + 1}" ${n <= 2 ? 'disabled' : ''}>${ICONS.trash}</button>
    </div>`;
    const listHtml = () => parts.map((p, i) => rowHtml(p, i, parts.length)).join('');
    const read = (el) => { parts = parts.map((p, i) => ({ name: trim($('#sp-name-' + i, el).value), size: $('#sp-size-' + i, el).value, description: '', deadline: readDate($('#sp-dl-' + i, el)) })); };
    const m = openModal({
      title: 'Chia đợt đơn XL', testid: 'split-dialog', top: true, size: 'lg',
      desc: `${t.id} · ${t.name}. Mỗi đợt thành một đơn con (S/M/L), xếp hàng cùng tuổi với đơn gốc. Đơn gốc tự Hoàn thành khi mọi đợt xong.`,
      body: `<div class="stack">${sug.length ? `<div class="ai-note">${ICONS.spark}<span>Đã điền sẵn theo gợi ý chia đợt của AI — bạn có thể sửa.</span></div>` : ''}
        <div class="split-head" aria-hidden="true"><span></span><span>Tên đợt (để trống = tên mặc định)</span><span>Cỡ</span><span>Hạn (tùy chọn)</span><span></span></div>
        <div id="split-list">${listHtml()}</div>
        <div><button type="button" class="btn btn-sm" data-testid="split-add">+ Thêm đợt</button> <span class="muted split-count"></span></div>
        <div class="field-error" data-general-error hidden role="alert"></div></div>`,
      foot: `<button type="button" class="btn" data-testid="split-cancel">Quay lại</button><button type="button" class="btn btn-brand" data-testid="split-submit" data-write>Chia đợt</button>`,
      onCancel: () => finish(null),
      onMount: (api) => {
        const el = api.el;
        const rerender = () => { $('#split-list', el).innerHTML = listHtml(); el.querySelector('.split-count').textContent = `${parts.length} đợt · tối đa 10`; el.querySelector('[data-testid="split-add"]').disabled = parts.length >= 10; };
        rerender();
        el.addEventListener('click', async (e) => {
          const b = e.target.closest('button'); if (!b) return;
          if (b.dataset.testid === 'split-add') { read(el); if (parts.length < 10) parts.push({ name: '', size: 'M', description: '', deadline: '' }); rerender(); const n = $('#sp-name-' + (parts.length - 1), el); if (n) n.focus(); return; }
          if (b.dataset.splitDel !== undefined) { read(el); parts.splice(+b.dataset.splitDel, 1); rerender(); return; }
          if (b.dataset.testid === 'split-cancel') { finish(null); return; }
          if (b.dataset.testid === 'split-submit') {
            read(el);
            const errs = {};
            parts.forEach((p, i) => { if (p.deadline === null) errs[`parts.${i}.deadline`] = 'Ngày không hợp lệ (dd/mm/yyyy)'; });
            if (Object.keys(errs).length) { showErrors(el, errs); return; }
            const payload = parts.map((p) => { const o = { name: p.name, size: p.size }; if (p.deadline) o.deadline = p.deadline; return o; });
            try { Rules.planSplit(getTask(t.id) || t, payload, localCtx(), S.tasks.map((x) => x.id)); }
            catch (e1) { showErrors(el, errFields(e1)); return; }
            if (!guardOnline()) return;
            b.disabled = true; b.textContent = 'Đang chia…';
            beginWrite();
            try {
              const r = await S.api.split(t.id, payload, auth());
              finish(r);
              toast(`${t.id}: đã chia ${(r && r.children && r.children.length) || payload.length} đợt`);
              invalidateLog(t.id);
              await loadAll({ silent: true });
            } catch (e0) {
              const er = toApiError(e0);
              b.disabled = false; b.textContent = 'Chia đợt';
              if (er.code === 'UNAUTHORIZED') { finish(null); App.onUnauthorized(); return; }
              if (er.code === 'VALIDATION') showErrors(el, errFields(er));
              else { showErrors(el, { _: er.message }); }
            } finally { endWrite(); }
          }
        });
      },
    });
  });
}

// --- create ---
async function createTask(input, opts = {}) {
  if (!guardOnline()) return { error: new ApiError('NETWORK', 'Đang ngoại tuyến') };
  const cid = opts.clientRequestId || uid();
  beginWrite();
  try {
    const t = await S.api.create(input, Object.assign({}, auth(), { clientRequestId: cid, draftId: opts.draftId }));
    replaceTask(t.id, t);
    App.onDataChanged({});
    loadAll({ silent: true });
    buddyReact('created');
    return { task: t };
  } catch (e0) {
    const e = toApiError(e0);
    if (e.code === 'UNAUTHORIZED') { App.onUnauthorized(); return { error: e }; }
    if (e.code === 'VALIDATION') { return { errors: (e.details && e.details.fields) || { _: e.message }, error: e }; }
    return { error: e, retryId: cid };
  } finally { endWrite(); }
}

// --- delete ---
async function deleteTask(id) {
  if (!guardOnline()) return;
  const i = S.tasks.findIndex((x) => sameName(x.id, id));
  if (i < 0) return;
  const before = S.tasks[i];
  S.tasks.splice(i, 1);
  App.onDataChanged({ deletedId: before.id });
  beginWrite();
  try {
    await enqueue(before.id, () => S.api.remove(before.id, auth()));
    toast('Đã xóa ' + before.id);
  } catch (e0) {
    const e = toApiError(e0);
    S.tasks.splice(Math.min(i, S.tasks.length), 0, before);
    App.onDataChanged({});
    if (e.code === 'UNAUTHORIZED') { App.onUnauthorized(); return; }
    toast('Không lưu được: ' + e.message, { type: 'error', retry: () => deleteTask(before.id) });
  } finally { endWrite(); }
}

// --- comments ---
async function addComment(id, text, o = {}) {
  if (!guardOnline()) return false;
  const key = String(id).toUpperCase();
  const tmp = { ts: isoLocal(), taskId: id, actor: actor(), action: 'comment', field: '', oldValue: '', newValue: '', text: trim(text), _pending: true };
  const list = S.logCache.get(key);
  if (list) { list.unshift(tmp); App.onLogChanged(id); }
  beginWrite();
  try {
    const entry = await enqueue(id, () => S.api.addComment(id, text, auth()));
    const l2 = S.logCache.get(key);
    if (l2) { const j = l2.indexOf(tmp); if (j >= 0) l2[j] = entry; else l2.unshift(entry); App.onLogChanged(id); }
    if (!o.silent) toast('Đã gửi bình luận');
    return true;
  } catch (e0) {
    const e = toApiError(e0);
    const l2 = S.logCache.get(key);
    if (l2) { const j = l2.indexOf(tmp); if (j >= 0) l2.splice(j, 1); App.onLogChanged(id); }
    if (e.code === 'UNAUTHORIZED') { App.onUnauthorized(); return false; }
    toast('Không lưu được: ' + e.message, { type: 'error', retry: () => addComment(id, text, o) });
    return false;
  } finally { endWrite(); }
}

// --- config ---
async function saveConfigOp(mutate, okText) {
  if (!guardOnline()) return { error: 'Đang ngoại tuyến' };
  const prev = clone(S.config);
  let next;
  try { next = Rules.mergeConfig(mutate(clone(prev))); } catch (e) { return { error: e.message }; }
  const msg = Rules.validateConfig(next);
  if (msg) return { error: msg };
  S.config = next;
  App.onConfigChanged();
  beginWrite();
  try {
    let saved;
    try { saved = await S.api.saveConfig(next, Object.assign({}, auth(), { baseVersion: prev.version })); }
    catch (e1) {
      if (toApiError(e1).code !== 'CONFLICT') throw e1;
      const fresh = Rules.mergeConfig(await S.api.getConfig(auth()));
      const again = Rules.mergeConfig(mutate(clone(fresh)));
      const m2 = Rules.validateConfig(again);
      if (m2) throw new ApiError('VALIDATION', m2);
      saved = await S.api.saveConfig(again, Object.assign({}, auth(), { baseVersion: fresh.version }));
    }
    if (saved && typeof saved.aiEnabled === 'boolean') S.aiEnabled = saved.aiEnabled;
    S.config = Rules.mergeConfig(saved);
    App.onConfigChanged();
    setupPolling();
    if (okText) toast(okText);
    return { ok: true };
  } catch (e0) {
    const e = toApiError(e0);
    S.config = prev;
    App.onConfigChanged();
    if (e.code === 'UNAUTHORIZED') { App.onUnauthorized(); return { error: e.message }; }
    toast('Không lưu được: ' + e.message, { type: 'error', retry: () => saveConfigOp(mutate, okText) });
    return { error: e.message };
  } finally { endWrite(); }
}

// ============================================================================
// Conflict dialog
// ============================================================================
function fmtFieldValue(k, v) {
  if (v === null || v === undefined || trim(v) === '') return '—';
  if (k === 'requestDate' || k === 'deadline' || k === 'reviewDate') return fmtDate(v) || String(v);
  return String(v);
}
function openConflictDialog(e, mine) {
  return new Promise((resolve) => {
    const cur = (e.details && e.details.current) || {};
    const fields = (e.details && e.details.fields) || [];
    const rows = fields.map((k) => `<tr><td>${esc(Rules.FIELD_LABELS[k] || k)}</td><td class="theirs" data-testid="conflict-theirs">${esc(fmtFieldValue(k, cur[k]))}</td><td class="mine" data-testid="conflict-mine">${esc(fmtFieldValue(k, mine[k]))}</td></tr>`).join('');
    let done = false;
    const finish = (v) => { if (done) return; done = true; m.close(); resolve(v); };
    const m = openModal({
      title: 'Dữ liệu đã thay đổi trên Google Sheet', testid: 'conflict-dialog', top: true,
      desc: 'Trong lúc bạn sửa, ai đó đã đổi các trường dưới đây. Chọn bản muốn giữ.',
      body: `<table class="conflict-table"><thead><tr><th>Trường</th><th>Trên sheet</th><th>Của bạn</th></tr></thead><tbody>${rows}</tbody></table>`,
      foot: `<button type="button" class="btn" data-testid="conflict-use-theirs">Dùng bản trên sheet</button>
             <button type="button" class="btn btn-primary" data-testid="conflict-use-mine">Ghi đè bằng bản của tôi</button>`,
      onCancel: () => finish(null),
      onMount: (api) => {
        api.el.querySelector('[data-testid="conflict-use-theirs"]').addEventListener('click', () => finish('theirs'));
        api.el.querySelector('[data-testid="conflict-use-mine"]').addEventListener('click', () => finish('mine'));
      },
    });
  });
}
