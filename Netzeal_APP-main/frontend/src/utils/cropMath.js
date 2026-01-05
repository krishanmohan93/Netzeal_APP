// Pure utility for computing crop rectangle given transform state.
// Enables deterministic unit testing separate from React Native / Reanimated environment.

export function computeCropRect({
  imageWidth,
  imageHeight,
  frameWidth,
  frameHeight,
  baseScale, // scale to fit image in frame prior to user zoom
  userScale, // additional zoom from user gestures
  translateX, // user translation within frame (px)
  translateY,
}) {
  // Derived displayed dimensions
  const displayedWidth = imageWidth * baseScale * userScale;
  const displayedHeight = imageHeight * baseScale * userScale;

  const offsetLeft = (frameWidth - displayedWidth) / 2 + translateX;
  const offsetTop = (frameHeight - displayedHeight) / 2 + translateY;

  const originX = Math.max(0, -offsetLeft) / (baseScale * userScale);
  const originY = Math.max(0, -offsetTop) / (baseScale * userScale);
  const cropWidthOriginal = frameWidth / (baseScale * userScale);
  const cropHeightOriginal = frameHeight / (baseScale * userScale);

  const finalOriginX = clamp(Math.round(originX), 0, imageWidth - 1);
  const finalOriginY = clamp(Math.round(originY), 0, imageHeight - 1);
  const finalWidth = Math.round(Math.min(cropWidthOriginal, imageWidth - finalOriginX));
  const finalHeight = Math.round(Math.min(cropHeightOriginal, imageHeight - finalOriginY));

  return {
    originX: finalOriginX,
    originY: finalOriginY,
    width: finalWidth,
    height: finalHeight,
  };
}

function clamp(val, min, max) {
  return Math.min(Math.max(val, min), max);
}

// Helper to derive baseScale (contain strategy)
export function deriveBaseScale(imageWidth, imageHeight, frameWidth, frameHeight) {
  return Math.min(frameWidth / imageWidth, frameHeight / imageHeight);
}
