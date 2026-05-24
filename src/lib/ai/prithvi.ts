/**
 * Stabilized AI Wrapper
 * Local inference is currently disabled to ensure 100% Vercel stability.
 * GEE Baseline is used as the primary engine.
 */

export async function runPrithviInference(imageBuffer: Buffer) {
  console.log('[AI] Local inference is currently in fallback mode.');
  // Return an empty array or signal that we are in GEE mode
  return new Float32Array(0);
}

/**
 * Placeholder for future optimized WASM implementation
 */
async function preprocess(buffer: Buffer) {
  return null;
}
