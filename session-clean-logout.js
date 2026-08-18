(() => {
  let loggingOut = false;

  function resetClientUi() {
    try {
      document.getElementById('appShell')?.style.setProperty('display', 'none');
      const auth = document.getElementById('authScreen');
      if (auth) auth.style.display = 'flex';
      const email = document.getElementById('authEmail');
      const password = document.getElementById('authPassword');
      if (email) email.value = '';
      if (password) password.value = '';
      const msg = document.getElementById('authMsg');
      if (msg) msg.style.display = 'none';
      document.querySelector('.sidebar')?.classList.remove('open');
      document.getElementById('mobileOverlay')?.classList.remove('show');
      document.getElementById('managedUsersPanel')?.remove();
      document.getElementById('managedUserModal')?.remove();
      document.getElementById('roleBadge')?.remove();
      document.body.dataset.userRole = '';
      document.body.dataset.userName = '';
      for (const key of Object.keys(sessionStorage)) {
        if (key.startsWith('melati-')) sessionStorage.removeItem(key);
      }
    } catch (e) {
      console.warn('Logout UI cleanup failed', e);
    }
  }

  async function hardLogout() {
    if (loggingOut) return;
    loggingOut = true;
    try {
      if (typeof sb !== 'undefined' && sb?.auth) {
        await sb.auth.signOut({ scope: 'local' });
      }
    } catch (e) {
      console.warn('Supabase signOut failed; continuing local logout', e);
    } finally {
      resetClientUi();
      const freshUrl = window.location.pathname + '?fresh=' + Date.now();
      window.location.replace(freshUrl);
    }
  }

  function bind() {
    if (document.documentElement.dataset.sessionCleanLogout === 'true') return;
    document.documentElement.dataset.sessionCleanLogout = 'true';

    document.addEventListener('click', event => {
      const btn = event.target.closest('button[onclick*="logout"], .topbar button.secondary');
      if (!btn) return;
      const text = (btn.textContent || '').trim().toLowerCase();
      if (!text.includes('keluar')) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      hardLogout();
    }, true);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind);
  else bind();
})();
