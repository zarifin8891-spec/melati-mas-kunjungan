(() => {
  const MESSAGE = 'Data tidak dapat dihapus. Hanya Administrator yang memiliki izin untuk menghapus data kunjungan.';
  const friendly = (error) => {
    const raw = String(error?.message || error || '').trim();
    const low = raw.toLowerCase();
    if (low.includes('row-level security') || low.includes('permission denied') || low.includes('42501') || low.includes('new row violates row-level security')) return MESSAGE;
    return raw || 'Data tidak dapat dihapus. Silakan coba lagi.';
  };

  async function getAccess() {
    const { data, error } = await sb.auth.getSession();
    if (error) throw error;
    const user = data?.session?.user;
    if (!user) return { loggedIn: false, admin: false };
    const { data: profile, error: profileError } = await sb
      .from('profiles')
      .select('role, active')
      .eq('id', user.id)
      .maybeSingle();
    if (profileError) throw profileError;
    return { loggedIn: true, admin: profile?.role === 'admin' && profile?.active === true };
  }

  async function handleDeleteClick(event) {
    const button = event.target.closest('button.iconbtn');
    if (!button) return;
    const text = (button.textContent || '').trim().toLowerCase();
    if (text !== 'hapus') return;

    // Capture phase stops the original inline onclick before it can run.
    event.preventDefault();
    event.stopImmediatePropagation();

    try {
      const access = await getAccess();
      if (!access.loggedIn) {
        alert('Sesi login tidak ditemukan. Silakan login kembali.');
        return;
      }
      if (!access.admin) {
        alert(MESSAGE);
        return;
      }

      const onclick = button.getAttribute('onclick') || '';
      const match = onclick.match(/deleteVisit\(['"]([^'"]+)['"]\)/);
      const id = match?.[1];
      if (!id) {
        alert('ID data kunjungan tidak ditemukan.');
        return;
      }

      // Administrator: hand control back to the application's existing delete flow.
      if (typeof window.deleteVisit === 'function') {
        await window.deleteVisit(id);
      }
    } catch (error) {
      console.error('Delete guard error:', error);
      alert(friendly(error));
    }
  }

  function install() {
    if (typeof sb === 'undefined') return;
    if (document.documentElement.dataset.deleteGuardCapture === 'true') return;
    document.documentElement.dataset.deleteGuardCapture = 'true';
    document.addEventListener('click', handleDeleteClick, true);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
  else install();
})();
