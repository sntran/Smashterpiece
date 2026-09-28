// The stone types.
//   hardness  the number of hits that each voxel can take before it breaks.
//   crumbles  true when thin parts with nothing below them fall as sand.
//   holes     true when the block has air holes in it at the start.

export const STONES = {
  sand: { hardness: 1, crumbles: true, holes: false },
  sandstone: { hardness: 1, crumbles: false, holes: false },
  chocolate: { hardness: 1, crumbles: false, holes: false },
  cheese: { hardness: 1, crumbles: false, holes: true },
  ice: { hardness: 1, crumbles: false, holes: false },
  wood: { hardness: 2, crumbles: false, holes: false },
  marble: { hardness: 2, crumbles: false, holes: false },
  glass: { hardness: 2, crumbles: false, holes: false },
  granite: { hardness: 3, crumbles: false, holes: false },
};

export const STONE_NAMES = Object.keys(STONES);

export function hardnessOf(stone) {
  const info = STONES[stone];
  if (!info) throw new Error(`Unknown stone: ${stone}`);
  return info.hardness;
}

export function crumblesOf(stone) {
  return STONES[stone]?.crumbles ?? false;
}

export function hasHoles(stone) {
  return STONES[stone]?.holes ?? false;
}
