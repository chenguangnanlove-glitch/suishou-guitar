// Movable E/A guitar shapes, with familiar open-position overrides.
export const ROOTS=['C','C#','D','Eb','E','F','F#','G','Ab','A','Bb','B'];
const SHAPES={
 '':{label:'大三和弦',E:[0,2,2,1,0,0],A:[-1,0,2,2,2,0]},
 m:{label:'小三和弦',E:[0,2,2,0,0,0],A:[-1,0,2,2,1,0]},
 '7':{label:'属七和弦',E:[0,2,0,1,0,0],A:[-1,0,2,0,2,0]},
 maj7:{label:'大七和弦',E:[0,2,1,1,0,0],A:[-1,0,2,1,2,0]},
 m7:{label:'小七和弦',E:[0,2,0,0,0,0],A:[-1,0,2,0,1,0]},
 sus2:{label:'挂二和弦',E:[0,2,4,4,0,0],A:[-1,0,2,2,0,0]},
 sus4:{label:'挂四和弦',E:[0,2,2,2,0,0],A:[-1,0,2,2,3,0]}
};
const OPEN_VOICINGS={C:[-1,3,2,0,1,0],Am:[-1,0,2,2,1,0],F:[1,3,3,2,1,1],G:[3,2,0,0,0,3],Dm:[-1,-1,0,2,3,1],Em:[0,2,2,0,0,0],D:[-1,-1,0,2,3,2],E:[0,2,2,1,0,0],A:[-1,0,2,2,2,0],C7:[-1,3,2,3,1,3],G7:[3,2,0,0,0,1],A7:[-1,0,2,0,2,0],D7:[-1,-1,0,2,1,2],E7:[0,2,0,1,0,0],Bm:[-1,2,4,4,3,2],Cmaj7:[-1,3,2,0,0,0],Asus2:[-1,0,2,2,0,0],Dsus4:[-1,-1,0,2,3,3]};
export const CHORDS={};
for(let root=0;root<12;root++)for(const [suffix,shape] of Object.entries(SHAPES)){
 const e=(root-4+12)%12,a=(root-9+12)%12,base=e<=a?e:a,frets=e<=a?shape.E:shape.A;
 CHORDS[ROOTS[root]+suffix]=frets.map(f=>f<0?-1:f+base);
}
Object.assign(CHORDS,OPEN_VOICINGS);
export const CHORD_LIST=Object.keys(CHORDS).map(name=>{
 const root=ROOTS.find(r=>name.startsWith(r)&&Object.hasOwn(SHAPES,name.slice(r.length)));
 const suffix=name.slice(root.length);
 return {name,root,suffix,label:SHAPES[suffix].label,common:Object.hasOwn(OPEN_VOICINGS,name)};
});
export function normalizeChordQuery(query){return query.trim().replace(/♯/g,'#').replace(/♭/g,'b').replace(/Δ/g,'maj7').replace(/\s+/g,'').toLowerCase().replace(/^db/,'c#').replace(/^d#/,'eb').replace(/^gb/,'f#').replace(/^g#/,'ab').replace(/^a#/,'bb');}
export function filterChords(query='',family='common'){
 const q=normalizeChordQuery(query);
 return CHORD_LIST.filter(c=>{
  const familyMatch=family==='all'||family==='recent'||(family==='common'&&c.common)||(family==='major'&&c.suffix==='')||(family==='minor'&&c.suffix==='m')||(family==='seventh'&&['7','maj7','m7'].includes(c.suffix))||(family==='sus'&&c.suffix.startsWith('sus'));
  const parsed=q.match(/^(c#|eb|f#|ab|bb|[a-g])(.*)$/);
  const nameMatch=parsed?normalizeChordQuery(c.root)===parsed[1]&&(parsed[2]==='m'?['m','m7'].includes(c.suffix):c.suffix.startsWith(parsed[2])):normalizeChordQuery(c.name).includes(q)||c.label.includes(q);
  return familyMatch&&(!q||nameMatch);
 });
}
