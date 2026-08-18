(() => {
  let checking = false;
  let lastUserId = null;

  async function enforce() {
    if (checking || typeof sb === 'undefined') return;
    checking = true;
    try {
      const { data: sessionData } = await sb.auth.getSession();
      const session = sessionData?.session;
      const user = session?.user;
      if (!user) {
        lastUserId = null;
        return;
      }

      if (lastUserId === user.id && document.body.dataset.accountChecked === 'true') return;

      const { data: profile, error } = await sb
        .from('profiles')
        .select('role, active, full_name')
        .eq('id', user.id)
        .maybeSingle();

      if (error) throw error;

      if (!profile || profile.active === false) {
        lastUserId = null;
        document.body.dataset.accountChecked = 'false';
        document.getElementById('appShell')?.style.setProperty('display', 'none');
        const auth = document.getElementById('authScreen');
        if (auth) auth.style.display = 'flex';
        const msg = document.getElementById('authMsg');
        if (msg) {
          msg.style.display = 'block';
          msg.textContent = 'Akun ini sedang dinonaktifkan. Hubungi Administrator.';
          msg.style.background = '#fee4e2';
        }
        try { await sb.auth.signOut({ scope: 'local' }); } catch (_) {}
        return;
      }

      lastUserId = user.id;
      document.body.dataset.accountChecked = 'true';
      document.body.dataset.userRole = profile.role || 'marketing';
      document.body.dataset.userName = profile.full_name || '';
    } catch (e) {
      console.warn('Inactive account guard check failed', e);
    } finally {
      checking = false;
    }
  }

  function bindAuth() {
    if (typeof sb === 'undefined' || !sb.auth) return;
    sb.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        setTimeout(enforce, 0);
      } else if (event === 'SIGNED_OUT') {
        lastUserId = null;
        document.body.dataset.accountChecked = 'false';
      }
    });
    enforce();
    setInterval(enforce, 5000);
    window.addEventListener('focus', enforce);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) enforce(); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bindAuth);
  else bindAuth();
})();
