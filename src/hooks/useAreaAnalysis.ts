'use client';

import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { maskToDataURL } from '@/utils/visualize';

interface AnalysisResult {
  success: boolean;
  mode: 'prithvi' | 'gee';
  data: any;
  processedImage?: string;
  bbox: number[];
  meta: {
    processingTime: number;
    creditsLeft?: number;
    cached?: boolean;
  };
}

export function useAreaAnalysis() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [credits, setCredits] = useState(20); // Sync with new relaxed limit
  
  const analyzeArea = useCallback(async (bbox: number[], dateRange: [string, string]) => {
    setLoading(true);
    try {
      // 1. GEE Analyze (Base Imagery)
      const geeResponse = await fetch('/api/gee/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bbox, dateStart: dateRange[0], dateEnd: dateRange[1] })
      });
      
      const geeJson = await geeResponse.json();
      if (!geeJson.success) throw new Error(geeJson.error);

      // 2. AI Infer (Change Mask)
      const aiResponse = await fetch('/api/ai/infer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          bbox, 
          imageUrl: geeJson.data.url.replace('{z}/{x}/{y}', '10/500/500'), // Placeholder logic
          cacheKey: `${bbox.join(',')}-${dateRange.join(',')}`
        })
      });

      const aiJson = await aiResponse.json();

      console.log('[FRONTEND] GEE Response:', geeJson);
      console.log('[FRONTEND] AI Response:', aiJson);

      if (aiJson.success && aiJson.mode === 'prithvi') {
        const processedImage = maskToDataURL(aiJson.data, 224, 224);
        console.log('[FRONTEND] Prithvi mode activated. Processed image length:', processedImage.length);
        setResult({
          success: true,
          mode: 'prithvi',
          data: geeJson.data, // Imagery from GEE
          processedImage,
          bbox,
          meta: aiJson.meta
        });
        if (!aiJson.meta.cached) setCredits(prev => Math.max(0, prev - 1));
      } else {
        console.log('[FRONTEND] Fallback to GEE mode activated. Setting result with data:', geeJson.data);
        // Fallback to pure GEE imagery
        setResult({
          success: true,
          mode: 'gee',
          data: geeJson.data,
          bbox,
          meta: { processingTime: geeJson.meta?.processingTime || 0 }
        });
        if (aiJson.error) {
          toast.info(aiJson.error);
        }
      }

    } catch (error: any) {
      console.error('[FRONTEND] Analysis flow failed:', error);
      toast.error(`Analysis failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  return { analyzeArea, loading, result, credits };
}
