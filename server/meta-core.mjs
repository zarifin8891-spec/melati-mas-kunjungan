import { randomUUID, randomBytes, createHash, createHmac, createCipheriv, createDecipheriv } from 'node:crypto';
import configuration from '../config/meta-integration.json' with { type: 'json' };
import { readWeeklyInsights } from './meta-insights.mjs';
const SCOPE='development', COOKIE='__Host-mmr-meta-state';
const REQUIRED=['instagram_basic','instagram_manage_insights','pages_show_list','pages_read_engagement','read_insights'];
export class SafeError extends Error { constructor(code,status=400,providerCode,providerSubcode){super(code);this.status=status;if(Number.isSafeInteger(providerCode))this.providerCode=providerCode;if(Number.isSafeInteger(providerSubcode))this.providerSubcode=providerSubcode;} }
const hash=s=>createHash('sha256').update(s).digest('hex');
export function seal(data,key){const iv=randomBytes(12),c=createCipheriv('aes-256-gcm',key,iv);c.setAAD(Buffer.from('mmr-meta:'+SCOPE));return ['v1',iv.toString('base64url'),Buffer.concat([c.update(JSON.stringify(data),'utf8'),c.final()]).toString('base64url'),c.getAuthTag().toString('base64url')].join('.');}
export function unseal(value,key){const [v,i,d,t]=value.split('.');if(v!=='v1')throw new SafeError('credential_invalid',503);const c=createDecipheriv('aes-256-gcm',key,Buffer.from(i,'base64url'));c.setAAD(Buffer.from('mmr-meta:'+SCOPE));c.setAuthTag(Buffer.from(t,'base64url'));return JSON.parse(Buffer.concat([c.update(Buffer.from(d,'base64url')),c.final()]).toString('utf8'));}
export function settings(env){
 const required=['SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','META_APP_SECRET','META_TOKEN_ENCRYPTION_KEY','META_CALLBACK_URL','META_GRAPH_VERSION'];
 const missing=required.filter(k=>!env[k]);
 if(env.META_ENABLED!=='true'||env.VERCEL_ENV!=='preview')missing.push('PREVIEW_ACTIVATION');
 if(missing.length)return {ready:false,missing};
 let callback;try{callback=new URL(env.META_CALLBACK_URL);}catch{throw new SafeError('callback_invalid',503);}
 if(callback.protocol!=='https:'||callback.username||callback.password||callback.pathname!=='/api/meta'||callback.search!=='?action=callback'||callback.hash)throw new SafeError('callback_invalid',503);
 if(!/^v\d+\.0$/.test(env.META_GRAPH_VERSION)||!/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(env.SUPABASE_URL))throw new SafeError('server_configuration_invalid',503);
 const key=Buffer.from(env.META_TOKEN_ENCRYPTION_KEY,'base64');if(key.length!==32||key.toString('base64')!==env.META_TOKEN_ENCRYPTION_KEY)throw new SafeError('encryption_key_invalid',503);
 return {ready:true,callback:callback.href,origin:callback.origin,key,version:env.META_GRAPH_VERSION,sb:env.SUPABASE_URL,service:env.SUPABASE_SERVICE_ROLE_KEY,secret:env.META_APP_SECRET};
}
export function createHandler({env=process.env,fetcher=fetch,clock=()=>Date.now()}={}){
 async function request(url,opts={},code='upstream_unavailable'){
  let r;try{r=await fetcher(url,{...opts,redirect:'error',signal:AbortSignal.timeout(12000)});}catch{throw new SafeError(code,502);}
  let data;try{data=await r.json();}catch{throw new SafeError(code,502);}
  if(!r.ok||data?.error){if(data?.error?.code===190)throw new SafeError('meta_reconnect_required',409);const failure=new SafeError(code,502,code==='meta_request_failed'?data?.error?.code:undefined,code==='meta_request_failed'?data?.error?.error_subcode:undefined);
   if(code==='meta_request_failed'){
    const message=typeof data?.error?.message==='string'?data.error.message:'';
    failure.permissions=['business_management','instagram_manage_messages','pages_manage_metadata','pages_messaging',...REQUIRED].filter(permission=>(message.match(/[a-z_]+/g)||[]).includes(permission));
   }
   throw failure;}return data;
 }
 function db(c,path,method='GET',body,representation=false){return request(c.sb+'/rest/v1/'+path,{method,headers:{apikey:c.service,Authorization:'Bearer '+c.service,'Content-Type':'application/json',Prefer:representation?'return=representation':'return=minimal'},...(body===undefined?{}:{body:JSON.stringify(body)})},'storage_unavailable');}
 async function profile(c,id){const rows=await db(c,'profiles?select=id,role,active&id=eq.'+encodeURIComponent(id));if(rows.length!==1||!rows[0].active||rows[0].role!=='admin')throw new SafeError('admin_required',403);return rows[0];}
 async function admin(c,req){const h=req.headers.authorization;if(typeof h!=='string'||!/^Bearer [^\s]+$/.test(h))throw new SafeError('login_required',401);
  let user;try{user=await request(c.sb+'/auth/v1/user',{headers:{apikey:c.service,Authorization:h}},'login_required');}catch{throw new SafeError('login_required',401);}
  if(!user.id)throw new SafeError('login_required',401);return profile(c,user.id);
 }
 async function graph(c,path,token,params={}){const u=new URL('https://graph.facebook.com/'+c.version+'/'+path);for(const [k,v]of Object.entries(params))u.searchParams.set(k,v);u.searchParams.set('appsecret_proof',createHmac('sha256',c.secret).update(token).digest('hex'));return request(u.href,{headers:{Authorization:'Bearer '+token}},'meta_request_failed');}
 async function connection(c){const rows=await db(c,'mmr_v2_meta_connections?scope=eq.'+SCOPE);return rows[0]||null;}
 async function patch(c,row,values){const rows=await db(c,'mmr_v2_meta_connections?scope=eq.'+SCOPE+'&revision=eq.'+row.revision,'PATCH',{...values,updated_at:new Date(clock()).toISOString()},true);if(rows.length!==1)throw new SafeError('connection_changed',409);return rows[0];}
 function checkOrigin(c,req){if(req.headers.origin!==c.origin)throw new SafeError('origin_denied',403);}
 function live(row){if(!row?.credential||row.status==='not_connected'||row.status==='reconnect_required')throw new SafeError('meta_reconnect_required',409);if(row.expires_at&&Date.parse(row.expires_at)<=clock())throw new SafeError('meta_reconnect_required',409);}
 async function assets(c,bundle){
  const token=bundle.token;
  // Business integration system-user tokens can expose authorized asset IDs via
  // token introspection instead of a personal user's /me/accounts edge.
  if(bundle.page_ids?.length){const pages=[];
   for(let offset=0;offset<bundle.page_ids.length;offset+=5){
    const batch=await Promise.all(bundle.page_ids.slice(offset,offset+5).map(async id=>{
     const p=await graph(c,id,token,{fields:'id,name,instagram_business_account{id,username}'});
     if(p.id!==id)throw new SafeError('asset_mismatch',409);
     return {...p,access_token:token};
    }));pages.push(...batch);
   }return pages;}

  let after;const pages=[];
  for(let n=0;n<10;n++){const r=await graph(c,'me/accounts',token,{fields:'id,name,access_token,instagram_business_account{id,username}',limit:'25',...(after?{after}:{})});
   if(!Array.isArray(r.data))throw new SafeError('asset_response_invalid',502);for(const p of r.data){if(/^\d+$/.test(p.id)&&p.access_token)pages.push(p);}
   if(!r.paging?.next)return pages;
   after=r.paging?.cursors?.after;if(!after)throw new SafeError('asset_pagination_invalid',502);
  }throw new SafeError('too_many_assets',422);
 }
 return async function handler(req,res){
  res.setHeader('Cache-Control','no-store, private');res.setHeader('Pragma','no-cache');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Content-Type-Options','nosniff');
  const send=(status,data)=>res.status(status).json(data);
  let action,c,row;
  try{
   const u=new URL(req.url,'https://internal.invalid');action=u.searchParams.get('action')||'status';
   if(!['status','start','callback','assets','select','disconnect','verify','weekly_insights','inbox','inbox_messages'].includes(action))throw new SafeError('not_found',404);
   const expected=['start','select','disconnect','verify','weekly_insights'].includes(action)?'POST':'GET';if(req.method!==expected)throw new SafeError('method_not_allowed',405);
   c=settings(env);
   // Without server credentials, return no account data and never enable controls.
   if(!c.ready){if(action==='status')return send(200,{configured:false,status:'not_configured',missing:c.missing});throw new SafeError('meta_not_configured',503);}
   if(req.headers.host!==new URL(c.origin).host)throw new SafeError('use_callback_host',409);
   if(action==='callback'){
    const state=u.searchParams.get('state')||'';
    const cookie=String(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith(COOKIE+'='))?.slice(COOKIE.length+1)||'';
    if(!/^[A-Za-z0-9_-]{43}$/.test(state)||!/^[A-Za-z0-9_-]{43}$/.test(cookie))throw new SafeError('oauth_state_invalid',400);
    const states=await db(c,'rpc/mmr_v2_meta_consume','POST',{p_state:hash(state),p_browser:hash(cookie)});
    res.setHeader('Set-Cookie',COOKIE+'=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0');
    if(states.length!==1)throw new SafeError('oauth_state_invalid',400);
    const s=states[0];await profile(c,s.admin_id);
    if(u.searchParams.has('error'))throw new SafeError('oauth_cancelled',400);
    const code=u.searchParams.get('code');if(!code||code.length>4096)throw new SafeError('oauth_code_missing',400);
    const token=await request('https://graph.facebook.com/'+c.version+'/oauth/access_token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:configuration.app_id,client_secret:c.secret,redirect_uri:c.callback,code}).toString()},'oauth_exchange_failed');
    if(typeof token.access_token!=='string'||!token.access_token)throw new SafeError('oauth_exchange_failed',502);
    const info=await graph(c,'debug_token',configuration.app_id+'|'+c.secret,{input_token:token.access_token});const d=info.data;
    if(!d?.is_valid||String(d.app_id)!==configuration.app_id||d.type!=='SYSTEM_USER')throw new SafeError('oauth_token_invalid',400);
    const scopes=Array.isArray(d.scopes)?d.scopes:[];if(REQUIRED.some(p=>!scopes.includes(p)))throw new SafeError('meta_permissions_missing',400);
    const expiries=[d.expires_at,d.data_access_expires_at].filter(t=>Number.isFinite(t)&&t>0).map(t=>t*1000);
    if(Number.isFinite(token.expires_in)&&token.expires_in>0)expiries.push(clock()+token.expires_in*1000);
    if(!expiries.length)throw new SafeError('token_expiry_unconfirmed',400);
    const expires=Math.min(...expiries);if(expires<=clock())throw new SafeError('meta_reconnect_required',409);
    const pageIds=[...new Set((Array.isArray(d.granular_scopes)?d.granular_scopes:[]).filter(s=>['pages_show_list','pages_read_engagement','read_insights'].includes(s.scope)).flatMap(s=>Array.isArray(s.target_ids)?s.target_ids:[]).map(String).filter(id=>/^\d+$/.test(id)))];
    if(pageIds.length>50)throw new SafeError('too_many_assets',422);
    await profile(c,s.admin_id);
    await patch(c,s,{credential:seal({token:token.access_token,page_ids:pageIds},c.key),connected_by:s.admin_id,permissions:scopes,expires_at:new Date(expires).toISOString(),status:'awaiting_asset',page_id:null,page_name:null,instagram_id:null,instagram_username:null});
    res.statusCode=303;res.setHeader('Location',c.origin+'/?meta=authorized');return res.end();
   }
   const user=await admin(c,req);if(expected==='POST')checkOrigin(c,req);
   row=await connection(c);
   if(action==='status')return send(200,{configured:true,status:row?.expires_at&&Date.parse(row.expires_at)<=clock()?'reconnect_required':row?.status||'not_connected',page_id:row?.page_id||null,page_name:row?.page_name||null,instagram_username:row?.instagram_username||null,expires_at:row?.expires_at||null,revision:row?.revision||null});
   if(action==='start'){
    const state=randomBytes(32).toString('base64url'),browser=randomBytes(32).toString('base64url');
    await db(c,'rpc/mmr_v2_meta_start','POST',{p_admin:user.id,p_state:hash(state),p_browser:hash(browser)});
    res.setHeader('Set-Cookie',COOKIE+'='+browser+'; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600');
    const auth=new URL('https://www.facebook.com/'+c.version+'/dialog/oauth');for(const [k,v]of Object.entries({client_id:configuration.app_id,config_id:configuration.configuration_id,redirect_uri:c.callback,response_type:'code',override_default_response_type:'true',state}))auth.searchParams.set(k,v);
    return send(200,{authorization_url:auth.href});
   }
   const body=typeof req.body==='string'?JSON.parse(req.body):req.body||{};
   if(action==='disconnect'){
    if(row)await patch(c,row,{credential:null,revision:randomUUID(),status:'not_connected',permissions:[],expires_at:null,page_id:null,page_name:null,instagram_id:null,instagram_username:null,connected_by:null});
    return send(200,{status:'not_connected'});
   }
   live(row);const bundle=unseal(row.credential,c.key);
   if(action==='assets'||action==='select'){
    const all=await assets(c,bundle);
    if(action==='assets')return send(200,{revision:row.revision,assets:all.map(p=>({page_id:p.id,page_name:p.name,instagram_id:p.instagram_business_account?.id||null,instagram_username:p.instagram_business_account?.username||null}))});
    if(body.revision!==row.revision)throw new SafeError('connection_changed',409);
    const p=all.find(p=>p.id===body.page_id);if(!p?.instagram_business_account?.id)throw new SafeError('linked_instagram_required',400);
    if(p.instagram_business_account.username?.toLowerCase()!=='melatimasresidence')throw new SafeError('instagram_account_mismatch',400);
    if(p.id!==String(body.page_id)||p.instagram_business_account.id!==body.instagram_id)throw new SafeError('asset_mismatch',400);
    await patch(c,row,{credential:seal({token:bundle.token,page_ids:bundle.page_ids,page_token:p.access_token},c.key),page_id:p.id,page_name:String(p.name||''),instagram_id:p.instagram_business_account.id,instagram_username:p.instagram_business_account.username,status:'connected'});
    return send(200,{status:'connected'});
   }
   if(action==='inbox'||action==='inbox_messages'){
    if(row.status!=='connected'||!bundle.page_token)throw new SafeError('select_asset_first',409);
    const missing=['instagram_manage_messages','pages_manage_metadata'].filter(permission=>!row.permissions?.includes(permission));
    if(missing.length){const error=new SafeError('inbox_permissions_missing',409);error.permissions=missing;throw error;}
    const timestamp=clock();
    const context={kind:'instagram_thread',account:row.instagram_id,page:row.page_id};
    function readHandle(value,kind){
     let payload;try{if(typeof value!=='string'||value.length>8192)throw Error('invalid');payload=unseal(value,c.key);}catch{throw new SafeError('inbox_handle_invalid',400);}
     if(payload.kind!==kind||payload.account!==row.instagram_id||payload.page!==row.page_id||!Number.isFinite(payload.expires)||payload.expires<=timestamp)throw new SafeError('inbox_handle_invalid',400);
     return payload;
    }
    if(action==='inbox'){
     const cursor=u.searchParams.get('cursor');
     const after=cursor?readHandle(cursor,'instagram_cursor').after:null;
     const response=await graph(c,row.page_id+'/conversations',bundle.page_token,{
      platform:'instagram',fields:'id,updated_time,participants,messages.limit(1){id,message,created_time,from}',
      limit:'20',...(after?{after}:{})
     });
     if(!Array.isArray(response.data))throw new SafeError('inbox_response_invalid',502);
     const conversations=response.data.flatMap(thread=>{
      const sender=thread.participants?.data?.find(person=>person.id!==row.instagram_id);
      if(typeof thread.id!=='string'||!sender||!/^\d+$/.test(sender.id))return [];
      const latest=thread.messages?.data?.[0];
      return [{handle:seal({...context,thread:thread.id,sender:sender.id,username:String(sender.username||'').slice(0,150),expires:timestamp+15*60000},c.key),
       sender_id:sender.id,account_id:row.instagram_id,username:String(sender.username||'').slice(0,150),
       updated_at:thread.updated_time||null,last_message:typeof latest?.message==='string'?latest.message.slice(0,500):''}];
     });
     const next=response.paging?.next&&response.paging?.cursors?.after;
     return send(200,{conversations,next_cursor:typeof next==='string'?seal({...context,kind:'instagram_cursor',after:next,expires:timestamp+15*60000},c.key):null});
    }
    const handle=u.searchParams.get('handle')||'';
    if(handle.length>8192)throw new SafeError('inbox_handle_invalid',400);
    const thread=readHandle(handle,'instagram_thread');
    const response=await graph(c,encodeURIComponent(thread.thread)+'/messages',bundle.page_token,{fields:'id,message,created_time,from,to',limit:'20'});
    if(!Array.isArray(response.data))throw new SafeError('inbox_response_invalid',502);
    return send(200,{account_id:row.instagram_id,sender_id:thread.sender,username:thread.username,
     messages:response.data.slice(0,20).map(message=>({
      id:String(message.id||''),text:typeof message.message==='string'?message.message.slice(0,20000):'',
      created_at:message.created_time||null,outgoing:message.from?.id===row.instagram_id
     }))});
   }
   if(action==='weekly_insights'){
    if(row.status!=='connected'||!bundle.page_token)throw new SafeError('select_asset_first',409);
    if(!/^\d+$/.test(row.page_id)||!/^\d+$/.test(row.instagram_id))throw new SafeError('asset_mismatch',409);
    const report=await readWeeklyInsights({
     readGraph:(path,params)=>graph(c,path,bundle.page_token,params),
     pageId:row.page_id,instagramId:row.instagram_id,now:clock()
    });
    const checkedAt=new Date(clock()).toISOString();
    const snapshots=report.metrics.filter(item=>item.status==='available'&&Number.isSafeInteger(item.value)&&item.value>=0).map(item=>({
     scope:SCOPE,asset_id:item.platform==='Facebook'?row.page_id:row.instagram_id,
     platform:item.platform,metric:item.metric,start_date:report.start_date,end_date:report.end_date,
     value:item.value,timezone:report.timezone,checked_at:checkedAt
    }));
    if(snapshots.length)await request(c.sb+'/rest/v1/mmr_v2_meta_weekly?on_conflict=scope,asset_id,metric,start_date',{
     method:'POST',headers:{apikey:c.service,Authorization:'Bearer '+c.service,'Content-Type':'application/json',Prefer:'resolution=merge-duplicates,return=representation'},
     body:JSON.stringify(snapshots)
    },'statistics_save_failed');
    return send(200,{...report,checked_at:checkedAt,saved_count:snapshots.length});
   }
   if(action==='verify'){
    if(row.status!=='connected'||!bundle.page_token)throw new SafeError('select_asset_first',409);
    const page=await graph(c,row.page_id,bundle.page_token,{fields:'id,name,instagram_business_account{id,username}'});
    if(page.id!==row.page_id||page.instagram_business_account?.id!==row.instagram_id)throw new SafeError('asset_mismatch',409);
    return send(200,{verified:true,verified_at:new Date(clock()).toISOString(),page_id:page.id,instagram_id:row.instagram_id,statistics_synced:false});
   }
  }catch(e){
   if(c?.ready&&row&&e instanceof SafeError&&e.message==='meta_reconnect_required')try{await patch(c,row,{status:'reconnect_required'});}catch{}
   const safe=e instanceof SafeError?e:new SafeError('internal_error',500);
   // Never include provider error bodies, authorization codes, tokens or secrets.
   if(action==='callback'){res.setHeader('Set-Cookie',COOKIE+'=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0');res.setHeader('Content-Security-Policy',"default-src 'none'; frame-ancestors 'none'");res.setHeader('Content-Type','text/plain; charset=utf-8');res.statusCode=safe.status;return res.end('Koneksi Meta belum selesai ('+safe.message+'). Kembali ke Pengaturan aplikasi dan hubungkan ulang.');}
   return send(safe.status,{error:safe.message,...(safe.providerCode===undefined?{}:{meta_code:safe.providerCode}),...(safe.providerSubcode===undefined?{}:{meta_subcode:safe.providerSubcode}),...(safe.permissions?.length?{meta_permissions:safe.permissions}:{})});
  }
 };
}
