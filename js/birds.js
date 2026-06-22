/* ============================================================
   birds.js — species data for Backyard Birds
   Each species drives both gameplay (points / rarity / spawn
   weight) and its procedurally-drawn sprite (palette + marks).
   ============================================================ */

/* Rarity → display color + a base spawn weight multiplier.
   Higher weight = shows up more often. */
const RARITY = {
  common:   { label: "Common",   color: "#7c9c6a", weight: 10 },
  uncommon: { label: "Uncommon", color: "#4f8ab0", weight: 4  },
  rare:     { label: "Rare",     color: "#b067c0", weight: 1.4 },
  legendary:{ label: "Legendary",color: "#d99a2b", weight: 0.5 },
};

/* shape flags:
     plump     – rounder, heavier body (doves/robins)
     crest     – pointed head feathers (cardinal, jay, titmouse)
     longTail  – extended tail (mourning dove)
     little    – tiny body (chickadee, goldfinch)
   palette keys:
     body, belly, wing, tail, beak, eye, head(optional)
     cap, bib, cheek, mask  – optional markings (any may be omitted) */
const BIRDS = [
  {
    id: "house_sparrow", name: "House Sparrow", area: "suburb",
    rarity: "common", points: 1,
    desc: "A cheerful, chattery regular. The first friend at almost any feeder.",
    shape: { size: 0.92 },
    palette: {
      body:"#a07f52", belly:"#d8c6a2", wing:"#6f5530", tail:"#5b4326",
      beak:"#39393b", eye:"#1b1410", head:"#7c6647", cap:"#6e5e44",
      cheek:"#cdb893", bib:"#3a342c",
    },
  },
  {
    id: "house_finch", name: "House Finch", area: "suburb",
    rarity: "common", points: 2,
    desc: "Streaky brown with a splash of raspberry on the males. Loves to sing.",
    shape: { size: 0.9 },
    palette: {
      body:"#8c7256", belly:"#cdbb9b", wing:"#6c563d", tail:"#5a4631",
      beak:"#7a6a4c", eye:"#1b1410", head:"#9c4b3f", cap:"#bd4435", bib:"#c1503a",
    },
  },
  {
    id: "dark_eyed_junco", name: "Dark-eyed Junco", area: "suburb",
    rarity: "common", points: 2,
    desc: "“Snowbird.” Slate-grey hood, clean white belly, and a tidy pink bill.",
    shape: { size: 0.9 },
    palette: {
      body:"#5d5d68", belly:"#ece9e2", wing:"#50505a", tail:"#3f3f47",
      beak:"#e7b3b3", eye:"#120f0c", head:"#4c4c57",
    },
  },
  {
    id: "american_robin", name: "American Robin", area: "suburb",
    rarity: "common", points: 3,
    desc: "Grey back, brick-orange breast, and an early-morning song.",
    shape: { size: 1.05, plump: true },
    palette: {
      body:"#5f5c56", belly:"#c25a32", wing:"#54514b", tail:"#403d38",
      beak:"#e3a82a", eye:"#15110d", head:"#34322e", cheek:"#6a6760",
    },
  },
  {
    id: "black_capped_chickadee", name: "Black-capped Chickadee", area: "suburb",
    rarity: "common", points: 3,
    desc: "Tiny, bold, and curious — the one that says its own name: chicka-dee-dee.",
    shape: { size: 0.78, little: true },
    palette: {
      body:"#b7b3a8", belly:"#f3f0e8", wing:"#8f8c84", tail:"#7d7a72",
      beak:"#26241f", eye:"#100d0a", head:"#ffffff",
      cap:"#2a2823", bib:"#2a2823", cheek:"#ffffff",
    },
  },
  {
    id: "tufted_titmouse", name: "Tufted Titmouse", area: "suburb",
    rarity: "uncommon", points: 4,
    desc: "A silvery sprite with a jaunty crest and peach-washed flanks.",
    shape: { size: 0.86, crest: true },
    palette: {
      body:"#9a9aa1", belly:"#ece9e2", wing:"#86868d", tail:"#74747b",
      beak:"#2a2823", eye:"#100d0a", head:"#9a9aa1", cheek:"#d9b89a",
    },
  },
  {
    id: "white_breasted_nuthatch", name: "White-breasted Nuthatch", area: "suburb",
    rarity: "uncommon", points: 4,
    desc: "The upside-down acrobat that walks headfirst down tree trunks.",
    shape: { size: 0.84 },
    palette: {
      body:"#6e7f96", belly:"#f2f0ea", wing:"#5a6b82", tail:"#48566b",
      beak:"#26241f", eye:"#100d0a", head:"#ffffff", cap:"#2b2b30", cheek:"#ffffff",
    },
  },
  {
    id: "american_goldfinch", name: "American Goldfinch", area: "suburb",
    rarity: "uncommon", points: 5,
    desc: "A drop of summer sunshine in black-capped, black-winged finery.",
    shape: { size: 0.82, little: true },
    palette: {
      body:"#f2c413", belly:"#f7d94a", wing:"#23211c", tail:"#23211c",
      beak:"#e0894b", eye:"#120f0c", head:"#f2c413", cap:"#23211c",
    },
  },
  {
    id: "mourning_dove", name: "Mourning Dove", area: "suburb",
    rarity: "uncommon", points: 5,
    desc: "Soft, dusty-rose and endlessly gentle, with a mournful coo at dusk.",
    shape: { size: 1.12, plump: true, longTail: true },
    palette: {
      body:"#b9a890", belly:"#cbbda6", wing:"#9a876c", tail:"#7f6e54",
      beak:"#2a2823", eye:"#120f0c", head:"#bcab94", cheek:"#c9a59a",
    },
  },
  {
    id: "northern_cardinal", name: "Northern Cardinal", area: "suburb",
    rarity: "rare", points: 7,
    desc: "Unmistakable scarlet, a black mask, and a proud pointed crest.",
    shape: { size: 1.04, crest: true },
    palette: {
      body:"#c23026", belly:"#b62f26", wing:"#a4271f", tail:"#8d201a",
      beak:"#eb9a3c", eye:"#150b09", head:"#c23026", mask:"#241612",
    },
  },
  {
    id: "blue_jay", name: "Blue Jay", area: "suburb",
    rarity: "rare", points: 8,
    desc: "Brash, brilliant, and clever — a flash of sky-blue with a crest.",
    shape: { size: 1.1, crest: true },
    palette: {
      body:"#3f72a8", belly:"#eceae3", wing:"#2f578a", tail:"#264a78",
      beak:"#26241f", eye:"#100d0a", head:"#3f72a8", bib:"#22405f",
    },
  },
  {
    id: "rose_breasted_grosbeak", name: "Rose-breasted Grosbeak", area: "suburb",
    rarity: "legendary", points: 14,
    desc: "A rare treat: jet-black, snow-white, and a vivid crimson heart on the chest.",
    shape: { size: 1.0 },
    palette: {
      body:"#27241f", belly:"#f3f0e8", wing:"#1c1a16", tail:"#1c1a16",
      beak:"#e9e2cf", eye:"#100d0a", head:"#1f1d18", bib:"#c8324a",
    },
  },

  /* ============ WHISPERING WOODLAND (forest) ============ */
  { id:"downy_woodpecker", name:"Downy Woodpecker", area:"forest", rarity:"common", points:3,
    foods:["suet","seed"], rainLover:false,
    desc:"A pint-sized woodpecker in crisp black-and-white, fond of suet.",
    shape:{ size:0.86, little:true },
    palette:{ body:"#f2efe6", belly:"#f2efe6", wing:"#23211c", tail:"#23211c", beak:"#3a3a3a", eye:"#120f0c",
      head:"#f2efe6", cap:"#23211c", cheek:"#f2efe6", bib:"#23211c" } },
  { id:"white_throated_sparrow", name:"White-throated Sparrow", area:"forest", rarity:"common", points:2,
    foods:["seed"], desc:"Brown and tidy with a bright white throat and a whistled “Oh-sweet-Canada.”",
    shape:{ size:0.9 },
    palette:{ body:"#8a6f52", belly:"#cdbb9b", wing:"#6c563d", tail:"#5a4631", beak:"#3a3a3a", eye:"#1b1410",
      head:"#6a563e", cap:"#4a3a2a", cheek:"#cdb893", bib:"#f2efe6" } },
  { id:"eastern_bluebird", name:"Eastern Bluebird", area:"forest", rarity:"uncommon", points:5,
    foods:["fruit","seed"], desc:"A scrap of sky with a warm rusty breast — pure happiness.",
    shape:{ size:0.92 },
    palette:{ body:"#3f6fbf", belly:"#c46a3a", wing:"#2f5aa0", tail:"#264a86", beak:"#2b2b2b", eye:"#100d0a",
      head:"#3f6fbf" } },
  { id:"red_breasted_nuthatch", name:"Red-breasted Nuthatch", area:"forest", rarity:"uncommon", points:4,
    foods:["suet","seed"], desc:"A tiny, nasal-voiced acrobat with a rusty belly and bold eyeline.",
    shape:{ size:0.82, little:true },
    palette:{ body:"#6e7f96", belly:"#c98a5e", wing:"#5a6b82", tail:"#48566b", beak:"#26241f", eye:"#100d0a",
      head:"#ffffff", cap:"#2b2b30", cheek:"#ffffff" } },
  { id:"wood_thrush", name:"Wood Thrush", area:"forest", rarity:"uncommon", points:4,
    foods:["fruit"], season:[0,1], rainLover:true,
    desc:"Warm cinnamon above, spotted below; its flute-song is the soul of the woods.",
    shape:{ size:1.0, plump:true },
    palette:{ body:"#9a6a44", belly:"#e8e0d2", wing:"#80552f", tail:"#6a4628", beak:"#3a3a3a", eye:"#150f0a",
      head:"#a06f47" } },
  { id:"scarlet_tanager", name:"Scarlet Tanager", area:"forest", rarity:"rare", points:8,
    foods:["fruit","nectar"], season:[1],
    desc:"Impossibly red with jet-black wings — a flame in the treetops.",
    shape:{ size:0.96 },
    palette:{ body:"#d62a22", belly:"#c62820", wing:"#1c1a16", tail:"#1c1a16", beak:"#bcae8a", eye:"#150b09",
      head:"#d62a22" } },
  { id:"pileated_woodpecker", name:"Pileated Woodpecker", area:"forest", rarity:"rare", points:10,
    foods:["suet"], desc:"Crow-sized and dramatic, with a flaming red crest and a ringing call.",
    shape:{ size:1.16, crest:true },
    palette:{ body:"#1f1d18", belly:"#1f1d18", wing:"#161410", tail:"#161410", beak:"#cfc6a8", eye:"#d8d2c0",
      head:"#1f1d18", cap:"#c0302a", cheek:"#f2efe6" } },
  { id:"baltimore_oriole", name:"Baltimore Oriole", area:"forest", rarity:"legendary", points:16,
    foods:["nectar","fruit"], season:[0,1],
    desc:"Flame-orange and black, a sip-loving jewel that adores oranges and nectar.",
    shape:{ size:0.98 },
    palette:{ body:"#e8772a", belly:"#f0902f", wing:"#1c1a16", tail:"#1c1a16", beak:"#9aa2a6", eye:"#100d0a",
      head:"#1c1a16" } },

  /* ============ REEDY WETLAND (wetland) ============ */
  { id:"red_winged_blackbird", name:"Red-winged Blackbird", area:"wetland", rarity:"common", points:3,
    foods:["seed"], desc:"Glossy black with fiery shoulder badges, calling “conk-la-ree!” over the reeds.",
    shape:{ size:1.0 },
    palette:{ body:"#1b1916", belly:"#1b1916", wing:"#15130f", tail:"#15130f", beak:"#2b2b2b", eye:"#cfc6a8",
      head:"#1b1916", bib:"#c0302a" } },
  { id:"common_yellowthroat", name:"Common Yellowthroat", area:"wetland", rarity:"common", points:3,
    foods:["suet","seed"], season:[0,1],
    desc:"A skulking warbler in olive and gold with a rakish black bandit mask.",
    shape:{ size:0.78, little:true },
    palette:{ body:"#8a8a48", belly:"#f0d84a", wing:"#6f6f38", tail:"#5c5c2e", beak:"#2b2b2b", eye:"#120f0c",
      head:"#8a8a48", mask:"#1c1a16" } },
  { id:"marsh_wren", name:"Marsh Wren", area:"wetland", rarity:"common", points:2,
    foods:["suet"], desc:"A tiny brown firecracker with a cocked tail and a bubbling, gurgling song.",
    shape:{ size:0.74, little:true },
    palette:{ body:"#8a6a44", belly:"#d6c6a6", wing:"#6c5030", tail:"#5a4226", beak:"#3a3a3a", eye:"#150f0a",
      head:"#7a5a38", cheek:"#e8dcc4" } },
  { id:"cedar_waxwing", name:"Cedar Waxwing", area:"wetland", rarity:"uncommon", points:5,
    foods:["fruit"], desc:"Silky fawn-grey, masked like a bandit, dipped in yellow at the tail.",
    shape:{ size:0.9, crest:true },
    palette:{ body:"#b39a76", belly:"#d8c08e", wing:"#8f7a58", tail:"#6a5a40", beak:"#2b2b2b", eye:"#100d0a",
      head:"#b39a76", mask:"#1c1a16" } },
  { id:"tree_swallow", name:"Tree Swallow", area:"wetland", rarity:"uncommon", points:4,
    foods:["seed"], season:[0,1], desc:"Iridescent blue-green above, snow-white below, swooping over the water.",
    shape:{ size:0.86 },
    palette:{ body:"#2f6f8f", belly:"#f2efe6", wing:"#245a76", tail:"#1f4a64", beak:"#2b2b2b", eye:"#100d0a",
      head:"#2f6f8f" } },
  { id:"belted_kingfisher", name:"Belted Kingfisher", area:"wetland", rarity:"rare", points:9,
    foods:["seed"], rainLover:true, desc:"A shaggy-crested, big-billed angler that rattles as it patrols the shore.",
    shape:{ size:1.08, crest:true },
    palette:{ body:"#5f88a0", belly:"#f2efe6", wing:"#4d7488", tail:"#3f6072", beak:"#2b2b2b", eye:"#100d0a",
      head:"#5f88a0", bib:"#5f88a0" } },
  { id:"great_blue_heron", name:"Great Blue Heron", area:"wetland", rarity:"legendary", points:18,
    foods:["seed"], rainLover:true, desc:"Statuesque and patient, a slate-blue giant stalking the shallows.",
    shape:{ size:1.3, crest:true },
    palette:{ body:"#7a8a9a", belly:"#d3dae0", wing:"#647483", tail:"#536270", beak:"#d8b24a", eye:"#d8d24a",
      head:"#9aa6b2", cap:"#1c1a16" } },

  /* ============ ALPINE HEIGHTS (mountain) ============ */
  { id:"mountain_chickadee", name:"Mountain Chickadee", area:"mountain", rarity:"common", points:3,
    foods:["suet","seed"], desc:"A perky highland cousin of the chickadee with a white eyebrow stripe.",
    shape:{ size:0.78, little:true },
    palette:{ body:"#b7b3a8", belly:"#f3f0e8", wing:"#8f8c84", tail:"#7d7a72", beak:"#26241f", eye:"#100d0a",
      head:"#ffffff", cap:"#2a2823", cheek:"#ffffff" } },
  { id:"oregon_junco", name:"Oregon Junco", area:"mountain", rarity:"common", points:2,
    foods:["seed"], season:[2,3], desc:"A handsome junco with a dark hood, warm brown back and buffy sides.",
    shape:{ size:0.9 },
    palette:{ body:"#7a6a5a", belly:"#e8e0d2", wing:"#6a5a4a", tail:"#3f3f47", beak:"#e7b3b3", eye:"#120f0c",
      head:"#3a3340" } },
  { id:"stellers_jay", name:"Steller's Jay", area:"mountain", rarity:"uncommon", points:6,
    foods:["seed","suet"], desc:"A deep-blue, charcoal-hooded jay with a tall, jaunty crest.",
    shape:{ size:1.1, crest:true },
    palette:{ body:"#2f5aa0", belly:"#2f5aa0", wing:"#244a86", tail:"#1f3f72", beak:"#1c1a16", eye:"#100d0a",
      head:"#1c1a16" } },
  { id:"clarks_nutcracker", name:"Clark's Nutcracker", area:"mountain", rarity:"uncommon", points:5,
    foods:["seed","suet"], desc:"Ash-grey with crisp black-and-white wings, a clever cacher of pine seeds.",
    shape:{ size:1.04 },
    palette:{ body:"#9a9aa1", belly:"#b8b8bd", wing:"#1c1a16", tail:"#1c1a16", beak:"#2b2b2b", eye:"#100d0a",
      head:"#a6a6ad" } },
  { id:"mountain_bluebird", name:"Mountain Bluebird", area:"mountain", rarity:"uncommon", points:5,
    foods:["fruit","seed"], desc:"Turquoise sky given wings — the softest blue imaginable.",
    shape:{ size:0.9 },
    palette:{ body:"#4f9fd6", belly:"#a9d2ec", wing:"#3f8ac0", tail:"#357aac", beak:"#2b2b2b", eye:"#100d0a",
      head:"#4f9fd6" } },
  { id:"pine_grosbeak", name:"Pine Grosbeak", area:"mountain", rarity:"rare", points:8,
    foods:["seed","fruit"], season:[3], desc:"A plump, rosy-red finch of the cold conifers, gentle and unhurried.",
    shape:{ size:1.02, plump:true },
    palette:{ body:"#c0566a", belly:"#9a9aa1", wing:"#6a6a72", tail:"#54545c", beak:"#2b2b2b", eye:"#100d0a",
      head:"#c0566a" } },
  { id:"gray_crowned_rosy_finch", name:"Gray-crowned Rosy-Finch", area:"mountain", rarity:"rare", points:9,
    foods:["nyjer","seed"], season:[3], desc:"A hardy alpine wanderer, brown and frosted with rosy pink.",
    shape:{ size:0.9 },
    palette:{ body:"#7a5a44", belly:"#b3766a", wing:"#684a36", tail:"#553c2b", beak:"#2b2b2b", eye:"#120f0c",
      head:"#6a4f3c", cap:"#9a9aa1" } },
  { id:"golden_eagle", name:"Golden Eagle", area:"mountain", rarity:"legendary", points:22,
    foods:["seed"], desc:"Master of the high crags — dark, regal, and crowned with golden nape feathers.",
    shape:{ size:1.34 },
    palette:{ body:"#4a3826", belly:"#5a4630", wing:"#3a2c1c", tail:"#33271a", beak:"#d8b24a", eye:"#e0c24a",
      head:"#7a6240", cap:"#9a7a48" } },
];

/* Areas — only the suburb is playable for now; the rest are
   teasers for future updates. */
const AREAS = [
  { id:"suburb",  name:"Suburban Backyard", emoji:"🏡", cost:0,
    blurb:"Hedges, fences and a friendly mix of neighborhood songbirds." },
  { id:"forest",  name:"Whispering Woodland", emoji:"🌲", cost:2500,
    blurb:"Woodpeckers, warblers and shy thrushes in the dappled shade." },
  { id:"wetland", name:"Reedy Wetland",       emoji:"🪷", cost:25000,
    blurb:"Blackbirds, kingfishers and a great heron along the cattails." },
  { id:"mountain",name:"Alpine Heights",      emoji:"⛰️", cost:200000,
    blurb:"Jays, nutcrackers and rosy-finches on the cold high slopes." },
];

const BIRDS_BY_ID = Object.fromEntries(BIRDS.map(b => [b.id, b]));

/* Weighted pool for a given area, using rarity weights. */
function spawnPoolForArea(areaId){
  return BIRDS
    .filter(b => b.area === areaId)
    .map(b => ({ bird:b, weight: RARITY[b.rarity].weight }));
}

/* Expose to other scripts (plain globals; no modules so it runs from file://). */
window.BIRDS = BIRDS;
window.BIRDS_BY_ID = BIRDS_BY_ID;
window.RARITY = RARITY;
window.AREAS = AREAS;
window.spawnPoolForArea = spawnPoolForArea;
