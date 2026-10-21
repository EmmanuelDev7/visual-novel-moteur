/* ============================================================
   SERVICE WORKER — Le Lapin dans ma Tête
   Stratégie : Cache First (offline complet)
   ============================================================
   VERSION : incrémenter à chaque déploiement pour forcer
   la mise à jour du cache sur les appareils des joueurs.
   ============================================================ */

const CACHE_NAME = 'lapin-v1';

/* ── FICHIERS À METTRE EN CACHE AU 1er LANCEMENT ──────────────
   Ajoute ici tout nouveau fichier ajouté au projet
   (nouveaux chapitres, nouvelles images, musiques…).
   ─────────────────────────────────────────────────────────── */
const ASSETS = [
  /* Core */
  './',
  './index.html',
  './style.css',
  './manifest.json',

  /* Scripts moteur */
  './scenario/intro.js',
  './scenario/scenario.js',
  './scenario/engine.js',

  /* ── Images ──────────────────────────────────────────────
     Liste TOUS tes fichiers img/ ici.
     Si tu ajoutes une image plus tard, ajoute-la dans cette
     liste ET incrémente CACHE_NAME (ex: 'lapin-v2').
  ─────────────────────────────────────────────────────── */
  './img/cover1.png',
  './img/image2.png',
  './img/lapin-malicieux2.png',
  './img/david-stoique.png',
  './img/david-tete-basse2.png',

  /* ── Audio (décommenter si tu as des fichiers audio) ─── */
  './audio/theme.mp3',
  './audio/sfx_click.mp3',
  
];

/* ── INSTALLATION : mise en cache de tous les assets ──────── */
self.addEventListener('install', event => {
  console.log('[SW] Installation — cache:', CACHE_NAME);

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Mise en cache des assets…');
        /* addAll échoue si UN fichier manque.
           On utilise une boucle pour tolérer les erreurs
           sur les fichiers optionnels (ex: audio absent). */
        return Promise.allSettled(
          ASSETS.map(url =>
            cache.add(url).catch(err =>
              console.warn('[SW] Impossible de cacher :', url, err.message)
            )
          )
        );
      })
      .then(() => {
        console.log('[SW] Cache prêt — activation immédiate');
        /* Prend le contrôle immédiatement sans attendre
           la fermeture de l'ancien SW */
        return self.skipWaiting();
      })
  );
});

/* ── ACTIVATION : nettoyage des anciens caches ────────────── */
self.addEventListener('activate', event => {
  console.log('[SW] Activation — nettoyage des anciens caches');

  event.waitUntil(
    caches.keys()
      .then(keys =>
        Promise.all(
          keys
            .filter(key => key !== CACHE_NAME)
            .map(key => {
              console.log('[SW] Suppression ancien cache :', key);
              return caches.delete(key);
            })
        )
      )
      .then(() => self.clients.claim())
  );
});

/* ── FETCH : stratégie Cache First ───────────────────────────
   1. On cherche dans le cache.
   2. Si trouvé → on sert le cache (offline OK).
   3. Si absent → on tente le réseau et on met à jour le cache.
   4. Si réseau impossible → on sert une réponse de fallback.
─────────────────────────────────────────────────────────── */
self.addEventListener('fetch', event => {
  /* Ignorer les requêtes non-GET et les requêtes cross-origin
     (ex : Google Fonts si jamais elles sont ajoutées plus tard) */
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  /* Google Fonts : network first, sans fallback offline
     (les polices sont jolies mais pas critiques) */
  if (url.hostname === 'fonts.googleapis.com' ||
      url.hostname === 'fonts.gstatic.com') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  /* Tous les autres assets : Cache First */
  event.respondWith(
    caches.match(event.request)
      .then(cached => {
        if (cached) {
          /* Cache hit → servi instantanément */
          return cached;
        }

        /* Cache miss → on va chercher sur le réseau */
        return fetch(event.request)
          .then(response => {
            /* On ne cache que les réponses valides */
            if (!response || response.status !== 200 || response.type === 'error') {
              return response;
            }
            const clone = response.clone();
            caches.open(CACHE_NAME)
              .then(cache => cache.put(event.request, clone));
            return response;
          })
          .catch(() => {
            /* Réseau impossible + pas de cache :
               fallback HTML minimal pour éviter un écran blanc */
            if (event.request.headers.get('accept')?.includes('text/html')) {
              return new Response(
                `<!DOCTYPE html>
                <html lang="fr">
                <head>
                  <meta charset="UTF-8">
                  <meta name="viewport" content="width=device-width,initial-scale=1">
                  <title>Hors ligne</title>
                  <style>
                    body { background:#0a0a12; color:#e8e0f5;
                           font-family:serif; display:flex;
                           align-items:center; justify-content:center;
                           height:100vh; margin:0; text-align:center; }
                    h1 { font-size:1.4rem; color:#b49fff; margin-bottom:12px; }
                    p  { font-size:.9rem; color:#9890b0; }
                  </style>
                </head>
                <body>
                  <div>
                    <h1>Hors ligne</h1>
                    <p>Le jeu n'a pas encore été mis en cache.<br>
                       Lance-le une première fois avec une connexion.</p>
                  </div>
                </body>
                </html>`,
                { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
              );
            }
          });
      })
  );
});

/* ── MESSAGE : forcer la mise à jour depuis l'interface ───── */
self.addEventListener('message', event => {
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
  }
});
