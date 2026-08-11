export type DonutSlice = {
  key: string;
  startAngle: number;
  endAngle: number;
};

/**
 * Cumulative start/end angles (degrees, clockwise from 12 o'clock) for each
 * share, in the order given. Zero-share entries produce a zero-sweep slice
 * rather than being skipped, so callers can zip the result back against
 * their own entry list by index.
 */
export function layoutDonutSlices(
  entries: { key: string; share: number }[],
): DonutSlice[] {
  let cursor = 0;
  return entries.map((entry) => {
    const sweep = entry.share * 360;
    const slice = { key: entry.key, startAngle: cursor, endAngle: cursor + sweep };
    cursor += sweep;
    return slice;
  });
}

/** Rounded to 3 decimals: an unrounded float can stringify with a different
 * number of digits between the server and client render of the same value
 * (e.g. `21.65154470175959` vs `21.651544701759576`), which React's
 * hydration diff flags as a mismatch even though the underlying value is
 * identical. Fixed precision makes the server and client strings match
 * byte-for-byte, and 3 decimals is far finer than this donut renders. */
function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: round(cx + r * Math.cos(rad)), y: round(cy + r * Math.sin(rad)) };
}

/**
 * SVG path for one donut wedge, gapped from its neighbors by `gapDeg` split
 * evenly off each edge (the surface-gap spacer, drawn as background showing
 * through rather than a stroke - see marks-and-anatomy.md). A slice too thin
 * to survive the gap renders with no gap rather than a negative sweep.
 */
export function donutWedgePath(
  cx: number,
  cy: number,
  innerR: number,
  outerR: number,
  startAngle: number,
  endAngle: number,
  gapDeg: number,
): string {
  const halfGap = Math.min(gapDeg / 2, (endAngle - startAngle) / 2);
  const start = startAngle + halfGap;
  const end = endAngle - halfGap;
  const largeArc = end - start > 180 ? 1 : 0;

  const outerStart = polarToCartesian(cx, cy, outerR, start);
  const outerEnd = polarToCartesian(cx, cy, outerR, end);
  const innerEnd = polarToCartesian(cx, cy, innerR, end);
  const innerStart = polarToCartesian(cx, cy, innerR, start);

  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${outerR} ${outerR} 0 ${largeArc} 1 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerEnd.x} ${innerEnd.y}`,
    `A ${innerR} ${innerR} 0 ${largeArc} 0 ${innerStart.x} ${innerStart.y}`,
    "Z",
  ].join(" ");
}
