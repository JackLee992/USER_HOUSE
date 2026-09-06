// Presentation regression in the authorized Via emulator; native physics is read-only.
import {writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {connectAndroid} from './android-cdp.mjs';
const dir=process.argv[2],c=await connectAndroid(),wait=ms=>new Promise(r=>setTimeout(r,ms));
const log={checks:[]},api="document.querySelector('.wb-cadet-frame').contentWindow.cadetHost";
const display=()=>c.evaluate(`${api}.displayInspection()`),state=()=>c.evaluate('wbTest.state()');
async function until(expr){for(let n=0;n<120;n++){if(await c.evaluate(expr))return;await wait(100);}throw Error('Timeout: '+expr);}
async function tap(selector){const p=await c.evaluate(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);await c.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...p,id:1}]});await c.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await wait(200);}
function shot(name){writeFileSync(`${dir}/via-cadet-${name}.png`,execFileSync('/Users/jacklee/Library/Android/sdk/platform-tools/adb',['-s','emulator-5554','exec-out','screencap','-p'],{maxBuffer:16*1024*1024}));}
try{
 await c.send('Page.navigate',{url:'http://127.0.0.1:8765/'});await until("typeof wbTest!=='undefined'");await c.evaluate("document.querySelector('#testbar').hidden=true;document.querySelector('#testbar').style.display='none';wbTest.prepare('pinball')");
 await until(`${api}?.displayInspection()?.mode==='hd' && wbTest.state()?.ready`);await wait(900);
 log.normal=await display();assert.equal(log.normal.sourceWidth,1105);assert.equal(log.normal.engineWidth,365);assert.ok(log.normal.cssWidth>=375);assert.ok(log.normal.width>950);shot('hd-normal');
 log.checks.push('HD artwork remains 1105px source and >950 device pixels on normal phone view');
 const before=await state();await tap('.cd-expand');await wait(250);log.expanded=await display();assert.ok(log.expanded.cssWidth>log.normal.cssWidth);assert.ok(log.expanded.cssWidth>=400);assert.equal((await state()).sessionId,before.sessionId);
 assert.equal(await c.evaluate("document.documentElement.scrollWidth>innerWidth"),false);assert.equal(await c.evaluate("(()=>{const r=document.querySelector('.cd-tools').getBoundingClientRect();return r.bottom<=innerHeight+1})()"),true);shot('hd-expanded');
 log.checks.push('expanded view enlarges whole table, keeps controls inside screen and preserves live game');
 await tap('#wb-pause');await until('wbTest.state().paused');const paused=await state();await tap('.cd-quality');assert.equal((await display()).mode,'classic');await tap('.cd-expand');await wait(400);assert.deepEqual(await state(),paused);shot('classic');
 await tap('.cd-quality');assert.equal((await display()).mode,'hd');assert.deepEqual(await state(),paused);log.checks.push('HD/classic and expanded/normal can switch while paused without advancing native physics');
 await tap('#wb-pause');await until('!wbTest.state().paused');
 const first=await state(),t=Date.now();let samples=[];for(let n=0;n<20;n++){await wait(150);samples.push((await display()).composeMs);}const last=await state();const elapsed=Date.now()-t;log.performance={wallMs:elapsed,nativeMs:last.elapsedMs-first.elapsedMs,composeMs:samples};assert.ok(log.performance.nativeMs/elapsed>0.8);assert.ok(log.performance.nativeMs/elapsed<1.2);log.checks.push('HD display retains real-time native simulation on Via');
 await tap('.cd-expand');await tap('#wb-back');assert.equal(await c.evaluate("document.querySelector('#wanbanXiaowu-popup').classList.contains('wb-cadet-expanded')"),false);assert.equal(await c.evaluate("getComputedStyle(document.querySelector('.wb-cadet-frame')).visibility"),'hidden');log.checks.push('return to lobby clears expanded layout and hides paused engine');
 log.errors=await c.evaluate('testErrors');assert.deepEqual(log.errors,[]);log.passed=true;
}catch(error){log.passed=false;log.error=error.stack;shot('display-failure');process.exitCode=1;}finally{writeFileSync(`${dir}/via-cadet-display.json`,JSON.stringify(log,null,2));console.log(JSON.stringify(log,null,2));c.close();}
