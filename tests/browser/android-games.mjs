import {writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {connectAndroid} from './android-cdp.mjs';
import {legalMoves} from '../../src/games/match3.js';
const game=process.argv[2],dir=process.argv[3];
const c=await connectAndroid(),wait=ms=>new Promise(r=>setTimeout(r,ms)),log={game,checks:[]};
const read=()=>c.evaluate('wbTest.state()');
async function point(selector){return c.evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('Missing '+${JSON.stringify(selector)});e.scrollIntoView({block:'nearest',inline:'nearest'});const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);}
async function touch(p,type='tap',ms=0){await c.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:p.x,y:p.y}]});if(ms)await wait(ms);await c.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await wait(120);}
async function tap(s){await touch(await point(s));}
async function shot(name){const r=await c.send('Page.captureScreenshot',{format:'png'});writeFileSync(`${dir}/via-${game}-${name}.png`,Buffer.from(r.data,'base64'));}
async function until(expr,timeout=5000){const end=Date.now()+timeout;while(Date.now()<end){if(await c.evaluate(expr))return;await wait(100);}throw Error('Timeout '+expr);}
try{
 await c.send('Page.navigate',{url:'http://127.0.0.1:8765/'});await wait(700);await until("typeof wbTest !== 'undefined'");
 await c.evaluate(`document.querySelector('#testbar').style.display='none';wbTest.prepare(${JSON.stringify(game)})`);await wait(250);
 log.env=await c.evaluate('({ua:navigator.userAgent,width:innerWidth,height:innerHeight,dpr:devicePixelRatio})');
 log.layout=await c.evaluate(`(()=>{const root=document.querySelector('#wb-gamebox');const r=root.getBoundingClientRect();return {gamebox:{x:r.x,y:r.y,width:r.width,height:r.height},overflow:document.documentElement.scrollWidth>innerWidth,buttons:[...root.querySelectorAll('button')].map(e=>{const a=e.getBoundingClientRect();return {label:e.getAttribute('aria-label')||e.textContent,x:a.x,y:a.y,width:a.width,height:a.height}})}})()`);
 assert.equal(log.layout.overflow,false);await shot('ready');
 if(game==='freecell'){
  const before=await read();await tap('.fc-pile[data-index="0"] .fc-card:last-child');await tap('.fc-slot[data-type="freecell"][data-index="0"]');
  let after=await read();assert.equal(after.moves,1);assert.equal(after.freecells[0],before.columns[0].at(-1));log.checks.push('touch move into freecell');
  const undo=await c.evaluate("[...document.querySelectorAll('.fc-tools button')].find(e=>e.textContent.includes('撤销'))?.outerHTML");
  await tap('.fc-tools [data-action="undo"]');after=await read();assert.equal(after.moves,0);log.checks.push('undo restores deal');
  await tap('.fc-pile[data-index="0"] .fc-card:last-child');await tap('.fc-slot[data-type="freecell"][data-index="0"]');
 }else if(game==='match3'){
  const before=await read();const [a,b]=legalMoves(before.board)[0];await tap(`.m3-cell[data-index="${a}"]`);await tap(`.m3-cell[data-index="${b}"]`);
  await until('wbTest.state().moves < 28',12000);const after=await read();assert.equal(after.moves,27);assert.ok(after.score>0);log.checks.push('touch match consumes one move and scores');
 }else if(game==='pinball'){
  await touch(await point('[data-action="launch"]'),'hold',450);await until("wbTest.state().phase === 'play'");log.checks.push('touch hold/release launches');
  const p1=await point('[data-action="left"]'),p2=await point('[data-action="right"]');
  await c.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...p1,id:1},{...p2,id:2}]});await wait(220);const held=await read();assert.ok(held.left>.5&&held.right>.5);await shot('flippers');
  await c.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});log.checks.push('two-finger flippers simultaneously lift');
 }
 await tap('#wb-pause');await until('wbTest.game().gamePaused');const paused=await read();await wait(350);assert.deepEqual(await read(),paused);log.checks.push('pause freezes state');await shot('paused');
 await tap('#wb-pause');await until('!wbTest.game().gamePaused',5000);log.checks.push('resume countdown works');
 await tap('#wb-pause');await until('wbTest.game().gamePaused');const saved=await read();await tap('#wb-back');await tap(`[data-game="${game}"]`);await until("!!document.querySelector('#wb-progress-continue')");await tap('#wb-progress-continue');await until('wbTest.game().gameStarted',5000);
 const restored=await read();
 if(game==='pinball'){assert.equal(restored.score,saved.score);assert.equal(restored.lives,saved.lives);}else{assert.deepEqual(restored.board||restored.columns,saved.board||saved.columns);assert.equal(restored.moves,saved.moves);}
 log.checks.push('lobby reentry restores saved progress');await shot('restored');
 await tap('#wb-restart');await tap('#wb-confirm-ok');await until("!!document.querySelector('#wb-start-cover-btn')");
 assert.equal(await c.evaluate("!!document.querySelector('#wb-progress-continue')"),false);
 await tap('#wb-start-cover-btn');await until('wbTest.game().gameStarted');const fresh=await read();
 if(game==='freecell')assert.equal(fresh.moves,0);
 if(game==='match3'){assert.equal(fresh.moves,28);assert.equal(fresh.score,0);}
 if(game==='pinball'){assert.equal(fresh.lives,3);assert.equal(fresh.score,0);}
 log.checks.push('confirmed restart discards old progress');
 await tap('#wb-back');assert.equal(await c.evaluate("!!document.querySelector('[data-game]')"),true);log.checks.push('back exits to catalog');log.errors=await c.evaluate('testErrors');assert.deepEqual(log.errors,[]);log.passed=true;
}catch(e){log.passed=false;log.error=e.stack;try{await shot('failure');}catch{}process.exitCode=1;}finally{writeFileSync(`${dir}/via-${game}-checks.json`,JSON.stringify(log,null,2));console.log(JSON.stringify({game,passed:log.passed,checks:log.checks,error:log.error},null,2));c.close();}
