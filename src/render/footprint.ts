// Finding where a building stands in an image, so art doesn't have to be
// lined up with a footprint template by hand.
//
// Template-aligned art (the base on the template's diamond) is read directly.
// Anything else is measured from its outline: walking up from the lowest point,
// the left and right edges of the base climb at the isometric 2:1 slope until
// they reach the base's side corners, where the walls go straight up.

export interface BaseFit {
  /** Anchor: the base's lowest corner, in image pixels. */
  ax: number;
  ay: number;
  /** Image pixels per tile width. */
  tilePx: number;
  /** How it was found. */
  method: 'template' | 'outline';
}

const TEMPLATE = { width: 1024, diamond: 720, bottom: 112 };
const SOLID = 200;

/**
 * alpha: one byte per pixel (row-major), w × h. tilesW and tilesH are the
 * footprint in tiles along the image's right edge (w) and left edge (h).
 */
export function fitBase(alpha: ArrayLike<number>, W: number, H: number, tilesW: number, tilesH: number): BaseFit {
  const solid = (x: number, y: number) => alpha[y * W + x] > SOLID;
  const rowSpan = (y: number): [number, number] | null => {
    let l = -1;
    let r = -1;
    for (let x = 0; x < W; x++) if (solid(x, y)) { if (l < 0) l = x; r = x; }
    return l < 0 ? null : [l, r];
  };
  let by = -1;
  for (let y = H - 1; y >= 0; y--) {
    const s = rowSpan(y);
    if (s && s[1] - s[0] >= 2) { by = y; break; }
  }
  const k = W / TEMPLATE.width;
  const tplBottom = H - TEMPLATE.bottom * k;
  const tplTile = (TEMPLATE.diamond * k) / Math.max(tilesW, tilesH);
  if (by < 0) return { ax: W / 2, ay: tplBottom, tilePx: tplTile, method: 'template' };

  // Profiles of the outline, from the lowest point upward.
  const top = Math.max(0, by - Math.floor(H * 0.75));
  const L: number[] = [];
  const R: number[] = [];
  for (let y = by; y >= top; y--) {
    const s = rowSpan(y);
    L.push(s ? s[0] : NaN);
    R.push(s ? s[1] : NaN);
  }
  // Walk up an edge while it keeps moving outward at about 2 px per row;
  // the corner is where it stops (the wall goes straight up).
  const corner = (P: number[], dir: -1 | 1): { x: number; up: number } => {
    const win = 14;
    let best = { x: P[0], up: 0 };
    for (let i = 4; i + win < P.length; i++) {
      const a = P[i];
      const b = P[i + win];
      if (Number.isNaN(a) || Number.isNaN(b)) continue;
      const moved = (b - a) * dir;
      const travelled = (a - P[0]) * dir;
      if (travelled > 30 && moved < win * 0.45) return { x: a, up: i };
      best = { x: a, up: i };
    }
    return best;
  };
  const lc = corner(L, -1);
  const rc = corner(R, 1);
  const yl = by - lc.up;
  const yr = by - rc.up;
  // The lowest corner is where the two base edges (slope 1:2) meet.
  const ax = (lc.x + rc.x) / 2 + (yr - yl);
  const ay = yl + (ax - lc.x) / 2;
  // The edge running to the left corner spans the footprint's width (w); the
  // edge running to the right corner spans its depth (h).
  const fromLeft = (2 * (ax - lc.x)) / tilesW;
  const fromRight = (2 * (rc.x - ax)) / tilesH;
  const tilePx = (fromLeft + fromRight) / 2;

  // If it's sitting where the template puts it, trust the template.
  const tplLeft = W / 2 - (TEMPLATE.diamond * k) / 2;
  if (Math.abs(ay - tplBottom) < 10 * k && Math.abs(lc.x - tplLeft) < 30 * k) {
    return { ax: W / 2, ay: tplBottom, tilePx: tplTile, method: 'template' };
  }
  return { ax, ay, tilePx, method: 'outline' };
}
