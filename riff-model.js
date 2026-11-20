export function validRiff(r){return !!r&&Number.isFinite(r.bpm)&&r.bpm>=60&&r.bpm<=320&&Array.isArray(r.steps)&&r.steps.length>=1&&r.steps.length<=16&&r.steps.some(s=>s!==null)&&r.steps.every(s=>s===null||(s&&Number.isInteger(s.string)&&s.string>=1&&s.string<=6&&Number.isInteger(s.fret)&&s.fret>=0&&s.fret<=12));}
export function putRiffStep(steps,selected,note){
 const next=steps.map(s=>s?{...s}:null);
 if(selected>=0&&selected<next.length)next[selected]=note?{...note}:null;
 else {if(next.length>=16)throw Error('最多 16 步，点选已有步骤可以替换');next.push(note?{...note}:null);}
 return next;
}
