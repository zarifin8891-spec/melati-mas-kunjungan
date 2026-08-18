(() => {
  function roleLabel(role) {
    return role === 'admin' ? 'Administrator' : 'Marketing';
  }

  function injectStyles() {
    if (document.getElementById('role-enhancement-style')) return;
    const style = document.createElement('style');
    style.id = 'role-enhancement-style';
    style.textContent = '.user-panel{margin-bottom:16px}.user-toolbar{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:12px}.user-table-wrap{overflow:auto;border:1px solid #e6eaf0;border-radius:11px}.user-table{width:100%;border-collapse:separate;border-spacing:0}.user-table th,.user-table td{padding:9px;border-bottom:1px solid #e6eaf0;font-size:12px;text-align:left;vertical-align:middle}.user-table th{background:#f8fafc;color:#667085;font-size:11px}.user-pill{display:inline-flex;padding:4px 7px;border-radius:999px;font-size:10px;font-weight:700}.user-pill.admin{background:#e8f4f1;color:#176b5d}.user-pill.marketing{background:#eef2f6;color:#344054}.user-pill.on{background:#dcfae6;color:#067647}.user-pill.off{background:#fee4e2;color:#b42318}.user-actions{display:flex;gap:5px;flex-wrap:wrap}.user-actions button{border:1px solid #e6eaf0;background:#fff;border-radius:7px;padding:6px 8px;font-size:10px;font-weight:700}.user-actions .danger{background:#fee4e2;color:#b42318;border-color:#f4c7c3}.user-form{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-top:12px;padding:14px;border:1px solid #e6eaf0;border-radius:12px;background:#f8fafc}.user-form .full{grid-column:1/-1}.user-form label{font-size:10px;color:#667085;font-weight:700}.user-form input,.user-form select{border:1px solid #d6dbe4;border-radius:8px;padding:8px;background:#fff}.user-form-actions{grid-column:1/-1;display:flex;justify-content:flex-end;gap:8px}.user-empty{padding:25px;text-align:center;color:#667085}.user-modal{position:fixed;inset:0;background:rgba(16,24,40,.45);display:none;align-items:center;justify-content:center;padding:18px;z-index:60}.user-modal.show{display:flex}.user-modal-box{width:min(520px,100%);background:#fff;border-radius:16px;padding:18px;box-shadow:0 20px 60px rgba(0,0,0,.2)}.user-modal-box h3{margin:0 0 14px;font-size:16px}.user-modal-grid{display:grid;gap:10px}.user-modal-grid label{font-size:10px;color:#667085;font-weight:700}.user-modal-grid input,.user-modal-grid select{border:1px solid #d6dbe4;border-radius:8px;padding:9px}.user-modal-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:15px}.user-modal-actions button{border:0;border-radius:8px;padding:9px 12px;font-weight:700;cursor:pointer}.um-cancel{background:#eef2f6;color:#344054}.um-save{background:#176b5d;color:#fff}@media(max-width:760px){.user-form{grid-template-columns:1fr}.user-form .full{grid-column:auto}.user-form-actions{grid-column:auto}.user-toolbar{align-items:flex-start;flex-direction:column}.user-actions button{padding:8px 9px}}';
    document.head.appendChild(style);
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
    if (info) info.textContent = 'Login: ' + user.email + ' • ' + roleLabel(profile.role) + (profile.full_name ? ' • ' + profile.full_name : '');
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

    if (profile.role === 'admin') addUserManagement();
  }

  async function callAdmin(action, payload = {}) {
    const { data: sessionData } = await sb.auth.getSession();
    const token = sessionData?.session?.access_token;
    const res = await fetch('https://xfujcoemuwopzstxzmir.supabase.co/functions/v1/admin-user-management', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token, 'apikey': 'sb_publishable_tDqFBC0iQVLEp_WUehtBtw_vVbG7BX2' },
      body: JSON.stringify({ action, ...payload })
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || 'Operasi user gagal.');
    return body;
  }

  async function loadUsers() {
    const { data, error } = await sb.from('profiles').select('id,email,full_name,role,active,created_at,updated_at').order('created_at', { ascending: true });
    if (error) throw error;
    return data || [];
  }

  function userRow(u) {
    return '<tr><td><b>' + esc(u.full_name || '(Tanpa nama)') + '</b><br><span style="color:#667085">' + esc(u.email || '-') + '</span></td><td><span class="user-pill ' + esc(u.role) + '">' + roleLabel(u.role) + '</span></td><td><span class="user-pill ' + (u.active ? 'on' : 'off') + '">' + (u.active ? 'Aktif' : 'Nonaktif') + '</span></td><td><div class="user-actions"><button onclick="window.__editManagedUser(\'' + u.id + '\')">Edit</button><button onclick="window.__resetManagedUser(\'' + u.id + '\')">Reset Password</button><button onclick="window.__toggleManagedUser(\'' + u.id + '\',' + (!u.active) + ')">' + (u.active ? 'Nonaktifkan' : 'Aktifkan') + '</button><button class="danger" onclick="window.__deleteManagedUser(\'' + u.id + '\')">Hapus</button></div></td></tr>';
  }

  async function renderUsers() {
    injectStyles();
    const body = document.getElementById('managedUsersBody');
    const count = document.getElementById('managedUsersCount');
    if (!body) return;
    body.innerHTML = '<tr><td colspan="4" class="user-empty">Memuat pengguna...</td></tr>';
    try {
      const users = await loadUsers();
      if (count) count.textContent = users.length + ' pengguna';
      body.innerHTML = users.length ? users.map(userRow).join('') : '<tr><td colspan="4" class="user-empty">Belum ada pengguna.</td></tr>';
    } catch (e) {
      body.innerHTML = '<tr><td colspan="4" class="user-empty">Gagal memuat pengguna: ' + esc(e.message) + '</td></tr>';
    }
  }

  function openUserModal(user) {
    injectStyles();
    const modal = document.getElementById('managedUserModal');
    const form = document.getElementById('managedUserForm');
    form.dataset.userId = user?.id || '';
    document.getElementById('managedUserName').value = user?.full_name || '';
    document.getElementById('managedUserEmail').value = user?.email || '';
    document.getElementById('managedUserRole').value = user?.role || 'marketing';
    document.getElementById('managedUserActive').value = user?.active === false ? 'false' : 'true';
    document.getElementById('managedUserPassword').value = '';
    document.getElementById('managedUserPasswordWrap').style.display = user ? 'none' : '';
    document.getElementById('managedUserEmail').disabled = !!user;
    document.getElementById('managedUserModalTitle').textContent = user ? 'Edit Pengguna' : 'Tambah Pengguna';
    modal.classList.add('show');
  }

  function closeUserModal() { document.getElementById('managedUserModal')?.classList.remove('show'); }

  async function submitManagedUser(e) {
    e.preventDefault();
    const form = e.target;
    const id = form.dataset.userId;
    const fullName = document.getElementById('managedUserName').value.trim();
    const email = document.getElementById('managedUserEmail').value.trim();
    const role = document.getElementById('managedUserRole').value;
    const active = document.getElementById('managedUserActive').value === 'true';
    const password = document.getElementById('managedUserPassword').value;
    const button = document.getElementById('managedUserSave');
    button.disabled = true; button.textContent = 'Menyimpan...';
    try {
      if (id) {
        await callAdmin('update', { user_id: id, full_name: fullName, role, active });
      } else {
        await callAdmin('create', { email, full_name: fullName, role, password });
      }
      closeUserModal();
      await renderUsers();
      window.msg?.('Data pengguna berhasil disimpan.', false);
    } catch (e2) {
      window.msg?.(e2.message, true);
    } finally { button.disabled = false; button.textContent = 'Simpan'; }
  }

  async function editManagedUser(id) {
    const users = await loadUsers();
    const user = users.find(x => x.id === id);
    if (user) openUserModal(user);
  }
  async function toggleManagedUser(id, active) {
    const users = await loadUsers(); const u = users.find(x => x.id === id); if (!u) return;
    if (!confirm((active ? 'Aktifkan' : 'Nonaktifkan') + ' user ' + (u.email || '') + '?')) return;
    try { await callAdmin('update', { user_id: id, full_name: u.full_name || '', role: u.role, active }); await renderUsers(); }
    catch (e) { window.msg?.(e.message, true); }
  }
  async function resetManagedUser(id) {
    const users = await loadUsers(); const u = users.find(x => x.id === id); if (!u) return;
    const password = prompt('Password baru untuk ' + (u.email || '') + ' (minimal 6 karakter):');
    if (password === null) return;
    if (password.length < 6) { window.msg?.('Password minimal 6 karakter.', true); return; }
    try { await callAdmin('reset_password', { user_id: id, password }); window.msg?.('Password berhasil direset.', false); }
    catch (e) { window.msg?.(e.message, true); }
  }
  async function deleteManagedUser(id) {
    const users = await loadUsers(); const u = users.find(x => x.id === id); if (!u) return;
    if (!confirm('Hapus permanen user ' + (u.email || '') + '? Tindakan ini tidak dapat dibatalkan.')) return;
    try { await callAdmin('delete', { user_id: id }); await renderUsers(); window.msg?.('User berhasil dihapus.', false); }
    catch (e) { window.msg?.(e.message, true); }
  }

  function addUserManagement() {
    if (document.getElementById('managedUsersPanel')) { renderUsers(); return; }
    const settingsPage = document.getElementById('page-settings');
    if (!settingsPage) return;
    injectStyles();
    const panel = document.createElement('div');
    panel.id = 'managedUsersPanel';
    panel.className = 'panel user-panel';
    panel.innerHTML = '<div class="user-toolbar"><div><h2 style="margin:0;font-size:15px">Pengguna Aplikasi</h2><small id="managedUsersCount" style="color:#667085">Memuat...</small></div><button class="btn primary" id="addManagedUserBtn">+ Tambah Pengguna</button></div><div class="user-table-wrap"><table class="user-table"><thead><tr><th>Pengguna</th><th>Role</th><th>Status</th><th>Aksi</th></tr></thead><tbody id="managedUsersBody"></tbody></table></div>';
    settingsPage.insertBefore(panel, settingsPage.firstElementChild);

    const modal = document.createElement('div');
    modal.id = 'managedUserModal';
    modal.className = 'user-modal';
    modal.innerHTML = '<div class="user-modal-box"><h3 id="managedUserModalTitle">Tambah Pengguna</h3><form id="managedUserForm" class="user-modal-grid"><div><label>NAMA LENGKAP</label><input id="managedUserName" required></div><div><label>EMAIL</label><input id="managedUserEmail" type="email" required></div><div><label>ROLE</label><select id="managedUserRole"><option value="marketing">Marketing</option><option value="admin">Administrator</option></select></div><div><label>STATUS</label><select id="managedUserActive"><option value="true">Aktif</option><option value="false">Nonaktif</option></select></div><div id="managedUserPasswordWrap"><label>PASSWORD AWAL</label><input id="managedUserPassword" type="password" minlength="6" placeholder="Minimal 6 karakter"></div><div class="user-modal-actions"><button type="button" class="um-cancel" onclick="window.__closeManagedUserModal()">Batal</button><button type="submit" class="um-save" id="managedUserSave">Simpan</button></div></form></div>';
    document.body.appendChild(modal);
    document.getElementById('managedUserForm').addEventListener('submit', submitManagedUser);
    document.getElementById('addManagedUserBtn').addEventListener('click', () => openUserModal(null));
    renderUsers();
  }

  window.__editManagedUser = editManagedUser;
  window.__toggleManagedUser = toggleManagedUser;
  window.__resetManagedUser = resetManagedUser;
  window.__deleteManagedUser = deleteManagedUser;
  window.__closeManagedUserModal = closeUserModal;

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
