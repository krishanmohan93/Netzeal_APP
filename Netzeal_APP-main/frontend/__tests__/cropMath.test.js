import { computeCropRect, deriveBaseScale } from '../src/utils/cropMath';

test('computeCropRect basic center crop no translation', () => {
  const imageWidth = 1200;
  const imageHeight = 800;
  const frameWidth = 600;
  const frameHeight = 600;
  const baseScale = deriveBaseScale(imageWidth, imageHeight, frameWidth, frameHeight); // contain
  const userScale = 1; // no extra zoom
  const translateX = 0;
  const translateY = 0;
  const rect = computeCropRect({
    imageWidth,
    imageHeight,
    frameWidth,
    frameHeight,
    baseScale,
    userScale,
    translateX,
    translateY,
  });
  expect(rect.width).toBeGreaterThan(0);
  expect(rect.height).toBeGreaterThan(0);
});

test('computeCropRect zoom in clamps translation', () => {
  const imageWidth = 1000;
  const imageHeight = 500;
  const frameWidth = 500;
  const frameHeight = 500;
  const baseScale = deriveBaseScale(imageWidth, imageHeight, frameWidth, frameHeight);
  const userScale = 2; // zoomed in 2x
  // large translate should still compute valid origin inside bounds
  const rect = computeCropRect({
    imageWidth,
    imageHeight,
    frameWidth,
    frameHeight,
    baseScale,
    userScale,
    translateX: 300, // exceed theoretical bounds intentionally
    translateY: -250,
  });
  expect(rect.originX).toBeGreaterThanOrEqual(0);
  expect(rect.originY).toBeGreaterThanOrEqual(0);
  expect(rect.originX + rect.width).toBeLessThanOrEqual(imageWidth);
  expect(rect.originY + rect.height).toBeLessThanOrEqual(imageHeight);
});
