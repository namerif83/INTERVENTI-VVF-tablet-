
const DB_NAME='vvf-interventi-v2', STORE='records';
const mezzi=['APS','ABP','AS (Autoscala)','Carro Soccorso','Autobotte (AB)','UCL','AF / Polisoccorso'];
let db,deferredPrompt,currentPhotos=[];

const $=id=>document.getElementById(id);
const val=id=>$(id).value.trim();
const chk=id=>$(id).checked;
const today=()=>new Date().toISOString().slice(0,10);
const makeId=()=>crypto.randomUUID?crypto.randomUUID():Date.now().toString(36)+Math.random().toString(36).slice(2);
const esc=(s='')=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function toast(msg){const t=$('toast');t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2200)}
function openDB(){return new Promise((res,rej)=>{const r=indexedDB.open(DB_NAME,1);r.onupgradeneeded=()=>r.result.createObjectStore(STORE,{keyPath:'id'});r.onsuccess=()=>{db=r.result;res()};r.onerror=()=>rej(r.error)})}
function store(mode='readonly'){return db.transaction(STORE,mode).objectStore(STORE)}
function req(r){return new Promise((res,rej)=>{r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}
const getAll=()=>req(store().getAll());const getOne=id=>req(store().get(id));const put=x=>req(store('readwrite').put(x));const del=id=>req(store('readwrite').delete(id));

function show(view){$('homeView').classList.toggle('hidden',view!=='home');$('formView').classList.toggle('hidden',view!=='form');scrollTo(0,0)}
function renderMezzi(){const box=$('mezziBox');if(box)box.innerHTML=mezzi.map(m=>`<label><input type="checkbox" data-mezzo="${esc(m)}"> ${esc(m)}</label>`).join('')}
function addPerson(p={}){
  const node=$('personTemplate').content.cloneNode(true);
  const card=node.querySelector('.person-card');
  card.dataset.docFront=p.docFront||p.docImage||'';
  card.dataset.docBack=p.docBack||'';
  card.querySelectorAll('[data-k]').forEach(el=>el.value=p[el.dataset.k]||'');

  const frontPreview=card.querySelector('.doc-front-preview');
  const backPreview=card.querySelector('.doc-back-preview');
  const frontStatus=card.querySelector('.doc-front-status');
  const backStatus=card.querySelector('.doc-back-status');
  const removeFront=card.querySelector('.remove-doc-front');
  const removeBack=card.querySelector('.remove-doc-back');
  const frontInput=card.querySelector('.doc-front-input');
  const backInput=card.querySelector('.doc-back-input');
  const frontGalleryInput=card.querySelector('.doc-front-gallery-input');
  const backGalleryInput=card.querySelector('.doc-back-gallery-input');
  const ocrButton=card.querySelector('.ocr-document-btn');
  const ocrProgress=card.querySelector('.ocr-progress');
  const ocrDetails=card.querySelector('.ocr-details');
  const ocrRawText=card.querySelector('.ocr-raw-text');

  function refresh(side){
    const isFront=side==='front';
    const value=isFront?card.dataset.docFront:card.dataset.docBack;
    const preview=isFront?frontPreview:backPreview;
    const status=isFront?frontStatus:backStatus;
    const removeButton=isFront?removeFront:removeBack;
    const label=isFront?'fronte':'retro';

    preview.classList.toggle('hidden',!value);
    removeButton.classList.toggle('hidden',!value);
    status.textContent=value?`Foto ${label} salvata`:`Nessuna foto ${label}`;
    if(value)preview.src=value;
    else preview.removeAttribute('src');
  }

  async function acquire(file,side){
    if(!file)return;
    try{
      const image=await compressImage(file,1800,.82);
      if(side==='front')card.dataset.docFront=image;
      else card.dataset.docBack=image;
      refresh(side);
      toast(`Foto ${side==='front'?'fronte':'retro'} acquisita`);
    }catch(error){
      toast('Impossibile acquisire la foto del documento');
    }
  }

  frontInput.onchange=async event=>{
    await acquire(event.target.files&&event.target.files[0],'front');
    event.target.value='';
  };
  backInput.onchange=async event=>{
    await acquire(event.target.files&&event.target.files[0],'back');
    event.target.value='';
  };
  frontGalleryInput.onchange=async event=>{
    await acquire(event.target.files&&event.target.files[0],'front');
    event.target.value='';
  };
  backGalleryInput.onchange=async event=>{
    await acquire(event.target.files&&event.target.files[0],'back');
    event.target.value='';
  };
  frontPreview.onclick=()=>openImageViewer(card.dataset.docFront);
  backPreview.onclick=()=>openImageViewer(card.dataset.docBack);
  ocrButton.onclick=()=>runDocumentOCR(card);

  removeFront.onclick=()=>{
    card.dataset.docFront='';
    refresh('front');
  };
  removeBack.onclick=()=>{
    card.dataset.docBack='';
    refresh('back');
  };

  card.querySelector('.remove-person').onclick=()=>card.remove();
  refresh('front');
  refresh('back');
  $('peopleList').appendChild(node);
}
function setPeople(list=[]){$('peopleList').innerHTML='';(list.length?list:[{}]).forEach(addPerson)}
function peopleData(){
  return [...document.querySelectorAll('.person-card')].map(card=>{
    const person={};
    card.querySelectorAll('[data-k]').forEach(el=>person[el.dataset.k]=el.value.trim());
    person.docFront=card.dataset.docFront||'';
    person.docBack=card.dataset.docBack||'';
    person.docImage=person.docFront;
    return person;
  }).filter(person=>Object.values(person).some(Boolean));
}

function addEntity(e={}){
  const node=$('entityTemplate').content.cloneNode(true);
  const card=node.querySelector('.entity-card');
  card.querySelectorAll('[data-e]').forEach(el=>el.value=e[el.dataset.e]||'');
  card.querySelector('.remove-entity').onclick=()=>card.remove();
  $('entitiesList').appendChild(node);
}
function setEntities(list=[]){
  $('entitiesList').innerHTML='';
  (list.length?list:[{}]).forEach(addEntity);
}
function entitiesData(){
  return [...document.querySelectorAll('.entity-card')].map(card=>{
    const e={};
    card.querySelectorAll('[data-e]').forEach(el=>e[el.dataset.e]=el.value.trim());
    return e;
  }).filter(e=>Object.values(e).some(Boolean));
}
function legacyEntities(record){
  if(Array.isArray(record.entiLista))return record.entiLista;
  const old=record.enti||{};
  const list=[];
  const push=(tipo,responsabile,denominazione='')=>{
    if(responsabile||denominazione)list.push({tipo,denominazione,responsabile,note:'',tipoAltro:''});
  };
  push('118',old.medico?'Medico: '+old.medico:'');
  push('118',old.infermiere?'Infermiere: '+old.infermiere:'');
  push('Carabinieri',old.cc||'');
  push('Polizia di Stato',old.ps||'');
  push('Polizia Locale',old.pl||'');
  push('Guardia di Finanza',old.gdf||'');
  push('Protezione Civile',old.pc||'');
  if(old.altriEnti)list.push({tipo:'Altro',tipoAltro:old.altriEnti,denominazione:'',responsabile:'',note:''});
  return list;
}


function addTeam(t={}){
  const node=$('teamTemplate').content.cloneNode(true);
  const card=node.querySelector('.team-card');
  card.querySelectorAll('[data-t]').forEach(el=>el.value=t[el.dataset.t]||'');
  card.querySelector('.remove-team').onclick=()=>card.remove();
  $('teamsList').appendChild(node);
}

function setTeams(list=[]){
  $('teamsList').innerHTML='';
  (list.length?list:[{}]).forEach(addTeam);
}

function teamsData(){
  return [...document.querySelectorAll('.team-card')].map(card=>{
    const team={};
    card.querySelectorAll('[data-t]').forEach(el=>team[el.dataset.t]=el.value.trim());
    return team;
  }).filter(team=>Object.values(team).some(Boolean));
}

function legacyTeams(record){
  if(Array.isArray(record.squadreLista))return record.squadreLista;

  const teams=[];
  const vehicles=Array.isArray(record.mezzi)?record.mezzi:[];
  const add=(sede,mezzo,note='')=>teams.push({
    sede:sede||'',
    mezzo:mezzo||'',
    targa:'',
    note:note||''
  });

  if(record.perm||record.permNome){
    if(vehicles.length)vehicles.forEach(v=>add(record.permNome||'Distaccamento permanente',v));
    else add(record.permNome||'Distaccamento permanente','');
  }

  if(record.vol||record.volNome){
    if(vehicles.length)vehicles.forEach(v=>add(record.volNome||'Distaccamento volontario',v));
    else add(record.volNome||'Distaccamento volontario','');
  }

  if(!record.perm&&!record.vol){
    vehicles.forEach(v=>add('',v));
  }

  if(record.mezzoAltro){
    add('','Altro',record.mezzoAltro);
  }

  return teams;
}

function compressImage(file,max=1600,q=.78){return new Promise((res,rej)=>{const fr=new FileReader();fr.onerror=()=>rej(fr.error);fr.onload=()=>{const im=new Image();im.onerror=()=>rej();im.onload=()=>{let w=im.width,h=im.height,s=Math.min(1,max/Math.max(w,h));w=Math.round(w*s);h=Math.round(h*s);const c=document.createElement('canvas');c.width=w;c.height=h;c.getContext('2d').drawImage(im,0,0,w,h);res(c.toDataURL('image/jpeg',q))};im.src=fr.result};fr.readAsDataURL(file)})}
function renderPhotos(){
  const box=$('photoList');
  box.innerHTML='';
  currentPhotos.forEach((photo,index)=>{
    const node=$('photoTemplate').content.cloneNode(true);
    const card=node.querySelector('.photo-card');
    const image=card.querySelector('img');
    image.src=photo.data;
    image.onclick=()=>openImageViewer(photo.data);
    const caption=card.querySelector('[data-photo-caption]');
    caption.value=photo.caption||'';
    caption.oninput=()=>currentPhotos[index].caption=caption.value;
    card.querySelector('.remove-photo').onclick=()=>{
      currentPhotos.splice(index,1);
      renderPhotos();
    };
    box.appendChild(node);
  });
}

function resetForm(){
  $('interventionForm').reset();$('recordId').value='';$('data').value=today();setPeople([]);setEntities([]);setTeams([]);currentPhotos=[];renderPhotos();
  $('lat').value='';$('lng').value='';$('gpsStatus').textContent='Nessuna posizione acquisita';
  $('formTitle').textContent='Nuovo intervento';$('deleteBtn').classList.add('hidden')
}
function gather(){
  return {
    id:val('recordId')||makeId(),createdAt:Date.now(),updatedAt:Date.now(),effettuato:chk('effettuato'),data:val('data'),
    tipologia:val('tipologia'),tipologiaAltro:val('tipologiaAltro'),comune:val('comune'),indirizzo:val('indirizzo'),
    lat:val('lat'),lng:val('lng'),squadreLista:teamsData(),
    persone:peopleData(),foto:currentPhotos.map(p=>({...p})),
    entiLista:entitiesData(),
    infoArrivo:val('infoArrivo'),
    provvedeva:val('provvedeva'),
    risultati:val('risultati'),
    danniCompleti:val('danniCompleti'),
    infortunatiDeceduti:val('infortunatiDeceduti'),
    causaSinistro:val('causaSinistro'),
    tutelaAdottata:val('tutelaAdottata'),
    poliziaGiudiziaria:val('poliziaGiudiziaria'),
    dinamica:val('infoArrivo'),
    situazione:val('infoArrivo'),
    operazioni:val('provvedeva'),
    danni:val('danniCompleti'),
    provvedimenti:val('tutelaAdottata'),
    note:val('poliziaGiudiziaria')
  }
}
function fill(r){
  resetForm();$('recordId').value=r.id;$('formTitle').textContent='Modifica intervento';$('deleteBtn').classList.remove('hidden');
  ['data','tipologia','tipologiaAltro','comune','indirizzo','lat','lng'].forEach(k=>$(k).value=r[k]||'');
  $('infoArrivo').value=r.infoArrivo||r.situazione||r.dinamica||'';
  $('provvedeva').value=r.provvedeva||r.operazioni||'';
  $('risultati').value=r.risultati||'';
  $('danniCompleti').value=r.danniCompleti||r.danni||'';
  $('infortunatiDeceduti').value=r.infortunatiDeceduti||'';
  $('causaSinistro').value=r.causaSinistro||'';
  $('tutelaAdottata').value=r.tutelaAdottata||r.provvedimenti||'';
  $('poliziaGiudiziaria').value=r.poliziaGiudiziaria||r.note||'';
  $('effettuato').checked=!!r.effettuato;
  setPeople(r.persone||[]);setEntities(legacyEntities(r));setTeams(legacyTeams(r));currentPhotos=(r.foto||[]).map(p=>({...p}));renderPhotos();
  $('gpsStatus').textContent=r.lat&&r.lng?`${r.lat}, ${r.lng}`:'Nessuna posizione acquisita'
}

async function render(q=''){
  const all=(await getAll()).sort((a,b)=>(b.data||'').localeCompare(a.data||'')||b.updatedAt-a.updatedAt);
  const now=new Date(),ym=now.toISOString().slice(0,7);
  $('countAll').textContent=all.length;$('countMonth').textContent=all.filter(r=>(r.data||'').startsWith(ym)).length;$('countDone').textContent=all.filter(r=>r.effettuato).length;
  const list=all.filter(r=>JSON.stringify(r).toLowerCase().includes(q.toLowerCase()));
  $('emptyState').classList.toggle('hidden',list.length>0);
  $('records').innerHTML=list.map(r=>`<article class="record">
    <div class="record-top"><div><h3>${esc(r.tipologiaAltro||r.tipologia||'Intervento')}</h3><p><strong>${esc(r.data||'Data non indicata')}</strong> · ${esc(r.comune||'Comune non indicato')}</p><p>${esc(r.indirizzo||'')}</p></div><span class="status ${r.effettuato?'done':''}">${r.effettuato?'Scheda fatta':'Da completare'}</span></div>
    <div class="record-actions"><button data-open="${r.id}">Apri</button><button data-copy="${r.id}">Duplica</button></div>
  </article>`).join('');
  document.querySelectorAll('[data-open]').forEach(b=>b.onclick=async()=>{fill(await getOne(b.dataset.open));show('form')});
  document.querySelectorAll('[data-copy]').forEach(b=>b.onclick=async()=>{const r=await getOne(b.dataset.copy);r.id=makeId();r.createdAt=r.updatedAt=Date.now();await put(r);toast('Intervento duplicato');render(q)})
}

$('newBtn').onclick=()=>{resetForm();show('form')};$('backBtn').onclick=()=>{show('home');render($('searchInput').value)};
$('addPersonBtn').onclick=()=>addPerson();$('addEntityBtn').onclick=()=>addEntity();$('addTeamBtn').onclick=()=>addTeam();$('searchInput').oninput=e=>render(e.target.value);
$('photoInput').onchange=async e=>{for(const f of [...e.target.files]){try{currentPhotos.push({data:await compressImage(f),caption:'',name:f.name,createdAt:Date.now()})}catch{toast('Foto non aggiunta')}}renderPhotos();e.target.value=''}
$('photoGalleryInput').onchange=async e=>{for(const f of [...e.target.files]){try{currentPhotos.push({data:await compressImage(f),caption:'',name:f.name,createdAt:Date.now()})}catch{toast('Foto non aggiunta')}}renderPhotos();e.target.value=''}

$('gpsBtn').onclick=()=>{
  if(!navigator.geolocation)return toast('GPS non disponibile');
  $('gpsStatus').textContent='Rilevamento in corso…';
  navigator.geolocation.getCurrentPosition(p=>{$('lat').value=p.coords.latitude.toFixed(6);$('lng').value=p.coords.longitude.toFixed(6);$('gpsStatus').textContent=`${$('lat').value}, ${$('lng').value}`;toast('Posizione acquisita')},()=>{$('gpsStatus').textContent='Posizione non disponibile';toast('Permesso GPS negato')},{enableHighAccuracy:true,timeout:12000})
};


let activeRecognition=null;
document.querySelectorAll('[data-mic]').forEach(btn=>btn.onclick=()=>{
  const field=$(btn.dataset.mic);
  const SpeechRecognition=window.SpeechRecognition||window.webkitSpeechRecognition;

  if(!SpeechRecognition){
    field.focus();
    toast('Usa il microfono della tastiera per dettare in questo campo');
    return;
  }

  if(activeRecognition){
    activeRecognition.stop();
    activeRecognition=null;
    document.querySelectorAll('[data-mic]').forEach(b=>b.classList.remove('mic-active'));
    return;
  }

  const recognition=new SpeechRecognition();
  activeRecognition=recognition;
  recognition.lang='it-IT';
  recognition.continuous=true;
  recognition.interimResults=false;

  recognition.onstart=()=>{
    btn.classList.add('mic-active');
    toast('Dettatura attiva. Tocca di nuovo 🎤 per fermare');
  };
  recognition.onresult=event=>{
    let transcript='';
    for(let i=event.resultIndex;i<event.results.length;i++){
      if(event.results[i].isFinal)transcript+=event.results[i][0].transcript+' ';
    }
    if(transcript.trim())field.value+=(field.value.trim()?' ':'')+transcript.trim();
  };
  recognition.onerror=event=>{
    if(event.error==='not-allowed')toast('Consenti l’uso del microfono nelle impostazioni del browser');
    else toast('Dettatura non disponibile: usa il microfono della tastiera');
  };
  recognition.onend=()=>{
    btn.classList.remove('mic-active');
    if(activeRecognition===recognition)activeRecognition=null;
  };
  try{recognition.start()}catch(error){
    activeRecognition=null;
    btn.classList.remove('mic-active');
    field.focus();
    toast('Usa il microfono della tastiera per dettare');
  }
});

$('interventionForm').onsubmit=async e=>{e.preventDefault();const r=gather(),old=r.id?await getOne(r.id):null;if(old)r.createdAt=old.createdAt;await put(r);toast('Intervento salvato');show('home');render()};
$('deleteBtn').onclick=async()=>{const id=val('recordId');if(id&&confirm('Eliminare definitivamente questo intervento?')){await del(id);show('home');render();toast('Intervento eliminato')}};

function buildChatGPTText(record){
  const tipo=record.tipologiaAltro||record.tipologia||'Non indicata';
  const persone=(record.persone||[]).map((p,index)=>{
    const residenza=[p.residenzaVia,p.residenzaCivico,p.residenzaComune,p.residenzaProvincia].filter(Boolean).join(', ');
    return [
      'Persona '+(index+1),
      p.nome?'Nome: '+p.nome:'',
      p.nascita?'Data di nascita: '+p.nascita:'',
      p.documento?'Documento: '+p.documento:'',
      p.numero?'Numero documento: '+p.numero:'',
      p.ruolo?'Ruolo: '+p.ruolo:'',
      residenza?'Residenza: '+residenza:''
    ].filter(Boolean).join(' — ');
  }).join('\n');

  const enti=(record.entiLista||legacyEntities(record)).map((e,index)=>{
    const tipoEnte=e.tipo==='Altro'?(e.tipoAltro||'Altro'):(e.tipo||e.tipoAltro||'Ente');
    return [
      'Ente '+(index+1)+': '+tipoEnte,
      e.denominazione?'Denominazione/mezzo: '+e.denominazione:'',
      e.responsabile?'Responsabile: '+e.responsabile:'',
      e.note?'Note: '+e.note:''
    ].filter(Boolean).join(' — ');
  }).join('\n');

  return [
    'Usa le istruzioni e i modelli presenti nel progetto ChatGPT dedicato alle schede intervento VVF.',
    'Redigi una relazione tecnica, cronologica, oggettiva e professionale usando solo i dati forniti.',
    'Non inventare informazioni mancanti.',
    '',
    'SCHEDA FATTA: '+(record.effettuato?'Sì':'No'),
    'DATA: '+(record.data||'Non indicata'),
    'TIPOLOGIA: '+tipo,
    'COMUNE: '+(record.comune||'Non indicato'),
    'INDIRIZZO: '+(record.indirizzo||'Non indicato'),
    'SQUADRE E MEZZI VVF:',
    ((record.squadreLista||legacyTeams(record)).map((team,index)=>{
      return [
        'Squadra '+(index+1),
        team.sede?'Sede: '+team.sede:'',
        team.mezzo?'Mezzo: '+team.mezzo:'',
        team.targa?'Targa: '+team.targa:'',
        team.note?'Note: '+team.note:''
      ].filter(Boolean).join(' — ');
    }).join('\n')||'Non indicati'),
    '',
    'PERSONE IDENTIFICATE:',
    persone||'Nessuna indicata',
    '',
    'ENTI PRESENTI:',
    enti||'Nessun ente indicato',
    '',
    "INFORMAZIONI E SITUAZIONE ALL'ARRIVO SUL POSTO:",
    record.infoArrivo||record.situazione||record.dinamica||'Non indicata',
    '',
    'IN CONSIDERAZIONE DI QUANTO SOPRA SI PROVVEDEVA A:',
    record.provvedeva||record.operazioni||'Non indicato',
    '',
    'RISULTATI OTTENUTI:',
    record.risultati||'Non indicati',
    '',
    'DANNI A PERSONE, BENI, RISORSE AMBIENTALI O NATURALI:',
    record.danniCompleti||record.danni||'Non indicati',
    '',
    'PERSONE INFORTUNATE E/O DECEDUTE:',
    record.infortunatiDeceduti||'Non indicate',
    '',
    'PRESUMIBILE CAUSA DEL SINISTRO:',
    record.causaSinistro||'Non indicata',
    '',
    'PROVVEDIMENTI DI TUTELA ADOTTATI:',
    record.tutelaAdottata||record.provvedimenti||'Non indicati',
    '',
    'ATTIVITÀ DI POLIZIA GIUDIZIARIA:',
    record.poliziaGiudiziaria||record.note||'Non indicata',
    '',
    'Le fotografie dell’intervento possono essere condivise separatamente. Non includere le foto dei documenti.'
  ].join('\n');
}

$('chatgptBtn').onclick=async()=>{
  const text=buildChatGPTText(gather());
  try{
    await navigator.clipboard.writeText(text);
  }catch(error){
    const area=document.createElement('textarea');
    area.value=text;
    area.style.position='fixed';
    area.style.opacity='0';
    document.body.appendChild(area);
    area.select();
    document.execCommand('copy');
    area.remove();
  }
  toast('Dati copiati negli appunti');
};


function dataUrlToFile(dataUrl,name){
  const parts=dataUrl.split(',');
  const mime=(parts[0].match(/:(.*?);/)||[])[1]||'image/jpeg';
  const binary=atob(parts[1]);
  const bytes=new Uint8Array(binary.length);
  for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
  return new File([bytes],name,{type:mime});
}

$('sharePhotosBtn').onclick=async()=>{
  const photos=currentPhotos||[];
  if(!photos.length){
    toast('Nessuna foto dell’intervento presente');
    return;
  }
  const files=photos.map((p,i)=>dataUrlToFile(p.data,`foto_intervento_${i+1}.jpg`));
  if(navigator.share && navigator.canShare && navigator.canShare({files})){
    try{
      await navigator.share({title:'Foto intervento VVF',files});
      return;
    }catch(error){
      if(error && error.name==='AbortError')return;
    }
  }
  toast('Condivisione multipla non supportata: salva le foto dalla galleria');
};

$('printBtn').onclick=()=>window.print();

$('exportBtn').onclick=async()=>{
  const data=await getAll(),blob=new Blob([JSON.stringify({version:2,exportedAt:new Date().toISOString(),records:data},null,2)],{type:'application/json'});
  const file=new File([blob],`backup_interventi_vvf_${today()}.json`,{type:'application/json'});
  if(navigator.share&&navigator.canShare?.({files:[file]})){try{await navigator.share({title:'Backup interventi VVF',files:[file]});return}catch{}}
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=file.name;a.click();URL.revokeObjectURL(a.href)
};
$('importInput').onchange=async e=>{const f=e.target.files[0];if(!f)return;try{const d=JSON.parse(await f.text()),rs=Array.isArray(d)?d:d.records;if(!Array.isArray(rs))throw 0;if(confirm(`Importare ${rs.length} interventi?`)){for(const r of rs)await put(r);render();toast('Archivio importato')}}catch{toast('Backup non valido')}e.target.value=''};

window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredPrompt=e;$('installBtn').classList.remove('hidden')});
$('installBtn').onclick=async()=>{if(deferredPrompt){deferredPrompt.prompt();await deferredPrompt.userChoice;deferredPrompt=null;$('installBtn').classList.add('hidden')}};


const tabletSteps=['intervento','persone','enti','relazione'];
let tabletStep='intervento';

function tabletShowStep(step,doScroll=true){
  if(!tabletSteps.includes(step))step='intervento';
  tabletStep=step;
  document.querySelectorAll('.form-section').forEach(section=>{
    section.classList.toggle('step-active',section.dataset.formPage===step);
  });
  document.querySelectorAll('#formTabs [data-step]').forEach(button=>{
    button.classList.toggle('active',button.dataset.step===step);
  });
  const position=tabletSteps.indexOf(step);
  $('stepCounter').textContent=`${position+1} di ${tabletSteps.length}`;
  $('stepPrevBtn').disabled=position===0;
  $('stepNextBtn').disabled=position===tabletSteps.length-1;
  $('stepNextBtn').textContent=position===tabletSteps.length-1?'Fine':'Avanti →';
  if(doScroll)window.scrollTo({top:0,behavior:'smooth'});
}

function tabletInit(){
  document.querySelectorAll('#formTabs [data-step]').forEach(button=>{
    button.onclick=()=>tabletShowStep(button.dataset.step);
  });
  $('stepPrevBtn').onclick=()=>{
    const position=tabletSteps.indexOf(tabletStep);
    if(position>0)tabletShowStep(tabletSteps[position-1]);
  };
  $('stepNextBtn').onclick=()=>{
    const position=tabletSteps.indexOf(tabletStep);
    if(position<tabletSteps.length-1)tabletShowStep(tabletSteps[position+1]);
  };
  $('newBtn').addEventListener('click',()=>tabletShowStep('intervento',false));
  tabletShowStep('intervento',false);
}


function normalizeOCRText(text=''){
  return text
    .replace(/\r/g,'\n')
    .replace(/[|]/g,'I')
    .replace(/[ \t]+/g,' ')
    .replace(/\n{2,}/g,'\n')
    .trim();
}

function ocrLines(text=''){
  return normalizeOCRText(text)
    .split('\n')
    .map(line=>line.trim())
    .filter(Boolean);
}

function isLikelyLabel(line=''){
  return /^(REPUBBLICA|ITALIANA|MINISTERO|CARTA|IDENTIT|IDENTITY|COGNOME|SURNAME|NOME|NAME|LUOGO|PLACE|DATA|DATE|SESSO|SEX|ALTEZZA|HEIGHT|CITTADINANZA|NATIONALITY|SCADENZA|EXPIRY|EMISSIONE|ISSUING|RESIDENZA|ADDRESS|COMUNE|DOCUMENT|DOC\.?|NUMERO|FIRMA|SIGNATURE|CODICE|FISCALE|AUTORIT)/i.test(line);
}

function valueAfterLabel(lines,patterns){
  for(let i=0;i<lines.length;i++){
    const line=lines[i];
    if(patterns.some(pattern=>pattern.test(line))){
      const inline=line.replace(/^.*?(?:COGNOME|SURNAME|NOME|GIVEN NAMES?|LUOGO(?: E DATA)? DI NASCITA|PLACE OF BIRTH|DATA DI NASCITA|DATE OF BIRTH|RESIDENZA|ADDRESS|NUMERO DOCUMENTO|DOCUMENT NO\.?|DOCUMENT NUMBER)\s*[:\-]?\s*/i,'').trim();
      if(inline && inline!==line && !isLikelyLabel(inline))return inline;
      for(let j=i+1;j<Math.min(lines.length,i+4);j++){
        if(!isLikelyLabel(lines[j]))return lines[j];
      }
    }
  }
  return '';
}

function toISODate(value=''){
  const match=value.match(/\b([0-3]?\d)[.\/\-]([01]?\d)[.\/\-]((?:19|20)?\d{2})\b/);
  if(!match)return '';
  let year=match[3];
  if(year.length===2)year=(Number(year)>30?'19':'20')+year;
  return `${year.padStart(4,'0')}-${match[2].padStart(2,'0')}-${match[1].padStart(2,'0')}`;
}

function parseItalianIdentityDocument(text=''){
  const lines=ocrLines(text);
  let surname=valueAfterLabel(lines,[/\bCOGNOME\b/i,/\bSURNAME\b/i]);
  let given=valueAfterLabel(lines,[/^NOME\b/i,/\bGIVEN NAMES?\b/i]);
  const birth=valueAfterLabel(lines,[/LUOGO.*NASCITA/i,/PLACE OF BIRTH/i]);
  let birthPlace=birth.replace(/\b[0-3]?\d[.\/\-][01]?\d[.\/\-](?:19|20)?\d{2}\b.*$/,'').trim();
  let birthDate=toISODate(valueAfterLabel(lines,[/DATA.*NASCITA/i,/DATE OF BIRTH/i])||birth);
  const residence=valueAfterLabel(lines,[/\bRESIDENZA\b/i,/\bADDRESS\b/i]);
  let documentNumber=valueAfterLabel(lines,[/NUMERO.*DOCUMENT/i,/DOCUMENT NO/i,/DOCUMENT NUMBER/i]);

  if(!documentNumber){
    const joined=lines.join(' ');
    const cie=joined.match(/\bC[A-Z0-9]{7,9}\b/);
    if(cie)documentNumber=cie[0];
  }

  if((!surname||!given)){
    const mrz=lines.filter(line=>/[A-Z]{2,}<<[A-Z<]{2,}/.test(line)).pop();
    if(mrz){
      const parts=mrz.replace(/[^A-Z<]/g,'').split('<<');
      if(!surname)surname=(parts[0]||'').replace(/</g,' ').trim();
      if(!given)given=(parts[1]||'').replace(/</g,' ').trim();
    }
  }

  return {
    nome:[surname,given].filter(Boolean).join(' ').replace(/\s+/g,' ').trim(),
    luogoNascita:birthPlace,
    nascita:birthDate,
    numero:documentNumber.replace(/\s+/g,'').trim(),
    residenzaVia:residence
  };
}

async function runDocumentOCR(card){
  const front=card.dataset.docFront||'';
  const back=card.dataset.docBack||'';
  const button=card.querySelector('.ocr-document-btn');
  const progress=card.querySelector('.ocr-progress');
  const details=card.querySelector('.ocr-details');
  const raw=card.querySelector('.ocr-raw-text');

  if(!front&&!back){
    toast('Aggiungi prima il fronte o il retro del documento');
    return;
  }
  if(!window.Tesseract){
    toast('Motore OCR non caricato. Controlla Internet, aggiorna la pagina e riprova');
    return;
  }

  button.disabled=true;
  progress.classList.remove('hidden');
  progress.textContent='Caricamento OCR…';
  let worker;

  try{
    worker=await Tesseract.createWorker('ita',1,{
      workerPath:'https://cdn.jsdelivr.net/npm/tesseract.js@v5.0.0/dist/worker.min.js',
      corePath:'https://cdn.jsdelivr.net/npm/tesseract.js-core@v5.0.0/',
      langPath:'https://tessdata.projectnaptha.com/4.0.0_fast/',
      workerBlobURL:true,
      gzip:true,
      logger:message=>{
        const labels={
          'loading tesseract core':'Caricamento motore OCR',
          'initializing tesseract':'Inizializzazione OCR',
          'loading language traineddata':'Caricamento lingua italiana',
          'initializing api':'Preparazione lettura',
          'recognizing text':'Lettura del documento'
        };
        const label=labels[message.status]||message.status||'Preparazione OCR';
        const percentage=typeof message.progress==='number'
          ? ` ${Math.round(message.progress*100)}%`
          : '';
        progress.textContent=label+percentage;
      },
      errorHandler:error=>{
        console.error('Errore worker OCR:',error);
      }
    });

    const texts=[];
    if(front){
      progress.textContent='Lettura fronte…';
      const result=await worker.recognize(front);
      texts.push(result.data.text||'');
    }
    if(back){
      progress.textContent='Lettura retro…';
      const result=await worker.recognize(back);
      texts.push(result.data.text||'');
    }

    const complete=normalizeOCRText(texts.join('\n'));
    const parsed=parseItalianIdentityDocument(complete);
    const fields=['nome','luogoNascita','nascita','numero','residenzaVia'];

    fields.forEach(key=>{
      const input=card.querySelector(`[data-k="${key}"]`);
      if(input && parsed[key] && !input.value.trim())input.value=parsed[key];
    });

    const docType=card.querySelector('[data-k="documento"]');
    if(docType && !docType.value)docType.value="Carta d'identità";

    raw.textContent=complete||'Nessun testo riconosciuto';
    details.classList.remove('hidden');
    details.open=true;
    toast('OCR completato: controlla e correggi i dati');
  }catch(error){
    console.error(error);
    const technicalMessage=(error&&error.message)?error.message:String(error||'Errore sconosciuto');
    raw.textContent='ERRORE OCR:\n'+technicalMessage;
    details.classList.remove('hidden');
    details.open=true;
    toast('OCR non riuscito: apri “Testo riconosciuto” per vedere il motivo');
  }finally{
    if(worker)await worker.terminate().catch(()=>{});
    button.disabled=false;
    progress.classList.add('hidden');
  }
}

let viewerScale=1;
let viewerRotation=0;
let viewerX=0;
let viewerY=0;
let viewerDragging=false;
let viewerStartX=0;
let viewerStartY=0;
let viewerPinchDistance=0;

function applyViewerTransform(){
  $('viewerImage').style.transform=`translate(${viewerX}px,${viewerY}px) scale(${viewerScale}) rotate(${viewerRotation}deg)`;
}

function resetImageViewer(){
  viewerScale=1;
  viewerRotation=0;
  viewerX=0;
  viewerY=0;
  applyViewerTransform();
}

function openImageViewer(source){
  if(!source)return;
  $('viewerImage').src=source;
  $('imageViewer').classList.remove('hidden');
  $('imageViewer').setAttribute('aria-hidden','false');
  document.body.classList.add('viewer-open');
  resetImageViewer();
}

function closeImageViewer(){
  $('imageViewer').classList.add('hidden');
  $('imageViewer').setAttribute('aria-hidden','true');
  $('viewerImage').removeAttribute('src');
  document.body.classList.remove('viewer-open');
}

function distanceBetweenTouches(touches){
  const dx=touches[0].clientX-touches[1].clientX;
  const dy=touches[0].clientY-touches[1].clientY;
  return Math.hypot(dx,dy);
}

function initImageViewer(){
  $('viewerClose').onclick=closeImageViewer;
  $('viewerZoomIn').onclick=()=>{viewerScale=Math.min(6,viewerScale+.35);applyViewerTransform()};
  $('viewerZoomOut').onclick=()=>{viewerScale=Math.max(.5,viewerScale-.35);applyViewerTransform()};
  $('viewerRotate').onclick=()=>{viewerRotation=(viewerRotation+90)%360;applyViewerTransform()};
  $('viewerReset').onclick=resetImageViewer;
  $('imageViewer').onclick=event=>{if(event.target===$('imageViewer'))closeImageViewer()};

  const stage=$('viewerStage');
  stage.onwheel=event=>{
    event.preventDefault();
    viewerScale=Math.max(.5,Math.min(6,viewerScale+(event.deltaY<0?.25:-.25)));
    applyViewerTransform();
  };
  stage.onpointerdown=event=>{
    viewerDragging=true;
    viewerStartX=event.clientX-viewerX;
    viewerStartY=event.clientY-viewerY;
    stage.setPointerCapture?.(event.pointerId);
  };
  stage.onpointermove=event=>{
    if(!viewerDragging)return;
    viewerX=event.clientX-viewerStartX;
    viewerY=event.clientY-viewerStartY;
    applyViewerTransform();
  };
  stage.onpointerup=()=>viewerDragging=false;
  stage.onpointercancel=()=>viewerDragging=false;
  stage.ontouchstart=event=>{
    if(event.touches.length===2)viewerPinchDistance=distanceBetweenTouches(event.touches);
  };
  stage.ontouchmove=event=>{
    if(event.touches.length===2){
      event.preventDefault();
      const distance=distanceBetweenTouches(event.touches);
      if(viewerPinchDistance){
        viewerScale=Math.max(.5,Math.min(6,viewerScale*(distance/viewerPinchDistance)));
        applyViewerTransform();
      }
      viewerPinchDistance=distance;
    }
  };
  stage.ontouchend=()=>viewerPinchDistance=0;
}


const SINGLE_BACKUP_CACHE='vvf-backup-unico-interno';
const SINGLE_BACKUP_KEY=new URL('./__backup_unico_vvf__.json',location.href).href;
const SINGLE_BACKUP_DATE_KEY='vvfSingleBackupDate';

async function updateSingleBackupStatus(){
  const status=$('singleBackupStatus');
  if(!status)return;
  const savedAt=localStorage.getItem(SINGLE_BACKUP_DATE_KEY);
  if(!savedAt){
    status.textContent='Non ancora creato';
    return;
  }
  const date=new Date(savedAt);
  status.textContent=`Ultimo aggiornamento: ${date.toLocaleString('it-IT')}`;
}

async function createSingleInternalBackup(){
  try{
    const records=await getAll();
    const payload={
      version:2,
      backupType:'single-internal',
      exportedAt:new Date().toISOString(),
      records
    };
    const cache=await caches.open(SINGLE_BACKUP_CACHE);
    await cache.put(
      SINGLE_BACKUP_KEY,
      new Response(JSON.stringify(payload),{
        headers:{'Content-Type':'application/json'}
      })
    );
    localStorage.setItem(SINGLE_BACKUP_DATE_KEY,payload.exportedAt);
    await updateSingleBackupStatus();
    toast(`Backup unico aggiornato: ${records.length} schede`);
  }catch(error){
    console.error(error);
    toast('Impossibile aggiornare il backup unico');
  }
}

async function restoreSingleInternalBackup(){
  try{
    const cache=await caches.open(SINGLE_BACKUP_CACHE);
    const response=await cache.match(SINGLE_BACKUP_KEY);
    if(!response){
      toast('Nessun backup unico disponibile');
      return;
    }
    const payload=await response.json();
    const records=Array.isArray(payload)?payload:payload.records;
    if(!Array.isArray(records)){
      toast('Backup unico non valido');
      return;
    }
    if(!confirm(`Ripristinare ${records.length} schede dal backup unico? Le schede con lo stesso ID verranno aggiornate.`)){
      return;
    }
    for(const record of records)await put(record);
    await render($('searchInput').value);
    toast(`Ripristino completato: ${records.length} schede`);
  }catch(error){
    console.error(error);
    toast('Impossibile ripristinare il backup unico');
  }
}

async function verifyOCRResources(){
  const button=document.querySelector('.ocr-document-btn');
  if(!button)return;
  if(!window.Tesseract){
    button.title='Motore OCR non caricato: serve Internet';
  }else{
    button.title='Leggi automaticamente i dati del documento';
  }
}

(async()=>{initImageViewer();tabletInit();$('singleBackupBtn').onclick=createSingleInternalBackup;$('singleRestoreBtn').onclick=restoreSingleInternalBackup;await updateSingleBackupStatus();await verifyOCRResources();renderMezzi();await openDB();await render();setPeople([]);setEntities([]);setTeams([]);if('serviceWorker'in navigator)navigator.serviceWorker.register('service-worker.js')})();
