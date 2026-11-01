import test from 'node:test';
import assert from 'node:assert/strict';
import {parsePrefs,defaultPrefs,tipText,tipsAllowed,clampPanelWidth,PANEL_MIN,PANEL_MAX} from '../src/prefs.ts';
import {displayPlaces} from '../src/units.ts';

test('preferences tolerate missing, malformed and partial stored values',()=>{
 assert.deepEqual(parsePrefs(null),defaultPrefs);
 assert.deepEqual(parsePrefs('not json'),defaultPrefs);
 assert.deepEqual(parsePrefs('{"tips":"yes"}'),defaultPrefs);
 assert.deepEqual(parsePrefs('{"tips":false}'),{...defaultPrefs,tips:false});
 assert.deepEqual(parsePrefs('{"tips":true,"welcomed":true,"extra":1}'),{...defaultPrefs,tips:true,welcomed:true});
 assert.deepEqual(parsePrefs('{"panelOpen":true,"panelWidth":520,"panelTab":"Library"}'),{...defaultPrefs,panelOpen:true,panelWidth:520,panelTab:'Library'});
 assert.deepEqual(parsePrefs('{"panelOpen":"yes","panelWidth":"wide","panelTab":"x".repeat(40)}'),defaultPrefs,'wrong types fall back');
 assert.equal(parsePrefs('{"panelWidth":50}').panelWidth,PANEL_MIN);assert.equal(parsePrefs('{"panelWidth":99999}').panelWidth,PANEL_MAX);
});
test('the docked panel width stays between its minimum and 60% of the viewport',()=>{
 assert.equal(clampPanelWidth(460,1400),460);
 assert.equal(clampPanelWidth(100,1400),PANEL_MIN);
 assert.equal(clampPanelWidth(900,1400),840,'60% of 1400');
 assert.equal(clampPanelWidth(Infinity,3000),PANEL_MAX);
 assert.equal(clampPanelWidth(500,1001),500,'within the 600 px a 1001 px viewport allows');assert.equal(clampPanelWidth(700,1001),600);
 assert.equal(clampPanelWidth(NaN,1400),defaultPrefs.panelWidth);
 assert.equal(clampPanelWidth(900,400),PANEL_MIN,'the minimum wins over a tiny viewport');
});
test('quick tips show one readable sentence and keep the full text available',()=>{
 assert.equal(tipText('Short tip. Second sentence here.'),'Short tip.');
 assert.equal(tipText('Value in N/mm². More follows.'),'Value in N/mm².');
 const long='A'.repeat(50)+' '+'B'.repeat(50)+' '+'C'.repeat(80)+'. Tail.';
 const t=tipText(long);assert.ok(t.length<=140);assert.ok(t.endsWith('…'));
 assert.equal(tipText('No terminal punctuation'),'No terminal punctuation');
});
test('tips never appear in Help mode, when disabled, or for coarse pointers',()=>{
 assert.equal(tipsAllowed(false,{tips:true,welcomed:true},true),true);
 assert.equal(tipsAllowed(true,{tips:true,welcomed:true},true),false);
 assert.equal(tipsAllowed(false,{tips:false,welcomed:true},true),false);
 assert.equal(tipsAllowed(false,{tips:true,welcomed:true},false),false);
});
test('field display rounding keeps four significant figures without false precision',()=>{
 assert.equal(Number((30/25.4).toFixed(displayPlaces(30/25.4,'length','imperial'))),1.1811);
 assert.equal(Number((15/25.4).toFixed(displayPlaces(15/25.4,'length','imperial'))),0.5906);
 assert.equal(Number((0.008).toFixed(displayPlaces(0.008,'length','metric'))),0.008);
 assert.equal(Number((0.45).toFixed(displayPlaces(0.45,'none','metric'))),0.45);
 assert.equal(Number((18000).toFixed(displayPlaces(18000,'none','metric'))),18000);
 assert.equal(Number((1200/25.4).toFixed(displayPlaces(1200/25.4,'feed','imperial'))),47.24);
});
