import {calculate,constraintInfo,CUTTER_MATERIALS} from './model.ts';
import type {ConstraintKey,Cut,Operation,Result,Setup} from './model.ts';
import type {Configuration,Point} from './experiment.ts';
import {fmt,toDisplay,unit} from './units.ts';
import type {Units} from './units.ts';

/**
 * Finds a starting cut for a configuration: a deterministic seed from the configured chip band, surface-speed
 * limit and machine range, then a back-off ladder that reduces engagement (and, if needed, adjusts chipload)
 * until the forward model reports the cut inside the comfortable zone. Every move is recorded in plain language
 * so the result can be explained. This derives a place to begin exploring from the configured limits; it is not
 * a cutting recommendation, and it never applies chip-thinning feed compensation.
 */
/** Conventional engagement to begin from, as fractions of diameter. These are conventions, not sourced data; the back-off adjusts them. */
export const STARTING_ENGAGEMENT:Record<Operation,{woc:number;doc:number}>={roughing:{woc:.5,doc:1},finishing:{woc:.1,doc:.5}};
/** The seed aims this far below the caution threshold so the point sits inside the comfortable zone rather than on its edge. */
export const TARGET_FRACTION=.9;
/** Seeded feed stays this far below the machine feed limit. */
export const FEED_FRACTION=.9;
const DOC_FLOOR=.05,WOC_FLOOR=.1,BACKOFF=.8,CHIP_STEP=.15,MAX_STEPS=40,REACH_FRACTION=.9;
const ENGAGEMENT_KEYS:ConstraintKey[]=['deflection','power','torque'];

export interface StartingPointOk {ok:true;cut:Cut;point:Point;result:Result;steps:string[]}
export interface StartingPointFail {ok:false;reasons:string[];steps:string[];nearest?:{cut:Cut;point:Point;result:Result}}
export type StartingPointOutcome=StartingPointOk|StartingPointFail;

const thinning=(r:number)=>r<.5?2*Math.sqrt(r*(1-r)):1;
const floor100=(x:number)=>Math.floor(x/100)*100;
const label=(key:ConstraintKey)=>constraintInfo[key].label;
const ratioOf=(r:Result,keys:ConstraintKey[])=>r.constraints.filter(c=>keys.includes(c.key)).reduce((best,c)=>c.ratio>best.ratio?c:best,{key:keys[0],ratio:-Infinity});

export function startingPoint(config:Configuration,units:Units='metric'):StartingPointOutcome{
 const {tool:t,machine:m,material:mat,limits:l}=config,D=t.diameter,caution=l.caution??.75,target=caution*TARGET_FRACTION,steps:string[]=[];
 const len=(x:number)=>`${fmt(toDisplay(x,'length',units),units==='imperial'?3:2)} ${unit('length',units)}`;
 const chipText=(x:number)=>`${fmt(toDisplay(x,'chip',units),units==='imperial'?4:3)} ${unit('chip',units)}`;
 const feedText=(x:number)=>`${fmt(toDisplay(x,'feed',units),0)} ${unit('feed',units)}`;
 const surfaceText=`${fmt(toDisplay(l.surfaceMax,'surface',units),0)} ${unit('surface',units)}`;
 const pct=(x:number)=>`${fmt(x/D*100,0)}%D`;
 const toPoint=(c:Cut):Point=>({rpm:c.rpm,feed:c.feed,docRatio:c.doc/D,wocRatio:c.woc/D});
 const evaluate=(cut:Cut)=>calculate(cut,{...config,cut} as Setup);
 const accepted=(r:Result)=>r.status==='inside'&&r.softRatio<=target;

 const reasons:string[]=[];
 if(!l.cuttingDataKnown)reasons.push(`No chip-thickness or surface-speed limits are available for ${CUTTER_MATERIALS[t.material].name} / ${mat.name}, so no cut can pass every check. Enter limits in Model & limits → Limits, or choose a material that has cutting data for this cutter.`);
 if(m.known===false)reasons.push('The spindle capacity curve is marked unavailable for this machine, so power and torque cannot be checked.');
 if(mat.known===false)reasons.push('The force/power model is marked unavailable for this material, so power, torque and deflection cannot be checked.');
 if(reasons.length)return {ok:false,reasons,steps};

 // Spindle speed: the lowest of the machine maximum, the tool's rating and the surface-speed ceiling.
 const rpmSurface=target*l.surfaceMax*1000/(Math.PI*D),rpmLimit=l.surfaceMax*1000/(Math.PI*D);
 const rpmHi=Math.min(m.rpmMax,t.maxRpm||Infinity,rpmSurface);
 let rpm:number;
 if(rpmHi>=m.rpmMin){
  rpm=Math.max(m.rpmMin,floor100(rpmHi));
  const setBy=rpmHi===rpmSurface?`${fmt(target*100,0)}% of the ${surfaceText} surface-speed limit for a ${len(D)} tool`:rpmHi===m.rpmMax?`the machine's ${fmt(m.rpmMax,0)} RPM maximum`:`the tool's ${fmt(t.maxRpm??0,0)} RPM rating`;
  steps.push(`Spindle speed ${fmt(rpm,0)} RPM, set by ${setBy}.`);
 }else if(m.rpmMin<=rpmLimit&&m.rpmMin<=(t.maxRpm||Infinity)){
  // The comfortable surface speed is below the machine's slowest speed, but its minimum still passes the limit: start there and say so.
  rpm=m.rpmMin;
  steps.push(`Spindle speed ${fmt(rpm,0)} RPM, the machine's minimum. That puts surface speed at ${fmt(rpm/rpmLimit*100,0)}% of the ${surfaceText} limit for a ${len(D)} tool, inside the caution band; a slower spindle or a smaller tool would be more comfortable.`);
 }else return {ok:false,reasons:[`The ${surfaceText} surface-speed limit needs ${fmt(rpmLimit,0)} RPM or less for a ${len(D)} tool, but this machine's minimum is ${fmt(m.rpmMin,0)} RPM. A smaller tool, a different cutter material or a slower machine would be needed.`],steps};

 // Chipload target: the geometric mean of the configured band, kept inside the comfortable part of it. No chip-thinning compensation is applied.
 const lo=l.chipMin/target,hi=l.chipMax*target;
 let chip=Math.sqrt(l.chipMin*l.chipMax);if(lo<=hi)chip=Math.min(hi,Math.max(lo,chip));
 steps.push(`Chipload target ${chipText(chip)}, near the middle of the ${chipText(l.chipMin)}–${chipText(l.chipMax)} band.`);

 // Engagement: a convention for the operation, within the tool's reach.
 const convention=STARTING_ENGAGEMENT[l.operation],reach=Math.min(t.fluteLength,t.stickout);
 let woc=convention.woc*D,doc=Math.min(convention.doc*D,REACH_FRACTION*reach);
 steps.push(`${l.operation==='roughing'?'Roughing':'Finishing'} convention: stepover ${pct(woc)}, depth ${pct(doc)}${doc<convention.doc*D?` (held within the tool's ${len(reach)} reach)`:''}${woc/D<.5?`. At this stepover the chip thins to about ${fmt(thinning(woc/D)*100,0)}% of the chipload.`:'.'}`);

 // Feed from the chipload, within the machine's feed limit. If the limit binds, slow the spindle to keep the chipload; at the minimum speed, thin the chip instead.
 const feedCap=FEED_FRACTION*m.feedMax;
 let feed=0;
 const recomputeFeed=(note:boolean)=>{
  feed=chip*t.flutes*rpm;
  if(feed<=feedCap){if(note)steps.push(`Feed ${feedText(feed)} from the chipload × ${t.flutes} flute${t.flutes===1?'':'s'} × ${fmt(rpm,0)} RPM.`);return;}
  feed=feedCap;const needed=floor100(feed/(chip*t.flutes));
  if(needed>=m.rpmMin){rpm=needed;if(note)steps.push(`Feed capped at ${feedText(feed)} (${fmt(FEED_FRACTION*100,0)}% of the machine limit), so spindle speed is lowered to ${fmt(rpm,0)} RPM to keep the chipload.`);return;}
  rpm=m.rpmMin;chip=feed/(t.flutes*rpm);
  if(note)steps.push(`Feed capped at ${feedText(feed)} (${fmt(FEED_FRACTION*100,0)}% of the machine limit). Even at the machine's minimum ${fmt(rpm,0)} RPM that gives only ${chipText(chip)} per tooth.`);
 };
 recomputeFeed(true);

 // Verify and back off until the point is comfortable. Consecutive moves against the same check are summarised in one line.
 let cut:Cut={rpm,feed,doc,woc},result=evaluate(cut);
 let nearest:{cut:Cut;result:Result}|undefined,inside:{cut:Cut;result:Result}|undefined;
 const adjustable=(r:Result)=>ratioOf(r,[...ENGAGEMENT_KEYS,'chipHigh','chipLow']).ratio;
 const track=()=>{
  if(result.hardOk&&(!nearest||adjustable(result)<adjustable(nearest.result)))nearest={cut,result};
  if(result.status==='inside'&&(!inside||adjustable(result)<adjustable(inside.result)))inside={cut,result};
 };
 let run:{key:string;text:string;from:string;to:string;n:number}|null=null;
 const flush=()=>{if(run){steps.push(`${run.text} ${run.from} to ${run.to}${run.n>1?` in ${run.n} steps`:''}.`);run=null;}};
 const move=(key:string,text:string,from:string,to:string)=>{if(run&&run.key===key){run.to=to;run.n++;}else{flush();run={key,text,from,to,n:1};}};
 for(let i=0;i<MAX_STEPS&&!accepted(result);i++){
  if(result.status==='invalid'||result.status==='no-cut'||!result.hardOk){
   flush();const hard=result.constraints.filter(c=>constraintInfo[c.key].kind==='hard'&&c.ratio>1).map(c=>label(c.key));
   return {ok:false,reasons:[`A hard limit fails at the seeded cut (${hard.join(', ')||result.status}). Check the machine RPM range, feed limit and tool reach.`],steps,nearest:nearest&&{...nearest,point:toPoint(nearest.cut)}};
  }
  track();
  const engagement=ratioOf(result,ENGAGEMENT_KEYS),chipHigh=ratioOf(result,['chipHigh']),chipLow=ratioOf(result,['chipLow']);
  const used=(c:{ratio:number})=>`${fmt(c.ratio*100,0)}% of its limit`;
  if(engagement.ratio>target){
   if(doc/D>DOC_FLOOR+1e-9){const from=pct(doc);doc=Math.max(DOC_FLOOR*D,doc*BACKOFF);move(`${engagement.key}:doc`,`${label(engagement.key)} at ${used(engagement)}: depth reduced from`,from,pct(doc));}
   else if(woc/D>WOC_FLOOR+1e-9){const from=pct(woc);woc=Math.max(WOC_FLOOR*D,woc*BACKOFF);move(`${engagement.key}:woc`,`${label(engagement.key)} at ${used(engagement)} with depth at its floor: stepover reduced from`,from,pct(woc));}
   else break;
  }else if(chipHigh.ratio>target){const from=chipText(chip);chip*=1-CHIP_STEP;recomputeFeed(false);move('chipHigh',`Chipload too high at ${used(chipHigh)}: chipload reduced from`,from,chipText(chip));}
  else if(chipLow.ratio>target){
   if(feed>=feedCap-1e-9&&rpm<=m.rpmMin)break;
   const from=chipText(chip);chip*=1+CHIP_STEP;recomputeFeed(false);move('chipLow',`Chipload too low at ${used(chipLow)}: chipload raised from`,from,chipText(chip));
  }else break;
  cut={rpm,feed,doc,woc};result=evaluate(cut);
 }
 flush();track();

 const feedStep=units==='imperial'?25.4:10;
 const snap=(c:Cut):Cut=>({rpm:Math.round(c.rpm/100)*100,feed:Math.round(c.feed/feedStep)*feedStep,doc:Math.round(c.doc/D/.05)*.05*D,woc:Math.min(D,Math.round(c.woc/D/.05)*.05*D)});
 const finish=(c:Cut,r:Result,okay:(r:Result)=>boolean):StartingPointOk=>{
  const s=snap(c),sr=evaluate(s);
  if(okay(sr)){c=s;r=sr;}
  return {ok:true,cut:c,point:toPoint(c),result:r,steps};
 };
 if(accepted(result))return finish(cut,result,accepted);
 if(inside){
  const soft=inside.result.softLimiting;
  steps.push(`No point met the ${fmt(target*100,0)}% target${soft?`: ${label(soft.key).toLowerCase()} stays at ${fmt(soft.ratio*100,0)}% of its limit`:''}. This is the best point inside your limits; it sits in the caution band.`);
  return finish(inside.cut,inside.result,r=>r.status==='inside');
 }
 const over=result.constraints.filter(c=>c.ratio>1),near=result.constraints.filter(c=>c.ratio>target&&c.ratio<=1);
 const list=(over.length?over:near).map(c=>`${label(c.key)} at ${fmt(c.ratio*100,0)}% of its limit`);
 return {ok:false,reasons:[`Reducing depth, stepover and chipload did not bring the cut inside your limits: ${list.join('; ')||result.status}. The chip band, deflection allowance or machine profile may need attention.`],steps,nearest:nearest&&{...nearest,point:toPoint(nearest.cut)}};
}
