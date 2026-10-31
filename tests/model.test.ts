import test from 'node:test';
import assert from 'node:assert/strict';
import { availablePower, calculate, cloneDefaults, peakCutterLoadFactor } from '../src/model.ts';
const close = (actual: number, expected: number, tolerance = 1e-9) => assert.ok(Math.abs(actual - expected) < tolerance, `${actual} != ${expected}`);

test('reference cut: units for speed, feed, chip thinning, MRR, power and torque', () => {
  const s = cloneDefaults(); const r = calculate(s.cut, s);
  close(r.surface, 60 * Math.PI); close(r.chip, .04); close(r.thinning, .8);
  close(r.chipMax, .032); close(r.mrr, 4.32); close(r.power, 90);
  close(r.torque, 90 * 60 / (2 * Math.PI * 10000));
  assert.equal(r.feasible, true);
});
test('radial chip thinning is continuous at half diameter and absent above it', () => {
  const s = cloneDefaults();
  for (const ratio of [.1, .5, .75, 1]) {
    const r = calculate({...s.cut, woc: s.tool.diameter * ratio}, s);
    close(r.thinning, ratio === .1 ? .6 : 1);
  }
  close(calculate({...s.cut, woc: 2.999999}, s).thinning, 1, 1e-10);
});
test('mechanical capacity is continuous at constant-torque / constant-power crossover', () => {
  const s = cloneDefaults(); const m = s.machine;
  const base = m.power * 60 / (2 * Math.PI * m.torque);
  close(availablePower(base, m), m.power * m.utilization);
  close(availablePower(base / 2, m), m.power * m.utilization / 2);
  close(availablePower(base * 2, m), m.power * m.utilization);
  for (const rpm of [1500, 5000, base, 18000]) {
    const r = calculate({...s.cut, rpm}, s);
    close(Math.max(...r.constraints.filter(c => ['power', 'torque'].includes(c.key)).map(c => c.ratio)), r.power / r.capacity);
  }
});
test('beam bending scales with stickout cubed and effective stiffness inversely', () => {
  const s = cloneDefaults(); const r = calculate(s.cut, s);
  close(calculate(s.cut, {...s, tool: {...s.tool, stickout: s.tool.stickout * 2}}).deflection, r.deflection * 8);
  close(calculate(s.cut, {...s, tool: {...s.tool, stiffness: s.tool.stiffness / 2}}).deflection, r.deflection * 2);
  // Independent reference for the illustrative cut: F=124.8 N; I=.45*pi*6^4/64 mm^4.
  close(r.force, 124.8); close(r.deflection, 124.8 * 20 ** 3 / (3 * 600000 * (.45 * Math.PI * 6 ** 4 / 64)) * 1000);
});
test('phase-resolved cutter load is continuous as a second flute enters at 75 percent WOC', () => {
  const s = cloneDefaults(); s.tool.flutes = 3;
  const below = calculate({...s.cut, woc: s.tool.diameter * (.75 - 1e-6)}, s);
  const at = calculate({...s.cut, woc: s.tool.diameter * .75}, s);
  const above = calculate({...s.cut, woc: s.tool.diameter * (.75 + 1e-6)}, s);
  assert.ok(Math.abs(above.force - below.force) / at.force < 1e-4);
  close(peakCutterLoadFactor(.75, 3), 1, 1e-12);
});
test('single-flute force retains the chip-thickness model and simultaneous flute forces are vector summed', () => {
  const s = cloneDefaults(); s.tool.flutes = 1;
  for(const engagement of [.1, .2, .5, .75, 1]){
    const r=calculate({...s.cut,woc:s.tool.diameter*engagement},s);
    close(r.force,s.material.kc*s.cut.doc*r.chipMax*s.material.forceFactor,1e-8);
  }
  close(peakCutterLoadFactor(1,4),1,1e-12);
  close(peakCutterLoadFactor(1,6),1.5,1e-12);
});
test('zero engagement removes no material and cannot enter the feasible envelope', () => {
  const s = cloneDefaults(); const r = calculate({...s.cut, woc: 0}, s);
  close(r.power, 0); close(r.mrr, 0); close(r.deflection, 0); assert.equal(r.feasible, false);
});
test('threshold crossing changes envelope classification and limiting cause', () => {
  const s = cloneDefaults();
  const weak = {...s, machine: {...s.machine, power: 10}};
  const r = calculate(s.cut, weak);
  assert.equal(r.feasible, false); assert.equal(r.limiting.key, 'power');
  const shallow = calculate({...s.cut, feed: 10}, s);
  assert.equal(shallow.feasible, false); assert.equal(shallow.limiting.key, 'chipLow');
  const tooDeep = calculate({...s.cut, doc: 16}, s);
  assert.ok(tooDeep.constraints.find(c => c.key === 'geometry')!.ratio > 1);
  const tooSlow = calculate({...s.cut, rpm: 1000}, s);
  assert.ok(tooSlow.constraints.find(c => c.key === 'rpm')!.ratio > 1);
});
test('full operating grids remain finite for all positive inputs, even outside limits', () => {
  const s = cloneDefaults();
  for (const rpm of [100, 1500, 10000, 19800]) for (const feed of [1, 1200, 3600]) for (const doc of [.01, 3, 16.5]) for (const woc of [.01, 1.2, 3, 6]) {
    const r = calculate({rpm, feed, doc, woc}, s);
    for (const k of ['surface', 'chip', 'chipMax', 'thinning', 'mrr', 'power', 'torque', 'capacity', 'force', 'deflection'] as const) assert.ok(Number.isFinite(r[k]), k);
    assert.equal(r.feasible, r.constraints.every(c => c.ratio <= 1));
  }
});
