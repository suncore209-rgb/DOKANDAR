const CACHE = 'dokandar-v1';
const STATIC = ['/', '/index.html', '/manifest.json', '/icon-192.png', '/icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(STATIC)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ).then(() => self.clients.claim()));
});

// Offline queue for API writes
const Q_KEY = 'dokandar-offline-queue';

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  // API calls — network first, queue if offline
  if (url.pathname.startsWith('/api/')) {
    if (e.request.method !== 'GET') {
      e.respondWith(
        fetch(e.request.clone()).catch(async () => {
          // Queue the failed write
          const body = await e.request.clone().text().catch(() => '{}');
          const queue = JSON.parse(await getStore(Q_KEY) || '[]');
          queue.push({ url: e.request.url, method: e.request.method, body, ts: Date.now() });
          await setStore(Q_KEY, JSON.stringify(queue));
          return new Response(JSON.stringify({ ok: true, offline: true }), {
            headers: { 'Content-Type': 'application/json' }
          });
        })
      );
    } else {
      e.respondWith(fetch(e.request).catch(() =>
        new Response(JSON.stringify({ ok: false, offline: true, error: 'অফলাইন' }), {
          headers: { 'Content-Type': 'application/json' }
        })
      ));
    }
    return;
  }
  // Static assets — cache first
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request).then(res => {
      const clone = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, clone));
      return res;
    }))
  );
});

// Sync queued writes when back online
self.addEventListener('sync', e => {
  if (e.tag === 'dokandar-sync') e.waitUntil(flushQueue());
});

self.addEventListener('message', e => {
  if (e.data === 'SYNC_NOW') flushQueue().then(() =>
    self.clients.matchAll().then(cls => cls.forEach(c => c.postMessage('SYNC_DONE')))
  );
});

async function flushQueue() {
  const raw = await getStore(Q_KEY);
  if (!raw) return;
  const queue = JSON.parse(raw);
  const failed = [];
  for (const item of queue) {
    try {
      await fetch(item.url, { method: item.method, headers: { 'Content-Type': 'application/json' }, body: item.body });
    } catch { failed.push(item); }
  }
  await setStore(Q_KEY, JSON.stringify(failed));
}

function getStore(k) {
  return new Promise(res => {
    const req = indexedDB.open('dkd-sw', 1);
    req.onupgradeneeded = e => e.target.result.createObjectStore('kv');
    req.onsuccess = e => { const r = e.target.result.transaction('kv','readonly').objectStore('kv').get(k); r.onsuccess = () => res(r.result); r.onerror = () => res(null); };
    req.onerror = () => res(null);
  });
}
function setStore(k, v) {
  return new Promise(res => {
    const req = indexedDB.open('dkd-sw', 1);
    req.onupgradeneeded = e => e.target.result.createObjectStore('kv');
    req.onsuccess = e => { const r = e.target.result.transaction('kv','readwrite').objectStore('kv').put(v, k); r.onsuccess = () => res(); r.onerror = () => res(); };
    req.onerror = () => res();
  });
}
