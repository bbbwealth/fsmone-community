# FSMOne Community App v2 — Masked Name Matching

## What's new in v2

**Fuzzy name matching engine** — handles FSMOne's masked name format automatically.

FSMOne masks referral names like this:
```
Gun L**** S****     →  matches "Gun Lim Seng"      ✅ 95%
Ang C*** H**        →  matches "Ang Chai Huat"      ✅ 92%
Leong K** F***      →  matches "Leong Kai Feng"     ✅ 91%
```

How the matching works:
1. Split both names into words
2. Word count must match (first name, last name, etc.)
3. First letter of each word must match
4. Word length (including masked asterisks) must match real name length
5. Score = weighted average (first word counts 1.5x)

**Three outcomes:**
- **≥80% match** → Auto-approved instantly, WA link shown
- **50–79% match** → Flagged for admin review (partial match)
- **<50% match** → Manual review required

---

## Deploy to GitHub Pages

### Step 1 — Create repo
1. Go to [github.com](https://github.com) → **+** → New repository
2. Name: `fsmone-community` → Public → Create

### Step 2 — Upload files
1. On the repo page → "uploading an existing file"
2. Upload all 4 files: `index.html`, `admin.html`, `app.js`, `README.md`
3. Commit changes

### Step 3 — Enable Pages
1. Repo → **Settings** → **Pages**
2. Source: Deploy from branch → main → /(root) → Save

### Step 4 — Live!
```
Public signup:  https://YOUR-USERNAME.github.io/fsmone-community/
Admin dashboard: https://YOUR-USERNAME.github.io/fsmone-community/admin.html
```

---

## How to use

### Adding referral names
1. Log into FSMOne → Referral Rewards → "View Details"
2. Copy the masked names (e.g. `Gun L**** S****`) exactly as shown
3. Go to admin.html → Paste into "FSMOne referrals" → Add names
4. The app will fuzzy-match future signups automatically

### Or use the Chrome extension
The Chrome extension syncs masked names directly from FSMOne:
1. Navigate to your FSMOne referral page
2. Click "Sync Now" on the banner
3. In the extension → Copy Names → paste into admin

### Setting the auto-approve threshold
- 80% (default): safe, high confidence matches only
- 70%: slightly more permissive
- 90%: stricter, more manual reviews

### Testing matches
Admin dashboard → Settings → "Test name matching"  
Type a real name to see how it scores against your referral list.

---

## Files

```
fsmone-community/
├── index.html   — Public signup page
├── admin.html   — Admin dashboard
├── app.js       — Matching engine + all logic
└── README.md
```

---

## Limitations of static (GitHub Pages) version

Data is stored in **localStorage** — only accessible from the same browser.

For multi-device access or team management, upgrade to:
- **Supabase** (free tier) — real database, accessible anywhere
- **Firebase** — easy realtime database

Ask Claude to help build the backend upgrade when ready.
