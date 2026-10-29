(() => {
 'use strict';
 const $=id=>document.getElementById(id), E=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const date=v=>v?new Date(v+'T00:00:00').toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric'}):'—';
 const code=r=>'L-'+String(r.lead_no).padStart(4,'0');
 const options=(a,v='')=>a.map(x=>`<option value="${E(x)}" ${v===x?'selected':''}>${E(x)}</option>`).join('');
 const field=(label,name,type='text',value='',required=true)=>`<div class="field"><label for="j-${name}">${E(label)}${required?' *':''}</label><input id="j-${name}" name="${name}" type="${type}" value="${E(value)}" ${required?'required':''} ${type==='number'?'min="0" step="0.01"':''}></div>`;
 const select=(label,name,a,v)=>`<div class="field"><label for="j-${name}">${E(label)}</label><select id="j-${name}" name="${name}">${options(a,v)}</select></div>`;
 const note=(label,name,required=false)=>`<div class="field full"><label for="j-${name}">${label}${required?' *':''}</label><textarea id="j-${name}" name="${name}" rows="3" ${required?'required':''}></textarea></div>`;
 const money=v=>Number(v).toLocaleString('id-ID',{maximumFractionDigits:2});
 const akadOf=b=>Array.isArray(b.mmr_v2_akad)?b.mmr_v2_akad[0]:b.mmr_v2_akad;
 let seq=0,saving=false;
 const lists={visits:{page:0,seq:0,table:'mmr_v2_visits'},bookings:{page:0,seq:0,table:'mmr_v2_bookings'}};
 function errorText(e){if(e?.code==='23505')return e.message?.includes('active_unit')?'Unit ini sudah memiliki booking/akad aktif. Periksa kembali kode unit.':e.message?.includes('active_lead')?'Lead ini sudah memiliki booking aktif. Muat ulang detail.':'Catatan ini sudah tersimpan atau akad sudah tercatat. Muat ulang untuk memastikannya.';return e?.message||String(e);}
 function fail(id,e){const box=$(id);if(box){box.textContent=errorText(e);box.hidden=false;}}
 async function open(id,tab='summary'){
  const token=++seq,d=$('journey-dialog');if(!d.open)d.showModal();
  d.innerHTML='<h2>Memuat perjalanan konsumen...</h2><p id="journey-error" role="alert" class="error" hidden></p><button class="btn secondary" data-journey-close>Tutup</button>';
  try{
   const [lr,vr,br]=await Promise.all([
    sb.from('mmr_v2_pipeline').select('*').eq('id',id).single(),
    sb.from('mmr_v2_visits').select('*').eq('lead_id',id).order('created_at',{ascending:false}).range(0,29),
    sb.from('mmr_v2_bookings').select('*,mmr_v2_akad(*)').eq('lead_id',id).order('created_at',{ascending:false}).range(0,29)
   ]);
   if(token!==seq||!d.open)return;for(const r of [lr,vr,br])if(r.error)throw r.error;
   const l=lr.data,visits=vr.data,bookings=br.data,active=bookings.find(b=>b.status!=='Batal'),terminal=['Batal','Akad'].includes(l.pipeline_status);
   const canBook=!terminal&&!active&&visits.length>0,canAkad=active?.status==='Booking';
   d.innerHTML=`<div class="panel-head"><div><h2>${E(code(l))} • ${E(l.nama)}</h2><small>Status: <b>${E(l.pipeline_status)}</b> • ${E(l.telepon)}</small></div><button class="btn secondary" data-journey-close>Tutup</button></div><div class="journey-tabs"><button data-tab="summary" class="btn secondary">Riwayat</button><button data-tab="visit" class="btn secondary" ${terminal?'disabled':''}>+ Kunjungan</button><button data-tab="booking" class="btn secondary" ${canBook?'':'disabled'}>+ Booking</button><button data-tab="akad" class="btn secondary" ${canAkad?'':'disabled'}>Catat Akad</button>${canAkad&&document.body.dataset.userRole==='admin'?'<button data-tab="cancel" class="btn danger">Batalkan Booking</button>':''}</div><p id="journey-error" class="error" role="alert" hidden></p><div id="journey-content"></div>`;
   d.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>render(b.dataset.tab));
   function render(mode){
    if(saving)return;
    if(mode==='summary'){
     $('journey-content').innerHTML=`<p class="notice">Alur: Leads → Follow-up → Kunjungan → Booking → Akad. Booking memerlukan kunjungan terlebih dahulu. Setiap unit dan lead hanya boleh memiliki satu booking/akad aktif. Nominal booking adalah catatan, bukan bukti penerimaan pembayaran.</p><h3>Kunjungan terakhir (maksimal 30)</h3>${visits.length?visits.map(v=>`<article><b>${date(v.tanggal)} • ${E(v.unit)}</b><br>Sales: ${E(v.sales)} • Minat: ${E(v.minat)}<br>Keberatan: ${E(v.keberatan||'—')}<br>${E(v.tindak_lanjut)}<br><small>Follow-up: ${date(v.next_followup)}</small></article>`).join(''):'<p>Belum ada kunjungan. Pilih + Kunjungan untuk memulai.</p>'}<h3>Booking & Akad (maksimal 30)</h3>${bookings.length?bookings.map(b=>{const a=akadOf(b);return `<article><b>${date(b.tanggal)} • ${E(b.unit)} • ${E(b.status)}</b><br>${E(b.pembayaran)} • Nominal booking: ${money(b.nominal_booking)}<br>${E(b.catatan)}${b.status==='Batal'?'<br>Alasan batal: '+E(b.alasan_batal):''}${a?'<br>Akad: '+date(a.tanggal)+' • '+E(a.nomor_referensi)+'<br>'+E(a.catatan):''}</article>`;}).join(''):'<p>Belum ada booking.</p>'}`;return;
    }
    if((mode==='visit'&&terminal)||(mode==='booking'&&!canBook)||(mode==='akad'&&!canAkad)||(mode==='cancel'&&(!canAkad||document.body.dataset.userRole!=='admin')))return;
    let fields='',title='';
    if(mode==='visit'){title='Catat Kunjungan';fields=field('Tanggal kunjungan','tanggal','date',today())+field('Sales pendamping','sales','text',document.body.dataset.userName||l.sales)+field('Unit / tipe yang dilihat','unit','text',l.tipe_unit)+select('Minat','minat',['Tinggi','Sedang','Rendah'],'Sedang')+select('Keberatan utama','keberatan',['','Harga','Lokasi','Proses KPR / BI Checking','Desain / Tipe rumah','Masih menunda','Lainnya'],'')+field('Follow-up berikut','next_followup','date',today())+note('Tindak lanjut','tindak_lanjut');}
    if(mode==='booking'){title='Catat Booking';fields=field('Tanggal booking','tanggal','date',today())+field('Kode unit / kavling (contoh A-01)','unit')+select('Metode pembayaran','pembayaran',['KPR','Cash Keras','Cash Bertahap'],'KPR')+field('Nominal booking (catatan)','nominal_booking','number','0')+field('Follow-up berikut','next_followup','date',today())+note('Catatan','catatan');}
    if(mode==='akad'){title='Catat Akad • '+active.unit;fields=field('Tanggal akad','tanggal','date',today())+field('Nomor dokumen / referensi akad','nomor_referensi')+note('Catatan akad','catatan');}
    if(mode==='cancel'){title='Batalkan Booking • '+active.unit;fields=field('Follow-up setelah pembatalan','next_followup','date',today())+note('Alasan pembatalan','alasan_batal',true);}
    $('journey-content').innerHTML=`<h3>${E(title)}</h3>${mode==='booking'?'<p class="notice">Isi kode unit yang spesifik, bukan hanya tipe rumah. Pembatalan booking dilakukan oleh Administrator.</p>':''}<form id="journey-form"><div class="form-grid">${fields}</div><div class="modal-actions"><button type="button" class="btn secondary" id="journey-back">Kembali</button><button class="btn primary" type="submit">${mode==='cancel'?'Simpan Pembatalan':'Simpan'}</button></div></form>`;
    $('journey-back').onclick=()=>render('summary');const f=$('journey-form'),newId=crypto.randomUUID();f.querySelector('input,select,textarea')?.focus();
    f.onsubmit=async e=>{
     e.preventDefault();if(saving)return;saving=true;$('journey-error').hidden=true;f.querySelector('[type=submit]').disabled=true;
     try{
      const auth=await sb.auth.getUser();if(auth.error||!auth.data.user)throw Error('Sesi berakhir. Masuk kembali.');const p=Object.fromEntries(new FormData(f));for(const k of Object.keys(p))p[k]=p[k].trim();
      if(p.next_followup&&p.tanggal&&p.next_followup<p.tanggal)throw Error('Follow-up berikutnya tidak boleh mendahului tanggal transaksi.');
      let result;
      if(mode==='cancel'){if(!p.alasan_batal)throw Error('Isi alasan pembatalan.');if(!confirm('Batalkan booking '+active.unit+'? Riwayat akan tetap tersimpan.'))return;result=await sb.from('mmr_v2_bookings').update({...p,status:'Batal'}).eq('id',active.id).eq('updated_at',active.updated_at).select('id');if(!result.error&&!result.data.length)throw Error('Booking sudah berubah. Tutup dan muat ulang detail.');}
      else{const body={...p,id:newId,created_by:auth.data.user.id};if(mode==='akad')body.booking_id=active.id;else body.lead_id=id;if(mode==='booking')body.nominal_booking=Number(p.nominal_booking);const table={visit:'mmr_v2_visits',booking:'mmr_v2_bookings',akad:'mmr_v2_akad'}[mode];result=await sb.from(table).insert(body);}
      if(result.error)throw result.error;
      saving=false;document.dispatchEvent(new CustomEvent('mmr:lead-changed'));await open(id);
     }catch(err){fail('journey-error',err);}finally{saving=false;if(f.isConnected)f.querySelector('[type=submit]').disabled=false;}
    };
   }
   render(tab);
  }catch(e){if(token===seq)fail('journey-error',e);}
 }
 async function loadList(kind){
  const cfg=lists[kind],token=++cfg.seq,prefix='journey-'+kind;
  $(prefix+'-error').hidden=true;$(prefix+'-body').innerHTML='<tr><td colspan="8" class="empty">Memuat data...</td></tr>';
  try{
   const from=$(prefix+'-from').value,to=$(prefix+'-to').value;if(from&&to&&from>to)throw Error('Periode awal melewati periode akhir.');
   const relation=kind==='bookings'?',mmr_v2_akad(tanggal,nomor_referensi)':'';
   let q=sb.from(cfg.table).select('*,mmr_v2_leads(id,lead_no,nama,sales)'+relation,{count:'exact'}).order('tanggal',{ascending:false}).order('created_at',{ascending:false}).order('id').range(cfg.page*50,cfg.page*50+49);
   const term=$(prefix+'-search').value.trim();if(term)q=q.ilike('unit','%'+term.replace(/[%_]/g,'')+'%');if(from)q=q.gte('tanggal',from);if(to)q=q.lte('tanggal',to);if(kind==='bookings'&&$(prefix+'-status').value)q=q.eq('status',$(prefix+'-status').value);
   const r=await q;if(token!==cfg.seq)return;if(r.error)throw r.error;
   if(!r.data.length&&cfg.page>0){cfg.page--;return loadList(kind);}
   $(prefix+'-body').innerHTML=r.data.length?r.data.map(x=>{const l=x.mmr_v2_leads,a=kind==='bookings'?akadOf(x):null;return `<tr><td class="nowrap">${date(x.tanggal)}</td><td><b>${E(l?.nama||'—')}</b><br>${l?E(code(l)):''}</td><td>${E(x.unit)}</td>${kind==='visits'?`<td>${E(x.sales)}</td><td>${E(x.minat)}</td><td>${E(x.keberatan||'—')}</td><td>${E(x.tindak_lanjut||'—')}</td>`:`<td>${E(x.pembayaran)}</td><td class="money">${money(x.nominal_booking)}</td><td>${E(x.status)}</td><td>${a?date(a.tanggal)+'<br>'+E(a.nomor_referensi):'—'}</td>`}<td><button class="iconbtn" data-open-lead="${E(x.lead_id)}">Detail</button></td></tr>`;}).join(''):'<tr><td colspan="8" class="empty">Belum ada data yang sesuai filter. Mulai dari menu Leads & Follow-up.</td></tr>';
   $(prefix+'-count').textContent=`${r.count||0} catatan • halaman ${cfg.page+1} / ${Math.max(1,Math.ceil((r.count||0)/50))}`;$(prefix+'-prev').disabled=cfg.page===0;$(prefix+'-next').disabled=(cfg.page+1)*50>=(r.count||0);
  }catch(e){if(token!==cfg.seq)return;fail(prefix+'-error',e);$(prefix+'-body').innerHTML='<tr><td colspan="8" class="empty">Data belum dapat dimuat. Pilih Muat Ulang.</td></tr>';}
 }
 function init(){
  document.querySelector('.nav').insertAdjacentHTML('beforeend','<button data-page="crm-visits">Kunjungan Leads</button><button data-page="crm-bookings">Booking & Akad</button>');
  for(const kind of ['visits','bookings']){
   const prefix='journey-'+kind,title=kind==='visits'?'Kunjungan Leads':'Booking & Akad',heads=kind==='visits'?['Tanggal','Lead','Unit Dilihat','Sales Pendamping','Minat','Keberatan','Tindak Lanjut','Aksi']:['Booking','Lead','Unit / Kavling','Pembayaran','Nominal Booking','Status','Akad / Referensi','Aksi'];
   document.querySelector('.content').insertAdjacentHTML('beforeend',`<section class="page crm" id="page-crm-${kind}"><div class="panel"><div class="panel-head"><div><h2>${title}</h2><small class="hint">Setiap catatan terhubung dengan lead</small></div><button class="btn primary" id="${prefix}-choose">Pilih Lead</button></div><div class="filters"><div class="field"><label for="${prefix}-search">CARI UNIT</label><input id="${prefix}-search" placeholder="Kode / tipe unit"></div><div class="field"><label for="${prefix}-from">DARI</label><input type="date" id="${prefix}-from"></div><div class="field"><label for="${prefix}-to">SAMPAI</label><input type="date" id="${prefix}-to"></div>${kind==='bookings'?`<div class="field"><label for="${prefix}-status">STATUS</label><select id="${prefix}-status"><option value="">Semua status</option>${options(['Booking','Akad','Batal'])}</select></div>`:''}<button class="btn secondary" id="${prefix}-reload">Muat Ulang</button></div><p class="hint">${kind==='visits'?'Catat kunjungan melalui tombol Kunjungan / Closing pada daftar Leads. Data Kunjungan lama tetap tersedia pada menu sebelumnya.':'Periode berdasarkan tanggal booking. Akad tercatat pada booking terkait. Nominal booking tidak mewakili penerimaan kas.'}</p><div id="${prefix}-error" class="error" role="alert" hidden></div><div class="table-wrap"><table><thead><tr>${heads.map(h=>'<th>'+h+'</th>').join('')}</tr></thead><tbody id="${prefix}-body"></tbody></table></div><div class="pager"><span id="${prefix}-count"></span><div class="actions"><button class="btn secondary" id="${prefix}-prev">Sebelumnya</button><button class="btn secondary" id="${prefix}-next">Berikutnya</button></div></div></div></section>`);
   $(prefix+'-choose').onclick=()=>window.go('leads');$(prefix+'-reload').onclick=()=>loadList(kind);$(prefix+'-prev').onclick=()=>{if(lists[kind].page>0){lists[kind].page--;loadList(kind);}};$(prefix+'-next').onclick=()=>{lists[kind].page++;loadList(kind);};
   let timer;$(prefix+'-search').oninput=()=>{clearTimeout(timer);timer=setTimeout(()=>{lists[kind].page=0;loadList(kind);},300);};['from','to',...(kind==='bookings'?['status']:[])].forEach(s=>$(prefix+'-'+s).onchange=()=>{lists[kind].page=0;loadList(kind);});$(prefix+'-body').onclick=e=>{const b=e.target.closest('[data-open-lead]');if(b)open(b.dataset.openLead);};
  }
  document.body.insertAdjacentHTML('beforeend','<dialog class="crm-dialog" id="journey-dialog" aria-label="Kunjungan Booking dan Akad"></dialog>');
  $('journey-dialog').addEventListener('click',e=>{if(e.target.closest('[data-journey-close]')&&!saving)$('journey-dialog').close();});$('journey-dialog').addEventListener('cancel',e=>{if(saving)e.preventDefault();});$('journey-dialog').addEventListener('close',()=>{seq++;});
  document.addEventListener('mmr:navigate',e=>{const kind=e.detail==='crm-visits'?'visits':e.detail==='crm-bookings'?'bookings':null;if(kind){lists[kind].page=0;loadList(kind);}});
  document.addEventListener('mmr:lead-changed',()=>{for(const kind of ['visits','bookings'])if($('page-crm-'+kind).classList.contains('active'))loadList(kind);});
  sb.auth.onAuthStateChange(event=>{if(event==='SIGNED_OUT'){seq++;$('journey-dialog').close();for(const [kind,cfg] of Object.entries(lists)){cfg.seq++;$('journey-'+kind+'-body').innerHTML='';$('journey-'+kind+'-count').textContent='';}}});
  window.mmrJourney={open};
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
