(() => {
  function friendly(text) {
    const raw = String(text || '');
    const low = raw.toLowerCase();
    if (low.includes('invalid login credentials')) return 'Email atau password salah.';
    if (low.includes('email not confirmed')) return 'Email akun belum dikonfirmasi.';
    if (low.includes('too many requests') || low.includes('429')) return 'Terlalu banyak percobaan. Tunggu beberapa menit lalu coba lagi.';
    return raw || 'Login gagal. Silakan coba lagi.';
  }

  function withTimeout(promise, ms) {
    return Promise.race([
      promise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('Koneksi login terlalu lama. Periksa koneksi internet lalu coba lagi.')), ms))
    ]);
  }

  function init() {
    const form = document.getElementById('loginForm');
    if (!form || form.dataset.stableLogin === 'true') return;
    form.dataset.stableLogin = 'true';
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      const emailEl = document.getElementById('authEmail');
      const passwordEl = document.getElementById('authPassword');
      const button = form.querySelector('button[type="submit"]') || form.querySelector('.primary');
      const email = emailEl?.value.trim();
      const password = passwordEl?.value || '';
      if (!email || password.length < 6) {
        window.msg?.('Isi email dan password minimal 6 karakter.', true);
        return;
      }
      if (button) { button.disabled = true; button.textContent = 'Memproses...'; }
      window.msg?.('Memproses...', false);
      try {
        const result = await withTimeout(sb.auth.signInWithPassword({ email, password }), 15000);
        if (result.error) throw result.error;
        const user = result.data?.user;
        if (!user) throw new Error('Login berhasil tetapi sesi pengguna tidak ditemukan.');
        if (typeof window.showApp === 'function') {
          await window.showApp(user);
        } else {
          window.location.reload();
        }
      } catch (error) {
        window.msg?.(friendly(error?.message), true);
      } finally {
        if (button) { button.disabled = false; button.textContent = 'Masuk'; }
      }
    }, true);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
