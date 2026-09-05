import {writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {connectAndroid} from './android-cdp.mjs';

const dir=process.argv[2], c=await connectAndroid();
const log={game:'paopao',checks:[]},wait=ms=>new Promise(r=>setTimeout(r,ms));
const adb=(...args)=>execFileSync(process.env.ADB || 'adb',['-s','emulator-5554',...args],{encoding:'utf8'}).trim();
async function until(expr,ms=6000){const end=Date.now()+ms;while(Date.now()<end){if(await c.evaluate(expr))return;await wait(100);}throw Error('Timeout '+expr);}
async function tap(selector,fx=.5,fy=.5){
 const p=await c.evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});e.scrollIntoView({block:'nearest'});const r=e.getBoundingClientRect();return {x:r.x+r.width*${fx},y:r.y+r.height*${fy}}})()`);
 await c.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[p]});await wait(60);await c.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await wait(150);
}
const dynamics=()=>c.evaluate('(()=>{const s=paopaoTest.snapshot();delete s.lastT;return s})()');
async function shot(name){const r=await c.send('Page.captureScreenshot',{format:'png'});writeFileSync(`${dir}/via-paopao-${name}.png`,Buffer.from(r.data,'base64'));}
try{
 await c.send('Page.navigate',{url:'http://127.0.0.1:8765/'});await until("typeof wbTest !== 'undefined'");
 await c.evaluate("document.querySelector('#testbar').style.display='none';testFrames.set(10);wbTest.prepare('paopao')");await wait(300);
 log.env=await c.evaluate('({ua:navigator.userAgent,width:innerWidth,height:innerHeight,dpr:devicePixelRatio})');
 await shot('ready');
 await tap('#wb-paopao-canvas',.5,.35);await until('paopaoTest.snapshot().shots > 0');
 log.checks.push('real touch shot resolves with requested 10 fps cap');
 await tap('#wb-pause');await until('wbTest.game().gamePaused');const frozen=await dynamics();await wait(450);assert.deepEqual(await dynamics(),frozen);log.checks.push('pause freezes all bubble motion');
 await tap('#wb-pause');await until('!wbTest.game().gamePaused');log.checks.push('resume countdown returns to play');
 // A deterministic falling fixture allows visibility suspension to be compared exactly.
 await c.evaluate("window.visibilitySamples=[];document.addEventListener('visibilitychange',()=>{const s=paopaoTest.snapshot();delete s.lastT;visibilitySamples.push({hidden:document.hidden,state:s})});paopaoTest.setup()");
 const activity=adb('shell','cmd','package','resolve-activity','--brief','mark.via.gp').split('\n').at(-1);
 adb('shell','input','keyevent','KEYCODE_HOME');await wait(1500);
 assert.equal(await c.evaluate('document.hidden'),true);
 const hidden=await dynamics();await wait(500);assert.deepEqual(await dynamics(),hidden);
 adb('shell','am','start','-n',activity);await until('!document.hidden');
 const visibility=await c.evaluate('visibilitySamples');
 assert.ok(visibility.some(v=>v.hidden)&&visibility.some(v=>!v.hidden));
 assert.deepEqual(visibility.find(v=>!v.hidden).state,visibility.find(v=>v.hidden).state);
 log.checks.push('Android Home/background freezes motion and foreground does not fast-forward');log.visibility=visibility;
 await tap('#wb-restart');await tap('#wb-confirm-ok');await until("!!document.querySelector('#wb-start-cover-btn')");
 assert.equal(await c.evaluate("!!document.querySelector('#wb-progress-continue')"),false);
 await tap('#wb-start-cover-btn');await until('wbTest.game().gameStarted');assert.equal((await dynamics()).shots,0);log.checks.push('confirmed restart starts a fresh board');
 await shot('restarted');await tap('#wb-back');await wait(350);
 log.pendingFrames=await c.evaluate('testFrames.pending()');assert.equal(log.pendingFrames,0);log.checks.push('exit cancels pending animation loop');
 log.errors=await c.evaluate('testErrors');assert.deepEqual(log.errors,[]);log.passed=true;
}catch(e){log.passed=false;log.error=e.stack;try{await shot('failure');}catch{}process.exitCode=1;}
finally{writeFileSync(`${dir}/via-paopao-checks.json`,JSON.stringify(log,null,2));console.log(JSON.stringify({passed:log.passed,checks:log.checks,error:log.error},null,2));c.close();}
