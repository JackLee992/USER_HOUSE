const W=420,H=680,R=8,STEP=1/240;
const BUMPERS=[{x:140,y:230,r:24},{x:270,y:230,r:24},{x:205,y:320,r:27}];
const TARGETS=[{x:85,y:145,r:13},{x:205,y:115,r:13},{x:325,y:145,r:13}];
const WALLS=[[35,100,35,465],[35,100,85,55],[85,55,350,55],[350,55,405,100],[405,100,405,640],[370,155,370,640],[35,465,35,640],[35,465,105,545],[365,465,295,545]];
export function newPinball(){return {version:1,score:0,lives:3,phase:'ready',lane:true,ball:{x:390,y:600,vx:0,vy:0},left:0,right:0,accumulator:0,lights:[0,0,0,0,0,0]};}
export function restorePinball(s){
  if(!s||s.version!==1||!Number.isSafeInteger(s.score)||s.score<0||!Number.isInteger(s.lives)||s.lives<0||s.lives>3||!['ready','play','over'].includes(s.phase)||!s.ball||!['x','y','vx','vy'].every(k=>Number.isFinite(s.ball[k]))||s.ball.x<0||s.ball.x>W||s.ball.y<0||s.ball.y>710||Math.abs(s.ball.vx)>1300||Math.abs(s.ball.vy)>1300||typeof s.lane!=='boolean'||(s.phase==='over')!==(s.lives===0))return newPinball();
  const n=newPinball();Object.assign(n,{score:s.score,lives:s.lives,phase:s.phase,lane:s.lane,ball:{...s.ball}});if(s.phase==='ready'){n.ball={x:390,y:600,vx:0,vy:0};n.lane=true;}return n;
}
export function launchPinball(s,charge=0){if(s.phase!=='ready')return false;s.phase='play';s.lane=true;s.ball={x:390,y:600,vx:0,vy:-(960+Math.max(0,Math.min(1,Number(charge)||0))*160)};return true;}
function segment(s,x1,y1,x2,y2,r=4,kick=0){
  const b=s.ball,dx=x2-x1,dy=y2-y1,t=Math.max(0,Math.min(1,((b.x-x1)*dx+(b.y-y1)*dy)/(dx*dx+dy*dy))),px=x1+t*dx,py=y1+t*dy;
  let nx=b.x-px,ny=b.y-py,d=Math.hypot(nx,ny);if(d>=R+r)return false;if(d<.0001){nx=0;ny=-1;d=1;}else{nx/=d;ny/=d;}
  b.x=px+nx*(R+r+.05);b.y=py+ny*(R+r+.05);const dot=b.vx*nx+b.vy*ny;if(dot<0){b.vx-=1.8*dot*nx;b.vy-=1.8*dot*ny;}if(kick&&ny<.3){b.vy=Math.min(b.vy,-kick);b.vx+=(200-b.x)*2;}return true;
}
function tick(s,input){
  s.lights=s.lights.map(v=>Math.max(0,v-STEP));
  const oldLeft=s.left,oldRight=s.right;s.left+=Math.max(-STEP*12,Math.min(STEP*12,(input.left?1:0)-s.left));s.right+=Math.max(-STEP*12,Math.min(STEP*12,(input.right?1:0)-s.right));
  if(s.phase!=='play')return;
  const b=s.ball;b.vy+=520*STEP;b.x+=b.vx*STEP;b.y+=b.vy*STEP;
  if(s.lane&&b.y<150){s.lane=false;b.x=350;b.vx=-300;b.vy=Math.min(b.vy,-160);}
  // A returned launch-lane ball is served again without taking a life.
  if(s.lane&&b.y>620){s.phase='ready';s.ball={x:390,y:600,vx:0,vy:0};return;}
  WALLS.forEach(w=>segment(s,...w));
  if(!s.lane){
    [...BUMPERS,...TARGETS].forEach((p,i)=>{let dx=b.x-p.x,dy=b.y-p.y,d=Math.hypot(dx,dy);if(d<R+p.r){if(d<.001){dx=0;dy=-1;d=1;}const nx=dx/d,ny=dy/d;b.x=p.x+nx*(R+p.r+.1);b.y=p.y+ny*(R+p.r+.1);const dot=b.vx*nx+b.vy*ny;if(dot<0){const speed=i<3?520:400;b.vx=nx*speed;b.vy=ny*speed;if(!s.lights[i])s.score+=i<3?100:250;s.lights[i]=.18;}}});
    segment(s,105,545,175,570-65*s.left,9,input.left?(s.left>oldLeft?820:580):0);
    segment(s,295,545,225,570-65*s.right,9,input.right?(s.right>oldRight?820:580):0);
    if(b.y>695){s.lives--;s.phase=s.lives?'ready':'over';s.ball={x:390,y:600,vx:0,vy:0};s.lane=true;}
  }
  const speed=Math.hypot(b.vx,b.vy);if(speed>1150){b.vx*=1150/speed;b.vy*=1150/speed;}
}
export function advancePinball(s,elapsed,input={}){if(!Number.isFinite(elapsed)||elapsed<=0)return s;s.accumulator+=Math.min(.15,elapsed);while(s.accumulator+1e-10>=STEP){tick(s,input);s.accumulator-=STEP;}return s;}
function styles(doc){if(doc.getElementById('wb-pinball-css'))return;const e=doc.createElement('style');e.id='wb-pinball-css';e.textContent=`.wb-pinball{height:100%;min-height:0;display:flex;flex-direction:column;align-items:center;gap:6px;padding:8px;box-sizing:border-box;background:radial-gradient(ellipse at top,#183447,#070e17);color:#daf6ff;overflow:hidden}.wb-pinball .pb-hud{width:min(100%,430px);display:flex;justify-content:space-between;font:12px monospace}.wb-pinball .pb-stage{min-height:0;flex:1;width:100%;display:flex;justify-content:center;align-items:center;overflow:hidden}.wb-pinball canvas{display:block;width:100%;height:100%;object-fit:contain;touch-action:none}.wb-pinball .pb-controls{display:flex;gap:10px;width:min(100%,430px)}.wb-pinball button{flex:1;min-height:46px;border-radius:9px;border:1px solid #5e94a4;background:linear-gradient(#284b5f,#122834);color:#e3faff;font-weight:700;touch-action:none;user-select:none}.wb-pinball button:active,.wb-pinball button.pb-held{background:#296c83;box-shadow:inset 0 0 12px #56ddff80}.wb-pinball .pb-help{margin:0;font-size:11px;color:#9db7c6;text-align:center}`;doc.head.appendChild(e);}
export function createPinballGame(env,state){
 const {root,document:doc,window:win}=env;styles(doc);let s=restorePinball(state),destroyed=false,finished=false,last=null,raf=0,lastSave=0,charge=0,charging=false;
 const input={left:false,right:false},cleanups=[];root.innerHTML='<div class="wb-pinball"><div class="pb-hud"><span class="pb-score"></span><span class="pb-lives"></span></div><div class="pb-stage"><canvas width="420" height="680" aria-label="星港弹球台：左右方向键操作挡板，按住空格蓄力后松开发射" role="img"></canvas></div><div class="pb-controls"><button data-action="left" aria-label="左挡板">◀ 左挡板</button><button data-action="launch">按住发射</button><button data-action="right" aria-label="右挡板">右挡板 ▶</button></div><p class="pb-help">方向键控制挡板 · 按住空格蓄力，松开发射 · 共 3 球</p></div>';
 // A CPU-backed context avoids blank accelerated Canvas layers in Android WebView.
 const canvas=root.querySelector('canvas'),ctx=canvas.getContext('2d',{willReadFrequently:true}),score=root.querySelector('.pb-score'),lives=root.querySelector('.pb-lives'),launch=root.querySelector('[data-action="launch"]');
 const data=()=>JSON.parse(JSON.stringify(s));const save=(force=false)=>{if(!finished&&!destroyed)env.save(data(),force);};const active=()=>!destroyed&&!finished&&!doc.hidden&&!env.isPaused()&&env.isActive();
 function clearInput(){input.left=input.right=false;charging=false;charge=0;root.querySelectorAll('.pb-held').forEach(b=>b.classList.remove('pb-held'));last=null;}
 function press(action){if(!active())return;if(action==='launch'){if(s.phase==='ready'){charging=true;charge=0;}}else input[action]=true;}
 function release(action){if(action==='launch'){if(charging&&active()){launchPinball(s,charge);save(true);}charging=false;charge=0;}else input[action]=false;}
 function on(target,type,fn,opts){target.addEventListener(type,fn,opts);cleanups.push(()=>target.removeEventListener(type,fn,opts));}
 root.querySelectorAll('[data-action]').forEach(button=>{const a=button.dataset.action;on(button,'pointerdown',e=>{e.preventDefault();button.setPointerCapture?.(e.pointerId);press(a);button.classList.add('pb-held');});on(button,'pointerup',e=>{e.preventDefault();release(a);button.classList.remove('pb-held');});on(button,'pointercancel',()=>{if(a==='launch'){charging=false;charge=0;}else input[a]=false;button.classList.remove('pb-held');});on(button,'lostpointercapture',()=>{if(a==='launch'){charging=false;charge=0;}else input[a]=false;button.classList.remove('pb-held');});});
 const key=e=>({ArrowLeft:'left',ArrowRight:'right',Space:'launch'}[e.code]);on(win,'keydown',e=>{const a=key(e);if(a&&active()){e.preventDefault();if(!e.repeat)press(a);}});on(win,'keyup',e=>{const a=key(e);if(a){if(active())e.preventDefault();release(a);}});on(win,'blur',clearInput);on(doc,'visibilitychange',clearInput);
 function path(points,color,width=1){ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(...p):ctx.moveTo(...p));ctx.strokeStyle=color;ctx.lineWidth=width;ctx.lineCap='round';ctx.stroke();}
 function circle(x,y,r,fill,stroke){ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=2;ctx.stroke();}}
 function draw(){
  ctx.clearRect(0,0,W,H);ctx.fillStyle='#050c13';ctx.fillRect(16,40,398,630);const bg=ctx.createLinearGradient(0,55,0,665);bg.addColorStop(0,'#18374a');bg.addColorStop(1,'#091a29');ctx.fillStyle=bg;ctx.beginPath();ctx.moveTo(85,50);ctx.lineTo(350,50);ctx.lineTo(410,100);ctx.lineTo(410,650);ctx.lineTo(30,650);ctx.lineTo(30,100);ctx.closePath();ctx.fill();
  for(let y=120;y<610;y+=42)path([[45,y],[360,y]],'#20404d',1);for(let x=65;x<365;x+=42)path([[205+(x-205)*.65,75],[x,630]],'#20404d',1);
  ctx.textAlign='center';ctx.fillStyle='#b6e7ee';ctx.font='bold 23px monospace';ctx.fillText('STAR HARBOR',205,405);ctx.font='10px monospace';ctx.fillStyle='#6699aa';ctx.fillText('星 港 · ORBITAL ARCADE',205,425);
  WALLS.forEach(w=>{path([[w[0]+2,w[1]+6],[w[2]+2,w[3]+6]],'#01060b',13);path([[w[0],w[1]],[w[2],w[3]]],'#35596b',9);path([[w[0]-1,w[1]-2],[w[2]-1,w[3]-2]],'#8eabb9',2);});
  [...BUMPERS,...TARGETS].forEach((p,i)=>{circle(p.x+3,p.y+7,p.r+3,'#0009');circle(p.x,p.y,p.r+3,'#152b3e','#6d8c9d');circle(p.x,p.y-3,p.r-2,s.lights[i]?'#fff7b0':i<3?'#23aeca':'#dba451',s.lights[i]?'#fff':'#b3f5ff');circle(p.x-5,p.y-9,p.r*.25,'#ffffff65');ctx.fillStyle='#123145';ctx.font='bold 12px monospace';ctx.fillText(i<3?'100':'250',p.x,p.y+1);});
  [[105,175,s.left],[295,225,s.right]].forEach(([x,tip,up])=>{path([[x+2,552],[tip+2,577-65*up]],'#000b',22);path([[x,545],[tip,570-65*up]],'#ac692f',20);path([[x,542],[tip,567-65*up]],'#ffd278',13);circle(x,543,6,'#b5c9cc','#445661');});
  path([[382,635],[398,635]],'#e8c46b',6);ctx.fillStyle='#e8c46b';ctx.fillRect(385,610+charge*15,10,18);ctx.fillStyle='#02070b';ctx.fillRect(170,643,60,12);ctx.fillStyle='#6ba1b5';ctx.font='10px monospace';ctx.fillText('DRAIN',200,661);
  const b=s.ball;circle(b.x+3,b.y+5,R+1,'#0009');const metal=ctx.createRadialGradient(b.x-3,b.y-4,1,b.x,b.y,R);metal.addColorStop(0,'white');metal.addColorStop(.3,'#edf8ff');metal.addColorStop(.65,'#9faeba');metal.addColorStop(1,'#344958');circle(b.x,b.y,R,metal);
  if(s.phase==='ready'){ctx.fillStyle='#07121bce';ctx.fillRect(64,450,285,44);ctx.fillStyle='#e7f8ff';ctx.font='14px sans-serif';ctx.fillText(charging?`蓄力 ${Math.round(charge*100)}% · 松开发射`:'按住「发射」或空格开始',206,478);}
  score.textContent=`得分 ${s.score.toLocaleString()}`;lives.textContent=`剩余 ${s.lives} 球`;launch.textContent=charging?`蓄力 ${Math.round(charge*100)}%`:s.phase==='play'?'弹球进行中':'按住发射';
 }
 function frame(now){if(destroyed)return;if(active()){const dt=last===null?0:Math.min(.15,(now-last)/1000);last=now;if(charging)charge=Math.min(1,charge+dt*.8);const old=s.score;advancePinball(s,dt,input);if(old!==s.score)env.setScore(s.score);if(now-lastSave>1500){save();lastSave=now;}if(s.phase==='over'&&!finished){finished=true;env.clear();env.speak('settle');env.finish('弹球结束',`三球挑战完成，得分 ${s.score}。`,{outcome:'score',score:s.score},{score:s.score,details:{balls:3}});}}else clearInput();draw();raf=win.requestAnimationFrame(frame);}
 env.setScore(s.score);draw();raf=win.requestAnimationFrame(frame);
 return {destroy(){destroyed=true;win.cancelAnimationFrame(raf);cleanups.forEach(fn=>fn());},save(){save(true);},getState:data};
}
