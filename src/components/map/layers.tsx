import { BitmapLayer } from '@deck.gl/layers';
import { TileLayer } from '@deck.gl/geo-layers';

/**
 * AI Prediction Layer
 * Renders the semantic segmentation mask as a semi-transparent overlay.
 */
export function createAILayer(data: any, visible: boolean, opacity: number) {
  if (!data || !visible) return null;

  return new TileLayer({
    id: 'ai-prediction-layer',
    data: data.url || '', // This would be the GEE map tile URL or a local canvas
    opacity: opacity,
    visible: visible,
    renderSubLayers: (props: any) => {
      const { west, south, east, north } = props.tile.bbox;
      return new BitmapLayer(props, {
        data: undefined,
        image: props.data,
        bounds: [west, south, east, north],
        // Custom shader or tinting could go here
      });
    },
    updateTriggers: {
      data: data.url,
      opacity: opacity
    }
  });
}

/**
 * Uncertainty Heatmap Layer
 * Renders the confidence scores using a Color Ramp (Red to Green).
 */
export function createUncertaintyLayer(data: any, visible: boolean) {
  if (!data || !visible) return null;

  return new TileLayer({
    id: 'uncertainty-heatmap',
    data: data.uncertaintyUrl || '', 
    visible: visible,
    opacity: 0.7,
    renderSubLayers: (props: any) => {
      const { west, south, east, north } = props.tile.bbox;
      return new BitmapLayer(props, {
        data: undefined,
        image: props.data,
        bounds: [west, south, east, north],
      });
    }
  });
}
