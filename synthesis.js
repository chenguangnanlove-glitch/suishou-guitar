import {buildEvents} from './music.js?v=18';

// Evaluate our own envelope so cancellation is continuous on browsers without
// AudioParam.cancelAndHoldAtTime, including when a note is still attacking.
export function envelopeAt(voice,time){
 const r=voice.release;
 if(r&&time>=r.time)return time>=r.end?0:r.level*(r.end-time)/(r.end-r.time);
 const points=voice.envelope;
 if(time<=points[0].time)return points[0].value;
 for(let i=1;i<points.length;i++){
  const a=points[i-1],b=points[i];
  if(time<=b.time){const f=(time-a.time)/(b.time-a.time);return b.curve==='exponential'?a.value*(b.value/a.value)**f:a.value+(b.value-a.value)*f;}
 }
 return points.at(-1).value;
}
export class GuitarSynth {
 constructor(){this.ctx=null;this.buffers=new Map();this.voices=new Set();this.generation=0;this.ready=false;this.lastEventCount=0;}
 async load(progress=()=>{},context=null){
  const C=window.AudioContext||window.webkitAudioContext;
  if(!context&&!C)throw Error('此浏览器不支持音频，请使用 Chrome 打开');
  this.initGraph(context||new C({latencyHint:'interactive'}));const c=this.ctx;
  const r=await fetch('audio/manifest.json?v=3');if(!r.ok)throw Error('采样清单加载失败');const files=await r.json();let done=0;
  await Promise.all(files.map(async f=>{
   const res=await fetch('audio/'+f.file);if(!res.ok)throw Error('采样下载失败');const b=await c.decodeAudioData(await res.arrayBuffer());
   const data=b.getChannelData(0);let start=0;while(start<data.length&&Math.abs(data[start])<.001)start++;
   start=Math.max(0,start-Math.floor(b.sampleRate*.002));this.buffers.set(f.midi,{buffer:b,offset:start/b.sampleRate});progress(++done,files.length);
  }));this.ready=true;
 }
 initGraph(context){
  this.ctx=context;const c=context;
  this.master=c.createGain();this.master.gain.value=.75;
  this.compressor=c.createDynamicsCompressor();this.compressor.threshold.value=-8;this.compressor.knee.value=6;this.compressor.ratio.value=20;this.compressor.attack.value=.001;this.compressor.release.value=.09;
  this.bus=c.createGain();this.bus.gain.value=.18;
  this.highpass=c.createBiquadFilter();this.highpass.type='highpass';this.highpass.frequency.value=45;this.highpass.Q.value=.5;
  this.bus.connect(this.highpass);this.highpass.connect(this.compressor);this.compressor.connect(this.master);
  // Transparent below 0.75; a smooth safety knee above it bounds rare overlaps.
  this.guard=c.createWaveShaper();const curve=new Float32Array(8193);
  for(let i=0;i<curve.length;i++){const x=i/(curve.length-1)*2-1,a=Math.abs(x);curve[i]=Math.sign(x)*(a<=.75?a:.75+.23*(1-Math.exp(-(a-.75)/.23)));}
  this.guard.curve=curve;this.guard.oversample='2x';this.master.connect(this.guard);this.guard.connect(c.destination);
  this.reverb=c.createConvolver();this.reverb.normalize=false;
  const impulse=c.createBuffer(2,Math.floor(c.sampleRate*.24),c.sampleRate);
  for(let ch=0;ch<2;ch++){const a=impulse.getChannelData(ch);for(const [t,v] of [[.027,.24],[.053,.16],[.089,.10],[.137,.055],[.193,.025]])a[Math.floor((t+ch*.003)*c.sampleRate)]=v;}
  this.reverb.buffer=impulse;this.wet=c.createGain();this.wet.gain.value=0;
  this.highpass.connect(this.reverb);this.reverb.connect(this.wet);this.wet.connect(this.compressor);
 }
 unlock(){if(this.ctx?.state==='suspended')return this.ctx.resume();return Promise.resolve();}
 setVolume(v){if(this.master)this.master.gain.setTargetAtTime(v/100,this.ctx.currentTime,.015);}
 releaseVoice(v,time,duration=.024){
  if(v.stopAt<=time){if(v.stopAt<=(this.ctx?.currentTime??0))this.voices.delete(v);return;}
  if(v.time>time){try{v.src.stop();}catch{}this.voices.delete(v);return;}
  const end=time+duration;
  // Repeated touches must never extend an already fading voice.
  if(v.release&&v.release.end<=end)return;
  const level=envelopeAt(v,time);v.release={time,end,level};v.stopAt=end+.002;
  const gain=v.gain.gain;gain.cancelScheduledValues(time);gain.setValueAtTime(level,time);gain.linearRampToValueAtTime(0,end);v.src.stop(v.stopAt);
 }
 stop(release=.024){this.generation++;if(!this.ctx)return;const now=this.ctx.currentTime;for(const v of this.voices)this.releaseVoice(v,now,release);}
 play(chord,p){
  if(!this.ready)return false;const generation=++this.generation;
  if(this.ctx.state!=='running')this.unlock().then(()=>{if(this.generation===generation)this.perform(chord,p);});else this.perform(chord,p);
  return true;
 }
 perform(chord,p){
  this.stop(.024);const c=this.ctx,now=c.currentTime+.004;
  this.wet.gain.setTargetAtTime(p.room/100*.25,c.currentTime,.025);
  const events=buildEvents(chord,p);this.lastEventCount=events.length;
  for(const e of events)this.note(e,now+e.time,p);
 }
 note(e,time,p){
  const c=this.ctx;
  for(const v of this.voices)if(v.string===e.string&&v.time<=time)this.releaseVoice(v,time,.018);
  const key=[...this.buffers.keys()].reduce((a,b)=>Math.abs(b-e.midi)<Math.abs(a-e.midi)?b:a);
  const sample=this.buffers.get(key),src=c.createBufferSource(),gain=c.createGain(),filter=c.createBiquadFilter();
  src.buffer=sample.buffer;src.playbackRate.value=2**((e.midi-key)/12);
  filter.type='lowpass';filter.frequency.value=e.muted?1500:4200+(p.strength/100)*1800;filter.Q.value=.5;
  const peak=(p.strength/100)*e.accent*(e.muted?.85:1);
  const duration=e.gate?e.gate+.04:e.muted?.12:5.3;
  const envelope=[{time,value:0},{time:time+.004,value:peak}];
  if(e.gate)envelope.push({time:time+e.gate*.8,value:peak},{time:time+e.gate+.02,value:0});
  else if(e.muted)envelope.push({time:time+.095,value:.00001,curve:'exponential'},{time:time+.11,value:0});
  else envelope.push({time:time+1.5,value:peak},{time:time+5.1,value:.00001,curve:'exponential'},{time:time+5.25,value:0});
  gain.gain.setValueAtTime(0,time);
  for(const point of envelope.slice(1)){
   if(point.curve==='exponential')gain.gain.exponentialRampToValueAtTime(point.value,point.time);
   else gain.gain.linearRampToValueAtTime(point.value,point.time);
  }
  src.connect(filter);filter.connect(gain);gain.connect(this.bus);
  const voice={src,gain,filter,time,string:e.string,envelope,release:null,stopAt:time+duration};this.voices.add(voice);
  src.onended=()=>{this.voices.delete(voice);src.disconnect();gain.disconnect();filter.disconnect();};
  src.start(time,sample.offset);src.stop(voice.stopAt);
 }
}
