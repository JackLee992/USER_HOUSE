# Classic Games Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Track each deliverable below.

**Goal:** Repair Bubble Shooter timing and add playable classic FreeCell, pinball and match-three games to the fork.
**Architecture:** Preserve the legacy runtime and use its existing modularGameEnvironment for new standalone engines; keep simulation functions independently testable.
**Tech Stack:** JavaScript ES modules, Canvas 2D/DOM, CSS, node:test, Android Via.

## Global Constraints
- User-approved specification: ../specs/2026-09-05-classic-games-design.md.
- Work on the fork feature branch, not upstream/main.
- Each game owns its module and test file; controller owns runtime integration and shared CSS.
- No API credentials or user game saves in test fixtures. New art uses code/CSS and Unicode.
- env contract: root, document, window, save(state,force), clear(), setScore(number), finish(title,text,result,meta), speak(event), toast(text), isPaused(), isActive().
- Controllers return {destroy, save, getState}; destroy cancels owned callbacks/listeners.

### Task 1: Bubble Shooter timing and lifecycle
- [x] Execute real startPaopao in tests/helpers/paopao-harness.mjs with synthetic frame timestamps; tests/paopao-timing.test.mjs demonstrates 7 failures on upstream.
- [ ] Update falling integration by elapsed nominal frames, preserve collision substeps, freeze paused effects, cancel old animation/resize/delayed turn callbacks.
- [ ] Run `node --test tests/paopao-timing.test.mjs` and existing tests, expect all pass.
- [ ] Commit runtime and regression tests, verify Android Via full rendering.

### Task 2: FreeCell
- [ ] Create src/games/freecell.js and tests/freecell.test.mjs; assert 52 unique cards, exact deal sizes, color/rank legality, empty-cell capacity including empty destination exclusion, foundation order, undo and win.
- [ ] Implement pure rules plus createFreeCellGame(env,state), exported by the module. Use DOM cards and scoped module stylesheet injected once.
- [ ] Run `node --test tests/freecell.test.mjs`, self-review, commit only owned files.
- [ ] Independent review of task diff; fix all material findings before acceptance.

### Task 3: Pinball
- [ ] Create src/games/pinball.js and tests/pinball.test.mjs; tests cover launch, bumper/wall reflection, flipper impulse, drain, 3-ball end, bounded substeps and elapsed-time equivalence.
- [ ] Implement createPinballGame(env,state), pure simulation exports, Canvas inclined table and touch/keyboard controls; inject scoped style once.
- [ ] Run `node --test tests/pinball.test.mjs`, self-review, commit owned files; independently review and resolve defects.

### Task 4: Match-three
- [ ] Create src/games/match3.js and tests/match3.test.mjs; test matching union (crosses), invalid swap restoration, valid swap consumption, gravity, legal starting board, reshuffle, cascades and level/end state.
- [ ] Implement createMatch3Game(env,state), pure rule exports, clear DOM gem board and scoped style; use cancellable wall-time animations and pause-safe lifecycle.
- [ ] Run `node --test tests/match3.test.mjs`, self-review, commit owned files; independently review and resolve defects.

### Task 5: Integration and delivery
- [ ] Controller updates runtime imports/GAME_META/rules/hasPlayableProgress/startCurrentGame and core/metadata.js + manifest version; add Chinese README.
- [ ] Full host harness smoke: open all games, legal moves, pause/resume, save/reload, restart/exit. Verify phone viewport and desktop appearance.
- [ ] Run `node --test tests/*.test.mjs`; inspect diff and independent whole-branch review.
- [ ] Push feature branch to origin, verify remote commit and provide exact install branch/URL plus evidence and limits.
