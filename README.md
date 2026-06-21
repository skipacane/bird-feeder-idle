# 🐦 Backyard Birds — a cozy pixel-art bird-feeder idle

A relaxing 2D idle game about tending a feeder and discovering the birds of your
neighborhood. Inspired by the calm, collect-the-birds spirit of **Wingspan** and the
warm **Stardew Valley** pixel aesthetic. The scene fills the whole screen and
everything — birds, feeder, the suburban world and UI — is drawn procedurally as
**pixel art** (a low-res 480×270 canvas scaled up with nearest-neighbour), so there
are **no external assets to download**.

## ▶️ How to play

Just open **`index.html`** in any modern browser (Chrome, Edge, Firefox).
No build step, no server, no installs. Your progress saves automatically to the
browser (localStorage) and keeps earning gently while you're away once you hire help.

A cozy **ambient soundscape** (a soft breeze with occasional birdsong) is generated
live with WebAudio — toggle it with the 🔊 button. The game also **keeps running in
the background**: minimise or switch tabs and your helpers keep working; anything they
earn is credited (and announced) when you return.

### Controls
- **Scatter Seed** button / **Spacebar** / **click the feeder** — add seed to the tray.
- **🛠️ Shop** button — spend Bird Points on upgrades.
- **📖 Birds** button — your collection; click a discovered bird for its species card.
- **🗺️ Areas** button — habitats to unlock (more coming!).
- **🔊 / 🔇** — toggle all sound (effects + ambient). **Esc** — close any open menu.

## 🎮 The core loop

| Rule | How it works in game |
|------|----------------------|
| Start with one basic feeder | A pole-mounted hopper feeder in a suburban backyard. |
| Birds visit the feeder | Local songbirds fly in on a timer and land on the perches. |
| A satisfied bird → **Bird Points** | If there's **seed**, the bird eats, is happy 💛, and you earn points. |
| No food → **disappointed bird** | An empty feeder makes the bird sad 💧 and you lose a few points. |
| Feeders have a food limit | The tray/hopper holds a limited amount of seed (upgradeable). |
| Automate the filling | Hire **Helpers** who top up the feeder for you — true idle play. |
| Bird index / collection | Every new species to **arrive** is added to your illustrated index. |

## 🐤 Starting area — *Suburban Backyard* (12 species)

Common → Uncommon → Rare → Legendary, each with hand-tuned colors, markings and
point values:

House Sparrow · House Finch · Dark-eyed Junco · American Robin ·
Black-capped Chickadee · Tufted Titmouse · White-breasted Nuthatch ·
American Goldfinch · Mourning Dove · Northern Cardinal · Blue Jay ·
**Rose-breasted Grosbeak** (legendary).

## 🛠️ Upgrades

- **Bigger Tray** — more seed capacity.
- **Bird Bath** — birds visit more often.
- **Hire a Helper** — auto-fills the feeder (stacks).
- **Seed Scoops** — helpers refill faster.
- **Premium Seed** — more points per happy visit.

## 🗺️ Roadmap (future areas)

The framework already supports multiple areas, feeders and bird sets. Next up:
**Whispering Woodland** 🌲, **Reedy Wetland** 🪷 and **Alpine Heights** ⛰️ — each with
their own species, scenery and feeder types.

## 📁 Project structure

```
bird-feeder-idle/
├── index.html        # layout: HUD, canvas stage, side panel
├── css/style.css     # cozy woodland theme
└── js/
    ├── birds.js      # species data (palettes, rarity, points) + areas
    ├── sprites.js    # procedural art: birds, feeder, suburb scene, animations
    └── game.js       # game loop, economy, spawning, automation, UI, save
```
