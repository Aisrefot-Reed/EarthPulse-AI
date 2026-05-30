'use client';

import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { maskToDataURL } from '@/utils/visualize';

export type AnalysisMode = 'prithvi' | 'gee';
export type AnalysisType = 'deforestation' | 'wildfires' | 'flooding';

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
    requestedMode: AnalysisMode = 'prithvi',
    analysisType: AnalysisType = 'deforestation'
  ) => {
    setLoading(true);
    try {
      // 1. GEE Analyze (Base Imagery and Logic)
      const geeResponse = await fetch('/api/gee/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bbox, dateStart: dateRange[0], dateEnd: dateRange[1], analysisType })
      });
      
      const geeJson = await geeResponse.json();
      if (!geeJson.success) {
        toast.info(geeJson.error || 'Analysis returned no results.');
        setLoading(false);
        return;
      }

      // 2. AI Infer (Simulated/Fallback)
      let aiJson: any = { success: false };
      if (requestedMode === 'prithvi') {
        const aiResponse = await fetch('/api/ai/infer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bbox, analysisType })
        });
        aiJson = await aiResponse.json();
      }

      if (requestedMode === 'prithvi' && aiJson.success && aiJson.mode === 'prithvi' && aiJson.data) {
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
        setResult({
          success: true,
          mode: 'gee',
          data: geeJson.data,
          bbox,
          meta: { processingTime: geeJson.meta?.processingTime || 0 }
        });
      }

    } catch (error: any) {
      console.error('[FRONTEND] Analysis failed:', error);
      toast.error(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  return { analyzeArea, loading, result, credits };
}
