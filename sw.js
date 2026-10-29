const CACHE_NAME='melati-mas-kunjungan-v25-crm1';
const APP_SHELL=['./','./index.html','./manifest.json','./icon-192.svg','./icon-512.svg','./dashboard-kavio-bright.css','./crm-v2.css','./crm-v2.js','./auth-enhancements.js','./role-enhancements.js','./login-stability.js','./navigation-fix.js','./role-session-fix.js','./user-management-revive.js','./session-clean-logout.js','./master-data-admin.js','./inactive-account-guard.js','./visit-save-stability.js','./delete-guard.js','./pie3d-dashboard-v23.js'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE_NAME).then(c=>c.addAll(APP_SHELL)));self.skipWaiting();});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('melati-mas-kunjungan-')&&k!==CACHE_NAME).map(k=>caches.delete(k)))));self.clients.claim();});
self.addEventListener('fetch',event=>{
 const r=event.request,u=new URL(r.url);
 // Never cache authenticated API responses or third-party requests.
 if(r.method!=='GET'||u.origin!==self.location.origin||u.pathname.endsWith('/sw.js'))return;
 const isShell=r.mode==='navigate'||APP_SHELL.some(p=>p!=='./'&&new URL(p,self.registration.scope).pathname===u.pathname);
 if(!isShell)return;
 event.respondWith(fetch(r).then(response=>{if(response.ok){const copy=response.clone();caches.open(CACHE_NAME).then(c=>c.put(r,copy));}return response;}).catch(async()=>{const cached=await caches.match(r);if(cached)return cached;if(r.mode==='navigate')return (await caches.match('./index.html'))||Response.error();return Response.error();}));
});
