/** Per-browser interface preferences. Separate from experiments so they never travel in exported files. */
export const PREFS_KEY='cutspace-prefs-v1';
export const TIP_DELAY=700;
export interface Prefs {tips:boolean;welcomed:boolean}
export const defaultPrefs:Prefs={tips:true,welcomed:false};
export function parsePrefs(text:string|null):Prefs{
 const prefs={...defaultPrefs};
 if(!text)return prefs;
 try{
  const o=JSON.parse(text);
  if(o&&typeof o==='object'){if(typeof o.tips==='boolean')prefs.tips=o.tips;if(typeof o.welcomed==='boolean')prefs.welcomed=o.welcomed;}
 }catch{/* malformed preferences fall back to defaults */}
 return prefs;
}
export function loadPrefs():Prefs{try{return parsePrefs(localStorage.getItem(PREFS_KEY));}catch{return {...defaultPrefs};}}
export function savePrefs(p:Prefs){try{localStorage.setItem(PREFS_KEY,JSON.stringify(p));}catch{/* storage unavailable: preference lasts for this session only */}}
/** Quick tips show only the first sentence, trimmed to a readable length; the full text stays one click away. */
export function tipText(full:string,max=140){
 const first=(full.match(/^[\s\S]*?[.!?](?=\s|$)/)??[full])[0].trim();
 if(first.length<=max)return first;
 const cut=first.slice(0,max-1),space=cut.lastIndexOf(' ');
 return `${cut.slice(0,space>max*.6?space:max-1).trimEnd()}…`;
}
/** Tips are a mouse convenience: never in Help mode, never when switched off, never for touch or pen input. */
export function tipsAllowed(helpMode:boolean,prefs:Prefs,finePointer:boolean){return !helpMode&&prefs.tips&&finePointer;}
