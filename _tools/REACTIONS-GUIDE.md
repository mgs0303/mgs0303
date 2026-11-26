# Réactions emoji sous les avis

Le site affiche une rangée d'emoji (❤️ 🔥 😂 😮 😢) sous chaque avis écrit.
Les totaux sont gardés par un petit service gratuit (Cloudflare Worker + KV) : `_tools/reactions-worker.js`.
Il ne garde que des totaux par jeu, aucune information sur les visiteurs.

## Activer
1. Créer le service sur Cloudflare (voir les étapes données dans la conversation) et copier son adresse
   (du type `https://lll-reactions.xxxx.workers.dev`).
2. Dans `assets/app.js`, mettre cette adresse dans `const REACTIONS_URL = '';`.
3. Tant que cette adresse est vide, rien ne s'affiche sur le site.

## Changer les emoji
La liste est à deux endroits, qui doivent rester identiques :
`REACTION_EMOJIS` dans `assets/app.js` et `EMOJIS` dans `_tools/reactions-worker.js`
(puis recopier le Worker dans Cloudflare).

## Limites
- Un seul choix par navigateur (mémorisé dans le navigateur) : quelqu'un de motivé peut gonfler un compteur.
- Le plan gratuit de Cloudflare KV permet 1 000 écritures par jour, largement assez ici.
