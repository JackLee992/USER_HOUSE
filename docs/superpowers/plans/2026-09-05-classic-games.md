# Classic Games Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Track each deliverable below.

**Goal:** Repair Bubble Shooter timing and add playable classic FreeCell, pinball and match-three games to the fork.
**Architecture:** Preserve the legacy runtime and use its existing modularGameEnvironment for new standalone engines; keep simulation functions independently testable.
**Tech Stack:** JavaScript ES modules, Canvas 2D/DOM, CSS, node:test, Android Via.

## Global Constraints
- User-approved specification: ../specs/2026-09-05-classic-games-design.md.
- Work on the fork feature branch, not upstream/main.
- Each game owns its module and test file; controller owns runtime integration and shared CSS.
- No API credentials or user game saves in test fixtures. Game visuals use code/CSS/Canvas; original generated catalog art is being integrated.
- env contract: root, document, window, save(state,force), clear(), setScore(number), finish(title,text,result,meta), speak(event), toast(text), isPaused(), isActive().
- Controllers return {destroy, save, getState}; destroy cancels owned callbacks/listeners.

### Task 1: Bubble Shooter timing and lifecycle
- [x] Execute real startPaopao in tests/helpers/paopao-harness.mjs with synthetic frame timestamps; tests/paopao-timing.test.mjs demonstrates 7 failures on upstream.
- [x] Update falling integration by elapsed nominal frames, preserve collision substeps, freeze paused effects, cancel old animation/resize/delayed turn callbacks.
- [x] Run `node --test tests/paopao-timing.test.mjs` and existing tests, expect all pass.
- [x] Commit timing runtime and regression tests; Android Via A/B confirms pause freezing. Requested 60/10 callback rates are not measured native FPS; see regression report.

### Task 2: FreeCell
- [x] Create src/games/freecell.js and tests/freecell.test.mjs; assert 52 unique cards, exact deal sizes, color/rank legality, empty-cell capacity including empty destination exclusion, foundation order, undo and win.
- [x] Implement pure rules plus createFreeCellGame(env,state), exported by the module. Use DOM cards and scoped module stylesheet injected once.
- [x] Run `node --test tests/freecell.test.mjs`, self-review, commit only owned files.
- [x] Independent review of task diff; fix all material findings before acceptance.

### Task 3: Pinball
- [x] Create src/games/pinball.js and tests/pinball.test.mjs; tests cover launch, bumper/wall reflection, flipper impulse, drain, 3-ball end, bounded substeps and elapsed-time equivalence.
- [x] Implement createPinballGame(env,state), pure simulation exports, Canvas inclined table and touch/keyboard controls; inject scoped style once.
- [x] Run `node --test tests/pinball.test.mjs`, self-review, commit owned files; independently review and resolve defects.

### Task 4: Match-three
- [x] Create src/games/match3.js and tests/match3.test.mjs; test matching union (crosses), invalid swap restoration, valid swap consumption, gravity, legal starting board, reshuffle, cascades and level/end state.
- [x] Implement createMatch3Game(env,state), pure rule exports, clear DOM gem board and scoped style; use cancellable wall-time animations and pause-safe lifecycle.
- [x] Run `node --test tests/match3.test.mjs`, self-review, commit owned files; independently review and resolve defects.

### Task 5: Integration and delivery
- [x] Android Via touch regressions: FreeCell and Match3 legal actions, pause/resume, lobby progress restoration and viewport fit.
- [x] Add runtime-progress tests (2): recognize actual module snapshots; reject finished games.
- [x] Add runtime-restart tests (3): discard old controller snapshots before rendering a fresh game.
- [x] Pinball final Android screenshot verification after blank-canvas repair: six touch/state checks rerun and final flipper screenshot independently inspected.
- [x] Controller updates runtime imports/GAME_META/rules/hasPlayableProgress/startCurrentGame and core/metadata.js + manifest version; add Chinese README.
- [x] Full host harness smoke: open all games, legal moves, pause/resume, save/reload, restart/exit. Verify phone viewport and desktop appearance.
- [x] Run `node --test tests/*.test.mjs`; inspect diff and independent whole-branch review.
- [x] Push feature branch to origin. Per user request, merge the release into main so the repository URL installs the new version directly.

## Verification status — 2026-09-05

- Evidence and reproducible commands: [Android Via regression](../../via-regression.md).
- Original timing suite: 0/7 before, 7/7 after; expanded Bubble Shooter suite: 12/12. Final integrated test run: 49/49 including 5 runtime integration tests and a renderer DPI budget test.
- Android Emulator ARM64, Android 15/API 35, Via 7.3.3, WebView 124. Tests run actual plugin runtime with a minimal SillyTavern stub, not a complete SillyTavern installation or physical-phone certification.
- FreeCell and Match3 Android checks passed. Pinball blank canvas was fixed with a CPU-backed 2D context and aspect-ratio fit; seven input/state checks passed again after the perspective sci-fi renderer upgrade; final Android screenshots were visually inspected.
- Integration/version/README, three generated icons, final full suite and Android screenshot review are complete. Feature branch has been pushed; release is being fast-forwarded to main per the user installation preference.
