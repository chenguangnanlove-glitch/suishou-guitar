import {hapticPulse} from './haptics.js?v=7';
// This runs synchronously in pointerdown, before Web Audio node creation or UI work.
export function pressChord(engine,chord,pattern,haptics,device=globalThis.navigator){
 if(!engine.ready)return false;
 hapticPulse(haptics,device);
 return engine.play(chord,pattern);
}
