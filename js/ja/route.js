/*!
 * KMT Global · route.js — 역량 엔벨로프 차트(FIG. 14) + 생산 경로 찾기
 * 의존성 없음 · file:// 동작 · 마크업: index.html #network (원본 _build/fragments/network.html)
 * 카피·판정 규칙: _build/content_ko.md §5-2·§5-3 (REV B)
 *
 *  [data-nw-env]     차트 호스트(빈 div). JS가 폭에 맞춰 인라인 SVG를 그린다(리사이즈 시 다시 그림)
 *  [data-nw-route]   경로 카드 A|B|C — 차트 영역과 서로 하이라이트
 *  [data-nw-hl]      범례 버튼 A|B|C
 *  [data-nw-finder]  경로 찾기 위젯 루트 (data-mailto = 대체용 수신 주소)
 *
 * 공개 API: KMTG.route.init(root?) · KMTG.route.evaluate(state)
 * 문의 연동: "이 조건으로 문의하기" → KMTG.prefillContact(obj) 가 있으면 호출 후 #contact 로 이동,
 *            없으면 mailto(제목·본문 프리필)로 대체. document 에 'kmtg:route-prefill' 이벤트도 보낸다.
 * 규칙: 가격·납기 계산 없음 · 결과는 항상 "예비 안내" · B 영역은 수치 경계 없음(정성 영역)
 * 일본어판(js/ja) — js/route.js와 같은 코드·판정, 화면·차트·메일 문구만 일본어(용어: _build/i18n/glossary.ja.md §3-9)
 */
(function () {
  'use strict';

  var KMTG = window.KMTG = window.KMTG || {};
  if (KMTG.route) return;

  var doc = document;
  var mqReduce = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  function reduced() { return !!(mqReduce && mqReduce.matches); }
  var HANGUL = /[\uAC00-\uD7A3]/;
  function shown(inp) { // RFQ 체크리스트: value가 한국어 원본이면 라벨의 굵은 글자(<b>)를 메일에 쓴다
    if (!HANGUL.test(inp.value)) return inp.value;
    var l = inp.closest ? inp.closest('label') : null;
    var b = l && (l.querySelector('b') || l.querySelector('span'));
    return b ? b.textContent.replace(/\u2060/g, '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim() : inp.value;
  }

  /* ------------------------------------------------------------------
   * 도메인 (log10) — x: 연간 수량 1 → ~316,000 개 / y: 단중 1 kg → ~28 t
   * 구간은 서로 겹치지 않는다(입력 선택지와 같은 경계)
   * ------------------------------------------------------------------ */
  var X1 = 5.5, Y1 = 4.45;
  var LG = function (n) { return Math.log(n) / Math.LN10; };
  var LOG5T = LG(5000);

  var WB = { // 단중: [lo, hi, 라벨]
    w1: [0, 1, '10 kg未満'],
    w2: [1, 2, '10 kg〜100 kg未満'],
    w3: [2, 3, '100 kg〜1 t未満'],
    w4: [3, LOG5T, '1 t〜5 t以下'],
    w5: [LOG5T, 4, '5 t超〜10 t以下'],
    w6: [4, Y1, '10 t超']
  };
  var QB = { // 연간 수량
    q1: [0, LG(50), '50個未満'],
    q2: [LG(50), LG(500), '50〜499個'],
    q3: [LG(500), LG(5000), '500〜4,999個'],
    q4: [LG(5000), X1, '5,000個以上']
  };
  var MAT = { FC: 'ねずみ鋳鉄（GC/FC）', FCD: '球状黒鉛鋳鉄（GCD/FCD）', U: '未定' };
  var MC = { Y: '必要', N: '不要', U: '未定' };
  var IATF = { Y: '必要', N: '不要', U: '不明' };

  var RES = {
    'R-A': { big: 'A', tag: 'フラン鋳造', match: ['A'], card: '#nw-card-a',
      title: 'フラン鋳造 — 関係会社ケイエムテック 高霊工場',
      body: '単品・多品種少量の鋳物に適したルートで、中小物から大物まで対応します。関係会社ケイエムテック 高霊工場の最大単重は、ねずみ鋳鉄 10 t、球状黒鉛鋳鉄 5 tです。' },
    'R-B': { big: 'B', tag: '自動造型量産', match: ['B'], card: '#nw-card-b',
      title: '自動造型量産 — 協力鋳造工場',
      body: '小物部品の繰り返し量産に適したルートです。協力鋳造工場にはIATF 16949認証工場が含まれており、認証は当該法人の名義です。' },
    'R-AB': { big: 'A · B', tag: '境界域', match: ['A', 'B'], card: '#nw-cards',
      title: '図面検討後にルートを決めます',
      body: 'この条件は2つのルートの境界に近い範囲です。どちらのルートが適しているかは、形状・数量・検査の要求を見て判断する必要があるため、図面を検討したうえで適切なルートをご提案します。' },
    'R-S': { big: '要検討', tag: '図面が必要', match: [], card: '#nw-cards',
      title: '図面の検討が必要です',
      body: '小物・少量の部品は、形状と木型の条件によって適したルートが異なります。図面をお送りいただければ、検討してご回答します。' },
    'R-X1': { big: '要検討', tag: '範囲外', match: [], card: '#nw-cards',
      title: '確認済みの範囲を超える単重です',
      body: '10 tを超える鋳物は、現在確認済みの生産範囲外です。図面と条件をお送りいただければ、対応可否を検討して結果をお知らせします。' },
    'R-X2': { big: '要検討', tag: 'FCD 5 t超', match: [], card: '#nw-card-a',
      title: '球状黒鉛鋳鉄 5 t超',
      body: '関係会社ケイエムテック 高霊工場の球状黒鉛鋳鉄の最大単重（5 t）を超えます。図面をお送りいただければ、対応可否を検討してご回答します。' },
    'R-X3': { big: '要検討', tag: 'IATF・1 t以上', match: [], card: '#nw-cards',
      title: '現在、該当するルートはありません',
      body: '単重1 t以上で、IATF 16949認証工場が必要な条件に合うルートは、現在ありません。関係会社ケイエムテック 高霊工場（フラン鋳造）の認証はISO 9001:2015です。' },
    'R-X4': { big: '要検討', tag: '物量確認', match: [], card: '#nw-cards',
      title: '年間物量の確認が必要です',
      body: '選択した単重・数量では、年間の物量が25,000 tを超え、関係会社ケイエムテック 高霊工場の年間生産能力（約12,000 t）を上回ります。図面と年間物量をお送りいただければ、対応可否を検討してご回答します。' }
  };
  var NOTES = {
    'N-W5': ['+ 材質', '5 tを超える単重は、ねずみ鋳鉄で確認済みの範囲です。関係会社ケイエムテック 高霊工場の球状黒鉛鋳鉄の最大単重は5 tです。'],
    'N-C': ['+ 加工', '機械加工は社外の機械加工協力会社が行い、KMT Globalは加工先の工程計画と測定結果を検討します。'],
    'N-IATF-B': ['+ IATF', 'IATF 16949認証工場のルートで検討します。該当案件の製造委託先はNDA締結後にお知らせし、認証の確認方法もその際にご案内します。'],
    'N-IATF-A': ['+ IATF', 'IATF 16949認証工場は、協力鋳造工場（自動造型）の中にあります。この単重が認証工場の対応範囲に入るかどうかは、図面検討後に確認します。'],
    'N-IATF-L': ['+ IATF', 'フラン鋳造ルート（関係会社ケイエムテック 高霊工場）の認証はISO 9001:2015で、IATF 16949認証工場ではありません。単重1 t以上で、IATF 16949認証工場が必要な条件に合うルートは、現在ありません。'],
    'N-CAP-A': ['+ 物量', '関係会社ケイエムテック 高霊工場の年間生産能力は約12,000 tです。年間の物量（単重 × 数量）が大きい場合は、生産可能かどうかを別途確認します。'],
    'N-CAP-B': ['+ 物量', '自動造型ルートは製造委託先ごとに生産能力が決まっているため、年間の物量を確認したうえでご回答します。'],
    'N-M': ['+ 材質', '材質は、使用条件と図面をもとに、ご相談しながら決めることができます。']
  };
  var NOTE = '目安 — 実際のルートと対応可否は図面検討後に確認';
  var NDA_KEY = 'NDA事前締結の要否'; // RFQ 체크리스트의 NDA 체크박스 value (index.src.ja.html #nw-result)

  /* ------------------------------------------------------------------
   * 판정 (content_ko §5-3 판정 규칙) — 순수 함수
   * state: { mat:'FC'|'FCD'|'U'|'', w:'w1'..'w6'|'', q:'q1'..'q4'|'', mc:'Y'|'N'|'U'|'', iatf:'Y'|'N'|'U'|'' }
   * ------------------------------------------------------------------ */
  function evaluate(s) {
    var w = s.w || '', q = s.q || '', mat = s.mat || '';
    var out = { kind: 'empty', code: '', notes: [], match: [] };
    if (!w) {
      out.prompt = q ? '単重を選ぶと、想定ルートが表示されます。' : '単重と年間数量を選ぶと、想定ルートが表示されます。';
      return out;
    }
    var code = '';
    if (w === 'w6') code = 'R-X1';
    else if (w === 'w5') code = mat === 'FCD' ? 'R-X2' : 'R-A';
    else if (w === 'w4') code = 'R-A';
    else if (!q) {
      out.prompt = '年間数量を選ぶと、想定ルートが表示されます。';
      return out;
    } else if (w === 'w3') code = q === 'q4' ? 'R-AB' : 'R-A';
    else if (w === 'w2') code = (q === 'q3' || q === 'q4') ? 'R-B' : 'R-AB';
    else code = (q === 'q3' || q === 'q4') ? 'R-B' : 'R-S';
    // 1 t 이상(후란 주조 경로)을 경로 A로 안내하지 않는 조건 (js/route.js와 같은 순서)
    //  · 수량 하한으로 본 최소 연간 물량이 고령공장 능력(연 약 12,000 t)을 넘음: w5(5 t 초과) × q4(5,000개 이상) = 25,000 t 초과
    //  · IATF 16949 인증 생산처 필요: 후란 주조 경로는 ISO 9001이며, 지금은 맞는 경로가 없다
    if (code === 'R-A' && w === 'w5' && q === 'q4') code = 'R-X4';
    else if (code === 'R-A' && s.iatf === 'Y' && (w === 'w4' || w === 'w5')) code = 'R-X3';

    out.kind = /R-[AB]/.test(code) && code !== 'R-AB' ? 'route' : (code === 'R-AB' ? 'review' : 'special');
    out.code = code;
    var r = RES[code];
    out.big = r.big; out.tag = r.tag; out.title = r.title; out.body = r.body; out.card = r.card;
    out.match = r.match.slice();

    if (w === 'w5' && mat !== 'FC' && mat !== 'FCD') out.notes.push('N-W5');
    // 연간 물량 확인: 1 t 이상(후란 주조, 연 약 12,000 t)은 연 500개 이상일 때(최소 500 t), 자동조형 경로는 항상
    if (code === 'R-A' && (w === 'w4' || w === 'w5') && (q === 'q3' || q === 'q4')) out.notes.push('N-CAP-A');
    if (code === 'R-B') out.notes.push('N-CAP-B');
    if (s.mc === 'Y') { out.notes.push('N-C'); out.match.push('C'); }
    if (s.iatf === 'Y') {
      if (code === 'R-B') out.notes.push('N-IATF-B');
      // 1 t 이상(R-X1·R-X2·R-X4)은 IATF 인증 생산처 범위가 아니며, 지금은 맞는 경로가 없다고 밝힌다(R-X3은 본문에 같은 내용)
      else if (code === 'R-X1' || code === 'R-X2' || code === 'R-X4') out.notes.push('N-IATF-L');
      else if (code === 'R-A' || code === 'R-AB') out.notes.push('N-IATF-A');
    }
    if (mat === 'U') out.notes.push('N-M');
    return out;
  }

  /* ------------------------------------------------------------------
   * 엔벨로프 차트 (인라인 SVG, 폭 = 실제 px)
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
      o.push('<title id="' + id + 't">FIG. 14 — 対応範囲（単重 × 年間数量、概念図）</title>');
      o.push('<desc id="' + id + 'd">対応範囲の概念図。横軸は年間数量、縦軸は単重です。フラン鋳造の領域は、関係会社ケイエムテック 高霊工場の数値で、ねずみ鋳鉄 最大 10 t、球状黒鉛鋳鉄 最大 5 tまでです。' +
        '自動造型量産の領域は小物・多数量の側にあり、境界は図面検討後に確認します。機械加工は両ルートに接続します。同じ内容をチャート下の表でも掲載しています。</desc>');
    }

    /* defs */
    o.push('<defs>');
    o.push('<pattern id="' + id + 'h" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line class="nw-hatch" x1="0" y1="0" x2="0" y2="7"/></pattern>');
    o.push('<pattern id="' + id + 's" width="6" height="6" patternUnits="userSpaceOnUse"><circle class="nw-dot" cx="3" cy="3" r="1.05"/></pattern>');
    // A 마스크: 선명한 다각형. 확정 경계(10 t)는 실선 상한선, 미확정 경계(오른쪽 대각선·아래쪽)는 점선으로 따로 그린다
    o.push('<mask id="' + id + 'ma" maskUnits="userSpaceOnUse" x="0" y="0" width="' + L.w + '" height="' + L.h + '"><polygon fill="#fff" points="' +
      pts(L, [[-1, 6], [2.62, 6], [2.62, 4], [3.62, 2.02], [-1, 2.02]]) + '"/></mask>');
    o.push('<clipPath id="' + id + 'ca"><rect x="' + x0 + '" y="' + L.y(4) + '" width="' + r1(L.pw) + '" height="' + r1(yb - L.y(4)) + '"/></clipPath>');
    o.push('<clipPath id="' + id + 'cp"><rect x="' + x0 + '" y="' + yt + '" width="' + r1(L.pw) + '" height="' + r1(L.ph) + '"/></clipPath>');
    // B 마스크: 타원형 방사 그라데이션(수치 경계 없음)
    o.push('<radialGradient id="' + id + 'g"><stop offset="0" stop-color="#fff" stop-opacity="1"/><stop offset=".5" stop-color="#fff" stop-opacity=".9"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>');
    var bc = [L.x(4.12), L.y(1.12)], brx = r1(1.5 / X1 * L.pw), bry = r1(1.18 / Y1 * L.ph);
    o.push('<mask id="' + id + 'mb" maskUnits="userSpaceOnUse" x="0" y="0" width="' + L.w + '" height="' + L.h + '"><ellipse fill="url(#' + id + 'g)" cx="' + bc[0] + '" cy="' + bc[1] + '" rx="' + brx + '" ry="' + bry + '" transform="rotate(-10 ' + bc[0] + ' ' + bc[1] + ')"/></mask>');
    o.push('</defs>');

    /* 그리드 */
    o.push('<g class="nw-grid nw-fade">');
    var d;
    for (d = 1; d <= 5; d++) o.push('<line x1="' + L.x(d) + '" y1="' + yt + '" x2="' + L.x(d) + '" y2="' + yb + '"/>');
    for (d = 1; d <= 4; d++) o.push('<line x1="' + x0 + '" y1="' + L.y(d) + '" x2="' + x1 + '" y2="' + L.y(d) + '"/>');
    o.push('</g>');

    /* A 영역 */
    var aLabel = 'A フラン鋳造 — 関係会社ケイエムテック 高霊工場。ねずみ鋳鉄 最大 10 t、球状黒鉛鋳鉄 最大 5 t。クリックするとルートカードへ移動';
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
    function place(x0p, x1p, h, cands) { // 마커와 겹치지 않는 첫 후보(y, log) → px
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
      labA.push(text(ax, ay, 'nw-lbl', 'A  フラン鋳造'));
      labA.push(text(ax, ay + (cp ? 15 : 18), 'nw-lbl-sub', 'ケイエムテック 高霊工場'));
    } else {
      labA.push(text(L.x(0.18), L.y(3.15), 'nw-lbl nw-lbl--mini', 'A'));
    }

    /* B 영역 */
    var bLabel = 'B 自動造型量産 — 協力鋳造工場。境界は図面検討後に確認。クリックするとルートカードへ移動';
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
      labB.push(text(bx, by, 'nw-lbl', 'B  自動造型量産', 'middle'));
      labB.push(text(bx, by + (cp ? 15 : 18), 'nw-lbl-sub', '協力鋳造工場', 'middle'));
      labB.push(text(bx, by + (cp ? 30 : 35), 'nw-lbl-note', '境界は図面検討後に確認', 'middle'));
    } else {
      labB.push(text(L.x(4.25), L.y(1.0), 'nw-lbl nw-lbl--mini', 'B', 'middle'));
    }

    /* 상한선: FC 10 t · FCD 5 t (관계사 케이엠텍 고령공장 기준, 확정 수치) */
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
        '<text x="' + lx0 + '" y="' + r1(y10 - 7) + '"><tspan class="nw-dim nw-dim--strong">FC 最大 10 t</tspan>' +
        (cp ? '' : '<tspan class="nw-dim-src" dx="10">ケイエムテック 高霊工場の数値</tspan>') + '</text>' +
        '<text x="' + lx0 + '" y="' + r1(y5 + (cp ? 14 : 16)) + '"><tspan class="nw-dim">FCD 最大 5 t</tspan>' +
        (cp ? '' : '<tspan class="nw-dim-src" dx="10">同上</tspan>') + '</text></g>';
      // 좁은 화면: 상한선 옆에 출처를 붙이면 C 주석과 겹치므로, A 영역 라벨(관계사 케이엠텍 고령공장)을 두 상한선 바로 아래에 둔다
    }

    /* 선택 조건 마커 */
    if (mk) {
      var mx0 = L.x(mk.x[0]), mx1 = L.x(mk.x[1]), my0 = L.y(mk.y[1]), my1 = L.y(mk.y[0]);
      o.push('<g class="nw-mark" clip-path="url(#' + id + 'cp)"><rect class="nw-mark-box" x="' + mx0 + '" y="' + my0 + '" width="' + r1(mx1 - mx0) + '" height="' + r1(my1 - my0) + '"/></g>');
    }

    /* 라벨(마커 위) */
    o.push('<g class="nw-lblg nw-fade" data-reg="A">' + labA.join('') + '</g>');
    o.push('<g class="nw-lblg nw-fade" data-reg="B">' + labB.join('') + '</g>');
    o.push(labCap);

    /* 경계 구간 주석 + C 오버레이 노트 */
    if (!mini) {
      var qx = L.x(cp ? 3.42 : 3.72), qy = L.y(cp ? 2.66 : 2.62), qr = cp ? 7 : 8;
      o.push('<g class="nw-q nw-fade"><circle cx="' + qx + '" cy="' + qy + '" r="' + qr + '"/>' +
        text(qx, qy + 4, 'nw-q-t', '?', 'middle') +
        text(qx + qr + 5, qy - 2, 'nw-lbl-note', '境界域') +
        text(qx + qr + 5, qy + (cp ? 11 : 13), 'nw-lbl-note', '図面検討後に判断') + '</g>');

      var cw = cp ? 150 : 214, ch = cp ? 40 : 46;
      var cx = r1(x1 - cw - (cp ? 2 : 6)), cy = r1(L.y(cp ? 4.3 : 4.25));
      var cAx = L.x(cp ? 2.72 : 2.86), cAy = L.y(cp ? 3.32 : 3.36);
      var cBx = r1(cx + cw * 0.82), cBy = L.y(1.9);
      o.push('<a class="nw-cnote" data-reg="C" href="#nw-card-c" aria-label="C 機械加工 — 両ルートに接続、機械加工協力会社。クリックするとルートカードへ移動">');
      o.push('<g class="nw-fade"><path class="nw-lead" d="M' + cx + ' ' + r1(cy + ch * 0.7) + ' L' + cAx + ' ' + cAy + '"/>' +
        '<path class="nw-lead" d="M' + cBx + ' ' + r1(cy + ch) + ' L' + cBx + ' ' + cBy + '"/>' +
        '<circle class="nw-lead-dot" cx="' + cAx + '" cy="' + cAy + '" r="2.4"/><circle class="nw-lead-dot" cx="' + cBx + '" cy="' + cBy + '" r="2.4"/>' +
        '<rect class="nw-cbox" x="' + cx + '" y="' + cy + '" width="' + cw + '" height="' + ch + '" rx="3"/>' +
        text(cx + 10, cy + (cp ? 17 : 19), 'nw-lbl nw-lbl--c', '+C  加工 — 両ルートに接続') +
        text(cx + 10, cy + (cp ? 32 : 36), 'nw-lbl-sub', '機械加工協力会社') + '</g>');
      o.push('</a>');
    }

    /* 축 */
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

    var xt = mini ? ['1', '', '100', '', '1万', ''] : cp ? ['1', '10', '100', '1,000', '1万', '10万'] : ['1', '10', '100', '1,000', '10,000', '100,000'];
    var yt2 = mini ? ['1 kg', '', '100 kg', '', '10 t'] : ['1 kg', '10 kg', '100 kg', '1 t', '10 t'];
    o.push('<g class="nw-tick">');
    for (d = 0; d <= 5; d++) if (xt[d]) o.push(text(L.x(d), yb + (mini ? 15 : 20), '', xt[d], d === 0 ? 'start' : 'middle'));
    for (d = 0; d <= 4; d++) if (yt2[d]) o.push(text(x0 - (mini ? 5 : 9), L.y(d) + 4, '', yt2[d], 'end'));
    o.push('</g>');
    if (!mini) {
      o.push(text(x0 - (cp ? 40 : 52), yt - (cp ? 14 : 16), 'nw-axt', '↑ 単重（対数目盛）'));
      o.push(text(x1, yb + (cp ? 40 : 44), 'nw-axt', cp ? '年間数量（個、対数）→' : '年間数量（個、対数目盛）→', 'end'));
    }
    o.push('</svg>');
    return o.join('');
  }

  /* ------------------------------------------------------------------
   * 하이라이트 (차트 영역 ↔ 경로 카드 ↔ 범례)
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
   * 경로 찾기 위젯
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
        if (msgEl) msgEl.textContent = !s.w && !s.q ? '単重と年間数量を先に選んでください。' : (!s.w ? '単重を先に選んでください。' : '年間数量を先に選んでください。');
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
    if (o.live) { // 입력 중 연속 낭독을 막기 위해 잠시 모았다가 알린다
      var msg = r.kind === 'empty' ? '' : '想定ルート：' + r.title + '。' + NOTE + '。';
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
    var ready = [], nda = false;
    var cks = this.el.querySelectorAll('[data-nw-check] input:checked');
    for (var i = 0; i < cks.length; i++) {
      if (cks[i].value === NDA_KEY) nda = true; // NDA 선행 체크는 '준비된 자료'가 아니라 요청으로 다룬다
      else ready.push(shown(cks[i]));
    }
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
      nda: nda,
      note: NOTE
    };
    var L = [
      'KMT Global',
      '海外営業ご担当者様',
      '',
      nda ? '生産ルートの目安で選んだ条件で、図面の検討についてお問い合わせします。図面をお送りする前に、NDAを先に締結したいと考えています。' : '生産ルートの目安で選んだ条件で、図面の検討をお願いいたします。',
      '',
      '■ 材質：' + (obj.material || '-'),
      '■ 単重：' + (obj.weight || '-'),
      '■ 年間数量：' + (obj.qty || '-'),
      '■ 機械加工：' + (obj.machining || '-'),
      '■ IATF 16949認証工場：' + (obj.iatf || '-'),
      '■ 準備済みの資料：' + (ready.length ? ready.join('、') : '-'),
      '■ NDAの事前締結：' + (nda ? '必要' : '-'),
      '',
      nda ? '図面はNDA締結後にお送りします。NDAの進め方をお知らせください。' : '図面ファイル：本メールに添付します（2D PDF、可能であれば3D STEP）。',
      '（生産ルートの目安：' + (obj.title || '-') + '）',
      '',
      'よろしくお願いいたします。'
    ];
    obj.message = L.join('\r\n');
    obj.subject = (nda ? '【NDAのご依頼・図面検討のお問い合わせ】' : '【図面検討のご依頼】') + [obj.material, obj.weight].filter(Boolean).join('／');
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

    // 표(대체 콘텐츠)는 JS가 있으면 접어 둔다
    var tbl = scope.querySelectorAll('details[data-nw-table]');
    for (var t = 0; t < tbl.length; t++) tbl[t].open = false;

    // 하이라이트: 마우스·포커스·탭
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

    // 진입 시 라인 드로우
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
