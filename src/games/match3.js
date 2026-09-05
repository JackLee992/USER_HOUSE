const SIZE = 8;
const COLORS = 6;
const copy = board => board.map(row => row.slice());
const at = (board, index) => board[Math.floor(index / SIZE)][index % SIZE];
const adjacent = (a, b) => Number.isInteger(a) && Number.isInteger(b) && a >= 0 && b >= 0 && a < 64 && b < 64 && Math.abs(Math.floor(a / 8) - Math.floor(b / 8)) + Math.abs(a % 8 - b % 8) === 1;
const gem = random => Math.max(0, Math.min(5, Math.floor(random() * COLORS)));

export function findMatches(board) {
  const runs = [], cells = new Set();
  for (const vertical of [false, true]) for (let line = 0; line < SIZE; line++) {
    let start = 0;
    while (start < SIZE) {
      const index = position => vertical ? position * SIZE + line : line * SIZE + position;
      const color = at(board, index(start));
      let end = start + 1;
      while (end < SIZE && at(board, index(end)) === color) end++;
      if (color !== null && end - start >= 3) {
        const run = Array.from({ length:end - start }, (_, n) => index(start + n));
        runs.push(run); run.forEach(cell => cells.add(cell));
      }
      start = end;
    }
  }
  return { cells:[...cells], runs };
}

export function swapBoard(board, a, b) {
  const next = copy(board);
  [next[Math.floor(a / SIZE)][a % SIZE], next[Math.floor(b / SIZE)][b % SIZE]] = [at(board, b), at(board, a)];
  return next;
}

export function legalMoves(board) {
  const moves = [];
  for (let a = 0; a < 64; a++) for (const b of [a + 1, a + 8]) {
    if (!adjacent(a, b) || at(board, a) === at(board, b)) continue;
    const matches = findMatches(swapBoard(board, a, b)).cells;
    if (matches.includes(a) || matches.includes(b)) moves.push([a, b]);
  }
  return moves;
}

export function createBoard(random = Math.random) {
  // Select from allowed colors directly, so even a constant RNG terminates.
  for (let attempt = 0; attempt < 30; attempt++) {
    const board = Array.from({ length:SIZE }, () => []);
    for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) {
      const allowed = Array.from({ length:COLORS }, (_, n) => n).filter(n => !(c >= 2 && board[r][c - 1] === n && board[r][c - 2] === n) && !(r >= 2 && board[r - 1][c] === n && board[r - 2][c] === n));
      board[r][c] = allowed[Math.min(allowed.length - 1, Math.max(0, Math.floor(random() * allowed.length)))];
    }
    if (legalMoves(board).length) return board;
  }
  const board = Array.from({ length:SIZE }, (_, r) => Array.from({ length:SIZE }, (_, c) => (r + c) % COLORS));
  // Plant an A B A / C A D pattern, with a guaranteed vertical swap.
  board[0][0] = 0; board[0][1] = 1; board[0][2] = 0; board[1][1] = 0;
  return board;
}

export function collapseBoard(board, cells, random = Math.random) {
  const cleared = new Set(cells), next = copy(board);
  for (let c = 0; c < SIZE; c++) {
    const survivors = board.map((row, r) => ({ value:row[c], index:r * SIZE + c })).filter(item => !cleared.has(item.index)).map(item => item.value);
    const added = Array.from({ length:SIZE - survivors.length }, () => gem(random));
    [...added, ...survivors].forEach((value, r) => { next[r][c] = value; });
  }
  return next;
}

export function resolveBoard(board, random = Math.random) {
  let next = copy(board), score = 0, reshuffled = false;
  const waves = [];
  for (let chain = 1; chain <= 100; chain++) {
    const matches = findMatches(next);
    if (!matches.cells.length) break;
    const points = (matches.cells.length * 10 + matches.runs.reduce((sum, run) => sum + (run.length >= 5 ? 50 : run.length === 4 ? 20 : 0), 0)) * Math.min(chain, 5);
    const before = copy(next);
    next = collapseBoard(next, matches.cells, random);
    waves.push({ before, board:copy(next), cells:matches.cells, points, chain });
    score += points;
  }
  // Also bounds pathological deterministic refill generators.
  if (findMatches(next).cells.length || !legalMoves(next).length) { next = createBoard(random); reshuffled = true; }
  return { board:next, score, waves, reshuffled };
}

export function levelConfig(level) {
  const n = Math.max(1, Math.floor(Number(level) || 1));
  return { target:600 + (n - 1) * 180, moves:Math.max(18, 28 - Math.floor((n - 1) / 3)) };
}
export function turnOutcome(state) {
  if (state.levelScore >= levelConfig(state.level).target) return 'level';
  return state.moves <= 0 ? 'gameover' : 'continue';
}
export function playMove(state, a, b, random = Math.random) {
  if (!adjacent(a, b) || state.moves <= 0 || turnOutcome(state) !== 'continue') return { valid:false, state };
  const board = swapBoard(state.board, a, b), matches = findMatches(board).cells;
  if (!matches.includes(a) && !matches.includes(b)) return { valid:false, state };
  const result = resolveBoard(board, random);
  const next = { ...state, board:result.board, score:state.score + result.score, levelScore:state.levelScore + result.score, moves:state.moves - 1 };
  return { valid:true, state:next, waves:result.waves, reshuffled:result.reshuffled, outcome:turnOutcome(next) };
}

const STYLES = `
.m3-game{max-width:620px;margin:0 auto;padding:12px;color:#eaf8ff;font-family:inherit}.m3-game *{box-sizing:border-box}.m3-game .m3-top{display:flex;justify-content:space-between;gap:10px;margin-bottom:14px}.m3-game .m3-stat{flex:1;background:linear-gradient(145deg,#223f58,#14263e);border:1px solid #6bd7e52b;border-radius:15px;padding:10px 12px}.m3-game .m3-label{font-size:12px;color:#b6d7e7}.m3-game .m3-value{font-size:24px;font-weight:800;font-variant-numeric:tabular-nums}.m3-game .m3-progress{height:7px;overflow:hidden;border-radius:10px;background:#102139;margin:0 0 14px}.m3-game .m3-progress span{display:block;height:100%;background:linear-gradient(90deg,#42d8c7,#ebda85);border-radius:10px}.m3-game .m3-board{display:grid;grid-template-columns:repeat(8,minmax(0,1fr));gap:5px;padding:10px;background:linear-gradient(140deg,#142d47,#09172c);border:1px solid #69b5c544;box-shadow:0 12px 30px #0003,inset 0 1px #ffffff17;border-radius:20px;touch-action:none;user-select:none}.m3-game .m3-cell{min-width:0;aspect-ratio:1;border:1px solid #b0e6ff0c;border-radius:11px;background:#ffffff06;padding:5px;display:grid;place-items:center;cursor:pointer;position:relative;touch-action:none}.m3-game .m3-cell:focus-visible{outline:3px solid #fff;outline-offset:1px;z-index:2}.m3-game .m3-cell[aria-pressed=true]{background:#def7ff24;border-color:#f1d68a;box-shadow:0 0 0 2px #f1d68a77,0 0 16px #edda7766;z-index:2}.m3-game .m3-gem{display:grid;place-items:center;width:100%;height:100%;filter:drop-shadow(0 3px 2px #0007);will-change:transform,opacity}.m3-game .m3-stone{width:91%;height:91%;display:grid;place-items:center;position:relative;background:radial-gradient(ellipse at 32% 20%,#ffffffcf,transparent 37%),linear-gradient(150deg,var(--light),var(--dark));box-shadow:inset 0 0 0 2px #ffffff5c,inset 0 -5px 7px #0003;border-radius:25%}.m3-game .m3-stone:after{content:attr(data-mark);color:#fff;font-size:clamp(12px,3vw,22px);line-height:1;text-shadow:0 1px 3px #0008;font-weight:900}.m3-game .m3-kind-0{--light:#ff819e;--dark:#b52155;clip-path:polygon(50% 0,100% 50%,50% 100%,0 50%);border-radius:0}.m3-game .m3-kind-1{--light:#ffc959;--dark:#b9741e;border-radius:50%}.m3-game .m3-kind-2{--light:#72eabc;--dark:#178770;clip-path:polygon(25% 3%,75% 3%,100% 50%,75% 97%,25% 97%,0 50%)}.m3-game .m3-kind-3{--light:#84c8ff;--dark:#305bbd;border-radius:17%}.m3-game .m3-kind-4{--light:#c5a0ff;--dark:#7441c1;clip-path:polygon(50% 0,100% 35%,82% 100%,18% 100%,0 35%)}.m3-game .m3-kind-5{--light:#ffaf83;--dark:#cb5430;clip-path:polygon(50% 0,100% 95%,0 95%)}.m3-game .m3-status{min-height:28px;text-align:center;color:#f2d890;font-size:14px;padding-top:12px}.m3-game .m3-help{color:#abc3d7;font-size:12px;line-height:1.7;text-align:center;margin:8px 0}.m3-game .m3-tools{display:flex;justify-content:center;margin-top:10px}.m3-game .m3-hint{border:1px solid #94ccdd55;border-radius:12px;padding:9px 18px;background:#21425b;color:#ebfaff;font:inherit;cursor:pointer}.m3-game .m3-cell.m3-suggest{box-shadow:inset 0 0 0 2px #faf3ac;background:#edd47933}@media(max-width:420px){.m3-game{padding:6px}.m3-game .m3-board{gap:3px;padding:7px;border-radius:15px}.m3-game .m3-cell{padding:3px;border-radius:7px}.m3-game .m3-stat{padding:8px}.m3-game .m3-value{font-size:20px}}
`;
const NAMES = ['红色菱形','金色圆形','绿色六角形','蓝色方形','紫色五角形','橙色三角形'];
const MARKS = ['◆','●','✚','■','★','▲'];

export function createMatch3Game(env, saved) {
  const doc = env.document || document, win = env.window || window;
  let destroyed = false, busy = false, finished = false, selected = -1, frame = 0, cancelTween = null, gesture = null;
  const validSaved = saved && Array.isArray(saved.board) && saved.board.length === 8 && saved.board.every(row => Array.isArray(row) && row.length === 8 && row.every(n => Number.isInteger(n) && n >= 0 && n < 6)) && ['score','levelScore','moves','level'].every(key => Number.isFinite(saved[key])) && saved.level >= 1 && saved.moves >= 0 && saved.score >= 0 && saved.levelScore >= 0;
  let state = validSaved ? { board:copy(saved.board), score:saved.score, levelScore:saved.levelScore, moves:Math.floor(saved.moves), level:Math.floor(saved.level) } : fresh(1, 0);
  if (findMatches(state.board).cells.length || !legalMoves(state.board).length) state.board = createBoard();
  function fresh(level, score) { return { board:createBoard(), level, score, levelScore:0, moves:levelConfig(level).moves }; }
  const style = doc.createElement('style'); style.textContent = STYLES;
  const shell = doc.createElement('section'); shell.className = 'm3-game'; shell.setAttribute('aria-label','宝石消消乐');
  shell.innerHTML = `<div class="m3-top"><div class="m3-stat"><div class="m3-label">关卡</div><div class="m3-value" data-stat="level"></div></div><div class="m3-stat"><div class="m3-label">本关 / 目标</div><div class="m3-value" data-stat="target"></div></div><div class="m3-stat"><div class="m3-label">剩余步数</div><div class="m3-value" data-stat="moves"></div></div></div><div class="m3-progress" role="progressbar" aria-label="本关得分进度"><span></span></div><div class="m3-board" role="group" aria-label="八行八列宝石棋盘"></div><div class="m3-status" role="status" aria-live="polite">交换相邻宝石，连成三个即可消除</div><div class="m3-tools"><button class="m3-hint" type="button">寻找一步</button></div><p class="m3-help">点选两颗相邻宝石，或滑动交换 · 无效交换不扣步数<br>四连 +20，五连 +50 · 连锁消除最高 ×5</p>`;
  env.root.append(style, shell);
  const boardEl = shell.querySelector('.m3-board'), status = shell.querySelector('.m3-status'), hint = shell.querySelector('.m3-hint');
  const buttons = Array.from({ length:64 }, (_, index) => {
    const button = doc.createElement('button'); button.className = 'm3-cell'; button.type = 'button'; button.dataset.index = index; button.setAttribute('aria-pressed','false');
    boardEl.append(button); return button;
  });
  const alive = () => !destroyed && (!env.isActive || env.isActive());
  const paused = () => !!env.isPaused?.();
  const snapshot = () => ({ ...state, board:copy(state.board) });
  const persist = force => { if (alive() && !finished) env.save(snapshot(), !!force); };
  function render(board = state.board) {
    buttons.forEach((button, index) => {
      const color = at(board, index);
      button.innerHTML = `<span class="m3-gem"><span class="m3-stone m3-kind-${color}" data-mark="${MARKS[color]}"></span></span>`;
      button.setAttribute('aria-label',`第${Math.floor(index / 8) + 1}行第${index % 8 + 1}列 ${NAMES[color]}`);
      button.setAttribute('aria-pressed',String(selected === index)); button.classList.remove('m3-suggest');
    });
    shell.querySelector('[data-stat=level]').textContent = state.level;
    shell.querySelector('[data-stat=target]').textContent = `${state.levelScore} / ${levelConfig(state.level).target}`;
    shell.querySelector('[data-stat=moves]').textContent = state.moves;
    const progress = shell.querySelector('.m3-progress');
    progress.setAttribute('aria-valuemin','0'); progress.setAttribute('aria-valuemax',String(levelConfig(state.level).target)); progress.setAttribute('aria-valuenow',String(Math.min(state.levelScore,levelConfig(state.level).target)));
    progress.firstElementChild.style.width = `${Math.min(100,state.levelScore / levelConfig(state.level).target * 100)}%`;
  }
  function tween(duration, update = () => {}) {
    return new Promise(resolve => {
      let elapsed = 0, previous = null;
      cancelTween = () => { cancelTween = null; resolve(false); };
      const tick = now => {
        if (!alive()) { cancelTween?.(); return; }
        const delta = previous === null ? 0 : (now - previous > 250 ? 0 : now - previous); previous = now;
        if (!paused()) { elapsed += delta; update(Math.min(1,elapsed / duration)); }
        if (elapsed >= duration) { cancelTween = null; frame = 0; resolve(true); }
        else frame = win.requestAnimationFrame(tick);
      };
      frame = win.requestAnimationFrame(tick);
    });
  }
  function swapVisual(a, b, reverse = false) {
    const rectA = buttons[a].getBoundingClientRect(), rectB = buttons[b].getBoundingClientRect();
    const x = rectB.left - rectA.left, y = rectB.top - rectA.top;
    return tween(170, t => {
      const p = reverse ? 1 - t : t;
      buttons[a].firstElementChild.style.transform = `translate(${x * p}px,${y * p}px)`;
      buttons[b].firstElementChild.style.transform = `translate(${-x * p}px,${-y * p}px)`;
    });
  }
  function settle() {
    env.setScore(state.score);
    const outcome = turnOutcome(state);
    if (outcome === 'level') {
      state = fresh(state.level + 1, state.score); status.textContent = `过关！进入第 ${state.level} 关`; env.speak?.('level_up'); env.toast?.(`目标达成！第 ${state.level} 关开始`); render();
    } else if (outcome === 'gameover') {
      finished = true; env.clear(); env.finish('本局完成',`到达第 ${state.level} 关，累计 ${state.score} 分`,{ outcome:'score',score:state.score },{ score:state.score,level:state.level }); return;
    }
    persist(true);
  }
  async function attempt(a, b) {
    if (!alive() || paused() || busy || finished) return;
    if (!adjacent(a, b)) { selected = b; render(); return; }
    busy = true; selected = -1; render(); hint.disabled = true;
    const result = playMove(state, a, b);
    if (!await swapVisual(a, b)) return;
    if (!result.valid) {
      status.textContent = '这一步没有连成三个，换个方向试试'; env.speak?.('invalid');
      if (!await swapVisual(a, b, true)) return;
      render();
    } else {
      for (const wave of result.waves) {
        render(wave.before); status.textContent = `${wave.chain > 1 ? `${wave.chain} 连锁！` : '消除！'} +${wave.points}`;
        if (!await tween(190, t => wave.cells.forEach(index => { const el = buttons[index].firstElementChild; el.style.transform = `scale(${1 - t * 0.85}) rotate(${t * 25}deg)`; el.style.opacity = String(1 - t); }))) return;
        render(wave.board);
        const affected = new Set(wave.cells.map(index => index % 8));
        if (!await tween(210, t => buttons.forEach((button, index) => { if (affected.has(index % 8)) { button.firstElementChild.style.transform = `translateY(${-20 * (1 - t)}px)`; button.firstElementChild.style.opacity = String(0.3 + 0.7 * t); } }))) return;
      }
      if (!alive()) return;
      state = result.state; render(); env.speak?.(result.waves.length > 1 ? 'streak' : 'merge');
      if (result.reshuffled) status.textContent = '棋盘已重新排列，继续消除吧';
      settle();
    }
    busy = false; hint.disabled = finished;
  }
  function choose(index) {
    if (!alive() || busy || finished || paused()) return;
    if (selected === index) { selected = -1; render(); }
    else if (selected < 0) { selected = index; render(); }
    else void attempt(selected, index);
  }
  function cellFrom(event) { const cell = event.target.closest?.('.m3-cell'); return cell && boardEl.contains(cell) ? Number(cell.dataset.index) : -1; }
  function click(event) { const index = cellFrom(event), suppressed = suppressClick; suppressClick = false; if (index >= 0 && (!suppressed || event.detail === 0)) choose(index); }
  let suppressClick = false;
  function down(event) { suppressClick = false; const index = cellFrom(event); if (index >= 0 && !busy && !paused()) gesture = { index,x:event.clientX,y:event.clientY,id:event.pointerId }; }
  function up(event) {
    if (!gesture || gesture.id !== event.pointerId) return;
    const start = gesture; gesture = null;
    const dx = event.clientX - start.x, dy = event.clientY - start.y;
    if (Math.max(Math.abs(dx),Math.abs(dy)) < 18) return;
    suppressClick = true;
    const to = start.index + (Math.abs(dx) > Math.abs(dy) ? Math.sign(dx) : Math.sign(dy) * 8);
    if (adjacent(start.index,to)) void attempt(start.index,to);
  }
  function cancel() { gesture = null; }
  function showHint() { if (!alive() || paused() || busy || finished) return; const move = legalMoves(state.board)[0]; if (move) { selected = -1; render(); move.forEach(index => buttons[index].classList.add('m3-suggest')); status.textContent = '试着交换这两颗发光的宝石'; } }
  boardEl.addEventListener('click',click); boardEl.addEventListener('pointerdown',down); win.addEventListener('pointerup',up); win.addEventListener('pointercancel',cancel); hint.addEventListener('click',showHint);
  render(); settle(); env.speak?.(validSaved ? 'resume' : 'start');
  return {
    getState:snapshot,
    save() { persist(true); },
    destroy() { if (destroyed) return; destroyed = true; if (frame) win.cancelAnimationFrame(frame); cancelTween?.(); boardEl.removeEventListener('click',click); boardEl.removeEventListener('pointerdown',down); win.removeEventListener('pointerup',up); win.removeEventListener('pointercancel',cancel); hint.removeEventListener('click',showHint); style.remove(); shell.remove(); },
  };
}
