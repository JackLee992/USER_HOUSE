# Local Space Cadet WASM build

This build uses the complete MIT-licensed Space Cadet engine, original CC0 Open Cadet data, and an original true-color playfield override. It does not bundle Microsoft game data.

Pinned source:
- Engine: https://github.com/alula/SpaceCadetPinball/commit/0bc12d3ca97a30a61e1e325cfde1eeec379bb9b9
- Open data: https://github.com/andrewnakas/open-cadet/commit/4ae332be705f86bfb62f8d8ac1dc1f11918977dd
- Emscripten 3.1.74 (LLVM SDK c2655005234810c7c42e02a18e4696554abe0352)
- SDL 2.30.9 and SDL_mixer 2.8.0, fetched and SHA-512 checked by Emscripten's ports.
- CMake 3.16+ and Ninja; C++11, release optimization, no pthreads.

`source.patch` contains all engine changes, including the browser bridge. Apply to the pinned engine checkout, copy the CC0 PINBALL.DAT + sound*.wav into game_resources/, and optionally place table.rgba there (exactly playfield width * height * 4 bytes; top-down RGBA; current data 365x470). Keep the generated playfield source and its provenance in the host repository. Music soundfont is disabled; WAV effects stay enabled.

```sh
# After activating Emscripten 3.1.74 via emsdk_env.sh:
git apply /path/to/source.patch
emcmake cmake -S . -B build -G Ninja -DCMAKE_BUILD_TYPE=Release -DMUSIC_TSF=OFF
cmake --build build --parallel 6
# Copy bin/space-cadet.js, bin/space-cadet.wasm and bin/space-cadet.data together.
```

To rebuild .data after adding or replacing art without a source edit, touch SpaceCadetPinball/cadet_bridge.cpp before the build. The linker preloads the complete game_resources directory.

## Module contract

Create a dedicated iframe per live game instance. Define global `Module` before loading space-cadet.js: `{canvas, locateFile, preRun, onRuntimeInitialized, printErr}`. Assets are loaded locally; no runtime CDN is required. `onRuntimeInitialized` occurs before main(); poll `Module._cadet_ready()` until it returns 1. The initialized game is paused. The bridge sets canvas width/height to the actual playfield and crops out the legacy sidebar/menu.

Use Module.ccall; numeric parameters are JavaScript numbers:
- `cadet_ready(): number`
- `cadet_new_game(): void`: new one-player game, resume loop.
- `cadet_input(action, down): void`: 0 left flipper, 1 right flipper, 2 spring plunger, 3 left nudge, 4 right nudge, 5 forward nudge. down is 0/1; duplicate states are ignored.
- `cadet_set_paused(0|1): void`: idempotent, releases all controls on pause, stops the Emscripten RAF loop and audio, resets time accumulation on resume.
- `cadet_set_muted(0|1): void`: toggles WAV sound effects.
- `cadet_restore_checkpoint(score, lives, rank, rankProgress): void`: deliberately starts a **new ball**, retaining total score, remaining normal balls, rank lamps, and rank-progress lamps. It does not restore an in-flight ball, active mission, fuel, multiplier, bonus, or extra balls. Score capped 9,999,999,999, normal lives 1..3, rank 1..9, progress 0..24. The opening light-show callback is completed before restoring lamps, so it cannot clear them later.
- `cadet_snapshot(): string`: JSON with ready, renderer, score, lives, extraBalls, gameover, paused, gameMode, rank, rankProgress, missionId, mission, info, tilted, multiplier (engine index), plungerBoost/plungerMax/plungerIncrement, components, elapsedMs, ticks, tableRect, left/right (actual radians), inputs[6], balls[{active,x,y,z,speed,vx,vy}]. No arbitrary writes or test-only APIs are exposed.

Use `Module.ccall('cadet_snapshot','string',[],[])` for the JSON; all other procedures return null except ready. `FS`, `ccall`, `cwrap`, and `UTF8ToString` are exported. A caller may replace data in /game_resources through FS during preRun. For original data imports, remove table.rgba to avoid applying the default artwork to custom data. Recreate the iframe to fully reload data. An imported DAT must be validated before giving it to the legacy engine.

Do not reconstruct complete in-flight state from JSON: it omits the many component/timer state machines. Preserve the paused iframe session for exact same-page navigation. Use explicitly labelled new-ball checkpoints after page refresh.

## Timing/rendering changes

The web bridge uses RAF for display and 8ms real elapsed-time physics steps. Up to 250ms of delayed foreground time is simulated per frame; gaps over 1 second are discarded. Pausing resets accumulated time and calls emscripten_pause_main_loop. Focus changes caused by host touch controls do not implicitly stop the table. Visible rendering uses the real playfield dimensions (Open Cadet 365x470), and the framebuffer grows when a data pack is taller than the original fixed 416px viewport.

The optional true-color override only replaces the loaded playfield RGBA buffer. Original geometry, ramp elevation, collision surfaces, sprite layers, z-map and lamp/target sprites remain engine-driven.

The web build selects SDL_RENDERER_SOFTWARE, presenting the existing CPU-rasterized table through Canvas2D. This removes a redundant WebGL texture-upload/compositor layer from an engine that already rasterizes its table on the CPU. It has been verified with Android Via using native ADB screenshots; CDP screenshots can omit this iframe and must not be used alone to infer rendering failure. Native desktop builds retain SDL_RENDERER_ACCELERATED. The snapshot renderer field identifies the selected backend.
