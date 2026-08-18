(() => {
  const eyeSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"></path><circle cx="12" cy="12" r="2.5"></circle></svg>';
  const eyeOffSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3l18 18"></path><path d="M10.7 5.1A10.8 10.8 0 0 1 12 5c6.5 0 10 7 10 7a18.8 18.8 0 0 1-3.1 3.8M6.1 6.1C3.4 8 2 12 2 12s3.5 7 10 7c1.5 0 2.8-.3 4-.8"></path><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"></path></svg>';

  function friendlyAuthError(errorText) {
    const raw = String(errorText || '');
    const low = raw.toLowerCase();
    if (low.includes('email rate limit exceeded') || low.includes('over_email_send_rate_limit')) {
      return 'Pengiriman email autentikasi sedang mencapai batas. Jangan klik Daftar berulang. Jika akun sudah terdaftar, gunakan Masuk. Coba lagi setelah batas email pulih.';
    }
    if (low.includes('too many requests') || low.includes('over_request_rate_limit') || low.includes('429')) {
      return 'Terlalu banyak permintaan ke layanan login. Tunggu beberapa menit lalu coba lagi.';
    }
    if (low.includes('invalid login credentials')) {
      return 'Email atau password salah.';
    }
    if (low.includes('email not confirmed')) {
      return 'Email akun belum dikonfirmasi. Silakan konfirmasi email terlebih dahulu.';
    }
    return raw || 'Terjadi kesalahan saat autentikasi.';
  }

  function injectStyles() {
    if (document.getElementById('auth-enhancement-style')) return;
    const style = document.createElement('style');
    style.id = 'auth-enhancement-style';
    style.textContent = '.password-wrap{position:relative}.password-wrap input{width:100%;padding-right:48px}.password-toggle{position:absolute;right:8px;top:50%;transform:translateY(-50%);width:36px;height:36px;border:0;background:transparent;color:#667085;border-radius:8px;display:grid;place-items:center;padding:0;cursor:pointer}.password-toggle:hover{background:#f2f4f7;color:#344054}.password-toggle:focus-visible{outline:2px solid #6eafa4;outline-offset:2px}.password-toggle svg{width:20px;height:20px;pointer-events:none}';
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
    window.msg = (text, isError = false) => {
      original(friendlyAuthError(text), isError);
    };
    window.__melatiMsgWrapped = true;
  }

  function protectSignupButton() {
    const button = document.getElementById('signupBtn');
    if (!button || button.__cooldownInstalled) return;
    button.__cooldownInstalled = true;
    let cooling = false;
    let timer = null;
    button.addEventListener('click', (event) => {
      if (cooling) {
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
      cooling = true;
      let left = 60;
      const original = 'Daftar';
      button.disabled = true;
      button.textContent = `${original} (${left}s)`;
      timer = setInterval(() => {
        left -= 1;
        if (left <= 0) {
          clearInterval(timer);
          button.disabled = false;
          button.textContent = original;
          cooling = false;
        } else {
          button.textContent = `${original} (${left}s)`;
        }
      }, 1000);
    }, true);
  }

  function init() {
    addPasswordToggle();
    improveMessages();
    protectSignupButton();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();