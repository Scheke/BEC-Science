/* BEC Animations — Mobile helper (all animation pages) */
(function () {

  // ── 1. Remove "Rotate Your Device" banner ─────────────────────────────
  document.querySelectorAll('h2, p').forEach(function (el) {
    if (/Rotate Your Device|Turn your phone sideways/i.test(el.textContent))
      el.remove();
  });

  // ── 2. Inject styles ───────────────────────────────────────────────────
  var s = document.createElement('style');
  s.textContent = [
    /* Cancel per-file CSS auto-rotate transform */
    '@media(max-width:560px) and (orientation:portrait){',
    '  html,body{overflow:auto!important}',
    '  body{position:static!important;width:100%!important;height:auto!important;',
    '       top:auto!important;left:auto!important;transform:none!important}',
    '}',

    /* Normal mode — only remove max-width so transform scale works cleanly.
       Do NOT override width/height — p5 sets those as inline px values. */
    '#sketch-wrap{width:100%;overflow:hidden;display:block;margin-top:10px}',
    '#sketch-wrap canvas{max-width:none!important;transform-origin:top left;display:block}',

    /* Fullscreen overlay */
    '#bec-fs-overlay{',
    '  display:none;position:fixed;top:0;left:0;right:0;bottom:0;',
    '  background:#111;z-index:900;',
    '  flex-direction:column;align-items:center;justify-content:center;',
    '}',
    '#bec-fs-overlay.active{display:flex}',
    '#bec-fs-overlay canvas{display:block;transform-origin:center center;max-width:none!important}',

    /* Controls bar inside fullscreen */
    '#bec-fs-controls{',
    '  position:fixed;bottom:0;left:0;right:0;',
    '  background:rgba(255,255,255,.97);backdrop-filter:blur(8px);',
    '  border-top:1px solid #e0e0e0;',
    '  display:none;flex-wrap:wrap;gap:8px;padding:8px 12px;z-index:901;',
    '  align-items:center;justify-content:center;',
    '}',
    '#bec-fs-controls.active{display:flex}',
    '#bec-fs-controls .btn{flex:1;min-width:80px;padding:10px 6px;font-size:.8rem;text-align:center}',

    /* Fullscreen toggle button */
    '#bec-fs-btn{',
    '  position:fixed;bottom:16px;right:10px;z-index:950;',
    '  background:rgba(27,94,32,.9);color:#fff;border:none;',
    '  border-radius:10px;padding:8px 14px;font-size:.82rem;font-weight:700;',
    '  cursor:pointer;font-family:inherit;',
    '  box-shadow:0 2px 10px rgba(0,0,0,.35);',
    '  display:none;',
    '}',
    '@media(max-width:820px){#bec-fs-btn{display:block}}',
    '#bec-fs-btn.fs-active{background:rgba(198,40,40,.9);bottom:80px}',

    /* Controls row must wrap on small screens — no horizontal scrollbar */
    '@media(max-width:820px){',
    '  #controls,.controls{flex-wrap:wrap!important;justify-content:center!important;',
    '    max-width:100%!important;width:auto!important;row-gap:8px;padding:0 8px}',
    '}',

    /* Header title was wrapping to 2 lines and eating vertical space on phones —
       shrink title/label/topbar text so the header stays compact. */
    '@media(max-width:480px){',
    '  .topbar{padding:8px 14px!important;flex-wrap:wrap!important;row-gap:4px}',
    '  .topbar .logo{font-size:.95rem!important}',
    '  .topbar a{font-size:.78rem!important}',
    '  .topbar .print-btn,.print-btn{font-size:.72rem!important;padding:5px 10px!important;margin-left:auto!important}',
    '  .topic-header{padding:10px 14px!important;gap:8px!important}',
    '  .topic-header h1{font-size:1.02rem!important;line-height:1.25!important}',
    '  .topic-header .label{font-size:.64rem!important;padding:2px 8px!important;white-space:nowrap}',
    '}',

    /* Big pill mode-toggle buttons (Animation / Practice) were oversized on phones —
       collapse to compact icon-only buttons, icon still visible via title tooltip. */
    '@media(max-width:480px){',
    '  .mode-btn{width:44px!important;height:44px!important;padding:0!important;',
    '    display:inline-flex!important;align-items:center;justify-content:center;',
    '    font-size:1.05rem!important;border-radius:10px!important}',
    '  .mode-btn .mode-lbl{display:none}',
    '}',
  ].join('\n');
  document.head.appendChild(s);

  // ── 3. Scale canvas to fit screen (normal mode) ────────────────────────
  var _canvas = null;

  function getCanvas() {
    if (_canvas && _canvas.parentNode) return _canvas;
    var wrap = document.getElementById('sketch-wrap');
    _canvas = wrap ? wrap.querySelector('canvas') : null;
    return _canvas;
  }

  // Logical (CSS) canvas size. canvas.width/.height are the internal pixel
  // buffer, which p5 multiplies by devicePixelRatio (2-3x on phones) — using
  // those for layout math produces a canvas 2-3x too small on real devices.
  function cssSize(canvas) {
    var w = parseFloat(canvas.style.width);
    var h = parseFloat(canvas.style.height);
    var dpr = window.devicePixelRatio || 1;
    if (!w || w <= 0) w = canvas.width / dpr;
    if (!h || h <= 0) h = canvas.height / dpr;
    return { w: w, h: h };
  }

  function scaleNormal() {
    var canvas = getCanvas();
    var wrap = document.getElementById('sketch-wrap');
    if (!canvas || !wrap) return;

    var size = cssSize(canvas);

    // The per-file CSS has height:auto!important which collapses canvas height to 0.
    // Use setProperty with 'important' priority — inline !important beats stylesheet !important.
    canvas.style.setProperty('height', size.h + 'px', 'important');
    canvas.style.setProperty('max-width', 'none', 'important');

    var available = wrap.clientWidth || window.innerWidth;
    if (size.w <= 0 || available <= 0) return;

    if (size.w <= available) {
      canvas.style.transform = '';
      canvas.style.transformOrigin = '';
      wrap.style.height = '';
      return;
    }
    var scale = available / size.w;
    canvas.style.transform = 'scale(' + scale + ')';
    canvas.style.transformOrigin = 'top left';
    wrap.style.height = Math.ceil(size.h * scale) + 'px';
  }

  // Retry until p5 creates the canvas (p5 setup() runs asynchronously)
  function tryScaleNormal(n) {
    if (getCanvas()) { scaleNormal(); }
    else if (n > 0) { setTimeout(function () { tryScaleNormal(n - 1); }, 200); }
  }
  window.addEventListener('load', function () { tryScaleNormal(15); });
  window.addEventListener('resize', function () {
    if (!fsOverlay || !fsOverlay.classList.contains('active')) scaleNormal();
    else scaleFullscreen();
  });
  window.addEventListener('orientationchange', function () {
    setTimeout(function () {
      if (!fsOverlay || !fsOverlay.classList.contains('active')) scaleNormal();
      else scaleFullscreen();
    }, 350);
  });

  // ── 4. Fullscreen overlay ──────────────────────────────────────────────
  var fsOverlay = document.createElement('div');
  fsOverlay.id = 'bec-fs-overlay';
  document.body.appendChild(fsOverlay);

  var fsControls = document.createElement('div');
  fsControls.id = 'bec-fs-controls';
  document.body.appendChild(fsControls);

  var fsBtn = document.createElement('button');
  fsBtn.id = 'bec-fs-btn';
  fsBtn.textContent = '⛶ Fullscreen';
  document.body.appendChild(fsBtn);

  var _origParent = null;
  var _origControls = null;

  function scaleFullscreen() {
    var canvas = getCanvas();
    if (!canvas) return;
    var size = cssSize(canvas);
    var controlsH = fsControls.offsetHeight || 64;
    var availW = window.innerWidth;
    var availH = window.innerHeight - controlsH;
    var sx = availW / size.w;
    var sy = availH / size.h;
    var sc = Math.min(sx, sy);
    canvas.style.transform = 'scale(' + sc + ')';
    canvas.style.transformOrigin = 'center center';
  }

  function openFullscreen() {
    var canvas = getCanvas();
    if (!canvas) return;

    _origParent = canvas.parentNode;
    fsOverlay.appendChild(canvas);
    fsOverlay.classList.add('active');

    var origCtrl = document.getElementById('controls') || document.querySelector('.controls');
    if (origCtrl) {
      _origControls = origCtrl;
      origCtrl.style.display = 'none';
      Array.from(origCtrl.children).forEach(function (btn) {
        var clone = btn.cloneNode(true);
        clone.setAttribute('onclick', btn.getAttribute('onclick'));
        fsControls.appendChild(clone);
      });
    }
    fsControls.classList.add('active');

    scaleFullscreen();
    fsBtn.textContent = '✕ Exit Fullscreen';
    fsBtn.classList.add('fs-active');
  }

  function closeFullscreen() {
    var canvas = getCanvas();
    if (!canvas) return;

    if (_origParent) _origParent.appendChild(canvas);
    fsOverlay.classList.remove('active');

    if (_origControls) _origControls.style.display = '';
    while (fsControls.firstChild) fsControls.removeChild(fsControls.firstChild);
    fsControls.classList.remove('active');

    canvas.style.transform = '';
    canvas.style.transformOrigin = '';
    scaleNormal();
    fsBtn.textContent = '⛶ Fullscreen';
    fsBtn.classList.remove('fs-active');
  }

  fsBtn.onclick = function () {
    if (fsOverlay.classList.contains('active')) closeFullscreen();
    else openFullscreen();
  };

})();
