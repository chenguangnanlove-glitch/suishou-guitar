import {PRESETS,readCards,ensureSong,editableSteps,patternLabel,applyCard,removeSongCard} from './rhythm-model.js?v=18';
import {validState,padVoice} from './music.js?v=18';
const copy=x=>JSON.parse(JSON.stringify(x)),STORE='suishou-guitar-rhythms-v1';
export function setupRhythms({guitar,getState,commit,toast}){
 const $=id=>document.getElementById(id);let library=[],draft=null,step=0,scope='all',targets=new Set(),busy=false,savedPersonalId=null,origin=null,lastRemoved=null,previewGeneration=0;
 try{library=readCards(JSON.parse(localStorage.getItem(STORE)));}catch{}
 const dialog=$('rhythmDialog');
 function button(text,fn,selected){const b=document.createElement('button');b.type='button';b.textContent=text;b.onclick=fn;if(selected!==undefined)b.setAttribute('aria-pressed',selected);return b;}
 function setBusy(value){busy=value;for(const e of dialog.querySelectorAll('button,input,select'))e.disabled=value;}
 function writeLibrary(next){try{localStorage.setItem(STORE,JSON.stringify(next));library=next;return true;}catch{toast('未能保存常用卡片，请检查本机空间');return false;}}
 async function removeCard(card,kind){
  if(busy)return;previewGeneration++;guitar.stop();
  if(kind==='personal'){
   const index=library.findIndex(c=>c.id===card.id);if(index<0)return;
   const removed=copy(library[index]);if(!writeLibrary(library.filter(c=>c.id!==card.id)))return;
   lastRemoved={card:removed,kind,index};
  }else{
   const state=getState(),index=state.rhythmCards.findIndex(c=>c.id===card.id);if(index<0)return;
   setBusy(true);try{const next=removeSongCard(state,card.id);await guitar.preparePads(next.pads,next.pattern);commit(next);lastRemoved={card:copy(state.rhythmCards[index]),kind,index,wasActive:state.activeRhythmId===card.id};}catch(e){toast(e.message);return;}finally{setBusy(false);}
  }
  showLibrary();toast(kind==='personal'?'已删除常用卡片，可撤销':'已从本曲移除，可撤销');
 }
 function libraryRow(card,kind){const row=document.createElement('div');row.className='rhythm-library-row';const b=button('',()=>edit(card,kind));const title=document.createElement('strong'),sub=document.createElement('small');title.textContent=card.name;sub.textContent=patternLabel(card.pattern)+' · '+card.pattern.bpm+' BPM';b.append(title,sub);row.append(b);if(kind!=='preset'){const remove=button(kind==='personal'?'删除':'移除',()=>removeCard(card,kind));remove.className='rhythm-remove';remove.setAttribute('aria-label',`${kind==='personal'?'删除常用':'从本曲移除'}卡片 ${card.name}`);row.append(remove);}return row;}
 function showLibrary(){ $('rhythmLibrary').hidden=false;$('rhythmEdit').hidden=true;renderLibrary();dialog.scrollTop=0;dialog.querySelector('.sheet').scrollTop=0;}
 $('undoRhythmDelete').onclick=async()=>{
  if(busy||!lastRemoved)return;const removed=lastRemoved;
  if(removed.kind==='personal'){
   if(library.length>=40)return toast('常用卡片已满，请先删除一张');
   const next=copy(library);if(!next.some(c=>c.id===removed.card.id))next.splice(removed.index,0,copy(removed.card));if(!writeLibrary(next))return;
  }else{
   const next=copy(getState());if(next.rhythmCards.length>=6)return toast('本曲卡片已满，请先移除一张');
   if(!next.rhythmCards.some(c=>c.id===removed.card.id))next.rhythmCards.splice(removed.index,0,copy(removed.card));
   if(removed.wasActive&&JSON.stringify(next.pattern)===JSON.stringify(removed.card.pattern))next.activeRhythmId=removed.card.id;
   setBusy(true);try{await guitar.preparePads(next.pads,next.pattern);commit(next);}catch(e){toast(e.message);return;}finally{setBusy(false);}
  }
  lastRemoved=null;renderLibrary();toast('已恢复这张卡片');
 };
 function renderLibrary(){$('rhythmUndo').hidden=!lastRemoved;$('rhythmUndoText').textContent=lastRemoved?`已${lastRemoved.kind==='personal'?'删除':'移除'}「${lastRemoved.card.name}」`:'';for(const [id,cards,kind]of [['songRhythms',ensureSong(getState()).rhythmCards,'song'],['personalRhythms',library,'personal'],['presetRhythms',PRESETS,'preset']]){$(id).replaceChildren(...cards.map(c=>libraryRow(c,kind)));} $('personalEmpty').hidden=library.length>0;}
 function open(index=null,card=null){if(!guitar.ready)return toast('音色还在准备中');guitar.stop();scope=Number.isInteger(index)?'selected':'all';targets=new Set(Number.isInteger(index)?[index]:[]);$('rhythmLibrary').hidden=false;$('rhythmEdit').hidden=true;renderLibrary();dialog.showModal();if(card)edit(card,'song');}
 function edit(card,kind){origin=kind;savedPersonalId=kind==='personal'?card.id:null;draft=copy(card);if(kind==='preset')draft.id='rhythm-'+crypto.randomUUID();step=0;dialog.scrollTop=0;dialog.querySelector('.sheet').scrollTop=0;$('rhythmLibrary').hidden=true;$('rhythmEdit').hidden=false;$('rhythmName').value=draft.name;renderEdit();}
 function renderEdit(){const p=draft.pattern;$('rhythmStyle').value=p.style;syncTempo();$('deleteEditingRhythm').hidden=origin==='preset';$('deleteEditingRhythm').textContent=origin==='personal'?'删除常用卡片':'从本曲移除';$('rhythmStrength').value=p.strength;$('rhythmStrengthText').textContent=p.strength+'%';$('rhythmRoom').value=p.room;$('rhythmRoomText').textContent=p.room+'%';$('rhythmStrings').hidden=p.style!=='pinch';$('rhythmSequence').hidden=!['pick','strum'].includes(p.style);$('rhythmTempo').hidden=['down','up','pinch'].includes(p.style);if(['pick','strum'].includes(p.style)){p.steps=editableSteps(p);step=Math.min(step,p.steps.length-1);const seq=p.steps;let tick=0;$('rhythmSteps').replaceChildren(...seq.map((s,i)=>{const b=button('',()=>{step=i;renderEdit()},i===step);b.className='rhythm-step';b.style.flexBasis=(s.ticks*40)+'px';const at=document.createElement('small'),action=document.createElement('strong'),length=document.createElement('span');at.textContent=(Math.floor(tick/4)+1)+(tick%4?' '+['','e','&','a'][tick%4]:' 拍');action.textContent=p.style==='strum'?({D:'↓',U:'↑',X:'×','-':'·'})[s.action]:s.strings.length?s.strings.map(x=>x==='B'?'低':x).join('+'):'·';length.textContent={1:'1/16',2:'1/8',4:'1/4'}[s.ticks];b.append(at,action,length);tick+=s.ticks;return b;}));$('rhythmLength').textContent=`${tick/4} 拍 · ${seq.length} 步`;$('rhythmStepTitle').textContent=`第 ${step+1} 步`;$('rhythmDurations').replaceChildren(...[[4,'四分'],[2,'八分'],[1,'十六分']].map(([ticks,label])=>button(label,()=>{const total=seq.reduce((n,s)=>n+s.ticks,0)-seq[step].ticks+ticks;if(total>32)return toast('一张卡片最多 8 拍');seq[step].ticks=ticks;renderEdit()},seq[step].ticks===ticks)));$('rhythmActions').replaceChildren();if(p.style==='strum'){for(const[action,label]of[['D','↓ 下扫'],['U','↑ 上扫'],['-','空拍']])$('rhythmActions').append(button(label,()=>{seq[step].action=action;renderEdit()},seq[step].action===action));}else stringButtons('rhythmActions',seq[step].strings,ss=>{seq[step].strings=ss;renderEdit()});}
 if(p.style==='pinch')stringButtons('rhythmStringButtons',p.strings||['B','3','2','1'],ss=>{p.strings=ss;renderEdit()});
 $('rhythmScopes').replaceChildren(...[['all','整组和弦'],['selected','选几个和弦'],['prepare','只加入弹唱']].map(([value,label])=>button(label,()=>{scope=value;renderEdit()},scope===value)));
 $('rhythmTargets').hidden=scope!=='selected';$('rhythmTargets').replaceChildren(...getState().pads.flatMap((pad,i)=>pad.kind==='riff'?[]:[button(`${i+1} · ${pad.chord}`,()=>{targets.has(i)?targets.delete(i):targets.add(i);renderEdit()},targets.has(i))]));
 $('applyRhythm').textContent=scope==='all'?'应用到整组':scope==='selected'?`应用到 ${targets.size} 个和弦`:'加入弹唱切换栏';
 }
 function stringButtons(id,values,change){$(id).replaceChildren(...['B','6','5','4','3','2','1'].map(v=>button(v==='B'?'低音':v+'弦',()=>change(values.includes(v)?values.filter(x=>x!==v):[...values,v]),values.includes(v))));}
 $('closeRhythms').onclick=()=>{if(!busy)dialog.close()};dialog.addEventListener('cancel',e=>{if(busy)e.preventDefault()});dialog.addEventListener('close',()=>{previewGeneration++;guitar.stop()});
 $('backRhythms').onclick=()=>{previewGeneration++;guitar.stop();showLibrary();};
 $('deleteEditingRhythm').onclick=()=>removeCard(draft,origin);
 $('rhythmName').oninput=e=>draft.name=e.target.value;
 $('rhythmStyle').onchange=e=>{const style=e.target.value;delete draft.pattern.steps;draft.pattern.style=style;if(['pick','strum'].includes(style))draft.pattern.steps=editableSteps(draft.pattern);step=0;renderEdit()};
 for(const[key,id]of[['strength','rhythmStrength'],['room','rhythmRoom']])$(id).oninput=e=>{draft.pattern[key]=Number(e.target.value);$(id+'Text').textContent=e.target.value+(key==='bpm'?' BPM':'%');};
 function syncTempo(){const bpm=draft.pattern.bpm;$('rhythmBpm').value=bpm;$('rhythmBpmNumber').value=bpm;for(const b of $('rhythmTempoPresets').children)b.setAttribute('aria-pressed',Number(b.dataset.bpm)===bpm);}
 function setTempo(value){const n=Number(value);if(!Number.isFinite(n)||String(value).trim()===''){syncTempo();return;}draft.pattern.bpm=Math.max(45,Math.min(320,Math.round(n)));syncTempo();}
 $('rhythmBpm').oninput=e=>setTempo(e.target.value);
 $('rhythmBpmNumber').oninput=e=>{const n=Number(e.target.value);if(e.target.value!==''&&Number.isInteger(n)&&n>=45&&n<=320){draft.pattern.bpm=n;$('rhythmBpm').value=n;for(const b of $('rhythmTempoPresets').children)b.setAttribute('aria-pressed',Number(b.dataset.bpm)===n);}};
 $('rhythmBpmNumber').onchange=e=>setTempo(e.target.value);
 $('rhythmBpmNumber').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();setTempo(e.target.value);e.target.blur();}};
 for(const[id,delta]of[['rhythmSlower5',-5],['rhythmSlower',-1],['rhythmFaster',1],['rhythmFaster5',5]])$(id).onclick=()=>setTempo(draft.pattern.bpm+delta);
 for(const bpm of [60,80,100,120,160]){const b=button(String(bpm),()=>setTempo(bpm));b.dataset.bpm=bpm;$('rhythmTempoPresets').append(b);}
 function changeStep(mode){const seq=draft.pattern.steps;if(mode==='delete'){if(seq.length===1)return toast('至少保留一步');seq.splice(step,1);step=Math.max(0,step-1);}else{const item=mode==='copy'?copy(seq[step]):draft.pattern.style==='strum'?{action:'-',ticks:2}:{strings:[],ticks:2};if(seq.length>=32||seq.reduce((n,s)=>n+s.ticks,0)+item.ticks>32)return toast('最多 32 步、8 拍');seq.splice(++step,0,item);}renderEdit();$('rhythmSteps').children[step]?.scrollIntoView({block:'nearest',inline:'nearest'});}
 $('rhythmAddStep').onclick=()=>changeStep('add');$('rhythmCopyStep').onclick=()=>changeStep('copy');$('rhythmDeleteStep').onclick=()=>changeStep('delete');
 function validate(){draft.name=$('rhythmName').value.trim();if(!draft.name)return toast('给这张节奏卡片起个名字'),false;const p=draft.pattern;if(p.style==='pinch'&&!p.strings?.length)return toast('至少选择一根弦'),false;if(!validState({...getState(),pattern:p}))return toast('节奏数据无法使用'),false;return true;}
 $('savePersonalRhythm').onclick=()=>{if(!validate())return;const existing=library.find(c=>c.id===savedPersonalId);if(!existing&&library.length>=40)return toast('常用卡片最多 40 张');const personal={...copy(draft),id:savedPersonalId||'personal-'+crypto.randomUUID()},next=existing?library.map(c=>c.id===personal.id?personal:c):[...library,personal];if(writeLibrary(next)){savedPersonalId=personal.id;toast('已存为常用卡片；已保存的歌曲不会自动改变');}};
 $('previewRhythm').onclick=async()=>{if(busy||!validate())return;const token=++previewGeneration,p=copy(draft.pattern),pad=getState().pads.find(p=>p.kind!=='riff');if(!pad)return toast('请先添加一个和弦试听');setBusy(true);try{await guitar.unlock();await guitar.prepareChord(padVoice(pad),p);if(dialog.open&&token===previewGeneration)guitar.play(padVoice(pad),p);}catch(e){toast(e.message);}finally{setBusy(false)}};
 $('applyRhythm').onclick=async()=>{if(busy||!validate())return;if(scope==='selected'&&!targets.size)return toast('请点选要应用的和弦');setBusy(true);$('applyRhythm').textContent='准备声音…';try{const next=applyCard(getState(),draft,scope==='all'?null:scope==='selected'?[...targets]:[]);guitar.stop();await guitar.preparePads(next.pads,next.pattern);commit(next);dialog.close();toast(scope==='prepare'?'已加入弹唱切换栏':scope==='all'?'整组已使用这张右手卡片':'选中的和弦已更新右手');}catch(e){toast(e.message);}finally{setBusy(false)}};
 return {open};
}
