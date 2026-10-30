import {constraintInfo} from './model';
import type {Result,Setup} from './model';
import type {Units} from './units';
import {fmt} from './units';
import {explain,constraintHelp} from './help';
import {limitGuidance,limitReading} from './limitGuidance';

export default function LimitChecks({setup,result,units}:{setup:Setup;result:Result;units:Units}){
 const keys=[...result.constraints.map(c=>c.key),...result.unknown];
 return <div className="limit-checks">{keys.map(key=>{
  const reading=limitReading(key,setup,result,units),guide=limitGuidance[key];
  return <details key={`${key}-${reading.state}`} className={`limit-check ${reading.exceeded?'exceeded':reading.caution?'caution':''}`} open={reading.exceeded||reading.unknown}>
   <summary {...explain(`${constraintHelp[key]} Expand this check to see its meaning, why it matters and what to adjust.`)}>
    <span>{constraintInfo[key].label}<small>{reading.state}{reading.soft?' · soft limit':' · hard limit'}</small></span>
    <b>{reading.inactive||reading.unknown?'—':Number.isFinite(reading.ratio)?`${fmt(reading.ratio!*100,0)}%`:'Beyond range'}</b>
   </summary>
   <div className="limit-detail">
    <div className="limit-values">{reading.readings.map(text=><p key={text}>{text}</p>)}</div>
    <p>{guide.meaning}</p>
    <h4>Why it matters</h4><p>{guide.why}</p>
    <h4>What to adjust</h4><p>{guide.adjust}</p>
    <h4>What you’d notice</h4><p>{guide.notice}</p>
    <p className="limit-qualification">{guide.qualification}</p>
   </div>
  </details>;
 })}</div>;
}
