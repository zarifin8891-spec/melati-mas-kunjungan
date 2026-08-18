(() => {
  function isAdmin() {
    return document.body?.dataset?.userRole === 'admin';
  }

  function ensure() {
    if (!isAdmin()) return;
    const settingsPage = document.getElementById('page-settings');
    if (!settingsPage) return;
    if (document.getElementById('managedUsersPanel')) return;
    if (typeof window.__ensureUserManagement === 'function') {
      try { window.__ensureUserManagement(); } catch (e) { console.error('User management revive error:', e); }
    }
  }

  function scheduleEnsure() {
    let attempts = 0;
    const timer = setInterval(() => {
      attempts += 1;
      ensure();
      if (document.getElementById('managedUsersPanel') || attempts >= 30) clearInterval(timer);
    }, 500);
  }

  function bind() {
    document.addEventListener('click', (event) => {
      const button = event.target.closest('.nav button[data-page="settings"]');
      if (!button) return;
      setTimeout(scheduleEnsure, 0);
      setTimeout(ensure, 800);
    }, true);
    window.addEventListener('focus', scheduleEnsure);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) scheduleEnsure();
    });
    scheduleEnsure();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind);
  else bind();
})();
