/**
 * Transcription of the user's "DMC2 Mini speeds and feeds" Google Sheet
 * (https://docs.google.com/spreadsheets/d/1Vxh8LKq3Z59RujVOuwpK9PEfAGgtIwfIzEzbZbDQ1Lk/).
 *
 * Three sources appear in that sheet:
 *  - `chart`: the cutter manufacturer's printed charts (3-flute square end mills for aluminium,
 *    4-flute coated square end mills for steel, "pre-hardened steel 40–50 HRC" column), which are
 *    embedded as images. The tables marked "derived from manufacturer chart" are those charts with
 *    RPM capped at the DMC2 Mini's 24,000 RPM ceiling; the feed is unchanged. Profile rows use
 *    stepover 0.1D (aluminium) or 0.05D (steel) with depth 1.5D; slotting rows use full width,
 *    depth 0.5D (aluminium) or 0.25D (steel) and half the profile feed. These are the "normal" numbers.
 *  - `aggressive`: the "aggressive parameters from testing" summary tables on the same tabs.
 *  - `raw`: rows of the Raw Test Data tab that carry an explicit outcome note. Rows without a note
 *    are not used. Rows that follow a breakage inside the same stepping sequence are not used either,
 *    because the sheet does not say whether they were run.
 *
 * Units: mm, mm/min, RPM. Chipload is recomputed from feed / (RPM × flutes); the sheet's own
 * chipload column has a few typos (for example 0.0375 instead of 0.00375 for the 1 mm steel slot).
 * None of this is a cutting recommendation: it records what one operator reported on one machine.
 */
export type Workpiece='aluminum'|'steel';
export type Mode='profile'|'slot';
export interface Row {workpiece:Workpiece;mode:Mode;diameter:number;rpm:number;woc:number;doc:number;feed:number;note?:string}
export type Outcome='good'|'marginal'|'fail';
export interface RawRow extends Row {outcome:Outcome}
/** Tool identity per workpiece: the operator ran uncoated 3-flute carbide in aluminium and coated 4-flute carbide in steel. */
export const FLUTES:Record<Workpiece,number>={aluminum:3,steel:4};
export const INSERT_DIAMETER=10;
export const INSERT_FLUTES=1;
export const DIAMETERS=[1,2,3,4,6,8,10,12];
export const SHEET_URL='https://docs.google.com/spreadsheets/d/1Vxh8LKq3Z59RujVOuwpK9PEfAGgtIwfIzEzbZbDQ1Lk/edit?usp=sharing';

const row=(workpiece:Workpiece,mode:Mode,[diameter,rpm,woc,doc,feed]:number[],note?:string):Row=>({workpiece,mode,diameter,rpm,woc,doc,feed,...(note?{note}:{})});

/** "Profile Milling (derived from manufacturer chart)" and "Slotting (derived from manufacturer chart)". */
export const CHART:Row[]=[
 ...[[1,24000,.1,1.5,800],[2,24000,.2,3,1200],[3,24000,.3,4.5,1800],[4,20000,.4,6,2000],[6,13000,.6,9,1500],[8,10000,.8,12,1650],[10,8000,1,15,1900],[12,6600,1.2,18,1950]].map(r=>row('aluminum','profile',r)),
 ...[[1,24000,1,.5,400],[2,24000,2,1,600],[3,24000,3,1.5,900],[4,20000,4,2,1000],[6,13000,6,3,750],[8,10000,8,4,825],[10,8000,10,5,950],[12,6600,12,6,975]].map(r=>row('aluminum','slot',r)),
 ...[[1,24000,.05,1.5,320],[2,24000,.1,3,800],[3,24000,.15,4.5,1020],[4,24000,.2,6,1250],[6,16000,.3,9,1540],[8,12000,.4,12,1540],[10,9600,.5,15,1540],[12,8000,.6,18,1600]].map(r=>row('steel','profile',r)),
 ...[[1,24000,1,.25,160],[2,24000,2,.5,400],[3,24000,3,.75,510],[4,24000,4,1,625],[6,16000,6,1.5,770],[8,12000,8,2,770],[10,9600,10,2.5,770],[12,8000,12,3,800]].map(r=>row('steel','slot',r)),
];

/** "Profile Milling Tests / Slotting Tests (aggressive parameters from testing)". The sheet notes these ran briefly, without tool-wear observation. */
export const AGGRESSIVE:Row[]=[
 ...[[1,24000,.5,3,518],[2,20000,1,5,3093],[3,22000,1.5,8,2592],[4,24000,1,10,2000],[6,24000,.5,12,3456],[8,24000,.3,24,2000],[10,21000,.2,30,1800],[12,18000,.2,35,1600]].map(r=>row('aluminum','profile',r)),
 ...[[1,24000,1,.5,360],[2,22000,2,.9,720],[3,24000,3,.8,3200],[4,24000,4,.7,3600],[6,24000,6,.6,4500],[8,14400,8,.8,2376],[10,17000,10,.6,2700],[12,17000,12,.6,2500]].map(r=>row('aluminum','slot',r)),
 ...[[1,24000,.3,3,480],[2,16000,.2,5,2132],[3,16000,.2,8,4147],[4,16000,.2,10,5971],[6,16000,.15,12,3456],[8,18000,.03,24,1100],[10,17000,.05,30,1000],[12,16000,.05,35,1000]].map(r=>row('steel','profile',r)),
 ...[[1,24000,1,.5,360],[2,20000,2,.7,2000],[3,18000,3,.7,2000],[4,16000,4,.8,2000],[6,16000,6,.5,2000],[8,17000,8,.4,1200],[10,16000,10,.4,1000],[12,12000,12,.5,800]].map(r=>row('steel','slot',r)),
];
/** The 12 mm aluminium profile summary row has no feed in the sheet; the raw rows behind it ran 1600 mm/min. */

/** Single-insert 10 mm mill rows from the aggressive tables (its body is steel; the insert is carbide). */
export const INSERT_AGGRESSIVE:Row[]=[
 row('aluminum','profile',[10,22000,.1,6,800]),row('aluminum','slot',[10,24000,10,.6,1600]),
 row('steel','profile',[10,18000,.02,6,500]),row('steel','slot',[10,22000,10,.4,1000]),
];

const raw=(workpiece:Workpiece,mode:Mode,outcome:Outcome,values:number[],note:string):RawRow=>({...row(workpiece,mode,values,note),outcome});
const good=(w:Workpiece,m:Mode,v:number[],note:string)=>raw(w,m,'good',v,note),marginal=(w:Workpiece,m:Mode,v:number[],note:string)=>raw(w,m,'marginal',v,note),fail=(w:Workpiece,m:Mode,v:number[],note:string)=>raw(w,m,'fail',v,note);
/** Raw Test Data rows with an explicit outcome. `fail` = break, bog, stall, flames or "too much"; `marginal` = chatter, screech, heavy, struggling, would not push harder. */
export const RAW:RawRow[]=[
 // Aluminium profile milling, 3-flute
 fail('aluminum','profile',[1,24000,.5,3,894],'Break!'),
 marginal('aluminum','profile',[2,24000,.5,5,720],'chattery in y axis moves'),
 marginal('aluminum','profile',[2,24000,.75,5,720],'chattery'),
 good('aluminum','profile',[2,20000,.75,5,720],'much quieter'),
 good('aluminum','profile',[2,22000,1,5,720],'good'),
 marginal('aluminum','profile',[2,22000,1,5,1492],'chattery'),
 good('aluminum','profile',[2,20000,1,5,1492],'better'),
 good('aluminum','profile',[2,20000,1,5,1790],'good'),
 marginal('aluminum','profile',[2,20000,1,5,4454],'some screeching'),
 marginal('aluminum','profile',[2,20000,1,5,5344],'little less screeching'),
 fail('aluminum','profile',[2,20000,1,5,6413],'Break!'),
 marginal('aluminum','profile',[3,24000,1,8,1800],'tiny bit screechy'),
 marginal('aluminum','profile',[3,20000,1,8,1800],'something resonating/humming/chatter?'),
 marginal('aluminum','profile',[3,22000,1.25,8,1800],'tiny chatter in x axis'),
 good('aluminum','profile',[3,22000,1.5,8,1800],'ok'),
 good('aluminum','profile',[3,22000,1.5,8,2160],'good'),
 good('aluminum','profile',[3,22000,1.5,8,2592],'great'),
 fail('aluminum','profile',[3,22000,1.5,8,3732],'Spindle bog down and break!'),
 fail('aluminum','profile',[4,24000,1,10,2880],'Break!'),
 fail('aluminum','profile',[4,24000,1.5,10,2880],'Spindle bog down and break!'),
 fail('aluminum','profile',[4,24000,1.5,10,2000],'Bog!'),
 good('aluminum','profile',[4,24000,1,10,2000],'good'),
 good('aluminum','profile',[4,24000,1,10,2400],'good'),
 fail('aluminum','profile',[4,24000,1,10,3456],'Bog!'),
 fail('aluminum','profile',[6,24000,1,12,2000],'Bog!!'),
 good('aluminum','profile',[6,24000,.5,12,2000],'good'),
 good('aluminum','profile',[6,24000,.5,12,2400],'good, something humming in X'),
 good('aluminum','profile',[6,24000,.5,12,2880],'good'),
 good('aluminum','profile',[6,24000,.5,12,3456],'good'),
 good('aluminum','profile',[6,24000,.5,12,4147],'good'),
 marginal('aluminum','profile',[6,24000,.5,12,4976],'good, barely starting to bog'),
 good('aluminum','profile',[12,18000,.05,35,1600],'easy'),
 good('aluminum','profile',[12,18000,.1,35,1600],'easy'),
 good('aluminum','profile',[12,18000,.2,35,1600],'easy'),
 good('aluminum','profile',[12,20000,.2,35,1600],'good'),
 marginal('aluminum','profile',[12,20000,.25,35,1600],'good, don’t really want to push harder'),
 good('aluminum','profile',[10,21000,.1,30,1800],'easy'),
 good('aluminum','profile',[10,21000,.2,30,1800],'easy'),
 good('aluminum','profile',[10,22000,.2,30,1900],'good'),
 fail('aluminum','profile',[10,22000,.3,30,1900],'stall!'),
 good('aluminum','profile',[8,24000,.2,24,2000],'good'),
 good('aluminum','profile',[8,24000,.3,24,2000],'good'),
 marginal('aluminum','profile',[8,24000,.35,24,2000],'good, wouldn’t push much harder'),
 // Aluminium slotting, 3-flute (stepdown = depth, full width)
 fail('aluminum','slot',[1,24000,1,.8,360],'Break!'),
 fail('aluminum','slot',[1,24000,1,.4,500],'Break!'),
 fail('aluminum','slot',[2,22000,2,.7,2000],'Break!'),
 fail('aluminum','slot',[3,24000,3,.7,2400],'Break!'),
 fail('aluminum','slot',[4,24000,4,1,3600],'Break!'),
 fail('aluminum','slot',[6,24000,6,.8,3000],'Bog!'),
 fail('aluminum','slot',[6,24000,6,.9,4500],'Bog!'),
 good('aluminum','slot',[8,10000,8,.1,1650],'easy'),
 good('aluminum','slot',[8,10000,8,.4,1650],'easy'),
 good('aluminum','slot',[8,10000,8,.6,1650],'fine'),
 good('aluminum','slot',[8,12000,8,.8,1980],'fine'),
 marginal('aluminum','slot',[8,12000,8,1,1980],'eh'),
 good('aluminum','slot',[8,14400,8,.8,2376],'good'),
 good('aluminum','slot',[8,17280,8,.8,2851],'good'),
 good('aluminum','slot',[8,20736,8,.8,3421],'good'),
 marginal('aluminum','slot',[8,22000,8,.8,3500],'good enough to stop'),
 good('aluminum','slot',[10,16000,10,.4,2600],'good'),
 good('aluminum','slot',[10,16000,10,.6,2600],'good'),
 marginal('aluminum','slot',[10,16000,10,.8,2600],'managed'),
 marginal('aluminum','slot',[10,18000,10,.7,2800],'managed, loud'),
 marginal('aluminum','slot',[10,18000,10,.6,2800],'managed, maybe too fast sfm'),
 good('aluminum','slot',[10,17000,10,.6,2700],'very good'),
 good('aluminum','slot',[10,17000,10,.7,2700],'good'),
 good('aluminum','slot',[10,18000,10,.6,2800],'good'),
 marginal('aluminum','slot',[10,18000,10,.8,2800],'good, heavy'),
 marginal('aluminum','slot',[10,19000,10,.8,2900],'good, heavy'),
 good('aluminum','slot',[12,14000,12,.4,2200],'good, slow?'),
 good('aluminum','slot',[12,16000,12,.4,2400],'great'),
 good('aluminum','slot',[12,16000,12,.6,2400],'great'),
 marginal('aluminum','slot',[12,16000,12,.7,2400],'good, a bit heavy'),
 good('aluminum','slot',[12,17000,12,.6,2500],'good'),
 good('aluminum','slot',[12,18000,12,.6,2600],'good'),
 marginal('aluminum','slot',[12,18000,12,.9,2600],'good, heavy'),
 marginal('aluminum','slot',[12,18000,12,1,2600],'good, heavy'),
 // Steel profile milling, 4-flute
 fail('steel','profile',[1,24000,.3,3,691],'Break!'),
 fail('steel','profile',[2,24000,.2,5,857],'FLAMES!'),
 good('steel','profile',[2,16000,.2,5,2132],'very good'),
 fail('steel','profile',[2,16000,.25,5,6367],'Break! Slip in vise'),
 marginal('steel','profile',[3,16000,.2,8,7166],'kind of starting to sound struggling'),
 marginal('steel','profile',[4,16000,.2,10,8000],'very fast, don’t want to run past 8000mm/min'),
 marginal('steel','profile',[6,16000,.2,12,3456],'screech, slight chatter'),
 marginal('steel','profile',[6,16000,.2,12,2400],'better, slight screech, changed mid cut'),
 good('steel','profile',[6,16000,.15,12,3456],'good'),
 marginal('steel','profile',[6,16000,.15,12,4976],'slight chatter, would not push harder'),
 fail('steel','profile',[12,14000,.2,35,1000],'stall'),
 good('steel','profile',[12,14000,.1,35,1000],'ok'),
 fail('steel','profile',[12,16000,.1,35,1200],'stall'),
 good('steel','profile',[12,16000,.05,35,1000],'ok'),
 marginal('steel','profile',[10,18000,.05,30,1000],'bit chattery/noisy'),
 marginal('steel','profile',[8,18000,.05,24,1100],'bit noisy'),
 good('steel','profile',[8,18000,.03,24,1100],'good'),
 // Steel slotting, 4-flute
 fail('steel','slot',[1,24000,1,.5,500],'Break!'),
 good('steel','slot',[6,16000,6,.5,2000],'great'),
 fail('steel','slot',[6,16000,6,.8,2000],'Bog!'),
 good('steel','slot',[8,16000,8,.4,1000],'good'),
 fail('steel','slot',[8,16000,8,.6,1000],'too much'),
 good('steel','slot',[8,17000,8,.4,1200],'good'),
 marginal('steel','slot',[8,17000,8,.5,1200],'bit heavy'),
 good('steel','slot',[8,18000,8,.4,1300],'good'),
 marginal('steel','slot',[8,18000,8,.4,1500],'good, wouldn’t go too much harder'),
 good('steel','slot',[10,16000,10,.4,1000],'good'),
 marginal('steel','slot',[10,16000,10,.5,1000],'felt heavy'),
 good('steel','slot',[10,17000,10,.4,1200],'good'),
 good('steel','slot',[12,12000,12,.4,800],'good'),
 good('steel','slot',[12,12000,12,.5,800],'good'),
 good('steel','slot',[12,14000,12,.5,1100],'good'),
 marginal('steel','slot',[12,15000,12,.5,1200],'good, heavy'),
];
/** Insert-mill raw rows with an outcome. */
export const INSERT_RAW:RawRow[]=[
 marginal('aluminum','profile',[10,22000,.1,6,800],'good, loud, wouldn’t push harder'),
 good('aluminum','slot',[10,18000,10,.4,1100],'easy'),
 good('aluminum','slot',[10,24000,10,.4,1400],'good'),
 good('aluminum','slot',[10,24000,10,.4,1600],'good'),
 good('aluminum','slot',[10,24000,10,.6,1600],'good'),
 marginal('aluminum','slot',[10,24000,10,.8,1600],'good, wouldn’t push much harder'),
 marginal('aluminum','slot',[10,24000,10,.8,1800],'good, heavy wouldn’t push faster'),
 marginal('steel','profile',[10,18000,.02,6,500],'good, loud?'),
 good('steel','slot',[10,20000,10,.4,1000],'good'),
 marginal('steel','slot',[10,22000,10,.4,1000],'heavy cut, mirror finish!'),
 marginal('steel','slot',[10,24000,10,.4,1100],'heavy, maybe slow down spindle'),
];
