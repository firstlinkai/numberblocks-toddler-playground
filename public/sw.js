/* Numberblocks Toddler Playground - Service Worker
 * Strategy: pre-cache core shell at install + runtime cache-first for
 * every same-origin GET (hashed Vite assets get cached on first load),
 * giving full offline playback after the first visit.
 */
/* Pre-cached phrase audio (natural TTS, generated at build time).
 * Missing files are tolerated - SoundManager falls back to speechSynthesis. */
const PHRASES = [
  ...Array.from({ length: 50 }, (_, i) => 'number-' + (i + 1)),
  ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map((ch) => 'letter-' + ch),
  'feed-1', 'feed-2', 'feed-3', 'feed-4', 'feed-5',
  'yummy', 'hooray', 'made-ten', 'made-20', 'made-30', 'made-40', 'made-fifty', 'hello', 'rest',
  ...['eyes', 'nose', 'mouth', 'ear', 'hat', 'wheel', 'window', 'door', 'roof',
      'apple', 'banana', 'pear', 'arm'].map((p) => 'part-' + p)
];
const AUDIO_ASSETS = PHRASES.map((id) => `/audio/${id}.wav`);

const CACHE_NAME = 'nbp-v13';
const CORE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  ...AUDIO_ASSETS
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => Promise.allSettled(CORE_ASSETS.map((url) => cache.add(url))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Navigation requests: serve cached shell when offline
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put('/', copy));
          return res;
        })
        .catch(() => caches.match('/').then((r) => r || caches.match('/index.html')))
    );
    return;
  }

  // Everything else: cache-first, then network + cache fill
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req)
        .then((res) => {
          if (res && res.ok && res.type === 'basic') {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
    })
  );
});
