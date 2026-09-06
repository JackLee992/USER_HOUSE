import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';
import {createBoard,migrateState,switchMode,validMatch3Progress} from '../src/games/match3.js';
import {dealFreeCell} from '../src/games/freecell.js';
import {validCadetProgress} from '../src/games/space-cadet.js';
const cadet = () => ({version:2,engine:'space-cadet',ready:true,score:0,lives:3,gameover:false});
const source=readFileSync(new URL('../src/runtime/wanban-app.js',import.meta.url),'utf8');
const a=source.indexOf('  function hasPlayableProgress('),b=source.indexOf('\n  function ',a+4);
const context=vm.createContext({validCadetProgress,validMatch3Progress});vm.runInContext(source.slice(a,b),context);
const playable=context.hasPlayableProgress;
test('new game snapshots are recognized by the real runtime resume gate',()=>{
 assert.equal(playable('freecell',dealFreeCell()),true);
 assert.equal(playable('pinball',cadet()),true);
 assert.equal(playable('match3',{board:createBoard(),moves:27,score:30,level:1}),true);
});
test('finished pinball and legacy exhausted match-three are not offered as progress',()=>{
 assert.equal(playable('pinball',{...cadet(),lives:0,gameover:true}),false);
 assert.equal(playable('match3',{board:createBoard(),moves:0}),false);
});

test('v3 endless zero-step and finite failed levels remain resumable with their rewards',()=>{
 const classic=migrateState(null);classic.moves=0;classic.wallet.coins=65;classic.wallet.stars=3;
 assert.equal(playable('match3',classic),true);
 const ice=switchMode(classic,'ice');ice.moves=0;
 assert.equal(playable('match3',ice),true);
 const endless=switchMode(ice,'endless');assert.equal(endless.moves,0);assert.equal(playable('match3',endless),true);
 assert.equal(endless.wallet.coins,65);assert.equal(endless.modeStates.classic.moves,0);
});
test('the v3 resume exception does not accept malformed boards, modes or wallets',()=>{
 const s=migrateState(null);s.moves=0;
 for(const bad of [{...s,board:[]},{...s,board:Array.from({length:8},()=>Array(8).fill(99))},{...s,mode:'invalid'},{...s,levelScore:NaN},{...s,score:-1},{...s,wallet:{coins:-1,stars:3}},{...s,wallet:null}])assert.equal(playable('match3',bad),false);
 assert.equal(playable('match3',{rulesVersion:2,board:s.board,moves:0}),false);
});
