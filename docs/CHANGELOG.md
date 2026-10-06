# Changelog

How Light Handler's design changed during TGC GameJam 2026, newest first. Each version is a set of design notes written by the team and then built; the notes are kept here in the team's own terms, tidied for spelling. The current design in full is in [DESIGN.md](DESIGN.md).


## v3.1

- Fixed bugs

## v3

- **Art upgrade.** The square felt like basic pixel art: it should feel lived-in and humane, like Rain World, Eastward or Dead Cells, with imperfections and more detail everywhere, not post-processing.
- **Weathering** on every building and stone: damp, streaks under the sills, soot, posters, ivy, down-pipes, curtains and plants in the windows, moss and aerials on the roofs, dirt and grass against the walls, worn paths, litter, a chalk hopscotch. Each era wears differently; the ending is the most lived-in. Nothing that looks like a crack, so the secrets stay fair.
- **Motion:** smoke from the chimneys, spray from the fountain, steam from the grates, breathing lamps, neon signs that stutter. Nothing that flies, so nothing is mistaken for a bat.
- **Light:** long lamp shadows, sun through the gaps in Golden, lamp pools in Retro.
- **Screen effects only where they make sense:** grain and vignette in Retro only, paper in Manga and on the cover. A light colour grade for every era, a glow round the neon in Cyberpunk, a few particles in the air.
- **Pause is P, not Esc:** Esc left fullscreen and paused the game at the same time. Settings on the cover open and close with S.

## v2.6

- **Boss buff** Phase-change lasts 2 seconds now. Invulnerability 1 second after phase-change.

## v2.5

- **Boss still too hard.** Three attacks between phase changes, and the phase-change warning lasts 3 seconds. Boss health reduced by 10%.
- **God mode** in Settings, giving unlimited health.
- **Armour class** health reduced by 15%.
- **Rays:** White damage raised to 16. UV stun raised to 0.2 seconds. Green damage raised to 11 (uncharged) to 16 (fully charged).

## v2.4

- **Boss too hard.** New enemy cap of 4 beside the boss; the boss spawns 2 with every phase change.
- **Boss fight 20% shorter.**
- **Reverted from v2.3:** a phase change affects the machine again. Each phase has only that era's weapon rules.
- **Boss health bar.**

## v2.3

- **Boss company capped:** at most 3 per phase change, 5 in total (with 4 on screen, a phase change spawns 1).
- **All three weapon types** (colour wheel, White, UV) available throughout the boss fight. *Taken back in v2.4.*
- **Collision physics fixed:** it was janky.
- **More armour enemies:** they were almost absent in a normal playthrough; the Golem was never seen.
- **Blue** is strong against swarms, and its damage is raised to 16.
- **Pause screen as a comic book.** Left page: all the eras arranged like comic panels. Right page: controls, pages inked, guide pages and secrets found. Then the Field Guide, the machine, and settings with a button to exit to the home screen, each across both pages. Page-turn animation. Its own comic fonts and colours.

## v2.2

- **Green charge:** uncharged, three attacks to kill and a very short distance; fully charged, two attacks to kill and a long distance.
- **White** ring radius reduced by 20%.
- **UV cone** stuns all enemies for 0.1 seconds.
- **Field Guide** shows every monster's weakness, in demo mode only.
- **Weapon guide** explaining every ray and exactly what it does. In demo mode it shows which enemies each ray is strong against.

## v2.1

- **Green blob** dealt too much damage: half the damage, half the area, but the area lasts much longer (6 to 8 seconds).
- **Pages named after eras:** Cyberpunk Era, Retro Era, Manga Era.
- **Ghosts invulnerable** until revealed by the UV cone; the same for the boss in its Retro phase.
- **Boss spawns mobs** with each phase change, one more every time. *Changed to a fixed number in v2.3 and v2.4.*
- **Golden Era on a 2-minute timer** too: waves keep spawning until the timer runs out.
- **Demo mode** unlocks all levels even in the middle of a game.
- **Manga Era** mob spawn rate doubled.
- **Boss phase-change warning** reduced to 2 seconds. *Raised to 3 in v2.5.*

## v2

The redesign. The first version (three levels of three rooms, four radiation types) was replaced by this.

**Weapon.** The EMW Machine has a colour wheel at the bottom right, turned with a key, and a key to switch between RGB mode, UV mode and Unprism mode.

1. **Blue ray:** a cone in front that damages all enemies at 1x (good against swarms).
2. **Red ray:** a laser in a straight line, high damage up close, dropping off with distance (weaker than Blue at full range, strongest at close range); 1.5x against armour.
3. **Green ray:** a charged blob that slows everything it touches; 2x against speed enemies.
4. **White ray:** a 360 degree pushback of enemies and projectiles; 1.5x against swarm and projectile enemies, 0.25x against others.
5. **UV rays:** a cone that reveals stealth enemies and halves their health; no damage to others.

**Enemies.**

1. **Swarm:** slimes and bats (bats fly over obstacles), and rats that follow the player.
2. **Armour:** the Ironclad, and a slow rolling Golem that blocks rays from reaching other enemies.
3. **Speed:** a zig-zag bat, and an enemy that dashes away after being damaged, forcing a re-aim.
4. **Stealth:** ghosts, and more aggressive ghosts.
5. **Projectile:** a snowman whose snow leaves ice on the floor and slows the player, and a slime that throws acid and poisons the floor.
6. **Boss, the Prism:** simple dashes, then an attack that changes the comic style of the screen and how the weapon works, announced over its head a few seconds before.

**One city square** common to all levels, detailed with buildings.

1. **Golden Era:** highly detailed city in bright sunshine; bright monsters; swarm and armour enemies; the player has Red, Blue and Green.
2. **Cyberpunk Era:** enemies spawn continuously from the entries; dusk and neon, fewer details; speed enemies; Blue is taken away; a dash with a 3-second cooldown.
3. **Retro Era:** many enemies spawning continuously; darker and duller; stealth enemies; the machine in overdrive (twice as fast, twice the damage, twice the energy use) with the wheel locked to a colour that changes every few seconds; a double dash with a 5-second cooldown; the UV lens.
4. **Manga Era:** many projectile enemies, like a bullet hell; black and white with very little detail; the machine locked to white light.
5. **Boss Era.**

The twist stays at the end. The details fall away because the Handler has schizophrenia and it is getting worse, so he sees less detail and colour each level. Art at 16-bit quality, like Stardew Valley or Chrono Trigger.

**Chosen when planning v2:** double-resolution art; timed eras end on a survive timer; Field Guide, pause page map, hidden secrets, hearts and the hidden mercy heart kept; a Settings page with a demo mode; secrets hidden behind cracked walls only.

## v1

The first complete build, from the team's proposal ([proposal.pdf](proposal.pdf)).

- Top-down action game in the style of the early Zelda games, in the browser, built with Phaser 4.
- Three levels of three rooms each (Golden Age, Noir, Manga) and a boss, on a tile grid.
- Four radiation types: Radio, Infrared, Ultraviolet, Gamma. Five monsters: Swarmlet, Frostling, Shade, Ironclad, the Prism.
- A chest after the first room of each level gave the next radiation type. One secret per level.
- Health as 20 blocks in two rows of ten.
- **The twist, set by the team:** the Light Handler has schizophrenia; he has been shining a torch at random people and is arrested for causing mild annoyance to the public.
- Pixel art defined in code and music synthesised at runtime, so the game ships no image or audio files.
