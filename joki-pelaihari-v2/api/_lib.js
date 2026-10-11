import {createHmac} from 'node:crypto';

export const configured=()=>Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_PUBLISHABLE_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.JP_ADMIN_EMAILS);
const cfg=()=>({
 url:(process.env.SUPABASE_URL||'').replace(/\/+$/,''),
 pub:process.env.SUPABASE_PUBLISHABLE_KEY||'',
 secret:process.env.SUPABASE_SERVICE_ROLE_KEY||''
});
export const send=(res,status,obj)=>{
 res.setHeader('Cache-Control','no-store, max-age=0');
 res.setHeader('X-Content-Type-Options','nosniff');
 return res.status(status).json(obj);
};
export const str=(s,max=300)=>typeof s==='string'?s.trim().slice(0,max):'';
export const uuid=x=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x);
export const sameOrigin=req=>{
 const origin=req.headers.origin;
 if(!origin)return false;
 try{const u=new URL(origin);return u.protocol==='https:' && u.host===req.headers.host;}catch{return false;}
};
export const payload=(req,max=16000)=>{
 if(!String(req.headers['content-type']||'').startsWith('application/json'))throw Object.assign(new Error('JSON diperlukan'),{status:415});
 const size=Number(req.headers['content-length']||0);
 if(size>max)throw Object.assign(new Error('Data terlalu besar'),{status:413});
 const body=req.body;
 if(!body||typeof body!=='object'||Array.isArray(body)||JSON.stringify(body).length>max)throw Object.assign(new Error('Format data tidak valid'),{status:400});
 return body;
};
export const readCookies=req=>Object.fromEntries((req.headers.cookie||'').split(';').map(x=>x.trim()).filter(Boolean).map(x=>{const i=x.indexOf('=');return [x.slice(0,i),x.slice(i+1)];}));
const cookie=(key,val,age)=>key+'='+encodeURIComponent(val)+'; Path=/; HttpOnly; Secure; SameSite=Strict; '+(age?'Max-Age='+age:'Max-Age=0');
export const writeSession=(res,tokens)=>{
 res.setHeader('Set-Cookie',[
  cookie('__Host-jp-access',tokens.access_token,Math.min(Math.max(Number(tokens.expires_in)||3600,300),7200)),
  cookie('__Host-jp-refresh',tokens.refresh_token,7*24*3600)
 ]);
};
export const clearSession=res=>res.setHeader('Set-Cookie',[cookie('__Host-jp-access','',0),cookie('__Host-jp-refresh','',0)]);
export async function supa(path,{method='GET',body,token,service=false,query}={}){
 const c=cfg();
 if(!configured())throw Object.assign(new Error('Database belum dikonfigurasi'),{status:503});
 const p=path.startsWith('/')?path:'/'+path;
 const url=c.url+p+(query?'?'+new URLSearchParams(query).toString():'');
 const headers={apikey:service?c.secret:c.pub,Authorization:'Bearer '+(token||(service?c.secret:c.pub))};
 if(body!==undefined)headers['Content-Type']='application/json';
 if(service)headers.Prefer='return=representation';
 let r;
 try{r=await fetch(url,{method,headers,body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(10000)});}
 catch(e){throw Object.assign(new Error('Koneksi database gagal'),{status:503});}
 let out;
 try{out=await r.json();}catch{out=null;}
 if(!r.ok){const err=new Error(r.status===401||r.status===403?'Akses tidak diizinkan':'Permintaan database gagal');err.status=r.status;err.internal=String(out?.message||out?.msg||out?.error_description||'').slice(0,200);throw err;}
 return out;
}
export const db=(table,opt={})=>supa('/rest/v1/'+table,{...opt,service:true});
export const allowlisted=email=>(process.env.JP_ADMIN_EMAILS||'').toLowerCase().split(',').map(x=>x.trim()).filter(Boolean).includes(String(email||'').toLowerCase());
export async function adminRole(user){
 if(!user?.id||!user?.email||!user.email_confirmed_at)return null;
 if(allowlisted(user.email))return 'owner';
 const rows=await db('jp_admin_users',{query:{select:'role,active',user_id:'eq.'+user.id,limit:'1'}});
 return rows?.[0]?.active?rows[0].role:null;
}
export const validOrderStatus=new Set(['baru','diproses','revisi','selesai','dibatalkan']);
export const validPaymentStatus=new Set(['belum_bayar','dp','lunas']);
export const validReviewStatus=new Set(['pending','approved','rejected']);
export async function authorize(req,res){
 const cookies=readCookies(req);
 let at;try{at=decodeURIComponent(cookies['__Host-jp-access']||'');}catch{}
 let user=null;
 if(at){try{user=await supa('/auth/v1/user',{token:at});}catch{}}
 if(!user){
  let rt;try{rt=decodeURIComponent(cookies['__Host-jp-refresh']||'');}catch{}
  if(!rt){clearSession(res);return null;}
  try{
   const tokens=await supa('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:{refresh_token:rt}});
   at=tokens.access_token;
   user=await supa('/auth/v1/user',{token:at});
   writeSession(res,tokens);
  }catch{clearSession(res);return null;}
 }
 const role=await adminRole(user);
 if(!role){clearSession(res);return null;}
 return {id:user.id,email:user.email,role};
}
export async function rateLimit(req,action,max,seconds){
 const raw=(req.headers['x-forwarded-for']||req.headers['x-real-ip']||'').split(',')[0].trim().slice(0,80);
 const hash=createHmac('sha256',process.env.SUPABASE_SERVICE_ROLE_KEY).update(action+':'+raw).digest('hex');
 const data=await supa('/rest/v1/rpc/jp_consume_rate_limit',{method:'POST',body:{p_key:hash,p_max:max,p_seconds:seconds},service:true});
 return data===true;
}
export async function audit(actor,action,entity,entityId){
 try{await db('jp_audit_logs',{method:'POST',body:{actor_id:actor,action,entity,entity_id:entityId||null}});}catch{}
}
export function fail(res,e){
 const status=[400,401,403,404,405,409,413,415,429,503].includes(e?.status)?e.status:500;
 return send(res,status,{error:status===500?'Terjadi kesalahan server':e?.message||'Permintaan gagal'});
}
