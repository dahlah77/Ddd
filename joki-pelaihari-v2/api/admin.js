import {configured,send,payload,sameOrigin,supa,db,allowlisted,adminRole,authorize,writeSession,clearSession,rateLimit,rateLimitIdentity,passwordLeaked,preMfaAdmin,getAal,audit,fail,str,uuid,validOrderStatus,validPaymentStatus,validReviewStatus} from './_lib.js';

const methods='GET, POST, PATCH';
export default async function handler(req,res){
 try{
  const action=String(req.query?.action||'');
  const resource=String(req.query?.resource||'dashboard');
  if(req.method==='OPTIONS')return send(res,405,{error:'Metode tidak diizinkan'});
  if(!configured())return send(res,503,{configured:false,error:'Database dan autentikasi admin belum diaktifkan'});
  if(req.method!=='GET'&&!sameOrigin(req))return send(res,403,{error:'Permintaan lintas situs ditolak'});

  if(action==='login'){
   if(req.method!=='POST')return send(res,405,{error:methods});
   const body=payload(req,3000),email=str(body.email,254).toLowerCase(),password=body.password;
   if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||typeof password!=='string'||password.length<8||password.length>128)
     return send(res,400,{error:'Email atau kata sandi tidak valid'});
   if(!await rateLimit(req,'admin-login',8,3600))return send(res,429,{error:'Terlalu banyak percobaan login'});
   // Also throttle the target account across many IPs to limit password spraying
   if(!await rateLimitIdentity(email,'admin-login',30,3600))
     return send(res,429,{error:'Terlalu banyak percobaan login'});
   if(await passwordLeaked(password))
     return send(res,403,{error:'Kata sandi terdeteksi dalam daftar kebocoran Ganti kata sandi di Supabase sebelum login'});
   let tokens,user;
   try{
    tokens=await supa('/auth/v1/token?grant_type=password',{method:'POST',body:{email,password}});
    user=await supa('/auth/v1/user',{token:tokens.access_token});
   }catch{
    return send(res,401,{error:'Kredensial tidak valid atau akun belum aktif'});
   }
   const role=await adminRole(user);
   if(!role)return send(res,403,{error:'Akun ini tidak mempunyai izin administrator'});
   writeSession(res,tokens);
   await audit(user.id,'password_login','session',null);
   const verified=(user.factors||[]).some(f=>f.factor_type==='totp'&&f.status==='verified');
   return send(res,200,{ok:true,mfa_required:true,step:verified?'challenge':'enroll'});
  }
  if(action==='logout'){
   if(req.method!=='POST')return send(res,405,{error:methods});
   const who=await preMfaAdmin(req,res);
   if(who)await audit(who.id,'logout','session',null);
   clearSession(res);
   return send(res,200,{ok:true});
  }
  if(action.startsWith('mfa_')){
   const first=await preMfaAdmin(req,res);
   if(!first)return send(res,401,{error:'Sesi awal sudah berakhir Silakan login ulang'});
   if(action==='mfa_state'&&req.method==='GET'){
    const verified=first.factors.find(f=>f.factor_type==='totp'&&f.status==='verified');
    return send(res,200,{step:first.aal==='aal2'?'complete':verified?'challenge':'enroll'});
   }
   if(action==='mfa_factor'&&req.method==='GET'){
    const verified=first.factors.find(f=>f.factor_type==='totp'&&f.status==='verified');
    return verified?send(res,200,{factor_id:verified.id}):send(res,404,{error:'Autentikator belum terdaftar'});
   }
   if(req.method!=='POST')return send(res,405,{error:'Metode tidak tersedia'});
   if(!await rateLimit(req,'admin-mfa',15,3600)||
      !await rateLimitIdentity(first.email,'admin-mfa',25,3600))
     return send(res,429,{error:'Batas percobaan verifikasi tercapai'});
   if(action==='mfa_enroll'){
    if(first.factors.some(f=>f.status==='verified'))return send(res,409,{error:'Autentikator sudah aktif'});
    if(first.factors.filter(f=>f.status==='unverified').length>=3)return send(res,429,{error:'Terlalu banyak pengaturan MFA tertunda'});
    const data=await supa('/auth/v1/factors',{method:'POST',token:first.token,body:{factor_type:'totp',friendly_name:'Joki Pelaihari Admin'}});
    return send(res,200,{factor_id:data.id,qr_code:data.totp?.qr_code||'',secret:data.totp?.secret||''});
   }
   if(action==='mfa_verify'){
    const body=payload(req,1000),factor=str(body.factor_id,80),code=str(body.code,8);
    if(!uuid(factor)||!/^\d{6}$/.test(code))return send(res,400,{error:'Kode enam digit tidak valid'});
    let updated;
    try{
     const challenge=await supa('/auth/v1/factors/'+factor+'/challenge',{method:'POST',token:first.token,body:{}});
     updated=await supa('/auth/v1/factors/'+factor+'/verify',{method:'POST',token:first.token,body:{challenge_id:challenge.id,code}});
    }catch{return send(res,401,{error:'Kode autentikator salah atau kedaluwarsa'});}
    if(!updated?.access_token||getAal(updated.access_token)!=='aal2')
      return send(res,403,{error:'Verifikasi MFA belum lengkap'});
    const user=await supa('/auth/v1/user',{token:updated.access_token});
    const role=await adminRole(user);
    if(!role)return send(res,403,{error:'Akun bukan administrator'});
    writeSession(res,updated);
    await audit(user.id,'mfa_login','session',null);
    return send(res,200,{ok:true,user:{email:user.email,role}});
   }
   return send(res,404,{error:'Aksi MFA tidak tersedia'});
  }
  const user=await authorize(req,res);
  if(!user){
   const pending=await preMfaAdmin(req,res);
   if(pending)return send(res,403,{error:'Verifikasi MFA diperlukan',mfa_required:true,
    step:pending.factors.some(f=>f.status==='verified')?'challenge':'enroll'});
   return send(res,401,{error:'Login admin diperlukan'});
  }

  if(action==='session'){
   if(req.method!=='GET')return send(res,405,{error:methods});
   return send(res,200,{configured:true,user});
  }
  if(req.method==='GET'){
   const q={select:'*',order:'created_at.desc',limit:'100'};
   if(resource==='orders')return send(res,200,{rows:await db('jp_orders',{query:q})});
   if(resource==='reviews')return send(res,200,{rows:await db('jp_reviews',{query:q})});
   if(resource==='prices'){
    const arr=await db('jp_settings',{query:{select:'data,version,updated_at',id:'eq.pricing',limit:'1'}});
    return send(res,200,{data:arr[0]?.data||null,version:arr[0]?.version||0,updated_at:arr[0]?.updated_at||null});
   }
   if(resource==='dashboard'||resource==='analytics'){
    const [orders,reviews,events]=await Promise.all([
     db('jp_orders',{query:{select:'id,code,customer_name,service,level,total,status,payment_status,created_at',order:'created_at.desc',limit:'1000'}}),
     db('jp_reviews',{query:{select:'id,status,created_at',order:'created_at.desc',limit:'1000'}}),
     db('jp_events',{query:{select:'event_type,created_at',order:'created_at.desc',limit:'1000'}})
    ]);
    const monthAgo=Date.now()-30*86400000;
    const recent=events.filter(x=>new Date(x.created_at).getTime()>=monthAgo);
    const counts={};
    recent.forEach(x=>counts[x.event_type]=(counts[x.event_type]||0)+1);
    const total=orders.filter(x=>x.payment_status==='lunas').reduce((n,x)=>n+Number(x.total||0),0);
    return send(res,200,{orders:orders.length,newOrders:orders.filter(x=>x.status==='baru').length,completedOrders:orders.filter(x=>x.status==='selesai').length,paidRevenue:total,pendingReviews:reviews.filter(x=>x.status==='pending').length,approvedReviews:reviews.filter(x=>x.status==='approved').length,events30days:counts,recentOrders:orders.slice(0,8)});
   }
   if(resource==='audit'){
    if(user.role!=='owner')return send(res,403,{error:'Hanya pemilik'});
    return send(res,200,{rows:await db('jp_audit_logs',{query:{select:'action,entity,entity_id,created_at',order:'created_at.desc',limit:'100'}})});
   }
   return send(res,404,{error:'Kategori admin tidak tersedia'});
  }

  if(resource==='orders'&&req.method==='PATCH'){
   const b=payload(req),id=str(b.id);
   if(!uuid(id))return send(res,400,{error:'ID pesanan tidak valid'});
   const changes={updated_at:new Date().toISOString()};
   if(b.status!==undefined){if(!validOrderStatus.has(b.status))return send(res,400,{error:'Status tidak valid'});changes.status=b.status;}
   if(b.payment_status!==undefined){if(!validPaymentStatus.has(b.payment_status))return send(res,400,{error:'Status pembayaran tidak valid'});changes.payment_status=b.payment_status;}
   if(b.total!==undefined){if(!Number.isFinite(b.total)||b.total<0||b.total>1e9)return send(res,400,{error:'Nominal tidak valid'});changes.total=b.total;}
   if(b.admin_note!==undefined)changes.admin_note=str(b.admin_note,2500);
   if(Object.keys(changes).length===1)return send(res,400,{error:'Tidak ada perubahan'});
   const rows=await db('jp_orders',{method:'PATCH',query:{id:'eq.'+id,select:'id,status,payment_status,total,updated_at'},body:changes});
   if(!rows?.length)return send(res,404,{error:'Pesanan tidak ditemukan'});
   await audit(user.id,'update','orders',id);
   return send(res,200,{ok:true,row:rows[0]});
  }
  if(resource==='orders'&&req.method==='POST'){
   const b=payload(req),name=str(b.customer_name,120),service=str(b.service,120),level=str(b.level,50);
   if(name.length<2||!service)return send(res,400,{error:'Nama dan layanan diperlukan'});
   if(b.deadline&&!/^\d{4}-\d{2}-\d{2}$/.test(b.deadline))return send(res,400,{error:'Tanggal tidak valid'});
   const row={
    code:'JP-M'+Date.now().toString(36).toUpperCase(),
    customer_name:name,level,service,deadline:b.deadline||null,kesepakatan:str(b.kesepakatan,3000),
    status:'baru',payment_status:'belum_bayar',source:'admin'
   };
   const added=await db('jp_orders',{method:'POST',query:{select:'id,code'},body:row});
   await audit(user.id,'create','orders',added?.[0]?.id);
   return send(res,201,{ok:true,row:added?.[0]});
  }
  if(resource==='reviews'&&req.method==='PATCH'){
   const b=payload(req),id=str(b.id);
   if(!uuid(id)||!validReviewStatus.has(b.status))return send(res,400,{error:'Review atau status tidak valid'});
   const changes={status:b.status,reviewed_at:new Date().toISOString(),reviewed_by:user.id};
   if(b.verified===true){
    const old=await db('jp_reviews',{query:{select:'order_id',id:'eq.'+id,limit:'1'}});
    if(!old?.[0]?.order_id)return send(res,400,{error:'Verifikasi memerlukan pesanan asli yang terhubung'});
    const o=await db('jp_orders',{query:{select:'id,status',id:'eq.'+old[0].order_id,limit:'1'}});
    if(!o?.length||o[0].status!=='selesai')return send(res,400,{error:'Pesanan terkait belum selesai'});
    if(b.status!=='approved')return send(res,400,{error:'Review terverifikasi harus disetujui'});
    changes.verified=true;
   }else changes.verified=false;
   const rows=await db('jp_reviews',{method:'PATCH',query:{id:'eq.'+id,select:'id,status,verified'},body:changes});
   if(!rows?.length)return send(res,404,{error:'Review tidak ditemukan'});
   await audit(user.id,'moderate','reviews',id);
   return send(res,200,{ok:true,row:rows[0]});
  }
  if(resource==='prices'&&req.method==='POST'){
   if(user.role!=='owner')return send(res,403,{error:'Hanya pemilik dapat mengubah harga'});
   const b=payload(req,65000),p=b.data;
   if(!p||typeof p!=='object'||Array.isArray(p))return send(res,400,{error:'Format harga tidak valid'});
   const expected=['express','general','academic','proposal','internship','spss','spssPackages','qualitative','transcript','formatting','proofreading','ppt','consultation'];
   if(expected.some(k=>!(k in p)))return send(res,400,{error:'Kategori harga belum lengkap'});
   const json=JSON.stringify(p);
   if(json.length>50000||/("__proto__"|"constructor"|"prototype")/.test(json))return send(res,400,{error:'Data tidak diizinkan'});
   const amounts=[];
   const walk=(o,d=0)=>{if(d>7)throw new Error('Data harga terlalu dalam');if(o&&typeof o==='object')for(const [k,v] of Object.entries(o)){if(typeof v==='number')amounts.push(v);else walk(v,d+1);}};
   walk(p);
   if(amounts.length<40||amounts.some(x=>!Number.isFinite(x)||x<0||x>1e10))return send(res,400,{error:'Nilai harga tidak valid'});
   const current=await db('jp_settings',{query:{select:'version',id:'eq.pricing',limit:'1'}});
   const version=Number(b.version);
   if(!Number.isInteger(version)||version<0||version!==(current[0]?.version||0))return send(res,409,{error:'Data harga berubah, muat ulang sebelum menyimpan'});
   let saved;
   if(!current.length)saved=await db('jp_settings',{method:'POST',query:{select:'id,version'},body:{id:'pricing',data:p,version:1,updated_by:user.id}});
   else saved=await db('jp_settings',{method:'PATCH',query:{id:'eq.pricing',version:'eq.'+version,select:'id,version'},body:{data:p,version:version+1,updated_by:user.id,updated_at:new Date().toISOString()}});
   if(!saved?.length)return send(res,409,{error:'Konflik versi, muat ulang'});
   await audit(user.id,'update','prices',null);
   return send(res,200,{ok:true,version:saved[0].version});
  }
  return send(res,405,{error:'Metode tidak tersedia'});
 }catch(e){return fail(res,e);}
}
