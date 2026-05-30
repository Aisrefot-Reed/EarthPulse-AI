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
import { cinematicFlyTo, STORY_EVENTS } from '@/lib/story/logic';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';
import { 
  Loader2, Zap, AlertTriangle, Map as MapIcon, 
  Layers, Eye, Share2, Sparkles, X, ChevronRight, ChevronLeft,
  Cpu, Activity, Flame, Droplets, TreePine
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
  const [mapScreenshot, setMapScreenshot] = useState<string | undefined>();
  
  // Modes & Types
  const [requestedMode, setRequestedMode] = useState<AnalysisMode>('prithvi');
  const [analysisType, setAnalysisType] = useState<AnalysisType>('deforestation');
  const [currentYear, setCurrentYear] = useState(2024);

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

  const startStoryMode = () => { setIsStoryMode(true); handleNextEvent(0); };

  // Story Mode State
  const [isStoryMode, setIsStoryMode] = useState(false);
  const [currentEventIndex, setCurrentEventIndex] = useState(-1);

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
    
    // 1. GEE Base Imagery
    if (result?.data?.url) {
      activeLayers.push(new TileLayer({
        id: 'gee-base', data: result.data.url, visible: layersVisibility.base,
        renderSubLayers: (props: any) => {
          const { west, south, east, north } = props.tile.bbox;
          return new BitmapLayer(props, { data: undefined, image: props.data, bounds: [west, south, east, north] });
        }
      }));
    }

    // 2. GEE Raster Mask Fallback (Always present for heatmap look)
    if (result?.data?.changeUrl) {
       activeLayers.push(new TileLayer({
          id: 'gee-raster-mask', 
          data: result.data.changeUrl, 
          visible: layersVisibility.raster,
          opacity: aiOpacity,
          renderSubLayers: (props: any) => {
            const { west, south, east, north } = props.tile.bbox;
            return new BitmapLayer(props, { data: undefined, image: props.data, bounds: [west, south, east, north] });
          }
       }));
    }

    // 3. Pro GeoJSON Polygons
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

      <div className={cn("map-dimmer", showShareDialog && "active")} onClick={() => setShowShareDialog(false)} />

      <div className="absolute inset-0 z-20 pointer-events-none p-6 flex flex-col justify-between">
        {/* Top bar */}
        <div className="flex justify-between items-start w-full">
          <div className="pointer-events-auto glass-panel px-5 py-3 rounded-2xl flex items-center gap-4 border-white/40 shadow-xl">
            <TreePine className="w-6 h-6 text-emerald-600" />
            <div className="flex flex-col">
              <h1 className="text-sm font-black tracking-tight text-slate-800 uppercase leading-none">EarthPulse</h1>
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Satellite Intelligence</span>
            </div>
          </div>

          <div className="flex items-center gap-3 pointer-events-auto">
            <div className="px-4 py-2 glass-panel rounded-2xl flex items-center gap-3 border-white/40 shadow-lg">
               <Zap className={cn("w-4 h-4", credits > 0 ? "text-emerald-500" : "text-slate-400")} />
               <span className="text-[11px] font-bold text-slate-600">{credits}/20</span>
               <div className="w-px h-5 bg-slate-200" />
               <Button onClick={handleAnalyze} disabled={loading} className="h-7 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[9px] uppercase tracking-wider rounded-lg px-3">
                  {loading ? <Loader2 className="animate-spin w-3 h-3" /> : "Analyze Area"}
               </Button>
            </div>
            <Button variant="ghost" onClick={handleOpenShare} disabled={!result} className="h-11 w-11 glass-panel rounded-xl flex items-center justify-center border-white/40 shadow-lg"><Share2 className="w-5 h-5 text-slate-600" /></Button>
          </div>
        </div>

        <div className="flex-1" />

        {/* Bottom Timeline */}
        <div className="w-full max-w-4xl self-center pointer-events-auto mb-4">
           <Card className="glass-panel p-5 rounded-[2rem] border-white/40 shadow-2xl flex items-center gap-8">
              <div className="flex items-center gap-3">
                 <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Timeline</span>
                 <div className="flex items-center bg-slate-100/50 rounded-xl p-1 border border-slate-200/50">
                    <Button variant="ghost" size="icon" onClick={() => setCurrentYear(y => Math.max(2019, y-1))} className="w-7 h-7 rounded-lg"><ChevronLeft className="w-4 h-4" /></Button>
                    <span className="text-xs font-black text-slate-700 font-mono px-4">{currentYear}</span>
                    <Button variant="ghost" size="icon" onClick={() => setCurrentYear(y => Math.min(2025, y+1))} className="w-7 h-7 rounded-lg"><ChevronRight className="w-4 h-4" /></Button>
                 </div>
              </div>
              <div className="flex-1 h-1.5 bg-slate-100 rounded-full relative overflow-hidden">
                 <div className="absolute inset-y-0 left-0 bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${((currentYear - 2019) / 6) * 100}%` }} />
              </div>
              <div className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest shrink-0">Live Sentinel-2 Feed</div>
           </Card>
        </div>
      </div>

      {/* Right Fixed Inspector */}
      <div className="absolute top-32 right-6 z-40 w-80 pointer-events-auto">
        <Card className="p-6 glass-panel border-white/40 shadow-2xl rounded-[2.5rem] space-y-8">
          <div className="space-y-3">
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Analysis Type</label>
            <div className="grid grid-cols-3 gap-2">
              <Button variant={analysisType === 'deforestation' ? "default" : "outline"} onClick={() => setAnalysisType('deforestation')} className={cn("h-14 flex flex-col gap-1 rounded-xl text-[9px] font-bold", analysisType === 'deforestation' ? "bg-emerald-50 text-emerald-600 border-emerald-200" : "bg-transparent text-slate-400")}>
                <TreePine className="w-4 h-4" /> Forest
              </Button>
              <Button variant={analysisType === 'wildfires' ? "default" : "outline"} onClick={() => setAnalysisType('wildfires')} className={cn("h-14 flex flex-col gap-1 rounded-xl text-[9px] font-bold", analysisType === 'wildfires' ? "bg-orange-50 text-orange-600 border-orange-200" : "bg-transparent text-slate-400")}>
                <Flame className="w-4 h-4" /> Fire
              </Button>
              <Button variant={analysisType === 'flooding' ? "default" : "outline"} onClick={() => setAnalysisType('flooding')} className={cn("h-14 flex flex-col gap-1 rounded-xl text-[9px] font-bold", analysisType === 'flooding' ? "bg-blue-50 text-blue-600 border-blue-200" : "bg-transparent text-slate-400")}>
                <Droplets className="w-4 h-4" /> Flood
              </Button>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-end">
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Opacity</label>
              <span className="text-[10px] font-bold text-slate-600">{Math.round(aiOpacity * 100)}%</span>
            </div>
            <Slider value={[aiOpacity * 100]} onValueChange={(v) => setAiOpacity(v[0] / 100)} max={100} step={1} />
          </div>

          {result && (
            <div className="pt-6 border-t border-slate-100 space-y-4">
              <div className="flex justify-between items-center p-3 rounded-xl border bg-white shadow-sm">
                <span className={cn("text-[10px] font-bold px-2 py-1 rounded-md border", result.mode === 'prithvi' ? "text-emerald-700 bg-emerald-50 border-emerald-200" : "text-blue-700 bg-blue-50 border-blue-200")}>
                  {result.mode === 'prithvi' ? 'PREMIUM AI ACTIVE' : 'STANDARD GEE ACTIVE'}
                </span>
                <span className="text-[10px] font-bold text-slate-400 font-mono">{result.meta.processingTime}ms</span>
              </div>
              <div className="p-4 bg-slate-50 rounded-2xl space-y-2">
                 <div className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Detected Area</div>
                 <div className="flex items-end gap-1">
                    <span className="text-2xl font-black text-slate-800">{result.data.analysisInfo?.stats?.areaHectares.toFixed(1) || 0}</span>
                    <span className="text-sm font-bold text-slate-400 mb-1">hectares</span>
                 </div>
              </div>
            </div>
          )}
        </Card>
      </div>

      {showShareDialog && result && (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-6">
           <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-md" onClick={() => setShowShareDialog(false)} />
           <div className="relative max-w-lg w-full">
              <Button variant="ghost" size="icon" onClick={() => setShowShareDialog(false)} className="absolute -top-14 right-0 text-white hover:bg-white/20 rounded-full"><X className="w-8 h-8" /></Button>
              <ShareCardDialog regionName="Analysis Export" stats={{ hectares: result.data.analysisInfo?.stats?.areaHectares || 0, co2: 120, risk: "Verified" }} mapScreenshot={mapScreenshot} />
           </div>
        </div>
      )}
    </div>
  );
}
