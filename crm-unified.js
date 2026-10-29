(() => {
 function init(){
  const nav=document.querySelector('.nav');
  nav.querySelector('[data-page="dashboard"]')?.remove();nav.querySelector('[data-page="kunjungan"]')?.remove();
  const names={'crm-dashboard':'Dashboard',leads:'Leads & Follow-up','crm-visits':'Kunjungan','crm-bookings':'Booking & Akad',social:'Media Sosial',settings:'Pengaturan'};
  for(const [page,name] of Object.entries(names)){const b=nav.querySelector('[data-page="'+page+'"]');if(b){b.textContent=name;nav.appendChild(b);}}
  document.querySelector('.topbar button[onclick="openForm()"]')?.remove();
  const foot=document.querySelector('.sidebar .foot');if(foot)foot.textContent='Melati Mas Residence • V2.0';
  const brand=document.querySelector('.sidebar .brand small');if(brand)brand.textContent='Pemasaran & Konsumen';
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
