import {validRiff,putRiffStep} from './riff-model.js?v=16';
import {OPEN} from './music.js?v=18';
import {ROOTS} from './chords.js?v=10';
import {isFingerboardTap} from './voicing-model.js?v=18';
export function setupRiffEditor({guitar,getState,commit,toast}){
 const $=id=>document.getElementById(id),dialog=$('riffEditor'),copy=x=>JSON.parse(JSON.stringify(x));
 let target=-1,steps=[],bpm=160,selected=-1,busy=false,serial=0,start=null,moved=false;
 const noteLabel=s=>s===null?'休止':`${s.string}弦${s.fret}品`;
 const voice=(notes=steps)=>({name:$('riffName').value.trim()||'Riff',riff:{bpm,steps:copy(notes)}});
 const pattern=()=>({...copy(getState().pattern),style:'down'});
 // Use the same pattern as preparePads/live playback. Riff events ignore its style.
 const livePattern=()=>copy(getState().pattern);
 function refresh(){
  $('riffSpeedText').textContent=bpm+' BPM';$('riffTiming').textContent=`每个音 ${Math.round(60000/bpm/2)} 毫秒 · 每拍 2 个音，所有步骤等长`;
  $('riffCount').textContent=steps.length+' / 16';const left=$('riffSteps').scrollLeft;$('riffSteps').replaceChildren();
  steps.forEach((s,i)=>{const b=document.createElement('button');b.type='button';b.className='riff-step';b.setAttribute('aria-pressed',selected===i);b.setAttribute('aria-label',`第 ${i+1} 步，${noteLabel(s)}`);const n=document.createElement('small');n.textContent=i+1;const text=document.createElement('strong');text.textContent=noteLabel(s);b.append(n,text);b.onclick=()=>{selected=i;refresh();};$('riffSteps').append(b);});
  if(!steps.length){const hint=document.createElement('p');hint.textContent='还没有音。点下方指板，编一句试试。';$('riffSteps').append(hint);}
  $('riffSteps').scrollLeft=left;$('riffRest').textContent=selected<0?'＋ 休止':'改为休止';
  $('riffEditHint').textContent=selected<0?'点指板，音会依次加入':`替换第 ${selected+1} 步 · 点指板选音`;
  $('riffDelete').disabled=busy||selected<0;$('riffAppend').disabled=busy;$('riffRest').disabled=busy||(selected<0&&steps.length>=16);
  $('previewRiff').disabled=$('saveRiff').disabled=busy||!validRiff({bpm,steps});
  for(const b of $('riffBoard').querySelectorAll('[data-fret]')){const s=steps[selected],on=!!s&&s.string===Number(b.dataset.string)&&s.fret===Number(b.dataset.fret);b.classList.toggle('selected',on);b.setAttribute('aria-pressed',on);}
 }
 function setBusy(value){busy=value;for(const el of dialog.querySelectorAll('button,input'))el.disabled=value;if(!value)refresh();}
 async function audition(note){const id=++serial;guitar.stop();if(!guitar.ready)return;try{await guitar.unlock();const v=voice([note]),p=pattern();await guitar.prepareChord(v,p);if(dialog.open&&id===serial&&!busy)guitar.play(v,p);}catch(e){toast(e.message);}}
 function put(note){if(busy)return;try{steps=putRiffStep(steps,selected,note);selected=-1;refresh();$('riffSteps').scrollLeft=$('riffSteps').scrollWidth;if(note)audition(note);else{serial++;guitar.stop();}}catch(e){toast(e.message);}}
 function board(){
  $('riffBoard').replaceChildren();const head=document.createElement('div');head.className='fret-row fret-head';
  for(const text of ['弦',...Array.from({length:13},(_,i)=>i===0?'0 空弦':i)]){const cell=document.createElement('span');cell.textContent=text;head.append(cell);}$('riffBoard').append(head);
  for(let string=1;string<=6;string++){const row=document.createElement('div');row.className='fret-row';row.style.setProperty('--string-weight',(.6+(string-1)*.3)+'px');const label=document.createElement('span');label.className='string-toggle riff-string-label';label.textContent=string+'弦';row.append(label);
   for(let fret=0;fret<=12;fret++){const b=document.createElement('button');b.type='button';b.className='fret-cell'+(fret===0?' open-fret':'');b.dataset.string=string;b.dataset.fret=fret;const note=ROOTS[(OPEN[6-string]+fret)%12];b.setAttribute('aria-label',`Riff ${string}弦 ${fret}品 ${note}`);const text=document.createElement('span');text.textContent=note;b.append(text);b.onclick=e=>{if(e.detail&&moved)return;put({string,fret});};row.append(b);}$('riffBoard').append(row);
  }
 }
 const scroll=$('riffBoardScroll');scroll.addEventListener('pointerdown',e=>{start={x:e.clientX,y:e.clientY,scrollLeft:scroll.scrollLeft};moved=false;},{passive:true});scroll.addEventListener('pointermove',e=>{if(start&&!isFingerboardTap(start,{x:e.clientX,y:e.clientY,scrollLeft:scroll.scrollLeft}))moved=true;},{passive:true});scroll.addEventListener('pointercancel',()=>moved=true,{passive:true});
 $('riffBpm').oninput=e=>{bpm=Number(e.target.value);serial++;guitar.stop();refresh();};$('riffAppend').onclick=()=>{selected=-1;refresh();};$('riffRest').onclick=()=>put(null);
 $('riffDelete').onclick=()=>{if(busy||selected<0)return;steps.splice(selected,1);selected=-1;serial++;guitar.stop();refresh();};
 $('previewRiff').onclick=async()=>{if(busy||!validRiff({bpm,steps}))return;if(!guitar.ready)return toast('声音还在准备中');serial++;setBusy(true);$('previewRiff').textContent='准备试听…';try{guitar.stop();await guitar.unlock();const v=voice(),p=livePattern();await guitar.prepareChord(v,p);if(dialog.open)guitar.play(v,p);}catch(e){toast(e.message);}finally{$('previewRiff').textContent='♫ 试听整句';setBusy(false);}};
 $('saveRiff').onclick=async()=>{if(busy||!validRiff({bpm,steps}))return;if(!guitar.ready)return toast('声音还在准备中');const next=copy(getState()),pad={kind:'riff',chord:$('riffName').value.trim()||'Riff',riff:{bpm,steps:copy(steps)},pattern:null};if(target<0){if(next.pads.length>=8)return toast('最多 8 个演奏键');next.pads.push(pad);}else next.pads[target]=pad;
  serial++;setBusy(true);$('saveRiff').textContent='准备声音…';try{guitar.stop();await guitar.preparePads(next.pads,next.pattern);commit(next);dialog.close();toast('Riff 键已保存，点一下弹一遍');}catch(e){toast(e.message);}finally{$('saveRiff').textContent='保存 Riff 键';setBusy(false);}};
 $('removeRiff').onclick=async()=>{if(busy||target<0||getState().pads.length<=2)return;const next=copy(getState());next.pads.splice(target,1);serial++;setBusy(true);try{guitar.stop();await guitar.preparePads(next.pads,next.pattern);commit(next);dialog.close();toast('已移除这个 Riff 键');}catch(e){toast(e.message);}finally{setBusy(false);}};
 $('closeRiff').onclick=()=>{if(!busy)dialog.close();};dialog.addEventListener('cancel',e=>{if(busy)e.preventDefault();});dialog.addEventListener('close',()=>{serial++;guitar.stop();});
 return {open(index=-1){if(busy)return;const state=getState();if(index<0&&state.pads.length>=8)return toast('最多 8 个演奏键，请先移除一个');guitar.stop();serial++;target=index;const original=index<0?null:state.pads[index];steps=copy(original?.riff?.steps||[]);bpm=original?.riff?.bpm||160;selected=-1;$('riffName').value=original?.kind==='riff'?original.chord:'';$('riffBpm').value=bpm;$('riffTitle').textContent=index<0?'添加 Riff':'编辑 Riff';$('removeRiff').hidden=index<0||state.pads.length<=2;board();scroll.scrollLeft=0;refresh();dialog.showModal();}};
}
