(() => {
  function safeGo(page) {
    try {
      const target = document.getElementById('page-' + page);
      if (!target) return;

      document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
      target.classList.add('active');

      document.querySelectorAll('.nav button').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.page === page);
      });

      const title = document.getElementById('pageTitle');
      if (title) {
        title.textContent = page === 'dashboard' ? 'Dashboard' : page === 'kunjungan' ? 'Data Kunjungan' : 'Setting';
      }

      if (page === 'dashboard' && typeof window.renderDashboard === 'function') window.renderDashboard();
      if (page === 'kunjungan' && typeof window.renderList === 'function') window.renderList();
      if (page === 'settings' && typeof window.renderSettings === 'function') window.renderSettings();

      if (typeof window.toggleMobileMenu === 'function') window.toggleMobileMenu(false);
      window.__navFixLastPage = page;
    } catch (error) {
      console.error('Navigation error:', error);
    }
  }

  async function safeLogout() {
    try {
      const result = await sb.auth.signOut({ scope: 'local' });
      if (result?.error) throw result.error;
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      const authScreen = document.getElementById('authScreen');
      const appShell = document.getElementById('appShell');
      if (appShell) appShell.style.display = 'none';
      if (authScreen) authScreen.style.display = 'flex';
      const email = document.getElementById('authEmail');
      const password = document.getElementById('authPassword');
      if (email) email.value = '';
      if (password) password.value = '';
      const msg = document.getElementById('authMsg');
      if (msg) {
        msg.style.display = 'none';
        msg.textContent = '';
      }
      if (typeof window.toggleMobileMenu === 'function') window.toggleMobileMenu(false);
    }
  }

  window.go = safeGo;
  window.logout = safeLogout;

  function bind() {
    if (document.documentElement.dataset.navigationFix === 'true') return;
    document.documentElement.dataset.navigationFix = 'true';

    document.addEventListener('click', event => {
      const navButton = event.target.closest('.nav button[data-page]');
      if (navButton) {
        event.preventDefault();
        event.stopImmediatePropagation();
        safeGo(navButton.dataset.page);
        return;
      }

      const logoutButton = event.target.closest('button[onclick="logout()"]');
      if (logoutButton) {
        event.preventDefault();
        event.stopImmediatePropagation();
        safeLogout();
      }
    }, true);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind);
  else bind();
})();
