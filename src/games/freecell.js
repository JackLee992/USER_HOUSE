const SUITS = ['♣', '♥', '♦', '♠'];
const suit = card => Math.floor(card / 13);
const rank = card => card % 13 + 1;
const red = card => suit(card) === 1 || suit(card) === 2;
const label = card => (['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'][rank(card)] + SUITS[suit(card)]);
const cloneBoard = s => ({ columns:s.columns.map(c=>c.slice()), freecells:s.freecells.slice(), foundations:s.foundations.map(c=>c.slice()), moves:s.moves, ...(typeof s.autoHome==='boolean'?{autoHome:s.autoHome}:{}) });
function validBoard(s) {
  if (!s || !Array.isArray(s.columns) || s.columns.length !== 8 || !s.columns.every(Array.isArray) || !Array.isArray(s.freecells) || s.freecells.length !== 4 || !Array.isArray(s.foundations) || s.foundations.length !== 4 || !s.foundations.every(Array.isArray) || !Number.isSafeInteger(s.moves) || s.moves < 0) return false;
  const cards = [...s.columns.flat(), ...s.freecells.filter(c=>c!==null), ...s.foundations.flat()];
  return cards.length === 52 && new Set(cards).size === 52 && cards.every(c=>Number.isInteger(c)&&c>=0&&c<52) && s.foundations.every((pile,i)=>pile.length<=13&&pile.every((c,j)=>c===i*13+j));
}
export function dealFreeCell(random = Math.random) {
  const deck=Array.from({length:52},(_,i)=>i);
  for(let i=51;i>0;i--){ const j=Math.max(0,Math.min(i,Math.floor(random()*(i+1)))); [deck[i],deck[j]]=[deck[j],deck[i]]; }
  const columns=Array.from({length:8},()=>[]); deck.forEach((c,i)=>columns[i%8].push(c));
  return {columns, freecells:[null,null,null,null], foundations:[[],[],[],[]],moves:0,history:[]};
}
export function restoreFreeCell(saved) {
  if(!validBoard(saved)) return dealFreeCell();
  return {...cloneBoard(saved),history:Array.isArray(saved.history)?saved.history.slice(-100).filter(validBoard).map(cloneBoard):[]};
}
function validLocation(s,p) {
  return p && Number.isInteger(p.index) && p.index>=0 && (p.type==='column'?p.index<8:(p.type==='freecell'||p.type==='foundation')&&p.index<4);
}
function sourceCards(s,p) {
  if(!validLocation(s,p)) return [];
  if(p.type==='freecell') return s.freecells[p.index]===null?[]:[s.freecells[p.index]];
  // Foundations are final destinations; undo can recover an earlier placement.
  if(p.type!=='column') return [];
  const pile=s.columns[p.index], start=p.cardIndex??pile.length-1;
  return Number.isInteger(start)&&start>=0&&start<pile.length?pile.slice(start):[];
}
const stacksOn = (a,b) => rank(a)+1===rank(b)&&red(a)!==red(b);
export function canMoveFreeCell(s,from,to) {
  if(!validLocation(s,from)||!validLocation(s,to)||(from.type===to.type&&from.index===to.index)) return false;
  const cards=sourceCards(s,from); if(!cards.length||!cards.every((c,i)=>i===0||stacksOn(c,cards[i-1]))) return false;
  if(to.type==='freecell') return cards.length===1&&s.freecells[to.index]===null;
  if(to.type==='foundation') return cards.length===1&&suit(cards[0])===to.index&&rank(cards[0])===s.foundations[to.index].length+1;
  const target=s.columns[to.index];
  const empties=s.columns.filter((c,i)=>!c.length&&i!==to.index).length;
  const capacity=(s.freecells.filter(c=>c===null).length+1)*2**empties;
  return cards.length<=capacity&&(!target.length||stacksOn(cards[0],target.at(-1)));
}
export function moveFreeCell(s,from,to) {
  if(!canMoveFreeCell(s,from,to)) return s;
  const cards=sourceCards(s,from), next=cloneBoard(s);
  if(from.type==='column') next.columns[from.index].splice(-cards.length); else next.freecells[from.index]=null;
  if(to.type==='column') next.columns[to.index].push(...cards);
  else if(to.type==='freecell') next.freecells[to.index]=cards[0];
  else next.foundations[to.index].push(cards[0]);
  if(s.autoHome) collectSafeCards(next);
  next.moves++;
  next.history=[...(s.history||[]).map(cloneBoard),cloneBoard(s)].slice(-100);
  return next;
}
// A/2 never need to remain as tableau support. Higher cards wait until both
// opposite-color predecessor ranks have already gone home.
export function safeToHomeFreeCell(state, card) {
  if(!Number.isInteger(card)||card<0||card>=52)return false;
  const n=rank(card),own=suit(card);
  if(state.foundations[own].length+1!==n)return false;
  return n<=2 || [0,1,2,3].filter(s=>red(s*13)!==red(card)).every(s=>state.foundations[s].length>=n-1);
}
function collectSafeCards(next) {
  let count=0;
  for(let pass=0;pass<52;pass++) {
    const source=next.freecells.map((card,index)=>({card,index,type:'freecell'})).concat(next.columns.map((pile,index)=>({card:pile.at(-1),index,type:'column'}))).find(p=>safeToHomeFreeCell(next,p.card));
    if(!source)break;
    if(source.type==='column')next.columns[source.index].pop();else next.freecells[source.index]=null;
    next.foundations[suit(source.card)].push(source.card);count++;
  }
  return count;
}
export function autoHomeFreeCell(state) {
  const next=cloneBoard(state);
  if(!collectSafeCards(next))return state;
  next.moves++;
  next.history=[...(state.history||[]).map(cloneBoard),cloneBoard(state)].slice(-100);
  return next;
}
export function undoFreeCell(s) {
  if(!s.history?.length) return s;
  return {...cloneBoard(s.history.at(-1)),...(typeof s.autoHome==='boolean'?{autoHome:s.autoHome}:{}),history:s.history.slice(0,-1).map(cloneBoard)};
}
export function isFreeCellWon(s) { return validBoard(s)&&s.foundations.every(c=>c.length===13); }
export function freeCellHint(s) {
  const sources=[];
  s.columns.forEach((pile,index)=>pile.forEach((_,cardIndex)=>sources.push({type:'column',index,cardIndex})));
  s.freecells.forEach((card,index)=>{if(card!==null)sources.push({type:'freecell',index});});
  const targets=[...Array.from({length:4},(_,index)=>({type:'foundation',index})),...Array.from({length:8},(_,index)=>({type:'column',index})),...Array.from({length:4},(_,index)=>({type:'freecell',index}))];
  let fallback=null;
  for(const to of targets) for(const from of sources) if(canMoveFreeCell(s,from,to)) {
    const move={from,to};
    if(to.type==='foundation'||to.type==='column'&&s.columns[to.index].length) return move;
    if(!(to.type==='column'&&from.type==='column'&&from.cardIndex===0)) fallback ||= move;
  }
  return fallback;
}
// Each rendered card supplies its stack offset; empty slots omit it.
export function freeCellHintHighlights(state, hint, position) {
  if (!hint || !position) return false;
  const matches = endpoint => endpoint?.type === position.type && endpoint.index === position.index;
  if (matches(hint.from)) {
    if (position.type !== 'column') return true;
    const start = hint.from.cardIndex ?? state.columns[position.index].length - 1;
    return Number.isInteger(position.cardIndex) && position.cardIndex >= start && position.cardIndex < state.columns[position.index].length;
  }
  if (!matches(hint.to)) return false;
  if (position.type !== 'column') return true;
  const length = state.columns[position.index].length;
  return length ? position.cardIndex === length - 1 : position.cardIndex === undefined;
}
function ensureStyles(doc) {
  if(doc.getElementById('wb-freecell-css'))return;
  const style=doc.createElement('style'); style.id='wb-freecell-css'; style.textContent=`
.wb-freecell{width:100%;height:100%;min-height:0;display:flex;flex-direction:column;gap:10px;padding:12px;box-sizing:border-box;background:radial-gradient(ellipse at top,#28795b,#125138);color:#fff;overflow:auto}
.wb-freecell .fc-status{display:flex;justify-content:space-between;gap:8px;font-size:12px}.wb-freecell .fc-top,.wb-freecell .fc-columns{display:grid;grid-template-columns:repeat(8,minmax(0,1fr));gap:clamp(3px,1vw,10px)}
.wb-freecell .fc-columns{flex:1;align-items:start;min-height:190px}.wb-freecell .fc-pile{position:relative;min-width:0;min-height:78px;border:1px solid #ffffff38;border-radius:5px;background:#002d252b}.wb-freecell .fc-card,.wb-freecell .fc-slot{width:100%;box-sizing:border-box;height:clamp(65px,9vw,96px)}
.wb-freecell .fc-card{display:flex;align-items:flex-start;justify-content:flex-start;white-space:nowrap;position:relative;height:clamp(65px,9vw,96px);padding:3px;border:1px solid #c4c6bc;border-radius:5px;background:#fffdf5;color:#202b2e;text-align:left;line-height:1.1;font:bold clamp(12px,2.1vw,20px)/1.1 Georgia,serif;box-shadow:0 2px 3px #0003;cursor:pointer;touch-action:manipulation}
.wb-freecell .fc-card.red{color:#bb243c}.wb-freecell .fc-columns .fc-card:not(:last-child){margin-bottom:calc(-1 * clamp(65px,9vw,96px) + 27px)}
.wb-freecell .fc-card.selected{background:#fff1b6;outline:3px solid #ffd75a;outline-offset:-3px}.wb-freecell .fc-slot{height:clamp(65px,9vw,96px);border:1px dashed #ffffff70;border-radius:5px;background:#073c3040;color:#d5eadc;cursor:pointer;font-size:clamp(12px,2.2vw,23px)}
.wb-freecell .fc-hint{outline:3px solid #71dcff!important;outline-offset:-3px}.wb-freecell .fc-tools{display:flex;gap:8px;flex-wrap:wrap}.wb-freecell .fc-tools button{min-height:40px;padding:7px 12px;border:1px solid #afcbbc;border-radius:5px;background:#f5f1df;color:#234935;cursor:pointer}.wb-freecell .fc-tools button[aria-pressed="true"]{background:#d9f6ce;border-color:#99e487}.wb-freecell button:focus-visible{outline:3px solid #ffd75a;outline-offset:1px}.wb-freecell button:disabled{opacity:.45}.wb-freecell .fc-help{font-size:11px;line-height:1.5;margin:0;color:#d2e8d9}
@media(max-width:560px){.wb-freecell{padding:6px;gap:7px}.wb-freecell .fc-card{padding:4px 1px}.wb-freecell .fc-columns .fc-card:not(:last-child){margin-bottom:calc(-1 * clamp(65px,9vw,96px) + 25px)}.wb-freecell .fc-status{font-size:10px}}
`; doc.head.appendChild(style);
}
export function createFreeCellGame(env,state) {
  const {root,document:doc}=env; ensureStyles(doc);
  let current=restoreFreeCell(state),selected=null,hint=null,destroyed=false,finished=false;
  const doubleTapMs=400;
  let lastTap=null,pendingMove=null,lastDoubleAt=-Infinity;
  const active=()=>!destroyed&&!finished&&!env.isPaused()&&env.isActive();
  const data=()=>({...cloneBoard(current),history:current.history.map(cloneBoard)});
  function save(force=true){if(!destroyed&&!finished)env.save(data(),force);}
  function same(a,b){return a&&b&&a.type===b.type&&a.index===b.index;}
  function location(type,index,cardIndex){return `data-type="${type}" data-index="${index}"${cardIndex===undefined?'':` data-card-index="${cardIndex}"`}`;}
  function cardHTML(c,type,index,cardIndex){const p={type,index,cardIndex}; return `<button type="button" class="fc-card ${red(c)?'red':''} ${same(selected,p)&&(type!=='column'||cardIndex>=selected.cardIndex)?'selected':''} ${freeCellHintHighlights(current,hint,p)?'fc-hint':''}" ${location(type,index,cardIndex)} data-card="${c}" aria-label="${type==='column'?'第'+(index+1)+'列 ':type==='freecell'?'空当 '+(index+1)+' ':'收牌区 '}${label(c)}">${label(c)}</button>`;}
  function slot(type,index,text){return `<button type="button" class="fc-slot ${freeCellHintHighlights(current,hint,{type,index})?'fc-hint':''}" ${location(type,index)} aria-label="${type==='column'?'空列':type==='freecell'?'空当':'收牌区'} ${index+1}">${text}</button>`;}
  function draw(){
    const count=current.foundations.flat().length; env.setScore(count*10);
    root.innerHTML=`<section class="wb-freecell"><div class="fc-status"><span>空当接龙 · 空当（左）／收牌区（右）</span><span>步数 ${current.moves} · 已归位 ${count}/52</span></div><div class="fc-top">${current.freecells.map((c,i)=>c===null?slot('freecell',i,'空当'):cardHTML(c,'freecell',i)).join('')}${current.foundations.map((p,i)=>p.length?cardHTML(p.at(-1),'foundation',i):slot('foundation',i,SUITS[i])).join('')}</div><div class="fc-columns">${current.columns.map((p,i)=>`<div class="fc-pile" ${location('column',i)}>${p.length?p.map((c,j)=>cardHTML(c,'column',i,j)).join(''):slot('column',i,'＋')}</div>`).join('')}</div><p class="fc-help" aria-live="polite">${selected?'已选中：点击目标空当、列或同花色收牌区。':'点击牌选中，再点击目标；列内红黑交替递减，收牌区从 A 到 K。'} 双击／快速连点同一张露出的牌可归位。安全归档只收不会影响接牌的牌；撤回同时恢复本步自动归档。</p><div class="fc-tools"><button data-action="undo" ${current.history.length?'':'disabled'}>↶ 撤回</button><button data-action="auto-home" title="一次收取全部安全牌；双击或快速连点单张牌则只按同花色 A 到 K 判断">安全归档</button><button data-action="toggle-auto" aria-pressed="${!!current.autoHome}" title="每次有效移动后自动收取安全牌，与该次移动一起撤回">随步归档：${current.autoHome?'开':'关'}</button><button data-action="hint">提示</button><button data-action="finish">结算</button></div></section>`;
  }
  function cancelPending(){if(pendingMove){clearTimeout(pendingMove.timer);pendingMove=null;}}
  function resetTap(){cancelPending();lastTap=null;}
  function perform(from,to){const next=moveFreeCell(current,from,to);if(next===current)return false; resetTap();current=next;selected=null;hint=null;draw();env.speak('move');save();if(isFreeCellWon(current))settle(true);return true;}
  function settle(won){if(finished)return;finished=true;const score=current.foundations.flat().length*10;env.clear();env.speak(won?'win':'settle');env.finish(won?'接龙成功！':'本局结算',`已归位 ${current.foundations.flat().length}/52 张 · ${current.moves} 步`,{outcome:won?'win':'score',score},{score,details:{moves:current.moves,cardsHome:current.foundations.flat().length}});}
  function hit(event){
    const el=event.target.closest('[data-type]');if(!el)return null;
    const p={type:el.dataset.type,index:Number(el.dataset.index)};
    if(el.dataset.cardIndex!==undefined)p.cardIndex=Number(el.dataset.cardIndex);
    else if(p.type==='column')p.cardIndex=current.columns[p.index].length-1;
    const card=el.dataset.card===undefined?null:Number(el.dataset.card);
    // A redraw can expose another card in the same slot before a late event arrives.
    if(card!==null&&(p.type==='column'?current.columns[p.index][p.cardIndex]:p.type==='freecell'?current.freecells[p.index]:current.foundations[p.index].at(-1))!==card)return null;
    return {p,card};
  }
  function homeCard(target,now){
    resetTap();lastDoubleAt=now;
    const {p,card}=target,cards=sourceCards(current,p);
    if(card!==null&&cards.length===1&&cards[0]===card&&perform(p,{type:'foundation',index:suit(card)}))return;
    selected=null;hint=null;draw();env.toast('这张牌暂不能归位：须已露出，并按同花色 A 到 K 收牌');env.speak('invalid');
  }
  function flushPending(){
    const move=pendingMove;cancelPending();
    if(move&&active()&&current===move.board)perform(move.from,move.to);
  }
  function click(event){if(!active()){resetTap();return;}const action=event.target.closest('[data-action]')?.dataset.action;
    if(action)resetTap();
    if(action==='undo'){current=undoFreeCell(current);selected=null;hint=null;draw();save();env.speak('undo');return;}
    if(action==='toggle-auto'){current={...current,autoHome:!current.autoHome};draw();save();env.toast(current.autoHome?'每次有效移动后自动收取安全牌':'已关闭随步归档，仍可手动点击安全归档');return;}
    if(action==='auto-home'){const next=autoHomeFreeCell(current);if(next===current){env.toast('暂时没有可安全归档的牌');return;}const count=next.foundations.flat().length-current.foundations.flat().length;current=next;selected=null;hint=null;draw();save();env.speak('move');env.toast(`已安全归档 ${count} 张，撤回可整体恢复`);if(isFreeCellWon(current))settle(true);return;}
    if(action==='hint'){hint=freeCellHint(current);selected=null;draw();env.toast(hint?'蓝框标示一个合法步骤（不保证最终可解）':'当前没有可提示的有效步骤，可撤回调整');env.speak('hint');return;}
    if(action==='finish'){settle(false);return;}
    let target=hit(event);if(!target){resetTap();return;}
    const now=event.timeStamp??Date.now(),pointerClick=event.detail!==0;
    const canTap=pointerClick&&target.card!==null&&target.p.type!=='foundation';
    // Browsers may reset click.detail and omit dblclick when selection redraws
    // the button. Card identity and time also recognize two touch-generated clicks.
    if(canTap&&lastTap&&lastTap.card===target.card&&same(lastTap.p,target.p)&&lastTap.p.cardIndex===target.p.cardIndex&&now-lastTap.at>=0&&now-lastTap.at<=doubleTapMs){event.preventDefault?.();homeCard(target,now);return;}
    flushPending();if(!active())return;target=hit(event);if(!target)return;
    const {p}=target;
    lastTap=canTap?{...target,at:now}:null;
    if(selected&&canMoveFreeCell(current,selected,p)){
      // An occupied card is both a move destination and a double-tap source.
      // Wait briefly so an illegal double-tap cannot move a different selection.
      if(canTap){pendingMove={from:selected,to:p,board:current,timer:setTimeout(flushPending,doubleTapMs)};return;}
      if(perform(selected,p))return;
    }
    if(same(selected,p)&&selected.cardIndex===p.cardIndex){selected=null;hint=null;draw();return;}
    const cards=sourceCards(current,p);if(cards.length&&cards.every((c,i)=>i===0||stacksOn(c,cards[i-1]))){selected=p;hint=null;draw();}else{env.toast('此处不能移动：请按红黑交替、点数递减排列');env.speak('invalid');}
  }
  function doubleClick(event){
    if(!active()){resetTap();return;}
    event.preventDefault?.();const now=event.timeStamp??Date.now();
    // The second click already handled this gesture, possibly exposing a new card.
    if(now-lastDoubleAt>=0&&now-lastDoubleAt<=doubleTapMs)return;
    const target=hit(event);if(target&&target.card!==null&&target.p.type!=='foundation')homeCard(target,now);
  }
  root.addEventListener('click',click);
  root.addEventListener('dblclick',doubleClick);
  function destroy(){if(destroyed)return;destroyed=true;resetTap();root.removeEventListener('click',click);root.removeEventListener('dblclick',doubleClick);}
  draw();env.speak(state?'resume':'start');save();if(isFreeCellWon(current))settle(true);
  return {destroy,save,getState:data};
}
