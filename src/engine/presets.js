// Ready-made cup competitions, and the quick draw.
export const PRESETS = [
  { id: 'mug', name: 'The Mug Cup', size: 64, desc: "Straight knockout, one game, extra dice if it's level. The original.",
    stages: [{ type: 'ko', legs: 1, level: 'dice', until: 1 }] },
  { id: 'world', name: 'The World Cup', size: 32, desc: 'Groups of four, top two through, then a knockout.',
    stages: [{ type: 'groups', gsize: 4, legs: 1, adv: 2, pts: 3 }, { type: 'ko', legs: 1, level: 'dice', until: 1 }] },
  { id: 'facup', name: 'The Old FA Cup', size: 'all', desc: "Everyone in, replays if it's level, and the big clubs don't join until the minnows have been thinned out.",
    stages: [{ type: 'ko', legs: 1, level: 'replay', until: 'fit' }, { type: 'ko', legs: 1, level: 'replay', until: 1, join: [1, 2] }] },
  { id: 'euro', name: 'The European Cup', size: 32, desc: 'Two-legged knockout from the first round. Away goals, and a one-off final.',
    stages: [{ type: 'ko', legs: 2, level: 'away', final1: true, until: 1 }] },
  { id: 'cl', name: 'The Champions League', size: 32, desc: 'Groups of four home and away, then two-legged knockouts and a one-off final.',
    stages: [{ type: 'groups', gsize: 4, legs: 2, adv: 2, pts: 3 }, { type: 'ko', legs: 2, level: 'away', final1: true, until: 1 }] },
  { id: 'league', name: 'A League Season', size: 20, desc: 'One big league. Everyone plays everyone home and away. Top of the table takes it.',
    stages: [{ type: 'groups', gsize: 0, legs: 2, adv: 1, pts: 3 }] },
  { id: 'marathon', name: 'The Marathon', size: 'all', desc: 'Everyone in. Groups home and away, a replay-riddled cup, more groups, then two-legged knockouts. Clear your diary.',
    stages: [{ type: 'groups', gsize: 4, legs: 2, adv: 2, pts: 3 }, { type: 'ko', legs: 1, level: 'replay', until: 32 }, { type: 'groups', gsize: 4, legs: 2, adv: 2, pts: 3 }, { type: 'ko', legs: 2, level: 'away', final1: true, until: 1 }] },
];

// This season's Champions League line-up (2026–27 league phase), plus Celtic and Rangers.
// These are always in the quick draw; the rest of the 64 come out of the whole mug at random.
export const QUICK_CORE = [
  'paris-saint-germain', 'bayern-munich', 'real-madrid', 'liverpool', 'manchester-city', 'inter', 'arsenal', 'barcelona', 'atletico-madrid',
  'borussia-dortmund', 'roma', 'sporting-cp', 'aston-villa', 'porto', 'manchester-united', 'club-brugge', 'real-betis', 'psv-eindhoven',
  'feyenoord', 'lille', 'napoli', 'rb-leipzig', 'villarreal', 'shakhtar-donetsk', 'galatasaray', 'bodo-glimt', 'fenerbahce',
  'slavia-prague', 'stuttgart', 'como-1907', 'lens', 'lask', 'sabah', 'aek-athens', 'viking', 'slovan-bratislava',
  'celtic', 'rangers',
];
export const QUICK_SIZE = 64;
export const QUICK_STAGES = [{ type: 'ko', legs: 1, level: 'dice', until: 1 }];
