// ── FSMOne Community App — Shared Logic ──────────────────────────────────
// Uses localStorage so data persists across sessions (same browser/device)
// For a real multi-device setup, replace localStorage with a backend API

'use strict';

// ══════════════════════════════════════════════════════
//  DATA LAYER  (localStorage)
// ══════════════════════════════════════════════════════

const KEYS = {
  requests: 'fsm_requests',
  referrals: 'fsm_referrals',
  settings: 'fsm_settings',
};

function getRequests() {
  try { return JSON.parse(localStorage.getItem(KEYS.requests)) || []; }
  catch { return []; }
}

function saveRequests(data) {
  localStorage.setItem(KEYS.requests, JSON.stringify(data));
}

function getReferrals() {
  try { return JSON.parse(localStorage.getItem(KEYS.referrals)) || []; }
  catch { return []; }
}

function saveReferrals(data) {
  localStorage.setItem(KEYS.referrals, JSON.stringify(data));
}

function getSettings() {
  const defaults = { waLink: '', adminPassword: 'admin123' };
  try { return Object.assign({}, defaults, JSON.parse(localStorage.getItem(KEYS.settings))); }
  catch { return defaults; }
}

function saveSettings() {
  const s = getSettings();
  const waEl = document.getElementById('wa-link');
  const pwEl = document.getElementById('admin-pw');
  if (waEl) s.waLink = waEl.value.trim();
  if (pwEl && pwEl.value.trim()) s.adminPassword = pwEl.value.trim();
  localStorage.setItem(KEYS.settings, JSON.stringify(s));
}

// ══════════════════════════════════════════════════════
//  HELPERS
// ══════════════════════════════════════════════════════

function normName(n) {
  return (n || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function escHtml(s) {
  return (s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function timeAgo(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return Math.floor(s / 60) + 'm ago';
  if (s < 86400) return Math.floor(s / 3600) + 'h ago';
  return Math.floor(s / 86400) + 'd ago';
}

function showToast(msg) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2800);
}

function showAlert(type, msg) {
  const el = document.getElementById('alert');
  if (!el) return;
  el.className = `alert alert-${type} show`;
  el.innerHTML = msg;
}

// ══════════════════════════════════════════════════════
//  SIGNUP PAGE LOGIC
// ══════════════════════════════════════════════════════

function handleSubmit() {
  const name  = (document.getElementById('name')?.value || '').trim();
  const phone = (document.getElementById('phone')?.value || '').trim();
  const email = (document.getElementById('email')?.value || '').trim();

  if (!name || !phone) {
    showAlert('error', 'Please fill in your full name and WhatsApp number.');
    return;
  }

  const requests = getRequests();
  const referrals = getReferrals();
  const settings = getSettings();

  // Check duplicate
  const existing = requests.find(r =>
    normName(r.name) === normName(name) && r.status !== 'rejected'
  );
  if (existing) {
    if (existing.status === 'approved') {
      showApprovedResult(settings.waLink);
    } else {
      showAlert('warning', 'Your request is already pending review. Please allow up to 24 hours.');
    }
    return;
  }

  // Check referral match
  const matched = referrals.some(r => normName(r.name) === normName(name));

  const req = {
    id: Date.now(),
    name, phone, email,
    status: 'pending',
    matched,
    submittedAt: Date.now(),
  };
  requests.unshift(req);
  saveRequests(requests);

  // If auto-approve when matched and WA link is set
  if (matched && settings.waLink) {
    req.status = 'approved';
    saveRequests(requests);
    showApprovedResult(settings.waLink);
  } else if (matched) {
    showAlert('success', '✅ Your name was found in our referral list! We\'ll send you the WhatsApp link shortly.');
    document.getElementById('submit-btn').disabled = true;
  } else {
    showAlert('warning', '⏳ Request submitted. Your details will be manually verified within 24 hours.');
    document.getElementById('submit-btn').disabled = true;
  }
}

function showApprovedResult(waLink) {
  document.getElementById('form-section').style.display = 'none';
  const box = document.getElementById('result-box');
  box.classList.add('show');
  const btn = document.getElementById('wa-join-btn');
  if (waLink) {
    btn.href = waLink;
    btn.style.display = 'inline-flex';
  } else {
    btn.style.display = 'none';
    document.getElementById('result-desc').textContent =
      'You\'re verified! The admin will send you the WhatsApp invite link shortly.';
  }
}

// ══════════════════════════════════════════════════════
//  ADMIN PAGE LOGIC
// ══════════════════════════════════════════════════════

const ADMIN_PW = () => getSettings().adminPassword;

function login() {
  const pw = document.getElementById('pw-input')?.value || '';
  if (pw === ADMIN_PW()) {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('admin-screen').style.display = 'block';
    updateMetrics();
    renderRequests();
    renderReferralList();
  } else {
    const err = document.getElementById('pw-error');
    if (err) err.style.display = 'block';
  }
}

function updateMetrics() {
  const requests = getRequests();
  const referrals = getReferrals();
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  set('m-pending',   requests.filter(r => r.status === 'pending').length);
  set('m-approved',  requests.filter(r => r.status === 'approved').length);
  set('m-rejected',  requests.filter(r => r.status === 'rejected').length);
  set('m-referrals', referrals.length);
}

function renderRequests() {
  const tbody = document.getElementById('requests-tbody');
  if (!tbody) return;

  const q       = (document.getElementById('search-inp')?.value || '').toLowerCase();
  const filter  = document.getElementById('filter-status')?.value || 'all';
  const requests = getRequests();

  let filtered = requests.filter(r => {
    const matchQ = !q ||
      (r.name || '').toLowerCase().includes(q) ||
      (r.phone || '').includes(q) ||
      (r.email || '').toLowerCase().includes(q);
    const matchF = filter === 'all' || r.status === filter;
    return matchQ && matchF;
  });

  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="5" class="empty-row">No requests found.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(r => {
    const matchBadge = r.matched
      ? '<span class="badge badge-matched">matched</span>'
      : '<span class="badge badge-unmatched">unmatched</span>';
    const statusBadge = {
      pending:  '<span class="badge badge-pending">Pending</span>',
      approved: '<span class="badge badge-approved">Approved</span>',
      rejected: '<span class="badge badge-rejected">Rejected</span>',
    }[r.status] || '';
    const actions = r.status === 'pending'
      ? `<div class="action-btns">
           <button class="btn-sm btn-approve" onclick="approveReq(${r.id})">Approve</button>
           <button class="btn-sm btn-reject" onclick="rejectReq(${r.id})">Reject</button>
         </div>`
      : r.status === 'approved'
        ? `<button class="btn-sm btn-reject" onclick="rejectReq(${r.id})">Revoke</button>`
        : `<button class="btn-sm btn-approve" onclick="approveReq(${r.id})">Re-approve</button>`;

    return `<tr>
      <td>
        <div class="name-cell">${escHtml(r.name)}</div>
        <div class="meta-cell">${escHtml(r.email)} · ${timeAgo(r.submittedAt)}</div>
      </td>
      <td>${escHtml(r.phone)}</td>
      <td>${matchBadge}</td>
      <td>${statusBadge}</td>
      <td>${actions}</td>
    </tr>`;
  }).join('');
}

function approveReq(id) {
  const requests = getRequests();
  const r = requests.find(x => x.id === id);
  if (!r) return;
  r.status = 'approved';
  saveRequests(requests);
  renderRequests();
  updateMetrics();
  showToast(`Approved: ${r.name}`);
}

function rejectReq(id) {
  const requests = getRequests();
  const r = requests.find(x => x.id === id);
  if (!r) return;
  r.status = 'rejected';
  saveRequests(requests);
  renderRequests();
  updateMetrics();
  showToast(`Rejected: ${r.name}`);
}

// ── Referrals ──────────────────────────────────────────

function importReferrals() {
  const raw = (document.getElementById('bulk-import')?.value || '');
  const incoming = raw.split('\n').map(n => n.trim()).filter(Boolean);
  if (!incoming.length) { showToast('No names to add.'); return; }

  const existing = getReferrals();
  const map = new Map(existing.map(r => [normName(r.name), r]));
  let added = 0;
  incoming.forEach(name => {
    if (!map.has(normName(name))) {
      map.set(normName(name), { name, addedAt: Date.now() });
      added++;
    }
  });
  const merged = [...map.values()];
  saveReferrals(merged);

  document.getElementById('bulk-import').value = '';
  renderReferralList();
  updateMetrics();
  showToast(`Added ${added} new name${added !== 1 ? 's' : ''}.`);
}

function renderReferralList() {
  const el = document.getElementById('ref-list');
  if (!el) return;
  const referrals = getReferrals();
  const badge = document.getElementById('ref-badge');
  if (badge) badge.textContent = referrals.length + ' names';

  if (!referrals.length) {
    el.innerHTML = '<p style="font-size:13px;color:var(--ink-muted);text-align:center;padding:12px 0;">No names added yet.</p>';
    return;
  }
  el.innerHTML = referrals.map(r => `
    <div class="ref-row">
      <span style="font-size:13px;font-weight:500;">${escHtml(r.name)}</span>
      <button class="ref-remove" onclick="removeReferral('${escHtml(r.name).replace(/'/g,"\\'")}')">✕</button>
    </div>
  `).join('');
}

function removeReferral(name) {
  const updated = getReferrals().filter(r => r.name !== name);
  saveReferrals(updated);
  renderReferralList();
  updateMetrics();
  showToast('Removed.');
}

// ── Export ─────────────────────────────────────────────

function exportCSV() {
  const requests = getRequests();
  if (!requests.length) { showToast('No data to export.'); return; }
  const header = 'Name,Phone,Email,Status,Matched,Submitted\n';
  const rows = requests.map(r =>
    [r.name, r.phone, r.email, r.status, r.matched ? 'Yes' : 'No', new Date(r.submittedAt).toLocaleString()]
      .map(v => `"${(v || '').replace(/"/g, '""')}"`)
      .join(',')
  ).join('\n');
  const blob = new Blob([header + rows], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `community-requests-${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('CSV exported!');
}

// ── Webhook receiver (for Chrome extension sync) ───────
// Add this endpoint to receive data from the extension:
// POST to your app URL with { referrals: [...] }
// Since this is a static GitHub Pages site, the extension
// should sync directly via the extension's storage,
// and you paste the names manually into the admin panel.
// For full automation, deploy a backend (see README).
