import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';

const source = readFileSync(new URL('../src/runtime/wanban-app.js', import.meta.url), 'utf8');
const stopSource = source.split('\n').find(line => line.startsWith('  function stopGame()'));
const restartSource = source.split('\n').find(line => line.includes("qs('#wb-restart').onclick ="));

for (const id of ['freecell', 'pinball', 'match3']) test(`confirmed ${id} restart discards controller snapshot before rendering`, () => {
  const nodes = new Map();
  let stored = { moves:7, score:200 }, destroyed = false;
  const noop = () => {};
  const context = vm.createContext({
    id, qs:selector => { if (!nodes.has(selector)) nodes.set(selector, {}); return nodes.get(selector); },
    activeGameController:{ save:() => { stored = { moves:7, score:200 }; }, destroy:() => { destroyed = true; } },
    clearProgress:() => { stored = null; },
    commitGameActiveDuration:noop, showGamePauseOverlay:noop, hideGamePauseOverlay:noop,
    flushAllProgressSaves:noop, clearGameDurationRewardTimer:noop,
    showConfirm:(_title, _text, accept) => accept(), startPauseResumeCountdown:noop,
    getHostDocument:() => ({}), clearTimeout:noop, clearInterval:noop,
    gamePaused:false, gameStarted:true, gameActiveStartedAt:1, firstMoverAwaitingUserAction:false,
    snakeTimer:null, tetrisTimer:null, watermelonTimer:null, jumpTimer:null, screwTimer:null,
    linkLinkTimer:null, shuerteTimer:null, randomLineTimer:null, singleDialogueTimer:null, singleDialogueQueue:null,
    // renderGame begins by stopping the current controller before querying progress.
    renderGame:() => { context.stopGame(); assert.equal(stored, null, 'fresh-game screen must not recover discarded progress'); },
  });
  vm.runInContext(stopSource, context);
  vm.runInContext(restartSource, context);
  nodes.get('#wb-restart').onclick();
  assert.equal(destroyed, true);
  assert.equal(stored, null);
});
