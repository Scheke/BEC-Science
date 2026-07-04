# BEC Admin Panel — Developer Guide

This admin panel runs **localhost only**. It is never deployed to the live site.

---

## Quick Start

### 1. Start the Admin Panel

```
cd admin
npm install        # first time only
npm run dev
```

Opens automatically at **http://localhost:5175**

Sign in with the admin Google account (`schekes23@gmail.com`) using email + password.

---

### 2. Start the Main App (for testing alongside admin)

The main app (`index.html`) has no build step — open it directly:

```
# Option A: VS Code Live Server
Right-click index.html → Open with Live Server
# Opens at http://127.0.0.1:5500 or similar

# Option B: Python simple server (from project root)
python -m http.server 8000
# Opens at http://localhost:8000

# Option C: npx serve (from project root)
npx serve .
# Opens at http://localhost:3000
```

> The main app and admin panel run as two separate servers at the same time. You can have both open at once.

---

## Project Layout

```
BEC Animations/
├── index.html          ← Main app (no build, served as-is)
├── firebase-config.js  ← Shared Firebase credentials
├── firestore.rules     ← Firestore security rules
├── firestore.indexes.json
├── firebase.json       ← Hosting config (admin/ excluded)
└── admin/
    ├── index.html      ← Admin SPA entry point
    ├── main.js         ← All admin logic (ES modules)
    ├── vite.config.js  ← Dev server config (port 5175, host: localhost)
    ├── package.json
    └── dist-admin/     ← Build output (gitignored, never deployed)
```

---

## Firebase CLI Commands

Run these from the **project root** (not inside `admin/`):

| Command | What it does |
|---|---|
| `firebase deploy --only firestore:rules` | Deploy updated Firestore security rules |
| `firebase deploy --only firestore:indexes` | Deploy updated indexes |
| `firebase deploy --only hosting` | Deploy main app to live site |
| `firebase deploy` | Deploy everything at once |
| `firebase emulators:start` | Run Firestore/Auth locally (optional) |

---

## Common Problems & Fixes

---

### Admin page loads forever / stuck on splash

**Cause A — Wrong hostname**

Firebase Auth only whitelists `localhost`, not `127.0.0.1`. If the browser
opens at `127.0.0.1:5175`, auth will time out.

Fix: make sure `vite.config.js` has `host: 'localhost'` (not `'127.0.0.1'`).
Then restart with `npm run dev` and confirm the URL is `http://localhost:5175`.

**Cause B — localhost not in Firebase Authorized Domains**

1. Go to [Firebase Console](https://console.firebase.google.com) → your project
2. Authentication → Settings → Authorized domains
3. Add `localhost` if it's missing

**Cause C — Firebase npm package not installed**

```
cd admin
npm install
```

**Cause D — Port 5175 already in use**

```
# Windows — find what's using the port
netstat -ano | findstr :5175

# Kill it (replace PID with the number from above)
taskkill /PID <PID> /F

# Then restart
npm run dev
```

---

### "Invalid email or password" on sign-in

**Cause A — Email/Password provider not enabled**

1. Firebase Console → Authentication → Sign-in method
2. Enable **Email/Password** provider
3. Create a user for `schekes23@gmail.com` under Authentication → Users
   (or use "Reset password" to set one)

**Cause B — Typo in email or password**

The login box uses `autocomplete="off"` — autofill is disabled on purpose.
Type both fields manually.

**Cause C — Wrong account**

Only `schekes23@gmail.com` is allowed. Any other account is rejected immediately after sign-in (Firestore rules enforce this server-side too).

---

### "Failed to load leaderboard" in main app

**Cause — Firestore indexes not deployed**

The leaderboard queries `primaryVisited`, `juniorVisited`, `seniorVisited` in descending order. These indexes must exist.

```
firebase deploy --only firestore:indexes
```

Wait ~2 minutes for indexes to build, then reload.

---

### Grant/Revoke premium button gives a Firestore permission error

**Cause — Firestore rules not deployed yet, or admin email mismatch**

1. Make sure the signed-in account is exactly `schekes23@gmail.com`
2. Deploy the latest rules:
   ```
   firebase deploy --only firestore:rules
   ```
3. Check the rules file — `isAdmin()` must match the email exactly (no trailing space).

---

### Users table shows no users / empty

**Cause A — No users have signed in yet**

The admin reads the `users` Firestore collection. Users appear only after they sign in to the main app at least once.

**Cause B — Firestore rules blocking admin reads**

Deploy the rules:
```
firebase deploy --only firestore:rules
```

**Cause C — Network / offline**

Check DevTools → Network tab. If Firestore requests show `net::ERR_*` errors, you are offline or the Firebase project is down.

---

### Admin builds fine but grant/revoke does nothing

Check the browser console (F12) for a Firestore error. The two most common:

- `PERMISSION_DENIED` → rules not deployed or you're not signed in as the admin account
- `NOT_FOUND` → the `entitlements` collection doesn't exist yet (it's created on first grant — this is normal; the first grant creates it)

---

### Main app leaderboard shows old/wrong data

The leaderboard is synced once per sign-in from the user's `users/{uid}` doc.
If a user earned XP after their last sign-in, their leaderboard entry is stale.

Force a re-sync: have the user sign out and sign back in, or clear their browser's Firebase Auth state.

---

### HMR (hot reload) breaks Firebase — "app already exists" error

Vite's hot reload can call `initializeApp` twice. This is handled by the `getApps()` guard in `main.js`:

```js
const app = getApps().length ? getApps()[0] : initializeApp(FIREBASE_CONFIG);
```

If you see this error, make sure you haven't removed that guard. A full page reload (`Ctrl+R`) always resolves it.

---

### Admin panel accidentally pushed to live site

It shouldn't be possible — `firebase.json` has `"admin/**"` and `"dist-admin/**"` in the hosting ignore list.

If somehow it happened: immediately run `firebase deploy --only hosting` from a clean state (without the admin files in the public directory). Verify by visiting the live URL and confirming `/admin/` returns 404.

---

## Environment Notes

| Item | Value |
|---|---|
| Admin URL (dev) | http://localhost:5175 |
| Main app (Live Server) | http://localhost:5500 or :8000 |
| Firebase project | `bec-science` |
| Admin email | `schekes23@gmail.com` |
| Entitlements collection | `entitlements/{uid}` |
| Leaderboard collection | `leaderboard/{uid}` |
| Premium grant field | `entitlements/{uid}.premium = true` |

---

## Daily Limit Reference (Free Accounts)

Free (non-premium) users are limited per day, reset at midnight (local time):

| Action | Limit |
|---|---|
| Animate / Study / Quiz | 7 per day |
| Practice Tests | 3 per day |
| Full Exams | 1 per day |

Premium users (granted via admin) have no limits. Grant premium by clicking **Grant** next to any user in the admin panel.
