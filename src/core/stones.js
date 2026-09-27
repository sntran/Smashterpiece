// The stone types.
//   hardness  the number of hits that each voxel can take before it breaks.
//   crumbles  true when thin parts with nothing below them fall as sand.

export const STONES = {
  sand: { hardness: 1, crumbles: true },
  sandstone: { hardness: 1, crumbles: false },
  marble: { hardness: 2, crumbles: false },
  granite: { hardness: 3, crumbles: false },
  glass: { hardness: 2, crumbles: false },
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
