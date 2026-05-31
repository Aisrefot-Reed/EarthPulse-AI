'use client';

import React, { useState, useMemo, useEffect } from 'react';
import Map, { NavigationControl, FullscreenControl, ScaleControl } from 'react-map-gl/maplibre';
import DeckGL from '@deck.gl/react';
import { TileLayer } from '@deck.gl/geo-layers';
import { BitmapLayer } from '@deck.gl/layers';
import { WebMercatorViewport } from '@deck.gl/core';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

import { useAreaAnalysis, AnalysisMode, AnalysisType } from '@/hooks/useAreaAnalysis';
import { createAILayer } from './layers';
import { NarrativeOverlay } from '../story/NarrativeOverlay';
import { ShareCardDialog } from '../ui/ShareCardDialog';
import { AnalysisExplainer } from '../ui/AnalysisExplainer';
import { cinematicFlyTo, STORY_EVENTS } from '@/lib/story/logic';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';
import { 
  Loader2, Zap, AlertTriangle, Map as MapIcon, 
  Layers, Eye, Share2, Sparkles, X, ChevronRight, ChevronLeft,
  Cpu, Activity, Flame, Droplets, TreePine, BookOpen
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
  const [layersVisibility, setLayersVisibility] = useState({ base: true, ai: true, raster: true });
  const [aiOpacity, setAiOpacity] = useState(0.7);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [showExplainer, setShowExplainer] = useState(false);
  const [mapScreenshot, setMapScreenshot] = useState<string | undefined>();
  
  const [requestedMode, setRequestedMode] = useState<AnalysisMode>('prithvi');
  const [analysisType, setAnalysisType] = useState<AnalysisType>('deforestation');
  const [currentYear, setCurrentYear] = useState(2024);

  useEffect(() => {
    const savedMode = localStorage.getItem('earthpulse_analysis_mode') as AnalysisMode;
    if (savedMode) setRequestedMode(savedMode);
  }, []);

  const toggleMode = (mode: AnalysisMode) => {
    setRequestedMode(mode);
    localStorage.setItem('earthpulse_analysis_mode', mode);
  };

  const dateRange = useMemo<[string, string]>(() => [`${currentYear}-01-01`, `${currentYear}-12-31`], [currentYear]);

  const { analyzeArea, loading, result, credits } = useAreaAnalysis();

  const handleAnalyze = () => {
    const viewport = new WebMercatorViewport({ width: window.innerWidth, height: window.innerHeight, ...viewState });
    analyzeArea(viewport.getBounds(), dateRange, requestedMode, analysisType);
  };

  const handleOpenShare = async () => {
    if (mapContainerRef.current) {
      try {
        const dataUrl = await toPng(mapContainerRef.current, { quality: 0.8, cacheBust: true, skipFonts: true });
        setMapScreenshot(dataUrl);
      } catch (err) { console.error(err); }
    }
    setShowShareDialog(true);
  };

  const [isStoryMode, setIsStoryMode] = useState(false);
  const [currentEventIndex, setCurrentEventIndex] = useState(-1);

  const startStoryMode = () => { setIsStoryMode(true); handleNextEvent(0); };

  const handleNextEvent = (index?: number) => {
    const nextIndex = index !== undefined ? index : currentEventIndex + 1;
    if (nextIndex < STORY_EVENTS.length) {
      setCurrentEventIndex(nextIndex);
      const event = STORY_EVENTS[nextIndex];
      setViewState(cinematicFlyTo(viewState, event.coordinates) as any);
      analyzeArea([event.coordinates.longitude-0.1, event.coordinates.latitude-0.1, event.coordinates.longitude+0.1, event.coordinates.latitude+0.1], [event.date, event.date], 'prithvi', 'deforestation');
    } else {
      setIsStoryMode(false);
      setCurrentEventIndex(-1);
    }
  };

  const layers = useMemo(() => {
    const activeLayers = [];
    
    if (result?.data?.url) {
      activeLayers.push(new TileLayer({
        id: 'gee-base', data: result.data.url, visible: layersVisibility.base,
        renderSubLayers: (props: any) => {
          const { west, south, east, north } = props.tile.bbox;
          return new BitmapLayer(props, { data: undefined, image: props.data, bounds: [west, south, east, north] });
        }
      }));
    }

    if (result?.data?.changeUrl) {
       activeLayers.push(new TileLayer({
          id: 'gee-raster-mask', 
          data: result.data.changeUrl, 
          visible: layersVisibility.raster,
          opacity: aiOpacity, // FIX: Apply aiOpacity here
          renderSubLayers: (props: any) => {
            const { west, south, east, north } = props.tile.bbox;
            return new BitmapLayer(props, { data: undefined, image: props.data, bounds: [west, south, east, north] });
          },
          updateTriggers: {
            opacity: aiOpacity
          }
       }));
    }

    // FIX: Pass aiOpacity to vectors
    const aiLayer = createAILayer(result, layersVisibility.ai, aiOpacity);
    if (aiLayer) activeLayers.push(aiLayer);

    return activeLayers;
  }, [result, layersVisibility, aiOpacity]);

  return (
    <div className="relative w-full h-screen bg-slate-50 overflow-hidden font-sans select-none" ref={mapContainerRef}>
      <DeckGL viewState={viewState} onViewStateChange={({ viewState }) => setViewState(viewState as any)} controller={true} layers={layers} style={{ zIndex: '0' }}>
        <Map mapLib={maplibregl as any} mapStyle="https://basemaps.cartocdn.com/gl/positron-gl-style/style.json">
          <div className="absolute top-32 left-6 z-10 flex flex-col gap-2 pointer-events-auto">
            <NavigationControl showCompass={false} />
            <FullscreenControl />
          </div>
          <ScaleControl position="bottom-left" />
        </Map>
      </DeckGL>

      <div className={cn("map-dimmer", (showShareDialog || isStoryMode || showExplainer) && "active-dim")} />

      {/* Header Overlay */}
      <div className="absolute top-6 inset-x-6 z-20 flex justify-between items-start pointer-events-none">
        <div className="pointer-events-auto glass-panel px-5 py-3 rounded-2xl flex items-center gap-4 border-white/40 shadow-xl">
          <TreePine className="w-8 h-8 text-emerald-600" />
          <div className="flex flex-col">
            <h1 className="text-sm font-black tracking-tight text-slate-800 uppercase leading-none">EarthPulse AI</h1>
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Eco Insight Engine</span>
          </div>
        </div>

        <div className="flex items-center gap-3 pointer-events-auto">
          <div className="px-4 py-2 glass-panel rounded-2xl flex items-center gap-3 border-white/40 shadow-lg">
               <Zap className={cn("w-3.5 h-3.5", credits > 0 ? "text-emerald-500 fill-current" : "text-slate-400")} />
               <span className="text-[11px] font-bold text-slate-600">{credits}/20</span>
               <div className="w-px h-5 bg-slate-200" />
               <Button onClick={handleAnalyze} disabled={loading || (requestedMode === 'prithvi' && credits === 0)} className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] uppercase tracking-wider rounded-lg px-4 shadow-md">
                {loading ? <Loader2 className="animate-spin w-3 h-3 mr-2" /> : <Sparkles className="w-3 h-3 mr-2" />}
                Analyze
             </Button>
          </div>
          <Button variant="ghost" onClick={handleOpenShare} disabled={!result} className="h-12 w-12 glass-panel rounded-2xl flex items-center justify-center border-white/40 shadow-lg text-slate-600 hover:text-emerald-600 transition-all"><Share2 className="w-5 h-5" /></Button>
        </div>
      </div>

      {/* Story Overlay */}
      {isStoryMode && currentEventIndex >= 0 && (
        <div className="absolute inset-0 z-30 flex items-center pointer-events-none">
          <div className="pointer-events-auto ml-10 max-w-sm">
            <NarrativeOverlay 
              event={STORY_EVENTS[currentEventIndex]} 
              onClose={() => setIsStoryMode(false)}
              onNext={() => handleNextEvent()}
            />
          </div>
          <div className="absolute bottom-32 left-1/2 -translate-x-1/2 flex gap-3 pointer-events-auto bg-white/60 backdrop-blur-md px-6 py-2 rounded-full border border-white/40 shadow-2xl">
             {STORY_EVENTS.map((_, idx) => (
                <div key={idx} className={cn("w-10 h-1 rounded-full transition-all duration-500", idx === currentEventIndex ? "bg-emerald-600 w-16 shadow-[0_0_10px_rgba(16,185,129,0.5)]" : (idx < currentEventIndex ? "bg-emerald-200" : "bg-slate-200"))} />
             ))}
          </div>
        </div>
      )}

      {/* Inspector Sidebar */}
      {!isStoryMode && (
        <div className="absolute top-32 right-6 z-40 w-80 pointer-events-auto animate-in slide-in-from-right-10 duration-500">
          <Card className="p-6 glass-panel border-white/40 shadow-2xl rounded-[2.5rem] space-y-8">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-800 flex items-center gap-2"><Layers className="w-4 h-4 text-emerald-500" />Inspector</h2>
              <Button variant="ghost" size="sm" onClick={startStoryMode} className="text-[10px] font-bold text-emerald-600 uppercase hover:bg-emerald-50 rounded-lg h-7 px-3 border border-emerald-100">Story</Button>
            </div>
            
            <div className="space-y-4">
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Analysis Type</label>
              <div className="grid grid-cols-3 gap-2">
                <Button variant={analysisType === 'deforestation' ? "default" : "outline"} onClick={() => setAnalysisType('deforestation')} className={cn("h-14 flex flex-col gap-1 rounded-xl text-[9px] font-bold transition-all", analysisType === 'deforestation' ? "bg-emerald-50 text-emerald-600 border-emerald-200 shadow-sm" : "bg-transparent text-slate-400 border-slate-100")}>
                  <TreePine className="w-4 h-4" />Forest
                </Button>
                <Button variant={analysisType === 'wildfires' ? "default" : "outline"} onClick={() => setAnalysisType('wildfires')} className={cn("h-14 flex flex-col gap-1 rounded-xl text-[9px] font-bold transition-all", analysisType === 'wildfires' ? "bg-orange-50 text-orange-600 border-orange-200 shadow-sm" : "bg-transparent text-slate-400 border-slate-100")}>
                  <Flame className="w-4 h-4" />Fire
                </Button>
                <Button variant={analysisType === 'flooding' ? "default" : "outline"} onClick={() => setAnalysisType('flooding')} className={cn("h-14 flex flex-col gap-1 rounded-xl text-[9px] font-bold transition-all", analysisType === 'flooding' ? "bg-blue-50 text-blue-600 border-blue-200 shadow-sm" : "bg-transparent text-slate-400 border-slate-100")}>
                  <Droplets className="w-4 h-4" />Flood
                </Button>
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Analysis Mode</label>
              <div className="flex p-1 bg-slate-100/50 rounded-2xl border border-slate-200/50">
                <button onClick={() => toggleMode('prithvi')} className={cn("flex-1 py-2 rounded-xl text-[10px] font-bold transition-all", requestedMode === 'prithvi' ? "bg-white text-emerald-600 shadow-sm border border-emerald-100" : "text-slate-400 hover:text-slate-600")}>Premium AI</button>
                <button onClick={() => toggleMode('gee')} className={cn("flex-1 py-2 rounded-xl text-[10px] font-bold transition-all", requestedMode === 'gee' ? "bg-white text-blue-600 shadow-sm border border-blue-100" : "text-slate-400 hover:text-slate-600")}>Standard GEE</button>
              </div>
            </div>

            <div className="space-y-5">
              <div className="flex justify-between items-center">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Opacity</label>
                <span className="text-xs font-mono font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                  {isNaN(aiOpacity) ? '70' : Math.round(aiOpacity * 100)}%
                </span>
              </div>
              <Slider 
                value={[isNaN(aiOpacity) ? 70 : aiOpacity * 100]} 
                onValueChange={(val: any) => {
                  if (Array.isArray(val) && val.length > 0) {
                    const newOpacity = parseFloat(val[0]) / 100;
                    if (!isNaN(newOpacity)) {
                      setAiOpacity(newOpacity);
                    }
                  }
                }} 
                max={100} 
                min={0}
                step={1} 
              />
            </div>
            
            {result && (
              <div className="pt-6 border-t border-slate-100 space-y-4">
                <div className="flex justify-between items-center p-3 rounded-xl border bg-white shadow-sm transition-all border-emerald-100">
                  <div className="flex items-center gap-2">
                    <div className={cn("w-2 h-2 rounded-full animate-pulse", result.mode === 'prithvi' ? "bg-emerald-500" : "bg-blue-500")} />
                    <span className="text-[11px] font-bold text-slate-700 uppercase">{result.mode === 'prithvi' ? 'AI Active' : 'GEE Active'}</span>
                  </div>
                  <span className="text-[11px] font-bold text-slate-400 font-mono">{result.meta.processingTime}ms</span>
                </div>
                
                <div className="flex gap-2">
                  <div className="flex-1 p-4 bg-emerald-50/50 rounded-2xl border border-emerald-100/50">
                    <div className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-1">Area</div>
                    <span className="text-2xl font-black text-slate-800">{result.data.analysisInfo?.stats?.areaHectares?.toFixed(1) || 0} ha</span>
                  </div>
                  {/* EXPLAIN BUTTON */}
                  <Button 
                    onClick={() => setShowExplainer(true)}
                    className="h-auto aspect-square bg-slate-900 hover:bg-slate-800 text-white rounded-2xl flex flex-col gap-1 items-center justify-center shadow-lg"
                  >
                    <BookOpen className="w-5 h-5" />
                    <span className="text-[8px] font-black uppercase">Рассказать</span>
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Timeline Footer */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 w-full max-w-4xl px-6 pointer-events-none">
        <Card className="glass-panel p-5 rounded-[2.5rem] border-white/50 shadow-2xl flex items-center gap-8 pointer-events-auto">
            <div className="flex items-center gap-3 shrink-0">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Global Timeline</span>
              <div className="flex items-center bg-slate-100/50 rounded-xl p-1 border border-slate-200/50">
                 <Button variant="ghost" size="icon" onClick={() => setCurrentYear(y => Math.max(2019, y-1))} className="w-8 h-8 rounded-lg text-slate-400 hover:text-emerald-600"><ChevronLeft className="w-4 h-4"/></Button>
                 <span className="text-sm font-black text-slate-700 font-mono px-4">{currentYear}</span>
                 <Button variant="ghost" size="icon" onClick={() => setCurrentYear(y => Math.min(2025, y+1))} className="w-8 h-8 rounded-lg text-slate-400 hover:text-emerald-600"><ChevronRight className="w-4 h-4"/></Button>
              </div>
            </div>
            <div className="flex-1 px-4">
               <div className="h-1.5 bg-slate-100 rounded-full relative overflow-hidden">
                  <div className="absolute inset-y-0 left-0 bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all duration-1000 shadow-[0_0_8px_rgba(16,185,129,0.3)]" style={{ width: `${((currentYear - 2019) / 6) * 100}%` }} />
               </div>
            </div>
            <div className="hidden md:flex items-center gap-2 shrink-0 border-l border-slate-100 pl-8">
               <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
               <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">Live Monitoring</span>
            </div>
        </Card>
      </div>

      {showShareDialog && result && (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-6 pointer-events-auto">
           <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-500" onClick={() => setShowShareDialog(false)} />
           <div className="relative animate-in zoom-in-95 slide-in-from-bottom-10 duration-500 max-w-lg w-full">
              <Button variant="ghost" size="icon" onClick={() => setShowShareDialog(false)} className="absolute -top-14 right-0 text-white hover:bg-white/20 rounded-full"><X className="w-8 h-8" /></Button>
              <ShareCardDialog 
                regionName={result.mode === 'prithvi' ? "Premium AI Analysis" : "Standard GEE Analysis"}
                stats={{ hectares: result.data.analysisInfo?.stats?.areaHectares || 0, co2: 120, risk: result.mode === 'prithvi' ? "Verified" : "Calculated" }}
                mapScreenshot={mapScreenshot}
              />
           </div>
        </div>
      )}

      {/* EXPLAINER OVERLAY */}
      {showExplainer && result && (
        <AnalysisExplainer 
          result={result} 
          onClose={() => setShowExplainer(false)} 
        />
      )}
    </div>
  );
}
