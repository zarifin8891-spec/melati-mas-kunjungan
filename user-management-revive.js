(() => {
  function isAdmin() {
    return document.body?.dataset?.userRole === 'admin';
  }

  function ensure() {
    if (!isAdmin()) return;
    const settingsPage = document.getElementById('page-settings');
    if (!settingsPage) return;
    if (document.getElementById('managedUsersPanel')) return;
    const loader = window.__ensureUserManagement;
    if (typeof loader === 'function') {
      try { loader(); } catch (e) { console.error('User management revive error:', e); }
    }
  }

  function scheduleEnsure(durationMs = 30000) {
    const started = Date.now();
    const timer = setInterval(() => {
      ensure();
      if (document.getElementById('managedUsersPanel') || Date.now() - started >= durationMs) {
        clearInterval(timer);
      }
    }, 250);
    ensure();
  }

  function bind() {
    if (document.documentElement.dataset.userManagementReviveBound === 'true') return;
    document.documentElement.dataset.userManagementReviveBound = 'true';

    document.addEventListener('click', (event) => {
      const button = event.target.closest('.nav button[data-page="settings"]');
      if (!button) return;
      scheduleEnsure(10000);
    }, true);

    // Role is assigned asynchronously after login. Observe the actual role
    // attribute so Admin gets User Management immediately without needing
    // to change browser tabs or refocus the window.
    const roleObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'attributes' && mutation.attributeName === 'data-user-role') {
          scheduleEnsure(15000);
          break;
        }
      }
    });
    roleObserver.observe(document.body, { attributes: true, attributeFilter: ['data-user-role'] });

    const pageObserver = new MutationObserver(() => {
      if (isAdmin()) ensure();
    });
    pageObserver.observe(document.body, { childList: true, subtree: true });

    window.addEventListener('focus', () => scheduleEnsure(10000));
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) scheduleEnsure(10000);
    });

    scheduleEnsure(30000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind);
  else bind();
})();
