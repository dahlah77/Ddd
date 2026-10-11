/* Joki Pelaihari V2 — anonymous conversion instrumentation.
   Sends event names and bounded categories only. Does not send names,
   message contents, order IDs, prices, form fields, IPs, or cookies.
   Vercel custom event reporting requires an eligible Vercel plan. */
(function(){
  'use strict';
  function track(name,data){
    if(typeof window.va!=='function')return;
    try{window.va('event',{name:name,data:data||{}});}catch(_){}
  }
  document.addEventListener('click',function(event){
    const node=event.target && event.target.closest && event.target.closest('a,button,[data-wa],.tab');
    if(!node)return;
    const anchor=node.closest('a');
    const url=anchor && anchor.getAttribute('href') || '';
    if(/^https?:\/\/(?:www\.)?instagram\.com\/joki_pelaihari\/?/i.test(url)){
      track('Instagram Click',{source:'website'});
    }else if(/^https?:\/\/wa\.me\//i.test(url)){
      track('WhatsApp Click',{source:'direct_link'});
    }else if(node.id==='waEstimate'){
      track('WhatsApp Click',{source:'price_calculator'});
    }else if(node.hasAttribute('data-wa')){
      track('WhatsApp Click',{source:'call_to_action'});
    }
    if(node.matches('.tab')){
      const category=node.getAttribute('data-cat');
      if(['general','spss','qualitative','transcript','ppt','consultation'].includes(category)){
        track('Price Table Viewed',{category:category});
      }
    }
    const modal=node.getAttribute('onclick')||'';
    if(modal.includes("openModal('orderModal')")||modal.includes('openModal("orderModal")')){
      track('Order Form Opened',{source:'website'});
    }
  },true);

  let calculatorInteracted=false;
  const calculatorIds=new Set(['level','fileType','part','method','pptStyle','deadline']);
  document.addEventListener('change',function(event){
    if(calculatorInteracted || !event.target || !calculatorIds.has(event.target.id))return;
    calculatorInteracted=true;
    const input=document.getElementById('fileType');
    const kind=input && input.value || 'unspecified';
    const allowed=['word','pdf','excel','ppt','web','design','other','academic'];
    track('Price Calculator Used',{file_type:allowed.includes(kind)?kind:'other'});
  },true);

  document.addEventListener('submit',function(event){
    if(event.target && event.target.id==='orderForm'){
      track('Order Form Submitted',{source:'website'});
    }else if(event.target && event.target.id==='reviewForm'){
      track('Review Submitted',{source:'website'});
    }
  },true);
})();