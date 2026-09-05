/* JJOONI Control Tower — QA status banner */
(function (global) {
  "use strict";

  var STATUS_URL = 'qa/status.json';
  var DEFAULT_MAX_AGE = 3600;
  var POLL_MS = 5 * 60 * 1000;
  var TIMEOUT_MS = 8000;

  function css() {
    if (document.getElementById('ctqa-style')) return;
    var s = document.createElement('style');
    s.id = 'ctqa-style';
    s.textContent = [
      '#ctqa{position:sticky;top:0;z-index:9999;display:none;align-items:center;gap:10px;',
      'padding:10px 14px;font:600 13px/1.4 system-ui,-apple-system,sans-serif;',
      'border-bottom:1px solid rgba(255,255,255,.12)}',
      '#ctqa.on{display:flex}',
      '#ctqa.fail{background:#5a1f2a;color:#ffdbe1}',
      '#ctqa.stale{background:#4a3813;color:#ffe7b0}',
      '#ctqa.dead{background:#2a2f38;color:#c6ced9}',
      '#ctqa .ctqa-msg{flex:1;min-width:0}',
      '#ctqa a{color:inherit;text-decoration:underline;white-space:nowrap;font-weight:800}',
      '#ctqa button{background:transparent;border:0;color:inherit;font-size:18px;',
      'line-height:1;cursor:pointer;padding:0 4px}',
      '#ctqa button:focus-visible{outline:2px solid currentColor;outline-offset:2px}'
    ].join('');
    document.head.appendChild(s);
  }

  function el() {
    var b = document.getElementById('ctqa');
    if (b) return b;
    b = document.createElement('div');
    b.id = 'ctqa';
    b.setAttribute('role', 'status');
    b.setAttribute('aria-live', 'polite');
    b.innerHTML = '<span class="ctqa-msg"></span>' +
                  '<a href="qa/">자세히</a>' +
                  '<button type="button" aria-label="배너 닫기">&times;</button>';
    b.querySelector('button').addEventListener('click', function () { b.classList.remove('on'); });
    document.body.insertBefore(b, document.body.firstChild);
    return b;
  }

  function show(kind, msg) {
    var b = el();
    b.className = 'on ' + kind;
    b.querySelector('.ctqa-msg').textContent = msg;
  }

  function hide() {
    var b = document.getElementById('ctqa');
    if (b) b.className = '';
  }

  function fmtAge(sec) {
    if (sec < 3600) return Math.round(sec / 60) + '분';
    if (sec < 86400) return (sec / 3600).toFixed(1) + '시간';
    return (sec / 86400).toFixed(1) + '일';
  }

  async function check() {
    var ac = new AbortController();
    var t = setTimeout(function () { ac.abort(); }, TIMEOUT_MS);
    try {
      var r = await fetch(STATUS_URL + '?t=' + Date.now(), { cache: 'no-store', signal: ac.signal });
      if (!r.ok) throw new Error('응답 ' + r.status);
      var j = await r.json();

      var gen = j.generated_kst ? new Date(j.generated_kst) : null;
      var age = gen && !isNaN(gen) ? (Date.now() - gen.getTime()) / 1000 : Infinity;
      var maxAge = j.max_age_seconds || DEFAULT_MAX_AGE;

      if (age > maxAge) {
        show('stale', '구조 점검이 ' + fmtAge(age) + ' 동안 갱신되지 않았습니다. 화면의 수치는 검증되지 않은 상태입니다.');
        return;
      }

      var failed = (j.failed_checks || []);
      if (failed.length) {
        var s = j.summary || {};
        var blockers = s.blockers ? ' (차단 ' + s.blockers + '건)' : '';
        show('fail', '계좌 정합성 점검 ' + failed.length + '건 실패' + blockers +
                     '. 총계와 계좌별 수치가 어긋나 있을 수 있습니다.');
        return;
      }
      hide();
    } catch (e) {
      show('dead', '구조 점검 상태를 확인할 수 없습니다: ' + e.message);
    } finally {
      clearTimeout(t);
    }
  }

  global.CTQABanner = {
    mount: function () {
      css();
      check();
      setInterval(check, POLL_MS);
      document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'visible') check();
      });
    },
    check: check
  };
})(window);
