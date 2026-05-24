import { BitmapLayer } from '@deck.gl/layers';

/**
 * AI Prediction Layer
 * Renders the processed mask image over the analyzed bounding box.
 */
export function createAILayer(result: any, visible: boolean, opacity: number) {
  if (!result || !visible || !result.processedImage || !result.bbox) return null;

  return new BitmapLayer({
    id: 'ai-prediction-layer',
    image: result.processedImage,
    bounds: result.bbox, // [west, south, east, north]
    opacity: opacity,
    pickable: true,
    updateTriggers: {
      image: result.processedImage,
      opacity: opacity
    }
  });
}

/**
 * Uncertainty Layer (Confidence Heatmap)
 * In v1, we use the same mask but with a different color ramp logic if needed.
 */
export function createUncertaintyLayer(result: any, visible: boolean) {
  if (!result || !visible || !result.processedImage || !result.bbox) return null;

  return new BitmapLayer({
    id: 'uncertainty-heatmap',
    image: result.processedImage,
    bounds: result.bbox,
    opacity: 0.5,
    tintColor: [255, 165, 0], // Amber tint for uncertainty visualization
  });
}
