/* ============================================================
   game.js — Backyard Birds (cozy pixel-art feeder idle)
   Core loop, economy, automation, UI and save system.
   Renders into a low-res 480x270 canvas scaled up by CSS.
   ============================================================ */
(() => {
"use strict";

const SAVE_KEY = "backyard-birds-v1";
const MAX_CONCURRENT = 5;

/* ---------------- balance / config ---------------- */
const CONFIG = {
  baseCap: 5,
  baseSpawn: 5.0,
  scatterAmount: 1,
  eatTime: 1.4,
  sadTime: 1.0,
  sadPenaltyRatio: 0.4,
  fillerBaseInterval: 4.5,
  offlineCapHours: 4,
};

const UPGRADES = [
  { id:"capacity",    name:"Bigger Tray",  emoji:"🪵", max:14, baseCost:25, growth:1.5,  desc:"+3 seed capacity each level." },
  { id:"attractor",   name:"Bird Bath",    emoji:"💧", max:12, baseCost:45, growth:1.55, desc:"Birds visit more often." },
  { id:"fillers",     name:"Hire a Helper",emoji:"🧑‍🌾", max:8, baseCost:60, growth:1.85, desc:"A helper auto-fills the feeder. Stacks." },
  { id:"fillerSpeed", name:"Seed Scoops",  emoji:"🥄", max:10, baseCost:85, growth:1.7,  desc:"Helpers refill faster." },
  { id:"seedQuality", name:"Premium Seed", emoji:"🌻", max:10, baseCost:70, growth:1.7,  desc:"+20% Bird Points from happy visits." },
];

/* ---------------- state ---------------- */
function defaultState(){
  return {
    points:0, food:3,
    upgrades:{ capacity:0, attractor:0, fillers:0, fillerSpeed:0, seedQuality:0 },
    discovered:{}, seen:{}, happyVisits:0, sadVisits:0,
    area:"suburb", muted:false, lastSave:Date.now(),
  };
}
let state = defaultState();

const capacity      = () => CONFIG.baseCap + state.upgrades.capacity*3;
const pointMult     = () => 1 + state.upgrades.seedQuality*0.2;
const spawnInterval = () => CONFIG.baseSpawn * Math.pow(0.9, state.upgrades.attractor);
const fillerCount   = () => state.upgrades.fillers;
const fillInterval  = () => Math.max(1.1, CONFIG.fillerBaseInterval * Math.pow(0.86, state.upgrades.fillerSpeed));
const upgCost = u => Math.round(u.baseCost * Math.pow(u.growth, state.upgrades[u.id]));

/* ---------------- runtime ---------------- */
let canvas, ctx, t=0, lastTs=0, hudTick=0, saveTick=0;
let birds=[], floats=[], seeds=[];
let occupied=new Set();
let spawnTimer=2.0, fillTimer=0;
let pendingOffline=null;
let bgInterval=null, bgLast=0, bgGained=0;   // background-tab idle accrual
const suburbSpecies = BIRDS.filter(b=>b.area==="suburb");
const pool = spawnPoolForArea("suburb");
const poolTotalWeight = pool.reduce((s,p)=>s+p.weight,0);

/* ============================================================
   SAVE / LOAD
   ============================================================ */
function save(){
  state.lastSave=Date.now();
  try{ localStorage.setItem(SAVE_KEY, JSON.stringify(state)); }catch(e){}
}
function load(){
  try{
    const raw=localStorage.getItem(SAVE_KEY);
    if(raw){
      const s=JSON.parse(raw);
      state=Object.assign(defaultState(), s);
      state.upgrades=Object.assign(defaultState().upgrades, s.upgrades||{});
      state.discovered=s.discovered||{}; state.seen=s.seen||{};
    }
  }catch(e){ state=defaultState(); }
}
/* Idle accrual used both for offline progress and while the tab is
   backgrounded. Helpers keep the feeder topped up and serve visitors. */
function accrue(seconds){
  seconds=Math.min(seconds, CONFIG.offlineCapHours*3600);
  if(seconds<=0 || fillerCount()<=0) return 0;
  const seedPerSec=fillerCount()/fillInterval();
  const visitPerSec=1/spawnInterval();
  const servedPerSec=Math.min(visitPerSec,seedPerSec);
  let avg=0; for(const p of pool) avg+=p.bird.points*(p.weight/poolTotalWeight);
  const served=servedPerSec*seconds;
  const gained=Math.floor(served*avg*pointMult()*0.6);
  if(gained>0){ state.points+=gained; state.happyVisits+=Math.floor(served); state.food=capacity(); }
  return gained;
}
function applyOffline(){
  const secs=(Date.now()-(state.lastSave||Date.now()))/1000;
  if(secs<30) return;
  const gained=accrue(secs);
  if(gained>0) pendingOffline={ gained, mins:Math.round(Math.min(secs,CONFIG.offlineCapHours*3600)/60) };
}

/* ============================================================
   SPAWNING & BIRD LIFE-CYCLE
   ============================================================ */
function pickSpecies(){
  let r=Math.random()*poolTotalWeight;
  for(const p of pool){ if((r-=p.weight)<=0) return p.bird; }
  return pool[0].bird;
}
function currentFeeder(){
  return { x:Sprites.L.feeder.x, trayY:Sprites.L.feeder.trayY, food:state.food, cap:capacity() };
}
function freeSlotIndex(feeder){
  const slots=Sprites.perchSlots(feeder), idxs=[];
  for(let i=0;i<slots.length;i++) if(!occupied.has(i)) idxs.push(i);
  return idxs.length? idxs[(Math.random()*idxs.length)|0] : -1;
}
function spawnBird(feeder){
  if(birds.length>=MAX_CONCURRENT) return false;
  const idx=freeSlotIndex(feeder);
  if(idx<0) return false;
  const slot=Sprites.perchSlots(feeder)[idx];
  const sp=pickSpecies();
  occupied.add(idx);
  const fromLeft=Math.random()<0.5;
  const startX=fromLeft? -20 : Sprites.L.W+20;
  const startY=16+Math.random()*64;
  birds.push({
    sp, slotIndex:idx, slot,
    x:startX, y:startY,
    tx:slot.x, ty:slot.y - Sprites.standHeight(sp),
    facing: slot.x>startX?1:-1,
    phase:Math.random()*7,
    mode:"fly", st:"incoming",
    flapPhase:Math.random()*7, bob:0, peck:0,
    timer:0, emote:null, emoteFade:1, awarded:false,
  });
  return true;
}
function arriveDecide(b){
  state.seen[b.sp.id]=(state.seen[b.sp.id]||0)+1;
  if(!state.discovered[b.sp.id]){ state.discovered[b.sp.id]=true; onDiscover(b.sp); }
  b.mode="perch"; b.facing=b.slot.facing;
  if(state.food>0){
    state.food-=1; b.st="eating"; b.timer=CONFIG.eatTime; b.emote="note"; b.emoteFade=1;
  }else{
    b.st="sad"; b.timer=CONFIG.sadTime; b.emote="sad"; b.emoteFade=1;
    const lost=Math.max(1,Math.ceil(b.sp.points*CONFIG.sadPenaltyRatio));
    state.points=Math.max(0,state.points-lost); state.sadVisits++;
    addFloat(b.x, b.ty-12, "-"+lost, "#c0563f");
    flashStat("pointsVal"); sfx("sad");
  }
}
function finishEating(b){
  const gain=Math.max(1,Math.round(b.sp.points*pointMult()));
  state.points+=gain; state.happyVisits++;
  addFloat(b.x, b.ty-12, "+"+gain, "#caa12a");
  b.emote="happy"; b.emoteFade=1; b.awarded=true;
  flashStat("pointsVal"); flashStat("happyVal"); sfx("happy");
  startLeaving(b);
}
function startLeaving(b){
  b.st="leaving"; b.mode="fly"; occupied.delete(b.slotIndex);
  b.tx = b.x<Sprites.L.W/2 ? -30 : Sprites.L.W+30;
  b.ty = 16+Math.random()*54;
}
function updateBird(b, dt){
  b.flapPhase += dt*(b.mode==="fly"?15:0);
  switch(b.st){
    case "incoming":{
      const dx=b.tx-b.x, dy=b.ty-b.y, d=Math.hypot(dx,dy), sp=95*dt;
      if(d>2){ b.x+=dx/d*sp; b.y+=dy/d*sp; b.facing=dx>=0?1:-1; b.bob=Math.sin(t*12+b.phase)*1; }
      else { b.x=b.tx; b.y=b.ty; b.bob=0; arriveDecide(b); }
      break;
    }
    case "eating":{
      b.peck=(Math.sin(t*13+b.phase)+1)/2; b.bob=Math.sin(t*3)*0.4; b.timer-=dt;
      if(b.timer<=0){ b.peck=0; finishEating(b); }
      break;
    }
    case "sad":{
      b.bob=Math.sin(t*22+b.phase)*0.8; b.timer-=dt;
      if(b.timer<=0) startLeaving(b);
      break;
    }
    case "leaving":{
      const dx=b.tx-b.x, dy=b.ty-b.y, d=Math.hypot(dx,dy)||1, sp=105*dt;
      b.x+=dx/d*sp; b.y+=dy/d*sp; b.facing=dx>=0?1:-1; b.bob=Math.sin(t*12+b.phase)*1;
      b.emoteFade-=dt*0.7;
      if(b.x<-26||b.x>Sprites.L.W+26||b.y<-20) b._dead=true;
      break;
    }
  }
  if(b.emote && b.emoteFade<=0) b.emote=null;
}

/* ============================================================
   UPDATE
   ============================================================ */
function update(dt){
  const feeder=currentFeeder();
  if(fillerCount()>0){
    fillTimer-=dt;
    if(fillTimer<=0){
      const before=state.food;
      state.food=Math.min(capacity(), state.food+fillerCount());
      if(state.food>before) spawnSeedToss(feeder, Math.min(3,fillerCount()));
      fillTimer=fillInterval();
    }
  }
  spawnTimer-=dt;
  if(spawnTimer<=0){
    if(spawnBird(feeder)) spawnTimer=spawnInterval()*(0.7+Math.random()*0.6);
    else spawnTimer=0.6;
  }
  for(const b of birds) updateBird(b,dt);
  birds=birds.filter(b=>!b._dead);
  for(const f of floats){ f.y+=f.vy*dt; f.life-=dt; }
  floats=floats.filter(f=>f.life>0);
  for(const s of seeds){ s.vy+=240*dt; s.x+=s.vx*dt; s.y+=s.vy*dt; s.life-=dt; if(s.y>=s.gy){ s.y=s.gy; s.vy*=-0.35; s.vx*=0.6; } }
  seeds=seeds.filter(s=>s.life>0);
}

/* ============================================================
   RENDER
   ============================================================ */
function render(){
  ctx.imageSmoothingEnabled=false;
  Sprites.drawBackground(ctx, t);
  const feeder=currentFeeder();
  Sprites.drawFeeder(ctx, feeder, t);

  for(const s of seeds){ ctx.fillStyle="#caa15c"; ctx.fillRect(s.x|0, s.y|0, 1, 1); }

  const drawList=birds.slice().sort((a,b)=>a.y-b.y);
  for(const b of drawList){
    Sprites.drawBird(ctx, b.sp, {
      x:b.x, y:b.y, facing:b.facing, mode:b.mode,
      flapPhase:b.flapPhase, bob:b.bob, peck:b.peck,
      emote:b.emote, emoteFade:b.emoteFade,
    });
  }

  for(const f of floats){
    const a=Math.max(0,Math.min(1,f.life/0.9));
    const w=Sprites.pixelTextWidth(f.text,1);
    const x=Math.round(f.x-w/2), y=Math.round(f.y);
    ctx.globalAlpha=a*0.6; Sprites.pixelText(ctx, x+1, y+1, f.text, "#3a2a1a", 1);
    ctx.globalAlpha=a;     Sprites.pixelText(ctx, x,   y,   f.text, f.color, 1);
  }
  ctx.globalAlpha=1;
}

function loop(ts){
  if(!lastTs) lastTs=ts;
  let dt=(ts-lastTs)/1000; lastTs=ts;
  if(dt>0.1) dt=0.1;
  t+=dt;
  update(dt); render();
  hudTick+=dt; if(hudTick>0.12){ refreshHUD(); hudTick=0; }
  saveTick+=dt; if(saveTick>5){ save(); saveTick=0; }
  requestAnimationFrame(loop);
}

/* ============================================================
   PARTICLES & FLOATERS
   ============================================================ */
function addFloat(x,y,text,color){ floats.push({x,y,text,color,vy:-16,life:1.0}); }
function spawnSeedToss(feeder,n){
  for(let i=0;i<n*3;i++){
    seeds.push({
      x:feeder.x+(Math.random()-0.5)*16, y:feeder.trayY-30,
      vx:(Math.random()-0.5)*34, vy:-10-Math.random()*22,
      gy:feeder.trayY-1, life:0.9+Math.random()*0.4,
    });
  }
}

/* ============================================================
   UI
   ============================================================ */
const $=id=>document.getElementById(id);

function refreshHUD(){
  $("pointsVal").textContent=Math.floor(state.points).toLocaleString();
  $("foodVal").textContent=state.food;
  $("capVal").textContent=capacity();
  $("happyVal").textContent=state.happyVisits.toLocaleString();
  const disc=suburbSpecies.filter(s=>state.discovered[s.id]).length;
  $("discVal").textContent=disc;
  $("totalVal").textContent=suburbSpecies.length;
  refreshShop();
}
function flashStat(valId){
  const el=$(valId); if(!el) return;
  const stat=el.closest(".stat"); if(!stat) return;
  stat.classList.remove("flash"); void stat.offsetWidth; stat.classList.add("flash");
}

/* ---- shop ---- */
function buildShop(){
  const list=$("shopList"); list.innerHTML="";
  for(const u of UPGRADES){
    const item=document.createElement("div"); item.className="shop-item"; item.dataset.id=u.id;
    item.innerHTML=`
      <div class="shop-ico">${u.emoji}</div>
      <div class="shop-info"><h3>${u.name} <span class="lvl" data-lvl></span></h3><p>${u.desc}</p></div>
      <button class="buy-btn" data-buy></button>`;
    item.querySelector("[data-buy]").addEventListener("click",()=>buyUpgrade(u));
    list.appendChild(item);
  }
  refreshShop();
}
function refreshShop(){
  for(const u of UPGRADES){
    const item=document.querySelector(`.shop-item[data-id="${u.id}"]`); if(!item) continue;
    const lvl=state.upgrades[u.id];
    item.querySelector("[data-lvl]").textContent=lvl>0?`Lv.${lvl}`:"";
    const btn=item.querySelector("[data-buy]");
    if(lvl>=u.max){ btn.className="buy-btn maxed"; btn.disabled=true; btn.innerHTML="MAX"; }
    else{
      const cost=upgCost(u);
      btn.className="buy-btn"; btn.disabled=state.points<cost;
      btn.innerHTML=`${lvl>0?"Upgrade":"Buy"}<small>✨ ${cost.toLocaleString()}</small>`;
    }
  }
}
function buyUpgrade(u){
  const lvl=state.upgrades[u.id]; if(lvl>=u.max) return;
  const cost=upgCost(u); if(state.points<cost) return;
  state.points-=cost; state.upgrades[u.id]++;
  if(u.id==="fillers" && fillTimer<=0) fillTimer=0.2;
  if(u.id==="capacity") state.food=Math.min(state.food,capacity());
  sfx("buy"); refreshHUD();
  ticker(`${u.name} ${state.upgrades[u.id]>1?"upgraded":"unlocked"}! 🐣`); save();
}

/* ---- bird index ---- */
const indexCells={};
function buildIndex(){
  const grid=$("indexGrid"); grid.innerHTML="";
  for(const sp of suburbSpecies){
    const cell=document.createElement("div"); cell.className="index-cell";
    const cv=document.createElement("canvas"); cv.width=72; cv.height=60;
    const name=document.createElement("div"); name.className="ic-name";
    const dot=document.createElement("div"); dot.className="ic-dot";
    cell.appendChild(dot); cell.appendChild(cv); cell.appendChild(name);
    grid.appendChild(cell);
    indexCells[sp.id]={cell,cv,name,dot};
    cell.addEventListener("click",()=>{ if(state.discovered[sp.id]) openCard(sp); });
    paintIndexCell(sp);
  }
}
function paintIndexCell(sp){
  const c=indexCells[sp.id]; if(!c) return;
  const found=!!state.discovered[sp.id];
  c.cell.classList.toggle("found",found); c.cell.classList.toggle("locked",!found);
  c.dot.style.background=RARITY[sp.rarity].color; c.dot.style.display=found?"block":"none";
  if(found){ c.name.textContent=sp.name; c.name.classList.remove("locked"); Sprites.drawPortrait(c.cv,sp,{}); }
  else{ c.name.textContent="? ? ?"; c.name.classList.add("locked"); Sprites.drawPortrait(c.cv,sp,{silhouette:"#b9ab8f"}); }
}
function onDiscover(sp){
  paintIndexCell(sp);
  indexCells[sp.id]?.cell.classList.add("new");
  toast(sp,"New species discovered!");
  ticker(`You discovered the ${sp.name}! 🎉`);
  sfx("discover"); refreshHUD(); save();
}

/* ---- species card ---- */
function openCard(sp){
  $("cardName").textContent=sp.name;
  const rar=RARITY[sp.rarity]; const rEl=$("cardRarity"); rEl.textContent=rar.label; rEl.style.color=rar.color;
  $("cardDesc").textContent=sp.desc; $("cardPoints").textContent=sp.points; $("cardSeen").textContent=state.seen[sp.id]||0;
  Sprites.drawPortrait($("cardCanvas"),sp,{});
  $("cardModal").classList.remove("hidden");
  indexCells[sp.id]?.cell.classList.remove("new");
}

/* ---- toasts ---- */
function toast(sp,text){
  const wrap=$("toasts");
  const el=document.createElement("div"); el.className="toast";
  const cv=document.createElement("canvas"); cv.width=44; cv.height=38;
  Sprites.drawPortrait(cv,sp,{});
  const txt=document.createElement("div"); txt.innerHTML=`${sp.name}<small>${text}</small>`;
  el.appendChild(cv); el.appendChild(txt); wrap.appendChild(el);
  setTimeout(()=>el.remove(),3900);
}

/* ---- ticker ---- */
const IDLE_LINES=[
  "A gentle breeze drifts through the yard…","Sunlight dapples the feeder.",
  "Somewhere, a robin is singing.","The hedge rustles softly.","A perfect day for birdwatching.",
];
let tickerTimer=null;
function ticker(msg){
  $("ticker").textContent=msg;
  clearTimeout(tickerTimer);
  tickerTimer=setTimeout(()=>{ $("ticker").textContent=IDLE_LINES[(Math.random()*IDLE_LINES.length)|0]; },4000);
}

/* ---- areas ---- */
function buildAreas(){
  const list=$("areaList"); list.innerHTML="";
  for(const a of AREAS){
    const active=a.id===state.area;
    const card=document.createElement("div");
    card.className="area-card"+(a.unlocked?(active?" active":""):" locked");
    card.innerHTML=`<div class="area-emoji">${a.emoji}</div>
      <div><h3>${a.name}</h3><p>${a.blurb}</p></div>
      <span class="area-tag ${a.unlocked?'on':'off'}">${a.unlocked?(active?'Here':'Open'):'Locked'}</span>`;
    list.appendChild(card);
  }
}

/* ============================================================
   AUDIO  — WebAudio sound effects + procedural ambient soundscape
   (a soft wind bed and occasional gentle birdsong). No assets.
   ============================================================ */
let actx=null;
const ambient={ started:false, master:null, birdTimer:null };

function ensureAudio(){
  try{
    actx=actx||new (window.AudioContext||window.webkitAudioContext)();
    if(actx.state==="suspended") actx.resume();
  }catch(e){ actx=null; }
  return actx;
}
function tone(freq,dur,type="sine",gain=0.05,delay=0){
  if(state.muted) return;
  const ctx=ensureAudio(); if(!ctx) return;
  try{
    const o=ctx.createOscillator(), g=ctx.createGain(), t0=ctx.currentTime+delay;
    o.type=type; o.frequency.setValueAtTime(freq,t0);
    g.gain.setValueAtTime(0,t0); g.gain.linearRampToValueAtTime(gain,t0+0.01);
    g.gain.exponentialRampToValueAtTime(0.0001,t0+dur);
    o.connect(g).connect(ctx.destination); o.start(t0); o.stop(t0+dur+0.02);
  }catch(e){}
}
function sfx(kind){
  if(state.muted) return;
  switch(kind){
    case "happy":    tone(880,0.12,"sine",0.05); tone(1320,0.12,"sine",0.04,0.08); break;
    case "discover": tone(660,0.12,"triangle",0.05); tone(990,0.14,"triangle",0.05,0.1); tone(1320,0.16,"sine",0.04,0.22); break;
    case "sad":      tone(300,0.18,"sine",0.05); tone(220,0.2,"sine",0.04,0.1); break;
    case "buy":      tone(520,0.07,"square",0.04); tone(780,0.09,"square",0.035,0.06); break;
    case "scatter":  tone(440,0.05,"triangle",0.03); break;
  }
}

/* ---- ambient soundscape ---- */
function makeNoiseBuffer(ctx, secs){
  const len=Math.floor(ctx.sampleRate*secs);
  const buf=ctx.createBuffer(1,len,ctx.sampleRate);
  const d=buf.getChannelData(0); let last=0;
  for(let i=0;i<len;i++){ const w=Math.random()*2-1; last=(last+0.02*w)/1.02; d[i]=last*3.2; }
  return buf;
}
function startAmbient(){
  if(ambient.started) return;
  const ctx=ensureAudio(); if(!ctx) return;
  ambient.started=true;
  try{
    const master=ctx.createGain();
    master.gain.value=0;
    master.connect(ctx.destination);
    ambient.master=master;

    // breezy wind bed: looping noise -> lowpass, gently modulated
    const wind=ctx.createBufferSource(); wind.buffer=makeNoiseBuffer(ctx,3); wind.loop=true;
    const lp=ctx.createBiquadFilter(); lp.type="lowpass"; lp.frequency.value=480;
    const wg=ctx.createGain(); wg.gain.value=0.05;
    wind.connect(lp).connect(wg).connect(master); wind.start();
    const lfo=ctx.createOscillator(); lfo.frequency.value=0.08;
    const lfoAmt=ctx.createGain(); lfoAmt.gain.value=240;
    lfo.connect(lfoAmt).connect(lp.frequency); lfo.start();
    const lfo2=ctx.createOscillator(); lfo2.frequency.value=0.05;
    const lfo2Amt=ctx.createGain(); lfo2Amt.gain.value=0.02;
    lfo2.connect(lfo2Amt).connect(wg.gain); lfo2.start();

    master.gain.setTargetAtTime(state.muted?0:0.9, ctx.currentTime, 1.5);
    scheduleAmbientBird();
  }catch(e){ ambient.started=false; }
}
function setAmbientMuted(muted){
  if(ambient.master && actx){
    try{ ambient.master.gain.setTargetAtTime(muted?0:0.9, actx.currentTime, 0.4); }catch(e){}
  }
}
function scheduleAmbientBird(){
  clearTimeout(ambient.birdTimer);
  ambient.birdTimer=setTimeout(()=>{
    if(!state.muted) playAmbientBird();
    scheduleAmbientBird();
  }, 2200+Math.random()*5200);
}
function playAmbientBird(){
  const ctx=actx; if(!ctx || !ambient.master) return;
  try{
    const dest=ctx.createGain(); dest.gain.value=1;
    if(ctx.createStereoPanner){ const pan=ctx.createStereoPanner(); pan.pan.value=(Math.random()*2-1)*0.7; dest.connect(pan).connect(ambient.master); }
    else dest.connect(ambient.master);
    const base=1300+Math.random()*1500;
    const notes=2+((Math.random()*4)|0);
    let tt=ctx.currentTime;
    for(let i=0;i<notes;i++){
      const o=ctx.createOscillator(), g=ctx.createGain();
      o.type="sine";
      const f=base*(0.82+Math.random()*0.5);
      o.frequency.setValueAtTime(f,tt);
      o.frequency.linearRampToValueAtTime(f*(1+(Math.random()*0.18-0.09)), tt+0.08);
      g.gain.setValueAtTime(0,tt);
      g.gain.linearRampToValueAtTime(0.05,tt+0.012);
      g.gain.exponentialRampToValueAtTime(0.0001,tt+0.12);
      o.connect(g).connect(dest); o.start(tt); o.stop(tt+0.14);
      tt+=0.06+Math.random()*0.07;
    }
  }catch(e){}
}

/* ============================================================
   INPUT / WIRING
   ============================================================ */
function scatter(){
  if(state.food>=capacity()){ ticker("The feeder is already full of seed. 🌾"); return; }
  state.food=Math.min(capacity(), state.food+CONFIG.scatterAmount);
  spawnSeedToss(currentFeeder(),2); sfx("scatter"); flashStat("foodVal"); refreshHUD();
}
function canvasToInternal(e){
  const r=canvas.getBoundingClientRect();
  const scale=Math.max(r.width/Sprites.L.W, r.height/Sprites.L.H);
  const offX=(r.width-Sprites.L.W*scale)/2, offY=(r.height-Sprites.L.H*scale)/2;
  return { x:(e.clientX-r.left-offX)/scale, y:(e.clientY-r.top-offY)/scale };
}
function onCanvasClick(e){
  const p=canvasToInternal(e), f=Sprites.L.feeder;
  if(p.x>f.x-42 && p.x<f.x+42 && p.y>f.trayY-52 && p.y<Sprites.L.groundContact) scatter();
}

function openPanel(id){
  closePanels();
  $(id).classList.remove("hidden");
}
function closePanels(){
  document.querySelectorAll(".overlay").forEach(o=>o.classList.add("hidden"));
}

/* keep the game progressing while the tab is hidden / minimized:
   the rAF loop is paused by the browser, so we accrue idle progress
   on a timer and credit anything earned when the player returns. */
function onHidden(){
  save();
  bgLast=Date.now(); bgGained=0;
  clearInterval(bgInterval);
  bgInterval=setInterval(()=>{
    const now=Date.now(); bgGained+=accrue((now-bgLast)/1000); bgLast=now; save();
  }, 15000);
}
function onVisible(){
  clearInterval(bgInterval); bgInterval=null;
  if(bgLast){ bgGained+=accrue((Date.now()-bgLast)/1000); bgLast=0; }
  if(actx && actx.state==="suspended") actx.resume();
  if(bgGained>0){ refreshHUD(); ticker(`While away, your helpers earned ✨${Math.floor(bgGained)}. 🪶`); }
  bgGained=0;
  lastTs=0;   // prevents a giant dt on the first resumed frame
}

function wireUI(){
  $("scatterBtn").addEventListener("click", scatter);
  $("btnShop").addEventListener("click", ()=>openPanel("overlayShop"));
  $("btnIndex").addEventListener("click", ()=>openPanel("overlayIndex"));
  $("btnAreas").addEventListener("click", ()=>openPanel("overlayAreas"));
  canvas.addEventListener("click", onCanvasClick);

  document.querySelectorAll("[data-close]").forEach(b=>b.addEventListener("click", closePanels));
  $("cardClose").addEventListener("click", ()=>$("cardModal").classList.add("hidden"));
  document.querySelectorAll(".overlay").forEach(o=>{
    o.addEventListener("click", e=>{ if(e.target===o) o.classList.add("hidden"); });
  });

  $("muteBtn").addEventListener("click", ()=>{
    state.muted=!state.muted;
    $("muteBtn").textContent=state.muted?"🔇":"🔊";
    if(state.muted){ setAmbientMuted(true); } else { startAmbient(); setAmbientMuted(false); }
    save();
  });
  $("resetBtn").addEventListener("click", ()=>{
    if(confirm("Reset all progress and start a fresh backyard?")){
      try{ localStorage.removeItem(SAVE_KEY); }catch(e){}
      state=defaultState(); occupied.clear(); birds=[]; floats=[]; seeds=[];
      buildIndex(); buildAreas(); refreshHUD(); closePanels();
      ticker("A fresh new backyard awaits. 🌱");
    }
  });

  window.addEventListener("keydown", e=>{
    if(e.code==="Space"){ e.preventDefault(); scatter(); }
    if(e.code==="Escape"){ closePanels(); }
  });
  window.addEventListener("beforeunload", save);

  // browsers block audio until a user gesture — start the soundscape then
  const startAudioOnce=()=>{
    ensureAudio(); if(!state.muted) startAmbient();
    window.removeEventListener("pointerdown", startAudioOnce);
    window.removeEventListener("keydown", startAudioOnce);
  };
  window.addEventListener("pointerdown", startAudioOnce);
  window.addEventListener("keydown", startAudioOnce);

  // keep progressing while the tab is hidden / minimized
  document.addEventListener("visibilitychange", ()=> document.hidden ? onHidden() : onVisible());
}

/* ============================================================
   BOOT
   ============================================================ */
function init(){
  canvas=$("game"); ctx=canvas.getContext("2d"); ctx.imageSmoothingEnabled=false;
  load(); applyOffline();
  $("muteBtn").textContent=state.muted?"🔇":"🔊";
  buildShop(); buildIndex(); buildAreas(); wireUI();
  refreshHUD();
  ticker(pendingOffline
    ? `Welcome back! Your helpers earned ✨${pendingOffline.gained} over ~${pendingOffline.mins} min.`
    : "Welcome! Scatter some seed and wait for your first visitor. 🐦");
  state.food=Math.min(state.food,capacity());
  fillTimer=fillInterval();
  requestAnimationFrame(loop);
}

if(document.readyState==="loading") document.addEventListener("DOMContentLoaded", init);
else init();

})();
