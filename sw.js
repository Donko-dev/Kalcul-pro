/* ============================================================
   Kalcul — Service Worker
   Rôle unique : garantir que l'application se recharge correctement
   même hors connexion, y compris après une actualisation (F5) ou
   une fermeture complète du navigateur.

   Stratégie : "stale-while-revalidate" sur les ressources de même
   origine — la page enregistrée en cache est servie immédiatement
   (donc instantanément disponible hors connexion), pendant qu'une
   tentative de mise à jour en arrière-plan se fait si une connexion
   est disponible. Les appels vers des domaines tiers (FedaPay, taux
   de change) ne sont jamais interceptés : ils suivent leur propre
   logique réseau normale, avec échec silencieux déjà géré côté app.

   Pour publier une mise à jour de Kalcul plus tard : changer
   CACHE_NAME (ex. "kalcul-cache-v2") force le renouvellement du
   cache chez tous les utilisateurs déjà installés.
   ============================================================ */

const CACHE_NAME = "kalcul-cache-v1";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;

  // On ne met en cache que les requêtes GET de notre propre origine.
  // Tout le reste (FedaPay, API de taux de change, etc.) suit son
  // comportement réseau natif, sans interception.
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.open(CACHE_NAME).then((cache) =>
      cache.match(req).then((cached) => {
        const networkFetch = fetch(req)
          .then((res) => {
            if (res && res.ok) cache.put(req, res.clone());
            return res;
          })
          .catch(() => cached); // hors ligne ou échec réseau : retombe sur le cache

        // Sert le cache immédiatement s'il existe (rapide + fiable hors ligne) ;
        // sinon attend la réponse réseau (premier chargement).
        return cached || networkFetch;
      })
    )
  );
});
