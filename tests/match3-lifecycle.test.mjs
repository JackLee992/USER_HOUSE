import test from 'node:test';
import assert from 'node:assert/strict';
import {createMatch3Game,specialGem} from '../src/games/match3.js';
function harness(savedState){
 class Element {
  constructor(){this.children=[];this.nodes=new Map();this.listeners=new Map();this.style={};this.dataset={};this.classList={remove(){},add(){}};this.attributes={};this.firstElementChild={style:{}};}
  set innerHTML(v){this.html=v;this.firstElementChild={style:{}};}get innerHTML(){return this.html;}
  setAttribute(k,v){this.attributes[k]=v;}append(...els){this.children.push(...els);}replaceChildren(...els){this.children=els;}
  querySelector(key){if(!this.nodes.has(key))this.nodes.set(key,new Element());return this.nodes.get(key);}
  addEventListener(k,v){this.listeners.set(k,v);}removeEventListener(k){this.listeners.delete(k);}remove(){this.removed=true;}
  contains(el){return this.children.includes(el);}closest(){return this;}
  getBoundingClientRect(){return {left:Number(this.dataset.index||0)%8*40,top:Math.floor(Number(this.dataset.index||0)/8)*40,width:40,height:40};}
 }
 let paused=false,id=0;const frames=new Map(),saved=[],finishes=[],clears=[];const win=new Element();win.requestAnimationFrame=fn=>{frames.set(++id,fn);return id;};win.cancelAnimationFrame=id=>frames.delete(id);
 const root=new Element(),board=Array.from({length:8},(_,r)=>Array.from({length:8},(_,c)=>(r+c)%6));board[0][0]=specialGem(0,'rainbow');
 const game=createMatch3Game({root,document:{createElement:()=>new Element()},window:win,save:s=>saved.push(s),clear(){clears.push(true);},setScore(){},finish(...args){finishes.push(args);},isPaused:()=>paused,isActive:()=>true},savedState||{board,score:0,levelScore:0,moves:28,level:1});
 const shell=root.children[1],grid=shell.querySelector('.m3-board');
 return {game,saved,finishes,clears,frames,win,grid,shell,press:selector=>shell.querySelector(selector).listeners.get('click')({}),mode:value=>{const select=shell.querySelector('.m3-mode');select.value=value;select.listeners.get('change')({});},pause:v=>paused=v,click:i=>grid.listeners.get('click')({target:grid.children[i],detail:1}),async frame(t){const jobs=[...frames];frames.clear();jobs.forEach(([,fn])=>fn(t));await Promise.resolve();await Promise.resolve();}};
}
test('pending special animation saves only stable state and destroy cancels future writes',async()=>{const h=harness(),before=h.game.getState();h.click(0);h.click(1);await h.frame(0);await h.frame(60);assert.deepEqual(h.game.getState(),before);h.game.save();assert.deepEqual(h.saved.at(-1),before);const count=h.saved.length;h.game.destroy();assert.equal(h.frames.size,0);assert.equal(h.win.listeners.size,0);assert.equal(h.grid.listeners.size,0);await h.frame(999);assert.equal(h.saved.length,count);});
test('pause holds special-swap animation transform and resumes the same pending turn',async()=>{const h=harness();h.click(0);h.click(1);await h.frame(0);await h.frame(50);const before=h.grid.children[0].firstElementChild.style.transform;h.pause(true);await h.frame(100);await h.frame(200);assert.equal(h.grid.children[0].firstElementChild.style.transform,before);h.pause(false);await h.frame(250);assert.notEqual(h.grid.children[0].firstElementChild.style.transform,before);h.game.destroy();});

async function completeAnimation(h){for(let t=0;t<100000&&h.frames.size;t+=200)await h.frame(t);assert.equal(h.frames.size,0,'animation reaches a stable state');}
test('mode selector requires confirmation, cancel preserves save, and return restores board',()=>{
 const h=harness(),before=h.game.getState(),count=h.saved.length;
 h.mode('ice');assert.equal(h.game.getState().mode,'classic');assert.equal(h.saved.length,count);
 h.press('.m3-confirm-cancel');assert.deepEqual(h.game.getState(),before);
 h.mode('ice');h.press('.m3-confirm-ok');assert.equal(h.game.getState().mode,'ice');assert.ok(h.game.getState().ice.some(n=>n>0));
 h.mode('classic');h.press('.m3-confirm-ok');assert.deepEqual(h.game.getState().board,before.board);assert.equal(h.game.getState().wallet.coins,30);h.game.destroy();
});
test('pause prevents confirming a mode change until play resumes',()=>{
 const h=harness();h.mode('endless');h.pause(true);h.press('.m3-confirm-ok');assert.equal(h.game.getState().mode,'classic');h.pause(false);h.press('.m3-confirm-ok');assert.equal(h.game.getState().mode,'endless');h.game.destroy();
});
test('cancelling hammer targeting costs nothing; in-flight hammer and mode controls keep the stable save',async()=>{
 const h=harness(),before=h.game.getState();h.press('.m3-hammer');h.press('.m3-hammer');assert.deepEqual(h.game.getState(),before);
 h.press('.m3-hammer');h.click(0);await h.frame(0);await h.frame(60);assert.deepEqual(h.game.getState(),before);h.mode('ice');assert.equal(h.game.getState().mode,'classic');
 h.game.save();assert.deepEqual(h.saved.at(-1),before);const savedCount=h.saved.length;h.game.destroy();await h.frame(999);assert.equal(h.saved.length,savedCount);assert.equal(h.frames.size,0);
});
test('successful hammer animation deducts once and persists the final board and wallet together',async()=>{
 const base=harness(),seed=base.game.getState();base.game.destroy();seed.mode='endless';seed.moves=0;seed.levelScore=0;seed.score=0;
 const h=harness(seed);h.press('.m3-hammer');h.click(7);await completeAnimation(h);const after=h.game.getState();
 assert.equal(after.wallet.coins,10);assert.equal(after.toolsUsed,1);assert.equal(after.moves,0);assert.deepEqual(h.saved.at(-1),after);assert.ok(after.score>=10);h.game.destroy();
});
test('shuffle confirms cost once and cancellation leaves the wallet untouched',()=>{
 const h=harness(),before=h.game.getState();h.press('.m3-shuffle');h.press('.m3-confirm-cancel');assert.deepEqual(h.game.getState(),before);
 h.press('.m3-shuffle');h.press('.m3-confirm-ok');const after=h.game.getState();assert.equal(after.wallet.coins,15);assert.equal(after.moves,before.moves);assert.equal(after.toolsUsed,1);h.press('.m3-confirm-ok');assert.deepEqual(h.game.getState(),after);h.game.destroy();
});
test('completed save issues a visible reward once and resumes the next level',()=>{
 const base=harness(),s=base.game.getState();base.game.destroy();s.levelScore=600;s.score=600;s.moves=10;
 const first=harness(s);const after=first.game.getState();assert.equal(after.level,2);assert.equal(after.wallet.coins,80);assert.equal(after.wallet.stars,3);assert.match(first.shell.querySelector('.m3-status').textContent,/金币 \+50/);assert.match(first.shell.querySelector('.m3-wallet').textContent,/80/);first.game.destroy();
 const resumed=harness(after);assert.equal(resumed.game.getState().wallet.coins,80);assert.equal(resumed.game.getState().wallet.stars,3);resumed.game.destroy();
});
test('exhausted level is saved and retryable without clearing rewards or creating a gameover record',()=>{
 const base=harness(),s=base.game.getState();base.game.destroy();s.moves=0;s.wallet.coins=65;s.wallet.stars=3;
 const h=harness(s);assert.equal(h.finishes.length,0);assert.equal(h.clears.length,0);assert.equal(h.shell.querySelector('.m3-retry').hidden,false);assert.equal(h.saved.at(-1).wallet.coins,65);
 h.press('.m3-retry');h.press('.m3-confirm-ok');assert.equal(h.game.getState().moves,28);assert.equal(h.game.getState().wallet.coins,65);h.game.destroy();
});
test('explicit end requires confirmation and emits only one result with reward metadata',()=>{
 const h=harness();h.press('.m3-end');h.press('.m3-confirm-cancel');assert.equal(h.finishes.length,0);assert.equal(h.clears.length,0);
 h.press('.m3-end');h.press('.m3-confirm-ok');assert.equal(h.finishes.length,1);assert.equal(h.clears.length,1);assert.equal(h.finishes[0][3].mode,'classic');assert.equal(h.finishes[0][3].coins,30);
 h.press('.m3-confirm-ok');h.press('.m3-end');h.game.save();assert.equal(h.finishes.length,1);h.game.destroy();
});
