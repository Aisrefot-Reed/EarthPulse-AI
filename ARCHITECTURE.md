# EarthPulse AI: Revised Architecture (Phase 1)

## 1. Updated System Architecture (Local AI Inference)

EarthPulse AI now runs **Prithvi-EO-tiny inference locally** within Vercel Serverless Functions. We leverage **ONNX Runtime** for high-performance CPU execution, bypassing external AI APIs and ensuring complete data privacy and control.

```text
[ Client (Browser) ]
      |
      |-- Maps: Deck.gl + MapLibre GL JS
      |-- State: React Context + URL Params
      |
[ Next.js API Routes (Vercel Serverless / Node.js Runtime) ]
      |
      |-- /api/ai/infer (LOCAL Prithvi Inference via ONNX)
      |    |-- Downloads ONNX weights from HF Hub (cached if possible)
      |    |-- Performs CPU-only inference using onnxruntime-node
      |    |-- Returns segmentation mask + uncertainty
      |
      |-- /api/gee/* (Google Earth Engine Integration)
      |
[ External Services ]
      |
      |-- Google Earth Engine (Data source & reliable baseline)
      |-- Upstash Redis (Rate limiting & inference result caching)
      |-- Resend (Alerts)
```

## 2. Updated Data Flow

1.  **Request:** User selects a region.
2.  **GEE Prep:** Next.js API pulls required Sentinel-2 bands from GEE.
3.  **Local Inference:**
    *   The `/api/ai/infer` route checks for a cached ONNX model.
    *   If not present, it fetches the **Quantized ONNX weights** from HF Hub.
    *   `onnxruntime-node` executes the model on the GEE-provided image buffer.
    *   `sharp` handles image preprocessing/tiling.
4.  **Synthesis:** AI results (mask + confidence) are returned alongside GEE baseline metrics.

## 3. Strict Optimization & Limits for Vercel Hobby

To ensure stability on the Hobby tier (1024MB RAM, 10s timeout), the following constraints are enforced:

### A. Operational Limits
*   **Premium AI Max Area:** 2.0 km² (approx. 1400m x 1400m). Larger areas will automatically use the GEE Baseline Engine.
*   **Hard Timeout:** 8.0 seconds for AI inference. If exceeded, the process returns a fallback signal.
*   **Rate Limit:** 5 premium analyses per 24h per IP.

### B. Model & Runtime Optimization
*   **Model:** Prithvi-EO-tiny (INT8 Quantized ONNX). Targeted size: < 40MB.
*   **Runtime:** `onnxruntime-node` with specific build flags to minimize binary size.
*   **Caching:** AI results (masks/metrics) are cached in **Upstash Redis** for 24 hours (Key: `geo:hex_h8:date_range`).

### C. Size Management & Pre-warming
*   **Deployment Size:** We will monitor the 250MB limit closely. If `onnxruntime-node` binaries are too large, we will explore `onnxruntime-web` with WASM for client-side inference as a secondary architectural alternative.
*   **Pre-warming:** A Vercel Cron job (`/api/ai/warm`) runs every 10 minutes to keep the function hot and the model weights in the execution environment's `/tmp` cache.

## 4. Risks and Mitigation

| Risk | Mitigation |
| :--- | :--- |
| **Vercel Execution Timeout (10s)** | Keep input patches small. Fall back to GEE baseline if AI takes >8s. |
| **Memory Limit (1024MB)** | Use INT8 Quantization. Clear model instance from memory after inference if necessary. |
| **Dependency Size** | Ensure `onnxruntime-node` binaries are trimmed for the target environment (Linux/x64). |

---
**Status:** Dependencies installed (`onnxruntime-node`, `sharp`). Architecture updated to run AI locally. 

**Does this revised Stage 1 meet your requirements? If so, I am ready to move to Phase 2: User Flow, UI/UX Design & Component Architecture.**