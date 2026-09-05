import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';
import {createBoard} from '../src/games/match3.js';
import {dealFreeCell} from '../src/games/freecell.js';
import {newPinball} from '../src/games/pinball.js';
const source=readFileSync(new URL('../src/runtime/wanban-app.js',import.meta.url),'utf8');
const a=source.indexOf('  function hasPlayableProgress('),b=source.indexOf('\n  function ',a+4);
const context=vm.createContext({});vm.runInContext(source.slice(a,b),context);
const playable=context.hasPlayableProgress;
test('new game snapshots are recognized by the real runtime resume gate',()=>{
 assert.equal(playable('freecell',dealFreeCell()),true);
 assert.equal(playable('pinball',newPinball()),true);
 assert.equal(playable('match3',{board:createBoard(),moves:27,score:30,level:1}),true);
});
test('finished pinball and exhausted match-three are not offered as progress',()=>{
 assert.equal(playable('pinball',{...newPinball(),lives:0,phase:'over'}),false);
 assert.equal(playable('match3',{board:createBoard(),moves:0}),false);
});
