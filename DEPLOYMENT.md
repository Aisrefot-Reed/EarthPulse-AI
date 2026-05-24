# EarthPulse AI: Deployment Guide & Technical Documentation

## 1. Project Overview
EarthPulse AI is a high-impact geospatial monitoring platform combining Google Earth Engine (GEE) with local AI inference (Prithvi-EO-tiny) to detect and visualize landscape changes.

## 2. Mandatory Environment Variables (Vercel)

| Variable | Description |
| :--- | :--- |
| `GEE_SERVICE_ACCOUNT_KEY` | JSON string of the GEE Service Account private key. |
| `UPSTASH_REDIS_REST_URL` | Redis URL for rate limiting and subscription storage. |
| `UPSTASH_REDIS_REST_TOKEN` | Auth token for Upstash Redis. |
| `RESEND_API_KEY` | API key for email notifications. |
| `CRON_SECRET` | Secret to secure the Vercel Cron endpoint. |
| `PRITHVI_MODEL_URL` | Direct URL to the INT8 Quantized ONNX weights (e.g., HF Hub). |

## 3. GEE Service Account Setup
1. Create a project in [Google Cloud Console](https://console.cloud.google.com/).
2. Enable **Earth Engine API**.
3. Create a **Service Account** and generate a **JSON Private Key**.
4. Whitelist the service account email in the [Earth Engine Cloud Project](https://code.earthengine.google.com/).
5. Paste the entire JSON content into `GEE_SERVICE_ACCOUNT_KEY`.

## 4. Performance Optimization (Lighthouse 90+)
- **Dynamic Imports:** Used for heavy libraries like `maplibre-gl` and `onnxruntime-node`.
- **Image Optimization:** All preprocessing handled via `sharp` (C++ bindings) for low memory usage.
- **Edge Middleware:** Rate limiting handled at the edge to reduce server load.
- **Memoized Layers:** Deck.gl layers only re-calculate on specific `updateTriggers`.

## 5. Known Limitations & Future Scaling

### Known Limitations
- **Vercel Hobby Tier Timeouts:** Serverless functions are hard-capped at 10 seconds. AI inference (Prithvi-EO-tiny) on CPU may take 4-8 seconds. To prevent timeouts, the "Premium AI" mode is strictly limited to areas of ~2.0 km². Larger areas automatically trigger the GEE Baseline fallback.
- **Memory Constraints (OOM):** The function has 1024MB RAM. Rapid, concurrent heavy image processing might cause Out-Of-Memory errors. We use `sharp` and garbage collection nullification to mitigate this, but it remains a boundary condition.
- **GEE Quotas:** Google Earth Engine limits concurrent queries and overall usage on free service accounts. If traffic spikes, GEE might return `429 Too Many Requests`.
- **Model Cold Starts:** The first invocation of the AI model requires downloading the ONNX weights to `/tmp` (~25MB), adding ~2-3 seconds of latency. A cron job mitigates this by keeping the function warm.

### Scaling Strategy
- Move AI inference to dedicated GPU-backed workers (e.g., AWS Lambda with container support, Modal, or RunPod).
- Use PostGIS/Supabase for persistent, indexed geographical storage to handle massive community subscriptions.
- Implement WebWorker-based client-side inference using `onnxruntime-web` (WASM) to offload compute from the server entirely.

---
## Hackathon Presentation Strategy
1. **The Hook:** Start with the "Journey of a Forest" (Amazon Fire 2021) to show visual impact.
2. **The Tech:** Highlight "Local AI on Vercel" — running complex Earth Observation models in serverless functions.
3. **The Utility:** Demonstrate "Adopt a Region" — moving from passive viewing to active guardianship.
4. **Twitter Hook:** "We just built a planet-monitoring AI that runs on your browser. 🌍🔥 #BuildWithAI #ClimateAction"
