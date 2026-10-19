/*!
 * KMT Global · micro.js — 흑연 미세조직 모식도 (Canvas 2D, 의존성 없음)
 *   회주철: 펄라이트 기지 + 편상흑연(얇고 휘어진 판, 일부 가지)
 *   구상흑연주철: 펄라이트 기지 + 구상흑연 + 둘레 페라이트(불스아이)
 * 사용: <canvas data-micro-type="gray|ductile"> 를 감싼 요소에 data-micro, 또는 KMTG.micro.init(selector)
 * 시드 고정(항상 같은 그림) · DPR ≤ 2 · 화면 진입 시 1.2 s 동안 한 번 자라남 · reduced-motion 이면 정지 화면
 * 색은 CSS 토큰(--ink, --paper-2)을 읽는다.
 */
(function () {
  'use strict';

  var KMTG = window.KMTG = window.KMTG || {};
  if (KMTG.micro) return;

  var DUR = 1200;
  var SEEDS = { gray: 0x5eed01, ductile: 0x5eed02 };
  var mq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  function reduced() { return !!(mq && mq.matches); }

  function rng(seed) { // mulberry32
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
  function ease(x) { x = clamp01(x); return 1 - Math.pow(1 - x, 3); }

  function rgb(str, fb) {
    str = (str || '').trim();
    var m = /^#?([0-9a-f]{6})$/i.exec(str);
    if (!m) { m = /^#?([0-9a-f]{3})$/i.exec(str); if (m) m[1] = m[1].replace(/(.)/g, '$1$1'); }
    if (!m) return fb;
    var n = parseInt(m[1], 16);
    return [n >> 16 & 255, n >> 8 & 255, n & 255];
  }
  function mix(a, b, t) { return [Math.round(lerp(a[0], b[0], t)), Math.round(lerp(a[1], b[1], t)), Math.round(lerp(a[2], b[2], t))]; }
  function css(c, a) { return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + (a == null ? 1 : a) + ')'; }

  /* ---------- 조직 생성 (단위 원: 반지름 1) ---------- */
  function inDisc(R, rmax) {
    var a = R() * Math.PI * 2, r = Math.sqrt(R()) * rmax;
    return [Math.cos(a) * r, Math.sin(a) * r];
  }

  function colonies(R, n) { // 펄라이트 콜로니(미세한 층상 결)
    var out = [];
    for (var i = 0; i < n; i++) {
      var c = inDisc(R, 1.05);
      out.push({ x: c[0], y: c[1], r: lerp(0.07, 0.16, R()), a: R() * Math.PI, s: lerp(0.0105, 0.0145, R()) });
    }
    return out;
  }

  function flake(R, cx, cy, len, ang, thick) {
    return {
      x: cx, y: cy, len: len, ang: ang, thick: thick,
      bend: (R() - 0.5) * 1.1, wob: lerp(0.01, 0.03, R()), wf: lerp(4, 9, R()), wp: R() * 6.28
    };
  }
  function genGray(R) {
    var fl = [], n = 165;
    for (var i = 0; i < n; i++) {
      var c = inDisc(R, 1.06);
      var len = lerp(0.055, 0.3, Math.pow(R(), 1.25));
      var f = flake(R, c[0], c[1], len, R() * Math.PI, lerp(0.0055, 0.0115, R()) * Math.pow(len / 0.3, 0.35));
      f.al = lerp(0.72, 0.9, R());
      f.d = Math.min(0.45, Math.hypot(c[0], c[1]) * 0.32 + R() * 0.13);
      f.br = [];
      var nb = R() < 0.3 ? 1 : 0;
      for (var b = 0; b < nb; b++) {
        var t0 = lerp(-0.3, 0.3, R());
        var sgn = R() < 0.5 ? -1 : 1;
        var p = flakePoint(f, t0);
        var bl = len * lerp(0.25, 0.5, R());
        var ba = f.ang + sgn * lerp(0.25, 0.6, R());
        // 가지는 본줄기 한 점에서 한쪽으로 뻗는다
        var g = flake(R, p[0] + Math.cos(ba) * bl / 2, p[1] + Math.sin(ba) * bl / 2, bl, ba, f.thick * lerp(0.6, 0.85, R()));
        g.al = f.al;
        g.d = Math.min(0.55, f.d + 0.08);
        f.br.push(g);
      }
      fl.push(f);
    }
    return { col: colonies(R, 70), flakes: fl };
  }
  function flakePoint(f, t) { // t ∈ [-0.5, 0.5]
    var dx = Math.cos(f.ang), dy = Math.sin(f.ang), nx = -dy, ny = dx;
    var off = f.bend * f.len * (0.25 - t * t) + f.wob * f.len * Math.sin(t * f.wf + f.wp);
    return [f.x + dx * f.len * t + nx * off, f.y + dy * f.len * t + ny * off];
  }

  function genDuctile(R) {
    var nod = [], tries = 0;
    while (nod.length < 96 && tries < 6000) {
      tries++;
      var r = lerp(0.016, 0.036, Math.pow(R(), 1.4));
      var c = inDisc(R, 1.04);
      var ok = true;
      for (var i = 0; i < nod.length; i++) {
        var o = nod[i];
        if (Math.hypot(o.x - c[0], o.y - c[1]) < (o.r + r) * 2.45) { ok = false; break; }
      }
      if (ok) nod.push(mkNod(R, c[0], c[1], r, lerp(1.75, 2.5, R())));
    }
    // 작은 2차 흑연
    tries = 0;
    var small = 0;
    while (small < 18 && tries < 3000) {
      tries++;
      var rs = lerp(0.007, 0.012, R());
      var cs = inDisc(R, 1.02), ok2 = true;
      for (var j = 0; j < nod.length; j++) {
        var q = nod[j];
        if (Math.hypot(q.x - cs[0], q.y - cs[1]) < q.r * 1.6 + rs * 3) { ok2 = false; break; }
      }
      if (ok2) { nod.push(mkNod(R, cs[0], cs[1], rs, lerp(1.6, 2.3, R()))); small++; }
    }
    for (var k = 0; k < nod.length; k++) nod[k].d = Math.min(0.45, Math.hypot(nod[k].x, nod[k].y) * 0.32 + R() * 0.13);
    return { col: colonies(R, 80), nod: nod };
  }
  function mkNod(R, x, y, r, halo) {
    var h = [], b = [];
    for (var i = 0; i < 5; i++) h.push([R() * 6.28, lerp(0.03, 0.1, R()) / (1 + i * 0.25)]);
    for (var j = 0; j < 3; j++) b.push([R() * 6.28, lerp(0.015, 0.045, R())]);
    return { x: x, y: y, r: r, hr: r * halo, hn: h, bn: b };
  }

  /* ---------- 그리기 ---------- */
  function Micro(canvas) {
    this.c = canvas;
    this.type = canvas.getAttribute('data-micro-type') === 'ductile' ? 'ductile' : 'gray';
    var R = rng(SEEDS[this.type]);
    this.data = this.type === 'ductile' ? genDuctile(R) : genGray(R);
    this.w = 0; this.played = false; this.t = 0;
    this.readColors();
    this.resize();
  }

  Micro.prototype.readColors = function () {
    var cs = getComputedStyle(this.c);
    this.ink = rgb(cs.getPropertyValue('--ink'), [15, 28, 46]);
    this.paper = rgb(cs.getPropertyValue('--paper-2'), [244, 246, 249]);
    this.line = rgb(cs.getPropertyValue('--line-2'), [184, 196, 211]);
    var white = [255, 255, 255];
    if (this.type === 'ductile') {
      this.matrix = mix(this.paper, this.ink, 0.22);          // 펄라이트(어두운 기지)
      this.ferrite = mix(this.paper, white, 0.35);             // 페라이트(밝은 띠)
    } else {
      this.matrix = mix(this.paper, this.ink, 0.1);
    }
  };

  Micro.prototype.resize = function () {
    var w = Math.round(this.c.clientWidth);
    if (!w || w === this.w) return false;
    this.w = w;
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.c.width = Math.round(w * this.dpr);
    this.c.height = Math.round(w * this.dpr);
    this.R = w / 2 - 1.5;            // 시야 원 반지름(css px)
    this.s = this.R * 0.985;         // 단위 → px
    this.bg = this.buildMatrix();
    return true;
  };

  Micro.prototype.buildMatrix = function () {
    var w = this.w, d = this.dpr;
    var off = document.createElement('canvas');
    off.width = Math.round(w * d); off.height = Math.round(w * d);
    var g = off.getContext('2d');
    g.setTransform(d, 0, 0, d, 0, 0);
    var cx = w / 2, cy = w / 2, s = this.s;
    g.save();
    g.beginPath(); g.arc(cx, cy, this.R, 0, Math.PI * 2); g.clip();
    g.fillStyle = css(this.matrix); g.fillRect(0, 0, w, w);
    // 펄라이트 층상 결
    var col = this.data.col, a = this.type === 'ductile' ? 0.085 : 0.05;
    var J = rng(SEEDS[this.type] ^ 0x9e3779b9); // 결 길이 흔들림(시드 고정)
    g.strokeStyle = css(this.ink, a);
    g.lineWidth = Math.max(0.55, s * 0.003);
    g.lineCap = 'round';
    for (var i = 0; i < col.length; i++) {
      var k = col[i], px = cx + k.x * s, py = cy + k.y * s, pr = k.r * s, sp = Math.max(1.5, k.s * s);
      g.save();
      g.translate(px, py); g.rotate(k.a);
      g.beginPath();
      for (var y = -pr; y <= pr; y += sp) {
        var half = Math.sqrt(Math.max(0, pr * pr - y * y));
        var l0 = -half * lerp(0.45, 1, J()), l1 = half * lerp(0.45, 1, J());
        g.moveTo(l0, y); g.lineTo(l1, y + sp * 0.3);
      }
      g.stroke();
      g.restore();
    }
    g.restore();
    return off;
  };

  Micro.prototype.draw = function (t) { // t: 0..1 (전체 진행)
    var ctx = this.c.getContext('2d'), w = this.w, d = this.dpr;
    if (!w) return;
    ctx.setTransform(d, 0, 0, d, 0, 0);
    ctx.clearRect(0, 0, w, w);
    var cx = w / 2, cy = w / 2, s = this.s, R = this.R;

    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.clip();
    ctx.globalAlpha = ease(t / 0.35);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(this.bg, 0, 0);
    ctx.setTransform(d, 0, 0, d, 0, 0);
    ctx.globalAlpha = 1;

    if (this.type === 'ductile') this.drawDuctile(ctx, t, cx, cy, s);
    else this.drawGray(ctx, t, cx, cy, s);

    // 시야 가장자리 비네팅
    var vg = ctx.createRadialGradient(cx, cy, R * 0.7, cx, cy, R);
    vg.addColorStop(0, css(this.ink, 0));
    vg.addColorStop(1, css(this.ink, 0.09));
    ctx.fillStyle = vg; ctx.fillRect(cx - R, cy - R, R * 2, R * 2);
    ctx.restore();

    // 시야 테두리 + 레티클 눈금
    ctx.strokeStyle = css(this.line);
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = css(this.ink, 0.45);
    ctx.beginPath();
    for (var q = 0; q < 4; q++) {
      var an = q * Math.PI / 2, ca = Math.cos(an), sa = Math.sin(an);
      ctx.moveTo(cx + ca * (R - 1), cy + sa * (R - 1));
      ctx.lineTo(cx + ca * (R - 8), cy + sa * (R - 8));
    }
    ctx.stroke();
  };

  Micro.prototype.drawGray = function (ctx, t, cx, cy, s) {
    var fl = this.data.flakes;
    for (var i = 0; i < fl.length; i++) {
      var f = fl[i];
      var p = ease((t - f.d) / 0.5);
      if (p <= 0) continue;
      ctx.fillStyle = css(this.ink, f.al);
      this.flake(ctx, f, p, cx, cy, s);
      for (var b = 0; b < f.br.length; b++) {
        var g = f.br[b], pb = ease((t - g.d) / 0.45);
        if (pb > 0) this.flake(ctx, g, pb, cx, cy, s);
      }
    }
  };
  Micro.prototype.flake = function (ctx, f, p, cx, cy, s) {
    var N = 14, L = [], Rr = [];
    var dx = Math.cos(f.ang), dy = Math.sin(f.ang);
    var minW = 0.45 / s;
    for (var i = 0; i <= N; i++) {
      var t = (i / N - 0.5) * p;            // 가운데서 양끝으로 자란다
      var u = (i / N - 0.5) * 2;           // -1..1 (두께 프로파일)
      var pt = flakePoint(f, t);
      var t2 = Math.min(0.5, t + 0.01), t1 = Math.max(-0.5, t - 0.01);
      var a = flakePoint(f, t1), b = flakePoint(f, t2);
      var tx = b[0] - a[0], ty = b[1] - a[1], tl = Math.hypot(tx, ty) || 1;
      var nx = -ty / tl, ny = tx / tl;
      if (!isFinite(nx)) { nx = -dy; ny = dx; }
      var wv = Math.max(minW, f.thick * Math.pow(1 - u * u, 0.55));
      L.push([cx + (pt[0] + nx * wv) * s, cy + (pt[1] + ny * wv) * s]);
      Rr.push([cx + (pt[0] - nx * wv) * s, cy + (pt[1] - ny * wv) * s]);
    }
    ctx.beginPath();
    ctx.moveTo(L[0][0], L[0][1]);
    for (var j = 1; j < L.length; j++) ctx.lineTo(L[j][0], L[j][1]);
    for (var k = Rr.length - 1; k >= 0; k--) ctx.lineTo(Rr[k][0], Rr[k][1]);
    ctx.closePath();
    ctx.fill();
  };

  function blob(ctx, x, y, r, noise, segs) {
    ctx.beginPath();
    for (var i = 0; i <= segs; i++) {
      var a = i / segs * Math.PI * 2, m = 1;
      for (var k = 0; k < noise.length; k++) m += noise[k][1] * Math.sin(a * (k + 2) + noise[k][0]);
      var px = x + Math.cos(a) * r * m, py = y + Math.sin(a) * r * m;
      if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
    }
    ctx.closePath();
  }

  Micro.prototype.drawDuctile = function (ctx, t, cx, cy, s) {
    var nod = this.data.nod, i, n, p;
    // 1) 페라이트 띠
    ctx.fillStyle = css(this.ferrite);
    for (i = 0; i < nod.length; i++) {
      n = nod[i]; p = ease((t - n.d) / 0.5);
      if (p <= 0) continue;
      blob(ctx, cx + n.x * s, cy + n.y * s, n.hr * s * p, n.hn, 30);
      ctx.fill();
    }
    // 2) 페라이트 입계(아주 옅은 선)
    ctx.strokeStyle = css(this.ink, 0.13);
    ctx.lineWidth = 0.8;
    for (i = 0; i < nod.length; i++) {
      n = nod[i]; p = ease((t - n.d) / 0.5);
      if (p <= 0.05) continue;
      blob(ctx, cx + n.x * s, cy + n.y * s, n.hr * s * p, n.hn, 30);
      ctx.stroke();
    }
    // 3) 구상흑연
    for (i = 0; i < nod.length; i++) {
      n = nod[i]; p = ease((t - n.d - 0.05) / 0.45);
      if (p <= 0) continue;
      var x = cx + n.x * s, y = cy + n.y * s, r = Math.max(0.6, n.r * s * p);
      var gr = ctx.createRadialGradient(x - r * 0.15, y - r * 0.15, r * 0.1, x, y, r);
      gr.addColorStop(0, css(this.ink, 0.93));
      gr.addColorStop(1, css(this.ink, 0.7));
      ctx.fillStyle = gr;
      blob(ctx, x, y, r, n.bn, 22);
      ctx.fill();
    }
  };

  Micro.prototype.play = function () {
    if (this.played) return;
    this.played = true;
    var self = this;
    if (reduced() || !window.requestAnimationFrame) { this.t = 1; this.draw(1); return; }
    var t0 = 0;
    var step = function (ts) {
      if (!t0) t0 = ts;
      self.t = Math.min(1, (ts - t0) / DUR);
      self.draw(self.t * 1.0);
      if (self.t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };

  /* ---------- init ---------- */
  var io = null;
  function observe(m) {
    if (reduced() || !('IntersectionObserver' in window)) { m.play(); return; }
    if (!io) {
      io = new IntersectionObserver(function (ents) {
        ents.forEach(function (en) {
          if (en.isIntersecting) { en.target.__micro.play(); io.unobserve(en.target); }
        });
      }, { threshold: 0.3 });
    }
    io.observe(m.c);
  }

  function init(selector) {
    var roots;
    if (!selector) roots = document.querySelectorAll('[data-micro]');
    else if (typeof selector === 'string') roots = document.querySelectorAll(selector);
    else if (selector.length != null) roots = selector;
    else roots = [selector];
    var made = [];
    for (var i = 0; i < roots.length; i++) {
      var el = roots[i];
      var cs = el.matches && el.matches('canvas[data-micro-type]') ? [el] : el.querySelectorAll('canvas[data-micro-type]');
      for (var j = 0; j < cs.length; j++) {
        var c = cs[j];
        if (c.__micro) { made.push(c.__micro); continue; }
        var m = c.__micro = new Micro(c);
        m.draw(0);
        observe(m);
        watch(m);
        made.push(m);
      }
    }
    return made;
  }

  function watch(m) {
    var redo = function () {
      // 애니메이션 중이면 다음 프레임이 이어서 그린다. 끝났거나 시작 전이면 지금 상태로 다시 그린다.
      if (m.resize() && !(m.played && m.t < 1)) m.draw(m.played ? 1 : 0);
    };
    if (window.ResizeObserver) {
      var raf = 0;
      new ResizeObserver(function () { cancelAnimationFrame(raf); raf = requestAnimationFrame(redo); }).observe(m.c);
    } else window.addEventListener('resize', redo);
  }

  KMTG.micro = { init: init };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { init(); });
  else init();
})();
