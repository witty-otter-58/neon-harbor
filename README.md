# Neon Harbor

[![make.fun bounty](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/witty-otter-58/neon-harbor/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/witty-otter-58/neon-harbor/reward.svg)](https://make.fun/bounty/gta6-01)

An original top-down open-world crime game, built by an AI agent for
make.fun's "Make GTA 6" bounty, $1,666 in USDC. No Rockstar names,
characters, art, music or maps — the city, the story and the people in it
are all invented here.

## The story

Juno Reyes drives for whoever pays. Tonight the job is simple: pick up a
package at the docks, deliver it to The Lantern club — and when the harbor
police turn the whole city against her, lose them and get home. Three
missions, then the whole harbor is yours to roam.

## The city

A 2400×1800 harbor city: four avenues crossed by three streets, blocks of
seeded buildings with a darker roof edge for a 2.5D feel, the docks along
the south edge, The Lantern club in the north-east, a hospital in the west
and a safehouse near the middle. Twelve traffic cars loop the roads and
twenty pedestrians walk the sidewalks — and step aside when a car bears
down on them at speed.

## How it plays

- **On foot:** WASD / arrows to walk, mouse to aim, click to shoot the
  pistol (12-round magazine, auto reload), E to enter or exit the nearest
  car, R to reload.
- **Driving:** WASD to accelerate, brake and reverse; steering bites less
  at high speed and never less than a third at low speed, so a car that has
  bumped a wall can still turn away. Buildings slow and stop a car;
  running over a pedestrian is a crime.
- **Wanted, 0–5 stars:** stealing a car +1, hitting a pedestrian +1,
  shooting near police +1. Police cars spawn at wanted ≥ 1 and chase and
  ram; on foot an officer walks up to you — if one touches you, BUSTED:
  lose $200 and wake up at the hospital, wanted 0. Health 0: WASTED, same
  respawn. Wanted decays one star per 12 seconds with no new crime and no
  police within 300 px.
- **Missions:** 1. The Pickup — collect the glowing package at the docks
  ($200). 2. The Delivery — carry it to The Lantern within 90 seconds
  ($500). 3. The Getaway — wanted jumps to 3 stars; lose the cops, then
  reach the safehouse ($1000). Then free roam, with a replay option (R).
- **HUD:** health bar, money, wanted stars, ammo, the current objective,
  and a minimap showing roads, the player, the mission marker, police and
  traffic.
- **Pickups:** health at the hospital, ammo crates at four fixed spots.
- **Save:** money, mission and position persist in localStorage.
- **Sound:** WebAudio synthesis only — gunshot, siren, pickup blip,
  engine hum, mission jingle. No audio files.
- **Screens:** title (story intro + controls + Start / Continue), pause
  (P), busted, wasted, and a mission-complete toast.

## Run it

Static files, no build step, no network requests — it plays offline in a
desktop browser:

```sh
node serve.ts
# open http://localhost:8080
```

## Files

| File | Job |
| --- | --- |
| `game/index.html` | Page shell, canvas, HUD and overlays |
| `game/src/config.js` | Tuning: world, car, police, rewards |
| `game/src/random.js` | Seeded RNG for the city and traffic |
| `game/src/audio.js` | WebAudio synth sounds |
| `game/src/city.js` | Roads, buildings and landmarks |
| `game/src/world.js` | State, player, cars, pedestrians, police, wanted, missions |
| `game/src/render.js` | Canvas drawing: city, cars, HUD, minimap |
| `game/src/input.js` | Keyboard and mouse, plus the autopilot |
| `game/src/shots.js` | Screenshot staging (`?shot=title\|drive\|chase\|mission`) |
| `game/src/main.js` | Game loop and phase wiring |
| `main.ts` | Handover: copies `game/` + `screenshots/` and writes `dossier.json` |

## Verified

- Headless Node simulation: the autopilot completes all three missions on
  8 of 8 seeds (55–79 s, $1700), and a parked no-input run ends BUSTED
  (on foot, 4.9 s) or WASTED (in a car, 76.4 s) — the game is winnable
  and losable.
- Four screenshots, 1280×800 JPEG, each under 256 KiB, zero console or
  page errors.
