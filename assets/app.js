(function () {
  const STATUS_COLORS = {
    'Pas lancé': '#8a8f9a',
    'En attente de sortie': '#d2b252',
    'Accès Anticipé': '#47b5ad',
    'Priorité backlog': '#9e84d8',
    'Relancé': '#e07fa8',
    'Pause': '#e3a05a',
    'Partie en cours': '#5f9bd8',
    'Dropped': '#d96e6e',
    'Complété': '#5db97f'
  };
  const GROUP_ORDER = ['Pas lancé', 'En attente de sortie', 'Accès Anticipé', 'Relancé', 'Pause', 'Dropped', 'Complété'];
  const COMPLETION_ICONS = { 'Main Story': '🎯', 'Main + Sides': '🧭', '100%': '🎖️', 'Endless': '⏳', 'N/A': '❌' };

  const app = document.getElementById('app');
  const modal = document.getElementById('modal');
  let games = [];
  let avisFilter = 'Tous';

  /* ---------- utilitaires ---------- */
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const BASE = location.pathname.replace(/[^/]*$/, '').replace(/\/$/, '');
  const path = (s) => (!s ? '' : /^(https?:)?\/\//.test(s) || /^data:/.test(s) ? s : s.charAt(0) === '/' ? BASE + s : s);
  const color = (status) => STATUS_COLORS[status] || '#8a8f9a';
  const hasNote = (g) => typeof g.note === 'number' && !isNaN(g.note);
  const noteText = (g) => (hasNote(g) ? String(g.note).replace('.', ',') : 'N/A');
  const pct = (g) => {
    if (g.status === 'Complété') return 100;
    const n = Number(g.progress);
    return isNaN(n) ? 0 : Math.max(0, Math.min(100, n));
  };
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
  function card(g, withBar) {
    const banner = g.banner || g.cover;
    return `<button class="card" data-open="${esc(g.slug)}">
      ${banner ? img(banner, 'banner', g.title) : `<div class="banner ph">${esc(g.title)}</div>`}
      <div class="body"><div class="name">${esc(g.title)}</div>${withBar ? progressBar(g) : ''}</div>
    </button>`;
  }
  function poster(g) {
    const art = g.cover || g.banner;
    return `<a class="poster" href="#/jeu/${encodeURIComponent(g.slug)}">
      <div class="art">${art ? img(art, '', g.title) : `<div class="ph">${esc(g.title)}</div>`}
        <span class="score">${esc(noteText(g))}</span></div>
      <div class="name">${esc(g.title)}</div>
      <div class="meta">${esc(g.status === 'Dropped' ? 'Dropped' : g.end_date ? fmtDate(g.end_date) : 'Complété')}</div>
    </a>`;
  }
  function section(title, list, withBar, small) {
    if (!list.length) return '';
    return `<section><div class="sec-head"><h2>${esc(title)}</h2><span class="count">${list.length}</span></div>
      <div class="grid${small ? ' small' : ''}">${list.map((g) => card(g, withBar)).join('')}</div></section>`;
  }

  /* ---------- pages ---------- */
  function renderHome() {
    if (!games.length) { app.innerHTML = '<p class="empty">Aucun jeu pour l\'instant. Ajoute le premier depuis l\'admin.</p>'; return; }
    const of = (s) => games.filter((g) => g.status === s);
    let html = '';
    html += section('Currently Playing', of('Partie en cours').sort(byStartDesc), true);
    html += section('Backloggd', of('Priorité backlog').sort((a, b) => a.title.localeCompare(b.title)), false);

    const groups = GROUP_ORDER.map((s) => {
      let list = of(s);
      list = s === 'Complété' ? list.sort(byEndDesc) : list.sort((a, b) => a.title.localeCompare(b.title));
      if (!list.length) return '';
      return `<div class="group"><div class="sec-head">${badge(s)}<span class="count">${list.length}</span></div>
        <div class="grid small">${list.map((g) => card(g, false)).join('')}</div></div>`;
    }).join('');
    if (groups) html += `<section><div class="sec-head"><h2>Par statut</h2></div>${groups}</section>`;

    html += section('Complété', of('Complété').sort(byEndDesc), true);
    app.innerHTML = html;
  }

  function renderAvis() {
    const list = games.filter((g) => g.status === 'Complété' || g.status === 'Dropped')
      .filter((g) => avisFilter === 'Tous' || g.status === avisFilter).sort(byEndDesc);
    const chips = ['Tous', 'Complété', 'Dropped'].map((f) => `<button class="chip${f === avisFilter ? ' on' : ''}" data-filter="${f}">${f}</button>`).join('');
    app.innerHTML = `<div class="sec-head"><h2>Avis</h2><span class="count">${list.length}</span></div>
      <div class="filters">${chips}</div>
      ${list.length ? `<div class="grid posters">${list.map(poster).join('')}</div>` : '<p class="empty">Aucun jeu à afficher ici pour l\'instant.</p>'}`;
  }

  function facts(g, full) {
    const rows = [];
    const add = (k, v) => { if (v !== null && v !== undefined && v !== '') rows.push(`<dt>${k}</dt><dd>${v}</dd>`); };
    add('Série', esc(g.series));
    add('Année', esc(g.release_year));
    add('Genre', esc([g.genre, g.subgenre].filter(Boolean).join(' / ')));
    add('Éditeur', esc(g.publisher));
    add('Développeur', esc(g.developer));
    add('Plateforme', esc(g.platform));
    add('Note', hasNote(g) ? `${esc(noteText(g))} / 10` : 'N/A');
    const c = g.completion;
    add('Completion', c ? `${COMPLETION_ICONS[c] || ''} ${esc(c)}` : '');
    add('Début', esc(fmtDate(g.start_date)));
    add('Fin', esc(fmtDate(g.end_date)));
    return `<dl class="facts">${rows.join('')}</dl>`;
  }

  function youtubeId(url) {
    const m = String(url || '').match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{11})/);
    return m ? m[1] : null;
  }
  function renderMarkdown(t) {
    t = t || '';
    if (/^\s*<\w/.test(t)) return t;
    return window.marked ? window.marked.parse(t) : `<p>${esc(t)}</p>`;
  }
  function renderBlocks(blocks) {
    if (!Array.isArray(blocks) || !blocks.length) return '';
    const html = blocks.map((b) => {
      const type = b.type || b._block;
      if (type === 'titre') return b.text ? `<h2>${esc(b.text)}</h2>` : '';
      if (type === 'texte') return b.text ? `<div>${renderMarkdown(b.text)}</div>` : '';
      if (type === 'image') return b.image ? `<figure><img src="${esc(path(b.image))}" alt="${esc(b.caption)}" loading="lazy">${b.caption ? `<figcaption>${esc(b.caption)}</figcaption>` : ''}</figure>` : '';
      if (type === 'galerie') return Array.isArray(b.images) && b.images.length ? `<div class="gallery">${b.images.map((s) => `<a href="${esc(path(s))}" target="_blank" rel="noopener"><img src="${esc(path(s))}" alt="" loading="lazy"></a>`).join('')}</div>` : '';
      if (type === 'video') { const id = youtubeId(b.url); return id ? `<div class="video"><iframe src="https://www.youtube-nocookie.com/embed/${id}" allowfullscreen loading="lazy" title="Vidéo"></iframe></div>` : ''; }
      return '';
    }).join('');
    return html.trim() ? `<div class="content">${html}</div>` : '';
  }

  function renderGame(slug) {
    const g = games.find((x) => x.slug === slug);
    if (!g) { app.innerHTML = '<a class="back" href="#/">← Accueil</a><p class="empty">Ce jeu n\'existe pas.</p>'; return; }
    const art = g.cover || g.banner;
    const showBar = g.status !== 'Pas lancé' && g.status !== 'En attente de sortie';
    app.innerHTML = `<a class="back" href="#/avis">← Retour</a>
      <article class="game">
        <div class="cover">${art ? img(art, '', g.title) : `<div class="ph">${esc(g.title)}</div>`}</div>
        <div>
          <h1>${esc(g.title)}</h1>
          <div class="row">${badge(g.status)}<span class="big-note">${esc(noteText(g))}${hasNote(g) ? '<small> / 10</small>' : ''}</span></div>
          ${showBar ? progressBar(g) : '<div style="height:16px"></div>'}
          ${facts(g, true)}
        </div>
      </article>
      ${renderBlocks(g.blocks)}`;
    document.title = g.title + ' · La Li Lu Le Log';
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
        <h2>${esc(g.title)}</h2>${badge(g.status)}
        ${showBar ? progressBar(g) : '<div style="height:18px"></div>'}
        ${facts(g, false)}
        <a class="btn" href="#/jeu/${encodeURIComponent(g.slug)}" data-close>Voir la page complète</a>
      </div></div>`;
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
    modal.querySelector('.close').focus();
  }
  function closeModal() { modal.hidden = true; modal.innerHTML = ''; document.body.style.overflow = ''; }

  /* ---------- routage ---------- */
  function route() {
    closeModal();
    const h = location.hash || '#/';
    document.title = 'La Li Lu Le Log';
    document.querySelectorAll('[data-nav]').forEach((a) => a.classList.toggle('on',
      (a.dataset.nav === 'home' && (h === '#/' || h === '')) || (a.dataset.nav === 'avis' && h.startsWith('#/avis'))));
    if (h.startsWith('#/jeu/')) renderGame(decodeURIComponent(h.slice(6)));
    else if (h.startsWith('#/avis')) renderAvis();
    else renderHome();
    window.scrollTo(0, 0);
  }

  document.addEventListener('click', (e) => {
    const open = e.target.closest('[data-open]');
    if (open) { openModal(open.dataset.open); return; }
    if (e.target.closest('[data-close]') || e.target === modal) { closeModal(); return; }
    const f = e.target.closest('[data-filter]');
    if (f) { avisFilter = f.dataset.filter; renderAvis(); }
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !modal.hidden) closeModal(); });
  window.addEventListener('hashchange', route);

  fetch('games.json')
    .then((r) => r.json())
    .then((data) => { games = data.filter((g) => g && g.title); route(); })
    .catch(() => { app.innerHTML = '<p class="empty">Impossible de charger les jeux. Vérifie que le site est bien en ligne sur GitHub Pages.</p>'; });
})();
