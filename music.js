import {validRiff} from './riff-model.js?v=16';
export const OPEN=[40,45,50,55,59,64];
import {CHORDS} from './chords.js?v=10';
export {CHORDS};
export const NAMES={down:'温暖下扫',up:'轻盈上扫',arp:'琶音',pinch:'同时拨弦',pick:'自定义分解',strum:'自定义扫弦',mute:'短促闷弦'};
export const DEFAULT_PATTERN={style:'down',bpm:80,strength:78,room:0,strings:['B','3','2','1'],division:2,pick:['B','3','2','1','2','3'],strum:['D','-','D','U','-','U','D','U']};
export const DEFAULT_STATE={pattern:{...DEFAULT_PATTERN},pads:[{chord:'C',pattern:null},{chord:'Am',pattern:null},{chord:'F',pattern:null},{chord:'G',pattern:null}],volume:75,haptics:false,hapticDuration:35};
function validStrings(s){return Array.isArray(s)&&s.length<=7&&s.every(x=>['B','1','2','3','4','5','6'].includes(x))&&new Set(s).size===s.length;}
export function validPattern(p){return (p?.steps===undefined||(Array.isArray(p.steps)&&p.steps.length>0&&p.steps.length<=32&&p.steps.every(s=>s&&[1,2,4].includes(s.ticks)&&(p.style==='strum'?['D','U','X','-'].includes(s.action):p.style==='pick'&&validStrings(s.strings)))&&p.steps.reduce((n,s)=>n+s.ticks,0)<=32))&& p&&Object.hasOwn(NAMES,p.style)&&Number.isFinite(p.bpm)&&p.bpm>=45&&p.bpm<=320&&Number.isFinite(p.strength)&&p.strength>=35&&p.strength<=100&&Number.isFinite(p.room)&&p.room>=0&&p.room<=35&&(p.division===undefined||[1,2,4,8].includes(p.division))&&(p.strings===undefined||validStrings(p.strings))&&Array.isArray(p.pick)&&p.pick.length>0&&p.pick.length<=12&&p.pick.every(s=>Array.isArray(s)?validStrings(s):['B','1','2','3','4','5','6','-'].includes(s))&&Array.isArray(p.strum)&&p.strum.length>0&&p.strum.length<=12&&p.strum.every(s=>['D','U','X','-'].includes(s));}
export function validState(s){return s&&(s.rhythmCards===undefined||(Array.isArray(s.rhythmCards)&&s.rhythmCards.length<=6&&new Set(s.rhythmCards.map(c=>c?.id)).size===s.rhythmCards.length&&s.rhythmCards.every(c=>c&&typeof c.id==='string'&&c.id.length>0&&c.id.length<=100&&typeof c.name==='string'&&c.name.trim()&&c.name.length<=24&&validPattern(c.pattern))&&(s.activeRhythmId===undefined||s.activeRhythmId===null||s.rhythmCards.some(c=>c.id===s.activeRhythmId))))&&(s.hapticDuration===undefined||[15,35,60].includes(s.hapticDuration))&&(s.haptics===undefined||typeof s.haptics==='boolean')&&validPattern(s.pattern)&&Array.isArray(s.pads)&&s.pads.length>=2&&s.pads.length<=8&&s.pads.every(p=>p&&typeof p.chord==='string'&&p.chord.trim().length>0&&p.chord.length<=18&&(p.kind==='riff'?validRiff(p.riff)&&p.pattern===null&&p.frets===undefined:p.kind===undefined||p.kind==='chord')&&(p.nameMode===undefined||['auto','manual'].includes(p.nameMode))&&(p.kind==='riff'||(p.frets===undefined?Object.hasOwn(CHORDS,p.chord):validFrets(p.frets)))&&(p.pattern===null||validPattern(p.pattern)))&&Number.isFinite(s.volume)&&s.volume>=0&&s.volume<=100;}
export function validFrets(frets){return Array.isArray(frets)&&frets.length===6&&frets.every(f=>Number.isInteger(f)&&f>=-1&&f<=12)&&frets.some(f=>f>=0);}
export function padVoice(pad){if(pad.kind==='riff')return {name:pad.chord,riff:JSON.parse(JSON.stringify(pad.riff))};return pad.frets?{name:pad.chord,frets:[...pad.frets]}:pad.chord;}
export function chordNotes(chord){const frets=typeof chord==='object'&&chord!==null?chord.frets:CHORDS[chord];if(!validFrets(frets))return [];return frets.map((f,i)=>f<0?null:{midi:OPEN[i]+f,string:6-i}).filter(Boolean);}
export function buildEvents(chord,p){
 if(chord?.riff){if(!validRiff(chord.riff))return [];const step=60/chord.riff.bpm/2;return chord.riff.steps.flatMap((s,i)=>s===null?[]:[{midi:OPEN[6-s.string]+s.fret,string:s.string,time:i*step,gate:step*.9,accent:.9}]);}
 const notes=chordNotes(chord),events=[],step=60/p.bpm/(p.division||2);
 const strum=(time,up=false,muted=false)=>{const ns=up?[...notes].reverse():notes;ns.forEach((n,i)=>events.push({...n,time:time+i*(muted?.005:up?.012:.017),muted,accent:i===0?1:.84}));};
 if(p.style==='down'||p.style==='up'||p.style==='mute')strum(0,p.style==='up',p.style==='mute');
 if(p.style==='arp')notes.forEach((n,i)=>events.push({...n,time:i*step*.62,accent:i===0?1:.82}));
 const group=(ss,time)=>{const chosen=new Map();for(const s of ss){const n=s==='B'?notes[0]:notes.find(n=>n.string===Number(s));if(n)chosen.set(n.string,n);}for(const n of chosen.values())events.push({...n,time,accent:.86});};
 if(p.style==='pinch')group(p.strings||['B','3','2','1'],0);
 if(p.steps&&['pick','strum'].includes(p.style)){let ticks=0;for(const s of p.steps){const time=ticks*60/p.bpm/4;if(p.style==='pick')group(s.strings,time);else if(s.action!=='-')strum(time,s.action==='U',s.action==='X');ticks+=s.ticks;}return events.sort((a,b)=>a.time-b.time);}
 if(p.style==='pick')p.pick.forEach((s,i)=>group(Array.isArray(s)?s:[s],i*step));
 if(p.style==='strum')p.strum.forEach((s,i)=>{if(s!=='-')strum(i*step,s==='U',s==='X');});
 return events.sort((a,b)=>a.time-b.time);
}

// Retired standalone mute style is migrated without dropping existing voicings.
export function normalizeLegacyArticulations(value){
 const next=JSON.parse(JSON.stringify(value));
 if(next.pattern.style==='mute')next.pattern.style='down';
 for(const pad of next.pads)if(pad.pattern?.style==='mute')pad.pattern.style='down';
 return next;
}
export function labelWidth(name){return [...name].reduce((n,c)=>n+(/[\x00-\xff]/.test(c)?1:2),0);}
