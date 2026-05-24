'use client';

import React, { useState, useMemo } from 'react';
import Map, { NavigationControl, FullscreenControl, ScaleControl } from 'react-map-gl/maplibre';
import DeckGL from '@deck.gl/react';
import { TileLayer } from '@deck.gl/geo-layers';
import { BitmapLayer } from '@deck.gl/layers';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

import { useAreaAnalysis } from '@/hooks/useAreaAnalysis';
import { createAILayer, createUncertaintyLayer } from './layers';
import { NarrativeOverlay } from '../story/NarrativeOverlay';
import { cinematicFlyTo, STORY_EVENTS } from '@/lib/story/logic';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';
import { Loader2, Zap, AlertTriangle, Info, Map as MapIcon, Layers, Eye } from 'lucide-react';

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
  const [dateRange] = useState<[string, string]>(['2023-01-01', '2023-12-31']);
  
  // Story Mode State
  const [isStoryMode, setIsStoryMode] = useState(false);
  const [currentEventIndex, setCurrentEventIndex] = useState(-1);

  const { analyzeArea, loading, result, credits } = useAreaAnalysis();

  const handleAnalyze = () => {
    const bbox = [
      viewState.longitude - 0.1, 
      viewState.latitude - 0.1, 
      viewState.longitude + 0.1, 
      viewState.latitude + 0.1
    ];
    analyzeArea(bbox, dateRange);
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
          <div className="absolute top-20 left-4 z-10 flex flex-col gap-2">
            <NavigationControl showCompass={false} />
            <FullscreenControl />
          </div>
          <ScaleControl position="bottom-left" />
        </Map>
      </DeckGL>
      
      {/* Top Bar: Credits & Status */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 z-20 flex items-center gap-4">
        <div className="px-5 py-2.5 glass-panel rounded-2xl flex items-center gap-4 border-white/40 shadow-xl">
          <div className="flex items-center gap-2.5">
            <div className={cn(
              "w-8 h-8 rounded-xl flex items-center justify-center transition-colors",
              credits > 0 ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-400"
            )}>
              <Zap className="w-4 h-4 fill-current" />
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 leading-none mb-1">Credits</span>
              <span className="text-sm font-semibold text-slate-700 leading-none">{credits}/20</span>
            </div>
          </div>
          
          <div className="w-px h-8 bg-slate-200/60" />
          
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleAnalyze} 
            disabled={loading || credits === 0 || isStoryMode}
            className="h-9 px-4 text-xs font-bold uppercase tracking-wider text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50/50 rounded-xl transition-all"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.4 animate-spin" />
                Processing
              </span>
            ) : "Analyze View"}
          </Button>

          <Button 
            variant="ghost" 
            size="sm" 
            onClick={startStoryMode} 
            disabled={isStoryMode}
            className="h-9 px-4 text-xs font-bold uppercase tracking-wider text-primary hover:text-primary/80 hover:bg-primary/5 rounded-xl transition-all"
          >
            Story Mode
          </Button>
        </div>
      </div>

      {/* Narrative Overlay */}
      {isStoryMode && currentEventIndex >= 0 && (
        <NarrativeOverlay 
          event={STORY_EVENTS[currentEventIndex]} 
          onClose={() => setIsStoryMode(false)}
          onNext={() => handleNextEvent()}
        />
      )}

      {/* Right Panel: Controls */}
      <div className="absolute top-6 right-6 z-20 w-80 flex flex-col gap-4">
        <Card className="p-6 glass-panel border-white/40 shadow-2xl rounded-[2rem]">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <Layers className="w-4 h-4 text-emerald-500" />
              Inspector
            </h2>
            <div className="px-2 py-1 bg-emerald-50 text-[10px] font-bold text-emerald-600 rounded-lg uppercase tracking-tight">Live</div>
          </div>
          
          <div className="space-y-8">
            <div className="space-y-4">
              <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Data Layers</label>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50/50 border border-slate-100/50 hover:bg-white transition-colors cursor-pointer group" onClick={() => setLayersVisibility(prev => ({ ...prev, ai: !prev.ai }))}>
                  <div className="flex items-center gap-3">
                    <div className={cn("w-2 h-2 rounded-full", layersVisibility.ai ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : "bg-slate-300")} />
                    <span className="text-sm font-medium text-slate-600 group-hover:text-slate-900 transition-colors">AI Predictions</span>
                  </div>
                  <input type="checkbox" checked={layersVisibility.ai} readOnly className="sr-only" />
                  <Eye className={cn("w-4 h-4 transition-opacity", layersVisibility.ai ? "text-slate-400" : "text-slate-200 opacity-50")} />
                </div>

                <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50/50 border border-slate-100/50 hover:bg-white transition-colors cursor-pointer group" onClick={() => setLayersVisibility(prev => ({ ...prev, uncertainty: !prev.uncertainty }))}>
                  <div className="flex items-center gap-3">
                    <div className={cn("w-2 h-2 rounded-full", layersVisibility.uncertainty ? "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]" : "bg-slate-300")} />
                    <span className="text-sm font-medium text-slate-600 group-hover:text-slate-900 transition-colors">Risk Heatmap</span>
                  </div>
                  <input type="checkbox" checked={layersVisibility.uncertainty} readOnly className="sr-only" />
                  <Eye className={cn("w-4 h-4 transition-opacity", layersVisibility.uncertainty ? "text-slate-400" : "text-slate-200 opacity-50")} />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-end">
                <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">AI Intensity</label>
                <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">{Math.round(aiOpacity * 100)}%</span>
              </div>
              <Slider 
                value={[aiOpacity * 100]} 
                onValueChange={(val: any) => setAiOpacity(val[0] / 100)} 
                max={100} 
                step={1}
                className="py-2"
              />
            </div>
          </div>
        </Card>

        {result?.mode === 'fallback' && (
          <div className="p-4 bg-amber-50/80 backdrop-blur-xl border border-amber-200/50 text-amber-900 flex items-start gap-4 rounded-[1.5rem] shadow-lg animate-in fade-in slide-in-from-right-4">
            <div className="p-2 bg-amber-100 rounded-xl">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
            </div>
            <div className="text-xs pt-1">
              <p className="font-bold mb-1 uppercase tracking-tight">System Notice</p>
              <p className="opacity-80 leading-relaxed">Premium AI is offline. Viewing high-fidelity GEE baseline data.</p>
            </div>
          </div>
        )}
      </div>

      {/* Bottom: Project Brand & Timeline */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 w-full max-w-4xl px-6">
        <div className="p-1 glass-panel rounded-[2.5rem] border-white/50 shadow-2xl overflow-hidden">
          <div className="bg-white/40 p-5 rounded-[2.25rem] flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-emerald-200/50">
                  <MapIcon className="w-5 h-5" />
                </div>
                <div className="flex flex-col">
                  <h1 className="text-sm font-black tracking-tight text-slate-800 leading-none">EARTHPULSE AI</h1>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Satellite Intelligence</span>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex flex-col items-end">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Current Epoch</span>
                  <span className="text-xs font-black text-slate-700 font-mono">2024.Q2</span>
                </div>
              </div>
            </div>
            
            <div className="space-y-2 px-1">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Temporal Analysis (2019-2026)</span>
                <div className="flex gap-1.5">
                   <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                   <div className="w-1.5 h-1.5 rounded-full bg-emerald-500/40" />
                   <div className="w-1.5 h-1.5 rounded-full bg-emerald-500/10" />
                </div>
              </div>
              <div className="h-2 bg-slate-100 rounded-full relative overflow-hidden">
                <div className="absolute inset-y-0 left-0 w-3/4 bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full shadow-[0_0_12px_rgba(16,185,129,0.3)] transition-all duration-1000 ease-in-out" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
