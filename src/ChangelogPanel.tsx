import type {ReactNode} from 'react';
import changelog from '../CHANGELOG.md?raw';

function inline(text:string):ReactNode[]{
 return text.split(/(`[^`]+`)/g).filter(Boolean).map((part,i)=>part.startsWith('`')&&part.endsWith('`')?<code key={i}>{part.slice(1,-1)}</code>:part);
}

export default function ChangelogPanel(){
 const blocks:ReactNode[]=[];let bullets:string[]=[];let key=0;
 const flush=()=>{if(bullets.length){blocks.push(<ul key={key++}>{bullets.map((item,i)=><li key={i}>{inline(item)}</li>)}</ul>);bullets=[];}};
 for(const raw of changelog.trim().split('\n')){
  const line=raw.trim();
  if(!line){flush();continue;}
  if(line.startsWith('- ')){bullets.push(line.slice(2));continue;}
  flush();
  if(line.startsWith('### '))blocks.push(<h4 key={key++}>{inline(line.slice(4))}</h4>);
  else if(line.startsWith('## '))blocks.push(<h3 key={key++}>{inline(line.slice(3))}</h3>);
  else if(line.startsWith('# '))blocks.push(<h3 className="changelog-title" key={key++}>{inline(line.slice(2))}</h3>);
  else blocks.push(<p key={key++}>{inline(line)}</p>);
 }
 flush();
 return <section className="changelog-panel" aria-label="Cutspace changelog">{blocks}</section>;
}
