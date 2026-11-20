import {GuitarSynth} from './synthesis.js?v=18';
import {buildEvents,padVoice} from './music.js?v=18';

// Prepare the complete articulation off the live audio thread. A press starts
// ONE buffer, instead of constructing/cancelling dozens of per-string nodes.
export class GuitarAudio extends GuitarSynth {
 constructor(){super();this.cache=new Map();this.pending=new Map();this.cacheLimit=12;this.outputPeak=0;this.pinnedKeys=new Set();}
 initGraph(context){
  this.ctx=context;this.master=context.createGain();this.master.gain.value=.75;
  const guard=context.createWaveShaper(),curve=new Float32Array(4097);
  for(let i=0;i<curve.length;i++){const x=i/(curve.length-1)*2-1,a=Math.abs(x);curve[i]=Math.sign(x)*(a<=.75?a:.75+.23*(1-Math.exp(-(a-.75)/.23)));}
  guard.curve=curve;this.master.connect(guard);guard.connect(context.destination);this.guard=guard;
 }
 key(chord,p){return JSON.stringify([chord,p]);}
 async prepareChord(chord,p){
  const key=this.key(chord,p);
  if(this.cache.has(key)){const buffer=this.cache.get(key);this.cache.delete(key);this.cache.set(key,buffer);return buffer;}
  if(this.pending.has(key))return this.pending.get(key);
  const job=this.renderChord(chord,p).then(buffer=>{
   this.cache.set(key,buffer);
   this.trimCache();
   return buffer;
  }).finally(()=>this.pending.delete(key));
  this.pending.set(key,job);return job;
 }
 trimCache(){for(const key of this.cache.keys()){if(this.cache.size<=this.cacheLimit)break;if(!this.pinnedKeys.has(key))this.cache.delete(key);}}
 async preparePads(pads,pattern,cards=[]){
  const jobs=pads.flatMap(pad=>{const voice=padVoice(pad);return [[voice,pad.pattern||pattern],...(pad.kind==='riff'?[]:cards.map(c=>[voice,c.pattern]))];});
  const previous=this.pinnedKeys,next=new Set(jobs.map(([voice,p])=>this.key(voice,p)));
  this.pinnedKeys=new Set([...previous,...next]);
  try{for(const [voice,p] of jobs)await this.prepareChord(voice,p);this.pinnedKeys=next;}
  catch(e){this.pinnedKeys=previous;throw e;}
  this.trimCache();
 }
 async renderChord(chord,p){
  const events=buildEvents(chord,p),end=chord?.riff?chord.riff.steps.length*60/chord.riff.bpm/2+.15:Math.max(0,...events.map(e=>e.time))+5.65;
  const C=window.OfflineAudioContext||window.webkitOfflineAudioContext;
  if(!C)throw Error('当前浏览器无法准备弹法，请用安卓版 Chrome 打开');
  const rate=this.ctx.sampleRate,offline=new C(2,Math.ceil(end*rate),rate),synth=new GuitarSynth();
  synth.initGraph(offline);synth.buffers=this.buffers;synth.ready=true;synth.master.gain.value=1;
  synth.perform(chord,p);
  const result=await offline.startRendering();
  // A conservative peak ceiling allows old/new chords to crossfade without clipping.
  let peak=0;
  for(let ch=0;ch<result.numberOfChannels;ch++){const data=result.getChannelData(ch);for(let i=0;i<data.length;i++)peak=Math.max(peak,Math.abs(data[i]));}
  const scale=peak>.42?.42/peak:1;
  for(let ch=0;ch<result.numberOfChannels;ch++){
   const data=result.getChannelData(ch);for(let i=0;i<data.length;i++)data[i]*=scale;
   // Final hard safety: the prepared buffer starts and ends at exact silence.
   const fade=Math.min(192,data.length>>1);
   for(let i=0;i<fade;i++){data[i]*=i/fade;data[data.length-1-i]*=i/fade;}
  }
  return result;
 }
 play(chord,p){
  if(!this.ready||!this.cache.has(this.key(chord,p)))return false;
  return super.play(chord,p);
 }
 releaseVoice(v,time,duration=.016){
  if(v.stopAt<=time){this.voices.delete(v);return;}
  if(v.releasing)return;
  v.releasing=true;
  if(v.time>time){v.src.stop(time);this.voices.delete(v);return;}
  // The live gain has NO earlier envelope to cancel or estimate: it is always 1.
  v.gain.gain.setValueAtTime(1,time);
  v.gain.gain.linearRampToValueAtTime(0,time+duration);
  v.stopAt=time+duration+.002;v.src.stop(v.stopAt);
 }
 stop(release=.016){this.generation++;if(!this.ctx)return;const now=this.ctx.currentTime;for(const v of this.voices)this.releaseVoice(v,now,release);}
 perform(chord,p){
  const buffer=this.cache.get(this.key(chord,p));if(!buffer)return;
  this.stop(.016);
  const c=this.ctx,src=c.createBufferSource(),gain=c.createGain(),time=c.currentTime+.003;
  src.buffer=buffer;gain.gain.setValueAtTime(1,time);src.connect(gain);gain.connect(this.master);
  const voice={src,gain,time,stopAt:time+buffer.duration,releasing:false};this.voices.add(voice);
  src.onended=()=>{this.voices.delete(voice);src.disconnect();gain.disconnect();};
  this.lastEventCount=1;src.start(time);src.stop(voice.stopAt);
 }
}
