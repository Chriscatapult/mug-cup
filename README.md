# The Mug Cup

Dice football, the way it was played on the bedroom floor.

Write the slips, fold them into the mug, draw the ties, roll the dice.
One die per team: **1 to 5 is goals, a 6 is nil**. Level in a knockout tie?
Extra dice until somebody blinks. League and group games can finish level.

## What's in it

- **Quick draw**: 64 slips. This season's Champions League line-up, Celtic and
  Rangers, and the rest at random from everywhere. Straight knockout.
- **Cup mode**: ready-made cups (Mug Cup, World Cup, Old FA Cup, European Cup,
  Champions League, a league season, The Marathon) or a designer for your own:
  groups or knockouts, one game or home and away, replays, away goals, late
  entrants, as many stages as you like.
- **Season mode**: 16 made-up regions (or 8, or 4), each with four shelves of
  eight: the Top Shelf, the Second Shelf, the Bottom Drawer and Under the Bed.
  Home and away, 14 games, two up and two down. A regional cup for every club in
  the region. Then the summer: the top two from each Top Shelf play the World
  Championship (groups, then knockout), third and fourth play the World Shield,
  and the regional cup winners play the World Cup Winners' Cup. Then the next
  season starts with everyone where they finished.
- **Tension**: after the first die lands, it tells you what the second die
  needs ("A 4 or 5 and Albion Rovers are through. A 3 and it's extra dice.").
  Finals, deciding legs, replays and the last days of a tight league slow right
  down, with a crowd that builds while you hold the die.
- **By hand**: press and hold the mug to rummage, let go to pull a slip, or tip
  a handful onto the carpet and pick one. Press and hold a die to shake it, let
  go to throw. Shortcuts (Space, R, A, T, N) are there if you want them.
- **The book, the wallchart, the almanac**: every result, every table, every
  scorer, all-time records for every club, head-to-heads, how the dice have
  really behaved, and an honours board.
- **Tear out the page**: a picture of the winner's page, or your club's season,
  to save or send.

## Dice rules

Pick them in the drawer, or on the cup and season setup pages. Each cup and
season keeps the rules it started with.

- **Classic dice**: one six-sided die each. 1 to 5 is goals, a six is nil.
  Level in a cup tie? Extra dice until somebody blinks.
- **Expanded dice rules**: two ten-sided dice and a 10×10 results card. The red
  (home) die picks the row, the blue (away) die picks the square. Every square
  is 1% of matches. Level in a cup tie? One roll of the green die on the
  penalty card. Three cards:
  - *Higher dice is better*: the standard card (44% home wins, 27% draws,
    29% away wins, about 2.6 goals a game).
  - *Fully random*: the same squares shuffled once per cup or season.
  - *Your own card*: fill in all 100 squares and the penalty card in the drawer.
- **Form** (optional, either rules): a club that has won its last three
  anywhere in the book is in form; lost its last three, out of form.
  Classic: two dice, keep the better (in form) or the worse (out of form).
  Expanded: the form die (four 0s, a 1, a 2) is added to the in-form side, or
  to whoever is facing an out-of-form side. In form against out of form gets
  the big form die (two 0s, three 1s, a 2). Two in form, or two out of form,
  cancel out.

The standard card lives in `src/engine/rules.js` if you want to retune it.

## Running it

`index.html` is the whole game in one file: styles, code and club data all
inside it. Open it straight from your computer, or put it anywhere online.
It's the only file Vercel or GitHub Pages actually needs.

## Putting it online

**Vercel**: import the GitHub repo with framework preset "Other". There is
nothing to build: Vercel just serves `index.html`, which is already the whole
game. (That is why the rebuild command is called `make`, not `build`.) Even if only `index.html`
makes it into the repo, the site works.

**GitHub Pages**: Settings, then Pages, serve from the `main` branch root.

## Changing it

The source lives in `dev.html`, `css/` and `src/`. While working on it:

```
npm install
npm run dev          # then open http://localhost:5173/dev.html
```

When you're happy, rebuild the one-file version and commit it:

```
npm run make         # rewrites index.html from dev.html, css/ and src/
npm test             # plays every ready-made cup and a whole season
```

## Where things are saved

Everything stays in the player's browser. Games and the almanac go in
IndexedDB (a full season is around 600KB, far too much for localStorage);
settings go in localStorage. The drawer has "Save everything to a file" and
"Load a save file" for moving to another device or keeping a backup.

## The data

`data/teams.json` and `data/squads.json` are built from the Transfermarkt
dataset (CC0 1.0) plus two hand-written files:

- `scripts/hand-clubs.txt`: lower leagues, non-league, Wales, Ireland and a
  few clubs the dataset doesn't cover. One slip per line: `tier|Team name|Ground`.
- `scripts/hand-legends.txt`: famous names, past and present, who can pop up and
  score. `Club name:Legend,Legend`.

To rebuild after changing either file, or with a newer dataset, put
`clubs.csv` and `players.csv` in `data-raw/` and run:

```
npm run data
```

The raw CSVs aren't committed (they're about 19MB); only the trimmed JSON is.
Tiers come from squad market value and only decide shocks and "still dreaming".
They never touch the dice.

The quick draw's Champions League clubs are listed in `src/engine/presets.js`
(`QUICK_CORE`). Change them each season.

## The code

```
src/engine/   the rules, with no browser code: dice, matches and scorers,
              cups (competition.js), leagues, seasons, tension lines, almanac
src/ui/       the screens: the mug, the dice, cup mode, season mode, book,
              almanac, drawer, wallchart, share image, sound, saving
src/main.js   start-up, routing, clicks, the hand, keys
dev.html      the page you work on; index.html is built from it
tests/        npm test plays every ready-made cup and a whole season
```

## Licence

Code: MIT. Club and player data: CC0 1.0 (Transfermarkt dataset).
