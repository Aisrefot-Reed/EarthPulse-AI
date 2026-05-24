/**
 * Converts Prithvi AI probability mask (Float32Array) into a color-coded Data URL.
 * Red = Deforestation/Change, Green = Stable, Blue/Yellow = Uncertainty.
 */
export function maskToDataURL(data: number[] | Float32Array, width: number, height: number): string {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  const imageData = ctx.createImageData(width, height);
  
  for (let i = 0; i < data.length; i++) {
    const value = data[i]; // Probability of change [0, 1]
    const idx = i * 4;

    // RGBA logic
    // We color higher probability of change in RED
    imageData.data[idx] = Math.floor(value * 255);     // Red
    imageData.data[idx + 1] = Math.floor((1 - value) * 100); // Faint green for contrast
    imageData.data[idx + 2] = 50;                      // Slight blue tint
    imageData.data[idx + 3] = Math.floor(value * 200); // Alpha based on confidence
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL();
}
