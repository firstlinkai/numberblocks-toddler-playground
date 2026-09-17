/* Picture data for "Connect the Dots".
 *
 * Each picture is a closed polygon authored by hand in a 0 0 200 200 box, in
 * the exact order a child taps them (dot N connects to dot N+1, and the last
 * dot closes back to the first once the round finishes). Straight segments
 * only - a toddler is joining numbered dots, not tracing a curve, so the
 * artwork is designed around what a polygon can still read as (a star, a
 * heart, a boat) rather than faked with curves.
 *
 * No two dots in a picture may sit closer than MIN_GAP units (see
 * scripts/check-dots.mjs). The boat's mast was authored 16 units wide and its
 * two base dots rendered as one blob a toddler could not tell apart - dots are
 * ~20 units across on screen, so anything under ~26 overlaps.
 *
 * `face` is a single {cx, cy, r} anchor, not per-shape eye/mouth artwork -
 * one face generator (see faceMarkup in the scene) draws every picture's
 * face from that anchor, so a new picture only ever needs new dots.
 */

export const DOT_SHAPES = [
  {
    id: 'star',
    fill: '#fde047',
    stroke: '#d97706',
    face: { cx: 100, cy: 100, r: 24 },
    dots: [
      [100, 15], [120, 72.5], [180.8, 73.7], [132.3, 110.5], [150, 168.8],
      [100, 134], [50, 168.8], [67.7, 110.5], [19.2, 73.7], [80, 72.5]
    ]
  },
  {
    id: 'heart',
    fill: '#fb7185',
    stroke: '#be123c',
    face: { cx: 100, cy: 103, r: 26 },
    dots: [
      [100, 175], [55, 145], [25, 100], [35, 55],
      [100, 80], [165, 55], [175, 100], [145, 145]
    ]
  },
  {
    id: 'fish',
    fill: '#38bdf8',
    stroke: '#0369a1',
    face: { cx: 68, cy: 92, r: 20 },
    dots: [
      [25, 100], [45, 65], [95, 50], [140, 70], [190, 40],
      [150, 100], [190, 160], [140, 130], [95, 150], [45, 135]
    ]
  },
  {
    id: 'boat',
    fill: '#fb923c',
    stroke: '#c2410c',
    face: { cx: 90, cy: 136, r: 20 },
    dots: [
      [24, 148], [176, 148], [152, 110], [116, 110], [116, 28], [76, 110], [48, 110]
    ]
  },
  {
    id: 'cat',
    fill: '#f59e0b',
    stroke: '#92400e',
    face: { cx: 100, cy: 116, r: 30 },
    /* The ears are dots in their own right. An earlier version notched the top
       of a blob between two shoulder points and the finished picture read as a
       lump, not a cat - the payoff has to be recognisable or the counting has
       nothing to pay off with. */
    dots: [
      [100, 184], [46, 160], [22, 112], [16, 26], [64, 52],
      [136, 52], [184, 26], [178, 112], [154, 160]
    ]
  },
  {
    id: 'house',
    fill: '#ef4444',
    stroke: '#991b1b',
    face: { cx: 100, cy: 130, r: 26 },
    dots: [
      [40, 170], [160, 170], [160, 95], [100, 35], [40, 95]
    ]
  }
];
