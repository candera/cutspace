import test from 'node:test';
import assert from 'node:assert/strict';
import {DRAWING,toolLayout} from '../src/toolLayout.ts';
import {builtinLibrary} from '../src/library.ts';
import {cloneDefaults} from '../src/model.ts';

const close=(a:number,b:number,t=1e-9)=>assert.ok(Math.abs(a-b)<t,`${a} != ${b}`);
const TOOLS=builtinLibrary().tools;

test('the drawing uses one scale: shank, flutes and lengths are proportional to the entered values and fit the frame',()=>{
 const t=cloneDefaults().tool,l=toolLayout(t);
 close(l.shank.width/l.flutes.width,t.shankDiameter/t.diameter);
 close(l.flutes.height/(l.shank.height+l.flutes.height),t.fluteLength/t.stickout);
 close(l.tip-l.shank.y,t.stickout*l.scale);
 assert.ok(l.tip<=DRAWING.top+DRAWING.colletHeight+DRAWING.maxLength+1e-9);
 assert.ok(l.flutes.width<=DRAWING.maxWidth+1e-9&&l.shank.width<=DRAWING.maxWidth+1e-9);
 assert.deepEqual(l.dimensions.map(d=>d.key),['stickout','fluteLength','diameter','shankDiameter']);
 assert.equal(l.upcut,undefined);
});

test('a tipped straight bit on a small shank is drawn top-heavy, and a compression bit shows its upcut section',()=>{
 const tipped=TOOLS.find(t=>t.id==='half-2f-straight-tipped')!.tool,l=toolLayout(tipped);
 close(l.shank.width/l.flutes.width,.5);assert.ok(l.shank.width<l.flutes.width);
 const comp=TOOLS.find(t=>t.id==='quarter-2f-compression')!.tool,c=toolLayout(comp);
 assert.ok(c.upcut);close(c.upcut!.height/c.flutes.height,comp.upcutLength!/comp.fluteLength);close(c.upcut!.y+c.upcut!.height,c.tip);
 assert.equal(c.dimensions.at(-1)!.key,'upcutLength');assert.equal(c.dimensions.at(-1)!.value,comp.upcutLength);
 // A flute length longer than the stickout leaves no shank segment; a slender tool still has a visible stroke.
 const long=toolLayout({...comp,fluteLength:comp.stickout*2});assert.equal(long.shank.height,0);close(long.flutes.height,comp.stickout*long.scale);
 const slender=toolLayout({...comp,diameter:.5,shankDiameter:.5,stickout:120});assert.ok(slender.flutes.width>=DRAWING.minStroke);
});
