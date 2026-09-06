import {createCadetDisplay} from './display.js';
/* The engine lives in a same-origin iframe; each new game owns one WASM instance. */
(() => {
  'use strict';
  const session = new URLSearchParams(location.search).get('session');
  const canvas = document.querySelector('canvas');
  let started = false, ready = false, timer = null, lastSnapshot = null, display = null;
  const send = (type, payload = {}) => parent.postMessage({channel:'wb-cadet', session, type, ...payload}, location.origin);
  const call = (name, returnType, types = [], args = []) => Module.ccall(`cadet_${name}`, returnType, types, args);
  const fail = error => send('error', {message:String(error?.message || error)});
  function snapshot() {
    if (!ready) return;
    try {
      lastSnapshot = JSON.parse(call('snapshot', 'string'));
      send('snapshot', {state:lastSnapshot});
    } catch (error) { fail(error); }
  }
  function pause(value) {
    if (!ready) return;
    call('set_paused', null, ['number'], [value ? 1 : 0]);
    clearInterval(timer); timer = null;
    if (!value) timer = setInterval(snapshot, 100);
    snapshot();
  }
  function initialize(config) {
    if (started) return;
    started = true;
    display = createCadetDisplay(document.querySelector('#display'), () => window.Module, {useArtwork:!config.files?.length});
    window.Module = {
      canvas,
      cadetPresent:(...args) => display.present(...args),
      locateFile:path => new URL(path, location.href).href,
      preRun:[() => {
        for (const file of config.files || []) {
          if (!/^(PINBALL\.DAT|CADET\.DAT|sound\d+[a-z]?\.wav)$/i.test(file.name)) continue;
          const name = /\.dat$/i.test(file.name) ? file.name.toUpperCase() : file.name.toLowerCase();
          Module.FS.writeFile(`/game_resources/${name}`, new Uint8Array(file.bytes));
        }
        if (config.files?.length) {
          try { Module.FS.unlink('/game_resources/table.rgba'); } catch {}
        }
      }],
      print:() => {},
      printErr:message => { if (/abort|exception|error/i.test(message)) fail(message); },
      onAbort:fail,
      setStatus:message => { if (message) send('loading', {message}); },
      onRuntimeInitialized() {
        const check = setInterval(() => {
          try {
            if (!call('ready', 'number')) return;
            clearInterval(check); ready = true;
            call('new_game', null);
            if (config.checkpoint && Module._cadet_restore_checkpoint) {
              const s = config.checkpoint;
              call('restore_checkpoint', null, ['number','number','number','number'], [s.score || 0,s.lives || 3,s.rank || 0,s.rankProgress || 0]);
            }
            call('set_muted', null, ['number'], [config.muted ? 1 : 0]);
            pause(true); send('ready');
          } catch (error) { clearInterval(check); fail(error); }
        }, 25);
      },
    };
    const script = document.createElement('script');
    script.src = 'space-cadet.js'; script.onerror = () => fail('球台文件加载失败，请更新插件后重试。');
    document.body.appendChild(script);
  }
  addEventListener('message', event => {
    if (event.source !== parent || event.origin !== location.origin || event.data?.channel !== 'wb-cadet' || event.data.session !== session) return;
    const m = event.data;
    if (m.type === 'initialize') { initialize(m); return; }
    if (!ready) return;
    try {
      if (m.type === 'input') {
        // Resuming WebAudio here happens in response to a user's gesture in the host.
        if (m.down) Module.SDL2?.audioContext?.resume?.().catch(() => {});
        call('input', null, ['number','number'], [m.action,m.down ? 1 : 0]);
      }
      if (m.type === 'paused') pause(m.value);
      if (m.type === 'muted') call('set_muted', null, ['number'], [m.value ? 1 : 0]);
      if (m.type === 'snapshot') snapshot();
    } catch (error) { fail(error); }
  });
  addEventListener('pagehide', () => { clearInterval(timer); display?.destroy(); if (ready) call('set_paused', null, ['number'], [1]); });
  addEventListener('error', event => fail(event.message));
  canvas.addEventListener('contextmenu', event => event.preventDefault());
  // Only read-only inspection is exposed to the Android integration test.
  window.cadetInspection = () => lastSnapshot;
  window.cadetHost = {
    get ready() { return ready; },
    snapshot() { return ready ? JSON.parse(call('snapshot', 'string')) : null; },
    pause,
    input(action, down) {
      if (!ready) return;
      if (down) (Module.SDL2 || window.SDL2)?.audioContext?.resume?.().catch(() => {});
      call('input', null, ['number','number'], [action,down ? 1 : 0]);
    },
    mute(value) { if (ready) call('set_muted', null, ['number'], [value ? 1 : 0]); },
    quality(value) { display?.quality(value); },
    displayInspection() { return display?.inspection(); },
  };
  send('boot');
})();
