import * as ort from 'onnxruntime-node';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import { downloadFile } from '@/utils/download'; // New utility needed

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
    await downloadFile(MODEL_URL, TMP_MODEL_PATH);
    console.log('[AI] Model download complete.');
  }

  try {
    session = await ort.InferenceSession.create(TMP_MODEL_PATH, {
      executionProviders: ['cpu'],
      graphOptimizationLevel: 'all'
    });
    return session;
  } catch (error) {
    console.error('[AI] Failed to create inference session:', error);
    throw error;
  }
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
