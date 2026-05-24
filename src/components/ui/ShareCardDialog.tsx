'use client';

import React, { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Share2, Download, Globe, Info, Loader2, Sparkles } from 'lucide-react';
import { toPng } from 'html-to-image';
import { toast } from 'sonner';

interface ShareCardProps {
  regionName: string;
  stats: {
    hectares: number;
    co2: number;
    risk: string;
  };
  mapScreenshot?: string;
}

export const ShareCardDialog = ({ regionName, stats, mapScreenshot }: ShareCardProps) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [tweetText, setTweetText] = useState(
    `🌍 EarthPulse AI Insight: Detected changes in ${regionName}. \n📉 ${stats.hectares}ha affected. \n🛑 Biodiversity Risk: ${stats.risk}. \n\nMonitoring our planet with AI. #EarthPulse #ClimateTech`
  );

  const generateImage = async () => {
    if (!cardRef.current) return;
    setIsGenerating(true);
    try {
      const dataUrl = await toPng(cardRef.current, { quality: 0.95, cacheBust: true });
      const link = document.createElement('a');
      link.download = `earthpulse-${regionName.toLowerCase()}.png`;
      link.href = dataUrl;
      link.click();
      toast.success("Share card generated successfully!");
    } catch (err) {
      toast.error("Failed to generate image.");
      console.error(err);
    } finally {
      setIsGenerating(false);
    }
  };

  const shareToTwitter = () => {
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`;
    window.open(url, '_blank');
  };

  return (
    <Card className="p-4 bg-slate-900/90 border-slate-800 backdrop-blur-xl max-w-md w-full">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-amber-400" />
          Generate Share Card
        </h3>
      </div>

      {/* Preview of the actual card that will be screenshotted */}
      <div className="overflow-hidden rounded-xl border border-slate-800 bg-black aspect-[4/5] relative mb-4" ref={cardRef}>
        {/* Background / Map Placeholder */}
        <div className="absolute inset-0 bg-gradient-to-b from-slate-900 to-black opacity-80" />
        {mapScreenshot && <img src={mapScreenshot} className="absolute inset-0 object-cover opacity-60" alt="Map View" />}
        
        {/* Watermark */}
        <div className="absolute top-4 left-4 flex items-center gap-2 z-10">
          <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center shadow-lg">
            <Globe className="w-5 h-5 text-white" />
          </div>
          <span className="text-sm font-black tracking-tighter text-white">EARTHPULSE AI</span>
        </div>

        {/* Content */}
        <div className="absolute bottom-0 inset-x-0 p-6 bg-gradient-to-t from-black via-black/80 to-transparent">
          <div className="mb-2 inline-block px-2 py-1 bg-emerald-500/20 border border-emerald-500/30 rounded text-[10px] font-bold text-emerald-400 uppercase tracking-widest">
            AI Analysis Report
          </div>
          <h4 className="text-2xl font-bold text-white mb-4">{regionName}</h4>
          
          <div className="grid grid-cols-3 gap-2">
            <div className="p-2 bg-slate-800/50 rounded-lg border border-white/5">
              <p className="text-[10px] text-slate-400 uppercase">Impact</p>
              <p className="text-sm font-bold text-white">{stats.hectares} ha</p>
            </div>
            <div className="p-2 bg-slate-800/50 rounded-lg border border-white/5">
              <p className="text-[10px] text-slate-400 uppercase">CO2 Loss</p>
              <p className="text-sm font-bold text-white">{stats.co2} t</p>
            </div>
            <div className="p-2 bg-slate-800/50 rounded-lg border border-white/5">
              <p className="text-[10px] text-slate-400 uppercase">Risk</p>
              <p className="text-sm font-bold text-amber-400">{stats.risk}</p>
            </div>
          </div>
          
          <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-between">
            <span className="text-[9px] text-slate-500 font-mono tracking-widest uppercase">earthpulse-ai.vercel.app</span>
            <div className="flex gap-1">
               <div className="w-1 h-1 rounded-full bg-emerald-500" />
               <div className="w-1 h-1 rounded-full bg-emerald-500/50" />
               <div className="w-1 h-1 rounded-full bg-emerald-500/20" />
            </div>
          </div>
        </div>
      </div>

      {/* Post Editor */}
      <div className="space-y-4">
        <textarea 
          value={tweetText}
          onChange={(e) => setTweetText(e.target.value)}
          className="w-full h-24 bg-slate-800/50 border border-slate-700 rounded-lg p-3 text-xs text-slate-300 focus:outline-none focus:border-emerald-500 transition-colors resize-none"
        />
        
        <div className="flex gap-2">
          <Button 
            className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold h-12"
            onClick={generateImage}
            disabled={isGenerating}
          >
            {isGenerating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Download className="w-4 h-4 mr-2" />}
            Save PNG
          </Button>
          <Button 
            className="flex-1 bg-sky-500 hover:bg-sky-400 text-white font-bold h-12"
            onClick={shareToTwitter}
          >
            <Share2 className="w-4 h-4 mr-2" />
            Share on X
          </Button>
        </div>
      </div>
    </Card>
  );
};
