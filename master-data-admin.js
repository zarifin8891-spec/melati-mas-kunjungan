(() => {
  const CATEGORIES = [
    ['pekerjaan','Pekerjaan'],
    ['pembayaran','Pembayaran'],
    ['sumber','Sumber Informasi'],
    ['status','Status Kunjungan'],
    ['penerima','Penerima'],
  ];

  const escHtml = (v) => String(v ?? '').replace(/[&<>\"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[s]));
  const labelFor = key => (CATEGORIES.find(x => x[0] === key) || [key,key])[1];

  function isAdmin(){ return document.body?.dataset?.userRole === 'admin'; }

  function injectStyles(){
    if(document.getElementById('master-admin-style')) return;
    const s=document.createElement('style'); s.id='master-admin-style';
    s.textContent=`
      .master-panel{margin-bottom:16px}.master-tabs{display:flex;gap:7px;flex-wrap:wrap;margin-bottom:14px}.master-tab{border:1px solid #dfe4ea;background:#fff;color:#344054;border-radius:8px;padding:7px 10px;font-size:11px;font-weight:700}.master-tab.active{background:#e8f4f1;color:#176b5d;border-color:#b9d8d1}.master-list{display:grid;gap:7px}.master-item{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 11px;border:1px solid #e6eaf0;border-radius:9px;background:#fff}.master-item.off{opacity:.55}.master-item-main{min-width:0}.master-item-main b{font-size:12px}.master-item-main small{display:block;color:#667085;font-size:10px;margin-top:2px}.master-actions{display:flex;gap:5px;flex-wrap:wrap}.master-actions button{border:1px solid #e0e5eb;background:#fff;border-radius:7px;padding:6px 8px;font-size:10px;font-weight:700}.master-actions .danger{background:#fee4e2;color:#b42318;border-color:#f4c7c3}.master-modal{position:fixed;inset:0;background:rgba(16,24,40,.45);display:none;align-items:center;justify-content:center;padding:18px;z-index:65}.master-modal.show{display:flex}.master-box{width:min(460px,100%);background:#fff;border-radius:15px;padding:18px;box-shadow:0 20px 60px rgba(0,0,0,.22)}.master-box h3{margin:0 0 14px;font-size:16px}.master-grid{display:grid;gap:10px}.master-grid label{font-size:10px;color:#667085;font-weight:700}.master-grid input,.master-grid select{border:1px solid #d6dbe4;border-radius:8px;padding:9px}.master-modal-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:14px}.master-modal-actions button{border:0;border-radius:8px;padding:9px 12px;font-weight:700}.master-cancel{background:#eef2f6;color:#344054}.master-save{background:#176b5d;color:#fff}.master-empty{text-align:center;color:#667085;padding:20px}
    `;
    document.head.appendChild(s);
  }

  async function loadRows(category){
    const {data,error}=await sb.from('master_data').select('id,category,value,sort_order,active').eq('category',category).order('sort_order',{ascending:true}).order('id',{ascending:true});
    if(error) throw error; return data || [];
  }

  function getNextSort(rows){ return rows.reduce((m,r)=>Math.max(m,Number(r.sort_order)||0),-1)+1; }

  async function ensurePanel(){
    if(!isAdmin()) return;
    const settings=document.getElementById('page-settings'); if(!settings) return;
    if(document.getElementById('masterDataPanel')) { await renderList(); return; }
    injectStyles();
    const panel=document.createElement('div'); panel.id='masterDataPanel'; panel.className='panel master-panel';
    panel.innerHTML=`<div class="panel-head"><div><h2 style="margin:0;font-size:15px">Master Data</h2><small style="color:#667085">Daftar pilihan yang digunakan pada form kunjungan</small></div><button class="btn primary" id="addMasterBtn">+ Tambah Master Data</button></div><div class="master-tabs" id="masterTabs"></div><div class="master-list" id="masterList"></div>`;
    const users=document.getElementById('managedUsersPanel');
    if(users && users.parentNode===settings) users.insertAdjacentElement('afterend',panel); else settings.insertBefore(panel,settings.firstElementChild);

    const modal=document.createElement('div'); modal.id='masterDataModal'; modal.className='master-modal';
    modal.innerHTML=`<div class="master-box"><h3 id="masterModalTitle">Tambah Master Data</h3><form id="masterForm" class="master-grid"><div><label>KATEGORI</label><select id="masterCategory"></select></div><div><label>NILAI</label><input id="masterValue" required maxlength="120"></div><div><label>URUTAN</label><input id="masterSort" type="number" min="0" value="0"></div><div><label>STATUS</label><select id="masterActive"><option value="true">Aktif</option><option value="false">Nonaktif</option></select></div><div class="master-modal-actions"><button type="button" class="master-cancel" id="masterCancel">Batal</button><button type="submit" class="master-save">Simpan</button></div></form></div>`;
    document.body.appendChild(modal);

    const cat=document.getElementById('masterCategory'); cat.innerHTML=CATEGORIES.map(([k,l])=>`<option value="${k}">${l}</option>`).join('');
    cat.addEventListener('change',renderList);
    document.getElementById('addMasterBtn').addEventListener('click',()=>openModal());
    document.getElementById('masterCancel').addEventListener('click',closeModal);
    document.getElementById('masterForm').addEventListener('submit',submitForm);
    window.__ensureMasterData=ensurePanel;
    window.__refreshMasterData=renderList;
    await renderList();
  }

  function openModal(row){
    const modal=document.getElementById('masterDataModal'); if(!modal) return;
    document.getElementById('masterModalTitle').textContent=row?'Edit Master Data':'Tambah Master Data';
    const cat=document.getElementById('masterCategory'); const value=document.getElementById('masterValue'); const sort=document.getElementById('masterSort'); const active=document.getElementById('masterActive');
    document.getElementById('masterForm').dataset.id=row?.id || '';
    if(row){cat.value=row.category; value.value=row.value; sort.value=row.sort_order ?? 0; active.value=row.active===false?'false':'true';}
    else{cat.value=cat.value || 'sumber'; value.value=''; sort.value='0'; active.value='true';}
    cat.disabled=!!row;
    modal.classList.add('show'); value.focus();
  }
  function closeModal(){ document.getElementById('masterDataModal')?.classList.remove('show'); }

  async function submitForm(e){
    e.preventDefault(); if(!isAdmin()) return;
    const form=e.target; const id=form.dataset.id; const category=document.getElementById('masterCategory').value; const value=document.getElementById('masterValue').value.trim(); const sort=Number(document.getElementById('masterSort').value||0); const active=document.getElementById('masterActive').value==='true';
    if(!value){ window.msg?.('Nilai master data wajib diisi.',true); return; }
    try{
      let result;
      if(id) result=await sb.from('master_data').update({value,sort_order:sort,active}).eq('id',id);
      else result=await sb.from('master_data').insert({category,value,sort_order:sort,active});
      if(result.error) throw result.error;
      closeModal(); await renderList();
      if(typeof loadOnlineData==='function') await loadOnlineData();
      if(typeof populateForm==='function') populateForm();
      if(typeof populateFilters==='function') populateFilters();
      window.msg?.('Master data berhasil disimpan.',false);
    }catch(err){ window.msg?.(err.message || 'Gagal menyimpan master data.',true); }
  }

  async function editRow(id){ const rows=await loadRows(document.getElementById('masterCategory').value); const row=rows.find(x=>x.id===id); if(row) openModal(row); }
  async function toggleRow(id,active){
    const rows=await loadRows(document.getElementById('masterCategory').value); const row=rows.find(x=>x.id===id); if(!row) return;
    if(!confirm(`${active?'Aktifkan':'Nonaktifkan'} "${row.value}"?`)) return;
    const {error}=await sb.from('master_data').update({active}).eq('id',id); if(error){window.msg?.(error.message,true);return;}
    await renderList(); if(typeof loadOnlineData==='function') await loadOnlineData(); if(typeof populateForm==='function') populateForm(); if(typeof populateFilters==='function') populateFilters();
  }
  async function deleteRow(id){
    const rows=await loadRows(document.getElementById('masterCategory').value); const row=rows.find(x=>x.id===id); if(!row) return;
    if(!confirm(`Hapus master data "${row.value}" secara permanen?`)) return;
    const {error}=await sb.from('master_data').delete().eq('id',id); if(error){window.msg?.(error.message,true);return;}
    await renderList(); if(typeof loadOnlineData==='function') await loadOnlineData(); if(typeof populateForm==='function') populateForm(); if(typeof populateFilters==='function') populateFilters();
  }

  async function renderList(){
    if(!isAdmin()) return;
    const tabs=document.getElementById('masterTabs'), list=document.getElementById('masterList'); const cat=document.getElementById('masterCategory'); if(!tabs||!list||!cat) return;
    tabs.innerHTML=CATEGORIES.map(([k,l])=>`<button class="master-tab ${k===cat.value?'active':''}" data-cat="${k}">${l}</button>`).join('');
    tabs.querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>{cat.value=b.dataset.cat; tabs.querySelectorAll('button').forEach(x=>x.classList.toggle('active',x===b)); renderList();}));
    list.innerHTML='<div class="master-empty">Memuat...</div>';
    try{
      const rows=await loadRows(cat.value);
      if(!rows.length){list.innerHTML='<div class="master-empty">Belum ada data pada kategori ini.</div>'; return;}
      list.innerHTML=rows.map(r=>`<div class="master-item ${r.active?'':'off'}"><div class="master-item-main"><b>${escHtml(r.value)}</b><small>Urutan ${Number(r.sort_order)||0} • ${r.active?'Aktif':'Nonaktif'}</small></div><div class="master-actions"><button onclick="window.__editMaster(${r.id})">Edit</button><button onclick="window.__toggleMaster(${r.id},${!r.active})">${r.active?'Nonaktifkan':'Aktifkan'}</button><button class="danger" onclick="window.__deleteMaster(${r.id})">Hapus</button></div></div>`).join('');
    }catch(err){list.innerHTML=`<div class="master-empty">Gagal memuat master data: ${escHtml(err.message)}</div>`;}
  }

  window.__editMaster=editRow; window.__toggleMaster=toggleRow; window.__deleteMaster=deleteRow;
  function boot(){
    if(!isAdmin()) return;
    let tries=0; const t=setInterval(async()=>{tries++; if(isAdmin() && document.getElementById('page-settings')){clearInterval(t); await ensurePanel();} if(tries>=40) clearInterval(t);},500);
    document.addEventListener('click',e=>{const b=e.target.closest('.nav button[data-page="settings"]'); if(b) setTimeout(()=>ensurePanel(),150);},true);
    window.addEventListener('focus',()=>setTimeout(ensurePanel,100));
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot); else boot();
})();
