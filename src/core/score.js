// The match score between the stone and the ghost shape. This module does
// not use three.js or the DOM.

import { EMPTY, PEDESTAL } from './grid.js';

// The score limits for 2 and 3 stars. The player always gets 1 star.
export const STAR_LIMITS = [0.55, 0.8];
// The player can finish when the score is at this value or more.
export const FINISH_LIMIT = 0.3;
// The limits for the easy challenges.
export const EASY_STAR_LIMITS = [0.4, 0.65];
export const EASY_FINISH_LIMIT = 0.2;

// Return { finish, stars } for the normal or the easy challenges.
export function limitsFor(easy = false) {
  return easy ? { finish: EASY_FINISH_LIMIT, stars: EASY_STAR_LIMITS } : { finish: FINISH_LIMIT, stars: STAR_LIMITS };
}

// Count the stone voxels that are out of the ghost shape.
export function countOutside(grid, ghostMask) {
  let n = 0;
  const cells = grid.cells;
  for (let i = 0; i < cells.length; i++) {
    const v = cells[i];
    if (v !== EMPTY && v !== PEDESTAL && !ghostMask[i]) n++;
  }
  return n;
}

// Calculate the match.
//   keep:  the part of the ghost shape that is still stone (0 to 1).
//   clear: the part of the unwanted stone that the player removed (0 to 1).
//   score: keep * clear (0 to 1).
// `outsideAtStart` is countOutside() for the block at the start.
export function matchScore(grid, ghostMask, outsideAtStart, easy = false) {
  let ghostTotal = 0;
  let kept = 0;
  let outside = 0;
  const cells = grid.cells;
  for (let i = 0; i < cells.length; i++) {
    const v = cells[i];
    const stone = v !== EMPTY && v !== PEDESTAL;
    if (ghostMask[i]) {
      ghostTotal++;
      if (stone) kept++;
    } else if (stone) {
      outside++;
    }
  }
  const keep = ghostTotal > 0 ? kept / ghostTotal : 0;
  const clear = outsideAtStart > 0 ? Math.max(0, 1 - outside / outsideAtStart) : 1;
  const score = keep * clear;
  return { keep, clear, score, stars: starsFor(score, easy) };
}

// Give 1, 2, or 3 stars for a score.
export function starsFor(score, easy = false) {
  const limits = limitsFor(easy).stars;
  if (score >= limits[1]) return 3;
  if (score >= limits[0]) return 2;
  return 1;
}
