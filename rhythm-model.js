import {DEFAULT_PATTERN,validPattern} from './music.js?v=18';
const copy=x=>JSON.parse(JSON.stringify(x));
const strum=(actions,ticks)=>({...copy(DEFAULT_PATTERN),style:'strum',steps:actions.map((action,i)=>({action,ticks:ticks[i]}))});
const pick=(strings,ticks)=>({...copy(DEFAULT_PATTERN),style:'pick',steps:strings.map((s,i)=>({strings:Array.isArray(s)?s:[s],ticks:ticks[i]}))});
export const PRESETS=[
 {id:'folk',name:'流行扫弦',pattern:strum(['D','D','U','U','D','U'],[4,2,4,2,2,2])},
 {id:'ddu',name:'下下上 · 十六分',pattern:strum(['D','D','U','D','D','U','D','D','U','D','D','U'],[2,1,1,2,1,1,2,1,1,2,1,1])},
 {id:'quarters',name:'四拍下扫',pattern:strum(['D','D','D','D'],[4,4,4,4])},
 {id:'eighths',name:'八分交替扫弦',pattern:strum(['D','U','D','U','D','U','D','U'],Array(8).fill(2))},
 {id:'pick8',name:'主歌八分分解',pattern:pick(['B','3','2','3','1','3','2','3'],Array(8).fill(2))},
 {id:'pick6',name:'三拍六步分解',pattern:pick(['B','3','2','1','2','3'],Array(6).fill(2))},
 {id:'alternating',name:'低音与齐拨',pattern:pick(['B',['3','2','1'],'B',['3','2','1']],[4,4,4,4])},
 {id:'pinch',name:'收尾齐拨',pattern:{...copy(DEFAULT_PATTERN),style:'pinch'}},
 {id:'down',name:'单次下扫',pattern:copy(DEFAULT_PATTERN)},
 {id:'arp',name:'轻盈琶音',pattern:{...copy(DEFAULT_PATTERN),style:'arp',bpm:160}}
];
export function validCard(c){return !!c&&typeof c.id==='string'&&c.id.length>0&&c.id.length<=100&&typeof c.name==='string'&&c.name.trim().length>0&&c.name.length<=24&&validPattern(c.pattern);}
export function ensureSong(s){const n=copy(s);if(!Array.isArray(n.rhythmCards)){n.rhythmCards=[{id:'existing',name:'原有右手',pattern:copy(n.pattern)}];n.activeRhythmId='existing';}else if(!n.rhythmCards.some(c=>c.id===n.activeRhythmId))n.activeRhythmId=null;return n;}
export function readCards(raw){if(!Array.isArray(raw))return [];const seen=new Set();return raw.filter(c=>validCard(c)&&!seen.has(c.id)&&(seen.add(c.id),true)).slice(0,40).map(copy);}
export function editableSteps(p){if(p.steps)return copy(p.steps);const ticks=4/(p.division||2);if(p.style==='strum')return p.strum.map(action=>({action,ticks:Math.max(1,ticks)}));if(p.style==='pick')return p.pick.map(s=>({strings:Array.isArray(s)?s:s==='-'?[]:[s],ticks:Math.max(1,ticks)}));return [];}
export function patternLabel(p){if(p.style==='strum')return editableSteps(p).map(s=>({D:'↓',U:'↑',X:'×','-':'·'})[s.action]).join(' ');if(p.style==='pick')return editableSteps(p).map(s=>s.strings.length?s.strings.map(x=>x==='B'?'低':x).join('+'):'·').join(' ');return {down:'↓ 单次下扫',up:'↑ 单次上扫',arp:'低 → 高',pinch:'多弦同时响'}[p.style]||'右手节奏';}
export function applyCard(state,card,indices=null){if(!validCard(card))throw Error('这张节奏卡片无法使用');const n=ensureSong(state),at=n.rhythmCards.findIndex(c=>c.id===card.id);if(at<0&&n.rhythmCards.length>=6)throw Error('每组最多准备 6 张右手卡片，可先移除一张');if(at<0)n.rhythmCards.push(copy(card));else n.rhythmCards[at]=copy(card);if(indices===null){n.pattern=copy(card.pattern);n.activeRhythmId=card.id;for(const p of n.pads)if(p.kind!=='riff')p.pattern=null;}else{for(const i of indices)if(n.pads[i]&&n.pads[i].kind!=='riff')n.pads[i].pattern=copy(card.pattern);}return n;}
export function removeSongCard(s,id){const n=ensureSong(s);n.rhythmCards=n.rhythmCards.filter(c=>c.id!==id);if(n.activeRhythmId===id)n.activeRhythmId=null;return n;}
export function stagePattern(pad,state,cardId=null){return cardId&&pad.kind!=='riff'?(state.rhythmCards.find(c=>c.id===cardId)?.pattern||pad.pattern||state.pattern):(pad.pattern||state.pattern);}
