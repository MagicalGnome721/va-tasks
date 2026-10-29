// ============================================================================
// Drawer (order detail)
// ============================================================================
const EDIT_KEYS = ['name', 'description', 'usage', 'quantity', 'outputSpec', 'acceptance', 'briefLink', 'deadline', 'assetType', 'project', 'team', 'priority', 'urgentReason', 'assignee', 'deliveryLink', 'notes'];

const Drawer = {
  id: null, wrap: null, el: null, original: null, draft: null, tab: 'details', errors: {}, banner: null, deleted: false, editLinks: {},
  isOpen() { return !!this.el; },
  dirtyKeys() {
    if (!this.original || !this.draft) return [];
    return EDIT_KEYS.filter((k) => !Rules.strictEqual(this.draft[k], this.original[k]));
  },
  isDirty() { return this.dirtyKeys().length > 0; },
  open(id) {
    if (this.el && this.id && sameName(this.id, id)) return;
    if (this.el) this.closeUI(false);
    this.id = id; this.tab = 'details'; this.errors = {}; this.banner = null; this.deleted = false; this.editLinks = {};
    const t = getTask(id);
    this.original = t ? clone(t) : null; this.draft = t ? clone(t) : null;
    const root = $('#layer-root');
    const ov = document.createElement('div'); ov.className = 'overlay';
    ov.addEventListener('mousedown', () => this.requestClose());
    const el = document.createElement('aside');
    el.className = 'drawer'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-labelledby', 'drawer-title'); el.setAttribute('data-testid', 'task-drawer');
    root.appendChild(ov); root.appendChild(el);
    this.wrap = ov; this.el = el;
    pushLayer(el, { onEsc: () => this.requestClose(), name: 'drawer' });
    document.body.classList.add('has-drawer');
    bindDrawerEvents(el);
    this.render();
    setTimeout(() => { const f = el.querySelector('[data-testid="drawer-close"]'); if (f && !el.contains(document.activeElement)) f.focus(); }, 0);
  },
  closeUI(focusBack = true) {
    if (!this.el) return;
    removeLayer(this.el, focusBack);
    this.el.remove(); this.wrap.remove();
    document.body.classList.remove('has-drawer');
    this.el = null; this.wrap = null; this.id = null; this.original = null; this.draft = null;
  },
  async requestClose() {
    if (this.isDirty() && !this.deleted) {
      const ok = await confirmDialog({ title: 'Bỏ các thay đổi chưa lưu?', desc: 'Những chỉnh sửa bạn vừa làm trong đơn này sẽ mất.', confirmText: 'Bỏ thay đổi', cancelText: 'Tiếp tục sửa', danger: true });
      if (!ok) return;
      this.draft = clone(this.original);
    }
    App.closeOverlayNav();
  },
  sync(info = {}) {
    if (!this.el) return;
    if (!S.loaded) { this.render(); return; }
    const t = getTask(this.id);
    if (!t) {
      if (info.deletedId && sameName(info.deletedId, this.id)) return;
      if (this.original) { this.deleted = true; this.banner = 'deleted'; this.render(); }
      else this.render();
      return;
    }
    if (!this.original) { this.original = clone(t); this.draft = clone(t); this.render(); return; }
    const keys = Rules.OWNED_KEYS.concat(['childCount', 'childDone', 'queuePosition', 'queueTotal']);
    const same = keys.every((k) => Rules.strictEqual(t[k], this.original[k])) && !!t._tmp === !!this.original._tmp;
    const own = [info.savedId, info.optimisticId, info.rolledBack].some((x) => x && sameName(x, this.id));
    if (same) { if (own) this.render(); return; }
    if (!this.isDirty() || own) { this.rebase(t); this.render(); }
    else { this.original = Object.assign({}, this.original, { status: t.status }); this.banner = 'changed'; this.renderBanner(); }
  },
  rebase(t) {
    const d = this.draft, o = this.original;
    EDIT_KEYS.forEach((k) => { if (Rules.strictEqual(d[k], o[k])) d[k] = t[k]; });
    Object.keys(t).forEach((k) => { if (EDIT_KEYS.indexOf(k) < 0) d[k] = t[k]; });
    this.original = clone(t);
  },
  render() {
    const el = this.el; if (!el) return;
    const active = document.activeElement;
    const focusTid = active && el.contains(active) ? (active.getAttribute('data-testid') || (active.id ? '#' + active.id : null)) : null;
    const body = el.querySelector('.drawer-body'); const scroll = body ? body.scrollTop : 0;
    el.innerHTML = drawerHtml(this);
    const nb = el.querySelector('.drawer-body'); if (nb) nb.scrollTop = scroll;
    if (focusTid) {
      const f = focusTid[0] === '#' ? el.querySelector(focusTid) : el.querySelector(`[data-testid="${CSS.escape(focusTid)}"]`);
      if (f) f.focus(); else { const c = el.querySelector('[data-testid="drawer-close"]'); if (c) c.focus(); }
    }
    autosizeAll(el);
    if (this.tab === 'activity') loadActivity(this.id);
    applyOffline();
  },
  renderBanner() { const b = this.el && this.el.querySelector('#drawer-banner'); if (b) b.outerHTML = bannerHtml(this); },
  updateSavebar() { const bar = this.el && this.el.querySelector('.savebar'); if (bar) bar.hidden = !this.isDirty(); },
  async save() {
    if (!this.el || !this.draft || this.deleted) return;
    if (!guardOnline()) return;
    // date fields are typed as dd/MM/yyyy
    const dl = this.el.querySelector('#df-deadline');
    if (dl) { const v = readDate(dl); if (v === null) { this.errors = { deadline: 'Ngày không hợp lệ (dd/mm/yyyy)' }; this.render(); focusFirstError(this.el); return; } this.draft.deadline = v; }
    const keys = this.dirtyKeys();
    if (!keys.length) { this.render(); return; }
    const changes = {};
    keys.forEach((k) => {
      let v = this.draft[k];
      if (k === 'quantity') v = trim(v) === '' ? null : Number(v);
      else if (typeof v === 'string' && ['description', 'notes', 'usage', 'acceptance'].indexOf(k) < 0) v = v.trim();
      changes[k] = v;
    });
    const errs = dryRun(this.original, changes);
    if (Object.keys(errs).length) { this.errors = errs; this.render(); focusFirstError(this.el); if (errs._) toast(errs._, { type: 'error' }); return; }
    const base = {};
    Object.keys(changes).forEach((k) => { base[k] = this.original[k]; });
    this.errors = {};
    const id = this.original.id;
    const keepDraft = clone(this.draft);
    const ui = {
      successToast: () => 'Đã lưu thay đổi',
      onSuccess: (srv) => { if (this.id && sameName(this.id, srv.id)) { this.original = clone(srv); this.draft = clone(srv); this.banner = null; this.editLinks = {}; this.render(); } },
      onValidation: (fields) => { this.errors = fields || {}; this.draft = keepDraft; this.render(); focusFirstError(this.el); },
      onConflict: async (e) => {
        const choice = await openConflictDialog(e, changes);
        if (choice === 'mine') runUpdate(id, changes, base, { force: true }, ui);
        else if (choice === 'theirs') {
          const cur = (e.details && e.details.current) || getTask(id);
          if (cur) { replaceTask(cur.id, cur); this.original = clone(cur); this.draft = clone(cur); this.banner = null; App.onDataChanged({}); this.render(); }
          syncNow();
        }
      },
      onError: () => { if (this.el && this.id && sameName(this.id, id)) { const cur = getTask(id); if (cur) this.original = clone(cur); this.draft = keepDraft; this.render(); } },
    };
    return runUpdate(id, changes, base, {}, ui);
  },
};

function bannerHtml(d) {
  if (d.banner === 'deleted') return `<div id="drawer-banner" class="drawer-banner is-danger" role="alert">Đơn này đã bị xóa.</div>`;
  if (d.banner === 'changed') return `<div id="drawer-banner" class="drawer-banner" role="status"><span>Đơn này vừa được cập nhật ở nơi khác.</span><button type="button" class="btn btn-sm" data-act="reload-task">Tải bản mới</button></div>`;
  return '<div id="drawer-banner" hidden></div>';
}
function catalogSelectOptions(list, value, { allowEmpty = true, emptyLabel = '—' } = {}) {
  let html = '';
  const v = trim(value);
  if (allowEmpty || !v) html += `<option value="" ${!v ? 'selected' : ''}>${esc(emptyLabel)}</option>`;
  let found = false;
  (list || []).forEach((x) => { const sel = sameName(x, v); if (sel) found = true; html += `<option value="${esc(x)}" ${sel ? 'selected' : ''}>${esc(x)}</option>`; });
  if (v && !found) html += `<option value="${esc(value)}" selected>${esc(v)} (ngoài danh mục)</option>`;
  return html;
}
function fieldWrap(key, label, inner, { span = false, req = false, hint = '' } = {}) {
  const err = Drawer.errors[key];
  return `<div class="field ${span ? 'span-2' : ''} ${err ? 'has-error' : ''}" data-f="${key}"><label for="df-${key}">${esc(label)}${req ? ' <span class="req">*</span>' : ''}</label>${inner}
    ${hint}${err ? `<div class="field-error" role="alert">${esc(err)}</div>` : ''}</div>`;
}
function roField(key, label, valueHtml, o = {}) {
  return `<div class="field ro ${o.span ? 'span-2' : ''}" data-f="${key}"><span class="label">${esc(label)}</span><div class="ro-val" data-testid="drawer-value-${key}">${valueHtml}</div></div>`;
}
function linkField(d, key, label, editable) {
  const v = d.draft[key] || '';
  const links = Rules.splitLinks(v);
  if (!editable) return roField(key, label, links.length ? linkChips(v) : '<span class="dash">—</span>', { span: true });
  const editing = !links.length || d.editLinks[key];
  const chips = links.length ? `<div class="links">${linkChips(v).replace(/^<span class="links">|<\/span>$/g, '')}
    ${editing ? '' : `<button type="button" class="icon-btn icon-btn-sm" data-edit-links="${key}" aria-label="Sửa ${esc(label)}" data-write>${ICONS.edit}</button>`}</div>` : '';
  return fieldWrap(key, label, `${chips}<textarea id="df-${key}" data-k="${key}" data-testid="drawer-field-${key}" rows="1" placeholder="https://…" ${editing ? '' : 'hidden'} style="${links.length && editing ? 'margin-top:8px' : ''}">${esc(v)}</textarea>`, { span: true });
}
function drawerActions(o, d) {
  const k = statusKey(o);
  const pending = S.pending.has(o.id);
  const dis = d.deleted || pending ? 'disabled' : '';
  const to = allowedTo(o);
  const PRIMARY = { new: 'in_progress', in_progress: 'review', review: 'done', changes_requested: 'review', done: '', cancelled: 'new' };
  const btns = to.map((x) => {
    const tt = transitionText(k, x);
    const primary = PRIMARY[k] === x || (isLegacy(k) && x === 'in_progress');
    const cls = x === 'cancelled' ? 'btn-danger-text' : x === 'done' ? 'btn-ok' : primary ? 'btn-primary' : '';
    const label = x === 'in_progress' && k === 'new' && trim(o.size) === 'XL' ? 'Nhận · chia đợt' : tt.label;
    return `<button type="button" class="btn btn-sm ${cls}" data-testid="action-${tt.key}" data-qa-to="${x}" data-write ${dis}>${esc(label)}</button>`;
  });
  if (isVA() && k === 'review' && to.indexOf('done') < 0) btns.push('<span class="muted act-note">Người order duyệt Đạt / Chưa đạt</span>');
  const extra = [];
  if (can('split', o).ok) extra.push(`<button type="button" class="btn btn-sm" data-testid="action-split" data-act="split" data-write ${dis}>${ICONS.split}Chia đợt</button>`);
  if (can('setHold', o).ok && Rules.isOpen(o)) extra.push(`<button type="button" class="btn btn-sm btn-ghost" data-testid="hold-toggle" data-act="hold" aria-pressed="${onHold(o)}" data-write ${dis}>${onHold(o) ? ICONS.play + 'Tiếp tục' : ICONS.pause + 'Tạm dừng'}</button>`);
  if (!btns.length && !extra.length) return '';
  return `<div class="drawer-actions" role="toolbar" aria-label="Hành động">${btns.join('')}${extra.length ? '<span class="act-sep" aria-hidden="true"></span>' + extra.join('') : ''}</div>`;
}
function drawerHtml(d) {
  const head = (inner) => `<div class="drawer-head">${inner}</div>`;
  const closeBtn = `<button type="button" class="icon-btn" data-testid="drawer-close" data-act="close-drawer" aria-label="Đóng">${ICONS.close}</button>`;
  if (!S.loaded && !d.draft) {
    return head(`<div class="drawer-topline"><span class="drawer-id">${esc(d.id)}</span><span class="spacer"></span>${closeBtn}</div><h2 id="drawer-title" class="sr-only">Đang tải đơn ${esc(d.id)}</h2>`) +
      `<div class="drawer-body" data-testid="loading-state" aria-busy="true"><div class="stack"><span class="skel" style="width:60%;height:20px"></span><span class="skel"></span><span class="skel" style="width:80%"></span><span class="skel" style="width:40%"></span></div></div>`;
  }
  if (!d.draft) {
    return head(`<div class="drawer-topline"><span class="drawer-id">${esc(d.id)}</span><span class="spacer"></span>${closeBtn}</div>`) +
      `<div class="drawer-body"><div class="empty">${EMPTY_ART}<h2 class="empty-title" id="drawer-title">Không tìm thấy đơn ${esc(d.id)}</h2><p>Đơn có thể đã bị xóa, ID không đúng hoặc bạn không có quyền xem.</p><button type="button" class="btn btn-primary" data-act="close-drawer">Đóng</button></div></div>`;
  }
  const t = d.draft; const o = d.original;
  const k = statusKey(o);
  const pending = S.pending.has(o.id);
  const va = isVA();
  const ed = (key) => !d.deleted && can('edit', o, { [key]: t[key] == null ? '' : t[key] }).ok;
  const q = colKey(o) === 'new' ? queueInfoOf(o) : null;
  const aad = autoApproveOn(o);
  const ep = effPrio(o);
  const pc = splitProgress(o);
  const kids = childrenOf(o);
  const parent = trim(o.parentId) ? getTask(o.parentId) : null;
  const prios = S.config.priorities || [];
  const reqPrioOpts = () => prios.map((p, i) => `<option value="${esc(p)}" ${sameName(p, t.priority) ? 'selected' : ''}>${esc(p)}${i === 0 ? ' (cần lý do gấp)' : ''}</option>`).join('');

  const summary = trim(o.aiSummary) ? `<section class="ai-card" data-testid="drawer-ai-summary"><div class="ai-card-head">${ICONS.spark}<span>AI tóm tắt</span></div><div class="ai-card-body">${esc(o.aiSummary).replace(/\n/g, '<br>')}</div></section>` : '';
  const reviewBox = k === 'review' ? `<div class="info-box" data-testid="drawer-review-info">${ICONS.cal}<span>Gửi duyệt ${esc(fmtDate(o.reviewDate) || '—')}${aad ? ` · <b>Tự duyệt sau: ${esc(fmtDM(aad))}</b>` : onHold(o) ? ' · đang tạm dừng nên không tự duyệt' : ''}</span></div>` : '';
  const flags = [];
  if (onHold(o)) flags.push(`<div class="info-box is-hold" data-testid="drawer-hold">${ICONS.pause}<span><b>Đang tạm dừng:</b> ${esc(o.holdReason)}</span></div>`);
  if (discuss(o)) flags.push(`<div class="info-box is-discuss" data-testid="drawer-discuss">${ICONS.chat}<span><b>Cần thảo luận</b> — đơn đã bị “Chưa đạt” ${esc(o.revisionCount)} lần. Nên trao đổi trực tiếp trước khi sửa tiếp.</span></div>`);

  // editable → form control; otherwise plain text (requester on a non-new order, …)
  const fld = (key, label, editor, o = {}) => (ed(key) ? fieldWrap(key, label, editor, o)
    : roField(key, label, trim(o.text != null ? o.text : t[key]) ? `<span class="ro-text">${esc(o.text != null ? o.text : t[key])}</span>` : '<span class="dash">—</span>', o));
  const details = `
    ${summary}
    <div class="detail-grid"><div class="detail-main">
    <fieldset class="fieldset" ${d.deleted ? 'disabled' : ''}><legend>Yêu cầu</legend><div class="form-grid">
      ${fld('description', 'Cần làm gì', `<textarea id="df-description" data-k="description" data-testid="drawer-field-description" rows="3" class="autosize">${esc(t.description)}</textarea>`, { span: true })}
      ${fld('usage', 'Mục đích sử dụng', `<textarea id="df-usage" data-k="usage" data-testid="drawer-field-usage" rows="1" class="autosize" maxlength="1000">${esc(t.usage)}</textarea>`, { span: true })}
      ${fld('acceptance', 'Tiêu chí đạt', `<textarea id="df-acceptance" data-k="acceptance" data-testid="drawer-field-acceptance" rows="1" class="autosize" maxlength="1000">${esc(t.acceptance)}</textarea>`, { span: true })}
      ${fld('quantity', 'Số lượng', `<input type="number" id="df-quantity" min="1" max="9999" step="1" data-k="quantity" data-testid="drawer-field-quantity" value="${esc(t.quantity == null ? '' : t.quantity)}" placeholder="—">`)}
      ${fld('assetType', 'Loại asset', `<select id="df-assetType" data-k="assetType" data-testid="drawer-field-assetType">${catalogSelectOptions(S.config.assetTypes, t.assetType)}</select>`)}
      ${fld('outputSpec', 'Thông số đầu ra', `<input type="text" id="df-outputSpec" data-k="outputSpec" data-testid="drawer-field-outputSpec" value="${esc(t.outputSpec)}" placeholder="VD: PNG @2x, 512×512">`, { span: true })}
      ${linkField(d, 'briefLink', 'Link brief / tham chiếu', ed('briefLink'))}
      ${fld('project', 'Dự án', `<select id="df-project" data-k="project" data-testid="drawer-field-project">${catalogSelectOptions(S.config.projects, t.project)}</select>`)}
      ${fld('team', 'Team', `<select id="df-team" data-k="team" data-testid="drawer-field-team">${catalogSelectOptions(S.config.teams, t.team)}</select>`)}
    </div></fieldset>
    ${pc || parent || trim(o.parentId) ? `<fieldset class="fieldset"><legend>Chia đợt</legend>
      ${trim(o.parentId) ? `<p class="ro-line">Thuộc đơn <a href="#/task/${encodeURIComponent(o.parentId)}" data-testid="drawer-parent-link">${esc(o.parentId)}</a>${parent ? ` · ${esc(parent.name)}` : ''}</p>` : ''}
      ${pc ? `<p class="ro-line" data-testid="drawer-split-progress">Đã chia ${pc.total} đợt · ${pc.done}/${pc.total} xong${pc.allDone ? ' — đơn gốc tự Hoàn thành' : ''}</p>
        ${kids.length ? `<ul class="child-list">${kids.map((c) => `<li><a href="#/task/${encodeURIComponent(c.id)}" class="child-link" data-testid="drawer-child-${esc(c.id)}"><span class="mono">${esc(c.id)}</span><span class="cname">${esc(c.name)}</span>${sizeBadge(c)}${statusPill(c)}</a></li>`).join('')}</ul>` : ''}` : ''}
    </fieldset>` : ''}
    <fieldset class="fieldset" ${d.deleted ? 'disabled' : ''}><legend>Bàn giao</legend><div class="form-grid">
      ${linkField(d, 'deliveryLink', 'Link kết quả', va && ed('deliveryLink'))}
      ${va && ed('notes') ? fieldWrap('notes', 'Ghi chú / feedback', `<textarea id="df-notes" data-k="notes" data-testid="drawer-field-notes" rows="3" class="autosize">${esc(t.notes)}</textarea>`, { span: true }) : (trim(o.notes) ? roField('notes', 'Ghi chú / feedback', `<div class="notes-ro">${linkify(o.notes)}</div>`, { span: true }) : '')}
    </div></fieldset>
    ${can('delete', o).ok ? `<div class="danger-zone"><span>Không làm nữa? Dùng “Hủy đơn” để giữ lại lịch sử.</span><button type="button" class="btn btn-sm btn-danger-text" data-testid="action-delete" data-act="delete" data-write ${d.deleted ? 'disabled' : ''}>${ICONS.trash}Xóa đơn</button></div>` : ''}
    </div><aside class="detail-side" aria-label="Phân công & hạn">
    <fieldset class="fieldset" ${d.deleted ? 'disabled' : ''}><legend>Phân công & hạn</legend><div class="form-grid is-side">
      ${va || !ed('priority')
        ? roField('priority', 'Ưu tiên', `${effPrioHtml(o)}${ep.escalated && colKey(o) === 'new' ? `<span class="muted"> · gốc ${esc(o.priority || '—')}</span>` : ''}${va && can('setPriority', o).ok ? `<button type="button" class="btn btn-sm btn-ghost" data-act="prio" data-testid="action-priority" data-write>Đổi</button>` : ''}`)
        : fieldWrap('priority', 'Ưu tiên', `<select id="df-priority" data-k="priority" data-testid="drawer-field-priority">${reqPrioOpts()}</select>`)}
      ${roField('size', 'Độ nặng', `${sizeBadge(o, { long: true })}${trim(o.size) ? `<span class="muted"> ${esc(sizeHint(o.size))}</span>` : ''}${can('setSize', o).ok ? `<button type="button" class="btn btn-sm btn-ghost" data-act="size" data-testid="action-size" data-write>${trim(o.size) ? 'Đổi' : 'Chấm cỡ'}</button>` : ''}`)}
      ${(trim(t.urgentReason) || ed('urgentReason')) ? (ed('urgentReason') ? fieldWrap('urgentReason', 'Lý do gấp', `<input type="text" id="df-urgentReason" data-k="urgentReason" data-testid="drawer-field-urgentReason" value="${esc(t.urgentReason)}" maxlength="500" placeholder="Bắt buộc nếu chọn Khẩn cấp">`, { span: true }) : roField('urgentReason', 'Lý do gấp', esc(o.urgentReason), { span: true })) : ''}
      ${q ? roField('queue', 'Vị trí trong hàng', `<span data-testid="drawer-queue-pos"><b>#${esc(q.position)}</b> / ${esc(q.total)}</span>${(q.reasons || []).length ? `<div class="ro-sub">${q.reasons.map(esc).join(' · ')}</div>` : ''}`, { span: true }) : ''}
      ${va && ed('assignee') ? fieldWrap('assignee', 'Người làm', `<select id="df-assignee" data-k="assignee" data-testid="drawer-field-assignee">${colKey(o) === 'new' || !trim(t.assignee) ? '<option value="">— Chưa có —</option>' : ''}${vaOptions(t.assignee)}</select>`) : roField('assignee', 'Người làm', personHtml(o.assignee))}
      ${roField('requester', 'Người order', `${personHtml(o.requester)}${va && trim(o.requesterEmail) ? `<div class="ro-sub">${esc(o.requesterEmail)}</div>` : ''}`)}
      ${roField('requestDate', 'Ngày order', esc(fmtDate(o.requestDate) || '—'))}
      ${ed('deadline') ? fieldWrap('deadline', 'Hạn cần', dateInputHtml({ id: 'df-deadline', testid: 'drawer-field-deadline', value: t.deadline, label: 'hạn cần' })) : roField('deadline', 'Hạn cần', trim(o.deadline) ? `${esc(fmtDate(o.deadline))} ${deadlineBadge(o)}` : '<span class="dash">—</span>')}
      ${roField('revisionCount', 'Số lần sửa', `${esc(Number(o.revisionCount) || 0)}${discuss(o) ? ' <span class="flag is-discuss">Cần thảo luận</span>' : ''}`)}
      ${trim(o.reviewDate) ? roField('reviewDate', 'Ngày gửi duyệt', `${esc(fmtDate(o.reviewDate))}${aad ? `<div class="ro-sub" data-testid="drawer-auto-approve">Tự duyệt sau: ${esc(fmtDM(aad))}</div>` : ''}`) : ''}
    </div></fieldset>
    </aside></div>`;
  const canComment = can('comment', o).ok && !d.deleted;
  const activity = `${canComment ? `<div class="comment-box"><label class="sr-only" for="comment-input">Bình luận</label>
      <textarea id="comment-input" data-testid="comment-input" placeholder="Viết bình luận… (Ctrl+Enter để gửi)"></textarea>
      <div class="row"><button type="button" class="btn btn-primary btn-sm" data-testid="comment-submit" data-act="comment" data-write>Gửi</button></div></div>` : ''}
    <div id="activity-box">${activityHtml(d.id)}</div>`;
  const nameEditable = ed('name');
  return `${head(`
    <div class="drawer-topline">
      <button type="button" class="drawer-id" data-act="copy-link" title="Bấm để sao chép liên kết" aria-label="${esc(o.id)} — sao chép liên kết">${o._tmp ? 'Đang tạo…' : esc(o.id)}</button>${pending ? '<span class="saving-spin" role="img" aria-label="Đang lưu"></span>' : ''}
      <span class="spacer"></span>
      ${va ? `<button type="button" class="icon-btn" data-act="drawer-menu" aria-label="Thêm thao tác" aria-haspopup="menu">${ICONS.dots}</button>` : ''}
      ${closeBtn}
    </div>
    <h2 id="drawer-title" class="sr-only">Chi tiết đơn ${esc(o.id)}</h2>
    ${nameEditable ? `<input type="text" class="drawer-name" id="df-name" data-k="name" data-testid="drawer-field-name" value="${esc(t.name)}" aria-label="Tên đơn" maxlength="200">` : `<div class="drawer-name is-ro" data-testid="drawer-field-name">${esc(o.name)}</div>`}
    ${d.errors.name ? `<div class="field-error" role="alert">${esc(d.errors.name)}</div>` : ''}
    <div class="drawer-meta">${statusPill(o)}${sizeBadge(o)}${effPrioHtml(o)}${deadlineBadge(o)}${flagsHtml(o, { child: true })}</div>`)}
    ${bannerHtml(d)}
    ${drawerActions(o, d)}
    ${reviewBox}${flags.join('')}
    ${d.errors._ ? `<div class="drawer-banner is-danger" role="alert">${esc(d.errors._)}</div>` : ''}
    <div class="tabs" role="tablist">
      <button type="button" class="tab" role="tab" id="tab-details" data-testid="drawer-tab-details" data-tab="details" aria-selected="${d.tab === 'details'}" aria-controls="drawer-panel">Chi tiết</button>
      <button type="button" class="tab" role="tab" id="tab-activity" data-testid="drawer-tab-activity" data-tab="activity" aria-selected="${d.tab === 'activity'}" aria-controls="drawer-panel">Lịch sử & bình luận</button>
    </div>
    <div class="drawer-body" id="drawer-panel" role="tabpanel" aria-labelledby="tab-${d.tab}">${d.tab === 'details' ? details : activity}</div>
    <div class="savebar" ${d.isDirty() ? '' : 'hidden'}><span class="msg">Bạn có thay đổi chưa lưu</span>
      <button type="button" class="btn" data-testid="drawer-cancel" data-act="drawer-cancel">Hủy</button>
      <button type="button" class="btn btn-brand" data-testid="drawer-save" data-act="drawer-save" data-write>Lưu thay đổi</button></div>`;
}
function focusFirstError(el) {
  if (!el) return;
  const errName = el.querySelector('.drawer-name + .field-error');
  if (errName) { el.querySelector('.drawer-name').focus(); return; }
  const f = $$('.field.has-error', el).map((fl) => fl.querySelector('input:not([type="hidden"]):not([tabindex="-1"]):not([hidden]), select, textarea:not([hidden])')).find(Boolean);
  if (f) { f.setAttribute('aria-invalid', 'true'); f.focus(); }
}
function autosize(ta) { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight + 2, 420) + 'px'; }
function autosizeAll(el) { $$('textarea.autosize', el).forEach(autosize); $$('textarea[data-k="briefLink"], textarea[data-k="deliveryLink"]', el).forEach(autosize); }

// --- activity ---
function logLine(l) {
  const a = `<b>${esc(l.actor || Rules.SYSTEM_ACTOR)}</b>`;
  const fv = (v) => { const s = fmtFieldValue(l.field, v); return esc(s.length > 80 ? s.slice(0, 80) + '…' : s); };
  switch (l.action) {
    case 'create': return `${a} ${l.text === 'Cấp ID cho dòng nhập tay' ? 'đã cấp ID cho dòng nhập tay' : 'đã tạo đơn'}`;
    case 'status': return `${a} chuyển trạng thái <b>${esc(l.oldValue || 'Mới')} → ${esc(l.newValue)}</b>${trim(l.text) ? `<div class="act-quote">${linkify(l.text)}</div>` : ''}`;
    case 'update': {
      const lab = Rules.FIELD_LABELS[l.field] || l.field;
      const why = trim(l.text) ? `<div class="act-quote">${linkify(l.text)}</div>` : '';
      if (['description', 'notes', 'usage', 'acceptance'].indexOf(l.field) >= 0) return `${a} đã sửa <b>${esc(lab)}</b>${why}`;
      if (l.field === 'holdReason') return trim(l.newValue) ? `${a} <b>tạm dừng</b> đơn<div class="act-quote">${esc(l.newValue)}</div>` : `${a} bỏ tạm dừng`;
      return `${a} đã sửa <b>${esc(lab)}</b>: ${fv(l.oldValue)} → ${fv(l.newValue)}${why}`;
    }
    case 'comment': return `${a}<div class="act-comment">${linkify(l.text)}</div>`;
    case 'split': return `${a} <b>chia đợt</b>: ${esc(l.text)}`;
    case 'remind': case 'mail': return `${a} ${esc(l.text)}`;
    case 'delete': return `${a} đã xóa đơn`;
    default: return `${a} ${esc(l.text)}`;
  }
}
function activityHtml(id) {
  const list = S.logCache.get(String(id).toUpperCase());
  const lerr = logErrors.get(String(id).toUpperCase());
  if (!list && lerr) return `<div class="empty is-error" role="alert" style="padding:24px 8px"><div class="empty-title">Không tải được lịch sử</div><p>${esc(lerr)}</p><button type="button" class="btn btn-sm" data-act="retry-log">Thử lại</button></div>`;
  if (!list) return `<div data-testid="loading-state" class="stack" aria-busy="true"><span class="skel" style="width:70%"></span><span class="skel" style="width:50%"></span><span class="skel" style="width:60%"></span></div>`;
  if (!list.length) return `<ol class="activity-list" data-testid="activity-list"></ol><p class="muted">Chưa có hoạt động nào</p>`;
  return `<ol class="activity-list" data-testid="activity-list">${list.map((l) => `<li class="activity-item ${l._pending ? 'is-saving' : ''}" data-testid="activity-item">${avatar(l.actor || Rules.SYSTEM_ACTOR, '')}<div><div class="act-head">${logLine(l)}</div><div class="act-time" title="${esc(l.ts)}">${esc(relTime(l.ts))}${l._pending ? ' · đang gửi…' : ''}</div></div></li>`).join('')}</ol>`;
}
const logLoading = new Set();
const logErrors = new Map();
async function loadActivity(id) {
  const key = String(id).toUpperCase();
  if (logLoading.has(key) || S.logCache.has(key) || logErrors.has(key)) return;
  logLoading.add(key);
  try {
    const list = await S.api.getLog(id, auth());
    S.logCache.set(key, list || []);
  } catch (e0) {
    const e = toApiError(e0);
    if (e.code === 'UNAUTHORIZED') { logLoading.delete(key); App.onUnauthorized(); return; }
    logErrors.set(key, e.message);
  } finally { logLoading.delete(key); }
  App.onLogChanged(id);
}

function bindDrawerEvents(el) {
  el.addEventListener('input', (e) => {
    const k = e.target.dataset.k;
    const d = Drawer;
    if (e.target.id === 'df-deadline') { const v = readDate(e.target); if (v !== null) d.draft.deadline = v; d.updateSavebar(); return; }
    if (!k || !d.draft) return;
    const v = e.target.value;
    if (e.target.tagName === 'TEXTAREA' && e.target.classList.contains('autosize')) autosize(e.target);
    d.draft[k] = v;
    if (d.errors[k]) { delete d.errors[k]; const f = e.target.closest('.field'); if (f) { f.classList.remove('has-error'); const fe = f.querySelector('.field-error'); if (fe) fe.remove(); } }
    d.updateSavebar();
  });
  el.addEventListener('change', (e) => { if (e.target.dataset.k === 'quantity' && trim(e.target.value) === '') { Drawer.draft.quantity = Drawer.original.quantity; } });
  el.addEventListener('click', async (e) => {
    const d = Drawer;
    const b = e.target.closest('button, a'); if (!b) return;
    const act = b.dataset.act;
    if (b.dataset.qaTo) { if (d.original) transition(d.original.id, b.dataset.qaTo); return; }
    if (b.dataset.tab) { d.tab = b.dataset.tab; d.render(); const tb = el.querySelector(`[data-tab="${d.tab}"]`); if (tb) tb.focus(); return; }
    if (b.dataset.editLinks) { d.editLinks[b.dataset.editLinks] = true; d.render(); const ta = el.querySelector(`[data-k="${b.dataset.editLinks}"]`); if (ta) ta.focus(); return; }
    switch (act) {
      case 'close-drawer': d.requestClose(); break;
      case 'drawer-save': d.save(); break;
      case 'drawer-cancel': d.draft = clone(d.original); d.errors = {}; d.editLinks = {}; d.render(); break;
      case 'reload-task': { const t = getTask(d.id); if (t) { d.original = clone(t); d.draft = clone(t); } d.banner = null; d.errors = {}; d.render(); break; }
      case 'copy-link': copyLink(d.original.id); break;
      case 'size': openSizeDialog(getTask(d.original.id) || d.original); break;
      case 'prio': openPriorityDialog(getTask(d.original.id) || d.original); break;
      case 'hold': toggleHold(d.original.id); break;
      case 'split': openSplitDialog(getTask(d.original.id) || d.original); break;
      case 'drawer-menu': openMenu(b, () => [
        { html: `${ICONS.copy}<span>Sao chép liên kết</span>`, fn: () => copyLink(d.original.id) },
        { sep: true },
        { html: `${ICONS.trash}<span>Xóa đơn</span>`, fn: () => confirmDelete(d.original.id), disabled: !S.online || d.deleted || !can('delete', d.original).ok, noFocusBack: true },
      ]); break;
      case 'delete': confirmDelete(d.original.id); break;
      case 'comment': submitComment(); break;
      case 'retry-log': logErrors.delete(String(d.id).toUpperCase()); { const box = el.querySelector('#activity-box'); if (box) box.innerHTML = activityHtml(d.id); } loadActivity(d.id); break;
      default: break;
    }
  });
  el.addEventListener('keydown', (e) => {
    if (e.target.id === 'comment-input' && e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); submitComment(); }
    if (e.target.classList.contains('drawer-name') && e.key === 'Enter') { e.preventDefault(); Drawer.save(); }
  });
}
async function submitComment() {
  const d = Drawer; const ta = d.el && d.el.querySelector('#comment-input'); if (!ta) return;
  const text = trim(ta.value); if (!text) { ta.focus(); return; }
  if (!guardOnline()) return;
  ta.value = '';
  const ok = await addComment(d.original.id, text);
  if (!ok && d.el) { const t2 = d.el.querySelector('#comment-input'); if (t2 && !t2.value) t2.value = text; }
}
async function confirmDelete(id) {
  const ok = await confirmDialog({
    title: `Xóa vĩnh viễn ${id}?`, danger: true, confirmText: 'Xóa', cancelText: 'Không', confirmTestid: 'confirm-delete',
    desc: 'Dòng này sẽ bị xóa khỏi Google Sheet. Dùng “Hủy đơn” nếu chỉ muốn ngừng làm.',
  });
  if (!ok) return;
  Drawer.draft = clone(Drawer.original);
  App.closeOverlayNav();
  deleteTask(id);
}
function copyLink(id) {
  const url = location.href.split('#')[0] + '#/task/' + encodeURIComponent(id);
  const done = () => toast('Đã sao chép liên kết', { type: 'info' });
  try {
    if (navigator.clipboard && window.isSecureContext) { navigator.clipboard.writeText(url).then(done, () => { fallbackCopy(url); done(); }); return; }
  } catch (e) { /* fallthrough */ }
  fallbackCopy(url); done();
}
function fallbackCopy(text) {
  const ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
  document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); } catch (e) { /* ignore */ } ta.remove();
}

// ============================================================================
// Tạo đơn — AI intake conversation + manual wizard (§5.1)
// ============================================================================
const ORDER_FIELDS = ['name', 'description', 'usage', 'quantity', 'outputSpec', 'acceptance', 'assetType', 'deadline'];
const ORDER_LABELS = { name: 'Tên đơn', description: 'Cần làm gì', usage: 'Dùng vào đâu', quantity: 'Số lượng', outputSpec: 'Kích thước / định dạng', acceptance: 'Thế nào là đạt', assetType: 'Loại asset', deadline: 'Hạn cần', briefLink: 'Link tham chiếu', priority: 'Mức quan trọng', project: 'Dự án', urgentReason: 'Lý do gấp' };
const MANUAL_STEPS = [
  { title: 'Việc cần làm', keys: ['name', 'description', 'project', 'assetType'] },
  { title: 'Khối lượng & mục đích', keys: ['quantity', 'usage', 'outputSpec', 'acceptance'] },
  { title: 'Hạn & mức quan trọng', keys: ['deadline', 'priority', 'urgent', 'urgentReason', 'briefLink'] },
];
function freshOrder() {
  const last = LS.get('va.ui.lastOrder', {}) || {};
  const projects = S.config.projects || [];
  return {
    phase: 'compose', busy: false, error: null, aiDown: null,
    input: { message: '', project: projects.some((p) => sameName(p, last.project)) ? last.project : (projects.length === 1 ? projects[0] : ''), urgent: false, urgentReason: '', briefLink: '', deadline: '' },
    draftId: null, round: 0, history: [], questions: [], answers: [], result: null,
    form: {}, step: 0, errors: {}, created: null, cid: uid(),
  };
}
let Order = null;
function orderFormFromResult(r, inp) {
  const f = (r && r.fields) || {};
  return {
    name: f.name || '', description: f.description || inp.message || '', usage: f.usage || '', quantity: f.quantity || 1, outputSpec: f.outputSpec || '',
    acceptance: f.acceptance || '', assetType: f.assetType || '', deadline: f.deadline || inp.deadline || '', briefLink: inp.briefLink || '',
    priority: (r && r.priority) || defaultPriority(), project: inp.project, urgent: inp.urgent, urgentReason: inp.urgentReason,
  };
}
function prioOptionsFor(sel, o) {
  const prios = S.config.priorities || [];
  return prios.map((p, i) => ({ p, i })).filter(({ i }) => (i === 0 ? o.urgent : i >= (o.minIndex || 0) || (o.minIndex || 0) === 0))
    .map(({ p, i }) => `<option value="${esc(p)}" ${sameName(p, sel) ? 'selected' : ''}>${esc(p)}${i === 0 ? ' — Gấp' : ''}</option>`).join('');
}
function orderComposeHtml(O) {
  const inp = O.input;
  const aiOff = S.aiEnabled === false;
  const err = O.errors;
  const fe = (k) => (err[k] ? `<div class="field-error" role="alert">${esc(err[k])}</div>` : '');
  return `<section class="card order-card" data-testid="order-compose">
    <div class="field ${err.message ? 'has-error' : ''}" data-f="message"><label for="or-message" class="order-q">Bạn cần team VA làm gì?</label>
      <textarea id="or-message" data-testid="order-message" rows="6" maxlength="${Rules.MAX_ORDER_CHARS || 4000}" placeholder="Viết tự nhiên như nhắn tin. VD: Cần 12 icon kỹ năng hệ Lửa cho cây kỹ năng mới, style giống bộ hệ Băng, PNG 256×256, cần trước 15/11 để kịp build." ${O.busy ? 'disabled' : ''}>${esc(inp.message)}</textarea>
      <div class="field-hint order-count"><span>Ghi rõ số lượng, dùng vào đâu và thế nào là đạt — AI sẽ hỏi thêm nếu thiếu.</span><span data-count>${inp.message.length}/${Rules.MAX_ORDER_CHARS || 4000}</span></div>${fe('message')}</div>
    <div class="form-grid">
      <div class="field ${err.project ? 'has-error' : ''}" data-f="project"><label for="or-project">Dự án <span class="req">*</span></label>
        <select id="or-project" data-testid="order-project" ${O.busy ? 'disabled' : ''}><option value="">— Chọn dự án —</option>${(S.config.projects || []).map((p) => `<option value="${esc(p)}" ${sameName(p, inp.project) ? 'selected' : ''}>${esc(p)}</option>`).join('')}</select>${fe('project')}</div>
      <div class="field ${err.deadline ? 'has-error' : ''}" data-f="deadline"><label for="or-deadline">Hạn cần (tùy chọn)</label>${dateInputHtml({ id: 'or-deadline', testid: 'order-deadline', value: inp.deadline, min: today(), label: 'hạn cần', disabled: O.busy })}${fe('deadline')}</div>
      <div class="field span-2 ${err.briefLink ? 'has-error' : ''}" data-f="briefLink"><label for="or-link">Link tham chiếu (tùy chọn)</label>
        <input type="text" id="or-link" data-testid="order-link" value="${esc(inp.briefLink)}" placeholder="https://… (Drive, Figma, ảnh mẫu)" autocomplete="off" ${O.busy ? 'disabled' : ''}>${fe('briefLink')}</div>
      <div class="field span-2 urgent-box ${inp.urgent ? 'is-on' : ''}" data-f="urgentReason">
        <label class="check"><input type="checkbox" id="or-urgent" data-testid="order-urgent" ${inp.urgent ? 'checked' : ''} ${O.busy ? 'disabled' : ''}><span><b>Gấp</b> — cần làm trước các đơn khác</span></label>
        <div class="urgent-reason" ${inp.urgent ? '' : 'hidden'}><label for="or-urgent-reason" class="sr-only">Lý do gấp</label>
          <input type="text" id="or-urgent-reason" data-testid="order-urgent-reason" value="${esc(inp.urgentReason)}" maxlength="500" placeholder="Vì sao gấp? (ít nhất 5 ký tự, VD: event lên sóng 31/10)" ${O.busy ? 'disabled' : ''}>${fe('urgentReason')}</div></div>
    </div>
    ${aiOff ? '<div class="ai-note is-off">AI đang tắt trên máy chủ — bạn điền form thủ công nhé.</div>' : ''}
    <div class="order-actions">
      ${aiOff ? '' : `<button type="button" class="btn btn-brand" data-testid="order-ai-submit" data-act="ai-submit" data-write ${O.busy ? 'disabled' : ''}>${O.busy ? '<span class="saving-spin" aria-hidden="true"></span>AI đang đọc…' : ICONS.spark + 'Gửi cho AI xem'}</button>`}
      <button type="button" class="btn ${aiOff ? 'btn-brand' : 'btn-ghost'}" data-testid="order-manual" data-act="manual" ${O.busy ? 'disabled' : ''}>Điền form thủ công</button>
    </div>
  </section>`;
}
function bubbleUser(text) { return `<div class="bubble is-user"><div class="bubble-body">${esc(text).replace(/\n/g, '<br>')}</div></div>`; }
function bubbleAi(html) { return `<div class="bubble is-ai"><span class="bubble-ava" aria-hidden="true">${ICONS.spark}</span><div class="bubble-body">${html}</div></div>`; }
function orderThreadHtml(O) {
  return O.history.map((h) => (h.role === 'user' ? bubbleUser(h.text) : bubbleAi(`<ol class="ai-qs">${h.questions.map((q) => `<li>${esc(q)}</li>`).join('')}</ol>`))).join('');
}
function orderQuestionsHtml(O) {
  return `<section class="card order-card" data-testid="order-questions">
    <div class="thread">${orderThreadHtml(O)}
      ${bubbleAi(`<div class="ai-round">Vòng ${O.round}/${Rules.MAX_AI_ROUNDS || 3} · AI cần thêm vài thông tin</div>
        <div class="stack">${O.questions.map((q, i) => `<div class="field ${O.errors['a' + i] ? 'has-error' : ''}" data-f="a${i}"><label for="or-ans-${i}" data-testid="order-ai-question-${i}">${esc(q)}</label>
          <textarea id="or-ans-${i}" data-testid="order-ai-answer-${i}" rows="2" maxlength="1000" ${O.busy ? 'disabled' : ''}>${esc(O.answers[i] || '')}</textarea>${O.errors['a' + i] ? `<div class="field-error" role="alert">${esc(O.errors['a' + i])}</div>` : ''}</div>`).join('')}</div>`)}
    </div>
    <div class="order-actions">
      <button type="button" class="btn btn-brand" data-testid="order-ai-submit" data-act="ai-answer" data-write ${O.busy ? 'disabled' : ''}>${O.busy ? '<span class="saving-spin" aria-hidden="true"></span>AI đang đọc…' : 'Trả lời'}</button>
      <button type="button" class="btn btn-ghost" data-testid="order-manual" data-act="manual" ${O.busy ? 'disabled' : ''}>Bỏ qua, điền form thủ công</button>
      <button type="button" class="btn btn-ghost" data-act="order-restart" data-testid="order-restart" ${O.busy ? 'disabled' : ''}>Viết lại từ đầu</button>
    </div>
  </section>`;
}
function orderFieldHtml(prefix, k, F, err, o = {}) {
  const id = `${prefix}-${k}`; const tid = `${o.tidPrefix}-${k}`;
  const e = err[k];
  const lab = ORDER_LABELS[k] + (k === 'name' || k === 'project' ? ' <span class="req">*</span>' : '');
  const fe = e ? `<div class="field-error" role="alert">${esc(e)}</div>` : '';
  const miss = o.missing && o.missing.indexOf(k) >= 0 ? '<span class="miss-tag">AI chưa rõ</span>' : '';
  const wrap = (inner, span) => `<div class="field ${span ? 'span-2' : ''} ${e ? 'has-error' : ''}" data-f="${k}"><label for="${id}">${lab}${miss}</label>${inner}${fe}</div>`;
  switch (k) {
    case 'name': return wrap(`<input type="text" id="${id}" data-testid="${tid}" data-of="${k}" value="${esc(F.name)}" maxlength="200" placeholder="Tên ngắn gọn, VD: 12 icon kỹ năng hệ Lửa">`, true);
    case 'description': return wrap(`<textarea id="${id}" data-testid="${tid}" data-of="${k}" rows="4" class="autosize" maxlength="5000">${esc(F.description)}</textarea>`, true);
    case 'usage': return wrap(`<textarea id="${id}" data-testid="${tid}" data-of="${k}" rows="2" class="autosize" maxlength="1000" placeholder="Màn hình / sự kiện / kênh nào">${esc(F.usage)}</textarea>`, true);
    case 'acceptance': return wrap(`<textarea id="${id}" data-testid="${tid}" data-of="${k}" rows="2" class="autosize" maxlength="1000" placeholder="VD: đúng palette, chữ đọc rõ trên mobile">${esc(F.acceptance)}</textarea>`, true);
    case 'quantity': return wrap(`<input type="number" id="${id}" data-testid="${tid}" data-of="${k}" min="1" max="9999" step="1" value="${esc(F.quantity)}">`);
    case 'outputSpec': return wrap(`<input type="text" id="${id}" data-testid="${tid}" data-of="${k}" value="${esc(F.outputSpec)}" placeholder="VD: PNG 512×512, nền trong">`);
    case 'assetType': return wrap(`<select id="${id}" data-testid="${tid}" data-of="${k}">${catalogSelectOptions(S.config.assetTypes, F.assetType, { emptyLabel: '— Không rõ / khác —' })}</select>`);
    case 'project': return wrap(`<select id="${id}" data-testid="${tid}" data-of="${k}"><option value="">— Chọn dự án —</option>${(S.config.projects || []).map((p) => `<option value="${esc(p)}" ${sameName(p, F.project) ? 'selected' : ''}>${esc(p)}</option>`).join('')}</select>`);
    case 'deadline': return wrap(dateInputHtml({ id, testid: tid, value: F.deadline, min: today(), label: 'hạn cần' }));
    case 'briefLink': return wrap(`<input type="text" id="${id}" data-testid="${tid}" data-of="${k}" value="${esc(F.briefLink)}" placeholder="https://…" autocomplete="off">`, true);
    case 'priority': return wrap(`<select id="${id}" data-testid="${tid}" data-of="${k}">${prioOptionsFor(F.priority, { urgent: F.urgent, minIndex: o.minPrio || 0 })}</select>${o.prioHint ? `<div class="field-hint">${esc(o.prioHint)}</div>` : ''}`);
    case 'urgent': return `<div class="field span-2 urgent-box ${F.urgent ? 'is-on' : ''}" data-f="urgent"><label class="check"><input type="checkbox" id="${id}" data-testid="${tid}" data-of="urgent" ${F.urgent ? 'checked' : ''}><span><b>Gấp</b> — cần lý do</span></label></div>`;
    case 'urgentReason': return F.urgent ? wrap(`<input type="text" id="${id}" data-testid="${tid}" data-of="${k}" value="${esc(F.urgentReason)}" maxlength="500" placeholder="Ít nhất 5 ký tự">`, true) : '';
    default: return '';
  }
}
function orderPreviewHtml(O) {
  const r = O.result || {}; const F = O.form;
  const prios = S.config.priorities || [];
  const aiIdx = Math.max(0, prios.findIndex((p) => sameName(p, r.priority)));
  const keys = ['name', 'description', 'usage', 'quantity', 'outputSpec', 'acceptance', 'assetType', 'deadline', 'briefLink'];
  const sug = r.size === 'XL' ? (r.splitSuggestion || []) : [];
  return `<section class="card order-card" data-testid="order-preview">
    ${O.history.length ? `<details class="thread-fold"><summary>${ICONS.chev}Xem lại trao đổi với AI (${O.round} vòng)</summary><div class="thread">${orderThreadHtml(O)}</div></details>` : ''}
    <div class="assess" data-testid="order-assessment">
      <div class="assess-item"><span class="assess-l">Độ nặng (AI chấm)</span><span class="assess-v">${r.size ? `<span class="size-badge is-lg" data-size="${esc(r.size)}" data-testid="order-ai-size">${esc(r.size)}</span><span>${esc(sizeHint(r.size))}</span>` : '<span class="size-badge is-empty" data-testid="order-ai-size">chưa chấm</span><span class="muted">VA sẽ chốt</span>'}</span>
        ${trim(r.sizeReason) ? `<span class="assess-why">${esc(r.sizeReason)}</span>` : ''}</div>
      <div class="assess-item"><span class="assess-l">Mức quan trọng</span>
        <div class="field" data-f="priority"><select id="op-priority" data-testid="order-preview-field-priority" data-of="priority" aria-label="Mức quan trọng">${prioOptionsFor(F.priority, { urgent: F.urgent, minIndex: aiIdx })}</select></div>
        ${trim(r.priorityReason) ? `<span class="assess-why">${esc(r.priorityReason)}</span>` : ''}
        <span class="field-hint">Bạn có thể hạ mức; “${esc(prios[0] || 'Khẩn cấp')}” chỉ khi đã tick Gấp.</span></div>
      ${trim(r.summary) ? `<div class="assess-item span-2"><span class="assess-l">${ICONS.spark} Tóm tắt cho VA</span><span class="assess-sum">${esc(r.summary)}</span></div>` : ''}
      ${sug.length ? `<div class="assess-item span-2"><span class="assess-l">Gợi ý chia đợt (VA sẽ chốt)</span><ol class="split-sug">${sug.map((p) => `<li>${esc(p.name)} <span class="size-badge" data-size="${esc(p.size)}">${esc(p.size)}</span></li>`).join('')}</ol></div>` : ''}
    </div>
    ${(r.missing || []).length ? `<div class="ai-note is-warn" data-testid="order-missing">AI chưa rõ: ${(r.missing || []).map((k) => esc(ORDER_LABELS[k] || Rules.FIELD_LABELS[k] || k)).join(', ')}. Bạn bổ sung giúp nếu có thể.</div>` : ''}
    <div class="form-grid">${keys.map((k) => orderFieldHtml('op', k, F, O.errors, { tidPrefix: 'order-preview-field', missing: r.missing || [] })).join('')}</div>
    <div class="field-error" data-general-error ${O.errors._ ? '' : 'hidden'} role="alert">${esc(O.errors._ || '')}</div>
    <div class="order-actions">
      <button type="button" class="btn btn-brand" data-testid="order-submit" data-act="order-submit" data-write ${O.busy ? 'disabled' : ''}>${O.busy ? '<span class="saving-spin" aria-hidden="true"></span>Đang gửi…' : 'Gửi đơn'}</button>
      <button type="button" class="btn btn-ghost" data-act="order-restart" data-testid="order-restart" ${O.busy ? 'disabled' : ''}>Viết lại từ đầu</button>
    </div>
  </section>`;
}
function orderManualHtml(O) {
  const st = MANUAL_STEPS[O.step];
  const last = O.step === MANUAL_STEPS.length - 1;
  return `<section class="card order-card" data-testid="order-manual-form">
    ${O.aiDown ? `<div class="ai-note is-warn" role="status" data-testid="order-ai-error"><span><b>Không dùng được AI:</b> ${esc(O.aiDown)} Đơn vẫn gửi bình thường — VA sẽ chốt độ nặng sau.</span></div>` : ''}
    <ol class="wizard-steps" aria-label="Các bước">${MANUAL_STEPS.map((s, i) => `<li class="${i === O.step ? 'is-current' : i < O.step ? 'is-done' : ''}" ${i === O.step ? 'aria-current="step"' : ''}><span>${i + 1}</span>${esc(s.title)}</li>`).join('')}</ol>
    <div class="form-grid">${st.keys.map((k) => orderFieldHtml('om', k, O.form, O.errors, { tidPrefix: 'order-field', prioHint: k === 'priority' ? 'Mặc định Trung bình. Chọn Khẩn cấp cần tick Gấp và lý do.' : '' })).join('')}</div>
    <div class="field-error" data-general-error ${O.errors._ ? '' : 'hidden'} role="alert">${esc(O.errors._ || '')}</div>
    <div class="order-actions">
      ${O.step > 0 ? `<button type="button" class="btn" data-act="step-back" data-testid="order-step-back">← Quay lại</button>` : ''}
      ${last ? `<button type="button" class="btn btn-brand" data-testid="order-submit" data-act="order-submit" data-write ${O.busy ? 'disabled' : ''}>${O.busy ? '<span class="saving-spin" aria-hidden="true"></span>Đang gửi…' : 'Gửi đơn'}</button>`
        : `<button type="button" class="btn btn-primary" data-act="step-next" data-testid="order-step-next">Tiếp →</button>`}
      ${S.aiEnabled !== false && !O.aiDown ? `<button type="button" class="btn btn-ghost" data-act="order-restart" data-testid="order-restart">Dùng AI</button>` : ''}
    </div>
  </section>`;
}
function orderDoneHtml(O) {
  const t = getTask(O.created.id) || O.created;
  const q = queueInfoOf(t);
  return `<section class="card order-card order-done" data-testid="order-done">
    <div class="done-mark" aria-hidden="true">${ICONS.check}</div>
    <h2>Đã gửi đơn <span class="mono">${esc(t.id)}</span></h2>
    <p class="muted">${esc(t.name)}</p>
    ${q ? `<p class="done-pos" data-testid="queue-pos-${esc(t.id)}">Vị trí <b>#${esc(q.position)}</b> / ${esc(q.total)} trong hàng đợi</p>` : '<p class="done-pos">Đơn đã vào hàng đợi của team VA.</p>'}
    <p class="muted">Bạn sẽ nhận email khi VA gửi kết quả để duyệt.</p>
    <div class="order-actions center"><a class="btn btn-primary" href="#/task/${encodeURIComponent(t.id)}" data-testid="order-view">Xem đơn</a>
      <a class="btn" href="#/mine" data-testid="order-go-mine">Đơn của tôi</a>
      <button type="button" class="btn btn-ghost" data-act="order-another" data-testid="order-new-another">Tạo đơn khác</button></div>
  </section>`;
}
function renderOrder(view) {
  if (!Order) Order = freshOrder();
  const O = Order;
  const steps = [['compose', 'Mô tả'], ['questions', 'AI hỏi thêm'], ['preview', 'Xem lại & gửi']];
  const phaseIdx = O.phase === 'manual' ? -1 : O.phase === 'done' ? 3 : steps.findIndex((s) => s[0] === O.phase);
  let body;
  if (O.phase === 'questions') body = orderQuestionsHtml(O);
  else if (O.phase === 'preview') body = orderPreviewHtml(O);
  else if (O.phase === 'manual') body = orderManualHtml(O);
  else if (O.phase === 'done') body = orderDoneHtml(O);
  else body = orderComposeHtml(O);
  view.innerHTML = `<div class="view-head"><div><h1 class="view-title">Tạo đơn</h1><p class="view-sub">${O.phase === 'manual' ? 'Form thủ công — 3 bước ngắn.' : 'Mô tả tự nhiên, AI giúp bạn viết thành đơn rõ ràng cho team VA.'}</p></div>
    ${O.phase !== 'manual' && O.phase !== 'done' ? `<ol class="order-progress" aria-label="Tiến trình">${steps.map(([k, l], i) => `<li class="${i === phaseIdx ? 'is-current' : i < phaseIdx ? 'is-done' : ''}">${l}</li>`).join('')}</ol>` : ''}</div>
    <div class="order-wrap">${body}
      ${O.phase === 'compose' ? `<aside class="order-tips"><h2>Mẹo để đơn được làm nhanh</h2><ul><li><b>Số lượng</b> cụ thể (12 icon, 3 banner…)</li><li><b>Dùng vào đâu</b> — màn hình, sự kiện, kênh</li><li><b>Thế nào là đạt</b> — style mẫu, màu, kích thước</li><li>Khối lượng lớn (> 3 ngày) sẽ được <b>chia đợt</b> và giao dần.</li></ul></aside>` : ''}
    </div>`;
  autosizeAll(view);
}
function readOrderCompose(view) {
  const O = Order; const v = (id) => { const x = view.querySelector('#' + id); return x ? x.value : ''; };
  if (!view.querySelector('#or-message')) return true;
  O.input.message = v('or-message');
  O.input.project = v('or-project');
  O.input.briefLink = trim(v('or-link'));
  O.input.urgent = !!(view.querySelector('#or-urgent') || {}).checked;
  O.input.urgentReason = trim(v('or-urgent-reason'));
  const d = readDate(view.querySelector('#or-deadline'));
  O.input.deadline = d || '';
  return d !== null;
}
function readOrderForm(view) {
  const O = Order; let okDate = true;
  $$('[data-of]', view).forEach((x) => {
    const k = x.dataset.of;
    if (k === 'urgent') O.form.urgent = x.checked;
    else O.form[k] = x.value;
  });
  $$('.date-text', view).forEach((x) => { const v = readDate(x); if (v === null) okDate = false; else O.form.deadline = v; });
  return okDate;
}
function composeErrors(O) {
  const e = {};
  if (trim(O.input.message).length < 5) e.message = 'Hãy mô tả việc bạn cần (ít nhất vài từ)';
  if (!trim(O.input.project)) e.project = 'Bắt buộc chọn Dự án';
  if (O.input.urgent && trim(O.input.urgentReason).length < 5) e.urgentReason = 'Lý do gấp cần ít nhất 5 ký tự';
  if (trim(O.input.briefLink) && !Rules.isUrlList(O.input.briefLink)) e.briefLink = 'Link không hợp lệ (http/https)';
  if (O.input.deadline && Rules.diffDays(O.input.deadline, today()) < 0) e.deadline = 'Hạn cần không được ở quá khứ';
  return e;
}
function focusOrderError(view) {
  const f = view.querySelector('.field.has-error input:not([type="hidden"]):not([tabindex="-1"]), .field.has-error select, .field.has-error textarea');
  if (f) { f.setAttribute('aria-invalid', 'true'); f.focus(); }
}
async function orderAi(view, answering) {
  const O = Order; if (O.busy) return;
  if (!guardOnline()) return;
  O.errors = {};
  if (!answering) {
    if (!readOrderCompose(view)) { O.errors.deadline = 'Ngày không hợp lệ (dd/mm/yyyy)'; renderOrder(view); focusOrderError(view); return; }
    const e = composeErrors(O);
    if (Object.keys(e).length) { O.errors = e; renderOrder(view); focusOrderError(view); return; }
    O.draftId = null; O.round = 0; O.history = []; O.result = null;
    LS.set('va.ui.lastOrder', { project: O.input.project });
  } else {
    O.answers = O.questions.map((_, i) => trim((view.querySelector('#or-ans-' + i) || {}).value || ''));
    if (!O.answers.some(Boolean)) { O.errors = { a0: 'Trả lời ít nhất một câu (hoặc chọn điền form thủ công)' }; renderOrder(view); focusOrderError(view); return; }
  }
  const body = { project: O.input.project, urgent: O.input.urgent, urgentReason: O.input.urgent ? O.input.urgentReason : '', briefLink: O.input.briefLink, deadline: O.input.deadline };
  if (O.draftId) { body.draftId = O.draftId; body.answers = O.answers; } else body.message = O.input.message;
  O.busy = true; renderOrder(view);
  beginWrite();
  try {
    const r = await S.api.aiIntake(body, auth());
    if (Order !== O) return;
    if (!O.draftId) O.history.push({ role: 'user', text: O.input.message });
    else { O.history.push({ role: 'ai', questions: O.questions.slice() }); O.history.push({ role: 'user', text: O.questions.map((q, i) => O.answers[i] ? `${q} → ${O.answers[i]}` : '').filter(Boolean).join('\n') }); }
    O.draftId = r.draftId; O.round = r.round || O.round + 1; O.result = r.result || null;
    if (r.status === 'need_info' && (r.questions || []).length) { O.phase = 'questions'; O.questions = r.questions.slice(0, 3); O.answers = []; }
    else { O.phase = 'preview'; O.form = orderFormFromResult(r.result, O.input); }
    S.aiEnabled = true;
  } catch (e0) {
    const e = toApiError(e0);
    if (Order !== O) return;
    if (e.code === 'UNAUTHORIZED') { O.busy = false; App.onUnauthorized(); return; }
    if (e.code === 'AI_UNAVAILABLE') { toManual(O, e.message); }
    else if (e.code === 'NOT_FOUND') { O.phase = 'compose'; O.draftId = null; O.errors = { message: 'Phiên trao đổi với AI đã hết hạn — gửi lại để bắt đầu.' }; }
    else if (e.code === 'VALIDATION') { O.errors = errFields(e); if (O.errors.message === undefined && O.errors._) O.errors.message = O.errors._; }
    else toast('AI chưa trả lời được: ' + e.message, { type: 'error', retry: () => orderAi($('#view'), answering) });
  } finally { O.busy = false; endWrite(); }
  if (S.view === 'new' && Order === O) { renderOrder(view); const f = view.querySelector(O.phase === 'questions' ? '#or-ans-0' : O.phase === 'preview' ? '#op-name' : O.phase === 'manual' ? '#om-name' : '#or-message'); if (f && !view.querySelector('.has-error')) f.focus(); else focusOrderError(view); }
}
function toManual(O, aiDown) {
  O.phase = 'manual'; O.step = 0; O.errors = {};
  O.aiDown = aiDown || null;
  const base = O.result ? orderFormFromResult(O.result, O.input) : orderFormFromResult(null, O.input);
  if (!O.result) { base.name = trim(O.input.message).split(/\n/)[0].slice(0, 80); base.priority = defaultPriority(); }
  O.form = Object.assign(base, { urgent: O.input.urgent, urgentReason: O.input.urgentReason, project: O.input.project });
}
function orderInput(O) {
  const F = O.form;
  const prios = S.config.priorities || [];
  const input = {
    name: trim(F.name), description: String(F.description || '').replace(/\s+$/, ''), usage: String(F.usage || '').replace(/\s+$/, ''),
    quantity: trim(F.quantity) === '' ? null : Number(F.quantity), outputSpec: trim(F.outputSpec), acceptance: String(F.acceptance || '').replace(/\s+$/, ''),
    assetType: trim(F.assetType), project: trim(F.project || O.input.project), team: (S.user && S.user.team) || '', deadline: trim(F.deadline),
    briefLink: trim(F.briefLink), priority: trim(F.priority), urgentReason: F.urgent ? trim(F.urgentReason) : '',
  };
  if (!F.urgent && prios.indexOf(input.priority) === 0) input.priority = prios[1] || input.priority;
  return input;
}
function orderValidate(O, input) {
  const e = {};
  if (O.form.urgent && trim(O.form.urgentReason).length < 5) e.urgentReason = 'Lý do gấp cần ít nhất 5 ký tự';
  try { Rules.buildNewTask(input, Object.assign(localCtx(), { aiResult: O.phase === 'preview' ? O.result : null }), S.tasks.map((t) => t.id)); }
  catch (e0) { Object.assign(e, errFields(e0)); }
  if (e.priority && O.phase === 'manual' && !O.form.urgent) e.priority = 'Mức Khẩn cấp cần tick Gấp và lý do';
  if (e.urgentReason === undefined && e.priority && O.form.urgent && trim(O.form.urgentReason).length < 5) e.urgentReason = e.priority;
  return e;
}
async function orderSubmit(view) {
  const O = Order; if (O.busy) return;
  if (!guardOnline()) return;
  if (!readOrderForm(view)) { O.errors = { deadline: 'Ngày không hợp lệ (dd/mm/yyyy)' }; renderOrder(view); focusOrderError(view); return; }
  const input = orderInput(O);
  const errs = orderValidate(O, input);
  if (Object.keys(errs).length) {
    O.errors = errs;
    if (O.phase === 'manual') { const s = MANUAL_STEPS.findIndex((st) => st.keys.some((k) => errs[k])); if (s >= 0) O.step = s; else if (errs._ === undefined) O.errors._ = Rules.firstMessage(errs); }
    renderOrder(view); focusOrderError(view); return;
  }
  O.busy = true; O.errors = {}; renderOrder(view);
  const res = await createTask(input, { draftId: O.phase === 'preview' ? O.draftId : null, clientRequestId: O.cid });
  O.busy = false;
  if (Order !== O) return;
  if (res.task) {
    O.created = res.task; O.phase = 'done';
    LS.set('va.ui.lastOrder', { project: input.project });
    toast('Đã gửi đơn ' + res.task.id, { action: { label: 'Xem', fn: () => App.openTask(res.task.id) } });
  } else if (res.errors) {
    O.errors = res.errors;
    if (O.phase === 'manual') { const s = MANUAL_STEPS.findIndex((st) => st.keys.some((k) => res.errors[k])); if (s >= 0) O.step = s; }
    if (!Object.keys(res.errors).some((k) => view.querySelector(`[data-f="${k}"]`))) O.errors._ = res.error ? res.error.message : Rules.firstMessage(res.errors);
  } else if (res.error && res.error.code !== 'UNAUTHORIZED') {
    O.errors = { _: 'Chưa gửi được: ' + res.error.message };
    toast('Chưa gửi được đơn: ' + res.error.message, { type: 'error', retry: () => orderSubmit($('#view')) });
  }
  if (S.view === 'new') { renderOrder(view); if (O.phase === 'done') { const b = view.querySelector('[data-testid="order-view"]'); if (b) b.focus(); } else focusOrderError(view); }
}
function orderStep(view, dir) {
  const O = Order;
  if (!readOrderForm(view)) { O.errors = { deadline: 'Ngày không hợp lệ (dd/mm/yyyy)' }; renderOrder(view); focusOrderError(view); return; }
  if (dir > 0) {
    const keys = MANUAL_STEPS[O.step].keys;
    const errs = orderValidate(O, orderInput(O));
    const mine = {}; keys.forEach((k) => { if (errs[k]) mine[k] = errs[k]; });
    if (Object.keys(mine).length) { O.errors = mine; renderOrder(view); focusOrderError(view); return; }
  }
  O.errors = {};
  O.step = Math.max(0, Math.min(MANUAL_STEPS.length - 1, O.step + dir));
  renderOrder(view);
  const f = view.querySelector('.order-card input:not([type="hidden"]):not([tabindex="-1"]), .order-card textarea, .order-card select'); if (f) f.focus();
}
function bindOrderEvents(view) {
  view.addEventListener('click', (e) => {
    if (S.view !== 'new') return;
    const b = e.target.closest('[data-act]'); if (!b) return;
    switch (b.dataset.act) {
      case 'ai-submit': orderAi(view, false); break;
      case 'ai-answer': orderAi(view, true); break;
      case 'manual': readOrderCompose(view); if (Order.phase === 'questions') Order.answers = Order.questions.map((_, i) => trim((view.querySelector('#or-ans-' + i) || {}).value || '')); toManual(Order, null); renderOrder(view); { const f = view.querySelector('#om-name'); if (f) f.focus(); } break;
      case 'order-restart': { const keep = Order.input; Order = freshOrder(); Order.input = keep; renderOrder(view); const f = view.querySelector('#or-message'); if (f) f.focus(); break; }
      case 'order-submit': orderSubmit(view); break;
      case 'step-next': orderStep(view, 1); break;
      case 'step-back': orderStep(view, -1); break;
      case 'order-another': Order = freshOrder(); renderOrder(view); { const f = view.querySelector('#or-message'); if (f) f.focus(); } break;
      default: break;
    }
  });
  view.addEventListener('input', (e) => {
    if (S.view !== 'new') return;
    const t = e.target;
    if (t.id === 'or-message') { const c = view.querySelector('[data-count]'); if (c) c.textContent = `${t.value.length}/${Rules.MAX_ORDER_CHARS || 4000}`; Order.input.message = t.value; }
    if (t.classList.contains('autosize')) autosize(t);
    const f = t.closest('.field.has-error'); if (f) { f.classList.remove('has-error'); const fe = f.querySelector('.field-error'); if (fe) fe.remove(); t.removeAttribute('aria-invalid'); }
  });
  view.addEventListener('change', (e) => {
    if (S.view !== 'new') return;
    const t = e.target;
    if (t.id === 'or-urgent') { const box = view.querySelector('.urgent-reason'); box.hidden = !t.checked; t.closest('.urgent-box').classList.toggle('is-on', t.checked); Order.input.urgent = t.checked; if (t.checked) view.querySelector('#or-urgent-reason').focus(); }
    if (t.dataset.of === 'urgent') { readOrderForm(view); renderOrder(view); const u = view.querySelector(t.checked ? '#om-urgentReason' : '#om-urgent'); if (u) u.focus(); }
  });
  view.addEventListener('keydown', (e) => {
    if (S.view !== 'new') return;
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      if (Order.phase === 'compose') orderAi(view, false); else if (Order.phase === 'questions') orderAi(view, true);
      else if (Order.phase === 'preview' || (Order.phase === 'manual' && Order.step === MANUAL_STEPS.length - 1)) orderSubmit(view);
      else if (Order.phase === 'manual') orderStep(view, 1);
    }
  });
}

// ============================================================================
// Login (OTP by Gmail; Demo = quick accounts + code 000000)
// ============================================================================
const Login = { step: 'email', email: '', busy: false, error: '', info: '', resendAt: 0, timer: null, showConn: false };
function loginHtml() {
  const L = Login;
  const demo = S.mode === 'demo';
  const accounts = demo && S.api._accounts ? S.api._accounts() : [];
  const grp = (title, list) => list.length ? `<div class="lg-group"><h3>${title}</h3><div class="lg-accounts">${list.map((a) => `<button type="button" class="lg-acc" data-quick="${esc(a.email)}" data-testid="login-demo-${esc(a.email.split('@')[0])}" ${L.busy ? 'disabled' : ''}>${avatar(a.name)}<span><b>${esc(a.name)}</b><span class="muted">${esc(a.email)}</span></span></button>`).join('')}</div></div>` : '';
  const wait = Math.max(0, Math.ceil((L.resendAt - Date.now()) / 1000));
  const apiUrl = trim(LS.raw('va.apiUrl'));
  const gid = !demo && L.step === 'email' ? googleClientId() : '';
  return `<div class="login-stage"><div class="lg-mascot"><button type="button" class="lg-poke" data-lg-poke aria-label="Chọc ${BUDDY_NAME}"><img src="${L.error ? ASSETS.mascotTired : ASSETS.mascotWave}" alt="" draggable="false"></button><p class="lg-say" aria-live="polite">${esc(loginLine())}</p></div><div class="login-card" data-testid="login-screen" role="main" aria-labelledby="lg-title">
    <div class="lg-brand"><img class="brand-mark" src="${ASSETS.teamBadge}" alt="" width="34" height="34"><span class="brand-name">VA Tasks</span>${demo ? '<span class="demo-badge">DEMO</span>' : ''}</div>
    <h1 id="lg-title">${L.step === 'code' ? 'Nhập mã đăng nhập' : 'Đăng nhập'}</h1>
    <p class="muted lg-sub">${L.step === 'code' ? `Mã 6 số đã được gửi tới <b>${esc(L.email)}</b> (nếu Gmail này có trong danh sách). Mã có hiệu lực 10 phút.` : (gid ? 'Dùng tài khoản Google có trong danh sách thành viên của team VA.' : 'Nhập Gmail bạn dùng với team VA — chúng tôi gửi mã 6 số qua email, không cần mật khẩu.')}</p>
    ${demo ? `<div class="lg-demo" role="note"><b>Chế độ Demo</b> — dữ liệu mẫu trong trình duyệt. Mã đăng nhập luôn là <code>${DEMO_OTP}</code>.</div>` : ''}
    ${L.info ? `<div class="lg-info" role="status">${esc(L.info)}</div>` : ''}
    ${gid ? `<div class="lg-google"><div id="g-btn" data-testid="login-google" aria-busy="${L.busy}"></div>${GoogleAuth.failed ? '<p class="field-hint">Không tải được nút Google — dùng mã qua Gmail bên dưới.</p>' : ''}</div><div class="lg-sep"><span>hoặc nhận mã qua Gmail</span></div>` : ''}
    ${L.step === 'email' ? `<form class="lg-form" data-lg="email" novalidate>
        <div class="field"><label for="lg-email">Gmail</label><input type="email" id="lg-email" class="input" data-testid="login-email" value="${esc(L.email)}" placeholder="ten@gmail.com" autocomplete="email" inputmode="email" spellcheck="false" ${L.busy ? 'disabled' : ''} autofocus></div>
        <button type="submit" class="btn btn-brand lg-btn" data-testid="login-send" ${L.busy ? 'disabled' : ''}>${L.busy ? '<span class="saving-spin" aria-hidden="true"></span>Đang gửi…' : 'Gửi mã'}</button>
      </form>` : `<form class="lg-form" data-lg="code" novalidate>
        <div class="field"><label for="lg-code">Mã 6 số</label><input type="text" id="lg-code" class="input lg-code" data-testid="login-code" inputmode="numeric" autocomplete="one-time-code" placeholder="••••••" ${L.busy ? 'disabled' : ''} autofocus></div>
        <button type="submit" class="btn btn-brand lg-btn" data-testid="login-verify" ${L.busy ? 'disabled' : ''}>${L.busy ? '<span class="saving-spin" aria-hidden="true"></span>Đang kiểm tra…' : 'Đăng nhập'}</button>
        <div class="lg-links"><button type="button" class="linklike" data-lg-act="change-email" data-testid="login-change-email">← Đổi Gmail</button>
          <button type="button" class="linklike" data-lg-act="resend" data-testid="login-resend" ${wait ? 'disabled' : ''}>${wait ? `Gửi lại mã (${wait}s)` : 'Gửi lại mã'}</button></div>
      </form>`}
    <div class="field-error lg-error" data-testid="login-error" role="alert" ${L.error ? '' : 'hidden'}>${esc(L.error)}</div>
    ${demo ? `<div class="lg-quick"><div class="lg-sep"><span>hoặc chọn nhanh tài khoản mẫu</span></div>${grp('Team VA', accounts.filter((a) => a.role === 'va'))}${grp('Người order', accounts.filter((a) => a.role !== 'va'))}</div>` : ''}
    <div class="lg-foot" ${BUILT_API && !demo ? 'hidden' : ''}>
      <button type="button" class="linklike" data-lg-act="conn" aria-expanded="${L.showConn}" data-testid="login-conn-toggle">${demo ? 'Kết nối Google Sheet…' : 'Kết nối: ' + esc(apiUrl.replace(/^https:\/\//, '').slice(0, 38)) + '…'}</button>
      ${L.showConn ? `<div class="lg-conn"><label for="lg-api" class="sr-only">Apps Script Web App URL</label><input type="url" id="lg-api" class="input" data-testid="login-api-url" value="${esc(apiUrl)}" placeholder="https://script.google.com/macros/s/…/exec" spellcheck="false">
        <div class="lg-conn-row"><button type="button" class="btn btn-sm" data-lg-act="conn-save" data-testid="login-api-save">Lưu kết nối</button>${apiUrl ? '<button type="button" class="btn btn-sm btn-ghost" data-lg-act="conn-clear">Dùng Demo</button>' : ''}</div>
        <p class="field-hint">Hỏi team VA link Web App của Google Apps Script.</p></div>` : ''}
    </div>
  </div></div>`;
}
// ---------- Google Sign-In (Google Identity Services) ----------
const GoogleAuth = { loading: null, failed: false, inited: '' };
function googleClientId() { return S.mode === 'remote' ? trim(LS.raw('va.googleClientId')) : ''; }
function loadGis() {
  if (window.google && window.google.accounts && window.google.accounts.id) return Promise.resolve();
  if (GoogleAuth.loading) return GoogleAuth.loading;
  GoogleAuth.loading = new Promise((resolve, reject) => {
    const sc = document.createElement('script');
    sc.src = 'https://accounts.google.com/gsi/client'; sc.async = true; sc.defer = true;
    sc.onload = () => resolve(); sc.onerror = () => { GoogleAuth.loading = null; reject(new Error('gis')); };
    document.head.appendChild(sc);
  });
  return GoogleAuth.loading;
}
async function mountGoogleButton() {
  const cid = googleClientId(); const box = $('#g-btn');
  if (!cid || !box) return;
  try { await loadGis(); } catch (e) { if (!GoogleAuth.failed) { GoogleAuth.failed = true; renderLogin(); } return; }
  const el = $('#g-btn'); if (!el) return;
  if (GoogleAuth.inited !== cid) {
    window.google.accounts.id.initialize({ client_id: cid, callback: (resp) => googleLogin(resp && resp.credential), ux_mode: 'popup', auto_select: false, itp_support: true });
    GoogleAuth.inited = cid;
  }
  window.google.accounts.id.renderButton(el, { theme: currentTheme() === 'dark' ? 'filled_black' : 'outline', size: 'large', shape: 'rectangular', text: 'signin_with', logo_alignment: 'left', locale: 'vi', width: Math.min(384, Math.max(240, el.clientWidth || 340)) });
}
async function googleLogin(credential) {
  const L = Login;
  if (!credential || L.busy) return;
  L.busy = true; L.error = ''; L.info = ''; renderLogin();
  try {
    const r = await S.api.googleSignIn(credential);
    const sess = storeSession(S.mode, r);
    L.busy = false;
    startSession(sess, { greet: true });
  } catch (e0) {
    const e = toApiError(e0);
    L.busy = false; L.error = e.message || 'Đăng nhập Google không thành công'; renderLogin();
  }
}
// Login screen asks the server whether Google sign-in is on (ping is public).
async function refreshGoogleConfig() {
  if (S.mode !== 'remote') return;
  try {
    const p = await S.api.ping();
    const cid = trim(p && p.googleClientId);
    if (cid !== googleClientId()) { LS.setRaw('va.googleClientId', cid); if (!S.user && Login.step === 'email') renderLogin(); }
  } catch (e) { /* offline: keep cached value */ }
}
// câu của Cún ở màn đăng nhập: đổi khi sang bước/lỗi mới, giữ nguyên khi chỉ vẽ lại (gõ phím…)
const LG_LINE = { key: '', text: '' };
function loginLine() {
  const L = Login;
  const key = L.error ? 'login_error:' + L.error : L.step === 'code' ? 'login_code' : 'login';
  if (LG_LINE.key !== key) { LG_LINE.key = key; LG_LINE.text = say(key.split(':')[0]); }
  return LG_LINE.text;
}
function renderLogin() {
  const root = $('#login-root');
  root.innerHTML = loginHtml();
  if (googleClientId() && Login.step === 'email') mountGoogleButton();
  const f = root.querySelector('[autofocus]');
  if (f && !Login.busy) setTimeout(() => { if (document.body.contains(f)) f.focus(); }, 0);
}
function showLogin(opts = {}) {
  document.body.classList.add('is-login');
  $('#login-root').hidden = false;
  if (opts.message) Login.info = opts.message;
  if (opts.reset !== false) { Login.step = 'email'; Login.busy = false; Login.error = ''; }
  renderLogin();
  refreshGoogleConfig();
}
function hideLogin() {
  document.body.classList.remove('is-login');
  $('#login-root').hidden = true; $('#login-root').innerHTML = '';
  Login.info = ''; Login.error = ''; Login.step = 'email'; Login.busy = false;
  clearInterval(Login.timer);
}
async function loginSend(email) {
  const L = Login;
  const em = Rules.normEmail(email);
  if (!Rules.isValidEmail(em)) { L.error = 'Gmail không hợp lệ'; L.email = email; renderLogin(); $('#lg-email').focus(); return; }
  L.email = em; L.busy = true; L.error = ''; L.info = ''; renderLogin();
  try {
    const r = await S.api.requestCode(em);
    L.step = 'code'; L.info = (r && r.message) || '';
    L.resendAt = Date.now() + 60000;
    clearInterval(L.timer);
    L.timer = setInterval(() => { const b = $('[data-testid="login-resend"]'); if (!b) { clearInterval(L.timer); return; } const w = Math.max(0, Math.ceil((L.resendAt - Date.now()) / 1000)); b.disabled = !!w; b.textContent = w ? `Gửi lại mã (${w}s)` : 'Gửi lại mã'; if (!w) clearInterval(L.timer); }, 1000);
  } catch (e0) { const e = toApiError(e0); L.error = e.code === 'RATE_LIMITED' ? (e.message || ERR_MSG.RATE_LIMITED) : e.message; }
  L.busy = false; renderLogin();
}
async function loginVerify(code) {
  const L = Login;
  const c = String(code || '').replace(/\D/g, '');
  if (c.length !== 6) { L.error = 'Mã gồm 6 chữ số'; renderLogin(); return; }
  L.busy = true; L.error = ''; renderLogin();
  try {
    const r = await S.api.verifyCode(L.email, c);
    const sess = storeSession(S.mode, r);
    L.busy = false;
    startSession(sess, { greet: true });
  } catch (e0) {
    const e = toApiError(e0);
    L.busy = false; L.error = e.code === 'INVALID_CODE' ? ERR_MSG.INVALID_CODE : e.message; renderLogin();
    const ci = $('#lg-code'); if (ci) { ci.value = ''; ci.focus(); }
  }
}
async function quickLogin(email) {
  Login.email = email; Login.busy = true; renderLogin();
  try { await S.api.requestCode(email); Login.step = 'code'; await loginVerify(DEMO_OTP); }
  catch (e0) { Login.busy = false; Login.error = toApiError(e0).message; renderLogin(); }
}
function bindLogin() {
  const root = $('#login-root');
  root.addEventListener('submit', (e) => {
    e.preventDefault();
    const f = e.target.closest('[data-lg]'); if (!f || Login.busy) return;
    if (f.dataset.lg === 'email') loginSend($('#lg-email').value); else loginVerify($('#lg-code').value);
  });
  root.addEventListener('input', (e) => {
    if (e.target.id === 'lg-code') {
      // keep digits only, then the first 6: "000 000", " 000-000 ", "Mã đăng nhập VA Tasks: 123456" all work
      const v = e.target.value.replace(/\D/g, '').slice(0, 6);
      if (v !== e.target.value) e.target.value = v;
      if (v.length === 6 && !Login.busy) loginVerify(v);
    }
    if (e.target.id === 'lg-email') Login.email = e.target.value;
  });
  root.addEventListener('click', (e) => {
    const q = e.target.closest('[data-quick]'); if (q && !Login.busy) { quickLogin(q.dataset.quick); return; }
    const b = e.target.closest('[data-lg-act]'); if (!b) return;
    switch (b.dataset.lgAct) {
      case 'change-email': Login.step = 'email'; Login.error = ''; Login.info = ''; renderLogin(); break;
      case 'resend': if (!Login.busy) loginSend(Login.email); break;
      case 'conn': Login.showConn = !Login.showConn; renderLogin(); if (Login.showConn) $('#lg-api').focus(); break;
      case 'conn-save': {
        const rawUrl = trim($('#lg-api').value); const url = normApiUrl(rawUrl);
        if (rawUrl && !url) { Login.error = 'Link máy chủ không hợp lệ (cần dạng https://script.google.com/macros/s/…/exec)'; renderLogin(); return; }
        if (url !== savedApiUrl()) clearSession();
        if (url !== savedApiUrl()) LS.setRaw('va.googleClientId', '');
        LS.setRaw('va.apiUrl', url); Login.showConn = false; Login.error = '';
        setupApi(); Login.info = S.mode === 'demo' ? (url ? 'Đã lưu – vẫn ở Demo do có ?demo=1' : 'Đang dùng Demo') : 'Đã lưu kết nối Google Sheet'; renderLogin(); refreshGoogleConfig(); break;
      }
      case 'conn-clear': clearSession(); LS.setRaw('va.apiUrl', ''); setupApi(); Login.showConn = false; Login.info = 'Đã chuyển về Demo'; renderLogin(); break;
      default: break;
    }
  });
}

// ============================================================================
// Session lifecycle
// ============================================================================
function startSession(sess, o = {}) {
  S.session = sess; S.user = sess.user;
  hideLogin();
  S.loaded = false; S.tasks = []; S.loadError = null; S.logCache.clear(); S.pending.clear();
  if (S.mode === 'remote') {
    const cache = LS.get('va.cache.v2', null);
    if (cache && cache.email === S.user.email && cache.apiUrl === savedApiUrl() && Array.isArray(cache.tasks)) { S.tasks = cache.tasks; S.config = Rules.mergeConfig(cache.config); S.loaded = true; S.stale = true; }
  }
  Order = null;
  renderTopbar();
  const back = App.returnHash; App.returnHash = '';
  if (back && back !== '#/' && back !== '#') { if (location.hash !== back) location.hash = back; else route(); }
  else if (o.greet || !location.hash || location.hash === '#/' ) { const def = defaultHash(); if (location.hash !== def) location.hash = def; else route(); }
  else route();
  if (o.greet && buddyOff()) toast(`Xin chào, ${S.user.name}!`);
  buddyGreet();
  loadAll();
  setupPolling();
  // role may have changed since the session was created
  S.api.me(auth()).then((r) => {
    if (!r || !r.user || !S.user) return;
    if (typeof r.aiEnabled === 'boolean') S.aiEnabled = r.aiEnabled;
    const changed = r.user.role !== S.user.role || r.user.name !== S.user.name;
    S.user = r.user; S.session.user = r.user; LS.set(SESSION_KEY, S.session);
    if (changed) { renderTopbar(); route(); }
  }).catch((e0) => { if (toApiError(e0).code === 'UNAUTHORIZED') App.onUnauthorized(); });
}
function endSession(message) {
  clearSession();
  S.session = null; S.user = null;
  S.tasks = []; S.loaded = false; S.loadError = null; S.logCache.clear(); S.pending.clear(); S.qi = {};
  if (pollTimer) clearInterval(pollTimer);
  closeMenu(false);
  if (Drawer.isOpen()) Drawer.closeUI(false);
  closeAllLayers();
  Order = null;
  $('#toast-root').innerHTML = '';
  $('#view').innerHTML = '';
  App.mounted = null;
  Buddy.open = false; Buddy.greetedSession = ''; clearTimeout(Buddy.idleTimer); renderBuddy();
  showLogin({ message });
}
async function logout() {
  const tok = auth();
  endSession('Bạn đã đăng xuất.');
  try { await S.api.logout(tok); } catch (e) { /* ignore */ }
}
const defaultHash = () => (isVA() ? '#/queue' : '#/mine');

// ============================================================================
// Shortcuts dialog
// ============================================================================
function openShortcuts() {
  if (layers.some((l) => l.name === 'shortcuts')) return;
  const rows = isVA()
    ? [['/', 'Tìm kiếm'], ['n', 'Tạo đơn'], ['g rồi q / b / l / o / s', 'Hàng đợi / Kanban / Danh sách / Tổng quan / Cài đặt'], ['j / k', 'Dòng kế / trước trong Danh sách'], ['Enter', 'Mở đơn đang chọn'], ['Esc', 'Đóng hộp thoại / chi tiết'], ['Ctrl/⌘ + S', 'Lưu chi tiết đơn'], ['Ctrl/⌘ + Enter', 'Gửi form / bình luận / xác nhận'], ['?', 'Bảng phím tắt này']]
    : [['n', 'Tạo đơn'], ['g rồi m / s', 'Đơn của tôi / Cài đặt'], ['Esc', 'Đóng hộp thoại / chi tiết'], ['Ctrl/⌘ + Enter', 'Gửi cho AI / gửi đơn / bình luận'], ['?', 'Bảng phím tắt này']];
  openModal({
    title: 'Phím tắt', testid: 'shortcuts-dialog', size: 'sm', name: 'shortcuts',
    body: `<table class="kbd-table"><tbody>${rows.map(([k, d]) => `<tr><td>${k.split(' ').map((x) => (['rồi', '/', '+'].includes(x) ? ` ${x} ` : `<kbd>${esc(x)}</kbd>`)).join('')}</td><td>${esc(d)}</td></tr>`).join('')}</tbody></table>`,
    foot: '<button type="button" class="btn btn-primary" data-close>Đóng</button>',
  });
}

// ============================================================================
// Topbar, nav & theme
// ============================================================================
const NAV_ICONS = {
  queue: '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h10M4 18h6"/><path d="m16 15 3 3-3 3" transform="translate(0 -3)"/></svg>',
  board: '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="4" width="5" height="16" rx="1.5"/><rect x="9.5" y="4" width="5" height="10" rx="1.5"/><rect x="15.5" y="4" width="5" height="13" rx="1.5"/></svg>',
  list: '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="18" r="1"/></svg>',
  overview: '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="3.5" width="7" height="8" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="5" rx="1.5"/><rect x="13.5" y="11.5" width="7" height="9" rx="1.5"/><rect x="3.5" y="14.5" width="7" height="6" rx="1.5"/></svg>',
  settings: '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
  mine: '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="3.5" width="14" height="17" rx="2"/><path d="M9 8h6M9 12h6M9 16h3"/></svg>',
  new: '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
  ai: '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/></svg>',
};
function navItems() {
  return isVA()
    ? [['queue', 'Hàng đợi'], ['board', 'Kanban'], ['list', 'Danh sách'], ['overview', 'Tổng quan'], ['ai', 'Trợ lý AI'], ['settings', 'Cài đặt']]
    : [['mine', 'Đơn của tôi'], ['new', 'Tạo đơn'], ['settings', 'Cài đặt']];
}
function renderNav() {
  const nav = $('#sidenav');
  const items = navItems();
  const reviewN = !isVA() ? S.tasks.filter((t) => statusKey(t) === 'review' && isOwnOrder(t)).length : 0;
  const changesN = isVA() ? S.tasks.filter((t) => statusKey(t) === 'changes_requested' && isMine(t)).length : 0;
  nav.innerHTML = items.map(([k, l]) => {
    const extra = k === 'mine' && reviewN ? `${reviewN} cần duyệt` : k === 'queue' && changesN ? `${changesN} cần sửa` : '';
    // accessible name = view name; the badge count is the accessible description ("1 cần duyệt")
    const badge = extra ? `<span class="nav-badge" aria-hidden="true">${k === 'mine' ? reviewN : changesN}</span><span class="sr-only" id="nav-desc-${k}">${esc(extra)}</span>` : '';
    const tip = l + (extra ? ', ' + extra : '');
    return `<a class="nav-item" href="#/${k}" data-testid="nav-${k}" data-nav="${k}" aria-label="${esc(l)}" ${extra ? `aria-describedby="nav-desc-${k}"` : ''} title="${esc(tip)}" ${S.view === k ? 'aria-current="page"' : ''}>${NAV_ICONS[k]}<span class="nav-label">${esc(l)}</span>${badge}</a>`;
  }).join('');
}
function renderTopbar() {
  const u = S.user;
  const box = $('#topbar-user');
  if (u) {
    box.innerHTML = `${avatar(u.name)}<span class="tu-text"><span class="tu-name">${esc(u.name)}</span><span class="role-tag" data-role="${esc(u.role)}">${esc(roleLabel(u))}</span></span>`;
    box.setAttribute('aria-label', `${u.name} — ${roleLabel(u)} (${u.email})`);
    box.title = u.email;
  } else box.innerHTML = '';
  document.body.dataset.role = u ? u.role : '';
  $('[data-testid="demo-badge"]').hidden = S.mode !== 'demo';
  $('#search-box').hidden = !isVA();
  $('#btn-search-mobile').hidden = !isVA();
  renderNav();
  renderSyncChip();
  renderBuddy();
}
function currentTheme() {
  const t = document.documentElement.dataset.theme;
  if (t === 'dark' || t === 'light') return t;
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
function applyTheme(t) {
  if (t) document.documentElement.dataset.theme = t; else delete document.documentElement.dataset.theme;
  const btn = $('#theme-toggle');
  const dark = currentTheme() === 'dark';
  btn.innerHTML = dark ? ICONS.sun : ICONS.moon;
  btn.setAttribute('aria-label', dark ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối');
  btn.title = btn.getAttribute('aria-label');
}

// ============================================================================
// App / routing
// ============================================================================
const VA_VIEWS = ['queue', 'board', 'list', 'overview', 'ai', 'settings', 'mine', 'new'];
const REQ_VIEWS = ['mine', 'new', 'settings'];
const App = {
  bgHash: '', cameFromApp: false, mounted: null, returnHash: '',
  openTask(id) { App.cameFromApp = true; location.hash = '#/task/' + encodeURIComponent(id); },
  openNew() { if (!S.online) { guardOnline(); return; } location.hash = '#/new'; },
  closeOverlayNav() {
    if (App.cameFromApp && history.length > 1) { App.cameFromApp = false; history.back(); }
    else { location.hash = App.bgHash || defaultHash(); }
  },
  onDataChanged(info = {}) {
    if (!S.user) return;
    recomputeQueue();
    renderView(info);
    Drawer.sync(info);
    renderNav();
  },
  onConfigChanged() { recomputeQueue(); renderView({ config: true }); if (Drawer.isOpen()) Drawer.render(); },
  onLogChanged(id) {
    if (Drawer.isOpen() && sameName(Drawer.id, id) && Drawer.tab === 'activity') {
      const box = Drawer.el.querySelector('#activity-box'); if (box) box.innerHTML = activityHtml(id);
      if (!S.logCache.has(String(id).toUpperCase())) loadActivity(id);
    }
  },
  onUnauthorized() {
    if (!S.user) return;
    const h = location.hash;
    App.returnHash = h && !/^#\/?$/.test(h) ? h : '';
    endSession(ERR_MSG.UNAUTHORIZED);
  },
  logoutLocal() { endSession(''); },
  reloadAll() { S.logCache.clear(); return loadAll(); },
  syncNow() { return loadAll(); },
};

function renderView(info = {}) {
  if (!S.user) return;
  const view = $('#view');
  const v = S.view;
  const key = v + '|' + (v === 'settings' ? S.settingsTab : '') + '|' + (isMobile() ? 'm' : 'd') + '|' + (S.loaded ? 1 : 0) + '|' + (S.loadError ? 1 : 0) + '|' + S.user.role;
  if (v === 'list' || v === 'board') {
    if (App.mounted !== key || info.force) { App.mounted = key; (v === 'list' ? mountList : mountBoard)(view); }
    else updateResults(v);
    if (info.config && App.mounted === key) { (v === 'list' ? mountList : mountBoard)(view); }
    applyOffline();
    return;
  }
  if (v === 'new') {
    // the order form keeps its own state; only re-render on navigation or when it shows server data
    if (App.mounted !== key || info.force || (Order && Order.phase === 'done')) {
      // keep whatever the user typed if data/config arrive mid-edit
      if (Order && view.querySelector('.order-card')) { if (Order.phase === 'compose') readOrderCompose(view); else if (Order.phase === 'preview' || Order.phase === 'manual') readOrderForm(view); }
      const hadFocus = document.activeElement && view.contains(document.activeElement) ? document.activeElement.id : '';
      App.mounted = key;
      if (!(Order && Order.busy) || info.force) renderOrder(view);
      if (hadFocus) { const f = document.getElementById(hadFocus); if (f) f.focus(); }
    }
    applyOffline();
    return;
  }
  const active = document.activeElement;
  const typing = active && view.contains(active) && active.matches('input[type="text"], input[type="url"], input[type="email"], input[type="password"], input[type="number"], textarea');
  if ((v === 'settings' || v === 'ai') && typing && !info.force && !info.config) return;
  const ftid = active && view.contains(active) ? (active.getAttribute('data-testid') || (active.id ? '#' + active.id : null)) : null;
  App.mounted = key;
  if (v === 'settings') renderSettings(view);
  else if (v === 'ai') renderAi(view);
  else if (v === 'queue') renderQueue(view);
  else if (v === 'mine') renderMine(view);
  else renderOverview(view);
  if (ftid) {
    const f = ftid[0] === '#' ? view.querySelector(ftid) : view.querySelector(`[data-testid="${CSS.escape(ftid)}"]`);
    if (f) f.focus();
  }
  applyOffline();
}

function parseHash() {
  const h = (location.hash || '').replace(/^#/, '');
  const [path, qs] = h.split('?');
  const parts = (path || '').split('/').filter(Boolean);
  return { parts, qs, view: parts[0] || '' };
}
async function route() {
  if (!S.user) return;
  const r = parseHash();
  if (r.view === 'task' && r.parts[1]) {
    ensureBackground();
    Drawer.open(decodeURIComponent(r.parts[1]));
    return;
  }
  if (Drawer.isOpen() && Drawer.isDirty() && !Drawer.deleted) {
    const id = Drawer.id;
    const ok = await confirmDialog({ title: 'Bỏ các thay đổi chưa lưu?', desc: 'Những chỉnh sửa bạn vừa làm trong đơn này sẽ mất.', confirmText: 'Bỏ thay đổi', cancelText: 'Tiếp tục sửa', danger: true });
    if (!ok) { history.pushState(null, '', '#/task/' + encodeURIComponent(id)); return; }
  }
  App.cameFromApp = false;
  const allowed = isVA() ? VA_VIEWS : REQ_VIEWS;
  let view = allowed.includes(r.view) ? r.view : '';
  if (!view) { const def = defaultHash(); if (location.hash !== def) { history.replaceState(null, '', def); } view = def.slice(2); }
  const prevView = S.view;
  if (view === 'settings') { const tab = r.parts[1] === 'connection' ? 'sync' : r.parts[1]; S.settingsTab = settingsTabs().some((t) => t[0] === tab) ? tab : 'general'; if (S.settingsTab === 'admin' && prevView !== 'settings') settingsUi.admin = null; }
  let force = false;
  if (view === 'list' || view === 'board') {
    if (r.qs !== undefined && r.qs !== '') { S.prefs = prefsFromQuery(r.qs); savePrefs(); force = true; }
    else { const qs = prefsToQuery(S.prefs); if (qs) history.replaceState(null, '', '#/' + view + '?' + qs); }
  }
  if (view === 'new' && prevView !== 'new' && Order && Order.phase === 'done') Order = null;
  S.view = view;
  document.body.dataset.view = view;
  App.bgHash = location.hash || defaultHash();
  $('#global-search').value = S.prefs.q || '';
  const hadOverlay = Drawer.isOpen();
  if (prevView !== view || force || !hadOverlay || App.mounted == null) renderView({ force: true });
  if (Drawer.isOpen()) Drawer.closeUI();
  renderTopbar();
  if (view === 'new' && prevView !== 'new') setTimeout(buddyOrderTip, 300); // Cún popup nhắc người order
  if (!hadOverlay) { const m = $('#main'); if (m && prevView !== view) m.focus({ preventScroll: true }); window.scrollTo(0, 0); }
}
function ensureBackground() {
  if (App.mounted == null) {
    const bg = App.bgHash && !/^#\/task/.test(App.bgHash) ? App.bgHash : defaultHash();
    const [p] = bg.replace(/^#\/?/, '').split('?');
    const allowed = isVA() ? VA_VIEWS : REQ_VIEWS;
    S.view = allowed.includes(p.split('/')[0]) ? p.split('/')[0] : defaultHash().slice(2);
    document.body.dataset.view = S.view;
    App.bgHash = '#/' + S.view + (S.view === 'list' || S.view === 'board' ? (prefsToQuery(S.prefs) ? '?' + prefsToQuery(S.prefs) : '') : '');
    renderView({ force: true });
    renderTopbar();
  }
}

// ============================================================================
// Global events
// ============================================================================
let searchTimer = null;
function bindGlobal() {
  const search = $('#global-search');
  search.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      if (S.view === 'list' || S.view === 'board') updatePrefs((p) => { p.q = search.value; });
    }, 200);
  });
  search.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault(); clearTimeout(searchTimer);
      if (S.view === 'list' || S.view === 'board') updatePrefs((p) => { p.q = search.value; });
      else { S.prefs.q = search.value; savePrefs(); location.hash = '#/list?' + prefsToQuery(S.prefs); }
    } else if (e.key === 'Escape') { e.stopPropagation(); search.blur(); $('#search-box').classList.remove('is-open'); }
  });
  $('#btn-search-mobile').addEventListener('click', () => {
    const box = $('#search-box'); const open = !box.classList.contains('is-open');
    box.classList.toggle('is-open', open); $('#btn-search-mobile').setAttribute('aria-expanded', String(open));
    if (open) search.focus();
  });
  $('#btn-new-request').addEventListener('click', () => App.openNew());
  $('#btn-logout').addEventListener('click', () => logout());
  $('#topbar-user').addEventListener('click', () => { location.hash = '#/settings'; });
  $('#sync-status').addEventListener('click', () => { if (effectiveSyncState() === 'error' && isVA()) location.hash = '#/settings/sync'; else syncNow(); });
  $('#theme-toggle').addEventListener('click', () => { const next = currentTheme() === 'dark' ? 'light' : 'dark'; LS.setRaw('va.ui.theme', next); applyTheme(next); if (S.view === 'settings') renderView({ force: true }); });

  const view = $('#view');
  view.addEventListener('click', onViewClick);
  bindBuddy();
  bindAiForm(view);
  view.addEventListener('change', onViewChange);
  view.addEventListener('keydown', onViewKeydown);
  view.addEventListener('pointerdown', (e) => { if (S.view === 'board') boardPointerDown(e); });
  view.addEventListener('mousedown', (e) => {
    const sel = e.target.closest('select[multiple][data-filter]');
    if (e.target.tagName === 'OPTION' && sel && !e.shiftKey) {
      e.preventDefault();
      const o = e.target; o.selected = !o.selected;
      const st = sel.scrollTop; sel.focus(); sel.scrollTop = st;
      sel.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });
  view.addEventListener('focusout', (e) => {
    if (e.target.matches('[data-rename]')) commitRename(e.target);
  });
  bindOrderEvents(view);
  bindDateInputs(document);
  bindLogin();

  window.addEventListener('hashchange', route);
  window.addEventListener('online', () => { S.online = true; applyOffline(); syncNow(); });
  window.addEventListener('offline', () => { S.online = false; applyOffline(); });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && S.loaded && Date.now() - S.sync.lastAt > 15000 && S.online) loadAll({ silent: true }); });
  window.addEventListener('focus', () => { if (S.loaded && Date.now() - S.sync.lastAt > 15000 && S.online) loadAll({ silent: true }); });
  let lastMobile = isMobile();
  window.addEventListener('resize', () => { const m = isMobile(); if (m !== lastMobile) { lastMobile = m; renderView({ force: true }); } });
  if (window.matchMedia) {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const h = () => applyTheme(document.documentElement.dataset.theme || null);
    if (mq.addEventListener) mq.addEventListener('change', h); else if (mq.addListener) mq.addListener(h);
  }
  document.addEventListener('keydown', onGlobalKeydown);
}

async function onViewClick(e) {
  const t = e.target;
  if (S.view === 'new') return;
  if (S.view === 'ai' && onAiClick(e)) return;
  const adm = t.closest('[data-admin]'); if (adm) { adminAction(adm.dataset.admin); return; }
  if (Drag.justDragged && Date.now() - Drag.justDragged < 300 && (t.closest('.kcard') || t.closest('.board'))) { e.preventDefault(); return; }
  // quick actions on rows/cards
  const cl = t.closest('[data-claim]'); if (cl) { e.stopPropagation(); transition(cl.dataset.claim, 'in_progress'); return; }
  const mv = t.closest('[data-move]'); if (mv) { e.stopPropagation(); transition(mv.dataset.move, mv.dataset.to); return; }
  const sz = t.closest('[data-size-of]'); if (sz) { e.stopPropagation(); const task = getTask(sz.dataset.sizeOf); if (task) openSizeDialog(task); return; }
  const pr = t.closest('[data-prio-of]'); if (pr) { e.stopPropagation(); const task = getTask(pr.dataset.prioOf); if (task) openPriorityDialog(task); return; }
  const hd = t.closest('[data-hold-of]'); if (hd) { e.stopPropagation(); toggleHold(hd.dataset.holdOf); return; }
  if (t.closest('[data-toggle-closed]')) { S.groupCollapsed['mine-closed-open'] = !S.groupCollapsed['mine-closed-open']; renderView({ force: true }); const b = $('[data-toggle-closed]'); if (b) b.focus(); return; }
  // overview
  const stat = t.closest('[data-qf]');
  if (stat && S.view === 'overview') { const qf = stat.dataset.qf; goListWith((p) => { p.qf = qf; }); return; }
  const fs = t.closest('[data-filter-status]'); if (fs) { goListWith((p) => { p.filters.status = [fs.dataset.filterStatus]; if (['done', 'cancelled'].includes(fs.dataset.filterStatus)) p.hideClosed = false; }); return; }
  const fa = t.closest('[data-filter-assignee]'); if (fa) { goListWith((p) => { p.filters.assignee = [fa.dataset.filterAssignee]; }); return; }
  const act = t.closest('[data-act]');
  if (act) {
    switch (act.dataset.act) {
      case 'retry-load': S.loadError = null; renderView({ force: true }); loadAll(); return;
      case 'clear-filters': clearFilters(); return;
      case 'test-conn': testConnection(); return;
      case 'save-conn': saveConnection(); return;
      case 'save-due': saveDueSoon(); return;
      case 'reset-demo': resetDemo(); return;
      case 'logout': logout(); return;
      case 'sync-now': await syncNow(); if (S.view === 'settings') renderView({ force: true }); return;
      case 'mem-add': addMember(); return;
      default: break;
    }
  }
  // toolbar
  const qfb = t.closest('.qf-bar [data-qf]'); if (qfb) { updatePrefs((p) => { p.qf = qfb.dataset.qf; }); return; }
  if (t.closest('[data-testid="btn-filters"]')) {
    filtersOpen = !filtersOpen; const panel = $('#filters-panel'); if (panel) panel.hidden = !filtersOpen;
    t.closest('[data-testid="btn-filters"]').setAttribute('aria-expanded', String(filtersOpen)); return;
  }
  if (t.closest('[data-testid="btn-clear-filters"]')) { clearFilters(); return; }
  const sortB = t.closest('[data-sort]');
  if (sortB) {
    const k = sortB.dataset.sort;
    updatePrefs((p) => { if (p.sortKey !== k) { p.sortKey = k; p.sortDir = 'asc'; } else if (p.sortDir === 'asc') p.sortDir = 'desc'; else { p.sortKey = ''; p.sortDir = 'asc'; } });
    const nb = $(`[data-sort="${k}"]`); if (nb) nb.focus();
    return;
  }
  const grp = t.closest('[data-group]'); if (grp) { const g = grp.dataset.group; S.groupCollapsed[g] = !S.groupCollapsed[g]; renderListResults(); const nb = $(`[data-group="${CSS.escape(g)}"]`); if (nb) nb.focus(); return; }
  const pill = t.closest('[data-pill-menu]');
  if (pill) { e.stopPropagation(); const task = getTask(pill.dataset.pillMenu); if (task) openMenu(pill, () => moveToItems(task)); return; }
  const cm = t.closest('[data-card-menu]');
  if (cm) { e.stopPropagation(); const task = getTask(cm.dataset.cardMenu); if (task) cardMenu(cm, task); return; }
  const colT = t.closest('[data-col-toggle]');
  if (colT) { const k = colT.dataset.colToggle; S.collapsed[k] = !S.collapsed[k]; renderBoardColumns(); const nb = $(`[data-col-toggle="${k}"]`); if (nb) nb.focus(); return; }
  const col = t.closest('.col[data-collapsed="true"]'); if (col) { S.collapsed[col.dataset.status] = false; renderBoardColumns(); return; }
  // settings: catalogs & members
  const ca = t.closest('[data-cat-add]'); if (ca) { addCatalogItem(ca.dataset.catAdd); return; }
  const cu = t.closest('[data-cat-up]'); if (cu) { moveCatalogItem(cu.dataset.catUp, +cu.dataset.i, -1); return; }
  const cd = t.closest('[data-cat-down]'); if (cd) { moveCatalogItem(cd.dataset.catDown, +cd.dataset.i, 1); return; }
  const ce = t.closest('[data-cat-edit]'); if (ce) { settingsUi.editing = { cat: ce.dataset.catEdit, i: +ce.dataset.i }; renderView({ force: true }); const inp = $(`[data-rename="${ce.dataset.catEdit}"]`); if (inp) { inp.focus(); inp.select(); } return; }
  const cx = t.closest('[data-cat-del]'); if (cx) { deleteCatalogItem(cx.dataset.catDel, +cx.dataset.i); return; }
  const md = t.closest('[data-mem-del]'); if (md) { deleteMember(+md.dataset.memDel); return; }
  // open order
  const open = t.closest('[data-open]'); if (open && !t.closest('button:not([data-open])')) { App.openTask(open.dataset.open); return; }
  if (t.closest('a, button, input, select, textarea, label')) return;
  const row = t.closest('.task-row, .mcard, .kcard, .qrow, .wrow, .ocard');
  if (row && row.dataset.id && !row.dataset.id.startsWith('tmp-')) { S.selectedId = row.dataset.id; App.openTask(row.dataset.id); }
}
function onViewChange(e) {
  const t = e.target;
  if (S.view === 'new') return;
  if (S.view === 'ai' && onAiChange(e)) return;
  if (t.matches('[data-testid="toggle-hide-closed"]')) { updatePrefs((p) => { p.hideClosed = t.checked; }); return; }
  if (t.matches('[data-testid="group-by"]')) { updatePrefs((p) => { p.groupBy = t.value; }); return; }
  if (t.matches('select[data-filter]')) { const k = t.dataset.filter; const vals = Array.from(t.selectedOptions).map((o) => o.value); updatePrefs((p) => { p.filters[k] = vals; }); return; }
  if (t.id === 'set-buddy') { LS.setRaw('va.buddy.off', t.checked ? '' : '1'); renderBuddy(); if (t.checked) buddyGreet(); return; }
  if (t.name === 'set-theme') { LS.setRaw('va.ui.theme', t.value); applyTheme(t.value || null); return; }
  if (t.id === 'set-due') { saveDueSoon(); return; }
  if (t.id === 'set-poll') { const v = Number(t.value); saveConfigOp((c) => { c.pollSeconds = v; return c; }, 'Đã lưu cài đặt'); return; }
  if (t.dataset.memArtist !== undefined) { const i = +t.dataset.memArtist; const val = t.checked; saveMember(i, (m) => { m.isArtist = val; }); return; }
  if (t.dataset.memActive !== undefined) { const i = +t.dataset.memActive; const val = t.checked; saveMember(i, (m) => { m.active = val; }); return; }
  if (t.dataset.memEmail !== undefined) { saveMemberEmail(+t.dataset.memEmail, t.value); return; }
}
function onViewKeydown(e) {
  const t = e.target;
  if (S.view === 'new') return;
  if (t.matches('[data-cat-input]') && e.key === 'Enter') { e.preventDefault(); addCatalogItem(t.dataset.catInput); return; }
  if (t.matches('[data-rename]')) {
    if (e.key === 'Enter') { e.preventDefault(); commitRename(t); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); settingsUi.editing = null; renderView({ force: true }); }
    return;
  }
  if (t.dataset.memEmail !== undefined && e.key === 'Enter') { e.preventDefault(); t.blur(); return; }
  if ((t.id === 'mem-name' || t.id === 'mem-email') && e.key === 'Enter') { e.preventDefault(); addMember(); return; }
  if (t.id === 'set-due' && e.key === 'Enter') { e.preventDefault(); saveDueSoon(); return; }
  if (t.id === 'set-url' && e.key === 'Enter') { e.preventDefault(); saveConnection(); return; }
  if ((e.key === 'Enter' || e.key === ' ') && t.matches('.task-row, .mcard, .kcard, .qrow, .wrow, .ocard, [data-open][role="button"]') && !e.ctrlKey && !e.metaKey) {
    e.preventDefault(); e.stopPropagation();
    const id = t.dataset.id || t.dataset.open; if (id && !id.startsWith('tmp-')) { S.selectedId = id; App.openTask(id); }
  }
}
function clearFilters() {
  S.prefs = DEFAULT_PREFS(); savePrefs(); $('#global-search').value = '';
  if (S.view === 'list' || S.view === 'board') { history.replaceState(null, '', '#/' + S.view); App.bgHash = '#/' + S.view; renderView({ force: true }); }
}

// ----- settings actions -----
async function testConnection() {
  const rawUrl = trim($('#set-url').value); const url = normApiUrl(rawUrl);
  settingsUi.urlDraft = $('#set-url').value;
  settingsUi.urlError = '';
  let api;
  if (!rawUrl) api = S.mode === 'demo' ? S.api : null;
  else if (!url) { settingsUi.urlError = 'Link máy chủ không hợp lệ (cần dạng https://script.google.com/macros/s/…/exec)'; settingsUi.testResult = null; renderView({ force: true }); return; }
  else api = createRemoteApi(url);
  if (!api) { settingsUi.testResult = { ok: false, text: 'Chưa nhập URL' }; renderView({ force: true }); return; }
  settingsUi.testResult = { ok: true, text: 'Đang kiểm tra…' }; renderView({ force: true });
  try {
    const r = await api.ping();
    settingsUi.testResult = { ok: true, text: `Kết nối thành công${r && r.sheetName ? ' – sheet: ' + r.sheetName : ''}${r && r.version ? ' · v' + r.version : ''}${r && typeof r.aiEnabled === 'boolean' ? ' · AI ' + (r.aiEnabled ? 'bật' : 'tắt') : ''}` };
  } catch (e0) { const e = toApiError(e0); settingsUi.testResult = { ok: false, text: `Lỗi kết nối: ${e.message}` }; }
  if (S.view === 'settings') renderView({ force: true });
}
async function saveConnection() {
  const rawUrl = trim($('#set-url').value); const url = normApiUrl(rawUrl);
  if (rawUrl && !url) { settingsUi.urlDraft = $('#set-url').value; settingsUi.urlError = 'Link máy chủ không hợp lệ (cần dạng https://script.google.com/macros/s/…/exec)'; renderView({ force: true }); $('#set-url').focus(); return; }
  settingsUi.urlError = ''; settingsUi.testResult = null; settingsUi.urlDraft = null;
  const prevMode = S.mode;
  const changed = url !== savedApiUrl();
  if (changed) {
    // a session belongs to the server that issued it: never carry it to another URL → log out
    const old = S.api; const tok = auth();
    try { if (old && tok.sessionToken) old.logout(tok).catch(() => {}); } catch (e) { /* ignore */ }
  }
  LS.setRaw('va.apiUrl', url);
  setupApi();
  if (changed || S.mode !== prevMode) {
    endSession(S.mode === 'demo' ? 'Đã chuyển về chế độ Demo — đăng nhập lại.' : 'Đã đổi máy chủ — đăng nhập lại bằng Gmail.');
    return;
  }
  toast(S.mode === 'demo' ? (url ? 'Đã lưu – đang ở Demo do có ?demo=1' : 'Đang ở chế độ Demo') : 'Đã lưu kết nối Google Sheet', { type: 'info' });
  renderView({ force: true });
}
async function saveDueSoon() {
  const inp = $('#set-due'); if (!inp) return;
  const n = Number(inp.value);
  const err = $('#due-err');
  if (!(trim(inp.value) !== '' && Number.isInteger(n) && n >= 0 && n <= 30)) { err.hidden = false; err.textContent = 'Nhập số nguyên từ 0 đến 30'; return; }
  err.hidden = true;
  if (n === Number(S.config.dueSoonDays)) return;
  await saveConfigOp((c) => { c.dueSoonDays = n; return c; }, 'Đã lưu cài đặt');
}
async function resetDemo() {
  const ok = await confirmDialog({ title: 'Khôi phục dữ liệu mẫu?', desc: 'Mọi đơn, danh mục, tài khoản và lịch sử trong Demo sẽ trở về mặc định. Bạn sẽ được đăng xuất.', confirmText: 'Khôi phục', cancelText: 'Không', danger: true });
  if (!ok || S.mode !== 'demo') return;
  S.api._reseed();
  endSession('Đã khôi phục dữ liệu mẫu.');
}
function catErr(cat, msg) { settingsUi.catErrors[cat] = msg; renderView({ force: true }); }
async function addCatalogItem(cat) {
  const inp = $(`[data-cat-input="${cat}"]`); if (!inp) return;
  const v = trim(inp.value).replace(/\s+/g, ' ');
  if (!v) { catErr(cat, 'Mục không được để trống'); $(`[data-cat-input="${cat}"]`).focus(); return; }
  if ((S.config[cat] || []).some((x) => Rules.normText(x) === Rules.normText(v))) { catErr(cat, 'Mục này đã tồn tại'); const i2 = $(`[data-cat-input="${cat}"]`); i2.value = v; i2.focus(); return; }
  settingsUi.catErrors[cat] = '';
  const r = await saveConfigOp((c) => { if (!c[cat].some((x) => Rules.normText(x) === Rules.normText(v))) c[cat].push(v); return c; }, 'Đã lưu danh mục');
  if (r && r.error) catErr(cat, r.error);
  const i3 = $(`[data-cat-input="${cat}"]`); if (i3) i3.focus();
}
async function moveCatalogItem(cat, i, dir) {
  const j = i + dir; const arr = S.config[cat] || []; if (j < 0 || j >= arr.length) return;
  const name = arr[i];
  settingsUi.catErrors[cat] = '';
  await saveConfigOp((c) => { const a = c[cat]; const k = a.findIndex((x) => sameName(x, name)); const kk = k + dir; if (k < 0 || kk < 0 || kk >= a.length) return c; [a[k], a[kk]] = [a[kk], a[k]]; return c; }, 'Đã lưu danh mục');
  const nb = $(`[data-cat-${dir < 0 ? 'up' : 'down'}="${cat}"][data-i="${j}"]`); if (nb && !nb.disabled) nb.focus();
}
async function deleteCatalogItem(cat, i) {
  const arr = S.config[cat] || []; const name = arr[i];
  if (arr.length <= 1) { catErr(cat, 'Danh mục cần ít nhất 1 mục'); return; }
  settingsUi.catErrors[cat] = '';
  const n = usageCount(cat, name);
  const ok = await confirmDialog({ title: `Xóa “${name}”?`, desc: n > 0 ? `${n} đơn đang dùng “${name}”. Các đơn này giữ nguyên giá trị cũ.` : 'Mục này sẽ không còn trong danh sách chọn.', confirmText: 'Xóa', cancelText: 'Không', danger: true });
  if (!ok) return;
  const r = await saveConfigOp((c) => { const k = c[cat].findIndex((x) => sameName(x, name)); if (k >= 0) c[cat].splice(k, 1); if (!c[cat].length) throw new Error('Danh mục cần ít nhất 1 mục'); return c; }, 'Đã lưu danh mục');
  if (r && r.error) catErr(cat, r.error);
}
let renaming = false;
async function commitRename(inp) {
  if (renaming || !settingsUi.editing) return;
  const cat = inp.dataset.rename; const i = +inp.dataset.i;
  const old = (S.config[cat] || [])[i];
  const v = trim(inp.value).replace(/\s+/g, ' ');
  if (v === old) { settingsUi.editing = null; renderView({ force: true }); return; }
  renaming = true;
  try {
    if (!v) { settingsUi.editing = null; catErr(cat, 'Mục không được để trống'); return; }
    if ((S.config[cat] || []).some((x, k) => k !== i && Rules.normText(x) === Rules.normText(v))) { settingsUi.editing = null; catErr(cat, 'Mục này đã tồn tại'); return; }
    settingsUi.editing = null;
    const n = usageCount(cat, old);
    if (n > 0) {
      const ok = await confirmDialog({ title: `Đổi tên “${old}” thành “${v}”?`, desc: `${n} đơn đang dùng “${old}”. Các đơn này giữ nguyên giá trị cũ.`, confirmText: 'Đổi tên', cancelText: 'Không' });
      if (!ok) { renderView({ force: true }); return; }
    }
    settingsUi.catErrors[cat] = '';
    const r = await saveConfigOp((c) => { const k = c[cat].findIndex((x) => sameName(x, old)); if (k >= 0) c[cat][k] = v; return c; }, 'Đã lưu danh mục');
    if (r && r.error) catErr(cat, r.error);
  } finally { renaming = false; }
}
function emailError(email, exceptIndex) {
  const em = Rules.normEmail(email);
  if (!em) return '';
  if (!Rules.isValidEmail(em)) return 'Gmail không hợp lệ';
  if (members().some((m, j) => j !== exceptIndex && Rules.normEmail(m.email) === em)) return 'Gmail này đã được dùng cho thành viên khác';
  return '';
}
async function saveMember(i, mut) {
  const m = members()[i]; if (!m) return;
  const name = m.name;
  return saveConfigOp((c) => { const k = c.members.findIndex((x) => sameName(x.name, name)); if (k >= 0) mut(c.members[k]); return c; }, 'Đã lưu thành viên');
}
async function saveMemberEmail(i, value) {
  const m = members()[i]; if (!m) return;
  const em = Rules.normEmail(value);
  if (em === Rules.normEmail(m.email)) { delete settingsUi.memberErrors[i]; return; }
  const er = emailError(em, i);
  if (er) { settingsUi.memberErrors[i] = er; renderView({ force: true }); const inp = $(`[data-mem-email="${i}"]`); if (inp) { inp.value = value; inp.focus(); } return; }
  delete settingsUi.memberErrors[i];
  const r = await saveMember(i, (x) => { x.email = em; });
  if (r && r.error) { settingsUi.memberErrors[i] = r.error; renderView({ force: true }); }
}
async function addMember() {
  const name = trim($('#mem-name').value).replace(/\s+/g, ' ');
  const email = Rules.normEmail($('#mem-email').value);
  const team = $('#mem-team').value; const art = $('#mem-artist').checked;
  const keep = () => { const a = $('#mem-name'); if (a) a.value = name; const b = $('#mem-email'); if (b) b.value = email; };
  if (name.length < 2 || name.length > 50) { settingsUi.memberError = 'Tên cần từ 2 đến 50 ký tự'; renderView({ force: true }); keep(); $('#mem-name').focus(); return; }
  if (memberOf(name)) { settingsUi.memberError = 'Thành viên đã tồn tại'; renderView({ force: true }); keep(); $('#mem-name').focus(); return; }
  const er = emailError(email, -1);
  if (er) { settingsUi.memberError = er; renderView({ force: true }); keep(); $('#mem-email').focus(); return; }
  settingsUi.memberError = email ? '' : '';
  const r = await saveConfigOp((c) => { c.members.push({ name, email, team, isArtist: art, active: true }); return c; }, email ? 'Đã thêm thành viên' : 'Đã thêm thành viên — chưa có Gmail nên chưa đăng nhập được');
  if (r && r.error) { settingsUi.memberError = r.error; renderView({ force: true }); }
  const i = $('#mem-name'); if (i) i.focus();
}
async function deleteMember(i) {
  const m = members()[i]; if (!m) return;
  const n = S.tasks.filter((t) => Rules.isOpen(t) && sameName(t.assignee, m.name)).length;
  if (n) { settingsUi.memberError = `${m.name} còn ${n} đơn đang làm — hãy bỏ chọn “Hoạt động” thay vì xóa.`; renderView({ force: true }); return; }
  if (S.user && Rules.normEmail(m.email) === Rules.normEmail(S.user.email)) { settingsUi.memberError = 'Không thể xóa chính bạn.'; renderView({ force: true }); return; }
  const ok = await confirmDialog({ title: `Xóa thành viên ${m.name}?`, desc: 'Các đơn cũ vẫn giữ nguyên tên người này. Người này sẽ không đăng nhập được nữa.', confirmText: 'Xóa', cancelText: 'Không', danger: true });
  if (!ok) return;
  settingsUi.memberError = ''; settingsUi.memberErrors = {};
  await saveConfigOp((c) => { const k = c.members.findIndex((x) => sameName(x.name, m.name)); if (k >= 0) c.members.splice(k, 1); return c; }, 'Đã lưu thành viên');
}

// ----- keyboard -----
let gPending = 0;
function onGlobalKeydown(e) {
  if (e.key === 'Tab' && layers.length) { trapFocus(e); return; }
  if (e.key === 'Escape') {
    const l = topLayer();
    if (l) { e.preventDefault(); if (l.onEsc) l.onEsc(); }
    return;
  }
  if (!S.user) return;
  const mod = e.ctrlKey || e.metaKey;
  if (mod && (e.key === 's' || e.key === 'S')) {
    if (Drawer.isOpen() && topLayer() && topLayer().el === Drawer.el) { e.preventDefault(); Drawer.save(); }
    else if (Drawer.isOpen()) e.preventDefault();
    return;
  }
  if (mod && e.key === 'Enter') {
    const l = topLayer();
    if (l && l.el.matches('[data-testid="transition-dialog"], [data-testid="approve-fail-dialog"]')) { e.preventDefault(); l.el.querySelector('[data-testid="transition-confirm"]').click(); }
    return;
  }
  const tg = e.target;
  if (mod || e.altKey) return;
  if (tg && (tg.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(tg.tagName))) return;
  if (layers.length) return;
  const k = e.key;
  const G = isVA() ? { q: '#/queue', o: '#/overview', l: '#/list', b: '#/board', s: '#/settings', m: '#/mine' } : { m: '#/mine', s: '#/settings' };
  if (gPending && Date.now() - gPending < 1000 && G[k]) { gPending = 0; e.preventDefault(); location.hash = G[k]; return; }
  gPending = 0;
  if (k === '/' && isVA()) { e.preventDefault(); const box = $('#search-box'); if (isMobile()) box.classList.add('is-open'); $('#global-search').focus(); return; }
  if (k === '?') { e.preventDefault(); openShortcuts(); return; }
  if (k === 'n') { e.preventDefault(); App.openNew(); return; }
  if (k === 'g') { gPending = Date.now(); return; }
  if ((k === 'j' || k === 'k') && S.view === 'list') {
    e.preventDefault();
    if (!listOrder.length) return;
    let i = listOrder.indexOf(S.selectedId);
    i = i < 0 ? (k === 'j' ? 0 : listOrder.length - 1) : Math.max(0, Math.min(listOrder.length - 1, i + (k === 'j' ? 1 : -1)));
    S.selectedId = listOrder[i];
    $$('.task-row.is-selected, .mcard.is-selected').forEach((r) => r.classList.remove('is-selected'));
    const row = $(`[data-testid="task-row-${CSS.escape(S.selectedId)}"]`);
    if (row) { row.classList.add('is-selected'); row.focus(); row.scrollIntoView({ block: 'nearest' }); }
    return;
  }
  if (k === 'Enter' && S.view === 'list' && S.selectedId && (!tg || tg === document.body || tg.matches('.task-row, .mcard, main'))) {
    e.preventDefault(); App.openTask(S.selectedId);
  }
}

// ============================================================================
// Init
// ============================================================================
function setupApi() {
  S.mode = configuredMode();
  if (S.mode === 'demo') { if (!S.demoApi) S.demoApi = createDemoApi(); S.api = S.demoApi; }
  else { S.api = createRemoteApi(trim(LS.raw('va.apiUrl'))); }
  if (S.mode !== 'demo') { try { delete window.__vaDemo; } catch (e) { window.__vaDemo = undefined; } }
  else if (S.demoApi) window.__vaDemo = S.demoApi._hook;
  renderSyncChip();
  const b = $('[data-testid="demo-badge"]'); if (b) b.hidden = S.mode !== 'demo';
}
function showApiConfirm(url, onSkip) {
  document.body.classList.add('is-login');
  const root = $('#login-root'); root.hidden = false;
  const cur = savedApiUrl();
  root.innerHTML = `<div class="login-card" data-testid="api-confirm" role="main" aria-labelledby="ac-title">
    <div class="lg-brand"><img class="brand-mark" src="${ASSETS.teamBadge}" alt="" width="34" height="34"><span class="brand-name">VA Tasks</span></div>
    <h1 id="ac-title">Đổi máy chủ dữ liệu?</h1>
    <p class="muted lg-sub">Link bạn vừa mở muốn kết nối app tới máy chủ (Google Apps Script) sau:</p>
    <code class="api-url" data-testid="api-confirm-url">${esc(url)}</code>
    ${cur ? `<p class="muted" style="font-size:13px">Máy chủ hiện tại: <code class="api-url is-cur">${esc(cur)}</code></p>` : ''}
    <div class="ai-note is-warn" role="alert"><span><b>Chỉ dùng link do quản lý team gửi.</b> Máy chủ lạ có thể đánh cắp mã đăng nhập của bạn. Nếu đồng ý, bạn sẽ bị đăng xuất và phải đăng nhập lại với máy chủ mới.</span></div>
    <div class="order-actions"><button type="button" class="btn btn-brand lg-btn" data-testid="api-confirm-use">Dùng máy chủ này</button>
      <button type="button" class="btn lg-btn" data-testid="api-confirm-skip" autofocus>Bỏ qua</button></div>
  </div>`;
  root.querySelector('[data-testid="api-confirm-use"]').addEventListener('click', () => {
    LS.setRaw('va.apiUrl', url); clearSession(); LS.del('va.cache.v2');
    setupApi(); App.returnHash = location.hash && !/^#\/?$/.test(location.hash) ? location.hash : '';
    showLogin({ message: 'Đã chuyển máy chủ. Đăng nhập bằng Gmail của bạn.' });
  });
  root.querySelector('[data-testid="api-confirm-skip"]').addEventListener('click', () => { root.innerHTML = ''; onSkip(); });
  setTimeout(() => { const b = root.querySelector('[data-testid="api-confirm-skip"]'); if (b) b.focus(); }, 0);
}
async function init() {
  S.prefs = loadPrefs();
  const resetting = PARAMS.get('reset') === '1';
  if (resetting) clearSession();
  setupApi();
  const asEmail = S.mode === 'demo' ? trim(PARAMS.get('as')) : '';
  if (PARAMS.has('reset') || PARAMS.has('as') || PARAMS.has('api')) {
    const p = new URLSearchParams(location.search); p.delete('reset'); p.delete('as'); p.delete('api');
    const qs = p.toString();
    history.replaceState(null, '', location.pathname + (qs ? '?' + qs : '') + location.hash);
  }
  const theme = LS.raw('va.ui.theme');
  applyTheme(theme === 'dark' || theme === 'light' ? theme : null);
  S.online = navigator.onLine !== false;
  bindGlobal();
  applyOffline();
  setSync(S.mode === 'demo' ? 'demo' : 'idle');
  // a link carrying a different ?api= is confirmed BEFORE any request is made
  if (API_PARAM_INVALID) toast('Link máy chủ không hợp lệ', { type: 'error' });
  if (PENDING_API) { showApiConfirm(PENDING_API, () => boot(asEmail)); return; }
  boot(asEmail);
}
async function boot(asEmail) {
  const sess = loadSession(S.mode);
  if (asEmail) {
    try {
      const r = await S.api.verifyCode(asEmail, DEMO_OTP);
      startSession(storeSession(S.mode, r), {});
      return;
    } catch (e) { /* fall back to the login screen */ }
  }
  if (sess) startSession(sess, {});
  else { App.returnHash = location.hash && !/^#\/?$/.test(location.hash) ? location.hash : ''; showLogin(); }
}
init();
