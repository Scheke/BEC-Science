/* BEC Study Engine v2.0 */

/* ── Topic order for Prev/Next navigation ── */
const _SE_TOPICS = [
  'psle/std5-scientific-processes','psle/std5-classification','psle/std5-food-chains',
  'psle/std5-states-of-matter','psle/std5-nutrition','psle/std6-human-body',
  'psle/std6-forces-motion','psle/std6-electricity','psle/std6-reproductive-health',
  'psle/std7-solar-system','psle/std7-advanced-systems','psle/std7-environmental-science',
  'psle/std7-diseases-health','jce/form1-cells','jce/form1-chemistry-intro',
  'jce/form1-si-units','jce/form2-photosynthesis','jce/form2-digestion',
  'jce/form2-separation','jce/form2-forces','jce/form3-circulatory',
  'jce/form3-respiration','jce/form3-energy','jce/form3-sound',
  'bgcse/bio-cell-transport','bgcse/bio-respiration-advanced','bgcse/bio-homeostasis',
  'bgcse/bio-nervous-system','bgcse/bio-genetics','bgcse/bio-ecosystems',
  'bgcse/chem-atomic-structure','bgcse/chem-bonding','bgcse/chem-quantitative',
  'bgcse/chem-rates','bgcse/chem-metals','bgcse/chem-organic',
  'bgcse/phys-mechanics','bgcse/phys-thermal','bgcse/phys-waves',
  'bgcse/phys-electricity','bgcse/phys-nuclear',
];

/* Detect level/group from current URL → returns {level, group, backLabel, backUrl} */
function _seDetectContext() {
  const parts  = window.location.pathname.replace(/\\/g,'/').split('/');
  const folder = parts[parts.length - 2]; // 'psle' | 'jce' | 'bgcse'
  const file   = parts[parts.length - 1]; // e.g. 'std5-nutrition-study.html'

  const levelMap = { psle:'primary', jce:'junior', bgcse:'senior' };
  const groupMap = {
    psle:  [['std5','Standard 5'],['std6','Standard 6'],['std7','Standard 7']],
    jce:   [['form1','Form 1'],['form2','Form 2'],['form3','Form 3']],
    bgcse: [['bio-','Biology'],['chem-','Chemistry'],['phys-','Physics']],
  };

  const level = levelMap[folder];
  if (!level) return null;

  let group = null;
  (groupMap[folder] || []).forEach(([key, name]) => {
    if (file.startsWith(key)) group = name;
  });

  if (!group) return null;
  const backUrl = '../../index.html#' + level + '/' + encodeURIComponent(group);
  return { level, group, backLabel: '← ' + group, backUrl };
}

function _seTopicNav() {
  const parts  = window.location.pathname.split('/');
  const fn     = parts[parts.length - 1];
  const folder = parts[parts.length - 2];
  const isStudy = fn.endsWith('-study.html');
  const suffix  = isStudy ? '-study.html' : '-study.html';
  const base    = fn.replace(/-study\.html$/, '').replace(/-quiz\.html$/, '');
  const slug    = folder + '/' + base;
  const idx     = _SE_TOPICS.indexOf(slug);
  if (idx === -1) return null;
  const makeUrl = s => {
    const nf = s.split('/')[0], nb = s.split('/')[1] + suffix;
    return nf === folder ? nb : '../' + nf + '/' + nb;
  };
  return {
    prev:  idx > 0 ? makeUrl(_SE_TOPICS[idx - 1]) : null,
    next:  idx < _SE_TOPICS.length - 1 ? makeUrl(_SE_TOPICS[idx + 1]) : null,
    pos:   idx + 1,
    total: _SE_TOPICS.length,
  };
}

class StudyEngine {
  constructor(steps, opts = {}) {
    // Remove mini-game/MCQ steps — quizzes live in the separate Quiz page
    steps = steps.filter(s => !s.mcq && !s.game);

    // Enforce order: animation/text steps → SVG diagram steps
    steps.sort((a, b) => {
      const rank = s => s.visual ? 1 : 0;
      return rank(a) - rank(b);
    });
    this.steps = steps;
    const ctx = _seDetectContext();
    const defaults = {
      color    : '#2e7d32',
      dark     : '#1b5e20',
      light    : '#e8f5e9',
      backUrl  : ctx ? ctx.backUrl  : '../../index.html',
      backLabel: ctx ? ctx.backLabel : '← Home',
      title    : 'Study',
    };
    this.O = Object.assign(defaults, opts);
    // Shorten title for header — strip everything after — or : then trim
    const rawTitle = this.O.title.replace(/&amp;/g,'&');
    const shortTitle = rawTitle.split('—')[0].split(':')[0].trim();
    this.O.shortTitle = shortTitle.length > 45
      ? shortTitle.substring(0, 43) + '…'
      : shortTitle;

    this.cur        = 0;
    this.sketch     = null;
    this.gameActive = false;
    this._mcqIdx    = 0;
    this._mcqScore  = 0;

    this._applyTokens();
    this._buildLayout();
    window.__se = this;
    this._show(0);

    // BEC init is handled by _becInitStudy() at module level below
  }

  /* ── CSS colour tokens ── */
  _applyTokens() {
    const r = document.documentElement.style;
    r.setProperty('--c',      this.O.color);
    r.setProperty('--c-dark', this.O.dark);
    r.setProperty('--c-light',this.O.light);
  }

  /* ── Normalize game data: supports s.game or s.mcq shorthand ── */
  _gameFor(s) {
    if (s.game) return s.game;
    if (s.mcq)  return { type: 'mcq', questions: s.mcq };
    return null;
  }

  /* ── DOM skeleton ── */
  _buildLayout() {
    document.body.style.cssText =
      'margin:0;padding:0;font-family:Segoe UI,system-ui,sans-serif;' +
      'height:100vh;overflow:hidden;display:flex;flex-direction:column;background:#0f1117';

    // Add responsive meta tag
    if (!document.querySelector('meta[name="viewport"]')) {
      const meta = document.createElement('meta');
      meta.name = 'viewport';
      meta.content = 'width=device-width, initial-scale=1.0';
      document.head.appendChild(meta);
    }

    // Add responsive styles
    const style = document.createElement('style');
    style.textContent = `
      #se-cv canvas { display: block !important; }
      @media (max-width: 768px) {
        #se-main { flex-direction: column !important; }
        #se-cv { flex: 0 0 45vh !important; width: 100% !important; }
        #se-panel { flex: 1 !important; }
      }
      @media (max-width: 480px) {
        #se-cv { flex: 0 0 40vh !important; }
        #se-title { font-size: .88rem !important; }
        #se-body { font-size: .78rem !important; }
      }
      /* Topbar: too many flex-shrink:0 controls crammed in one 44px row
         crushed the title to a single letter + ellipsis on phones.
         Reflow into two rows: back+title on top, nav controls below. */
      @media (max-width: 560px) {
        #se-topbar {
          height: auto !important; min-height: 44px;
          flex-wrap: wrap !important; row-gap: 6px; padding: 8px 10px !important;
        }
        #se-topbar .se-sep { display: none !important; }
        #se-topbar .se-navlbl { display: none !important; }
        #se-back { order: 1; font-size: .7rem !important; }
        #se-title-txt { order: 2; flex: 1 1 auto !important; font-size: .78rem !important; }
        #se-topbar .se-break { order: 3; flex-basis: 100%; height: 0; }
        #se-badge { order: 4; }
        #se-prev { order: 5; }
        #se-next { order: 6; }
        #se-next-topic { order: 7; }
      }
    `;
    document.head.appendChild(style);

    document.body.innerHTML = `
      <div id="se-topbar" style="
        position:sticky;top:0;left:0;right:0;height:44px;z-index:50;
        display:flex;align-items:center;gap:8px;padding:0 12px;
        background:rgba(0,0,0,.55);backdrop-filter:blur(8px)">
        <a id="se-back" href="${this.O.backUrl}" style="
          color:rgba(255,255,255,.65);text-decoration:none;font-size:.72rem;
          font-weight:600;display:flex;align-items:center;gap:4px;padding:4px 8px;
          border-radius:6px;transition:color .15s;flex-shrink:0;white-space:nowrap"
          onmouseover="this.style.color='#fff'" onmouseout="this.style.color='rgba(255,255,255,.65)'">
          ${this.O.backLabel}
        </a>
        <span class="se-sep" style="color:rgba(255,255,255,.3);font-size:.7rem;flex-shrink:0">|</span>
        <span id="se-title-txt" style="color:rgba(255,255,255,.75);font-size:.78rem;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0">${this.O.shortTitle}</span>
        <span id="se-navlbl" class="se-navlbl" style="
          color:rgba(255,255,255,.5);font-size:.7rem;font-weight:600;flex-shrink:0"></span>
        <div class="se-break" style="flex:1"></div>
        <button id="se-prev" onclick="__se.prev()" style="
          padding:4px 10px;border-radius:5px;border:1px solid rgba(255,255,255,.3);
          background:rgba(255,255,255,.08);color:rgba(255,255,255,.8);font-size:.7rem;
          font-weight:700;cursor:pointer;font-family:inherit;transition:all .15s;
          flex-shrink:0"
          onmouseover="this.style.background='rgba(255,255,255,.12)'" onmouseout="this.style.background='rgba(255,255,255,.08)'">
          ← Prev
        </button>
        <button id="se-next" onclick="__se.next()" style="
          padding:4px 10px;border-radius:5px;border:none;
          background:var(--c,#2e7d32);color:#fff;font-size:.7rem;font-weight:700;
          cursor:pointer;font-family:inherit;transition:all .15s;flex-shrink:0"
          onmouseover="this.style.opacity='.85'" onmouseout="this.style.opacity='1'">
          Next →
        </button>
        <button id="se-next-topic" style="
          padding:4px 10px;border-radius:5px;border:none;
          background:#d84315;color:#fff;font-size:.7rem;font-weight:700;
          cursor:pointer;font-family:inherit;transition:all .15s;flex-shrink:0;display:none"
          onclick="__se.nextTopic ? __se.nextTopic() : null"
          onmouseover="this.style.opacity='.85'" onmouseout="this.style.opacity='1'">
          Chapter →
        </button>
        <span id="se-badge" style="
          background:rgba(255,255,255,.12);color:rgba(255,255,255,.7);
          font-size:.65rem;font-weight:700;padding:3px 8px;border-radius:999px;flex-shrink:0"></span>
      </div>

      <!-- Main content wrapper (side-by-side) -->
      <div id="se-main" style="
        flex:1;display:flex;flex-direction:row;overflow:hidden;gap:0;
        min-height:0">

        <!-- Canvas area (55% on desktop) -->
        <div id="se-cv" style="
          flex:0 0 55%;position:relative;overflow:hidden;background:#111;
          cursor:default;border-right:1px solid rgba(255,255,255,.08);
          align-self:stretch;display:flex;align-items:center;justify-content:center">
        </div>

        <!-- Text panel (45% on desktop) -->
        <div id="se-panel" style="
          flex:1;background:#fff;display:flex;flex-direction:column;
          padding:16px 20px;overflow:hidden;min-height:0">

          <!-- Scrollable content area -->
          <div id="se-content" style="
            flex:1;overflow-y:auto;overflow-x:hidden;
            display:flex;flex-direction:column;min-height:0;
            padding-right:6px;margin-right:-2px">
            <div id="se-title" style="
              font-size:1.05rem;font-weight:800;color:#111;
              margin-bottom:12px;line-height:1.3"></div>
            <div id="se-body" style="
              font-size:.85rem;line-height:1.7;color:#444;
              margin-bottom:16px"></div>
          </div>

        </div>
      </div>

    `;

    // Footer navigation removed
  }


  /* ── Show step i ── */
  _show(i) {
    this.cur = i;
    this.gameActive = false;
    const s = this.steps[i];
    const n = this.steps.length;
    const game = this._gameFor(s);

    document.getElementById('se-badge').textContent  = `Step ${i+1} of ${n}`;
    document.getElementById('se-title').innerHTML    = s.title || s.q || '';
    // Support both s.body (original) and s.content (PSLE file format)
    document.getElementById('se-body').innerHTML     = s.body || s.content || '';
    document.getElementById('se-navlbl').textContent = '';

    const prevBtn = document.getElementById('se-prev');
    prevBtn.style.visibility = i === 0 ? 'hidden' : 'visible';

    const nextBtn = document.getElementById('se-next');
    if (game) {
      nextBtn.textContent = '🎮 Mini-Game →';
    } else if (i === n-1) {
      const nav = _seTopicNav();
      nextBtn.textContent = (nav && nav.next) ? 'Next Topic →' : '✓ Finish';
    } else {
      nextBtn.textContent = 'Next →';
    }

    // Restore panel background (in case game darkened it)
    document.getElementById('se-panel').style.background = '#fff';
    document.getElementById('se-title').style.color      = '#111';
    document.getElementById('se-body').style.color       = '#444';

    this._buildSketch(s);
  }

  /* ── p5.js sketch lifecycle ── */
  _buildSketch(s) {
    if (this.sketch) { this.sketch.remove(); this.sketch = null; }
    const wrap = document.getElementById('se-cv');
    wrap.innerHTML = '';
    if (!s.draw) {
      if (s.visual) wrap.innerHTML = s.visual;
      return;
    }
    if (s.vars) Object.keys(s.vars).forEach(k => { s._state = JSON.parse(JSON.stringify(s.vars)); });

    // Use window dimensions directly — container offsetHeight is unreliable in flex row layout
    setTimeout(() => {
      const mobile = window.innerWidth <= 768;
      const cw = mobile ? window.innerWidth : Math.floor(window.innerWidth * 0.55);
      const ch = mobile ? Math.floor(window.innerHeight * 0.45) : (window.innerHeight - 44);

      this.sketch = new p5(sk => {
        sk.setup = () => {
          sk.createCanvas(cw, ch);
          if (s.setup) s.setup(sk, s._state || {});
        };
        sk.draw          = () => s.draw(sk, s._state || {});
        sk.mousePressed  = s.mousePressed  ? () => s.mousePressed(sk,  s._state || {}) : undefined;
        sk.mouseDragged  = s.mouseDragged  ? () => s.mouseDragged(sk,  s._state || {}) : undefined;
        sk.mouseReleased = s.mouseReleased ? () => s.mouseReleased(sk, s._state || {}) : undefined;
        sk.windowResized = () => {
          const mob = window.innerWidth <= 768;
          const nw = mob ? window.innerWidth : Math.floor(window.innerWidth * 0.55);
          const nh = mob ? Math.floor(window.innerHeight * 0.45) : (window.innerHeight - 44);
          sk.resizeCanvas(nw, nh);
        };
      }, wrap);
    }, 100);
  }

  /* ── Navigation ── */
  next() {
    const s    = this.steps[this.cur];
    const game = this._gameFor(s);
    if (game && !this.gameActive) { this._launchMCQ(game); return; }
    if (this.cur < this.steps.length - 1) {
      this._show(this.cur + 1);
    } else {
      // Completed all steps — silver crown + bonus XP
      if (typeof BEC !== 'undefined') { BEC.addXP(20, 'Study complete!'); BEC.setCrown(BEC.getSlug(), 2); }
      const nav = _seTopicNav();
      location.href = (nav && nav.next) ? nav.next : this.O.backUrl;
    }
  }

  prev() {
    if (this.gameActive) { this._show(this.cur); return; }
    if (this.cur > 0) this._show(this.cur - 1);
  }

  /* ── MCQ Mini-Game ── */
  _launchMCQ(game) {
    this.gameActive = true;
    this._mcqIdx   = 0;
    this._mcqScore = 0;
    if (this.sketch) { this.sketch.remove(); this.sketch = null; }
    this._renderMCQQuestion(game);
  }

  _renderMCQQuestion(game) {
    const qi  = this._mcqIdx;
    const qs  = game.questions;
    if (qi >= qs.length) { this._showResult(game); return; }

    const q   = qs[qi];
    const wrap= document.getElementById('se-cv');
    wrap.innerHTML = `
      <div style="
        height:100%;display:flex;flex-direction:column;align-items:center;
        justify-content:center;background:#1a1a2e;padding:20px 24px">
        <div style="max-width:540px;width:100%">
          <div style="font-size:.68rem;font-weight:700;color:rgba(255,255,255,.4);
            text-transform:uppercase;letter-spacing:1px;margin-bottom:10px">
            🎮 Challenge · ${qi+1} / ${qs.length}
          </div>
          <div style="font-size:1rem;font-weight:700;color:#fff;line-height:1.45;margin-bottom:18px">
            ${q.q}
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:9px" id="se-opts">
            ${q.opts.map((o,i)=>`
              <button data-i="${i}" onclick="__se._pickMCQ(${qi},${i})" style="
                background:rgba(255,255,255,.09);border:1.5px solid rgba(255,255,255,.18);
                color:#fff;padding:11px 12px;border-radius:10px;font-size:.8rem;font-weight:600;
                cursor:pointer;text-align:left;font-family:inherit;transition:background .12s;
                line-height:1.35"
                onmouseover="this.style.background='rgba(255,255,255,.17)'"
                onmouseout="this.style.background='rgba(255,255,255,.09)'"
              ><span style="opacity:.55">${String.fromCharCode(65+i)}.</span> ${o}</button>
            `).join('')}
          </div>
          <div id="se-exp" style="margin-top:14px;min-height:48px"></div>
        </div>
      </div>`;

    document.getElementById('se-panel').style.background = '#0f0f1a';
    document.getElementById('se-title').style.color = 'rgba(255,255,255,.85)';
    document.getElementById('se-title').innerHTML = '🎮 Mini-Game Challenge';
    document.getElementById('se-body').style.color  = 'rgba(255,255,255,.55)';
    document.getElementById('se-body').innerHTML = 'Answer the questions to earn points. Read the feedback before continuing.';
    document.getElementById('se-navlbl').textContent = `${qi+1} / ${qs.length} questions`;
    document.getElementById('se-prev').style.visibility = 'hidden';
    document.getElementById('se-next').textContent = '→ Next Question';
    document.getElementById('se-next').style.pointerEvents = 'none';
    document.getElementById('se-next').style.opacity = '.4';
  }

  _pickMCQ(qi, chosen) {
    const game = this._gameFor(this.steps[this.cur]);
    const q    = game.questions[qi];
    const correct = chosen === q.ans;
    if (correct) { this._mcqScore++; if (typeof BEC !== 'undefined') { BEC.addXP(10, 'Correct!'); BEC.recordCorrect(); } }
    else { if (typeof BEC !== 'undefined') BEC.loseHeart(); }

    document.querySelectorAll('#se-opts button').forEach((b,i) => {
      b.style.pointerEvents = 'none';
      b.onmouseover = null; b.onmouseout = null;
      if (i === q.ans)                   b.style.background = 'rgba(46,125,50,.65)';
      else if (i === chosen && !correct) b.style.background = 'rgba(183,28,28,.55)';
      else                               b.style.opacity    = '.45';
    });

    document.getElementById('se-exp').innerHTML = `
      <div style="color:${correct?'#81c784':'#ef9a9a'};font-size:.78rem;font-weight:700;margin-bottom:3px">
        ${correct ? '✓ Correct!' : '✗ Not quite.'}
      </div>
      <div style="color:rgba(255,255,255,.65);font-size:.76rem;line-height:1.5">${q.exp}</div>`;

    const nb = document.getElementById('se-next');
    nb.style.pointerEvents = '';
    nb.style.opacity       = '1';
    nb.textContent = qi < game.questions.length-1 ? '→ Next Question' : '→ See Results';
    nb.onclick = () => { this._mcqIdx++; this._renderMCQQuestion(game); };
  }

  _showResult(game) {
    const score = this._mcqScore;
    const total = game.questions.length;
    const pct   = Math.round(score / total * 100);
    const stars = pct >= 80 ? '🏆' : pct >= 60 ? '⭐' : '📖';
    const msg   = pct >= 80 ? 'Excellent! You nailed it!' : pct >= 60 ? 'Good work — keep going!' : 'Review the lesson and try again!';

    document.getElementById('se-cv').innerHTML = `
      <div style="height:100%;display:flex;flex-direction:column;align-items:center;
        justify-content:center;background:#1a1a2e;color:#fff;text-align:center;padding:24px">
        <div style="font-size:3.5rem;margin-bottom:10px">${stars}</div>
        <div style="font-size:1.2rem;font-weight:800;margin-bottom:4px">${score} / ${total} Correct</div>
        <div style="font-size:2.6rem;font-weight:900;color:var(--c,#2e7d32);line-height:1">${pct}%</div>
        <div style="color:rgba(255,255,255,.65);font-size:.88rem;margin:10px 0 22px">${msg}</div>
        <button onclick="__se._continueAfterGame()" style="
          padding:11px 34px;background:var(--c,#2e7d32);color:#fff;border:none;
          border-radius:10px;font-size:.9rem;font-weight:700;cursor:pointer;font-family:inherit">
          Continue →
        </button>
      </div>`;

    // Clear panel so previous SVG content doesn't leak through
    document.getElementById('se-panel').style.background = '#fff';
    document.getElementById('se-title').style.color = '#111';
    document.getElementById('se-title').innerHTML = '';
    document.getElementById('se-body').style.color = '#888';
    document.getElementById('se-body').innerHTML = '';
    document.getElementById('se-nav').style.display = 'none';
  }

  _continueAfterGame() {
    document.getElementById('se-nav').style.display = '';
    this.gameActive = false;
    if (this.cur < this.steps.length - 1) {
      this._show(this.cur + 1);
    } else {
      const nav = _seTopicNav();
      location.href = (nav && nav.next) ? nav.next : this.O.backUrl;
    }
  }
}

/* ── BEC / Firebase init for standalone study pages ────────────────────────
   Runs immediately when study-engine.js loads.
   On index.html (SPA): BEC + _becUID already set — awards XP right away.
   On standalone study pages: loads Firebase CDN + game.js, waits for auth,
   loads cloud state, THEN awards the open-study XP (no data corruption risk).
──────────────────────────────────────────────────────────────────────────── */
(function _becInitStudy() {
  // SPA path: everything already initialized by index.html
  if (window.BEC && window._becDB && window._becUID) {
    BEC.setCrown(BEC.getSlug(), 1);
    BEC.addOpenXP(5, 'Opened study');
    return;
  }

  const me = document.querySelector('script[src*="study-engine"]');
  if (!me) return;
  const base = me.src.replace(/study-engine\.js.*$/, '');

  function _ld(src) {
    return new Promise(function(resolve) {
      const fn = src.split('/').pop();
      if (document.querySelector('script[src$="/' + fn + '"], script[src="' + src + '"]')) { resolve(); return; }
      const s = document.createElement('script');
      s.src = src; s.onload = resolve; s.onerror = resolve;
      document.head.appendChild(s);
    });
  }

  const FB = 'https://www.gstatic.com/firebasejs/10.12.2/';
  const CFG = {
    apiKey:'AIzaSyB8IeTflnPk4DOHXI0FEYs49F_oq6zud9g',
    authDomain:'bec-science.firebaseapp.com',
    projectId:'bec-science',
    storageBucket:'bec-science.firebasestorage.app',
    messagingSenderId:'587792683722',
    appId:'1:587792683722:web:04d29061435f1217b09a33',
  };

  var gameLoad = window.BEC ? Promise.resolve()
    : _ld(base + 'game.js');

  var fbLoad = window._becDB ? Promise.resolve()
    : _ld(FB + 'firebase-app-compat.js')
        .then(function() { return _ld(FB + 'firebase-auth-compat.js'); })
        .then(function() { return _ld(FB + 'firebase-firestore-compat.js'); })
        .then(function() {
          if (typeof firebase === 'undefined') return;
          if (!firebase.apps.length) firebase.initializeApp(CFG);
          window._becDB = firebase.firestore();
        });

  Promise.all([gameLoad, fbLoad]).then(function() {
    if (typeof BEC === 'undefined' || !window._becDB) return;
    firebase.auth().onAuthStateChanged(function(user) {
      if (user && !user.isAnonymous) {
        window._becUID = user.uid;
        BEC.loadFromCloud().then(function() {
          BEC.setCrown(BEC.getSlug(), 1);
          BEC.addOpenXP(5, 'Opened study');
        }).catch(function() {});
      }
    });
  });
})();
