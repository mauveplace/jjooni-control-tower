/* Observatory v2 navigation — phase 1 (issue #403).
 * Opt-in only: ?ui=v2 (or ?ui=v1 to clear a remembered opt-in). The default
 * page is untouched. Five top-level tabs group the 13 legacy tabs without
 * deleting any: the legacy buttons stay in the DOM (hidden) and are clicked to
 * switch panels, so lazy loading, hash deep links and module hooks keep working.
 */
(function (root) {
  'use strict';
  const IA = [
    { id: 'today', label: '오늘', tabs: ['overview'] },
    { id: 'market', label: '시장', tabs: ['indices', 'official-macro', 'rates', 'fx', 'energy', 'sectors'] },
    { id: 'strategy', label: '전략', tabs: ['tripod', 'jjooni-tripod', 'regime'] },
    { id: 'calendar', label: '일정', tabs: ['calendar'] },
    { id: 'brief', label: '시황', tabs: ['morning-brief', 'analysis-lab'] }
  ];
  function groupOf(tab) { return IA.find(g => g.tabs.includes(tab)) || null; }
  function enabled(search, stored) {
    const ui = new URLSearchParams(search || '').get('ui');
    if (ui === 'v2') return true;
    if (ui === 'v1') return false;
    return stored === 'v2';
  }
  const api = { IA, groupOf, enabled, version: '1.0' };
  if (typeof module === 'object' && module.exports) { module.exports = api; return; }
  if (!root.document) return;

  let stored = null;
  try {
    const ui = new URLSearchParams(location.search).get('ui');
    if (ui === 'v2') localStorage.setItem('obs-ui', 'v2');
    if (ui === 'v1') localStorage.removeItem('obs-ui');
    stored = localStorage.getItem('obs-ui');
  } catch (_) { /* storage blocked: query flag still works */ }
  root.__JJOONI_NAV_V2 = { ...api, active: false };
  if (!enabled(location.search, stored)) return;

  const css = `
body.navV2 #tabs{display:none!important}
.navV2Bar{position:sticky;top:0;z-index:31;background:#fff;border-bottom:1px solid #e5ebf2}
.navV2Main{display:flex;gap:4px;padding:8px 12px 0;max-width:1180px;margin:0 auto}
.navV2Main button{flex:1 1 0;min-height:44px;border:0;border-bottom:3px solid transparent;background:none;font:inherit;font-size:15px;font-weight:700;color:#5b6878;cursor:pointer}
.navV2Main button[aria-current=page]{color:#0e1726;border-bottom-color:#0e1726}
.navV2Sub{display:flex;gap:6px;overflow-x:auto;padding:8px 12px;max-width:1180px;margin:0 auto}
.navV2Sub:empty{display:none}
.navV2Sub button{flex:0 0 auto;min-height:36px;border:1px solid #d8e0e9;background:#fff;border-radius:999px;padding:0 14px;font:inherit;font-size:13px;font-weight:600;color:#425466;cursor:pointer}
.navV2Sub button[aria-pressed=true]{background:#0e1726;border-color:#0e1726;color:#fff}
`;
  function legacy(tab) { return document.querySelector('#tabs button[data-tab="' + tab + '"]'); }
  function current() { return document.querySelector('#tabs button.on')?.dataset.tab || 'overview'; }

  function mount() {
    const tabs = document.getElementById('tabs');
    if (!tabs || document.querySelector('.navV2Bar')) return;
    const style = document.createElement('style'); style.textContent = css; document.head.appendChild(style);
    const skin = document.createElement('link'); skin.rel = 'stylesheet'; skin.href = './observatory-v2-skin.css?v=20261112-skin1'; document.head.appendChild(skin);
    const bar = document.createElement('nav'); bar.className = 'navV2Bar'; bar.setAttribute('aria-label', '주요 화면');
    const main = document.createElement('div'); main.className = 'navV2Main';
    const sub = document.createElement('div'); sub.className = 'navV2Sub'; sub.setAttribute('aria-label', '하위 화면');
    for (const g of IA) {
      const b = document.createElement('button'); b.type = 'button'; b.dataset.group = g.id; b.textContent = g.label;
      b.addEventListener('click', () => {
        const here = groupOf(current());
        if (here && here.id === g.id) return;
        const target = g.tabs.map(legacy).find(Boolean);
        if (target) target.click();
      });
      main.appendChild(b);
    }
    bar.append(main, sub);
    tabs.parentNode.insertBefore(bar, tabs);
    document.body.classList.add('navV2');
    sync();
    new MutationObserver(sync).observe(tabs, { subtree: true, childList: true, attributes: true, attributeFilter: ['class'] });
    root.__JJOONI_NAV_V2.active = true;
  }

  function sync() {
    const bar = document.querySelector('.navV2Bar'); if (!bar) return;
    const tab = current(), g = groupOf(tab);
    if (document.body.dataset.v2tab !== tab) document.body.dataset.v2tab = tab;
    for (const b of bar.querySelectorAll('.navV2Main button')) {
      if (g && b.dataset.group === g.id) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    }
    const sub = bar.querySelector('.navV2Sub');
    const items = g && g.tabs.length > 1 ? g.tabs.map(t => [t, legacy(t)]).filter(x => x[1]) : [];
    const want = items.map(x => x[0] + (x[0] === tab ? '*' : '')).join(',');
    if (sub.dataset.state === want) return;
    sub.dataset.state = want;
    sub.replaceChildren(...items.map(([t, btn]) => {
      const c = document.createElement('button'); c.type = 'button'; c.dataset.tab = t; c.textContent = btn.textContent.trim();
      c.setAttribute('aria-pressed', String(t === tab));
      c.addEventListener('click', () => { if (current() !== t) legacy(t)?.click(); });
      return c;
    }));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
  // Some legacy tabs (분석 Lab, 주요 지수) are inserted later by their modules.
  let tries = 0; const id = setInterval(() => { tries++; sync(); if (tries > 40) clearInterval(id); }, 250);
})(typeof window === 'object' ? window : globalThis);
