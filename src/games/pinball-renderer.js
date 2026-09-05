// All raised parts project the same world coordinates used by the physics engine.
const WIDTH=420,HEIGHT=680;
const project=(x,y,z=0)=>[210+(x-210)*(.77+.23*y/680),22+y*.94-z];
export function pinballPixelRatio(width,height,dpr=1){return Math.max(1,Math.min(2,(Number(dpr)||1)*Math.min(width/420,height/680)));}
export function createPinballRenderer(canvas,ctx,doc,win,{walls,bumpers,targets}){
 let cache=null,ratio=1,trail=[],lastBall=null;
 function poly(c,points,fill,stroke,width=1){c.beginPath();points.forEach((p,i)=>i?c.lineTo(...p):c.moveTo(...p));c.closePath();if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.lineWidth=width;c.stroke();}}
 function line(c,points,color,width=1){c.beginPath();points.forEach((p,i)=>i?c.lineTo(...p):c.moveTo(...p));c.strokeStyle=color;c.lineWidth=width;c.lineCap='round';c.lineJoin='round';c.stroke();}
 function disc(c,x,y,rx,ry,fill,stroke,width=1){c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.lineWidth=width;c.stroke();}}
 function gradient(c,x,y,x2,y2,stops){const g=c.createLinearGradient(x,y,x2,y2);stops.forEach(([p,v])=>g.addColorStop(p,v));return g;}
 function text(c,t,x,y,size,color,spacing=false){c.font=`${spacing?'500':'700'} ${size}px monospace`;c.textAlign='center';c.fillStyle=color;c.fillText(t,x,y);}
 function plane(points,z=0){return points.map(([x,y])=>project(x,y,z));}
 const rim=[[23,98],[79,43],[351,43],[415,98],[415,666],[22,666]];
 function staticTable(c){
  c.clearRect(0,0,WIDTH,HEIGHT);
  // The cabinet's dark extruded sides and machined bevel are outside the playable rails.
  poly(c,plane(rim,-13),'#02060e');
  poly(c,plane(rim,-7),gradient(c,20,50,420,640,[[0,'#7492b0'],[.18,'#172b42'],[.5,'#526781'],[.8,'#101b2c'],[1,'#56677b']]),'#0b1322',2);
  poly(c,plane(rim,2),gradient(c,0,60,360,660,[[0,'#1d344e'],[.4,'#0a182a'],[1,'#152035']]),'#7699b7',1.5);
  const floor=[[37,101],[87,60],[348,60],[401,104],[401,645],[36,645]];
  poly(c,plane(floor),gradient(c,0,65,400,640,[[0,'#0b1f37'],[.5,'#071424'],[1,'#111b30']]));
  c.save();c.beginPath();plane(floor).forEach((p,i)=>i?c.lineTo(...p):c.moveTo(...p));c.closePath();c.clip();
  // Receding circuit etching is flush with the playfield, never a fake obstacle.
  for(let y=90;y<650;y+=28)line(c,plane([[32,y],[405,y]]),'#87bded0c',.6);
  for(let x=45;x<410;x+=24)line(c,plane([[x,60],[x,650]]),'#87bded0c',.6);
  for(let i=0;i<9;i++){const x=52+i*37;line(c,plane([[x,80],[x,170+i%3*24],[x+12,190+i%3*24],[x+12,440],[x-8,463],[x-8,620]]),i%2?'#327d9c30':'#556fad28',1);const p=project(x-8,620);disc(c,...p,2,1.6,'#66d7f155');}
  const core=project(205,326);for(const r of [48,58,78,113])disc(c,...core,r,r*.75,null,'#55bddd12',1);
  // Soft painted light cones underneath the reactor rings.
  for(const p of bumpers){const [x,y]=project(p.x,p.y);const g=c.createRadialGradient(x,y,2,x,y,72);g.addColorStop(0,'#1bcbe426');g.addColorStop(1,'#1bcbe400');disc(c,x,y,72,58,g);}
  c.restore();
  // Launch channel recessed bed, spring and depth-separated steel rail.
  poly(c,plane([[375,160],[400,160],[400,638],[375,638]]),gradient(c,365,0,408,0,[[0,'#030813'],[.5,'#233b54'],[1,'#060c18']]));
  for(let y=181;y<604;y+=18)line(c,plane([[379,y],[382,y-3],[394,y-3],[398,y]]),'#6a8fac45',1);
  walls.forEach(([x,y,x2,y2])=>{
   line(c,[project(x,y,-6),project(x2,y2,-6)],'#000912',12);
   line(c,[project(x,y,-2),project(x2,y2,-2)],'#1a304b',10);
   line(c,[project(x,y,3),project(x2,y2,3)],gradient(c,0,0,400,580,[[0,'#c4d9e8'],[.2,'#57748d'],[.55,'#8caac2'],[1,'#29475f']]),6);
   line(c,[project(x-1,y,5),project(x2-1,y2,5)],'#d8f6ff',1);
  });
  // LED strips embedded in existing side walls.
  for(const x of [35,370]){line(c,[project(x,172,7),project(x,449,7)],'#113b55',3);for(let y=176;y<443;y+=23)line(c,[project(x,y,7),project(x,y+11,7)],x===35?'#57e7f0':'#5d9eff',1.7);}
  // Precision fasteners live on the rim, outside the ball's corridor.
  for(const [x,y]of[[33,110],[78,51],[353,51],[408,113],[28,461],[411,468],[28,646],[411,646]]){const p=project(x,y,4);disc(c,...p,3.1,2.6,'#9db0c0','#0b1420');line(c,[[p[0]-1.5,p[1]],[p[0]+1.5,p[1]]],'#2c4058',.8);}
  text(c,'ORBITAL / 07',210,43,9,'#9cb7d3',true);
  const brand=project(201,413);text(c,'STAR HARBOR',...brand,23,'#dbeefa');text(c,'星 港  ·  深 空 竞 技',brand[0],brand[1]+18,9,'#6cabc4',true);
  line(c,[[brand[0]-91,brand[1]+29],[brand[0]-29,brand[1]+29]],'#426987',1);line(c,[[brand[0]+29,brand[1]+29],[brand[0]+91,brand[1]+29]],'#426987',1);
  text(c,'SECTOR 03',brand[0],brand[1]+32,7,'#5d839e',true);
  // Drain is recessed below the flippers; hazard marks are painted on the apron.
  poly(c,plane([[170,642],[231,642],[231,657],[170,657]]),'#01040a','#345471',1);
  for(let x=154;x<250;x+=9)line(c,plane([[x,667],[x+4,660]]),'#a98a4d',2);
  text(c,'MAGNETIC RETURN',210,HEIGHT-10,7,'#5d7a94',true);
 }
 function reactor(c,p,i,flash){
  const [x,y]=project(p.x,p.y),r=p.r*(.77+.23*p.y/680),ry=r*.8;
  disc(c,x+5,y+10,r+9,ry+6,'#00000075');
  disc(c,x,y+5,r+4,ry+2,'#07101d','#416077',1);
  poly(c,[[x-r-2,y+4],[x-r-2,y-5],[x+r+2,y-5],[x+r+2,y+4]],gradient(c,x-r,0,x+r,0,[[0,'#172c41'],[.28,'#6b8396'],[.5,'#183b50'],[1,'#071322']]));
  const metal=gradient(c,x-r,y-r,x+r,y+r,[[0,'#f2fcff'],[.25,'#91a9bb'],[.45,'#2b455d'],[.65,'#839bab'],[1,'#152b41']]);
  disc(c,x,y-6,r+4,ry+3,metal,'#bbdeed',.8);
  disc(c,x,y-7,r,ry-1,'#061220','#0a1b2d',2);
  const hue=i<3?'#67f5ff':'#ffcf79';
  disc(c,x,y-8,r-3,ry-4,null,flash?'#fff8c4':hue,2.3);
  for(let n=0;n<12;n++){const a=n*Math.PI/6;line(c,[[x+Math.cos(a)*(r-7),y-8+Math.sin(a)*(ry-7)],[x+Math.cos(a)*(r-5),y-8+Math.sin(a)*(ry-5)]],hue,.8);}
  disc(c,x,y-8,r*.56,ry*.52,gradient(c,x,y-r,x,y+r,[[0,i<3?'#164859':'#564424'],[1,'#071523']]),'#8eebed40');
  text(c,i<3?'100':'250',x,y-5,i<3?10:7,flash?'#fff':hue);
  // Short bloom and concentric impulse ripple when the real collider is hit.
  if(flash){const a=Math.min(1,flash/.18),g=c.createRadialGradient(x,y,1,x,y,r*2.8);g.addColorStop(0,`rgba(160,245,255,${a*.48})`);g.addColorStop(1,'#65eaff00');disc(c,x,y,r*2.8,r*2.2,g);disc(c,x,y-7,r+6+(1-a)*17,(ry+6+(1-a)*17)*.85,null,`rgba(205,250,255,${a})`,1.5);}
 }
 function flipper(c,x,tip,up){const a=project(x,545),b=project(tip,570-65*up),topA=project(x,545,7),topB=project(tip,570-65*up,7);
  line(c,[[a[0]+4,a[1]+8],[b[0]+4,b[1]+8]],'#00000085',22);line(c,[a,b],'#58412b',19);
  line(c,[topA,topB],gradient(c,a[0],a[1]-15,b[0],b[1]+10,[[0,'#fff1bb'],[.3,'#cfb077'],[.53,'#fbe2a1'],[1,'#7f6137']]),17);
  line(c,[[topA[0],topA[1]-4],[topB[0],topB[1]-4]],'#fff6d7',1.4);
  line(c,[[topA[0],topA[1]+4],[topB[0],topB[1]+4]],'#65e7f0',1.7);
  disc(c,...topA,7,6,'#1a3046','#d4e9ef',1.5);disc(c,...topA,3,2.5,'#7092ab');
 }
 function resize(){const rect=canvas.getBoundingClientRect?.();const next=rect?pinballPixelRatio(rect.width,rect.height,win.devicePixelRatio):1;if(Math.abs(next-ratio)>.02||!canvas.width){ratio=next;canvas.width=Math.round(WIDTH*ratio);canvas.height=Math.round(HEIGHT*ratio);cache=null;}}
 function draw(s,charge,charging){resize();ctx.setTransform(ratio,0,0,ratio,0,0);ctx.clearRect(0,0,WIDTH,HEIGHT);
  if(!cache&&typeof doc.createElement==='function'){cache=doc.createElement('canvas');cache.width=Math.round(WIDTH*ratio);cache.height=Math.round(HEIGHT*ratio);const c=cache.getContext('2d',{willReadFrequently:true});c.setTransform(ratio,0,0,ratio,0,0);staticTable(c);}
  if(cache)ctx.drawImage(cache,0,0,WIDTH,HEIGHT);else staticTable(ctx);
  [...bumpers,...targets].forEach((p,i)=>reactor(ctx,p,i,s.lights[i]));
  flipper(ctx,105,175,s.left);flipper(ctx,295,225,s.right);
  const plunger=project(390,623+charge*12);line(ctx,[[plunger[0]-7,plunger[1]],[plunger[0]+7,plunger[1]]],'#edcc82',5);
  const b=s.ball,p=project(b.x,b.y,7),speed=Math.hypot(b.vx,b.vy);
  if(s.phase!=='play'){trail=[];lastBall=null;}else if(!lastBall||Math.hypot(b.x-lastBall.x,b.y-lastBall.y)>.4){if(lastBall&&Math.hypot(b.x-lastBall.x,b.y-lastBall.y)>110)trail=[];trail.push(p);trail=trail.slice(-6);lastBall={...b};}
  if(speed>120)for(let i=1;i<trail.length;i++)line(ctx,[trail[i-1],trail[i]],`rgba(149,223,255,${i/trail.length*.25})`,1+i*.65);
  disc(ctx,p[0]+4,p[1]+10,8,5,'#00000085');const metal=ctx.createRadialGradient(p[0]-3,p[1]-4,.5,p[0],p[1],8);[[0,'#fff'],[.15,'#fff'],[.37,'#d7e9f5'],[.52,'#637e9a'],[.67,'#152e4a'],[.83,'#a0bcd0'],[1,'#1d324b']].forEach(([v,c])=>metal.addColorStop(v,c));disc(ctx,...p,8,8,metal,'#daeaff',.5);disc(ctx,p[0]-2.5,p[1]-3.8,1.5,.8,'#fff');
  // Restrained glass reflections across the cabinet, not opaque over the game.
  poly(ctx,plane([[92,65],[152,65],[81,638],[42,638]]),'#b5e7ff05');line(ctx,plane([[351,71],[395,113],[395,437]],8),'#d9f3ff20',1);
  if(s.phase==='ready'){const p=project(201,484);poly(ctx,[[p[0]-115,p[1]-17],[p[0]+115,p[1]-17],[p[0]+115,p[1]+15],[p[0]-115,p[1]+15]],'#061425eb','#37566e',.8);text(ctx,charging?`CHARGE ${Math.round(charge*100)}% · 松开发射`:'按住发射 · 启动星港任务',p[0],p[1]+3,11,'#d1e8f1');if(charging)line(ctx,[[p[0]-110,p[1]+11],[p[0]-110+220*charge,p[1]+11]],'#76eff1',2);}
 }
 return {draw};
}
