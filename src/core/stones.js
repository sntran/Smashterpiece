// The stone types. The hardness is the number of hits that each voxel
// can take before it breaks.

export const STONES = {
  sandstone: { hardness: 1 },
  marble: { hardness: 2 },
  granite: { hardness: 3 },
};

export const STONE_NAMES = Object.keys(STONES);

export function hardnessOf(stone) {
  const info = STONES[stone];
  if (!info) throw new Error(`Unknown stone: ${stone}`);
  return info.hardness;
}
