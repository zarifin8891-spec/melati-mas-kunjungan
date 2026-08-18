(() => {
  function roleLabel(role) {
    return role === 'admin' ? 'Administrator' : 'Marketing';
  }

  async function loadRole() {
    if (typeof sb === 'undefined') return;
    const { data: sessionData } = await sb.auth.getSession();
    const user = sessionData?.session?.user;
    if (!user) return;

    const { data: profile, error } = await sb
      .from('profiles')
      .select('full_name, role, active')
      .eq('id', user.id)
      .single();

    if (error || !profile) return;

    if (profile.active === false) {
      window.msg?.('Akun ini sedang dinonaktifkan. Hubungi Administrator.', true);
      await sb.auth.signOut();
      return;
    }

    document.body.dataset.userRole = profile.role || 'marketing';
    document.body.dataset.userName = profile.full_name || '';

    const info = document.getElementById('userInfo');
    if (info) {
      const name = (profile.full_name || '').trim();
      const label = roleLabel(profile.role);
      info.textContent = 'Login: ' + user.email + ' • ' + label + (name ? ' • ' + name : '');
    }

    const settingBtn = document.querySelector('.nav button[data-page="settings"]');
    if (settingBtn) settingBtn.style.display = profile.role === 'admin' ? '' : 'none';

    const brand = document.querySelector('.sidebar .brand');
    if (brand && !document.getElementById('roleBadge')) {
      const badge = document.createElement('span');
      badge.id = 'roleBadge';
      badge.textContent = roleLabel(profile.role);
      badge.style.cssText = 'display:inline-block;margin-top:5px;padding:3px 7px;border-radius:999px;background:rgba(255,255,255,.12);color:#d9eee9;font-size:10px;font-weight:700';
      const text = brand.querySelector('div');
      if (text) text.appendChild(badge);
    }
  }

  function waitForApp() {
    let attempts = 0;
    const timer = setInterval(async () => {
      attempts += 1;
      const shell = document.getElementById('appShell');
      if (shell && shell.style.display !== 'none') {
        clearInterval(timer);
        await loadRole();
      }
      if (attempts >= 30) clearInterval(timer);
    }, 500);
  }

  document.addEventListener('DOMContentLoaded', waitForApp);
  window.addEventListener('load', waitForApp);
})();
