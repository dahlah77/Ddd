const fmt=n=>new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(Number(n||0));
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const ua=navigator.userAgent,platform=navigator.platform||'';
const apple=/iPhone|iPad|iPod/.test(ua)||(/Mac/.test(platform)&&navigator.maxTouchPoints<=1)||(platform==='MacIntel'&&navigator.maxTouchPoints>1);
document.documentElement.dataset.platform=apple?'apple':'universal';
const pricing=window.__PRICING__||{}, institutions=window.__INSTITUTIONS__||[];
const TASK_KINDS={
  word:{name:'Word / Google Docs',priced:true,light:'≤10 halaman: ketik, format dasar, dokumen sederhana.',medium:'11–20 halaman: tabel, gambar, heading, sitasi.',complex:'>20 halaman atau format khusus: daftar isi otomatis, referensi, banyak tabel.'},
  pdf:{name:'PDF',priced:true,light:'≤10 halaman: edit, gabung, pisah, konversi PDF sederhana yang bisa diedit.',medium:'11–20 halaman: penataan, perbaikan teks dan format dokumen editable.',complex:'PDF panjang, hasil scan, OCR atau layout rumit memerlukan pengecekan file sebelum harga final.'},
  excel:{name:'Excel / Google Sheets',priced:false,light:'1–2 sheet: input data, SUM, AVERAGE dan tabel sederhana.',medium:'3–5 sheet: IF, lookup, grafik dan rekap antar-sheet.',complex:'Dashboard, PivotTable, otomatisasi, atau banyak sumber data.'},
  web:{name:'Website / HTML-CSS-JS',priced:false,light:'Satu halaman statis tanpa database.',medium:'Beberapa halaman responsif dengan navigasi dan formulir sederhana.',complex:'Login, database, dashboard admin, API atau integrasi.'},
  design:{name:'Canva / Desain',priced:false,light:'Satu poster atau edit template sederhana.',medium:'Beberapa desain dan variasi layout.',complex:'Paket identitas visual atau aset/desain khusus.'},
  other:{name:'Aplikasi / File lainnya',priced:false,light:'Satu pekerjaan sederhana tanpa fitur khusus.',medium:'Beberapa komponen dengan pengolahan dan revisi.',complex:'Integrasi, banyak komponen, atau fitur teknis khusus.'}
};
const TASK_LEVELS=[['light','Ringan'],['medium','Sedang'],['complex','Kompleks']];

function initEstimator(){
  const level=$('#level'),part=$('#part'),method=$('#method'),deadline=$('#deadline');
  const type=$('#fileType'),pptStyle=$('#pptStyle'),hint=$('#taskScopeHelp');
  if(!level||!part||!method||!deadline||!type)return;
  level.innerHTML='';
  (pricing.general||[]).forEach(row=>level.add(new Option(row.level,row.level)));
  level.value='S1';

  const addOption=(label,source,key)=>part.add(new Option(label,source+'|'+key));

  const updateHelp=()=>{
    const kind=type.value,source=(part.value||'').split('|')[0],key=(part.value||'').split('|')[1];
    const meta=TASK_KINDS[kind];
    if(meta && key in meta){
      hint.textContent=meta[key]+(meta.priced?' Acuan harga Umum untuk dokumen yang bisa diedit; kondisi dan tingkat kesulitan file tetap dicek.':' Belum ada tarif tetap: kirim brief untuk penawaran.');
    }else if(kind==='ppt'){
      hint.textContent='Tarif mengikuti jumlah slide dan paket Standard/Premium pada Price Table. Tambahan slide dan animasi khusus dihitung sesuai scope.';
    }else{
      hint.textContent='Pilih bagian pekerjaan. Harga mengikuti daftar layanan dan akan disesuaikan dengan brief.';
    }
  };

  const fill=()=>{
    const kind=type.value,l=level.value;
    part.innerHTML='';
    if(kind==='academic'){
      const academic=pricing.academic?.[l]||{};
      Object.keys(academic).forEach(k=>addOption(k,'academic',k));
      const prop=(pricing.proposal||[]).find(x=>x.level===l);
      if(prop)addOption('Proposal Penelitian','proposal','price');
      const internship=(pricing.internship||[]).find(x=>x.level===l);
      if(internship){
        addOption('PKL / Magang — Review & Revisi','internship','review');
        addOption('PKL / Magang — Formatting','internship','formatting');
      }
      if(['D3/D4','S1','S2','S3'].includes(l)){
        (pricing.spssPackages||[]).forEach((x,i)=>addOption('SPSS — '+x.name,'spssPackage',String(i)));
      }
    }else if(kind==='ppt'){
      (pricing.ppt||[]).forEach((row,i)=>{
        if(row.suffix==='/slide')return;
        addOption(row.name+' — Presentasi','ppt',String(i));
      });
      addOption('>20 slide / presentasi khusus — Konsultasi','custom','ppt');
    }else if(TASK_KINDS[kind]){
      TASK_LEVELS.forEach(([key,label])=>addOption(label+' — '+(kind==='word'||kind==='pdf'?(key==='light'?'≤10 halaman':key==='medium'?'11–20 halaman':'>20 halaman / fitur rumit'):'berdasarkan fitur & volume'),TASK_KINDS[kind].priced?'general':'custom',key));
    }
    if(part.options.length)part.selectedIndex=0;
    $('#pptStyleField').hidden=kind!=='ppt';
    $('#methodField').hidden=kind!=='academic';
    syncMethod();
    updateHelp();
    calc();
  };
  const syncMethod=()=>{
    const source=(part.value||'').split('|')[0],isAcademic=type.value==='academic'&&source==='academic';
    method.disabled=!isAcademic;
    method.title=isAcademic?'Pilih metode penelitian':'Metode hanya diperlukan untuk pekerjaan akademik';
  };
  level.addEventListener('change',fill);
  type.addEventListener('change',fill);
  part.addEventListener('change',()=>{syncMethod();updateHelp();calc()});
  pptStyle?.addEventListener('change',calc);
  method.addEventListener('change',calc);
  deadline.addEventListener('change',calc);
  fill();
}

function getEstimatorBase(){
  const l=$('#level')?.value,kind=$('#fileType')?.value;
  const [source,key]=($('#part')?.value||'').split('|');
  const method=$('#method')?.value||'quant';
  if(source==='general' && TASK_KINDS[kind]?.priced){
    const row=(pricing.general||[]).find(x=>x.level===l);
    return row?Number(row[key]):null;
  }
  if(source==='academic')return pricing.academic?.[l]?.[key]?.[method]??null;
  if(source==='proposal')return (pricing.proposal||[]).find(x=>x.level===l)?.price??null;
  if(source==='internship')return (pricing.internship||[]).find(x=>x.level===l)?.[key]??null;
  if(source==='spssPackage')return pricing.spssPackages?.[Number(key)]?.price??null;
  if(source==='ppt')return pricing.ppt?.[Number(key)]?.[$('#pptStyle')?.value||'standard']??null;
  return null;
}

function calc(){
  const level=$('#level')?.value,part=$('#part'),kind=$('#fileType')?.value||'word';
  if(!level||!part?.value)return;
  const method=$('#method')?.value||'quant',di=Number($('#deadline')?.value||0);
  const ex=pricing.express?.[di]||pricing.express?.[0]||{label:'≥4 hari',multiplier:1,surcharge:0};
  const raw=getEstimatorBase(),known=raw!==null && Number.isFinite(Number(raw)) && Number(raw)>=0;
  const base=known?Number(raw):null;
  const total=known?Math.round(base*ex.multiplier):null;
  const label=part.options[part.selectedIndex]?.text||'';
  if($('#base'))$('#base').textContent=known?fmt(base):'Sesuai brief';
  if($('#express'))$('#express').textContent=known?(ex.surcharge?'+'+ex.surcharge+'%':'Normal'):'Dikonfirmasi';
  if($('#total'))$('#total').textContent=known?fmt(total):'Konsultasi';
  if($('#calcNote'))$('#calcNote').textContent=known?(ex.surcharge?'Express '+ex.label+' termasuk dalam estimasi.':'Estimasi harga dasar; deadline normal ≥4 hari.'):'Belum ada tarif tetap untuk pekerjaan ini. Kirim detail file, fitur, volume, dan deadline untuk mendapatkan harga.';
  if($('#waEstimate')){
    const detail=['Halo Joki Pelaihari, saya ingin konsultasi.','','Jenjang: '+level,'Jenis file / platform: '+($('#fileType')?.options[$('#fileType').selectedIndex]?.text||kind),'Tingkat / pekerjaan: '+label];
    if(kind==='academic' && ($('#part')?.value||'').startsWith('academic|'))detail.push('Metode: '+(method==='quant'?'Kuantitatif':'Kualitatif'));
    if(kind==='ppt')detail.push('Paket desain: '+($('#pptStyle')?.value||'standard'));
    detail.push('Deadline: '+ex.label,'Estimasi: '+(known?fmt(total):'Mohon penawaran sesuai brief'));
    $('#waEstimate').dataset.msg=detail.join('\n');
  }
}

$$('.tab').forEach(b=>b.addEventListener('click',()=>{$$('.tab').forEach(x=>x.classList.remove('active'));b.classList.add('active');renderTable(b.dataset.cat)}));
function renderTable(cat){const box=$('#priceTable');if(!box)return;const guide=$('#taskGuide');if(guide)guide.hidden=cat!=='general';let rows='',head='';if(cat==='general'){head='<tr><th>Jenjang</th><th>Ringan<br>≤10 hlm</th><th>Sedang<br>11–20 hlm</th><th>Kompleks<br>>20 hlm / khusus</th></tr>';rows=(pricing.general||[]).map(x=>'<tr><td>'+x.level+'</td><td>'+fmt(x.light)+'</td><td>'+fmt(x.medium)+'</td><td>'+fmt(x.complex)+'</td></tr>').join('')}else if(cat==='spss'){head='<tr><th>Jenis analisis</th><th>Harga</th></tr>';rows=(pricing.spss||[]).map(x=>'<tr><td>'+x.name+'</td><td>'+fmt(x.price)+'</td></tr>').join('')}else if(cat==='qualitative'){head='<tr><th>Layanan</th><th>Harga</th></tr>';rows=(pricing.qualitative||[]).map(x=>'<tr><td>'+x.name+'</td><td>'+fmt(x.price)+(x.suffix||'')+'</td></tr>').join('')}else if(cat==='transcript'){head='<tr><th>Durasi</th><th>Harga</th></tr>';rows=(pricing.transcript||[]).map(x=>'<tr><td>'+x.name+'</td><td>'+fmt(x.price)+(x.suffix||'')+'</td></tr>').join('')}else if(cat==='ppt'){head='<tr><th>Paket</th><th>Standard</th><th>Premium</th></tr>';rows=(pricing.ppt||[]).map(x=>'<tr><td>'+x.name+'</td><td>'+fmt(x.standard)+(x.suffix||'')+'</td><td>'+fmt(x.premium)+(x.suffix||'')+'</td></tr>').join('')}else{head='<tr><th>Durasi</th><th>Harga</th></tr>';rows=(pricing.consultation||[]).map(x=>'<tr><td>'+x.name+'</td><td>'+fmt(x.price)+'</td></tr>').join('')}box.innerHTML='<table><thead>'+head+'</thead><tbody>'+rows+'</tbody></table>'}
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