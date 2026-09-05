import test from 'node:test';
import assert from 'node:assert/strict';
import { dealFreeCell, canMoveFreeCell, moveFreeCell, undoFreeCell, restoreFreeCell, freeCellHint, isFreeCellWon, freeCellHintHighlights } from '../src/games/freecell.js';
const card = (s,r) => s*13+r-1;
function board(columns = [], freecells = [null,null,null,null], foundations = [[],[],[],[]]) {
  const used = [...columns.flat(), ...freecells.filter(x=>x!==null), ...foundations.flat()];
  const rest = Array.from({length:52},(_,i)=>i).filter(x=>!used.includes(x));
  const cols = Array.from({length:8},(_,i)=>columns[i]?.slice() || []);
  cols[7].unshift(...rest);
  return { columns:cols, freecells, foundations, moves:0, history:[] };
}
const col = (index,cardIndex) => ({type:'column',index,cardIndex});
test('deal contains 52 unique cards and classic column sizes',()=>{
 const s=dealFreeCell(()=>0.5); assert.deepEqual(s.columns.map(x=>x.length),[7,7,7,7,6,6,6,6]); assert.equal(new Set(s.columns.flat()).size,52);
});
test('legal alternating sequence moves immutably and undo restores',()=>{
 const s=board([[card(0,6),card(1,5)],[card(2,7)]]); const original=structuredClone(s);
 const n=moveFreeCell(s,col(0,0),col(1)); assert.equal(n.moves,1); assert.deepEqual(n.columns[1],[card(2,7),card(0,6),card(1,5)]); assert.deepEqual(s,original); assert.deepEqual(undoFreeCell(n),s);
 assert.equal(canMoveFreeCell(s,col(0,0),{type:'freecell',index:0}),false);
});
test('capacity excludes empty destination and includes other empty columns',()=>{
 const s=board([[card(0,6),card(1,5)],[],[20],[21],[22],[23],[24]],[30,31,32,33]);
 assert.equal(canMoveFreeCell(s,col(0,0),col(1)),false);
 s.columns[6]=[]; assert.equal(canMoveFreeCell(s,col(0,0),col(1)),true);
});
test('foundations enforce suit and A through K; any card can occupy empty column',()=>{
 const s=board([[card(0,1)],[card(1,2)]]);
 assert.equal(canMoveFreeCell(s,col(0,0),{type:'foundation',index:0}),true);
 assert.equal(canMoveFreeCell(s,col(0,0),{type:'foundation',index:1}),false);
 assert.equal(canMoveFreeCell(s,col(1,0),{type:'foundation',index:1}),false);
 assert.equal(canMoveFreeCell(s,col(1,0),col(2)),true);
 assert.equal(canMoveFreeCell(s,col(0,-1),col(2)),false);
 assert.equal(canMoveFreeCell(s,col(0,0),{type:'column',index:99}),false);
});
test('restore clones durable state and rejects corrupt cards/history',()=>{
 const s=dealFreeCell(()=>0.4); const h=freeCellHint(s); assert.ok(h); const n=moveFreeCell(s,h.from,h.to);
 assert.deepEqual(restoreFreeCell(JSON.parse(JSON.stringify(n))),n);
 const restored=restoreFreeCell(n); restored.columns[0].pop(); assert.equal(n.columns.flat().length+n.freecells.filter(x=>x!==null).length+n.foundations.flat().length,52);
 const bad={...s,columns:s.columns.map(x=>x.slice())}; bad.columns[0][0]=bad.columns[0][1]; assert.equal(new Set(restoreFreeCell(bad).columns.flat()).size,52);
 assert.equal(restoreFreeCell({...s,history:[bad]}).history.length,0);
});
test('win requires all four complete foundations',()=>{
 const s={columns:Array.from({length:8},()=>[]),freecells:[null,null,null,null],foundations:Array.from({length:4},(_,s)=>Array.from({length:13},(_,i)=>s*13+i)),moves:52,history:[]};
 assert.equal(isFreeCellWon(s),true); assert.equal(isFreeCellWon(dealFreeCell()),false); assert.equal(freeCellHint(s),null);
});
test('rejects broken sequences, occupied cells and self moves without mutation',()=>{
 const s=board([[card(0,6),card(3,5)],[card(2,7)]],[30,null,null,null]);
 assert.equal(canMoveFreeCell(s,col(0,0),col(1)),false);
 assert.equal(canMoveFreeCell(s,col(0,1),{type:'freecell',index:0}),false);
 assert.equal(canMoveFreeCell(s,col(0,1),col(0)),false);
 assert.equal(moveFreeCell(s,col(0,0),col(1)),s);
 const n=moveFreeCell(s,col(0,1),{type:'freecell',index:1});
 assert.equal(n.freecells[1],card(3,5));
 const restored=restoreFreeCell(JSON.parse(JSON.stringify(n)));
 assert.deepEqual(undoFreeCell(restored),s);
});
test('capacity counts free cells and destination must fit lowest selected card',()=>{
 const s=board([[card(0,6),card(1,5),card(3,4)],[card(2,7)],[20],[21],[22],[23],[24]],[30,31,null,null]);
 assert.equal(canMoveFreeCell(s,col(0,0),col(1)),true);
 s.freecells[2]=32;
 assert.equal(canMoveFreeCell(s,col(0,0),col(1)),false);
 assert.equal(canMoveFreeCell(s,col(0,1),col(1)),false);
});

test('hint highlights only movable source suffix and receiving top or empty slot',()=>{
 const s=dealFreeCell(()=>0.4), hint=freeCellHint(s);
 assert.equal(hint.from.type,'column');
 assert.equal(hint.from.cardIndex,s.columns[hint.from.index].length-1);
 const source=s.columns[hint.from.index].map((_,cardIndex)=>freeCellHintHighlights(s,hint,col(hint.from.index,cardIndex)));
 assert.equal(source.filter(Boolean).length,1);
 const target=s.columns[hint.to.index].map((_,cardIndex)=>freeCellHintHighlights(s,hint,col(hint.to.index,cardIndex)));
 assert.equal(target.filter(Boolean).length,1);
 assert.equal(target.at(-1),true);
 const sequence=board([[card(0,6),card(1,5)],[],[card(2,7)]]);
 const multi={from:col(0,0),to:col(2)};
 assert.equal(freeCellHintHighlights(sequence,multi,col(0,0)),true);
 assert.equal(freeCellHintHighlights(sequence,multi,col(0,1)),true);
 assert.equal(freeCellHintHighlights(sequence,{from:col(0,1),to:col(1)},col(1)),true);
 assert.equal(freeCellHintHighlights(sequence,multi,col(1)),false);
 assert.equal(freeCellHintHighlights(sequence,null,col(0,0)),false);
});
