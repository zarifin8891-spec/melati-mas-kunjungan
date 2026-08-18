(() => {
  const ROLE_LABEL = { admin: 'Administrator', marketing: 'Marketing' };

  function removeManagedUI() {
    document.getElementById('managedUsersPanel')?.remove();
    document.getElementById('managedUserModal')?.remove();
  }

  async function refreshRoleUI() {
    if (typeof sb === 'undefined') return;
    const { data: sessionData } = await sb.auth.getSession();
    const user = sessionData?.session?.user;
    if (!user) return;

    const { data: profile, error } = await sb
      .from('profiles')
      .select('full_name, role, active')
      .eq('id', user.id)
      .maybeSingle();
    if (error || !profile) return;

    const role = profile.role === 'admin' ? 'admin' : 'marketing';
    const label = ROLE_LABEL[role];
    document.body.dataset.userRole = role;
    document.body.dataset.userName = profile.full_name || '';

    const info = document.getElementById('userInfo');
    if (info) info.textContent = 'Login: ' + user.email + ' • ' + label + (profile.full_name ? ' • ' + profile.full_name : '');

    const settingBtn = document.querySelector('.nav button[data-page="settings"]');
    if (settingBtn) settingBtn.style.display = role === 'admin' ? '' : 'none';

    const brandText = document.querySelector('.sidebar .brand > div');
    if (brandText) {
      let badge = document.getElementById('roleBadge');
      if (!badge) {
        badge = document.createElement('span');
        badge.id = 'roleBadge';
        badge.style.cssText = 'display:inline-block;margin-top:5px;padding:3px 7px;border-radius:999px;background:rgba(255,255,255,.12);color:#d9eee9;font-size:10px;font-weight:700';
        brandText.appendChild(badge);
      }
      badge.textContent = label;
    }

    if (profile.active === false) {
      removeManagedUI();
      await sb.auth.signOut({ scope: 'local' });
      return;
    }

    if (role === 'admin') {
      // Role-enhancements owns the panel creation. Call it after the app shell
      // is visible so it can find #page-settings on every new login.
      if (typeof window.__ensureUserManagement === 'function') {
        window.__ensureUserManagement();
      }
      setTimeout(() => {
        if (typeof window.__ensureUserManagement === 'function') window.__ensureUserManagement();
      }, 150);
    } else {
      removeManagedUI();
      const settingsPage = document.getElementById('page-settings');
      if (settingsPage?.classList.contains('active') && typeof window.go === 'function') window.go('dashboard');
    }
  }

  function bind() {
    if (document.documentElement.dataset.roleLifecycleFix === 'true') return;
    document.documentElement.dataset.roleLifecycleFix = 'true';

    if (typeof sb !== 'undefined') {
      sb.auth.onAuthStateChange((event) => {
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
          setTimeout(refreshRoleUI, 50);
        } else if (event === 'SIGNED_OUT') {
          removeManagedUI();
          const badge = document.getElementById('roleBadge');
          if (badge) badge.remove();
        }
      });
    }

    if (document.getElementById('appShell')?.style.display !== 'none') {
      setTimeout(refreshRoleUI, 100);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind);
  else bind();
})();
