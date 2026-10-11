export interface CloudBox { width: number; height: number }
export interface CloudPosition { x: number; y: number }

/** Center-out tag packing with enough vertical space for every word. */
export function packCloudBoxes(boxes: CloudBox[], width: number, initialHeight: number, seed = 0) {
  const margin = width < 640 ? 8 : 20;
  const gapX = width < 640 ? 12 : 16;
  const gapY = width < 640 ? 8 : 12;
  if (boxes.some(box => box.width > width - margin * 2)) {
    throw new Error('Cloud tags must fit within the canvas width');
  }
  const area = boxes.reduce((sum, box) => sum + (box.width + gapX) * (box.height + gapY), 0);
  let height = Math.max(initialHeight, Math.ceil(area / (width - margin * 2)) + 92);
  for (;;) {
    for (let attempt = 0; attempt < 4; attempt++) {
      const positions: CloudPosition[] = [];
      const centerX = width * (width < 640 ? [0.5, 0.46, 0.54, 0.5] : [0.5, 0.55, 0.45, 0.6])[attempt];
      const centerY = height / 2;
      // Follow the stage's shape: wide clouds on landscape, tall ones on portrait.
      const stretchX = width >= height ? Math.max(1.4, width / height) : 1;
      const stretchY = width >= height ? 1 : Math.min(2.2, height / width) * .85;
      const fits = (x: number, y: number, box: CloudBox) =>
        x >= margin && x + box.width <= width - margin && y >= 52 && y + box.height <= height - 40 &&
        positions.every((other, i) =>
          x + box.width + gapX <= other.x || other.x + boxes[i].width + gapX <= x ||
          y + box.height + gapY <= other.y || other.y + boxes[i].height + gapY <= y);
      for (const [index, box] of boxes.entries()) {
        let position: CloudPosition | undefined;
        for (let step = 0; step < 2000; step++) {
          const angle = seed + attempt * 1.7 + index * 2.39996 + step * 2.39996;
          const radius = Math.sqrt(step) * (width < 768 ? 5 : 8);
          const x = centerX + radius * Math.cos(angle) * stretchX - box.width / 2;
          const y = centerY + radius * Math.sin(angle) * stretchY - box.height / 2;
          if (fits(x, y, box)) { position = { x, y }; break; }
        }
        if (!position) {
          search: for (let y = 52; y + box.height <= height - 40; y += 4) {
            for (let x = margin; x + box.width <= width - margin; x += 4) {
              if (fits(x, y, box)) { position = { x, y }; break search; }
            }
          }
        }
        if (!position) break;
        positions.push(position);
      }
      if (positions.length === boxes.length) return { positions, height };
    }
    // Grow the cloud instead of stacking unplaced tags on top of each other.
    height += 80;
  }
}

/** Seeded shuffle so "Reorganizar" gives a new but repeatable order. */
function seededOrder(count: number, seed: number) {
  const order = Array.from({ length: count }, (_, i) => i);
  if (!seed) return order;
  let state = Math.floor(seed * 1000) % 2147483647 || 1;
  const random = () => (state = (state * 16807) % 2147483647) / 2147483647;
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

/**
 * Typographic flow: centered lines of mixed sizes, like a poster. Much denser
 * than a spiral on narrow portrait screens. Returns the height it needs.
 */
export function flowCloudBoxes(boxes: CloudBox[], width: number, initialHeight: number, seed = 0) {
  const margin = 8;
  const gapX = 10;
  const gapY = 4;
  const top = 52;
  const bottom = 12;
  const usable = width - margin * 2;
  if (boxes.some(box => box.width > usable)) {
    throw new Error('Cloud tags must fit within the canvas width');
  }
  // Interleave large and small words so lines have rhythm, then apply the seed.
  const bySize = boxes.map((_, i) => i);
  const mixed: number[] = [];
  for (let lo = 0, hi = bySize.length - 1; lo <= hi; lo++, hi--) {
    mixed.push(bySize[lo]);
    if (lo !== hi) mixed.push(bySize[hi]);
  }
  const order = seededOrder(mixed.length, seed).map(i => mixed[i]);

  const lines: { items: number[]; width: number; height: number }[] = [];
  for (const index of order) {
    const box = boxes[index];
    const line = lines.at(-1);
    if (line && line.width + gapX + box.width <= usable) {
      line.items.push(index);
      line.width += gapX + box.width;
      line.height = Math.max(line.height, box.height);
    } else {
      lines.push({ items: [index], width: box.width, height: box.height });
    }
  }
  const contentHeight = lines.reduce((sum, line) => sum + line.height, 0) + gapY * Math.max(0, lines.length - 1);
  const height = Math.max(initialHeight, contentHeight + top + bottom);
  const positions: CloudPosition[] = new Array(boxes.length);
  let y = top + Math.max(0, (height - top - bottom - contentHeight) / 2);
  for (const line of lines) {
    let x = margin + (usable - line.width) / 2;
    for (const index of line.items) {
      positions[index] = { x, y: y + (line.height - boxes[index].height) / 2 };
      x += boxes[index].width + gapX;
    }
    y += line.height + gapY;
  }
  return { positions, height };
}
