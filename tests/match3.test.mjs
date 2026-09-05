import test from 'node:test';
import assert from 'node:assert/strict';
import {findMatches, legalMoves, createBoard, swapBoard, collapseBoard, resolveBoard, playMove, levelConfig, turnOutcome} from '../src/games/match3.js';
const rng = seed => () => ((seed = (Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
const latin = () => Array.from({length:8},(_,r)=>Array.from({length:8},(_,c)=>(r+c)%6));
test('crosses count each gem once and retain two runs',()=>{
 const b=latin(); for(let c=2;c<5;c++)b[3][c]=5; for(let r=2;r<5;r++)b[r][3]=5;
 const m=findMatches(b); assert.equal(m.cells.length,5); assert.deepEqual(m.runs.map(r=>r.length),[3,3]);
});
test('seeded boards have no matches and a legal move',()=>{
 for(let seed=0;seed<80;seed++){const b=createBoard(rng(seed));assert.equal(findMatches(b).cells.length,0);assert.ok(legalMoves(b).length);}
});
test('invalid swap is rejected without changing state or losing a move; valid swap consumes one',()=>{
 const b=createBoard(rng(27)), before=structuredClone(b), move=legalMoves(b)[0];
 const state={board:b,score:0,levelScore:0,moves:20,level:1};
 const bad=playMove(state,0,63,rng(7));assert.equal(bad.valid,false);assert.deepEqual(bad.state,state);
 const good=playMove(state,...move,rng(7));assert.equal(good.valid,true);assert.equal(good.state.moves,19);assert.ok(good.state.score>=30);assert.deepEqual(b,before);assert.equal(findMatches(good.state.board).cells.length,0);
});
test('gravity preserves survivors in column order and refills vacancies',()=>{
 const b=latin(), next=collapseBoard(b,[0,8,24],()=>0.99);
 assert.deepEqual(next.map(r=>r[0]),[5,5,5,2,4,5,0,1]);assert.deepEqual(b,latin());
});
test('four and five runs receive bonuses and cascades resolve to stable board',()=>{
 const b=latin();for(let c=0;c<5;c++)b[0][c]=4;
 const result=resolveBoard(b,rng(8));assert.ok(result.score>=100);assert.ok(result.waves.length>=1);assert.equal(findMatches(result.board).cells.length,0);
 // A first horizontal clear drops another horizontal run into place.
 const cascade=latin();cascade[7].fill(0);cascade[6][0]=1;cascade[5][1]=1;cascade[6][2]=1;cascade[6][1]=0;
 let found=false;for(let s=1;s<20;s++)if(resolveBoard(cascade,rng(s)).waves.length>1){found=true;break;}assert.ok(found);
});
test('target takes priority on the final move and difficulty increases',()=>{
 assert.equal(turnOutcome({level:1,levelScore:levelConfig(1).target,moves:0}),'level');
 assert.equal(turnOutcome({level:1,levelScore:0,moves:0}),'gameover');
 assert.equal(turnOutcome({level:1,levelScore:0,moves:1}),'continue');
 assert.ok(levelConfig(5).target>levelConfig(1).target);
});
test('swaps are immutable',()=>{const b=latin(), copy=structuredClone(b), next=swapBoard(b,0,1);assert.deepEqual(b,copy);assert.equal(next[0][0],b[0][1]);});

test('adjacent nonmatching swap returns the exact unspent stable state',()=>{
 const board=latin(), state={board,score:10,levelScore:10,moves:3,level:1};
 assert.equal(findMatches(swapBoard(board,0,1)).cells.length,0);
 assert.deepEqual(playMove(state,0,1),{valid:false,state});
});
test('deadlocked board is regenerated and pathological RNG remains bounded',()=>{
 const board=latin();assert.equal(legalMoves(board).length,0);
 const result=resolveBoard(board,rng(17));assert.equal(result.reshuffled,true);assert.ok(legalMoves(result.board).length);
 const constant=createBoard(()=>0);assert.equal(findMatches(constant).cells.length,0);assert.ok(legalMoves(constant).length);
});
