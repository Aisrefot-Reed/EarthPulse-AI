'use client';

import React, { useState, useMemo } from 'react';
import Map, { NavigationControl, FullscreenControl, ScaleControl } from 'react-map-gl/maplibre';
import DeckGL from '@deck.gl/react';
import { TileLayer } from '@deck.gl/geo-layers';
import { BitmapLayer } from '@deck.gl/layers';
import { WebMercatorViewport } from '@deck.gl/core';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

import { useAreaAnalysis } from '@/hooks/useAreaAnalysis';
import { createAILayer, createUncertaintyLayer } from './layers';
import { NarrativeOverlay } from '../story/NarrativeOverlay';
import { ShareCardDialog } from '../ui/ShareCardDialog';
import { cinematicFlyTo, STORY_EVENTS } from '@/lib/story/logic';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';
import { 
  Loader2, Zap, AlertTriangle, Info, Map as MapIcon, 
  Layers, Eye, Share2, Sparkles, X, ChevronRight, ChevronLeft 
} from 'lucide-react';

const INITIAL_VIEW_STATE = {
  longitude: -62.2159,
  latitude: -3.4653,
  zoom: 10,
  pitch: 0,
  bearing: 0
};

export default function MapContainer() {
  const [viewState, setViewState] = useState(INITIAL_VIEW_STATE);
  const [layersVisibility, setLayersVisibility] = useState({
    base: true,
    ai: true,
    uncertainty: false
  });
  const [aiOpacity, setAiOpacity] = useState(0.7);
  const [showShareDialog, setShowShareDialog] = useState(false);
  
  // Story Mode State
  const [isStoryMode, setIsStoryMode] = useState(false);
  const [currentEventIndex, setCurrentEventIndex] = useState(-1);

  const { analyzeArea, loading, result, credits } = useAreaAnalysis();

  const handleAnalyze = () => {
    // Calculate BBox from current viewState
    const viewport = new WebMercatorViewport({
      width: window.innerWidth,
      height: window.innerHeight,
      ...viewState
    });
    const bounds = viewport.getBounds(); // [west, south, east, north]
    analyzeArea(bounds, ['2023-01-01', '2023-12-31']);
  };

  const startStoryMode = () => {
    setIsStoryMode(true);
    handleNextEvent(0);
  };

  const handleNextEvent = (index?: number) => {
    const nextIndex = index !== undefined ? index : currentEventIndex + 1;
    if (nextIndex < STORY_EVENTS.length) {
      setCurrentEventIndex(nextIndex);
      const event = STORY_EVENTS[nextIndex];
      setViewState(cinematicFlyTo(viewState, event.coordinates) as any);
      
      const bbox = [
        event.coordinates.longitude - 0.05,
        event.coordinates.latitude - 0.05,
        event.coordinates.longitude + 0.05,
        event.coordinates.latitude + 0.05
      ];
      analyzeArea(bbox, [event.date, event.date]);
    } else {
      setIsStoryMode(false);
      setCurrentEventIndex(-1);
    }
  };

  const layers = useMemo(() => {
    const activeLayers = [];
    
    // GEE Base Imagery
    if (result?.data?.url) {
      activeLayers.push(new TileLayer({
        id: 'gee-base',
        data: result.data.url,
        visible: layersVisibility.base,
        renderSubLayers: (props: any) => {
          const { west, south, east, north } = props.tile.bbox;
          return new BitmapLayer(props, {
            data: undefined,
            image: props.data,
            bounds: [west, south, east, north]
          });
        }
      }));
    }

    // AI Prediction Layer (Bitmap over BBox)
    const aiLayer = createAILayer(result, layersVisibility.ai, aiOpacity);
    if (aiLayer) activeLayers.push(aiLayer);

    // Uncertainty Layer
    const uncertaintyLayer = createUncertaintyLayer(result, layersVisibility.uncertainty);
    if (uncertaintyLayer) activeLayers.push(uncertaintyLayer);

    return activeLayers;
  }, [result, layersVisibility, aiOpacity]);

  return (
    <div className="relative w-full h-screen bg-slate-50 overflow-hidden font-sans">
      <DeckGL
        viewState={viewState}
        onViewStateChange={({ viewState }) => setViewState(viewState as any)}
        controller={true}
        layers={layers}
      >
        <Map
          mapLib={maplibregl as any}
          mapStyle="https://basemaps.cartocdn.com/gl/positron-gl-style/style.json"
        >
          <div className="absolute top-24 left-6 z-10 flex flex-col gap-2">
            <NavigationControl showCompass={false} />
            <FullscreenControl />
          </div>
          <ScaleControl position="bottom-left" />
        </Map>
      </DeckGL>
      
      {/* Top Header: Logo & Controls */}
      <div className="absolute top-6 inset-x-6 z-20 flex justify-between items-start pointer-events-none">
        <div className="pointer-events-auto glass-panel px-5 py-3 rounded-2xl flex items-center gap-4 shadow-xl border-white/40">
          <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center text-white shadow-lg">
            <MapIcon className="w-5 h-5" />
          </div>
          <div className="flex flex-col">
            <h1 className="text-sm font-black tracking-tight text-slate-800 uppercase">EarthPulse AI</h1>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">v1.2 Satellite Intelligence</span>
          </div>
        </div>

        <div className="pointer-events-auto flex items-center gap-3">
          <div className="px-5 py-2 glass-panel rounded-2xl flex items-center gap-4 border-white/40 shadow-xl">
             <div className="flex items-center gap-2">
                <Zap className={cn("w-4 h-4", credits > 0 ? "text-emerald-500" : "text-slate-400")} />
                <span className="text-xs font-bold text-slate-600">{credits}/20 Analyses</span>
             </div>
             <div className="w-px h-6 bg-slate-200" />
             <Button 
                onClick={handleAnalyze} 
                disabled={loading || credits === 0}
                className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] uppercase tracking-wider rounded-lg px-4"
             >
                {loading ? <Loader2 className="w-3 h-3 animate-spin mr-2" /> : <Sparkles className="w-3 h-3 mr-2" />}
                {loading ? "Analyzing..." : "Analyze Area"}
             </Button>
          </div>

          <Button 
            variant="ghost" 
            onClick={() => setShowShareDialog(true)}
            disabled={!result}
            className="h-12 w-12 glass-panel rounded-2xl flex items-center justify-center border-white/40 shadow-xl text-slate-600 hover:text-emerald-600 transition-colors"
          >
            <Share2 className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* Narrative Overlay (Story Mode) */}
      {isStoryMode && currentEventIndex >= 0 && (
        <div className="absolute inset-0 z-30 flex items-center pointer-events-none">
          <div className="pointer-events-auto ml-10">
            <NarrativeOverlay 
              event={STORY_EVENTS[currentEventIndex]} 
              onClose={() => setIsStoryMode(false)}
              onNext={() => handleNextEvent()}
            />
          </div>
          
          {/* Story Progress Bar */}
          <div className="absolute bottom-32 left-1/2 -translate-x-1/2 flex gap-2 pointer-events-auto bg-white/50 backdrop-blur-md p-2 rounded-full border border-white/50">
             {STORY_EVENTS.map((_, idx) => (
                <div 
                  key={idx} 
                  className={cn(
                    "w-8 h-1 rounded-full transition-all",
                    idx === currentEventIndex ? "bg-emerald-600 w-12" : (idx < currentEventIndex ? "bg-emerald-200" : "bg-slate-200")
                  )} 
                />
             ))}
          </div>
        </div>
      )}

      {/* Right Sidebar: Inspector */}
      {!isStoryMode && (
        <div className="absolute top-24 right-6 z-20 w-80">
          <Card className="p-6 glass-panel border-white/40 shadow-2xl rounded-[2rem]">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <Layers className="w-4 h-4 text-emerald-500" />
                Inspector
              </h2>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={startStoryMode}
                className="text-[10px] font-bold text-emerald-600 uppercase hover:bg-emerald-50 rounded-lg px-2 h-7"
              >
                Launch Story
              </Button>
            </div>
            
            <div className="space-y-6">
              <div className="space-y-3">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Visualization</label>
                <div className="grid grid-cols-2 gap-2">
                   <Button 
                      variant={layersVisibility.ai ? "default" : "outline"} 
                      onClick={() => setLayersVisibility(prev => ({ ...prev, ai: !prev.ai }))}
                      className={cn("h-16 flex flex-col gap-1 rounded-2xl text-[10px] font-bold", layersVisibility.ai ? "bg-emerald-50 text-emerald-600 border-emerald-200" : "bg-transparent text-slate-400 border-slate-100")}
                   >
                      <Eye className="w-4 h-4" />
                      AI Mask
                   </Button>
                   <Button 
                      variant={layersVisibility.uncertainty ? "default" : "outline"} 
                      onClick={() => setLayersVisibility(prev => ({ ...prev, uncertainty: !prev.uncertainty }))}
                      className={cn("h-16 flex flex-col gap-1 rounded-2xl text-[10px] font-bold", layersVisibility.uncertainty ? "bg-amber-50 text-amber-600 border-amber-200" : "bg-transparent text-slate-400 border-slate-100")}
                   >
                      <AlertTriangle className="w-4 h-4" />
                      Risk Map
                   </Button>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Opacity</label>
                  <span className="text-xs font-mono font-bold text-slate-600">{Math.round(aiOpacity * 100)}%</span>
                </div>
                <Slider 
                  value={[aiOpacity * 100]} 
                  onValueChange={(val: any) => setAiOpacity(val[0] / 100)} 
                  max={100} 
                  step={1}
                />
              </div>
              
              {result && (
                <div className="pt-4 border-t border-slate-100 space-y-4">
                   <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Analysis Region</span>
                      <span className="text-xs font-semibold text-slate-700 truncate">{result.bbox.map(c => c.toFixed(2)).join(', ')}</span>
                   </div>
                   <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100/50 flex justify-between items-center">
                      <div className="flex flex-col">
                         <span className="text-[10px] font-bold text-emerald-600 uppercase">Processor</span>
                         <span className="text-xs font-bold text-emerald-900">{result.mode === 'prithvi' ? 'Prithvi-EO' : 'GEE Baseline'}</span>
                      </div>
                      <div className="flex flex-col items-end">
                         <span className="text-[10px] font-bold text-emerald-600 uppercase">Latency</span>
                         <span className="text-xs font-bold text-emerald-900">{result.meta.processingTime}ms</span>
                      </div>
                   </div>
                </div>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* Share Dialog Overlay */}
      {showShareDialog && result && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/20 backdrop-blur-sm">
           <div className="relative animate-in zoom-in-95 duration-200">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setShowShareDialog(false)}
                className="absolute -top-12 right-0 text-white hover:bg-white/10 rounded-full"
              >
                <X className="w-6 h-6" />
              </Button>
              <ShareCardDialog 
                regionName={result.mode === 'prithvi' ? "Premium Analysis" : "GEE Snapshot"}
                stats={{ hectares: 450, co2: 120, risk: result.mode === 'prithvi' ? "High" : "Calculated" }}
              />
           </div>
        </div>
      )}

      {/* Bottom Timeline Legend */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 w-full max-w-4xl px-6 pointer-events-none">
        <div className="glass-panel p-5 rounded-[2.5rem] border-white/50 shadow-2xl flex items-center justify-between pointer-events-auto">
            <div className="flex items-center gap-4">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Global Timeline</div>
              <div className="flex items-center gap-1.5">
                 <Button variant="ghost" size="icon" className="w-8 h-8 rounded-full text-slate-400 hover:text-emerald-600"><ChevronLeft className="w-4 h-4"/></Button>
                 <span className="text-sm font-black text-slate-700 font-mono px-3">2024.Q2</span>
                 <Button variant="ghost" size="icon" className="w-8 h-8 rounded-full text-slate-400 hover:text-emerald-600"><ChevronRight className="w-4 h-4"/></Button>
              </div>
            </div>
            
            <div className="flex-1 max-w-sm px-10">
               <div className="h-1.5 bg-slate-100 rounded-full relative overflow-hidden">
                  <div className="absolute inset-y-0 left-0 w-3/4 bg-emerald-500 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.3)]" />
               </div>
            </div>

            <div className="flex items-center gap-3">
               <div className="flex gap-1">
                  {[1, 2, 3].map(i => <div key={i} className="w-1.5 h-1.5 rounded-full bg-emerald-500/20" />)}
               </div>
               <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">EarthPulse Monitoring</span>
            </div>
        </div>
      </div>
    </div>
  );
}
