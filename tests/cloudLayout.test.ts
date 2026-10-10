import assert from 'node:assert/strict';
import test from 'node:test';
import { packCloudBoxes } from '../src/utils/cloudLayout.js';

test('every tag stays inside the cloud without overlap on phone, tablet and desktop', () => {
  for (const width of [286, 326, 356, 718, 1230]) {
    for (const count of [15, 42]) {
      const boxes = Array.from({ length: count }, (_, i) => ({
        width: Math.min(width - 40, [145, 121, 109, 87, 127, 175, 220][i % 7]),
        height: i % 5 === 0 ? 62 : 44,
      }));
      for (const seed of [0, 1.8, 4.2]) {
        const { positions, height } = packCloudBoxes(boxes, width, 480, seed);
        assert.equal(positions.length, count);
        positions.forEach((a, i) => {
          assert.ok(a.x >= 0 && a.x + boxes[i].width <= width);
          assert.ok(a.y >= 52 && a.y + boxes[i].height <= height - 40);
          positions.slice(i + 1).forEach((b, offset) => {
            const j = i + offset + 1;
            const overlaps = a.x < b.x + boxes[j].width && a.x + boxes[i].width > b.x &&
              a.y < b.y + boxes[j].height && a.y + boxes[i].height > b.y;
            assert.equal(overlaps, false, `Tags ${i}/${j} overlap at ${width}px`);
          });
        });
      }
    }
  }
});
