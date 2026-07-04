import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth';
import {
  getFirestore,
  collection,
  getDocs,
  doc,
  setDoc,
} from 'firebase/firestore';

// ── Config ───────────────────────────────────────────────────────────────────
const ADMIN_EMAIL = 'schekes23@gmail.com';
const FIREBASE_CONFIG = {
  apiKey:            'AIzaSyB8IeTflnPk4DOHXI0FEYs49F_oq6zud9g',
  authDomain:        'bec-science.firebaseapp.com',
  projectId:         'bec-science',
  storageBucket:     'bec-science.firebasestorage.app',
  messagingSenderId: '587792683722',
  appId:             '1:587792683722:web:04d29061435f1217b09a33',
};
const LEVELS = [
  { name:'Seedling',  icon:'🌱', min:0     },
  { name:'Explorer',  icon:'🔍', min:100   },
  { name:'Scientist', icon:'🔬', min:300   },
  { name:'Scholar',   icon:'📖', min:600   },
  { name:'Expert',    icon:'🧠', min:1200  },
  { name:'Master',    icon:'🏆', min:2500  },
  { name:'Champion',  icon:'🥇', min:5000  },
  { name:'Legend',    icon:'⭐', min:10000 },
];

// ── State ─────────────────────────────────────────────────────────────────────
let db, auth, adminUser;
let allUsers  = [];
let sortField = 'xp';
let sortAsc   = false;
let _grantUid = null;

// ── Localhost guard ───────────────────────────────────────────────────────────
const h = location.hostname;
if (h !== 'localhost' && h !== '127.0.0.1') {
  splashError('This admin panel is only accessible from <strong>localhost</strong>.');
} else {
  boot();
}

// ── Boot ─────────────────────────────────────────────────────────────────────
function boot() {
  splashMsg('Initialising Firebase…');
  const app = getApps().length ? getApps()[0] : initializeApp(FIREBASE_CONFIG);
  auth = getAuth(app);
  db   = getFirestore(app);

  splashMsg('Setting up sign-in…');

  const doSignIn = () => {
    const email = document.getElementById('login-email').value.trim();
    const pass  = document.getElementById('login-pass').value;
    document.getElementById('login-error').textContent = '';
    if (!email || !pass) {
      document.getElementById('login-error').textContent = 'Enter your email and password.';
      return;
    }
    signInWithEmailAndPassword(auth, email, pass).catch(e => {
      document.getElementById('login-error').textContent =
        e.code === 'auth/invalid-credential' || e.code === 'auth/wrong-password' || e.code === 'auth/user-not-found'
          ? 'Invalid email or password.'
          : e.message;
    });
  };

  document.getElementById('signin-btn').addEventListener('click', doSignIn);
  document.getElementById('login-pass').addEventListener('keydown', e => {
    if (e.key === 'Enter') doSignIn();
  });
  document.getElementById('logout-btn').addEventListener('click', () => signOut(auth));

  splashMsg('Checking auth state…');
  const timeout = setTimeout(() => {
    splashError(
      'Auth timed out (10 s).<br><br>' +
      'Check:<br>• <strong>localhost</strong> is in Firebase Console → Auth → Authorized Domains<br>' +
      '• You are online<br>• Open DevTools → Console for details'
    );
  }, 10000);

  onAuthStateChanged(
    auth,
    user => {
      clearTimeout(timeout);
      if (!user) {
        show('login');
      } else if (user.email !== ADMIN_EMAIL) {
        signOut(auth);
        document.getElementById('login-error').textContent =
          `Access denied. Only ${ADMIN_EMAIL} may sign in here.`;
        show('login');
      } else {
        adminUser = user;
        document.getElementById('adm-user').textContent = user.email;
        show('app');
        loadData();
      }
    },
    err => {
      clearTimeout(timeout);
      splashError('Auth error: ' + err.message);
    }
  );
}

// ── UI helpers ────────────────────────────────────────────────────────────────
function show(view) {
  document.getElementById('splash').style.display = 'none';
  ['guard', 'login', 'app'].forEach(id => {
    document.getElementById(id)?.classList.toggle('hidden', id !== view);
  });
}
function splashMsg(text) {
  const el = document.getElementById('splash-msg');
  if (el) el.textContent = text;
}
function splashError(msg) {
  document.getElementById('splash').innerHTML =
    `<div style="color:#f85149;text-align:center;padding:28px;max-width:460px;line-height:1.7">
       <div style="font-size:2.4rem;margin-bottom:12px">⚠️</div>
       <div>${msg}</div>
       <button onclick="location.reload()"
         style="margin-top:20px;padding:8px 20px;background:#238636;color:#fff;
                border:none;border-radius:8px;cursor:pointer;font-size:.9rem">↺ Retry</button>
     </div>`;
}

// ── Data loading ─────────────────────────────────────────────────────────────
window.loadData = async function () {
  document.getElementById('users-tbody').innerHTML =
    '<tr id="loading-row"><td colspan="9"><span class="spinner"></span> Loading…</td></tr>';
  try {
    const [usersSnap, entSnap] = await Promise.all([
      getDocs(collection(db, 'users')),
      getDocs(collection(db, 'entitlements')),
    ]);
    const entMap = {};
    entSnap.forEach(d => { entMap[d.id] = d.data(); });

    allUsers = [];
    usersSnap.forEach(d => {
      const u = d.data();
      const visited = (u.visited_primary || []).length
                    + (u.visited_junior  || []).length
                    + (u.visited_senior  || []).length;
      allUsers.push({
        uid:       d.id,
        name:      u.displayName || u.name || '—',
        email:     u.email || '—',
        xp:        u.xp        || 0,
        streak:    u.streak    || 0,
        quizCount: u.quizCount || 0,
        animCount: visited,
        lastSeen:  u.lastSeen  || u.lastStudyDate || null,
        premium:   !!(entMap[d.id]?.premium),
        entNotes:  entMap[d.id]?.notes || '',
      });
    });
    computeStats();
    renderTable();
  } catch (e) {
    document.getElementById('users-tbody').innerHTML =
      `<tr><td colspan="9" class="no-data">Error: ${e.message}</td></tr>`;
    showToast('❌ Load failed: ' + e.message, true);
  }
};

// ── Stats ─────────────────────────────────────────────────────────────────────
function computeStats() {
  const total   = allUsers.length;
  const premium = allUsers.filter(u => u.premium).length;
  const conv    = total ? ((premium / total) * 100).toFixed(1) : '0';
  const revenue = premium * 200;
  const totalQ  = allUsers.reduce((a, u) => a + u.quizCount, 0);
  const totalXP = allUsers.reduce((a, u) => a + u.xp, 0);
  const avgXP   = total ? Math.round(totalXP / total) : 0;
  const streakers = allUsers.filter(u => u.streak > 0);
  const avgStr  = streakers.length
    ? (streakers.reduce((a, u) => a + u.streak, 0) / streakers.length).toFixed(1)
    : '0';
  const active7  = allUsers.filter(u => isRecent(u.lastSeen, 7)).length;
  const totalAn  = allUsers.reduce((a, u) => a + u.animCount, 0);

  set('s-total',    total);
  set('s-premium',  premium);
  set('s-conv',     conv + '% conversion');
  set('s-revenue',  'P' + revenue.toLocaleString());
  set('s-quizzes',  totalQ.toLocaleString());
  set('s-avgxp',    avgXP.toLocaleString());
  set('s-totalxp',  totalXP.toLocaleString() + ' total XP');
  set('s-avgstreak', avgStr + ' days');
  set('s-active7',  active7);
  set('s-active7-pct', ((active7 / Math.max(total, 1)) * 100).toFixed(0) + '% of users');
  set('s-anims',    totalAn.toLocaleString());
}
function isRecent(d, days) {
  if (!d) return false;
  return (Date.now() - new Date(d).getTime()) < days * 86400000;
}
function set(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

// ── Table ─────────────────────────────────────────────────────────────────────
function getLevel(xp) {
  let lv = LEVELS[0];
  for (const l of LEVELS) if (xp >= l.min) lv = l;
  return lv;
}
function fmtDate(str) {
  if (!str) return '—';
  const d = new Date(str);
  if (isNaN(d)) return '—';
  const days = Math.floor((Date.now() - d) / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7)  return days + 'd ago';
  if (days < 30) return Math.floor(days / 7) + 'w ago';
  return d.toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'2-digit' });
}
function esc(s) {
  return String(s || '').replace(/[&<>"']/g,
    c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}

window.setSort = function (field) {
  if (sortField === field) sortAsc = !sortAsc; else { sortField = field; sortAsc = false; }
  renderTable();
};
window.filterTable = function () { renderTable(); };

function renderTable() {
  const q = (document.getElementById('search')?.value || '').toLowerCase().trim();
  let rows = allUsers.filter(u =>
    !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
  );
  rows.sort((a, b) => {
    const va = a[sortField] ?? '', vb = b[sortField] ?? '';
    if (va < vb) return sortAsc ? -1 :  1;
    if (va > vb) return sortAsc ?  1 : -1;
    return 0;
  });
  if (!rows.length) {
    document.getElementById('users-tbody').innerHTML =
      '<tr><td colspan="9" class="no-data">No users found.</td></tr>';
    return;
  }
  document.getElementById('users-tbody').innerHTML = rows.map((u, i) => {
    const lv = getLevel(u.xp);
    const shortUid = u.uid.length > 16 ? u.uid.slice(0, 8) + '…' + u.uid.slice(-4) : u.uid;
    return `<tr>
      <td style="color:#484f58">${i + 1}</td>
      <td class="td-user">
        <div class="td-name">${esc(u.name)} <span class="badge-level">${lv.icon} ${lv.name}</span></div>
        <div class="td-email">${esc(u.email)}</div>
        <div style="font-size:.68rem;color:#484f58;margin-top:3px;font-family:monospace" title="${u.uid}">
          UID: ${shortUid}
          <button onclick="navigator.clipboard.writeText('${u.uid}').then(()=>{this.textContent='✓';setTimeout(()=>this.textContent='⧉',1200)})" title="Copy UID" style="background:none;border:none;color:#3fb950;cursor:pointer;font-size:.65rem;padding:0 2px;vertical-align:middle">⧉</button>
        </div>
      </td>
      <td class="td-num">${u.xp.toLocaleString()}</td>
      <td class="td-num">${u.streak > 0 ? '🔥 ' + u.streak : u.streak}</td>
      <td class="td-num">${u.quizCount}</td>
      <td class="td-num">${u.animCount}</td>
      <td style="color:#8b949e">${fmtDate(u.lastSeen)}</td>
      <td>${u.premium
        ? '<span class="badge-premium">⭐ Lifetime</span><div style="font-size:.68rem;color:#3fb950;margin-top:3px">Unlimited · all 90+ animations</div>'
        : '<span class="badge-free">Free</span><div style="font-size:.68rem;color:#f85149;margin-top:3px">🕐 7 sessions · 3 tests · 1 exam/day<br>Resets midnight · all 90+ available</div>'}</td>
      <td>${u.premium
        ? `<button class="btn-revoke" onclick="openRevoke('${u.uid}','${esc(u.name)}')">Revoke</button>`
        : `<button class="btn-grant"  onclick="openGrant('${u.uid}','${esc(u.name)}')" >Grant</button>`}</td>
    </tr>`;
  }).join('');
}

// ── Grant / Revoke ────────────────────────────────────────────────────────────
window.openGrant = function (uid, name) {
  _grantUid = uid;
  document.getElementById('grant-title').textContent = 'Grant Lifetime Premium';
  document.getElementById('grant-sub').innerHTML =
    `<strong>${esc(name)}</strong><br><span style="font-size:.72rem;color:#484f58;font-family:monospace">${uid}</span>`;
  document.getElementById('grant-notes').value       = '';
  document.getElementById('grant-confirm').textContent = '✅ Confirm Grant';
  document.getElementById('grant-confirm').onclick   = confirmGrant;
  document.getElementById('grant-modal').classList.remove('hidden');
  document.getElementById('grant-notes').focus();
};
window.openRevoke = function (uid, name) {
  _grantUid = uid;
  document.getElementById('grant-title').textContent = 'Revoke Premium Access';
  document.getElementById('grant-sub').innerHTML =
    `<strong>${esc(name)}</strong> — removes Lifetime access.<br><span style="font-size:.72rem;color:#484f58;font-family:monospace">${uid}</span>`;
  document.getElementById('grant-notes').value       = '';
  document.getElementById('grant-confirm').textContent = '⚠️ Confirm Revoke';
  document.getElementById('grant-confirm').onclick   = confirmRevoke;
  document.getElementById('grant-modal').classList.remove('hidden');
};
window.closeGrantModal = function () {
  document.getElementById('grant-modal').classList.add('hidden');
  _grantUid = null;
};

async function confirmGrant() {
  if (!_grantUid) return;
  const notes = document.getElementById('grant-notes').value.trim();
  try {
    await setDoc(doc(db, 'entitlements', _grantUid), {
      premium:   true,
      plan:      'lifetime',
      pula:      200,
      notes,
      grantedAt: new Date().toISOString(),
      grantedBy: adminUser.email,
    });
    const u = allUsers.find(x => x.uid === _grantUid);
    if (u) u.premium = true;
    closeGrantModal();
    computeStats();
    renderTable();
    showToast('✅ Lifetime premium granted.');
  } catch (e) { showToast('❌ ' + e.message, true); }
}
window.closeGrantModal = closeGrantModal;

async function confirmRevoke() {
  if (!_grantUid) return;
  const notes = document.getElementById('grant-notes').value.trim();
  try {
    await setDoc(doc(db, 'entitlements', _grantUid), {
      premium:   false,
      plan:      null,
      notes,
      revokedAt: new Date().toISOString(),
      revokedBy: adminUser.email,
    }, { merge: true });
    const u = allUsers.find(x => x.uid === _grantUid);
    if (u) u.premium = false;
    closeGrantModal();
    computeStats();
    renderTable();
    showToast('⚠️ Premium revoked.');
  } catch (e) { showToast('❌ ' + e.message, true); }
}

document.getElementById('grant-modal').addEventListener('click', e => {
  if (e.target === document.getElementById('grant-modal')) closeGrantModal();
});

// ── Toast ─────────────────────────────────────────────────────────────────────
let _toastTimer;
function showToast(msg, err) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.style.borderColor = err ? '#f85149' : '#3fb950';
  el.classList.remove('hidden');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.add('hidden'), 3500);
}
