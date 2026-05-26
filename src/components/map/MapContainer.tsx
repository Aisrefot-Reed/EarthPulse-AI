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
  Loader2, Zap, AlertTriangle, Map as MapIcon, 
  Layers, Eye, Share2, Sparkles, X, ChevronRight, ChevronLeft 
} from 'lucide-react';

import { toPng } from 'html-to-image';

const INITIAL_VIEW_STATE = {
  longitude: -62.2159,
  latitude: -3.4653,
  zoom: 10,
  pitch: 0,
  bearing: 0
};

export default function MapContainer() {
  const mapContainerRef = React.useRef<HTMLDivElement>(null);
  const [viewState, setViewState] = useState(INITIAL_VIEW_STATE);
  const [layersVisibility, setLayersVisibility] = useState({
    base: true,
    ai: true,
    uncertainty: false
  });
  const [aiOpacity, setAiOpacity] = useState(0.7);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [mapScreenshot, setMapScreenshot] = useState<string | undefined>();
  
  // Story Mode State
  const [isStoryMode, setIsStoryMode] = useState(false);
  const [currentEventIndex, setCurrentEventIndex] = useState(-1);

  const { analyzeArea, loading, result, credits } = useAreaAnalysis();

  const handleAnalyze = () => {
    const viewport = new WebMercatorViewport({
      width: window.innerWidth,
      height: window.innerHeight,
      ...viewState
    });
    const bounds = viewport.getBounds(); 
    analyzeArea(bounds, ['2023-01-01', '2023-12-31']);
  };

  const handleOpenShare = async () => {
    if (mapContainerRef.current) {
      try {
        const dataUrl = await toPng(mapContainerRef.current, { 
          quality: 0.8, 
          cacheBust: true,
          skipFonts: true // Speed up capture
        });
        setMapScreenshot(dataUrl);
      } catch (err) {
        console.error("Screenshot failed", err);
      }
    }
    setShowShareDialog(true);
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
    const aiLayer = createAILayer(result, layersVisibility.ai, aiOpacity);
    if (aiLayer) activeLayers.push(aiLayer);
    const uncertaintyLayer = createUncertaintyLayer(result, layersVisibility.uncertainty);
    if (uncertaintyLayer) activeLayers.push(uncertaintyLayer);
    return activeLayers;
  }, [result, layersVisibility, aiOpacity]);

  return (
    <div className="relative w-full h-screen bg-slate-50 overflow-hidden font-sans select-none">
      {/* 0 & 10: Map & Data Layers */}
      <DeckGL
        viewState={viewState}
        onViewStateChange={({ viewState }) => setViewState(viewState as any)}
        controller={true}
        layers={layers}
        style={{ zIndex: '0' }}
      >
        <Map
          mapLib={maplibregl as any}
          mapStyle="https://basemaps.cartocdn.com/gl/positron-gl-style/style.json"
        >
          <div className="absolute top-32 left-6 z-10 flex flex-col gap-2 pointer-events-auto">
            <NavigationControl showCompass={false} />
            <FullscreenControl />
          </div>
          <ScaleControl position="bottom-left" />
        </Map>
      </DeckGL>

      {/* Dimmer Overlay for Modals */}
      <div className={cn("map-dimmer", showShareDialog && "active")} onClick={() => setShowShareDialog(false)} />

      {/* Overlays Container (Non-blocking) */}
      <div className="absolute inset-0 z-20 pointer-events-none p-6 flex flex-col justify-between">
        
        {/* Top Section: Header & Quick Actions */}
        <div className="flex justify-between items-start w-full">
          <div className="pointer-events-auto glass-panel px-5 py-3 rounded-2xl flex items-center gap-4 border-white/40 shadow-xl max-w-[280px] md:max-w-none">
            <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center text-white shadow-lg shrink-0">
              <MapIcon className="w-5 h-5" />
            </div>
            <div className="flex flex-col truncate">
              <h1 className="text-sm font-black tracking-tight text-slate-800 uppercase truncate">EarthPulse AI</h1>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Satellite Intel v1.2</span>
            </div>
          </div>

          <div className="flex flex-col md:flex-row items-end md:items-start gap-3 pointer-events-auto">
            <div className="px-4 py-2 glass-panel rounded-2xl flex items-center gap-3 border-white/40 shadow-lg">
               <div className="flex items-center gap-2">
                  <Zap className={cn("w-4 h-4", credits > 0 ? "text-emerald-500" : "text-slate-400")} />
                  <span className="text-[11px] font-bold text-slate-600 whitespace-nowrap">{credits}/20</span>
               </div>
               <div className="w-px h-5 bg-slate-200" />
               <Button 
                  onClick={handleAnalyze} 
                  disabled={loading || credits === 0}
                  className="h-7 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[9px] uppercase tracking-wider rounded-lg px-3"
               >
                  {loading ? <Loader2 className="w-3 h-3 animate-spin mr-1.5" /> : <Sparkles className="w-3 h-3 mr-1.5" />}
                  {loading ? "Busy" : "Analyze"}
               </Button>
            </div>

            <Button 
              variant="ghost" 
              onClick={() => setShowShareDialog(true)}
              disabled={!result}
              className="h-11 w-11 glass-panel rounded-xl flex items-center justify-center border-white/40 shadow-lg text-slate-600 hover:text-emerald-600 transition-colors"
            >
              <Share2 className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Middle Section: Story Overlays (z-40 focus) */}
        <div className="flex-1 flex items-center justify-start py-10">
          {isStoryMode && currentEventIndex >= 0 && (
            <div className="pointer-events-auto max-w-[90vw] md:max-w-md animate-in slide-in-from-left-10 duration-500">
              <NarrativeOverlay 
                event={STORY_EVENTS[currentEventIndex]} 
                onClose={() => setIsStoryMode(false)}
                onNext={() => handleNextEvent()}
              />
            </div>
          )}
        </div>

        {/* Bottom Section: Timeline & Progress */}
        <div className="flex flex-col gap-4 items-center w-full">
          {isStoryMode && (
            <div className="pointer-events-auto bg-white/60 backdrop-blur-md px-6 py-2.5 rounded-full border border-white/50 shadow-xl flex gap-3 animate-in fade-in zoom-in-95">
               {STORY_EVENTS.map((_, idx) => (
                  <div 
                    key={idx} 
                    className={cn(
                      "w-10 h-1.5 rounded-full transition-all duration-700",
                      idx === currentEventIndex ? "bg-emerald-600 w-16 shadow-[0_0_10px_rgba(16,185,129,0.4)]" : (idx < currentEventIndex ? "bg-emerald-200" : "bg-slate-200")
                    )} 
                  />
               ))}
            </div>
          )}

          <div className="w-full max-w-4xl pointer-events-auto">
            <div className="glass-panel p-4 md:p-5 rounded-[2rem] md:rounded-[2.5rem] border-white/50 shadow-2xl flex flex-col md:flex-row items-center gap-4 md:gap-8 overflow-hidden">
                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Global Timeline</div>
                  <div className="flex items-center gap-1">
                     <Button variant="ghost" size="icon" className="w-8 h-8 rounded-full text-slate-400 hover:text-emerald-600"><ChevronLeft className="w-4 h-4"/></Button>
                     <span className="text-xs font-black text-slate-700 font-mono px-2">2024.Q2</span>
                     <Button variant="ghost" size="icon" className="w-8 h-8 rounded-full text-slate-400 hover:text-emerald-600"><ChevronRight className="w-4 h-4"/></Button>
                  </div>
                </div>
                
                <div className="flex-1 w-full px-2 md:px-4">
                   <div className="h-1.5 bg-slate-100 rounded-full relative overflow-hidden">
                      <div className="absolute inset-y-0 left-0 w-3/4 bg-emerald-500 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.3)] transition-all duration-1000" />
                   </div>
                </div>

                <div className="hidden md:flex items-center gap-3 shrink-0 border-l border-slate-100 pl-8">
                   <div className="flex gap-1">
                      {[1, 2, 3].map(i => <div key={i} className="w-1.5 h-1.5 rounded-full bg-emerald-500/20" />)}
                   </div>
                   <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">EarthPulse Monitoring</span>
                </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Fixed Inspector (z-40) */}
      {!isStoryMode && (
        <div className="absolute top-32 right-6 z-40 w-72 md:w-80 pointer-events-auto hidden sm:block animate-in slide-in-from-right-10 duration-500">
          <Card className="p-6 glass-panel border-white/40 shadow-2xl rounded-[2.5rem]">
            <div className="flex items-center justify-between mb-8">
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
            
            <div className="space-y-8">
              <div className="space-y-4">
                <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Visualization</label>
                <div className="grid grid-cols-2 gap-3">
                   <Button 
                      variant={layersVisibility.ai ? "default" : "outline"} 
                      onClick={() => setLayersVisibility(prev => ({ ...prev, ai: !prev.ai }))}
                      className={cn("h-16 flex flex-col gap-1.5 rounded-2xl text-[10px] font-bold transition-all", layersVisibility.ai ? "bg-emerald-50 text-emerald-600 border-emerald-200 shadow-sm" : "bg-transparent text-slate-400 border-slate-100 hover:border-slate-200")}
                   >
                      <Eye className="w-4 h-4" />
                      AI Mask
                   </Button>
                   <Button 
                      variant={layersVisibility.uncertainty ? "default" : "outline"} 
                      onClick={() => setLayersVisibility(prev => ({ ...prev, uncertainty: !prev.uncertainty }))}
                      className={cn("h-16 flex flex-col gap-1.5 rounded-2xl text-[10px] font-bold transition-all", layersVisibility.uncertainty ? "bg-amber-50 text-amber-600 border-amber-200 shadow-sm" : "bg-transparent text-slate-400 border-slate-100 hover:border-slate-200")}
                   >
                      <AlertTriangle className="w-4 h-4" />
                      Risk Map
                   </Button>
                </div>
              </div>

              <div className="space-y-5">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Opacity</label>
                  <span className="text-xs font-mono font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">{Math.round(aiOpacity * 100)}%</span>
                </div>
                <Slider 
                  value={[aiOpacity * 100]} 
                  onValueChange={(val: any) => setAiOpacity(val[0] / 100)} 
                  max={100} 
                  step={1}
                />
              </div>
              
              {result && (
                <div className="pt-6 border-t border-slate-100 space-y-4">
                   <div className="flex flex-col gap-1.5">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Analysis Region</span>
                      <span className="text-[11px] font-semibold text-slate-700 truncate bg-slate-50 p-2 rounded-lg border border-slate-100/50">{result.bbox.map(c => c.toFixed(3)).join(', ')}</span>
                   </div>
                   <div className="flex flex-col gap-2">
                      <div className="flex justify-between items-center">
                         <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Analysis Engine</span>
                         <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Latency</span>
                      </div>
                      <div className="flex justify-between items-center p-3 rounded-xl border bg-white shadow-sm">
                         {result.mode === 'prithvi' ? (
                           <div className="flex items-center gap-2">
                             <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                             <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100/50 px-2 py-1 rounded-md border border-emerald-200">Premium AI (Prithvi-EO)</span>
                           </div>
                         ) : (
                           <div className="flex items-center gap-2">
                             <div className="w-2 h-2 rounded-full bg-blue-500" />
                             <span className="text-[11px] font-bold text-blue-700 bg-blue-100/50 px-2 py-1 rounded-md border border-blue-200">Standard (GEE)</span>
                           </div>
                         )}
                         <span className="text-[11px] font-bold text-slate-600 font-mono">{result.meta.processingTime}ms</span>
                      </div>
                   </div>
                </div>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* Share Dialog Overlay (z-50) */}
      {showShareDialog && result && (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-6 pointer-events-auto">
           <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-500" onClick={() => setShowShareDialog(false)} />
           <div className="relative animate-in zoom-in-95 slide-in-from-bottom-10 duration-500 max-w-lg w-full">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setShowShareDialog(false)}
                className="absolute -top-14 right-0 text-white hover:bg-white/20 rounded-full transition-colors"
              >
                <X className="w-8 h-8" />
              </Button>
              <ShareCardDialog 
                regionName={result.mode === 'prithvi' ? "Premium Analysis" : "GEE Snapshot"}
                stats={{ hectares: 450, co2: 120, risk: result.mode === 'prithvi' ? "High" : "Calculated" }}
              />
           </div>
        </div>
      )}
    </div>
  );
}
