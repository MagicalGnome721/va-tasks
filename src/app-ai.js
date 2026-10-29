// ============================================================================
// Trợ lý AI (DeepSeek) — kế hoạch & phân việc, hỏi đáp, báo cáo tuần. VA + quản trị viên.
// AI chỉ đề xuất; VA chọn dòng nào áp dụng (đổi người làm qua runUpdate như thao tác tay).
// ============================================================================
const AI_TABS = [['plan', 'Kế hoạch & phân việc'], ['ask', 'Hỏi đáp'], ['weekly', 'Báo cáo tuần']];
const AI_SUGGEST = ['Tuần này team nên làm gì trước?', 'Đơn nào có nguy cơ trễ hạn?', 'Ai đang quá tải, nên chuyển bớt đơn nào?', 'Đơn nào chưa chấm cỡ cần xem trước?'];
const AiUi = { tab: 'plan', busy: false, error: '', plan: null, weekly: null, thread: [], picks: {}, draft: '' };

const RISK_LABEL = { high: 'Cao', medium: 'Vừa', low: 'Thấp' };

// Plain AI text → safe HTML: paragraphs, "- " bullet lists, task IDs become links.
function aiTextHtml(text) {
  const lines = String(text || '').split(/\r?\n/);
  const out = []; let list = [];
  const flush = () => { if (list.length) { out.push('<ul>' + list.map((l) => `<li>${l}</li>`).join('') + '</ul>'); list = []; } };
  const inline = (s) => esc(s).replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/\b(AI-\d{3,})\b/g, (m) => (getTask(m) ? `<button type="button" class="id-link" data-open="${m}">${m}</button>` : m));
  lines.forEach((raw) => {
    const l = raw.trim();
    if (!l) { flush(); return; }
    const m = /^[-*•]\s+(.*)$/.exec(l);
    if (m) { list.push(inline(m[1])); return; }
    flush();
    if (/^#{1,4}\s+/.test(l) || (/:$/.test(l) && l.length < 60) || (l.length < 48 && !/[.!?…]$/.test(l) && lines.length > 3)) out.push(`<h3>${inline(l.replace(/^#{1,4}\s+/, '').replace(/:$/, ''))}</h3>`);
    else out.push(`<p>${inline(l)}</p>`);
  });
  flush();
  return out.join('');
}
function aiRisksHtml(risks) {
  if (!risks || !risks.length) return '';
  return `<div class="ai-risks"><h3>Cần chú ý</h3><ul>${risks.map((r) => `<li data-level="${esc(r.level)}"><span class="risk-lv">${esc(RISK_LABEL[r.level] || r.level)}</span><span>${r.id ? `<button type="button" class="id-link" data-open="${esc(r.id)}">${esc(r.id)}</button> ` : ''}${esc(r.text)}</span></li>`).join('')}</ul></div>`;
}
function aiMetaHtml(r) {
  const at = r && r.generatedAt ? new Date(r.generatedAt) : null;
  return at && !isNaN(at) ? `<p class="ai-meta">Tạo lúc ${esc(hhmm(at))} · ${S.mode === 'demo' ? 'Demo mô phỏng, không gọi DeepSeek' : 'DeepSeek'} · AI có thể sai, hãy kiểm tra trước khi áp dụng</p>` : '';
}
function planRowsHtml(plan) {
  if (!plan || !plan.plan.length) return '<p class="sec-empty">AI không đề xuất thay đổi nào.</p>';
  return `<div class="table-wrap"><table class="plan-table" data-testid="ai-plan-table">
    <thead><tr><th class="c" scope="col"><span class="sr-only">Chọn</span></th><th scope="col">#</th><th scope="col">Đơn</th><th scope="col">Người làm</th><th scope="col">Dự kiến xong</th><th scope="col">Lý do</th></tr></thead>
    <tbody>${plan.plan.map((p) => {
      const t = getTask(p.id);
      const changes = !!t && !!p.assignee && !sameName(p.assignee, t.assignee) && can('edit', t, { assignee: p.assignee }).ok && colKey(t) === 'new';
      const late = t && trim(t.deadline) && p.eta && p.eta > t.deadline;
      return `<tr data-testid="ai-plan-row-${esc(p.id)}">
        <td class="c">${changes ? `<input type="checkbox" data-ai-pick="${esc(p.id)}" ${AiUi.picks[p.id] !== false ? 'checked' : ''} aria-label="Áp dụng: giao ${esc(p.id)} cho ${esc(p.assignee)}">` : ''}</td>
        <td class="num">${esc(p.order)}</td>
        <td class="td-name"><button type="button" class="id-link" data-open="${esc(p.id)}">${esc(p.id)}</button> <span class="nm">${esc(p.name || (t && t.name) || '')}</span></td>
        <td>${changes ? `<span class="muted">${trim(t.assignee) ? esc(t.assignee) : 'chưa ai'} →</span> <b>${esc(p.assignee)}</b>` : esc(p.assignee || (t && t.assignee) || '—')}</td>
        <td class="num ${late ? 'is-late' : ''}">${p.eta ? esc(fmtDM(p.eta)) : '—'}${late ? ' <span class="late-tag">sau hạn</span>' : ''}</td>
        <td class="reason">${esc(p.reason)}</td></tr>`;
    }).join('')}</tbody></table></div>`;
}
function aiPickable() {
  const plan = AiUi.plan;
  if (!plan) return [];
  return plan.plan.filter((p) => {
    const t = getTask(p.id);
    return t && p.assignee && !sameName(p.assignee, t.assignee) && colKey(t) === 'new' && can('edit', t, { assignee: p.assignee }).ok && AiUi.picks[p.id] !== false;
  });
}
function renderAi(view) {
  const on = S.aiEnabled !== false;
  const tab = AiUi.tab;
  const tabs = `<div class="seg-tabs" role="tablist" aria-label="Chế độ trợ lý">${AI_TABS.map(([k, l]) => `<button type="button" role="tab" class="seg-tab" data-ai-tab="${k}" data-testid="ai-tab-${k}" aria-selected="${tab === k}">${esc(l)}</button>`).join('')}</div>`;
  let body = '';
  if (!on) {
    body = `<div class="callout" data-testid="ai-off"><b>AI chưa được bật.</b> ${S.user && S.user.isOwner ? 'Dán API key DeepSeek ở <a href="#/settings/admin">Cài đặt › Quản trị</a> để bật.' : 'Nhờ quản trị viên dán API key DeepSeek trong Cài đặt › Quản trị.'}</div>`;
  } else if (tab === 'plan') {
    const p = AiUi.plan; const n = aiPickable().length;
    body = `<div class="ai-intro"><p>AI xem các đơn <b>Mới</b>, <b>Đang làm</b>, <b>Cần sửa</b> và đề xuất ai làm đơn nào, thứ tự làm, ngày dự kiến xong — cân tải giữa ${esc(Rules.vaNamesOf(S.config, null).join(', ') || 'các VA')}.</p>
      <button type="button" class="btn btn-primary" data-ai-run="plan" data-testid="ai-run-plan" ${AiUi.busy ? 'disabled' : ''}>${AiUi.busy ? '<span class="saving-spin" aria-hidden="true"></span>AI đang lập kế hoạch…' : (p ? 'Lập lại kế hoạch' : 'Lập kế hoạch')}</button></div>
      ${p ? `<div class="ai-result" data-testid="ai-result">${aiTextHtml(p.answer)}${aiRisksHtml(p.risks)}
        <div class="sec-head"><h2 class="sec-title">Đề xuất phân việc <span class="count-pill">${p.plan.length}</span></h2></div>
        ${planRowsHtml(p)}
        <div class="ai-apply">${n ? `<button type="button" class="btn btn-primary" data-ai-apply data-testid="ai-apply" data-write>Áp dụng ${n} thay đổi người làm</button><span class="muted">Chỉ đổi người làm của đơn còn ở trạng thái Mới. Thứ tự hàng đợi vẫn theo ưu tiên & hạn.</span>` : '<span class="muted">Không có thay đổi người làm nào cần áp dụng.</span>'}</div>
        ${aiMetaHtml(p)}</div>` : ''}`;
  } else if (tab === 'ask') {
    body = `<div class="ai-thread" data-testid="ai-thread">${AiUi.thread.length ? AiUi.thread.map((m) => m.role === 'user' ? `<div class="msg is-user"><p>${esc(m.text)}</p></div>` : `<div class="msg is-ai"><span class="msg-ava" aria-hidden="true">${ICONS.spark}</span><div class="msg-body">${aiTextHtml(m.r.answer)}${aiRisksHtml(m.r.risks)}${m.r.plan && m.r.plan.length ? `<p class="muted">AI có đề xuất phân việc — mở tab <button type="button" class="linklike" data-ai-tab="plan">Kế hoạch</button> để áp dụng.</p>` : ''}</div></div>`).join('') : `<div class="ai-suggest"><p class="muted">Gợi ý câu hỏi:</p>${AI_SUGGEST.map((q) => `<button type="button" class="chip" data-ai-suggest="${esc(q)}">${esc(q)}</button>`).join('')}</div>`}
      ${AiUi.busy ? '<div class="msg is-ai"><span class="msg-ava" aria-hidden="true">' + ICONS.spark + '</span><div class="msg-body"><span class="saving-spin" aria-hidden="true"></span> Đang suy nghĩ…</div></div>' : ''}</div>
      <form class="ai-ask" data-ai-form novalidate><label for="ai-q" class="sr-only">Câu hỏi cho trợ lý</label>
        <textarea id="ai-q" data-testid="ai-question" rows="2" maxlength="${esc(Rules.ASSIST_MAX_QUESTION || 1000)}" placeholder="Hỏi về hàng đợi, hạn, tải việc… (Ctrl+Enter để gửi)" ${AiUi.busy ? 'disabled' : ''}>${esc(AiUi.draft)}</textarea>
        <button type="submit" class="btn btn-primary" data-testid="ai-send" ${AiUi.busy ? 'disabled' : ''}>Hỏi</button></form>`;
  } else {
    const w = AiUi.weekly;
    body = `<div class="ai-intro"><p>Tóm tắt 7 ngày qua: đã xong, đang làm, tải từng VA, đơn trễ và đề xuất tuần tới. Báo cáo cũng tự gửi email cho team VA mỗi sáng thứ Hai.</p>
      <div class="ai-intro-actions"><button type="button" class="btn btn-primary" data-ai-run="weekly" data-testid="ai-run-weekly" ${AiUi.busy ? 'disabled' : ''}>${AiUi.busy ? '<span class="saving-spin" aria-hidden="true"></span>AI đang viết báo cáo…' : (w ? 'Viết lại báo cáo' : 'Viết báo cáo tuần')}</button>
      ${w ? '<button type="button" class="btn" data-ai-copy>' + ICONS.copy + 'Sao chép</button>' : ''}</div></div>
      ${w ? `<article class="ai-result ai-report" data-testid="ai-result">${aiTextHtml(w.answer)}${aiRisksHtml(w.risks)}${aiMetaHtml(w)}</article>` : ''}`;
  }
  view.innerHTML = `<div class="view-head"><div><h1 class="view-title">Trợ lý AI</h1><p class="view-sub">AI chỉ đọc mã đơn, tên đơn, trạng thái, độ nặng, hạn — không gửi email hay tên người order.</p></div></div>
    ${tabs}
    ${AiUi.error ? `<div class="callout is-error" role="alert" data-testid="ai-error">${esc(AiUi.error)}</div>` : ''}
    <div class="ai-pane">${body}</div>`;
}
async function aiRun(mode, question) {
  if (AiUi.busy || !guardOnline()) return;
  AiUi.busy = true; AiUi.error = '';
  if (mode === 'ask') { AiUi.thread.push({ role: 'user', text: question }); AiUi.draft = ''; }
  renderView({ force: true });
  try {
    const r = await S.api.aiAssist({ mode, question: question || '' }, auth());
    if (mode === 'plan') { AiUi.plan = r; AiUi.picks = {}; }
    else if (mode === 'weekly') AiUi.weekly = r;
    else AiUi.thread.push({ role: 'ai', r });
  } catch (e0) {
    const e = toApiError(e0);
    if (e.code === 'UNAUTHORIZED') { AiUi.busy = false; App.onUnauthorized(); return; }
    if (mode === 'ask') { const last = AiUi.thread.pop(); AiUi.draft = last ? last.text : ''; }
    AiUi.error = e.message || 'AI tạm thời không khả dụng';
  }
  AiUi.busy = false;
  if (S.view === 'ai') {
    renderView({ force: true });
    const f = mode === 'ask' ? $('#ai-q') : $('[data-testid="ai-result"]');
    if (f && mode === 'ask') f.focus();
  }
}
async function aiApplyPlan() {
  const rows = aiPickable();
  if (!rows.length || !guardOnline()) return;
  const ok = await confirmDialog({ title: `Áp dụng ${rows.length} thay đổi người làm?`, desc: rows.map((p) => `${p.id} → ${p.assignee}`).join(' · '), confirmText: 'Áp dụng', cancelText: 'Để sau' });
  if (!ok) return;
  let done = 0;
  for (const p of rows) {
    const t = getTask(p.id); if (!t) continue;
    const r = await runUpdate(t.id, { assignee: p.assignee }, { assignee: t.assignee }, {}, { noUndo: true });
    if (r) done++;
  }
  toast(done === rows.length ? `Đã giao ${done} đơn theo kế hoạch AI` : `Đã giao ${done}/${rows.length} đơn — xem lỗi phía trên`, { type: done === rows.length ? undefined : 'error' });
  if (S.view === 'ai') renderView({ force: true });
}
function onAiClick(e) {
  const t = e.target;
  const tb = t.closest('[data-ai-tab]'); if (tb) { AiUi.tab = tb.dataset.aiTab; AiUi.error = ''; renderView({ force: true }); const nb = $(`[data-ai-tab="${AiUi.tab}"].seg-tab`); if (nb) nb.focus(); return true; }
  const run = t.closest('[data-ai-run]'); if (run) { aiRun(run.dataset.aiRun); return true; }
  const sg = t.closest('[data-ai-suggest]'); if (sg) { aiRun('ask', sg.dataset.aiSuggest); return true; }
  if (t.closest('[data-ai-apply]')) { aiApplyPlan(); return true; }
  if (t.closest('[data-ai-copy]')) {
    const txt = AiUi.weekly ? AiUi.weekly.answer : '';
    (navigator.clipboard && navigator.clipboard.writeText ? navigator.clipboard.writeText(txt) : Promise.reject()).then(() => toast('Đã sao chép báo cáo'), () => { fallbackCopy(txt); toast('Đã sao chép báo cáo'); });
    return true;
  }
  return false;
}
function onAiChange(e) {
  const p = e.target.closest('[data-ai-pick]');
  if (p) { AiUi.picks[p.dataset.aiPick] = p.checked; const n = aiPickable().length; const b = $('[data-ai-apply]'); if (b) { b.textContent = `Áp dụng ${n} thay đổi người làm`; b.disabled = !n; } return true; }
  return false;
}
function bindAiForm(view) {
  view.addEventListener('submit', (e) => {
    if (!e.target.matches('[data-ai-form]')) return;
    e.preventDefault();
    const q = trim($('#ai-q').value);
    if (q.length < 3) { AiUi.error = 'Hãy nhập câu hỏi (ít nhất 3 ký tự)'; renderView({ force: true }); $('#ai-q').focus(); return; }
    aiRun('ask', q);
  });
  view.addEventListener('input', (e) => { if (e.target.id === 'ai-q') AiUi.draft = e.target.value; });
  view.addEventListener('keydown', (e) => {
    if (e.target.id === 'ai-q' && e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); e.target.form.requestSubmit(); }
  });
}
