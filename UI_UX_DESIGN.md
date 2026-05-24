# EarthPulse AI: UI/UX & Component Design (Phase 2 - Refined)

## 1. Design Language & Accessibility
- **Theme:** Dark Mode by default (Ecological/Modern aesthetic). Secondary accents: #10B981 (Emerald), #F59E0B (Amber for alerts).
- **Accessibility:** 
    - Full keyboard navigation for timeline and layer controls.
    - ARIA labels for all interactive map elements.
    - High-contrast mode support.
- **Responsive Strategy:** 
    - **Desktop:** Full-screen map with floating glassmorphism sidebars.
    - **Mobile:** Collapsible bottom sheets (`shadcn/ui` Drawer) for metrics and controls. Map view prioritized.

## 2. Interactive Map & Visual Optimization (Deck.gl)
- **Layer Optimization:**
    - **Memoization:** Use `useMemo` for layer definitions to prevent unnecessary re-renders.
    - **Layer Culling:** Disable layers outside the current viewport or at incompatible zoom levels.
    - **Lazy Loading:** High-res AI masks are loaded only when the user pauses the timeline or zooms into a hotspot.
- **Visuals:** 
    - GEE Tiles as the base.
    - Deck.gl `TileLayer` for AI probability masks with `autoHighlight`.
    - Confidence Heatmaps: Gradient overlay (Red = Change, Blue = Stable, Opacity = Uncertainty).

## 3. Storytelling Mode: "Journey of a Forest"
- **Technical Implementation:**
    - **CinematicCamera:** Uses `react-map-gl`'s `useMap().current.flyTo()` with custom easing functions for cinematic motion. 
    - **Timeline Sync:** Deck.gl layers are updated via `updateTriggers` synchronized with the animation frame.
- **Controls:** Floating "Director's Overlay" with Play/Pause, 1.5x Speed, Rewind, and "Exit Story" buttons.
- **Narrative:** Dynamic text cards appear based on spatial-temporal events detected by the backend.

## 4. "Generate Share Card" (Viral Engine)
- **Hybrid Strategy:**
    - **Static Card (PNG):** Generated on the client using `html-to-image`. Includes comparison shots and high-res stats.
    - **Animated Card (GIF):** 
        - Client sends a request to `/api/generate-gif` with coordinates/dates.
        - **Graceful Fallback:** If server-side generation exceeds 6 seconds, the API returns the pre-generated PNG link with a message: "GIF processing delayed, high-res static card ready."
        - Backend fetches a sequence of GEE images.
        - **Sharp** composites text/watermarks.
        - **gifenc** encodes the GIF (low palette optimization for fast sharing).
    - **Result:** High-quality PNG for immediate use; optional GIF for high-impact social sharing.

## 5. "Adopt a Region" Backend Logic
- **Subscription Storage:** Upstash Redis (Hash: `subscriptions:user_email`).
- **User Quota:** Maximum 3 regions per user to prevent system abuse.
- **Monitoring Workflow:**

## 6. Credit Visualization & UX
- **AI Credits:** A circular progress bar or "battery" icon in the top bar showing `X/5` credits.
- **Limit Reached UX:** When credits hit zero, the "Premium AI" toggle is disabled with a subtle glow effect. A dialog appears: "Premium AI rests for today. EarthPulse is still watching using high-accuracy GEE baseline data."
- **States:** 
    - **Loading:** Shimmer effects on metrics cards; "Scanning..." text on map overlays.
    - **Error:** Sonner toasts with actionable advice (e.g., "Area too large for AI, try a smaller region").
    - **Cron Job:** Vercel Cron runs every 24 hours.
    - **Efficiency:** The script calculates a "Change Score" for each region using GEE's fast `reduceRegion` with NDVI differencing.
    - **Alert Trigger:** If `change_score > 0.05` (5% change), an email is sent via **Resend**.

## 6. Component Architecture (Refined)

```text
src/components/
├── map/
│   ├── MapWrapper.tsx        # Responsive container (Drawer for mobile)
│   ├── DeckLayerManager.tsx  # Memoized layer logic & culling
│   └── GEEBaseMap.tsx        # MapLibre setup
├── story/
│   ├── CinematicCamera.ts    # Helper for flyTo orchestration
│   ├── TimelineAnimator.tsx  # Controls auto-play/easing
│   └── DirectorPanel.tsx     # Narrative controls
├── ui/
│   ├── DashboardOverlay.tsx  # Responsive sidebar/bottom-sheet logic
│   ├── MetricDisplay.tsx     # Animated stats (Framer Motion)
│   └── SharePreview.tsx      # Modal for PNG/GIF generation
└── community/
    └── AdoptForm.tsx         # Subscription UI
```

---
**Status:** UI/UX & Component design refined with mobile support, optimization, and technical depth.

**I am now moving to Phase 3: Backend API Routes.** I will focus on the GEE Service Account setup, the local ONNX inference engine, and the rate-limiting logic.
