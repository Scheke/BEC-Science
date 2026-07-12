/* BEC Quiz Engine — shared across all 41 quiz pages */

/* Detect level/group from URL for back button */
function _seDetectContext() {
  const parts  = window.location.pathname.replace(/\\/g,'/').split('/');
  const folder = parts[parts.length - 2];
  const file   = parts[parts.length - 1];
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

/* ── Topic order for Prev/Next navigation ── */
const _TOPICS = [
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

function _topicNav() {
  const parts = window.location.pathname.split('/');
  const fn     = parts[parts.length - 1];
  const folder = parts[parts.length - 2];
  const isQuiz = fn.endsWith('-quiz.html');
  const suffix = isQuiz ? '-quiz.html' : '-study.html';
  const base   = fn.replace(/-quiz\.html$/, '').replace(/-study\.html$/, '');
  const slug   = folder + '/' + base;
  const idx    = _TOPICS.indexOf(slug);
  if (idx === -1) return null;
  const makeUrl = s => {
    const nf = s.split('/')[0], nb = s.split('/')[1] + suffix;
    return nf === folder ? nb : '../' + nf + '/' + nb;
  };
  return {
    prev: idx > 0 ? makeUrl(_TOPICS[idx - 1]) : null,
    next: idx < _TOPICS.length - 1 ? makeUrl(_TOPICS[idx + 1]) : null,
    pos:  idx + 1,
    total: _TOPICS.length,
  };
}

class QuizEngine {
  constructor(data) {
    this.d = data;
    this.tab = 'mcq';
    this.mcqIdx = 0; this.mcqScore = 0; this.mcqDone = false;
    this.matchSel = null; this.matchMatched = new Set(); this.matchScore = 0;
    this.fcIdx = 0; this.fcFlipped = false;
    this.blankInputs = []; this.blankChecked = false;
    this.chalIdx = 0; this.chalScore = 0; this.chalTime = 60;
    this.chalTimer = null; this.chalDone = false; this._chalWrong = [];
    this._labelPlaced = {}; this._labelSelected = null; this._labelChecked = false; this._labelOrder = null;
    this._apply();
    this._build();
    this._go('mcq');
  }

  _apply() {
    const s = document.documentElement.style;
    s.setProperty('--qc', this.d.color || '#1565c0');
    s.setProperty('--qd', this.d.dark  || '#003c8f');
    s.setProperty('--ql', this.d.light || '#e3f2fd');
  }

  _build() {
    document.body.style.cssText = 'margin:0;font-family:system-ui,sans-serif;background:#f5f5f5;min-height:100vh';
    document.body.innerHTML = `
    <style>
      :root{--qc:#1565c0;--qd:#003c8f;--ql:#e3f2fd}
      *{box-sizing:border-box}
      #qz-top{background:var(--qd);color:#fff;padding:10px 16px;display:flex;align-items:center;gap:12px;position:sticky;top:0;z-index:100;box-shadow:0 2px 8px rgba(0,0,0,.3)}
      #qz-top a{color:#fff;text-decoration:none;font-size:.85rem;opacity:.8;padding:4px 10px;border:1px solid rgba(255,255,255,.3);border-radius:6px}
      #qz-top a:hover{opacity:1;background:rgba(255,255,255,.15)}
      #qz-title{flex:1;font-size:.95rem;font-weight:700;line-height:1.2}
      #qz-tabs{display:flex;overflow-x:auto;background:#fff;border-bottom:2px solid #e0e0e0;padding:0 8px;gap:0;scrollbar-width:none}
      #qz-tabs::-webkit-scrollbar{display:none}
      .qz-tab{padding:12px 14px;font-size:.78rem;font-weight:700;color:#777;border:none;background:none;cursor:pointer;white-space:nowrap;border-bottom:3px solid transparent;margin-bottom:-2px;font-family:inherit;transition:all .15s}
      .qz-tab:hover{color:var(--qc)}
      .qz-tab.active{color:var(--qc);border-bottom-color:var(--qc)}
      #qz-content{max-width:800px;margin:0 auto;padding:20px 16px 80px}

      /* MCQ */
      .qz-q{background:#fff;border-radius:10px;padding:18px;margin-bottom:14px;box-shadow:0 1px 4px rgba(0,0,0,.08)}
      .qz-q-text{font-size:.88rem;font-weight:700;margin-bottom:14px;line-height:1.5}
      .qz-opts{display:grid;grid-template-columns:1fr 1fr;gap:8px}
      @media(max-width:500px){.qz-opts{grid-template-columns:1fr}}
      .qz-opt{padding:10px 12px;border-radius:8px;border:1.5px solid #ddd;background:#fff;font-size:.82rem;cursor:pointer;text-align:left;font-family:inherit;transition:all .15s;line-height:1.4}
      .qz-opt:hover:not(:disabled){border-color:var(--qc);background:var(--ql)}
      .qz-opt.correct{background:#e8f5e9;border-color:#2e7d32;color:#1b5e20;font-weight:700}
      .qz-opt.wrong{background:#ffebee;border-color:#c62828;color:#b71c1c}
      .qz-exp{margin-top:10px;font-size:.8rem;background:var(--ql);border-left:3px solid var(--qc);padding:8px 12px;border-radius:0 6px 6px 0;line-height:1.5;color:#333}
      .qz-score-bar{background:#fff;border-radius:10px;padding:16px;text-align:center;margin-bottom:16px;box-shadow:0 1px 4px rgba(0,0,0,.08)}
      .qz-score-num{font-size:2rem;font-weight:800;color:var(--qc)}
      .qz-score-label{font-size:.8rem;color:#888;margin-top:4px}
      .qz-restart{margin-top:10px;padding:10px 24px;background:var(--qc);color:#fff;border:none;border-radius:8px;font-size:.85rem;font-weight:700;cursor:pointer;font-family:inherit}
      .qz-restart:hover{opacity:.85}

      /* Wrong answers review */
      .qz-wrong-section{margin-top:8px}
      .qz-wrong-head{font-size:.72rem;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:#b71c1c;margin:16px 0 10px;display:flex;align-items:center;gap:7px}
      .qz-wrong-head::after{content:'';flex:1;height:1px;background:#ffcdd2}
      .qz-correct-lbl{display:inline-block;font-size:.78rem;font-weight:700;color:#2e7d32;background:#e8f5e9;border-radius:5px;padding:5px 10px;margin-bottom:6px}
      .qz-wrong-none{font-size:.85rem;color:#2e7d32;font-weight:700;background:#e8f5e9;border-radius:8px;padding:12px 14px;margin-top:8px}

      /* Match */
      .match-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px}
      .match-col-head{font-size:.75rem;font-weight:700;color:#888;text-transform:uppercase;margin-bottom:6px;text-align:center}
      .match-item{padding:10px 12px;border-radius:8px;border:1.5px solid #ddd;background:#fff;font-size:.8rem;cursor:pointer;text-align:center;transition:all .15s;line-height:1.4;min-height:44px;display:flex;align-items:center;justify-content:center;font-family:inherit}
      .match-item:hover:not(.matched):not(:disabled){border-color:var(--qc);background:var(--ql)}
      .match-item.selected{border-color:var(--qc);background:var(--ql);box-shadow:0 0 0 2px var(--qc)}
      .match-item.matched{background:#e8f5e9;border-color:#2e7d32;color:#1b5e20;cursor:default;opacity:.75}
      .match-item.wrong{background:#ffebee;border-color:#c62828;animation:shake .3s}
      @keyframes shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}

      /* Flashcards */
      .fc-wrap{perspective:1000px;margin:16px auto;max-width:480px;cursor:pointer}
      .fc-inner{position:relative;width:100%;height:200px;transform-style:preserve-3d;transition:transform .5s}
      .fc-inner.flipped{transform:rotateY(180deg)}
      .fc-face{position:absolute;width:100%;height:100%;backface-visibility:hidden;border-radius:14px;display:flex;align-items:center;justify-content:center;padding:24px;text-align:center;box-shadow:0 2px 12px rgba(0,0,0,.12)}
      .fc-front{background:var(--qc);color:#fff;font-size:1rem;font-weight:700;line-height:1.5}
      .fc-back{background:#fff;color:#333;font-size:.88rem;line-height:1.6;transform:rotateY(180deg);border:2px solid var(--qc)}
      .fc-hint{text-align:center;font-size:.78rem;color:#999;margin-bottom:8px}
      .fc-nav{display:flex;align-items:center;gap:12px;justify-content:center;margin:14px 0}
      .fc-nav button{padding:8px 20px;border-radius:8px;border:1.5px solid var(--qc);background:#fff;color:var(--qc);font-size:.85rem;font-weight:700;cursor:pointer;font-family:inherit}
      .fc-nav button:hover{background:var(--ql)}
      .fc-nav button:disabled{opacity:.35;cursor:not-allowed}
      .fc-counter{font-size:.82rem;color:#888}

      /* Fill blanks */
      .blanks-passage{background:#fff;border-radius:10px;padding:18px;font-size:.88rem;line-height:2;box-shadow:0 1px 4px rgba(0,0,0,.08);margin-bottom:14px}
      .blank-input{display:inline-block;border:none;border-bottom:2px solid var(--qc);width:90px;font-size:.85rem;text-align:center;background:transparent;outline:none;font-family:inherit;color:#333;padding:0 2px}
      .blank-input.correct{border-color:#2e7d32;background:#e8f5e9;color:#1b5e20;border-radius:4px;padding:0 4px}
      .blank-input.wrong{border-color:#c62828;background:#ffebee;color:#b71c1c;border-radius:4px;padding:0 4px}
      .blanks-wordbank{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px}
      .bank-word{padding:6px 12px;border-radius:20px;background:var(--ql);border:1.5px solid var(--qc);color:var(--qd);font-size:.8rem;font-weight:700;cursor:pointer;transition:all .15s}
      .bank-word:hover{background:var(--qc);color:#fff}
      .bank-word.used{opacity:.4;cursor:not-allowed}

      /* Sentences */
      .sent-card{background:#fff;border-radius:10px;padding:18px;margin-bottom:14px;box-shadow:0 1px 4px rgba(0,0,0,.08)}
      .sent-keywords{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px}
      .sent-kw{padding:4px 10px;border-radius:12px;background:var(--qd);color:#fff;font-size:.78rem;font-weight:700}
      .sent-ta{width:100%;border:1.5px solid #ddd;border-radius:8px;padding:10px 12px;font-size:.85rem;font-family:inherit;resize:vertical;min-height:70px;line-height:1.5}
      .sent-ta:focus{outline:none;border-color:var(--qc)}
      .sent-hint{font-size:.76rem;color:#888;margin-top:6px;font-style:italic}

      /* Challenge */
      .chal-timer{font-size:3rem;font-weight:900;color:var(--qc);text-align:center;margin:8px 0}
      .chal-timer.warning{color:#e53935;animation:pulse .5s infinite alternate}
      @keyframes pulse{from{opacity:1}to{opacity:.4}}
      .chal-progress{height:6px;background:#e0e0e0;border-radius:3px;margin-bottom:16px;overflow:hidden}
      .chal-bar{height:100%;background:var(--qc);transition:width .3s;border-radius:3px}
      .chal-start{display:flex;flex-direction:column;align-items:center;gap:14px;padding:40px 0}
      .chal-start-btn{padding:14px 40px;background:var(--qc);color:#fff;border:none;border-radius:10px;font-size:1.1rem;font-weight:800;cursor:pointer;font-family:inherit}

      .qz-section-head{font-size:.75rem;font-weight:800;text-transform:uppercase;color:#888;margin:0 0 10px;letter-spacing:.05em}
      .qz-badge{display:inline-flex;align-items:center;gap:6px;padding:4px 12px;border-radius:20px;font-size:.75rem;font-weight:700;background:var(--ql);color:var(--qd);margin-bottom:14px}

      /* Topic nav footer */
      #qz-footer{position:fixed;bottom:0;left:0;right:0;background:var(--qd);z-index:99;
        display:flex;align-items:center;justify-content:space-between;
        padding:9px 16px;box-shadow:0 -2px 8px rgba(0,0,0,.25);gap:8px}
      #qz-footer a{color:#fff;text-decoration:none;padding:7px 14px;border-radius:7px;
        border:1px solid rgba(255,255,255,.28);font-size:.78rem;font-weight:700;
        white-space:nowrap;transition:background .15s}
      #qz-footer a:hover{background:rgba(255,255,255,.15)}
      .qz-ft-dis{color:rgba(255,255,255,.28);padding:7px 14px;font-size:.78rem;font-weight:700;white-space:nowrap}
      .qz-ft-mid{font-size:.72rem;color:rgba(255,255,255,.55);text-align:center;flex:1;line-height:1.3}

      /* Label It */
      .lbl-hs{position:absolute;min-width:70px;height:26px;transform:translate(-50%,-50%);
        background:rgba(255,255,255,.93);border:2px dashed #aaa;border-radius:6px;
        display:flex;align-items:center;justify-content:center;cursor:pointer;
        font-size:.71rem;font-weight:700;color:#666;padding:0 6px;
        transition:all .15s;z-index:5;white-space:nowrap}
      .lbl-hs:hover:not(.correct):not(.wrong){border-color:var(--qc);background:var(--ql)}
      .lbl-hs.target{border-color:var(--qc);background:var(--ql);border-style:solid;
        animation:pulse-hs .7s ease infinite alternate}
      @keyframes pulse-hs{from{box-shadow:0 0 0 0 rgba(21,101,192,.3)}to{box-shadow:0 0 0 5px rgba(21,101,192,.12)}}
      .lbl-hs.filled{border-style:solid;border-color:#546e7a;color:#111}
      .lbl-hs.correct{border-style:solid;border-color:#2e7d32!important;background:#e8f5e9!important;color:#1b5e20!important}
      .lbl-hs.wrong{border-style:solid;border-color:#c62828!important;background:#ffebee!important;color:#b71c1c!important}
      .lbl-bank{display:flex;flex-wrap:wrap;gap:8px;margin-top:6px}
      .lbl-word{padding:7px 14px;border-radius:20px;background:var(--ql);border:1.5px solid var(--qc);
        color:var(--qd);font-size:.8rem;font-weight:700;cursor:pointer;transition:all .15s;font-family:inherit}
      .lbl-word:hover:not(.used){background:var(--qc);color:#fff}
      .lbl-word.sel{background:var(--qc);color:#fff;box-shadow:0 0 0 3px rgba(21,101,192,.25)}
      .lbl-word.used{opacity:.35;cursor:not-allowed;text-decoration:line-through}
    </style>
    <div id="qz-top">
      <a href="${(()=>{ const ctx=_seDetectContext(); return ctx?ctx.backUrl:(this.d.backUrl||'../../index.html'); })()}">${(()=>{ const ctx=_seDetectContext(); return ctx?ctx.backLabel:'← Home'; })()}</a>
      <div id="qz-title">${this.d.title||'Quiz'}</div>
      <div id="bec-hearts-bar" style="display:flex;gap:3px;align-items:center;flex-shrink:0"></div>
    </div>
    <div id="qz-tabs">
      <button class="qz-tab" data-tab="mcq">Multiple Choice</button>
      <button class="qz-tab" data-tab="match">Match Terms</button>
      <button class="qz-tab" data-tab="fc">Flashcards</button>
      <button class="qz-tab" data-tab="blanks">Fill in Blanks</button>
      <button class="qz-tab" data-tab="sentences">Sentences</button>
      <button class="qz-tab" data-tab="challenge">Challenge</button>
      ${this.d.label ? '<button class="qz-tab" data-tab="label">🔬 Label It</button>' : ''}
    </div>
    <div id="qz-content"></div>
    <div id="qz-footer"></div>`;

    document.querySelectorAll('.qz-tab').forEach(btn => {
      btn.addEventListener('click', () => this._go(btn.dataset.tab));
    });

    // Render topic nav footer
    const nav = _topicNav();
    if (nav) {
      document.getElementById('qz-footer').innerHTML =
        (nav.prev ? `<a href="${nav.prev}">← Prev</a>` : `<span class="qz-ft-dis">← Prev</span>`) +
        `<div class="qz-ft-mid">Topic ${nav.pos} / ${nav.total}<br><small style="opacity:.7">Quiz</small></div>` +
        (nav.next ? `<a href="${nav.next}">Next →</a>` : `<span class="qz-ft-dis">Next →</span>`);
    } else {
      document.getElementById('qz-footer').style.display = 'none';
    }
  }

  _go(tab) {
    if (this.chalTimer) { clearInterval(this.chalTimer); this.chalTimer = null; }
    this.tab = tab;
    document.querySelectorAll('.qz-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    const map = {mcq:()=>this._mcq(), match:()=>this._match(), fc:()=>this._fc(),
                  blanks:()=>this._blanks(), sentences:()=>this._sents(), challenge:()=>this._chal(),
                  label:()=>this._label()};
    (map[tab]||map.mcq)();
    document.getElementById('qz-content').scrollTop = 0;
    window.scrollTo(0, 0);
  }

  /* ─── MCQ ─── */
  _mcq() {
    const qs = this.d.mcq || [];
    let html = `<p class="qz-section-head">Multiple Choice — ${qs.length} Questions</p>`;
    if (this.mcqDone) {
      const pct = Math.round((this.mcqScore / qs.length) * 100);
      html += `<div class="qz-score-bar">
        <div class="qz-score-num">${this.mcqScore}/${qs.length}</div>
        <div class="qz-score-label">${pct}% — ${pct>=80?'Excellent! 🏆':pct>=60?'Good work 👍':'Keep practising 📚'}</div>
        <button class="qz-restart" onclick="QE._resetMCQ()">Try Again</button>
      </div>`;
      // Wrong answers review
      html += this._wrongReviewHtml(qs, this._mcqAnswers || {});
    }
    qs.forEach((q, qi) => {
      html += `<div class="qz-q" id="mcq-${qi}">
        <div class="qz-q-text">${qi+1}. ${q.q}</div>
        <div class="qz-opts">
          ${q.opts.map((o,oi) => `<button class="qz-opt" onclick="QE._pickMCQ(${qi},${oi})">${o}</button>`).join('')}
        </div>
      </div>`;
    });
    if (!this.mcqDone) {
      html += `<button class="qz-restart" onclick="QE._submitMCQ()">Submit Answers</button>`;
    }
    document.getElementById('qz-content').innerHTML = html;
    this._mcqAnswers = this._mcqAnswers || {};
    Object.entries(this._mcqAnswers).forEach(([qi, chosen]) => this._markMCQ(+qi, +chosen, false));
  }

  _pickMCQ(qi, chosen) {
    if ((this._mcqAnswers||{})[qi] !== undefined) return;
    this._mcqAnswers = this._mcqAnswers || {};
    this._mcqAnswers[qi] = chosen;
    this._markMCQ(qi, chosen, true);
    const correct = chosen === this.d.mcq[qi].ans;
    if (correct) { window.BEC?.addXP(10, 'Correct answer'); window.BEC?.recordCorrect(); }
    else           window.BEC?.loseHeart();
  }

  _markMCQ(qi, chosen, live) {
    const q = this.d.mcq[qi];
    const box = document.getElementById(`mcq-${qi}`);
    if (!box) return;
    box.querySelectorAll('.qz-opt').forEach((btn, oi) => {
      btn.disabled = true;
      if (oi === q.ans) btn.classList.add('correct');
      else if (oi === chosen && chosen !== q.ans) btn.classList.add('wrong');
    });
    if (q.exp) {
      const expDiv = document.createElement('div');
      expDiv.className = 'qz-exp'; expDiv.innerHTML = q.exp;
      box.appendChild(expDiv);
    }
  }

  _submitMCQ() {
    this._mcqAnswers = this._mcqAnswers || {};
    const qs = this.d.mcq || [];
    qs.forEach((q, qi) => {
      if (this._mcqAnswers[qi] === undefined) this._mcqAnswers[qi] = -1;
    });
    this.mcqScore = qs.filter((q, qi) => this._mcqAnswers[qi] === q.ans).length;
    this.mcqDone = true;
    const pct = Math.round(this.mcqScore / qs.length * 100);
    if (pct === 100) { window.BEC?.markPerfectQuiz(); window.BEC?.confetti(); window.BEC?.addXP(30, 'Perfect MCQ!'); }
    else if (pct >= 80) { window.BEC?.addXP(20, 'Great quiz score'); window.BEC?.setCrown(window.BEC?.getSlug(), 3); }
    else                  window.BEC?.addXP(10, 'Quiz submitted');
    if (pct >= 80)        window.BEC?.setCrown(window.BEC?.getSlug(), 3);
    this._mcq();
  }

  _resetMCQ() {
    this.mcqDone = false; this.mcqScore = 0; this._mcqAnswers = {};
    this._mcq();
  }

  /* ─── Wrong Answers Review helper ─── */
  _wrongReviewHtml(qs, answers) {
    const wrongs = qs.reduce((acc, q, qi) => {
      if ((answers[qi] ?? -1) !== q.ans) acc.push({q, qi});
      return acc;
    }, []);
    if (!wrongs.length) {
      return `<div class="qz-wrong-none">✅ Perfect score — no wrong answers to review!</div>`;
    }
    return `<div class="qz-wrong-section">
      <div class="qz-wrong-head">Wrong Answers Review &mdash; ${wrongs.length} to revisit</div>
      ${wrongs.map(({q, qi}) => `
        <div class="qz-q">
          <div class="qz-q-text">${qi+1}. ${q.q}</div>
          <div class="qz-correct-lbl">✓ Correct answer: ${q.opts[q.ans]}</div>
          <div class="qz-exp">${q.exp}</div>
        </div>`).join('')}
    </div>`;
  }

  /* ─── MATCH ─── */
  _match() {
    const pairs = this.d.match || [];
    this.matchMatched = new Set(); this.matchSel = null; this.matchScore = 0;
    this._matchDefs = [...pairs].sort(() => Math.random() - 0.5).map((p, i) => ({...p, idx: i}));
    this._renderMatch();
  }

  _renderMatch() {
    const pairs = this.d.match || [];
    let html = `<p class="qz-section-head">Match Terms to Definitions</p>
      <p style="font-size:.78rem;color:#888;margin-bottom:14px">Click a TERM, then click its matching DEFINITION.</p>
      <div class="match-grid">
        <div>
          <div class="match-col-head">Terms</div>
          ${pairs.map((p, i) => {
            const matched = [...this.matchMatched].some(m => m === i);
            return `<button class="match-item ${matched?'matched':''} ${this.matchSel===i?'selected':''}"
              onclick="QE._selTerm(${i})" id="mt-${i}">${p.term}</button>`;
          }).join('')}
        </div>
        <div>
          <div class="match-col-head">Definitions</div>
          ${this._matchDefs.map((p, i) => {
            const matched = [...this.matchMatched].some(m => this.d.match[m].def === p.def);
            return `<button class="match-item ${matched?'matched':''}"
              onclick="QE._selDef(${i})" id="md-${i}">${p.def}</button>`;
          }).join('')}
        </div>
      </div>`;
    if (this.matchMatched.size === pairs.length) {
      const pct = Math.round((this.matchScore / pairs.length) * 100);
      html += `<div class="qz-score-bar">
        <div class="qz-score-num">${this.matchScore}/${pairs.length} correct</div>
        <div class="qz-score-label">${pct}%</div>
        <button class="qz-restart" onclick="QE._match()">Play Again</button>
      </div>`;
    }
    document.getElementById('qz-content').innerHTML = html;
  }

  _selTerm(i) {
    if ([...this.matchMatched].some(m => m === i)) return;
    this.matchSel = this.matchSel === i ? null : i;
    this._renderMatch();
  }

  _selDef(di) {
    if (this.matchSel === null) return;
    const ti = this.matchSel;
    const correctDef = this.d.match[ti].def;
    const selectedDef = this._matchDefs[di].def;
    if (correctDef === selectedDef) {
      this.matchMatched.add(ti); this.matchScore++; this.matchSel = null;
      if (this.matchMatched.size === this.d.match.length) window.BEC?.addXP(20, 'Match complete');
      this._renderMatch();
    } else {
      this._renderMatch();
      const termBtn = document.getElementById(`mt-${ti}`);
      const defBtn  = document.getElementById(`md-${di}`);
      [termBtn, defBtn].forEach(b => { if(b){b.classList.add('wrong');setTimeout(()=>b.classList.remove('wrong'),600);} });
      this.matchSel = null;
      setTimeout(() => this._renderMatch(), 700);
    }
  }

  /* ─── FLASHCARDS ─── */
  _fc() { this.fcIdx = 0; this.fcFlipped = false; this._renderFC(); }

  _renderFC() {
    const cards = this.d.flashcards || [];
    const c = cards[this.fcIdx];
    document.getElementById('qz-content').innerHTML = `
      <p class="qz-section-head">Flashcards — ${cards.length} cards</p>
      <p class="fc-hint">Click the card to reveal the answer</p>
      <div class="fc-wrap" onclick="QE._flipFC()">
        <div class="fc-inner ${this.fcFlipped?'flipped':''}">
          <div class="fc-face fc-front">${c.q}</div>
          <div class="fc-face fc-back">${c.a}</div>
        </div>
      </div>
      <div class="fc-nav">
        <button onclick="QE._fcNav(-1)" ${this.fcIdx===0?'disabled':''}>← Prev</button>
        <span class="fc-counter">${this.fcIdx+1} / ${cards.length}</span>
        <button onclick="QE._fcNav(1)" ${this.fcIdx===cards.length-1?'disabled':''}>Next →</button>
      </div>`;
  }

  _flipFC() { this.fcFlipped = !this.fcFlipped; this._renderFC(); }
  _fcNav(dir) { this.fcFlipped = false; this.fcIdx = Math.max(0, Math.min(this.d.flashcards.length-1, this.fcIdx+dir)); this._renderFC(); }

  /* ─── FILL IN BLANKS ─── */
  _blanks() {
    const b = this.d.blanks || {};
    this.blankChecked = false;
    this._blankSelected = null;
    this._blankFilled = Array((b.answers||[]).length).fill('');
    this._renderBlanks();
  }

  _renderBlanks() {
    const b = this.d.blanks || {};
    const answers = b.answers || [];
    let bIdx = 0;
    const passage = (b.passage||'').replace(/\[_\]/g, () => {
      const i = bIdx++;
      const val = this._blankFilled[i] || '';
      const cls = this.blankChecked ? (val.toLowerCase().trim()===answers[i].toLowerCase().trim()?'correct':'wrong') : '';
      return `<input class="blank-input ${cls}" id="blank-${i}" value="${val}" ${this.blankChecked?'readonly':''}
        onclick="QE._selectBlank(${i})" onchange="QE._blankFilled[${i}]=this.value" placeholder="...">`;
    });
    const bankWords = (b.wordbank || answers).map((w, i) => ({w, i}));
    let html = `<p class="qz-section-head">Fill in the Blanks</p>
      <p style="font-size:.78rem;color:#888;margin-bottom:10px">Click a word from the bank, then click a blank — or type directly.</p>
      <div class="blanks-wordbank">
        ${bankWords.map(({w,i}) => `<button class="bank-word ${this._blankFilled.includes(w)&&this.blankChecked?'used':''}"
          onclick="QE._useWord('${w.replace(/'/g,"&#39;")}')">${w}</button>`).join('')}
      </div>
      <div class="blanks-passage">${passage}</div>`;
    if (this.blankChecked) {
      const correct = this._blankFilled.filter((v,i)=>v.toLowerCase().trim()===answers[i].toLowerCase().trim()).length;
      html += `<div class="qz-score-bar">
        <div class="qz-score-num">${correct}/${answers.length}</div>
        <div class="qz-score-label">Words correct</div>
        <button class="qz-restart" onclick="QE._blanks()">Try Again</button>
      </div>`;
    } else {
      html += `<button class="qz-restart" onclick="QE._checkBlanks()">Check Answers</button>`;
    }
    document.getElementById('qz-content').innerHTML = html;
  }

  _selectBlank(i) { this._blankSelected = i; }

  _useWord(w) {
    if (this.blankChecked) return;
    const i = this._blankSelected;
    if (i !== null && i !== undefined && i < (this.d.blanks?.answers||[]).length) {
      this._blankFilled[i] = w;
      this._blankSelected = null;
      this._renderBlanks();
    }
  }

  _checkBlanks() {
    (this.d.blanks?.answers||[]).forEach((_, i) => {
      const el = document.getElementById(`blank-${i}`);
      if (el) this._blankFilled[i] = el.value;
    });
    this.blankChecked = true;
    this._renderBlanks();
  }

  /* ─── SENTENCES ─── */
  _sents() {
    const ss = this.d.sentences || [];
    document.getElementById('qz-content').innerHTML = `
      <p class="qz-section-head">Sentences — Use the Keywords</p>
      <p style="font-size:.78rem;color:#888;margin-bottom:14px">Write a sentence that correctly uses ALL the keywords shown.</p>
      ${ss.map((s, i) => `
        <div class="sent-card">
          <div class="qz-q-text">${i+1}. ${s.prompt}</div>
          <div class="sent-keywords">${s.keywords.map(k=>`<span class="sent-kw">${k}</span>`).join('')}</div>
          <textarea class="sent-ta" placeholder="Type your sentence here using all keywords..." id="sent-${i}"></textarea>
          <div class="sent-hint">${s.hint||''}</div>
        </div>`).join('')}
      <p style="font-size:.78rem;color:#888;margin-top:6px">Review your sentences — they cannot be auto-marked but use them to self-check against your notes.</p>`;
  }

  /* ─── CHALLENGE ─── */
  _chal() {
    this.chalIdx = 0; this.chalScore = 0; this.chalDone = false; this.chalTime = 60;
    this._chalWrong = [];
    if (this.chalTimer) clearInterval(this.chalTimer);
    document.getElementById('qz-content').innerHTML = `
      <p class="qz-section-head">60-Second Challenge</p>
      <div class="chal-start">
        <div style="font-size:1rem;text-align:center;color:#555;max-width:320px">Answer as many questions as you can in <strong>60 seconds</strong>. No explanations — speed counts!</div>
        <button class="chal-start-btn" onclick="QE._startChal()">Start ⏱</button>
      </div>`;
  }

  _startChal() {
    this._chalQs = [...(this.d.mcq||[]), ...(this.d.challenge||[])].sort(()=>Math.random()-.5);
    if (!this._chalQs.length) return;
    this.chalIdx = 0; this.chalScore = 0; this.chalTime = 60; this._chalWrong = [];
    this.chalTimer = setInterval(() => {
      this.chalTime--;
      const el = document.getElementById('chal-timer');
      if (el) { el.textContent = this.chalTime+'s'; el.className = 'chal-timer'+(this.chalTime<=10?' warning':''); }
      if (this.chalTime <= 0) { clearInterval(this.chalTimer); this.chalTimer = null; this._chalEnd(); }
    }, 1000);
    this._renderChal();
  }

  _renderChal() {
    const qs = this._chalQs;
    if (this.chalIdx >= qs.length) { this._chalEnd(); return; }
    const q = qs[this.chalIdx];
    document.getElementById('qz-content').innerHTML = `
      <p class="qz-section-head">60-Second Challenge</p>
      <div id="chal-timer" class="chal-timer">${this.chalTime}s</div>
      <div class="chal-progress"><div class="chal-bar" style="width:${(this.chalIdx/qs.length)*100}%"></div></div>
      <div class="qz-q">
        <div class="qz-q-text">${q.q}</div>
        <div class="qz-opts">
          ${q.opts.map((o,oi)=>`<button class="qz-opt" onclick="QE._pickChal(${oi})">${o}</button>`).join('')}
        </div>
      </div>
      <div style="text-align:center;font-size:.8rem;color:#888">Question ${this.chalIdx+1} of ${qs.length} • Score: ${this.chalScore}</div>`;
  }

  _pickChal(chosen) {
    const q = this._chalQs[this.chalIdx];
    if (chosen === q.ans) {
      this.chalScore++;
    } else {
      this._chalWrong.push({q, chosen});
      window.BEC?.loseHeart();
    }
    this.chalIdx++;
    this._renderChal();
  }

  _chalEnd() {
    if (this.chalTimer) { clearInterval(this.chalTimer); this.chalTimer = null; }
    const total    = this._chalQs.length;
    const answered = this.chalIdx || 1;
    const pct      = Math.round((this.chalScore / answered) * 100);
    window.BEC?.addXP(this.chalScore * 5, '60s Challenge');
    window.BEC?.recordChallengeScore(this.chalScore);
    if (this.chalScore >= 10) window.BEC?.confetti();
    let html = `
      <p class="qz-section-head">60-Second Challenge — Results</p>
      <div class="qz-score-bar">
        <div class="qz-score-num">${this.chalScore}/${this.chalIdx}</div>
        <div class="qz-score-label">${pct}% accuracy in 60 seconds${pct>=80?' 🏆':pct>=60?' 👍':' — keep practising!'}</div>
        <button class="qz-restart" onclick="QE._chal()">Play Again</button>
      </div>`;
    // Wrong answers review
    if (this._chalWrong.length) {
      html += `<div class="qz-wrong-section">
        <div class="qz-wrong-head">Wrong Answers Review &mdash; ${this._chalWrong.length} to revisit</div>
        ${this._chalWrong.map(({q, chosen}) => `
          <div class="qz-q">
            <div class="qz-q-text">${q.q}</div>
            <div style="font-size:.8rem;color:#b71c1c;margin-bottom:4px">✗ You chose: ${q.opts[chosen]}</div>
            <div class="qz-correct-lbl">✓ Correct answer: ${q.opts[q.ans]}</div>
            <div class="qz-exp">${q.exp||''}</div>
          </div>`).join('')}
      </div>`;
    } else if (this.chalIdx > 0) {
      html += `<div class="qz-wrong-none">✅ Perfect — no wrong answers!</div>`;
    }
    document.getElementById('qz-content').innerHTML = html;
  }

  /* ─── LABEL IT ─── */
  _label() {
    const L = this.d.label;
    if (!this._labelOrder) {
      this._labelOrder = [...L.hotspots].sort(() => Math.random() - 0.5);
    }
    const sel = this._labelSelected;
    const hotspotHtml = L.hotspots.map(h => {
      const placed = this._labelPlaced[h.id];
      let cls = 'lbl-hs';
      if (placed && this._labelChecked) cls += placed === h.answer ? ' correct' : ' wrong';
      else if (placed) cls += ' filled';
      else if (sel) cls += ' target';
      return `<div class="${cls}" style="left:${h.x}%;top:${h.y}%"
        onclick="QE._placeLabel('${h.id}')" title="${placed||'Click to label'}">${placed || '?'}</div>`;
    }).join('');

    const bankHtml = this._labelOrder.map(h => {
      const used = Object.values(this._labelPlaced).includes(h.answer);
      return `<button class="lbl-word${used?' used':''}${sel===h.answer?' sel':''}"
        onclick="QE._selectLabel('${h.answer.replace(/'/g,"&#39;")}')">${h.answer}</button>`;
    }).join('');

    const allPlaced = Object.keys(this._labelPlaced).length === L.hotspots.length;
    const checked   = this._labelChecked;
    const correct   = checked ? L.hotspots.filter(h => this._labelPlaced[h.id] === h.answer).length : 0;
    const pct       = checked ? Math.round(correct / L.hotspots.length * 100) : 0;

    let html = `<p class="qz-section-head">${L.title || 'Label the Diagram'}</p>`;
    if (checked) {
      html += `<div class="qz-score-bar" style="margin-bottom:12px">
        <div class="qz-score-num">${correct} / ${L.hotspots.length}</div>
        <div class="qz-score-label">${pct}%${pct===100?' — Perfect! 🏆':pct>=60?' — Good work!':' — Review and try again'}</div>
        <button class="qz-restart" onclick="QE._resetLabel()">Try Again</button>
      </div>`;
    } else {
      html += `<p style="font-size:.76rem;color:#888;margin-bottom:10px">${
        sel
          ? `<strong style="color:var(--qc)">"${sel}"</strong> selected — now click where it belongs on the diagram`
          : 'Select a label from the word bank, then click the matching part of the diagram.'
      }</p>`;
    }

    html += `<div id="lbl-wrap"
        style="position:relative;width:100%;max-width:420px;aspect-ratio:400/340;display:block">
        ${L.svg}${hotspotHtml}
      </div>`;

    if (!checked) {
      html += `<div style="margin-top:14px">
        <p class="qz-section-head" style="margin-bottom:8px">Word Bank</p>
        <div class="lbl-bank">${bankHtml}</div>
      </div>`;
      if (allPlaced) {
        html += `<button class="qz-restart" onclick="QE._checkLabels()" style="margin-top:14px">Check Labels ✓</button>`;
      }
    }

    document.getElementById('qz-content').innerHTML = html;
  }

  _selectLabel(answer) {
    this._labelSelected = this._labelSelected === answer ? null : answer;
    this._label();
  }

  _placeLabel(hotspotId) {
    if (!this._labelSelected) return;
    this._labelPlaced[hotspotId] = this._labelSelected;
    this._labelSelected = null;
    this._label();
  }

  _checkLabels() {
    this._labelChecked = true;
    this._labelSelected = null;
    this._label();
  }

  _resetLabel() {
    this._labelPlaced = {};
    this._labelSelected = null;
    this._labelChecked = false;
    this._labelOrder = null;
    this._label();
  }
}

// Global reference so inline onclick handlers can reach it
let QE;
function initQuiz(data) {
  QE = new QuizEngine(data);
}

/* ── BEC / Firebase init for standalone quiz pages ─────────────────────────
   Starts loading Firebase + game.js immediately when quiz-engine.js loads,
   so auth is resolved well before the user answers their first question.
   Uses _cloudLoaded guard in game.js to prevent data corruption.
──────────────────────────────────────────────────────────────────────────── */
(function _becInitQuiz() {
  if (window.BEC && window._becDB && window._becUID) return; // already set by index.html

  const me = document.querySelector('script[src*="quiz-engine"]');
  if (!me) return;
  const base = me.src.replace(/quiz-engine\.js.*$/, '');

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
        BEC.loadFromCloud().catch(function() {});
      }
    });
  });
})();
