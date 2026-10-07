/*!
 * KMT Global · site.js — 공통 동작 (의존성 없음 · file:// 동작)
 *  1 고령 현지 시각(KST) · 2 헤더(스티키·진행 표시·현재 시트) + 데스크톱 시트 표시
 *  3 모바일 메뉴 + 하단 CTA 바 · 4 진입 reveal + FIG 라인 드로우 · 5 기술 콜아웃 핀
 *  6 품목 필터 + 상세 패널 · 7 재질 대응표 탭 · 8 진행 절차 트래커 · 9 FAQ 링크
 *  10 문의 메일 생성기(mailto · Gmail · Outlook) + KMTG.prefillContact · 11 주소 복사 · 12 제조사 메일
 *  13 가로 스크롤 표(넘칠 때만 안내·페이드) · 14 모바일 접이식 블록 · 15 content-visibility 앵커 보정
 * 끝까지 실행되면 KMTG.ready = true — index.html의 안전장치가 이 값을 보고 js 클래스를 유지한다.
 * JS가 꺼져 있어도 모든 내용은 보인다(초기 숨김은 html.js 일 때만, css/site.css).
 */
(function () {
  'use strict';

  var KMTG = window.KMTG = window.KMTG || {};
  var doc = document;
  var MAIL = 'kevin.chang@koreametaltec.com';
  var mqRM = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  function reduced() { return mqRM.matches; }
  function $(s, c) { return (c || doc).querySelector(s); }
  function $$(s, c) { return Array.prototype.slice.call((c || doc).querySelectorAll(s)); }
  function enc(t) { return encodeURIComponent(t); }
  function hasIO() { return 'IntersectionObserver' in window; }

  /* 스크린리더 알림 */
  var live = doc.createElement('p');
  live.className = 'sr';
  live.setAttribute('aria-live', 'polite');
  function say(t) { live.textContent = ''; setTimeout(function () { live.textContent = t; }, 60); }

  /* ---------- 1 · 고령 현지 시각 ---------- */
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
      var open = o.weekday !== 'Sat' && o.weekday !== 'Sun' && mins >= 480 && mins < 1080; // 평일 08:00~18:00
      var st = open ? '업무 중' : '업무 시간 외';
      tEl.textContent = hh + ':' + mm;
      if (srEl) srEl.textContent = '고령 현지 시각 ' + (+hh) + '시 ' + (+mm) + '분(한국 표준시). 업무 시간은 평일 08:00부터 18:00까지입니다';
      if (inl) inl.textContent = '지금 고령 ' + hh + ':' + mm + ' · ' + st;
    }
    tick();
    setTimeout(function () { tick(); setInterval(tick, 60000); }, (60 - new Date().getSeconds()) * 1000 + 200);
  }

  /* ---------- 2 · 헤더 · 진행 표시 · 현재 시트 ---------- */
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
        snNext.textContent = '다음 ';
        snNext.setAttribute('aria-label', '다음 시트: ' + nx.getAttribute('data-sheet-name'));
        snNext.setAttribute('title', '다음: ' + nx.getAttribute('data-sheet-name'));
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
    // 키보드 포커스·Ctrl+F·scrollIntoView처럼 크게 이동하면, 이동 직후 화면 밖 시트(content-visibility)가
    // 실제 크기로 바뀌는데 scroll 이벤트는 다시 오지 않는다 → 시트 크기 변화·스크롤 종료·포커스 이동 때 다시 계산
    if ('ResizeObserver' in window) {
      var ro = new ResizeObserver(onScroll);
      sheets.forEach(function (s) { ro.observe(s); });
    }
    window.addEventListener('scrollend', onScroll, { passive: true });
    doc.addEventListener('focusin', onScroll);
    if (sn) sn.hidden = false;
    onScroll();
  }

  /* ---------- 3 · 모바일 메뉴 + 하단 CTA 바 ---------- */
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
      if (label) label.textContent = open ? '메뉴 닫기' : '메뉴 열기';
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

    var main = $('.mbar__main', bar), makers = doc.getElementById('makers'), mk = $('[data-maker-mail]');
    if (!main || !makers || !mk) return;
    var orig = { html: main.innerHTML, href: main.getAttribute('href') }, onMk = false;
    new IntersectionObserver(function (ents) {
      var on = ents[ents.length - 1].isIntersecting;
      if (on === onMk) return;
      onMk = on;
      main.innerHTML = on ? '협력 제조사 등록 문의 <span aria-hidden="true">→</span>' : orig.html;
      main.setAttribute('href', on ? mk.getAttribute('href') : orig.href);
    }, { rootMargin: '0px 0px -35% 0px', threshold: 0 }).observe(makers);
  }

  /* ---------- 4 · 진입 reveal + FIG 라인 드로우 ---------- */
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

  /* ---------- 5 · 기술 콜아웃 핀 ---------- */
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

  /* ---------- 6 · 품목 필터 + 상세 패널 ---------- */
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
      // 다른 축의 선택과 겹치는 품목이 없는 칩은 비활성화한다(빈 결과를 미리 막음)
      $$('.chip', pf).forEach(function (b) {
        var isInd = b.hasAttribute('data-pf-ind');
        var v = b.getAttribute(isInd ? 'data-pf-ind' : 'data-pf-route');
        var zero = !!v && (isInd ? countFor(v, st.route) : countFor(st.ind, v)) === 0;
        b.disabled = zero;
        if (zero) b.title = '선택한 ' + (isInd ? '생산 경로' : '산업') + '와 겹치는 예시 품목이 없습니다'; else b.removeAttribute('title');
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
      // 고른 조건과 다른 축이 겹치지 않으면 다른 축을 '전체'로 되돌린다
      if (!countFor(st.ind, st.route)) st[isInd ? 'route' : 'ind'] = '';
      apply();
    });
    syncChips();

    /* 상세 패널 */
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
      var clean = function (el) { return el ? el.textContent.replace(/\u2060/g, '').replace(/\u00a0/g, ' ') : ''; }; // 빌드가 넣은 줄바꿈 방지 문자(U+2060·NBSP) 정리
      KMTG.prefillContact({ source: 'parts', part: clean($('.part__h', cur)), materialSpec: clean(mat) });
      close();
    });
  }

  /* ---------- 7 · 재질 대응표 탭 ---------- */
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

  /* ---------- 8 · 진행 절차 트래커 ---------- */
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

  /* ---------- 9 · FAQ: 주소(#faq-N)로 들어오면 펼침 ---------- */
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

  /* ---------- 10 · 문의 메일 생성기 ---------- */
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
      var mat = [v('material'), v('spec')].filter(Boolean).join(' · ');
      var docs = $$('input[name="docs"]:checked', form).map(function (i) { return i.value; }).join(', ');
      var nda = v('nda');
      var L = [
        '안녕하세요, KMT Global 해외영업 담당자님.',
        '아래 조건으로 도면 검토를 요청드립니다.',
        '',
        '■ 회사: ' + d(v('company')),
        '■ 이름: ' + d(v('name')),
        '■ 국가: ' + d(v('country')),
        '■ 품목: ' + d(v('part')),
        '■ 재질(규격): ' + d(mat),
        '■ 단중(대략): ' + d(v('weight')),
        '■ 연간 수량: ' + d(v('qty')),
        '■ 가공: ' + d(v('machining')),
        '■ 필요 문서: ' + d(docs),
        '■ NDA 선행: ' + d(nda),
        '■ 추가 요구사항: ' + d(v('memo')),
        '',
        nda === '예' ? '도면은 NDA 체결 후 보내 드리겠습니다.' : '도면 파일: 이 메일에 첨부합니다(2D PDF, 가능하면 3D STEP).'
      ];
      if (cf.extra) L.push(cf.extra);
      L.push('', '감사합니다.', (v('name') ? v('name') + ' 드림' : ''));
      return {
        subject: '[도면 검토 요청] ' + d(v('company')) + ' · ' + d(v('part')),
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
        err.textContent = '회사명, 이름, 국가, 품목을 입력해 주세요.';
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
      say('메일 앱을 열었습니다. 도면 파일을 첨부해 주세요.');
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
    var r = form.querySelector('input[name="' + name + '"][value="' + value + '"]');
    if (r) r.checked = true;
  }

  /* 다른 위젯(경로 찾기 · 품목 상세)에서 문의 양식을 미리 채운다 */
  KMTG.prefillContact = function (o) {
    if (!cf) return;
    o = o || {};
    var f = cf.form, notice = $('[data-cf-pre]', f);
    var MATR = { FC: '회주철(GC/FC)', FCD: '구상흑연주철(GCD/FCD)', U: '기타·미정' };
    var MCR = { Y: '필요', N: '필요 없음', U: '미정' };
    var msg = '';
    if (o.source === 'route-finder') {
      if (o.materialKey) setRadio(f, 'material', MATR[o.materialKey]);
      if (o.weight) f.elements.weight.value = o.weight;
      if (o.qty) f.elements.qty.value = '연 ' + o.qty;
      if (o.machiningKey) setRadio(f, 'machining', MCR[o.machiningKey]);
      var memo = [];
      if (o.iatf) memo.push('IATF 16949 인증 생산처: ' + o.iatf);
      if (o.ready && o.ready.length) memo.push('준비된 자료: ' + o.ready.join(', '));
      if (memo.length && !f.elements.memo.value.trim()) f.elements.memo.value = memo.join('\n');
      cf.extra = o.title ? '(생산 경로 찾기 예비 안내: ' + o.title + ')' : '';
      msg = '생산 경로 찾기에서 고른 조건을 채웠습니다. 회사명·이름·국가·품목을 입력해 주세요.';
    } else if (o.source === 'parts') {
      if (o.part) f.elements.part.value = o.part;
      if (o.materialSpec) {
        f.elements.spec.value = o.materialSpec;
        var m = o.materialSpec;
        if (m.indexOf('/') < 0) {
          if (/^GCD|구상흑연/.test(m)) setRadio(f, 'material', MATR.FCD);
          else if (/^GC/.test(m)) setRadio(f, 'material', MATR.FC);
        }
      }
      msg = '“' + (o.part || '') + '” 품목을 채웠습니다. 나머지 항목을 입력해 주세요.';
    }
    if (notice && msg) { notice.textContent = msg; notice.hidden = false; }
    if (cf.sync) cf.sync();
    var first = ['company', 'name', 'country', 'part'].map(function (n) { return f.elements[n]; }).filter(function (el) { return !el.value.trim(); })[0];
    if (first) setTimeout(function () { try { first.focus({ preventScroll: true }); } catch (e) { first.focus(); } }, reduced() ? 0 : 700);
  };

  /* ---------- 11 · 주소 복사 ---------- */
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
        if (en) t += '\n' + en;
        copyText(t).then(function () {
          b.textContent = '복사했습니다';
          b.classList.add('is-done');
          say('복사했습니다');
          clearTimeout(b._t);
          b._t = setTimeout(function () { b.textContent = label; b.classList.remove('is-done'); }, 2000);
        }, function () { say('복사하지 못했습니다. 직접 선택해 복사해 주세요.'); });
      });
    });
  }

  /* ---------- 12 · 협력 제조사 등록 문의 메일 ---------- */
  function initMakerMail() {
    var a = $('[data-maker-mail]');
    if (!a) return;
    var body = [
      '안녕하세요, KMT Global 해외영업 담당자님.',
      '협력 제조사 등록을 문의드립니다.',
      '',
      '■ 회사명:',
      '■ 담당자 / 연락처:',
      '■ 주요 품목:',
      '■ 재질:',
      '■ 주요 설비:',
      '■ 보유 인증:',
      '■ 회사 소재지:',
      '',
      '감사합니다.'
    ].join('\r\n');
    a.setAttribute('href', 'mailto:' + MAIL + '?subject=' + enc('[협력 제조사 등록 문의] (회사명)') + '&body=' + enc(body));
  }

  /* ---------- 13 · 가로 스크롤 표: 실제로 넘칠 때만 안내 문구 + 오른쪽 페이드 ---------- */
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

  /* ---------- 14 · 접이식 블록: 모바일·태블릿(959px 이하)에서만 처음에 닫는다. 링크로 들어오면 연다 ---------- */
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

  /* ---------- 15 · 화면 밖 시트 렌더링 지연(content-visibility) 보정 ----------
     css: main > section:not(#hero), .ft { content-visibility:auto } — 첫 로드 레이아웃 비용을 줄인다.
     단, 자리 크기가 추정치라 앵커 이동 위치가 어긋날 수 있으므로, 페이지 안 링크를 처음 누르거나
     주소에 #이 붙어 들어오면 모든 시트를 실제 크기로 그린 뒤 이동한다. */
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
    // 화면 밖 요소로 포커스가 옮겨 가면(키보드 Tab, 프로그램 focus) 모든 시트를 실제 크기로 그린다.
    // 브라우저는 추정 크기로 이미 스크롤 목표를 잡았으므로(부드러운 스크롤이면 엉뚱한 곳에 멈춤),
    // 다음 프레임에 요소가 아직 화면 밖이면 한 번 더 그 요소로 이동한다. 한 번 그린 뒤에는 다시 할 일이 없다.
    doc.addEventListener('focusin', function (e) {
      var t = e.target;
      if (done || !t || !t.getBoundingClientRect) return;
      var r = t.getBoundingClientRect();
      if (r.bottom >= 0 && r.top <= window.innerHeight) return;
      reveal();
      requestAnimationFrame(function () {
        var r2 = t.getBoundingClientRect();
        // 헤더(약 72px)·모바일 하단 바(약 80px)에 가리지 않는 범위 밖이면 다시 이동
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
      initTabs, initProc, initFaq, initContact, initCopy, initMakerMail].forEach(function (fn) {
      try { fn(); } catch (e) { ok = false; if (window.console) console.error(e); }
    });
    KMTG.ready = ok;
  }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init);
  else init();
})();
