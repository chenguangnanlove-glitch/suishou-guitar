import {CHORDS,OPEN,validFrets} from './music.js?v=18';
import {CHORD_LIST} from './chords.js?v=10';
function signature(frets){return [...new Set(frets.flatMap((f,i)=>f<0?[]:[(OPEN[i]+f)%12]))].sort((a,b)=>a-b).join(',');}
export function matchingNames(frets){if(!validFrets(frets))return [];const key=signature(frets);return CHORD_LIST.filter(c=>signature(CHORDS[c.name])===key).map(c=>c.name);}
export function resolveVoicing(frets,manualName=''){
 const matches=matchingNames(frets),typed=manualName.trim();
 return {name:typed||matches[0]||'自选和弦',nameMode:typed?'manual':'auto',matches,frets:[...frets],conflict:!!typed&&Object.hasOwn(CHORDS,typed)&&!matches.includes(typed)};
}
export function normalizeCustomPad(pad){
 if(!pad.frets)return pad;
 // Legacy library-shaped names were auto-filled by the old editor. Recompute
 // them from the stored frets; preserve free-form and explicitly manual names.
 const mode=pad.nameMode||(!Object.hasOwn(CHORDS,pad.chord)?'manual':'auto');
 const resolved=resolveVoicing(pad.frets,mode==='manual'?pad.chord:'');
 return {...pad,chord:resolved.name,nameMode:resolved.nameMode};
}
export function isFingerboardTap(start,end){return !!start&&Math.hypot(end.x-start.x,end.y-start.y)<=9&&Math.abs(end.scrollLeft-start.scrollLeft)<=3;}
