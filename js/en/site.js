/*!
 * KMT Global · site.js (English page) — shared behavior (no dependencies · works on file://)
 *  1 Goryeong local time (KST) · 2 header (sticky · progress · current sheet) + desktop sheet indicator
 *  3 mobile menu + bottom CTA bar · 4 reveal on entry + FIG line drawing · 5 engineering callout pins
 *  6 parts filter + detail panel · 7 material cross-reference tabs · 8 process tracker · 9 FAQ links
 *  10 inquiry email builder (mailto · Gmail · Outlook) + KMTG.prefillContact · 11 copy address · (12 maker mail: removed)
 *  13 horizontally scrolling tables (hint and fade only when they overflow) · 14 mobile fold-outs · 15 content-visibility anchor fix
 * When it runs to the end, KMTG.ready = true — the safety check in the page keeps the js class based on it.
 * With JS off, all content stays visible (initial hiding only applies under html.js, css/site.css).
 * Same code as js/site.js; only the user-facing strings are English. The contact form's value= attributes
 * are English (2026-10-19, so the no-JS mailto fallback sends English too); FORM_EN below still turns the
 * Korean master-page values into English, so either set of values works.
 */
(function () {
  'use strict';

  var KMTG = window.KMTG = window.KMTG || {};
  var doc = document;
  var MAIL = (document.getElementById('cf')&&document.getElementById('cf').getAttribute('action')||'mailto:sales@kmtglobalco.com').replace(/^mailto:/,'');
  var mqRM = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  function reduced() { return mqRM.matches; }
  function $(s, c) { return (c || doc).querySelector(s); }
  function $$(s, c) { return Array.prototype.slice.call((c || doc).querySelectorAll(s)); }
  function enc(t) { return encodeURIComponent(t); }
  function hasIO() { return 'IntersectionObserver' in window; }

  /* Korean master-page value= attributes (written as \u escapes) → English text used in the email.
     The EN page's own values are already English (e.g. "Gray iron (GC/FC)", "PPAP") and pass through unchanged. */
  var FORM_EN = {
    '\ud68c\uc8fc\ucca0(GC/FC)': 'Gray iron (GC/FC)',
    '\uad6c\uc0c1\ud751\uc5f0\uc8fc\ucca0(GCD/FCD)': 'Ductile iron (GCD/FCD)',
    '\uae30\ud0c0\u00b7\ubbf8\uc815': 'Other / undecided',
    '\ud544\uc694': 'Required',
    '\ud544\uc694 \uc5c6\uc74c': 'Not required',
    '\ubbf8\uc815': 'Undecided',
    '\uc81c\uc870\uc0ac \uac80\uc0ac \ubb38\uc11c(EN 10204 3.1 \ub4f1)': "Manufacturer's inspection documents (e.g. EN 10204 3.1)",
    '\uce58\uc218 \uac80\uc0ac \ubcf4\uace0\uc11c': 'Dimensional inspection report',
    '\ucd08\ud488 \uac80\uc0ac(FAI)': 'First article inspection (FAI)',
    '\ube44\ud30c\uad34\uac80\uc0ac \ubcf4\uace0\uc11c': 'NDT report',
    '\uc6d0\uc0b0\uc9c0 \uc99d\ube59': 'Proof of origin',
    '\uae30\ud0c0': 'Other',
    '\uc608': 'Yes',
    '\uc544\ub2c8\uc694': 'No'
  };
  var NDA_YES = 'Yes'; // value of the "Yes — NDA needed before drawings" radio (fe() also maps the Korean '\uc608')
  function fe(x) { return Object.prototype.hasOwnProperty.call(FORM_EN, x) ? FORM_EN[x] : x; }

  /* screen-reader announcements */
  var live = doc.createElement('p');
  live.className = 'sr';
  live.setAttribute('aria-live', 'polite');
  function say(t) { live.textContent = ''; setTimeout(function () { live.textContent = t; }, 60); }

  /* ---------- 1 · Goryeong local time ---------- */
  function initClock() {
    var el = $('[data-clock]');
    if (!el || !window.Intl) return;
    var tEl = $('[data-clock-time]', el), srEl = $('[data-clock-sr]', el);
    var inl = $('[data-clock-inline]');
    var fmt;
    try {
      fmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Seoul', weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false });
    } catch (e) { return; }
    function tick() {
      var o = {};
      (fmt.formatToParts ? fmt.formatToParts(new Date()) : []).forEach(function (p) { o[p.type] = p.value; });
      if (!o.hour) return;
      var hh = o.hour === '24' ? '00' : o.hour, mm = o.minute;
      var mins = (+hh) * 60 + (+mm);
      var open = o.weekday !== 'Sat' && o.weekday !== 'Sun' && mins >= 480 && mins < 1080; // Mon–Fri 08:00–18:00
      var st = open ? 'Open now' : 'Outside business hours';
      tEl.textContent = hh + ':' + mm;
      if (srEl) srEl.textContent = 'Local time in Goryeong: ' + hh + ':' + mm + ' KST (Korea Standard Time). Business hours: 08:00 to 18:00, Monday to Friday.';
      if (inl) inl.textContent = 'Now in Goryeong ' + hh + ':' + mm + ' · ' + st;
    }
    tick();
    setTimeout(function () { tick(); setInterval(tick, 60000); }, (60 - new Date().getSeconds()) * 1000 + 200);
  }

  /* ---------- 2 · header · progress · current sheet ---------- */
  function initHeader() {
    var hdr = $('#header');
    if (!hdr) return;
    var prog = $('[data-progress]');
    var sheets = $$('[data-sheet]');
    var links = $$('.nav a[data-nav], .mnav__list a');
    var sn = $('[data-sheetnav]');
    var snNo = $('[data-sheetnav-no]'), snName = $('[data-sheetnav-name]'), snNext = $('[data-sheetnav-next]');
    var cur = null, queued = false;

    function setCurrent(c) {
      var id = c ? c.id : '';
      links.forEach(function (a) {
        if (a.getAttribute('href') === '#' + id) a.setAttribute('aria-current', 'true');
        else a.removeAttribute('aria-current');
      });
      if (!sn || !c) return;
      snNo.textContent = c.getAttribute('data-sheet');
      snName.textContent = c.getAttribute('data-sheet-name');
      var nx = sheets[sheets.indexOf(c) + 1];
      if (nx) {
        snNext.hidden = false;
        snNext.setAttribute('href', '#' + nx.id);
        snNext.textContent = 'Next ';
        snNext.setAttribute('aria-label', 'Next sheet: ' + nx.getAttribute('data-sheet-name'));
        snNext.setAttribute('title', 'Next: ' + nx.getAttribute('data-sheet-name'));
        var a = doc.createElement('span'); a.setAttribute('aria-hidden', 'true'); a.textContent = '↓';
        snNext.appendChild(a);
      } else {
        snNext.hidden = true;
      }
    }

    function frame() {
      queued = false;
      var y = window.pageYOffset || doc.documentElement.scrollTop;
      var vh = window.innerHeight;
      var max = doc.documentElement.scrollHeight - vh;
      hdr.classList.toggle('is-stuck', hdr.getBoundingClientRect().top <= 0 && y > 8);
      if (prog) prog.style.transform = 'scaleX(' + (max > 0 ? Math.min(1, Math.max(0, y / max)) : 0).toFixed(4) + ')';
      var line = vh * 0.38, c = sheets[0];
      for (var i = 0; i < sheets.length; i++) if (sheets[i].getBoundingClientRect().top <= line) c = sheets[i];
      if (c !== cur) { cur = c; setCurrent(c); }
      if (sn) {
        var foot = $('#footer');
        var off = y < vh * 0.7 || (c && c.id === 'contact') || (foot && foot.getBoundingClientRect().top < vh);
        sn.classList.toggle('is-off', !!off);
        if ('inert' in sn) sn.inert = !!off;
      }
    }
    function onScroll() { if (!queued) { queued = true; requestAnimationFrame(frame); } }
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    // After a big jump (keyboard focus, Ctrl+F, scrollIntoView) off-screen sheets (content-visibility) switch to
    // their real size, but no further scroll event arrives → recompute on sheet resize, scroll end and focus moves
    if ('ResizeObserver' in window) {
      var ro = new ResizeObserver(onScroll);
      sheets.forEach(function (s) { ro.observe(s); });
    }
    window.addEventListener('scrollend', onScroll, { passive: true });
    doc.addEventListener('focusin', onScroll);
    if (sn) sn.hidden = false;
    onScroll();
  }

  /* ---------- 3 · mobile menu + bottom CTA bar ---------- */
  function initMenu() {
    var btn = $('[data-menu-btn]'), panel = $('[data-mnav]'), label = $('[data-menu-label]');
    if (!btn || !panel) return;
    var outside = $$('.skip, .util, main, footer, .sheetnav, .mbar');
    function shield(open) {
      outside.forEach(function (el) {
        if (open) { el._inertPrev = !!el.inert; el.inert = true; if (!('inert' in el)) el.setAttribute('aria-hidden', 'true'); }
        else { el.inert = !!el._inertPrev; if (!('inert' in el)) el.removeAttribute('aria-hidden'); }
      });
    }
    function set(open) {
      if ((btn.getAttribute('aria-expanded') === 'true') === open) return;
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      shield(open);
      if (label) label.textContent = open ? 'Close menu' : 'Open menu';
      if (open) panel.style.setProperty('--mnav-top', Math.max(0, $('#header').getBoundingClientRect().bottom) + 'px');
      panel.classList.toggle('is-open', open);
      doc.body.classList.toggle('menu-open', open);
      if (open) { var f = $('a', panel); if (f) f.focus({ preventScroll: true }); }
    }
    btn.addEventListener('click', function () { set(btn.getAttribute('aria-expanded') !== 'true'); });
    panel.addEventListener('click', function (e) { if (e.target.closest('a')) set(false); });
    doc.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && btn.getAttribute('aria-expanded') === 'true') { set(false); btn.focus(); }
    });
    var mq = window.matchMedia('(min-width: 1181px)');
    var onMq = function () { if (mq.matches) set(false); };
    if (mq.addEventListener) mq.addEventListener('change', onMq); else if (mq.addListener) mq.addListener(onMq);
  }

  function initMbar() {
    var bar = $('[data-mbar]');
    if (!bar || !hasIO()) return;
    var hide = {};
    var io = new IntersectionObserver(function (ents) {
      ents.forEach(function (en) { hide[en.target.id] = en.isIntersecting; });
      var off = hide.contact || hide.footer;
      bar.classList.toggle('is-off', !!off);
      if ('inert' in bar) bar.inert = !!off;
    }, { threshold: 0.05 });
    ['contact', 'footer'].forEach(function (id) { var el = doc.getElementById(id); if (el) io.observe(el); });

  }

  /* ---------- 4 · reveal on entry + FIG line drawing ---------- */
  function prepFig(svg) {
    var outs = svg.querySelectorAll('.ln-out > [pathLength]');
    var ins = svg.querySelectorAll('.ln-in > [pathLength]');
    var i;
    for (i = 0; i < outs.length; i++) outs[i].style.setProperty('--dl', (i / Math.max(1, outs.length) * 0.32).toFixed(3) + 's');
    for (i = 0; i < ins.length; i++) ins[i].style.setProperty('--dl', (0.18 + i / Math.max(1, ins.length) * 0.4).toFixed(3) + 's');
  }
  function drawFig(svg) {
    if (svg.classList.contains('is-drawn')) return;
    svg.classList.add('is-drawn');
    var map = svg.closest('.pins__map');
    if (map) setTimeout(function () { map.classList.add('is-ready'); }, reduced() ? 0 : 1100);
  }
  KMTG.drawFig = drawFig;

  function initReveal() {
    var items = $$('[data-reveal]');
    var figs = $$('.fig');
    items.forEach(function (el) {
      var idx = Array.prototype.indexOf.call(el.parentNode.children, el);
      el.style.setProperty('--rd', (idx % 4) * 70 + 'ms');
    });
    figs.forEach(prepFig);
    if (reduced() || !hasIO()) {
      items.forEach(function (el) { el.classList.add('is-in'); });
      figs.forEach(drawFig);
      return;
    }
    var io = new IntersectionObserver(function (ents) {
      ents.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); } });
    }, { rootMargin: '0px 0px -6% 0px', threshold: 0.06 });
    items.forEach(function (el) { io.observe(el); });
    var fio = new IntersectionObserver(function (ents) {
      ents.forEach(function (en) { if (en.isIntersecting) { drawFig(en.target); fio.unobserve(en.target); } });
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.25 });
    figs.forEach(function (f) { if (!f.closest('dialog')) fio.observe(f); });
  }

  /* ---------- 5 · engineering callout pins ---------- */
  function initPins() {
    var box = $('[data-pins]');
    if (!box) return;
    var pins = $$('.pin', box), items = $$('[data-pin-item]', box), btns = $$('.pinlist__btn', box);
    var hover = window.matchMedia ? window.matchMedia('(hover: hover)') : { matches: false };
    function set(n) {
      pins.forEach(function (p) {
        var on = p.getAttribute('data-pin') === n;
        p.classList.toggle('is-on', on);
        p.setAttribute('aria-expanded', on ? 'true' : 'false');
      });
      btns.forEach(function (b) { b.setAttribute('aria-expanded', b.getAttribute('data-pin') === n ? 'true' : 'false'); });
      items.forEach(function (it) { it.classList.toggle('is-on', it.getAttribute('data-pin-item') === n); });
    }
    pins.concat(btns).forEach(function (b) {
      b.addEventListener('click', function () {
        set(b.getAttribute('data-pin'));
        if (b.classList.contains('pin')) say($('#pin-d' + b.getAttribute('data-pin')).textContent);
      });
      b.addEventListener('mouseenter', function () { if (hover.matches) set(b.getAttribute('data-pin')); });
    });
    set('1');
  }

  /* ---------- 6 · parts filter + detail panel ---------- */
  function initParts() {
    var pf = $('[data-pf]'), atlas = $('[data-atlas]');
    if (!pf || !atlas) return;
    var cards = $$('.part', atlas);
    var count = $('[data-pf-count]'), empty = $('[data-pf-empty]');
    var st = { ind: '', route: '' };

    function match(c, ind, route) {
      var inds = ' ' + c.getAttribute('data-ind') + ' ';
      return (!ind || inds.indexOf(' ' + ind + ' ') > -1) && (!route || c.getAttribute('data-route') === route);
    }
    function countFor(ind, route) { return cards.filter(function (c) { return match(c, ind, route); }).length; }
    function syncChips() {
      // disable chips that have no part in common with the other filter (prevents empty results)
      $$('.chip', pf).forEach(function (b) {
        var isInd = b.hasAttribute('data-pf-ind');
        var v = b.getAttribute(isInd ? 'data-pf-ind' : 'data-pf-route');
        var zero = !!v && (isInd ? countFor(v, st.route) : countFor(st.ind, v)) === 0;
        b.disabled = zero;
        if (zero) b.title = 'No example parts match the selected ' + (isInd ? 'route' : 'industry'); else b.removeAttribute('title');
      });
      $$('[data-pf-ind]', pf).forEach(function (x) { x.setAttribute('aria-pressed', x.getAttribute('data-pf-ind') === st.ind ? 'true' : 'false'); });
      $$('[data-pf-route]', pf).forEach(function (x) { x.setAttribute('aria-pressed', x.getAttribute('data-pf-route') === st.route ? 'true' : 'false'); });
    }
    function apply() {
      var n = 0;
      cards.forEach(function (c) {
        var ok = match(c, st.ind, st.route);
        c.hidden = !ok;
        if (ok) {
          n++;
          c.classList.add('is-in');
          var f = $('.fig', c); if (f) drawFig(f);
        }
      });
      count.textContent = n;
      empty.hidden = n > 0;
      syncChips();
    }
    pf.addEventListener('click', function (e) {
      var b = e.target.closest('.chip');
      if (!b || b.disabled) return;
      var isInd = b.hasAttribute('data-pf-ind');
      var key = isInd ? 'ind' : 'route';
      st[key] = b.getAttribute(isInd ? 'data-pf-ind' : 'data-pf-route');
      // if the other filter has nothing in common with the new choice, reset it to 'All'
      if (!countFor(st.ind, st.route)) st[isInd ? 'route' : 'ind'] = '';
      apply();
    });
    syncChips();

    /* detail panel */
    var dlg = $('[data-pd]');
    if (!dlg) return;
    var figHost = $('[data-pd-fig]', dlg), cur = null, lastFocus = null;
    function fill(card) {
      cur = card;
      var no = $('.part__no', card).textContent;
      var rt = $('.part__rt', card);
      $('[data-pd-no]', dlg).textContent = no;
      var rtOut = $('[data-pd-route]', dlg);
      rtOut.className = rt.className;
      rtOut.textContent = rt.textContent;
      $('[data-pd-title]', dlg).textContent = $('.part__h', card).textContent;
      $('[data-pd-desc]', dlg).textContent = $('.part__desc', card).textContent;
      $('[data-pd-passport]', dlg).innerHTML = $('.passport', card).innerHTML;
      var html = $('.fig', card).outerHTML.replace(/(["#])a(\d\d)-/g, '$1d$2-');
      figHost.innerHTML = html;
      var svg = $('.fig', figHost);
      svg.classList.remove('is-drawn');
      prepFig(svg);
      if (reduced()) svg.classList.add('is-drawn');
      else requestAnimationFrame(function () { requestAnimationFrame(function () { svg.classList.add('is-drawn'); }); });
    }
    function visible() { return cards.filter(function (c) { return !c.hidden; }); }
    function open(card) {
      lastFocus = doc.activeElement;
      fill(card);
      if (typeof dlg.showModal === 'function') { if (!dlg.open) dlg.showModal(); }
      else dlg.setAttribute('open', '');
      var cl = $('[data-pd-close]', dlg); if (cl) cl.focus();
    }
    function close() {
      if (typeof dlg.close === 'function' && dlg.open) dlg.close(); else dlg.removeAttribute('open');
    }
    dlg.addEventListener('close', function () { if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true }); });
    function step(d) {
      var v = visible(), i = v.indexOf(cur);
      if (!v.length) return;
      fill(v[(i + d + v.length) % v.length]);
      say($('[data-pd-title]', dlg).textContent);
    }
    atlas.addEventListener('click', function (e) {
      var b = e.target.closest('[data-part-open], .part__fig');
      if (!b) return;
      open(b.closest('.part'));
    });
    $('[data-pd-close]', dlg).addEventListener('click', close);
    $('[data-pd-prev]', dlg).addEventListener('click', function () { step(-1); });
    $('[data-pd-next]', dlg).addEventListener('click', function () { step(1); });
    dlg.addEventListener('click', function (e) { if (e.target === dlg) close(); });
    dlg.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight' && !e.target.closest('input,textarea')) step(1);
      if (e.key === 'ArrowLeft' && !e.target.closest('input,textarea')) step(-1);
    });
    $('[data-pd-cta]', dlg).addEventListener('click', function () {
      if (!cur) return;
      var mat = $('.passport dd', cur);
      var clean = function (el) { return el ? el.textContent.replace(/\u2060/g, '').replace(/\u00a0/g, ' ') : ''; }; // strip the no-break characters added by the build (U+2060, NBSP)
      KMTG.prefillContact({ source: 'parts', part: clean($('.part__h', cur)), materialSpec: clean(mat) });
      close();
    });
  }

  /* ---------- 7 · material cross-reference tabs ---------- */
  function initTabs() {
    $$('[data-tabs]').forEach(function (t) {
      var tabs = $$('[role="tab"]', t);
      var panels = tabs.map(function (b) { return doc.getElementById(b.getAttribute('aria-controls')); });
      function sel(i, focus) {
        tabs.forEach(function (b, j) {
          var on = i === j;
          b.setAttribute('aria-selected', on ? 'true' : 'false');
          b.tabIndex = on ? 0 : -1;
          panels[j].hidden = !on;
        });
        if (KMTG.checkTables) KMTG.checkTables();
        if (focus) tabs[i].focus();
      }
      tabs.forEach(function (b, i) {
        b.addEventListener('click', function () { sel(i); });
        b.addEventListener('keydown', function (e) {
          var n = tabs.length;
          if (e.key === 'ArrowRight') { e.preventDefault(); sel((i + 1) % n, true); }
          else if (e.key === 'ArrowLeft') { e.preventDefault(); sel((i - 1 + n) % n, true); }
          else if (e.key === 'Home') { e.preventDefault(); sel(0, true); }
          else if (e.key === 'End') { e.preventDefault(); sel(n - 1, true); }
        });
      });
      sel(0);
    });
  }

  /* ---------- 8 · process tracker ---------- */
  function initProc() {
    var steps = $$('.proc__s');
    if (!steps.length || !hasIO()) return;
    var io = new IntersectionObserver(function (ents) {
      ents.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('is-on'); io.unobserve(en.target); }
      });
    }, { rootMargin: '0px 0px -42% 0px', threshold: 0 });
    steps.forEach(function (s) { io.observe(s); });
  }

  /* ---------- 9 · FAQ: open the item when the URL has #faq-N ---------- */
  function initFaq() {
    function openHash() {
      var h = location.hash;
      if (!/^#faq-\d+$/.test(h)) return;
      var d = doc.getElementById(h.slice(1));
      if (d && d.tagName === 'DETAILS') d.open = true;
    }
    window.addEventListener('hashchange', openHash);
    openHash();
  }

  /* ---------- 10 · inquiry email builder ---------- */
  var cf = null;
  function initContact() {
    var form = $('[data-cf]');
    if (!form) return;
    cf = { form: form, extra: '' };
    var err = $('[data-cf-err]', form);
    var REQ = ['company', 'name', 'country', 'part'];

    function v(name) {
      var el = form.elements[name];
      return el ? String(el.value || '').trim() : '';
    }
    function compose() {
      var d = function (x) { return x || '-'; };
      var mat = [fe(v('material')), v('spec')].filter(Boolean).join(' · ');
      var docs = $$('input[name="docs"]:checked', form).map(function (i) { return fe(i.value); }).join(', ');
      var nda = v('nda');
      var L = [
        'Hello KMT Global Sales,',
        'Please review our drawing on the basis of the details below.',
        '',
        '■ Company: ' + d(v('company')),
        '■ Name: ' + d(v('name')),
        '■ Country: ' + d(v('country')),
        '■ Part: ' + d(v('part')),
        '■ Material (spec): ' + d(mat),
        '■ Piece weight (approx.): ' + d(v('weight')),
        '■ Annual volume: ' + d(v('qty')),
        '■ Machining: ' + d(fe(v('machining'))),
        '■ Documents required: ' + d(docs),
        '■ NDA first: ' + d(fe(nda)),
        '■ Additional requirements: ' + d(v('memo')),
        '',
        fe(nda) === NDA_YES ? 'We will send the drawings once the NDA is signed.' : 'Drawing files: attached to this email (2D PDF, plus 3D STEP if available).'
      ];
      if (cf.extra) L.push(cf.extra);
      L.push('', 'Best regards,', v('name'));
      return {
        subject: '[Drawing review request] ' + d(v('company')) + ' · ' + d(v('part')),
        body: L.join('\r\n')
      };
    }
    function validate() {
      var miss = REQ.filter(function (n) { return !v(n); });
      REQ.forEach(function (n) {
        var el = form.elements[n];
        if (miss.indexOf(n) > -1) { el.setAttribute('aria-invalid', 'true'); el.setAttribute('aria-describedby', 'cf-err'); }
        else { el.removeAttribute('aria-invalid'); el.removeAttribute('aria-describedby'); }
      });
      if (miss.length) {
        err.textContent = 'Please fill in company, name, country and part.';
        form.elements[miss[0]].focus();
        return false;
      }
      err.textContent = '';
      return true;
    }
    function webUrl(kind) {
      var m = compose();
      if (kind === 'gmail') return 'https://mail.google.com/mail/?view=cm&fs=1&to=' + enc(MAIL) + '&su=' + enc(m.subject) + '&body=' + enc(m.body);
      return 'https://outlook.office.com/mail/deeplink/compose?to=' + enc(MAIL) + '&subject=' + enc(m.subject) + '&body=' + enc(m.body);
    }
    var webLinks = $$('[data-cf-web]', form);
    function syncWeb() { webLinks.forEach(function (a) { a.setAttribute('href', webUrl(a.getAttribute('data-cf-web'))); }); }
    form.addEventListener('input', function (e) {
      if (e.target.getAttribute('aria-invalid') === 'true' && String(e.target.value).trim()) { e.target.removeAttribute('aria-invalid'); e.target.removeAttribute('aria-describedby'); }
      syncWeb();
    });
    form.addEventListener('change', syncWeb);
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!validate()) return;
      var m = compose();
      window.location.href = 'mailto:' + MAIL + '?subject=' + enc(m.subject) + '&body=' + enc(m.body);
      say('Your email app is open. Please attach your drawing files.');
    });
    webLinks.forEach(function (a) {
      a.addEventListener('click', function (e) {
        if (!validate()) { e.preventDefault(); return; }
        a.setAttribute('href', webUrl(a.getAttribute('data-cf-web')));
      });
    });
    syncWeb();
    cf.sync = syncWeb;
  }

  function setRadio(form, name, value) {
    var cands = [value, fe(value)], r = null; // English value, or the Korean master-page value that maps to it
    for (var k in FORM_EN) if (FORM_EN[k] === value) cands.push(k);
    for (var i = 0; i < cands.length && !r; i++) r = form.querySelector('input[name="' + name + '"][value="' + cands[i] + '"]');
    if (r) r.checked = true;
  }

  /* prefill the inquiry form from other widgets (route finder · part details) */
  KMTG.prefillContact = function (o) {
    if (!cf) return;
    o = o || {};
    var f = cf.form, notice = $('[data-cf-pre]', f);
    var MATR = { FC: 'Gray iron (GC/FC)', FCD: 'Ductile iron (GCD/FCD)', U: 'Other / undecided' }; // radio values
    var MCR = { Y: 'Required', N: 'Not required', U: 'Undecided' }; // radio values
    var msg = '';
    if (o.source === 'route-finder') {
      if (o.materialKey) setRadio(f, 'material', MATR[o.materialKey]);
      if (o.weight) f.elements.weight.value = o.weight;
      if (o.qty) f.elements.qty.value = o.qty + ' per year';
      if (o.machiningKey) setRadio(f, 'machining', MCR[o.machiningKey]);
      var memo = [];
      if (o.iatf) memo.push('IATF 16949-certified site: ' + o.iatf);
      if (o.ready && o.ready.length) memo.push('Information ready: ' + o.ready.join('; '));
      if (memo.length && !f.elements.memo.value.trim()) f.elements.memo.value = memo.join('\n');
      cf.extra = o.title ? '(Route finder — preliminary guidance: ' + o.title + ')' : '';
      msg = 'We’ve filled in the conditions from the route finder. Please add company, name, country and part.';
    } else if (o.source === 'parts') {
      if (o.part) f.elements.part.value = o.part;
      if (o.materialSpec) {
        f.elements.spec.value = o.materialSpec;
        var m = o.materialSpec;
        if (m.indexOf('/') < 0) {
          if (/^GCD|ductile iron/i.test(m)) setRadio(f, 'material', MATR.FCD);
          else if (/^GC/.test(m)) setRadio(f, 'material', MATR.FC);
        }
      }
      msg = 'We’ve filled in “' + (o.part || '') + '”. Please complete the remaining fields.';
    }
    if (notice && msg) { notice.textContent = msg; notice.hidden = false; }
    if (cf.sync) cf.sync();
    var first = ['company', 'name', 'country', 'part'].map(function (n) { return f.elements[n]; }).filter(function (el) { return !el.value.trim(); })[0];
    if (first) setTimeout(function () { try { first.focus({ preventScroll: true }); } catch (e) { first.focus(); } }, reduced() ? 0 : 700);
  };

  /* ---------- 11 · copy address ---------- */
  function copyText(t) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(t);
    return new Promise(function (res, rej) {
      var ta = doc.createElement('textarea');
      ta.value = t; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
      doc.body.appendChild(ta); ta.select();
      try { doc.execCommand('copy') ? res() : rej(new Error('copy')); } catch (e) { rej(e); }
      doc.body.removeChild(ta);
    });
  }
  function initCopy() {
    $$('button[data-copy]').forEach(function (b) {
      var label = b.textContent;
      b.addEventListener('click', function () {
        var t = b.getAttribute('data-copy');
        var en = b.getAttribute('data-copy-en');
        if (en) t = en + '\nKorean: ' + t; // EN page: English address first, Korean original second (for local couriers)
        copyText(t).then(function () {
          b.textContent = 'Copied';
          b.classList.add('is-done');
          say('Copied');
          clearTimeout(b._t);
          b._t = setTimeout(function () { b.textContent = label; b.classList.remove('is-done'); }, 2000);
        }, function () { say('Couldn’t copy. Please select the text and copy it manually.'); });
      });
    });
  }

  /* ---------- 13 · horizontally scrolling tables: hint text + right-edge fade only when they really overflow ---------- */
  function initTables() {
    var wraps = $$('.tbl-wrap--wide');
    function check(w) {
      var over = w.scrollWidth > w.clientWidth + 1;
      w.classList.toggle('is-over', over);
      w.classList.toggle('is-end', !over || w.scrollLeft + w.clientWidth >= w.scrollWidth - 2);
      var h = w.previousElementSibling;
      if (h && h.classList.contains('tbl-hint')) h.classList.toggle('is-on', over);
    }
    wraps.forEach(function (w) {
      w.addEventListener('scroll', function () { check(w); }, { passive: true });
      if (window.ResizeObserver) new ResizeObserver(function () { check(w); }).observe(w);
      else window.addEventListener('resize', function () { check(w); });
      check(w);
    });
    KMTG.checkTables = function () { wraps.forEach(check); };
  }

  /* ---------- 14 · fold-outs: closed at first only on mobile/tablet (959px and below); opened when reached by a link ---------- */
  function initFolds() {
    var folds = $$('details[data-fold]');
    if (!folds.length || !window.matchMedia) return;
    var mq = window.matchMedia('(min-width: 960px)');
    if (!mq.matches) folds.forEach(function (d) { d.open = false; });
    var onMq = function () { if (mq.matches) folds.forEach(function (d) { d.open = true; }); };
    if (mq.addEventListener) mq.addEventListener('change', onMq); else if (mq.addListener) mq.addListener(onMq);
    function openFor(id) {
      var t = id && doc.getElementById(id);
      if (!t) return;
      var d = t.closest('details[data-fold]') || t.querySelector('details[data-fold]');
      if (d && !d.open) d.open = true;
    }
    doc.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('a[href^="#"]');
      if (a) openFor(a.getAttribute('href').slice(1));
    });
    window.addEventListener('hashchange', function () { openFor(location.hash.slice(1)); });
    if (location.hash) openFor(location.hash.slice(1));
  }

  /* ---------- 15 · fix for deferred rendering of off-screen sheets (content-visibility) ----------
     css: main > section:not(#hero), .ft { content-visibility:auto } — reduces layout cost on first load.
     Placeholder sizes are estimates, so anchor jumps can land in the wrong place: on the first in-page link
     click, or when the URL arrives with a #hash, render every sheet at its real size first, then jump. */
  function initCV() {
    var secs = $$('main > section, .ft'), done = false;
    function reveal() {
      if (done) return;
      done = true;
      secs.forEach(function (s) { s.style.contentVisibility = 'visible'; });
    }
    KMTG.revealAll = reveal;
    doc.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('a[href^="#"]');
      if (a && a.getAttribute('href').length > 1) reveal();
    }, true);
    window.addEventListener('hashchange', reveal);
    // When focus moves to an off-screen element (keyboard Tab, programmatic focus), render every sheet at real size.
    // The browser has already picked its scroll target from the estimated sizes (a smooth scroll stops in the wrong
    // place), so if the element is still off-screen on the next frame, scroll to it once more. After that, nothing to do.
    doc.addEventListener('focusin', function (e) {
      var t = e.target;
      if (done || !t || !t.getBoundingClientRect) return;
      var r = t.getBoundingClientRect();
      if (r.bottom >= 0 && r.top <= window.innerHeight) return;
      reveal();
      requestAnimationFrame(function () {
        var r2 = t.getBoundingClientRect();
        // scroll again if it sits under the header (about 72px) or the mobile bottom bar (about 80px)
        if (doc.activeElement === t && (r2.top < 72 || r2.bottom > window.innerHeight - 80)) t.scrollIntoView({ block: 'center' });
      });
    }, true);
    if (location.hash.length > 1) {
      var t = doc.getElementById(location.hash.slice(1));
      if (t) {
        reveal();
        requestAnimationFrame(function () { t.scrollIntoView(); });
      }
    }
  }

  /* ---------- init ---------- */
  function init() {
    doc.body.appendChild(live);
    var ok = true;
    [initCV, initClock, initHeader, initMenu, initMbar, initReveal, initPins, initParts, initTables, initFolds,
      initTabs, initProc, initFaq, initContact, initCopy].forEach(function (fn) {
      try { fn(); } catch (e) { ok = false; if (window.console) console.error(e); }
    });
    KMTG.ready = ok;
  }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init);
  else init();
})();
