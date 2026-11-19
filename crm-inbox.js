(() => {
 'use strict';
 let host, list, detail, status, next=null, busy=false, generation=0, selected=null;
 const errors={
  inbox_permissions_missing:'Izin DM belum aktif. Tambahkan instagram_manage_messages dan pages_manage_metadata pada konfigurasi Meta, lalu hubungkan ulang melalui Pengaturan.',
  inbox_handle_invalid:'Daftar percakapan sudah kedaluwarsa atau akun berubah. Muat ulang Inbox.',
  select_asset_first:'Pilih akun Instagram melalui Pengaturan terlebih dahulu.',
  meta_reconnect_required:'Hubungkan kembali akun Meta melalui Pengaturan.',
  admin_required:'Inbox Instagram hanya dapat dibuka administrator.',
  login_required:'Sesi berakhir. Silakan masuk kembali.',
  meta_request_failed:'Meta menolak akses pesan. Periksa izin DM dan persyaratan aplikasi Meta.',
  meta_not_configured:'Koneksi Meta belum dikonfigurasi.'
 };
 const time=value=>value?new Date(value).toLocaleString('id-ID',{timeZone:'Asia/Jakarta'})+' WIB':'—';
 function text(tag,value,parent){const el=document.createElement(tag);el.textContent=value;parent.appendChild(el);return el;}
 function action(label,callback,parent){
  const b=text('button',label,parent);b.type='button';b.className='btn secondary';
  b.onclick=async()=>{
   if(busy)return;
   busy=true;b.disabled=true;
   try{await callback();}catch(error){status.textContent=error.name==='TimeoutError'?'Permintaan terlalu lama. Coba muat ulang Inbox.':error.message;}
   finally{busy=false;if(b.isConnected)b.disabled=false;}
  };return b;
 }
 async function api(actionName,params={}){
  const session=await sb.auth.getSession();
  if(session.error||!session.data.session)throw Error(errors.login_required);
  const url=new URL('/api/meta',location.origin);
  url.searchParams.set('action',actionName);
  Object.entries(params).forEach(([key,value])=>url.searchParams.set(key,value));
  const response=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(20000),headers:{Authorization:'Bearer '+session.data.session.access_token}});
  let result;try{result=await response.json();}catch{throw Error('Backend Inbox belum dapat diakses.');}
  if(!response.ok){
   const names=Array.isArray(result.meta_permissions)?result.meta_permissions.filter(name=>['instagram_manage_messages','pages_manage_metadata','pages_messaging','instagram_basic','business_management'].includes(name)):[];
   const code=(Number.isSafeInteger(result.meta_code)?' (Kode Meta '+result.meta_code+')':'')+(names.length?' Izin yang disebut Meta: '+names.join(', '):'');
   throw Error((errors[result.error]||'Inbox belum dapat dimuat. Coba lagi.')+code);
  }
  return result;
 }
 async function convert(){
  if(!selected)return;
  const seq=generation,person=selected;
  const result=await sb.from('mmr_v2_leads').select('lead_no').eq('instagram_account_id',person.account_id).eq('instagram_sender_id',person.sender_id).limit(1);
  if(seq!==generation)return;
  if(result.error)throw Error('Belum dapat memeriksa lead. Coba lagi.');
  if(result.data.length){status.textContent='Pengirim ini sudah tercatat sebagai lead L-'+String(result.data[0].lead_no).padStart(4,'0')+'. Buka Leads & Follow-up untuk melanjutkan.';return;}
  document.dispatchEvent(new CustomEvent('mmr:instagram-lead',{detail:{
   nama:person.username?'@'+person.username:'Pengirim Instagram',sumber:'Instagram',
   catatan:'Percakapan Instagram '+(person.username?'@'+person.username:person.sender_id)+'\n'+(person.last_message||''),
   instagram_account_id:person.account_id,instagram_sender_id:person.sender_id
  }}));
 }
 async function openConversation(person){
  const seq=++generation;selected=null;detail.replaceChildren();
  status.textContent='Memuat pesan…';
  const result=await api('inbox_messages',{handle:person.handle});
  if(seq!==generation)return;
  selected={...person,...result};
  text('h3',person.username?'@'+person.username:'Pengirim '+person.sender_id,detail);
  text('p','Maksimal 20 pesan terbaru yang tersedia melalui Meta. Waktu ditampilkan dalam WIB.',detail).className='hint';
  action('Jadikan Lead',convert,detail);
  for(const message of [...result.messages].reverse()){
   const article=document.createElement('article');article.style.cssText='padding:10px 0;border-bottom:1px solid #e6eaf0';
   text('small',(message.outgoing?'Melati Mas':'Konsumen')+' • '+time(message.created_at),article);
   const content=text('p',message.text||'Pesan tanpa teks atau jenis konten belum didukung.',article);content.style.whiteSpace='pre-wrap';
   detail.appendChild(article);
  }
  if(!result.messages.length)text('p','Tidak ada detail pesan yang dapat dibaca.',detail);
  status.textContent='Percakapan berhasil dimuat.';
 }
 async function load(append=false){
  if(document.body.dataset.userRole!=='admin'){status.textContent=errors.admin_required;return;}
  const seq=++generation;
  status.textContent='Memuat daftar percakapan Instagram…';
  const result=await api('inbox',append&&next?{cursor:next}:{});
  if(seq!==generation)return;
  if(!append){list.replaceChildren();detail.replaceChildren();selected=null;}
  list.querySelector('[data-inbox-more]')?.remove();
  for(const person of result.conversations){
   const article=document.createElement('article');article.style.cssText='padding:10px 0;border-bottom:1px solid #e6eaf0';
   text('strong',person.username?'@'+person.username:'Pengirim '+person.sender_id,article);
   text('p',person.last_message||'Pesan tanpa teks',article);
   text('small',time(person.updated_at),article);
   action('Buka pesan',()=>openConversation(person),article);
   list.appendChild(article);
  }
  next=result.next_cursor;
  if(next)action('Percakapan berikutnya',()=>load(true),list).dataset.inboxMore='true';
  if(!list.children.length)text('p','Tidak ada percakapan yang dikembalikan Meta.',list);
  status.textContent='Daftar percakapan berhasil dimuat.';
 }
 function init(){
  const social=document.getElementById('page-social');if(!social)return;
  host=document.createElement('div');host.className='panel';host.id='instagram-inbox';
  text('h2','Inbox Instagram',host);
  text('p','@melatimasresidence • Akses administrator',host).className='hint';
  status=text('p','Klik Muat Inbox untuk membaca percakapan yang diizinkan Meta.',host);status.setAttribute('role','status');
  action('Muat Inbox',()=>load(),host);
  list=document.createElement('div');detail=document.createElement('div');host.append(list,detail);social.appendChild(host);
  const visibility=()=>{host.hidden=document.body.dataset.userRole!=='admin';};
  visibility();
  document.addEventListener('mmr:navigate',visibility);
  sb.auth.onAuthStateChange(event=>{if(event==='SIGNED_OUT'){generation++;selected=null;next=null;list.replaceChildren();detail.replaceChildren();status.textContent='Masuk sebagai administrator untuk membuka Inbox.';host.hidden=true;}});
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
