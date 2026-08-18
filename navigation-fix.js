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

  window.go = safeGo;

  function bind() {
    if (document.documentElement.dataset.navigationFix === 'true') return;
    document.documentElement.dataset.navigationFix = 'true';

    document.addEventListener('click', event => {
      const button = event.target.closest('.nav button[data-page]');
      if (!button) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      safeGo(button.dataset.page);
    }, true);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind);
  else bind();
})();
