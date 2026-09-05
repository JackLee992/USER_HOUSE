import {validateCadetData} from './space-cadet-data.js';
const ENGINE_URL = new URL('../../assets/space-cadet/host.html', import.meta.url);
const sessions = new WeakMap();
const RANKS = ['学员','少尉','中尉','上尉','少校','中校','准将','上将','舰队司令'];
const clone = value => JSON.parse(JSON.stringify(value));

export function validCadetProgress(s) {
  return !!s && s.version === 2 && s.engine === 'space-cadet' && s.ready === true &&
    Number.isSafeInteger(s.score) && s.score >= 0 && s.score <= 9999999999 && Number.isInteger(s.lives) && s.lives > 0 && s.lives <= 3 && !s.gameover;
}
export function cadetCheckpoint(s) {
  if (!validCadetProgress(s)) return null;
  return {score:s.score,lives:s.lives,rank:Math.max(1,Math.min(9,s.rank | 0)),rankProgress:Math.max(0,Math.min(24,s.rankProgress | 0))};
}
export function validateCadetFiles(files) {
  if (!Array.isArray(files) || !files.some(f => /^(pinball|cadet)\.dat$/i.test(f.name))) throw Error('请选择 PINBALL.DAT 或 CADET.DAT，可同时选择 sound*.wav 音效。');
  if (files.filter(f => /\.dat$/i.test(f.name)).length !== 1) throw Error('一次只能选择一份 DAT 球台。');
  const names = new Set(); let total = 0;
  for (const f of files) {
    if (!/^(PINBALL\.DAT|CADET\.DAT|sound\d+[a-z]?\.wav)$/i.test(f.name)) throw Error('仅支持原版 DAT 球台和 sound*.wav 音效文件。');
    if (names.has(f.name.toLowerCase())) throw Error('不能选择同名素材。');
    names.add(f.name.toLowerCase()); total += f.size ?? f.bytes?.byteLength ?? 0;
    if (f.bytes && /\.dat$/i.test(f.name)) validateCadetData(f.bytes,f.name);
    if ((f.size ?? f.bytes?.byteLength ?? 0) > 32 * 1024 * 1024) throw Error('单个素材不能超过 32 MB。');
  }
  if (total > 64 * 1024 * 1024) throw Error('这组素材不能超过 64 MB。');
  return files;
}
async function resources(win, value) {
  if (!win.indexedDB) { if (value !== undefined) throw Error('浏览器未启用素材存储。'); return null; }
  const db = await new Promise((resolve,reject) => {
    const req = win.indexedDB.open('wanban-space-cadet-assets',1);
    req.onupgradeneeded = () => req.result.createObjectStore('resources');
    req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error);
  });
  try {
    return await new Promise((resolve,reject) => {
      const tx = db.transaction('resources',value === undefined ? 'readonly' : 'readwrite');
      const store = tx.objectStore('resources');
      const req = value === undefined ? store.get('selected') : value === null ? store.delete('selected') : store.put(value,'selected');
      tx.oncomplete = () => resolve(req.result || null); tx.onerror = () => reject(tx.error);
    });
  } finally { db.close(); }
}
function styles(doc) {
  if (doc.getElementById('wb-cadet-css')) return;
  const style = doc.createElement('style'); style.id = 'wb-cadet-css';
  style.textContent = `
.wb-cadet{height:100%;min-height:0;display:flex;flex-direction:column;gap:7px;padding:8px;box-sizing:border-box;color:#e9e9ec;background:linear-gradient(#161922,#090a10);overflow:hidden}
.wb-cadet .cd-hud{display:flex;align-items:center;justify-content:space-between;gap:6px;font:12px ui-monospace,monospace;color:#ffe5a1;flex:none}
.wb-cadet .cd-score{font-size:18px;color:#fff4cb;font-weight:800}
.wb-cadet .cd-stage{position:relative;flex:1;min-height:0;display:grid;place-items:center;overflow:hidden}
.wb-cadet .cd-loading{text-align:center;color:#b8becd;max-width:260px;font-size:13px;line-height:1.7}
.wb-cadet .cd-mission{flex:none;min-height:42px;max-height:72px;overflow:auto;padding:6px 10px;border:1px solid #626c87;background:#070a15;box-shadow:inset 0 0 14px #122c4c;font:12px/1.5 ui-monospace,monospace;text-align:center;color:#86eff4;white-space:pre-line}
.wb-cadet .cd-info{color:#ffce72;font-size:11px}
.wb-cadet .cd-controls{display:flex;gap:8px;flex:none}
.wb-cadet button{color:#faf6e7;border:1px solid #a79d9c;background:linear-gradient(#484454,#252332);border-radius:6px;font-family:inherit;font-size:13px;font-weight:700;line-height:1.3;min-height:44px;cursor:pointer;touch-action:none;user-select:none}
.wb-cadet .cd-controls button{flex:1}.wb-cadet .cd-controls button[data-action=launch]{background:linear-gradient(#755336,#342823);border-color:#c4a276}
.wb-cadet button:active,.wb-cadet .cd-held{background:#664957;box-shadow:inset 0 0 12px #fc85ab80}
.wb-cadet .cd-tools{display:flex;gap:6px;align-items:center;flex:none}.wb-cadet .cd-tools button{font-size:11px;min-height:28px;padding:3px 8px}.wb-cadet .cd-help{font-size:10px;line-height:1.5;color:#aeb4c3;flex:1;text-align:center}
.wb-cadet .cd-options{padding:8px;border:1px solid #a89da4;background:#1c1c29;font-size:12px;line-height:1.6;flex:none}.wb-cadet .cd-options[hidden]{display:none}.wb-cadet .cd-options button{min-height:32px;font-size:12px;margin:4px}
.wb-cadet-cover{position:absolute;z-index:7;display:grid;place-items:center;background:#0008;color:white;font:bold 36px system-ui;pointer-events:none;visibility:hidden;text-shadow:0 2px 8px #000}
.wb-cadet-frame{position:absolute;z-index:5;display:block;border:0;background:#020306;pointer-events:none;visibility:hidden}
@media(max-height:650px){.wb-cadet{gap:4px;padding:5px}.wb-cadet .cd-mission{min-height:28px;font-size:10px;padding:3px}.wb-cadet .cd-help{display:none}.wb-cadet .cd-controls button{min-height:38px}}
`;
  doc.head.appendChild(style);
}

export function createSpaceCadetGame(env, saved) {
  const {root,document:doc,window:win} = env;
  styles(doc);
  let destroyed = false, finished = false, lastSave = 0, paused = true, poll = 0, muted = false;
  let loadingResources = null, errorText = '', changingResources = false, entry = sessions.get(doc);
  const ownedListeners = [], held = new Set();
  const checkpoint = cadetCheckpoint(saved);
  const canReuse = entry?.iframe.isConnected && entry.ready && entry.id === saved?.sessionId && checkpoint;
  if (!canReuse && entry) { entry.iframe.remove(); entry.cover?.remove(); entry = null; }
  root.innerHTML = `<div class="wb-cadet"><div class="cd-hud"><span>SPACE CADET<br><b class="cd-score">0</b></span><span class="cd-rank">学员</span><span class="cd-lives">3 球</span></div><div class="cd-stage"><div class="cd-loading">正在装载完整球台…</div></div><div class="cd-mission"><div class="cd-task">击中任务靶选择任务，再上发射坡道接受</div><div class="cd-info">SPACE CADET</div></div><div class="cd-controls"><button type="button" data-action="left" aria-label="左挡板">◀ 左挡板</button><button type="button" data-action="launch">长按蓄力</button><button type="button" data-action="right" aria-label="右挡板">右挡板 ▶</button></div><div class="cd-tools"><button type="button" data-action="nudge" aria-label="向上震台">震台</button><span class="cd-help">长按约 3 秒松手发射 · 方向键挡板 · 连震会 TILT</span><button type="button" class="cd-sound">音效 开</button><button type="button" class="cd-assets">素材</button></div><div class="cd-options" hidden>内置完整球台与重绘素材。也可从本机选择原版 PINBALL.DAT／CADET.DAT 和 sound*.wav；素材仅保存在当前浏览器。更换素材会开始新局。<div><button class="cd-import">选择原版素材</button><button class="cd-default">使用内置重绘</button></div><input class="cd-files" type="file" accept=".dat,.wav" multiple hidden></div></div>`;
  const stage = root.querySelector('.cd-stage'), loading = root.querySelector('.cd-loading');
  const container = root.closest('#wanbanXiaowu-popup') || doc.body;
  if (!entry) {
    const id = `cadet-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    const iframe = doc.createElement('iframe'); iframe.className = 'wb-cadet-frame'; iframe.title = 'Space Cadet 完整球台'; iframe.allow = 'autoplay';
    const cover = doc.createElement('div'); cover.className = 'wb-cadet-cover'; cover.setAttribute('aria-hidden','true');
    entry = {id,iframe,cover,ready:false,state:null,files:null,muted:false}; sessions.set(doc,entry);
    loadingResources = resources(win).then(files => entry.files = files ? validateCadetFiles(files) : null).catch(() => null);
  }
  muted = !!entry.muted;
  const api = () => { try { return entry.iframe.contentWindow?.cadetHost; } catch { return null; } };
  const active = () => !destroyed && !finished && !changingResources && !doc.hidden && env.isActive() && !env.isPaused();
  const post = (type,payload = {}) => entry.iframe.contentWindow?.postMessage({channel:'wb-cadet',session:entry.id,type,...payload},ENGINE_URL.origin);
  function read() {
    const latest = api()?.snapshot();
    if (latest) entry.state = latest;
    return entry.state ? {version:2,engine:'space-cadet',sessionId:entry.id,...clone(entry.state)} : {version:2,engine:'space-cadet',sessionId:entry.id,ready:false,score:0,lives:3,gameover:false};
  }
  function save(force = false) {
    if (destroyed || finished || changingResources || !entry.ready) return;
    const s = read(); if (validCadetProgress(s)) env.save(s,force);
  }
  function release() {
    for (const action of held) api()?.input(action,false);
    held.clear(); root.querySelectorAll('.cd-held').forEach(b => b.classList.remove('cd-held'));
  }
  function layout() {
    if (destroyed || !entry.ready || !root.isConnected) return;
    const r = stage.getBoundingClientRect(), p = container.getBoundingClientRect();
    const sx = p.width / (container.offsetWidth || p.width || 1), sy = p.height / (container.offsetHeight || p.height || 1);
    const table = entry.state?.tableRect || {width:365,height:470};
    const scale = Math.min(r.width/table.width,r.height/table.height);
    const w = table.width*scale, h = table.height*scale;
    const box = {left:`${(r.left-p.left+(r.width-w)/2)/sx}px`,top:`${(r.top-p.top+(r.height-h)/2)/sy}px`,width:`${w/sx}px`,height:`${h/sy}px`};
    Object.assign(entry.iframe.style,{...box,visibility:'visible'});
    Object.assign(entry.cover.style,{...box,visibility:paused ? 'visible' : 'hidden'});
    entry.cover.textContent = doc.querySelector('.wb-pause-overlay')?.textContent.trim() || '已暂停';
  }
  function update() {
    if (destroyed || finished) return;
    if (!entry.ready) { loading.textContent = errorText || '正在装载完整球台…'; return; }
    loading.hidden = true;
    const nextPaused = !active();
    if (nextPaused !== paused) { paused = nextPaused; if (paused) release(); api()?.pause(paused); }
    const s = read();
    root.querySelector('.cd-score').textContent = Number(s.score || 0).toLocaleString();
    root.querySelector('.cd-lives').textContent = `${s.lives} 球${s.extraBalls ? ` +${s.extraBalls}` : ''}`;
    root.querySelector('.cd-rank').textContent = `${RANKS[Math.max(0,Math.min(8,(s.rank || 1)-1))]} · ${[1,2,3,5,10][s.multiplier] || 1}×`;
    root.querySelector('.cd-task').textContent = s.mission === 'Awaiting Deployment' ? '击任务靶选择 → 上坡接受任务' : s.mission || '击任务靶选择 → 上坡接受任务';
    root.querySelector('.cd-info').textContent = s.paused ? '已暂停 · 点击上方“继续”' : s.tilted ? 'TILT · 本球挡板已锁定' : (s.info === 'Continue Play' ? '继续游戏' : s.info || '完成任务积累军衔 · 燃料用尽任务失败');
    const charge = Math.min(100,Math.round(100*(s.plungerBoost || 0)/(s.plungerMax || 100)));
    const launch = root.querySelector('[data-action=launch]');
    launch.textContent = held.has(2) ? `蓄力 ${charge}% · 松手发射` : '长按蓄力';
    env.setScore(s.score || 0);
    layout();
    if (s.gameover && !finished) {
      finished = true; win.clearInterval(poll); release(); api()?.pause(true); entry.iframe.style.visibility = 'hidden'; entry.cover.style.visibility = 'hidden'; env.clear();
      env.finish('弹球结束',`Space Cadet · 本局 ${s.score} 分`,{outcome:'score',score:s.score},{score:s.score,details:{rank:s.rank,classic:true}});
    } else if (Date.now()-lastSave > 1500) { save(); lastSave = Date.now(); }
  }
  function on(target,type,fn,opts) { target.addEventListener(type,fn,opts); ownedListeners.push(() => target.removeEventListener(type,fn,opts)); }
  on(win,'message',async event => {
    if (event.source !== entry.iframe.contentWindow || event.origin !== ENGINE_URL.origin || event.data?.channel !== 'wb-cadet' || event.data.session !== entry.id || destroyed) return;
    const m = event.data;
    if (m.type === 'boot') { await loadingResources; if (!destroyed) post('initialize',{files:entry.files || [],checkpoint,muted}); }
    if (m.type === 'snapshot' && !changingResources) entry.state = m.state;
    if (m.type === 'ready') {
      entry.ready = true; paused = true; update();
      if (checkpoint && !canReuse) env.toast('已恢复分数、球数和军衔，从新球继续。');
    }
    if (m.type === 'error') { errorText = `球台加载失败：${m.message}`; loading.hidden = false; loading.textContent = errorText; }
  });
  const actions = {left:0,right:1,launch:2,nudge:5};
  function press(action) { if (!active() || !entry.ready || held.has(action)) return; held.add(action); api()?.input(action,true); }
  function lift(action) { held.delete(action); api()?.input(action,false); }
  root.querySelectorAll('[data-action]').forEach(button => {
    const action = actions[button.dataset.action];
    on(button,'pointerdown',event => { event.preventDefault(); button.setPointerCapture?.(event.pointerId); press(action); if (held.has(action)) button.classList.add('cd-held'); });
    on(button,'pointerup',event => { event.preventDefault(); lift(action); button.classList.remove('cd-held'); });
    for (const type of ['pointercancel','lostpointercapture']) on(button,type,() => { lift(action); button.classList.remove('cd-held'); });
  });
  const key = event => ({ArrowLeft:0,ArrowRight:1,Space:2,KeyZ:3,Slash:4,ArrowUp:5}[event.code]);
  on(win,'keydown',event => { const action = key(event); if (action !== undefined && active() && !/INPUT|TEXTAREA|SELECT/.test(event.target?.tagName || '')) { event.preventDefault(); if (!event.repeat) press(action); } });
  on(win,'keyup',event => { const action = key(event); if (action !== undefined && held.has(action)) { event.preventDefault(); lift(action); } });
  on(win,'blur',release); on(doc,'visibilitychange',() => { release(); update(); });
  on(win,'resize',layout); on(doc,'scroll',layout,true);
  const observer = win.ResizeObserver ? new win.ResizeObserver(layout) : null; observer?.observe(stage);
  const sound = root.querySelector('.cd-sound');
  sound.textContent = `音效 ${muted ? '关' : '开'}`;
  on(sound,'click',() => { muted = !muted; entry.muted = muted; api()?.mute(muted); sound.textContent = `音效 ${muted ? '关' : '开'}`; });
  const options = root.querySelector('.cd-options'), filesInput = root.querySelector('.cd-files');
  on(root.querySelector('.cd-assets'),'click',() => { options.hidden = !options.hidden; layout(); });
  on(root.querySelector('.cd-import'),'click',() => filesInput.click());
  async function changeResources(files) {
    if (destroyed || changingResources) return;
    changingResources = true; release(); api()?.pause(true);
    try {
      await resources(win,files);
      if (destroyed || sessions.get(doc) !== entry) return;
      entry.ready = false; entry.state = null; entry.iframe.remove(); entry.cover.remove(); sessions.delete(doc); env.clear();
      errorText = '素材已准备好，点击上方“重开”。';
      loading.hidden = false; loading.textContent = errorText;
      env.toast('素材已保存，请点击上方“重开”载入新球台。');
    } catch (error) {
      if (destroyed || sessions.get(doc) !== entry) return;
      changingResources = false; env.toast(error.message || '素材保存失败。'); api()?.pause(!active());
    }
  }
  on(filesInput,'change',async () => {
    try { const files = validateCadetFiles([...filesInput.files]); await changeResources(validateCadetFiles(await Promise.all(files.map(async f => ({name:f.name,bytes:await f.arrayBuffer()}))))); }
    catch (error) { env.toast(error.message); }
  });
  on(root.querySelector('.cd-default'),'click',() => changeResources(null));
  if (!canReuse) {
    entry.iframe.src = `${ENGINE_URL.href}?session=${encodeURIComponent(entry.id)}`;
    container.append(entry.iframe,entry.cover);
  } else { paused = true; api()?.pause(true); update(); }
  poll = win.setInterval(update,100);
  return {
    getState:read,
    save:() => save(true),
    destroy() {
      if (destroyed) return;
      release(); api()?.pause(true); entry.state = api()?.snapshot() || entry.state; entry.iframe.style.visibility = 'hidden'; entry.cover.style.visibility = 'hidden';
      destroyed = true; win.clearInterval(poll); observer?.disconnect(); ownedListeners.forEach(fn => fn());
    },
  };
}
