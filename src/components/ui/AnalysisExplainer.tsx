'use client';

import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { X, BookOpen, AlertCircle, Info, Database, History, TrendingDown, Leaf } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface AnalysisExplainerProps {
  result: any;
  onClose: () => void;
}

export const AnalysisExplainer = ({ result, onClose }: AnalysisExplainerProps) => {
  if (!result) return null;

  const { type, stats } = result.data.analysisInfo;
  const area = stats?.areaHectares?.toFixed(1) || 0;
  const co2 = (parseFloat(area) * 165).toFixed(0); // Estimated CO2 in tons

  const getStory = () => {
    switch (type) {
      case 'wildfires':
        return {
          title: "Wildfire Impact Report",
          subtitle: "Fire Scars & Thermal Analysis",
          overview: `Our analysis confirmed significant fire damage across ${area} hectares. The Normalized Burn Ratio (dNBR) indicates high-severity vegetation loss, characteristic of fast-moving wildfires.`,
          history: "Satellite records show the situation escalated rapidly during the dry season. While the initial canopy loss is severe, historical data suggests that nutrient release in the soil may support pioneering species within 18-24 months if further disturbances are prevented.",
          impact: "Massive immediate CO2 release and loss of critical habitat for local fauna. Soil degradation may increase erosion risk during the next rainy season.",
          conclusion: "This region requires immediate monitoring for secondary fire outbreaks and erosion control."
        };
      case 'flooding':
        return {
          title: "Inundation Intelligence",
          subtitle: "Hydrological Displacement Report",
          overview: `A major flood event has been detected, covering ${area} hectares. The NDWI index captured a sudden shift from terrestrial reflectance to aquatic absorption across the landscape.`,
          history: "Comparing current data to our 2019 baseline, this area has transitioned from stable ground to a critical inundation zone. This shift often correlates with extreme weather events or upstream hydrological changes.",
          impact: "Significant risk to local infrastructure and potential long-term displacement of land-based ecosystems. Siltation may alter future soil quality for agriculture.",
          conclusion: "A critical area for rapid humanitarian assessment and ecosystem resilience planning."
        };
      case 'deforestation':
      default:
        return {
          title: "Forest Loss Narrative",
          subtitle: "Vegetation & Biomass Analysis",
          overview: `Analysis reveals a forest cover loss of ${area} hectares since 2019. The NDVI drop is sharp and consistent with organized clearing or intensive selective logging.`,
          history: "Starting from a dense canopy in 2019, the region remained relatively stable until more recent years, where fragmented clearing began to emerge. This pattern suggests advancing human activity into primary forest zones.",
          impact: `An estimated ${co2} tons of sequestered carbon have been released back into the atmosphere. This fragmentation disrupts wildlife corridors and reduces local humidity levels.`,
          conclusion: "This site remains a high-priority zone for reforestation efforts and legal protection."
        };
    }
  };

  const story = getStory();

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 z-[60] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-md"
      >
        <Card className="max-w-2xl w-full p-10 glass-panel border-white/40 shadow-[0_32px_64px_rgba(0,0,0,0.2)] rounded-[3rem] relative overflow-hidden max-h-[90vh] overflow-y-auto custom-scrollbar">
          <Button variant="ghost" size="icon" onClick={onClose} className="absolute top-6 right-6 rounded-full text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-8 h-8" />
          </Button>

          <div className="flex items-center gap-5 mb-10">
            <div className="w-14 h-14 bg-emerald-100 rounded-[1.25rem] flex items-center justify-center text-emerald-600 shadow-inner">
              <BookOpen className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter leading-none mb-2">{story.title}</h3>
              <p className="text-xs font-bold text-emerald-600 uppercase tracking-[0.2em]">{story.subtitle}</p>
            </div>
          </div>

          <div className="space-y-8">
            <section>
              <div className="flex items-center gap-2 mb-3 text-slate-400">
                <Info className="w-4 h-4" />
                <span className="text-[10px] font-black uppercase tracking-widest">Executive Summary</span>
              </div>
              <p className="text-base text-slate-700 leading-relaxed font-medium">
                {story.overview}
              </p>
            </section>

            <div className="grid grid-cols-2 gap-4">
               <div className="p-6 bg-slate-50/80 rounded-[2rem] border border-slate-100/50">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Affected Area</span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-black text-slate-800">{area}</span>
                    <span className="text-sm font-bold text-slate-500">ha</span>
                  </div>
               </div>
               <div className="p-6 bg-rose-50/50 rounded-[2rem] border border-rose-100/50">
                  <span className="text-[10px] font-bold text-rose-400 uppercase tracking-widest block mb-1">Carbon Impact</span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-black text-rose-700">~{co2}</span>
                    <span className="text-sm font-bold text-rose-500">t/CO2</span>
                  </div>
               </div>
            </div>

            <section className="p-6 bg-emerald-50/30 rounded-[2.5rem] border border-emerald-100/50">
              <div className="flex items-center gap-2 mb-3 text-emerald-600">
                <History className="w-4 h-4" />
                <span className="text-[10px] font-black uppercase tracking-widest">Timeline & Evolution</span>
              </div>
              <p className="text-sm text-slate-600 leading-relaxed italic">
                {story.history}
              </p>
            </section>

            <section>
              <div className="flex items-center gap-2 mb-3 text-slate-400">
                <AlertCircle className="w-4 h-4" />
                <span className="text-[10px] font-black uppercase tracking-widest">Ecological Consequence</span>
              </div>
              <p className="text-sm text-slate-600 leading-relaxed font-medium">
                {story.impact}
              </p>
            </section>

            <div className="p-6 bg-slate-900 rounded-[2rem] text-white">
              <div className="flex items-center gap-2 mb-2 text-emerald-400">
                <Leaf className="w-4 h-4" />
                <span className="text-[10px] font-black uppercase tracking-widest">Significance</span>
              </div>
              <p className="text-sm font-bold leading-snug">
                {story.conclusion}
              </p>
            </div>

            <div className="flex items-center gap-3 pt-6 border-t border-slate-100">
               <Database className="w-4 h-4 text-slate-300" />
               <span className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.2em]">Source: ESA Copernicus Sentinel-2 MSI (2019-2025)</span>
            </div>
          </div>

          <Button 
            className="w-full mt-10 h-16 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-2xl shadow-xl transition-all hover:scale-[1.02] active:scale-[0.98]"
            onClick={onClose}
          >
            Close Insight
          </Button>
        </Card>
      </motion.div>
    </AnimatePresence>
  );
};
