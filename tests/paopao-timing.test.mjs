import assert from 'node:assert/strict';
import test from 'node:test';
import { createPaopaoHarness } from './helpers/paopao-harness.mjs';

function fallAt(fps, ms = 600) {
  const h = createPaopaoHarness(); h.frame(1000); h.game.fall();
  for (let i = 1; i <= Math.round(ms * fps / 1000); i++) h.frame(1000 + i * 1000 / fps);
  return h.game.snapshot().falling[0];
}
for (const fps of [10, 15, 30, 120]) test(`falling bubbles travel the same distance at ${fps} and 60 FPS`, () => {
  const normal = fallAt(60), slow = fallAt(fps);
  assert.ok(Math.abs(normal.y - slow.y) < .01, `60 FPS y=${normal.y}; ${fps} FPS y=${slow.y}`);
  assert.ok(Math.abs(normal.vy - slow.vy) < .01);
});
test('pause freezes falling bubbles and pop effects', () => {
  const h = createPaopaoHarness(); h.frame(1000); h.game.fall(); h.pause(true);
  const before = h.game.snapshot(); h.frame(1100); h.frame(1200);
  assert.deepEqual(h.game.snapshot(), before);
});
test('restart cancels the previous animation loop', () => {
  const h = createPaopaoHarness(); h.frame(1000); h.restart();
  assert.equal(h.pending().frames, 1);
  h.destroy(); assert.equal(h.pending().frames, 0); assert.equal(h.pending().listeners, 0);
});
test('resume after a long callback gap does not fast-forward a shot', () => {
  const h = createPaopaoHarness(); h.frame(1000); h.pause(true); h.game.shoot();
  h.frame(1010); h.pause(false); h.frame(61010);
  assert.equal(h.game.snapshot().shots, 0);
});
