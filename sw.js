/*
 * Offline play. The game is a fixed set of small files with no build step,
 * so the strategy is simple: precache everything on install, then serve
 * network-first — a fresh deploy always wins while online, and the cache
 * only speaks up when the network cannot.
 */
const CACHE = 'tata-v1';

const CORE = [
  './',
  'index.html',
  'manifest.webmanifest',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'src/style.css',
  'src/main.js',
  'src/art/palette.js',
  'src/art/pixel.js',
  'src/art/sprites.js',
  'src/art/tiles.js',
  'src/data/enemies.js',
  'src/data/interrogations.js',
  'src/data/items.js',
  'src/data/maps.js',
  'src/data/quests.js',
  'src/data/skills.js',
  'src/data/talks.js',
  'src/data/weapons.js',
  'src/engine/audio.js',
  'src/engine/fx.js',
  'src/engine/input.js',
  'src/engine/ui.js',
  'src/game/battle.js',
  'src/game/cutscene.js',
  'src/game/dialogue.js',
  'src/game/interrogation.js',
  'src/game/notebook.js',
  'src/game/rift.js',
  'src/game/scripts.js',
  'src/game/shop.js',
  'src/game/state.js',
  'src/game/talk.js',
  'src/game/world.js',
  'src/gfx/anim.js',
  'src/gfx/battle3d.js',
  'src/gfx/env.js',
  'src/gfx/field.js',
  'src/gfx/gl.js',
  'src/gfx/index.js',
  'src/gfx/math.js',
  'src/gfx/mesh.js',
  'src/gfx/models.js',
  'src/gfx/shaders.js',
  'src/gfx/worldview.js',
];

self.addEventListener('install', (ev) => {
  ev.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (ev) => {
  ev.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (ev) => {
  const url = new URL(ev.request.url);
  if (ev.request.method !== 'GET' || url.origin !== location.origin) return;
  ev.respondWith(
    fetch(ev.request)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(ev.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(ev.request, { ignoreSearch: true })
        .then((hit) => hit || caches.match('index.html'))),
  );
});
