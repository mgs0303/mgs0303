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

  // Mets ton pseudo Twitter / X ici, sans le @ (laisse vide pour cacher le lien)
  const TWITTER = 'bitterchocosan';

  const app = document.getElementById('app');
  const searchInput = document.getElementById('search');
  const modal = document.getElementById('modal');
  let games = [];
  let avisStatus = 'Tous';
  let avisSort = 'recent';
  let homeStatus = 'Tous';
  let homeSort = 'recent';
  let avisGenre = 'Tous';
  let avisYear = 'Tous';
  let avisNote = 'Tous';
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
  const sortSelect = (which, current) => `<select class="select" data-sort="${which}" aria-label="Trier">${Object.keys(SORTS).map((k) => `<option value="${k}"${k === current ? ' selected' : ''}>${SORTS[k].label}</option>`).join('')}</select>`;
  const chip = (filter, value, on) => `<button class="chip${on ? ' on' : ''}" data-filter="${filter}" data-value="${esc(value)}">${esc(value)}</button>`;
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
      <div class="meta">${esc(g.status !== 'Complété' ? g.status : g.end_date ? fmtDate(g.end_date) : 'Complété')}</div>
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

    const present = GROUP_ORDER.filter((st) => of(st).length);
    if (present.length) {
      if (homeStatus !== 'Tous' && !present.includes(homeStatus)) homeStatus = 'Tous';
      const shown = homeStatus === 'Tous' ? present : [homeStatus];
      const groups = shown.map((st) => {
        let list = of(st);
        list = st === 'Complété' ? list.sort(byEndDesc) : list.sort((a, b) => a.title.localeCompare(b.title));
        return `<div class="group"><div class="sec-head">${badge(st)}<span class="count">${list.length}</span></div>
          <div class="grid small">${list.map((g) => card(g, false)).join('')}</div></div>`;
      }).join('');
      const chips = ['Tous', ...present].map((st) => chip('home-status', st, st === homeStatus)).join('');
      html += `<section><div class="sec-head"><h2>Par statut</h2></div><div class="filters">${chips}</div>${groups}</section>`;
    }

    const done = of('Complété').sort(SORTS[homeSort].fn);
    if (done.length) {
      html += `<section><div class="sec-head"><h2>Complété</h2><span class="count">${done.length}</span>${sortSelect('home', homeSort)}</div>
        <div class="grid">${done.map((g) => card(g, true)).join('')}</div></section>`;
    }
    app.innerHTML = html;
  }

  const NOTE_FILTERS = {
    '10': (g) => hasNote(g) && g.note >= 10,
    '9 et plus': (g) => hasNote(g) && g.note >= 9,
    '8 et plus': (g) => hasNote(g) && g.note >= 8,
    '7 et plus': (g) => hasNote(g) && g.note >= 7,
    '6 et moins': (g) => hasNote(g) && g.note <= 6,
    'Non noté': (g) => !hasNote(g)
  };
  const filterSelect = (name, allLabel, values, current) => `<select class="select flat" data-fsel="${name}" aria-label="${esc(allLabel)}">
    <option value="Tous">${esc(allLabel)}</option>${values.map((v) => `<option value="${esc(v)}"${v === current ? ' selected' : ''}>${esc(v)}</option>`).join('')}</select>`;

  function renderAvis() {
    const base = games.filter((g) => g.status === 'Complété' || g.status === 'Dropped');
    const genres = [...new Set(base.flatMap((g) => toList(g.genre)))].sort((a, b) => a.localeCompare(b));
    const years = [...new Set(base.filter((g) => g.end_date).map((g) => g.end_date.slice(0, 4)))].sort().reverse();
    if (avisGenre !== 'Tous' && !genres.includes(avisGenre)) avisGenre = 'Tous';
    if (avisYear !== 'Tous' && !years.includes(avisYear)) avisYear = 'Tous';
    const list = base
      .filter((g) => avisStatus === 'Tous' || g.status === avisStatus)
      .filter((g) => avisGenre === 'Tous' || toList(g.genre).includes(avisGenre))
      .filter((g) => avisYear === 'Tous' || (g.end_date || '').slice(0, 4) === avisYear)
      .filter((g) => avisNote === 'Tous' || (NOTE_FILTERS[avisNote] ? NOTE_FILTERS[avisNote](g) : true))
      .sort(SORTS[avisSort].fn);
    const chips = ['Tous', 'Complété', 'Dropped'].map((f) => chip('avis-status', f, f === avisStatus)).join('');
    app.innerHTML = `<div class="sec-head"><h2>Avis</h2><span class="count">${list.length}</span></div>
      <div class="filters">${chips}${sortSelect('avis', avisSort)}</div>
      <div class="filters">${filterSelect('genre', 'Tous les genres', genres, avisGenre)}${filterSelect('year', 'Toutes les années', years, avisYear)}${filterSelect('note', 'Toutes les notes', Object.keys(NOTE_FILTERS), avisNote)}</div>
      ${list.length ? `<div class="grid posters">${list.map(poster).join('')}</div>` : '<p class="empty">Aucun jeu ne correspond à ces filtres.</p>'}`;
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
    const add = (k, v) => { if (v !== null && v !== undefined && v !== '') rows.push(`<dt>${k}</dt><dd>${v}</dd>`); };
    const finished = g.status === 'Complété' || g.status === 'Dropped';
    add('Série', esc(seriesOf(g)));
    add('Année', esc(g.release_year));
    add('Genre', esc([...toList(g.genre), ...toList(g.subgenre)].join(' / ')));
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
    return window.marked ? window.marked.parse(t) : `<p>${esc(t)}</p>`;
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
    document.title = g.title + ' · La-Li-Lu-Le-Log';
  }

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
      if (!name) return;
      const k = norm(name);
      if (!map.has(k)) map.set(k, { name, games: [] });
      map.get(k).games.push(g);
    });
    const groups = [...map.values()].filter((x) => x.games.length >= 2)
      .sort((a, b) => b.games.length - a.games.length || a.name.localeCompare(b.name));
    if (!groups.length) { app.innerHTML = '<div class="sec-head"><h2>Séries</h2></div><p class="empty">Aucune série avec au moins 2 jeux pour l\'instant.</p>'; return; }
    app.innerHTML = `<div class="sec-head"><h2>Séries</h2><span class="count">${groups.length}</span></div>` + groups.map((gr) => {
      const gs = gr.games.slice().sort((a, b) => gameTime(a).localeCompare(gameTime(b)));
      const m = avg(gs.filter(hasNote).map((g) => g.note));
      return `<section class="series-group"><div class="series-head"><h2>${esc(gr.name)}</h2>
        <span class="meta">${gs.length} jeux${m !== null ? ` · note moyenne ${fmt1(m)}` : ''}</span></div>
        <div class="grid posters compact">${gs.map(poster).join('')}</div></section>`;
    }).join('');
  }

  /* ---------- GOTY ---------- */
  function gameByRef(ref) {
    const k = norm(ref);
    return games.find((g) => norm(g.title) === k || g.slug === ref || norm(g.slug) === k);
  }
  function renderGoty(year) {
    const set = new Set(gotyData.map((x) => String(x.annee || x.year || '')));
    games.forEach((g) => { if ((g.status === 'Complété' || g.status === 'Dropped') && g.end_date) set.add(g.end_date.slice(0, 4)); });
    const years = [...set].filter(Boolean).sort().reverse();
    if (!years.length) { app.innerHTML = '<div class="sec-head"><h2>GOTY</h2></div><p class="empty">Pas encore de top.</p>'; return; }
    if (!years.includes(year)) year = years[0];
    const entry = gotyData.find((x) => String(x.annee || x.year) === year);
    const rows = toList(entry && entry.entries).map((e) => {
      const ref = typeof e === 'string' ? e : (e.game || e.title || '');
      return { g: gameByRef(ref), ref, comment: typeof e === 'object' ? e.comment : '' };
    }).filter((r) => r.ref).slice(0, 10);
    const chips = years.map((y) => `<a class="chip${y === year ? ' on' : ''}" href="#/goty/${y}">${y}</a>`).join('');
    const items = rows.map((r, i) => {
      const g = r.g;
      const art = g && (g.cover || g.banner);
      const title = g ? g.title : r.ref;
      const meta = g ? [hasNote(g) ? `${noteText(g)} / 10` : '', toList(g.genre).join(' / '), toList(g.platform).join(', ')].filter(Boolean).join(' · ') : '';
      const inner = `<div class="goty-art">${art ? img(art, '', title) : `<div class="ph">${esc(title)}</div>`}</div>`;
      return `<li class="goty-item r${i + 1}"><div class="goty-rank">${i + 1}</div>
        ${g ? `<a href="#/jeu/${encodeURIComponent(g.slug)}">${inner}</a>` : inner}
        <div><div class="goty-title">${g ? `<a href="#/jeu/${encodeURIComponent(g.slug)}">${esc(title)}</a>` : esc(title)}</div>
        ${meta ? `<div class="goty-meta">${esc(meta)}</div>` : ''}
        ${r.comment ? `<p class="goty-comment">${esc(r.comment)}</p>` : ''}</div></li>`;
    }).join('');
    app.innerHTML = `<div class="sec-head"><h2>GOTY ${esc(year)}</h2></div>
      <div class="filters">${chips}</div>
      ${items ? `<ol class="goty">${items}</ol>` : `<p class="empty">Le top 10 ${esc(year)} n'est pas encore fait.</p>`}`;
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
  function route() {
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
      window.scrollTo(0, 0);
      return;
    }
    if (document.activeElement !== searchInput && searchInput.value) searchInput.value = '';
    if (h.startsWith('#/jeu/')) renderGame(decodeURIComponent(h.slice(6)));
    else if (h.startsWith('#/avis')) renderAvis();
    else if (h.startsWith('#/goty')) renderGoty(decodeURIComponent(h.slice(7)));
    else if (h.startsWith('#/series')) renderSeries();
    else if (h.startsWith('#/stats')) renderStats(decodeURIComponent(h.slice(8)) || 'Tous');
    else renderHome();
    window.scrollTo(0, 0);
  }

  document.addEventListener('click', (e) => {
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
    const f = e.target.closest('[data-filter]');
    if (f) {
      if (f.dataset.filter === 'avis-status') { avisStatus = f.dataset.value; renderAvis(); }
      if (f.dataset.filter === 'home-status') { homeStatus = f.dataset.value; renderHome(); }
    }
  });
  document.addEventListener('change', (e) => {
    const fs = e.target.closest('[data-fsel]');
    if (fs) {
      if (fs.dataset.fsel === 'genre') avisGenre = fs.value;
      if (fs.dataset.fsel === 'year') avisYear = fs.value;
      if (fs.dataset.fsel === 'note') avisNote = fs.value;
      renderAvis();
      return;
    }
    const sel = e.target.closest('[data-sort]');
    if (!sel) return;
    if (sel.dataset.sort === 'avis') { avisSort = sel.value; renderAvis(); }
    if (sel.dataset.sort === 'home') { homeSort = sel.value; renderHome(); }
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
        const art = g.cover || g.banner;
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
    fetch('goty.json').then((r) => (r.ok ? r.json() : [])).catch(() => [])
  ])
    .then(([data, goty]) => { games = data.filter((g) => g && g.title); gotyData = Array.isArray(goty) ? goty : []; route(); })
    .catch(() => { app.innerHTML = '<p class="empty">Impossible de charger les jeux. Vérifie que le site est bien en ligne sur GitHub Pages.</p>'; });
})();
