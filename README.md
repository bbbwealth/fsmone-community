# FSMOne WhatsApp Community App

A lightweight, zero-backend signup app for your WhatsApp investment community. Members verify their FSMOne referral before getting the invite link.

**Live demo:** After deploying, your URL will be `https://YOUR-USERNAME.github.io/fsmone-community/`

---

## Files

```
fsmone-community/
├── index.html    — Public signup page (share this link)
├── admin.html    — Admin dashboard (you only)
├── app.js        — All shared logic (localStorage)
└── README.md
```

---

## Deploy to GitHub Pages (5 minutes)

### Step 1 — Create a GitHub account
Go to [github.com](https://github.com) and sign up if you don't have an account.

### Step 2 — Create a new repository
1. Click the **+** icon → **New repository**
2. Name it: `fsmone-community`
3. Set to **Public**
4. Click **Create repository**

### Step 3 — Upload the files
1. On the repository page, click **"uploading an existing file"**
2. Drag and drop all 4 files: `index.html`, `admin.html`, `app.js`, `README.md`
3. Click **Commit changes**

### Step 4 — Enable GitHub Pages
1. Go to your repo → **Settings** → **Pages** (left sidebar)
2. Under **Source**, select **Deploy from a branch**
3. Branch: **main**, folder: **/ (root)**
4. Click **Save**

### Step 5 — Your app is live!
Wait ~2 minutes, then visit:
```
https://YOUR-USERNAME.github.io/fsmone-community/
```

**Share this link** with people who signed up using your referral code.

**Admin dashboard:**
```
https://YOUR-USERNAME.github.io/fsmone-community/admin.html
```
Default password: `admin123` — change it in the Settings panel.

---

## How It Works

1. **Someone signs up** on FSMOne using your referral code
2. You see their name in your FSMOne referral report
3. **You paste their name** into Admin → FSMOne Referrals panel
   (or use the Chrome extension to sync automatically)
4. **They visit your signup page** and submit their name + phone
5. The app checks if their name matches your referral list
6. If matched → they get the WhatsApp invite link instantly
7. If unmatched → you review and approve/reject manually

---

## Chrome Extension Integration

After syncing names with the Chrome extension:
1. Open the extension popup → **Referrals tab**
2. Click **"Copy Names"**
3. Paste into Admin → FSMOne Referrals → **Add names**

---

## Customisation

### Change admin password
Login → Settings → enter new password → Save

### Change WhatsApp link
Login → Settings → paste your WhatsApp community invite link → Save

### Change your name / branding
Edit `index.html` — look for the `<h1>` and `<p>` in the `.brand` section.

---

## Data Storage

Data is stored in **localStorage** — meaning it lives in your browser only.

For multi-device access (e.g., checking admin on your phone), consider:
- **Option A:** Always use the same device/browser for admin
- **Option B:** Upgrade to a backend (Firebase/Supabase free tier) — ask Claude to help

---

## Security Note

This is a simple static app — anyone who knows the admin URL can try to guess your password. For better security, change the default password immediately after deploying.
