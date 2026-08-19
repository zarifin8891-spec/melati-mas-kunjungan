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

  function installEditBridge() {
    if (typeof window.openForm !== 'function' || window.openForm.__saveBridge) return;
    const originalOpenForm = window.openForm;
    const wrapped = function(id = null) {
      window.__visitEditId = id;
      return originalOpenForm.apply(this, arguments);
    };
    wrapped.__saveBridge = true;
    window.openForm = wrapped;
    window.__visitEditId = null;
  }

  function syncDashboardPeriod() {
    const fromEl = document.getElementById('dashFrom');
    const toEl = document.getElementById('dashTo');
    if (!fromEl || !toEl || !Array.isArray(window.state?.records)) return;

    const dates = window.state.records.map(r => r.tanggal).filter(Boolean).sort();
    if (!dates.length) return;

    const currentFrom = fromEl.value;
    const currentTo = toEl.value;
    const minDate = dates[0];
    const maxDate = dates[dates.length - 1];

    // Expand the active dashboard range only when it is still at the
    // previous dataset boundaries or currently empty. This keeps deliberate
    // user filtering intact while ensuring new records appear immediately.
    if (!currentFrom || currentFrom === minDate || currentFrom > maxDate) fromEl.value = minDate;
    if (!currentTo || currentTo < maxDate || currentTo === currentFrom) toEl.value = maxDate;
  }

  async function saveVisit(event) {
    event.preventDefault();
    event.stopImmediatePropagation();
    if (busy || typeof sb === 'undefined') return;

    installEditBridge();
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

    const editId = window.__visitEditId ?? null;

    try {
      setBusy(true);
      let result;
      if (editId === null) {
        result = await sb.from('kunjungan_konsumen').insert({ ...record, created_by: user.id });
      } else {
        result = await sb.from('kunjungan_konsumen').update(record).eq('id', editId);
      }

      if (result?.error) throw result.error;

      if (typeof window.closeForm === 'function') window.closeForm();
      if (typeof window.loadOnlineData === 'function') await window.loadOnlineData();
      syncDashboardPeriod();
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
    installEditBridge();
    const form = document.getElementById('visitForm');
    if (!form || form.dataset.stableSave === 'true') return;
    form.dataset.stableSave = 'true';
    form.addEventListener('submit', saveVisit, true);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind);
  else bind();
})();
