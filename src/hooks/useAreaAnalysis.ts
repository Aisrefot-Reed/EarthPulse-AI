'use client';

import { useState, useCallback, useRef } from 'react';
import { toast } from 'sonner';

interface AnalysisResult {
  success: boolean;
  mode: 'prithvi' | 'gee';
  data: any;
  meta: {
    processingTime: number;
    creditsLeft?: number;
    cached?: boolean;
  };
}

export function useAreaAnalysis() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [credits, setCredits] = useState(5);
  
  const analyzeArea = useCallback(async (bbox: number[], dateRange: [string, string]) => {
    setLoading(true);
    try {
      // 1. Call GEE for baseline and imagery for AI
      const geeResponse = await fetch('/api/gee/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bbox, dateStart: dateRange[0], dateEnd: dateRange[1] })
      });
      
      const geeData = await geeResponse.json();
      
      if (!geeData.success) throw new Error(geeData.error);

      // 2. Attempt Premium AI (Prithvi)
      // We pass the imageUrl from GEE to our AI endpoint
      const aiResponse = await fetch('/api/ai/infer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          bbox, 
          imageUrl: geeData.data.url.replace('{z}/{x}/{y}', '10/500/500'), // Mocked tile for inference
          cacheKey: `${bbox.join(',')}-${dateRange.join(',')}`
        })
      });

      const aiData = await aiResponse.json();

      if (aiData.success) {
        setResult(aiData);
        setCredits(prev => Math.max(0, prev - (aiData.meta.cached ? 0 : 1)));
      } else {
        // Fallback to GEE
        setResult({
          success: true,
          mode: 'gee',
          data: geeData.data,
          meta: { processingTime: geeData.meta.processingTime }
        });
        toast.info(aiData.error || 'Using GEE baseline analysis.');
      }

    } catch (error: any) {
      console.error('Analysis failed:', error);
      toast.error(`Analysis failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  return { analyzeArea, loading, result, credits };
}
