import test from 'node:test';
import assert from 'node:assert/strict';
import {createBoard,createIce,legalMoves,findMatches,migrateState,switchMode,turnOutcome,levelConfig,playMove,specialGem,specialKind,claimLevelReward,advanceLevel,retryLevel,usePowerup,POWERUP_COSTS} from '../src/games/match3.js';
const rng=seed=>()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
const start=()=>migrateState(null,rng(14));
const latin=()=>Array.from({length:8},(_,r)=>Array.from({length:8},(_,c)=>(r+c)%6));

test('mode changes retain each board and target progress while sharing the wallet',()=>{
 const classic=start();classic.score=120;classic.levelScore=120;classic.moves=19;
 const ice=switchMode(classic,'ice',rng(28));ice.score=40;ice.levelScore=40;ice.ice[18]=0;ice.wallet.coins=77;
 const endless=switchMode(ice,'endless',rng(31));endless.levelScore=120;
 const back=switchMode(endless,'classic');assert.deepEqual(back.board,classic.board);assert.equal(back.moves,19);assert.equal(back.levelScore,120);assert.equal(back.wallet.coins,77);
 const thaw=switchMode(back,'ice');assert.deepEqual(thaw.board,ice.board);assert.equal(thaw.ice[18],0);assert.equal(thaw.levelScore,40);assert.equal(thaw.wallet.coins,77);
 assert.equal(classic.wallet.coins,30,'source state is immutable');assert.equal(switchMode(thaw,'unknown'),thaw);
});
test('v2 saves preserve special gems and collection goals when upgraded, then roundtrip all modes',()=>{
 const board=createBoard(rng(3));board[0][0]=specialGem(2,'bomb');
 const old={rulesVersion:2,board,level:4,score:900,levelScore:200,moves:12,goals:[{color:1,count:8}],collected:[0,4,0,0,0,0]};
 const upgraded=migrateState(old);assert.equal(upgraded.rulesVersion,3);assert.deepEqual(upgraded.goals,old.goals);assert.deepEqual(upgraded.board,old.board);assert.equal(upgraded.wallet.coins,30);
 const all=switchMode(switchMode(upgraded,'ice',rng(5)),'endless',rng(6));assert.deepEqual(migrateState(JSON.parse(JSON.stringify(all))),all);
});
test('ice mode requires every layer plus the score goal, including on the last move',()=>{
 const s=switchMode(start(),'ice',rng(5));s.levelScore=1000;s.moves=0;
 assert.equal(turnOutcome(s),'gameover');s.ice.fill(0);assert.equal(turnOutcome(s),'level');s.levelScore=0;assert.equal(turnOutcome(s),'gameover');
 assert.equal(createIce(1).reduce((a,b)=>a+b,0),16);assert.ok(createIce(3).some(n=>n===2));assert.ok(createIce(4).reduce((a,b)=>a+b,0)>16);
});
test('endless accepts moves at zero remaining steps and advances milestones on the same board',()=>{
 const s=switchMode(start(),'endless',rng(7));assert.equal(s.moves,0);assert.equal(turnOutcome(s),'continue');
 const moved=playMove(s,...legalMoves(s.board)[0],rng(19));assert.equal(moved.valid,true);assert.equal(moved.state.moves,0);assert.equal(moved.state.turnsUsed,1);
 const complete={...moved.state,levelScore:2300};const advanced=advanceLevel(complete,rng(8));assert.deepEqual(advanced.board,complete.board);assert.equal(advanced.level,3);assert.equal(advanced.levelScore,300);assert.equal(advanced.wallet.coins,70);assert.equal(advanced.wallet.stars,2);assert.equal(turnOutcome(advanced),'continue');
});
test('finite rewards are issued once with stars determined by remaining moves',()=>{
 for(const [moves,stars] of [[0,1],[5,2],[10,3]]){
  const s={...start(),levelScore:600,moves};const result=claimLevelReward(s);assert.equal(result.reward.stars,stars);assert.equal(result.state.wallet.coins,30+20+10*stars);
  const reloaded=migrateState(JSON.parse(JSON.stringify(result.state)));assert.equal(claimLevelReward(reloaded).reward,null);assert.equal(advanceLevel(reloaded,rng(7)).wallet.coins,result.state.wallet.coins);
  assert.equal(s.wallet.coins,30);
 }
});
test('each mode receives its own level reward without reissuing the others',()=>{
 let s=claimLevelReward({...start(),levelScore:600,moves:0}).state;
 s=switchMode(s,'ice',rng(1));s={...s,levelScore:400,ice:Array(64).fill(0)};s=claimLevelReward(s).state;
 assert.equal(s.wallet.stars,4);assert.equal(s.wallet.claimed.classic,1);assert.equal(s.wallet.claimed.ice,1);
 s=switchMode(s,'classic');assert.equal(claimLevelReward(s).reward,null);
});
test('large endless cascades claim all crossed milestones once without rebuilding the board',()=>{
 const s={...switchMode(start(),'endless',rng(4)),levelScore:1200050};
 const first=claimLevelReward(s);assert.equal(first.reward.coins,24000);assert.equal(first.reward.stars,1200);assert.equal(first.state.wallet.claimed.endless,1200);
 const next=advanceLevel(first.state);assert.equal(next.level,1201);assert.equal(next.levelScore,50);assert.equal(next.wallet.coins,24030);assert.deepEqual(next.board,s.board);
});
test('hammer spends only on a valid target, chips one fixed ice layer and costs no move',()=>{
 const board=latin();board[0][0]=specialGem(0,'rainbow');const s={...switchMode(start(),'ice',rng(4)),board,ice:Array(64).fill(0)};s.ice[7]=2;s.ice[0]=1;
 assert.deepEqual(usePowerup(s,'hammer',-1),{valid:false,state:s});
 const hit=usePowerup(s,'hammer',7,()=>0);assert.equal(hit.valid,true);assert.equal(hit.waves.length,1);assert.equal(hit.state.ice[7],1);assert.equal(hit.state.ice[0],1);assert.equal(hit.state.moves,s.moves);assert.equal(hit.state.wallet.coins,10);assert.equal(hit.state.score,10);assert.equal(hit.state.collected[1],1);assert.equal(hit.state.toolsUsed,1);assert.equal(s.ice[7],2);
 assert.deepEqual(usePowerup(hit.state,'hammer',7),{valid:false,state:hit.state});
});
test('hammer triggers the actual special it hits, including its chain reaction',()=>{
 const s=start();s.board[3][3]=specialGem(2,'row');s.board[3][5]=specialGem(1,'column');
 const hit=usePowerup(s,'hammer',27,rng(99));assert.equal(hit.valid,true);for(let i=0;i<8;i++){assert.ok(hit.waves[0].cells.includes(24+i));assert.ok(hit.waves[0].cells.includes(i*8+5));}assert.equal(hit.state.wallet.coins,30-POWERUP_COSTS.hammer);
});
test('shuffle preserves special types, ice, moves and goals without scoring free matches',()=>{
 const s=switchMode(start(),'ice',rng(7));s.board[0][0]=specialGem(0,'rainbow');s.board[1][1]=specialGem(2,'bomb');s.board[3][4]=specialGem(1,'row');
 const before=structuredClone(s),result=usePowerup(s,'shuffle',null,rng(22));assert.equal(result.valid,true);assert.equal(result.state.wallet.coins,15);assert.equal(result.state.moves,s.moves);assert.equal(result.state.score,s.score);assert.deepEqual(result.state.ice,s.ice);assert.deepEqual(result.state.goals,s.goals);
 assert.equal(findMatches(result.state.board).cells.length,0);assert.ok(legalMoves(result.state.board).length);assert.deepEqual(result.state.board.flat().map(specialKind).sort(),s.board.flat().map(specialKind).sort());assert.deepEqual(s,before);
});
test('failed-level retry preserves rewards and other modes but discards the failed attempt score',()=>{
 let s=switchMode(switchMode(start(),'ice',rng(1)),'classic');s={...s,level:2,score:800,levelScore:200,moves:0,goals:levelConfig(2).goals,wallet:{coins:45,stars:3,claimed:{classic:1,ice:0,endless:0}}};
 const retried=retryLevel(s,rng(8));assert.equal(retried.level,2);assert.equal(retried.levelScore,0);assert.equal(retried.score,600);assert.equal(retried.moves,levelConfig(2).moves);assert.deepEqual(retried.wallet,s.wallet);assert.deepEqual(retried.modeStates,s.modeStates);assert.equal(turnOutcome(retried),'continue');
 assert.deepEqual(usePowerup(s,'shuffle'),{valid:false,state:s});
});
test('invalid optional save data is sanitized without overwriting the valid board',()=>{
 const s=start();const migrated=migrateState({...s,wallet:{coins:-20,stars:NaN,claimed:{classic:'9'}},modeStates:{ice:{board:[]}}});assert.equal(migrated.wallet.coins,0);assert.equal(migrated.wallet.stars,0);assert.equal(migrated.wallet.claimed.classic,0);assert.deepEqual(migrated.modeStates,{});assert.deepEqual(migrated.board,s.board);
});
