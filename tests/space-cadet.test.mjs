import test from 'node:test';
import assert from 'node:assert/strict';
import {validCadetProgress,cadetCheckpoint,validateCadetFiles} from '../src/games/space-cadet.js';

const saved = () => ({version:2,engine:'space-cadet',ready:true,score:1234567,lives:2,rank:3,rankProgress:8,gameover:false,balls:[{x:4,y:5}]});
test('classic checkpoints retain earned progress without inventing a portable live ball', () => {
  const s = saved(), checkpoint = cadetCheckpoint(s);
  assert.deepEqual(checkpoint,{score:1234567,lives:2,rank:3,rankProgress:8});
  checkpoint.score = 0; assert.equal(s.score,1234567);
});
test('resume rejects legacy toy-table saves, unfinished initialization and corrupt scores', () => {
  assert.equal(validCadetProgress(saved()),true);
  for (const s of [{version:1,score:5,lives:3,phase:'play'},{...saved(),ready:false},{...saved(),score:NaN},{...saved(),gameover:true},{...saved(),lives:0}]) {
    assert.equal(validCadetProgress(s),false); assert.equal(cadetCheckpoint(s),null);
  }
});
test('original assets accept DAT plus optional sounds and reject ambiguous or unrelated files', () => {
  assert.doesNotThrow(() => validateCadetFiles([{name:'PINBALL.DAT',size:900000},{name:'SOUND1.WAV',size:2000}]));
  assert.doesNotThrow(() => validateCadetFiles([{name:'CADET.DAT',size:3000000}]));
  for (const files of [[],[{name:'sound1.wav',size:20}],[{name:'../PINBALL.DAT',size:20}],[{name:'PINBALL.DAT',size:20},{name:'payload.js',size:20}],[{name:'PINBALL.DAT',size:20},{name:'pinball.dat',size:20}],[{name:'PINBALL.DAT',size:34*1024*1024}]]) assert.throws(() => validateCadetFiles(files));
});
