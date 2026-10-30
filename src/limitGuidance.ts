import {constraintInfo} from './model.ts';
import type {ConstraintKey,Result,Setup} from './model';
import {decimals,fmt,toDisplay,unit} from './units.ts';
import type {Quantity,Units} from './units';

// Qualitative teaching notes; these do not validate the configured thresholds.
export const limitGuidance:Record<ConstraintKey,{meaning:string;why:string;adjust:string;qualification:string;notice:string}>={
 chipHigh:{
  meaning:'Each cutting edge takes a bite of material; the size of that bite is the chipload. This check compares the thickest part of the chip, after radial chip thinning, with the configured maximum.',
  why:'An overly thick chip puts more force on the cutting edge. That can bend the cutter, damage an edge or break the tool, and leave a poor finish.',
  adjust:'Explore less feedrate at the same RPM, or more RPM within the machine and surface-speed limits. Recheck the other limits after either change. Reducing axial DOC reduces force but does not make each chip thinner in this model.',
  qualification:'The maximum is illustrative, not a proven tool-breakage threshold. Use tooling data for the actual cutter, material and operation.',
  notice:'Loud hammering or a bogging spindle, chipped cutting edges, torn fibres or rough walls, large chunky chips.',
 },
 chipLow:{
  meaning:'A cutting edge needs to take a chip, not just slide over the surface. This check compares maximum chip thickness with the configured minimum; a larger ratio here means a thinner chip.',
  why:'Very thin chips can cause rubbing instead of effective cutting. This can generate heat, accelerate wear and worsen the finish. A narrow WOC makes the chip thinner even when nominal feed per tooth looks reasonable.',
  adjust:'Explore more feedrate or less RPM within the other limits, then recheck power, torque and deflection. Further reducing WOC below half the cutter diameter makes chip thinning stronger. Do not blindly apply the thinning multiplier.',
  qualification:'The minimum is illustrative; actual rubbing depends on edge sharpness, material and tool geometry. A zero-removal point is not evaluated as a cutting problem.',
  notice:'Fine dust instead of chips, squealing, a hot cutter, burning or a brown glazed edge on wood, a dulling tool.',
 },
 power:{
  meaning:'Spindle power is the rate at which the spindle can do cutting work. This check compares estimated cutting demand with the configured power plateau after the usable-output reserve.',
  why:'Demand above real available output can slow the spindle, stall it or trip the drive. That can disrupt the cut and damage the work or tool.',
  adjust:'Explore a shallower DOC or narrower WOC to remove less material per minute. Lower feedrate also reduces estimated power, but can make chips too thin. In this model, changing RPM alone does not change cutting power at fixed feed, DOC and WOC.',
  qualification:'This is mechanical output, not wall-plug power. The example curve and estimated cutting demand do not establish the real machine capacity. Check torque too: it may limit output before the power plateau.',
  notice:'The spindle note drops under load, RPM sags, the drive faults or the spindle stalls.',
 },
 torque:{
  meaning:'Torque is the twisting effort at the spindle. Delivering the same power at a lower RPM needs more torque. This check compares estimated demand with the configured torque plateau after reserve.',
  why:'A cut can fit under a spindle’s power rating yet require more twisting effort than it can deliver at that speed. The spindle may lose speed or stall.',
  adjust:'Explore reducing DOC or WOC. Increasing RPM lowers torque demand at unchanged feed and engagement in this model, but also makes chips thinner and raises surface speed. Check all of those limits together.',
  qualification:'Power and torque are two checks on the same assumed output curve, not independent loads to add together. Actual gearing, drive behavior and low-speed cooling are not modeled.',
  notice:'The spindle slows or stalls at low RPM even though its power rating looked sufficient.',
 },
 deflection:{
  meaning:'Cutting force bends the tool slightly away from its unloaded position. This is an estimate of steady tool-tip bending, compared with the deflection allowed in this experiment.',
  why:'Too much bending can leave dimensions wrong, tapered walls or an uneven finish. A flexible setup can also increase the risk of tool damage.',
  adjust:'Explore less axial DOC or shorter stickout while retaining the reach and holder clearance the job needs. Shorter stickout strongly reduces this estimate. A larger tool changes stiffness, but also changes absolute DOC and WOC because Cutspace preserves their percentages.',
  qualification:'The selected cutter material sets a representative elastic modulus: HSS bends more than carbide under the same load and geometry in this model. This simplified estimate excludes holder, machine and workpiece flexibility. It does not predict chatter, tool breakage or guaranteed part accuracy.',
  notice:'Walls that are not square, undersized or tapered pockets, a wavy finish, a ringing or chattering sound.',
 },
 surface:{
  meaning:'Surface speed is how fast the outside cutting edge travels through the material. It depends on both cutter diameter and RPM, so a larger cutter has a higher surface speed at the same RPM.',
  why:'Excessive speed for the tool and material can raise cutting temperature and accelerate edge wear. The suitable speed depends on the tool material, coating, work material and cooling.',
  adjust:'Explore lower RPM, then recheck chip thickness and torque: keeping feed unchanged makes each tooth take a larger bite and raises twisting demand. Review feedrate together with RPM.',
  qualification:'The configured maximum is illustrative, not material-specific tooling guidance. This prototype does not calculate temperature.',
  notice:'Burning or glazing, smoke, discoloured chips, a cutting edge that dulls quickly.',
 },
 rpm:{
  meaning:'The selected spindle speed must lie between this machine profile’s configured minimum and maximum RPM, and below the tool’s own maximum RPM rating when one is entered. The panel identifies which bound is crossed.',
  why:'A real spindle may be unable to run or regulate properly below its approved range. Going above the approved speed of the spindle, holder or cutter can overload components; passing this profile check does not verify those separate ratings.',
  adjust:'Choose an RPM inside the verified operating range, then review surface speed and feed per tooth. Lower RPM at the same feed makes chips thicker; higher RPM makes them thinner.',
  qualification:'These profile bounds are example values. Verify the real spindle, tool and holder ratings before using a setup.',
  notice:'The controller clamps or refuses the speed, or the spindle runs rough and noisy outside its range.',
 },
 feed:{
  meaning:'Feedrate is how quickly the machine moves the cutter through the work. This check compares the requested feed with the configured machine feed limit.',
  why:'A machine cannot necessarily follow a faster command accurately. Depending on its controller and drives it may cap the speed, fault or lose position. Corners and short moves may need slower motion even below the stated maximum.',
  adjust:'Explore a feedrate within the verified machine range. Lowering feed at unchanged RPM makes chips thinner, so check the minimum-chip warning as well. Review RPM and engagement together if the desired chip thickness needs more feed than the machine can deliver.',
  qualification:'This assumed limit is not a motion simulation. Acceleration, path geometry and axis-specific limits are not included.',
  notice:'The machine never reaches the commanded feed, jerky motion, lost steps or rounded corners.',
 },
 geometry:{
  meaning:'Depth of cut must fit within both the usable flute length and the exposed stickout; each comparison is shown below. A full-width slot is a normal cut and is not penalised here. A stepover wider than the cutter is not a cut at all and is shown as invalid.',
  why:'Cutting deeper than the flutes can put an uncutting shank against the work; cutting beyond the exposed length risks holder interference.',
  adjust:'Reduce depth of cut to match the actual tool and setup. If a longer tool or more stickout is needed, recheck stiffness and clearances. Changing a number here does not change the physical tool.',
  qualification:'These are simple reach checks, not a collision simulation. Passing does not prove clearance around the holder, fixtures or part; relieved-neck and special-tool geometry are not modeled.',
  notice:'The shank rubbing or burnishing the wall, or the collet nut touching the work.',
 },
};

export function limitReading(key:ConstraintKey,s:Setup,r:Result,u:Units){
 const value=(n:number,q:Quantity)=>`${fmt(toDisplay(n,q,u),q==='length'?(u==='imperial'?5:4):decimals(q,u))} ${unit(q,u)}`.trim();
 const row=(label:string,actual:number,bound:number,q:Quantity,minimum=false)=>`${label}: ${value(actual,q)} · ${minimum?'minimum':'maximum'} ${value(bound,q)}${actual>bound&&!minimum?' — above maximum':actual<bound&&minimum?' — below minimum':''}`;
 const ratio=r.constraints.find(c=>c.key===key)?.ratio;
 const inactive=key==='chipLow'&&r.status==='no-cut'&&s.limits.cuttingDataKnown;
 const unknown=ratio===undefined;
 const exceeded=!inactive&&!unknown&&ratio>1;
 const soft=constraintInfo[key].kind==='soft',caution=soft&&!inactive&&!unknown&&!exceeded&&ratio>(s.limits.caution??.75);
 const state=inactive?'No cut':unknown?'Unavailable':exceeded?(key==='chipLow'||key==='rpm'&&s.cut.rpm<s.machine.rpmMin?'Below minimum':key==='rpm'?'Above maximum':'Limit exceeded'):caution?'Caution':soft?'Comfortable':'Within limit';
 let readings:string[]=[];
 switch(key){
  case 'chipHigh':readings=[row('Maximum chip thickness',r.chipMax,s.limits.chipMax,'length')];break;
  case 'chipLow':readings=inactive?['No material is being removed. The minimum-chip check applies to a cutting point.']:[row('Maximum chip thickness',r.chipMax,s.limits.chipMin,'length',true)];break;
  case 'power':readings=[row('Estimated cutting power',r.power,s.machine.power*s.machine.utilization,'power')];break;
  case 'torque':readings=[row('Estimated cutting torque',r.torque,s.machine.torque*s.machine.utilization,'torque')];break;
  case 'deflection':readings=[row('Estimated tip bending',r.deflection,s.limits.deflection,'deflection')];break;
  case 'surface':readings=[row('Surface speed',r.surface,s.limits.surfaceMax,'surface')];break;
  case 'rpm':readings=[`Selected ${fmt(s.cut.rpm,0)} RPM · range ${fmt(s.machine.rpmMin,0)}–${fmt(s.machine.rpmMax,0)} RPM${s.tool.maxRpm?` · tool maximum ${fmt(s.tool.maxRpm,0)} RPM`:''}`];break;
  case 'feed':readings=[row('Feedrate',s.cut.feed,s.machine.feedMax,'feed')];break;
  case 'geometry':readings=[row('Depth of cut / flute length',s.cut.doc,s.tool.fluteLength,'length'),row('Depth of cut / stickout',s.cut.doc,s.tool.stickout,'length')];break;
 }
 if(unknown)readings=['This check cannot be evaluated: required model data are unavailable or the cutting geometry is invalid. It is not a passing result.'];
 if(unknown&&!s.limits.cuttingDataKnown&&['chipHigh','chipLow','surface'].includes(key))readings=['No active limit for this cutter/workpiece combination. Enter chip and surface-speed limits above and enable their use. Previous values are retained for editing, not used in the check.'];
 return {state,exceeded,unknown,inactive,caution,soft,ratio,readings};
}
