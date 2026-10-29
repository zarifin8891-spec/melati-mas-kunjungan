(() => {
 'use strict';
 const $=id=>document.getElementById(id), E=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const stages=['Lead baru','Dihubungi','Jadwal survei','Batal'];
 const filterStages=['Lead baru','Dihubungi','Jadwal survei','Sudah survei','Booking','Akad','Batal'];
 const effective=r=>r.pipeline_status||r.status;
 const sources=['Instagram','TikTok','Threads','Facebook','YouTube','Iklan Meta','Iklan TikTok','WhatsApp Langsung','Referral','Pameran','Walk-in'];
 const phone=v=>{let p=String(v).replace(/\D/g,'');return p.startsWith('0')?'62'+p.slice(1):p;};
 const code=r=>'L-'+String(r.lead_no).padStart(4,'0');
 const date=v=>v?new Date(v+'T00:00:00').toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric'}):'—';
 const options=(a,value='')=>[...new Set([...a,...(value?[value]:[])])].map(v=>`<option value="${E(v)}" ${v===value?'selected':''}>${E(v)}</option>`).join('');
 let rows=[],page=0,total=0,request=0,busy=false,userId=null,timer;
 function showError(id,e){$(id).textContent=e?.message||String(e);$(id).hidden=false;}
 function openDialog(html){const d=$('crm-dialog');d.innerHTML=html;d.showModal();d.querySelector('input,select,textarea,button')?.focus();}
 const actions='<div class="modal-actions"><button type="button" class="btn secondary" data-close>Tutup</button><button type="submit" class="btn primary">Simpan</button></div>';
 const field=(label,name,value='',type='text',required=false)=>`<div class="field"><label for="crm-${name}">${E(label)}${required?' *':''}</label><input id="crm-${name}" name="${name}" type="${type}" value="${E(value)}" ${required?'required':''} ${type==='number'?'min="0" step="0.01"':''}></div>`;
 const select=(label,name,values,value='')=>`<div class="field"><label for="crm-${name}">${E(label)}</label><select id="crm-${name}" name="${name}">${options(values,value)}</select></div>`;
 async function session(){const r=await sb.auth.getUser();if(r.error||!r.data.user)throw Error('Sesi berakhir. Silakan masuk kembali.');userId=r.data.user.id;return userId;}
 async function load(){
  const seq=++request; $('crm-error').hidden=true;$('crm-body').innerHTML='<tr><td colspan="9" class="empty">Memuat leads...</td></tr>';
  try{
   let q=sb.from('mmr_v2_pipeline').select('*',{count:'exact'}).order('created_at',{ascending:false}).order('id').range(page*50,page*50+49);
   const term=$('crm-search').value.trim().replace(/[%_,().]/g,' '),st=$('crm-stage').value,due=$('crm-due').value;
   if(term)q=q.or(`nama.ilike.%${term}%,telepon.ilike.%${term}%,sales.ilike.%${term}%`);
   if(st)q=q.eq('pipeline_status',st);
   if(due==='late')q=q.lt('next_followup',today()).neq('pipeline_status','Batal').neq('pipeline_status','Akad');
   if(due==='today')q=q.eq('next_followup',today()).neq('pipeline_status','Batal').neq('pipeline_status','Akad');
   const r=await q;if(seq!==request)return;if(r.error)throw r.error;
   rows=r.data;total=r.count||0;
   if(!rows.length&&page>0){page--;return load();}
   $('crm-body').innerHTML=rows.length?rows.map(r=>{
    const overdue=!['Batal','Akad'].includes(effective(r))&&r.next_followup&&r.next_followup<today();
    return `<tr><td class="nowrap">${E(code(r))}<br><small>${date(r.tanggal_masuk)}</small></td><td><b>${E(r.nama)}</b><br><a href="https://wa.me/${phone(r.telepon)}" target="_blank" rel="noopener">${E(r.telepon)}</a></td><td>${E(r.sumber)}<br><small>${E(r.kampanye)}</small></td><td>${E(r.tipe_unit||'—')}</td><td class="money">${Number(r.budget).toLocaleString('id-ID',{maximumFractionDigits:2})}</td><td>${E(effective(r))}</td><td>${E(r.sales)}</td><td class="nowrap ${overdue?'late':''}">${effective(r)==='Akad'?'—':date(r.next_followup)}${overdue?'<br>TERLAMBAT':''}</td><td><div class="actions"><button class="iconbtn" data-edit="${r.id}">Edit</button><button class="iconbtn" data-follow="${r.id}">Follow-up</button><button class="iconbtn" data-journey="${r.id}">Kunjungan / Closing</button></div></td></tr>`;
   }).join(''):'<tr><td colspan="9" class="empty">Belum ada leads yang sesuai filter. Pilih + Lead Baru untuk mulai.</td></tr>';
   $('crm-count').textContent=`${total} leads • halaman ${page+1} / ${Math.max(1,Math.ceil(total/50))}`;$('crm-prev').disabled=page===0;$('crm-next').disabled=(page+1)*50>=total;
  }catch(e){if(seq!==request)return;showError('crm-error',e);$('crm-body').innerHTML='<tr><td colspan="9" class="empty">Data belum dapat dimuat. Pilih Muat Ulang.</td></tr>';}
 }
 function edit(id){
  const r=rows.find(x=>x.id===id)||{},editing=!!r.id;
  const src=[...sources,...(typeof values==='function'?values('sumber'):[])];
  openDialog(`<h2>${editing?'Edit '+E(code(r)):'Lead Baru'}</h2><p class="notice">Satu lead untuk satu calon pembeli. Catat sumber informasi dan tanggal follow-up berikutnya.</p><form id="crm-lead-form"><div class="form-grid">${field('Tanggal masuk','tanggal_masuk',r.tanggal_masuk||today(),'date',true)}${field('Nama','nama',r.nama,'text',true)}${field('Nomor WhatsApp','telepon',r.telepon,'tel',true)}${select('Sumber','sumber',src,r.sumber||'Walk-in')}${field('Konten / kampanye','kampanye',r.kampanye)}${field('Tipe unit diminati','tipe_unit',r.tipe_unit)}${field('Budget','budget',r.budget||0,'number')}${field('Sales','sales',r.sales||document.body.dataset.userName||'','text',true)}${select('Status','status',stages,r.status||'Lead baru')}${field('Follow-up berikut','next_followup',r.next_followup||today(),'date',true)}<div class="field full"><label for="crm-catatan">Catatan</label><textarea id="crm-catatan" name="catatan" rows="3">${E(r.catatan)}</textarea></div></div><p id="crm-form-error" class="error" role="alert" hidden></p>${actions}</form>`);
  const f=$('crm-lead-form'),newId=r.id||crypto.randomUUID();
  if(editing&&['Booking','Akad'].includes(effective(r)))f.elements.status.innerHTML=options([r.status],r.status);
  const sync=()=>{f.elements.next_followup.required=f.elements.status.value!=='Batal';};f.elements.status.onchange=sync;sync();
  f.onsubmit=async ev=>{
   ev.preventDefault();if(busy)return;busy=true;f.querySelector('[type=submit]').disabled=true;$('crm-form-error').hidden=true;
   try{
    await session();const p=Object.fromEntries(new FormData(f));for(const k of Object.keys(p))p[k]=p[k].trim();
    if(phone(p.telepon).length<8||phone(p.telepon).length>18)throw Error('Periksa nomor WhatsApp.');p.budget=Number(p.budget);p.next_followup=p.next_followup||null;
    if(!editing){const dupe=await sb.from('mmr_v2_leads').select('id').eq('telepon_normalized',phone(p.telepon)).limit(1);if(dupe.error)throw dupe.error;if(dupe.data.length&&!confirm('Nomor WhatsApp ini sudah terdaftar. Tetap buat lead terpisah?'))return;}
    const q=editing?sb.from('mmr_v2_leads').update(p).eq('id',r.id).eq('updated_at',r.updated_at):sb.from('mmr_v2_leads').insert({...p,id:newId,created_by:userId});
    const result=await q.select('id');if(result.error)throw result.error;if(!result.data.length)throw Error('Data telah berubah atau akses ditolak. Tutup form lalu muat ulang sebelum mengedit.');
    $('crm-dialog').close();await load();
   }catch(e){showError('crm-form-error',e);}finally{busy=false;if(f.isConnected)f.querySelector('[type=submit]').disabled=false;}
  };
 }
 async function follow(id){
  const r=rows.find(x=>x.id===id);if(!r)return;
  openDialog(`<h2>Follow-up • ${E(code(r))} ${E(r.nama)}</h2><div id="crm-history">Memuat riwayat...</div>${['Batal','Akad'].includes(effective(r))?'<p class="notice">Lead sudah Batal atau Akad. Riwayat tetap dapat dilihat.</p><button class="btn secondary" data-close>Tutup</button>':`<form id="crm-follow-form"><div class="form-grid">${field('Tanggal kontak','tanggal',today(),'date',true)}${select('Metode','metode',['WhatsApp','Telepon','Pertemuan','Lainnya'],'WhatsApp')}${field('Follow-up berikut','next_followup',r.next_followup||today(),'date',true)}<div class="field full"><label for="crm-hasil">Hasil / tindak lanjut *</label><textarea id="crm-hasil" name="hasil" rows="3" required></textarea></div></div><p id="crm-form-error" class="error" role="alert" hidden></p>${actions}</form>`}`);
  $('crm-dialog').dataset.context='follow-'+id;
  let offset=0;
  async function history(){const result=await sb.from('mmr_v2_followups').select('tanggal,metode,hasil,next_followup,created_at').eq('lead_id',id).order('created_at',{ascending:false}).range(offset,offset+29);
   if(!$('crm-history')||$('crm-dialog').dataset.context!=='follow-'+id||!$('crm-dialog').open)return;if(result.error){$('crm-history').textContent='Gagal memuat riwayat: '+result.error.message;return;}
   if(offset===0)$('crm-history').innerHTML='';$('crm-history-more')?.remove();
   $('crm-history').insertAdjacentHTML('beforeend',result.data.length?result.data.map(x=>`<article><b>${date(x.tanggal)} • ${E(x.metode)}</b><br>${E(x.hasil)}<br><small>Berikutnya: ${date(x.next_followup)}</small></article>`).join(''):(offset===0?'<p>Belum ada riwayat follow-up.</p>':''));
   if(result.data.length===30){$('crm-history').insertAdjacentHTML('beforeend','<button type="button" id="crm-history-more" class="btn secondary">Riwayat sebelumnya</button>');$('crm-history-more').onclick=()=>{offset+=30;history();};}
  }
  history();const f=$('crm-follow-form');if(!f)return;const newId=crypto.randomUUID();
  f.onsubmit=async ev=>{ev.preventDefault();if(busy)return;busy=true;f.querySelector('[type=submit]').disabled=true;
   try{await session();const p=Object.fromEntries(new FormData(f));p.hasil=p.hasil.trim();if(!p.hasil)throw Error('Isi hasil follow-up.');if(p.next_followup<p.tanggal)throw Error('Tanggal berikutnya harus sama atau setelah tanggal kontak.');const result=await sb.from('mmr_v2_followups').insert({...p,id:newId,lead_id:id,created_by:userId});if(result.error)throw result.error;$('crm-dialog').close();await load();}catch(e){showError('crm-form-error',e);}finally{busy=false;if(f.isConnected)f.querySelector('[type=submit]').disabled=false;}
  };
 }
 function init(){
  document.querySelector('.nav').insertAdjacentHTML('beforeend','<button data-page="leads">Leads & Follow-up</button>');
  document.querySelector('.content').insertAdjacentHTML('beforeend',`<section class="page crm" id="page-leads"><div class="panel"><div class="panel-head"><div><h2>Leads & Follow-up</h2><small class="hint">Pendataan calon pembeli • V2.0</small></div><button id="crm-add" class="btn primary">+ Lead Baru</button></div><div class="filters"><div class="field"><label for="crm-search">CARI NAMA / WA / SALES</label><input id="crm-search" placeholder="Ketik pencarian..."></div><div class="field"><label for="crm-stage">STATUS</label><select id="crm-stage"><option value="">Semua status</option>${options(filterStages)}</select></div><div class="field"><label for="crm-due">FOLLOW-UP</label><select id="crm-due"><option value="">Semua jadwal</option><option value="late">Terlambat</option><option value="today">Hari ini</option></select></div><button id="crm-reload" class="btn secondary">Muat Ulang</button></div><p class="hint">Petunjuk: tambah lead, lalu gunakan Follow-up untuk mencatat setiap kontak. Jadwal berikutnya diperbarui otomatis. Gunakan Kunjungan / Closing untuk mencatat kunjungan, booking dan akad. Status closing mengikuti transaksi yang tersimpan.</p><div id="crm-error" class="error" role="alert" hidden></div><div class="table-wrap"><table><thead><tr>${['ID / Masuk','Nama / WhatsApp','Sumber / Kampanye','Tipe Unit','Budget','Status','Sales','Follow-up','Aksi'].map(x=>'<th>'+x+'</th>').join('')}</tr></thead><tbody id="crm-body"></tbody></table></div><div class="pager"><span id="crm-count"></span><div class="actions"><button id="crm-prev" class="btn secondary">Sebelumnya</button><button id="crm-next" class="btn secondary">Berikutnya</button></div></div></div></section>`);
  document.body.insertAdjacentHTML('beforeend','<dialog class="crm-dialog" id="crm-dialog" aria-label="Form Leads dan Follow-up"></dialog>');
  $('crm-dialog').addEventListener('click',e=>{if(e.target.closest('[data-close]')&&!busy)$('crm-dialog').close();});$('crm-dialog').addEventListener('cancel',e=>{if(busy)e.preventDefault();});
  $('crm-add').onclick=()=>edit(null);$('crm-reload').onclick=()=>load();$('crm-prev').onclick=()=>{if(page>0){page--;load();}};$('crm-next').onclick=()=>{if((page+1)*50<total){page++;load();}};
  $('crm-search').oninput=()=>{clearTimeout(timer);timer=setTimeout(()=>{page=0;load();},300);};['crm-stage','crm-due'].forEach(id=>$(id).onchange=()=>{page=0;load();});
  $('crm-body').onclick=e=>{const b=e.target.closest('button');if(b?.dataset.edit)edit(b.dataset.edit);if(b?.dataset.follow)follow(b.dataset.follow);if(b?.dataset.journey)window.mmrJourney?.open(b.dataset.journey);};
  document.addEventListener('mmr:lead-changed',()=>{if($('page-leads').classList.contains('active'))load();});
  document.addEventListener('mmr:navigate',e=>{if(e.detail==='leads'){page=0;load();}});
  sb.auth.onAuthStateChange(event=>{if(event==='SIGNED_OUT'){request++;rows=[];userId=null;$('crm-body').innerHTML='';$('crm-count').textContent='';$('crm-dialog').close();}else if(event==='SIGNED_IN'&&$('page-leads').classList.contains('active'))setTimeout(load,0);});
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
