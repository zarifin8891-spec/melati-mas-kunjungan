const CACHE_NAME = 'melati-mas-kunjungan-v4';
const APP_SHELL = ['./', './index.html', './manifest.json', './icon-192.svg', './icon-512.svg', './auth-enhancements.js'];
const ENHANCEMENT = '<script src="./auth-enhancements.js" defer></script>';

function enhanceHtml(html) {
  if (html.includes('auth-enhancements.js')) return html;
  return html.replace('</head>', ENHANCEMENT + '</head>');
}

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  if (request.mode === 'navigate' || request.url.endsWith('/index.html')) {
    event.respondWith(
      fetch(request).then(async response => {
        const html = await response.text();
        const enhanced = enhanceHtml(html);
        const headers = new Headers(response.headers);
        headers.delete('content-length');
        const out = new Response(enhanced, {
          status: response.status,
          statusText: response.statusText,
          headers
        });
        const cache = await caches.open(CACHE_NAME);
        await cache.put(request, out.clone());
        return out;
      }).catch(() => caches.match(request).then(cached => cached || caches.match('./index.html')))
    );
    return;
  }

  event.respondWith(
    fetch(request).then(response => {
      const copy = response.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
      return response;
    }).catch(() => caches.match(request).then(cached => cached || caches.match('./index.html')))
  );
});