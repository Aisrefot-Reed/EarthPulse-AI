import { GeoJsonLayer } from '@deck.gl/layers';

/**
 * Advanced Layer Factory
 * Dynamically colors polygons based on analysis type (Fire = Orange, Flood = Blue, etc.)
 */
export function createAILayer(result: any, visible: boolean, opacity: number) {
  if (!result || !visible || !result.data?.polygons) return null;

  const analysisType = result.data.analysisInfo?.type || 'deforestation';
  
  // Dynamic color selection
  let fillColor = [220, 38, 38, opacity * 255]; // Default Red
  let lineColor = [185, 28, 28, 255];

  if (analysisType === 'flooding') {
    fillColor = [14, 165, 233, opacity * 255]; // Sky Blue
    lineColor = [3, 105, 161, 255];
  } else if (analysisType === 'wildfires') {
    fillColor = [249, 115, 22, opacity * 255]; // Orange
    lineColor = [194, 65, 12, 255];
  }

  return new GeoJsonLayer({
    id: `change-layer-${analysisType}`,
    data: result.data.polygons,
    filled: true,
    stroked: true,
    getFillColor: fillColor as any,
    getLineColor: lineColor as any,
    getLineWidth: 2,
    lineWidthMinPixels: 1,
    pickable: true,
    updateTriggers: {
      getFillColor: [opacity, analysisType]
    }
  });
}

export function createUncertaintyLayer(result: any, visible: boolean) {
  if (!result || !visible || !result.data?.polygons) return null;
  return new GeoJsonLayer({
    id: 'uncertainty-heatmap',
    data: result.data.polygons,
    filled: true,
    stroked: false,
    getFillColor: [245, 158, 11, 100],
    opacity: 0.5,
  });
}
