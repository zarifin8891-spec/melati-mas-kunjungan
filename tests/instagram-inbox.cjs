const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{})});
 try{
 const p=await browser.newPage({viewport:{width:390,height:844}});
 const errors=[];p.on('pageerror',error=>errors.push(error.message));
 await p.route('https://crm.test/**',route=>{
  const url=new URL(route.request().url());
  if(url.pathname==='/api/meta'){
   const action=url.searchParams.get('action');
   const data=action==='inbox'?{conversations:[{handle:'opaque',account_id:'456',sender_id:'789',username:'customer',last_message:'<img src=x onerror=alert(1)>',updated_at:'2026-11-19T00:00:00Z'}],next_cursor:null}:
   {account_id:'456',sender_id:'789',username:'customer',messages:[{id:'m1',text:'<img src=x onerror=alert(1)>',created_at:'2026-11-19T00:00:00Z',outgoing:false}]};
   return route.fulfill({json:data});
  }
  return route.fulfill({contentType:'text/html',body:'<nav class="nav"></nav><div class="content"><section id="page-social" class="active"></section></div>'});
 });
 await p.goto('https://crm.test/');
 await p.evaluate(()=>{
  document.body.dataset.userRole='admin';document.body.dataset.userName='Sales';
  window.go=()=>{};
  window.sb={auth:{getSession:async()=>({data:{session:{access_token:'test'}}}),getUser:async()=>({data:{user:{id:'test'}}}),onAuthStateChange:()=>{}},
   from:()=>{const q={op:'read',filters:[],select(){return this;},eq(k,v){this.filters.push([k,v]);return this;},limit(){return this;},order(){return this;},range(){return this;},insert(v){this.op='insert';window.savedLead=v;return this;},then(resolve){resolve({data:this.op==='insert'?[{id:'new'}]:[],count:0});}};return q;}};
 });
 await p.addScriptTag({path:'crm-v2.js'});await p.addScriptTag({path:'crm-inbox.js'});
 await p.getByRole('button',{name:'Muat Inbox',exact:true}).click();
 await p.getByRole('button',{name:'Buka pesan',exact:true}).click();
 await p.getByRole('button',{name:'Jadikan Lead',exact:true}).click();
 await p.locator('#crm-telepon').fill('081234567890');
 await p.locator('#crm-lead-form button[type=submit]').click();
 await p.waitForFunction(()=>document.querySelector('#crm-dialog').open===false);
 const saved=await p.evaluate(()=>window.savedLead);
 assert.equal(saved.instagram_account_id,'456');assert.equal(saved.instagram_sender_id,'789');
 assert.equal(saved.sumber,'Instagram');assert.equal(saved.nama,'@customer');
 assert.equal(await p.locator('#instagram-inbox img').count(),0);
 assert.deepEqual(errors,[]);
 console.log('Inbox mobile flow passed: conversation, escaped message, lead form, saved identity.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exit(1);});
