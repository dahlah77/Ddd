const fmt=n=>new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(Number(n||0));
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const ua=navigator.userAgent,platform=navigator.platform||'';
const apple=/iPhone|iPad|iPod/.test(ua)||(/Mac/.test(platform)&&navigator.maxTouchPoints<=1)||(platform==='MacIntel'&&navigator.maxTouchPoints>1);
document.documentElement.dataset.platform=apple?'apple':'universal';
const pricing=window.__PRICING__||{}, institutions=window.__INSTITUTIONS__||[];
function initEstimator(){
  const level=$('#level'),part=$('#part'),method=$('#method'),deadline=$('#deadline');
  if(!level||!part||!method||!deadline)return;

  const generalMap=Object.fromEntries((pricing.general||[]).map(x=>[x.level,x]));
  const proposalMap=Object.fromEntries((pricing.proposal||[]).map(x=>[x.level,x.price]));
  const internshipMap=Object.fromEntries((pricing.internship||[]).map(x=>[x.level,x]));

  const levels=(pricing.general||[]).map(x=>x.level);
  level.innerHTML='';
  levels.forEach(l=>level.add(new Option(l,l)));
  level.value=levels.includes('S1')?'S1':(levels[0]||'');

  const addOption=(label,source,key,extra='')=>{
    const o=new Option(label,source+'|'+key+(extra?'|'+extra:''));
    part.add(o);
  };

  const fill=()=>{
    const l=level.value;
    part.innerHTML='';

    if(generalMap[l]){
      addOption('Tugas Ringan ≤10 hlm','general','light');
      addOption('Tugas Sedang 11–20 hlm','general','medium');
      addOption('Tugas Kompleks >20 hlm','general','complex');
    }

    const academic=pricing.academic?.[l];
    if(academic){
      Object.keys(academic).forEach(k=>addOption(k,'academic',k));
    }

    if(proposalMap[l]) addOption('Proposal Penelitian','proposal','price');

    if(internshipMap[l]){
      addOption('PKL / Magang — Review & Revisi','internship','review');
      addOption('PKL / Magang — Formatting','internship','formatting');
    }

    if(['D3/D4','S1','S2','S3'].includes(l)){
      (pricing.spssPackages||[]).forEach((x,i)=>addOption('SPSS — '+x.name,'spssPackage',String(i)));
    }

    if(part.options.length) part.selectedIndex=0;
    syncMethod();
    calc();
  };

  const syncMethod=()=>{
    const source=(part.value||'').split('|')[0];
    const methodSpecific=source==='academic';
    method.disabled=!methodSpecific;
    method.style.opacity=methodSpecific?'1':'.58';
    method.title=methodSpecific?'Pilih metode penelitian':'Metode tidak memengaruhi harga untuk jenis pekerjaan ini';
  };

  level.addEventListener('change',fill);
  part.addEventListener('change',()=>{syncMethod();calc()});
  method.addEventListener('change',calc);
  deadline.addEventListener('change',calc);
  fill();
}

function getEstimatorBase(){
  const l=$('#level')?.value;
  const raw=$('#part')?.value||'';
  const [source,key]=raw.split('|');
  const method=$('#method')?.value||'quant';

  if(source==='general'){
    const row=(pricing.general||[]).find(x=>x.level===l);
    return Number(row?.[key]||0);
  }
  if(source==='academic') return Number(pricing.academic?.[l]?.[key]?.[method]||0);
  if(source==='proposal'){
    const row=(pricing.proposal||[]).find(x=>x.level===l);
    return Number(row?.price||0);
  }
  if(source==='internship'){
    const row=(pricing.internship||[]).find(x=>x.level===l);
    return Number(row?.[key]||0);
  }
  if(source==='spssPackage'){
    return Number(pricing.spssPackages?.[Number(key)]?.price||0);
  }
  return 0;
}

function calc(){
  const level=$('#level')?.value;
  const part=$('#part');
  const method=$('#method')?.value||'quant';
  const di=Number($('#deadline')?.value||0);
  if(!level||!part?.value)return;

  const base=getEstimatorBase();
  const ex=pricing.express?.[di]||pricing.express?.[0]||{label:'≥4 hari',multiplier:1,surcharge:0};
  const total=Math.round(base*ex.multiplier);
  const selectedLabel=part.options[part.selectedIndex]?.text||'';

  if($('#base'))$('#base').textContent=fmt(base);
  if($('#express'))$('#express').textContent=ex.surcharge?'+'+ex.surcharge+'%':'Normal';
  if($('#total'))$('#total').textContent=fmt(total);
  if($('#calcNote'))$('#calcNote').textContent=ex.surcharge?'Express '+ex.label+' sudah termasuk dalam estimasi.':'Deadline normal ≥4 hari.';
  if($('#waEstimate'))$('#waEstimate').dataset.msg='Halo Joki Pelaihari, saya ingin konsultasi.\n\nJenjang: '+level+'\nBagian / Jenis Pekerjaan: '+selectedLabel+'\nMetode: '+(method==='quant'?'Kuantitatif':'Kualitatif')+'\nDeadline: '+ex.label+'\nEstimasi: '+fmt(total);
}

$$('.tab').forEach(b=>b.addEventListener('click',()=>{$$('.tab').forEach(x=>x.classList.remove('active'));b.classList.add('active');renderTable(b.dataset.cat)}));
function renderTable(cat){const box=$('#priceTable');if(!box)return;let rows='',head='';if(cat==='general'){head='<tr><th>Jenjang</th><th>Ringan ≤10 hlm</th><th>Sedang 11–20 hlm</th><th>Kompleks >20 hlm</th></tr>';rows=(pricing.general||[]).map(x=>'<tr><td>'+x.level+'</td><td>'+fmt(x.light)+'</td><td>'+fmt(x.medium)+'</td><td>'+fmt(x.complex)+'</td></tr>').join('')}else if(cat==='spss'){head='<tr><th>Jenis analisis</th><th>Harga</th></tr>';rows=(pricing.spss||[]).map(x=>'<tr><td>'+x.name+'</td><td>'+fmt(x.price)+'</td></tr>').join('')}else if(cat==='qualitative'){head='<tr><th>Layanan</th><th>Harga</th></tr>';rows=(pricing.qualitative||[]).map(x=>'<tr><td>'+x.name+'</td><td>'+fmt(x.price)+(x.suffix||'')+'</td></tr>').join('')}else if(cat==='transcript'){head='<tr><th>Durasi</th><th>Harga</th></tr>';rows=(pricing.transcript||[]).map(x=>'<tr><td>'+x.name+'</td><td>'+fmt(x.price)+(x.suffix||'')+'</td></tr>').join('')}else if(cat==='ppt'){head='<tr><th>Paket</th><th>Standard</th><th>Premium</th></tr>';rows=(pricing.ppt||[]).map(x=>'<tr><td>'+x.name+'</td><td>'+fmt(x.standard)+(x.suffix||'')+'</td><td>'+fmt(x.premium)+(x.suffix||'')+'</td></tr>').join('')}else{head='<tr><th>Durasi</th><th>Harga</th></tr>';rows=(pricing.consultation||[]).map(x=>'<tr><td>'+x.name+'</td><td>'+fmt(x.price)+'</td></tr>').join('')}box.innerHTML='<table><thead>'+head+'</thead><tbody>'+rows+'</tbody></table>'}
function openModal(id){const el=$('#'+id);if(el){el.classList.add('show');document.body.style.overflow='hidden'}} function closeModal(id){const el=$('#'+id);if(el){el.classList.remove('show');document.body.style.overflow=''}} window.openModal=openModal;window.closeModal=closeModal;$$('.modal').forEach(m=>m.addEventListener('click',e=>{if(e.target===m)closeModal(m.id)}));
function wa(msg){msg=msg||'Halo Joki Pelaihari, saya ingin konsultasi.';window.open('https://wa.me/6285651498728?text='+encodeURIComponent(msg),'_blank','noopener')} $$('[data-wa]').forEach(b=>b.addEventListener('click',()=>wa(b.dataset.msg)));if($('#waEstimate'))$('#waEstimate').addEventListener('click',()=>wa($('#waEstimate').dataset.msg));
const seedTexts=['Formatting-nya rapi dan detail kecilnya diperhatikan.','Komunikasinya jelas, revisi juga cepat ditanggapi.','PPT jadi jauh lebih clean dan enak dipresentasikan.','Olah data dan interpretasinya dibuat lebih gampang dipahami.','Proofreading-nya teliti dan catatan revisinya jelas.','Pengerjaan sesuai brief dan deadline yang disepakati.','Struktur dokumen jadi lebih konsisten dan rapi.','Bantu SPSS dari cleaning sampai interpretasi dengan runtut.','Konsultasi metode sangat membantu ngerapikan arah analisis.','Presentasi dibuat modern tanpa terasa seperti template pasaran.'];
const services=['Formatting','Konsultasi','PPT Akademik','SPSS & Analisis Data','Proofreading','Revisi Dokumen'];
const seedReviews=institutions.slice(0,30).map((x,i)=>({name:['A•••','R•••','N•••','D•••','M•••'][i%5],institution:x[0],level:(x[1]||'S1').split('/')[0],service:services[i%services.length],rating:[5,4,5,5,4][i%5],text:seedTexts[i%seedTexts.length]}));
const reviewKey='jp_reviews_local_v2';
function esc(s){return String(s||'').replace(/[&<>\"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#039;'}[m]))}
let reviewsExpanded=false;
function loadReviews(){
  let own=[];
  try{own=JSON.parse(localStorage.getItem(reviewKey)||'[]')}catch(e){}
  const all=own.slice().reverse().concat(seedReviews);
  const grid=$('#reviewGrid');
  const toggle=$('#reviewToggle');
  if(!grid)return;
  const visible=reviewsExpanded?all:all.slice(0,6);
  grid.innerHTML=visible.map(r=>'<article class="glass review-card"><div class="stars">'+'★'.repeat(r.rating)+'</div><p>“'+esc(r.text)+'”</p><div class="review-meta">'+esc(r.name)+' • '+esc(r.level)+'<br>'+esc(r.institution)+'</div></article>').join('');
  if(toggle){
    toggle.style.display=all.length>6?'inline-flex':'none';
    toggle.textContent=reviewsExpanded?'Tampilkan Lebih Sedikit':'Lihat Semua Review';
  }
}
if($('#reviewToggle'))$('#reviewToggle').addEventListener('click',()=>{reviewsExpanded=!reviewsExpanded;loadReviews()});
if($('#reviewForm'))$('#reviewForm').addEventListener('submit',e=>{e.preventDefault();const fd=new FormData(e.currentTarget),r={name:fd.get('name')||'Anonim',institution:fd.get('institution')||'Institusi tidak ditampilkan',level:fd.get('level')||'',service:fd.get('service')||'',rating:Number(fd.get('rating')||5),text:fd.get('text')||'',createdAt:new Date().toISOString()};let a=[];try{a=JSON.parse(localStorage.getItem(reviewKey)||'[]')}catch(x){}a.push(r);localStorage.setItem(reviewKey,JSON.stringify(a));e.currentTarget.reset();closeModal('reviewModal');loadReviews();alert('Review berhasil disimpan.')});
if($('#orderForm'))$('#orderForm').addEventListener('submit',e=>{e.preventDefault();const fd=new FormData(e.currentTarget),id='JP-'+new Date().getFullYear()+'-'+Math.floor(10000+Math.random()*89999),msg='Halo Joki Pelaihari, saya ingin membuat order.\n\nOrder ID: '+id+'\nNama: '+fd.get('name')+'\nJenjang: '+fd.get('level')+'\nLayanan: '+fd.get('service')+'\nDeadline: '+fd.get('deadline')+'\n\nBrief: '+fd.get('brief');closeModal('orderModal');wa(msg)});
initEstimator();renderTable('general');loadReviews();