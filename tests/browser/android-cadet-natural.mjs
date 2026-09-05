// Natural three-ball play: real Via touch input only; no engine state writes.
import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {connectAndroid} from './android-cdp.mjs';
const c=await connectAndroid(),dir=process.argv[2],wait=ms=>new Promise(r=>setTimeout(r,ms));
const report={checks:[],samples:[]};
try {
 await c.evaluate("wbTest.prepare('pinball')");
 const start=Date.now();let lastLaunch=0,lastLives=4;
 while(Date.now()-start<180000){
  const s=await c.evaluate("document.querySelector('.wb-cadet-frame')?.contentWindow.cadetHost?.snapshot()");
  if(!s?.ready){await wait(200);continue;}
  if(s.lives!==lastLives){lastLives=s.lives;report.samples.push(s);console.log(JSON.stringify({score:s.score,lives:s.lives,time:s.elapsedMs}));}
  if(s.gameover){report.final=s;break;}
  const b=s.balls.find(b=>b.active);
  if(b&&Math.abs(b.x+7.03562)<.12&&Math.abs(b.y-11.675)<.2&&Date.now()-lastLaunch>4000){
   const p=await c.evaluate("(()=>{const r=document.querySelector('[data-action=launch]').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()");
   await c.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...p,id:1}]});await wait(3150);await c.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});lastLaunch=Date.now();
  }
  await wait(300);
 }
 assert.ok(report.final?.gameover,'game ended through natural drains');assert.equal(report.final.lives,0);assert.ok(report.final.score>0);assert.deepEqual(report.samples.map(s=>s.lives),[3,2,1,0]);
 await wait(400);report.page=await c.evaluate('document.body.innerText.slice(-1600)');assert.match(report.page,/弹球结束/);report.errors=await c.evaluate('testErrors');assert.deepEqual(report.errors,[]);report.passed=true;
 writeFileSync(`${dir}/via-cadet-natural-end.png`,execFileSync('/Users/jacklee/Library/Android/sdk/platform-tools/adb',['-s','emulator-5554','exec-out','screencap','-p'],{maxBuffer:16*1024*1024}));
}catch(e){report.passed=false;report.error=e.stack;process.exitCode=1;}finally{writeFileSync(`${dir}/via-cadet-natural.json`,JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,final:report.final,error:report.error}));c.close();}
