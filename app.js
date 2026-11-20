import {ensureSong,stagePattern} from './rhythm-model.js?v=18';
import {setupRhythms} from './rhythm-editor.js?v=20';
import{setupRiffEditor}from'./riff-editor.js?v=18';
import{CHORDS,NAMES,DEFAULT_STATE,validState,padVoice,validFrets,OPEN,chordNotes,normalizeLegacyArticulations,labelWidth}from'./music.js?v=18';import{GuitarAudio}from'./audio.js?v=18';import{hapticPulse,hapticTest,stopHaptics}from'./haptics.js?v=8';import{pressChord}from'./input.js?v=8';
import{CHORD_LIST,filterChords,normalizeChordQuery,CHORDS as VOICINGS,ROOTS}from'./chords.js?v=10';
import{initChoiceFields,refreshChoiceFields}from'./choice-fields.js?v=14';
import{arrangement,restoreArrangement,readSets,saveSet,deleteSet,sameArrangement}from'./sets-model.js?v=18';
import{matchingNames,resolveVoicing,normalizeCustomPad,isFingerboardTap}from'./voicing-model.js?v=18';
const $=id=>document.getElementById(id),clone=x=>JSON.parse(JSON.stringify(x)),STORE='suishou-guitar-v1';let state=clone(DEFAULT_STATE),selected=-1,animationTimer;
try{const x=JSON.parse(localStorage.getItem(STORE));if(validState(x))state=x;}catch{}
state=ensureSong(normalizeLegacyArticulations(state));state.pads=state.pads.map(normalizeCustomPad);
const guitar=new GuitarAudio();window.guitarDebug={engine:guitar,get state(){return clone(state)}};
function toast(s){$('toast').textContent=s;$('toast').classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('toast').classList.remove('show'),2300);}
function persist(){try{localStorage.setItem(STORE,JSON.stringify(state));return true;}catch{toast('无法保存到本机，当前设置仍可使用');return false;}}
let playState=null,stageActive=false,entering=false,riffUI,rhythmUI,stageRhythmId=null;
function padDescription(p,base){if(p.kind==='riff')return `Riff · ${p.riff.steps.length} 步`;const pattern=p.pattern||base,card=state.rhythmCards.find(c=>JSON.stringify(c.pattern)===JSON.stringify(pattern));return card?.name||NAMES[pattern.style];}
function renderPads(container,data,editable){
 container.replaceChildren();container.classList.toggle('many-pads',data.pads.length>4);
 container.style.setProperty('--pad-count',data.pads.length);container.dataset.count=data.pads.length;
 data.pads.forEach((p,i)=>{
 const wrap=document.createElement('div');wrap.className='pad-wrap';
 const b=document.createElement('button');b.className='pad';b.disabled=!guitar.ready;
 b.innerHTML=`<span class="number">0${i+1}</span><strong></strong><small></small>`;
 b.querySelector('small').textContent=padDescription(p,data.pattern)+(p.frets?' · 自选':p.pattern?' · 独立':'');
 b.querySelector('strong').textContent=p.chord;b.classList.toggle('custom-pad',!!p.frets);b.classList.toggle('long-name',labelWidth(p.chord)>5);b.classList.toggle('very-long-name',labelWidth(p.chord)>16);
 b.setAttribute('aria-label',`${editable?'试听':'弹奏'} ${p.chord}，${padDescription(p,data.pattern)}`);
 b.onpointerdown=e=>{e.preventDefault();b.setPointerCapture(e.pointerId);trigger(i);b.classList.add('pressed');};
 b.onpointerup=b.onpointercancel=b.onlostpointercapture=()=>b.classList.remove('pressed');b.onclick=e=>{if(e.detail===0&&!e.pointerType)trigger(i)};
 wrap.append(b);
 if(editable){const edit=document.createElement('button');edit.className='pad-edit';edit.textContent=p.kind==='riff'?'编':'换';edit.setAttribute('aria-label',`${p.kind==='riff'?'编辑 Riff':'更换和弦'} ${i+1} ${p.chord}`);edit.onclick=()=>openChordPicker(i);wrap.append(edit);if(p.kind!=='riff'){const rhythm=document.createElement('button');rhythm.className='pad-rhythm';rhythm.textContent='右手';rhythm.setAttribute('aria-label',`设置 ${i+1} ${p.chord} 的右手节奏`);rhythm.onclick=()=>rhythmUI.open(i);wrap.append(rhythm);}}
 container.append(wrap);
 });
}
function render(){renderPads($('pads'),state,true);$('volume').value=state.volume;$('volumeVal').textContent=state.volume;$('haptics').checked=!!state.haptics;$('addChord').disabled=$('addRiff').disabled=state.pads.length>=8;$('enterPlay').disabled=!guitar.ready||entering;refreshSetUI();renderEditorRhythms();}
function trigger(i){const data=stageActive?playState:state,p=data.pads[i];if(!pressChord(guitar,padVoice(p),stagePattern(p,data,stageActive?stageRhythmId:null),state.haptics,navigator))return;selected=i;const container=stageActive?$('playPads'):$('pads');[...container.querySelectorAll('.pad')].forEach((b,j)=>b.classList.toggle('active',i===j));$('nowChord').textContent=p.chord+' · '+padDescription(p,data.pattern);$('playNow').textContent=p.chord;document.body.classList.add('playing');clearTimeout(animationTimer);animationTimer=setTimeout(()=>document.body.classList.remove('playing'),2500);$('readyText').textContent='音色已就绪';}
function stop(){guitar.stop();document.body.classList.remove('playing');$('nowChord').textContent='已止音';$('playNow').textContent='已止音';}
$('mute').onpointerdown=e=>{e.preventDefault();stop()};$('mute').onclick=e=>{if(e.detail===0)stop()};$('volume').oninput=e=>{state.volume=Number(e.target.value);$('volumeVal').textContent=state.volume;guitar.setVolume(state.volume);};$('volume').onchange=persist;
function hapticStatus(accepted,test=false){$('hapticStatus').textContent=accepted?(test?'已请求一次 35 毫秒震动，与按和弦的反馈相同。':'按下时立即请求震动；实际手感由手机和浏览器决定。'):'当前浏览器未接受震动请求。请用安卓版 Chrome 打开测试。';}
$('haptics').onchange=e=>{state.haptics=e.target.checked;if(state.haptics)hapticStatus(hapticPulse(true,navigator));else{stopHaptics();$('hapticStatus').textContent='已关闭网页震动。手机系统触摸反馈不受此开关控制。';}persist();};
function testHaptic(){hapticStatus(hapticTest(),true);}
$('hapticTest').onpointerdown=e=>{e.preventDefault();testHaptic();};
$('hapticTest').onclick=e=>{if(e.detail===0&&!e.pointerType)testHaptic();};
async function load(){try{$('readyText').textContent='正在准备吉他采样…';await guitar.load((n,total)=>$('readyText').textContent=`正在准备音色 ${n} / ${total}`);$('readyText').textContent='正在准备弹法…';await guitar.preparePads(state.pads,state.pattern);guitar.setVolume(state.volume);$('readyDot').classList.add('ready');$('readyText').textContent='音色已就绪';render();if(location.hash==='#play')enterStage();}catch(err){$('readyText').textContent='加载失败 · 点击这里重试';document.querySelector('.soundbar').onclick=()=>{guitar.ctx?.close();load();};toast(err.message);}}

function openSettings(){if(stageActive)return;stop();$('settings').showModal();}
$('addRiff').onclick=()=>{if(!stageActive)riffUI.open();};
$('openGroupOptions').onclick=()=>$('groupOptions').showModal();$('closeGroupOptions').onclick=()=>$('groupOptions').close();$('groupOptions').addEventListener('click',e=>{if(e.target.closest('#copySet,#deleteSet'))$('groupOptions').close();},true);
$('openSettings').onclick=openSettings;$('editChords').onclick=()=>openChordPicker(selected<0?0:selected);$('addChord').onclick=()=>openChordPicker(-1);
$('settings').addEventListener('close',()=>guitar.stop());
$('about').onclick=()=>{const c=guitar.ctx;$('audioStats').textContent=c?`修订 18 · 弹法提前准备。采样：${guitar.buffers.size} 个音高 · ${c.sampleRate} Hz。实际触控到出声延迟需在手机上测量。`:'';$('info').showModal()};$('closeInfo').onclick=()=>$('info').close();
document.addEventListener('visibilitychange',()=>{if(document.hidden){stop();stopHaptics();}});window.addEventListener('pagehide',()=>{guitar.stop();stopHaptics();});

// Chord replacement is committed only after its prepared sound is ready.
let chordTarget=0,chordChoice='C',chordFamily='common',chordBusy=false,chordRecent=[],pickerMode='library',customFrets=[-1,3,2,0,1,0];
try{const stored=JSON.parse(localStorage.getItem('suishou-guitar-recents'));if(Array.isArray(stored))chordRecent=stored.filter(c=>Object.hasOwn(CHORDS,c)).slice(0,12);}catch{}
function openChordPicker(index){
 if(stageActive)return;if(index>=0&&state.pads[index].kind==='riff')return riffUI.open(index);
 if(index<0&&state.pads.length>=8)return toast('最多 8 个演奏键，请先移除一个');
 stop();chordTarget=index;const original=index<0?null:state.pads[index];chordChoice=original&&!original.frets?original.chord:'C';customFrets=original?.frets?[...original.frets]:[...(CHORDS[original?.chord]||CHORDS.C)];$('customChordName').value=original?.frets&&original.nameMode==='manual'?original.chord:'';lastFret=customFrets.map(f=>f<0?0:f);pickerMode=original?.frets?'custom':'library';chordFamily='common';$('chordSearch').value='';
 $('chordPickerTitle').textContent=index<0?'添加和弦':`更换第 ${index+1} 个和弦`;
 $('chordTargetHint').textContent=index<0?'增加一个演奏键，使用整套弹法。':'换好后直接弹奏，保留这个键的右手弹法。';
 $('removeChord').hidden=index<0||state.pads.length<=2;
 renderChordChoices();renderFretboard();updatePickerMode();$('chordPicker').showModal();
}
function chordPickerBusy(value){chordBusy=value;for(const el of $('chordPicker').querySelectorAll('button,input'))el.disabled=value;if(!value&&pickerMode==='custom'&&!validFrets(customFrets))$('previewChord').disabled=$('useChord').disabled=true;}
function renderChordChoices(){
 const q=$('chordSearch').value;let entries=filterChords(q,q?'all':chordFamily);
 if(q){const exact=normalizeChordQuery(q);entries.sort((a,b)=>Number(normalizeChordQuery(b.name)===exact)-Number(normalizeChordQuery(a.name)===exact));}
 if(!q&&chordFamily==='recent')entries=chordRecent.map(c=>CHORD_LIST.find(x=>x.name===c));
 if(!q&&chordFamily==='common'){const order=['C','Am','F','G','Dm','Em','D','E','A','Bm','C7','G7','A7','D7','E7','Cmaj7','Asus2','Dsus4'];entries.sort((a,b)=>order.indexOf(a.name)-order.indexOf(b.name));}
 $('chordChoices').replaceChildren();
 for(const entry of entries){const b=document.createElement('button');b.type='button';b.className='chord-option'+(entry.name===chordChoice?' chosen':'');b.setAttribute('aria-pressed',entry.name===chordChoice);b.setAttribute('aria-label',`选择 ${entry.name}，${entry.label}`);const name=document.createElement('strong');name.textContent=entry.name;const label=document.createElement('small');label.textContent=entry.label;b.append(name,label);b.onclick=()=>{chordChoice=entry.name;customFrets=[...CHORDS[entry.name]];$('customChordName').value='';renderChordChoices();};$('chordChoices').append(b);}
 const picked=CHORD_LIST.find(c=>c.name===chordChoice);if(pickerMode==='library')$('chordPicked').textContent=`${chordChoice} · ${picked.label}`;
 $('chordResultCount').textContent=entries.length?`${entries.length} 个和弦`:(!q&&chordFamily==='recent'?'换好或添加和弦后，会显示在这里。':'没有匹配和弦，可试试 C、Am、Bb 或 F#。');
 for(const b of $('chordFamilies').children)b.setAttribute('aria-pressed',!q&&b.dataset.family===chordFamily);
 if(pickerMode==='library')$('useChord').textContent=chordTarget<0?'添加到演奏区':`换成 ${chordChoice}`;
}
$('chordSearch').oninput=renderChordChoices;
for(const b of $('chordFamilies').children)b.onclick=()=>{chordFamily=b.dataset.family;$('chordSearch').value='';renderChordChoices();};
$('closeChordPicker').onclick=()=>{if(!chordBusy)$('chordPicker').close();};
$('chordPicker').addEventListener('cancel',e=>{if(chordBusy)e.preventDefault();});
$('chordPicker').addEventListener('close',()=>guitar.stop());
$('previewChord').onclick=async()=>{
 if(!guitar.ready||chordBusy)return toast('声音还在准备中');chordPickerBusy(true);$('previewChord').textContent='准备试听…';
 try{const p=chordTarget<0?state.pattern:(state.pads[chordTarget].pattern||state.pattern);await guitar.unlock();const voice=chosenVoice();await guitar.prepareChord(voice,p);guitar.play(voice,p);}catch(e){toast(e.message);}finally{chordPickerBusy(false);$('previewChord').textContent='♫ 试听';}
};
$('useChord').onclick=async()=>{
 if(!guitar.ready||chordBusy)return toast('声音还在准备中');if(pickerMode==='custom'&&!validFrets(customFrets))return toast('至少点选一个音');const next=clone(state),chosen=chosenVoice();
 const pad=chordTarget<0?{chord:'',pattern:null}:next.pads[chordTarget];if(pickerMode==='custom'){pad.chord=chosen.name;pad.frets=[...chosen.frets];pad.nameMode=$('customChordName').value.trim()?'manual':'auto';}else{pad.chord=chordChoice;delete pad.frets;delete pad.nameMode;}if(chordTarget<0)next.pads.push(pad);
 chordPickerBusy(true);$('useChord').textContent='准备声音…';
 try{guitar.stop();await guitar.preparePads(next.pads,next.pattern);state=next;selected=-1;persist();if(pickerMode==='library')chordRecent=[chordChoice,...chordRecent.filter(c=>c!==chordChoice)].slice(0,12);try{localStorage.setItem('suishou-guitar-recents',JSON.stringify(chordRecent));}catch{}render();$('chordPicker').close();$('nowChord').textContent='准备好了就弹';toast(chordTarget<0?'已添加和弦':'和弦已更换');}catch(e){toast(e.message);}finally{chordPickerBusy(false);renderChordChoices();if(pickerMode==='custom')renderCustomSummary();}
};
$('removeChord').onclick=async()=>{
 if(chordBusy||chordTarget<0||state.pads.length<=2)return;const next=clone(state);next.pads.splice(chordTarget,1);chordPickerBusy(true);
 try{guitar.stop();await guitar.preparePads(next.pads,next.pattern);state=next;selected=-1;persist();render();$('chordPicker').close();$('nowChord').textContent='准备好了就弹';toast('已移除这个和弦键');}catch(e){toast(e.message);}finally{chordPickerBusy(false);}
};

function matchingChordNames(){return matchingNames(customFrets);}
function chosenVoice(){if(pickerMode==='library')return chordChoice;const v=resolveVoicing(customFrets,$('customChordName').value);return {name:v.name,frets:v.frets};}
function updatePickerMode(){
 const custom=pickerMode==='custom';if(!custom)$('namingNotice').hidden=true;$('libraryPane').hidden=custom;$('fretboardPane').hidden=!custom;
 $('libraryTab').setAttribute('aria-selected',!custom);$('fretboardTab').setAttribute('aria-selected',custom);
 if(custom)renderCustomSummary();else{renderChordChoices();$('useChord').disabled=$('previewChord').disabled=false;}
}
$('libraryTab').onclick=()=>{pickerMode='library';updatePickerMode();};
$('fretboardTab').onclick=()=>{pickerMode='custom';renderFretboard();updatePickerMode();};
let lastFret=[0,0,0,0,0,0],boardStart=null,boardMoved=false;
const boardScroll=$('fretboardScroll');
boardScroll.addEventListener('pointerdown',e=>{boardStart={x:e.clientX,y:e.clientY,scrollLeft:boardScroll.scrollLeft};boardMoved=false;},{passive:true});
boardScroll.addEventListener('pointermove',e=>{if(boardStart&&!isFingerboardTap(boardStart,{x:e.clientX,y:e.clientY,scrollLeft:boardScroll.scrollLeft}))boardMoved=true;},{passive:true});
boardScroll.addEventListener('pointercancel',()=>{boardMoved=true;},{passive:true});
function selectFret(i,fret){
 if(customFrets[i]>=0)lastFret[i]=customFrets[i];
 customFrets[i]=customFrets[i]===fret?-1:fret;
 if(customFrets[i]>=0)lastFret[i]=customFrets[i];
 updateFretSelection();
}
function renderFretboard(){
 const table=$('fretboard'),left=boardScroll.scrollLeft;table.replaceChildren();
 const head=document.createElement('div');head.className='fret-row fret-head';
 for(const text of ['弦 · 开关',...Array.from({length:13},(_,i)=>i===0?'0 空弦':String(i))]){const cell=document.createElement('span');cell.textContent=text;head.append(cell);}table.append(head);
 for(let i=5;i>=0;i--){
  const row=document.createElement('div');row.className='fret-row';row.style.setProperty('--string-weight',(.6+(5-i)*.3)+'px');
  const label=document.createElement('button');label.type='button';label.className='string-label string-toggle';label.dataset.stringToggle=i;
  label.onclick=e=>{if(e.detail&&boardMoved)return;if(customFrets[i]>=0){lastFret[i]=customFrets[i];customFrets[i]=-1;}else customFrets[i]=lastFret[i]??0;updateFretSelection();};row.append(label);
  for(let fret=0;fret<=12;fret++){
   const b=document.createElement('button');b.type='button';b.className='fret-cell'+(fret===0?' open-fret':'');b.dataset.string=i;b.dataset.fret=fret;
   b.setAttribute('aria-label',`${6-i}弦 ${fret}品 ${ROOTS[(OPEN[i]+fret)%12]}`);const note=document.createElement('span');note.textContent=ROOTS[(OPEN[i]+fret)%12];b.append(note);
   b.onclick=e=>{if(e.detail&&boardMoved)return;selectFret(i,fret);};row.append(b);
  }table.append(row);
 }
 boardScroll.scrollLeft=left;updateFretSelection();
}
function updateFretSelection(){
 for(const b of $('fretboard').querySelectorAll('[data-fret]')){const active=customFrets[Number(b.dataset.string)]===Number(b.dataset.fret);b.classList.toggle('selected',active);b.setAttribute('aria-pressed',active);}
 for(const b of $('fretboard').querySelectorAll('[data-string-toggle]')){const i=Number(b.dataset.stringToggle),fret=customFrets[i];b.textContent=(6-i)+'弦\n'+(fret<0?'× 不弹':fret+'品');b.classList.toggle('string-muted',fret<0);b.setAttribute('aria-label',`${6-i}弦开关，当前${fret<0?'不弹':fret+'品'}，点击${fret<0?'恢复':'不弹'}`);b.setAttribute('aria-pressed',fret>=0);}
 renderCustomSummary();
}
function renderCustomSummary(){
 const notes=chordNotes({frets:customFrets});$('customNotes').textContent=notes.length?notes.map(n=>ROOTS[n.midi%12]+(Math.floor(n.midi/12)-1)).join(' · '):'还没有选择音，先点指板上的音符。';
 const identity=resolveVoicing(customFrets,$('customChordName').value);const matches=identity.matches;$('customMatch').textContent=matches.length?'可用名称：'+matches.slice(0,3).join(' / '):'自由组合，可给这组音起一个名字。';
 $('customChordName').placeholder=matches[0]||'例如：我的和弦';
 if(pickerMode==='custom'){$('chordPicked').textContent=identity.name+(identity.nameMode==='manual'?' · 自命名':'')+' · '+notes.length+' 根弦';$('namingNotice').hidden=!identity.conflict;$('namingNotice').textContent=identity.conflict?`名称是 ${identity.name}，但当前选音${matches.length?'对应 '+matches.join(' / '):'不对应这个和弦'}。清空名称可自动命名。`:'';$('useChord').textContent=chordTarget<0?'保存为和弦键':'保存这组音';$('useChord').disabled=$('previewChord').disabled=!notes.length||chordBusy;}
}
$('clearFrets').onclick=()=>{customFrets.forEach((f,i)=>{if(f>=0)lastFret[i]=f;});customFrets=[-1,-1,-1,-1,-1,-1];updateFretSelection();};
$('openFrets').onclick=()=>{customFrets=[0,0,0,0,0,0];lastFret=[0,0,0,0,0,0];updateFretSelection();};
$('customChordName').oninput=renderCustomSummary;

// Saved arrangements contain voicings and right-hand patterns, not device preferences.
const SETS_STORE='suishou-guitar-sets-v1',ACTIVE_STORE='suishou-guitar-active-set';
let savedSets=[],activeSetId=null,setLoading=false;
try{savedSets=readSets(JSON.parse(localStorage.getItem(SETS_STORE)));activeSetId=localStorage.getItem(ACTIVE_STORE);if(!savedSets.some(s=>s.id===activeSetId))activeSetId=null;}catch{}
function currentSet(){return savedSets.find(s=>s.id===activeSetId);}
function setDirty(){const current=currentSet();return !current||!sameArrangement(state,current.arrangement)||$('setName').value.trim()!==current.name;}
function refreshSetUI(){
 const current=currentSet(),dirty=setDirty();
 $('setSelect').replaceChildren(new Option('未命名编排',''),...savedSets.map(s=>new Option(s.name,s.id)));$('setSelect').value=activeSetId||'';
 $('setStatus').textContent=setLoading?'正在载入…':current?(dirty?'有未保存的更改':'已保存'):'尚未保存';
 $('setSelect').disabled=setLoading||!guitar.ready;$('deleteSet').disabled=!current||setLoading;$('saveSet').disabled=$('copySet').disabled=setLoading;
}
function writeSets(next){try{localStorage.setItem(SETS_STORE,JSON.stringify(next));savedSets=next;return true;}catch{toast('本机空间不足，未能保存和弦组');return false;}}
function rememberActive(){try{if(activeSetId)localStorage.setItem(ACTIVE_STORE,activeSetId);else localStorage.removeItem(ACTIVE_STORE);}catch{}}
function commitSet(asNew=false){
 if(setLoading)return;const name=$('setName').value.trim();
 try{const id=asNew||!activeSetId?crypto.randomUUID():activeSetId,next=saveSet(savedSets,id,name,state);if(!writeSets(next))return;activeSetId=id;$('setName').value=name;rememberActive();refreshSetUI();toast(asNew?'已另存一组':'整组和弦与弹法已保存');return true;}catch(e){toast(e.message);$('setName').focus();}
}
$('setName').value=currentSet()?.name||'';$('setName').oninput=refreshSetUI;
let saveAsNew=false,nameBeforeSave='';
function openSaveSheet(asNew){saveAsNew=asNew;nameBeforeSave=$('setName').value;if(asNew&&nameBeforeSave)$('setName').value=(nameBeforeSave+' · 副本').slice(0,40);$('saveSetTitle').textContent=asNew?'另存一组':'保存和弦组';$('saveSetPreview').replaceChildren(...state.pads.map(p=>{const tag=document.createElement('span');tag.textContent=p.chord;return tag;}));$('saveSetDialog').showModal();}
$('saveSet').onclick=()=>openSaveSheet(false);$('copySet').onclick=()=>openSaveSheet(true);
$('setName').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();$('commitSet').click();}};
$('commitSet').onclick=()=>{if(commitSet(saveAsNew)){nameBeforeSave=$('setName').value;$('saveSetDialog').close();}};
$('saveSetDialog').addEventListener('close',()=>{$('setName').value=nameBeforeSave;refreshSetUI();});
let pendingSetAction=null;
function confirmSetAction(title,text,action){$('setDialogTitle').textContent=title;$('setDialogText').textContent=text;pendingSetAction=action;$('setDialog').showModal();}
$('confirmSetAction').onclick=()=>{const action=pendingSetAction;pendingSetAction=null;$('setDialog').close();action?.();};
$('setDialog').addEventListener('close',()=>pendingSetAction=null);
$('deleteSet').onclick=()=>{const entry=currentSet();if(!entry)return;confirmSetAction('删除这组和弦？',`将删除「${entry.name}」的保存记录。当前编排仍会保留，可以重新保存。`,()=>{if(!writeSets(deleteSet(savedSets,entry.id)))return;activeSetId=null;rememberActive();refreshSetUI();toast('已删除保存记录，当前编排已保留');});};
async function loadSet(id){
 if(setLoading||stageActive)return;
 if(!id){activeSetId=null;$('setName').value='';rememberActive();refreshSetUI();return;}
 const entry=savedSets.find(s=>s.id===id);if(!entry)return;
 setLoading=true;$('enterPlay').disabled=true;refreshSetUI();
 for(const el of document.querySelectorAll('#editorPage button,#editorPage input,#editorPage select'))el.disabled=true;
 try{stop();const next=ensureSong(restoreArrangement(state,entry.arrangement));await guitar.preparePads(next.pads,next.pattern);state=next;activeSetId=id;selected=-1;$('setName').value=entry.name;persist();rememberActive();toast('已载入 '+entry.name);}catch(e){toast(e.message);}finally{setLoading=false;for(const el of document.querySelectorAll('#editorPage button,#editorPage input,#editorPage select'))el.disabled=false;render();}
}
$('setSelect').onchange=e=>{const id=e.target.value;refreshSetUI();if(id===activeSetId)return;if(id&&setDirty())confirmSetAction('载入另一组？','当前未保存的改动将被替换。可以先取消并保存整组。',()=>loadSet(id));else loadSet(id);};
async function enterStage(){
 if(stageActive||entering||setLoading)return;
 if(!guitar.ready){toast('音色还在准备中');return;}
 entering=true;$('enterPlay').disabled=true;$('enterPlay').textContent='正在准备弹唱…';
 try{stop();const snapshot=clone(state);await guitar.preparePads(snapshot.pads,snapshot.pattern,snapshot.rhythmCards);
 if(location.hash!=='#play')return;
 playState=snapshot;stageRhythmId=null;renderStageRhythms();selected=-1;renderPads($('playPads'),snapshot,false);$('playTitle').textContent=$('setName').value.trim()||'未命名和弦组';$('playNow').textContent='按下就响';
 stageActive=true;$('editorPage').hidden=true;$('playPage').hidden=false;document.body.classList.add('performance-mode');document.querySelector('meta[name=theme-color]').content='#101e1a';window.scrollTo(0,0);$('exitPlay').focus({preventScroll:true});
 }catch(e){toast(e.message);if(location.hash==='#play')history.replaceState(null,'',location.pathname+location.search);}
 finally{entering=false;$('enterPlay').innerHTML='进入弹唱 <span>↗</span>';$('enterPlay').disabled=!guitar.ready;}
}
function leaveStage(){
 if(!stageActive)return;stop();stageActive=false;playState=null;selected=-1;$('playPage').hidden=true;$('editorPage').hidden=false;document.body.classList.remove('performance-mode');document.querySelector('meta[name=theme-color]').content='#f8fafd';
 if(document.fullscreenElement)document.exitFullscreen?.().catch(()=>{});render();$('enterPlay').focus({preventScroll:true});
}
$('enterPlay').onclick=()=>{guitar.unlock().catch(()=>{});if(location.hash==='#play')enterStage();else location.hash='play';};
$('exitPlay').onclick=()=>{if(history.state?.guitarStage)history.back();else{history.replaceState(null,'',location.pathname+location.search);leaveStage();}};
window.addEventListener('hashchange',()=>{if(location.hash==='#play'){history.replaceState({guitarStage:true},'');enterStage();}else leaveStage();});
$('playMute').onpointerdown=e=>{e.preventDefault();stop();};$('playMute').onclick=e=>{if(e.detail===0)stop();};
$('fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else if(document.documentElement.requestFullscreen)await document.documentElement.requestFullscreen();else toast('当前浏览器不支持全屏，旋转手机仍可横屏弹唱');}catch{toast('未能进入全屏，旋转手机仍可横屏弹唱');}};
document.addEventListener('fullscreenchange',()=>{$('fullscreen').textContent=document.fullscreenElement?'⛶ 退出全屏':'⛶ 全屏';});
function renderEditorRhythms(){
 $('editorRhythms').replaceChildren(...state.rhythmCards.map(c=>{const b=document.createElement('button');b.textContent=c.name;b.setAttribute('aria-pressed',c.id===state.activeRhythmId);b.onclick=()=>rhythmUI.open(null,c);return b;}));
}
function renderStageRhythms(){
 const cards=[{id:null,name:'按编排'},...playState.rhythmCards];
 $('playRhythms').replaceChildren(...cards.map(c=>{const b=document.createElement('button');b.textContent=c.name;b.setAttribute('aria-pressed',stageRhythmId===c.id);b.onclick=()=>{stageRhythmId=c.id;for(const el of $('playRhythms').children)el.setAttribute('aria-pressed',el===b);for(const [i,pad]of playState.pads.entries()){if(pad.kind==='riff')continue;const p=stagePattern(pad,playState,stageRhythmId),el=$('playPads').children[i].querySelector('.pad');el.querySelector('small').textContent=c.id?c.name:padDescription(pad,playState.pattern);el.setAttribute('aria-label',`弹奏 ${pad.chord}，${c.id?c.name:NAMES[p.style]}`);}$('playNow').textContent='下次按和弦 · '+c.name;};return b;}));
}
$('openRhythms').onclick=()=>rhythmUI.open();
rhythmUI=setupRhythms({guitar,getState:()=>state,commit:next=>{state=next;selected=-1;persist();render();},toast});
initChoiceFields((select,value,current)=>{if(select.id!=='setSelect')return '';const entry=savedSets.find(s=>s.id===value);const pads=current?state.pads:(entry?.arrangement.pads||state.pads);return pads.map(p=>p.chord).join('  ·  ');});
riffUI=setupRiffEditor({guitar,getState:()=>state,commit:next=>{state=next;selected=-1;persist();render();$('nowChord').textContent='点按演奏键试听';},toast});
persist();render();load();
