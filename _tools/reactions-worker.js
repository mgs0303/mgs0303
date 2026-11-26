// Service de réactions du site La-Li-Lu-Le-Log (Cloudflare Worker + KV).
// Il garde seulement des totaux par jeu et par emoji, par exemple { "❤️": 12, "🔥": 3 }.
// Aucune information sur les visiteurs n'est enregistrée.
//
// Réglages (dans Cloudflare) :
//   - un espace KV relié au Worker sous le nom REACTIONS
//   - (facultatif) une variable ALLOWED_ORIGIN, par défaut https://mgs0303.github.io
//
// Adresses :
//   GET  /r/<jeu>  -> { "counts": { ... } }
//   POST /r/<jeu>  avec { "add": "❤️" } et/ou { "remove": "🔥" } -> { "counts": { ... } }

const EMOJIS = ['❤️', '🔥', '😂', '😮', '😢']; // doit être la même liste que sur le site
const SLUG = /^[a-z0-9][a-z0-9-]{0,90}$/;

export default {
  async fetch(request, env) {
    const origin = env.ALLOWED_ORIGIN || 'https://mgs0303.github.io';
    const headers = {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Vary': 'Origin',
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    };
    const out = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers });

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });

    const m = new URL(request.url).pathname.match(/^\/r\/([^/]+)$/);
    const slug = m ? decodeURIComponent(m[1]) : '';
    if (!SLUG.test(slug)) return out({ error: 'jeu inconnu' }, 404);
    const key = 'r:' + slug;

    const read = async () => {
      let data = {};
      try { data = JSON.parse((await env.REACTIONS.get(key)) || '{}'); } catch (e) { data = {}; }
      const counts = {};
      EMOJIS.forEach((e) => { const n = Number(data[e]); if (n > 0) counts[e] = Math.floor(n); });
      return counts;
    };

    if (request.method === 'GET') return out({ counts: await read() });

    if (request.method === 'POST') {
      const o = request.headers.get('Origin');
      if (origin !== '*' && o && o !== origin) return out({ error: 'origine refusée' }, 403);
      let body;
      try { body = await request.json(); } catch (e) { return out({ error: 'requête invalide' }, 400); }
      const add = body && body.add, remove = body && body.remove;
      if ((add && !EMOJIS.includes(add)) || (remove && !EMOJIS.includes(remove))) return out({ error: 'emoji refusé' }, 400);
      if (!add && !remove) return out({ error: 'rien à faire' }, 400);
      const counts = await read();
      if (remove && counts[remove] > 0) counts[remove] -= 1;
      if (add) counts[add] = (counts[add] || 0) + 1;
      Object.keys(counts).forEach((e) => { if (!(counts[e] > 0)) delete counts[e]; });
      await env.REACTIONS.put(key, JSON.stringify(counts));
      return out({ counts });
    }

    return out({ error: 'méthode refusée' }, 405);
  },
};
