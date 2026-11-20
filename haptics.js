// The API acknowledges requests only; it cannot report physical motor output.
function request(pattern,device){
 if(typeof device?.vibrate!=='function')return false;
 try{return device.vibrate(pattern)===true;}catch{return false;}
}
export function hapticPulse(enabled,device=globalThis.navigator){
 return enabled?request(35,device):false;
}
export function hapticTest(device=globalThis.navigator){return hapticPulse(true,device);}
export function stopHaptics(device=globalThis.navigator){return request(0,device);}
