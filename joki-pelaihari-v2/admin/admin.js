'use strict';
const $=q=>document.querySelector(q);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const fmt=v=>'Rp'+new Intl.NumberFormat('id-ID',{maximumFractionDigits:0}).format(Number(v)||0);
const app={user:null,tab:'dashboard',rows:{},prices:null,priceVersion:0,configured:false,mfaFactorId:null};
const categories=[['general','Umum'],['academic','BAB Akademik'],['proposal','Proposal'],['internship','PKL / Magang'],['spss','SPSS'],['spssPackages','Paket SPSS'],['qualitative','NVivo'],['transcript','Transkrip'],['formatting','Formatting'],['proofreading','Proofreading'],['ppt','PPT'],['consultation','Konsultasi'],['express','Express']];

async function api(query={},options={}){
 const url=new URL('/api/admin',location.origin);
 for(const [k,v] of Object.entries(query))url.searchParams.set(k,v);
 const r=await fetch(url,{...options,credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json',...(options.headers||{})}});
 let data={};try{data=await r.json();}catch{}
 if(!r.ok){const e=Error(data.error||'Permintaan gagal ('+r.status+')');e.status=r.status;e.data=data;throw e;}
 return data;
}
function note(message){$('#status').textContent=message;setTimeout(()=>{if($('#status').textContent===message)$('#status').textContent=''},6500)}
function failure(e){note(e.message||'Gagal memproses permintaan')}
function loggedIn(user){
 app.user=user;$('#who').textContent=user.email+' · '+user.role;
 $('#loginPanel').hidden=true;$('#mfaPanel').hidden=true;$('#mainPanel').hidden=false;$('#logout').hidden=false;
 $('[data-tab="audit"]').hidden=user.role!=='owner';
 $('#savePrices').disabled=user.role!=='owner';
 show('dashboard');
}
function show(view){
 if(!app.user)return;
 app.tab=view;
 for(const el of document.querySelectorAll('.view'))el.hidden=el.id!=='view'+view[0].toUpperCase()+view.slice(1);
 document.querySelectorAll('.menu button').forEach(b=>b.classList.toggle('active',b.dataset.tab===view));
 const title={dashboard:'Dashboard',orders:'Pesanan',reviews:'Moderasi Review',prices:'Pengaturan Harga',analytics:'Analitik',audit:'Riwayat Perubahan'}[view];
 $('#pageTitle').textContent=title||'Dashboard';
 loadView(view).catch(failure);
}
async function loadView(view){
 if(view==='dashboard'||view==='analytics'){
  const d=await api({resource:'dashboard'});
  const items=[['Total Pesanan',d.orders],['Pesanan Baru',d.newOrders],['Selesai',d.completedOrders],['Pendapatan Lunas',fmt(d.paidRevenue)],['Review Pending',d.pendingReviews],['Review Disetujui',d.approvedReviews]];
  $('#stats').innerHTML=items.map(([n,v])=>'<div class="stat"><b>'+esc(v)+'</b><span>'+esc(n)+'</span></div>').join('');
  $('#recentOrders').innerHTML=table(['Kode','Pelanggan','Layanan','Status','Pembayaran'],(d.recentOrders||[]).map(x=>[x.code||x.id,x.customer_name||'—',x.service||'—',x.status||'—',x.payment_status||'—']));
  const eventEntries=Object.entries(d.events30days||{});
  $('#events').innerHTML=eventEntries.length?eventEntries.map(([k,v])=>'<div class="stat"><b>'+esc(v)+'</b><span>'+esc(k)+'</span></div>').join(''):'<p class="small">Belum ada event tercatat</p>';
  return;
 }
 if(view==='orders'){const d=await api({resource:'orders'});app.rows.orders=d.rows||[];renderOrders();return;}
 if(view==='reviews'){const d=await api({resource:'reviews'});app.rows.reviews=d.rows||[];renderReviews();return;}
 if(view==='prices'){
  const d=await api({resource:'prices'});
  const seed=d.data||await (await fetch('/admin/prices.json',{cache:'no-store'})).json();
  app.prices=JSON.parse(JSON.stringify(seed));app.priceVersion=d.version||0;
  if(!$('#priceCategory').options.length)categories.forEach(([key,title])=>$('#priceCategory').add(new Option(title,key)));
  if(app.user.role!=='owner')note('Akses lihat harga — hanya pemilik bisa menyimpan');
  renderPrices();return;
 }
 if(view==='audit'){const d=await api({resource:'audit'});$('#auditTable').innerHTML=table(['Waktu','Aksi','Kategori','ID'],(d.rows||[]).map(x=>[date(x.created_at),x.action,x.entity,x.entity_id||'—']));return;}
}
const date=v=>v?new Date(v).toLocaleString('id-ID'):'—';
function table(headers,rows){return '<table><thead><tr>'+headers.map(h=>'<th>'+esc(h)+'</th>').join('')+'</tr></thead><tbody>'+rows.map(c=>'<tr>'+c.map(x=>'<td>'+esc(x)+'</td>').join('')+'</tr>').join('')+(rows.length?'':'<tr><td colspan="'+headers.length+'">Belum ada data</td></tr>')+'</tbody></table>'}
function renderOrders(){
 const h=['Kode / Waktu','Pelanggan','Layanan / Deadline','Status','Pembayaran','Total','Catatan Admin','Aksi'];
 const opts=(list,sel)=>list.map(x=>'<option value="'+x+'"'+(sel===x?' selected':'')+'>'+esc(x.replaceAll('_',' '))+'</option>').join('');
 const body=app.rows.orders.map(o=>{
  const name=esc(o.customer_name),code=esc(o.code),service=esc(o.service);
  return '<tr data-id="'+esc(o.id)+'"><td><strong>'+code+'</strong><br><span class="small">'+date(o.created_at)+'</span></td>'+
  '<td>'+name+'<br><span class="small">'+esc(o.level)+'</span></td>'+
  '<td>'+service+'<br><span class="small">'+esc(o.deadline||'—')+'</span></td>'+
  '<td><select data-field="status">'+opts(['baru','diproses','revisi','selesai','dibatalkan'],o.status)+'</select></td>'+
  '<td><select data-field="payment_status">'+opts(['belum_bayar','dp','lunas'],o.payment_status)+'</select></td>'+
  '<td><input data-field="total" type="number" min="0" step="1000" value="'+Number(o.total||0)+'"></td>'+
  '<td><textarea data-field="admin_note" rows="2" maxlength="2500">'+esc(o.admin_note||'')+'</textarea></td>'+
  '<td><button data-do="save-order" class="gold">Simpan</button></td></tr>';
 }).join('');
 $('#ordersTable').innerHTML='<table><thead><tr>'+h.map(x=>'<th>'+x+'</th>').join('')+'</tr></thead><tbody>'+body+(body?'':'<tr><td colspan="8">Belum ada pesanan</td></tr>')+'</tbody></table>';
}
function renderReviews(){
 const headers=['Waktu','Nama / Institusi','Rating','Isi Review','Status','Verifikasi'];
 const body=app.rows.reviews.map(r=>'<tr data-id="'+esc(r.id)+'"><td>'+date(r.created_at)+'</td><td>'+esc(r.name)+'<br><span class="small">'+esc(r.institution||'')+' · '+esc(r.level||'')+'</span></td><td>'+esc(r.rating)+'/5</td>'+
 '<td>'+esc(r.text)+'</td><td>'+esc(r.status)+'<br><button class="gold" data-do="approve">Setujui</button><button data-do="reject">Tolak</button></td>'+
 '<td>'+(r.verified?'<span class="good">Verified Order</span>':'<span class="small">Belum diverifikasi</span>')+'</td></tr>').join('');
 $('#reviewsTable').innerHTML='<table><thead><tr>'+headers.map(x=>'<th>'+x+'</th>').join('')+'</tr></thead><tbody>'+body+(body?'':'<tr><td colspan="6">Belum ada review</td></tr>')+'</tbody></table>';
}
function priceRows(){
 const cat=$('#priceCategory').value,lvl=$('#priceAcademicLevel').value;
 const items=cat==='academic'?app.prices.academic?.[lvl]:app.prices?.[cat];
 const data=Array.isArray(items)?items.map((o,i)=>({label:o.name||o.level||'Item '+(i+1),values:o,path:[cat,i]})):Object.entries(items||{}).map(([k,o])=>({label:k,values:o,path:['academic',lvl,k]}));
 return {cat,rows:data};
}
function renderPrices(){
 const {cat,rows}=priceRows();
 $('#academicLevelWrap').hidden=cat!=='academic';
 $('#priceNote').textContent='Kategori '+(categories.find(x=>x[0]===cat)?.[1]||'')+' — edit angka pada setiap kolom lalu klik Simpan Perubahan';
 const keys=[...new Set(rows.flatMap(x=>Object.entries(x.values||{}).filter(([k,v])=>typeof v==='number').map(([k])=>k)))];
 const th='<th>Layanan</th>'+keys.map(k=>'<th>'+esc(k)+'</th>').join('');
 const body=rows.map((r,i)=>'<tr><td><strong>'+esc(r.label)+'</strong></td>'+keys.map(k=>{
  const val=r.values?.[k];
  if(typeof val!=='number')return '<td>—</td>';
  return '<td><input aria-label="'+esc(r.label+' '+k)+'" type="number" min="0" max="10000000000" step="'+(k==='multiplier'?'0.01':'1')+'" data-price-index="'+i+'" data-price-field="'+esc(k)+'" value="'+val+'" '+(app.user.role==='owner'?'':'disabled')+'></td>';
 }).join('')+'</tr>').join('');
 $('#priceEditor').innerHTML='<table><thead><tr>'+th+'</tr></thead><tbody>'+body+'</tbody></table>';
}
async function showMfa(step){
 $('#loginPanel').hidden=true;$('#mainPanel').hidden=true;$('#mfaPanel').hidden=false;
 $('#mfaMessage').textContent='';$('#mfaCode').value='';$('#mfaSetup').hidden=true;
 app.mfaFactorId=null;
 const enroll=step==='enroll';
 $('#mfaEnroll').hidden=!enroll;
 $('#mfaIntro').textContent=enroll
  ?'Aktifkan aplikasi autentikator untuk membuka dashboard'
  :'Masukkan kode 6 digit dari aplikasi autentikator untuk masuk';
 if(!enroll){
  const d=await api({action:'mfa_factor'});
  app.mfaFactorId=d.factor_id;
 }
}
async function initialize(){
 try{const d=await api({action:'session'});loggedIn(d.user);}
 catch(e){
  if(e.status===403&&e.data?.mfa_required){
   try{await showMfa(e.data.step)}catch(err){$('#mfaPanel').hidden=true;$('#loginPanel').hidden=false;}
  }else{
   $('#loginPanel').hidden=false;$('#mainPanel').hidden=true;
   $('#loginMsg').textContent=e.message.includes('Database')?'Database admin belum diaktifkan. Halaman sudah siap tetapi login menunggu konfigurasi Supabase':'';
  }
 }
}
$('#loginForm').addEventListener('submit',async e=>{
 e.preventDefault();const btn=$('#loginForm button');btn.disabled=true;
 try{
  const d=await api({action:'login'},{method:'POST',body:JSON.stringify({email:$('#email').value,password:$('#password').value})});
  $('#password').value='';$('#loginMsg').textContent='';if(d.mfa_required)await showMfa(d.step);else loggedIn(d.user);
 }catch(err){$('#loginMsg').textContent=err.message}finally{btn.disabled=false}
});
$('#mfaEnroll').addEventListener('click',async()=>{
 const btn=$('#mfaEnroll');btn.disabled=true;
 try{
  const d=await api({action:'mfa_enroll'},{method:'POST',body:'{}'});
  app.mfaFactorId=d.factor_id;
  const qr=String(d.qr_code||'');
  const src=qr.startsWith('data:image/svg+xml,')?qr:
    qr.startsWith('<svg')?'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(qr):'';
  $('#mfaQr').hidden=!src;
  if(src)$('#mfaQr').src=src;
  $('#mfaSecret').textContent=d.secret||'';
  $('#mfaSetup').hidden=false;btn.hidden=true;
 }catch(e){$('#mfaMessage').textContent=e.message}
 finally{btn.disabled=false}
});
$('#mfaForm').addEventListener('submit',async e=>{
 e.preventDefault();const button=$('#mfaForm button');button.disabled=true;
 try{
  if(!app.mfaFactorId)throw Error('Autentikator belum dipilih atau diaktifkan');
  const d=await api({action:'mfa_verify'},{method:'POST',
   body:JSON.stringify({factor_id:app.mfaFactorId,code:$('#mfaCode').value.trim()})});
  $('#mfaCode').value='';$('#mfaSecret').textContent='';
  $('#mfaQr').removeAttribute('src');$('#mfaPanel').hidden=true;
  loggedIn(d.user);
 }catch(e){$('#mfaMessage').textContent=e.message}
 finally{button.disabled=false}
});
$('#mfaCancel').addEventListener('click',async()=>{
 try{await api({action:'logout'},{method:'POST',body:'{}'})}catch{}
 location.reload();
});
$('#logout').addEventListener('click',async()=>{try{await api({action:'logout'},{method:'POST',body:'{}'})}catch{}location.reload()});
document.querySelectorAll('.menu button').forEach(b=>b.addEventListener('click',()=>show(b.dataset.tab)));
$('#toggleNewOrder').addEventListener('click',()=>{$('#newOrderForm').hidden=!$('#newOrderForm').hidden});
$('#newOrderForm').addEventListener('submit',async e=>{
 e.preventDefault();const form=e.target;
 const data=Object.fromEntries(new FormData(form).entries());
 try{await api({resource:'orders'},{method:'POST',body:JSON.stringify(data)});form.reset();form.hidden=true;note('Pesanan ditambahkan');await loadView('orders')}catch(err){failure(err)}
});
$('#ordersTable').addEventListener('click',async e=>{
 const btn=e.target.closest('[data-do="save-order"]');if(!btn)return;
 const tr=btn.closest('tr'),data={id:tr.dataset.id};
 tr.querySelectorAll('[data-field]').forEach(f=>data[f.dataset.field]=f.dataset.field==='total'?Number(f.value):f.value);
 btn.disabled=true;try{await api({resource:'orders'},{method:'PATCH',body:JSON.stringify(data)});note('Pesanan diperbarui');await loadView('orders')}catch(err){failure(err)}finally{btn.disabled=false}
});
$('#reviewsTable').addEventListener('click',async e=>{
 const btn=e.target.closest('[data-do]');if(!btn)return;
 const row=btn.closest('tr'),status=btn.dataset.do==='approve'?'approved':'rejected';
 btn.disabled=true;try{await api({resource:'reviews'},{method:'PATCH',body:JSON.stringify({id:row.dataset.id,status})});note('Moderasi review disimpan');await loadView('reviews')}catch(err){failure(err)}finally{btn.disabled=false}
});
$('#priceCategory').addEventListener('change',renderPrices);
$('#priceAcademicLevel').addEventListener('change',renderPrices);
$('#priceEditor').addEventListener('change',e=>{
 const el=e.target.closest('[data-price-index]');if(!el||!app.prices)return;
 const {rows}=priceRows(),row=rows[Number(el.dataset.priceIndex)];
 const n=Number(el.value);
 if(!row||!Number.isFinite(n)||n<0||n>1e10){note('Nominal tidak valid');renderPrices();return;}
 row.values[el.dataset.priceField]=n;
});
$('#savePrices').addEventListener('click',async()=>{
 if(app.user.role!=='owner'||!app.prices)return;
 const btn=$('#savePrices');btn.disabled=true;
 try{const d=await api({resource:'prices'},{method:'POST',body:JSON.stringify({data:app.prices,version:app.priceVersion})});app.priceVersion=d.version;note('Harga tersimpan di database, website akan mengambil tarif baru')}catch(e){failure(e)}finally{btn.disabled=false}
});
initialize();
