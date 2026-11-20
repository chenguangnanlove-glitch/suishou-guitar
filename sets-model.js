import {validState,normalizeLegacyArticulations} from './music.js?v=18';
import {normalizeCustomPad} from './voicing-model.js?v=18';
const copy=x=>JSON.parse(JSON.stringify(x));
export function arrangement(state){return copy({pattern:state.pattern,pads:state.pads,...(state.rhythmCards?{rhythmCards:state.rhythmCards,activeRhythmId:state.activeRhythmId??null}:{})});}
export function validArrangement(value){return !!value&&validState({...value,volume:75,haptics:false});}
export function restoreArrangement(state,value){
 if(!validArrangement(value))throw new Error('这组和弦数据无法使用');
 const next=copy(state),normalized=normalizeLegacyArticulations(value);delete next.rhythmCards;delete next.activeRhythmId;if(normalized.rhythmCards){next.rhythmCards=normalized.rhythmCards;next.activeRhythmId=normalized.activeRhythmId;}next.pattern=normalized.pattern;next.pads=normalized.pads.map(normalizeCustomPad);return next;
}
export function readSets(raw){
 if(!Array.isArray(raw))return [];
 const seen=new Set();return raw.filter(s=>s&&typeof s.id==='string'&&s.id.length&&typeof s.name==='string'&&s.name.trim()&&s.name.length<=40&&validArrangement(s.arrangement)&&!seen.has(s.id)&&(seen.add(s.id),true)).map(s=>({...copy(s),arrangement:{...normalizeLegacyArticulations(s.arrangement),pads:normalizeLegacyArticulations(s.arrangement).pads.map(normalizeCustomPad)}}));
}
export function saveSet(sets,id,name,state){
 name=name.trim();if(!name||name.length>40)throw new Error('请填写 1–40 字的和弦组名称');
 if(!id||!validArrangement(state))throw new Error('当前和弦组无法保存');
 const entry={id,name,arrangement:arrangement(state)};
 return sets.some(s=>s.id===id)?sets.map(s=>s.id===id?entry:copy(s)):[...copy(sets),entry];
}
export function deleteSet(sets,id){return copy(sets.filter(s=>s.id!==id));}
export function sameArrangement(a,b){return JSON.stringify(arrangement(a))===JSON.stringify(arrangement(b));}
