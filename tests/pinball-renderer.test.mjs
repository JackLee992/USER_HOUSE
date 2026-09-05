import test from 'node:test';
import assert from 'node:assert/strict';
import {pinballPixelRatio} from '../src/games/pinball-renderer.js';
test('canvas density follows contained table size and caps CPU pixel budget',()=>{
 assert.equal(pinballPixelRatio(420,680,1),1);
 assert.equal(pinballPixelRatio(420,680,3),2);
 assert.equal(pinballPixelRatio(840,1360,3),2);
 assert.equal(pinballPixelRatio(210,340,3),1.5);
 assert.equal(pinballPixelRatio(400,340,3),1.5);
 assert.equal(pinballPixelRatio(0,0,3),1);
});
