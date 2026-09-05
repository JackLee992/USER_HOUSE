import test from 'node:test';
import assert from 'node:assert/strict';
import {newPinball,restorePinball,advancePinball,launchPinball,createPinballGame} from '../src/games/pinball.js';
test('restore validates finite physical state and independent copy',()=>{const s=newPinball();s.ball.x=NaN;assert.equal(restorePinball(s).ball.x,390);const a=newPinball(),b=restorePinball(a);b.ball.x=10;assert.equal(a.ball.x,390);});
test('minimum plunger charge reliably exits lane',()=>{const s=newPinball();launchPinball(s,0);for(let i=0;i<150;i++)advancePinball(s,1/120,{});assert.equal(s.lane,false);assert.ok(s.ball.x<370);});
test('fixed timestep is stable at 10 and 120 FPS',()=>{const a=newPinball(),b=newPinball();launchPinball(a,.8);launchPinball(b,.8);for(let i=0;i<30;i++)advancePinball(a,.1,{});for(let i=0;i<360;i++)advancePinball(b,1/120,{});assert.ok(Math.abs(a.ball.x-b.ball.x)<.01);assert.ok(Math.abs(a.ball.y-b.ball.y)<.01);assert.equal(a.score,b.score);});
test('bumper collision rebounds and scores once',()=>{const s=newPinball();s.phase='play';s.lane=false;s.ball={x:140,y:185,vx:0,vy:600};advancePinball(s,.04,{});assert.ok(s.ball.vy<0);assert.equal(s.score,100);});
test('fast ball cannot tunnel through rail',()=>{const s=newPinball();s.phase='play';s.lane=false;s.ball={x:340,y:320,vx:1100,vy:0};advancePinball(s,.05,{});assert.ok(s.ball.x<370);assert.ok(s.ball.vx<0);});
test('raised flipper sends descending ball upwards',()=>{const s=newPinball();s.phase='play';s.lane=false;s.ball={x:160,y:520,vx:0,vy:200};advancePinball(s,.08,{left:true});assert.ok(s.ball.vy<-250);});
test('three drains finish exactly once with no negative lives',()=>{const s=newPinball();for(let i=0;i<3;i++){s.phase='play';s.lane=false;s.ball={x:200,y:700,vx:0,vy:100};advancePinball(s,.02,{});assert.equal(s.lives,2-i);}assert.equal(s.phase,'over');advancePinball(s,1,{});assert.equal(s.lives,0);});
test('target contact awards target score and pause-sized gaps stay bounded',()=>{const s=newPinball();s.phase='play';s.lane=false;s.ball={x:205,y:145,vx:0,vy:-600};advancePinball(s,.025);assert.equal(s.score,250);const before=s.ball.y;advancePinball(s,NaN);assert.equal(s.ball.y,before);advancePinball(s,60);assert.ok(Number.isFinite(s.ball.y));});
test('returning into plunger lane serves again without losing a ball',()=>{const s=newPinball();s.phase='play';s.ball={x:390,y:621,vx:0,vy:100};advancePinball(s,.01);assert.equal(s.phase,'ready');assert.equal(s.lives,3);assert.ok(launchPinball(s));});

test('unpowered central ball passes between resting flippers and drains',()=>{const s=newPinball();s.phase='play';s.lane=false;s.ball={x:200,y:530,vx:0,vy:100};for(let i=0;i<100;i++)advancePinball(s,.1,{});assert.equal(s.lives,2);assert.equal(s.phase,'ready');});
test('natural launches without flipper input eventually drain at every charge',()=>{for(const charge of [0,.2,.5,1]){const s=newPinball();launchPinball(s,charge);for(let i=0;i<1800&&s.phase==='play';i++)advancePinball(s,.1,{});assert.equal(s.lives,2,`charge ${charge} must drain naturally`);assert.equal(s.phase,'ready');}});
function fixture(){
 const ctx=new Proxy({}, {get:(o,k)=>k in o?o[k]:(k==='createLinearGradient'||k==='createRadialGradient')?()=>({addColorStop(){}}):()=>{},set:(o,k,v)=>(o[k]=v,true)});
 const element=()=>Object.assign(new EventTarget(),{classList:{add(){},remove(){}}});
 const canvas=Object.assign(element(),{getContext:()=>ctx}),score=element(),lives=element();
 const buttons=['left','launch','right'].map(action=>Object.assign(element(),{dataset:{action}}));
 const root={querySelector:s=>s==='canvas'?canvas:s==='.pb-score'?score:s==='.pb-lives'?lives:buttons[1],querySelectorAll:s=>s==='[data-action]'?buttons:[]};
 const doc=Object.assign(new EventTarget(),{hidden:false,getElementById:()=>true});let next,requests=0,cancelled=0,saves=0,clears=0,finishes=0;
 const win=Object.assign(new EventTarget(),{requestAnimationFrame:fn=>(next=fn,++requests),cancelAnimationFrame:()=>cancelled++});
 const env={root,document:doc,window:win,save:()=>saves++,clear:()=>clears++,setScore(){},finish:()=>finishes++,speak(){},isPaused:()=>false,isActive:()=>true};
 return {env,frame:t=>next(t),counts:()=>({saves,clears,finishes,cancelled})};
}
test('settlement cannot be resurrected by controller save and destroy',()=>{const f=fixture(),s=newPinball();s.lives=1;s.phase='play';s.lane=false;s.ball={x:200,y:694,vx:0,vy:100};const game=createPinballGame(f.env,s);f.frame(0);f.frame(100);assert.equal(f.counts().finishes,1);assert.equal(f.counts().clears,1);const saves=f.counts().saves;game.save();game.destroy();game.save();assert.equal(f.counts().saves,saves);assert.equal(f.counts().cancelled,1);});
test('destroyed active controller no longer writes saved state',()=>{const f=fixture(),game=createPinballGame(f.env);game.save();assert.equal(f.counts().saves,1);game.destroy();game.save();assert.equal(f.counts().saves,1);});
