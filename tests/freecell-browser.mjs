// Real mouse/touch regression, using an isolated browser and an ephemeral server.
// PUPPETEER_CORE_PATH=/path/to/puppeteer-core CHROME_PATH=/path/to/chrome node tests/freecell-browser.mjs
import assert from 'node:assert/strict';
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {setTimeout as wait} from 'node:timers/promises';

const puppeteer=createRequire(import.meta.url)(process.env.PUPPETEER_CORE_PATH||'puppeteer-core');
const card=(s,r)=>s*13+r-1;
function board(columns=[],freecells=[null,null,null,null],counts=[0,0,0,0],autoHome=false){
  const foundations=counts.map((n,s)=>Array.from({length:n},(_,i)=>card(s,i+1)));
  const used=new Set([...columns.flat(),...freecells.filter(c=>c!==null),...foundations.flat()]);
  const cols=Array.from({length:8},(_,i)=>columns[i]?.slice()||[]);
  // Keep deterministic fixtures at realistic heights on a narrow phone screen.
  Array.from({length:52},(_,i)=>i).filter(c=>!used.has(c)).forEach((c,i)=>cols[2+i%6].push(c));
  return {columns:cols,freecells,foundations,moves:0,history:[],autoHome};
}
const fixtures={
  exposedAce:board([[card(0,2),card(0,1)]]),
  freecellAce:board([],[card(2,1),null,null,null]),
  unsafeLegal:board([[card(0,4)]],undefined,[3,2,3,0]),
  illegalWithSelection:board([[card(1,6)],[card(0,7)]]),
  legalWithSelection:board([[card(1,3)],[card(0,4)]],undefined,[3,2,0,0]),
  buriedAce:board([[card(0,1),card(1,2)]]),
  groupedUndo:board([[card(0,2),card(0,1)],[card(1,1)]],undefined,undefined,true),
};
const moduleSource=await readFile(new URL('../src/games/freecell.js',import.meta.url));
const server=http.createServer((req,res)=>{
  res.setHeader('Content-Type',req.url==='/freecell.js'?'text/javascript':'text/html');
  res.end(req.url==='/freecell.js'?moduleSource:'<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0}#game{width:100vw;height:100vh}</style><div id="game"></div>');
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
let browser;
const results=[],errors=[];
try{
  browser=await puppeteer.launch({headless:true,executablePath:process.env.CHROME_PATH});
  for(const touch of [false,true]){
    const page=await browser.newPage();
    page.on('pageerror',error=>errors.push(String(error)));
    await page.setViewport({width:touch?412:1000,height:touch?915:800,isMobile:touch,hasTouch:touch,deviceScaleFactor:1});
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.evaluate(async()=>{
      const {createFreeCellGame}=await import('/freecell.js');
      window.events=[];
      for(const type of ['click','dblclick'])document.addEventListener(type,event=>window.events.push({type,detail:event.detail,card:event.target.dataset.card??null}),true);
      window.mount=state=>{
        window.fcGame?.destroy();window.paused=false;window.effects={saves:0,finishes:0,toasts:[]};window.events=[];
        window.fcGame=createFreeCellGame({root:document.querySelector('#game'),document,isPaused:()=>window.paused,isActive:()=>true,save:()=>effects.saves++,clear(){},finish:()=>effects.finishes++,speak(){},toast:text=>effects.toasts.push(text),setScore(){}},state);
      };
    });
    const mount=state=>page.evaluate(s=>window.mount(s),state);
    const state=()=>page.evaluate(()=>window.fcGame.getState());
    const action=name=>page.$eval(`[data-action="${name}"]`,el=>el.click());
    const selector=(index,cardIndex=0)=>`.fc-columns .fc-card[data-index="${index}"][data-card-index="${cardIndex}"]`;
    async function point(query,buried=false){return page.$eval(query,(el,buried)=>{const r=el.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+(buried?10:r.height/2)};},buried);}
    async function tap(query,buried=false){const {x,y}=await point(query,buried);if(touch)await page.touchscreen.tap(x,y);else await page.mouse.click(x,y);}
    async function doubleTap(query,buried=false){
      const {x,y}=await point(query,buried);
      if(touch){await page.touchscreen.tap(x,y);await wait(60);await page.touchscreen.tap(x,y);}
      else{await page.mouse.click(x,y,{clickCount:1});await wait(60);await page.mouse.click(x,y,{clickCount:2});}
    }
    async function check(name,fn){await fn();results.push({mode:touch?'mobile-touch':'desktop-mouse',name});}

    await check('redraw-safe double gesture homes only the exposed ace',async()=>{
      await mount(fixtures.exposedAce);await doubleTap(selector(0,1));
      const next=await state();assert.deepEqual(next.foundations[0],[card(0,1)]);assert.deepEqual(next.columns[0],[card(0,2)]);assert.equal(next.moves,1);
      // Event trace distinguishes real touch clicks from native dblclick.
      results.push({mode:touch?'mobile-touch':'desktop-mouse',eventTrace:await page.evaluate(()=>window.events)});
      await action('undo');assert.deepEqual(await state(),fixtures.exposedAce);
    });
    await check('freecell double gesture',async()=>{
      await mount(fixtures.freecellAce);await doubleTap('.fc-top .fc-card[data-type="freecell"][data-index="0"]');
      const next=await state();assert.equal(next.freecells[0],null);assert.deepEqual(next.foundations[2],[card(2,1)]);assert.equal(next.moves,1);
    });
    await check('explicit legal home bypasses only the safe-archive threshold',async()=>{
      await mount(fixtures.unsafeLegal);await action('auto-home');assert.deepEqual(await state(),fixtures.unsafeLegal);
      await doubleTap(selector(0));const next=await state();assert.equal(next.foundations[0].length,4);assert.deepEqual(next.columns[0],[]);assert.equal(next.moves,1);
    });
    await check('illegal double gesture never moves the prior selection',async()=>{
      await mount(fixtures.illegalWithSelection);await tap(selector(0));await doubleTap(selector(1));await wait(450);
      assert.deepEqual(await state(),fixtures.illegalWithSelection);
    });
    await check('legal double gesture homes the target, preserving the prior selection card',async()=>{
      await mount(fixtures.legalWithSelection);await tap(selector(0));await doubleTap(selector(1));await wait(450);
      const next=await state();assert.deepEqual(next.columns[0],fixtures.legalWithSelection.columns[0]);assert.deepEqual(next.columns[1],[]);assert.equal(next.moves,1);
    });
    await check('single source and target clicks still move to cards and empty cells',async()=>{
      await mount(fixtures.illegalWithSelection);await tap(selector(0));await tap(selector(1));await wait(450);
      assert.deepEqual((await state()).columns[1],[card(0,7),card(1,6)]);
      await tap(selector(1,1));await tap('.fc-slot[data-type="freecell"][data-index="0"]');
      assert.equal((await state()).freecells[0],card(1,6));assert.equal((await state()).moves,2);
    });
    await check('a third different tap completes the pending move and keeps the next selection valid',async()=>{
      const fixture=fixtures.illegalWithSelection;await mount(fixture);
      const thirdIndex=fixture.columns[2].length-1,thirdCard=fixture.columns[2][thirdIndex];
      await tap(selector(0));await tap(selector(1));await tap(selector(2,thirdIndex));
      assert.equal((await state()).moves,1);
      await tap('.fc-slot[data-type="freecell"][data-index="0"]');await wait(450);
      assert.equal((await state()).freecells[0],thirdCard);assert.equal((await state()).moves,2);
    });
    await check('buried card cannot skip its covering card',async()=>{
      await mount(fixtures.buriedAce);await doubleTap(selector(0),true);assert.deepEqual(await state(),fixtures.buriedAce);
    });
    await check('automatic follow-up stays grouped across save, restore and undo',async()=>{
      await mount(fixtures.groupedUndo);await doubleTap(selector(0,1));const next=await state();
      assert.deepEqual(next.foundations[0],[card(0,1),card(0,2)]);assert.deepEqual(next.foundations[1],[card(1,1)]);assert.equal(next.moves,1);assert.equal(next.history.length,1);
      await mount(JSON.parse(JSON.stringify(next)));await action('undo');assert.deepEqual(await state(),fixtures.groupedUndo);
    });
    await check('pause cancels an unresolved single-card destination move',async()=>{
      await mount(fixtures.illegalWithSelection);await tap(selector(0));await tap(selector(1));await page.evaluate(()=>window.paused=true);await wait(450);
      assert.deepEqual(await state(),fixtures.illegalWithSelection);
    });
    if(touch&&process.env.FREECELL_SCREENSHOT){await mount(fixtures.exposedAce);await page.screenshot({path:process.env.FREECELL_SCREENSHOT});}
    await page.close();
  }
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({passed:results.filter(r=>r.name).length,errors,results,fixtures},null,2));
}finally{
  await browser?.close();
  await new Promise(resolve=>server.close(resolve));
}
