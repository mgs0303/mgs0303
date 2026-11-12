(function () {
  const STATUS_COLORS = {
    'Pas lancé': '#8a8f9a',
    'En attente de sortie': '#d2b252',
    'Accès Anticipé': '#47b5ad',
    'Demo': '#4a8fb3',
    'Priorité backlog': '#9e84d8',
    'Relancé': '#e07fa8',
    'Pause': '#e3a05a',
    'Partie en cours': '#5f9bd8',
    'Dropped': '#d96e6e',
    'Complété': '#5db97f'
  };
  const GROUP_ORDER = ['Pas lancé', 'En attente de sortie', 'Accès Anticipé', 'Demo', 'Relancé', 'Pause', 'Dropped', 'Complété'];
  const COMPLETION_ICONS = { 'Main Story': '🎯', 'Main + Sides': '🧭', '100%': '🎖️', 'Endless': '⏳', 'N/A': '❌' };

  // Mets ton pseudo Twitter / X ici, sans le @ (laisse vide pour cacher le lien)
  const TWITTER = 'bitterchocosan';

  const app = document.getElementById('app');
  const searchInput = document.getElementById('search');
  const modal = document.getElementById('modal');
  let games = [];
  let profile = {};
  let avisStatus = 'Tous';
  let avisSize = 'm';
  let avisSort = 'recent';
  let homeStatus = 'Tous';
  let homeSort = 'recent';
  let avisGenre = 'Tous';
  let avisYear = 'Tous';
  let avisMin = 0;
  let avisMax = 10;
  let gotyData = [];

  /* ---------- utilitaires ---------- */
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const BASE = location.pathname.replace(/[^/]*$/, '').replace(/\/$/, '');
  const encPath = (p) => p.split('/').map((seg) => { try { return encodeURIComponent(decodeURIComponent(seg)); } catch (e) { return encodeURIComponent(seg); } }).join('/');
  const path = (s) => {
    if (!s) return '';
    if (/^(https?:)?\/\//.test(s) || /^data:/.test(s)) return s;
    return s.charAt(0) === '/' ? BASE + encPath(s) : encPath(s);
  };
  const color = (status) => STATUS_COLORS[status] || '#8a8f9a';
  const hasNote = (g) => typeof g.note === 'number' && !isNaN(g.note);
  const noteText = (g) => (hasNote(g) ? String(g.note).replace('.', ',') : 'N/A');
  const pct = (g) => {
    if (g.status === 'Complété') return 100;
    const n = Number(g.progress);
    return isNaN(n) ? 0 : Math.max(0, Math.min(100, n));
  };
  const cmpDate = (dir) => (a, b) => {
    const x = a.end_date || '', y = b.end_date || '';
    if (!x && !y) return a.title.localeCompare(b.title);
    if (!x) return 1;
    if (!y) return -1;
    return dir * x.localeCompare(y) || a.title.localeCompare(b.title);
  };
  const cmpNote = (dir) => (a, b) => {
    if (!hasNote(a) && !hasNote(b)) return a.title.localeCompare(b.title);
    if (!hasNote(a)) return 1;
    if (!hasNote(b)) return -1;
    return dir * (a.note - b.note) || a.title.localeCompare(b.title);
  };
  const SORTS = {
    recent: { label: 'Plus récent', fn: cmpDate(-1) },
    ancien: { label: 'Plus ancien', fn: cmpDate(1) },
    note_desc: { label: 'Meilleure note', fn: cmpNote(-1) },
    note_asc: { label: 'Moins bonne note', fn: cmpNote(1) },
    az: { label: 'A → Z', fn: (a, b) => a.title.localeCompare(b.title) }
  };
  const dd = (kind, which, options, current, cls) => {
    const cur = options.find((o) => o.v === current) || options[0];
    return `<div class="dd${cls ? ' ' + cls : ''}"><button class="fold-toggle" data-fold aria-expanded="false" aria-haspopup="true">${esc(cur.s || cur.l)} <span class="chev" aria-hidden="true"></span></button><div class="fold-list" role="menu">${options.map((o) => `<button class="chip opt${o.v === cur.v ? ' on' : ''}" data-dd="${kind}" data-which="${which}" data-value="${esc(o.v)}">${esc(o.l)}</button>`).join('')}</div></div>`;
  };
  const sortSelect = (which, current) => dd('sort', which, Object.keys(SORTS).map((k) => ({ v: k, l: SORTS[k].label })), current, 'right');
  const backBtn = (href, label, hist) => `<a class="backbtn" href="${href}"${hist ? ' data-back' : ''}><svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg><span>${esc(label)}</span></a>`;
  const keepScroll = (fn) => { const y = window.scrollY; fn(); window.scrollTo(0, y); };
  const chip = (filter, value, on) => `<button class="chip${on ? ' on' : ''}" data-filter="${filter}" data-value="${esc(value)}">${esc(value)}</button>`;
  const fold = (label, chipsHtml) => `<div class="fold"><button class="fold-toggle" data-fold aria-expanded="false" aria-haspopup="true">${esc(label)} <span class="chev" aria-hidden="true"></span></button><div class="fold-list" role="menu">${chipsHtml}</div></div>`;
  const byEndDesc = (a, b) => (b.end_date || '').localeCompare(a.end_date || '') || a.title.localeCompare(b.title);
  const byStartDesc = (a, b) => (b.start_date || '').localeCompare(a.start_date || '') || a.title.localeCompare(b.title);
  const fmtDate = (d) => {
    if (!d) return '';
    const dt = new Date(d + 'T00:00:00');
    return isNaN(dt) ? d : dt.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  };
  const img = (src, cls, alt) => (src ? `<img class="${cls}" src="${esc(path(src))}" alt="${esc(alt || '')}" loading="lazy">` : '');
  const badge = (status) => `<span class="badge" style="--c:${color(status)}">${esc(status || 'Sans statut')}</span>`;
  const progressBar = (g) => `<div class="progress" style="--c:${color(g.status)}"><span class="pct">${pct(g)} %</span><div class="bar"><i style="width:${pct(g)}%"></i></div></div>`;

  /* ---------- cartes ---------- */
  function card(g, withBar) { return pcard(g, withBar ? (g.status === 'Complété' ? 'note' : 'bar') : 'none'); }
  function pcard(g, mode) {
    if (mode === undefined || mode === false) mode = 'bar'; else if (mode === true) mode = 'none';
    const ban = g.banner, cov = g.cover;
    const tags = [...toList(g.genre)].slice(0, 2);
    const pc = pct(g);
    const imgs = ban && cov && ban !== cov ? img(ban, 'pc-img pc-ban', g.title) + img(cov, 'pc-img pc-cov', g.title) : img(ban || cov, 'pc-img', g.title);
    return `<button class="pcard${imgs ? '' : ' noart'}" data-open="${esc(g.slug)}">
      ${imgs}
      <div class="pc-body"><div class="pc-name">${esc(g.title)}</div>
        ${mode === 'note' ? `<div class="pc-row">${tags.length ? `<div class="pc-tags">${tags.map((t) => `<span>${esc(t)}</span>`).join('')}</div>` : '<span></span>'}${hasNote(g) ? `<span class="pc-note">★ ${esc(noteText(g))} / 10</span>` : ''}</div>` : `${tags.length ? `<div class="pc-tags">${tags.map((t) => `<span>${esc(t)}</span>`).join('')}</div>` : ''}
        ${mode === 'bar' ? `<div class="pc-prog"><span class="pc-n">${pc} %</span><div class="pc-bar"><i style="width:${pc}%"></i></div></div>` : ''}`}</div>
    </button>`;
  }
  function tintCards() {
    document.querySelectorAll('.pcard:not([data-t]) .pc-img, .pod:not([data-t]) .pod-art img, .toprow:not([data-t]) .tr-art img').forEach((im) => {
      const go = () => {
        const c = im.closest('.pcard, .pod, .toprow'); if (!c || c.dataset.t) return;
        c.dataset.t = '1';
        try {
          const cv = document.createElement('canvas'); cv.width = cv.height = 24;
          const x = cv.getContext('2d'); x.drawImage(im, 0, 0, 24, 24);
          const d = x.getImageData(0, 12, 24, 12).data; let r = 0, g = 0, b = 0, n = 0;
          for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; n++; }
          r /= n * 255; g /= n * 255; b /= n * 255;
          const mx = Math.max(r, g, b), mn = Math.min(r, g, b), dl = mx - mn;
          let h = 0;
          if (dl) { h = mx === r ? ((g - b) / dl) % 6 : mx === g ? (b - r) / dl + 2 : (r - g) / dl + 4; h = Math.round(h * 60); if (h < 0) h += 360; }
          const l = (mx + mn) / 2, sat = dl ? dl / (1 - Math.abs(2 * l - 1)) : 0;
          c.style.setProperty('--h', h); c.style.setProperty('--s', Math.round(Math.min(0.85, Math.max(0.25, sat * 1.15)) * 100) + '%');
        } catch (e) { /* couleurs par défaut */ }
      };
      if (im.complete && im.naturalWidth) go(); else im.addEventListener('load', go, { once: true });
    });
  }
  function setW(c) { const k = +c.dataset.n; return c.children[k].offsetLeft - c.children[0].offsetLeft; }
  function initLoop() {
    document.querySelectorAll('.car-wrap .carousel:not([data-loop])').forEach((c) => {
      const items = [...c.children], n = items.length;
      if (n < 4 || !c.clientWidth) return;
      c.dataset.loop = '1'; c.dataset.n = n;
      const mk = (el) => { const x = el.cloneNode(true); x.setAttribute('aria-hidden', 'true'); x.tabIndex = -1; x.dataset.clone = '1'; return x; };
      items.slice().reverse().forEach((el) => c.insertBefore(mk(el), c.firstChild));
      items.forEach((el) => c.appendChild(mk(el)));
      c.style.scrollSnapType = 'none'; c.style.scrollBehavior = 'auto';
      c._skipUntil = performance.now() + 120;
      c.scrollLeft = setW(c) - (parseFloat(getComputedStyle(c).scrollPaddingLeft) || 0);
      requestAnimationFrame(() => { c.style.scrollSnapType = ''; c.style.scrollBehavior = ''; });
      const w = c.closest('.car-wrap'); if (w) { w.dataset.start = '0'; w.dataset.end = '0'; }
    });
  }
  function fixLoop(c) {
    const W = setW(c); if (!W) return;
    let x = c.scrollLeft;
    if (x < W * 0.5) x += W; else if (x > W * 1.5) x -= W; else return;
    c.style.scrollSnapType = 'none'; c.style.scrollBehavior = 'auto';
    c._skipUntil = performance.now() + 120;
    c.scrollLeft = x;
    requestAnimationFrame(() => { c.style.scrollSnapType = ''; c.style.scrollBehavior = ''; });
  }
  function syncCar() {
    document.querySelectorAll('.car-wrap').forEach((w) => {
      const c = w.querySelector('.carousel'); if (!c || c.dataset.loop) return;
      w.dataset.start = c.scrollLeft < 4 ? '1' : '0';
      w.dataset.end = c.scrollLeft + c.clientWidth >= c.scrollWidth - 4 ? '1' : '0';
    });
  }
  new MutationObserver(() => { initLoop(); tintCards(); requestAnimationFrame(syncCar); }).observe(app, { childList: true, subtree: true });
  window.addEventListener('resize', syncCar);
  function poster(g, i) {
    const art = g.cover || g.banner;
    const meta = g.status !== 'Complété' ? g.status : g.end_date ? fmtDate(g.end_date) : 'Complété';
    const tags = toList(g.genre).slice(0, 2);
    const gold = hasNote(g) && Number(g.note) >= 9.5;
    return `<a class="pcard portrait${art ? '' : ' noart'}" href="#/jeu/${encodeURIComponent(g.slug)}" style="--i:${Number.isInteger(i) ? i : 0}">
      ${art ? img(art, 'pc-img', g.title) : ''}<span class="pc-pct${gold ? ' gold' : ''}">${esc(noteText(g))}</span>
      <div class="pc-body"><div class="pc-name">${esc(g.title)}</div><div class="pc-meta">${esc(meta)}</div>
        <div class="pc-hover">${tags.length ? `<span class="ph-tags">${tags.map((t) => `<span>${esc(t)}</span>`).join('')}</span>` : ''}<span class="ph-go">Lire l’avis ›</span></div></div>
    </a>`;
  }
  function lastReview() {
    const txt = (g) => (Array.isArray(g.blocks) ? g.blocks.filter((b) => (b.type || b._block) === 'texte' && b.text).map((b) => b.text).join(' ') : '');
    const list = games.filter((g) => (g.status === 'Complété' || g.status === 'Dropped') && txt(g).trim()).sort(byEndDesc);
    const g = list[0]; if (!g) return '';
    let ex = txt(g).replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/[*_`>#~]/g, '').replace(/\s+/g, ' ').trim();
    if (ex.length > 260) ex = ex.slice(0, 260).replace(/\s+\S*$/, '') + '…';
    const art = g.cover || g.banner;
    const tags = toList(g.genre).slice(0, 2);
    return `<section class="lastrev"><div class="sec-head"><h2>Dernier avis</h2></div>
      <a class="lr-card" href="#/jeu/${encodeURIComponent(g.slug)}">
        <div class="lr-art">${art ? img(art, '', g.title) : `<div class="ph">${esc(g.title)}</div>`}</div>
        <div class="lr-body">
          <div class="lr-top"><span class="lr-title">${esc(g.title)}</span><span class="lr-score">${esc(noteText(g))}<small>/10</small></span></div>
          <div class="lr-meta">${[g.status !== 'Complété' ? g.status : '', g.end_date ? fmtDate(g.end_date) : '', ...tags].filter(Boolean).map((t) => `<span>${esc(t)}</span>`).join('')}</div>
          <p class="lr-ex">${esc(ex)}</p>
          <span class="lr-more">Lire l’avis ›</span>
        </div></a></section>`;
  }
  function section(title, list, withBar, small, carousel, wish) {
    if (!list.length) return '';
    if (wish) return `<section class="wish"><div class="sec-head"><h2>${esc(title)}</h2><span class="count">${list.length}</span></div><div class="pgrid">${list.map((g) => pcard(g, 'none')).join('')}</div></section>`;
    return `<section><div class="sec-head"><h2>${esc(title)}</h2><span class="count">${list.length}</span></div>
      ${carousel && list.length > 1 ? '<div class="car-wrap" data-start="1">' : ''}<div class="grid${small ? ' small' : ''}${carousel ? ' carousel' : ''}">${list.map((g) => (carousel ? pcard(g) : card(g, withBar))).join('')}</div>${carousel && list.length > 1 ? '<button type="button" class="car-btn prev" data-car="-1" aria-label="Précédent">‹</button><button type="button" class="car-btn next" data-car="1" aria-label="Suivant">›</button></div>' : ''}${carousel && list.length > 1 ? `<div class="dots" aria-hidden="true">${list.map((_, i) => `<i${i === 0 ? ' class="on"' : ''}></i>`).join('')}</div>` : ''}</section>`;
  }

  function applyTint(src) {
    if (!src) return;
    const im = new Image();
    im.onload = () => {
      try {
        const c = document.createElement('canvas'); c.width = c.height = 16;
        const x = c.getContext('2d'); x.drawImage(im, 0, 0, 16, 16);
        const d = x.getImageData(0, 0, 16, 16).data; let r = 0, g = 0, b = 0, n = 0;
        for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; n++; }
        r /= n; g /= n; b /= n;
        const k = 0.42, m = Math.max(r, g, b) || 1, boost = Math.min(1.5, 150 / m);
        const dark = [r, g, b].map((v) => Math.round(v * boost * k)).join(',');
        const mix = (t) => [r, g, b].map((v) => Math.round(v + (255 - v) * t)).join(',');
        const light = mix(0.5);
        const st = document.documentElement.style;
        st.setProperty('--tint', dark); st.setProperty('--tintl', light);
      } catch (e) { /* on garde les couleurs par défaut */ }
    };
    im.src = path(src);
  }
  function heroHtml() {
    const p = profile || {};
    const done = games.filter((g) => g.status === 'Complété');
    const hrs = Math.round(games.reduce((a, g) => a + (parseFloat(g.playtime) || 0), 0));
    const notes = games.map((g) => parseFloat(g.note)).filter((n) => !isNaN(n));
    const avg = notes.length ? (notes.reduce((a, b) => a + b, 0) / notes.length).toFixed(1).replace('.', ',') : '–';
    const name = p.display_name || 'La-Li-Lu-Le-Log';
    const h = (p.twitter || TWITTER || '').trim().replace(/^@/, '');
    return `<section class="hero3"><div class="hbg${p.banner ? '' : ' def'}"${p.banner ? ` style="background-image:url('${esc(path(p.banner))}')"` : ''}></div></section>
      <div class="pf">${p.avatar ? `<img class="pf-av" src="${esc(path(p.avatar))}" alt="">` : '<div class="pf-av"></div>'}
        <div class="pf-tx"><h1>${esc(name)}</h1>${h ? `<span class="h">@${esc(h)}</span>` : ''}
          <div class="pf-pills"><span><b>${games.length}</b> jeux</span><span><b>${done.length}</b> terminés</span><span><b>${hrs.toLocaleString('fr-FR')}</b> h</span><span><b>${avg}</b> moyenne</span></div></div>
</div>
      ${p.bio ? `<p class="bio">${esc(p.bio)}</p>` : '<div style="height:24px"></div>'}`;
  }

  /* ---------- pages ---------- */
  function renderHome() {
    if (!games.length) { app.innerHTML = '<p class="empty">Aucun jeu pour l\'instant. Ajoute le premier depuis l\'admin.</p>'; return; }
    const of = (s) => games.filter((g) => g.status === s);
    let html = heroHtml();
    html += section('Currently Playing', of('Partie en cours').sort(byStartDesc), true, false, true);
    html += lastReview();
    const doneAll = of('Complété').sort(byEndDesc);
    if (doneAll.length) html += `<section class="wish"><div class="sec-head"><h2>Derniers complétés</h2><span class="count">${doneAll.length}</span><a class="see-all" href="#/avis" data-allavis>Voir tout ›</a></div><div class="pgrid">${doneAll.slice(0, 6).map((g) => pcard(g, 'note')).join('')}</div></section>`;
    html += section('Mes envies', of('Priorité backlog').sort((a, b) => a.title.localeCompare(b.title)), false, false, false, true);

    const tabs = ['En attente de sortie', 'Accès Anticipé', 'Demo', 'Relancé', 'Pause', 'Dropped'];
    if (of('Pas lancé').length) tabs.unshift('Pas lancé');
    if (homeStatus !== 'Tous' && !tabs.includes(homeStatus)) homeStatus = 'Tous';
    const shown = (homeStatus === 'Tous' ? tabs : [homeStatus]).filter((st) => of(st).length);
    const groups = shown.map((st) => {
      const list = of(st).sort((a, b) => a.title.localeCompare(b.title));
      return `<div class="group"><div class="sec-head">${badge(st)}<span class="count">${list.length}</span></div>
        <div class="grid small">${list.map((g) => card(g, false)).join('')}</div></div>`;
    }).join('');
    const empty = groups ? '' : `<p class="empty">${homeStatus === 'Tous' ? 'Aucun jeu dans ces statuts pour l\'instant.' : 'Aucun jeu avec ce statut pour l\'instant.'}</p>`;
    const chips = ['Tous', ...tabs].map((st) => {
      const n = st === 'Tous' ? 0 : of(st).length;
      return `<button class="chip${st === homeStatus ? ' on' : ''}" data-filter="home-status" data-value="${esc(st)}">${esc(st)}${n ? ` <span class="chip-n">${n}</span>` : ''}</button>`;
    }).join('');
    html += `<section class="statut"><div class="sec-head"><h2>Par statut</h2>${fold(homeStatus, chips)}</div><div class="filters desk-only">${chips}</div>${groups}${empty}</section>`;

    app.innerHTML = html;
  }

  const filterSelect = (name, allLabel, values, current, short) => dd('fsel', name, [{ v: 'Tous', l: allLabel, s: short }, ...values.map((v) => ({ v, l: v }))], current, '');
  const fmtN = (n) => String(n).replace('.', ',');
  const rangeLabel = () => (avisMin <= 0 && avisMax >= 10 ? 'toutes' : avisMin === avisMax ? fmtN(avisMin) : `${fmtN(avisMin)} à ${fmtN(avisMax)}`);
  const rangeFill = () => `left:${avisMin * 10}%;width:${(avisMax - avisMin) * 10}%`;

  function avisFiltered() {
    return games.filter((g) => g.status === 'Complété' || g.status === 'Dropped')
      .filter((g) => avisStatus === 'Tous' || g.status === avisStatus)
      .filter((g) => avisGenre === 'Tous' || toList(g.genre).includes(avisGenre))
      .filter((g) => avisYear === 'Tous' || (g.end_date || '').slice(0, 4) === avisYear)
      .filter((g) => (avisMin <= 0 && avisMax >= 10) || (hasNote(g) && g.note >= avisMin && g.note <= avisMax))
      .sort(SORTS[avisSort].fn);
  }
  function updateAvisResults() {
    const list = avisFiltered();
    const box = document.getElementById('avis-results');
    if (!box) return;
    document.getElementById('avis-count').textContent = list.length;
    box.innerHTML = list.length ? `<div class="grid posters size-${avisSize}" id="avis-grid">${list.map(poster).join('')}</div>` : '<p class="empty">Aucun jeu ne correspond à ces filtres.</p>';
  }

  function renderAvis() {
    const base = games.filter((g) => g.status === 'Complété' || g.status === 'Dropped');
    const genres = [...new Set(base.flatMap((g) => toList(g.genre)))].sort((a, b) => a.localeCompare(b));
    const years = [...new Set(base.filter((g) => g.end_date).map((g) => g.end_date.slice(0, 4)))].sort().reverse();
    if (avisGenre !== 'Tous' && !genres.includes(avisGenre)) avisGenre = 'Tous';
    if (avisYear !== 'Tous' && !years.includes(avisYear)) avisYear = 'Tous';
    const chips = ['Tous', 'Complété', 'Dropped'].map((f) => chip('avis-status', f, f === avisStatus)).join('');
    app.innerHTML = `<section class="avis-panel"><div class="avis-bar"><div class="sec-head"><h2>Avis</h2><span class="count" id="avis-count">0</span>${fold(avisStatus, chips)}${sortSelect('avis', avisSort)}</div>
      <div class="filters avis-row"><span class="desk-only chips-inline">${chips}</span>${filterSelect('genre', 'Tous les genres', genres, avisGenre)}${filterSelect('year', 'Toutes les années', years, avisYear, 'Année')}
        <div class="rangebox"><span class="rl">Note : <b id="range-label">${rangeLabel()}</b></span>
          <div class="range"><span class="track"></span><span class="fill" id="range-fill" style="${rangeFill()}"></span>
            <input type="range" min="0" max="10" step="0.5" value="${avisMin}" data-range="min" aria-label="Note minimale">
            <input type="range" min="0" max="10" step="0.5" value="${avisMax}" data-range="max" aria-label="Note maximale"></div></div></div></div>
      <div id="avis-results"></div></section>`;
    updateAvisResults();
  }

  const toList = (v) => (Array.isArray(v) ? v : v ? [v] : []).filter(Boolean);
  const norm = (t) => String(t == null ? '' : t).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const initials = (t) => norm(t).split(/[^a-z0-9]+/).filter(Boolean).map((w) => w[0]).join('');
  function searchGames(q) {
    const terms = norm(q).split(/\s+/).filter(Boolean);
    if (!terms.length) return [];
    const hay = (g) => norm([g.title, initials(g.title), seriesOf(g), g.developer, g.publisher, ...toList(g.genre), ...toList(g.platform), g.release_year].join(' '));
    const rank = (g) => { const t = norm(g.title); return t.startsWith(terms[0]) ? 0 : t.includes(terms[0]) ? 1 : 2; };
    return games.filter((g) => { const h = hay(g); return terms.every((t) => h.includes(t)); })
      .sort((a, b) => rank(a) - rank(b) || a.title.localeCompare(b.title));
  }
  function renderSearch(q) {
    const list = searchGames(q);
    app.innerHTML = `<div class="sec-head"><h2>Recherche</h2><span class="count">${list.length} résultat${list.length > 1 ? 's' : ''}</span></div>
      ${list.length ? `<div class="grid small">${list.map((g) => card(g, false)).join('')}</div>` : `<p class="empty">Aucun jeu trouvé pour « ${esc(q)} ».</p>`}`;
  }

  function facts(g, full) {
    const rows = [];
    const add = (k, v, cls) => { if (v !== null && v !== undefined && v !== '') rows.push(`<div class="f${cls ? ' ' + cls : ''}"><dt>${k}</dt><dd>${v}</dd></div>`); };
    const finished = g.status === 'Complété' || g.status === 'Dropped';
    const genreTxt = esc([...toList(g.genre), ...toList(g.subgenre)].join(' / '));
    if (!full) add('Genre', genreTxt, 'wide');
    add('Série', esc(seriesOf(g)));
    add('Année', esc(g.release_year));
    if (full) add('Genre', genreTxt, 'genre');
    add('Éditeur', esc(g.publisher));
    add('Développeur', esc(g.developer));
    add('Plateforme', esc(toList(g.platform).join(', ')));
    add('Mode', esc(g.mode));
    const hours = Number(g.playtime);
    if (g.playtime !== null && g.playtime !== undefined && g.playtime !== '' && !isNaN(hours)) add('Temps de jeu', `${esc(String(hours).replace('.', ','))} h`);
    else if (g.status === 'Complété') add('Temps de jeu', 'N/A');
    add('Note', hasNote(g) ? `${esc(noteText(g))} / 10` : 'N/A');
    const c = g.completion;
    add('Completion', c ? `${COMPLETION_ICONS[c] || ''} ${esc(c)}` : '');
    const notStarted = ['Pas lancé', 'En attente de sortie', 'Priorité backlog'].includes(g.status);
    if (g.start_date) add('Début', esc(fmtDate(g.start_date)));
    else if (g.no_start_date && !notStarted) add('Début', 'N/A');
    if (finished) {
      if (g.end_date) add('Fin', esc(fmtDate(g.end_date)));
      else if (g.no_end_date) add('Fin', 'N/A');
    }
    const n = Number(g.replays);
    if (n > 0) add('Rejoué', `${n} fois`.replace(/^1 fois$/, '1 fois'));
    add('Raison du rejeu', esc(g.replay_reason));
    return `<dl class="facts">${rows.join('')}</dl>`;
  }

  function youtubeId(url) {
    const m = String(url || '').match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{11})/);
    return m ? m[1] : null;
  }
  function renderMarkdown(t) {
    t = t || '';
    if (/^\s*<\w/.test(t)) return t;
    if (window.marked) return window.marked.parse(t, { breaks: true });
    return t.split(/\n{2,}/).map((para) => `<p>${esc(para).replace(/\n/g, '<br>')}</p>`).join('');
  }
  function renderBlocks(blocks) {
    if (!Array.isArray(blocks) || !blocks.length) return '';
    const html = blocks.map((b) => {
      const type = b.type || b._block;
      if (type === 'titre') return b.text ? `<h2>${esc(b.text)}</h2>` : '';
      if (type === 'texte') return b.text ? `<div>${renderMarkdown(b.text)}</div>` : '';
      if (type === 'image') return b.image ? `<figure><img src="${esc(path(b.image))}" alt="${esc(b.caption)}" loading="lazy">${b.caption ? `<figcaption>${esc(b.caption)}</figcaption>` : ''}</figure>` : '';
      if (type === 'galerie') return Array.isArray(b.images) && b.images.length ? `<div class="gallery">${b.images.map((s) => `<img src="${esc(path(s))}" alt="" loading="lazy">`).join('')}</div>` : '';
      if (type === 'video') { const id = youtubeId(b.url); return id ? `<div class="video"><iframe src="https://www.youtube-nocookie.com/embed/${id}" allowfullscreen loading="lazy" title="Vidéo"></iframe></div>` : ''; }
      return '';
    }).join('');
    return html.trim() ? `<div class="content">${html}</div>` : '';
  }

  function renderGame(slug) {
    const g = games.find((x) => x.slug === slug);
    if (!g) { app.innerHTML = backBtn('#/', 'Accueil') + '<p class="empty">Ce jeu n\'existe pas.</p>'; return; }
    const art = g.cover || g.banner;
    const showBar = g.status !== 'Pas lancé' && g.status !== 'En attente de sortie';
    app.innerHTML = `${backBtn('#/avis', 'Retour', true)}
      <article class="game">
        <div class="cover">${art ? img(art, 'cv-main', g.title) : `<div class="ph">${esc(g.title)}</div>`}${g.banner ? img(g.banner, 'cv-alt', g.title) : ''}</div>
        <div class="ginfo">
          <h1>${esc(g.title)}</h1>
          <div class="row">${badge(g.status)}<span class="big-note">${esc(noteText(g))}${hasNote(g) ? '<small> / 10</small>' : ''}</span></div>
          ${showBar ? progressBar(g) : '<div style="height:16px"></div>'}
          ${facts(g, true)}
        </div>
      </article>
      ${renderBlocks(g.blocks)}`;
    document.title = g.title + ' · La-Li-Lu-Le-Log';
    fitCover();
  }
  function fitCover() {
    const art = document.querySelector('.game');
    const info = art && art.querySelector('.ginfo');
    if (!info) return;
    if (window.innerWidth <= 720) { art.style.gridTemplateColumns = ''; return; }
    const w = Math.max(220, Math.min(440, Math.round(info.offsetHeight * 2 / 3)));
    art.style.gridTemplateColumns = `${w}px 1fr`;
  }
  window.addEventListener('resize', fitCover);

  /* ---------- séries ---------- */
  const SERIES_RULES = [
    [/metal gear/, 'Metal Gear'], [/persona/, 'Persona'], [/batman/, 'Batman'], [/devil may cry/, 'Devil May Cry'],
    [/deltarune/, 'Deltarune'], [/higurashi/, 'Higurashi'], [/kingdom come/, 'Kingdom Come: Deliverance'],
    [/danganronpa/, 'Danganronpa'], [/date with death/, 'Date with Death'], [/escape academy/, 'Escape Academy'],
    [/duck detective/, 'Duck Detective'], [/golden idol/, 'Golden Idol'], [/resident evil/, 'Resident Evil'],
    [/cyberpunk/, 'Cyberpunk']
  ];
  const seriesOf = (g) => {
    if (g.series) return g.series;
    const t = norm(g.title);
    for (const [re, name] of SERIES_RULES) if (re.test(t)) return name;
    return '';
  };
  const avg = (list) => (list.length ? list.reduce((a, b) => a + b, 0) / list.length : null);
  const fmt1 = (n) => n.toFixed(1).replace('.', ',');
  const gameTime = (g) => g.start_date || g.end_date || (g.release_year ? String(g.release_year) : '9999');

  function renderSeries() {
    const map = new Map();
    games.forEach((g) => {
      const name = seriesOf(g);
      if (!name || g.hide_series) return;
      const k = norm(name);
      if (!map.has(k)) map.set(k, { name, games: [] });
      map.get(k).games.push(g);
    });
    const groups = [...map.values()].filter((x) => x.games.length >= 2)
      .sort((a, b) => b.games.length - a.games.length || a.name.localeCompare(b.name));
    if (!groups.length) { app.innerHTML = '<div class="sec-head"><h2>Séries</h2></div><p class="empty">Aucune série avec au moins 2 jeux pour l\'instant.</p>'; return; }
    app.innerHTML = `<div class="sec-head"><h2>Séries</h2><span class="count">${groups.length}</span></div>
      <div class="stiles" id="stiles">` + groups.map((gr, i) => {
      const gs = gr.games.slice().sort((a, b) => gameTime(a).localeCompare(gameTime(b)));
      const m = avg(gs.filter(hasNote).map((g) => g.note));
      const cg = gs.find((g) => g.cover) || gs.find((g) => g.banner);
      const art = cg && (cg.cover || cg.banner);
      gr.sorted = gs;
      return `<button class="pcard portrait stile" data-series="${i}" aria-expanded="false">
        ${art ? img(art, 'pc-img', gr.name) : ''}<span class="pc-pct">${gs.length} jeux</span>
        <span class="pc-body"><span class="pc-name">${esc(gr.name)}</span>${m !== null ? `<span class="pc-meta">note moyenne ${fmt1(m)}</span>` : ''}</span></button>`;
    }).join('') + '</div>';
    window.__series = groups;
    openSeriesIdx = openSeriesName ? groups.findIndex((x) => x.name === openSeriesName) : -1;
    if (openSeriesIdx >= 0) placeSeriesPanel(false);
  }
  let openSeriesIdx = -1;
  let openSeriesName = '';
  function placeSeriesPanel(userClick) {
    const wrap = document.getElementById('stiles');
    if (!wrap) return;
    wrap.querySelectorAll('.spanel').forEach((n) => n.remove());
    const tiles = [...wrap.querySelectorAll('.stile')];
    openSeriesName = openSeriesIdx >= 0 ? window.__series[openSeriesIdx].name : '';
    tiles.forEach((t, i) => { const on = i === openSeriesIdx; t.classList.toggle('on', on); t.setAttribute('aria-expanded', on); });
    if (openSeriesIdx < 0) return;
    const gr = window.__series[openSeriesIdx];
    const cols = Math.max(1, getComputedStyle(wrap).gridTemplateColumns.split(' ').length);
    const end = Math.min(tiles.length - 1, (Math.floor(openSeriesIdx / cols) + 1) * cols - 1);
    const panel = document.createElement('section');
    panel.className = 'spanel';
    panel.innerHTML = `<div class="sp-head"><h3>${esc(gr.name)}</h3><span class="v-meta">${gr.sorted.length} jeux</span><button class="chip" data-series-close>Fermer</button></div>
      <div class="grid posters compact">${gr.sorted.map(poster).join('')}</div>`;
    tiles[end].after(panel);
    if (userClick) {
      const tr = tiles[openSeriesIdx].getBoundingClientRect();
      if (panel.getBoundingClientRect().top > window.innerHeight - 120) window.scrollBy({ top: tr.top - 80, behavior: 'smooth' });
    }
  }

  window.addEventListener('resize', () => { if (openSeriesIdx >= 0) placeSeriesPanel(false); });

  /* ---------- GOTY ---------- */
  function gameByRef(ref) {
    const k = norm(ref);
    return games.find((g) => norm(g.title) === k || g.slug === ref || norm(g.slug) === k);
  }
  function gotyYears() {
    const set = new Set(gotyData.map((x) => String(x.annee || x.year || '')));
    games.forEach((g) => { if ((g.status === 'Complété' || g.status === 'Dropped') && g.end_date) set.add(g.end_date.slice(0, 4)); });
    return [...set].filter(Boolean).sort().reverse();
  }
  const gotyRows = (year) => {
    const entry = gotyData.find((x) => String(x.annee || x.year) === year);
    return toList(entry && entry.entries).map((e) => {
      const ref = typeof e === 'string' ? e : (e.game || e.title || '');
      return { g: gameByRef(ref), ref, comment: typeof e === 'object' ? e.comment : '' };
    }).filter((r) => r.ref).slice(0, 10);
  };
  function renderGotyIndex() {
    const years = gotyYears();
    if (!years.length) { app.innerHTML = '<div class="sec-head"><h2>GOTY</h2></div><p class="empty">Pas encore de top.</p>'; return; }
    app.innerHTML = `<div class="sec-head"><h2>GOTY</h2></div><p class="sub">Mon top 10 de chaque année.</p>
      <div class="ycards">${years.map((y) => {
      const n = gotyRows(y).length;
      const hue = (Number(y) * 47) % 360;
      return `<a class="ycard${n ? '' : ' empty-y'}" href="#/goty/${y}" style="--h:${isNaN(hue) ? 220 : hue}">
        <span class="y-year">${esc(y)}</span><span class="y-label">${n ? 'Top 10' : 'Bientôt'}</span></a>`;
    }).join('')}</div>`;
  }
  function renderGoty(year) {
    const years = gotyYears();
    if (!years.includes(year)) { renderGotyIndex(); return; }
    const rows = gotyRows(year);
    const info = (r) => {
      const g = r.g;
      return {
        title: g ? g.title : r.ref,
        meta: g ? [toList(g.genre).slice(0, 2).join(' / '), toList(g.platform).join(', ')].filter(Boolean).join(' · ') : '',
        score: g && hasNote(g) ? noteText(g) : ''
      };
    };
    const wrap = (r, cls, inner) => (r.g ? `<a class="${cls}" href="#/jeu/${encodeURIComponent(r.g.slug)}">${inner}</a>` : `<div class="${cls}">${inner}</div>`);
    const top = rows.slice(0, 3);
    const rest = rows.slice(3);
    const podium = [1, 0, 2].filter((i) => top[i]).map((i) => {
      const r = top[i], t = info(r);
      const art = r.g && (r.g.cover || r.g.banner);
      return wrap(r, `pcard portrait gpod gp${i + 1}`, `${art ? img(art, 'pc-img', t.title) : ''}
          <span class="gp-rank">${i + 1}</span>${t.score ? `<span class="pc-pct">${esc(t.score)}</span>` : ''}
        <div class="pc-body"><div class="pc-name">${esc(t.title)}</div>${t.meta ? `<div class="pc-meta">${esc(t.meta)}</div>` : ''}
        ${i === 0 && r.comment ? `<p class="gp-comment">${esc(r.comment)}</p>` : ''}</div>`);
    }).join('');
    const list = rest.map((r, i) => {
      const t = info(r);
      const art = r.g && (r.g.cover || r.g.banner);
      return wrap(r, 'toprow', `<span class="tr-rank">${i + 4}</span>
        <span class="tr-art">${art ? img(art, '', t.title) : ''}</span>
        <span class="tr-body"><span class="tr-title">${esc(t.title)}</span>
        <span class="tr-meta">${esc(t.meta || '')}</span>
        ${r.comment ? `<span class="tr-comment">${esc(r.comment)}</span>` : ''}</span>
        ${t.score ? `<span class="tr-score">${esc(t.score)}</span>` : ''}`);
    }).join('');
    app.innerHTML = `${backBtn('#/goty', 'Tous les GOTY')}<div class="sec-head"><h2>GOTY ${esc(year)}</h2></div>
      ${rows.length ? `<div class="podium" data-n="${top.length}">${podium}</div>
        ${list ? `<div class="toplist" style="--rows:${Math.ceil(rest.length / 2)}">${list}</div>` : ''}`
      : `<p class="empty">Le top 10 ${esc(year)} n'est pas encore fait.</p>`}`;
  }

  /* ---------- statistiques ---------- */
  const MONTHS = ['Janv', 'Févr', 'Mars', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sept', 'Oct', 'Nov', 'Déc'];
  const hrows = (items, max) => items.map(([label, n]) => `<div class="hrow"><span class="t" title="${esc(label)}">${esc(label)}</span>
    <span class="b"><i style="width:${max ? Math.round((n / max) * 100) : 0}%"></i></span><span class="n">${n}</span></div>`).join('');
  const vcols = (items) => {
    const max = Math.max(1, ...items.map((x) => x[1]));
    return `<div class="vbars">${items.map(([label, n]) => `<div class="vcol"><b>${n || ''}</b><i style="height:${n ? Math.max(4, Math.round((n / max) * 110)) : 2}px"></i><span>${esc(label)}</span></div>`).join('')}</div>`;
  };
  const tile = (v, l, s) => `<div class="tile"><div class="v">${v}</div><div class="l">${l}</div>${s ? `<div class="s">${s}</div>` : ''}</div>`;

  function renderStats(year) {
    const done = games.filter((g) => g.status === 'Complété' || g.status === 'Dropped');
    const years = [...new Set(done.filter((g) => g.end_date).map((g) => g.end_date.slice(0, 4)))].sort().reverse();
    if (year !== 'Tous' && !years.includes(year)) year = 'Tous';
    const sel = year === 'Tous' ? done : done.filter((g) => (g.end_date || '').slice(0, 4) === year);
    const comp = sel.filter((g) => g.status === 'Complété');
    const drop = sel.filter((g) => g.status === 'Dropped');
    const noted = sel.filter(hasNote);
    const m = avg(noted.map((g) => g.note));
    const timed = sel.filter((g) => typeof g.playtime === 'number' && g.playtime > 0);
    const hours = timed.reduce((a, g) => a + g.playtime, 0);
    const replays = sel.reduce((a, g) => a + (Number(g.replays) > 0 ? Number(g.replays) : 0), 0);

    const chips = ['Tous', ...years].map((y) => `<a class="chip${y === year ? ' on' : ''}" href="#/stats/${y}">${y}</a>`).join('');
    const tiles = [
      tile(comp.length, 'Jeux terminés'),
      tile(drop.length, 'Jeux abandonnés'),
      tile(m !== null ? fmt1(m) : 'N/A', 'Note moyenne', noted.length ? `sur ${noted.length} jeux notés` : ''),
      tile(timed.length ? `${Math.round(hours)} h` : 'N/A', 'Heures de jeu', timed.length ? `sur ${timed.length} jeux avec durée` : ''),
      replays ? tile(replays, 'Rejeux') : ''
    ].join('');

    const dist = [];
    for (let n = 10; n >= 1; n--) dist.push([String(n), noted.filter((g) => Math.round(g.note) === n).length]);
    const distMax = Math.max(1, ...dist.map((x) => x[1]));

    let time;
    if (year === 'Tous') {
      const ys = [...years].reverse().map((y) => [y, done.filter((g) => (g.end_date || '').slice(0, 4) === y && g.status === 'Complété').length]);
      time = { title: 'Jeux terminés par année', html: vcols(ys) };
    } else {
      const ms = MONTHS.map((l, i) => [l, comp.filter((g) => g.end_date && Number(g.end_date.slice(5, 7)) === i + 1).length]);
      time = { title: `Jeux terminés par mois en ${year}`, html: vcols(ms) };
    }

    const gc = new Map();
    sel.forEach((g) => toList(g.genre).forEach((x) => gc.set(x, (gc.get(x) || 0) + 1)));
    const genres = [...gc.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 8);

    const solo = sel.filter((g) => String(g.mode).toLowerCase() === 'solo').length;
    const multi = sel.filter((g) => String(g.mode).toLowerCase() === 'multi').length;

    const longest = timed.slice().sort((a, b) => b.playtime - a.playtime).slice(0, 5);
    const best = noted.filter((g) => g.note >= 10).length;

    app.innerHTML = `<div class="sec-head"><h2>Statistiques</h2></div>
      <div class="filters">${chips}</div>
      ${sel.length ? `<div class="tiles">${tiles}</div>
      <div class="panels">
        <div class="panel"><h3>${time.title}</h3>${time.html}</div>
        <div class="panel"><h3>Répartition des notes</h3>${noted.length ? hrows(dist, distMax) : '<p class="empty">Aucune note.</p>'}
          ${best ? `<p class="hint">${best} jeu${best > 1 ? 'x' : ''} noté${best > 1 ? 's' : ''} 10 / 10</p>` : ''}</div>
        <div class="panel"><h3>Genres les plus joués</h3>${genres.length ? hrows(genres, genres[0][1]) : '<p class="empty">Aucun genre renseigné.</p>'}</div>
        <div class="panel"><h3>Les plus longs</h3>${longest.length ? `<ol class="rank-list">${longest.map((g) => `<li><a href="#/jeu/${encodeURIComponent(g.slug)}">${esc(g.title)}</a><span>${esc(String(g.playtime).replace('.', ','))} h</span></li>`).join('')}</ol>` : '<p class="empty">Aucune durée renseignée.</p>'}
          ${solo + multi ? `<p class="hint">Solo : ${solo} · Multi : ${multi}</p>` : ''}</div>
      </div>` : '<p class="empty">Aucun jeu terminé pour cette période.</p>'}`;
  }

  /* ---------- aperçu (fenêtre) ---------- */
  function openModal(slug) {
    const g = games.find((x) => x.slug === slug);
    if (!g) return;
    const banner = g.banner || g.cover;
    const showBar = g.status !== 'Pas lancé' && g.status !== 'En attente de sortie';
    modal.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(g.title)}">
      <button class="close" data-close aria-label="Fermer">×</button>
      ${banner ? img(banner, 'banner', g.title) : `<div class="banner ph">${esc(g.title)}</div>`}
      <div class="inner">
        <div class="m-head"><div><h2>${esc(g.title)}</h2>${badge(g.status)}</div>
          <a class="btn" href="#/jeu/${encodeURIComponent(g.slug)}" data-close>Avis</a></div>
        ${showBar ? progressBar(g) : '<div style="height:14px"></div>'}
        ${facts(g, false)}
      </div></div>`;
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
    modal.querySelector('.close').focus();
  }
  function closeModal() { modal.hidden = true; modal.innerHTML = ''; document.body.style.overflow = ''; }

  /* ---------- visionneuse d'images ---------- */
  const lb = document.getElementById('lightbox');
  const lbImg = lb.querySelector('img');
  const lbCount = lb.querySelector('.lb-count');
  let lbList = [];
  let lbIdx = 0;
  function lbShow() {
    lbImg.src = lbList[lbIdx];
    lbCount.textContent = lbList.length > 1 ? `${lbIdx + 1} / ${lbList.length}` : '';
    lb.classList.toggle('single', lbList.length < 2);
  }
  function openLb(el) {
    const all = Array.from(document.querySelectorAll('.content img'));
    lbList = all.map((i) => i.currentSrc || i.src);
    lbIdx = Math.max(0, all.indexOf(el));
    lbShow();
    lb.hidden = false;
    document.body.style.overflow = 'hidden';
  }
  function closeLb() { lb.hidden = true; lbImg.removeAttribute('src'); document.body.style.overflow = ''; }
  function stepLb(d) { lbIdx = (lbIdx + d + lbList.length) % lbList.length; lbShow(); }

  /* ---------- routage ---------- */
  document.addEventListener('scroll', (e) => {
    const c = e.target;
    if (!c.classList || !c.classList.contains('carousel')) return;
    const wrap = c.closest('.car-wrap');
    if (!(c._skipUntil && performance.now() < c._skipUntil)) { c.classList.add('moving'); clearTimeout(c._mt); c._mt = setTimeout(() => c.classList.remove('moving'), 100); }
    if (c.dataset.loop) { clearTimeout(c._lt); c._lt = setTimeout(() => fixLoop(c), 140); }
    if (wrap && !c.dataset.loop) { wrap.dataset.start = c.scrollLeft < 4 ? '1' : '0'; wrap.dataset.end = c.scrollLeft + c.clientWidth >= c.scrollWidth - 4 ? '1' : '0'; }
    const dots = c.closest('section').querySelectorAll('.dots i');
    if (!dots.length) return;
    const card = c.firstElementChild;
    const step = card ? card.getBoundingClientRect().width + 10 : 1;
    const idx = c.dataset.loop ? ((Math.round(c.scrollLeft / step) - +c.dataset.n) % dots.length + dots.length) % dots.length : Math.min(dots.length - 1, Math.round(c.scrollLeft / step));
    dots.forEach((d, i) => d.classList.toggle('on', i === idx));
  }, true);
  const enterPage = () => { app.classList.remove('enter'); void app.offsetWidth; app.classList.add('enter'); };
  const scrollPos = {};
  let lastY = 0;
  let currentHash = null;
  let userNav = false;
  let navCount = 0;
  window.addEventListener('scroll', () => { lastY = window.scrollY; }, { passive: true });
  function route() {
    if (currentHash !== null) scrollPos[currentHash] = lastY;
    const restoreY = !userNav && scrollPos[location.hash || '#/'] ? scrollPos[location.hash || '#/'] : 0;
    userNav = false;
    currentHash = location.hash || '#/';
    navCount += 1;
    closeModal();
    closeLb();
    const h = location.hash || '#/';
    document.title = 'La-Li-Lu-Le-Log';
    const navKey = h.startsWith('#/avis') ? 'avis' : h.startsWith('#/goty') ? 'goty' : h.startsWith('#/series') ? 'series'
      : h.startsWith('#/stats') ? 'stats' : (h === '#/' || h === '') ? 'home' : '';
    document.querySelectorAll('[data-nav]').forEach((a) => a.classList.toggle('on', a.dataset.nav === navKey));
    if (h.startsWith('#/recherche/')) {
      const q = decodeURIComponent(h.slice(12));
      if (document.activeElement !== searchInput && searchInput.value.trim() !== q) searchInput.value = q;
      renderSearch(q);
      window.scrollTo(0, restoreY);
      enterPage();
      return;
    }
    document.body.classList.toggle('avispage', h.startsWith('#/avis'));
    document.body.classList.toggle('home', !/^#\/(jeu|avis|goty|series|stats|recherche)/.test(h));
    if (document.activeElement !== searchInput && searchInput.value) searchInput.value = '';
    if (h.startsWith('#/jeu/')) renderGame(decodeURIComponent(h.slice(6)));
    else if (h.startsWith('#/avis')) renderAvis();
    else if (h.startsWith('#/goty')) { const gy = decodeURIComponent(h.slice(7)); if (gy) renderGoty(gy); else renderGotyIndex(); }
    else if (h.startsWith('#/series')) renderSeries();
    else if (h.startsWith('#/stats')) renderStats(decodeURIComponent(h.slice(8)) || 'Tous');
    else renderHome();
    window.scrollTo(0, restoreY);
    lastY = restoreY;
    enterPage();
  }

  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-allavis]')) { avisStatus = 'Complété'; }
    const cn = e.target.closest('[data-car]');
    if (cn) { const c = cn.closest('section').querySelector('.carousel'); if (c) { const f = c.firstElementChild; const st = f ? f.getBoundingClientRect().width + 18 : c.clientWidth; const k = Math.max(1, Math.floor(c.clientWidth / st)); c.scrollBy({ left: Number(cn.dataset.car) * st * k, behavior: 'smooth' }); } return; }
    const nl = e.target.closest('a[href^="#/"]');
    if (nl && !nl.hasAttribute('data-back')) userNav = true;
    const bk = e.target.closest('[data-back]');
    if (bk && navCount > 1) { e.preventDefault(); history.back(); return; }
    if (!lb.hidden) {
      if (e.target.closest('.lb-prev')) { stepLb(-1); return; }
      if (e.target.closest('.lb-next')) { stepLb(1); return; }
      if (e.target.closest('.lb-close') || e.target === lb) { closeLb(); return; }
      return;
    }
    const zoom = e.target.closest('.content img');
    if (zoom) { openLb(zoom); return; }
    const open = e.target.closest('[data-open]');
    if (open) { openModal(open.dataset.open); return; }
    if (e.target.closest('[data-close]') || e.target === modal) { closeModal(); return; }
    if (e.target.closest('[data-series-close]')) { openSeriesIdx = -1; placeSeriesPanel(true); return; }
    const st = e.target.closest('.stile');
    if (st) { const i = +st.dataset.series; openSeriesIdx = openSeriesIdx === i ? -1 : i; placeSeriesPanel(true); return; }
    document.querySelectorAll('.fold.open,.dd.open').forEach((f) => { if (!f.contains(e.target)) f.classList.remove('open'); });
    const opt = e.target.closest('[data-dd]');
    if (opt) {
      const v = opt.dataset.value; const w = opt.dataset.which;
      keepScroll(() => {
        if (opt.dataset.dd === 'sort') { if (w === 'avis') { avisSort = v; renderAvis(); } else { homeSort = v; renderHome(); } }
        else { if (w === 'genre') avisGenre = v; if (w === 'year') avisYear = v; renderAvis(); }
      });
      return;
    }
    const ft = e.target.closest('[data-fold]');
    if (ft) { const box = ft.closest('.fold,.dd'); const on = box.classList.toggle('open'); ft.setAttribute('aria-expanded', on); return; }
    const f = e.target.closest('[data-filter]');
    if (f) {
      keepScroll(() => {
        if (f.dataset.filter === 'avis-status') { avisStatus = f.dataset.value; renderAvis(); }
        if (f.dataset.filter === 'home-status') { homeStatus = f.dataset.value; renderHome(); }
      });
    }
  });
  document.addEventListener('input', (e) => {
    const r = e.target.closest('[data-range]');
    if (!r) return;
    const v = Number(r.value);
    if (r.dataset.range === 'min') { avisMin = Math.min(v, avisMax); r.value = avisMin; }
    else { avisMax = Math.max(v, avisMin); r.value = avisMax; }
    document.getElementById('range-label').textContent = rangeLabel();
    document.getElementById('range-fill').style.cssText = rangeFill();
    updateAvisResults();
  });

  document.addEventListener('keydown', (e) => {
    if (!lb.hidden) {
      if (e.key === 'Escape') closeLb();
      if (e.key === 'ArrowLeft' && lbList.length > 1) stepLb(-1);
      if (e.key === 'ArrowRight' && lbList.length > 1) stepLb(1);
      return;
    }
    if (e.key === 'Escape' && !modal.hidden) closeModal();
  });
  const suggest = document.getElementById('suggest');
  let sugIdx = -1;
  const hideSuggest = () => { suggest.hidden = true; suggest.innerHTML = ''; sugIdx = -1; };
  function showSuggest() {
    const q = searchInput.value.trim();
    if (!q) { hideSuggest(); return; }
    const list = searchGames(q);
    const top = list.slice(0, 7);
    suggest.innerHTML = top.length
      ? top.map((g) => {
        const art = g.banner || g.cover;
        const meta = [g.release_year, g.status !== 'Complété' ? g.status : '', hasNote(g) ? `${noteText(g)} / 10` : ''].filter(Boolean).join(' · ');
        return `<a class="sug" href="#/jeu/${encodeURIComponent(g.slug)}">${art ? img(art, '', '') : '<span class="sug-ph"></span>'}
          <span class="sug-t"><b>${esc(g.title)}</b><small>${esc(meta)}</small></span></a>`;
      }).join('') + (list.length > top.length ? `<a class="sug more" href="#/recherche/${encodeURIComponent(q)}">Voir les ${list.length} résultats</a>` : '')
      : `<div class="sug none">Aucun jeu trouvé</div>`;
    suggest.hidden = false;
    sugIdx = -1;
  }
  searchInput.addEventListener('input', showSuggest);
  searchInput.addEventListener('focus', showSuggest);
  searchInput.addEventListener('keydown', (e) => {
    const items = Array.from(suggest.querySelectorAll('a.sug'));
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (!items.length) return;
      e.preventDefault();
      sugIdx = (sugIdx + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
      items.forEach((a, i) => a.classList.toggle('active', i === sugIdx));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const q = searchInput.value.trim();
      if (sugIdx >= 0 && items[sugIdx]) { location.hash = items[sugIdx].getAttribute('href'); }
      else if (q) location.hash = '#/recherche/' + encodeURIComponent(q);
      hideSuggest();
      searchInput.blur();
    } else if (e.key === 'Escape') {
      if (!suggest.hidden) hideSuggest(); else { searchInput.value = ''; }
      searchInput.blur();
    }
  });
  suggest.addEventListener('click', (e) => { if (e.target.closest('a.sug')) { hideSuggest(); searchInput.value = ''; } });
  document.addEventListener('click', (e) => { if (!e.target.closest('.search')) hideSuggest(); });
  document.addEventListener('keydown', (e) => {
    if (e.key === '/' && !/^(input|textarea|select)$/i.test((e.target.tagName || '')) && lb.hidden && modal.hidden) { e.preventDefault(); searchInput.focus(); }
  });
  (function () {
    const a = document.getElementById('twitter-link');
    const h = TWITTER.trim().replace(/^@/, '');
    if (!a || !h) return;
    a.href = 'https://x.com/' + encodeURIComponent(h);
    document.getElementById('twitter-label').textContent = '@' + h;
    a.hidden = false;
  })();
  window.addEventListener('hashchange', route);

  Promise.all([
    fetch('games.json').then((r) => r.json()),
    fetch('goty.json').then((r) => (r.ok ? r.json() : [])).catch(() => []),
    fetch('profile.json').then((r) => (r.ok ? r.json() : {})).catch(() => ({}))
  ])
    .then(([data, goty, prof]) => { profile = prof || {}; applyTint(profile.banner); games = data.filter((g) => g && g.title); games.forEach((g) => { if (g.status === 'DEMO') g.status = 'Demo'; }); gotyData = Array.isArray(goty) ? goty : []; route(); })
    .catch(() => { app.innerHTML = '<p class="empty">Impossible de charger les jeux. Vérifie que le site est bien en ligne sur GitHub Pages.</p>'; });

  /* ---------- lecteur de musique (ordinateur uniquement) ---------- */
  (function initPlayer() {
    if (!window.matchMedia('(min-width:721px)').matches) return;
    let pref = null; try { pref = localStorage.getItem('mp'); } catch (e) { /* ignoré */ }
    const box = document.createElement('div');
    box.id = 'mp'; box.setAttribute('role', 'button'); box.setAttribute('tabindex', '0');
    box.setAttribute('aria-label', 'Musique : lecture / pause'); box.title = 'Peace Reload — clic pour pause / lecture';
    box.innerHTML = '<img class="mp-pause" src="assets/player-pause.png" alt=""><img class="mp-play" src="assets/player-play.png" alt=""><span class="mp-time">00:00</span>';
    document.body.appendChild(box);
    const au = new Audio('assets/peace-reload.mp3'); au.loop = true; au.volume = 0.12; au.preload = 'auto';
    const tEl = box.querySelector('.mp-time');
    const two = (n) => String(n).padStart(2, '0');
    au.addEventListener('timeupdate', () => { const t = Math.floor(au.currentTime); tEl.textContent = two(Math.floor(t / 60)) + ':' + two(t % 60); });
    au.addEventListener('play', () => box.classList.add('playing'));
    au.addEventListener('pause', () => box.classList.remove('playing'));
    const save = (v) => { try { localStorage.setItem('mp', v); } catch (e) { /* ignoré */ } };
    const toggle = () => { if (au.paused) { save('on'); au.play().catch(() => {}); } else { save('off'); au.pause(); } };
    box.addEventListener('click', toggle);
    box.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });
    if (pref !== 'off') {
      au.play().catch(() => {
        const first = (e) => {
          if (box.contains(e.target)) return;
          document.removeEventListener('pointerdown', first, true); document.removeEventListener('keydown', first, true);
          if (au.paused && pref !== 'off') au.play().catch(() => {});
        };
        document.addEventListener('pointerdown', first, true); document.addEventListener('keydown', first, true);
      });
    }
  })();
})();
