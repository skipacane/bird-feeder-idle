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
/* Auto-fed model: a helper always keeps the tray stocked (birds never starve).
   "Scatter" is an OPTIONAL active boost on a recharge — a reward, never a chore. */
const CONFIG = {
  baseSpawn: 4.2,
  scatterDur: 12,            // seconds a Scatter buff lasts (freshness)
  scatterCd: 20,            // seconds to recharge a Scatter
  scatterBonus: 4,           // ×5 points at full Scatter buff (1 + 4), before upgrades
  helperRate: 0.16,          // passive points/sec per helper × avg bird value × mult
  offlineBase: 0.55,         // fraction of passive income earned while away
  eatTime: 1.3, offlineCapHours: 4,
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

/* Upgrades are organised into biome TIERS — each biome unlocks a new, pricier and
   more powerful set, and several upgrades are gated behind a prerequisite (reach a
   biome, or level another upgrade). The whole game is an uphill climb. */
const TIER_AREA={ 1:"suburb", 2:"forest", 3:"wetland", 4:"mountain" };
const UPGRADES = [
  /* ---- Tier 1 · Suburban Backyard (the basics) ---- */
  { id:"attractor",    name:"Bird Bath",         emoji:"💧", tier:1, max:18, baseCost:35,   growth:1.5,  desc:"Birds notice your yard and visit more often." },
  { id:"helpers",      name:"Hire a Helper",     emoji:"🧑‍🌾", tier:1, max:20, baseCost:45, growth:1.6,  desc:"A caretaker draws a steady passive income — and keeps earning while you're away." },
  { id:"seedQuality",  name:"Premium Seed",      emoji:"🌻", tier:1, max:20, baseCost:55,   growth:1.55, desc:"+20% Bird Points from every happy visit." },
  { id:"scatterPower", name:"Generous Scatter",  emoji:"🌱", tier:1, max:10, baseCost:90,   growth:1.6,  desc:"Your Scatter buff gives even more points." },
  { id:"scatterCharge",name:"Quick Hands",       emoji:"🤲", tier:1, max:8,  baseCost:95,   growth:1.6,  desc:"Scatter recharges faster — boost more often." },
  { id:"perches",      name:"Extra Perch",       emoji:"🪺", tier:1, max:5,  baseCost:120,  growth:1.85, desc:"+1 bird can feed at the same time." },
  { id:"rarity",       name:"Berry Bushes",      emoji:"🫐", tier:1, max:10, baseCost:150,  growth:1.6,  desc:"Rarer, higher-value birds visit more often." },
  { id:"flowers",      name:"Pollinator Garden", emoji:"🌷", tier:1, max:8,  baseCost:190,  growth:1.6,  desc:"A blooming bed lures golden visitors far more often." },
  { id:"frenzy",       name:"Welcome Sign",      emoji:"🪧", tier:1, max:6,  baseCost:250,  growth:1.7,  desc:"Feeding frenzies start sooner and last longer." },
  { id:"antihawk",     name:"Owl Decoy",         emoji:"🦉", tier:1, max:5,  baseCost:330,  growth:1.75, desc:"A watchful decoy keeps raiding hawks away for longer." },
  /* ---- Tier 2 · Whispering Woodland ---- */
  { id:"fieldNotes",   name:"Field Notes",       emoji:"📓", tier:2, max:12, baseCost:900,  growth:1.5,  desc:"+0.5% Bird Points for every species you've discovered, per level.", req:{area:"forest"} },
  { id:"seasonedHands",name:"Seasoned Hands",    emoji:"🧤", tier:2, max:10, baseCost:1100, growth:1.5,  desc:"+25% to all helper passive income, per level.", req:{area:"forest", upgrade:{id:"helpers", lvl:5}} },
  { id:"bountiful",    name:"Bountiful Visits",  emoji:"✨", tier:2, max:15, baseCost:1400, growth:1.45, desc:"+2% chance per level that a visit is bountiful — worth ×4.", req:{area:"forest", upgrade:{id:"seedQuality", lvl:8}} },
  /* ---- Tier 3 · Reedy Wetland ---- */
  { id:"larder",       name:"Living Larder",     emoji:"🍯", tier:3, max:10, baseCost:13000, growth:1.55, desc:"+25% offline earnings per level — helpers tend the feeder better while you're away.", req:{area:"wetland"} },
  { id:"goldenTide",   name:"Golden Tides",      emoji:"🪙", tier:3, max:8,  baseCost:15000, growth:1.6,  desc:"Golden visitors arrive far more often and are worth +25% more, per level.", req:{area:"wetland", upgrade:{id:"flowers", lvl:5}} },
  { id:"renown",       name:"Sanctuary Renown",  emoji:"🏅", tier:3, max:10, baseCost:18000, growth:1.6,  desc:"+50% Bird Points per level — word of your sanctuary spreads.", req:{area:"wetland"} },
  /* ---- Tier 4 · Alpine Heights ---- */
  { id:"aviary",       name:"Grand Aviary",      emoji:"🏛️", tier:4, max:4, baseCost:75000,  growth:2.0,  desc:"+1 more bird can feed at once.", req:{area:"mountain", upgrade:{id:"perches", lvl:5}} },
  { id:"legendCall",   name:"Legend's Call",     emoji:"🎺", tier:4, max:5, baseCost:110000, growth:1.7,  desc:"Lured legendary birds answer far more readily.", req:{area:"mountain"} },
  { id:"alpineBounty", name:"Alpine Bounty",     emoji:"🏔️", tier:4, max:8, baseCost:130000, growth:1.7,  desc:"+100% Bird Points per level — the ultimate sanctuary.", req:{area:"mountain"} },
];

const FOODS = [
  { id:"seed",     name:"Seed",      emoji:"🌾", cost:0,    desc:"The all-rounder — most backyard birds love it." },
  { id:"safflower",name:"Safflower", emoji:"🌱", cost:600,  desc:"Bitter white seed squirrels dislike — but cardinals adore." },
  { id:"suet",     name:"Suet",      emoji:"🧈", cost:500,  desc:"Fatty cake woodpeckers & nuthatches adore." },
  { id:"nyjer",    name:"Nyjer",     emoji:"🌰", cost:1500, desc:"Tiny thistle seed — a magnet for finches." },
  { id:"peanut",   name:"Peanuts",   emoji:"🥜", cost:1800, desc:"Whole peanuts — an irresistible feast for jays." },
  { id:"mealworm", name:"Mealworms", emoji:"🐛", cost:3000, desc:"Live mealworms — wrens, kingfishers & herons can't resist." },
  { id:"fruit",    name:"Fruit",     emoji:"🍎", cost:4000, desc:"Berries & orange halves for thrushes, waxwings & grosbeaks." },
  { id:"nectar",   name:"Nectar",    emoji:"🍯", cost:9000, desc:"Sweet sugar-water for orioles & tanagers." },
];

/* one-time structures you build to lure specific rare/legendary birds. x,y place
   them on the lawn (3 reusable slots per biome); sprite = the drawDecor type. */
const STRUCTURES = [
  // Suburban Backyard
  { id:"platform",     name:"Platform Feeder", area:"suburb",  cost:400,   icon:"tray",   x:294, y:247, sprite:"platform",     blurb:"A low, open tray. Ground-loving cardinals feel safe here." },
  { id:"peanut_post",  name:"Peanut Post",     area:"suburb",  cost:700,   icon:"can",    x:400, y:207, sprite:"peanut_post",  blurb:"A spike of whole peanuts — jays can't resist a visit." },
  { id:"fruit_tree",   name:"Fruit Tree",      area:"suburb",  cost:1200,  icon:"fruit",  x:52,  y:181, sprite:"fruit_tree",   blurb:"A little orchard tree whose fruit tempts grosbeaks & thrushes." },
  // Whispering Woodland
  { id:"berry_thicket",name:"Berry Thicket",   area:"forest",  cost:3000,  icon:"fruit",  x:52,  y:181, sprite:"berry_thicket",blurb:"A tangle of dark berries — a magnet for Scarlet Tanagers." },
  { id:"suet_log",     name:"Suet Log",        area:"forest",  cost:3600,  icon:"suet",   x:400, y:207, sprite:"suet_log",     blurb:"A drilled log packed with suet for big woodpeckers." },
  { id:"oriole_feeder",name:"Oriole Feeder",   area:"forest",  cost:5500,  icon:"nectar", x:294, y:247, sprite:"oriole_feeder",blurb:"Orange halves & a nectar cup — pure temptation for orioles." },
  // Reedy Wetland
  { id:"fishing_perch",name:"Fishing Perch",   area:"wetland", cost:13000, icon:"perch",  x:400, y:207, sprite:"fishing_perch",blurb:"A bare branch over the water where a kingfisher can watch & dive." },
  { id:"reed_pool",    name:"Reed Pool",       area:"wetland", cost:20000, icon:"drop",   x:294, y:247, sprite:"reed_pool",    blurb:"A still pool fringed with cattails — a heron's hunting ground." },
  // Alpine Heights
  { id:"pine_bough",   name:"Pine Bough",      area:"mountain",cost:55000, icon:"leaf",   x:52,  y:181, sprite:"pine_bough",   blurb:"A laden conifer branch — Pine Grosbeaks drift in to feed." },
  { id:"cliff_patch",  name:"Cliff Seed Patch",area:"mountain",cost:65000, icon:"snow",   x:400, y:207, sprite:"cliff_patch",  blurb:"Seed scattered on a windswept ledge for rosy-finches." },
  { id:"eagle_eyrie",  name:"Eagle Eyrie",     area:"mountain",cost:95000, icon:"bird",   x:294, y:247, sprite:"eagle_eyrie",  blurb:"A towering crag with a stick nest — fit for an eagle." },
];
const FOOD_BY_ID = Object.fromEntries(FOODS.map(f=>[f.id,f]));
const SUBURB_FOODS = {
  american_robin:["seed","fruit"], american_goldfinch:["nyjer","seed"],
  house_finch:["seed","nyjer"], northern_cardinal:["seed","fruit"],
  rose_breasted_grosbeak:["seed","fruit"],
};
function foodsFor(b){ return b.foods || SUBURB_FOODS[b.id] || ["seed"]; }

/* sequential quest ladder — always something to chase */
const maxFed = s => { const v=Object.values(s.speciesFed); return v.length?Math.max(...v):0; };
const QUESTS = [
  /* ---- Suburban Backyard: a long, gentle on-ramp before the next area ---- */
  { name:"First Friends",    desc:"Make 3 birds happy.",                metric:s=>s.happyVisits,            target:3,    reward:{points:40} },
  { name:"Right on Cue",     desc:"Scatter fresh seed 3 times.",        metric:s=>s.scatters,               target:3,    reward:{points:70} },
  { name:"Hello, Neighbor",  desc:"Discover 5 species.",                metric:s=>discCount(),              target:5,    reward:{points:130} },
  { name:"Helping Hands",    desc:"Hire a second helper.",              metric:s=>s.upgrades.helpers,       target:2,    reward:{points:200} },
  { name:"A Place to Bathe", desc:"Install a Bird Bath.",               metric:s=>s.upgrades.attractor,     target:1,    reward:{points:250} },
  { name:"Worth the Wait",   desc:"Hold 300 Bird Points at once.",      metric:s=>s.points,                 target:300,  reward:{points:150} },
  { name:"The Regulars",     desc:"Make 50 birds happy.",               metric:s=>s.happyVisits,            target:50,   reward:{feathers:1} },
  { name:"Eight is Great",   desc:"Discover 8 species.",                metric:s=>discCount(),              target:8,    reward:{points:350} },
  { name:"Garden in Bloom",  desc:"Plant the Pollinator Garden.",       metric:s=>s.upgrades.flowers,       target:1,    reward:{points:600} },
  { name:"A Fine Spread",    desc:"Unlock a new kind of food.",         metric:s=>Object.keys(s.unlockedFoods).length, target:2, reward:{points:400} },
  { name:"Premium Service",  desc:"Reach Premium Seed Lv.3.",          metric:s=>s.upgrades.seedQuality,   target:3,    reward:{points:900} },
  { name:"Feeding Frenzy!",  desc:"Trigger a feeding frenzy.",          metric:s=>s.flags.frenzy?1:0,       target:1,    reward:{feathers:1} },
  { name:"Familiar Faces",   desc:"Feed one species 25 times.",         metric:maxFed,                      target:25,   reward:{feathers:2} },
  { name:"A Busy Café",      desc:"Make 200 birds happy.",              metric:s=>s.happyVisits,            target:200,  reward:{points:1400} },
  { name:"A Tidy Sum",       desc:"Hold 2,500 Bird Points at once.",    metric:s=>s.points,                 target:2500, reward:{feathers:1} },
  { name:"Local Celebrity",  desc:"Discover all 12 suburb species.",    metric:s=>discCountArea("suburb"),  target:12,   reward:{feathers:3} },
  /* ---- the wider world ---- */
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
  { id:"automation",name:"Automation",    desc:"Employ 5 helpers.",            check:()=>state.upgrades.helpers>=5, pointPct:0.05 },
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
  { id:"pStart",  name:"Plentiful Perches", emoji:"🏡", max:3,  baseCost:4, growth:1.9, desc:"+1 bird can always feed at once." },
  { id:"pFeather",name:"Living Legacy",     emoji:"🪶", max:10, baseCost:5, growth:1.9, desc:"+10% Feathers earned on migration." },
];

/* ---------------- state ---------------- */
function defaultState(){
  return {
    v:2,
    points:0, runPoints:0, freshness:0, foodType:"seed", scatters:0,
    upgrades:{ attractor:0, helpers:1, seedQuality:0, scatterPower:0, scatterCharge:0, perches:0, rarity:0, flowers:0, frenzy:0, antihawk:0,
               fieldNotes:0, seasonedHands:0, bountiful:0, larder:0, goldenTide:0, renown:0, aviary:0, legendCall:0, alpineBounty:0 },
    unlockedFoods:{ seed:true },
    discovered:{}, seen:{}, speciesFed:{}, happyVisits:0,
    area:"suburb", unlockedAreas:{ suburb:true }, structures:{},
    questIdx:0, achievements:{},
    feathers:0, migrations:0, prestige:{ pPoints:0, pSpawn:0, pOffline:0, pStart:0, pFeather:0 },
    clock:0.32, dayCount:0,
    lastDay:null, streak:0,
    flags:{ seasonsSeen:{}, fedRain:false, frenzy:false, golden:false, tappedFeeder:false },
    muted:false, lastSave:Date.now(),
  };
}
let state = defaultState();

/* ---------------- derived ---------------- */
const achPct = () => ACHIEVEMENTS.reduce((s,a)=> s + (state.achievements[a.id]? a.pointPct:0), 0);
const pointMult    = () => (1 + state.upgrades.seedQuality*0.2)
                          * (1 + discCount()*0.005*state.upgrades.fieldNotes)   // Field Notes (collection synergy)
                          * (1 + state.upgrades.renown*0.5)                      // Sanctuary Renown
                          * (1 + state.upgrades.alpineBounty)                    // Alpine Bounty (+100%/lvl)
                          * (1 + achPct())
                          * (1 + state.prestige.pPoints*0.08)
                          * (frenzyActive()?CONFIG.frenzyMult:1);
const critChance   = () => Math.min(0.6, state.upgrades.bountiful*0.02);         // Bountiful Visits
const scatterStrength = () => CONFIG.scatterBonus + state.upgrades.scatterPower*0.15;  // Generous Scatter
const freshMult    = () => 1 + scatterStrength()*state.freshness;   // active Scatter boost
const maxConcurrent= () => MAX_CONCURRENT + state.upgrades.perches + state.upgrades.aviary + state.prestige.pStart;  // Extra Perch / Grand Aviary / Plentiful Perches
const scatterCd    = () => Math.max(6, CONFIG.scatterCd * Math.pow(0.88, state.upgrades.scatterCharge));  // Quick Hands
const scatterReady = () => scatterCharge>=1;
const frenzyNeedNow= () => Math.max(3, CONFIG.frenzyNeed - state.upgrades.frenzy);     // Welcome Sign
const frenzyTimeNow= () => CONFIG.frenzyTime + state.upgrades.frenzy*4;                // Welcome Sign
const goldenRoll   = () => { const f=Math.pow(0.85, state.upgrades.flowers)*Math.pow(0.82, state.upgrades.goldenTide); return rnd(CONFIG.goldenEvery[0]*f, CONFIG.goldenEvery[1]*f); }; // Pollinator Garden / Golden Tides
const goldenValueMult = () => 1 + state.upgrades.goldenTide*0.25;             // Golden Tides
const hawkRoll     = () => { const f=1 + state.upgrades.antihawk*0.55; return rnd(CONFIG.hawkEvery[0]*f, CONFIG.hawkEvery[1]*f); };            // Owl Decoy
const spawnInterval= () => Math.max(1.1, CONFIG.baseSpawn
                          * Math.pow(0.9, state.upgrades.attractor)
                          * Math.pow(0.95, state.prestige.pSpawn)
                          * (1 - 0.18*state.freshness));            // fresh seed draws birds sooner
function avgBirdValue(){ const p=areaPool(); let tw=0,sum=0; for(const x of p){ tw+=x.weight; sum+=x.bird.points*x.weight; } return tw>0?sum/tw:1; }
const passivePerSec= () => state.upgrades.helpers>0 ? state.upgrades.helpers*CONFIG.helperRate*avgBirdValue()*pointMult()*(1+state.upgrades.seasonedHands*0.25) : 0;  // Hire a Helper / Seasoned Hands
const offlineRate  = () => CONFIG.offlineBase * (1 + state.prestige.pOffline*0.15) * (1 + state.upgrades.larder*0.25);  // Living Larder
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
let birds=[], floats=[], seeds=[], rain=[], arrivalFx=[];
let flashVignette=0;
let occupied=new Set();
let spawnTimer=2.0, scatterCharge=1, scatterBurstT=-10;
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
      const s=JSON.parse(raw), d=defaultState();
      state=Object.assign({}, d, s);   // merge into a NEW object so d's sub-objects stay pristine
      state.upgrades=Object.assign({}, d.upgrades, s.upgrades||{});   // fill in any newly-added keys
      state.prestige=Object.assign({}, d.prestige, s.prestige||{});
      state.flags=Object.assign({}, d.flags, s.flags||{});
      state.unlockedAreas=Object.assign({suburb:true}, s.unlockedAreas||{});
      state.unlockedFoods=Object.assign({seed:true}, s.unlockedFoods||{});
      state.structures=Object.assign({}, s.structures||{});
      state.discovered=s.discovered||{}; state.seen=s.seen||{}; state.speciesFed=s.speciesFed||{};
    }
  }catch(e){ state=defaultState(); }
}
function accrue(seconds){
  seconds=Math.min(seconds, CONFIG.offlineCapHours*3600);
  if(seconds<=0) return 0;
  // helpers keep tending the feeder while you're away (at reduced efficiency)
  const gained=Math.floor(passivePerSec()*offlineRate()*seconds);
  if(gained>0) addPoints(gained);
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
    .map(b=>({ bird:b, weight: weightFor(b) }))
    .filter(x=> x.weight>0);
}
/* a lure bird only appears once its recipe (food + structure + season) is met */
function lureSatisfied(b){
  const L=b.lure; if(!L) return true;
  if(L.structure && !state.structures[L.structure]) return false;
  if(L.food && state.foodType!==L.food) return false;
  if(L.season!=null && currentSeason()!==L.season) return false;
  if(L.weather && weather!==L.weather) return false;
  return true;
}
function lureHint(b){
  const L=b.lure; if(!L) return ""; const parts=[];
  if(L.food){ const f=FOOD_BY_ID[L.food]; parts.push(f?f.name:L.food); }
  if(L.structure){ const s=STRUCTURES.find(x=>x.id===L.structure); parts.push(s?s.name:L.structure); }
  if(L.season!=null) parts.push(SEASONS[L.season].name+" only");
  if(L.weather==="rain") parts.push("in the rain");
  return parts.join(" · ");
}
function weightFor(b){
  if(b.lure){                                   // lure birds bypass the random pool
    if(!lureSatisfied(b)) return 0;
    const found=!!state.discovered[b.id], leg=b.rarity==="legendary";
    // findable within a minute once the recipe is set, then genuinely rare afterwards
    let w = found ? (leg?0.7:1.5) : (leg?2.5:4);
    if(leg) w *= 1 + state.upgrades.legendCall*0.4;   // Legend's Call
    if(b.id===dailyVisitorId) w*=1.5;
    return w;
  }
  let w=RARITY[b.rarity].weight;
  const prefs=foodsFor(b);
  w *= prefs.includes(state.foodType) ? 3 : 0.35;
  if(weather==="rain" && b.rainLover) w*=2.6;
  if(b.id===dailyVisitorId) w*=6;
  if(b.rarity!=="common") w *= 1 + 0.18*state.upgrades.rarity;   // Berry Bushes favour rarer birds
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
function currentFeeder(){ return { x:Sprites.L.feeder.x, trayY:Sprites.L.feeder.trayY, food:1, cap:1 }; }
function freeSlotIndex(feeder){
  const slots=Sprites.perchSlots(feeder, maxConcurrent()), idx=[];
  for(let i=0;i<slots.length;i++) if(!occupied.has(i)) idx.push(i);
  return idx.length? idx[(Math.random()*idx.length)|0] : -1;
}
function spawnBird(feeder, opts={}){
  if(birds.length>=maxConcurrent()) return false;
  const idx=freeSlotIndex(feeder); if(idx<0) return false;
  const slot=Sprites.perchSlots(feeder, maxConcurrent())[idx];
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
  if(!b.golden && (b.sp.rarity==="rare"||b.sp.rarity==="legendary")) announceArrival(b);
  b.mode="perch"; b.facing=b.slot.facing;
  if(b.golden){ b.st="eating"; b.timer=2.5; b.emote="happy"; return; }   // golden: click to collect
  // a helper keeps the tray stocked — every guest gets fed
  b.st="eating"; b.timer=CONFIG.eatTime; b.emote="note"; b.emoteFade=1;
  if(weather==="rain" && !state.flags.fedRain){ state.flags.fedRain=true; checkAchievements(); }
}
function finishEating(b){
  if(b.golden) return;   // golden handled by click only
  let gain=Math.max(1, Math.round(b.sp.points * pointMult() * freshMult() * speciesMastery(b.sp.id)));
  const crit = critChance()>0 && Math.random()<critChance();   // Bountiful Visits
  if(crit) gain*=4;
  addPoints(gain); state.happyVisits++;
  state.speciesFed[b.sp.id]=(state.speciesFed[b.sp.id]||0)+1;
  registerHappy();
  const boosted=state.freshness>0.05;   // fed during an active Scatter buff
  addFloat(b.x,b.ty-12,(crit?"+"+gain+"!":"+"+gain), crit?"#ff8a3a":(boosted?"#ffd54a":"#caa12a"), (crit||boosted)?2:1);
  if(crit) for(let i=0;i<6;i++) sparkle(b.x+(Math.random()-0.5)*20, b.ty-8+(Math.random()-0.5)*14);
  b.emote="happy"; b.emoteFade=1;
  flashStat("pointsVal"); flashStat("happyVal"); sfx("happy");
  notifyProgress();
  startLeaving(b);
}
function collectGolden(b){
  const gain=Math.round((Math.max(60, Math.round(state.points*0.06)) + Math.round(b.sp.points*CONFIG.goldenMult)) * goldenValueMult());
  addPoints(gain); state.happyVisits++;
  if(!state.flags.golden){ state.flags.golden=true; checkAchievements(); }
  if(Math.random()<0.5){ state.feathers+=1; addFloat(b.x,b.ty-22,"+1","#e8c34a"); }
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
  if(recentHappy.length>=frenzyNeedNow() && !frenzyActive()){
    frenzyUntil=t+frenzyTimeNow(); recentHappy=[];
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
  if(goldenTimer<=0){ goldenTimer=goldenRoll();
    spawnBird(currentFeeder(), { golden:true }); }

  // hawk
  hawkTimer-=dt;
  if(hawkTimer<=0){ hawkTimer=hawkRoll(); spawnHawk(); }
}
function areaName(){ return (AREAS.find(a=>a.id===state.area)||{}).name||"yard"; }

/* daily visitor + login streak (real calendar day) */
function checkDailyLogin(){
  const today=new Date().toDateString();
  // pick a featured visitor for the day from unlocked areas (favor rarer birds)
  const eligible=BIRDS.filter(b=>state.unlockedAreas[b.area] && !b.lure);
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
  state.freshness=Math.max(0, state.freshness - dt/CONFIG.scatterDur);   // Scatter buff fades
  if(scatterCharge<1) scatterCharge=Math.min(1, scatterCharge + dt/scatterCd());  // Scatter recharges
  if(state.upgrades.helpers>0) addPoints(passivePerSec()*dt);            // helpers' passive trickle
  if(!hawk){   // birds don't arrive while a hawk patrols
    spawnTimer-=dt;
    if(spawnTimer<=0){ if(spawnBird(feeder)) spawnTimer=spawnInterval()*(0.7+Math.random()*0.6); else spawnTimer=0.6; }
  }
  for(const b of birds) updateBird(b,dt);
  birds=birds.filter(b=>!b._dead);
  for(const e of arrivalFx) e.p += dt/(e.leg?1.2:0.8);
  arrivalFx=arrivalFx.filter(e=>e.p<1);
  if(flashVignette>0) flashVignette=Math.max(0, flashVignette - dt*1.5);
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
  // a deliberately laid-out backyard: corner trees/posts frame the yard, a flower &
  // berry garden sits on the left, the bird-feeding amenities cluster on the right,
  // and the feeder is the centerpiece. y also drives a perspective scale (back=smaller),
  // and everything is drawn back-to-front for correct overlap.
  const decor=[];
  // upgrade props (your sanctuary, present in every biome)
  if(state.upgrades.antihawk>0)   decor.push(["owldecoy",   430,184,1]);
  if(state.upgrades.rarity>0)     decor.push(["berrybush",   96,207,state.upgrades.rarity]);
  if(state.upgrades.flowers>0)    decor.push(["flowers",    144,231,state.upgrades.flowers]);
  if(state.upgrades.helpers>0)    decor.push(["gnome",       86,244,1]);
  if(state.upgrades.frenzy>0)     decor.push(["sign",       180,245,1]);
  if(state.upgrades.attractor>0)  decor.push(["birdbath",   332,210,1]);
  if(state.upgrades.perches>0)    decor.push(["perchpole",  362,233,1]);
  // the current biome's built lure structures (placed via their x,y in the data)
  for(const s of STRUCTURES) if(s.area===state.area && state.structures[s.id] && s.sprite)
    decor.push([s.sprite, s.x, s.y, 1]);
  decor.sort((a,b)=>a[2]-b[2]);
  for(const d of decor){ const f=Math.max(0,Math.min(1,(d[2]-172)/78)), s=1.06+f*0.46;
    Sprites.drawDecorScaled(ctx, d[0], d[1], d[2], d[3], t, s); }
  Sprites.drawFeeder(ctx, currentFeeder(), t);
  // active Scatter buff: glowing aura around the feeder (scales with freshness)
  Sprites.drawScatterAura(ctx, Sprites.L.feeder.x, Sprites.L.feeder.trayY, t, state.freshness);
  // one-shot burst the moment you Scatter
  if(t-scatterBurstT < 0.7) Sprites.drawScatterBurst(ctx, Sprites.L.feeder.x, Sprites.L.feeder.trayY, (t-scatterBurstT)/0.7);
  // "click the feeder" cue — bold until first tap, then only when it needs refilling
  if($("overlayFeeder").classList.contains("hidden")){
    const f=Sprites.L.feeder;
    if(!state.flags.tappedFeeder) Sprites.drawTapHint(ctx, f.x, f.trayY, t, true);
    else if(scatterReady()) Sprites.drawTapHint(ctx, f.x, f.trayY, t, false);
  }

  for(const s of seeds){ ctx.fillStyle="#caa15c"; ctx.fillRect(s.x|0,s.y|0,1,1); }

  for(const b of birds.slice().sort((a,b)=>a.y-b.y)){
    const sp = b.golden ? goldVersion(b.sp) : b.sp;
    Sprites.drawBird(ctx, sp, { x:b.x,y:b.y,facing:b.facing,mode:b.mode,flapPhase:b.flapPhase,bob:b.bob,peck:b.peck,emote:b.emote,emoteFade:b.emoteFade });
    if(b.golden) goldSparkle(b);
  }
  if(hawk) Sprites.drawHawk(ctx, hawk.x, hawk.y, hawk.facing, hawk.flap);

  // rare/legendary arrival bursts
  for(const e of arrivalFx) Sprites.drawArrivalBurst(ctx, e.x, e.y, Math.min(1,e.p), e.color, e.leg);

  // floating point text
  for(const f of floats){
    const sc=f.scale||1, a=Math.max(0,Math.min(1,f.life/0.9)), w=Sprites.pixelTextWidth(f.text,sc), x=Math.round(f.x-w/2), y=Math.round(f.y);
    ctx.globalAlpha=a*0.6; Sprites.pixelText(ctx,x+sc,y+sc,f.text,"#3a2a1a",sc);
    ctx.globalAlpha=a;     Sprites.pixelText(ctx,x,y,f.text,f.color,sc);
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
  // legendary arrival flash
  if(flashVignette>0){ ctx.fillStyle=`rgba(240,210,110,${flashVignette*0.16})`; ctx.fillRect(0,0,Sprites.L.W,Sprites.L.H); }
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
function sparkle(x,y){ floats.push({x,y,text:Math.random()<0.4?"*":".",color:Math.random()<0.5?"#ffe06a":"#bfeaf2",vy:-20,life:0.6}); }
/* dramatic fanfare when a rare/legendary visitor lands */
function announceArrival(b){
  const leg=b.sp.rarity==="legendary", col=RARITY[b.sp.rarity].color;
  arrivalFx.push({ x:b.x, y:b.ty-6, p:0, color:col, leg });
  const n=leg?32:16;
  for(let i=0;i<n;i++) floats.push({ x:b.x+(Math.random()-0.5)*(leg?50:30), y:b.ty-8+(Math.random()-0.5)*(leg?36:22),
    text:Math.random()<0.4?"*":".", color:Math.random()<0.5?col:"#fff6c0", vy:-12-Math.random()*24, life:0.7+Math.random()*0.5, scale:(leg&&Math.random()<0.3)?2:1 });
  if(leg){ flashVignette=0.7; showArrivalBanner(b.sp); ticker(`A LEGENDARY visitor: the ${b.sp.name}!`); }
  else ticker(`A rare ${b.sp.name} has arrived!`);
  sfx(leg?"legendary":"rare");
}
function showArrivalBanner(sp){
  const el=$("arrivalBanner"); if(!el) return;
  el.textContent=`★  Legendary — ${sp.name}  ★`; el.style.color=RARITY[sp.rarity].color;
  el.classList.remove("hidden"); clearTimeout(showArrivalBanner._t);
  showArrivalBanner._t=setTimeout(()=>el.classList.add("hidden"), 4200);
}

function loop(ts){
  if(!lastTs) lastTs=ts;
  let dt=(ts-lastTs)/1000; lastTs=ts; if(dt>0.1) dt=0.1;
  t+=dt; update(dt); render();
  hudTick+=dt; if(hudTick>0.12){ refreshHUD(); hudTick=0; }
  saveTick+=dt; if(saveTick>5){ save(); saveTick=0; }
  requestAnimationFrame(loop);
}

/* ---- particles ---- */
function addFloat(x,y,text,color,scale){ floats.push({x,y,text,color,scale:scale||1,vy:-16,life:1.0}); }
function spawnSeedToss(f,n){ for(let i=0;i<n*3;i++) seeds.push({ x:f.x+(Math.random()-0.5)*16,y:f.trayY-30,vx:(Math.random()-0.5)*34,vy:-10-Math.random()*22,gy:f.trayY-1,life:0.9+Math.random()*0.4 }); }
function seedRain(){ rain=[]; for(let i=0;i<70;i++) rain.push({ x:Math.random()*Sprites.L.W, y:Math.random()*Sprites.L.H, v:230+Math.random()*120, len:4+Math.random()*4 }); }

/* ============================================================
   PROGRESS: quests + achievements
   ============================================================ */
function notifyProgress(){ checkQuests(); checkAchievements(); }
let questNotified=-1;
function questClaimable(){ const q=QUESTS[state.questIdx]; return !!q && q.metric(state)>=q.target; }
function checkQuests(){   // rewards are CLAIMED manually now — just flag readiness
  const q=QUESTS[state.questIdx];
  if(q && q.metric(state)>=q.target && questNotified!==state.questIdx){
    questNotified=state.questIdx; ticker(`✅ Quest ready to claim: ${q.name}!`); sfx("buy");
  }
  buildQuests();
}
function claimQuest(){
  const q=QUESTS[state.questIdx]; if(!q || q.metric(state)<q.target) return;
  if(q.reward.points) addPoints(q.reward.points);
  if(q.reward.feathers) state.feathers+=q.reward.feathers;
  const rw=q.reward.feathers?`+${q.reward.feathers}🪶`:`+${q.reward.points}✨`;
  ticker(`Reward claimed: ${q.name} ${rw}`); sfx("discover");
  state.questIdx++; save();
  buildQuests(); buildBiomeCard(); refreshHUD();
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
const _iconState={};
function setIcon(id,name,size){ if(_iconState[id]===name) return; _iconState[id]=name; const el=$(id); if(!el)return; el.innerHTML=""; const c=Sprites.iconCanvas(name,size||16); if(c) el.appendChild(c); }
function fillCosts(root){ (root||document).querySelectorAll("[data-cost]").forEach(el=>{ const [ic,n]=el.dataset.cost.split(":"); el.innerHTML=""; const c=Sprites.iconCanvas(ic,10); if(c) el.appendChild(c); el.append(" "+Number(n).toLocaleString()); el.removeAttribute("data-cost"); }); }
function fillIcons(root){ (root||document).querySelectorAll("[data-ic]").forEach(el=>{ const c=Sprites.iconCanvas(el.dataset.ic, +el.dataset.icsize||18); if(c){ el.innerHTML=""; el.appendChild(c); } el.removeAttribute("data-ic"); }); }
const SHOP_ICONS={ attractor:"drop", helpers:"can", seedQuality:"star", scatterPower:"seed", scatterCharge:"scoop",
                   perches:"perch", rarity:"fruit", flowers:"flower", frenzy:"flame", antihawk:"owl",
                   fieldNotes:"book", seasonedHands:"scoop", bountiful:"nectar", larder:"suet", goldenTide:"star",
                   renown:"feather", aviary:"bird", legendCall:"flame", alpineBounty:"snow" };
const PRES_ICONS={ pPoints:"star", pSpawn:"bird", pOffline:"drop", pStart:"perch", pFeather:"feather" };
function refreshHUD(){
  $("pointsVal").textContent=Math.floor(state.points).toLocaleString();
  $("featherVal").textContent=state.feathers.toLocaleString();
  $("discVal").textContent=discCount(); $("totalVal").textContent=BIRDS.length;
  $("areaName").textContent=areaName();
  setIcon("seasonIco",["flower","sun","leaf","snow"][currentSeason()],20);
  const c=state.clock; setIcon("timeIco", (c<0.24||c>0.8)?"moon":"sun",20);
  setIcon("weatherIco", weather==="rain"?"rain":weather==="cloudy"?"cloud":"sun",20);
  $("streakVal").textContent=state.streak;
  // live points-multiplier badge (temporary boosts: fresh seed × frenzy)
  const tempMult=freshMult()*(frenzyActive()?CONFIG.frenzyMult:1), mb=$("pointsMult");
  if(tempMult>=1.1){ mb.classList.remove("hidden"); mb.classList.toggle("frenzy",frenzyActive());
    mb.textContent="×"+(Math.round(tempMult*10)/10); }
  else mb.classList.add("hidden");
  // live Scatter buff chip
  const sb=$("scatterBuff");
  if(state.freshness>0.02){ sb.classList.remove("hidden");
    $("sbFill").style.width=Math.round(state.freshness*100)+"%";
    $("sbPct").textContent="+"+Math.round(scatterStrength()*state.freshness*100)+"%"; }
  else sb.classList.add("hidden");
  if(!$("overlayFeeder").classList.contains("hidden")) updateFeederLive();
  refreshShop(); refreshStructures();
  updateEngagement(); refreshJournal();
}
function flashStat(valId){ const el=$(valId); if(!el)return; const s=el.closest(".stat"); if(!s)return; s.classList.remove("flash"); void s.offsetWidth; s.classList.add("flash"); }

/* ---- engagement: quest tracker + menu badges ---- */
function setBadge(id,n){ const el=$(id); if(!el) return; if(n>0){ el.textContent=n>9?"9+":String(n); el.classList.remove("hidden"); } else el.classList.add("hidden"); }
function setBadgeText(id,show,text){ const el=$(id); if(!el) return; if(show){ el.textContent=text; el.classList.remove("hidden"); } else el.classList.add("hidden"); }
function affordableUpgrades(){ let n=0; for(const u of UPGRADES){ if(upgradeUnlocked(u) && state.upgrades[u.id]<u.max && state.points>=upgCost(u)) n++; } return n; }
function updateEngagement(){
  setBadge("shopBadge", affordableUpgrades()+affordableStructures());
  setBadgeText("questsBadge", questClaimable(), "!");
}

/* ---- left journal: toggle, tabs, live refresh ---- */
let journalTab="quests";
function toggleJournal(){ const j=$("journal"); if(!j) return; j.classList.toggle("collapsed"); if(!j.classList.contains("collapsed")) refreshJournal(); }
function showJournalTab(name){
  journalTab=name;
  document.querySelectorAll("#journal .jtab").forEach(b=>b.classList.toggle("active", b.dataset.tab===name));
  document.querySelectorAll("#journal .jpanel").forEach(p=>p.classList.toggle("hidden", p.dataset.panel!==name));
  if(name==="quests"){ buildQuests(); buildLureGuide(); buildBiomeCard(); }
  else if(name==="ach") buildAchievements();
  else if(name==="shop"){ refreshShop(); refreshStructures(); }
}
function journalOpen(){ const j=$("journal"); return j && !j.classList.contains("collapsed"); }
function refreshJournal(){
  if(!journalOpen() || journalTab!=="quests") return;
  if(questClaimable()!==claimableShown) buildQuests();   // a quest just became (un)claimable
  else refreshQuestsLive();
}
function refreshQuestsLive(){
  document.querySelectorAll('#questList .quest[data-qi]').forEach(el=>{
    const q=QUESTS[+el.dataset.qi]; if(!q) return;
    const cur=q.metric(state), pct=Math.min(100,Math.round(cur/q.target*100));
    const f=el.querySelector('.q-fill'); if(f) f.style.width=pct+'%';
    const n=el.querySelector('.q-num'); if(n) n.textContent=`${Math.min(cur,q.target).toLocaleString()} / ${q.target.toLocaleString()}`;
  });
}

/* ---- shop (tiered by biome, with prerequisite gating) ---- */
const TIER_NAME={ 1:"Suburban Backyard", 2:"Whispering Woodland", 3:"Reedy Wetland", 4:"Alpine Heights" };
const tierUnlocked = tier => tier===1 || !!state.unlockedAreas[TIER_AREA[tier]];
function maxUnlockedTier(){ let m=1; for(let tr=2;tr<=4;tr++) if(tierUnlocked(tr)) m=tr; return m; }
function upgradeUnlocked(u){
  const r=u.req; if(!r) return true;
  if(r.area && !state.unlockedAreas[r.area]) return false;
  if(r.upgrade && (state.upgrades[r.upgrade.id]||0) < r.upgrade.lvl) return false;
  return true;
}
function upgradeReqText(u){
  const r=u.req; if(!r) return "";
  if(r.area && !state.unlockedAreas[r.area]) return "🔒 Reach the "+((AREAS.find(a=>a.id===r.area)||{}).name||r.area);
  if(r.upgrade && (state.upgrades[r.upgrade.id]||0)<r.upgrade.lvl){ const pu=UPGRADES.find(x=>x.id===r.upgrade.id); return "🔒 Needs "+((pu&&pu.name)||r.upgrade.id)+" Lv."+r.upgrade.lvl; }
  return "";
}
function buildShop(){
  const list=$("shopList"); list.innerHTML="";
  const reveal=Math.min(4, maxUnlockedTier()+1);   // show unlocked tiers + the next as a teaser
  for(let tr=1; tr<=reveal; tr++){
    const ups=UPGRADES.filter(u=>u.tier===tr); if(!ups.length) continue;
    const hdr=document.createElement("h4"); hdr.className="shop-tier"+(tierUnlocked(tr)?"":" soon");
    hdr.textContent=TIER_NAME[tr]+(tierUnlocked(tr)?"":" — locked"); list.appendChild(hdr);
    for(const u of ups){
      const item=document.createElement("div"); item.className="shop-item"; item.dataset.id=u.id;
      item.innerHTML=`<div class="shop-ico" data-ic="${SHOP_ICONS[u.id]||'star'}" data-icsize="20"></div>
        <div class="shop-info"><h3>${u.name} <span class="lvl" data-lvl></span></h3><p>${u.desc}</p><p class="req-line" data-req></p></div>
        <button class="buy-btn" data-buy><span class="blabel">Buy</span><small class="bcost"><span data-ic="star" data-icsize="10"></span> <span class="cnum"></span></small></button>`;
      item.querySelector("[data-buy]").addEventListener("click",()=>buyUpgrade(u));
      list.appendChild(item);
    }
  }
  fillIcons(list); refreshShop();
}
function refreshShop(){
  for(const u of UPGRADES){
    const item=document.querySelector(`.shop-item[data-id="${u.id}"]`); if(!item) continue;
    const lvl=state.upgrades[u.id]||0, unlocked=upgradeUnlocked(u), max=lvl>=u.max;
    item.querySelector("[data-lvl]").textContent=lvl>0?`Lv.${lvl}`:"";
    const reqEl=item.querySelector("[data-req]"), reqTxt=unlocked?"":upgradeReqText(u);
    reqEl.textContent=reqTxt; reqEl.style.display=reqTxt?"":"none";
    item.classList.toggle("locked", !unlocked);
    const btn=item.querySelector("[data-buy]"); btn.classList.toggle("maxed",max&&unlocked);
    if(!unlocked){ btn.disabled=true; btn.querySelector(".blabel").textContent="Locked"; btn.querySelector(".bcost").style.display="none"; item.classList.remove("afford"); }
    else if(max){ btn.disabled=true; btn.querySelector(".blabel").textContent="MAX"; btn.querySelector(".bcost").style.display="none"; item.classList.remove("afford"); }
    else{ const cost=upgCost(u); btn.disabled=state.points<cost;
      btn.querySelector(".blabel").textContent=lvl>0?"Upgrade":"Buy";
      btn.querySelector(".bcost").style.display=""; btn.querySelector(".cnum").textContent=cost.toLocaleString();
      item.classList.toggle("afford", state.points>=cost); }
  }
}
function buyUpgrade(u){
  if(!upgradeUnlocked(u)) return;
  const lvl=state.upgrades[u.id]; if(lvl>=u.max) return; const cost=upgCost(u); if(state.points<cost) return;
  state.points-=cost; state.upgrades[u.id]++;
  sfx("buy"); ticker(`${u.name} ${state.upgrades[u.id]>1?"upgraded":"unlocked"}! 🐣`);
  notifyProgress(); refreshHUD(); save();
}

/* ---- structures (one-time builds that lure rare visitors) ---- */
const areaStructures = () => STRUCTURES.filter(s=>s.area===state.area);
function affordableStructures(){ let n=0; for(const s of areaStructures()) if(!state.structures[s.id] && state.points>=s.cost) n++; return n; }
function buildStructures(){
  const list=$("structureList"); if(!list) return; list.innerHTML="";
  const here=areaStructures();
  if(!here.length){ list.innerHTML=`<p class="shop-empty">No structures to raise in this biome.</p>`; return; }
  for(const s of here){
    const item=document.createElement("div"); item.className="shop-item"; item.dataset.sid=s.id;
    item.innerHTML=`<div class="shop-ico" data-ic="${s.icon}" data-icsize="20"></div>
      <div class="shop-info"><h3>${s.name}</h3><p>${s.blurb}</p></div>
      <button class="buy-btn" data-build><span class="blabel">Build</span><small class="bcost"><span data-ic="star" data-icsize="10"></span> <span class="cnum"></span></small></button>`;
    item.querySelector("[data-build]").addEventListener("click",()=>buildStructure(s));
    list.appendChild(item);
  }
  fillIcons(list); refreshStructures();
}
function refreshStructures(){
  for(const s of areaStructures()){
    const item=document.querySelector(`.shop-item[data-sid="${s.id}"]`); if(!item) continue;
    const btn=item.querySelector("[data-build]"), built=!!state.structures[s.id];
    btn.classList.toggle("maxed",built);
    if(built){ btn.disabled=true; btn.querySelector(".blabel").textContent="Built"; btn.querySelector(".bcost").style.display="none"; item.classList.remove("afford"); }
    else{ btn.disabled=state.points<s.cost; btn.querySelector(".blabel").textContent="Build";
      btn.querySelector(".bcost").style.display=""; btn.querySelector(".cnum").textContent=s.cost.toLocaleString();
      item.classList.toggle("afford", state.points>=s.cost); }
  }
}
function buildStructure(s){
  if(state.structures[s.id] || state.points<s.cost) return;
  state.points-=s.cost; state.structures[s.id]=true;
  sfx("buy"); ticker(`Built the ${s.name}! Watch who it brings… 🪵`);
  notifyProgress(); refreshHUD(); refreshStructures(); buildLureGuide(); save();
}

/* ---- food selector (lives inside the feeder window) ---- */
function buildFoods(){
  const bar=$("fwFoods"); if(!bar) return; bar.innerHTML="";
  for(const f of FOODS){
    const chip=document.createElement("button"); chip.className="food-chip"; chip.dataset.id=f.id;
    const ic=Sprites.iconCanvas(f.id,18); if(ic) chip.appendChild(ic);
    const nm=document.createElement("span"); nm.className="fc-name"; nm.textContent=f.name; chip.appendChild(nm);
    const sub=document.createElement("span"); sub.className="fc-sub"; sub.dataset.sub="1"; chip.appendChild(sub);
    chip.title=f.desc;
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
    const sub=chip.querySelector("[data-sub]");
    if(unlocked){ sub.textContent=active?"active":""; }
    else { sub.dataset.cost="star:"+f.cost; fillCosts(chip); }
  }
}
function onFood(f){
  if(state.unlockedFoods[f.id]){ state.foodType=f.id; sfx("scatter"); ticker(`Now serving ${f.name}.`); }
  else if(state.points>=f.cost){ state.points-=f.cost; state.unlockedFoods[f.id]=true; state.foodType=f.id;
    sfx("buy"); ticker(`Unlocked ${f.name}!`); notifyProgress(); }
  else { ticker(`Need ${f.cost.toLocaleString()} points to stock ${f.name}.`); return; }
  refreshFoods(); buildLureGuide(); refreshHUD(); save();
}

/* ---- feeder details window ---- */
let fwRefs=null;
function openFeeder(){ closePanels(); state.flags.tappedFeeder=true; $("overlayFeeder").classList.remove("hidden"); buildFeederWindow(); }
function feederSeenList(){
  return BIRDS.filter(b=>b.area===state.area && state.seen[b.id])
              .sort((a,b)=>(state.seen[b.id]||0)-(state.seen[a.id]||0));
}
function buildFeederWindow(){
  const body=$("feederBody"); if(!body) return;
  const area=AREAS.find(a=>a.id===state.area)||{name:""};
  body.innerHTML=`
    <div class="fw-head"><h2>Hopper Feeder</h2><span class="fw-where">${area.name}</span></div>
    <div class="fw-meters">
      <div class="meter"><label>Scatter buff</label><div class="bar fresh"><div class="fill" id="fwFreshFill"></div></div><span id="fwFreshNum"></span></div>
      <div class="meter"><label>Recharge</label><div class="bar"><div class="fill" id="fwChargeFill"></div></div><span id="fwChargeNum"></span></div>
    </div>
    <button id="fwFill" class="fill-btn"></button>
    <p class="fw-hint">Your helper keeps the tray stocked, so birds always eat. <b>Scatter fresh seed</b> for a burst of bonus points &amp; faster visits whenever it's recharged — it's pure upside, never a chore.</p>
    <h3 class="fw-sub">Serving</h3>
    <div class="fw-foods" id="fwFoods"></div>
    <div class="fw-stats">
      <div class="fw-stat"><b id="fwVisits">0</b><span>visits</span></div>
      <div class="fw-stat"><b id="fwHappy">0</b><span>fed happily</span></div>
      <div class="fw-stat"><b id="fwScatters">0</b><span>scatters</span></div>
      <div class="fw-stat"><b id="fwSpecies">0</b><span>species here</span></div>
    </div>
    <h3 class="fw-sub" id="fwLogHdr">Visitor Logbook</h3>
    <div class="fw-log" id="fwLog"></div>`;
  const fb=$("fwFill"); fb.addEventListener("click",scatter);
  buildFoods();
  fwRefs={ freshFill:$("fwFreshFill"), freshNum:$("fwFreshNum"), chargeFill:$("fwChargeFill"), chargeNum:$("fwChargeNum"),
           fill:fb, vVisits:$("fwVisits"), vHappy:$("fwHappy"), vScatters:$("fwScatters"), vSpecies:$("fwSpecies"),
           logHdr:$("fwLogHdr"), log:$("fwLog"), rows:{}, logKey:"" };
  rebuildFeederLog();
  updateFeederLive();
}
function setScatterBtn(){
  const fb=fwRefs&&fwRefs.fill; if(!fb) return;
  const ready=scatterReady(); fb.disabled=!ready; fb.classList.toggle("charging",!ready);
  fb.innerHTML=""; const ic=Sprites.iconCanvas(ready?"seed":"scoop",16); if(ic) fb.appendChild(ic);
  fb.appendChild(document.createTextNode(ready?" Scatter Fresh Seed":" Recharging…"));
}
function rebuildFeederLog(){
  const log=fwRefs.log; log.innerHTML=""; fwRefs.rows={};
  const seenList=feederSeenList(), fav=seenList[0];
  fwRefs.logHdr.textContent = "Visitor Logbook"+(fav&&state.discovered[fav.id]?` · favourite: ${fav.name}`:"");
  if(!seenList.length){ log.innerHTML=`<p class="fw-empty">No visitors logged yet — sit tight, your first guest is on the way!</p>`; }
  else for(const sp of seenList){
    const row=document.createElement("div"); row.className="fw-row";
    const cv=document.createElement("canvas"); cv.width=44; cv.height=34; cv.className="fw-thumb";
    Sprites.drawPortrait(cv, sp, state.discovered[sp.id]?{}:{silhouette:"#b9ab8f"});
    const nm=document.createElement("div"); nm.className="fw-rname"; nm.textContent=state.discovered[sp.id]?sp.name:"? ? ?";
    const ct=document.createElement("div"); ct.className="fw-rcount"; ct.innerHTML=`${state.seen[sp.id]}<small> visits</small>`;
    row.appendChild(cv); row.appendChild(nm); row.appendChild(ct);
    if(state.discovered[sp.id]) row.addEventListener("click",()=>openCard(sp));
    log.appendChild(row); fwRefs.rows[sp.id]=ct;
  }
  fwRefs.logKey = seenList.map(sp=>sp.id+(state.discovered[sp.id]?"!":"")).join(",");
}
function updateFeederLive(){
  if(!fwRefs||!fwRefs.freshFill) return;
  const frp=Math.round(state.freshness*100), crp=Math.round(Math.min(1,scatterCharge)*100);
  fwRefs.freshFill.style.width=frp+"%"; fwRefs.freshNum.textContent=frp+"%";
  fwRefs.chargeFill.style.width=crp+"%"; fwRefs.chargeNum.textContent=scatterReady()?"Ready!":crp+"%";
  if(fwRefs.wasReady!==scatterReady()){ fwRefs.wasReady=scatterReady(); setScatterBtn(); }
  // live stats
  const totalVisits=Object.keys(state.seen).reduce((s,k)=>s+state.seen[k],0);
  fwRefs.vVisits.textContent=totalVisits.toLocaleString();
  fwRefs.vHappy.textContent=state.happyVisits.toLocaleString();
  fwRefs.vScatters.textContent=state.scatters.toLocaleString();
  fwRefs.vSpecies.textContent=`${discCountArea(state.area)}/${BIRDS.filter(b=>b.area===state.area).length}`;
  // live logbook: rebuild when the species set / discovery changes, else just bump counts
  const seenList=feederSeenList();
  const key=seenList.map(sp=>sp.id+(state.discovered[sp.id]?"!":"")).join(",");
  if(key!==fwRefs.logKey){ rebuildFeederLog(); }
  else for(const sp of seenList){ const ct=fwRefs.rows[sp.id]; if(ct) ct.innerHTML=`${state.seen[sp.id]}<small> visits</small>`; }
}

/* ---- bird index (fullscreen "field guide", grouped by biome) ---- */
const indexCells={};
const BIOME_ORDER=["suburb","forest","wetland","mountain"];
function buildIndex(){
  const grid=$("indexGrid"); grid.innerHTML="";
  for(const aid of BIOME_ORDER){
    const area=AREAS.find(a=>a.id===aid); if(!area) continue;
    const sec=document.createElement("section"); sec.className="biome"; sec.dataset.biome=aid;
    const hdr=document.createElement("h3"); hdr.className="biome-hdr";
    hdr.innerHTML=`<span class="biome-emoji">${area.emoji}</span><span class="biome-name">${area.name}</span><span class="biome-prog" data-prog="${aid}"></span>`;
    sec.appendChild(hdr);
    const bg=document.createElement("div"); bg.className="biome-grid"; sec.appendChild(bg);
    for(const sp of BIRDS.filter(b=>b.area===aid)){
      const cell=document.createElement("div"); cell.className="index-cell";
      const cv=document.createElement("canvas"); cv.width=72; cv.height=60;
      const name=document.createElement("div"); name.className="ic-name";
      const dot=document.createElement("div"); dot.className="ic-dot";
      const hint=document.createElement("div"); hint.className="ic-hint";
      cell.appendChild(dot); cell.appendChild(cv); cell.appendChild(name); cell.appendChild(hint); bg.appendChild(cell);
      indexCells[sp.id]={cell,cv,name,dot,hint};
      cell.addEventListener("click",()=>{ if(state.discovered[sp.id]) openCard(sp); });
      paintIndexCell(sp);
    }
    grid.appendChild(sec);
  }
  refreshIndexProgress();
}
function refreshIndexProgress(){
  for(const aid of BIOME_ORDER){
    const el=document.querySelector(`[data-prog="${aid}"]`); if(!el) continue;
    el.textContent=`${discCountArea(aid)} / ${BIRDS.filter(b=>b.area===aid).length}`;
  }
}
/* pixel constellation backdrop for the field guide */
function drawIndexStars(){
  const cv=$("indexStars"); if(!cv) return;
  const w=Math.max(1,cv.clientWidth||cv.offsetWidth), h=Math.max(1,cv.clientHeight||cv.offsetHeight);
  cv.width=w; cv.height=h; const g=cv.getContext("2d"); g.imageSmoothingEnabled=false;
  const grd=g.createLinearGradient(0,0,0,h); grd.addColorStop(0,"#0b0f2c"); grd.addColorStop(1,"#161b40");
  g.fillStyle=grd; g.fillRect(0,0,w,h);
  let s=982451653; const rr=()=>{ s=(s*1103515245+12345)&0x7fffffff; return s/0x7fffffff; };
  const N=Math.round(w*h/2400);
  for(let i=0;i<N;i++){ const x=Math.floor(rr()*w), y=Math.floor(rr()*h), b=rr();
    g.fillStyle=b>0.93?"#fffbe8":b>0.7?"#cdd8ff":"#7a88c0"; g.fillRect(x,y,b>0.96?2:1,b>0.96?2:1); }
  // a few constellations: bright vertex stars joined by faint lines
  const shapes=[ [[0,4],[3,0],[6,3],[9,0],[12,4]], [[0,0],[3,2],[6,1],[8,4],[5,6],[2,5]], [[0,2],[3,0],[6,2],[4,5],[1,5]] ];
  const spots=[[0.14,0.20],[0.72,0.15],[0.46,0.55],[0.86,0.5],[0.27,0.8],[0.62,0.78]];
  spots.forEach(([fx,fy],i)=>{
    const sh=shapes[i%shapes.length], sc=7+(i%3)*2, ox=fx*w, oy=fy*h;
    g.strokeStyle="rgba(150,170,235,0.26)"; g.lineWidth=1; g.beginPath();
    sh.forEach((p,j)=>{ const X=Math.round(ox+p[0]*sc), Y=Math.round(oy+p[1]*sc); j?g.lineTo(X+0.5,Y+0.5):g.moveTo(X+0.5,Y+0.5); });
    g.stroke();
    for(const p of sh){ const X=Math.round(ox+p[0]*sc), Y=Math.round(oy+p[1]*sc);
      g.fillStyle="#fffbe8"; g.fillRect(X,Y,2,2);
      g.fillStyle="rgba(255,251,232,0.4)"; g.fillRect(X-1,Y,1,1); g.fillRect(X+2,Y,1,1); g.fillRect(X,Y-1,1,1); g.fillRect(X,Y+2,1,1); }
  });
}
function paintIndexCell(sp){
  const c=indexCells[sp.id]; if(!c) return; const found=!!state.discovered[sp.id], isLure=!!sp.lure;
  c.cell.classList.toggle("found",found); c.cell.classList.toggle("locked",!found);
  c.cell.classList.toggle("lure", isLure && !found);
  c.cell.style.borderColor = (isLure && !found) ? RARITY[sp.rarity].color : "";
  c.dot.style.background=RARITY[sp.rarity].color; c.dot.style.display=found?"block":"none";
  if(found){ c.name.textContent=sp.name; c.name.classList.remove("locked"); Sprites.drawPortrait(c.cv,sp,{}); }
  else{ c.name.textContent="? ? ?"; c.name.classList.add("locked"); Sprites.drawPortrait(c.cv,sp,{silhouette:"#b9ab8f"}); }
  if(c.hint){
    if(isLure && !found){ c.hint.textContent=`${RARITY[sp.rarity].label} · ${lureHint(sp)}`; c.hint.style.color=RARITY[sp.rarity].color; c.hint.style.display="block"; }
    else c.hint.style.display="none";
  }
}
function onDiscover(sp){
  paintIndexCell(sp); refreshIndexProgress();
  checkBiomeUnlock(); buildLureGuide(); buildBiomeCard();
  indexCells[sp.id]?.cell.classList.add("new");
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
let claimableShown=false;
function buildQuests(){
  const list=$("questList"); if(!list) return; list.innerHTML="";
  const shown=QUESTS.slice(state.questIdx, state.questIdx+3);
  if(!shown.length){ list.innerHTML=`<div class="quest done">🌟 All quests complete — you legend!</div>`; claimableShown=false; return; }
  shown.forEach((q,i)=>{
    const cur=q.metric(state), pct=Math.min(100,Math.round(cur/q.target*100));
    const claimable=(i===0 && cur>=q.target);
    const rw=q.reward.feathers?`+${q.reward.feathers}🪶`:`+${q.reward.points}✨`;
    const el=document.createElement("div"); el.className="quest"+(i===0?" active":"")+(claimable?" claimable":""); el.dataset.qi=state.questIdx+i;
    el.innerHTML=`<div class="q-top"><b>${q.name}</b><span>${rw}</span></div>
      <div class="q-desc">${q.desc}</div>`+
      (claimable
        ? `<button class="q-claim" data-claim>Claim reward ${rw}</button>`
        : `<div class="q-bar"><div class="q-fill" style="width:${pct}%"></div></div>
           <div class="q-num">${Math.min(cur,q.target).toLocaleString()} / ${q.target.toLocaleString()}</div>`);
    list.appendChild(el);
  });
  const cb=list.querySelector("[data-claim]"); if(cb) cb.addEventListener("click",claimQuest);
  claimableShown=questClaimable();
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

/* ---- lure guide (current biome's rare/legendary recipes) ---- */
function buildLureGuide(){
  const el=$("lureGuide"); if(!el) return; el.innerHTML="";
  const lures=BIRDS.filter(b=>b.area===state.area && b.lure);
  if(!lures.length){ el.innerHTML=`<p class="j-empty">No special visitors to chart in this biome.</p>`; return; }
  for(const sp of lures){
    const found=!!state.discovered[sp.id], L=sp.lure;
    const row=document.createElement("div"); row.className="lure-row"+(found?" found":"");
    const cv=document.createElement("canvas"); cv.width=44; cv.height=34; cv.className="lure-thumb";
    Sprites.drawPortrait(cv, sp, found?{}:{silhouette:"#7a6a4c"});
    const reqs=[];   // once discovered, every requirement stays ticked off for good
    if(L.structure){ const s=STRUCTURES.find(x=>x.id===L.structure); reqs.push({label:"Build "+(s?s.name:L.structure), met:found||!!state.structures[L.structure]}); }
    if(L.food){ const f=FOOD_BY_ID[L.food]; reqs.push({label:"Serve "+(f?f.name:L.food), met:found||state.foodType===L.food}); }
    if(L.season!=null) reqs.push({label:"Visit in "+SEASONS[L.season].name, met:found||currentSeason()===L.season});
    if(L.weather==="rain") reqs.push({label:"Visit in the rain", met:found||weather==="rain"});
    const reqHtml=reqs.map(r=>`<li class="${r.met?'met':'unmet'}">${r.met?'✓':'○'} ${r.label}</li>`).join("");
    const info=document.createElement("div"); info.className="lure-info";
    info.innerHTML=`<div class="lure-name" style="color:${RARITY[sp.rarity].color}">${found?sp.name:RARITY[sp.rarity].label+" — ???"}</div>
      <ul class="lure-reqs">${reqHtml}</ul>`
      + (found?`<div class="lure-done">★ Caught — in your Field Guide!</div>`:``);
    row.appendChild(cv); row.appendChild(info);
    if(found) row.addEventListener("click",()=>openCard(sp));
    el.appendChild(row);
  }
}
/* ---- next-biome card + discovery-gated travel ---- */
function checkBiomeUnlock(){
  let opened=false;
  for(let i=0;i<BIOME_ORDER.length-1;i++){
    const a=BIOME_ORDER[i], next=BIOME_ORDER[i+1];
    const full=discCountArea(a)>=BIRDS.filter(b=>b.area===a).length;
    if(state.unlockedAreas[a] && full && !state.unlockedAreas[next]){
      state.unlockedAreas[next]=true; opened=true;
      const nm=(AREAS.find(x=>x.id===next)||{}).name||next;
      ticker(`You've charted every bird here — the ${nm} opens, with new upgrades to chase! 🗺️`); sfx("discover");
    }
  }
  if(opened) buildShop();   // reveal the newly-unlocked tier of upgrades
  return opened;
}
function buildBiomeCard(){
  const el=$("biomeCard"); if(!el) return;
  const idx=BIOME_ORDER.indexOf(state.area), cur=AREAS.find(a=>a.id===state.area)||{name:state.area};
  const found=discCountArea(state.area), total=BIRDS.filter(b=>b.area===state.area).length, pct=Math.round(found/total*100);
  const nextId=BIOME_ORDER[idx+1], nextArea=nextId?AREAS.find(a=>a.id===nextId):null;
  let html=`<div><div class="bc-prog-top"><span>${cur.name}</span><b>${found}/${total} charted</b></div>
    <div class="bc-bar"><div class="bc-fill" style="width:${pct}%"></div></div></div>`;
  if(nextArea){
    const unlocked=!!state.unlockedAreas[nextId];
    html+=`<div class="bc-next ${unlocked?'open':'locked'}">
      <div class="bc-face">${nextArea.emoji}</div>
      <div class="bc-next-info"><div class="bc-next-name">${unlocked?nextArea.name:'? ? ?'}</div>
        <p>${unlocked?nextArea.blurb:'A new biome awaits, full of birds you have never seen.'}</p>
        ${unlocked ? `<button class="bc-travel" data-go="${nextId}">Travel onward →</button>`
                   : `<div class="bc-locked-msg">Chart all ${total} birds here to open it.</div>`}</div></div>`;
  } else {
    html+=`<div class="bc-final">★ You've reached the final biome — the alpine heights.</div>`;
  }
  const chips=BIOME_ORDER.filter(id=>state.unlockedAreas[id]);
  if(chips.length>1) html+=`<div class="bc-chips">`+chips.map(id=>{ const a=AREAS.find(x=>x.id===id)||{};
    return `<button class="bc-chip${id===state.area?' on':''}" data-chip="${id}">${a.emoji||''} ${a.name||id}</button>`; }).join("")+`</div>`;
  el.innerHTML=html;
  el.querySelectorAll("[data-go]").forEach(b=>b.addEventListener("click",()=>switchArea(b.dataset.go)));
  el.querySelectorAll("[data-chip]").forEach(b=>b.addEventListener("click",()=>{ if(b.dataset.chip!==state.area) switchArea(b.dataset.chip); }));
}
function switchArea(id){
  if(!state.unlockedAreas[id] || id===state.area) return;
  state.area=id; birds=[]; occupied.clear(); hawk=null; spawnTimer=1.0;
  buildStructures(); buildLureGuide(); buildBiomeCard(); refreshHUD();
  ticker(`Travelled to the ${areaName()}. ${(AREAS.find(a=>a.id===id)||{}).emoji||""}`); sfx("scatter"); save();
}

/* ---- prestige / migration ---- */
function buildPrestige(){
  const gain=feathersOnMigrate();
  $("migrateInfo").innerHTML=`<p>Migrate to reset your points, upgrades, foods and current area — but keep your
    <b>collection</b>, <b>achievements</b> and <b>Feathers</b>. Each migration earns Feathers for permanent boosts.</p>
    <p class="migrate-gain">Migrating now earns <b>+${gain}</b> Feathers &nbsp;·&nbsp; Migrations: <b>${state.migrations}</b></p>`;
  const mb=$("migrateBtn"); mb.innerHTML="";
  if(gain<1){ mb.disabled=true; mb.textContent="Earn more points first"; }
  else { mb.disabled=false; const bi=Sprites.iconCanvas("bird",16); if(bi)mb.appendChild(bi); mb.append(`  Migrate  +${gain} `); const fi=Sprites.iconCanvas("feather",13); if(fi)mb.appendChild(fi); }
  const list=$("prestigeList"); list.innerHTML="";
  for(const p of PRESTIGE){
    const lvl=state.prestige[p.id]; const item=document.createElement("div"); item.className="shop-item";
    let btn;
    if(lvl>=p.max) btn=`<button class="buy-btn maxed" disabled>MAX</button>`;
    else { const cost=presCost(p); btn=`<button class="buy-btn feather" data-p="${p.id}" ${state.feathers<cost?"disabled":""}><span class="blabel">Buy</span><small class="bcost" data-cost="feather:${cost}"></small></button>`; }
    item.innerHTML=`<div class="shop-ico" data-ic="${PRES_ICONS[p.id]||'feather'}" data-icsize="20"></div>
      <div class="shop-info"><h3>${p.name} <span class="lvl">${lvl>0?`Lv.${lvl}`:""}</span></h3><p>${p.desc}</p></div>${btn}`;
    list.appendChild(item);
  }
  fillIcons(list); fillCosts(list);
  list.querySelectorAll("[data-p]").forEach(b=>b.addEventListener("click",()=>buyPrestige(b.dataset.p)));
}
function buyPrestige(id){
  const p=PRESTIGE.find(x=>x.id===id); const lvl=state.prestige[id]; if(lvl>=p.max) return;
  const cost=presCost(p); if(state.feathers<cost) return;
  state.feathers-=cost; state.prestige[id]++; sfx("buy"); ticker(`${p.name} → Lv.${state.prestige[id]} 🪶`);
  buildPrestige(); refreshHUD(); save();
}
function doMigrate(){
  const gain=feathersOnMigrate(); if(gain<1) return;
  if(!confirm(`Migrate now for +${gain} Feathers?\nYou keep your collection, achievements and Feathers, but points, upgrades, foods and area reset.`)) return;
  state.feathers+=gain; state.migrations++;
  const keep={ discovered:state.discovered, seen:state.seen, speciesFed:state.speciesFed,
    happyVisits:state.happyVisits, achievements:state.achievements,
    feathers:state.feathers, migrations:state.migrations, prestige:state.prestige,
    flags:state.flags, clock:state.clock, dayCount:state.dayCount, lastDay:state.lastDay, streak:state.streak, muted:state.muted };
  state=Object.assign(defaultState(), keep);
  birds=[]; occupied.clear(); seeds=[]; floats=[]; hawk=null; frenzyUntil=0; recentHappy=[];
  spawnTimer=1.5; scatterCharge=1;
  buildShop(); buildStructures(); buildFoods(); buildQuests(); buildPrestige();
  checkBiomeUnlock(); buildLureGuide(); buildBiomeCard(); refreshHUD(); closePanels();
  ticker(`🦅 You migrated! Earned ${gain} Feathers. A fresh season begins.`); sfx("discover"); save();
}

/* ---- toasts / ticker ---- */
function toast(sp,text){
  const wrap=$("toasts"); const el=document.createElement("div"); el.className="toast";
  const cv=document.createElement("canvas"); cv.width=44; cv.height=38; Sprites.drawPortrait(cv,sp,{});
  const txt=document.createElement("div"); txt.innerHTML=`${sp.name}<small>${text}</small>`;
  el.appendChild(cv); el.appendChild(txt); wrap.appendChild(el); setTimeout(()=>el.remove(),3900);
}
const IDLE_LINES=["A gentle breeze drifts through the yard…","Sunlight dapples the feeder.","Somewhere, a robin is singing.","The hedge rustles softly.","A perfect day for birdwatching.","Leaves whisper overhead.","The air smells of fresh seed.","A butterfly wanders past.","Clouds drift lazily by.","All is calm in the garden."];
/* flavor text fades in at a random spot around the feeder, then fades back out */
let flavorTimer=null, lastFlavor=0;
function flavor(msg){
  const layer=$("flavorLayer"); if(!layer) return;
  const el=document.createElement("div"); el.className="flavor-line"; el.textContent=msg;
  el.style.left=(26+Math.random()*48)+"vw";    // hidden boundary around the feeder + some space
  el.style.top=(30+Math.random()*36)+"vh";
  layer.appendChild(el); setTimeout(()=>el.remove(),6200); lastFlavor=Date.now();
}
function ticker(msg){ flavor(msg); }
function scheduleFlavor(){ clearInterval(flavorTimer); flavorTimer=setInterval(()=>{
  if(!document.hidden && Date.now()-lastFlavor>5200) flavor(IDLE_LINES[(Math.random()*IDLE_LINES.length)|0]);
}, 6500); }
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
    case "fresh":    tone(523,0.09,"triangle",0.05); tone(784,0.10,"triangle",0.05,0.07); tone(1046,0.16,"sine",0.045,0.15); break;
    case "rare":     tone(659,0.10,"triangle",0.05); tone(880,0.10,"triangle",0.05,0.08); tone(1175,0.18,"sine",0.05,0.17); break;
    case "legendary":[523,659,784,1046,1318].forEach((f,i)=>tone(f,0.18,"triangle",0.05,i*0.1)); tone(1568,0.5,"sine",0.045,0.55); tone(2093,0.5,"sine",0.03,0.6); break;
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
  const f=currentFeeder();
  if(!scatterReady()){                       // still recharging — gentle nudge, no penalty
    addFloat(f.x, f.trayY-30, "-", "#9c8a63"); sfx("scatter"); return;
  }
  scatterCharge=0; state.freshness=1; state.scatters++;
  scatterBurstT=t; spawnSeedToss(f,8);
  addFloat(f.x, f.trayY-40, "FRESH!", "#ffe06a", 2);   // bold pixel callout
  for(let i=0;i<12;i++) sparkle(f.x+(Math.random()-0.5)*40, f.trayY-30+(Math.random()-0.5)*24);
  for(const b of birds){ if(b.st!=="leaving" && !b.golden){ b.emote="happy"; b.emoteFade=1; } }  // birds perk up
  sfx("fresh"); flashStat("pointsVal");
  registerHappy();                           // a fresh scatter helps build toward a frenzy
  notifyProgress(); refreshHUD();
  if(!$("overlayFeeder").classList.contains("hidden")) updateFeederLive();
}
function canvasToInternal(e){
  const r=canvas.getBoundingClientRect(); const scale=Math.max(r.width/Sprites.L.W, r.height/Sprites.L.H);
  const offX=(r.width-Sprites.L.W*scale)/2, offY=(r.height-Sprites.L.H*scale)/2;
  return { x:(e.clientX-r.left-offX)/scale, y:(e.clientY-r.top-offY)/scale };
}
function onCanvasClick(e){
  const p=canvasToInternal(e);
  // hawk?
  if(hawk && Math.hypot(p.x-hawk.x,p.y-hawk.y)<22){ const fr=1; state.feathers+=fr; addFloat(hawk.x,hawk.y-14,"+1","#e8c34a");
    ticker("🦅 You shooed the hawk away! +1🪶"); sfx("buy"); hawk=null; refreshHUD(); save(); return; }
  // golden bird?
  for(const b of birds){ if(b.golden && b.st!=="leaving" && Math.hypot(p.x-b.x,p.y-b.y)<16){ collectGolden(b); return; } }
  // feeder → scatter fresh seed (the details window lives on the "Feeder" button)
  if(overFeeder(p)){ state.flags.tappedFeeder=true; scatter(); }
}
function overFeeder(p){ const f=Sprites.L.feeder; return p.x>f.x-46&&p.x<f.x+46&&p.y>f.trayY-58&&p.y<Sprites.L.groundContact; }
function onCanvasHover(e){
  const p=canvasToInternal(e);
  let hot = overFeeder(p) || (hawk && Math.hypot(p.x-hawk.x,p.y-hawk.y)<22);
  if(!hot) for(const b of birds){ if(b.golden && b.st!=="leaving" && Math.hypot(p.x-b.x,p.y-b.y)<16){ hot=true; break; } }
  canvas.style.cursor = hot ? "pointer" : "default";
}
function openPanel(id){ closePanels(); $(id).classList.remove("hidden");
  if(id==="overlayMigrate") buildPrestige();
  if(id==="overlayIndex"){ refreshIndexProgress(); requestAnimationFrame(drawIndexStars); }
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
  $("btnFeeder").addEventListener("click",openFeeder);
  $("btnIndex").addEventListener("click",()=>openPanel("overlayIndex"));
  $("btnMigrate").addEventListener("click",()=>openPanel("overlayMigrate"));
  $("migrateBtn").addEventListener("click",doMigrate);
  $("journalToggle").addEventListener("click",toggleJournal);
  document.querySelectorAll("#journal .jtab").forEach(b=>b.addEventListener("click",()=>showJournalTab(b.dataset.tab)));
  canvas.addEventListener("click",onCanvasClick);
  canvas.addEventListener("mousemove",onCanvasHover);
  document.querySelectorAll("[data-close]").forEach(b=>b.addEventListener("click",closePanels));
  $("cardClose").addEventListener("click",()=>$("cardModal").classList.add("hidden"));
  document.querySelectorAll(".overlay").forEach(o=>o.addEventListener("click",e=>{ if(e.target===o) o.classList.add("hidden"); }));
  $("muteBtn").addEventListener("click",()=>{ state.muted=!state.muted; setIcon("muteIco",state.muted?"mute":"speaker",20); $("muteState").textContent=state.muted?"Off":"On"; if(state.muted) setAmbientMuted(true); else { startAmbient(); setAmbientMuted(false); } save(); });
  $("resetBtn").addEventListener("click",()=>{ if(confirm("Erase ALL progress (including Feathers & collection) and start completely over?")){ try{ localStorage.removeItem(SAVE_KEY); }catch(e){} state=defaultState(); birds=[]; occupied.clear(); floats=[]; seeds=[]; hawk=null; buildShop(); buildStructures(); buildIndex(); buildQuests(); buildAchievements(); buildPrestige(); buildLureGuide(); buildBiomeCard(); setIcon("muteIco","speaker",20); $("muteState").textContent="On"; refreshHUD(); closePanels(); ticker("A brand new world."); } });
  window.addEventListener("keydown",e=>{ if(e.code==="Space"){ e.preventDefault(); state.flags.tappedFeeder=true; scatter(); } if(e.code==="Escape") closePanels(); });
  window.addEventListener("beforeunload",save);
  window.addEventListener("resize",()=>{ if(!$("overlayIndex").classList.contains("hidden")) drawIndexStars(); });
  const startAudioOnce=()=>{ ensureAudio(); if(!state.muted) startAmbient(); window.removeEventListener("pointerdown",startAudioOnce); window.removeEventListener("keydown",startAudioOnce); };
  window.addEventListener("pointerdown",startAudioOnce); window.addEventListener("keydown",startAudioOnce);
  document.addEventListener("visibilitychange",()=> document.hidden?onHidden():onVisible());
}

/* ============================================================
   BOOT
   ============================================================ */
function init(){
  canvas=$("game"); ctx=canvas.getContext("2d"); ctx.imageSmoothingEnabled=false;
  load(); checkBiomeUnlock(); applyOffline(); checkDailyLogin();
  fillIcons(document);                       // static UI icons (HUD, buttons)
  setIcon("muteIco", state.muted?"mute":"speaker", 20); $("muteState").textContent=state.muted?"Off":"On";
  buildShop(); buildStructures(); buildIndex(); buildQuests(); buildAchievements(); buildPrestige();
  buildLureGuide(); buildBiomeCard(); wireUI();
  checkAchievements(); refreshHUD();
  let msg = pendingOffline ? `Welcome back! Your helpers earned ✨${pendingOffline.gained} over ~${pendingOffline.mins} min.`
                           : "Welcome! Your helper has the feeder stocked — tap it to scatter fresh seed for a boost. 🐦";
  if(pendingDaily) msg = `Day ${pendingDaily.streak} streak! +${pendingDaily.feathers}🪶. Today's special guest: the ${pendingDaily.bird?pendingDaily.bird.name:"mystery bird"}.`;
  ticker(msg); scheduleFlavor();
  scatterCharge=1;
  requestAnimationFrame(loop);
}
if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",init); else init();

})();
