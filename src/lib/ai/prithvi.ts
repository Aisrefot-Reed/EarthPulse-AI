import * as ort from 'onnxruntime-web';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import { downloadFile } from '@/utils/download';

// Required for onnxruntime-web in Node.js environment
ort.env.wasm.numThreads = 1;
ort.env.wasm.simd = false; // Disable SIMD for maximum compatibility on Vercel

let session: ort.InferenceSession | null = null;
const MODEL_URL = process.env.PRITHVI_MODEL_URL!; // e.g., HF Hub direct link
const TMP_MODEL_PATH = path.join('/tmp', 'prithvi_tiny_quantized.onnx');

/**
 * Loads the Prithvi ONNX model. Downloads to /tmp if not present.
 */
async function getInferenceSession() {
  if (session) return session;

  if (!fs.existsSync(TMP_MODEL_PATH)) {
    console.log('[AI] Model weights missing in /tmp. Downloading...');
    try {
      await downloadFile(MODEL_URL, TMP_MODEL_PATH);
      console.log('[AI] Model download complete.');
    } catch (e) {
      console.error('[AI] Download failed:', e);
      throw new Error('MODEL_DOWNLOAD_FAILED');
    }
  }

  try {
    // We use the WASM execution provider to avoid native .so binding issues on Vercel Serverless
    const modelBuffer = fs.readFileSync(TMP_MODEL_PATH);
    session = await ort.InferenceSession.create(modelBuffer, {
      executionProviders: ['wasm'],
      graphOptimizationLevel: 'all'
    });
    return session;
  } catch (error) {
    console.error('[AI] Failed to create WASM inference session:', error);
    throw new Error('SESSION_CREATION_FAILED');
  }
}

/**
 * Preprocesses a raw image buffer from GEE into the format expected by Prithvi.
 */
async function preprocess(buffer: Buffer) {
  const { data } = await sharp(buffer)
    .resize(224, 224)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const floatData = new Float32Array(224 * 224 * 3);
  for (let i = 0; i < 224 * 224; i++) {
    floatData[i * 3] = data[i * 4] / 255.0;
    floatData[i * 3 + 1] = data[i * 4 + 1] / 255.0;
    floatData[i * 3 + 2] = data[i * 4 + 2] / 255.0;
  }

  return new ort.Tensor('float32', floatData, [1, 3, 224, 224]);
}

/**
 * Runs local inference with OOM protection.
 */
export async function runPrithviInference(imageBuffer: Buffer) {
  try {
    const session = await getInferenceSession();
    const inputTensor = await preprocess(imageBuffer);

    const feeds = { [session.inputNames[0]]: inputTensor };
    const results = await session.run(feeds);
    
    const output = results[session.outputNames[0]];
    
    // Explicitly nullify large objects to help GC
    (inputTensor as any) = null;
    
    return output.data as Float32Array;
  } catch (error: any) {
    if (error.message.includes('out of memory')) {
      console.error('[AI] OOM Error detected during inference');
    }
    throw error;
  }
}
