(() => {
  const friendly = (error) => {
    const raw = String(error?.message || error || '').trim();
    const low = raw.toLowerCase();
    if (low.includes('row-level security') || low.includes('permission denied') || low.includes('42501') || low.includes('new row violates row-level security')) {
      return 'Data tidak dapat dihapus. Hanya Administrator yang memiliki izin untuk menghapus data kunjungan.';
    }
    return raw || 'Data tidak dapat dihapus. Silakan coba lagi.';
  };

  function install() {
    if (typeof sb === 'undefined') return;
    if (typeof window.deleteVisit !== 'function' || window.deleteVisit.__deleteGuard) return;

    const guardedDelete = async function(id) {
      const records = Array.isArray(window.state?.records) ? window.state.records : [];
      const record = records.find(r => r?._id === id);
      const name = record?.nama || 'ini';
      if (!confirm('Hapus data kunjungan ' + name + '?')) return;

      try {
        const { data: sessionData } = await sb.auth.getSession();
        if (!sessionData?.session?.user) {
          alert('Sesi login tidak ditemukan. Silakan login kembali.');
          return;
        }

        const { error } = await sb.from('kunjungan_konsumen').delete().eq('id', id);
        if (error) {
          console.error('Delete visit rejected:', error);
          alert(friendly(error));
          return;
        }

        if (typeof window.loadOnlineData === 'function') await window.loadOnlineData();
        if (typeof window.renderDashboard === 'function') window.renderDashboard();
        if (typeof window.renderList === 'function') window.renderList();
        alert('Data kunjungan berhasil dihapus.');
      } catch (error) {
        console.error('Delete visit error:', error);
        alert(friendly(error));
      }
    };

    guardedDelete.__deleteGuard = true;
    window.deleteVisit = guardedDelete;
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
  else install();
  setTimeout(install, 300);
  setTimeout(install, 1000);
  setInterval(install, 3000);
})();
