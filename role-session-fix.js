(() => {
  const ROLE_LABEL = { admin: 'Administrator', marketing: 'Marketing' };

  function applyProfile(profile, user) {
    const role = profile?.role === 'admin' ? 'admin' : 'marketing';
    const label = ROLE_LABEL[role];
    document.body.dataset.userRole = role;
    document.body.dataset.userName = profile?.full_name || '';

    const info = document.getElementById('userInfo');
    if (info && user?.email) {
      info.textContent = 'Login: ' + user.email + ' • ' + label + (profile?.full_name ? ' • ' + profile.full_name : '');
    }

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

    const managedPanel = document.getElementById('managedUsersPanel');
    const managedModal = document.getElementById('managedUserModal');
    if (role !== 'admin') {
      if (managedPanel) managedPanel.remove();
      if (managedModal) managedModal.remove();
      const settingsPage = document.getElementById('page-settings');
      if (settingsPage?.classList.contains('active') && typeof window.go === 'function') window.go('dashboard');
    } else if (typeof window.__ensureUserManagement === 'function') {
      window.__ensureUserManagement();
    }
  }

  async function syncCurrentUser() {
    if (typeof sb === 'undefined') return;
    const { data: sessionData } = await sb.auth.getSession();
    const user = sessionData?.session?.user;
    if (!user) return;

    const { data: profile } = await sb.from('profiles').select('full_name, role, active').eq('id', user.id).maybeSingle();
    if (!profile) return;

    if (profile.active === false) {
      await sb.auth.signOut({ scope: 'local' });
      return;
    }

    applyProfile(profile, user);
  }

  function clearRoleUi() {
    const badge = document.getElementById('roleBadge');
    if (badge) badge.remove();
    const settingBtn = document.querySelector('.nav button[data-page="settings"]');
    if (settingBtn) settingBtn.style.display = '';
    document.body.dataset.userRole = '';
    document.body.dataset.userName = '';
  }

  async function init() {
    if (typeof sb === 'undefined') return;
    await syncCurrentUser();
    sb.auth.onAuthStateChange(async (event) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        setTimeout(syncCurrentUser, 0);
      } else if (event === 'SIGNED_OUT') {
        clearRoleUi();
      }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
