import {configured,send,payload,sameOrigin,db,rateLimit,fail,str} from './_lib.js';
import {randomBytes} from 'node:crypto';
const publicEnabled=()=>configured()&&process.env.JP_PUBLIC_WRITE_ENABLED==='true';
const allowedEvents=new Set(['page_view','whatsapp_click','instagram_click','calculator_use','order_open','order_submit','review_submit','price_view']);
export default async function handler(req,res){
 try{
  const resource=String(req.query?.resource||'status');
  if(resource==='status'&&req.method==='GET')return send(res,200,{database:configured(),enabled:publicEnabled()});
  if(!configured())return send(res,503,{error:'Fitur penyimpanan belum terhubung'});
  if(req.method==='GET'){
   if(resource==='prices'){
    const data=await db('jp_settings',{query:{select:'data,version',id:'eq.pricing',limit:'1'}});
    if(!data?.length)return res.status(204).end();
    return send(res,200,{prices:data[0].data,version:data[0].version});
   }
   if(resource==='reviews'){
    const data=await db('jp_reviews',{query:{select:'id,name,institution,level,service,rating,text,verified,created_at',status:'eq.approved',order:'created_at.desc',limit:'60'}});
    return send(res,200,{rows:data||[]});
   }
   return send(res,404,{error:'Tidak ditemukan'});
  }
  if(req.method!=='POST')return send(res,405,{error:'Metode tidak tersedia'});
  if(!sameOrigin(req))return send(res,403,{error:'Permintaan ditolak'});
  if(!publicEnabled())return send(res,503,{error:'Penerimaan data online belum diaktifkan'});
  const b=payload(req,10000);
  if(resource==='event'){
   if(!allowedEvents.has(b.event_type))return send(res,400,{error:'Kategori aktivitas tidak dikenal'});
   if(!await rateLimit(req,'public-events',100,3600))return send(res,429,{error:'Terlalu banyak aktivitas'});
   await db('jp_events',{method:'POST',body:{event_type:b.event_type,source:str(b.source,30)||'website'}});
   return send(res,201,{ok:true});
  }
  if(resource==='reviews'){
   if(!await rateLimit(req,'public-reviews',3,86400))return send(res,429,{error:'Batas pengiriman review tercapai'});
   const name=str(b.name,100),institution=str(b.institution,120),level=str(b.level,40),service=str(b.service,100),text=str(b.text,1200),rating=Number(b.rating);
   if(name.length<2||text.length<10||!Number.isInteger(rating)||rating<1||rating>5)return send(res,400,{error:'Lengkapi nama, rating, dan review minimal 10 karakter'});
   const rows=await db('jp_reviews',{method:'POST',query:{select:'id'},body:{name,institution,level,service,text,rating,status:'pending',verified:false}});
   return send(res,201,{ok:true,id:rows?.[0]?.id,status:'pending'});
  }
  if(resource==='orders'){
   if(!await rateLimit(req,'public-orders',6,3600))return send(res,429,{error:'Terlalu banyak permintaan'});
   const name=str(b.name,120),level=str(b.level,50),service=str(b.service,120),kesepakatan=str(b.kesepakatan,3000),date=str(b.deadline,20);
   if(name.length<2||!service||kesepakatan.length<8||!/^\d{4}-\d{2}-\d{2}$/.test(date)||Number.isNaN(new Date(date).getTime()))
    return send(res,400,{error:'Data pesanan perlu dilengkapi'});
   const clientCode=str(b.code,30);
   const code=/^JP-\d{4}-\d{5}$/.test(clientCode)?clientCode:'JP-'+Date.now().toString(36).toUpperCase()+'-'+randomBytes(3).toString('hex').toUpperCase();
   const row={code,customer_name:name,level,service,kesepakatan,deadline:date,status:'baru',payment_status:'belum_bayar',source:'website'};
   const rows=await db('jp_orders',{method:'POST',query:{select:'id,code'},body:row});
   return send(res,201,{ok:true,id:rows?.[0]?.id,code});
  }
  return send(res,404,{error:'Kategori tidak dikenal'});
 }catch(e){return fail(res,e);}
}