/* ============================================================
   game.js — Backyard Birds (cozy pixel-art feeder idle)
   Core loop, economy, automation, living world, quests,
   achievements, prestige, multiple areas, UI and save system.
   Renders into a low-res 480x270 canvas scaled up by CSS.
   ============================================================ */
(() => {
"use strict";

const SAVE_KEY = "backyard-birds-v2";
const MAX_CONCURRENT = 5;

/* ---------------- balance / config ---------------- */
const CONFIG = {
  baseCap: 5, baseSpawn: 5.0, scatterAmount: 1,
  eatTime: 1.4, sadTime: 1.0, sadPenaltyRatio: 0.4,
  fillerBaseInterval: 4.5, offlineCapHours: 4,
  dayLength: 300,            // seconds per in-game day
  seasonDays: 3,            // in-game days per season
  goldenEvery: [70,130],    // seconds between golden visitors
  hawkEvery: [130,220],     // seconds between hawk swoops
  frenzyNeed: 6, frenzyWindow: 12, frenzyTime: 15, frenzyMult: 2,
  goldenMult: 8,            // golden bird point multiplier
};

const SEASONS = [
  { id:"spring", name:"Spring", emoji:"🌸" },
  { id:"summer", name:"Summer", emoji:"☀️" },
  { id:"autumn", name:"Autumn", emoji:"🍂" },
  { id:"winter", name:"Winter", emoji:"❄️" },
];

const UPGRADES = [
  { id:"capacity",    name:"Bigger Tray",  emoji:"🪵", max:14, baseCost:25, growth:1.5,  desc:"+3 seed capacity each level." },
  { id:"attractor",   name:"Bird Bath",    emoji:"💧", max:12, baseCost:45, growth:1.55, desc:"Birds visit more often." },
  { id:"fillers",     name:"Hire a Helper",emoji:"🧑‍🌾", max:8, baseCost:60, growth:1.85, desc:"A helper auto-fills the feeder. Stacks." },
  { id:"fillerSpeed", name:"Seed Scoops",  emoji:"🥄", max:10, baseCost:85, growth:1.7,  desc:"Helpers refill faster." },
  { id:"seedQuality", name:"Premium Seed", emoji:"🌻", max:10, baseCost:70, growth:1.7,  desc:"+20% Bird Points from happy visits." },
  { id:"flowers",     name:"Flower Bed",   emoji:"🌷", max:6,  baseCost:120,growth:1.8,  desc:"A pretty patch: +6% points per level." },
];

const FOODS = [
  { id:"seed",  name:"Seed",   emoji:"🌾", cost:0,    desc:"The all-rounder — most backyard birds love it." },
  { id:"suet",  name:"Suet",   emoji:"🧈", cost:500,  desc:"Fatty cake woodpeckers & nuthatches adore." },
  { id:"nyjer", name:"Nyjer",  emoji:"🌰", cost:1500, desc:"Tiny thistle seed — a magnet for finches." },
  { id:"fruit", name:"Fruit",  emoji:"🍎", cost:4000, desc:"Berries & orange halves for thrushes & waxwings." },
  { id:"nectar",name:"Nectar", emoji:"🍯", cost:9000, desc:"Sweet sugar-water for orioles & tanagers." },
];
const FOOD_BY_ID = Object.fromEntries(FOODS.map(f=>[f.id,f]));
const SUBURB_FOODS = {
  american_robin:["seed","fruit"], american_goldfinch:["nyjer","seed"],
  house_finch:["seed","nyjer"], northern_cardinal:["seed","fruit"],
  rose_breasted_grosbeak:["seed","fruit"],
};
function foodsFor(b){ return b.foods || SUBURB_FOODS[b.id] || ["seed"]; }

/* sequential quest ladder — always something to chase */
const QUESTS = [
  { name:"First Friends",    desc:"Make 3 birds happy.",                metric:s=>s.happyVisits,            target:3,    reward:{points:25} },
  { name:"A Fuller Tray",    desc:"Upgrade the feeder capacity once.",  metric:s=>s.upgrades.capacity,      target:1,    reward:{points:40} },
  { name:"Hello, Neighbor",  desc:"Discover 5 species.",                metric:s=>discCount(),              target:5,    reward:{points:80} },
  { name:"Hired Help",       desc:"Hire your first helper.",            metric:s=>s.upgrades.fillers,       target:1,    reward:{points:120} },
  { name:"The Regulars",     desc:"Make 50 birds happy.",               metric:s=>s.happyVisits,            target:50,   reward:{feathers:1} },
  { name:"A Fine Spread",    desc:"Unlock a new kind of food.",         metric:s=>Object.keys(s.unlockedFoods).length, target:2, reward:{points:300} },
  { name:"Local Celebrity",  desc:"Discover all 12 suburb species.",    metric:s=>discCountArea("suburb"),  target:12,   reward:{feathers:3} },
  { name:"Into the Woods",   desc:"Unlock the Whispering Woodland.",    metric:s=>Object.keys(s.unlockedAreas).length, target:2, reward:{feathers:2} },
  { name:"Big Numbers",      desc:"Hold 5,000 Bird Points at once.",    metric:s=>s.points,                 target:5000, reward:{points:1000} },
  { name:"Collector",        desc:"Discover 20 species.",               metric:s=>discCount(),              target:20,   reward:{feathers:4} },
  { name:"Ready to Migrate", desc:"Earn 25,000 points this run.",       metric:s=>s.runPoints,              target:25000,reward:{feathers:5} },
  { name:"World Traveler",   desc:"Unlock every area.",                 metric:s=>Object.keys(s.unlockedAreas).length, target:4, reward:{feathers:10} },
  { name:"Master Naturalist",desc:"Discover all 35 species.",           metric:s=>discCount(),              target:35,   reward:{feathers:20} },
];

/* parallel achievements — permanent point bonuses */
const ACHIEVEMENTS = [
  { id:"wellfed",   name:"Well Fed",      desc:"Make 100 birds happy.",        check:()=>state.happyVisits>=100,  pointPct:0.05 },
  { id:"generous",  name:"Generous Soul", desc:"Make 1,000 birds happy.",      check:()=>state.happyVisits>=1000, pointPct:0.10 },
  { id:"watcher",   name:"Birdwatcher",   desc:"Discover 10 species.",         check:()=>discCount()>=10,         pointPct:0.05 },
  { id:"naturalist",name:"Naturalist",    desc:"Discover 20 species.",         check:()=>discCount()>=20,         pointPct:0.10 },
  { id:"complete",  name:"Completionist", desc:"Discover all 35 species.",     check:()=>discCount()>=35,         pointPct:0.25 },
  { id:"automation",name:"Automation",    desc:"Employ 5 helpers.",            check:()=>state.upgrades.fillers>=5, pointPct:0.05 },
  { id:"frenzy",    name:"Five-Star Café",desc:"Trigger a feeding frenzy.",    check:()=>!!state.flags.frenzy,    pointPct:0.05 },
  { id:"storm",     name:"Storm Chaser",  desc:"Feed a bird in the rain.",     check:()=>!!state.flags.fedRain,   pointPct:0.05 },
  { id:"seasoned",  name:"Four Seasons",  desc:"See all four seasons.",        check:()=>Object.keys(state.flags.seasonsSeen||{}).length>=4, pointPct:0.05 },
  { id:"golden",    name:"Golden Touch",  desc:"Catch a golden visitor.",      check:()=>!!state.flags.golden,    pointPct:0.05 },
];

/* prestige (Feathers) upgrades — permanent across migrations */
const PRESTIGE = [
  { id:"pPoints", name:"Heirloom Seed",    emoji:"🌟", max:25, baseCost:1, growth:1.6, desc:"+8% Bird Points per level." },
  { id:"pSpawn",  name:"Migratory Routes", emoji:"🧭", max:15, baseCost:2, growth:1.7, desc:"-5% time between visitors." },
  { id:"pOffline",name:"Caretakers",       emoji:"🛖", max:12, baseCost:2, growth:1.7, desc:"+15% idle & offline earnings." },
  { id:"pStart",  name:"Established Yard",  emoji:"🏡", max:8,  baseCost:3, growth:1.8, desc:"+3 starting seed capacity." },
  { id:"pFeather",name:"Living Legacy",     emoji:"🪶", max:10, baseCost:5, growth:1.9, desc:"+10% Feathers earned on migration." },
];

/* ---------------- state ---------------- */
function defaultState(){
  return {
    v:2,
    points:0, runPoints:0, food:3, foodType:"seed",
    upgrades:{ capacity:0, attractor:0, fillers:0, fillerSpeed:0, seedQuality:0, flowers:0 },
    unlockedFoods:{ seed:true },
    discovered:{}, seen:{}, speciesFed:{}, happyVisits:0, sadVisits:0,
    area:"suburb", unlockedAreas:{ suburb:true },
    questIdx:0, achievements:{},
    feathers:0, migrations:0, prestige:{ pPoints:0, pSpawn:0, pOffline:0, pStart:0, pFeather:0 },
    clock:0.32, dayCount:0,
    lastDay:null, streak:0,
    flags:{ seasonsSeen:{}, fedRain:false, frenzy:false, golden:false },
    muted:false, lastSave:Date.now(),
  };
}
let state = defaultState();

/* ---------------- derived ---------------- */
const achPct = () => ACHIEVEMENTS.reduce((s,a)=> s + (state.achievements[a.id]? a.pointPct:0), 0);
const capacity     = () => CONFIG.baseCap + state.upgrades.capacity*3 + state.prestige.pStart*3;
const pointMult    = () => (1 + state.upgrades.seedQuality*0.2 + state.upgrades.flowers*0.06)
                          * (1 + achPct())
                          * (1 + state.prestige.pPoints*0.08)
                          * (frenzyActive()?CONFIG.frenzyMult:1);
const spawnInterval= () => Math.max(1.1, CONFIG.baseSpawn
                          * Math.pow(0.9, state.upgrades.attractor)
                          * Math.pow(0.95, state.prestige.pSpawn));
const fillerCount  = () => state.upgrades.fillers;
const fillInterval = () => Math.max(1.1, CONFIG.fillerBaseInterval * Math.pow(0.86, state.upgrades.fillerSpeed));
const offlineRate  = () => 0.6 * (1 + state.prestige.pOffline*0.15);
const upgCost   = u => Math.round(u.baseCost * Math.pow(u.growth, state.upgrades[u.id]));
const presCost  = p => Math.ceil(p.baseCost * Math.pow(p.growth, state.prestige[p.id]));
const currentSeason = () => Math.floor(state.dayCount/CONFIG.seasonDays)%4;
const daylight  = () => { const c=Math.cos((state.clock-0.5)*2*Math.PI); return Math.max(0.12,(c+1)/2); };
function discCount(){ return Object.keys(state.discovered).length; }
function discCountArea(a){ return BIRDS.filter(b=>b.area===a && state.discovered[b.id]).length; }
function speciesMastery(id){ const n=state.speciesFed[id]||0; return n>=500?2 : n>=100?1.5 : n>=25?1.25 : 1; }
function feathersOnMigrate(){ return Math.floor(Math.sqrt(state.runPoints/250) * (1 + state.prestige.pFeather*0.1)); }

/* ---------------- runtime ---------------- */
let canvas, ctx, t=0, lastTs=0, hudTick=0, saveTick=0;
let birds=[], floats=[], seeds=[], rain=[];
let occupied=new Set();
let spawnTimer=2.0, fillTimer=0;
let pendingOffline=null, pendingDaily=null;
let bgInterval=null, bgLast=0, bgGained=0;
let weather="clear", weatherTimer=20;
let goldenTimer=rnd(...CONFIG.goldenEvery), hawkTimer=rnd(...CONFIG.hawkEvery);
let hawk=null, frenzyUntil=0, recentHappy=[];
let dailyVisitorId=null;
const poolCache={};
function rnd(a,b){ return a+Math.random()*(b-a); }

/* ============================================================
   SAVE / LOAD / IDLE
   ============================================================ */
function save(){ state.lastSave=Date.now(); try{ localStorage.setItem(SAVE_KEY, JSON.stringify(state)); }catch(e){} }
function load(){
  try{
    const raw=localStorage.getItem(SAVE_KEY);
    if(raw){
      const s=JSON.parse(raw); const d=defaultState();
      state=Object.assign(d, s);
      state.upgrades=Object.assign(d.upgrades, s.upgrades||{});
      state.prestige=Object.assign(d.prestige, s.prestige||{});
      state.flags=Object.assign(d.flags, s.flags||{});
      state.unlockedAreas=Object.assign({suburb:true}, s.unlockedAreas||{});
      state.unlockedFoods=Object.assign({seed:true}, s.unlockedFoods||{});
      state.discovered=s.discovered||{}; state.seen=s.seen||{}; state.speciesFed=s.speciesFed||{};
    }
  }catch(e){ state=defaultState(); }
}
function accrue(seconds){
  seconds=Math.min(seconds, CONFIG.offlineCapHours*3600);
  if(seconds<=0 || fillerCount()<=0) return 0;
  const seedPerSec=fillerCount()/fillInterval();
  const visitPerSec=1/spawnInterval();
  const served=Math.min(visitPerSec,seedPerSec)*seconds;
  let avg=0; const p=areaPool(); const tw=p.reduce((a,x)=>a+x.weight,0)||1;
  for(const x of p) avg+=x.bird.points*(x.weight/tw);
  const gained=Math.floor(served*avg*pointMult()*offlineRate());
  if(gained>0){ addPoints(gained); state.happyVisits+=Math.floor(served); state.food=capacity(); }
  return gained;
}
function applyOffline(){
  const secs=(Date.now()-(state.lastSave||Date.now()))/1000;
  if(secs<30) return;
  const g=accrue(secs);
  if(g>0) pendingOffline={ gained:g, mins:Math.round(Math.min(secs,CONFIG.offlineCapHours*3600)/60) };
}
function addPoints(n){ state.points+=n; if(n>0) state.runPoints+=n; }

/* ============================================================
   SPAWN POOL (area + season + food + weather + daily visitor)
   ============================================================ */
function areaPool(){
  const season=currentSeason();
  return BIRDS.filter(b=> b.area===state.area && (!b.season || b.season.includes(season)))
    .map(b=>({ bird:b, weight: weightFor(b) }));
}
function weightFor(b){
  let w=RARITY[b.rarity].weight;
  const prefs=foodsFor(b);
  w *= prefs.includes(state.foodType) ? 3 : 0.35;
  if(weather==="rain" && b.rainLover) w*=2.6;
  if(b.id===dailyVisitorId) w*=6;
  return Math.max(0.02,w);
}
function pickSpecies(){
  const p=areaPool(); const tw=p.reduce((a,x)=>a+x.weight,0);
  let r=Math.random()*tw;
  for(const x of p){ if((r-=x.weight)<=0) return x.bird; }
  return p.length?p[0].bird:BIRDS[0];
}

/* ============================================================
   SPAWNING & BIRD LIFE-CYCLE
   ============================================================ */
function currentFeeder(){ return { x:Sprites.L.feeder.x, trayY:Sprites.L.feeder.trayY, food:state.food, cap:capacity() }; }
function freeSlotIndex(feeder){
  const slots=Sprites.perchSlots(feeder), idx=[];
  for(let i=0;i<slots.length;i++) if(!occupied.has(i)) idx.push(i);
  return idx.length? idx[(Math.random()*idx.length)|0] : -1;
}
function spawnBird(feeder, opts={}){
  if(birds.length>=MAX_CONCURRENT) return false;
  const idx=freeSlotIndex(feeder); if(idx<0) return false;
  const slot=Sprites.perchSlots(feeder)[idx];
  const sp=opts.species||pickSpecies();
  occupied.add(idx);
  const fromLeft=Math.random()<0.5;
  birds.push({
    sp, slotIndex:idx, slot, golden:!!opts.golden,
    x: fromLeft?-20:Sprites.L.W+20, y:16+Math.random()*64,
    tx:slot.x, ty:slot.y - Sprites.standHeight(sp),
    facing: slot.x>(fromLeft?-20:Sprites.L.W+20)?1:-1,
    phase:Math.random()*7, mode:"fly", st:"incoming",
    flapPhase:Math.random()*7, bob:0, peck:0, timer:0, emote:null, emoteFade:1,
    life: opts.golden?9:999,
  });
  return true;
}
function arriveDecide(b){
  state.seen[b.sp.id]=(state.seen[b.sp.id]||0)+1;
  if(!state.discovered[b.sp.id]){ state.discovered[b.sp.id]=true; onDiscover(b.sp); }
  b.mode="perch"; b.facing=b.slot.facing;
  if(b.golden){ b.st="eating"; b.timer=2.5; b.emote="happy"; return; }   // golden: click to collect
  if(state.food>0){
    state.food-=1; b.st="eating"; b.timer=CONFIG.eatTime; b.emote="note"; b.emoteFade=1;
    if(weather==="rain" && !state.flags.fedRain){ state.flags.fedRain=true; checkAchievements(); }
  } else {
    b.st="sad"; b.timer=CONFIG.sadTime; b.emote="sad"; b.emoteFade=1;
    const lost=Math.max(1,Math.ceil(b.sp.points*CONFIG.sadPenaltyRatio));
    state.points=Math.max(0,state.points-lost); state.sadVisits++;
    addFloat(b.x,b.ty-12,"-"+lost,"#c0563f"); flashStat("pointsVal"); sfx("sad");
  }
}
function finishEating(b){
  if(b.golden) return;   // golden handled by click only
  const gain=Math.max(1, Math.round(b.sp.points * pointMult() * speciesMastery(b.sp.id)));
  addPoints(gain); state.happyVisits++;
  state.speciesFed[b.sp.id]=(state.speciesFed[b.sp.id]||0)+1;
  registerHappy();
  addFloat(b.x,b.ty-12,"+"+gain,"#caa12a");
  b.emote="happy"; b.emoteFade=1;
  flashStat("pointsVal"); flashStat("happyVal"); sfx("happy");
  notifyProgress();
  startLeaving(b);
}
function collectGolden(b){
  const gain=Math.max(60, Math.round(state.points*0.06)) + Math.round(b.sp.points*CONFIG.goldenMult);
  addPoints(gain); state.happyVisits++;
  if(!state.flags.golden){ state.flags.golden=true; checkAchievements(); }
  if(Math.random()<0.5){ state.feathers+=1; addFloat(b.x,b.ty-22,"+1🪶","#e8c34a"); }
  addFloat(b.x,b.ty-12,"+"+gain,"#f0c419"); flashStat("pointsVal");
  for(let i=0;i<14;i++) sparkle(b.x+(Math.random()-0.5)*22, b.ty-6+(Math.random()-0.5)*18);
  sfx("discover"); notifyProgress(); startLeaving(b);
}
function startLeaving(b){
  b.st="leaving"; b.mode="fly"; occupied.delete(b.slotIndex);
  b.tx=b.x<Sprites.L.W/2?-30:Sprites.L.W+30; b.ty=16+Math.random()*54;
}
function registerHappy(){
  const now=t; recentHappy.push(now);
  recentHappy=recentHappy.filter(x=>now-x<=CONFIG.frenzyWindow);
  if(recentHappy.length>=CONFIG.frenzyNeed && !frenzyActive()){
    frenzyUntil=t+CONFIG.frenzyTime; recentHappy=[];
    if(!state.flags.frenzy){ state.flags.frenzy=true; checkAchievements(); }
    showFrenzy(true); ticker("🎉 Feeding frenzy! Double points!"); sfx("discover");
  }
}
const frenzyActive = () => t<frenzyUntil;

function updateBird(b, dt){
  b.flapPhase += dt*(b.mode==="fly"?15:0);
  if(b.golden){ b.life-=dt; if(b.life<=0 && b.st!=="leaving") startLeaving(b); }
  switch(b.st){
    case "incoming":{
      const dx=b.tx-b.x, dy=b.ty-b.y, d=Math.hypot(dx,dy), sp=95*dt;
      if(d>2){ b.x+=dx/d*sp; b.y+=dy/d*sp; b.facing=dx>=0?1:-1; b.bob=Math.sin(t*12+b.phase); }
      else { b.x=b.tx; b.y=b.ty; b.bob=0; arriveDecide(b); }
      break; }
    case "eating":{
      b.peck=b.golden?0:(Math.sin(t*13+b.phase)+1)/2; b.bob=Math.sin(t*3)*0.4; b.timer-=dt;
      if(b.timer<=0 && !b.golden){ b.peck=0; finishEating(b); }
      break; }
    case "sad":{ b.bob=Math.sin(t*22+b.phase)*0.8; b.timer-=dt; if(b.timer<=0) startLeaving(b); break; }
    case "leaving":{
      const dx=b.tx-b.x, dy=b.ty-b.y, d=Math.hypot(dx,dy)||1, sp=105*dt;
      b.x+=dx/d*sp; b.y+=dy/d*sp; b.facing=dx>=0?1:-1; b.bob=Math.sin(t*12+b.phase);
      b.emoteFade-=dt*0.7;
      if(b.x<-26||b.x>Sprites.L.W+26||b.y<-20) b._dead=true;
      break; }
  }
  if(b.emote && b.emoteFade<=0) b.emote=null;
}

/* ---- hawk predator event ---- */
function spawnHawk(){
  if(hawk) return;
  const fromLeft=Math.random()<0.5;
  hawk={ x:fromLeft?-30:Sprites.L.W+30, y:60+Math.random()*40, facing:fromLeft?1:-1,
         tx:fromLeft?Sprites.L.W+40:-40, ty:80+Math.random()*40, flap:0, shooed:false, scared:false };
  ticker("🦅 A hawk! Click it to shoo it away!");
}
function updateHawk(dt){
  if(!hawk) return;
  hawk.flap+=dt*12;
  const dx=hawk.tx-hawk.x, dy=hawk.ty-hawk.y, d=Math.hypot(dx,dy)||1;
  hawk.x+=dx/d*70*dt; hawk.y+=dy/d*70*dt; hawk.facing=dx>=0?1:-1;
  if(!hawk.scared && Math.abs(hawk.x-Sprites.L.feeder.x)<160){  // scares birds when near
    hawk.scared=true;
    for(const b of birds){ if(b.st!=="leaving" && !b.golden) startLeaving(b); }
  }
  if(hawk.x<-40 || hawk.x>Sprites.L.W+40) hawk=null;
}

/* ============================================================
   LIVING WORLD: clock, seasons, weather, golden, daily
   ============================================================ */
function updateWorld(dt){
  // day / season
  const prevSeason=currentSeason();
  state.clock += dt/CONFIG.dayLength;
  while(state.clock>=1){ state.clock-=1; state.dayCount++; }
  const seas=currentSeason();
  if(!state.flags.seasonsSeen) state.flags.seasonsSeen={};
  if(!state.flags.seasonsSeen[seas]){ state.flags.seasonsSeen[seas]=true; checkAchievements(); }
  if(seas!==prevSeason) ticker(`${SEASONS[seas].emoji} ${SEASONS[seas].name} has arrived in the ${areaName()}.`);

  // weather
  weatherTimer-=dt;
  if(weatherTimer<=0){
    const r=Math.random();
    weather = r<0.6?"clear" : r<0.85?"cloudy" : "rain";
    weatherTimer=rnd(40,90);
    if(weather==="rain") seedRain();
  }

  // golden visitor
  goldenTimer-=dt;
  if(goldenTimer<=0){ goldenTimer=rnd(...CONFIG.goldenEvery);
    spawnBird(currentFeeder(), { golden:true }); }

  // hawk
  hawkTimer-=dt;
  if(hawkTimer<=0){ hawkTimer=rnd(...CONFIG.hawkEvery); spawnHawk(); }
}
function areaName(){ return (AREAS.find(a=>a.id===state.area)||{}).name||"yard"; }

/* daily visitor + login streak (real calendar day) */
function checkDailyLogin(){
  const today=new Date().toDateString();
  // pick a featured visitor for the day from unlocked areas (favor rarer birds)
  const eligible=BIRDS.filter(b=>state.unlockedAreas[b.area]);
  if(eligible.length){
    let seed=0; for(const c of today) seed=(seed*31+c.charCodeAt(0))&0xffffffff;
    dailyVisitorId=eligible[Math.abs(seed)%eligible.length].id;
  }
  if(state.lastDay!==today){
    const y=new Date(Date.now()-86400000).toDateString();
    state.streak = (state.lastDay===y) ? state.streak+1 : 1;
    state.lastDay=today;
    const fr=Math.min(5,state.streak); state.feathers+=fr;
    pendingDaily={ streak:state.streak, feathers:fr, bird:BIRDS_BY_ID[dailyVisitorId] };
    save();
  }
}

/* ============================================================
   UPDATE
   ============================================================ */
function update(dt){
  const feeder=currentFeeder();
  updateWorld(dt);
  if(fillerCount()>0){
    fillTimer-=dt;
    if(fillTimer<=0){ const b0=state.food; state.food=Math.min(capacity(),state.food+fillerCount());
      if(state.food>b0) spawnSeedToss(feeder, Math.min(3,fillerCount())); fillTimer=fillInterval(); }
  }
  if(!hawk){   // birds don't arrive while a hawk patrols
    spawnTimer-=dt;
    if(spawnTimer<=0){ if(spawnBird(feeder)) spawnTimer=spawnInterval()*(0.7+Math.random()*0.6); else spawnTimer=0.6; }
  }
  for(const b of birds) updateBird(b,dt);
  birds=birds.filter(b=>!b._dead);
  updateHawk(dt);
  for(const f of floats){ f.y+=f.vy*dt; f.life-=dt; } floats=floats.filter(f=>f.life>0);
  for(const s of seeds){ s.vy+=240*dt; s.x+=s.vx*dt; s.y+=s.vy*dt; s.life-=dt; if(s.y>=s.gy){ s.y=s.gy; s.vy*=-0.35; s.vx*=0.6; } }
  seeds=seeds.filter(s=>s.life>0);
  if(weather==="rain"){ for(const r of rain){ r.y+=r.v*dt; r.x+=r.v*0.18*dt; if(r.y>Sprites.L.H){ r.y=-4; r.x=Math.random()*Sprites.L.W; } } }
  if(frenzyActive()!==frenzyShown) showFrenzy(frenzyActive());
}

/* ============================================================
   RENDER
   ============================================================ */
let frenzyShown=false;
function render(){
  ctx.imageSmoothingEnabled=false;
  const env={ season:currentSeason(), area:state.area, weather, daylight:daylight() };
  Sprites.drawBackground(ctx, t, env);
  // decorations on the lawn
  if(state.upgrades.flowers>0) Sprites.drawDecor(ctx,"flowers",Sprites.L.feeder.x-70,Sprites.L.groundContact+6,state.upgrades.flowers);
  if(state.upgrades.attractor>0) Sprites.drawDecor(ctx,"birdbath",Sprites.L.feeder.x+74,Sprites.L.groundContact+2,1);
  Sprites.drawFeeder(ctx, currentFeeder(), t);

  for(const s of seeds){ ctx.fillStyle="#caa15c"; ctx.fillRect(s.x|0,s.y|0,1,1); }

  for(const b of birds.slice().sort((a,b)=>a.y-b.y)){
    const sp = b.golden ? goldVersion(b.sp) : b.sp;
    Sprites.drawBird(ctx, sp, { x:b.x,y:b.y,facing:b.facing,mode:b.mode,flapPhase:b.flapPhase,bob:b.bob,peck:b.peck,emote:b.emote,emoteFade:b.emoteFade });
    if(b.golden) goldSparkle(b);
  }
  if(hawk) Sprites.drawHawk(ctx, hawk.x, hawk.y, hawk.facing, hawk.flap);

  // floating point text
  for(const f of floats){
    const a=Math.max(0,Math.min(1,f.life/0.9)), w=Sprites.pixelTextWidth(f.text,1), x=Math.round(f.x-w/2), y=Math.round(f.y);
    ctx.globalAlpha=a*0.6; Sprites.pixelText(ctx,x+1,y+1,f.text,"#3a2a1a",1);
    ctx.globalAlpha=a;     Sprites.pixelText(ctx,x,y,f.text,f.color,1);
  }
  ctx.globalAlpha=1;

  // weather: rain
  if(weather==="rain"){ ctx.strokeStyle="rgba(180,205,230,.5)"; ctx.lineWidth=1; ctx.beginPath();
    for(const r of rain){ ctx.moveTo(r.x,r.y); ctx.lineTo(r.x+1.4,r.y+r.len); } ctx.stroke(); }

  // night tint + stars + moon
  const dl=env.daylight;
  if(dl<0.98){
    ctx.fillStyle=`rgba(20,26,58,${(1-dl)*0.55})`; ctx.fillRect(0,0,Sprites.L.W,Sprites.L.H);
    if(dl<0.55) drawNightSky(1-(dl-0.12)/0.43);
  }
}
function drawNightSky(intensity){
  const a=Math.max(0,Math.min(1,intensity));
  ctx.globalAlpha=a;
  // stars (deterministic)
  let s=24680;
  for(let i=0;i<46;i++){ s=(s*1103515245+12345)&0x7fffffff; const x=(s>>4)%Sprites.L.W; s=(s*1103515245+12345)&0x7fffffff; const y=(s>>4)%110;
    ctx.fillStyle = (i%5)? "#fdfbe8":"#cfe0ff"; ctx.fillRect(x,y,1,1); }
  // moon
  ctx.fillStyle="#f3efd2"; const mx=Math.round(60+state.clock*40);
  ctx.beginPath(); ctx.arc(410,38,11,0,7); ctx.fill();
  ctx.fillStyle=`rgba(20,26,58,${a})`; ctx.beginPath(); ctx.arc(415,34,9,0,7); ctx.fill();
  ctx.globalAlpha=1;
}
function goldVersion(sp){
  return { id:sp.id, name:sp.name, shape:sp.shape, palette:{
    body:"#f4cf3e", belly:"#fbe88a", wing:"#d9a521", tail:"#c9971c", beak:"#b97e16", eye:"#3a2a08",
    head:"#f6d84e", cap:"#e6b52c", cheek:"#fff0a8", mask:"#caa024", bib:"#ffe27a" } };
}
function goldSparkle(b){
  const n=3;
  for(let i=0;i<n;i++){ const a=t*4+i*2.1+b.phase; const r=10+Math.sin(t*3+i)*4;
    ctx.fillStyle = (i%2)?"#fff6c0":"#ffe06a"; ctx.fillRect(Math.round(b.x+Math.cos(a)*r), Math.round(b.y-6+Math.sin(a)*r*0.7),1,1); }
}
function sparkle(x,y){ floats.push({x,y,text:"·",color:"#ffe06a",vy:-20,life:0.6}); }

function loop(ts){
  if(!lastTs) lastTs=ts;
  let dt=(ts-lastTs)/1000; lastTs=ts; if(dt>0.1) dt=0.1;
  t+=dt; update(dt); render();
  hudTick+=dt; if(hudTick>0.12){ refreshHUD(); hudTick=0; }
  saveTick+=dt; if(saveTick>5){ save(); saveTick=0; }
  requestAnimationFrame(loop);
}

/* ---- particles ---- */
function addFloat(x,y,text,color){ floats.push({x,y,text,color,vy:-16,life:1.0}); }
function spawnSeedToss(f,n){ for(let i=0;i<n*3;i++) seeds.push({ x:f.x+(Math.random()-0.5)*16,y:f.trayY-30,vx:(Math.random()-0.5)*34,vy:-10-Math.random()*22,gy:f.trayY-1,life:0.9+Math.random()*0.4 }); }
function seedRain(){ rain=[]; for(let i=0;i<70;i++) rain.push({ x:Math.random()*Sprites.L.W, y:Math.random()*Sprites.L.H, v:230+Math.random()*120, len:4+Math.random()*4 }); }

/* ============================================================
   PROGRESS: quests + achievements
   ============================================================ */
function notifyProgress(){ checkQuests(); checkAchievements(); }
function checkQuests(){
  while(state.questIdx<QUESTS.length){
    const q=QUESTS[state.questIdx];
    if(q.metric(state) >= q.target){
      if(q.reward.points){ addPoints(q.reward.points); }
      if(q.reward.feathers){ state.feathers+=q.reward.feathers; }
      const rw = q.reward.feathers ? `+${q.reward.feathers}🪶` : `+${q.reward.points}✨`;
      ticker(`✅ Quest complete: ${q.name}  (${rw})`); sfx("buy");
      state.questIdx++; save();
    } else break;
  }
  buildQuests();
}
function checkAchievements(){
  let any=false;
  for(const a of ACHIEVEMENTS){
    if(!state.achievements[a.id] && a.check()){ state.achievements[a.id]=true; any=true;
      ticker(`🏆 Achievement: ${a.name}  (+${Math.round(a.pointPct*100)}% points)`); sfx("discover"); }
  }
  if(any){ buildAchievements(); save(); }
}

/* ============================================================
   UI
   ============================================================ */
const $=id=>document.getElementById(id);
function refreshHUD(){
  $("pointsVal").textContent=Math.floor(state.points).toLocaleString();
  $("featherVal").textContent=state.feathers.toLocaleString();
  $("foodVal").textContent=state.food; $("capVal").textContent=capacity();
  $("foodTypeIco").textContent=FOOD_BY_ID[state.foodType].emoji;
  $("happyVal").textContent=state.happyVisits.toLocaleString();
  $("discVal").textContent=discCount(); $("totalVal").textContent=BIRDS.length;
  $("areaName").textContent=areaName();
  const seas=SEASONS[currentSeason()];
  $("seasonIco").textContent=seas.emoji; $("seasonIco").title=seas.name;
  const c=state.clock; $("timeIco").textContent = c<0.22||c>0.82?"🌙": c<0.3?"🌅": c>0.72?"🌇":"☀️";
  $("weatherIco").textContent = weather==="rain"?"🌧️":weather==="cloudy"?"⛅":"☀️";
  $("streakVal").textContent=state.streak;
  refreshShop();
}
function flashStat(valId){ const el=$(valId); if(!el)return; const s=el.closest(".stat"); if(!s)return; s.classList.remove("flash"); void s.offsetWidth; s.classList.add("flash"); }

/* ---- shop ---- */
function buildShop(){
  const list=$("shopList"); list.innerHTML="";
  for(const u of UPGRADES){
    const item=document.createElement("div"); item.className="shop-item"; item.dataset.id=u.id;
    item.innerHTML=`<div class="shop-ico">${u.emoji}</div>
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
    const lvl=state.upgrades[u.id]; item.querySelector("[data-lvl]").textContent=lvl>0?`Lv.${lvl}`:"";
    const btn=item.querySelector("[data-buy]");
    if(lvl>=u.max){ btn.className="buy-btn maxed"; btn.disabled=true; btn.innerHTML="MAX"; }
    else{ const cost=upgCost(u); btn.className="buy-btn"; btn.disabled=state.points<cost;
      btn.innerHTML=`${lvl>0?"Upgrade":"Buy"}<small>✨ ${cost.toLocaleString()}</small>`; }
  }
}
function buyUpgrade(u){
  const lvl=state.upgrades[u.id]; if(lvl>=u.max) return; const cost=upgCost(u); if(state.points<cost) return;
  state.points-=cost; state.upgrades[u.id]++;
  if(u.id==="fillers" && fillTimer<=0) fillTimer=0.2;
  if(u.id==="capacity") state.food=Math.min(state.food,capacity());
  sfx("buy"); ticker(`${u.name} ${state.upgrades[u.id]>1?"upgraded":"unlocked"}! 🐣`);
  notifyProgress(); refreshHUD(); save();
}

/* ---- food selector ---- */
function buildFoods(){
  const bar=$("foodBar"); bar.innerHTML="";
  for(const f of FOODS){
    const chip=document.createElement("button"); chip.className="food-chip"; chip.dataset.id=f.id;
    chip.innerHTML=`<span class="fc-ico">${f.emoji}</span><span class="fc-name">${f.name}</span><span class="fc-sub" data-sub></span>`;
    chip.addEventListener("click",()=>onFood(f));
    bar.appendChild(chip);
  }
  refreshFoods();
}
function refreshFoods(){
  for(const f of FOODS){
    const chip=document.querySelector(`.food-chip[data-id="${f.id}"]`); if(!chip) continue;
    const unlocked=!!state.unlockedFoods[f.id], active=state.foodType===f.id;
    chip.classList.toggle("active",active); chip.classList.toggle("locked",!unlocked);
    chip.querySelector("[data-sub]").textContent = unlocked ? (active?"active":"") : `✨${f.cost.toLocaleString()}`;
  }
}
function onFood(f){
  if(state.unlockedFoods[f.id]){ state.foodType=f.id; sfx("scatter"); ticker(`Now serving ${f.name}. ${f.emoji}`); }
  else if(state.points>=f.cost){ state.points-=f.cost; state.unlockedFoods[f.id]=true; state.foodType=f.id;
    sfx("buy"); ticker(`Unlocked ${f.name}! ${f.emoji}`); notifyProgress(); }
  else { ticker(`Need ✨${f.cost.toLocaleString()} to stock ${f.name}.`); return; }
  refreshFoods(); refreshHUD(); save();
}

/* ---- bird index ---- */
const indexCells={};
function buildIndex(){
  const grid=$("indexGrid"); grid.innerHTML=""; const areasOrder=["suburb","forest","wetland","mountain"];
  for(const aid of areasOrder){
    const area=AREAS.find(a=>a.id===aid);
    const hdr=document.createElement("div"); hdr.className="index-area-hdr"; hdr.textContent=`${area.emoji} ${area.name}`; grid.appendChild(hdr);
    const wrap=document.createElement("div"); wrap.className="index-row"; grid.appendChild(wrap);
    for(const sp of BIRDS.filter(b=>b.area===aid)){
      const cell=document.createElement("div"); cell.className="index-cell";
      const cv=document.createElement("canvas"); cv.width=72; cv.height=60;
      const name=document.createElement("div"); name.className="ic-name";
      const dot=document.createElement("div"); dot.className="ic-dot";
      cell.appendChild(dot); cell.appendChild(cv); cell.appendChild(name); wrap.appendChild(cell);
      indexCells[sp.id]={cell,cv,name,dot};
      cell.addEventListener("click",()=>{ if(state.discovered[sp.id]) openCard(sp); });
      paintIndexCell(sp);
    }
  }
}
function paintIndexCell(sp){
  const c=indexCells[sp.id]; if(!c) return; const found=!!state.discovered[sp.id];
  c.cell.classList.toggle("found",found); c.cell.classList.toggle("locked",!found);
  c.dot.style.background=RARITY[sp.rarity].color; c.dot.style.display=found?"block":"none";
  if(found){ c.name.textContent=sp.name; c.name.classList.remove("locked"); Sprites.drawPortrait(c.cv,sp,{}); }
  else{ c.name.textContent="? ? ?"; c.name.classList.add("locked"); Sprites.drawPortrait(c.cv,sp,{silhouette:"#b9ab8f"}); }
}
function onDiscover(sp){
  paintIndexCell(sp); indexCells[sp.id]?.cell.classList.add("new");
  toast(sp,"New species discovered!"); ticker(`You discovered the ${sp.name}! 🎉`);
  sfx("discover"); notifyProgress(); refreshHUD(); save();
}

/* ---- species card ---- */
function openCard(sp){
  $("cardName").textContent=sp.name; const rar=RARITY[sp.rarity]; const rEl=$("cardRarity"); rEl.textContent=rar.label; rEl.style.color=rar.color;
  const m=speciesMastery(sp.id), fed=state.speciesFed[sp.id]||0;
  $("cardDesc").textContent=sp.desc; $("cardPoints").textContent=sp.points; $("cardSeen").textContent=state.seen[sp.id]||0;
  $("cardMastery").textContent = m>1?`×${m} mastery (fed ${fed})`:`fed ${fed} — feed 25 for a bonus`;
  Sprites.drawPortrait($("cardCanvas"),sp,{}); $("cardModal").classList.remove("hidden");
  indexCells[sp.id]?.cell.classList.remove("new");
}

/* ---- goals: quests + achievements ---- */
function buildQuests(){
  const list=$("questList"); if(!list) return; list.innerHTML="";
  const shown=QUESTS.slice(state.questIdx, state.questIdx+3);
  if(!shown.length){ list.innerHTML=`<div class="quest done">🌟 All quests complete — you legend!</div>`; return; }
  shown.forEach((q,i)=>{
    const cur=q.metric(state), pct=Math.min(100,Math.round(cur/q.target*100));
    const rw=q.reward.feathers?`+${q.reward.feathers}🪶`:`+${q.reward.points}✨`;
    const el=document.createElement("div"); el.className="quest"+(i===0?" active":"");
    el.innerHTML=`<div class="q-top"><b>${q.name}</b><span>${rw}</span></div>
      <div class="q-desc">${q.desc}</div>
      <div class="q-bar"><div class="q-fill" style="width:${pct}%"></div></div>
      <div class="q-num">${Math.min(cur,q.target).toLocaleString()} / ${q.target.toLocaleString()}</div>`;
    list.appendChild(el);
  });
}
function buildAchievements(){
  const list=$("achList"); if(!list) return; list.innerHTML="";
  for(const a of ACHIEVEMENTS){
    const got=!!state.achievements[a.id];
    const el=document.createElement("div"); el.className="ach"+(got?" got":"");
    el.innerHTML=`<span class="ach-ico">${got?"🏆":"🔒"}</span>
      <div><b>${a.name}</b><p>${a.desc}</p></div>
      <span class="ach-bonus">+${Math.round(a.pointPct*100)}%</span>`;
    list.appendChild(el);
  }
}

/* ---- areas (unlock + switch) ---- */
function buildAreas(){
  const list=$("areaList"); list.innerHTML="";
  for(const a of AREAS){
    const unlocked=!!state.unlockedAreas[a.id], active=a.id===state.area;
    const card=document.createElement("div"); card.className="area-card"+(active?" active":unlocked?"":" locked");
    const found=discCountArea(a.id), total=BIRDS.filter(b=>b.area===a.id).length;
    let btn;
    if(active) btn=`<span class="area-tag on">Here</span>`;
    else if(unlocked) btn=`<button class="area-btn go" data-go="${a.id}">Visit</button>`;
    else btn=`<button class="area-btn buy" data-buy="${a.id}">✨ ${a.cost.toLocaleString()}</button>`;
    card.innerHTML=`<div class="area-emoji">${a.emoji}</div>
      <div><h3>${a.name}</h3><p>${a.blurb}</p><p class="area-prog">${unlocked?`${found}/${total} discovered`:"Locked"}</p></div>${btn}`;
    list.appendChild(card);
  }
  list.querySelectorAll("[data-go]").forEach(b=>b.addEventListener("click",()=>switchArea(b.dataset.go)));
  list.querySelectorAll("[data-buy]").forEach(b=>b.addEventListener("click",()=>unlockArea(b.dataset.buy)));
}
function unlockArea(id){
  const a=AREAS.find(x=>x.id===id); if(!a||state.unlockedAreas[id]) return;
  if(state.points<a.cost){ ticker(`Need ✨${a.cost.toLocaleString()} to open the ${a.name}.`); return; }
  state.points-=a.cost; state.unlockedAreas[id]=true; sfx("discover");
  ticker(`🗺️ Unlocked the ${a.name}!`); switchArea(id); notifyProgress();
}
function switchArea(id){
  if(!state.unlockedAreas[id]) return;
  state.area=id; birds=[]; occupied.clear(); hawk=null; spawnTimer=1.0;
  buildAreas(); refreshHUD(); ticker(`Travelled to the ${areaName()}. ${(AREAS.find(a=>a.id===id)||{}).emoji||""}`); sfx("scatter"); save();
}

/* ---- prestige / migration ---- */
function buildPrestige(){
  const info=$("migrateInfo"); const gain=feathersOnMigrate();
  info.innerHTML=`<p>Migrate to reset your points, upgrades, foods and current area — but keep your
    <b>collection</b>, <b>achievements</b> and <b>Feathers</b>. Each migration earns Feathers to spend on permanent boosts.</p>
    <p class="migrate-gain">Migrating now earns <b>+${gain} 🪶</b> &nbsp;·&nbsp; Migrations: <b>${state.migrations}</b></p>`;
  const mb=$("migrateBtn"); mb.disabled=gain<1; mb.textContent= gain<1?"Earn more points first":`🦅 Migrate (+${gain}🪶)`;
  const list=$("prestigeList"); list.innerHTML="";
  for(const p of PRESTIGE){
    const lvl=state.prestige[p.id]; const item=document.createElement("div"); item.className="shop-item";
    let btn;
    if(lvl>=p.max) btn=`<button class="buy-btn maxed" disabled>MAX</button>`;
    else { const cost=presCost(p); btn=`<button class="buy-btn feather${state.feathers<cost?" ":""}" data-p="${p.id}" ${state.feathers<cost?"disabled":""}>Buy<small>🪶 ${cost}</small></button>`; }
    item.innerHTML=`<div class="shop-ico">${p.emoji}</div>
      <div class="shop-info"><h3>${p.name} <span class="lvl">${lvl>0?`Lv.${lvl}`:""}</span></h3><p>${p.desc}</p></div>${btn}`;
    list.appendChild(item);
  }
  list.querySelectorAll("[data-p]").forEach(b=>b.addEventListener("click",()=>buyPrestige(b.dataset.p)));
}
function buyPrestige(id){
  const p=PRESTIGE.find(x=>x.id===id); const lvl=state.prestige[id]; if(lvl>=p.max) return;
  const cost=presCost(p); if(state.feathers<cost) return;
  state.feathers-=cost; state.prestige[id]++; sfx("buy"); ticker(`${p.name} → Lv.${state.prestige[id]} 🪶`);
  if(id==="pStart") state.food=Math.min(state.food,capacity());
  buildPrestige(); refreshHUD(); save();
}
function doMigrate(){
  const gain=feathersOnMigrate(); if(gain<1) return;
  if(!confirm(`Migrate now for +${gain} 🪶?\nYou keep your collection, achievements and Feathers, but points, upgrades, foods and area reset.`)) return;
  state.feathers+=gain; state.migrations++;
  const keep={ discovered:state.discovered, seen:state.seen, speciesFed:state.speciesFed,
    happyVisits:state.happyVisits, sadVisits:state.sadVisits, achievements:state.achievements,
    feathers:state.feathers, migrations:state.migrations, prestige:state.prestige,
    flags:state.flags, clock:state.clock, dayCount:state.dayCount, lastDay:state.lastDay, streak:state.streak, muted:state.muted };
  state=Object.assign(defaultState(), keep);
  birds=[]; occupied.clear(); seeds=[]; floats=[]; hawk=null; frenzyUntil=0; recentHappy=[];
  spawnTimer=1.5; fillTimer=fillInterval();
  buildShop(); buildFoods(); buildAreas(); buildQuests(); buildPrestige(); refreshHUD(); closePanels();
  ticker(`🦅 You migrated! Earned ${gain} Feathers. A fresh season begins.`); sfx("discover"); save();
}

/* ---- toasts / ticker ---- */
function toast(sp,text){
  const wrap=$("toasts"); const el=document.createElement("div"); el.className="toast";
  const cv=document.createElement("canvas"); cv.width=44; cv.height=38; Sprites.drawPortrait(cv,sp,{});
  const txt=document.createElement("div"); txt.innerHTML=`${sp.name}<small>${text}</small>`;
  el.appendChild(cv); el.appendChild(txt); wrap.appendChild(el); setTimeout(()=>el.remove(),3900);
}
const IDLE_LINES=["A gentle breeze drifts through the yard…","Sunlight dapples the feeder.","Somewhere, a robin is singing.","The hedge rustles softly.","A perfect day for birdwatching."];
let tickerTimer=null;
function ticker(msg){ $("ticker").textContent=msg; clearTimeout(tickerTimer); tickerTimer=setTimeout(()=>{ $("ticker").textContent=IDLE_LINES[(Math.random()*IDLE_LINES.length)|0]; },4500); }
function showFrenzy(on){ frenzyShown=on; const el=$("frenzyBanner"); if(el) el.classList.toggle("hidden",!on); }

/* ============================================================
   AUDIO  (sfx + ambient soundscape)
   ============================================================ */
let actx=null; const ambient={ started:false, master:null, birdTimer:null };
function ensureAudio(){ try{ actx=actx||new (window.AudioContext||window.webkitAudioContext)(); if(actx.state==="suspended") actx.resume(); }catch(e){ actx=null; } return actx; }
function tone(freq,dur,type="sine",gain=0.05,delay=0){
  if(state.muted) return; const ctx=ensureAudio(); if(!ctx) return;
  try{ const o=ctx.createOscillator(),g=ctx.createGain(),t0=ctx.currentTime+delay;
    o.type=type; o.frequency.setValueAtTime(freq,t0);
    g.gain.setValueAtTime(0,t0); g.gain.linearRampToValueAtTime(gain,t0+0.01); g.gain.exponentialRampToValueAtTime(0.0001,t0+dur);
    o.connect(g).connect(ctx.destination); o.start(t0); o.stop(t0+dur+0.02);
  }catch(e){}
}
function sfx(kind){ if(state.muted) return;
  switch(kind){
    case "happy":    tone(880,0.12,"sine",0.05); tone(1320,0.12,"sine",0.04,0.08); break;
    case "discover": tone(660,0.12,"triangle",0.05); tone(990,0.14,"triangle",0.05,0.1); tone(1320,0.16,"sine",0.04,0.22); break;
    case "sad":      tone(300,0.18,"sine",0.05); tone(220,0.2,"sine",0.04,0.1); break;
    case "buy":      tone(520,0.07,"square",0.04); tone(780,0.09,"square",0.035,0.06); break;
    case "scatter":  tone(440,0.05,"triangle",0.03); break;
  }
}
function makeNoiseBuffer(ctx,secs){ const len=Math.floor(ctx.sampleRate*secs); const buf=ctx.createBuffer(1,len,ctx.sampleRate);
  const d=buf.getChannelData(0); let last=0; for(let i=0;i<len;i++){ const w=Math.random()*2-1; last=(last+0.02*w)/1.02; d[i]=last*3.2; } return buf; }
function startAmbient(){
  if(ambient.started) return; const ctx=ensureAudio(); if(!ctx) return; ambient.started=true;
  try{
    const master=ctx.createGain(); master.gain.value=0; master.connect(ctx.destination); ambient.master=master;
    const wind=ctx.createBufferSource(); wind.buffer=makeNoiseBuffer(ctx,3); wind.loop=true;
    const lp=ctx.createBiquadFilter(); lp.type="lowpass"; lp.frequency.value=480;
    const wg=ctx.createGain(); wg.gain.value=0.05; wind.connect(lp).connect(wg).connect(master); wind.start();
    const lfo=ctx.createOscillator(); lfo.frequency.value=0.08; const la=ctx.createGain(); la.gain.value=240; lfo.connect(la).connect(lp.frequency); lfo.start();
    const lfo2=ctx.createOscillator(); lfo2.frequency.value=0.05; const la2=ctx.createGain(); la2.gain.value=0.02; lfo2.connect(la2).connect(wg.gain); lfo2.start();
    master.gain.setTargetAtTime(state.muted?0:0.9, ctx.currentTime, 1.5); scheduleAmbientBird();
  }catch(e){ ambient.started=false; }
}
function setAmbientMuted(m){ if(ambient.master&&actx){ try{ ambient.master.gain.setTargetAtTime(m?0:0.9,actx.currentTime,0.4); }catch(e){} } }
function scheduleAmbientBird(){ clearTimeout(ambient.birdTimer); ambient.birdTimer=setTimeout(()=>{ if(!state.muted) playAmbientBird(); scheduleAmbientBird(); }, 2200+Math.random()*5200); }
function playAmbientBird(){
  const ctx=actx; if(!ctx||!ambient.master) return;
  try{ const dest=ctx.createGain(); dest.gain.value=1;
    if(ctx.createStereoPanner){ const pan=ctx.createStereoPanner(); pan.pan.value=(Math.random()*2-1)*0.7; dest.connect(pan).connect(ambient.master); } else dest.connect(ambient.master);
    const base=1300+Math.random()*1500, notes=2+((Math.random()*4)|0); let tt=ctx.currentTime;
    for(let i=0;i<notes;i++){ const o=ctx.createOscillator(),g=ctx.createGain(); o.type="sine"; const f=base*(0.82+Math.random()*0.5);
      o.frequency.setValueAtTime(f,tt); o.frequency.linearRampToValueAtTime(f*(1+(Math.random()*0.18-0.09)),tt+0.08);
      g.gain.setValueAtTime(0,tt); g.gain.linearRampToValueAtTime(0.05,tt+0.012); g.gain.exponentialRampToValueAtTime(0.0001,tt+0.12);
      o.connect(g).connect(dest); o.start(tt); o.stop(tt+0.14); tt+=0.06+Math.random()*0.07; }
  }catch(e){}
}

/* ============================================================
   INPUT / WIRING
   ============================================================ */
function scatter(){
  if(state.food>=capacity()){ ticker("The feeder is already full. 🌾"); return; }
  state.food=Math.min(capacity(),state.food+CONFIG.scatterAmount); spawnSeedToss(currentFeeder(),2);
  sfx("scatter"); flashStat("foodVal"); refreshHUD();
}
function canvasToInternal(e){
  const r=canvas.getBoundingClientRect(); const scale=Math.max(r.width/Sprites.L.W, r.height/Sprites.L.H);
  const offX=(r.width-Sprites.L.W*scale)/2, offY=(r.height-Sprites.L.H*scale)/2;
  return { x:(e.clientX-r.left-offX)/scale, y:(e.clientY-r.top-offY)/scale };
}
function onCanvasClick(e){
  const p=canvasToInternal(e);
  // hawk?
  if(hawk && Math.hypot(p.x-hawk.x,p.y-hawk.y)<22){ const fr=1; state.feathers+=fr; addFloat(hawk.x,hawk.y-14,"+1🪶","#e8c34a");
    ticker("🦅 You shooed the hawk away! +1🪶"); sfx("buy"); hawk=null; refreshHUD(); save(); return; }
  // golden bird?
  for(const b of birds){ if(b.golden && b.st!=="leaving" && Math.hypot(p.x-b.x,p.y-b.y)<16){ collectGolden(b); return; } }
  // feeder → scatter
  const f=Sprites.L.feeder;
  if(p.x>f.x-42 && p.x<f.x+42 && p.y>f.trayY-52 && p.y<Sprites.L.groundContact) scatter();
}
function openPanel(id){ closePanels(); $(id).classList.remove("hidden");
  if(id==="overlayGoals"){ buildQuests(); buildAchievements(); }
  if(id==="overlayMigrate") buildPrestige();
  if(id==="overlayAreas") buildAreas();
}
function closePanels(){ document.querySelectorAll(".overlay").forEach(o=>o.classList.add("hidden")); }

function onHidden(){
  save(); bgLast=Date.now(); bgGained=0; clearInterval(bgInterval);
  bgInterval=setInterval(()=>{ const now=Date.now(); bgGained+=accrue((now-bgLast)/1000); bgLast=now; save(); },15000);
}
function onVisible(){
  clearInterval(bgInterval); bgInterval=null;
  if(bgLast){ bgGained+=accrue((Date.now()-bgLast)/1000); bgLast=0; }
  if(actx&&actx.state==="suspended") actx.resume();
  if(bgGained>0){ refreshHUD(); ticker(`While away, your helpers earned ✨${Math.floor(bgGained)}. 🪶`); }
  bgGained=0; lastTs=0;
}

function wireUI(){
  $("scatterBtn").addEventListener("click",scatter);
  $("btnShop").addEventListener("click",()=>openPanel("overlayShop"));
  $("btnGoals").addEventListener("click",()=>openPanel("overlayGoals"));
  $("btnIndex").addEventListener("click",()=>openPanel("overlayIndex"));
  $("btnAreas").addEventListener("click",()=>openPanel("overlayAreas"));
  $("btnMigrate").addEventListener("click",()=>openPanel("overlayMigrate"));
  $("migrateBtn").addEventListener("click",doMigrate);
  canvas.addEventListener("click",onCanvasClick);
  document.querySelectorAll("[data-close]").forEach(b=>b.addEventListener("click",closePanels));
  $("cardClose").addEventListener("click",()=>$("cardModal").classList.add("hidden"));
  document.querySelectorAll(".overlay").forEach(o=>o.addEventListener("click",e=>{ if(e.target===o) o.classList.add("hidden"); }));
  $("muteBtn").addEventListener("click",()=>{ state.muted=!state.muted; $("muteBtn").textContent=state.muted?"🔇":"🔊"; if(state.muted) setAmbientMuted(true); else { startAmbient(); setAmbientMuted(false); } save(); });
  $("resetBtn").addEventListener("click",()=>{ if(confirm("Erase ALL progress (including Feathers & collection) and start completely over?")){ try{ localStorage.removeItem(SAVE_KEY); }catch(e){} state=defaultState(); birds=[]; occupied.clear(); floats=[]; seeds=[]; hawk=null; buildShop(); buildFoods(); buildIndex(); buildAreas(); buildQuests(); buildAchievements(); buildPrestige(); refreshHUD(); closePanels(); ticker("A brand new world. 🌱"); } });
  window.addEventListener("keydown",e=>{ if(e.code==="Space"){ e.preventDefault(); scatter(); } if(e.code==="Escape") closePanels(); });
  window.addEventListener("beforeunload",save);
  const startAudioOnce=()=>{ ensureAudio(); if(!state.muted) startAmbient(); window.removeEventListener("pointerdown",startAudioOnce); window.removeEventListener("keydown",startAudioOnce); };
  window.addEventListener("pointerdown",startAudioOnce); window.addEventListener("keydown",startAudioOnce);
  document.addEventListener("visibilitychange",()=> document.hidden?onHidden():onVisible());
}

/* ============================================================
   BOOT
   ============================================================ */
function init(){
  canvas=$("game"); ctx=canvas.getContext("2d"); ctx.imageSmoothingEnabled=false;
  load(); applyOffline(); checkDailyLogin();
  $("muteBtn").textContent=state.muted?"🔇":"🔊";
  buildShop(); buildFoods(); buildIndex(); buildAreas(); buildQuests(); buildAchievements(); buildPrestige(); wireUI();
  checkAchievements(); refreshHUD();
  let msg = pendingOffline ? `Welcome back! Your helpers earned ✨${pendingOffline.gained} over ~${pendingOffline.mins} min.`
                           : "Welcome! Scatter some seed and wait for your first visitor. 🐦";
  if(pendingDaily) msg = `Day ${pendingDaily.streak} streak! +${pendingDaily.feathers}🪶. Today's special guest: the ${pendingDaily.bird?pendingDaily.bird.name:"mystery bird"}.`;
  ticker(msg);
  state.food=Math.min(state.food,capacity()); fillTimer=fillInterval();
  requestAnimationFrame(loop);
}
if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",init); else init();

})();
