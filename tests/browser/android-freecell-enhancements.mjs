// Real Via touch acceptance. Run only when the Android emulator is available.
// Usage: node tests/browser/android-freecell-enhancements.mjs OUTPUT_DIR FIXTURES_JSON
// FIXTURES_JSON is the unmodified JSON output of tests/freecell-browser.mjs.
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {resolve,join} from 'node:path';
import assert from 'node:assert/strict';
import {connectAndroid} from './android-cdp.mjs';

const [directory,fixtureFile]=process.argv.slice(2);
if(!directory||!fixtureFile)throw Error('Usage: node tests/browser/android-freecell-enhancements.mjs OUTPUT_DIR FIXTURES_JSON (from tests/freecell-browser.mjs)');
const dir=resolve(directory),fixtures=JSON.parse(readFileSync(fixtureFile,'utf8')).fixtures;
for(const name of ['exposedAce','freecellAce','unsafeLegal','illegalWithSelection','legalWithSelection','buriedAce','groupedUndo']){
  const s=fixtures?.[name];assert.ok(s,`Missing existing fixture ${name}`);
  const deck=[...s.columns.flat(),...s.freecells.filter(c=>c!==null),...s.foundations.flat()];
  assert.equal(deck.length,52,`${name}: full deck required`);assert.equal(new Set(deck).size,52,`${name}: unique cards required`);
  assert.ok(deck.every(c=>Number.isInteger(c)&&c>=0&&c<52),`${name}: invalid card`);
}
mkdirSync(dir,{recursive:true});
const adb=process.env.ANDROID_ADB||'/Users/jacklee/Library/Android/sdk/platform-tools/adb';
const serial=process.env.ANDROID_SERIAL||'emulator-5554';
const url=process.env.ANDROID_TEST_URL||'http://127.0.0.1:8765/';
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const log={game:'freecell',fixtureSource:resolve(fixtureFile),checks:[],screenshots:[],fixtures};
let c;
const read=()=>c.evaluate('wbTest.state()');
const column=(index,cardIndex)=>`.fc-pile[data-index="${index}"] .fc-card[data-card-index="${cardIndex}"]`;
const cell=index=>`.fc-top [data-type="freecell"][data-index="${index}"]`;
const action=name=>`.fc-tools [data-action="${name}"]`;
async function until(expression,timeout=10000){
  const end=Date.now()+timeout;
  while(Date.now()<end){if(await c.evaluate(expression))return;await wait(100);}
  throw Error(`Timeout: ${expression}`);
}
async function locate(selector,scroll){
  return c.evaluate(`(()=>{
    const e=document.querySelector(${JSON.stringify(selector)});
    if(!e||e.disabled)return null;
    if(${scroll})e.scrollIntoView({block:'nearest',inline:'nearest',behavior:'instant'});
    const r=e.getBoundingClientRect();if(r.width<=0||r.height<=0)return null;
    let bottom=r.bottom;
    // A buried tableau card is exposed only above its next overlapping sibling.
    const next=e.nextElementSibling;
    if(e.matches('.fc-card')&&next?.matches('.fc-card'))bottom=Math.min(bottom,next.getBoundingClientRect().top);
    const left=Math.max(0,r.left),right=Math.min(innerWidth,r.right),top=Math.max(0,r.top);
    bottom=Math.min(innerHeight,bottom);if(right<=left||bottom<=top)return null;
    const point={x:(left+right)/2,y:(top+bottom)/2};
    const hit=document.elementFromPoint(point.x,point.y);
    return e===hit||e.contains(hit)?point:null;
  })()`);
}
async function point(selector){
  const end=Date.now()+10000;let last=null,stable=0;
  while(Date.now()<end){
    const p=await locate(selector,true);
    if(p&&last&&Math.abs(p.x-last.x)<0.4&&Math.abs(p.y-last.y)<0.4)stable++;else stable=0;
    if(p&&stable>=2)return p;
    last=p;await wait(80);
  }
  throw Error(`No stable, unobstructed touch point: ${selector}`);
}
async function touch(p){
  await c.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...p,id:1}]});
  await wait(35);
  await c.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
}
async function tap(selector){await touch(await point(selector));await wait(140);}
async function doubleTap(selector){
  const p=await point(selector);
  // Do not scroll or wait for a second layout between taps: the controller
  // redraws the selected card, and both physical contacts must remain one gesture.
  await touch(p);await wait(65);await touch(p);await wait(450);
}
function shot(name){
  const file=join(dir,`via-freecell-${name}-device.png`);
  writeFileSync(file,execFileSync(adb,['-s',serial,'exec-out','screencap','-p'],{maxBuffer:16*1024*1024,timeout:10000}));
  log.screenshots.push(file);
}
async function load(name,overrides={}){
  const saved={...structuredClone(fixtures[name]),...overrides};
  // select() destroys/saves the previous controller and sets gameStarted=false.
  // start() immediately installs the fixture before renderGame's delayed prompt.
  await c.evaluate(`wbTest.select('freecell');wbTest.start('freecell',${JSON.stringify(saved)},{forceNew:true})`);
  await until("wbTest.game().gameStarted&&!wbTest.game().gamePaused&&!!document.querySelector('.wb-freecell')");
  await wait(220);assert.deepEqual(await read(),saved);
  return saved;
}
const homeCount=s=>s.foundations.reduce((sum,pile)=>sum+pile.length,0);

try{
  c=await connectAndroid();
  await c.send('Page.navigate',{url});
  await until("typeof wbTest!=='undefined'&&typeof wbTest.start==='function'");
  await c.evaluate("document.querySelector('#testbar').style.display='none';wbTest.prepare('freecell');window.freeCellTouchEvents=[];window.freeCellTouchListener=e=>{if(e.target.closest?.('.wb-freecell'))freeCellTouchEvents.push({type:e.type,detail:e.detail,card:e.target.dataset.card??null,action:e.target.dataset.action??null})};document.addEventListener('click',freeCellTouchListener,true);document.addEventListener('dblclick',freeCellTouchListener,true)");
  await until("wbTest.game().gameStarted&&!wbTest.game().gamePaused&&!!document.querySelector('.wb-freecell')");
  log.env=await c.evaluate('({ua:navigator.userAgent,width:innerWidth,height:innerHeight,dpr:devicePixelRatio})');
  log.layout=await c.evaluate("(()=>{const r=document.querySelector('.wb-freecell').getBoundingClientRect();return {rect:r.toJSON(),overflow:document.documentElement.scrollWidth>innerWidth}})()");
  assert.equal(log.layout.overflow,false);

  const fresh=await read();assert.equal(fresh.moves,0);assert.equal(new Set(fresh.columns.flat()).size,52);
  await tap('.fc-pile[data-index="0"] .fc-card:last-child');await tap(cell(0));
  let s=await read();assert.equal(s.moves,1);assert.equal(s.freecells[0],fresh.columns[0].at(-1));
  await tap(action('undo'));assert.deepEqual(await read(),fresh);
  log.checks.push('a genuinely new random 52-card deal accepts real source/target taps and undo');shot('fresh');

  const exposed=await load('exposedAce');await doubleTap(column(0,1));s=await read();
  assert.deepEqual(s.foundations[0],[0]);assert.deepEqual(s.columns[0],[1]);assert.equal(s.moves,1);assert.equal(s.history.length,1);
  log.checks.push('real double touch survives selection redraw, homes only the exposed ace, and never collects the newly exposed two');shot('doubletap');
  await tap(action('undo'));assert.deepEqual(await read(),exposed);

  await load('freecellAce');await doubleTap(cell(0));s=await read();
  assert.equal(s.freecells[0],null);assert.deepEqual(s.foundations[2],[26]);assert.equal(s.moves,1);
  log.checks.push('double touch also homes the specified card from a free cell');

  const unsafe=await load('unsafeLegal');await tap(action('auto-home'));assert.deepEqual(await read(),unsafe);
  await doubleTap(column(0,0));s=await read();assert.equal(s.foundations[0].length,4);assert.deepEqual(s.columns[0],[]);assert.equal(s.moves,1);
  log.checks.push('safe archive leaves an unsafe club four; explicit double touch legally homes that exact card');

  const illegal=await load('illegalWithSelection');await tap(column(0,0));await doubleTap(column(1,0));
  assert.deepEqual(await read(),illegal);
  log.checks.push('illegal double touch leaves the previous selection, board, move count and undo history unconsumed');

  const legal=await load('legalWithSelection');await tap(column(0,0));await doubleTap(column(1,0));s=await read();
  assert.deepEqual(s.columns[0],legal.columns[0]);assert.deepEqual(s.columns[1],[]);assert.equal(s.foundations[0].length,4);assert.equal(s.moves,1);
  log.checks.push('with another card selected, legal double touch homes only the touched target');

  const buried=await load('buriedAce');await doubleTap(column(0,0));assert.deepEqual(await read(),buried);
  log.checks.push('touching the visible strip of a buried ace does not skip its covering card');

  const batch=await load('groupedUndo',{autoHome:false});await tap(action('auto-home'));s=await read();
  assert.equal(homeCount(s),3);assert.deepEqual(s.foundations[0],[0,1]);assert.deepEqual(s.foundations[1],[13]);assert.equal(s.moves,1);assert.equal(s.history.length,1);
  shot('safe-batch');await tap(action('undo'));assert.deepEqual(await read(),batch);
  log.checks.push('one physical safe-archive tap collects all three safe cards; one undo restores the whole batch');

  await tap(action('toggle-auto'));const enabled=await read();assert.equal(enabled.autoHome,true);assert.equal(enabled.moves,0);assert.deepEqual(enabled.columns,batch.columns);
  assert.equal(await c.evaluate("document.querySelector('.fc-tools [data-action=toggle-auto]').getAttribute('aria-pressed')"),'true');
  await tap(column(0,1));await tap(cell(0));s=await read();
  assert.equal(homeCount(s),3);assert.equal(s.freecells[0],null);assert.equal(s.moves,1);assert.equal(s.history.length,1);
  shot('followup-group');await tap(action('undo'));assert.deepEqual(await read(),enabled);
  log.checks.push('enabling follow-up archive does not move cards; a user move plus its three safe homes is one undo transaction');

  await tap(column(0,1));await tap(cell(0));const checkpoint=await read();
  await tap('#wb-pause');await until('wbTest.game().gamePaused');await wait(500);assert.deepEqual(await read(),checkpoint);shot('paused');
  log.checks.push('runtime pause leaves cards, grouped history and archive preference unchanged');
  await tap('#wb-pause');await until('!wbTest.game().gamePaused&&!document.querySelector("#wb-resume-mask")',7000);assert.deepEqual(await read(),checkpoint);
  log.checks.push('real pause button resumes through the complete countdown');
  await tap('#wb-pause');await until('wbTest.game().gamePaused');await tap('#wb-back');
  await until("!wbTest.game().gameStarted&&!!document.querySelector('[data-game=freecell]')");
  assert.equal(await read(),undefined);
  await tap('[data-game="freecell"]');await until("!!document.querySelector('#wb-progress-continue')");
  await tap('#wb-progress-continue');await until("wbTest.game().gameStarted&&!wbTest.game().gamePaused&&!document.querySelector('#wb-progress-count')",7000);
  assert.deepEqual(await read(),checkpoint);shot('continued');
  await tap(action('undo'));assert.deepEqual(await read(),enabled);
  log.checks.push('returning through the catalog and Continue restores the complete board, auto preference and grouped undo');

  await tap(column(0,1));await tap(cell(0));log.final=await read();assert.equal(log.final.moves,1);assert.equal(homeCount(log.final),3);
  log.checks.push('continued game accepts the next real move and archives normally');shot('final');
  log.events=await c.evaluate('freeCellTouchEvents');log.errors=await c.evaluate('testErrors');assert.deepEqual(log.errors,[]);
  await tap('#wb-back');await until("!wbTest.game().gameStarted&&!!document.querySelector('[data-game=freecell]')");
  log.passed=true;
}catch(error){
  log.passed=false;log.error=error.stack;
  try{shot('failure');}catch(screenshotError){log.screenshotError=String(screenshotError);}
  if(c)try{log.failedState=await read();log.events=await c.evaluate('window.freeCellTouchEvents');}catch{}
  process.exitCode=1;
}finally{
  if(c){
    try{await c.evaluate("if(window.freeCellTouchListener){document.removeEventListener('click',freeCellTouchListener,true);document.removeEventListener('dblclick',freeCellTouchListener,true);delete window.freeCellTouchListener}");}catch{}
    c.close();
  }
  writeFileSync(join(dir,'via-freecell-enhancements-checks.json'),JSON.stringify(log,null,2));
  console.log(JSON.stringify({game:log.game,passed:log.passed,checks:log.checks,screenshots:log.screenshots,error:log.error},null,2));
}
