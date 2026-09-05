// Real touch + ADB screenshots on the user-authorized Android Via emulator.
import {writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {connectAndroid} from './android-cdp.mjs';
const dir=process.argv[2], adb=process.env.ANDROID_ADB || '/Users/jacklee/Library/Android/sdk/platform-tools/adb';
const c=await connectAndroid(),wait=ms=>new Promise(r=>setTimeout(r,ms)),log={game:'space-cadet',checks:[]};
const read=()=>c.evaluate('wbTest.state()');
async function until(expr,timeout=10000){const end=Date.now()+timeout;while(Date.now()<end){if(await c.evaluate(expr))return;await wait(100);}throw Error('Timeout '+expr);}
async function point(selector){return c.evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('Missing '+${JSON.stringify(selector)});e.scrollIntoView({block:'nearest',inline:'nearest'});const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);}
async function down(points){await c.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:points.map((p,i)=>({...p,id:i+1}))});}
async function up(){await c.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await wait(160);}
async function tap(s){await point(s);await wait(200);await down([await point(s)]);await up();}
function shot(name){writeFileSync(`${dir}/via-cadet-${name}.png`,execFileSync(adb,['-s','emulator-5554','exec-out','screencap','-p'],{maxBuffer:16*1024*1024}));}
try{
 await c.send('Page.navigate',{url:'http://127.0.0.1:8765/'});await until("typeof wbTest !== 'undefined'");
 await c.evaluate("document.querySelector('#testbar').style.display='none';wbTest.prepare('pinball')");
 await until('wbTest.state()?.ready && wbTest.state().balls.some(b=>b.active)');
 log.env=await c.evaluate('({ua:navigator.userAgent,width:innerWidth,height:innerHeight,dpr:devicePixelRatio})');
 let s=await read();assert.equal(s.components,343);assert.equal(s.renderer,'software');assert.equal(s.lives,3);
 log.layout=await c.evaluate("(()=>{const r=document.querySelector('.wb-cadet-frame').getBoundingClientRect();return {rect:r.toJSON(),overflow:document.documentElement.scrollWidth>innerWidth}})()");
 assert.equal(log.layout.overflow,false);assert.ok(log.layout.rect.bottom<log.env.height);
 const pixels=await c.evaluate("(()=>{const v=document.querySelector('.wb-cadet-frame').contentDocument.querySelector('canvas');return [...v.getContext('2d').getImageData(100,100,10,10).data]})()");
 assert.ok(new Set(pixels).size>15);log.checks.push('complete 343-component table visibly renders and fits Android viewport');shot('ready-device');
 await down([await point('[data-action=launch]')]);await wait(2850);s=await read();assert.ok(s.plungerBoost>=75);assert.match(await c.evaluate("document.querySelector('[data-action=launch]').textContent"),/蓄力 \d+%/);log.charge=s.plungerBoost;await up();await wait(550);s=await read();assert.ok(s.balls.some(b=>b.active&&b.speed>1));log.checks.push('real long-press plunger charges, release fires a moving ball');shot('in-play-device');
 await down([await point('[data-action=left]'),await point('[data-action=right]')]);await wait(220);s=await read();assert.ok(s.inputs[0]&&s.inputs[1]);assert.ok(Math.abs(s.left)>1&&Math.abs(s.right)>1);log.flippers={left:s.left,right:s.right};shot('flippers-device');await up();
 s=await read();assert.ok(!s.inputs[0]&&!s.inputs[1]);log.checks.push('two-finger flippers move simultaneously and release cleanly');
 await tap('.cd-sound');assert.equal(await c.evaluate("document.querySelector('.cd-sound').textContent"),'音效 关');
 await tap('#wb-pause');await until('wbTest.state().paused');const paused=await read();await wait(550);assert.deepEqual(await read(),paused);shot('paused-device');log.checks.push('pause freezes elapsed time, ball, score and engine ticks');
 await tap('#wb-back');const frozen=await c.evaluate("document.querySelector('.wb-cadet-frame').contentWindow.cadetHost.snapshot()");await wait(450);assert.deepEqual(await c.evaluate("document.querySelector('.wb-cadet-frame').contentWindow.cadetHost.snapshot()"),frozen);assert.equal(await c.evaluate("getComputedStyle(document.querySelector('.wb-cadet-frame')).visibility"),'hidden');
 await tap('[data-game=pinball]');await until("!!document.querySelector('#wb-progress-continue')");await tap('#wb-progress-continue');await until('wbTest.game().gameStarted && wbTest.state()?.ready');s=await read();assert.equal(s.sessionId,paused.sessionId);assert.equal(s.score,paused.score);assert.equal(await c.evaluate("document.querySelector('.cd-sound').textContent"),'音效 关');log.checks.push('lobby pauses retained engine; Continue reuses same live session and sound preference');
 await until('!wbTest.state().paused');const running=await read();await wait(200);assert.ok((await read()).ticks>running.ticks);
 execFileSync(adb,['-s','emulator-5554','shell','input','keyevent','KEYCODE_HOME']);await wait(500);const bg=await read();assert.equal(bg.paused,true);await wait(650);assert.deepEqual(await read(),bg);
 execFileSync(adb,['-s','emulator-5554','shell','am','start','-n','mark.via.gp/mark.via.Shell']);await until('!document.hidden');assert.equal((await read()).paused,true);await tap('#wb-pause');await until('!wbTest.state().paused');log.checks.push('actual Android Home freezes game; Via returns paused and Continue resumes');
 await tap('#wb-pause');await until('wbTest.state().paused');const checkpoint=await read();await c.evaluate('wbTest.save()');
 await c.send('Page.navigate',{url:'http://127.0.0.1:8765/'});await until("typeof wbTest !== 'undefined'");await c.evaluate("document.querySelector('#testbar').style.display='none';wbTest.select('pinball')");await until("!!document.querySelector('#wb-progress-continue')");await tap('#wb-progress-continue');await until('wbTest.state()?.ready');s=await read();assert.notEqual(s.sessionId,checkpoint.sessionId);assert.equal(s.score,checkpoint.score);assert.equal(s.lives,checkpoint.lives);assert.equal(s.rank,checkpoint.rank);log.checks.push('page refresh restores earned checkpoint into a new-ball session');
 await tap('#wb-restart');await tap('#wb-confirm-ok');await until("!!document.querySelector('#wb-start-cover-btn')");assert.equal(await c.evaluate("!!document.querySelector('#wb-progress-continue')"),false);await tap('#wb-start-cover-btn');await until('wbTest.state()?.ready');s=await read();assert.equal(s.score,0);assert.equal(s.lives,3);assert.notEqual(s.sessionId,checkpoint.sessionId);log.checks.push('confirmed restart starts fresh three-ball game');
 log.final=s;log.errors=await c.evaluate('testErrors');assert.deepEqual(log.errors,[]);assert.equal(await c.evaluate("document.body.textContent.includes('球台加载失败')"),false);log.passed=true;shot('final-device');await tap('#wb-back');
}catch(e){log.passed=false;log.error=e.stack;try{shot('failure-device');}catch{}process.exitCode=1;}finally{writeFileSync(`${dir}/via-cadet-checks.json`,JSON.stringify(log,null,2));console.log(JSON.stringify(log,null,2));c.close();}
