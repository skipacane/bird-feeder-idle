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
];

/* Areas — only the suburb is playable for now; the rest are
   teasers for future updates. */
const AREAS = [
  { id:"suburb",  name:"Suburban Backyard", emoji:"🏡", unlocked:true,
    blurb:"Hedges, fences and a friendly mix of neighborhood songbirds." },
  { id:"forest",  name:"Whispering Woodland", emoji:"🌲", unlocked:false,
    blurb:"Woodpeckers, warblers and shy thrushes in the dappled shade." },
  { id:"wetland", name:"Reedy Wetland",       emoji:"🪷", unlocked:false,
    blurb:"Red-winged blackbirds and herons along the cattails." },
  { id:"mountain",name:"Alpine Heights",      emoji:"⛰️", unlocked:false,
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
