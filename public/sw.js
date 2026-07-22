const CACHE='frame-v0.19.0-paper-handoff';
const ASSETS=['./paper-handoff-v019.js','./vantage-watch-sync-v015.js','./frame-action-queue-v016.js','./frame-market-split-v017.js','./frame-mobile-fix-v018.js','./','./index.html','./manifest.json','./icon-v010-192.png','./icon-v010-512.png','./icon-v010-maskable-192.png','./icon-v010-maskable-512.png','./apple-touch-icon-v010.png'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{if(e.request.method!=='GET'||new URL(e.request.url).pathname.startsWith('/api/'))return;e.respondWith(fetch(e.request).then(r=>{const c=r.clone();caches.open(CACHE).then(x=>x.put(e.request,c));return r}).catch(()=>caches.match(e.request))) });
