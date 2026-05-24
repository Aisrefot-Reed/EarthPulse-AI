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
  const [credits, setCredits] = useState(5);
  
  const analyzeArea = useCallback(async (bbox: number[], dateRange: [string, string]) => {
    setLoading(true);
    try {
      const geeResponse = await fetch('/api/gee/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bbox, dateStart: dateRange[0], dateEnd: dateRange[1] })
      });
      
      const geeData = await geeResponse.json();
      if (!geeData.success) throw new Error(geeData.error);

      const aiResponse = await fetch('/api/ai/infer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          bbox, 
          imageUrl: geeData.data.url.replace('{z}/{x}/{y}', '10/500/500'), // Placeholder for specific tile
          cacheKey: `${bbox.join(',')}-${dateRange.join(',')}`
        })
      });

      const aiData = await aiResponse.json();

      if (aiData.success && aiData.mode === 'prithvi') {
        // Convert raw AI mask to visible image
        const processedImage = maskToDataURL(aiData.data, 224, 224);
        setResult({
          ...aiData,
          processedImage,
          bbox,
          data: geeData.data // Keep GEE tiles as base
        });
        if (!aiData.meta.cached) setCredits(prev => Math.max(0, prev - 1));
      } else {
        setResult({
          success: true,
          mode: 'gee',
          data: geeData.data,
          bbox,
          meta: { processingTime: geeData.meta.processingTime }
        });
        if (aiData.error) toast.info(aiData.error);
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
