// ══════════════════════════════════════════════════════════════════════════
//  FSMOne Community App — v2
//  Key feature: fuzzy matching of real names against FSMOne masked names
//  e.g. "Gun L**** S****" matches "Gun Lim Seng" with high confidence
// ══════════════════════════════════════════════════════════════════════════

'use strict';

// ── Storage keys ────────────────────────────────────────────────────────────
const K = {
  requests:  'fsm_requests',
  referrals: 'fsm_referrals',
  settings:  'fsm_settings',
};

// ── CRUD helpers ────────────────────────────────────────────────────────────
const load  = key => { try { return JSON.parse(localStorage.getItem(key)) || []; } catch { return []; } };
const save  = (key, data) => localStorage.setItem(key, JSON.stringify(data));

const getRequests  = () => load(K.requests);
const saveRequests = d  => save(K.requests, d);
const getReferrals = () => load(K.referrals);
const saveReferrals= d  => save(K.referrals, d);
const getSettings  = () => Object.assign(
  { waLink: '', adminPassword: 'admin123', autoApproveThreshold: 80 },
  (() => { try { return JSON.parse(localStorage.getItem(K.settings)) || {}; } catch { return {}; } })()
);
const saveSettings = d => save(K.settings, d);

// ══════════════════════════════════════════════════════════════════════════
//  FUZZY MATCHING ENGINE
//  FSMOne masks names like: "Gun L**** S****"
//  Real name example:       "Gun Lim Seng"
//  Strategy:
//   1. Split both into words
//   2. Check word count matches
//   3. For each word pair: first char must match, asterisk count must be
//      compatible with real word length
//   4. Score = weighted average of per-word confidence
// ══════════════════════════════════════════════════════════════════════════

/**
 * Parse a masked FSMOne name into an array of word descriptors.
 * e.g. "Gun L**** S****" →
 *   [ { first: 'g', minLen: 3, maxLen: 3, masked: false },   // "Gun" exact
 *     { first: 'l', minLen: 5, maxLen: 5, masked: true },    // "L****"
 *     { first: 's', minLen: 5, maxLen: 5, masked: true } ]   // "S****"
 */
function parseMasked(maskedName) {
  return maskedName.trim().split(/\s+/).map(word => {
    const lower = word.toLowerCase();
    const stars = (word.match(/\*/g) || []).length;
    const letters = word.replace(/\*/g, '').length;
    return {
      first:   lower[0],
      stars,
      letters, // non-asterisk characters
      len:     word.length,          // total length (letters + stars)
      masked:  stars > 0,
      raw:     lower,
    };
  });
}

/**
 * Score how well a real word matches a masked word descriptor.
 * Returns 0–100.
 */
function scoreWord(realWord, descriptor) {
  const r = realWord.toLowerCase();

  // First character must match
  if (r[0] !== descriptor.first) return 0;

  if (!descriptor.masked) {
    // Exact word — case-insensitive compare
    return r === descriptor.raw ? 100 : 0;
  }

  // Masked word: check total length compatibility
  // FSMOne shows first letter then masks the rest with *
  // So "L****" means a 5-letter word starting with L
  const expectedLen = descriptor.len; // first letter + stars
  if (r.length !== expectedLen) {
    // Allow ±1 tolerance for possible rendering variations
    if (Math.abs(r.length - expectedLen) > 1) return 20; // weak partial
    return 70; // close length
  }

  return 95; // first char + length match = very confident
}

/**
 * Main matching function.
 * Returns { score: 0–100, breakdown: [...] }
 */
function matchNameToMasked(realName, maskedName) {
  const realWords   = realName.trim().split(/\s+/);
  const maskedWords = parseMasked(maskedName);

  // Word count must match exactly
  if (realWords.length !== maskedWords.length) {
    // Try with word count off by 1 (some names have middle names)
    if (Math.abs(realWords.length - maskedWords.length) > 1) {
      return { score: 0, breakdown: [], reason: 'word_count_mismatch' };
    }
  }

  const pairs = Math.min(realWords.length, maskedWords.length);
  const breakdown = [];
  let totalWeight = 0;
  let weightedScore = 0;

  for (let i = 0; i < pairs; i++) {
    // First word (given name) weighted more heavily
    const weight = i === 0 ? 1.5 : 1.0;
    const s = scoreWord(realWords[i], maskedWords[i]);
    breakdown.push({ real: realWords[i], masked: maskedWords[i].raw, score: s });
    weightedScore += s * weight;
    totalWeight   += weight;
  }

  const score = Math.round(weightedScore / totalWeight);
  return { score, breakdown };
}

/**
 * Find the best matching referral for a given real name.
 * Returns { referral, score, breakdown } or null if no match above threshold.
 */
function findBestMatch(realName, referrals, minScore = 0) {
  let best = null;

  for (const ref of referrals) {
    const { score, breakdown } = matchNameToMasked(realName, ref.name);
    if (score > (best?.score ?? -1)) {
      best = { referral: ref, score, breakdown };
    }
  }

  if (!best || best.score < minScore) return null;
  return best;
}

/**
 * Get a human-readable confidence label.
 */
function confidenceLabel(score) {
  if (score >= 80) return { label: 'High confidence', color: 'success', emoji: '✅' };
  if (score >= 50) return { label: 'Partial match',   color: 'warning', emoji: '⚠️' };
  return              { label: 'No match',            color: 'danger',  emoji: '❌' };
}

// ══════════════════════════════════════════════════════════════════════════
//  SHARED UTILITIES
// ══════════════════════════════════════════════════════════════════════════

function escHtml(s) {
  return (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function timeAgo(ts) {
  if (!ts) return '—';
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60)   return 'just now';
  if (s < 3600) return Math.floor(s/60)   + 'm ago';
  if (s < 86400)return Math.floor(s/3600) + 'h ago';
  return Math.floor(s/86400) + 'd ago';
}

function showToast(msg, type = 'default') {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.className = 'toast show toast-' + type;
  setTimeout(() => el.classList.remove('show'), 3000);
}

function showAlert(id, type, msg) {
  const el = document.getElementById(id);
  if (!el) return;
  el.className = `alert alert-${type} show`;
  el.innerHTML = msg;
}

function hideAlert(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('show');
}

// ══════════════════════════════════════════════════════════════════════════
//  SIGNUP PAGE
// ══════════════════════════════════════════════════════════════════════════

function handleSubmit() {
  const name  = (document.getElementById('name')?.value  || '').trim();
  const phone = (document.getElementById('phone')?.value || '').trim();
  const email = (document.getElementById('email')?.value || '').trim();

  hideAlert('alert');

  if (!name || !phone) {
    showAlert('alert', 'error', '⚠️ Please fill in your full name and WhatsApp number.');
    return;
  }
  if (name.split(/\s+/).length < 2) {
    showAlert('alert', 'error', '⚠️ Please enter your full name (first + last name at minimum).');
    return;
  }

  const requests  = getRequests();
  const referrals = getReferrals();
  const settings  = getSettings();

  // Duplicate check
  const existing = requests.find(r =>
    r.name.toLowerCase() === name.toLowerCase() && r.status !== 'rejected'
  );
  if (existing) {
    if (existing.status === 'approved') {
      renderApproved(settings.waLink);
    } else {
      showAlert('alert', 'warning',
        '⏳ Your request is already under review. Please allow up to 24 hours.');
    }
    return;
  }

  // Run fuzzy match
  const match = findBestMatch(name, referrals, 0);
  const score = match?.score ?? 0;
  const { color, emoji } = confidenceLabel(score);

  const req = {
    id:          Date.now(),
    name, phone, email,
    status:      'pending',
    matchScore:  score,
    matchedRef:  match?.referral?.name || null,
    breakdown:   match?.breakdown || [],
    submittedAt: Date.now(),
  };

  // Auto-approve if above threshold and WA link is set
  if (score >= settings.autoApproveThreshold && settings.waLink) {
    req.status = 'approved';
    req.approvedAt = Date.now();
    req.approvalMethod = 'auto';
  }

  requests.unshift(req);
  saveRequests(requests);

  const btn = document.getElementById('submit-btn');
  if (btn) btn.disabled = true;

  if (req.status === 'approved') {
    renderApproved(settings.waLink);
  } else if (score >= 50) {
    showAlert('alert', 'warning',
      `${emoji} Your name was partially matched to our referral list (${score}% confidence). ` +
      `An admin will verify and send you the link within 24 hours.`);
  } else {
    showAlert('alert', 'info',
      `📋 Request received! Your details will be manually verified within 24 hours. ` +
      `Make sure you signed up on FSMOne using the referral code.`);
  }
}

function renderApproved(waLink) {
  const formSection = document.getElementById('form-section');
  const resultBox   = document.getElementById('result-box');
  if (formSection) formSection.style.display = 'none';
  if (resultBox)   resultBox.classList.add('show');
  const waBtn = document.getElementById('wa-join-btn');
  if (waBtn) {
    waBtn.href = waLink || '#';
    waBtn.style.display = waLink ? 'inline-flex' : 'none';
  }
  if (!waLink) {
    const desc = document.getElementById('result-desc');
    if (desc) desc.textContent = "You're verified! The admin will send you the WhatsApp invite link shortly.";
  }
}

// ══════════════════════════════════════════════════════════════════════════
//  ADMIN PAGE
// ══════════════════════════════════════════════════════════════════════════

function login() {
  const pw  = (document.getElementById('pw-input')?.value || '');
  const err = document.getElementById('pw-error');

  if (pw === getSettings().adminPassword) {
    document.getElementById('login-screen').style.display  = 'none';
    document.getElementById('admin-screen').style.display  = 'block';
    loadAdminSettings();
    updateMetrics();
    renderRequests();
    renderReferralList();
  } else {
    if (err) err.style.display = 'block';
  }
}

function loadAdminSettings() {
  const s = getSettings();
  const el = id => document.getElementById(id);
  if (el('wa-link'))     el('wa-link').value = s.waLink || '';
  if (el('auto-thresh')) el('auto-thresh').value = s.autoApproveThreshold ?? 80;
  updateThresholdLabel(s.autoApproveThreshold ?? 80);
}

function updateThresholdLabel(val) {
  const el = document.getElementById('thresh-label');
  if (el) {
    const { label } = confidenceLabel(parseInt(val));
    el.textContent = `${val}% — ${label}`;
  }
}

function saveAdminSettings() {
  const s = getSettings();
  const el = id => document.getElementById(id);
  if (el('wa-link'))     s.waLink = el('wa-link').value.trim();
  if (el('admin-pw') && el('admin-pw').value.trim()) s.adminPassword = el('admin-pw').value.trim();
  if (el('auto-thresh')) s.autoApproveThreshold = parseInt(el('auto-thresh').value);
  saveSettings(s);
  showToast('Settings saved!', 'success');
}

function updateMetrics() {
  const requests  = getRequests();
  const referrals = getReferrals();
  const set = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
  set('m-pending',   requests.filter(r => r.status === 'pending').length);
  set('m-approved',  requests.filter(r => r.status === 'approved').length);
  set('m-rejected',  requests.filter(r => r.status === 'rejected').length);
  set('m-referrals', referrals.length);
}

function renderRequests() {
  const tbody  = document.getElementById('requests-tbody');
  if (!tbody) return;

  const q      = (document.getElementById('search-inp')?.value || '').toLowerCase();
  const filter = (document.getElementById('filter-status')?.value || 'all');
  const reqs   = getRequests().filter(r => {
    const mq = !q || r.name.toLowerCase().includes(q) || (r.phone||'').includes(q) || (r.email||'').toLowerCase().includes(q);
    const mf = filter === 'all' || r.status === filter;
    return mq && mf;
  });

  if (!reqs.length) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:32px;color:var(--ink-muted);font-size:14px;">No requests found.</td></tr>`;
    return;
  }

  tbody.innerHTML = reqs.map(r => {
    const { label, color, emoji } = confidenceLabel(r.matchScore ?? 0);
    const scoreBar = r.matchScore != null
      ? `<div style="display:flex;align-items:center;gap:6px;">
           <div style="flex:1;height:4px;border-radius:2px;background:var(--border);overflow:hidden;">
             <div style="width:${r.matchScore}%;height:100%;background:${r.matchScore>=80?'#16a34a':r.matchScore>=50?'#d97706':'#dc2626'};border-radius:2px;"></div>
           </div>
           <span style="font-size:11px;color:var(--ink-muted);min-width:28px;">${r.matchScore}%</span>
         </div>
         <div style="font-size:11px;color:var(--ink-muted);margin-top:2px;">${r.matchedRef ? escHtml(r.matchedRef) : 'No match'}</div>`
      : '<span style="font-size:12px;color:var(--ink-muted);">—</span>';

    const statusBadge = {
      pending:  '<span class="badge badge-pending">Pending</span>',
      approved: `<span class="badge badge-approved">${r.approvalMethod === 'auto' ? '⚡ Auto' : '✓ Manual'}</span>`,
      rejected: '<span class="badge badge-rejected">Rejected</span>',
    }[r.status] || '';

    const actions = r.status === 'pending'
      ? `<div class="action-btns">
           <button class="btn-sm btn-approve" onclick="approveReq(${r.id})">Approve</button>
           <button class="btn-sm btn-reject"  onclick="rejectReq(${r.id})">Reject</button>
         </div>`
      : r.status === 'approved'
        ? `<button class="btn-sm btn-reject" onclick="rejectReq(${r.id})">Revoke</button>`
        : `<button class="btn-sm btn-approve" onclick="approveReq(${r.id})">Re-approve</button>`;

    return `<tr>
      <td>
        <div style="font-weight:500;font-size:14px;">${escHtml(r.name)}</div>
        <div style="font-size:11px;color:var(--ink-muted);">${escHtml(r.email)} · ${timeAgo(r.submittedAt)}</div>
      </td>
      <td style="font-size:13px;">${escHtml(r.phone)}</td>
      <td>${scoreBar}</td>
      <td>${statusBadge}</td>
      <td>${actions}</td>
    </tr>`;
  }).join('');
}

function approveReq(id) {
  const reqs = getRequests();
  const r = reqs.find(x => x.id === id);
  if (!r) return;
  r.status = 'approved';
  r.approvedAt = Date.now();
  r.approvalMethod = 'manual';
  saveRequests(reqs);
  renderRequests();
  updateMetrics();
  showToast(`✅ Approved: ${r.name}`, 'success');
}

function rejectReq(id) {
  const reqs = getRequests();
  const r = reqs.find(x => x.id === id);
  if (!r) return;
  r.status = 'rejected';
  saveRequests(reqs);
  renderRequests();
  updateMetrics();
  showToast(`Rejected: ${r.name}`);
}

// ── Referrals ─────────────────────────────────────────────────────────────

function importReferrals() {
  const raw = (document.getElementById('bulk-import')?.value || '');
  const incoming = raw.split('\n').map(n => n.trim()).filter(Boolean);
  if (!incoming.length) { showToast('No names to add.'); return; }

  const existing = getReferrals();
  const map = new Map(existing.map(r => [r.name.toLowerCase(), r]));
  let added = 0;
  incoming.forEach(name => {
    if (!map.has(name.toLowerCase())) {
      map.set(name.toLowerCase(), { name, addedAt: Date.now() });
      added++;
    }
  });
  saveReferrals([...map.values()]);
  const el = document.getElementById('bulk-import');
  if (el) el.value = '';
  renderReferralList();
  updateMetrics();
  // Re-score all pending requests
  rescorePendingRequests();
  showToast(`Added ${added} new name${added !== 1 ? 's' : ''}.`, 'success');
}

/**
 * After new referrals are added, re-run fuzzy matching on all pending requests.
 * If any now pass the threshold, auto-approve them.
 */
function rescorePendingRequests() {
  const reqs      = getRequests();
  const referrals = getReferrals();
  const settings  = getSettings();
  let changed = false;

  reqs.forEach(r => {
    if (r.status !== 'pending') return;
    const match = findBestMatch(r.name, referrals, 0);
    r.matchScore = match?.score ?? 0;
    r.matchedRef = match?.referral?.name || null;
    r.breakdown  = match?.breakdown || [];

    if (r.matchScore >= settings.autoApproveThreshold && settings.waLink) {
      r.status = 'approved';
      r.approvedAt = Date.now();
      r.approvalMethod = 'auto';
      changed = true;
    }
  });

  if (changed) {
    saveRequests(reqs);
    renderRequests();
    updateMetrics();
    showToast('Some pending requests were auto-approved after matching!', 'success');
  }
}

function renderReferralList() {
  const el    = document.getElementById('ref-list');
  if (!el) return;
  const refs  = getReferrals();
  const badge = document.getElementById('ref-badge');
  if (badge) badge.textContent = refs.length + ' names';

  if (!refs.length) {
    el.innerHTML = '<p style="font-size:13px;color:var(--ink-muted);text-align:center;padding:12px 0;">No referrals added yet.</p>';
    return;
  }

  el.innerHTML = refs.map(r => `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--border);font-size:13px;">
      <div>
        <span style="font-weight:500;">${escHtml(r.name)}</span>
        <span style="font-size:11px;color:var(--ink-muted);margin-left:8px;">${parseMasked(r.name).length} words</span>
      </div>
      <button onclick="removeReferral('${escHtml(r.name).replace(/'/g,"\\'")}'))" style="background:none;border:none;color:#9ca3af;cursor:pointer;font-size:15px;">✕</button>
    </div>
  `).join('');
}

function removeReferral(name) {
  saveReferrals(getReferrals().filter(r => r.name !== name));
  renderReferralList();
  updateMetrics();
  showToast('Removed.');
}

// ── Export ────────────────────────────────────────────────────────────────

function exportCSV() {
  const reqs = getRequests();
  if (!reqs.length) { showToast('No data to export.'); return; }
  const header = 'Name,Phone,Email,Status,Match Score,Matched Referral,Approval Method,Submitted\n';
  const rows = reqs.map(r =>
    [r.name, r.phone, r.email, r.status,
     r.matchScore ?? '', r.matchedRef ?? '',
     r.approvalMethod ?? 'manual',
     r.submittedAt ? new Date(r.submittedAt).toLocaleString() : '']
      .map(v => `"${(String(v||'')).replace(/"/g,'""')}"`)
      .join(',')
  ).join('\n');
  const blob = new Blob([header + rows], { type: 'text/csv' });
  const a = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(blob),
    download: `community-${new Date().toISOString().split('T')[0]}.csv`,
  });
  a.click();
  URL.revokeObjectURL(a.href);
  showToast('CSV exported!');
}

// ── Live match preview (on signup page) ──────────────────────────────────

function previewMatch() {
  const name = (document.getElementById('name')?.value || '').trim();
  const previewEl = document.getElementById('match-preview');
  if (!previewEl) return;
  if (!name || name.split(/\s+/).length < 2) {
    previewEl.style.display = 'none';
    return;
  }
  const referrals = getReferrals();
  if (!referrals.length) { previewEl.style.display = 'none'; return; }

  const match = findBestMatch(name, referrals, 0);
  if (!match) { previewEl.style.display = 'none'; return; }

  const { label, color } = confidenceLabel(match.score);
  previewEl.style.display = 'block';
  previewEl.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;font-size:13px;">
      <span>Closest referral: <strong>${escHtml(match.referral.name)}</strong></span>
      <span class="badge badge-${color === 'success' ? 'matched' : color === 'warning' ? 'partial' : 'none'}">${label} · ${match.score}%</span>
    </div>
    <div style="margin-top:6px;height:4px;border-radius:2px;background:#e5e7eb;overflow:hidden;">
      <div style="width:${match.score}%;height:100%;border-radius:2px;background:${match.score>=80?'#16a34a':match.score>=50?'#d97706':'#dc2626'};transition:width 0.3s;"></div>
    </div>`;
}
