(() => {
 function init(){
  const nav=document.querySelector('.nav');
  nav.querySelector('[data-page="dashboard"]')?.remove();nav.querySelector('[data-page="kunjungan"]')?.remove();
  const names={'crm-dashboard':'Dashboard',leads:'Leads & Follow-up','crm-visits':'Kunjungan','crm-bookings':'Booking & Akad',social:'Media Sosial',settings:'Pengaturan'};
  for(const [page,name] of Object.entries(names)){const b=nav.querySelector('[data-page="'+page+'"]');if(b){b.textContent=name;nav.appendChild(b);}}
  document.querySelector('.topbar button[onclick="openForm()"]')?.remove();
  const foot=document.querySelector('.sidebar .foot');if(foot)foot.textContent='Melati Mas Residence • V2.0';
  const brand=document.querySelector('.sidebar .brand small');if(brand)brand.textContent='Pemasaran & Konsumen';
  const panel=document.createElement('div');panel.className='panel';panel.id='social-account-targets';
  const heading=document.createElement('h2');heading.textContent='Akun Media Sosial';heading.style.fontSize='15px';panel.appendChild(heading);
  const note=document.createElement('p');note.className='hint';note.textContent='Akun tujuan sudah dicatat. Pembacaan statistik otomatis menunggu izin akun resmi; saat ini pencatatan mingguan masih tersedia.';panel.appendChild(note);
  const list=document.createElement('div');panel.appendChild(list);document.getElementById('page-settings').appendChild(panel);
  fetch('./config/social-accounts.json',{cache:'no-cache'}).then(r=>{if(!r.ok)throw Error('Account configuration unavailable');return r.json();}).then(data=>{
   for(const account of data.accounts){const row=document.createElement('p');row.style.cssText='font-size:13px;margin:10px 0';
    const label=document.createElement('b');label.textContent=account.platform+' — ';row.appendChild(label);
    if(account.url){const link=document.createElement('a');const url=new URL(account.url);if(url.protocol!=='https:')continue;link.href=url.href;link.target='_blank';link.rel='noopener';link.textContent=account.name;row.appendChild(link);}else{const name=document.createElement('span');name.textContent=account.name;row.appendChild(name);}
    const status=document.createElement('small');status.style.cssText='display:block;color:#63758a;margin-top:3px';status.textContent='Akun tujuan tercatat • Izin statistik belum terhubung.';row.appendChild(status);list.appendChild(row);
   }
  }).catch(()=>{list.textContent='Daftar akun belum dapat dimuat. Muat ulang halaman.';});

 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
