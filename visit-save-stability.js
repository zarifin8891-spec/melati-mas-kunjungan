(() => {
  let busy = false;

  function setBusy(v) {
    busy = v;
    document.body.dataset.saveInProgress = v ? 'true' : 'false';
    const btn = document.querySelector('#visitForm button[type="submit"]');
    if (btn) {
      btn.disabled = v;
      btn.textContent = v ? 'Menyimpan...' : 'Simpan Data';
    }
  }

  async function saveVisit(event) {
    event.preventDefault();
    event.stopImmediatePropagation();
    if (busy || typeof sb === 'undefined') return;

    const form = event.target;
    const sessionResult = await sb.auth.getSession();
    const session = sessionResult?.data?.session;
    const user = session?.user;
    if (!session || !user) {
      window.msg?.('Sesi login tidak ditemukan. Silakan login kembali.', true);
      return;
    }

    const fields = ['tanggal','nama','alamat','telepon','pekerjaan','pembayaran','sumber','status','deskripsi','penerima'];
    const record = {};
    for (const key of fields) record[key] = String(form.elements[key]?.value ?? '').trim();

    if (!record.tanggal || !record.nama) {
      window.msg?.('Tanggal dan Nama Prospek wajib diisi.', true);
      return;
    }

    try {
      setBusy(true);
      let result;
      if (window.editId === null || window.editId === undefined) {
        result = await sb.from('kunjungan_konsumen').insert({ ...record, created_by: user.id });
      } else {
        result = await sb.from('kunjungan_konsumen').update(record).eq('id', window.editId);
      }

      if (result?.error) throw result.error;

      if (typeof window.closeForm === 'function') window.closeForm();
      if (typeof window.loadOnlineData === 'function') await window.loadOnlineData();
      if (typeof window.renderDashboard === 'function') window.renderDashboard();
      if (typeof window.renderList === 'function') window.renderList();
      window.msg?.('Data kunjungan berhasil disimpan.', false);
    } catch (error) {
      console.error('Visit save error:', error);
      window.msg?.('Gagal menyimpan data: ' + (error?.message || 'Terjadi kesalahan.'), true);
    } finally {
      setBusy(false);
    }
  }

  function bind() {
    const form = document.getElementById('visitForm');
    if (!form || form.dataset.stableSave === 'true') return;
    form.dataset.stableSave = 'true';
    form.addEventListener('submit', saveVisit, true);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind);
  else bind();
})();
