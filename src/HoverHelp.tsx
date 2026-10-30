import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {tooltipPosition} from './tooltipPosition';
import {tipText,TIP_DELAY} from './prefs';

type Tip={anchor:Element;text:string;full:string;portal:Element;kind:'help'|'quick'|'pinned'};
const inUi=(t:EventTarget|null)=>t instanceof Element&&!!t.closest('[data-help-ui]');
const anchorOf=(t:EventTarget|null)=>t instanceof Element?t.closest('[data-help]'):null;
export default function HoverHelp({mode,tips,onDone}:{mode:boolean;tips:boolean;onDone:()=>void}){
 const [tip,setTip]=useState<Tip|null>(null),[position,setPosition]=useState({left:8,top:8});
 const bubble=useRef<HTMLDivElement>(null),visible=useRef(false);
 useEffect(()=>{
  // Explicit Help mode: click, tap or Enter/Space explains without activating. No listeners outside the mode.
  visible.current=false;setTip(null);
  if(!mode)return;
  let consumed=false;
  const hide=()=>{visible.current=false;setTip(null);};
  const show=(anchor:Element)=>{
   const text=anchor.getAttribute('data-help');if(!text||!anchor.isConnected)return;
   visible.current=true;setTip({anchor,text,full:text,portal:anchor.closest('dialog[open]')??document.body,kind:'help'});
  };
  const down=(e:PointerEvent)=>{if(!inUi(e.target)&&anchorOf(e.target)){e.preventDefault();e.stopPropagation();}};
  const click=(e:MouseEvent)=>{if(inUi(e.target))return;const a=anchorOf(e.target);if(a){e.preventDefault();e.stopPropagation();show(a);}};
  const key=(e:KeyboardEvent)=>{
   if(e.key==='Escape'){consumed=true;e.preventDefault();e.stopPropagation();if(visible.current)hide();else onDone();return;}
   if(e.key==='Tab'||inUi(e.target))return;
   const a=anchorOf(e.target);if(a){e.preventDefault();e.stopPropagation();if(e.key==='Enter'||e.key===' ')show(a);}
  };
  const cancel=(e:Event)=>{if(visible.current||consumed||mode){e.preventDefault();e.stopPropagation();consumed=false;if(visible.current)hide();else onDone();}};
  document.addEventListener('pointerdown',down,true);document.addEventListener('click',click,true);
  document.addEventListener('keydown',key,true);document.addEventListener('cancel',cancel,true);
  return()=>{document.removeEventListener('pointerdown',down,true);document.removeEventListener('click',click,true);document.removeEventListener('keydown',key,true);document.removeEventListener('cancel',cancel,true);};
 },[mode,onDone]);
 useEffect(()=>{
  // Quick tips: a mouse resting on a control for a moment shows its first sentence. Off in Help mode, when disabled, and for touch/pen.
  if(mode||!tips||typeof window.matchMedia!=='function'||!window.matchMedia('(pointer:fine)').matches)return;
  let showTimer=0,hideTimer=0,pressed=false,current:Element|null=null;
  const clearTimers=()=>{window.clearTimeout(showTimer);window.clearTimeout(hideTimer);};
  const dropQuick=()=>setTip(t=>t&&t.kind==='pinned'?t:null);
  const scheduleHide=()=>{clearTimers();current=null;hideTimer=window.setTimeout(dropQuick,250);};
  const over=(e:PointerEvent)=>{
   if(pressed||e.pointerType!=='mouse')return;
   if(inUi(e.target)){window.clearTimeout(hideTimer);return;}
   const a=anchorOf(e.target);
   if(!a){scheduleHide();return;}
   if(a===current){window.clearTimeout(hideTimer);return;}
   clearTimers();current=a;
   showTimer=window.setTimeout(()=>{
    const full=a.getAttribute('data-help');if(!full||!a.isConnected)return;
    setTip(prev=>prev&&prev.kind==='pinned'?prev:{anchor:a,text:tipText(full),full,portal:a.closest('dialog[open]')??document.body,kind:'quick'});
   },TIP_DELAY);
  };
  const out=(e:PointerEvent)=>{const to=e.relatedTarget instanceof Element?e.relatedTarget:null;if(to&&(inUi(to)||(current&&current.contains(to))))return;scheduleHide();};
  const down=(e:PointerEvent)=>{pressed=true;if(inUi(e.target))return;clearTimers();current=null;setTip(null);};
  const up=()=>{pressed=false;};
  const key=(e:KeyboardEvent)=>{if(e.key==='Escape'){clearTimers();current=null;setTip(null);}};
  const leave=(e?:Event)=>{if(e&&inUi(e.target))return;clearTimers();current=null;dropQuick();};
  document.addEventListener('pointerover',over,true);document.addEventListener('pointerout',out,true);document.addEventListener('pointerdown',down,true);document.addEventListener('pointerup',up,true);document.addEventListener('keydown',key,true);document.addEventListener('scroll',leave,true);window.addEventListener('blur',()=>leave());
  return()=>{clearTimers();document.removeEventListener('pointerover',over,true);document.removeEventListener('pointerout',out,true);document.removeEventListener('pointerdown',down,true);document.removeEventListener('pointerup',up,true);document.removeEventListener('keydown',key,true);document.removeEventListener('scroll',leave,true);setTip(null);};
 },[mode,tips]);
 useLayoutEffect(()=>{
  if(!tip||!bubble.current)return;
  const element=bubble.current,maxWidth=tip.kind==='quick'?280:340;
  const place=()=>{
   if(!element.isConnected)return;
   if(!tip.anchor.isConnected){setTip(null);visible.current=false;return;}
   const vv=window.visualViewport,viewport={left:vv?.offsetLeft??0,top:vv?.offsetTop??0,width:vv?.width??window.innerWidth,height:vv?.height??window.innerHeight};
   element.style.width=`${Math.max(1,Math.min(maxWidth,viewport.width-16))}px`;
   element.style.maxHeight=`${Math.max(1,Math.min(420,viewport.height-24))}px`;
   const rect=element.getBoundingClientRect();
   setPosition(tooltipPosition(tip.anchor.getBoundingClientRect(),rect.width,rect.height,viewport));
  };
  place();const ro=new ResizeObserver(place);ro.observe(element);ro.observe(tip.anchor);
  window.addEventListener('resize',place);document.addEventListener('scroll',place,true);window.visualViewport?.addEventListener('resize',place);window.visualViewport?.addEventListener('scroll',place);
  return()=>{ro.disconnect();window.removeEventListener('resize',place);document.removeEventListener('scroll',place,true);window.visualViewport?.removeEventListener('resize',place);window.visualViewport?.removeEventListener('scroll',place);};
 },[tip]);
 if(!tip)return null;
 const quick=tip.kind==='quick';
 // Essential placement is inline: stale/missing stylesheet rules cannot turn help into footer text.
 return createPortal(<div ref={bubble} data-help-ui role={quick?'tooltip':'region'} aria-label={quick?undefined:'Explanation'} aria-live="polite" className={`hover-help ${quick?'quick-tip':''}`} style={{position:'fixed',...position,right:'auto',bottom:'auto',margin:0,transform:'none',zIndex:2147483647,boxSizing:'border-box',width:`min(${quick?280:340}px, calc(100vw - 16px))`,maxWidth:'calc(100vw - 16px)',maxHeight:'min(420px, calc(100dvh - 24px))',overflowY:'auto'}}>
  {quick?<><div>{tip.text}</div>{tip.text!==tip.full&&<button className="help-more" onClick={()=>setTip({...tip,kind:'pinned',text:tip.full})}>More…</button>}</>
  :<><div className="help-heading"><strong>Explanation</strong><button onClick={()=>{setTip(null);visible.current=false;}} aria-label="Close explanation">×</button></div><div>{tip.text}</div>{tip.kind==='help'&&<button className="help-done" onClick={onDone}>Done with Help</button>}</>}
 </div>,tip.portal);
}
