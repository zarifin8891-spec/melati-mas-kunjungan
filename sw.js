const CACHE_NAME = 'melati-mas-kunjungan-v23';
const APP_SHELL = ['./', './index.html', './manifest.json', './icon-192.svg', './icon-512.svg', './auth-enhancements.js', './role-enhancements.js', './login-stability.js', './navigation-fix.js', './role-session-fix.js', './user-management-revive.js', './session-clean-logout.js', './master-data-admin.js', './inactive-account-guard.js', './visit-save-stability.js', './delete-guard.js', './pie3d-dashboard-v23.js'];
const SCRIPTS = ['auth-enhancements.js','role-enhancements.js','login-stability.js','navigation-fix.js','role-session-fix.js','user-management-revive.js','session-clean-logout.js','master-data-admin.js','inactive-account-guard.js','visit-save-stability.js','delete-guard.js','pie3d-dashboard-v23.js'];
const ENHANCEMENT = SCRIPTS.map(name => `<script src="./${name}" defer></script>`).join('');

function enhanceHtml(html) {
  let out = html;
  for (const name of SCRIPTS) {
    const tag = `<script src="./${name}" defer></script>`;
    if (!out.includes(`src="./${name}"`)) out = out.replace('</head>', tag + '</head>');
  }
  return out;
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

  if (request.url.endsWith('/sw.js')) {
    event.respondWith(fetch(request, {cache: 'no-store'}));
    return;
  }

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
