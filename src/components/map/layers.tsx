import { GeoJsonLayer } from '@deck.gl/layers';

/**
 * AI / Change Prediction Layer
 * Uses GeoJSON Polygons for a professional, clean look with strokes.
 */
export function createAILayer(result: any, visible: boolean, opacity: number) {
  if (!result || !visible || !result.data?.polygons) return null;

  return new GeoJsonLayer({
    id: 'ai-change-polygons',
    data: result.data.polygons,
    filled: true,
    stroked: true,
    getFillColor: [220, 38, 38, opacity * 255], // Red-600
    getLineColor: [185, 28, 28, 255],           // Red-700
    getLineWidth: 2,
    lineWidthMinPixels: 1,
    opacity: 1, // Controlled via getFillColor alpha
    pickable: true,
    updateTriggers: {
      getFillColor: [opacity]
    }
  });
}

/**
 * Risk Map (Heatmap style logic)
 */
export function createUncertaintyLayer(result: any, visible: boolean) {
  if (!result || !visible || !result.data?.polygons) return null;

  return new GeoJsonLayer({
    id: 'uncertainty-heatmap',
    data: result.data.polygons,
    filled: true,
    stroked: false,
    getFillColor: [245, 158, 11, 100], // Amber-500
    opacity: 0.5,
  });
}
