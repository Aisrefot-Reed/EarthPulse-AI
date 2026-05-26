'use client';

import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { maskToDataURL } from '@/utils/visualize';

export type AnalysisMode = 'prithvi' | 'gee';

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
  const [credits, setCredits] = useState(20);
  
  const analyzeArea = useCallback(async (
    bbox: number[], 
    dateRange: [string, string], 
    requestedMode: AnalysisMode = 'prithvi'
  ) => {
    setLoading(true);
    try {
      // 1. GEE Analyze (Always needed for base imagery and baseline)
      const geeResponse = await fetch('/api/gee/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bbox, dateStart: dateRange[0], dateEnd: dateRange[1] })
      });
      
      const geeJson = await geeResponse.json();
      if (!geeJson.success) throw new Error(geeJson.error);

      // 2. AI Infer (Only if requested and not in pure GEE mode)
      let aiJson: any = { success: false };
      
      if (requestedMode === 'prithvi') {
        const aiResponse = await fetch('/api/ai/infer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            bbox, 
            imageUrl: geeJson.data.url.replace('{z}/{x}/{y}', '10/500/500'),
            cacheKey: `${bbox.join(',')}-${dateRange.join(',')}`
          })
        });
        aiJson = await aiResponse.json();
      }

      console.log('[FRONTEND] GEE Response:', geeJson);
      console.log('[FRONTEND] AI Response:', aiJson);

      if (requestedMode === 'prithvi' && aiJson.success && aiJson.mode === 'prithvi') {
        const processedImage = maskToDataURL(aiJson.data, 224, 224);
        setResult({
          success: true,
          mode: 'prithvi',
          data: geeJson.data,
          processedImage,
          bbox,
          meta: aiJson.meta
        });
        if (!aiJson.meta.cached) setCredits(prev => Math.max(0, prev - 1));
      } else {
        // Fallback to pure GEE imagery or direct GEE request
        setResult({
          success: true,
          mode: 'gee',
          data: geeJson.data,
          bbox,
          meta: { processingTime: geeJson.meta?.processingTime || 0 }
        });
        
        if (requestedMode === 'prithvi' && aiJson.error) {
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
