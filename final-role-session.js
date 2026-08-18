(() => {
  let applying = false;

  const labelFor = role => role === 'admin' ? 'Administrator' : 'Marketing';

  async function currentProfile() {
    if (typeof sb === 'undefined' || !sb.auth) return null;
    const { data: sessionData } = await sb.auth.getSession();
    const user = sessionData?.session?.user;
    if (!user) return null;
    const { data: profile, error } = await sb.from('profiles')
      .select('full_name, role, active')
      .eq('id', user.id)
      .maybeSingle();
    if (error || !profile) return null;
    return { user, profile };
  }

  async function ensureAdminPanel() {
    for (let i = 0; i < 40; i++) {
      if (document.getElementById('appShell')?.style.display !== 'none' &&
          document.getElementById('page-settings') &&
          document.body.dataset.userRole === 'admin' &&
          typeof window.__ensureUserManagement === 'function') {
        window.__ensureUserManagement();
        return true;
      }
      await new Promise(r => setTimeout(r, 250));
    }
    return false;
  }

  async function applyCurrentUser(reason) {
    if (applying) return;
    applying = true;
    try {
      const state = await currentProfile();
      if (!state) return;

      const { user, profile } = state;
      if (profile.active === false) {
        await sb.auth.signOut({ scope: 'local' });
        return;
      }

      const role = profile.role === 'admin' ? 'admin' : 'marketing';
      document.body.dataset.userRole = role;
      document.body.dataset.userName = profile.full_name || '';

      const info = document.getElementById('userInfo');
      if (info) info.textContent = 'Login: ' + user.email + ' • ' + labelFor(role) + (profile.full_name ? ' • ' + profile.full_name : '');

      const settingBtn = document.querySelector('.nav button[data-page="settings"]');
      if (settingBtn) settingBtn.style.display = role === 'admin' ? '' : 'none';

      const badge = document.getElementById('roleBadge');
      if (badge) badge.textContent = labelFor(role);

      if (role === 'admin') {
        await ensureAdminPanel();
      } else {
        document.getElementById('managedUsersPanel')?.remove();
        document.getElementById('managedUserModal')?.remove();
        if (document.getElementById('page-settings')?.classList.contains('active') && typeof window.go === 'function') {
          window.go('dashboard');
        }
      }
    } finally {
      applying = false;
    }
  }

  function bindAuth() {
    if (typeof sb === 'undefined' || !sb.auth) {
      setTimeout(bindAuth, 300);
      return;
    }
    sb.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        setTimeout(() => applyCurrentUser(event), 150);
      } else if (event === 'SIGNED_OUT') {
        document.body.dataset.userRole = '';
        document.body.dataset.userName = '';
        document.getElementById('managedUsersPanel')?.remove();
        document.getElementById('managedUserModal')?.remove();
      }
    });

    applyCurrentUser('initial');

    document.addEventListener('click', (event) => {
      if (event.target.closest('.nav button[data-page="settings"]')) {
        setTimeout(() => applyCurrentUser('settings-click'), 50);
      }
    }, true);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bindAuth);
  else bindAuth();
})();
