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
import { Loader2, Zap, AlertTriangle, Info } from 'lucide-react';

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
  const [dateRange, setDateRange] = useState<[string, string]>(['2023-01-01', '2023-12-31']);
  
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

    const aiLayer = createAILayer(result?.data, layersVisibility.ai, aiOpacity);
    if (aiLayer) activeLayers.push(aiLayer);

    const uncertaintyLayer = createUncertaintyLayer(result?.data, layersVisibility.uncertainty);
    if (uncertaintyLayer) activeLayers.push(uncertaintyLayer);

    return activeLayers;
  }, [result, layersVisibility, aiOpacity]);

  return (
    <div className="relative w-full h-screen bg-slate-950 overflow-hidden">
      <DeckGL
        viewState={viewState}
        onViewStateChange={({ viewState }) => setViewState(viewState as any)}
        controller={true}
        layers={layers}
      >
        <Map
          mapLib={maplibregl as any}
          mapStyle="https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"
        >
          <NavigationControl position="top-left" />
          <FullscreenControl position="top-left" />
          <ScaleControl />
        </Map>
      </DeckGL>
      
      {/* Top Bar: Credits & Status */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-4">
        <Card className="px-4 py-2 bg-slate-900/90 border-slate-800 flex items-center gap-3 backdrop-blur-xl">
          <div className="flex items-center gap-2">
            <Zap className={cn("w-4 h-4", credits > 0 ? "text-emerald-400" : "text-slate-500")} />
            <span className="text-sm font-medium text-slate-200">AI Credits: {credits}/5</span>
          </div>
          <div className="w-px h-4 bg-slate-700" />
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleAnalyze} 
            disabled={loading || credits === 0 || isStoryMode}
            className="h-8 text-xs font-bold uppercase tracking-wider text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Analyze Current View"}
          </Button>
          <div className="w-px h-4 bg-slate-700" />
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={startStoryMode} 
            disabled={isStoryMode}
            className="h-8 text-xs font-bold uppercase tracking-wider text-amber-400 hover:text-amber-300 hover:bg-amber-500/10"
          >
            Story Mode
          </Button>
        </Card>
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
      <div className="absolute top-4 right-4 z-20 w-72 flex flex-col gap-4">
        <Card className="p-4 bg-slate-900/90 border-slate-800 backdrop-blur-xl text-white shadow-2xl">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <Info className="w-4 h-4 text-emerald-400" />
            Control Center
          </h2>
          
          <div className="space-y-6">
            <div className="space-y-3">
              <label className="text-xs font-bold uppercase tracking-tighter text-slate-400">Layers</label>
              <div className="space-y-2">
                <label className="flex items-center justify-between group cursor-pointer">
                  <span className="text-sm text-slate-300 group-hover:text-white transition-colors">AI Predictions</span>
                  <input 
                    type="checkbox" 
                    checked={layersVisibility.ai} 
                    onChange={() => setLayersVisibility(prev => ({ ...prev, ai: !prev.ai }))}
                    className="w-4 h-4 accent-emerald-500"
                  />
                </label>
                <label className="flex items-center justify-between group cursor-pointer">
                  <span className="text-sm text-slate-300 group-hover:text-white transition-colors">Uncertainty Map</span>
                  <input 
                    type="checkbox" 
                    checked={layersVisibility.uncertainty} 
                    onChange={() => setLayersVisibility(prev => ({ ...prev, uncertainty: !prev.uncertainty }))}
                    className="w-4 h-4 accent-amber-500"
                  />
                </label>
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-xs font-bold uppercase tracking-tighter text-slate-400">AI Opacity</label>
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

        {result?.mode === 'gee' && (
          <Card className="p-3 bg-amber-500/10 border-amber-500/50 backdrop-blur-xl text-amber-200 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <div className="text-xs">
              <p className="font-bold">GEE Fallback Active</p>
              <p className="opacity-80">Premium AI limit reached or timeout occurred. Showing reliable baseline data.</p>
            </div>
          </Card>
        )}
      </div>

      {/* Bottom: Timeline Placeholder */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 w-full max-w-4xl px-4">
        <Card className="p-4 bg-slate-900/90 border-slate-800 backdrop-blur-xl text-white">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-mono text-slate-400">2019</span>
            <span className="text-sm font-bold text-emerald-400">JOURNEY OF A FOREST</span>
            <span className="text-xs font-mono text-slate-400">2026</span>
          </div>
          <div className="h-1 bg-slate-800 rounded-full relative overflow-hidden">
            <div className="absolute inset-y-0 left-0 w-1/3 bg-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.5)]" />
          </div>
        </Card>
      </div>
    </div>
  );
}
