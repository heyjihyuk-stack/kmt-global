/*!
 * KMT Global · route.js (English page) — capability envelope chart (FIG. 14) + production route finder
 * No dependencies · works on file:// · markup: index-en.html #network (source _build/fragments/network.html)
 * Copy and decision rules: _build/content_ko.md §5-2·§5-3 (REV B); EN wording: _build/i18n/glossary.en.md §4.8–4.9
 * Same code as js/route.js; only the user-facing strings are English.
 *
 *  [data-nw-env]     chart host (empty div). JS draws an inline SVG to fit its width (redrawn on resize)
 *  [data-nw-route]   route cards A|B|C — highlight each other with the chart areas
 *  [data-nw-hl]      legend buttons A|B|C
 *  [data-nw-finder]  route finder root (data-mailto = fallback recipient address)
 *
 * Public API: KMTG.route.init(root?) · KMTG.route.evaluate(state)
 * Inquiry link: "Send an inquiry with these conditions" → calls KMTG.prefillContact(obj) if present, then goes to #contact;
 *               otherwise falls back to a mailto (subject and body prefilled). Also dispatches 'kmtg:route-prefill' on document.
 * Rules: no price or lead-time calculation · results are always "preliminary guidance" · area B has no numeric boundary (qualitative)
 */
(function () {
  'use strict';

  var KMTG = window.KMTG = window.KMTG || {};
  if (KMTG.route) return;

  var doc = document;
  var mqReduce = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  function reduced() { return !!(mqReduce && mqReduce.matches); }

  /* ------------------------------------------------------------------
   * domain (log10) — x: annual volume 1 → ~316,000 pcs / y: piece weight 1 kg → ~28 t
   * bands do not overlap (same boundaries as the input choices)
   * ------------------------------------------------------------------ */
  var X1 = 5.5, Y1 = 4.45;
  var LG = function (n) { return Math.log(n) / Math.LN10; };
  var LOG5T = LG(5000);

  var WB = { // piece weight: [lo, hi, label]
    w1: [0, 1, 'Under 10 kg'],
    w2: [1, 2, '10 kg to under 100 kg'],
    w3: [2, 3, '100 kg to under 1 t'],
    w4: [3, LOG5T, '1 t to 5 t'],
    w5: [LOG5T, 4, 'Over 5 t to 10 t'],
    w6: [4, Y1, 'Over 10 t']
  };
  var QB = { // annual volume
    q1: [0, LG(50), 'Under 50 pcs'],
    q2: [LG(50), LG(500), '50–499 pcs'],
    q3: [LG(500), LG(5000), '500–4,999 pcs'],
    q4: [LG(5000), X1, '5,000 pcs or more']
  };
  var MAT = { FC: 'Gray iron (GC/FC)', FCD: 'Ductile iron (GCD/FCD)', U: 'Not decided yet' };
  var MC = { Y: 'Required', N: 'Not required', U: 'Undecided' };
  var IATF = { Y: 'Required', N: 'Not required', U: 'Not sure' };
  /* Korean master-page value= of the RFQ checklist boxes (written as \u escapes) → English text for the email.
     The EN page's own values are already English (2026-10-19) and pass through unchanged. */
  var READY_EN = {
    '\ub3c4\uba74 \u2014 2D(PDF), \uac00\ub2a5\ud558\uba74 3D(STEP)': 'Drawings — 2D (PDF), plus 3D (STEP) if available',
    '\uc7ac\uc9c8 \uaddc\uaca9\uacfc \ud310': 'Material standard and edition',
    '\ub2e8\uc911 \ub610\ub294 \ub300\ub7b5\uc801\uc778 \ud06c\uae30': 'Piece weight or approximate size',
    '\uc5f0\uac04 \uc218\ub7c9\uacfc 1\ud68c \ubc1c\uc8fc \uc218\ub7c9(\ub85c\ud2b8)': 'Annual volume and quantity per order (lot size)',
    '\uac00\uacf5 \ubc94\uc704\uc640 \uacf5\ucc28 \uc694\uad6c': 'Machining scope and tolerance requirements',
    '\uac80\uc0ac\u00b7\ubb38\uc11c \uc694\uad6c': 'Inspection and document requirements',
    '\ud3ec\uc7a5\uacfc \uc778\ub3c4 \uc870\uac74(\uc778\ucf54\ud140\uc988) \ud76c\ub9dd': 'Preferred packing and delivery terms (Incoterms®)',
    '\ud76c\ub9dd \uc77c\uc815': 'Target schedule',
    'NDA \uc120\ud589 \ud544\uc694 \uc5ec\ubd80': 'Whether an NDA is needed first'
  };

  var RES = {
    'R-A': { big: 'A', tag: 'Furan no-bake', match: ['A'], card: '#nw-card-a',
      title: 'Furan no-bake casting — Goryeong foundry of our affiliate Korea Metal Tec',
      body: 'This route suits one-offs and low-volume, high-mix castings, from small-medium up to large sizes. Max. piece weight at the Goryeong foundry of our affiliate Korea Metal Tec: 10 t in gray iron, 5 t in ductile iron.' },
    'R-B': { big: 'B', tag: 'Automatic molding', match: ['B'], card: '#nw-card-b',
      title: 'Automatic molding — partner foundries',
      body: 'This route suits repeat volume production of small parts. The partner foundries include an IATF 16949-certified foundry; the certificate is held in the name of that production site.' },
    'R-AB': { big: 'A · B', tag: 'Borderline', match: ['A', 'B'], card: '#nw-cards',
      title: 'Route to be decided after drawing review',
      body: 'These conditions sit close to the boundary between the two routes. The right route depends on shape, volume and inspection requirements, so we propose it after drawing review.' },
    'R-S': { big: 'Review', tag: 'Drawing needed', match: [], card: '#nw-cards',
      title: 'Drawing review needed',
      body: 'For small parts in low volumes, the right route depends on the shape and the pattern conditions. Send us your drawing, and we will review it and reply.' },
    'R-X1': { big: 'Review', tag: 'Out of range', match: [], card: '#nw-cards',
      title: 'Piece weight beyond the confirmed range',
      body: 'Castings over 10 t are outside the production range confirmed at present. Send us your drawing and conditions, and we will review feasibility and tell you the result.' },
    'R-X2': { big: 'Review', tag: 'FCD over 5 t', match: [], card: '#nw-card-a',
      title: 'Ductile iron over 5 t',
      body: 'This exceeds the max. ductile iron piece weight (5 t) at the Goryeong foundry of our affiliate Korea Metal Tec. Send us your drawing, and we will review feasibility and reply.' }
  };
  // note badges sit in a 58px column (css .nw-result__why li b), so they stay short: Mat. = material, C = route C (machining)
  var NOTES = {
    'N-W5': ['+ Mat.', 'Piece weights over 5 t are confirmed for gray iron. The max. ductile iron piece weight at the Goryeong foundry of our affiliate Korea Metal Tec is 5 t.'],
    'N-C': ['+ C', 'Machining is done by external machining partners. KMT Global takes on machining process design, tolerance review and post-machining inspection.'],
    'N-IATF-B': ['+ IATF', 'We review this for the route through the IATF 16949-certified foundry. How the certificate can be verified is agreed only for that order.'],
    'N-IATF-A': ['+ IATF', 'The IATF 16949-certified foundry is one of the partner foundries (automatic molding). Whether this piece weight falls within its range is confirmed after drawing review.'],
    'N-IATF-L': ['+ IATF', 'On the furan no-bake route (Goryeong foundry of our affiliate Korea Metal Tec), the certification is ISO 9001:2015; this site is not IATF 16949-certified. If you need IATF 16949, please send us your drawing. We will review feasibility and reply.'],
    'N-M': ['+ Mat.', 'We can decide the material with you, based on the operating conditions and the drawing.']
  };
  var NOTE = 'Preliminary guidance — actual route and feasibility confirmed after drawing review';

  /* ------------------------------------------------------------------
   * decision (content_ko §5-3 decision rules) — pure function
   * state: { mat:'FC'|'FCD'|'U'|'', w:'w1'..'w6'|'', q:'q1'..'q4'|'', mc:'Y'|'N'|'U'|'', iatf:'Y'|'N'|'U'|'' }
   * ------------------------------------------------------------------ */
  function evaluate(s) {
    var w = s.w || '', q = s.q || '', mat = s.mat || '';
    var out = { kind: 'empty', code: '', notes: [], match: [] };
    if (!w) {
      out.prompt = q ? 'Choose a piece weight to see a likely route.' : 'Choose a piece weight and annual volume to see a likely route.';
      return out;
    }
    var code = '';
    if (w === 'w6') code = 'R-X1';
    else if (w === 'w5') code = mat === 'FCD' ? 'R-X2' : 'R-A';
    else if (w === 'w4') code = 'R-A';
    else if (!q) {
      out.prompt = 'Choose an annual volume to see a likely route.';
      return out;
    } else if (w === 'w3') code = q === 'q4' ? 'R-AB' : 'R-A';
    else if (w === 'w2') code = (q === 'q3' || q === 'q4') ? 'R-B' : 'R-AB';
    else code = (q === 'q3' || q === 'q4') ? 'R-B' : 'R-S';

    out.kind = /R-[AB]/.test(code) && code !== 'R-AB' ? 'route' : (code === 'R-AB' ? 'review' : 'special');
    out.code = code;
    var r = RES[code];
    out.big = r.big; out.tag = r.tag; out.title = r.title; out.body = r.body; out.card = r.card;
    out.match = r.match.slice();

    if (w === 'w5' && mat !== 'FC' && mat !== 'FCD') out.notes.push('N-W5');
    if (s.mc === 'Y') { out.notes.push('N-C'); out.match.push('C'); }
    if (s.iatf === 'Y') {
      if (code === 'R-B') out.notes.push('N-IATF-B');
      // 1 t and above (furan no-bake route): state clearly that this is outside the IATF-certified site's range
      else if (code === 'R-X2' || (code === 'R-A' && (w === 'w4' || w === 'w5'))) out.notes.push('N-IATF-L');
      else if (code === 'R-A' || code === 'R-AB') out.notes.push('N-IATF-A');
    }
    if (mat === 'U') out.notes.push('N-M');
    return out;
  }

  /* ------------------------------------------------------------------
   * envelope chart (inline SVG, width = actual px)
   * ------------------------------------------------------------------ */
  var uidN = 0;
  function r1(n) { return Math.round(n * 10) / 10; }
  function esc(t) { return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  function layout(w, mini) {
    var compact = !mini && w < 560;
    var m = mini ? { l: 34, r: 8, t: 10, b: 22 }
      : compact ? { l: 46, r: 10, t: 30, b: 46 }
        : { l: 60, r: 18, t: 34, b: 52 };
    var h = mini ? Math.round(w * 0.6) : compact ? Math.round(w * 1.06) : Math.round(w * 0.72);
    var L = { w: w, h: h, m: m, pw: w - m.l - m.r, ph: h - m.t - m.b, mini: !!mini, compact: compact };
    L.x = function (x) { return r1(m.l + x / X1 * L.pw); };
    L.y = function (y) { return r1(m.t + L.ph - y / Y1 * L.ph); };
    return L;
  }

  function pts(L, arr) {
    var s = [];
    for (var i = 0; i < arr.length; i++) s.push(L.x(arr[i][0]) + ',' + L.y(arr[i][1]));
    return s.join(' ');
  }

  function text(x, y, cls, t, anchor) {
    return '<text class="' + cls + '" x="' + r1(x) + '" y="' + r1(y) + '"' + (anchor ? ' text-anchor="' + anchor + '"' : '') + '>' + esc(t) + '</text>';
  }

  function buildSVG(L, opt) {
    var id = 'nwc' + (++uidN);
    var o = [];
    var x0 = L.m.l, x1 = L.m.l + L.pw, yb = L.m.t + L.ph, yt = L.m.t;
    var mini = L.mini, cp = L.compact;

    o.push('<svg class="nw-env__svg' + (cp ? ' is-compact' : '') + (mini ? ' is-mini' : '') + '" xmlns="http://www.w3.org/2000/svg" width="' + L.w + '" height="' + L.h + '" viewBox="0 0 ' + L.w + ' ' + L.h + '"' +
      (mini ? ' aria-hidden="true" focusable="false"' : ' role="group" aria-labelledby="' + id + 't ' + id + 'd"') + '>');
    if (!mini) {
      o.push('<title id="' + id + 't">FIG. 14 — Capability envelope (piece weight × annual volume, conceptual)</title>');
      o.push('<desc id="' + id + 'd">Conceptual capability chart. Horizontal axis: annual volume; vertical axis: piece weight. The furan no-bake area reaches up to 10 t in gray iron and 5 t in ductile iron (basis: Korea Metal Tec Goryeong foundry). ' +
        'The automatic molding area lies toward small parts and high volumes; its boundary is confirmed after drawing review. Machining links to both routes. The same information is given in the table below the chart.</desc>');
    }

    /* defs */
    o.push('<defs>');
    o.push('<pattern id="' + id + 'h" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line class="nw-hatch" x1="0" y1="0" x2="0" y2="7"/></pattern>');
    o.push('<pattern id="' + id + 's" width="6" height="6" patternUnits="userSpaceOnUse"><circle class="nw-dot" cx="3" cy="3" r="1.05"/></pattern>');
    // mask A: crisp polygon. The confirmed limit (10 t) is a solid cap line; unconfirmed edges (right diagonal, bottom) are drawn separately as dashed lines
    o.push('<mask id="' + id + 'ma" maskUnits="userSpaceOnUse" x="0" y="0" width="' + L.w + '" height="' + L.h + '"><polygon fill="#fff" points="' +
      pts(L, [[-1, 6], [2.62, 6], [2.62, 4], [3.62, 2.02], [-1, 2.02]]) + '"/></mask>');
    o.push('<clipPath id="' + id + 'ca"><rect x="' + x0 + '" y="' + L.y(4) + '" width="' + r1(L.pw) + '" height="' + r1(yb - L.y(4)) + '"/></clipPath>');
    o.push('<clipPath id="' + id + 'cp"><rect x="' + x0 + '" y="' + yt + '" width="' + r1(L.pw) + '" height="' + r1(L.ph) + '"/></clipPath>');
    // mask B: elliptical radial gradient (no numeric boundary)
    o.push('<radialGradient id="' + id + 'g"><stop offset="0" stop-color="#fff" stop-opacity="1"/><stop offset=".5" stop-color="#fff" stop-opacity=".9"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>');
    var bc = [L.x(4.12), L.y(1.12)], brx = r1(1.5 / X1 * L.pw), bry = r1(1.18 / Y1 * L.ph);
    o.push('<mask id="' + id + 'mb" maskUnits="userSpaceOnUse" x="0" y="0" width="' + L.w + '" height="' + L.h + '"><ellipse fill="url(#' + id + 'g)" cx="' + bc[0] + '" cy="' + bc[1] + '" rx="' + brx + '" ry="' + bry + '" transform="rotate(-10 ' + bc[0] + ' ' + bc[1] + ')"/></mask>');
    o.push('</defs>');

    /* grid */
    o.push('<g class="nw-grid nw-fade">');
    var d;
    for (d = 1; d <= 5; d++) o.push('<line x1="' + L.x(d) + '" y1="' + yt + '" x2="' + L.x(d) + '" y2="' + yb + '"/>');
    for (d = 1; d <= 4; d++) o.push('<line x1="' + x0 + '" y1="' + L.y(d) + '" x2="' + x1 + '" y2="' + L.y(d) + '"/>');
    o.push('</g>');

    /* area A */
    var aLabel = 'A Furan no-bake casting — Goryeong foundry of our affiliate Korea Metal Tec. Gray iron up to 10 t, ductile iron up to 5 t. Select to go to the route card';
    o.push('<a class="nw-reg nw-reg--a" data-reg="A" href="#nw-card-a"' + (mini ? ' tabindex="-1" aria-hidden="true"' : ' aria-label="' + esc(aLabel) + '"') + '>');
    o.push('<g clip-path="url(#' + id + 'ca)"><g mask="url(#' + id + 'ma)" class="nw-fade">' +
      '<rect class="nw-tint nw-tint--a" x="' + x0 + '" y="' + yt + '" width="' + r1(L.pw) + '" height="' + r1(L.ph) + '"/>' +
      '<rect class="nw-tint-hl nw-tint-hl--a" x="' + x0 + '" y="' + yt + '" width="' + r1(L.pw) + '" height="' + r1(L.ph) + '"/>' +
      '<rect fill="url(#' + id + 'h)" class="nw-pat" x="' + x0 + '" y="' + yt + '" width="' + r1(L.pw) + '" height="' + r1(L.ph) + '"/></g></g>');
    o.push('<polyline class="nw-aedge nw-fade" points="' + pts(L, [[2.62, 4], [3.62, 2.02], [0, 2.02]]) + '"/>');
    o.push('<polygon class="nw-hit" points="' + pts(L, [[0, 4], [2.62, 4], [3.5, 2.25], [0, 2.25]]) + '"/>');
    o.push('</a>');
    var mk = opt && opt.marker, mrect = null;
    if (mk) mrect = [L.x(mk.x[0]), L.x(mk.x[1]), L.y(mk.y[1]), L.y(mk.y[0])];
    function place(x0p, x1p, h, cands) { // first candidate (y, log) that does not overlap the marker → px
      var y = L.y(cands[0]);
      if (!mrect) return y;
      for (var i = 0; i < cands.length; i++) {
        var c = L.y(cands[i]);
        if (x1p < mrect[0] || x0p > mrect[1] || c + h < mrect[2] || c - 13 > mrect[3]) return c;
      }
      return y;
    }
    var labA = [];
    if (!mini) {
      var ax = L.x(0.14), ay = place(ax, ax + (cp ? 110 : 190), cp ? 18 : 22, cp ? [LOG5T - 0.47, 2.55] : [3.16, 2.6]);
      labA.push(text(ax, ay, 'nw-lbl', 'A  Furan no-bake'));
      labA.push(text(ax, ay + (cp ? 15 : 18), 'nw-lbl-sub', cp ? 'Affiliate · Korea Metal Tec' : 'Affiliate · Korea Metal Tec, Goryeong'));
    } else {
      labA.push(text(L.x(0.18), L.y(3.15), 'nw-lbl nw-lbl--mini', 'A'));
    }

    /* area B */
    var bLabel = 'B Automatic molding — partner foundries. Boundary confirmed after drawing review. Select to go to the route card';
    o.push('<a class="nw-reg nw-reg--b" data-reg="B" href="#nw-card-b"' + (mini ? ' tabindex="-1" aria-hidden="true"' : ' aria-label="' + esc(bLabel) + '"') + '>');
    o.push('<g clip-path="url(#' + id + 'cp)"><g mask="url(#' + id + 'mb)" class="nw-fade">' +
      '<rect class="nw-tint nw-tint--b" x="' + x0 + '" y="' + yt + '" width="' + r1(L.pw) + '" height="' + r1(L.ph) + '"/>' +
      '<rect class="nw-tint-hl nw-tint-hl--b" x="' + x0 + '" y="' + yt + '" width="' + r1(L.pw) + '" height="' + r1(L.ph) + '"/>' +
      '<rect fill="url(#' + id + 's)" class="nw-pat" x="' + x0 + '" y="' + yt + '" width="' + r1(L.pw) + '" height="' + r1(L.ph) + '"/></g>' +
      '<ellipse class="nw-bline nw-fade" cx="' + bc[0] + '" cy="' + bc[1] + '" rx="' + r1(brx * 0.8) + '" ry="' + r1(bry * 0.8) + '" transform="rotate(-10 ' + bc[0] + ' ' + bc[1] + ')"/></g>');
    o.push('<ellipse class="nw-hit" cx="' + bc[0] + '" cy="' + bc[1] + '" rx="' + r1(brx * 0.78) + '" ry="' + r1(bry * 0.78) + '" transform="rotate(-10 ' + bc[0] + ' ' + bc[1] + ')"/>');
    o.push('</a>');
    var labB = [];
    if (!mini) {
      var bx = cp ? L.x(4.06) : L.x(4.1), hw = cp ? 62 : 110;
      var by = place(bx - hw, bx + hw, cp ? 34 : 40, cp ? [1.38, 0.72, 1.98] : [1.42, 0.74, 1.98]);
      var bw = cp ? 128 : 162;
      labB.push('<rect class="nw-lblbg" x="' + r1(bx - bw / 2) + '" y="' + r1(by - (cp ? 14 : 16)) + '" width="' + bw + '" height="' + (cp ? 50 : 58) + '" rx="3"/>');
      labB.push(text(bx, by, 'nw-lbl', 'B  Automatic molding', 'middle'));
      labB.push(text(bx, by + (cp ? 15 : 18), 'nw-lbl-sub', 'Partner foundries', 'middle'));
      labB.push(text(bx, by + (cp ? 30 : 35), 'nw-lbl-note', cp ? 'Boundary after review' : 'Boundary after drawing review', 'middle'));
    } else {
      labB.push(text(L.x(4.25), L.y(1.0), 'nw-lbl nw-lbl--mini', 'B', 'middle'));
    }

    /* cap lines: FC 10 t · FCD 5 t (basis: Korea Metal Tec Goryeong foundry, confirmed figures) */
    var y10 = L.y(4), y5 = L.y(LOG5T), xe10 = L.x(2.62), xe5 = L.x(2.62 + (4 - LOG5T) / 2 * 1.0);
    o.push('<g class="nw-cap">');
    o.push('<line class="nw-cap10 nw-draw" pathLength="1" x1="' + x0 + '" y1="' + y10 + '" x2="' + xe10 + '" y2="' + y10 + '"/>');
    o.push('<line class="nw-cap10" x1="' + xe10 + '" y1="' + r1(y10 - 5) + '" x2="' + xe10 + '" y2="' + r1(y10 + 5) + '"/>');
    o.push('<line class="nw-cap5 nw-draw" pathLength="1" x1="' + x0 + '" y1="' + y5 + '" x2="' + xe5 + '" y2="' + y5 + '"/>');
    o.push('<line class="nw-cap5" x1="' + xe5 + '" y1="' + r1(y5 - 4) + '" x2="' + xe5 + '" y2="' + r1(y5 + 4) + '"/>');
    o.push('</g>');
    var labCap = '';
    if (!mini) {
      var lx0 = L.x(0.14);
      labCap = '<g class="nw-fade nw-caplbl">' +
        '<text x="' + lx0 + '" y="' + r1(y10 - 7) + '"><tspan class="nw-dim nw-dim--strong">FC max. 10 t</tspan>' +
        (cp ? '' : '<tspan class="nw-dim-src" dx="10">Korea Metal Tec, Goryeong</tspan>') + '</text>' +
        '<text x="' + lx0 + '" y="' + r1(y5 + (cp ? 14 : 16)) + '"><tspan class="nw-dim">FCD max. 5 t</tspan>' +
        (cp ? '' : '<tspan class="nw-dim-src" dx="10">same basis</tspan>') + '</text></g>';
      // narrow screens: a source note next to the cap lines would collide with the C note, so the area A label (affiliate, Goryeong) sits just below the two cap lines
    }

    /* marker for the selected conditions */
    if (mk) {
      var mx0 = L.x(mk.x[0]), mx1 = L.x(mk.x[1]), my0 = L.y(mk.y[1]), my1 = L.y(mk.y[0]);
      o.push('<g class="nw-mark" clip-path="url(#' + id + 'cp)"><rect class="nw-mark-box" x="' + mx0 + '" y="' + my0 + '" width="' + r1(mx1 - mx0) + '" height="' + r1(my1 - my0) + '"/></g>');
    }

    /* labels (above the marker) */
    o.push('<g class="nw-lblg nw-fade" data-reg="A">' + labA.join('') + '</g>');
    o.push('<g class="nw-lblg nw-fade" data-reg="B">' + labB.join('') + '</g>');
    o.push(labCap);

    /* borderline note + C overlay note */
    if (!mini) {
      var qx = L.x(cp ? 3.42 : 3.72), qy = L.y(cp ? 2.66 : 2.62), qr = cp ? 7 : 8;
      o.push('<g class="nw-q nw-fade"><circle cx="' + qx + '" cy="' + qy + '" r="' + qr + '"/>' +
        text(qx, qy + 4, 'nw-q-t', '?', 'middle') +
        text(qx + qr + 5, qy - 2, 'nw-lbl-note', 'Borderline') +
        text(qx + qr + 5, qy + (cp ? 11 : 13), 'nw-lbl-note', cp ? 'After review' : 'After drawing review') + '</g>');

      var cw = cp ? 150 : 214, ch = cp ? 40 : 46;
      var cx = r1(x1 - cw - (cp ? 2 : 6)), cy = r1(L.y(cp ? 4.3 : 4.25));
      var cAx = L.x(cp ? 2.72 : 2.86), cAy = L.y(cp ? 3.32 : 3.36);
      var cBx = r1(cx + cw * 0.82), cBy = L.y(1.9);
      o.push('<a class="nw-cnote" data-reg="C" href="#nw-card-c" aria-label="C Machining — linked to both routes, machining partners. Select to go to the route card">');
      o.push('<g class="nw-fade"><path class="nw-lead" d="M' + cx + ' ' + r1(cy + ch * 0.7) + ' L' + cAx + ' ' + cAy + '"/>' +
        '<path class="nw-lead" d="M' + cBx + ' ' + r1(cy + ch) + ' L' + cBx + ' ' + cBy + '"/>' +
        '<circle class="nw-lead-dot" cx="' + cAx + '" cy="' + cAy + '" r="2.4"/><circle class="nw-lead-dot" cx="' + cBx + '" cy="' + cBy + '" r="2.4"/>' +
        '<rect class="nw-cbox" x="' + cx + '" y="' + cy + '" width="' + cw + '" height="' + ch + '" rx="3"/>' +
        text(cx + 10, cy + (cp ? 17 : 19), 'nw-lbl nw-lbl--c', cp ? '+C  Machining — A & B' : '+C  Machining — both routes') +
        text(cx + 10, cy + (cp ? 32 : 36), 'nw-lbl-sub', 'Machining partners') + '</g>');
      o.push('</a>');
    }

    /* axes */
    o.push('<g class="nw-axis">');
    o.push('<line class="nw-draw" pathLength="1" x1="' + x0 + '" y1="' + yb + '" x2="' + x1 + '" y2="' + yb + '"/>');
    o.push('<line class="nw-draw" pathLength="1" x1="' + x0 + '" y1="' + yb + '" x2="' + x0 + '" y2="' + yt + '"/>');
    var k, mt = [];
    for (d = 0; d < 6; d++) for (k = 2; k <= 9; k++) {
      var lx2 = d + LG(k);
      if (lx2 < X1) mt.push('M' + L.x(lx2) + ' ' + yb + 'v3');
    }
    for (d = 0; d < 5; d++) for (k = 2; k <= 9; k++) {
      var ly2 = d + LG(k);
      if (ly2 < Y1) mt.push('M' + x0 + ' ' + L.y(ly2) + 'h-3');
    }
    o.push('<path class="nw-minor" d="' + mt.join('') + '"/>');
    for (d = 0; d <= 5; d++) o.push('<line x1="' + L.x(d) + '" y1="' + yb + '" x2="' + L.x(d) + '" y2="' + (yb + 6) + '"/>');
    for (d = 0; d <= 4; d++) o.push('<line x1="' + x0 + '" y1="' + L.y(d) + '" x2="' + (x0 - 6) + '" y2="' + L.y(d) + '"/>');
    o.push('</g>');

    var xt = mini ? ['1', '', '100', '', '10k', ''] : cp ? ['1', '10', '100', '1k', '10k', '100k'] : ['1', '10', '100', '1,000', '10,000', '100,000'];
    var yt2 = mini ? ['1 kg', '', '100 kg', '', '10 t'] : ['1 kg', '10 kg', '100 kg', '1 t', '10 t'];
    o.push('<g class="nw-tick">');
    for (d = 0; d <= 5; d++) if (xt[d]) o.push(text(L.x(d), yb + (mini ? 15 : 20), '', xt[d], d === 0 ? 'start' : 'middle'));
    for (d = 0; d <= 4; d++) if (yt2[d]) o.push(text(x0 - (mini ? 5 : 9), L.y(d) + 4, '', yt2[d], 'end'));
    o.push('</g>');
    if (!mini) {
      o.push(text(x0 - (cp ? 40 : 52), yt - (cp ? 14 : 16), 'nw-axt', '↑ Piece weight (log scale)'));
      o.push(text(x1, yb + (cp ? 40 : 44), 'nw-axt', cp ? 'Annual volume (pcs, log) →' : 'Annual volume (pcs, log scale) →', 'end'));
    }
    o.push('</svg>');
    return o.join('');
  }

  /* ------------------------------------------------------------------
   * highlight (chart areas ↔ route cards ↔ legend)
   * ------------------------------------------------------------------ */
  function Net(root) {
    this.root = root;
    this.hover = '';
    this.pin = '';
    this.match = [];
    this.marker = null;
    this.charts = [];
  }
  Net.prototype.apply = function () {
    var on = this.hover || this.pin;
    var all = this.root.querySelectorAll('[data-nw-route],[data-reg],[data-nw-hl]');
    for (var i = 0; i < all.length; i++) {
      var el = all[i];
      var c = el.getAttribute('data-nw-route') || el.getAttribute('data-reg') || el.getAttribute('data-nw-hl');
      el.classList.toggle('is-hl', !!on && c === on);
      el.classList.toggle('is-dim', !!on && c !== on && on !== 'C');
      el.classList.toggle('is-match', this.match.indexOf(c) > -1);
      if (el.hasAttribute('data-nw-hl')) el.setAttribute('aria-pressed', this.pin === c ? 'true' : 'false');
    }
    var envs = this.root.querySelectorAll('.nw-env, .nw-mini');
    for (var j = 0; j < envs.length; j++) envs[j].classList.toggle('has-hl', !!on);
  };
  Net.prototype.setHover = function (c) { this.hover = c || ''; this.apply(); };
  Net.prototype.setPin = function (c, scroll) {
    this.pin = this.pin === c ? '' : c;
    this.apply();
    if (scroll && this.pin) {
      var card = this.root.querySelector('[data-nw-route="' + c + '"]');
      if (card) {
        var r = card.getBoundingClientRect();
        var vh = window.innerHeight || doc.documentElement.clientHeight;
        if (r.top < 72 || r.bottom > vh) card.scrollIntoView({ block: 'nearest', behavior: reduced() ? 'auto' : 'smooth' });
      }
    }
  };

  function codeOf(t, root) {
    var el = t && t.closest ? t.closest('[data-reg],[data-nw-hl],[data-nw-route]') : null;
    if (!el || !root.contains(el)) return '';
    return el.getAttribute('data-reg') || el.getAttribute('data-nw-hl') || el.getAttribute('data-nw-route') || '';
  }

  function Chart(net, host, mini) {
    this.net = net; this.host = host; this.mini = !!mini; this.w = 0;
    var self = this;
    this.render();
    if (window.ResizeObserver) {
      var raf = 0;
      new ResizeObserver(function () {
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(function () { self.render(); });
      }).observe(host);
    } else {
      window.addEventListener('resize', function () { self.render(); });
    }
  }
  Chart.prototype.render = function (force) {
    var w = Math.floor(this.host.clientWidth);
    if (!w) return;
    if (w === this.w && !force) return;
    this.w = w;
    this.host.innerHTML = buildSVG(layout(w, this.mini), { marker: this.net.marker });
    this.net.apply();
  };

  /* ------------------------------------------------------------------
   * route finder widget
   * ------------------------------------------------------------------ */
  function Finder(net, el) {
    this.net = net; this.el = el;
    this.form = el.querySelector('form');
    this.out = {
      route: el.querySelector('[data-nw-route-out]'),
      title: el.querySelector('[data-nw-title]'),
      body: el.querySelector('[data-nw-body]'),
      why: el.querySelector('[data-nw-why]'),
      cta: el.querySelector('[data-nw-cta]'),
      link: el.querySelector('[data-nw-cardlink]'),
      live: el.querySelector('[data-nw-live]'),
      region: el.querySelector('.nw-result')
    };
    this.res = evaluate({});
    var self = this;

    this.form.addEventListener('submit', function (e) { e.preventDefault(); });
    this.form.addEventListener('change', function () { self.update(); });
    var reset = el.querySelector('[data-nw-reset]');
    if (reset) reset.addEventListener('click', function () { self.form.reset(); self.update(); });
    var show = el.querySelector('[data-nw-show]');
    var msgEl = el.querySelector('[data-nw-msg]');
    this.msgEl = msgEl;
    if (show) show.addEventListener('click', function () {
      self.update();
      if (self.res.kind === 'empty') {
        var s = self.state();
        if (msgEl) msgEl.textContent = !s.w && !s.q ? 'Please choose a piece weight and annual volume first.' : (!s.w ? 'Please choose a piece weight first.' : 'Please choose an annual volume first.');
        return;
      }
      var reg = self.out.region;
      if (!reg) return;
      reg.scrollIntoView({ block: 'start', behavior: reduced() ? 'auto' : 'smooth' });
      try { reg.focus({ preventScroll: true }); } catch (err) { reg.focus(); }
    });
    el.addEventListener('change', function (e) {
      if (e.target.closest && e.target.closest('[data-nw-check]')) self.syncCta();
    });
    if (this.out.cta) this.out.cta.addEventListener('click', function (e) { self.submit(e); });
    this.update();
  }
  Finder.prototype.val = function (name) {
    var c = this.form.querySelector('input[name="' + name + '"]:checked');
    return c ? c.value : '';
  };
  Finder.prototype.state = function () {
    return { mat: this.val('nw-mat'), w: this.val('nw-w'), q: this.val('nw-v'), mc: this.val('nw-mc'), iatf: this.val('nw-iatf') };
  };
  Finder.prototype.update = function () {
    var s = this.state();
    var r = this.res = evaluate(s);
    var o = this.out;
    if (this.msgEl) this.msgEl.textContent = '';

    this.el.setAttribute('data-kind', r.kind);
    if (r.kind === 'empty') {
      o.route.textContent = '—';
      o.title.textContent = r.prompt;
      o.body.textContent = '';
      o.why.innerHTML = '';
    } else {
      var withC = s.mc === 'Y' && (r.code === 'R-A' || r.code === 'R-B' || r.code === 'R-AB');
      o.route.innerHTML = esc(r.big) + (withC ? ' + C' : '') + ' <small>' + esc(r.tag) + '</small>';
      o.title.textContent = r.title;
      o.body.textContent = r.body;
      o.why.innerHTML = r.notes.map(function (k) { return '<li><b>' + esc(NOTES[k][0]) + '</b>' + esc(NOTES[k][1]) + '</li>'; }).join('');
    }
    if (o.link) o.link.setAttribute('href', r.card || '#nw-cards');
    if (o.live) { // debounce, so screen readers do not announce every change while the user is still choosing
      var msg = r.kind === 'empty' ? '' : 'Likely route: ' + r.title + '. ' + NOTE + '.';
      clearTimeout(this.liveT);
      this.liveT = setTimeout(function () { o.live.textContent = msg; }, 450);
    }

    var net = this.net;
    net.match = r.kind === 'empty' ? [] : r.match.slice();
    if (s.w || s.q) {
      var wb = s.w ? WB[s.w] : [0, Y1], qb = s.q ? QB[s.q] : [0, X1];
      net.marker = { x: [qb[0], qb[1]], y: [wb[0], wb[1]] };
    } else net.marker = null;
    for (var c = 0; c < net.charts.length; c++) net.charts[c].render(true);
    var ml = net.root.querySelectorAll('[data-nw-markleg]');
    for (var q = 0; q < ml.length; q++) ml[q].hidden = !net.marker;
    net.apply();
    this.syncCta();
  };
  Finder.prototype.payload = function () {
    var s = this.state(), r = this.res;
    var ready = [];
    var cks = this.el.querySelectorAll('[data-nw-check] input:checked');
    for (var i = 0; i < cks.length; i++) ready.push(Object.prototype.hasOwnProperty.call(READY_EN, cks[i].value) ? READY_EN[cks[i].value] : cks[i].value);
    var obj = {
      source: 'route-finder',
      materialKey: s.mat || '',
      material: s.mat ? MAT[s.mat] : '',
      weight: s.w ? WB[s.w][2] : '',
      qty: s.q ? QB[s.q][2] : '',
      machiningKey: s.mc || '',
      machining: s.mc ? MC[s.mc] : '',
      iatf: s.iatf ? IATF[s.iatf] : '',
      code: r.code || '',
      title: r.title || '',
      ready: ready,
      note: NOTE
    };
    var L = [
      'Hello KMT Global Sales,',
      'Please review our drawing on the basis of the conditions we selected in the route finder.',
      '',
      '■ Material: ' + (obj.material || '-'),
      '■ Piece weight: ' + (obj.weight || '-'),
      '■ Annual volume: ' + (obj.qty || '-'),
      '■ Machining: ' + (obj.machining || '-'),
      '■ IATF 16949-certified site: ' + (obj.iatf || '-'),
      '■ Information ready: ' + (ready.length ? ready.join('; ') : '-'),
      '',
      'Drawing files: attached to this email (2D PDF, plus 3D STEP if available).',
      '(Route finder — preliminary guidance: ' + (obj.title || '-') + ')',
      '',
      'Best regards,'
    ];
    obj.message = L.join('\r\n');
    obj.subject = '[Drawing review request] ' + [obj.material, obj.weight].filter(Boolean).join(' · ');
    return obj;
  };
  Finder.prototype.mailto = function (obj) {
    var to = this.el.getAttribute('data-mailto') || '';
    return 'mailto:' + to + '?subject=' + encodeURIComponent(obj.subject) + '&body=' + encodeURIComponent(obj.message);
  };
  Finder.prototype.syncCta = function () {
    var cta = this.out.cta;
    if (!cta) return;
    if (!(KMTG && typeof KMTG.prefillContact === 'function')) cta.setAttribute('href', this.mailto(this.payload()));
  };
  Finder.prototype.submit = function (e) {
    var obj = this.payload();
    try { doc.dispatchEvent(new CustomEvent('kmtg:route-prefill', { detail: obj })); } catch (err) { /* old browsers */ }
    var cta = this.out.cta;
    if (KMTG && typeof KMTG.prefillContact === 'function') {
      cta.setAttribute('href', '#contact');
      KMTG.prefillContact(obj);
      if (!doc.querySelector('#contact')) e.preventDefault();
    } else {
      cta.setAttribute('href', this.mailto(obj));
    }
  };

  /* ------------------------------------------------------------------
   * init
   * ------------------------------------------------------------------ */
  function init(root) {
    root = root || doc;
    var scopes = root.matches && root.matches('[data-nw]') ? [root] : root.querySelectorAll('[data-nw]');
    for (var i = 0; i < scopes.length; i++) setup(scopes[i]);
  }

  function setup(scope) {
    if (scope.__nw) return scope.__nw;
    var net = scope.__nw = new Net(scope);

    var hosts = scope.querySelectorAll('[data-nw-env]');
    for (var i = 0; i < hosts.length; i++) net.charts.push(new Chart(net, hosts[i], hosts[i].hasAttribute('data-mini')));

    // the table (fallback content) is collapsed when JS runs
    var tbl = scope.querySelectorAll('details[data-nw-table]');
    for (var t = 0; t < tbl.length; t++) tbl[t].open = false;

    // highlight: mouse · focus · tap
    scope.addEventListener('mouseover', function (e) { var c = codeOf(e.target, scope); if (c !== net.hover) net.setHover(c); });
    scope.addEventListener('mouseleave', function () { net.setHover(''); });
    scope.addEventListener('focusin', function (e) { net.setHover(codeOf(e.target, scope)); });
    scope.addEventListener('focusout', function () { net.setHover(''); });
    scope.addEventListener('click', function (e) {
      var el = e.target.closest ? e.target.closest('[data-reg],[data-nw-hl]') : null;
      if (!el || !scope.contains(el)) return;
      e.preventDefault();
      net.setPin(el.getAttribute('data-reg') || el.getAttribute('data-nw-hl'), true);
    });

    // line drawing on entry
    var envs = scope.querySelectorAll('.nw-env');
    var show = function (el) { el.classList.add('is-in'); };
    if (!reduced() && 'IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (ents) {
        ents.forEach(function (en) { if (en.isIntersecting) { show(en.target); io.unobserve(en.target); } });
      }, { threshold: 0.25 });
      for (var k = 0; k < envs.length; k++) io.observe(envs[k]);
    } else {
      for (var m = 0; m < envs.length; m++) show(envs[m]);
    }

    var f = scope.querySelector('[data-nw-finder]');
    if (f) net.finder = new Finder(net, f);
    net.apply();
    return net;
  }

  KMTG.route = { init: init, evaluate: evaluate };

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', function () { init(); });
  else init();
})();
