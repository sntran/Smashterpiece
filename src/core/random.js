// A small random number generator with a seed. This module does not use
// three.js or the DOM. The same seed always gives the same numbers, so
// the tests can check the results.

// Return a function that gives numbers from 0 (included) to 1 (not included).
export function makeRandom(seed = 1) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Return a random integer from min to max (both included).
export function randomInt(rand, min, max) {
  return min + Math.floor(rand() * (max - min + 1));
}
