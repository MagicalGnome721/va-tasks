// ============================================================================
// Shared render helpers
// ============================================================================
function statusLabelOf(t) {
  const k = statusKey(t);
  if (isLegacy(k)) return Rules.labelOf('new') || 'Mới';
  return Rules.statusDisplay(t.status) || Rules.labelOf('new');
}
function statusPill(t, o = {}) {
  const k = statusKey(t); const ck = isLegacy(k) ? 'new' : k;
  const label = statusLabelOf(t);
  const legacy = isLegacy(k);
  const tip = k === 'unknown' ? 'Trạng thái không có trong danh mục' : legacy ? `Dữ liệu cũ: “${trim(t.status)}”` : (o.button ? 'Đổi trạng thái' : label);
  const tag = o.button ? 'button type="button"' : 'span';
  const close = o.button ? 'button' : 'span';
  return `<${tag} class="pill" data-testid="status-pill" data-status="${ck}" title="${esc(tip)}" ${o.button ? `data-pill-menu="${esc(t.id)}" aria-label="Trạng thái: ${esc(label)}. Bấm để đổi trạng thái" aria-haspopup="menu"` : ''}><span class="pill-text">${esc(label)}</span>${legacy ? '<span class="pill-sub">dữ liệu cũ</span>' : ''}</${close}>`;
}
function deadlineBadge(t) {
  const d = dlState(t);
  return `<span class="badge" data-testid="deadline-badge" data-state="${d.state}"><span class="label">${esc(d.label)}</span> <span class="deadline-detail">${esc(d.detail)}</span></span>`;
}
function sizeHint(s) { const i = (Rules.SIZE_INFO || {})[s]; return i ? (i.label ? i.label + (i.hint ? ' — ' + i.hint : '') : i.hint || '') : ''; }
function sizeBadge(t, o = {}) {
  const s = trim(t.size);
  if (!s) return `<span class="size-badge is-empty" data-testid="size-badge" data-size="" title="VA chưa chốt độ nặng">chưa chấm</span>`;
  return `<span class="size-badge" data-testid="size-badge" data-size="${esc(s)}" title="${esc('Độ nặng ' + s + (sizeHint(s) ? ': ' + sizeHint(s) : ''))}">${o.long ? 'Cỡ ' : ''}${esc(s)}</span>`;
}
function prioHtml(p) {
  if (!trim(p)) return '<span class="dash">—</span>';
  return `<span class="prio"><span class="prio-dot" style="--pr:${priorityColor(p)}" aria-hidden="true"></span>${esc(p)}</span>`;
}
function effPrioHtml(t) {
  if (colKey(t) !== 'new') return prioHtml(t.priority);
  const ep = effPrio(t);
  if (!trim(ep.label)) return '<span class="dash">—</span>';
  return `<span class="prio" title="${ep.escalated ? esc(`Gốc: ${t.priority || '—'} · tự nâng sau ${ep.waitedDays} ngày chờ`) : ''}"><span class="prio-dot" style="--pr:${prColorIdx(ep.index)}" aria-hidden="true"></span>${esc(ep.label)}${ep.escalated ? '<span class="mini-tag is-up" data-testid="escalated-badge">tự nâng</span>' : ''}</span>`;
}
function flagsHtml(t, o = {}) {
  const out = [];
  if (onHold(t)) out.push(`<span class="flag is-hold" data-testid="flag-hold" title="${esc(t.holdReason)}">${ICONS.pause}<span>Tạm dừng${o.long ? ': ' + esc(t.holdReason) : ''}</span></span>`);
  if (discuss(t)) out.push(`<span class="flag is-discuss" data-testid="flag-discuss" title="Đã sửa ${esc(t.revisionCount)} lần — nên trao đổi trực tiếp">${ICONS.chat}<span>Cần thảo luận</span></span>`);
  const pc = splitProgress(t);
  if (pc) {
    out.push(`<span class="flag is-parent" data-testid="flag-parent">${ICONS.split}<span>Đã chia ${pc.total} đợt · ${pc.done}/${pc.total} xong</span></span>`);
  }
  if (trim(t.parentId) && o.child !== false) out.push(`<span class="flag is-child" title="Thuộc đơn ${esc(t.parentId)}"><span>Thuộc ${esc(t.parentId)}</span></span>`);
  return out.join('');
}
function personHtml(name) {
  if (!trim(name)) return '<span class="dash">—</span>';
  return `<span class="person">${avatar(name, 'avatar-sm')}${esc(name)}</span>`;
}
function linkChips(v) {
  const links = Rules.splitLinks(v);
  if (!links.length) return '';
  return `<span class="links">${links.map((u) => /^https?:\/\//i.test(u) ? `<a class="link-chip" href="${esc(u)}" target="_blank" rel="noopener" title="${esc(u)}">${ICONS.link}<span>${esc(u.replace(/^https?:\/\//i, ''))}</span></a>` : `<span class="link-chip" title="Link không hợp lệ">${esc(u)}</span>`).join('')}</span>`;
}
const idHtml = (t) => (t._tmp ? '<span class="mono">Đang tạo…</span>' : `<span class="mono">${esc(t.id)}</span>`);
const savingHtml = (t) => (S.pending.has(t.id) ? '<span class="saving-spin" role="img" aria-label="Đang lưu"></span>' : '');
const dash = (v) => (trim(v) ? esc(v) : '<span class="dash">—</span>');
function loadingHtml(title) {
  return `<div class="view-head"><div><h1 class="view-title">${esc(title)}</h1></div></div>
    <div class="table-wrap" data-testid="loading-state" aria-busy="true" aria-label="Đang tải dữ liệu">${Array.from({ length: 6 }).map(() => '<div class="skeleton-row"><span class="skel"></span><span class="skel"></span><span class="skel"></span><span class="skel"></span><span class="skel"></span></div>').join('')}</div>`;
}
function errorHtml(e) {
  return `<div class="panel"><div class="empty is-error" data-testid="error-state" role="alert">${EMPTY_ART}
    <div class="empty-title">Không tải được dữ liệu</div><p>${esc(e ? `${e.code}: ${e.message}` : '')}</p>
    <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center"><button type="button" class="btn btn-primary" data-act="retry-load">Thử lại</button>${isVA() ? '<a class="btn" href="#/settings/sync">Mở Cài đặt</a>' : ''}</div></div></div>`;
}
const isMobile = () => window.matchMedia('(max-width: 767px)').matches;

// ============================================================================
// Menus (popover)
// ============================================================================
let openMenuState = null;
function closeMenu(focusBack = true) {
  if (!openMenuState) return;
  const m = openMenuState; openMenuState = null;
  removeLayer(m.el, focusBack);
  m.el.remove();
  document.removeEventListener('mousedown', m.outside, true);
}
function openMenu(anchor, buildItems) {
  closeMenu(false);
  const el = document.createElement('div');
  el.className = 'menu'; el.setAttribute('role', 'menu');
  document.body.appendChild(el);
  const render = (items) => {
    el.innerHTML = items.map((it, i) => {
      if (it.sep) return '<div class="menu-sep" role="separator"></div>';
      if (it.label && !it.fn && !it.submenu) return `<div class="menu-label">${esc(it.label)}</div>`;
      return `<button type="button" role="menuitem" class="menu-item" data-i="${i}" ${it.testid ? `data-testid="${esc(it.testid)}"` : ''} ${it.disabled ? 'disabled' : ''} ${it.title ? `title="${esc(it.title)}"` : ''}>${it.html || esc(it.text)}</button>`;
    }).join('') || '<div class="menu-label">Không có thao tác</div>';
    el._items = items;
    const r = anchor.getBoundingClientRect();
    const mw = el.offsetWidth, mh = el.offsetHeight;
    const left = Math.min(r.left, window.innerWidth - mw - 8);
    let top = r.bottom + 4;
    if (top + mh > window.innerHeight - 8) top = Math.max(8, r.top - mh - 4);
    el.style.left = Math.max(8, left) + 'px'; el.style.top = top + 'px';
    const first = el.querySelector('.menu-item:not([disabled])'); if (first) first.focus();
  };
  el.addEventListener('click', (e) => {
    const b = e.target.closest('.menu-item'); if (!b) return;
    const it = el._items[+b.dataset.i];
    if (it.submenu) { render(it.submenu()); return; }
    closeMenu(!it.noFocusBack); it.fn();
  });
  el.addEventListener('keydown', (e) => {
    const items = $$('.menu-item:not([disabled])', el);
    const i = items.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') { e.preventDefault(); (items[i + 1] || items[0]).focus(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); (items[i - 1] || items[items.length - 1]).focus(); }
    else if (e.key === 'Tab') { e.preventDefault(); closeMenu(); }
  });
  const outside = (e) => { if (!el.contains(e.target) && !anchor.contains(e.target)) closeMenu(false); };
  document.addEventListener('mousedown', outside, true);
  openMenuState = { el, outside };
  pushLayer(el, { onEsc: () => closeMenu(), returnFocus: describeFocus(anchor) });
  render(buildItems());
}
function moveToItems(t) {
  const from = statusKey(t);
  const to = allowedTo(t);
  const items = [{ label: 'Chuyển sang…' }].concat(to.map((k) => ({
    testid: 'move-to-' + k, html: `<span class="pill" data-status="${k}"><span class="pill-text">${esc(transitionText(from, k).label)}</span></span>`,
    fn: () => transition(t.id, k), disabled: !S.online, noFocusBack: true,
  })));
  if (isVA() && colKey(t) === 'review' && !to.includes('done')) items.push({ html: '<span class="muted">Hoàn thành: người order duyệt</span>', disabled: true, fn: () => {} });
  return items;
}
function taskMenuItems(t) {
  const items = [{ html: `${ICONS.open}<span>Mở chi tiết</span>`, fn: () => App.openTask(t.id), noFocusBack: true }];
  if (allowedTo(t).length) items.push({ html: `${ICONS.move}<span>Chuyển sang…</span>`, submenu: () => moveToItems(getTask(t.id) || t), disabled: !S.online });
  if (can('setSize', t).ok) items.push({ testid: 'menu-size', html: `<span class="size-badge" data-size="${esc(trim(t.size))}">${esc(trim(t.size) || '?')}</span><span>Chỉnh độ nặng</span>`, fn: () => openSizeDialog(getTask(t.id) || t), noFocusBack: true, disabled: !S.online });
  if (can('setPriority', t).ok) items.push({ testid: 'menu-priority', html: `<span class="prio-dot" style="--pr:${priorityColor(t.priority)}"></span><span>Chỉnh ưu tiên</span>`, fn: () => openPriorityDialog(getTask(t.id) || t), noFocusBack: true, disabled: !S.online });
  if (can('setHold', t).ok) items.push({ testid: 'menu-hold', html: `${onHold(t) ? ICONS.play : ICONS.pause}<span>${onHold(t) ? 'Tiếp tục' : 'Tạm dừng'}</span>`, fn: () => toggleHold(t.id), noFocusBack: true, disabled: !S.online });
  if (can('split', t).ok) items.push({ testid: 'menu-split', html: `${ICONS.split}<span>Chia đợt</span>`, fn: () => openSplitDialog(getTask(t.id) || t), noFocusBack: true, disabled: !S.online });
  return items;
}
function cardMenu(anchor, t) { openMenu(anchor, () => taskMenuItems(getTask(t.id) || t)); }

// ============================================================================
// Queue (VA default view)
// ============================================================================
// Reasons already visible as signals (priority, size, deadline) are not repeated in the row.
const SHOWN_REASON = /^(Ưu tiên |Hạn |Chưa có hạn|Việc |Chưa chấm|Đang tạm dừng|Đã chờ )/;
function waitedText(t) {
  const w = effPrio(t).waitedDays;
  return w > 0 ? `chờ ${w} ngày` : 'mới vào hàng';
}
function queueRowHtml(t, q) {
  const k = statusKey(t);
  const allowed = allowedTo(t);
  const claimOk = allowed.indexOf('in_progress') >= 0 || claimViaSplit(t);
  const claimWhy = claimOk ? (trim(t.size) === 'XL' ? 'Đơn XL: chia đợt trước khi nhận' : 'Nhận đơn này và bắt đầu làm') : (can('transition:in_progress', t).reason || (isSplitParent(t) ? 'Đơn đã chia đợt — nhận từng đợt con' : 'Không nhận được đơn này'));
  const held = onHold(t);
  const reasons = (q && q.reasons) || [];
  const extra = reasons.filter((r) => !SHOWN_REASON.test(r));
  const ep = effPrio(t);
  const hasMenu = can('setSize', t).ok || can('setPriority', t).ok || can('setHold', t).ok || can('split', t).ok;
  const meta = [trim(t.requester) ? esc(t.requester) : '', esc(trim(t.team)), esc(trim(t.project)), waitedText(t)].filter(Boolean);
  return `<li class="qrow ${held ? 'is-held' : ''} ${isSplitParent(t) ? 'is-parent' : ''} ${S.pending.has(t.id) ? 'is-saving' : ''}" data-testid="queue-row-${esc(t.id)}" data-id="${esc(t.id)}" tabindex="0" aria-label="${esc((q ? 'Vị trí ' + q.position + ': ' : '') + t.id + ' ' + t.name)}">
    <span class="qpos" data-testid="queue-pos-${esc(t.id)}" title="${q ? `Vị trí ${q.position} / ${q.total}` : ''}">${q ? q.position : '—'}</span>
    <div class="qmain">
      <div class="qtitle"><span class="qname">${esc(t.name)}</span>${savingHtml(t)}</div>
      <div class="qsub"><span class="mono">${esc(t.id)}</span>${meta.map((m) => `<span class="dot-sep">${m}</span>`).join('')}${trim(t.assignee) ? `<span class="dot-sep">giao trước: ${esc(t.assignee)}</span>` : ''}${isLegacy(k) ? '<span class="dot-sep">dữ liệu cũ</span>' : ''}</div>
      ${held ? `<div class="qnote is-hold">${ICONS.pause}<span>Tạm dừng: ${esc(t.holdReason)}</span></div>` : ''}
      ${flagsHtml(t) && !held ? `<div class="qflags">${flagsHtml(t)}</div>` : ''}
      <div class="qreasons ${extra.length ? '' : 'sr-only'}" data-testid="queue-reasons-${esc(t.id)}" title="${esc(reasons.join(' · '))}">${extra.length ? ICONS.spark + '<span>' + esc(extra.join(' · ')) + '</span>' : esc(reasons.join(' · '))}</div>
    </div>
    <div class="qsig">
      <span class="sig-prio" title="${esc(ep.escalated ? `Ưu tiên gốc: ${t.priority || '—'} · tự nâng sau ${ep.waitedDays} ngày chờ` : 'Ưu tiên')}"><span class="prio-dot" style="--pr:${prColorIdx(ep.index)}" aria-hidden="true"></span>${esc(ep.label || '—')}${ep.escalated ? '<span class="sig-up" data-testid="escalated-badge" aria-label="tự nâng">↑</span>' : ''}</span>
      ${trim(t.size) && can('setSize', t).ok ? `<button type="button" class="size-btn" data-size-of="${esc(t.id)}" data-write aria-label="Chỉnh cỡ — hiện tại ${esc(t.size)}" title="Độ nặng ${esc(t.size)}: ${esc(sizeHint(t.size))} · bấm để chỉnh cỡ">${sizeBadge(t)}</button>` : sizeBadge(t)}
      ${deadlineText(t)}
    </div>
    <div class="qactions">
      ${!trim(t.size) && can('setSize', t).ok ? `<button type="button" class="btn btn-sm" data-testid="queue-size-${esc(t.id)}" data-size-of="${esc(t.id)}" data-write title="Chấm độ nặng S / M / L / XL">Chấm cỡ</button>` : ''}
      <button type="button" class="btn btn-sm ${claimOk ? 'btn-primary' : ''}" data-testid="queue-claim-${esc(t.id)}" data-claim="${esc(t.id)}" data-write ${claimOk ? '' : 'disabled'} title="${esc(claimWhy)}">${trim(t.size) === 'XL' && claimOk ? ICONS.split + 'Chia đợt' : 'Nhận làm'}</button>
      ${hasMenu ? `<button type="button" class="icon-btn icon-btn-sm" data-testid="card-menu-${esc(t.id)}" data-card-menu="${esc(t.id)}" aria-label="Thêm thao tác cho ${esc(t.id)}" title="Độ nặng, ưu tiên, tạm dừng…" aria-haspopup="menu">${ICONS.dots}</button>` : ''}
    </div>
  </li>`;
}
// Deadline as quiet text; colour only when it needs attention.
function deadlineText(t) {
  const d = dlState(t);
  const date = trim(t.deadline) ? fmtDM(t.deadline) : '';
  const txt = d.state === 'none' ? 'Không hạn' : d.state === 'overdue' ? `Trễ · ${date}` : d.state === 'dueSoon' ? `${esc(d.detail || d.label)}` : date ? `Hạn ${date}` : esc(d.label);
  return `<span class="sig-dl" data-testid="deadline-badge" data-state="${d.state}" title="${esc(d.label + (d.detail ? ' · ' + d.detail : ''))}"><span class="label">${txt}</span></span>`;
}
function myWorkRowHtml(t) {
  const k = statusKey(t);
  const to = allowedTo(t);
  const next = k === 'changes_requested' ? (to.includes('review') ? 'review' : to.includes('in_progress') ? 'in_progress' : '') : k === 'in_progress' && to.includes('review') ? 'review' : '';
  const label = next ? transitionText(k, next).label : '';
  const rev = Number(t.revisionCount) > 0 ? `<span class="dot-sep ${discuss(t) ? 'is-hot' : ''}" title="Số lần người order yêu cầu sửa">sửa ${esc(t.revisionCount)} lần</span>` : '';
  return `<li class="wrow ${S.pending.has(t.id) ? 'is-saving' : ''}" data-testid="mywork-row-${esc(t.id)}" data-id="${esc(t.id)}" data-status="${colKey(t)}" tabindex="0">
    <div class="wmain"><div class="qtitle">${statusPill(t)}<span class="qname">${esc(t.name)}</span>${savingHtml(t)}</div>
      <div class="qsub"><span class="mono">${esc(t.id)}</span>${trim(t.requester) ? `<span class="dot-sep">${esc(t.requester)}</span>` : ''}${rev}${onHold(t) ? `<span class="dot-sep">tạm dừng</span>` : ''}</div></div>
    <div class="qsig">${sizeBadge(t)}${deadlineText(t)}</div>
    <div class="qactions">${next ? `<button type="button" class="btn btn-sm ${k === 'changes_requested' ? 'btn-primary' : ''}" data-testid="mywork-${next === 'review' ? 'submit' : 'resume'}-${esc(t.id)}" data-move="${esc(t.id)}" data-to="${next}" data-write>${esc(label)}</button>` : ''}</div>
  </li>`;
}
function renderQueue(view) {
  if (!S.loaded) { view.innerHTML = S.loadError ? `<div class="view-head"><div><h1 class="view-title">Hàng đợi</h1></div></div>${errorHtml(S.loadError)}` : loadingHtml('Hàng đợi'); return; }
  const prios = S.config.priorities;
  let mine = [], queue = [];
  try { mine = Rules.myWorkSort(S.tasks, myName(), today(), prios) || []; } catch (e) { mine = []; }
  try { queue = Rules.queueSort(S.tasks.filter((t) => !t._tmp), today(), prios) || []; } catch (e) { queue = []; }
  const held = queue.filter(onHold).length;
  const unsized = queue.filter((t) => !trim(t.size)).length;
  const others = S.tasks.filter((t) => ['in_progress', 'changes_requested'].indexOf(statusKey(t)) >= 0 && trim(t.assignee) && !isMine(t));
  const reviewN = S.tasks.filter((t) => statusKey(t) === 'review').length;
  const summary = [`${queue.length} đơn chờ nhận`, unsized ? `${unsized} chưa chấm cỡ` : '', held ? `${held} tạm dừng` : '', reviewN ? `${reviewN} chờ người order duyệt` : ''].filter(Boolean).join(' · ');
  view.innerHTML = `
    <div class="view-head"><div><h1 class="view-title">Hàng đợi</h1><p class="view-sub">${esc(summary)}</p></div>
      <div class="head-actions">${S.aiEnabled !== false ? `<a class="btn btn-sm" href="#/ai" data-testid="queue-ai-plan">${ICONS.spark}Nhờ AI xếp lịch</a>` : ''}<a class="btn btn-sm btn-ghost" href="#/board">Xem Kanban</a></div></div>
    <section class="qsection" data-testid="queue-mine" aria-labelledby="qm-t">
      <div class="sec-head"><h2 class="sec-title" id="qm-t">Việc của tôi <span class="count-pill">${mine.length}</span></h2>
        ${others.length ? `<span class="sec-meta">${others.length} việc của VA khác đang chạy</span>` : ''}</div>
      ${mine.length ? `<ol class="rows wlist">${mine.map(myWorkRowHtml).join('')}</ol>` : '<p class="sec-empty">Bạn chưa nhận việc nào. Đơn đầu hàng bên dưới là việc nên làm tiếp theo.</p>'}
    </section>
    <section class="qsection" data-testid="queue-list" aria-labelledby="ql-t">
      <div class="sec-head"><h2 class="sec-title" id="ql-t">Chờ nhận <span class="count-pill">${queue.length}</span></h2>
        <span class="sec-meta" title="Thứ tự: ưu tiên hiệu lực → hạn cần → độ nặng → ngày order. Đơn chờ quá ${esc(Rules.AGING_DAYS || 10)} ngày tự nâng 1 bậc ưu tiên.">Xếp theo ưu tiên → hạn → độ nặng</span></div>
      ${queue.length ? `<ol class="rows qlist">${queue.map((t) => queueRowHtml(t, S.qi[t.id])).join('')}</ol>` : `<div class="empty" data-testid="empty-state">${EMPTY_ART}<div class="empty-title">Hàng đợi trống</div><p>Không còn đơn nào chờ nhận.</p></div>`}
    </section>`;
}

// ============================================================================
// Requester: Đơn của tôi
// ============================================================================
function orderCardHtml(t) {
  const k = statusKey(t); const ck = colKey(t);
  const q = ck === 'new' ? queueInfoOf(t) : null;
  const aad = k === 'review' ? autoApproveOn(t) : '';
  const to = allowedTo(t);
  let body = '';
  if (ck === 'new') {
    body = q ? `<div class="oc-queue" data-testid="queue-pos-${esc(t.id)}"><span class="oc-pos">Vị trí <b>#${esc(q.position)}</b> / ${esc(q.total)} trong hàng</span>${(q.reasons || []).length ? `<span class="oc-reasons">${q.reasons.map(esc).join(' · ')}</span>` : ''}</div>` : '<div class="oc-queue muted">Đang chờ VA xếp hàng</div>';
  } else if (k === 'in_progress') body = `<div class="oc-line">${personHtml(t.assignee)}<span>đang làm</span></div>`;
  else if (k === 'changes_requested') body = `<div class="oc-line">${personHtml(t.assignee)}<span>đang sửa theo góp ý của bạn</span></div>`;
  else if (k === 'review') {
    body = `<div class="oc-line">${personHtml(t.assignee)}<span>đã gửi kết quả</span></div>${linkChips(t.deliveryLink)}
      ${aad ? `<div class="oc-auto" data-testid="auto-approve-${esc(t.id)}">${onHold(t) ? 'Đang tạm dừng — không tự duyệt' : `Tự duyệt sau: <b>${esc(fmtDM(aad))}</b> nếu bạn chưa phản hồi`}</div>` : ''}
      <div class="oc-actions">
        <button type="button" class="btn btn-sm btn-ok" data-testid="approve-pass-${esc(t.id)}" data-move="${esc(t.id)}" data-to="done" data-write ${to.includes('done') && !S.pending.has(t.id) ? '' : 'disabled'}>${ICONS.check}Đạt</button>
        <button type="button" class="btn btn-sm" data-testid="approve-fail-${esc(t.id)}" data-move="${esc(t.id)}" data-to="changes_requested" data-write ${to.includes('changes_requested') && !S.pending.has(t.id) ? '' : 'disabled'}>${ICONS.x}Chưa đạt</button>
      </div>`;
  } else if (k === 'done') body = `<div class="oc-line">${linkChips(t.deliveryLink) || '<span class="muted">Đã hoàn thành</span>'}</div>`;
  return `<article class="ocard ${S.pending.has(t.id) ? 'is-saving' : ''}" data-testid="order-card-${esc(t.id)}" data-id="${esc(t.id)}" data-status="${ck}" tabindex="0" aria-label="${esc(t.id + ': ' + t.name)}">
    <div class="oc-top">${idHtml(t)}${statusPill(t)}${sizeBadge(t)}${savingHtml(t)}<span class="oc-spacer"></span>${trim(t.deadline) ? deadlineBadge(t) : ''}</div>
    <div class="oc-name">${esc(t.name)}</div>
    ${flagsHtml(t) ? `<div class="qflags">${flagsHtml(t)}</div>` : ''}
    ${body}
  </article>`;
}
function renderMine(view) {
  if (!S.loaded) { view.innerHTML = S.loadError ? `<div class="view-head"><div><h1 class="view-title">Đơn của tôi</h1></div></div>${errorHtml(S.loadError)}` : loadingHtml('Đơn của tôi'); return; }
  const own = S.tasks.filter((t) => !isVA() || isOwnOrder(t));
  const byQ = (a, b) => ((queueInfoOf(a) || {}).position || 999) - ((queueInfoOf(b) || {}).position || 999) || idNum(a.id) - idNum(b.id);
  const review = own.filter((t) => statusKey(t) === 'review').sort((a, b) => trim(a.reviewDate).localeCompare(trim(b.reviewDate)));
  const working = own.filter((t) => ['in_progress', 'changes_requested'].indexOf(statusKey(t)) >= 0).sort((a, b) => idNum(a.id) - idNum(b.id));
  const waiting = own.filter((t) => colKey(t) === 'new').sort(byQ);
  const closed = own.filter((t) => ['done', 'cancelled'].indexOf(statusKey(t)) >= 0).sort((a, b) => idNum(b.id) - idNum(a.id));
  const first = trim(myName()) || 'bạn';
  const sec = (key, title, list, desc, o = {}) => list.length ? `<section class="osec ${o.hot ? 'is-hot' : ''}" data-testid="mine-${key}" aria-labelledby="ms-${key}">
      <div class="osec-head"><h2 id="ms-${key}">${esc(title)} <span class="count-pill">${list.length}</span></h2>${desc ? `<p>${esc(desc)}</p>` : ''}</div>
      <div class="ogrid">${list.map(orderCardHtml).join('')}</div></section>` : '';
  if (!own.length) {
    view.innerHTML = `<div class="view-head"><div><h1 class="view-title">Đơn của tôi</h1></div></div>
      <div class="panel"><div class="empty" data-testid="empty-state">${EMPTY_ART}<div class="empty-title">Bạn chưa có đơn nào</div><p>Mô tả việc bạn cần, AI sẽ giúp bạn viết thành đơn rõ ràng cho team VA.</p>
      <a class="btn btn-brand" href="#/new" data-testid="mine-new">Tạo đơn đầu tiên</a></div></div>`;
    return;
  }
  const showClosed = !!S.groupCollapsed['mine-closed-open'];
  view.innerHTML = `<div class="view-head"><div><h1 class="view-title">Chào ${esc(first)}</h1><p class="view-sub">${review.length ? `Có <b>${review.length}</b> đơn cần bạn duyệt.` : 'Không có đơn nào chờ bạn duyệt.'} ${waiting.length ? `${waiting.length} đơn đang trong hàng.` : ''}</p></div>
</div>
    ${sec('review', 'Cần bạn duyệt', review, 'Xem kết quả và bấm Đạt hoặc Chưa đạt. Nếu bạn không phản hồi, đơn tự duyệt sau 3 ngày làm việc.', { hot: true })}
    ${sec('working', 'VA đang làm', working, '')}
    ${sec('waiting', 'Đang trong hàng', waiting, 'Vị trí tính trên toàn bộ hàng đợi của team VA.')}
    ${closed.length ? `<section class="osec" data-testid="mine-closed"><div class="osec-head"><h2><button type="button" class="linklike" data-toggle-closed aria-expanded="${showClosed}">${ICONS.chevDown}Đã xong / đã hủy <span class="count-pill">${closed.length}</span></button></h2></div>
      ${showClosed ? `<div class="ogrid">${closed.slice(0, 30).map(orderCardHtml).join('')}</div>` : ''}</section>` : ''}`;
}

// ============================================================================
// Overview (VA)
// ============================================================================
function renderOverview(view) {
  if (!S.loaded) { view.innerHTML = S.loadError ? errorHtml(S.loadError) : loadingHtml('Tổng quan'); return; }
  const open = S.tasks.filter((t) => Rules.isOpen(t));
  const counts = {
    queue: S.tasks.filter((t) => colKey(t) === 'new').length,
    // cùng định nghĩa với danh sách "Việc của tôi" (Rules.myWorkSort): Đang làm + Cần sửa của mình
    mine: open.filter((t) => isMine(t) && ['in_progress', 'changes_requested'].indexOf(statusKey(t)) >= 0).length,
    myReview: open.filter((t) => isMine(t) && statusKey(t) === 'review').length,
    review: S.tasks.filter((t) => statusKey(t) === 'review').length,
    changes: S.tasks.filter((t) => statusKey(t) === 'changes_requested').length,
    overdue: open.filter((t) => dlState(t).state === 'overdue').length,
    hold: open.filter(onHold).length,
  };
  const STATS = [
    ['queue', 'Trong hàng', 'queue', 'Đơn Mới chờ nhận'], ['mine', 'Việc của tôi', 'mine', 'Bạn đang làm / sửa'],
    ['review', 'Chờ duyệt', 'review', 'Người order đang xem'], ['changes', 'Cần sửa', 'changes', 'Bị “Chưa đạt”'],
    ['overdue', 'Quá hạn', 'overdue', 'Đã qua hạn cần'], ['hold', 'Tạm dừng', 'hold', 'Đang chờ thông tin'],
  ];
  const first = trim(myName()).split(/\s+/).pop() || '';
  if (!S.tasks.length) {
    view.innerHTML = `<div class="view-head"><div><h1 class="view-title">Tổng quan</h1></div></div>
      <div class="panel"><div class="empty" data-testid="empty-state">${EMPTY_ART}<div class="empty-title">Chưa có đơn nào</div><p>Khi các team gửi order, đơn sẽ xuất hiện ở Hàng đợi.</p></div></div>`;
    return;
  }
  let mine = [];
  try { mine = (Rules.myWorkSort(S.tasks, myName(), today(), S.config.priorities) || []).slice(0, 8); } catch (e) { mine = []; }
  const urgent = sortTasks(open.filter((t) => ['overdue', 'dueSoon'].includes(dlState(t).state)), '', 'asc').slice(0, 10);
  const disc = open.filter(discuss);
  const line = (t) => `<button type="button" class="task-line" data-open="${esc(t.id)}">${idHtml(t)}<span class="tl-name">${esc(t.name)}</span>${statusPill(t)}${deadlineBadge(t)}</button>`;
  const statusCounts = STATUS_ORDER.map((key) => ({ key, label: Rules.labelOf(key), n: S.tasks.filter((t) => colKey(t) === key).length }));
  const maxN = Math.max(1, ...statusCounts.map((x) => x.n));
  const artists = members().filter((m) => m.isArtist && m.active !== false);
  const wl = artists.map((m) => { const ts = open.filter((t) => sameName(t.assignee, m.name) && ['in_progress', 'changes_requested', 'review'].indexOf(statusKey(t)) >= 0); return { m, n: ts.length, over: ts.filter((t) => dlState(t).state === 'overdue').length, sizes: ts.map((t) => trim(t.size)).filter(Boolean).join(' ') }; });
  const maxW = Math.max(1, ...wl.map((x) => x.n));
  view.innerHTML = `
    <div class="view-head"><div><h1 class="view-title">Chào ${esc(first || 'bạn')}</h1><p class="view-sub">Hôm nay ${esc(fmtDate(today()))} · ${counts.queue} đơn trong hàng · ${counts.mine ? `bạn có ${counts.mine} việc đang làm` : 'bạn không có việc nào đang làm'}${counts.myReview ? ` (+${counts.myReview} chờ duyệt)` : ''}</p></div></div>
    <div class="stats">${STATS.map(([k, label, qf, hint]) => `
      <button type="button" class="stat ${(k === 'overdue' || k === 'changes') && counts[k] > 0 ? 'is-hot' : ''}" data-key="${k}" data-testid="stat-card-${k}" data-qf="${qf}">
        <span class="stat-label">${label}</span><span class="stat-value">${counts[k]}</span><span class="stat-hint">${esc(hint)}</span>
      </button>`).join('')}</div>
    <div class="ov-grid">
      <div class="ov-col">
        <section class="panel" data-testid="overview-mine" aria-labelledby="ov-mine-t">
          <div class="panel-head"><h2 class="panel-title" id="ov-mine-t">Việc của tôi</h2><a class="panel-link" href="#/queue">Mở hàng đợi →</a></div>
          <div class="panel-body">${mine.length ? mine.map(line).join('') : '<p class="panel-empty">Bạn chưa nhận việc nào.</p>'}</div>
        </section>
        <section class="panel" data-testid="overview-overdue" aria-labelledby="ov-urg-t">
          <div class="panel-head"><h2 class="panel-title" id="ov-urg-t">Quá hạn & sắp đến hạn</h2><button type="button" class="panel-link" data-qf="overdue">Xem quá hạn →</button></div>
          <div class="panel-body">${urgent.length ? urgent.map(line).join('') : '<p class="panel-empty">Không có đơn nào quá hạn hay sắp đến hạn.</p>'}</div>
        </section>
        ${disc.length ? `<section class="panel" data-testid="overview-discuss" aria-labelledby="ov-dis-t">
          <div class="panel-head"><h2 class="panel-title" id="ov-dis-t">Cần thảo luận</h2><button type="button" class="panel-link" data-qf="discuss">Xem tất cả →</button></div>
          <div class="panel-body">${disc.map(line).join('')}</div></section>` : ''}
      </div>
      <div class="ov-col">
        <section class="panel" aria-labelledby="ov-st-t">
          <div class="panel-head"><h2 class="panel-title" id="ov-st-t">Theo trạng thái</h2></div>
          <div class="panel-body">${statusCounts.map(({ key, label, n }) => `
            <button type="button" class="status-row" data-testid="overview-status-${key}" data-status="${key}" data-filter-status="${key}">
              <span class="pill" data-status="${key}"><span class="pill-text">${esc(label)}</span></span>
              <span class="bar"><span style="width:${(n / maxN) * 100}%"></span></span><span class="cnt">${n}</span></button>`).join('')}</div>
        </section>
        <section class="panel" aria-labelledby="ov-wl-t">
          <div class="panel-head"><h2 class="panel-title" id="ov-wl-t">Khối lượng theo VA</h2></div>
          <div class="panel-body">${wl.length ? wl.map(({ m, n, over, sizes }) => `
            <button type="button" class="workload-row" data-filter-assignee="${esc(m.name)}" aria-label="${esc(m.name)}: ${n} việc đang làm, ${over} quá hạn">
              ${avatar(m.name)}<span><span class="workload-name">${esc(m.name)}</span>${sizes ? `<span class="wl-sizes">${esc(sizes)}</span>` : ''}
              <span class="wl-bar" style="width:${Math.max(6, (n / maxW) * 100)}%"><span class="wl-over" style="flex:${over}"></span><span class="wl-ok" style="flex:${n - over}"></span></span></span>
              <span class="cnt">${n}</span></button>`).join('') : '<p class="panel-empty">Chưa có VA nào. Thêm ở Cài đặt › Thành viên.</p>'}</div>
          ${wl.length ? '<div class="wl-legend"><span><i style="background:var(--st-in_progress)"></i>Đang làm / sửa / chờ duyệt</span><span><i style="background:var(--dl-overdue)"></i>Quá hạn</span></div>' : ''}
        </section>
      </div>
    </div>`;
}
function goListWith(mut) {
  const p = DEFAULT_PREFS();
  p.sortKey = ''; mut(p);
  S.prefs = p; savePrefs();
  $('#global-search').value = p.q;
  location.hash = '#/list?' + prefsToQuery(p);
}

// ============================================================================
// Toolbar shared by list + board
// ============================================================================
let filtersOpen = false;
function activeFilterCount(p) { return FILTER_KEYS.filter((k) => p.filters[k].length).length; }
function filterOptions(k) {
  const vals = new Set();
  const add = (v) => { if (trim(v)) vals.add(trim(v)); };
  if (k === 'status') return STATUS_ORDER.map((s) => ({ v: s, l: Rules.labelOf(s) }));
  if (k === 'size') return [{ v: 'S', l: 'S' }, { v: 'M', l: 'M' }, { v: 'L', l: 'L' }, { v: 'XL', l: 'XL' }, { v: '__none__', l: '(Chưa chấm)' }];
  if (k === 'team') (S.config.teams || []).forEach(add);
  if (k === 'project') (S.config.projects || []).forEach(add);
  if (k === 'assetType') (S.config.assetTypes || []).forEach(add);
  if (k === 'priority') (S.config.priorities || []).forEach(add);
  if (k === 'assignee') members().filter((m) => m.isArtist).forEach((m) => add(m.name));
  if (k === 'requester') members().forEach((m) => add(m.name));
  S.tasks.forEach((t) => add(t[k]));
  const arr = Array.from(vals).map((v) => ({ v, l: v }));
  if (k === 'assignee') arr.unshift({ v: '__none__', l: '(Chưa có người làm)' });
  return arr;
}
const FILTER_LABELS = { status: 'Trạng thái', team: 'Team', project: 'Dự án', assetType: 'Loại asset', priority: 'Ưu tiên', size: 'Độ nặng', assignee: 'Người làm', requester: 'Người order' };
function toolbarHtml(kind) {
  const p = S.prefs;
  const n = activeFilterCount(p);
  return `<div class="toolbar">
    <div class="toolbar-row">
      <div class="qf-bar" role="group" aria-label="Lọc nhanh">${QUICK_FILTERS.map((f) => `<button type="button" class="chip" data-testid="quick-filter-${f.key}" data-qf="${f.key}" aria-pressed="${p.qf === f.key}">${f.label}<span class="chip-count" data-qf-count="${f.key}"></span></button>`).join('')}</div>
    </div>
    <div class="toolbar-row">
      <button type="button" class="btn btn-sm btn-filters" data-testid="btn-filters" aria-expanded="${filtersOpen}" aria-controls="filters-panel">${ICONS.filter}<span class="btn-filters-text">${n ? `Bộ lọc (${n})` : 'Bộ lọc'}</span></button>
      <button type="button" class="btn btn-sm btn-ghost" data-testid="btn-clear-filters">Xóa bộ lọc</button>
      <div class="toolbar-right">
        ${kind === 'list' ? `<label class="switch"><input type="checkbox" role="switch" data-testid="toggle-hide-closed" ${p.hideClosed ? 'checked' : ''}>Ẩn đơn đã đóng</label>
        <label class="switch" style="gap:6px">Nhóm theo <select class="select-inline" data-testid="group-by" aria-label="Nhóm theo">
          ${[['', 'Không nhóm'], ['status', 'Trạng thái'], ['assignee', 'Người làm'], ['size', 'Độ nặng'], ['project', 'Dự án'], ['team', 'Team']].map(([v, l]) => `<option value="${v}" ${p.groupBy === v ? 'selected' : ''}>${l}</option>`).join('')}
        </select></label>` : ''}
        <span class="list-count" data-testid="list-count" aria-live="polite"></span>
      </div>
    </div>
    <div class="filters-panel" id="filters-panel" ${filtersOpen ? '' : 'hidden'}>
      ${FILTER_KEYS.map((k) => `<div class="filter-group"><label for="flt-${k}">${FILTER_LABELS[k]}</label>
        <select id="flt-${k}" multiple data-testid="filter-${k}" data-filter="${k}">${filterOptions(k).map((o) => `<option value="${esc(o.v)}" ${p.filters[k].indexOf(o.v) >= 0 ? 'selected' : ''}>${esc(o.l)}</option>`).join('')}</select></div>`).join('')}
    </div>
  </div>`;
}
function refreshToolbarState(kind) {
  const p = S.prefs;
  $$('[data-qf-count]').forEach((el) => {
    const k = el.dataset.qfCount;
    const n = filterTasks(Object.assign({}, p, { qf: k }), { board: kind === 'board' }).length;
    el.textContent = ` (${n})`;
  });
  $$('.qf-bar .chip').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.qf === p.qf)));
  const n = activeFilterCount(p);
  const bt = $('.btn-filters-text'); if (bt) bt.textContent = n ? `Bộ lọc (${n})` : 'Bộ lọc';
}
function updatePrefs(mut, kind) {
  mut(S.prefs); savePrefs();
  if (S.view === 'list' || S.view === 'board') {
    const qs = prefsToQuery(S.prefs);
    const h = '#/' + S.view + (qs ? '?' + qs : '');
    if (location.hash !== h && !/^#\/task/.test(location.hash)) history.replaceState(null, '', h);
    App.bgHash = h;
  }
  updateResults(kind || S.view);
}
function updateResults(kind) {
  if (kind === 'list') renderListResults(); else if (kind === 'board') renderBoardColumns();
  refreshToolbarState(kind);
}

// ============================================================================
// List
// ============================================================================
function mountList(view) {
  view.innerHTML = `<div class="view-head"><div><h1 class="view-title">Danh sách</h1><p class="view-sub">Mọi đơn order, lọc và sắp xếp theo nhu cầu.</p></div></div>
    ${toolbarHtml('list')}<div id="list-results"></div>`;
  renderListResults();
  refreshToolbarState('list');
}
const LIST_COLS = [
  ['id', 'ID', ''], ['name', 'Tên đơn', ''], ['priority', 'Ưu tiên', ''], ['size', 'Cỡ', ''], ['requester', 'Người order', 'col-hide-lg'],
  ['assignee', 'Người làm', ''], ['deadline', 'Hạn cần', ''], ['status', 'Trạng thái', ''], ['revisionCount', 'Sửa', 'col-hide-md'],
];
let listOrder = [];
function groupTasks(rows, by) {
  if (!by) return [{ key: '', label: '', rows }];
  const groups = new Map();
  const keyOf = (t) => {
    if (by === 'status') { const k = statusKey(t); return k === 'unknown' ? 'unknown:' + trim(t.status) : colKey(t); }
    return trim(t[by]);
  };
  rows.forEach((t) => { const k = keyOf(t); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(t); });
  let keys = Array.from(groups.keys());
  if (by === 'status') keys.sort((a, b) => { const ia = STATUS_ORDER.indexOf(a), ib = STATUS_ORDER.indexOf(b); return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib); });
  else if (by === 'size') keys.sort((a, b) => (a in SIZE_ORDER ? SIZE_ORDER[a] : 9) - (b in SIZE_ORDER ? SIZE_ORDER[b] : 9));
  else keys.sort((a, b) => (a === '' ? 1 : b === '' ? -1 : a.localeCompare(b, 'vi')));
  return keys.map((k) => ({
    key: k,
    label: by === 'status' ? (Rules.labelOf(k) || k.replace(/^unknown:/, '')) : (k || (by === 'assignee' ? '(Chưa có người làm)' : by === 'size' ? '(Chưa chấm)' : '(Trống)')),
    rows: groups.get(k),
  }));
}
function renderListResults() {
  const box = $('#list-results'); if (!box) return;
  const countEl = $('[data-testid="list-count"]');
  if (!S.loaded) {
    if (S.loadError) { box.innerHTML = errorHtml(S.loadError); }
    else box.innerHTML = `<div class="table-wrap" data-testid="loading-state" aria-busy="true" aria-label="Đang tải dữ liệu">${Array.from({ length: 6 }).map(() => '<div class="skeleton-row"><span class="skel"></span><span class="skel"></span><span class="skel"></span><span class="skel"></span><span class="skel"></span></div>').join('')}</div>`;
    if (countEl) countEl.textContent = '';
    return;
  }
  const p = S.prefs;
  const rows = sortTasks(filterTasks(p), p.sortKey, p.sortDir);
  if (countEl) countEl.textContent = rows.length + ' đơn';
  if (!rows.length) {
    listOrder = [];
    box.innerHTML = `<div class="panel"><div class="empty" data-testid="empty-state">${EMPTY_ART}<div class="empty-title">Không có đơn nào khớp bộ lọc</div><p>Thử bỏ bớt điều kiện lọc hoặc từ khóa tìm kiếm.</p><button type="button" class="btn" data-act="clear-filters">Xóa bộ lọc</button></div></div>`;
    return;
  }
  const groups = groupTasks(rows, p.groupBy);
  listOrder = [];
  groups.forEach((g) => { if (!S.groupCollapsed[p.groupBy + '|' + g.key]) g.rows.forEach((t) => listOrder.push(t.id)); });
  if (isMobile()) {
    box.innerHTML = `<div class="card-list">${groups.map((g) => {
      const gk = p.groupBy + '|' + g.key; const col = !!S.groupCollapsed[gk];
      return (p.groupBy ? `<button type="button" class="group-title" data-group="${esc(gk)}" aria-expanded="${!col}">${ICONS.chevDown}<span>${esc(g.label)} (${g.rows.length})</span></button>` : '') +
        (col ? '' : g.rows.map((t) => {
          const d = dlState(t);
          return `<div class="mcard ${d.state === 'overdue' ? 'is-overdue' : ''} ${S.pending.has(t.id) ? 'is-saving' : ''} ${S.selectedId === t.id ? 'is-selected' : ''}" role="button" tabindex="0" data-status="${colKey(t)}" data-testid="task-row-${esc(t.id)}" data-id="${esc(t.id)}">
            <div class="mcard-top">${idHtml(t)}${sizeBadge(t)}${trim(t.priority) ? `<span class="prio-dot" style="--pr:${prColorIdx(effPrio(t).index)}" title="Ưu tiên: ${esc(effPrio(t).label)}"></span><span class="sr-only">Ưu tiên ${esc(effPrio(t).label)}</span>` : ''}${savingHtml(t)}${avatar(t.assignee, 'avatar-sm')}</div>
            <div class="mcard-name">${esc(t.name)}</div>
            <div class="mcard-meta">${statusPill(t)}${deadlineBadge(t)}${flagsHtml(t, { child: false })}</div></div>`;
        }).join(''));
    }).join('')}</div>`;
    return;
  }
  const th = LIST_COLS.map(([k, l, cls]) => {
    const active = p.sortKey === k;
    const sort = active ? (p.sortDir === 'desc' ? 'descending' : 'ascending') : 'none';
    return `<th class="${cls}" aria-sort="${sort}" scope="col"><button type="button" class="th-btn" data-sort="${k}">${l}<span class="sort-arrow" aria-hidden="true">${active ? (p.sortDir === 'desc' ? '▼' : '▲') : ''}</span></button></th>`;
  }).join('');
  const body = groups.map((g) => {
    const gk = p.groupBy + '|' + g.key; const col = !!S.groupCollapsed[gk];
    const head = p.groupBy ? `<tr class="group-head"><td colspan="${LIST_COLS.length}"><button type="button" data-group="${esc(gk)}" aria-expanded="${!col}">${ICONS.chevDown}<span class="group-label">${esc(g.label)} (${g.rows.length})</span></button></td></tr>` : '';
    return head + (col ? '' : g.rows.map((t) => `<tr class="task-row ${S.pending.has(t.id) ? 'is-saving' : ''} ${S.selectedId === t.id ? 'is-selected' : ''}" data-testid="task-row-${esc(t.id)}" data-id="${esc(t.id)}" tabindex="0">
        <td class="td-id">${idHtml(t)}${savingHtml(t)}</td>
        <td class="td-name"><div class="nm">${esc(t.name)}</div><div class="sub">${[t.team, t.project, t.assetType].filter((x) => trim(x)).map(esc).join(' · ') || '—'}</div>${flagsHtml(t) ? `<div class="row-flags">${flagsHtml(t)}</div>` : ''}</td>
        <td>${effPrioHtml(t)}</td>
        <td>${sizeBadge(t)}</td>
        <td class="td-person col-hide-lg">${personHtml(t.requester)}</td>
        <td class="td-person">${personHtml(t.assignee)}</td>
        <td class="td-deadline"><div class="dl-date">${trim(t.deadline) ? esc(fmtDate(t.deadline) || t.deadline) : '<span class="dash">—</span>'}</div>${deadlineBadge(t)}</td>
        <td>${t._tmp || !allowedTo(t).length ? statusPill(t) : statusPill(t, { button: true })}</td>
        <td class="col-hide-md td-rev">${Number(t.revisionCount) > 0 ? `<span class="${discuss(t) ? 'rev-hot' : ''}">${esc(t.revisionCount)}</span>` : '<span class="dash">0</span>'}</td></tr>`).join(''));
  }).join('');
  box.innerHTML = `<div class="table-wrap"><table class="tasks"><caption class="sr-only">Danh sách đơn</caption><thead><tr>${th}</tr></thead><tbody>${body}</tbody></table></div>`;
}

// ============================================================================
// Board (Kanban) — 5 columns, cancelled stays in Danh sách
// ============================================================================
const BOARD_COLS = ['new', 'in_progress', 'review', 'changes_requested', 'done'];
function mountBoard(view) {
  view.innerHTML = `<div class="view-head"><div><h1 class="view-title">Kanban</h1><p class="view-sub">Kéo thẻ sang cột khác để đổi trạng thái. Cột “Hoàn thành” do người order duyệt.</p></div></div>
    ${toolbarHtml('board')}<div class="board" id="board" aria-label="Bảng Kanban"></div>`;
  renderBoardColumns();
  refreshToolbarState('board');
}
function cardHtml(t) {
  const d = dlState(t); const k = statusKey(t); const ck = colKey(t);
  const q = ck === 'new' ? S.qi[t.id] : null;
  return `<article class="kcard ${d.state === 'overdue' ? 'is-overdue' : ''} ${S.pending.has(t.id) ? 'is-saving' : ''} ${onHold(t) ? 'is-held' : ''}" data-testid="task-card-${esc(t.id)}" data-id="${esc(t.id)}" data-status="${ck}" tabindex="0" aria-label="${esc(t.id)}: ${esc(t.name)}">
    <div class="kcard-top">${q ? `<span class="kpos" title="Vị trí trong hàng">#${q.position}</span>` : ''}${idHtml(t)}<span class="prio-dot" style="--pr:${prColorIdx(effPrio(t).index)}" title="Ưu tiên: ${esc(effPrio(t).label)}"></span><span class="sr-only">Ưu tiên ${esc(effPrio(t).label)}</span>${sizeBadge(t)}${savingHtml(t)}</div>
    ${t._tmp ? '' : `<button type="button" class="icon-btn icon-btn-sm kcard-menu-btn" data-testid="card-menu-${esc(t.id)}" data-card-menu="${esc(t.id)}" aria-label="Thao tác cho ${esc(t.id)}" aria-haspopup="menu">${ICONS.dots}</button>`}
    <div class="kcard-name">${esc(t.name)}</div>
    <div class="kcard-meta">${k === 'unknown' || isLegacy(k) ? statusPill(t) : ''}${trim(t.deadline) || ck !== 'done' ? deadlineBadge(t) : ''}${flagsHtml(t, { child: false })}</div>
    <div class="kcard-foot">${Number(t.revisionCount) > 0 ? `<span class="mini-tag ${discuss(t) ? 'is-hot' : ''}" title="Số lần sửa">Sửa ${esc(t.revisionCount)}×</span>` : ''}<span style="flex:1"></span>${trim(t.assignee) ? `<span title="${esc(t.assignee)}">${avatar(t.assignee, 'avatar-sm')}</span><span class="sr-only">Người làm: ${esc(t.assignee)}</span>` : `<span title="Chưa có người làm">${avatar('', 'avatar-sm')}</span>`}</div>
  </article>`;
}
function renderBoardColumns() {
  const board = $('#board'); if (!board) return;
  const countEl = $('[data-testid="list-count"]');
  if (!S.loaded) {
    board.innerHTML = S.loadError ? errorHtml(S.loadError) : BOARD_COLS.map((k) => `<section class="col" data-status="${k}" data-testid="loading-state"><div class="col-head"><span class="skel" style="width:60%"></span></div><div class="col-body">${'<div class="kcard"><span class="skel"></span><br><span class="skel" style="width:70%"></span></div>'.repeat(2)}</div></section>`).join('');
    return;
  }
  const rows = filterTasks(S.prefs, { board: true });
  const inBoard = rows.filter((t) => BOARD_COLS.indexOf(colKey(t)) >= 0);
  if (countEl) countEl.textContent = inBoard.length + ' đơn';
  const scroll = board.scrollLeft;
  board.innerHTML = BOARD_COLS.map((key) => {
    let items = rows.filter((t) => colKey(t) === key);
    const total = items.length;
    let more = '';
    if (key === 'done') {
      items = items.slice().sort((a, b) => trim(b.reviewDate).localeCompare(trim(a.reviewDate)) || idNum(b.id) - idNum(a.id));
      if (items.length > 20) { items = items.slice(0, 20); more = `<div class="col-more"><a href="#/list?status=done&closed=1">Xem tất cả trong Danh sách</a></div>`; }
    } else if (key === 'new') {
      items = items.slice().sort((a, b) => ((S.qi[a.id] || {}).position || 9999) - ((S.qi[b.id] || {}).position || 9999) || idNum(a.id) - idNum(b.id));
    } else if (key === 'in_progress' || key === 'changes_requested') {
      items = boardSort(items);
    } else items = items.slice().sort((a, b) => trim(a.reviewDate).localeCompare(trim(b.reviewDate)) || idNum(a.id) - idNum(b.id));
    const collapsed = !!S.collapsed[key];
    const label = key === 'new' ? 'Hàng đợi' : Rules.labelOf(key);
    return `<section class="col" data-testid="kanban-column-${key}" data-status="${key}" data-count="${total}" data-collapsed="${collapsed}" aria-label="${esc(label)}, ${total} đơn">
      <div class="col-head"><span class="col-title">${esc(label)}</span><span class="col-count">${total}</span>
        <button type="button" class="icon-btn icon-btn-sm col-toggle" data-col-toggle="${key}" aria-expanded="${!collapsed}" aria-label="${collapsed ? 'Mở rộng' : 'Thu gọn'} cột ${esc(label)}">${collapsed ? ICONS.chev : ICONS.chevDown}</button></div>
      <div class="col-body">${items.length ? items.map(cardHtml).join('') : '<div class="col-empty">Trống</div>'}${more}</div>
    </section>`;
  }).join('');
  board.scrollLeft = scroll;
}

// --- Drag & drop (pointer-based; mouse + touch long-press) ---
const Drag = { st: null };
function boardPointerDown(e) {
  const card = e.target.closest('.kcard');
  if (!card || e.button > 0 || e.target.closest('button')) return;
  const id = card.dataset.id; if (!id || id.startsWith('tmp-') || !S.online) return;
  const touch = e.pointerType === 'touch';
  Drag.st = { id, card, startX: e.clientX, startY: e.clientY, active: false, touch, pid: e.pointerId, timer: null, over: null };
  if (touch) Drag.st.timer = setTimeout(() => { if (Drag.st && !Drag.st.cancel) startDrag(Drag.st.startX, Drag.st.startY); }, 300);
}
function startDrag(x, y) {
  const st = Drag.st; if (!st) return;
  const t = getTask(st.id); if (!t) { Drag.st = null; return; }
  st.active = true;
  const from = colKey(t);
  const allowed = new Set(allowedTo(t));
  if (claimViaSplit(t)) allowed.add('in_progress');
  $$('.col').forEach((c) => {
    const k = c.dataset.status;
    if (k === from) { c.removeAttribute('data-drop'); c.removeAttribute('title'); }
    else {
      c.dataset.drop = allowed.has(k) ? 'allowed' : 'disabled';
      if (!allowed.has(k)) c.title = k === 'done' && isVA() ? 'Người order duyệt' : (can('transition:' + k, t).reason || 'Không chuyển được sang cột này');
    }
  });
  const r = st.card.getBoundingClientRect();
  st.offX = x - r.left; st.offY = y - r.top;
  const ghost = st.card.cloneNode(true);
  ghost.removeAttribute('data-testid'); $$('[data-testid]', ghost).forEach((n) => n.removeAttribute('data-testid'));
  ghost.classList.add('is-ghost'); ghost.style.width = r.width + 'px';
  document.body.appendChild(ghost);
  st.ghost = ghost;
  st.card.classList.add('is-dragging');
  document.body.classList.add('is-dragging');
  if (navigator.vibrate && st.touch) { try { navigator.vibrate(15); } catch (e) { /* ignore */ } }
  moveDrag(x, y);
}
function colAt(x, y) {
  const el = document.elementFromPoint(x, y);
  return el ? el.closest('.col') : null;
}
function moveDrag(x, y) {
  const st = Drag.st; if (!st || !st.active) return;
  st.ghost.style.left = (x - st.offX) + 'px'; st.ghost.style.top = (y - st.offY) + 'px';
  const col = colAt(x, y);
  if (st.over && st.over !== col) st.over.classList.remove('is-over');
  st.over = col;
  if (col && col.dataset.drop === 'allowed') col.classList.add('is-over');
  st.lastX = x; st.lastY = y;
  if (!st.raf) st.raf = requestAnimationFrame(autoScrollTick);
}
function autoScrollTick() {
  const st = Drag.st;
  if (!st || !st.active) return;
  st.raf = null;
  const board = $('#board');
  if (board && board.scrollWidth > board.clientWidth) {
    const br = board.getBoundingClientRect();
    const edge = 60;
    let dx = 0;
    if (st.lastX > br.right - edge) dx = Math.ceil((st.lastX - (br.right - edge)) / 4) + 6;
    else if (st.lastX < br.left + edge) dx = -(Math.ceil(((br.left + edge) - st.lastX) / 4) + 6);
    if (dx) {
      const before = board.scrollLeft;
      board.scrollLeft += dx;
      if (board.scrollLeft !== before) {
        const col = colAt(st.lastX, st.lastY);
        if (st.over && st.over !== col) st.over.classList.remove('is-over');
        st.over = col; if (col && col.dataset.drop === 'allowed') col.classList.add('is-over');
      }
      st.raf = requestAnimationFrame(autoScrollTick);
    }
  }
}
function endDrag(x, y, cancelled) {
  const st = Drag.st; Drag.st = null;
  if (!st) return;
  clearTimeout(st.timer);
  if (!st.active) return;
  const col = cancelled ? null : colAt(x, y);
  const allowed = !!(col && col.dataset.drop === 'allowed');
  if (st.ghost) st.ghost.remove();
  st.card.classList.remove('is-dragging');
  document.body.classList.remove('is-dragging');
  $$('.col').forEach((c) => { c.removeAttribute('data-drop'); c.classList.remove('is-over'); c.removeAttribute('title'); });
  Drag.justDragged = Date.now();
  if (allowed) transition(st.id, col.dataset.status);
  else if (col && col.dataset.status === 'done' && isVA()) toast('Hoàn thành do người order duyệt (hoặc tự duyệt sau 3 ngày làm việc)', { type: 'info' });
}
document.addEventListener('pointermove', (e) => {
  const st = Drag.st; if (!st || e.pointerId !== st.pid) return;
  const dx = e.clientX - st.startX, dy = e.clientY - st.startY;
  if (!st.active) {
    if (st.touch) { if (Math.hypot(dx, dy) > 8) { clearTimeout(st.timer); Drag.st = null; } return; }
    if (Math.hypot(dx, dy) > 5) startDrag(st.startX, st.startY); else return;
  }
  e.preventDefault();
  moveDrag(e.clientX, e.clientY);
});
document.addEventListener('pointerup', (e) => { if (Drag.st && e.pointerId === Drag.st.pid) endDrag(e.clientX, e.clientY, false); });
document.addEventListener('pointercancel', (e) => { if (Drag.st && e.pointerId === Drag.st.pid) endDrag(e.clientX, e.clientY, true); });
document.addEventListener('touchmove', (e) => { if (Drag.st && Drag.st.active) e.preventDefault(); }, { passive: false });
document.addEventListener('contextmenu', (e) => { if (Drag.st) e.preventDefault(); });

// ============================================================================
// Settings
// ============================================================================
const SETTINGS_TABS = [['general', 'Chung'], ['catalogs', 'Danh mục'], ['members', 'Thành viên'], ['sync', 'Kết nối']];
const CATALOGS = [['teams', 'Team'], ['projects', 'Dự án'], ['assetTypes', 'Loại asset'], ['priorities', 'Ưu tiên']];
const CATALOG_FIELD = { teams: 'team', projects: 'project', assetTypes: 'assetType', priorities: 'priority' };
const ADMIN_TAB = ['admin', 'Quản trị'];
const settingsTabs = () => (S.user && S.user.isOwner ? SETTINGS_TABS.concat([ADMIN_TAB]) : SETTINGS_TABS);
const settingsUi = { testResult: null, urlError: '', catErrors: {}, editing: null, memberError: '', memberErrors: {}, urlDraft: null, admin: null, adminBusy: '', adminErr: {}, adminMsg: null };
function roleLabel(u) { return u && u.role === 'va' ? (u.isOwner ? 'Quản trị viên' : 'VA') : 'Người order'; }
function renderSettings(view) {
  if (!isVA()) { view.innerHTML = `<div class="view-head"><div><h1 class="view-title">Cài đặt</h1><p class="view-sub">Hồ sơ và giao diện của bạn.</p></div></div><div class="settings-section settings-solo">${profileCardHtml()}${themeCardHtml()}<section class="card" data-testid="settings-buddy"><h2>Bạn đồng hành</h2><p class="card-desc">${BUDDY_NAME} chào bạn khi vào app và nhắc đơn cần duyệt.</p><label class="switch"><input type="checkbox" id="set-buddy" ${buddyOff() ? '' : 'checked'}>Hiện ${BUDDY_NAME}</label></section></div>`; return; }
  const tab = S.settingsTab;
  view.innerHTML = `<div class="view-head"><div><h1 class="view-title">Cài đặt</h1><p class="view-sub">Kết nối Google Sheet, danh mục và thành viên dùng chung cho cả team.</p></div></div>
    <div class="settings">
      <div class="settings-tabs" role="tablist" aria-label="Mục cài đặt">${settingsTabs().map(([k, l]) => `<a class="settings-tab" role="tab" href="#/settings/${k}" data-testid="settings-tab-${k}" aria-selected="${tab === k}">${l}</a>`).join('')}</div>
      <div class="settings-section" role="tabpanel">${settingsTabHtml(tab)}</div>
    </div>`;
}
function settingsTabHtml(tab) {
  if (tab === 'catalogs') return catalogsHtml();
  if (tab === 'members') return membersHtml();
  if (tab === 'sync') return syncHtml();
  if (tab === 'admin' && S.user && S.user.isOwner) return adminHtml();
  return generalHtml();
}
function profileCardHtml() {
  const u = S.user || {};
  return `<section class="card" data-testid="settings-profile"><h2>Hồ sơ</h2><p class="card-desc">Thông tin lấy từ danh sách thành viên của team VA.</p>
    <div class="profile">${avatar(u.name, 'avatar-lg')}<div><div class="profile-name">${esc(u.name || '')}</div><div class="muted">${esc(u.email || '')}</div>
      <div class="profile-tags"><span class="role-tag" data-role="${esc(u.role || '')}">${esc(roleLabel(u))}</span>${trim(u.team) ? `<span class="tag">${esc(u.team)}</span>` : ''}${S.mode === 'demo' ? '<span class="tag">Demo</span>' : ''}</div></div>
      <button type="button" class="btn" data-act="logout" data-testid="settings-logout">${ICONS.logout}Đăng xuất</button></div></section>`;
}
function themeCardHtml() {
  const cur = LS.raw('va.ui.theme') || '';
  return `<section class="card"><h2>Giao diện</h2><p class="card-desc">Sáng, tối hoặc theo hệ thống.</p>
    <div class="seg" role="radiogroup" aria-label="Giao diện" data-testid="settings-theme">${[['', 'Theo hệ thống'], ['light', 'Sáng'], ['dark', 'Tối']].map(([v, l]) => `<label><input type="radio" name="set-theme" value="${v}" ${cur === v ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div></section>`;
}
function generalHtml() {
  return `${profileCardHtml()}${themeCardHtml()}
    <section class="card" data-testid="settings-buddy"><h2>Bạn đồng hành</h2><p class="card-desc">${BUDDY_NAME} chào bạn khi vào app, nhắc việc cần làm và tung hứng vài câu cho đỡ khô.</p>
      <label class="switch"><input type="checkbox" id="set-buddy" ${buddyOff() ? '' : 'checked'}>Hiện ${BUDDY_NAME}</label></section>
    <section class="card"><h2>Cảnh báo deadline</h2><p class="card-desc">Đơn được đánh dấu “Sắp đến hạn” khi còn ít ngày hơn hoặc bằng số này.</p>
      <div class="inline-form"><div class="field" style="flex:0 1 220px"><label for="set-due">Sắp đến hạn khi còn ≤ N ngày</label>
        <input type="number" id="set-due" min="0" max="30" step="1" data-testid="settings-due-soon-days" value="${esc(S.config.dueSoonDays)}" data-write></div>
        <button type="button" class="btn" style="margin-top:23px" data-act="save-due" data-testid="settings-save-due-soon" data-write>Lưu</button></div>
      <div class="field-error" id="due-err" hidden></div></section>
    ${S.mode === 'demo' ? `<section class="card"><h2>Dữ liệu mẫu</h2><p class="card-desc">Xóa mọi thay đổi trong Demo, nạp lại dữ liệu mẫu và đăng xuất.</p>
      <button type="button" class="btn" data-testid="settings-reset-demo" data-act="reset-demo">Khôi phục dữ liệu mẫu</button></section>` : ''}`;
}
function usageCount(cat, name) { const f = CATALOG_FIELD[cat]; return S.tasks.filter((t) => sameName(t[f], name)).length; }
function catalogsHtml() {
  return `<div class="catalog-grid">${CATALOGS.map(([k, l]) => {
    const items = S.config[k] || [];
    return `<section class="card" data-testid="catalog-${k}"><h2>${l}</h2><p class="card-desc">${items.length} mục${k === 'priorities' ? ' · thứ tự = mức ưu tiên (mục 1 = Khẩn cấp)' : ''}</p>
      <ul class="cat-list">${items.map((it, i) => {
        const n = usageCount(k, it);
        const editing = settingsUi.editing && settingsUi.editing.cat === k && settingsUi.editing.i === i;
        return `<li class="cat-item">${k === 'priorities' ? `<span class="prio-dot" style="--pr:${prColorIdx(i)}"></span>` : ''}
          <span class="nm">${editing ? `<input type="text" value="${esc(it)}" data-rename="${k}" data-i="${i}" aria-label="Tên mới cho ${esc(it)}">` : esc(it)}</span>
          ${n ? `<span class="use" title="${n} đơn đang dùng">${n} đơn</span>` : ''}
          <button type="button" class="icon-btn icon-btn-sm" data-cat-up="${k}" data-i="${i}" aria-label="Chuyển ${esc(it)} lên" ${i === 0 ? 'disabled' : ''} data-write>${ICONS.up}</button>
          <button type="button" class="icon-btn icon-btn-sm" data-cat-down="${k}" data-i="${i}" aria-label="Chuyển ${esc(it)} xuống" ${i === items.length - 1 ? 'disabled' : ''} data-write>${ICONS.down}</button>
          <button type="button" class="icon-btn icon-btn-sm" data-cat-edit="${k}" data-i="${i}" aria-label="Đổi tên ${esc(it)}" data-write>${ICONS.edit}</button>
          <button type="button" class="icon-btn icon-btn-sm" data-cat-del="${k}" data-i="${i}" aria-label="Xóa ${esc(it)}" data-write>${ICONS.trash}</button></li>`;
      }).join('')}</ul>
      <div class="cat-add"><input type="text" data-testid="catalog-${k}-input" data-cat-input="${k}" placeholder="Thêm ${l.toLowerCase()}…" aria-label="Thêm mục vào ${l}" maxlength="100">
        <button type="button" class="btn" data-testid="catalog-${k}-add" data-cat-add="${k}" data-write>Thêm</button></div>
      ${settingsUi.catErrors[k] ? `<div class="field-error" role="alert">${esc(settingsUi.catErrors[k])}</div>` : ''}
    </section>`;
  }).join('')}
    <section class="card" style="grid-column:1/-1"><h2>Trạng thái & độ nặng</h2><p class="card-desc">Gắn với quy trình nên không chỉnh sửa được.</p>
      <div class="status-ro">${STATUS_ORDER.map((s) => `<span class="pill" data-status="${s}"><span class="pill-text">${esc(Rules.labelOf(s))}</span></span>`).join('')}</div>
      <div class="status-ro" style="margin-top:10px">${SIZES().map((s) => `<span class="size-row"><span class="size-badge" data-size="${s}">${s}</span><span class="muted">${esc(sizeHint(s))}</span></span>`).join('')}</div></section>
  </div>`;
}
function membersHtml() {
  const open = S.tasks.filter((t) => Rules.isOpen(t));
  const ms = members();
  const noMail = ms.filter((m) => m.active !== false && !trim(m.email));
  return `<section class="card"><h2>Thành viên</h2><p class="card-desc">Gmail dùng để đăng nhập (nhận mã 6 số). VA = người nhận làm đơn. Bỏ “Đang hoạt động” để khóa đăng nhập.</p>
    ${noMail.length ? `<div class="warn-box" role="status" data-testid="members-warning" style="margin-bottom:12px"><strong>${noMail.length} thành viên đang hoạt động chưa có Gmail — không đăng nhập được:</strong> ${noMail.map((m) => esc(m.name)).join(', ')}</div>` : ''}
    <table class="members"><thead><tr><th>Tên</th><th>Gmail</th><th>Team</th><th class="c">VA</th><th class="c">Hoạt động</th><th class="c">Đơn đang làm</th><th><span class="sr-only">Xóa</span></th></tr></thead>
    <tbody>${ms.map((m, i) => {
      const n = open.filter((t) => sameName(t.assignee, m.name)).length;
      const err = settingsUi.memberErrors[i];
      const warn = m.active !== false && !trim(m.email);
      return `<tr data-testid="member-row-${i}"><td><span class="person">${avatar(m.name, 'avatar-sm')}<strong>${esc(m.name)}</strong></span></td>
        <td data-label="Gmail" class="td-email"><div class="field ${err ? 'has-error' : ''}"><input type="email" class="input input-sm" data-mem-email="${i}" data-testid="member-email-${i}" value="${esc(m.email || '')}" placeholder="ten@gmail.com" aria-label="Gmail của ${esc(m.name)}" autocomplete="off" spellcheck="false" data-write ${err ? 'aria-invalid="true"' : ''}>
          ${err ? `<div class="field-error" role="alert">${esc(err)}</div>` : warn ? `<div class="field-hint is-warn" data-testid="member-warn-${i}">Không đăng nhập được</div>` : ''}</div></td>
        <td data-label="Team">${dash(m.team)}</td>
        <td class="c" data-label="VA"><input type="checkbox" data-mem-artist="${i}" ${m.isArtist ? 'checked' : ''} aria-label="${esc(m.name)} là VA" data-write></td>
        <td class="c" data-label="Hoạt động"><input type="checkbox" data-mem-active="${i}" ${m.active !== false ? 'checked' : ''} aria-label="${esc(m.name)} đang hoạt động" data-write></td>
        <td class="c" data-label="Đơn đang làm">${n}</td>
        <td><button type="button" class="icon-btn icon-btn-sm" data-mem-del="${i}" aria-label="Xóa ${esc(m.name)}" ${n ? 'disabled' : ''} title="${n ? 'Còn đơn đang làm — hãy bỏ chọn “Hoạt động” thay vì xóa' : 'Xóa thành viên'}" data-write>${ICONS.trash}</button></td></tr>`;
    }).join('')}</tbody></table>
    <div class="member-add"><input type="text" data-testid="member-add-input" id="mem-name" placeholder="Tên thành viên mới" aria-label="Tên thành viên mới" maxlength="50">
      <input type="email" data-testid="member-add-email" id="mem-email" placeholder="Gmail (để đăng nhập)" aria-label="Gmail thành viên mới" autocomplete="off" spellcheck="false">
      <select id="mem-team" aria-label="Team" data-testid="member-add-team"><option value="">— Team —</option>${(S.config.teams || []).map((t) => `<option value="${esc(t)}">${esc(t)}</option>`).join('')}</select>
      <label class="check"><input type="checkbox" id="mem-artist" data-testid="member-add-artist">Là VA</label>
      <button type="button" class="btn btn-primary" data-testid="member-add" data-act="mem-add" data-write>Thêm</button></div>
    ${settingsUi.memberError ? `<div class="field-error" role="alert" data-testid="member-error">${esc(settingsUi.memberError)}</div>` : ''}
  </section>`;
}
function syncHtml() {
  const w = (S.meta && S.meta.warnings) || [];
  const e = S.sync.error;
  const tr = settingsUi.testResult;
  const ai = S.aiEnabled;
  return `<section class="card" data-testid="settings-connection"><h2>Kết nối Google Sheet</h2><p class="card-desc">${S.mode === 'demo' ? 'Đang ở chế độ Demo: dữ liệu mẫu chỉ nằm trong trình duyệt này.' : 'Đang đồng bộ với Google Sheet qua Apps Script.'}</p>
      ${BUILT_API && S.mode === 'remote' ? `<p class="muted">Máy chủ được gắn sẵn trong bản phát hành — không cần cấu hình.</p><div class="btn-row"><button type="button" class="btn" data-testid="settings-test-connection" data-act="test-conn">Kiểm tra kết nối</button></div>${settingsUi.testResult ? `<p class="result-line ${settingsUi.testResult.ok ? 'ok' : 'err'}" role="status">${esc(settingsUi.testResult.text)}</p>` : ''}` : `<div class="stack">
        <div class="field ${settingsUi.urlError ? 'has-error' : ''}"><label for="set-url">Apps Script Web App URL</label>
          <input type="url" id="set-url" data-testid="settings-api-url" placeholder="https://script.google.com/macros/s/…/exec" value="${esc(settingsUi.urlDraft != null ? settingsUi.urlDraft : (LS.raw('va.apiUrl') || ''))}" autocomplete="off" spellcheck="false">
          ${settingsUi.urlError ? `<div class="field-error" role="alert">${esc(settingsUi.urlError)}</div>` : '<div class="field-hint">Chia sẻ cho team link app kèm <code>?api=&lt;URL này&gt;</code> để mọi người khỏi phải dán URL.</div>'}</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" class="btn" data-testid="settings-test-connection" data-act="test-conn">Kiểm tra (ping)</button>
          <button type="button" class="btn btn-primary" data-testid="settings-save-connection" data-act="save-conn">Lưu</button></div>
        ${tr ? `<p class="result-line ${tr.ok ? 'ok' : 'err'}" role="status" data-testid="settings-test-result">${esc(tr.text)}</p>` : ''}
        ${FORCE_DEMO && trim(LS.raw('va.apiUrl')) ? '<p class="muted">URL đang có tham số <code>?demo=1</code> nên app vẫn chạy Demo.</p>' : ''}
      </div>`}</section>
    <section class="card"><h2>Trợ lý AI (DeepSeek)</h2>
      <p class="ai-status" data-testid="settings-ai-status" data-enabled="${ai === true ? 'true' : ai === false ? 'false' : 'unknown'}"><span class="dot" aria-hidden="true"></span>${ai === true ? 'Đang bật — AI đọc đơn khi tạo, lập kế hoạch, trả lời câu hỏi và viết báo cáo tuần.' : ai === false ? 'Đang tắt — chưa có API key DeepSeek. Người order dùng form thủ công.' : 'Chưa rõ (chưa tải cấu hình).'}</p>
      <p class="card-desc" style="margin:8px 0 0">${S.user && S.user.isOwner ? 'Dán hoặc đổi API key ở <a href="#/settings/admin">Quản trị</a>.' : 'Quản trị viên bật / tắt AI trong mục Quản trị.'}</p></section>
    <section class="card"><h2>Đồng bộ</h2>
    <dl class="kv"><dt>Chế độ hiện tại</dt><dd>${S.mode === 'demo' ? 'Demo (dữ liệu trong trình duyệt)' : 'Google Sheet'}</dd>
      <dt>Lần đồng bộ cuối</dt><dd>${S.sync.lastAt ? esc(fmtDateTime(new Date(S.sync.lastAt))) : '—'}</dd>
      ${S.meta && S.meta.sheetName ? `<dt>Tab dữ liệu</dt><dd>${esc(S.meta.sheetName)}</dd>` : ''}</dl>
    ${e && S.sync.state === 'error' ? `<div class="warn-box" style="background:var(--err-bg);color:var(--err-fg);border-color:transparent;margin-bottom:14px" role="alert"><strong>Lỗi đồng bộ:</strong> ${esc(e.code)} – ${esc(e.message)}</div>` : ''}
    <div class="inline-form"><button type="button" class="btn btn-primary" data-testid="sync-now" data-act="sync-now">Đồng bộ ngay</button>
      <label class="switch" style="margin-left:8px">Tự làm mới mỗi <select class="select-inline" id="set-poll" aria-label="Tự làm mới mỗi" data-write>
        ${[[0, 'Tắt'], [30, '30 giây'], [60, '60 giây'], [300, '5 phút']].map(([v, l]) => `<option value="${v}" ${Number(S.config.pollSeconds) === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label></div>
  </section>
  <section class="card"><h2>Cảnh báo từ dữ liệu</h2>
    ${w.length ? `<div class="warn-box" role="status"><strong>${w.length} cảnh báo</strong><ul>${w.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>` : '<p class="muted">Không có cảnh báo nào.</p>'}
  </section>
  <section class="card"><details class="guide"><summary>${ICONS.chev}Hướng dẫn cài đặt</summary>
      <ol>
        <li>Mở Google Sheet <strong>“[Visual Artist] Request Assets”</strong> › <strong>Extensions › Apps Script</strong>.</li>
        <li>Dán toàn bộ file <code>Code.gs</code> (và <code>appsscript.json</code>), bấm Lưu rồi chạy hàm <code>setup</code> một lần (cấp quyền khi được hỏi). Dữ liệu cũ: chạy thêm <code>migrateV2</code>.</li>
        <li><strong>Deploy › New deployment</strong> › <strong>Web app</strong>; Execute as: <strong>Me</strong>; Who has access: <strong>Anyone</strong>.</li>
        <li>Copy <strong>Web app URL</strong>, dán vào ô phía trên, bấm <strong>Kiểm tra</strong> rồi <strong>Lưu</strong>.</li>
        <li>Thêm Gmail cho từng thành viên ở tab <strong>Thành viên</strong> để họ đăng nhập bằng mã 6 số.</li>
      </ol></details></section>`;
}

// ---------- Quản trị (chỉ quản trị viên khuonglun69@gmail.com) ----------
async function loadAdmin(force) {
  if (settingsUi.adminBusy === 'load' || (settingsUi.admin && !force)) return;
  settingsUi.adminBusy = 'load';
  try { settingsUi.admin = await S.api.adminGet(auth()); settingsUi.adminMsg = null; }
  catch (e0) { const e = toApiError(e0); if (e.code === 'UNAUTHORIZED') { settingsUi.adminBusy = ''; App.onUnauthorized(); return; } settingsUi.adminMsg = { ok: false, text: 'Không tải được cài đặt quản trị: ' + e.message }; }
  settingsUi.adminBusy = '';
  if (S.view === 'settings' && S.settingsTab === 'admin') renderView({ force: true });
}
function adminField(id, label, inner, err, hint) {
  return `<div class="field ${err ? 'has-error' : ''}"><label for="${id}">${label}</label>${inner}${err ? `<div class="field-error" role="alert">${esc(err)}</div>` : hint ? `<div class="field-hint">${hint}</div>` : ''}</div>`;
}
function adminHtml() {
  const a = settingsUi.admin;
  if (!a) { loadAdmin(); return `<section class="card">${settingsUi.adminMsg ? `<p class="result-line err">${esc(settingsUi.adminMsg.text)}</p><button type="button" class="btn" data-admin="reload">Thử lại</button>` : '<p class="muted"><span class="saving-spin" aria-hidden="true"></span> Đang tải…</p>'}</section>`; }
  const E = settingsUi.adminErr || {}; const busy = settingsUi.adminBusy;
  const msg = settingsUi.adminMsg;
  const origin = location.origin && location.origin !== 'null' ? location.origin : 'https://<tên>.github.io';
  return `${msg ? `<div class="callout ${msg.ok ? 'is-ok' : 'is-error'}" role="status" data-testid="admin-msg">${esc(msg.text)}</div>` : ''}
    <section class="card" data-testid="admin-owner"><h2>Quản trị viên</h2><p class="card-desc">Tài khoản quản trị cố định của app — luôn đăng nhập được, toàn quyền: thành viên, danh mục, API key, duyệt thay người order.</p>
      <div class="profile">${avatar((S.user && S.user.name) || a.ownerEmail, 'avatar-lg')}<div><div class="profile-name">${esc(a.ownerEmail)}</div><div class="muted">Không đổi được trong app (đặt trong mã nguồn Code.gs).</div></div></div></section>
    <section class="card" data-testid="admin-ai"><h2>API key DeepSeek</h2>
      <p class="ai-status" data-enabled="${a.deepseekKeySet}"><span class="dot" aria-hidden="true"></span>${a.deepseekKeySet ? `Đang bật · key <code>${esc(a.deepseekKeyMasked)}</code>` : 'Chưa có key — AI đang tắt'}</p>
      <p class="card-desc">Lấy key tại platform.deepseek.com › API keys. Key chỉ lưu trên máy chủ Apps Script, không bao giờ gửi về trình duyệt.</p>
      ${adminField('ad-key', a.deepseekKeySet ? 'Thay key mới' : 'Dán key', `<input type="password" id="ad-key" data-testid="admin-deepseek-key" placeholder="sk-…" autocomplete="off" spellcheck="false">`, E.deepseekKey)}
      <div class="btn-row"><button type="button" class="btn btn-primary" data-admin="save-key" data-testid="admin-save-key" ${busy ? 'disabled' : ''}>${busy === 'save-key' ? '<span class="saving-spin" aria-hidden="true"></span>Đang lưu…' : 'Lưu key'}</button>
        ${a.deepseekKeySet ? `<button type="button" class="btn" data-admin="test-ai" data-testid="admin-test-ai" ${busy ? 'disabled' : ''}>${busy === 'test-ai' ? '<span class="saving-spin" aria-hidden="true"></span>Đang thử…' : 'Kiểm tra kết nối'}</button>
        <button type="button" class="btn btn-ghost btn-danger-text" data-admin="clear-key" ${busy ? 'disabled' : ''}>Gỡ key (tắt AI)</button>` : ''}</div></section>
    <section class="card" data-testid="admin-google"><h2>Đăng nhập bằng Google</h2>
      <p class="ai-status" data-enabled="${!!a.googleClientId}"><span class="dot" aria-hidden="true"></span>${a.googleClientId ? 'Đang bật — màn đăng nhập có nút “Đăng nhập bằng Google”' : 'Đang tắt — chỉ đăng nhập bằng mã gửi qua Gmail'}</p>
      ${adminField('ad-gid', 'Google OAuth Client ID', `<input type="text" id="ad-gid" data-testid="admin-google-client-id" value="${esc(a.googleClientId)}" placeholder="1234567890-abc….apps.googleusercontent.com" autocomplete="off" spellcheck="false">`, E.googleClientId)}
      <details class="guide"><summary>${ICONS.chev}Cách lấy Client ID (5 phút, miễn phí)</summary><ol>
        <li>Mở <b>console.cloud.google.com</b> bằng ${esc(a.ownerEmail)} › tạo project (VD “VA Tasks”).</li>
        <li><b>APIs &amp; Services › OAuth consent screen</b>: chọn <i>External</i>, điền tên app + email › Publish app.</li>
        <li><b>Credentials › Create credentials › OAuth client ID</b> › loại <i>Web application</i>.</li>
        <li><b>Authorized JavaScript origins</b>: thêm <code>${esc(origin)}</code> (địa chỉ đang mở app, không có dấu / cuối). Thêm <code>https://vaqueuecenter.pages.dev</code> để dùng bản Cloudflare Pages; giữ origin hiện tại nếu vẫn dùng cả hai địa chỉ.</li>
        <li>Create › copy <b>Client ID</b> dán vào ô trên › Lưu. Người dùng vẫn phải có Gmail trong danh sách Thành viên.</li></ol></details>
      <div class="btn-row"><button type="button" class="btn btn-primary" data-admin="save-google" data-testid="admin-save-google" ${busy ? 'disabled' : ''}>${busy === 'save-google' ? '<span class="saving-spin" aria-hidden="true"></span>Đang lưu…' : 'Lưu'}</button></div></section>
    <section class="card" data-testid="admin-mail"><h2>Email thông báo</h2>
      ${adminField('ad-url', 'Link app (chèn vào email)', `<input type="url" id="ad-url" data-testid="admin-app-url" value="${esc(a.appUrl)}" placeholder="https://vaqueuecenter.pages.dev/" autocomplete="off" spellcheck="false">`, E.appUrl, 'Email đơn mới / chờ duyệt / báo cáo tuần sẽ có link mở thẳng đơn.')}
      <label class="check" style="margin-top:10px"><input type="checkbox" id="ad-weekly" data-testid="admin-weekly" ${a.weeklyReport ? 'checked' : ''}>Gửi báo cáo tuần cho team VA mỗi sáng thứ Hai</label>
      <div class="btn-row"><button type="button" class="btn btn-primary" data-admin="save-mail" data-testid="admin-save-mail" ${busy ? 'disabled' : ''}>${busy === 'save-mail' ? '<span class="saving-spin" aria-hidden="true"></span>Đang lưu…' : 'Lưu'}</button></div></section>`;
}
async function adminAction(act) {
  if (act === 'reload') { settingsUi.admin = null; settingsUi.adminMsg = null; renderView({ force: true }); return; }
  if (!guardOnline() || settingsUi.adminBusy) return;
  let body = null; let okText = 'Đã lưu';
  if (act === 'save-key') { const v = trim($('#ad-key').value); if (!v) { settingsUi.adminErr = { deepseekKey: 'Hãy dán API key' }; renderView({ force: true }); $('#ad-key').focus(); return; } body = { deepseekKey: v }; okText = 'Đã lưu API key — AI đã bật'; }
  else if (act === 'clear-key') { const ok = await confirmDialog({ title: 'Gỡ API key DeepSeek?', desc: 'AI sẽ tắt: người order dùng form thủ công, Trợ lý AI ngừng hoạt động.', confirmText: 'Gỡ key', danger: true }); if (!ok) return; body = { deepseekKey: '' }; okText = 'Đã gỡ key — AI đã tắt'; }
  else if (act === 'save-google') { body = { googleClientId: trim($('#ad-gid').value) }; okText = body.googleClientId ? 'Đã bật đăng nhập Google' : 'Đã tắt đăng nhập Google'; }
  else if (act === 'save-mail') { body = { appUrl: trim($('#ad-url').value), weeklyReport: $('#ad-weekly').checked }; }
  settingsUi.adminBusy = act; settingsUi.adminErr = {}; settingsUi.adminMsg = null; renderView({ force: true });
  try {
    if (act === 'test-ai') { const r = await S.api.adminTestAi(auth()); settingsUi.adminMsg = { ok: true, text: r.message || 'Kết nối DeepSeek hoạt động' }; }
    else {
      settingsUi.admin = await S.api.adminSave(body, auth());
      settingsUi.adminMsg = { ok: true, text: okText };
      if ('deepseekKey' in body) { S.aiEnabled = !!settingsUi.admin.deepseekKeySet; }
      if ('googleClientId' in body) LS.setRaw('va.googleClientId', settingsUi.admin.googleClientId || '');
    }
  } catch (e0) {
    const e = toApiError(e0);
    if (e.code === 'UNAUTHORIZED') { settingsUi.adminBusy = ''; App.onUnauthorized(); return; }
    const f = (e.details && e.details.fields) || {};
    settingsUi.adminErr = f;
    settingsUi.adminMsg = Object.keys(f).length ? null : { ok: false, text: e.message };
  }
  settingsUi.adminBusy = '';
  if (S.view === 'settings') renderView({ force: true });
}
