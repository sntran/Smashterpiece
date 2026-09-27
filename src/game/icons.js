// The icons of the game. All icons are inline SVG, so the game does not
// load image files.

const LINE = '#3b2a52';
const svg = (body) =>
  `<svg viewBox="0 0 64 64" aria-hidden="true" stroke="${LINE}" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round">${body}</svg>`;

export const ICONS = {
  home: svg(`
    <path d="M10 30 L32 10 L54 30 Z" fill="#ff5d73"/>
    <rect x="16" y="30" width="32" height="24" fill="#ffd35c"/>
    <rect x="27" y="38" width="10" height="16" fill="#8b5cf6"/>`),
  undo: svg(`
    <path d="M22 18 L8 28 L22 38 Z" fill="#4cc9f0"/>
    <path d="M20 28 H38 A14 14 0 0 1 38 56 H26" fill="none" stroke-width="7"/>
    <path d="M20 28 H38 A14 14 0 0 1 38 56 H26" fill="none" stroke="#4cc9f0" stroke-width="3"/>`),
  museum: svg(`
    <path d="M6 22 L32 8 L58 22 Z" fill="#b388ff"/>
    <rect x="8" y="22" width="48" height="5" fill="#fff4d6"/>
    <rect x="12" y="27" width="7" height="20" fill="#fff4d6"/>
    <rect x="28.5" y="27" width="7" height="20" fill="#fff4d6"/>
    <rect x="45" y="27" width="7" height="20" fill="#fff4d6"/>
    <rect x="6" y="47" width="52" height="8" fill="#b388ff"/>`),
  newStone: svg(`
    <path d="M12 24 L32 14 L52 24 L52 46 L32 56 L12 46 Z" fill="#c9c3d6"/>
    <path d="M12 24 L32 34 L52 24 M32 34 V56" fill="none"/>
    <path d="M32 14 L52 24 L32 34 L12 24 Z" fill="#ece7f5"/>
    <path d="M50 4 l3 7 l7 3 l-7 3 l-3 7 l-3 -7 l-7 -3 l7 -3 Z" fill="#ffd35c" stroke-width="2.5"/>`),
  hammer: svg(`
    <rect x="29" y="22" width="8" height="38" rx="3" fill="#ffc94d" transform="rotate(35 33 40)"/>
    <rect x="10" y="8" width="34" height="18" rx="4" fill="#ff5d73" transform="rotate(35 27 17)"/>
    <rect x="10" y="12" width="8" height="10" rx="2" fill="#ffffff" opacity="0.5" stroke="none" transform="rotate(35 27 17)"/>`),
  chisel: svg(`
    <rect x="26" y="4" width="12" height="24" rx="4" fill="#ff9f43" transform="rotate(30 32 32)"/>
    <rect x="28.5" y="28" width="7" height="22" fill="#d7dde8" transform="rotate(30 32 32)"/>
    <path d="M28.5 50 L32 60 L35.5 50 Z" fill="#aeb8c9" transform="rotate(30 32 32)"/>`),
  file: svg(`
    <rect x="27" y="40" width="10" height="20" rx="4" fill="#4ade80" transform="rotate(-35 32 32)"/>
    <rect x="25" y="4" width="14" height="36" rx="3" fill="#cfd6e3" transform="rotate(-35 32 32)"/>
    <path d="M27 10 H37 M27 16 H37 M27 22 H37 M27 28 H37 M27 34 H37" stroke-width="2" transform="rotate(-35 32 32)"/>`),
  trophy: svg(`
    <path d="M18 8 H46 V22 A14 14 0 0 1 18 22 Z" fill="#ffd35c"/>
    <path d="M18 12 H8 A10 10 0 0 0 20 28 M46 12 H56 A10 10 0 0 1 44 28" fill="none"/>
    <rect x="28" y="36" width="8" height="10" fill="#ffd35c"/>
    <rect x="18" y="46" width="28" height="10" rx="3" fill="#ff9f43"/>
    <path d="M32 13 l2 5 l5 0.5 l-4 3.5 l1.5 5 l-4.5 -3 l-4.5 3 l1.5 -5 l-4 -3.5 l5 -0.5 Z" fill="#fff" stroke-width="1.5"/>`),
  ghost: svg(`
    <path d="M14 56 V28 A18 18 0 0 1 50 28 V56 L44 50 L38 56 L32 50 L26 56 L20 50 Z" fill="#aef3ff"/>
    <circle cx="25" cy="28" r="4" fill="${LINE}" stroke="none"/>
    <circle cx="39" cy="28" r="4" fill="${LINE}" stroke="none"/>
    <ellipse cx="32" cy="39" rx="4" ry="5" fill="${LINE}" stroke="none"/>`),
  ghostOff: svg(`
    <path d="M14 56 V28 A18 18 0 0 1 50 28 V56 L44 50 L38 56 L32 50 L26 56 L20 50 Z" fill="#e3e3e3" opacity="0.8"/>
    <path d="M8 8 L56 56" stroke="#ff5d73" stroke-width="7"/>`),
  left: svg(`<path d="M40 8 L14 32 L40 56 Z" fill="#4cc9f0"/>`),
  right: svg(`<path d="M24 8 L50 32 L24 56 Z" fill="#4cc9f0"/>`),
  trash: svg(`
    <rect x="14" y="18" width="36" height="40" rx="4" fill="#ff8fa3"/>
    <rect x="9" y="10" width="46" height="8" rx="3" fill="#ff5d73"/>
    <rect x="25" y="4" width="14" height="6" rx="2" fill="#ff5d73"/>
    <path d="M24 26 V50 M32 26 V50 M40 26 V50" stroke-width="3"/>`),
  check: svg(`<path d="M10 34 L26 50 L54 16" fill="none" stroke="#fff" stroke-width="9"/>`),
  cross: svg(`<path d="M14 14 L50 50 M50 14 L14 50" fill="none" stroke="#fff" stroke-width="9"/>`),
  play: svg(`<path d="M20 8 L54 32 L20 56 Z" fill="#4ade80"/>`),
  soundOn: svg(`
    <path d="M8 24 H20 L34 12 V52 L20 40 H8 Z" fill="#ffd35c"/>
    <path d="M42 22 A12 12 0 0 1 42 42 M48 14 A22 22 0 0 1 48 50" fill="none"/>`),
  soundOff: svg(`
    <path d="M8 24 H20 L34 12 V52 L20 40 H8 Z" fill="#d6d6d6"/>
    <path d="M42 24 L56 40 M56 24 L42 40" stroke="#ff5d73" stroke-width="6"/>`),
  free: svg(`
    <path d="M8 30 L28 20 L48 30 L48 52 L28 62 L8 52 Z" fill="#f4b860"/>
    <path d="M8 30 L28 40 L48 30 M28 40 V62" fill="none"/>
    <path d="M28 20 L48 30 L28 40 L8 30 Z" fill="#ffd9a0"/>
    <rect x="40" y="2" width="8" height="30" rx="3" fill="#ffc94d" transform="rotate(40 44 17)"/>
    <rect x="36" y="0" width="24" height="12" rx="3" fill="#ff5d73" transform="rotate(40 48 6)"/>`),
  challenge: svg(`
    <path d="M12 58 V30 A20 20 0 0 1 52 30 V58 L45 52 L38 58 L32 52 L26 58 L19 52 Z" fill="#aef3ff"/>
    <path d="M32 18 l4 8 l9 1 l-7 6 l2 9 l-8 -5 l-8 5 l2 -9 l-7 -6 l9 -1 Z" fill="#ffd35c" stroke-width="2.5"/>`),
  chest: svg(`
    <path d="M8 28 Q8 12 32 12 Q56 12 56 28 Z" fill="#ff9f43"/>
    <rect x="8" y="28" width="48" height="26" rx="3" fill="#c96f2d"/>
    <rect x="8" y="26" width="48" height="6" fill="#ffd35c"/>
    <rect x="27" y="24" width="10" height="14" rx="2" fill="#ffd35c"/>
    <path d="M14 14 l2 -6 l2 6 M46 10 l2 -6 l2 6" stroke="#ffd35c" stroke-width="3"/>`),
  question: svg(`<circle cx="32" cy="32" r="26" fill="#ffd35c"/><path d="M24 24 A8 8 0 1 1 34 32 Q32 34 32 38" fill="none" stroke-width="6"/><circle cx="32" cy="48" r="3" fill="${LINE}"/>`),
};

export function starSvg(filled) {
  return `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M32 4 l8.5 17.5 l19.5 2.5 l-14 13.5 l3.5 19.5 l-17.5 -9.5 l-17.5 9.5 l3.5 -19.5 l-14 -13.5 l19.5 -2.5 Z" fill="${filled ? '#ffd35c' : '#ffffff55'}" stroke="${LINE}" stroke-width="4" stroke-linejoin="round"/></svg>`;
}

// The shape pictures for the challenge buttons.
export const SHAPE_EMOJI = {
  star: '⭐',
  fish: '🐟',
  heart: '❤️',
  duck: '🦆',
  smiley: '😊',
  rocket: '🚀',
};
