const fmt=n=>new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(Number(n||0));
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const ua=navigator.userAgent,platform=navigator.platform||'';
const apple=/iPhone|iPad|iPod/.test(ua)||(/Mac/.test(platform)&&navigator.maxTouchPoints<=1)||(platform==='MacIntel'&&navigator.maxTouchPoints>1);
document.documentElement.dataset.platform=apple?'apple':'universal';
const pricing=window.__PRICING__||{}, institutions=window.__INSTITUTIONS__||[];
/* Contextual task guide: keep the explanations inside Smart Price Calculator. */
const TASK_KINDS={
  word:{
    name:'Word / Google Docs',priced:true,
    light:'≤10 halaman; mengetik, merapikan format dasar, atau tulisan sederhana.',
    medium:'11–20 halaman; tabel, gambar, heading, dan sitasi standar.',
    complex:'>20 halaman atau format khusus; daftar isi otomatis, banyak tabel dan referensi.',
    note:'Harga Umum adalah acuan untuk dokumen Word/Docs yang bisa diedit. Format khusus atau kesulitan di luar contoh dikonfirmasi dari brief.'
  },
  pdf:{
    name:'PDF',priced:true,
    light:'Edit, gabung, pisah, atau konversi PDF sederhana (≤10 halaman) yang bisa diedit.',
    medium:'11–20 halaman; penataan ulang dan perbaikan dokumen PDF yang bisa diedit.',
    complex:'PDF hasil scan, banyak halaman, tata letak rumit, atau perlu ekstraksi teks (OCR).',
    note:'Harga Umum hanya sebagai acuan PDF yang dapat diedit. File scan/OCR dan pekerjaan kompleks perlu pemeriksaan file dan penawaran khusus.'
  },
  excel:{
    name:'Excel / Google Sheets',priced:false,
    light:'1–2 sheet; input data, tabel, SUM, AVERAGE, atau rumus dasar.',
    medium:'3–5 sheet; IF, lookup, grafik, dan rekap antar-sheet.',
    complex:'Dashboard, PivotTable, data besar, otomatisasi, atau banyak sumber data.',
    note:'Harga dihitung dari jumlah sheet, kerumitan rumus, volume data dan fitur, bukan halaman. Kirim file/brief untuk penawaran.'
  },
  web:{
    name:'Website / HTML-CSS-JS',priced:false,
    light:'Satu halaman statis dengan teks/gambar, tanpa database.',
    medium:'Beberapa halaman responsif dengan navigasi dan formulir sederhana.',
    complex:'Akun/login, database, dashboard admin, API, atau integrasi layanan.',
    note:'Harga ditentukan oleh jumlah halaman, fitur, desain, integrasi, hosting dan cakupan proyek. Kirim brief untuk penawaran.'
  },
  design:{
    name:'Canva / Desain',priced:false,
    light:'Satu desain/poster sederhana atau edit template.',
    medium:'Beberapa desain, variasi layout, dan revisi visual.',
    complex:'Paket identitas visual, banyak aset, atau desain khusus.',
    note:'Sampaikan aplikasi, output, jumlah aset, contoh desain, kebutuhan revisi dan deadline untuk penawaran.'
  },
  other:{
    name:'File / aplikasi lainnya',priced:false,
    light:'Satu pekerjaan sederhana, misalnya mengubah format file atau penyesuaian kecil.',
    medium:'Beberapa komponen, pengolahan isi dan revisi yang memerlukan beberapa tahap.',
    complex:'Banyak komponen, otomatisasi, integrasi atau fitur teknis khusus.',
    note:'Sebutkan format file, aplikasi, tujuan, volume pekerjaan dan hasil yang diinginkan agar tingkat kesulitan serta harga bisa dinilai.'
  }
};
const TASK_LEVELS=[['light','Ringan'],['medium','Sedang'],['complex','Kompleks']];
const PPT_GUIDE={
  light:'≤5 slide; layout sederhana.',
  medium:'6–10 slide; tata letak beragam, diagram, dan visual tambahan.',
  complex:'11–20 slide; banyak visual/animasi, atau desain premium. >20 slide dihitung sesuai scope.'
};
const ACADEMIC_GUIDE={
  'BAB I':'Pendahuluan: latar belakang masalah, rumusan masalah, tujuan dan manfaat penelitian. Kelengkapan disesuaikan pedoman kampus.',
  'BAB II':'Landasan teori dan penelitian terdahulu: menyusun alur pembahasan, kerangka pemikiran dan referensi yang relevan.',
  'BAB III':'Metodologi: pendekatan penelitian, populasi/sampel atau informan, instrumen, pengumpulan data, dan rencana analisis.',
  'BAB IV':'Hasil dan pembahasan: penyajian temuan, tabel/grafik, interpretasi dan kaitan dengan teori atau referensi.',
  'BAB V':'Penutup: kesimpulan berdasarkan hasil, keterbatasan, dan saran sesuai ketentuan akademik.',
  'BAB I–III':'Paket tahap awal: BAB I (pendahuluan), BAB II (teori), dan BAB III (metodologi).',
  'BAB IV–V':'Paket tahap akhir: BAB IV (hasil dan pembahasan) serta BAB V (kesimpulan dan saran).',
  'BAB I–V':'Paket BAB I sampai BAB V: cakupan pendahuluan, teori, metode, hasil, dan penutup. Batas revisi mengikuti brief.',
  'Abstrak ID + EN':'Abstrak Bahasa Indonesia dan Inggris: ringkasan tujuan, metode, temuan, kesimpulan serta kata kunci.',
  'Daftar pustaka & sitasi':'Meratakan gaya sitasi dan daftar pustaka sesuai pedoman (misalnya APA/Harvard) berdasarkan sumber yang tersedia.',
  'Formatting keseluruhan':'Merapikan margin, heading, spasi, penomoran, daftar isi, tabel/gambar dan tata letak naskah.',
  'Formatting':'Merapikan struktur dan tampilan dokumen sesuai template/pedoman kampus.',
  'Lengkap + format + abstrak':'Paket BAB I–V dengan pemeriksaan format dokumen dan penyusunan abstrak. Detail cakupan mengikuti brief.'
};
const safeText=s=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]));

function initEstimator(){
  const level=$('#level'),part=$('#part'),method=$('#method'),deadline=$('#deadline');
  const type=$('#fileType'),pptStyle=$('#pptStyle'),hint=$('#taskScopeHelp');
  if(!level||!part||!method||!deadline||!type||!hint)return;
  level.innerHTML='';
  (pricing.general||[]).forEach(row=>level.add(new Option(row.level,row.level)));
  level.value='S1';

  const addOption=(label,source,key)=>part.add(new Option(label,source+'|'+key));

  const renderRows=(descriptions,selected,showSelected=true)=>{
    return '<div class="scope-levels">'+TASK_LEVELS.map(([key,label])=>
      '<div class="scope-level '+(showSelected&&selected===key?'is-selected':'')+'">'+
      '<strong>'+label+(showSelected&&selected===key?' <span class="scope-current">Dipilih</span>':'')+'</strong>'+
      '<span>'+safeText(descriptions[key])+'</span></div>'
    ).join('')+'</div>';
  };

  const describeAcademic=(source,key)=>{
    if(source==='academic'){
      const methodSpecific=$('#method')?.value==='qual'?'Kualitatif (wawancara, observasi, tema/penafsiran)':'Kuantitatif (data numerik, variabel, statistik)';
      return {
        title:key,
        detail:ACADEMIC_GUIDE[key]||'Bagian penelitian atau dokumen akademik yang dipilih; cakupan final mengikuti panduan dan brief.',
        note:'Metode: '+methodSpecific+'. Jenjang: '+level.value+'. Harga mengikuti bagian yang dipilih dan tingkat penanganan.'
      };
    }
    if(source==='proposal')return {
      title:'Proposal penelitian',
      detail:'Rencana penelitian yang menjelaskan latar belakang, fokus/tujuan, kajian singkat, dan rancangan metode sebelum penelitian dilaksanakan.',
      note:'Cakupan mengikuti format proposal '+level.value+' dan pedoman lembaga.'
    };
    if(source==='internship')return key==='review'?{
      title:'PKL / Magang — Review & Revisi',
      detail:'Memeriksa struktur laporan, kejelasan isi, kesesuaian dengan panduan, konsistensi penulisan dan catatan perbaikan.',
      note:'Perlu file laporan dan aturan kampus/sekolah untuk memastikan cakupan revisi.'
    }:{
      title:'PKL / Magang — Formatting',
      detail:'Merapikan margin, heading, spasi, nomor halaman, daftar isi, tabel/gambar, serta layout laporan PKL atau magang.',
      note:'Konten laporan tetap mengikuti materi yang diberikan customer.'
    };
    if(source==='spssPackage'){
      const pack=pricing.spssPackages?.[Number(key)];
      return {
        title:'SPSS — '+(pack?.name||'Analisis'),
        detail:Number(key)===0?'Paket Basic: tiga jenis uji statistik dan interpretasi hasil.':Number(key)===1?'Paket Standard: lima jenis uji statistik dan interpretasi hasil.':'Paket Premium: rangkaian analisis statistik yang disesuaikan dengan rancangan dan data penelitian, berikut interpretasi.',
        note:'Pemilihan uji harus sesuai desain riset, struktur data, dan asumsi statistik. Pengolahan lanjutan di luar paket dikonfirmasi terpisah.'
      };
    }
    return {
      title:'Layanan akademik lainnya',
      detail:'Pilih jenis pekerjaan akademik yang dibutuhkan lalu kirim dokumen, pedoman, target hasil, serta deadline.',
      note:'Harga ditentukan setelah pemeriksaan brief.'
    };
  };

  const updateHelp=()=>{
    const kind=type.value,[source,key]=(part.value||'').split('|');
    if(TASK_KINDS[kind]){
      const info=TASK_KINDS[kind];
      let note=info.note;
      if(kind==='pdf'&&key==='complex')note+=' PDF scan/OCR tidak dihitung otomatis memakai tarif dokumen biasa.';
      hint.innerHTML='<div class="scope-header"><strong>'+safeText(info.name)+'</strong><span>Perbandingan tingkat kesulitan</span></div>'+
        renderRows(info,key)+
        '<p class="scope-note">'+safeText(note)+'</p>';
    }else if(kind==='ppt'){
      const row=source==='ppt'?pricing.ppt?.[Number(key)]:null;
      const bucket=source!=='ppt'?'complex':Number(key)===0?'light':Number(key)===1?'medium':'complex';
      const tier=pptStyle?.value==='premium'?'Premium':'Standard';
      const title=row?row.name:'>20 slide / presentasi khusus';
      hint.innerHTML='<div class="scope-header"><strong>PPT / Google Slides</strong><span>Contoh klasifikasi</span></div>'+
        renderRows(PPT_GUIDE,bucket,source==='ppt')+
        '<p class="scope-note"><strong>Pilihan: '+safeText(title)+' — '+safeText(tier)+'.</strong> Tarif berdasarkan jumlah slide dan paket Standard/Premium pada Price Table. Tambahan slide, animasi khusus atau >20 slide dihitung sesuai scope dan brief.</p>';
    }else if(kind==='academic'){
      const a=describeAcademic(source,key);
      hint.innerHTML='<div class="scope-header"><strong>'+safeText(a.title)+'</strong><span>Penjelasan pekerjaan</span></div>'+
        '<p class="scope-description">'+safeText(a.detail)+'</p>'+
        '<p class="scope-note">'+safeText(a.note)+'</p>';
    }else{
      hint.textContent='Pilih jenis file atau pekerjaan agar penjelasan lingkupnya muncul di sini.';
    }
  };

  const syncMethod=()=>{
    const source=(part.value||'').split('|')[0];
    const visible=type.value==='academic'&&source==='academic';
    const field=$('#methodField');
    if(field)field.hidden=!visible;
    method.disabled=!visible;
    method.title=visible?'Pilih metode penelitian':'Metode hanya untuk bagian penelitian yang memakai metode';
  };

  const fill=()=>{
    const kind=type.value,l=level.value;
    part.innerHTML='';
    const lab=$('#partLabel');
    if(lab)lab.textContent=kind==='academic'?'Bagian / Jenis Pekerjaan':kind==='ppt'?'Jumlah slide / pekerjaan':'Tingkat kesulitan';
    if(kind==='academic'){
      const academic=pricing.academic?.[l]||{};
      Object.keys(academic).forEach(k=>addOption(k,'academic',k));
      if((pricing.proposal||[]).some(x=>x.level===l))addOption('Proposal Penelitian','proposal','price');
      if((pricing.internship||[]).some(x=>x.level===l)){
        addOption('PKL / Magang — Review & Revisi','internship','review');
        addOption('PKL / Magang — Formatting','internship','formatting');
      }
      if(['D3/D4','S1','S2','S3'].includes(l)){
        (pricing.spssPackages||[]).forEach((x,i)=>addOption('SPSS — '+x.name,'spssPackage',String(i)));
      }
      if(part.options.length===0)addOption('Pekerjaan akademik lainnya — Konsultasi','custom','academic');
    }else if(kind==='ppt'){
      (pricing.ppt||[]).forEach((row,i)=>{
        if(row.suffix==='/slide')return;
        addOption(row.name+' — Presentasi','ppt',String(i));
      });
      addOption('>20 slide / presentasi khusus — Konsultasi','custom','ppt');
    }else if(TASK_KINDS[kind]){
      TASK_LEVELS.forEach(([key,label])=>{
        const volume=(kind==='word'||kind==='pdf')
          ?(key==='light'?'≤10 halaman':key==='medium'?'11–20 halaman':'>20 halaman / fitur rumit')
          :'berdasarkan fitur & volume';
        addOption(label+' — '+volume,TASK_KINDS[kind].priced?'general':'custom',key);
      });
    }
    if(part.options.length)part.selectedIndex=0;
    const field=$('#pptStyleField');
    if(field)field.hidden=kind!=='ppt';
    syncMethod();
    updateHelp();
    calc();
  };

  level.addEventListener('change',fill);
  type.addEventListener('change',fill);
  part.addEventListener('change',()=>{syncMethod();updateHelp();calc()});
  pptStyle?.addEventListener('change',()=>{updateHelp();calc()});
  method.addEventListener('change',()=>{updateHelp();calc()});
  deadline.addEventListener('change',calc);
  fill();
}

function getEstimatorBase(){
  const l=$('#level')?.value,kind=$('#fileType')?.value;
  const [source,key]=($('#part')?.value||'').split('|');
  const method=$('#method')?.value||'quant';
  if(source==='general' && TASK_KINDS[kind]?.priced){
    // Scanned/complex PDF needs a custom quote, not a generic page-rate estimate.
    if(kind==='pdf' && key==='complex')return null;
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

/* Complete Price Table — values always read from window.__PRICING__. */
const PRICE_CATEGORIES=['general','academic','proposal','internship','spss','qualitative','transcript','formatting','proofreading','ppt','consultation','digital','express'];
const PRICE_NOTES={
  general:'Acuan pekerjaan dokumen Word/Google Docs dan PDF yang dapat diedit. File scan/OCR, desain dan pekerjaan teknis khusus perlu penilaian brief.',
  academic:'Tarif per BAB/paket menurut jenjang dan metode penelitian. Harga tidak mencakup pekerjaan di luar cakupan yang disepakati.',
  proposal:'Tarif proposal berdasarkan jenjang. Ruang lingkup, referensi, dan format kampus perlu dikonfirmasi.',
  internship:'Review/revisi dan formatting adalah jenis pekerjaan berbeda. Pilih layanan sesuai kebutuhan.',
  spss:'Harga per uji dan harga paket adalah pilihan layanan tersendiri; tambahan uji di luar paket dihitung setelah konsultasi.',
  qualitative:'Harga paket NVivo lengkap bertanda + merupakan tarif mulai dari; kompleksitas data menentukan penawaran akhir.',
  transcript:'Untuk audio/video lebih dari 60 menit, harga dinyatakan per menit. Kualitas audio, bahasa, dan jumlah pembicara bisa memengaruhi harga final.',
  formatting:'Tarif sesuai jenjang dan cakupan. Paket lengkap tidak otomatis ditambah tarif item yang sudah termasuk.',
  proofreading:'Proofreading bahasa dihitung per halaman. Harga revisi berat bertanda + merupakan tarif mulai dari.',
  ppt:'Harga Standard/Premium mengikuti jumlah slide. Baris tambahan slide dinyatakan per slide.',
  consultation:'Tarif berdasarkan durasi/sesi konsultasi yang tercantum.',
  digital:'Belum tersedia harga tetap untuk jenis pekerjaan digital ini. Kirim file atau rincian fitur, volume, output dan deadline untuk mendapatkan penawaran.',
  express:'Biaya express adalah persentase tambahan terhadap harga dasar yang relevan, tergantung ketersediaan slot pengerjaan.'
};
const priceText=(value,suffix='')=>value===null||value===undefined?'Sesuai brief':fmt(value)+suffix;
const priceTable=(headings,rows)=>'<table><thead><tr>'+headings.map(x=>'<th>'+safeText(x)+'</th>').join('')+'</tr></thead><tbody>'+rows.map(cols=>'<tr>'+cols.map(v=>'<td>'+v+'</td>').join('')+'</tr>').join('')+'</tbody></table>';
const priceSectionTitle=name=>'<h3 class="price-group-label">'+safeText(name)+'</h3>';
const priceAction=(name,cat)=>'<button type="button" class="price-action-link" data-price-target="'+safeText(cat)+'">'+safeText(name)+'</button>';

function activatePriceTab(cat){
  if(!PRICE_CATEGORIES.includes(cat))return;
  $$('.price-tabs .tab').forEach(b=>{
    const active=b.dataset.cat===cat;
    b.classList.toggle('active',active);
    b.setAttribute('aria-selected',String(active));
  });
  renderTable(cat);
}
$$('.price-tabs .tab').forEach(b=>b.addEventListener('click',()=>activatePriceTab(b.dataset.cat)));
$('#priceAcademicLevel')?.addEventListener('change',()=>{
  const tab=$('.price-tabs .tab.active');
  if(tab?.dataset.cat==='academic')renderTable('academic');
});
$('#priceTable')?.addEventListener('click',e=>{
  const dest=e.target.closest('[data-price-target]')?.dataset.priceTarget;
  if(dest)activatePriceTab(dest);
});

function renderTable(cat){
  const box=$('#priceTable'),filters=$('#priceFilters'),note=$('#priceTableNote');
  if(!box)return;
  const rows=pricing||{};
  if(filters)filters.hidden=cat!=='academic';
  if(note)note.textContent=(PRICE_NOTES[cat]||'')+' Seluruh nominal merupakan tarif dasar sebelum biaya express; harga final mengikuti brief dan ketentuan layanan.';
  let out='';
  const s=priceText, e=safeText;

  if(cat==='general'){
    out=priceTable(['Jenjang','Ringan ≤10 hlm','Sedang 11–20 hlm','Kompleks >20 hlm / khusus'],(rows.general||[]).map(x=>[e(x.level),s(x.light),s(x.medium),s(x.complex)]));
  }else if(cat==='academic'){
    const level=$('#priceAcademicLevel')?.value||'S1';
    const academic=rows.academic?.[level]||{};
    out=priceSectionTitle('BAB & Paket Akademik — '+level)+priceTable(['Bagian / Paket','Kuantitatif','Kualitatif'],Object.entries(academic).map(([name,cost])=>[e(name),s(cost?.quant),s(cost?.qual)]));
  }else if(cat==='proposal'){
    out=priceTable(['Jenjang','Harga proposal'],(rows.proposal||[]).map(x=>[e(x.level),s(x.price)]));
  }else if(cat==='internship'){
    out=priceTable(['Jenjang','Review & Revisi','Formatting'],(rows.internship||[]).map(x=>[e(x.level),s(x.review),s(x.formatting)]));
  }else if(cat==='spss'){
    out=priceSectionTitle('Uji Statistik / SPSS')+priceTable(['Jenis analisis','Harga per layanan'],(rows.spss||[]).map(x=>[e(x.name),s(x.price)]))+
      priceSectionTitle('Paket SPSS')+priceTable(['Nama paket','Harga paket'],(rows.spssPackages||[]).map(x=>[e(x.name),s(x.price)]));
  }else if(cat==='qualitative'){
    out=priceTable(['Layanan NVivo','Harga'],(rows.qualitative||[]).map(x=>[e(x.name),s(x.price,x.suffix||'')]));
  }else if(cat==='transcript'){
    out=priceTable(['Durasi audio / video','Harga'],(rows.transcript||[]).map(x=>[e(x.name),s(x.price,x.suffix||'')]));
  }else if(cat==='formatting'){
    out=priceTable(['Jenis formatting','D3/D4 & S1','S2','S3'],(rows.formatting||[]).map(x=>[e(x.name),s(x['D3/D4 & S1']),s(x.S2),s(x.S3)]));
  }else if(cat==='proofreading'){
    out=priceTable(['Layanan','D3/D4 & S1','S2','S3'],(rows.proofreading||[]).map(x=>[e(x.name),s(x['D3/D4 & S1'],x.suffix||''),s(x.S2,x.suffix||''),s(x.S3,x.suffix||'')]));
  }else if(cat==='ppt'){
    out=priceTable(['Jumlah slide','Standard','Premium'],(rows.ppt||[]).map(x=>[e(x.name),s(x.standard,x.suffix||''),s(x.premium,x.suffix||'')]));
  }else if(cat==='consultation'){
    out=priceTable(['Durasi / sesi','Harga'],(rows.consultation||[]).map(x=>[e(x.name),s(x.price)]));
  }else if(cat==='digital'){
    out=priceTable(['Jenis file / pekerjaan','Harga / acuan'],[
      ['Word / Google Docs',priceAction('Lihat tarif Umum','general')],
      ['PDF yang bisa diedit',priceAction('Lihat tarif Umum','general')],
      ['PDF hasil scan / OCR','Sesuai brief'],
      ['Excel / Google Sheets','Sesuai brief'],
      ['Website / HTML-CSS-JS','Sesuai brief'],
      ['Canva / Desain','Sesuai brief'],
      ['PPT / Google Slides',priceAction('Lihat tarif PPT','ppt')],
      ['Aplikasi / file lainnya','Sesuai brief']
    ]);
  }else if(cat==='express'){
    out=priceTable(['Deadline','Tambahan dari harga dasar'],(rows.express||[]).map(x=>[e(x.label),x.surcharge?'+'+Number(x.surcharge)+'%':'Normal (0%)']));
  }
  box.innerHTML=out||'<p class="price-empty">Harga untuk kategori ini belum tersedia. Silakan konsultasi.</p>';
}
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