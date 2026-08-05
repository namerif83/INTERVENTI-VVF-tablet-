
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
  const box=$('photoList');box.innerHTML='';
  currentPhotos.forEach((p,i)=>{const n=$('photoTemplate').content.cloneNode(true),c=n.querySelector('.photo-card');c.querySelector('img').src=p.data;const cap=c.querySelector('[data-photo-caption]');cap.value=p.caption||'';cap.oninput=()=>currentPhotos[i].caption=cap.value;c.querySelector('.remove-photo').onclick=()=>{currentPhotos.splice(i,1);renderPhotos()};box.appendChild(n)})
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

(async()=>{tabletInit();renderMezzi();await openDB();await render();setPeople([]);setEntities([]);setTeams([]);if('serviceWorker'in navigator)navigator.serviceWorker.register('service-worker.js')})();
