/** Per-browser interface preferences. Separate from experiments so they never travel in exported files. */
export const PREFS_KEY='cutspace-prefs-v1';
export const TIP_DELAY=700;
export interface Prefs {tips:boolean;welcomed:boolean;panelOpen:boolean;panelWidth:number;panelTab:string}
export const defaultPrefs:Prefs={tips:true,welcomed:false,panelOpen:false,panelWidth:460,panelTab:'Machine'};
/** The docked inspector panel (wide screens only) is at least this wide and never takes more than 60% of the viewport or 1200 px. */
export const PANEL_MIN=320,PANEL_MAX=1200,PANEL_SHARE=.6;
export function clampPanelWidth(width:number,viewportWidth:number){const max=Math.max(PANEL_MIN,Math.min(PANEL_MAX,Math.floor(viewportWidth*PANEL_SHARE)));return Math.round(Math.min(max,Math.max(PANEL_MIN,Number.isNaN(width)?defaultPrefs.panelWidth:width)));}
export function parsePrefs(text:string|null):Prefs{
 const prefs={...defaultPrefs};
 if(!text)return prefs;
 try{
  const o=JSON.parse(text);
  if(o&&typeof o==='object'){if(typeof o.tips==='boolean')prefs.tips=o.tips;if(typeof o.welcomed==='boolean')prefs.welcomed=o.welcomed;if(typeof o.panelOpen==='boolean')prefs.panelOpen=o.panelOpen;if(typeof o.panelWidth==='number'&&Number.isFinite(o.panelWidth))prefs.panelWidth=Math.min(PANEL_MAX,Math.max(PANEL_MIN,Math.round(o.panelWidth)));if(typeof o.panelTab==='string'&&o.panelTab.length<=20)prefs.panelTab=o.panelTab;}
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
