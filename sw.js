const CACHE = 'sm-v2';
const PRECACHE_URLS = ['/', '/dashboard.html', '/manifest.json'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(PRECACHE_URLS)));
  self.skipWaiting();
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', e => {
  // GAS/Groq/Drive 같은 외부 API 호출(polling 포함)은 캐시하지 않고 그대로 네트워크로
  // 흘려보낸다. 이전 버전은 모든 GET을 무차별 캐싱해서, 캐시버스팅 쿼리스트링이 붙은
  // 폴링 요청(?t=timestamp)마다 새 캐시 엔트리가 쌓여 캐시가 무한정 커지는 문제가 있었다.
  if (e.request.method !== 'GET') return;
  if (new URL(e.request.url).origin !== self.location.origin) return;
  e.respondWith(
    fetch(e.request).then(r => {
      var cl = r.clone();
      caches.open(CACHE).then(c => c.put(e.request, cl));
      return r;
    }).catch(() => caches.match(e.request))
  );
});
