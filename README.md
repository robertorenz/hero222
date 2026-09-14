# H.E.R.O. Revamped

A browser remake of Activision's 1984 classic **H.E.R.O.** (Helicopter Emergency Rescue Operation), built with plain HTML5 canvas. No build step, no dependencies: open `index.html` and play.

The two design goals:

1. **A fixed set of caverns.** Every cavern is a hand-designed grid of screens that never changes, so you can learn the route by heart, exactly like the original.
2. **A built-in cavern editor.** Draw your own caverns with the same tiles and creatures, test-play them instantly, save them in the browser, and share them as JSON.

## Play

Play online: https://claude.ai/code/artifact/0d81be73-8d0e-4fad-a036-a99898d86c94

Source: https://github.com/robertorenz/hero222

Open `index.html` in any modern browser (Chrome, Edge, Firefox, Safari). Touch controls appear automatically on phones and tablets.

| Key | Action |
| --- | --- |
| `←` `→` or `A` `D` | Walk / steer |
| `↑` or `W` | Helicopter pack (hold to fly) |
| `Space` or `Z` | Helmet laser |
| `↓` or `X` | Drop dynamite (only while standing) |
| `P` | Pause |
| `Esc` | Pause menu (restart / quit) |

### Rules

- **Power** drains constantly. Reach the miner before it hits zero.
- **Walls** (brick) are destroyed by dynamite, or by a long laser burn.
- **Lava** and **water** kill on touch. Fly over water or ride a raft.
- **Bats, spiders, moths and snakes** kill on touch. The laser kills them.
- **Lanterns** light the screen. Shoot one by mistake and you fly in the dark.
- Dynamite has a 1.5 second fuse and blasts the tile it sits on, two tiles in each direction and the diagonals. Stand well back.
- Dying returns you to the point where you entered the current screen, with full power and six sticks of dynamite.
- Scoring: 50 per creature, 25 per wall tile, 1000 per rescue plus 10 per unit of power left plus 50 per stick of dynamite left. Extra life every 20,000 points.

## The caverns

| # | Name | Screens | Power |
| --- | --- | --- | --- |
| 1 | Entrance Shaft | 1 × 2 | 60 s |
| 2 | Twin Shafts | 1 × 3 | 75 s |
| 3 | The Crossing | 2 × 3 | 80 s |
| 4 | Lava Gallery | 2 × 4 | 90 s |
| 5 | Deep Water | 2 × 4 | 100 s |
| 6 | Spider Nest | 3 × 3 | 100 s |
| 7 | The Descent | 2 × 5 | 110 s |
| 8 | Magma Core | 3 × 4 | 120 s |

Caverns unlock as you clear them. Progress, best scores and the high score are stored in the browser.

## Cavern editor

Open **Cavern editor** from the top bar.

- Each screen is 20 × 12 tiles. Cyan lines mark screen edges; the view flips when the hero crosses one.
- Click or drag to paint. Right-click erases. Shift-drag (or the *Rectangle drag* option) fills a rectangle. `Ctrl+Z` / `Ctrl+Y` undo and redo. Number keys select tools.
- **Check** verifies the cavern has one start, one miner, and that the miner is reachable.
- **Test play** runs the cavern immediately and returns you to the editor.
- **Save** stores the cavern in the browser; play saved caverns from *Custom caverns* on the main menu.
- **Export / Import** move caverns between browsers as JSON.

### Level format

Levels are plain text maps, one character per tile (see `js/levels.js`):

```
#  rock (indestructible)     .  open air
W  wall (dynamite / laser)   L  lava wall (deadly)
~  water (deadly)
P  player start              M  trapped miner (goal)
b  bat   s  spider   m  moth   n  snake
l  lantern               r  raft (place on the row above water)
```

```js
{
  name: "Entrance Shaft", power: 60, dynamite: 6, sw: 1, sh: 2,
  tip: "Drop down the shaft, then blast through the wall to reach the miner.",
  map: [ "####################", "#..................#", /* 12 rows per screen */ ]
}
```

To add a built-in cavern, append an entry to `HERO_LEVELS` in `js/levels.js`. Rows must be `sw × 20` characters wide and there must be `sh × 12` of them.

## Project layout

```
index.html        page shell (menu, game, editor)
css/style.css     theme and layout
js/levels.js      the eight built-in caverns
js/game.js        engine: parsing, physics, entities, rendering, sound
js/editor.js      cavern editor
js/main.js        menus, modals, storage, wiring
tools/build.js    bundles everything into dist/hero.html (single shareable file)
```

Run `node tools/build.js` to regenerate the single-file build in `dist/`.

## Credits

A tribute to the original game by John Van Ryzin (Activision, 1984). All art, code and caverns here are original.
