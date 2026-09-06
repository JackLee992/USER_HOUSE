// Run only when the Android Via test surface is free:
// node tests/browser/android-match3-enhancements.mjs /absolute/evidence/dir
// Offline fixture validation (never connects to Android): --validate-fixtures
// Fixtures are stable input saves. Every tested move, tool, confirmation, pause,
// catalog return and resume uses actual touch input through the real runtime.
import assert from 'node:assert/strict';
import {writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {connectAndroid} from './android-cdp.mjs';
import {migrateState,switchMode,findMatches,legalMoves,specialGem,specialKind,swapBoard,resolveWave} from '../../src/games/match3.js';

const rng=seed=>()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
const latin=()=>Array.from({length:8},(_,r)=>Array.from({length:8},(_,c)=>(r+c)%6));
function fixture(kind='four',mode='endless'){
 const board=latin();let move,want;
 if(kind==='four'){board[0].splice(0,4,0,1,0,0);board[1][1]=0;move=[1,9];want='row';}
 else if(kind==='five'){board[0].splice(0,5,0,0,1,0,0);board[1][2]=0;move=[2,10];want='rainbow';}
 else if(kind==='L'){for(const i of [17,25,33,34,35])board[i>>3][i%8]=5;board[4][1]=1;board[5][1]=5;move=[33,41];want='bomb';}
 else if(kind==='T'){for(const i of [25,26,27,18,10])board[i>>3][i%8]=5;board[3][2]=1;board[4][2]=5;move=[26,34];want='bomb';}
 else throw Error('Unknown fixture '+kind);
 const state=switchMode(migrateState(null,rng(10)),mode,rng(20));state.board=board;
 assert.equal(findMatches(board).cells.length,0,kind+' fixture must not already contain matches');
 assert.ok(legalMoves(board).some(pair=>pair.join()===move.join()),kind+' fixture has the intended legal move');
 assert.ok(resolveWave(swapBoard(board,...move),{preferred:[move[1],move[0]]}).created.some(g=>specialKind(g.value)===want));
 return {state,move,want};
}
if(process.argv.includes('--validate-fixtures')){
 for(const kind of ['four','five','L','T'])fixture(kind);
 console.log('4 stable, legal touch fixtures validated without connecting to Android.');
 process.exit(0);
}
const dir=process.argv[2];if(!dir)throw Error('Pass an evidence output directory, or --validate-fixtures.');mkdirSync(dir,{recursive:true});
const c=await connectAndroid(),wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const log={game:'match3-enhancements',checks:[],fixtures:[],shots:[]};
const sdkAdb='/Users/jacklee/Library/Android/sdk/platform-tools/adb';
const adb=(...args)=>execFileSync(process.env.ADB||(existsSync(sdkAdb)?sdkAdb:'adb'),['-s',process.env.ANDROID_SERIAL||'emulator-5554',...args],{encoding:'utf8',timeout:15000,maxBuffer:8*1024*1024}).trim();
const read=()=>c.evaluate('wbTest.state()');
async function until(expression,timeout=8000){const end=Date.now()+timeout;while(Date.now()<end){if(await c.evaluate(expression))return;await wait(80);}throw Error('Timeout: '+expression);}
async function point(selector,scroll=true){return c.evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('Missing '+${JSON.stringify(selector)});if(e.disabled)throw Error('Disabled '+${JSON.stringify(selector)});if(${scroll})e.scrollIntoView({block:'nearest',inline:'nearest'});const r=e.getBoundingClientRect();if(!r.width||!r.height)throw Error('Hidden '+${JSON.stringify(selector)});return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);}
async function tap(selector,after=80){
 let p=await point(selector);
 // Runtime dialogs/catalog cards animate after they enter the DOM. Scroll first,
 // let that transition settle, then measure a fresh touch position. Board moves
 // and Pause deliberately skip this delay so an in-flight turn can be paused.
 if(selector==='#wb-progress-continue'||selector==='#wb-confirm-ok'||selector.startsWith('[data-game')){
  await wait(240);p=await point(selector,false);
 }
 await c.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...p,id:1}]});await wait(35);await c.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});if(after)await wait(after);
}
async function shot(name){const result=await c.send('Page.captureScreenshot',{format:'png'});const path=`${dir}/via-match3-${name}.png`;writeFileSync(path,Buffer.from(result.data,'base64'));log.shots.push(path);}
async function layout(name){const value=await c.evaluate(`(()=>{const board=document.querySelector('.m3-board').getBoundingClientRect(),shell=document.querySelector('.m3-game').getBoundingClientRect();return {viewport:{width:innerWidth,height:innerHeight},overflow:document.documentElement.scrollWidth>innerWidth,board:{x:board.x,y:board.y,width:board.width,height:board.height},shell:{x:shell.x,y:shell.y,width:shell.width,height:shell.height}}})()`);assert.equal(value.overflow,false,name+' has no horizontal overflow');assert.ok(value.board.width>=200,name+' board remains touchable');assert.ok(value.board.x>=0&&value.board.x+value.board.width<=value.viewport.width+1);log[name+'Layout']=value;}
async function mount(state,name){
 assert.equal(findMatches(state.board).cells.length,0,name+' save starts stable');
 await c.evaluate(`wbTest.stop();wbTest.start('match3',${JSON.stringify(state)},{forceNew:true})`);
 await until("wbTest.game().gameStarted && document.querySelectorAll('.m3-cell').length === 64");await wait(100);
 assert.deepEqual((await read()).board,state.board,name+' fixture is not silently regenerated');log.fixtures.push({name,mode:state.mode,moves:state.moves,level:state.level});
}
// Android displays an HTML select as a native dialog. Open it with browser touch,
// inspect the actual native option text, then tap its physical screen bounds.
async function chooseMode(mode){
 const labels={classic:'经典闯关',ice:'破冰挑战',endless:'无限休闲'};await tap('.m3-mode');
 let bounds=null;
 for(let attempt=0;attempt<5&&!bounds;attempt++){
  adb('shell','uiautomator','dump','/sdcard/wanban-match3-window.xml');const xml=adb('exec-out','cat','/sdcard/wanban-match3-window.xml');
  const node=(xml.match(/<node\b[^>]*>/g)||[]).find(item=>item.includes(`text="${labels[mode]}"`)||item.includes(`content-desc="${labels[mode]}"`));
  const match=node?.match(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/);if(match)bounds=match.slice(1).map(Number);else await wait(150);
 }
 if(!bounds)throw Error('Native select did not expose mode '+labels[mode]);
 adb('shell','input','tap',String(Math.round((bounds[0]+bounds[2])/2)),String(Math.round((bounds[1]+bounds[3])/2)));
 await until("!document.querySelector('.m3-confirm').hidden");
}
async function commitMode(mode){await chooseMode(mode);await tap('.m3-confirm-ok');await until(`wbTest.state().mode === ${JSON.stringify(mode)}`);}
async function move(pair,after=80){await tap(`.m3-cell[data-index="${pair[0]}"]`,30);await tap(`.m3-cell[data-index="${pair[1]}"]`,after);}
async function waitTurn(turn=1){await until(`wbTest.state().turnsUsed >= ${turn} && !document.querySelector('.m3-mode').disabled`,30000);}
async function returnAndContinue(label){
 const before=await read();await tap('#wb-back');await until("!!document.querySelector('[data-game=match3]')");await tap('[data-game="match3"]');
 await until("!!document.querySelector('#wb-progress-continue')");await tap('#wb-progress-continue');await until('wbTest.game().gameStarted',7000);const after=await read();
 for(const key of ['board','wallet','mode','moves','level','levelScore','modeStates','ice'])assert.deepEqual(after[key],before[key],label+' restores '+key);
 log.checks.push(label+' survives catalog return and real Continue countdown');return after;
}
try{
 await c.send('Page.navigate',{url:process.env.WB_TEST_URL||'http://127.0.0.1:8765/'});
 await until("typeof wbTest !== 'undefined'");await c.evaluate("document.querySelector('#testbar').style.display='none';testFrames.set(0);wbTest.prepare('match3')");await until("!!document.querySelector('.m3-mode')");
 log.env=await c.evaluate('({ua:navigator.userAgent,width:innerWidth,height:innerHeight,dpr:devicePixelRatio})');await layout('initial');await shot('modes-ready');
 const original=await read();await chooseMode('ice');assert.equal((await read()).mode,'classic');await tap('.m3-confirm-cancel');assert.deepEqual(await read(),original);log.checks.push('native mode selector requires confirmation; cancellation preserves the exact save');
 await commitMode('ice');assert.ok((await read()).ice.some(n=>n>0));await layout('ice');await shot('ice-mode');
 await commitMode('endless');assert.equal((await read()).moves,0);await move(legalMoves((await read()).board)[0]);await waitTurn();const endlessProgress=await read();assert.ok(endlessProgress.score>0);assert.equal(endlessProgress.moves,0);
 await commitMode('classic');assert.deepEqual((await read()).board,original.board);assert.equal((await read()).moves,original.moves);
 await commitMode('endless');assert.deepEqual((await read()).board,endlessProgress.board);assert.equal((await read()).turnsUsed,endlessProgress.turnsUsed);log.checks.push('all three modes switch through native touch and restore their own boards; endless accepts a zero-step move');
 await returnAndContinue('v3 endless with zero moves');

 for(const kind of ['four','five','L','T']){
  const f=fixture(kind);await mount(f.state,kind+' manufacture');
  await c.evaluate("window.m3ObservedKinds=[];window.m3Observer?.disconnect();window.m3Observer=new MutationObserver(()=>{for(const b of document.querySelectorAll('.m3-cell'))if(b.dataset.special!=='normal'&&!m3ObservedKinds.includes(b.dataset.special))m3ObservedKinds.push(b.dataset.special)});m3Observer.observe(document.querySelector('.m3-board'),{subtree:true,childList:true,attributes:true})");
  await move(f.move);await until(`m3ObservedKinds.includes(${JSON.stringify(f.want)})`,20000);await shot('manufacture-'+kind.toLowerCase());await waitTurn();
  assert.ok((await read()).score>0);log.checks.push(kind+' is manufactured by a real adjacent two-touch exchange ('+f.want+')');await c.evaluate('m3Observer.disconnect()');
 }

 const ice=fixture('four','ice').state;ice.board=latin();ice.board[0][0]=specialGem(0,'rainbow');ice.ice=Array(64).fill(0);ice.ice[7]=2;ice.wallet.coins=80;
 await mount(ice,'fixed double ice and paid tools');await tap('.m3-hammer');await tap('.m3-hammer');assert.equal((await read()).wallet.coins,80);
 await tap('.m3-hammer');await tap('.m3-cell[data-index="7"]');await until('wbTest.state().toolsUsed === 1',12000);let hit=await read();assert.equal(hit.ice[7],1);assert.equal(hit.wallet.coins,60);assert.equal(hit.moves,28);await shot('hammer-ice');
 await tap('.m3-hammer');await tap('.m3-cell[data-index="7"]');await until('wbTest.state().toolsUsed === 2',12000);hit=await read();assert.equal(hit.ice[7],0);assert.equal(hit.wallet.coins,40);log.checks.push('hammer targeting can cancel for free; two real hammer taps remove two fixed ice layers and spend 40 coins without moves');
 const beforeShuffle=await read();await tap('.m3-shuffle');await tap('.m3-confirm-cancel');assert.deepEqual(await read(),beforeShuffle);
 await tap('.m3-shuffle');await tap('.m3-confirm-ok');const shuffled=await read();assert.equal(shuffled.wallet.coins,25);assert.equal(shuffled.moves,beforeShuffle.moves);assert.deepEqual(shuffled.ice,beforeShuffle.ice);assert.equal(shuffled.score,beforeShuffle.score);assert.deepEqual(shuffled.board.flat().map(specialKind).sort(),beforeShuffle.board.flat().map(specialKind).sort());assert.equal(findMatches(shuffled.board).cells.length,0);assert.ok(legalMoves(shuffled.board).length);log.checks.push('confirmed shuffle spends 15 once, retaining special inventory, score, ice and moves');

 const reward=fixture('four','classic');reward.state.levelScore=590;reward.state.score=590;reward.state.moves=12;reward.state.wallet.coins=40;await mount(reward.state,'one touch exchange before finite reward');await move(reward.move);await until('wbTest.state().level === 2',30000);const paid=await read();assert.equal(paid.wallet.coins,90);assert.equal(paid.wallet.stars,3);assert.equal(paid.wallet.claimed.classic,1);assert.match(await c.evaluate("document.querySelector('.m3-wallet').textContent"),/90/);await shot('earned-reward');await returnAndContinue('finite completed level and wallet');assert.equal((await read()).wallet.coins,90);log.checks.push('a real scoring exchange earns visible 3 stars and 50 coins; Continue does not reissue the reward');
 const milestone=fixture('four');milestone.state.levelScore=990;milestone.state.score=990;await mount(milestone.state,'one touch exchange before endless reward');await move(milestone.move);await waitTurn();const miles=await read();assert.ok(miles.level>=2);assert.equal(miles.wallet.coins,30+(miles.level-1)*20);assert.equal(miles.wallet.stars,miles.level-1);await returnAndContinue('endless awarded milestone and zero moves');log.checks.push('endless milestones award coins from an actual move, persist at zero moves and do not duplicate');

 const paused=fixture('five');await mount(paused.state,'pause in a pending special exchange');await move(paused.move,10);assert.equal((await read()).turnsUsed,0);assert.equal(await c.evaluate("document.querySelector('.m3-mode').disabled"),true);await tap('#wb-pause',10);await until('wbTest.game().gamePaused');
 const frozen=await read(),transforms=await c.evaluate("[...document.querySelectorAll('.m3-cell > .m3-gem')].map(e=>e.getAttribute('style'))");await wait(450);assert.deepEqual(await read(),frozen);assert.deepEqual(await c.evaluate("[...document.querySelectorAll('.m3-cell > .m3-gem')].map(e=>e.getAttribute('style'))"),transforms);await shot('pending-special-paused');
 await tap('#wb-pause');await until('!wbTest.game().gamePaused',7000);await waitTurn();log.checks.push('real pause freezes a still-pending special exchange and its rendered transforms; countdown resumes that turn');

 let failed=fixture('four','classic').state;failed=switchMode(switchMode(failed,'ice',rng(33)),'classic');failed.moves=0;failed.wallet.coins=65;failed.wallet.stars=3;failed.score=100;failed.levelScore=100;
 await mount(failed,'failed finite level with other mode progress');assert.equal(await c.evaluate("document.querySelector('.m3-retry').hidden"),false);await returnAndContinue('failed finite v3 level with wallet and another mode');assert.equal((await read()).wallet.coins,65);assert.ok((await read()).modeStates.ice);await shot('failed-level-restored');
 await tap('.m3-retry');await tap('.m3-confirm-ok');assert.equal((await read()).moves,28);assert.equal((await read()).wallet.coins,65);log.checks.push('failed finite level remains resumable and a confirmed retry preserves its wallet and other mode');
 const beforeEnd=await read();await tap('.m3-end');await tap('.m3-confirm-cancel');assert.deepEqual(await read(),beforeEnd);assert.equal(await c.evaluate("!!document.querySelector('#wb-gameover-mask')"),false);
 await tap('.m3-end');await tap('.m3-confirm-ok');await until("!!document.querySelector('#wb-gameover-mask') && !wbTest.game().gameStarted");await shot('confirmed-end');log.checks.push('End cancellation retains the game; confirmed End opens the real runtime score result');
 log.errors=await c.evaluate('testErrors');assert.deepEqual(log.errors,[]);log.passed=true;
}catch(error){log.passed=false;log.error=error.stack;try{await shot('enhancements-failure');log.failureView=await c.evaluate("({game:wbTest.game(),dialogs:[...document.querySelectorAll('.wb-modal,.m3-dialog')].map(el=>el.textContent)})");}catch{}process.exitCode=1;}
finally{try{await c.evaluate('window.m3Observer?.disconnect()');}catch{}writeFileSync(`${dir}/via-match3-enhancements-checks.json`,JSON.stringify(log,null,2));console.log(JSON.stringify({passed:log.passed,checks:log.checks,error:log.error},null,2));c.close();}
