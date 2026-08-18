(() => {
  const eyeSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"></path><circle cx="12" cy="12" r="2.5"></circle></svg>';
  const eyeOffSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3l18 18"></path><path d="M10.7 5.1A10.8 10.8 0 0 1 12 5c6.5 0 10 7 10 7a18.8 18.8 0 0 1-3.1 3.8M6.1 6.1C3.4 8 2 12 2 12s3.5 7 10 7c1.5 0 2.8-.3 4-.8"></path><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"></path></svg>';

  function friendlyAuthError(errorText) {
    const raw = String(errorText || '');
    const low = raw.toLowerCase();
    if (low.includes('email rate limit exceeded') || low.includes('over_email_send_rate_limit')) {
      return 'Batas email autentikasi Supabase sedang tercapai. Password reset belum dapat mengirim email. Tunggu sampai batas pulih atau gunakan custom SMTP untuk penggunaan produksi.';
    }
    if (low.includes('too many requests') || low.includes('over_request_rate_limit') || low.includes('429')) return 'Terlalu banyak permintaan ke layanan login. Tunggu beberapa menit lalu coba lagi.';
    if (low.includes('invalid login credentials')) return 'Email atau password salah.';
    if (low.includes('email not confirmed')) return 'Email akun belum dikonfirmasi. Silakan konfirmasi email terlebih dahulu.';
    return raw || 'Terjadi kesalahan saat autentikasi.';
  }

  function injectStyles() {
    if (document.getElementById('auth-enhancement-style')) return;
    const style = document.createElement('style');
    style.id = 'auth-enhancement-style';
    style.textContent = '.password-wrap{position:relative}.password-wrap input{width:100%;padding-right:48px}.password-toggle{position:absolute;right:8px;top:50%;transform:translateY(-50%);width:36px;height:36px;border:0;background:transparent;color:#667085;border-radius:8px;display:grid;place-items:center;padding:0;cursor:pointer}.password-toggle:hover{background:#f2f4f7;color:#344054}.password-toggle:focus-visible{outline:2px solid #6eafa4;outline-offset:2px}.password-toggle svg{width:20px;height:20px;pointer-events:none}.auth-link-row{display:flex;justify-content:center;margin-top:12px}.auth-link{border:0;background:transparent;color:#176b5d;font-size:12px;font-weight:700;padding:6px 8px;cursor:pointer}.auth-link:hover{text-decoration:underline}.auth-link:disabled{opacity:.6;cursor:default;text-decoration:none}.reset-panel{margin-top:14px;padding:14px;border:1px solid #e6eaf0;border-radius:12px;background:#f8fafc}.reset-panel h3{margin:0 0 8px;font-size:14px}.reset-panel p{margin:0 0 10px;font-size:11px;color:#667085}.reset-panel .reset-field{display:grid;gap:6px;margin-top:10px}.reset-panel label{font-size:11px;color:#667085;font-weight:700}.reset-panel input{border:1px solid #d6dbe4;border-radius:9px;padding:9px 10px;background:#fff;outline:none}.reset-panel .reset-actions{display:flex;gap:8px;justify-content:flex-end;margin-top:14px}.reset-panel .reset-actions button{border:0;border-radius:9px;padding:8px 12px;font-weight:700;cursor:pointer}.reset-cancel{background:#eef2f6;color:#344054}.reset-submit{background:#176b5d;color:#fff}.reset-submit:disabled{opacity:.65;cursor:default}.auth-link.waiting{color:#667085}
    document.head.appendChild(style);
  }

  function addPasswordToggle() {
    const input = document.getElementById('authPassword');
    if (!input || document.getElementById('togglePassword')) return;
    injectStyles();
    const field = input.parentElement;
    const wrap = document.createElement('div');
    wrap.className = 'password-wrap';
    field.replaceChild(wrap, input);
    wrap.appendChild(input);
    const button = document.createElement('button');
    button.type = 'button';
    button.id = 'togglePassword';
    button.className = 'password-toggle';
    button.setAttribute('aria-label', 'Tampilkan password');
    button.setAttribute('title', 'Tampilkan password');
    button.setAttribute('aria-pressed', 'false');
    button.innerHTML = eyeSvg;
    wrap.appendChild(button);
    button.addEventListener('click', () => {
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      button.setAttribute('aria-pressed', String(show));
      button.setAttribute('aria-label', show ? 'Sembunyikan password' : 'Tampilkan password');
      button.setAttribute('title', show ? 'Sembunyikan password' : 'Tampilkan password');
      button.innerHTML = show ? eyeOffSvg : eyeSvg;
    });
  }

  function improveMessages() {
    if (typeof window.msg !== 'function' || window.__melatiMsgWrapped) return;
    const original = window.msg;
    window.msg = (text, isError = false) => original(friendlyAuthError(text), isError);
    window.__melatiMsgWrapped = true;
  }

  async function sendPasswordReset() {
    const email = document.getElementById('authEmail')?.value.trim();
    const link = document.getElementById('forgotPassword');
    if (!email) {
      window.msg?.('Masukkan email terlebih dahulu, lalu pilih Lupa password.', true);
      document.getElementById('authEmail')?.focus();
      return;
    }
    if (link?.dataset.busy === 'true') return;
    if (link) {
      link.dataset.busy = 'true';
      link.disabled = true;
      link.classList.add('waiting');
      link.textContent = 'Mengirim...';
    }
    try {
      const redirectTo = window.location.origin + window.location.pathname;
      const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo });
      if (error) {
        window.msg?.(friendlyAuthError(error.message), true);
        if (link) {
          link.dataset.busy = 'false';
          link.disabled = false;
          link.classList.remove('waiting');
          link.textContent = 'Lupa password?';
        }
        return;
      }
      window.msg?.('Jika email terdaftar, link untuk membuat password baru sudah dikirim. Periksa Inbox dan folder Spam.', false);
      if (link) link.textContent = 'Coba lagi 60 dtk';
      setTimeout(() => {
        if (!link) return;
        link.dataset.busy = 'false';
        link.disabled = false;
        link.classList.remove('waiting');
        link.textContent = 'Lupa password?';
      }, 60000);
    } catch (error) {
      window.msg?.(friendlyAuthError(error?.message), true);
      if (link) {
        link.dataset.busy = 'false';
        link.disabled = false;
        link.classList.remove('waiting');
        link.textContent = 'Lupa password?';
      }
    }
  }

  function addForgotPassword() {
    const signup = document.getElementById('signupBtn');
    const loginForm = document.getElementById('loginForm');
    if (!signup || !loginForm || document.getElementById('forgotPassword')) return;
    injectStyles();
    signup.style.display = 'none';
    const row = signup.parentElement;
    const linkRow = document.createElement('div');
    linkRow.className = 'auth-link-row';
    linkRow.innerHTML = '<button type="button" class="auth-link" id="forgotPassword">Lupa password?</button>';
    row.parentElement.appendChild(linkRow);
    document.getElementById('forgotPassword').addEventListener('click', sendPasswordReset);
  }

  function buildResetPanel() {
    const authCard = document.querySelector('#authScreen > div');
    const loginForm = document.getElementById('loginForm');
    if (!authCard || !loginForm || document.getElementById('resetPasswordPanel')) return null;
    injectStyles();
    loginForm.style.display = 'none';
    const panel = document.createElement('div');
    panel.id = 'resetPasswordPanel';
    panel.className = 'reset-panel';
    panel.innerHTML = '<h3>Buat Password Baru</h3><p>Masukkan password baru untuk akun ini. Gunakan minimal 6 karakter.</p><div class="reset-field"><label>PASSWORD BARU</label><input id="newPassword" type="password" minlength="6" autocomplete="new-password"></div><div class="reset-field"><label>ULANGI PASSWORD</label><input id="confirmPassword" type="password" minlength="6" autocomplete="new-password"></div><div class="reset-actions"><button type="button" class="reset-cancel" id="resetCancel">Batal</button><button type="button" class="reset-submit" id="resetSubmit">Simpan Password</button></div>';
    authCard.appendChild(panel);
    document.getElementById('resetCancel').addEventListener('click', () => window.location.reload());
    document.getElementById('resetSubmit').addEventListener('click', async () => {
      const a = document.getElementById('newPassword').value;
      const b = document.getElementById('confirmPassword').value;
      if (a.length < 6) return window.msg?.('Password minimal 6 karakter.', true);
      if (a !== b) return window.msg?.('Konfirmasi password tidak sama.', true);
      const button = document.getElementById('resetSubmit');
      button.disabled = true;
      button.textContent = 'Menyimpan...';
      const { error } = await sb.auth.updateUser({ password: a });
      if (error) {
        window.msg?.(friendlyAuthError(error.message), true);
        button.disabled = false;
        button.textContent = 'Simpan Password';
        return;
      }
      await sb.auth.signOut();
      window.location.reload();
    });
    return panel;
  }

  function handlePasswordRecovery() {
    if (!window.supabase || typeof sb === 'undefined') return;
    sb.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setTimeout(() => {
          const authScreen = document.getElementById('authScreen');
          const appShell = document.getElementById('appShell');
          if (authScreen) authScreen.style.display = 'flex';
          if (appShell) appShell.style.display = 'none';
          buildResetPanel();
        }, 0);
      }
    });
  }

  function init() {
    addPasswordToggle();
    improveMessages();
    addForgotPassword();
    handlePasswordRecovery();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();