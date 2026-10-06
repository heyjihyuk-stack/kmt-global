/* KMT Global — 책임 구조 모션그래픽 (SPEC §6 row 4, §3.4)
   Scrollytelling for <section id="structure">. No libraries, no fetch.
   - Desktop (≥960px): sticky SVG, 6 step texts; IntersectionObserver picks the
     step whose top has passed the viewport centre and writes state classes on
     the SVG:  r1…rN (reached → groups drawn)  +  is-sN (current → highlight).
   - Mobile (<960px): no sticky. A separate vertical drawing (.st-svg--m, made by
     _build/fragments/structure-m-gen.py) is shown once above text-only step cards and
     draws itself step by step when it scrolls in. (The old per-card copies of the big
     drawing were removed: labels got too small and the section ran ~4,400 px.)
   - prefers-reduced-motion: same states, switched instantly (CSS kills motion).
   - No JS / no IntersectionObserver: markup already shows the final state and
     every step text; nothing here runs.
*/
(function () {
  'use strict';

  var root = document.getElementById('structure');
  if (!root || !('IntersectionObserver' in window) || !window.matchMedia) return;
  // prefers-reduced-motion: 최종 상태(전체 도면 + 모든 스텝)를 그대로 둔다 — SPEC §3.4
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var svg = root.querySelector('.st-svg:not(.st-svg--m)');
  var svgM = root.querySelector('.st-svg--m');
  var steps = Array.prototype.slice.call(root.querySelectorAll('.st-step'));
  if (!svg || !steps.length) return;

  var N = steps.length;
  var now = root.querySelector('[data-st-now]');
  var ticks = root.querySelectorAll('.st-ticks i');
  var legends = root.querySelectorAll('[data-st-legend]');
  var mqDesk = window.matchMedia('(min-width: 960px)');
  var current = -1;

  function pad(n) { return (n < 10 ? '0' : '') + n; }

  // SVG elements: className is an SVGAnimatedString, so rewrite the attribute.
  function setState(el, n) {
    var keep = (el.getAttribute('class') || '').split(/\s+/).filter(function (c) {
      return c && !/^(r\d+|is-s\d+)$/.test(c);
    });
    for (var i = 1; i <= n; i++) keep.push('r' + i);
    keep.push('is-s' + n);
    el.setAttribute('class', keep.join(' '));
  }

  function go(n) {
    if (n === current) return;
    current = n;
    setState(svg, n);
    for (var i = 0; i < N; i++) steps[i].classList.toggle('is-active', i + 1 === n);
    for (var t = 0; t < ticks.length; t++) ticks[t].classList.toggle('is-on', t < n);
    for (var l = 0; l < legends.length; l++) {
      legends[l].classList.toggle('is-on', +legends[l].getAttribute('data-st-legend') === n);
    }
    if (now) now.textContent = pad(n);
  }

  // Active step = the last step whose top is above the viewport centre.
  // (Recomputed from geometry, so fast scrolling can never leave a stale state.)
  function pick() {
    var mid = window.innerHeight * 0.5;
    var n = 0;
    for (var i = 0; i < N; i++) {
      if (steps[i].getBoundingClientRect().top <= mid) n = i + 1;
    }
    // 시트가 화면 위쪽 절반에 들어오면 첫 장면부터 그린다(빈 도면이 오래 보이지 않게)
    if (!n && root.getBoundingClientRect().top < window.innerHeight * 0.45) n = 1;
    go(n);
  }

  root.classList.add('st--live');
  go(0);

  // 1%-tall band at the viewport centre; any crossing triggers a recompute.
  var io = new IntersectionObserver(pick, { rootMargin: '-50% 0px -49% 0px', threshold: 0 });
  steps.forEach(function (s) { io.observe(s); });
  var io2 = new IntersectionObserver(pick, { rootMargin: '0px 0px -55% 0px', threshold: [0, 0.01] });
  io2.observe(root);
  window.addEventListener('resize', pick, { passive: true });
  pick();

  /* ---------- mobile: the vertical drawing draws itself once ---------- */
  function setStateM(n, keepCurrent) {
    var keep = (svgM.getAttribute('class') || '').split(/\s+/).filter(function (c) {
      return c && !/^(r\d+|is-s\d+)$/.test(c);
    });
    for (var i = 1; i <= n; i++) keep.push('r' + i);
    if (keepCurrent && n) keep.push('is-s' + n);
    svgM.setAttribute('class', keep.join(' '));
  }
  if (svgM) {
    setStateM(0);
    var started = false;
    var mio = new IntersectionObserver(function (ents) {
      if (started || !ents[ents.length - 1].isIntersecting) return;
      started = true;
      mio.disconnect();
      var n = 0;
      (function next() {
        n++;
        setStateM(n, n < N);
        if (n < N) setTimeout(next, 320);
      })();
    }, { threshold: 0.2 });
    mio.observe(svgM);
  }
})();
