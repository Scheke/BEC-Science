/* BEC Game Engine — XP, Streaks, Hearts, Crowns, Badges (Firestore-backed) */
const BEC = (() => {
  'use strict';

  /* ── Constants ── */
  const HEART_MAX = 5;
  const HEART_MS  = 30 * 60 * 1000; // 30 min per heart refill

  /* ── Firestore helpers ── */
  // db and currentUID are set by index.html after Firebase initialises
  function _uid() {
    return window._becUID || null;
  }

  function _docRef() {
    if (!window._becDB || !_uid()) return null;
    return window._becDB.collection('users').doc(_uid());
  }

  async function _saveToCloud(data) {
    const ref = _docRef();
    if (!ref) return;
    try {
      await ref.set(data, { merge: true });
    } catch(e) { console.warn('BEC cloud save failed', e); }
  }

  async function _loadFromCloud() {
    const ref = _docRef();
    if (!ref) return null;
    try {
      const snap = await ref.get();
      return snap.exists ? snap.data() : null;
    } catch(e) { console.warn('BEC cloud load failed', e); return null; }
  }

  const LEVELS = [
    { name:'Seedling',  icon:'🌱', min:0    },
    { name:'Explorer',  icon:'🔍', min:100  },
    { name:'Scientist', icon:'🔬', min:300  },
    { name:'Analyst',   icon:'🧪', min:700  },
    { name:'Expert',    icon:'🧠', min:1200 },
    { name:'Master',    icon:'🏆', min:2000 },
  ];

  /* Topic slug lists — used by badge checkers */
  const _SLUGS = {
    psle: ['psle/std5-scientific-processes','psle/std5-classification','psle/std5-food-chains',
           'psle/std5-states-of-matter','psle/std5-nutrition','psle/std6-human-body',
           'psle/std6-forces-motion','psle/std6-electricity','psle/std6-reproductive-health',
           'psle/std7-solar-system','psle/std7-advanced-systems','psle/std7-environmental-science',
           'psle/std7-diseases-health'],
    bio:  ['jce/form1-cells','jce/form2-photosynthesis','jce/form2-digestion',
           'jce/form3-circulatory','jce/form3-respiration',
           'bgcse/bio-cell-transport','bgcse/bio-respiration-advanced','bgcse/bio-homeostasis',
           'bgcse/bio-nervous-system','bgcse/bio-genetics','bgcse/bio-ecosystems'],
    chem: ['jce/form1-chemistry-intro','jce/form1-si-units','jce/form2-separation',
           'bgcse/chem-atomic-structure','bgcse/chem-bonding','bgcse/chem-quantitative',
           'bgcse/chem-rates','bgcse/chem-metals','bgcse/chem-organic'],
    phys: ['jce/form2-forces','jce/form3-energy','jce/form3-sound',
           'bgcse/phys-mechanics','bgcse/phys-thermal','bgcse/phys-waves',
           'bgcse/phys-electricity','bgcse/phys-nuclear'],
  };

  /* ── Badge helpers ── */
  function _goldCount(s, slugList) {
    return slugList.filter(sl => (s.crowns[sl] || 0) >= 3).length;
  }
  function _silverCount(s, slugList) {
    return slugList.filter(sl => (s.crowns[sl] || 0) >= 2).length;
  }
  function _hasSubjectKing(s) {
    // 5 gold crowns in any one subject
    return Object.values(_SLUGS).some(list => _goldCount(s, list) >= 5);
  }
  function _examReady(s) {
    // All gold in PSLE, OR all JCE topics, OR all BGCSE topics
    const jce  = [..._SLUGS.bio, ..._SLUGS.chem, ..._SLUGS.phys].filter(sl => sl.startsWith('jce'));
    const bgcse = [..._SLUGS.bio, ..._SLUGS.chem, ..._SLUGS.phys].filter(sl => sl.startsWith('bgcse'));
    return _SLUGS.psle.every(sl => (s.crowns[sl] || 0) >= 3) ||
           jce.every(sl => (s.crowns[sl] || 0) >= 3) ||
           bgcse.every(sl => (s.crowns[sl] || 0) >= 3);
  }

  /* ─────────────────────────────────────
     BADGES — 3 tiers, 18 total
     Easy wins → weekly goals → mastery
  ───────────────────────────────────── */
  const BADGES = [

    /* ── TIER 1: Quick Wins (earn in first session) ── */
    {
      id:'first-spark', tier:1,
      icon:'🎯', name:'First Spark',
      desc:'Earn your first XP',
      check: s => (s.xp || 0) >= 5,
    },
    {
      id:'question-crusher', tier:1,
      icon:'✅', name:'Question Crusher',
      desc:'Answer 10 MCQs correctly',
      check: s => (s.totalCorrect || 0) >= 10,
    },
    {
      id:'first-study', tier:1,
      icon:'📖', name:'First Study',
      desc:'Complete your first topic study',
      check: s => Object.values(s.crowns).some(c => c >= 2),
    },
    {
      id:'getting-warm', tier:1,
      icon:'🔥', name:'Getting Warm',
      desc:'Study 3 days in a row',
      check: s => (s.streak || 0) >= 3,
    },

    /* ── TIER 2: Weekly Goals ── */
    {
      id:'rising-star', tier:2,
      icon:'⭐', name:'Rising Star',
      desc:'Reach 500 XP',
      check: s => (s.xp || 0) >= 500,
    },
    {
      id:'on-fire', tier:2,
      icon:'🔥', name:'On Fire',
      desc:'7-day study streak',
      check: s => (s.streak || 0) >= 7,
    },
    {
      id:'fifty-questions', tier:2,
      icon:'📚', name:'Fifty Questions',
      desc:'Answer 50 MCQs correctly',
      check: s => (s.totalCorrect || 0) >= 50,
    },
    {
      id:'explorer', tier:2,
      icon:'🗺️', name:'Explorer',
      desc:'Silver crown on 5 different topics',
      check: s => Object.values(s.crowns).filter(c => c >= 2).length >= 5,
    },
    {
      id:'perfectionist', tier:2,
      icon:'💯', name:'Perfectionist',
      desc:'Score 100% on any quiz',
      check: s => !!s._perfectQuiz,
    },

    /* ── TIER 3: Exam Season (aspirational) ── */
    {
      id:'star-student', tier:3,
      icon:'💫', name:'Star Student',
      desc:'Reach 2,000 XP (about 10 full topics)',
      check: s => (s.xp || 0) >= 2000,
    },
    {
      id:'week-warrior', tier:3,
      icon:'📅', name:'Week Warrior',
      desc:'14-day study streak',
      check: s => (s.streak || 0) >= 14,
    },
    {
      id:'hundred-questions', tier:3,
      icon:'📝', name:'Hundred Questions',
      desc:'Answer 100 MCQs correctly',
      check: s => (s.totalCorrect || 0) >= 100,
    },
    {
      id:'subject-king', tier:3,
      icon:'🏆', name:'Subject King',
      desc:'Gold crown on 5 topics in one subject',
      check: _hasSubjectKing,
    },
    {
      id:'shooting-star', tier:3,
      icon:'🌠', name:'Shooting Star',
      desc:'Reach 5,000 XP',
      check: s => (s.xp || 0) >= 5000,
    },
    {
      id:'scholar', tier:3,
      icon:'🎓', name:'Scholar',
      desc:'Answer 500 MCQs correctly',
      check: s => (s.totalCorrect || 0) >= 500,
    },
    {
      id:'speed-demon', tier:3,
      icon:'⚡', name:'Speed Demon',
      desc:'Score 10+ in the 60s Challenge',
      check: s => (s._bestChallenge || 0) >= 10,
    },
    {
      id:'exam-ready', tier:3,
      icon:'🏅', name:'Exam Ready',
      desc:'Gold on all topics in PSLE, JCE, or BGCSE',
      check: _examReady,
    },
    {
      id:'all-rounder', tier:3,
      icon:'🌍', name:'All-Rounder',
      desc:'Silver crown on all 41 topics',
      check: s => {
        const all = [..._SLUGS.psle, ..._SLUGS.bio, ..._SLUGS.chem, ..._SLUGS.phys];
        return all.length === 41 && all.every(sl => (s.crowns[sl] || 0) >= 2);
      },
    },

    /* ── QUICK WINS (Tier 1) ── */
    {
      id:'first-animation', tier:1,
      icon:'🎬', name:'First Animation',
      desc:'Watch your first animation',
      check: s => Object.keys(s.crowns || {}).length >= 1,
    },
    {
      id:'practice-makes-perfect', tier:1,
      icon:'✏️', name:'Practice Makes Perfect',
      desc:'Complete 5 MCQs',
      check: s => (s.totalCorrect || 0) >= 5,
    },
    {
      id:'streak-starter', tier:1,
      icon:'🔥', name:'Streak Starter',
      desc:'Study 2 days in a row',
      check: s => (s.streak || 0) >= 2,
    },

    /* ── MILESTONES ── */
    {
      id:'hundred-xp', tier:2,
      icon:'💯', name:'Century',
      desc:'Earn 100 XP',
      check: s => (s.xp || 0) >= 100,
    },
    {
      id:'thousand-xp', tier:3,
      icon:'💰', name:'Thousand XP Club',
      desc:'Earn 1,000 XP',
      check: s => (s.xp || 0) >= 1000,
    },
    {
      id:'ten-thousand-xp', tier:3,
      icon:'🤑', name:'XP Millionaire',
      desc:'Earn 10,000 XP',
      check: s => (s.xp || 0) >= 10000,
    },

    /* ── STREAKS ── */
    {
      id:'five-streak', tier:1,
      icon:'🔥', name:'Five-Day Blaze',
      desc:'5-day study streak',
      check: s => (s.streak || 0) >= 5,
    },
    {
      id:'thirty-streak', tier:3,
      icon:'🌟', name:'Month Master',
      desc:'30-day study streak',
      check: s => (s.streak || 0) >= 30,
    },
    {
      id:'hundred-day', tier:3,
      icon:'👑', name:'Century Streak',
      desc:'100-day study streak',
      check: s => (s.streak || 0) >= 100,
    },

    /* ── QUESTIONS ANSWERED ── */
    {
      id:'twenty-five-q', tier:1,
      icon:'❓', name:'Quiz Novice',
      desc:'Answer 25 MCQs correctly',
      check: s => (s.totalCorrect || 0) >= 25,
    },
    {
      id:'two-hundred-q', tier:2,
      icon:'❔', name:'Quiz Master',
      desc:'Answer 200 MCQs correctly',
      check: s => (s.totalCorrect || 0) >= 200,
    },
    {
      id:'thousand-q', tier:3,
      icon:'🧠', name:'Quiz Legend',
      desc:'Answer 1,000 MCQs correctly',
      check: s => (s.totalCorrect || 0) >= 1000,
    },

    /* ── CROWN ACHIEVEMENTS ── */
    {
      id:'bronze-collector', tier:2,
      icon:'🥉', name:'Bronze Collector',
      desc:'Bronze crown on 10 topics',
      check: s => Object.values(s.crowns || {}).filter(c => c >= 1).length >= 10,
    },
    {
      id:'silver-collector', tier:2,
      icon:'🥈', name:'Silver Collector',
      desc:'Silver crown on 10 topics',
      check: s => Object.values(s.crowns || {}).filter(c => c >= 2).length >= 10,
    },
    {
      id:'gold-collector', tier:3,
      icon:'🥇', name:'Gold Collector',
      desc:'Gold crown on 10 topics',
      check: s => Object.values(s.crowns || {}).filter(c => c >= 3).length >= 10,
    },
    {
      id:'diamond-hand', tier:3,
      icon:'💎', name:'Diamond Hands',
      desc:'Gold crown on 20 topics',
      check: s => Object.values(s.crowns || {}).filter(c => c >= 3).length >= 20,
    },

    /* ── SUBJECT MASTERY ── */
    {
      id:'psle-master', tier:2,
      icon:'🏫', name:'PSLE Master',
      desc:'Silver crown on all PSLE topics',
      check: s => _SLUGS.psle.every(sl => (s.crowns[sl] || 0) >= 2),
    },
    {
      id:'jce-master', tier:2,
      icon:'📚', name:'JCE Master',
      desc:'Silver crown on all JCE topics',
      check: s => {
        const jce = [..._SLUGS.bio, ..._SLUGS.chem, ..._SLUGS.phys].filter(sl => sl.startsWith('jce/'));
        return jce.length > 0 && jce.every(sl => (s.crowns[sl] || 0) >= 2);
      },
    },
    {
      id:'bgcse-master', tier:2,
      icon:'🎓', name:'BGCSE Master',
      desc:'Silver crown on all BGCSE topics',
      check: s => [..._SLUGS.bio, ..._SLUGS.chem, ..._SLUGS.phys].every(sl => (s.crowns[sl] || 0) >= 2),
    },
    {
      id:'bio-expert', tier:2,
      icon:'🔬', name:'Bio Expert',
      desc:'Silver on all Biology topics',
      check: s => _SLUGS.bio.every(sl => (s.crowns[sl] || 0) >= 2),
    },
    {
      id:'chem-expert', tier:2,
      icon:'⚗️', name:'Chemistry Expert',
      desc:'Silver on all Chemistry topics',
      check: s => _SLUGS.chem.every(sl => (s.crowns[sl] || 0) >= 2),
    },
    {
      id:'phys-expert', tier:2,
      icon:'⚡', name:'Physics Expert',
      desc:'Silver on all Physics topics',
      check: s => _SLUGS.phys.every(sl => (s.crowns[sl] || 0) >= 2),
    },

    /* ── PERFECT SCORES ── */
    {
      id:'ten-perfects', tier:2,
      icon:'🎯', name:'Perfect Aim',
      desc:'Score 100% on 10 quizzes',
      check: s => (s._perfectCount || 0) >= 10,
    },
    {
      id:'hundred-perfects', tier:3,
      icon:'🏆', name:'Perfection Master',
      desc:'Score 100% on 50 quizzes',
      check: s => (s._perfectCount || 0) >= 50,
    },

    /* ── CONSISTENCY ── */
    {
      id:'weekly-warrior-x3', tier:2,
      icon:'💪', name:'Consistency King',
      desc:'Study every week for 3 weeks',
      check: s => (s._weeksStudied || 0) >= 3,
    },
    {
      id:'comeback-king', tier:2,
      icon:'🔙', name:'Comeback King',
      desc:'Restore your streak after losing hearts',
      check: s => (s._comebacks || 0) >= 1,
    },

    /* ── SPECIAL ACHIEVEMENTS ── */
    {
      id:'early-bird', tier:1,
      icon:'🌅', name:'Early Bird',
      desc:'Study before 8 AM',
      check: s => !!(s._earlyBird),
    },
    {
      id:'night-owl', tier:1,
      icon:'🌙', name:'Night Owl',
      desc:'Study after 9 PM',
      check: s => !!(s._nightOwl),
    },
    {
      id:'marathon-session', tier:2,
      icon:'🏃', name:'Marathon',
      desc:'Study for 2+ hours in one session',
      check: s => (s._longestSession || 0) >= 7200000,
    },
    {
      id:'speed-runner', tier:2,
      icon:'⚡', name:'Speed Runner',
      desc:'Complete 5 topics in one day',
      check: s => (s._topicsInDay || 0) >= 5,
    },

    /* ── ULTIMATE ACHIEVEMENTS ── */
    {
      id:'grand-master', tier:3,
      icon:'🌟', name:'Grand Master',
      desc:'Gold crown on 30+ topics',
      check: s => Object.values(s.crowns || {}).filter(c => c >= 3).length >= 30,
    },
    {
      id:'supreme', tier:3,
      icon:'👑', name:'Supreme',
      desc:'Gold on all BGCSE + 10k XP + 1k MCQs',
      check: s => (s.xp || 0) >= 10000 &&
                  (s.totalCorrect || 0) >= 1000 &&
                  [..._SLUGS.bio, ..._SLUGS.chem, ..._SLUGS.phys].every(sl => (s.crowns[sl] || 0) >= 3),
    },
    {
      id:'ultimate', tier:3,
      icon:'💥', name:'ULTIMATE SCHOLAR',
      desc:'100 days + 5k perfect MCQs + all crowns gold',
      check: s => (s.streak || 0) >= 100 &&
                  (s.totalCorrect || 0) >= 5000 &&
                  Object.values(s.crowns || {}).every(c => c >= 3),
    },
  ];

  /* ── State ── */
  let _s;
  let _cloudLoaded = false; // guard: prevents saves before cloud state is loaded (avoids data corruption)

  function _fresh() {
    return {
      xp: 0, streak: 0, lastStudyDate: null,
      hearts: HEART_MAX, lastHeartTime: Date.now(),
      crowns: {}, badges: [],
      totalCorrect: 0,
      _perfectQuiz: false, _bestChallenge: 0,
      _perfectCount: 0, _weeksStudied: 0, _comebacks: 0,
      _earlyBird: false, _nightOwl: false, _longestSession: 0, _topicsInDay: 0,
      _lastWeekNum: 0, _topicsInDayDate: null,
      last_visited: null,
      bookmarks: [],
      quiz_history: [],
      streak_freeze_date: null,
    };
  }

  function _load() {
    // Sync load from memory; cloud load is async via loadFromCloud()
    if (!_s) _s = _fresh();
    if (_s.totalCorrect === undefined) _s.totalCorrect = 0;
    _refillHearts();
  }

  async function loadFromCloud() {
    const data = await _loadFromCloud();
    if (data) {
      _s = { ..._fresh(), ...data };
      if (_s.totalCorrect === undefined) _s.totalCorrect = 0;
      _refillHearts();
    } else {
      _s = _fresh();
    }
    _cloudLoaded = true;
    _checkBadges();
    _refreshUI();
  }

  function _save() {
    // Guard: skip save until cloud state is loaded to avoid overwriting real data with empty state
    if (!_uid() || !_cloudLoaded) return;
    _saveToCloud({ ..._s });
  }

  /* ── Hearts ── */
  function _refillHearts() {
    if (_s.hearts >= HEART_MAX) return;
    const elapsed = Date.now() - (_s.lastHeartTime || Date.now());
    const refills = Math.floor(elapsed / HEART_MS);
    if (refills > 0) {
      _s.hearts = Math.min(HEART_MAX, _s.hearts + refills);
      _s.lastHeartTime += refills * HEART_MS;
      _save();
    }
  }

  /* ── Streak ── */
  function _touchStreak() {
    const today = _today();
    if (_s.lastStudyDate === today) return;
    const yesterday = _daysAgo(1);
    const wasStreakBroken = _s.streak > 0 && _s.lastStudyDate !== yesterday;
    if      (_s.lastStudyDate === yesterday) _s.streak++;
    else if (!_s.lastStudyDate)              _s.streak = 1;
    else                                     _s.streak = 1; // streak broken
    if (wasStreakBroken && _s.streak === 1) _s._comebacks = (_s._comebacks || 0) + 1;
    _s.lastStudyDate = today;

    // Track time-based achievements
    const hour = new Date().getHours();
    if (hour < 8) _s._earlyBird = true;
    if (hour >= 21) _s._nightOwl = true;

    // Track weeks studied (increment when entering a new week)
    const weekNum = Math.floor(new Date(today).getTime() / (7 * 86400000));
    if (!_s._lastWeekNum) _s._lastWeekNum = weekNum;
    if (weekNum > _s._lastWeekNum) {
      _s._weeksStudied = (_s._weeksStudied || 0) + 1;
      _s._lastWeekNum = weekNum;
    }
  }

  function _today()    { return new Date().toISOString().slice(0, 10); }
  function _daysAgo(n) { return new Date(Date.now() - n * 86400000).toISOString().slice(0, 10); }

  /* ── Level helpers ── */
  function getLevel(xp) {
    let lv = LEVELS[0];
    for (const l of LEVELS) if ((xp ?? 0) >= l.min) lv = l;
    return lv;
  }

  function getNextLevel(xp) {
    for (const l of LEVELS) if ((xp ?? 0) < l.min) return l;
    return null;
  }

  /* ══════════════════════════════════════
     PUBLIC API
  ══════════════════════════════════════ */

  function addXP(amount, reason) {
    _load();
    const prevLv = getLevel(_s.xp);
    _s.xp += amount;
    _touchStreak();
    _save();
    _showXPToast(amount, reason);
    const nextLv = getLevel(_s.xp);
    if (prevLv.name !== nextLv.name) _showLevelUp(nextLv);
    _checkBadges();
    _refreshUI();
  }

  /* XP for simply opening a topic (animation/study) — only every 2nd open counts,
     so casually re-opening the same or new topics doesn't farm XP too fast. */
  function addOpenXP(amount, reason) {
    _load();
    _s._openCount = (_s._openCount || 0) + 1;
    _save();
    if (_s._openCount % 2 === 0) addXP(amount, reason);
  }

  /* Call this alongside addXP whenever an MCQ answer is correct */
  function recordCorrect() {
    _load();
    _s.totalCorrect = (_s.totalCorrect || 0) + 1;
    _save();
    _checkBadges();
  }

  function loseHeart() {
    _load();
    if (_s.hearts > 0) {
      if (_s.hearts === HEART_MAX) _s.lastHeartTime = Date.now();
      _s.hearts--;
      _save();
    }
    _refreshUI();
    return _s.hearts;
  }

  function getHearts() { _load(); return _s.hearts; }

  function setCrown(slug, level) {
    if (!slug || !level) return;
    _load();
    if (level > (_s.crowns[slug] || 0)) {
      _s.crowns[slug] = level;

      // Track topics completed today for Speed Runner achievement
      const today = _today();
      if (!_s._topicsInDayDate) _s._topicsInDayDate = today;
      if (_s._topicsInDayDate === today) {
        _s._topicsInDay = (_s._topicsInDay || 0) + 1;
      } else {
        _s._topicsInDayDate = today;
        _s._topicsInDay = 1;
      }

      _save();
      _checkBadges();
      _refreshUI();
    }
  }

  function getCrown(slug) { _load(); return _s.crowns[slug] || 0; }

  function markPerfectQuiz() {
    _load();
    _s._perfectQuiz = true;
    _s._perfectCount = (_s._perfectCount || 0) + 1;
    _save();
    _checkBadges();
  }

  function recordChallengeScore(score) {
    _load();
    if (score > (_s._bestChallenge || 0)) {
      _s._bestChallenge = score; _save(); _checkBadges();
    }
  }

  function recordLastVisited(url) {
    _load();
    _s.last_visited = url;
    _save();
  }

  function getLastVisited() {
    _load();
    return _s.last_visited || null;
  }

  function toggleBookmark(url) {
    _load();
    if (!_s.bookmarks) _s.bookmarks = [];
    const idx = _s.bookmarks.indexOf(url);
    if (idx >= 0) _s.bookmarks.splice(idx, 1);
    else _s.bookmarks.push(url);
    _save();
    return _s.bookmarks.includes(url); // true if now bookmarked
  }

  function getBookmarks() {
    _load();
    return _s.bookmarks || [];
  }

  function recordQuizAttempt(topic, score, totalQs) {
    _load();
    if (!_s.quiz_history) _s.quiz_history = [];
    _s.quiz_history.push({
      topic, score, totalQs,
      timestamp: new Date().toISOString(),
    });
    // Keep last 50 attempts
    if (_s.quiz_history.length > 50) _s.quiz_history.shift();
    _save();
  }

  function getQuizHistory() {
    _load();
    return _s.quiz_history || [];
  }

  function canFreezeStreak() {
    _load();
    return _s.xp >= 100 && !_s.streak_freeze_date;
  }

  function freezeStreak() {
    _load();
    if (_s.xp < 100) return false;
    _s.xp -= 100;
    _s.streak_freeze_date = _today();
    _save();
    _refreshUI();
    return true;
  }

  function consumeStreakFreeze() {
    _load();
    if (_s.streak_freeze_date) {
      _s.streak_freeze_date = null;
      _save();
      return true;
    }
    return false;
  }

  function getState() { _load(); return { ..._s }; }

  /* Derive topic slug from current page URL */
  function getSlug() {
    const parts = window.location.pathname.split('/');
    const fn     = parts[parts.length - 1];
    const folder = parts[parts.length - 2];
    const base   = fn.replace(/-study\.html$/, '').replace(/-quiz\.html$/, '').replace(/\.html$/, '');
    return folder + '/' + base;
  }

  /* ── Badge checking ── */
  function _checkBadges() {
    const newOnes = BADGES.filter(b => !_s.badges.includes(b.id) && b.check(_s));
    newOnes.forEach((b, i) => {
      _s.badges.push(b.id);
      _save();
      setTimeout(() => _showBadgePop(b), 300 + i * 800);
    });
  }

  /* ── Confetti ── */
  function confetti() {
    const cols = ['#f44336','#e91e63','#9c27b0','#2196f3','#4caf50','#ff9800','#ffd600'];
    _addKf('bec-fall', 'to{transform:translateY(110vh) rotate(720deg);opacity:0}');
    for (let i = 0; i < 70; i++) {
      const el = document.createElement('div');
      const sz = 6 + Math.random() * 8;
      el.style.cssText = [
        'position:fixed','z-index:10000','pointer-events:none',
        `width:${sz}px`, `height:${sz}px`,
        `background:${cols[i % cols.length]}`,
        `border-radius:${Math.random() > .5 ? '50%' : '2px'}`,
        `left:${Math.random() * 100}vw`, 'top:-12px',
        `animation:bec-fall ${1.5 + Math.random() * 2}s linear ${Math.random() * .6}s forwards`,
      ].join(';');
      document.body.appendChild(el);
      setTimeout(() => el.remove(), 4500);
    }
  }

  /* ── Toasts & Popups ── */
  function _showXPToast(amount, reason) {
    _addKf('bec-pop', 'from{opacity:0;transform:translateY(12px) scale(.8)}to{opacity:1;transform:translateY(0) scale(1)}');
    const el = document.createElement('div');
    el.style.cssText = [
      'position:fixed','right:16px','bottom:72px','z-index:9999','pointer-events:none',
      'background:#1b5e20','color:#fff',
      'padding:8px 16px','border-radius:8px',
      'font-size:.82rem','font-weight:700','font-family:system-ui,sans-serif',
      'box-shadow:0 4px 16px rgba(0,0,0,.3)',
      'animation:bec-pop .25s cubic-bezier(.34,1.56,.64,1)',
    ].join(';');
    el.textContent = `+${amount} XP${reason ? '  ·  ' + reason : ''}`;
    document.body.appendChild(el);
    setTimeout(() => {
      el.style.transition = 'opacity .4s, transform .4s';
      el.style.opacity = '0'; el.style.transform = 'translateY(-10px)';
      setTimeout(() => el.remove(), 420);
    }, 1700);
  }

  const TIER_LABELS = { 1:'⚡ Quick Win', 2:'📅 Weekly Goal', 3:'🏆 Mastery' };
  const TIER_COLORS = { 1:'#43a047', 2:'#1976d2', 3:'#7b1fa2' };

  function _showBadgePop(badge) {
    document.getElementById('bec-badge-pop')?.remove();
    _addKf('bec-slidein',
      'from{opacity:0;transform:translateX(-50%) translateY(24px) scale(.88)}' +
      'to{opacity:1;transform:translateX(-50%) translateY(0) scale(1)}');
    const el = document.createElement('div');
    el.id = 'bec-badge-pop';
    const color = TIER_COLORS[badge.tier] || '#2e7d32';
    el.style.cssText = [
      'position:fixed','left:50%','bottom:80px','transform:translateX(-50%)',
      'z-index:9999',
      'background:#fff','border-radius:18px',
      'padding:22px 34px','min-width:250px',
      'box-shadow:0 10px 44px rgba(0,0,0,.22)',
      'text-align:center',
      `border-top:4px solid ${color}`,
      'font-family:system-ui,sans-serif',
      'animation:bec-slidein .35s cubic-bezier(.34,1.56,.64,1)',
    ].join(';');
    el.innerHTML = `
      <div style="font-size:2.6rem;margin-bottom:6px">${badge.icon}</div>
      <div style="font-size:.66rem;font-weight:800;text-transform:uppercase;letter-spacing:.11em;color:${color};margin-bottom:3px">${TIER_LABELS[badge.tier] || 'Badge Unlocked'}</div>
      <div style="font-size:1.05rem;font-weight:800;color:#111;margin-bottom:4px">${badge.name}</div>
      <div style="font-size:.78rem;color:#888">${badge.desc}</div>`;
    document.body.appendChild(el);
    setTimeout(() => {
      el.style.transition = 'opacity .4s, transform .4s';
      el.style.opacity = '0'; el.style.transform = 'translateX(-50%) translateY(14px)';
      setTimeout(() => el.remove(), 420);
    }, 3600);
  }

  function _showLevelUp(lv) {
    _addKf('bec-pop', 'from{opacity:0;transform:translate(-50%,-50%) scale(.7)}to{opacity:1;transform:translate(-50%,-50%) scale(1)}');
    const el = document.createElement('div');
    el.style.cssText = [
      'position:fixed','left:50%','top:42%','transform:translate(-50%,-50%)',
      'z-index:9999','background:#1b5e20','color:#fff',
      'border-radius:20px','padding:30px 44px','min-width:260px','text-align:center',
      'box-shadow:0 14px 48px rgba(0,0,0,.32)',
      'font-family:system-ui,sans-serif',
      'animation:bec-pop .4s cubic-bezier(.34,1.56,.64,1)',
    ].join(';');
    el.innerHTML = `
      <div style="font-size:3rem;margin-bottom:8px">${lv.icon}</div>
      <div style="font-size:.75rem;font-weight:800;text-transform:uppercase;letter-spacing:.12em;opacity:.7;margin-bottom:4px">Level Up!</div>
      <div style="font-size:1.6rem;font-weight:900">${lv.name}</div>`;
    document.body.appendChild(el);
    confetti();
    setTimeout(() => {
      el.style.transition = 'opacity .5s, transform .5s';
      el.style.opacity = '0'; el.style.transform = 'translate(-50%,-60%)';
      setTimeout(() => el.remove(), 520);
    }, 2800);
  }

  function _addKf(id, body) {
    if (document.getElementById('bec-kf-' + id)) return;
    const s = document.createElement('style');
    s.id = 'bec-kf-' + id;
    s.textContent = `@keyframes ${id}{${body}}`;
    document.head.appendChild(s);
  }

  /* ── UI refresh ── */
  function _refreshUI() {
    renderStatsBar();
    document.querySelectorAll('[data-bec-crown]').forEach(el => {
      el.textContent = _crownIcon(_s.crowns[el.dataset.becCrown] || 0);
    });
    // Update landing stats card if it exists
    if (typeof window.renderLandingStats === 'function') {
      window.renderLandingStats();
    }
  }

  function _heartsHtml() {
    _load();
    let h = '';
    for (let i = 0; i < HEART_MAX; i++)
      h += `<span style="color:${i < _s.hearts ? '#e53935' : '#e0e0e0'};font-size:.95rem;line-height:1">♥</span>`;
    return h;
  }

  function _crownIcon(level) {
    return ['', '🥉', '🥈', '🥇', '💎'][level] || '';
  }

  /* ── Dashboard stats bar ── */
  function renderStatsBar() {
    const bar = document.getElementById('bec-stats');
    if (!bar) return;
    _load();
    const lv = getLevel(_s.xp);
    bar.style.cssText = 'background:#fff;border-bottom:1px solid #e8e8e8;padding:8px 20px;font-family:system-ui,sans-serif;';
    bar.innerHTML = `
      <div style="display:flex;align-items:center;gap:12px;height:32px;flex-wrap:nowrap">
        <!-- Achievements badge count -->
        <button onclick="BEC._showProfile()" style="background:var(--c,#2e7d32);border:none;color:#fff;
          font-size:.7rem;font-weight:800;padding:4px 10px;border-radius:6px;
          cursor:pointer;font-family:inherit;white-space:nowrap;flex-shrink:0">
          ${_s.badges.length}/${BADGES.length}
        </button>

        <!-- Level icon + name -->
        <div style="display:flex;align-items:center;gap:6px;flex-shrink:0;font-size:.75rem;color:#666">
          <span style="font-size:1.1rem">${lv.icon}</span>
          <span style="font-weight:600">${lv.name}</span>
        </div>

        <!-- Streak -->
        <div style="display:flex;align-items:center;gap:4px;flex-shrink:0;font-size:.75rem;color:#666">
          <span>🔥</span>
          <span style="font-weight:700">${_s.streak}</span>
        </div>

        <!-- More button -->
        <button onclick="BEC._showDetailedStats()" style="background:transparent;border:1px solid #ddd;color:#666;
          font-size:.7rem;font-weight:600;padding:4px 10px;border-radius:6px;
          cursor:pointer;font-family:inherit;margin-left:auto;flex-shrink:0;white-space:nowrap">
          More Stats
        </button>
      </div>`;
  }

  /* Detailed stats — full screen achievements page */
  function _showDetailedStats() {
    _load();
    const page = document.createElement('div');
    page.id = 'bec-stats-page';
    page.style.cssText = 'position:fixed;inset:0;background:#f9f9f9;z-index:9998;overflow-y:auto;font-family:system-ui,sans-serif';

    const lv = getLevel(_s.xp);
    const nx = getNextLevel(_s.xp);
    const pct = nx ? Math.round((_s.xp - lv.min) / (nx.min - lv.min) * 100) : 100;
    const earned = BADGES.filter(b => _s.badges.includes(b.id));
    const locked = BADGES.filter(b => !_s.badges.includes(b.id));

    page.innerHTML = `
      <!-- Header -->
      <div style="background:var(--c,#2e7d32);color:#fff;padding:24px 20px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:10">
        <h1 style="font-size:1.6rem;font-weight:800;margin:0">Your Progress</h1>
        <button onclick="document.getElementById('bec-stats-page').remove()" style="background:rgba(255,255,255,.2);border:none;color:#fff;font-size:1.4rem;cursor:pointer;border-radius:8px;width:40px;height:40px;display:flex;align-items:center;justify-content:center">✕</button>
      </div>

      <!-- Content -->
      <div style="max-width:1000px;margin:0 auto;padding:30px 20px 90px">

        <!-- Level & XP -->
        <div style="background:#fff;border-radius:14px;padding:24px;margin-bottom:28px;box-shadow:0 2px 8px rgba(0,0,0,.05)">
          <div style="display:flex;align-items:center;gap:16px;margin-bottom:16px">
            <span style="font-size:2.4rem">${lv.icon}</span>
            <div>
              <div style="font-size:1.3rem;font-weight:800;color:var(--c,#2e7d32)">${lv.name}</div>
              ${nx ? `<div style="font-size:.85rem;color:#888">${nx.min - _s.xp} XP to next level</div>`
                   : `<div style="font-size:.85rem;color:#888">🎉 Max Level Achieved!</div>`}
            </div>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:.8rem;color:#999;margin-bottom:8px">
            <span>${_s.xp} XP</span>
            <span>${nx ? nx.min + ' XP' : '★'}</span>
          </div>
          <div style="height:12px;background:#f0f0f0;border-radius:999px;overflow:hidden">
            <div style="width:${pct}%;height:100%;background:var(--c,#2e7d32);border-radius:999px;transition:width .6s"></div>
          </div>
        </div>

        <!-- Stats Grid -->
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:16px;margin-bottom:28px">
          <div style="background:#fff;border-radius:12px;padding:18px;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,.05)">
            <div style="font-size:1.8rem;margin-bottom:8px">🔥</div>
            <div style="font-size:1.4rem;font-weight:800;color:var(--c,#2e7d32);margin-bottom:4px">${_s.streak}</div>
            <div style="font-size:.8rem;color:#999">Day Streak</div>
          </div>
          <div style="background:#fff;border-radius:12px;padding:18px;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,.05)">
            <div style="font-size:1.8rem;margin-bottom:8px">✅</div>
            <div style="font-size:1.4rem;font-weight:800;color:var(--c,#2e7d32);margin-bottom:4px">${_s.totalCorrect || 0}</div>
            <div style="font-size:.8rem;color:#999">Correct</div>
          </div>
        </div>

        <!-- Achievements Section -->
        <h2 style="font-size:1.2rem;font-weight:800;color:#111;margin:32px 0 16px;padding-bottom:12px;border-bottom:2px solid var(--c,#2e7d32)">Achievements</h2>

        <!-- Earned Badges -->
        ${earned.length > 0 ? `
          <div style="margin-bottom:28px">
            <h3 style="font-size:.95rem;font-weight:700;color:#666;text-transform:uppercase;letter-spacing:.5px;margin:0 0 14px">Unlocked (${earned.length})</h3>
            <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(100px,1fr));gap:14px">
              ${earned.map(b => `
                <div style="background:#fff;border:2px solid var(--c-light,#e8f5e9);border-radius:12px;padding:16px;text-align:center;cursor:pointer;transition:all .2s"
                  onmouseover="this.style.borderColor='var(--c,#2e7d32)';this.style.boxShadow='0 4px 12px rgba(0,0,0,.1)'"
                  onmouseout="this.style.borderColor='var(--c-light,#e8f5e9)';this.style.boxShadow=''">
                  <div style="font-size:2.2rem;margin-bottom:8px">${b.icon}</div>
                  <div style="font-size:.8rem;font-weight:700;color:#111;margin-bottom:4px">${b.name}</div>
                  <div style="font-size:.65rem;color:#888;line-height:1.3">${b.desc}</div>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}

        <!-- Locked Badges -->
        ${locked.length > 0 ? `
          <div>
            <h3 style="font-size:.95rem;font-weight:700;color:#999;text-transform:uppercase;letter-spacing:.5px;margin:0 0 14px">Locked (${locked.length})</h3>
            <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(100px,1fr));gap:14px">
              ${locked.map(b => `
                <div style="background:#fff;border:2px solid #e8e8e8;border-radius:12px;padding:16px;text-align:center;opacity:.5">
                  <div style="font-size:2.2rem;margin-bottom:8px;filter:grayscale(100%)">${b.icon}</div>
                  <div style="font-size:.8rem;font-weight:700;color:#999;margin-bottom:4px">${b.name}</div>
                  <div style="font-size:.65rem;color:#ccc;line-height:1.3">${b.desc}</div>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}

      </div>
    `;

    document.body.appendChild(page);
  }

  /* ── Badge wall popup (tiered) ── */
  function _showProfile() {
    _load();
    document.getElementById('bec-profile-overlay')?.remove();
    const ov = document.createElement('div');
    ov.id = 'bec-profile-overlay';
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9998;display:flex;align-items:center;justify-content:center;padding:20px';
    ov.onclick = e => { if (e.target === ov) ov.remove(); };
    const lv = getLevel(_s.xp);
    const nx = getNextLevel(_s.xp);
    const pct = nx ? Math.round((_s.xp - lv.min) / (nx.min - lv.min) * 100) : 100;

    const tierNames = { 1:'Quick Wins', 2:'Weekly Goals', 3:'Exam Season' };
    const tierGroups = [1, 2, 3].map(tier => {
      const items = BADGES.filter(b => b.tier === tier);
      const rows = items.map(b => {
        const earned = _s.badges.includes(b.id);
        const color  = TIER_COLORS[tier];
        return `
          <div style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:10px;
            background:${earned ? '#f9fff9' : '#fafafa'};border:1.5px solid ${earned ? color : '#eee'};
            opacity:${earned ? '1' : '.55'}">
            <div style="font-size:1.6rem;flex-shrink:0">${b.icon}</div>
            <div style="flex:1;min-width:0">
              <div style="font-size:.82rem;font-weight:800;color:${earned ? '#111' : '#666'}">${b.name}</div>
              <div style="font-size:.72rem;color:#999;margin-top:1px">${b.desc}</div>
            </div>
            ${earned ? `<div style="font-size:1rem;color:${color}">✓</div>` : ''}
          </div>`;
      }).join('');
      const earned = items.filter(b => _s.badges.includes(b.id)).length;
      const color  = TIER_COLORS[tier];
      return `
        <div style="margin-bottom:18px">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
            <div style="font-size:.68rem;font-weight:800;text-transform:uppercase;letter-spacing:.1em;color:${color}">${tierNames[tier]}</div>
            <div style="flex:1;height:1px;background:#eee"></div>
            <div style="font-size:.68rem;color:#bbb">${earned}/${items.length}</div>
          </div>
          <div style="display:flex;flex-direction:column;gap:6px">${rows}</div>
        </div>`;
    }).join('');

    const xpBar = `
      <div style="margin-bottom:6px;display:flex;justify-content:space-between;font-size:.74rem;color:#888">
        <span>${lv.name}</span>
        <span>${_s.xp} XP${nx ? ' · ' + (nx.min - _s.xp) + ' to ' + nx.name : ' · MAX'}</span>
      </div>
      <div style="height:7px;background:#eee;border-radius:999px;overflow:hidden;margin-bottom:18px">
        <div style="width:${pct}%;height:100%;background:#2e7d32;border-radius:999px;transition:width .6s"></div>
      </div>`;

    ov.innerHTML = `
      <div style="background:#fff;border-radius:20px;padding:28px;max-width:420px;width:100%;max-height:85vh;overflow-y:auto;font-family:system-ui,sans-serif">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:16px">
          <div>
            <div style="font-size:1.4rem;font-weight:900">${lv.icon} ${lv.name}</div>
            <div style="font-size:.78rem;color:#888;margin-top:2px">🔥 ${_s.streak}-day streak · ✅ ${_s.totalCorrect} correct · 🏅 ${_s.badges.length}/${BADGES.length} badges</div>
          </div>
          <button onclick="document.getElementById('bec-profile-overlay').remove()"
            style="border:none;background:#f0f0f0;border-radius:50%;width:32px;height:32px;font-size:1rem;cursor:pointer;flex-shrink:0">✕</button>
        </div>
        ${xpBar}
        ${tierGroups}
      </div>`;
    document.body.appendChild(ov);
  }

  /* Crown emoji for dashboard cards */
  function crownHtml(level) { return _crownIcon(level); }

  /* ── Init ── */
  _load();

  return {
    addXP, addOpenXP, recordCorrect, loseHeart, getHearts,
    setCrown, getCrown, getLevel, getNextLevel, getState, getSlug,
    markPerfectQuiz, recordChallengeScore,
    renderStatsBar, crownHtml, confetti,
    loadFromCloud,
    recordLastVisited, getLastVisited,
    toggleBookmark, getBookmarks,
    recordQuizAttempt, getQuizHistory,
    canFreezeStreak, freezeStreak, consumeStreakFreeze,
    LEVELS, BADGES, _showProfile, _showDetailedStats,
  };
})();
