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
  let height = Math.max(initialHeight, Math.ceil(area / (width - margin * 2) * 1.25) + 92);
  for (;;) {
    for (let attempt = 0; attempt < 4; attempt++) {
      const positions: CloudPosition[] = [];
      const centerX = width * (width < 640 ? [0.5, 0.46, 0.54, 0.5] : [0.5, 0.55, 0.45, 0.6])[attempt];
      const centerY = height / 2;
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
          const x = centerX + radius * Math.cos(angle) * Math.max(1.4, width / height) - box.width / 2;
          const y = centerY + radius * Math.sin(angle) - box.height / 2;
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
