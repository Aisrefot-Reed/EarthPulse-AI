'use client';

import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { X, Calendar, Activity, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface NarrativeOverlayProps {
  event: any;
  onClose: () => void;
  onNext: () => void;
}

export const NarrativeOverlay = ({ event, onClose, onNext }: NarrativeOverlayProps) => {
  if (!event) return null;

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ opacity: 0, x: -50 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -50 }}
        className="absolute top-24 left-4 z-30 w-80"
      >
        <Card className="p-5 bg-slate-900/95 border-emerald-500/30 backdrop-blur-2xl text-white shadow-[0_0_30px_rgba(16,185,129,0.2)]">
          <div className="flex justify-between items-start mb-4">
            <div className="p-2 bg-emerald-500/20 rounded-lg">
              <Activity className="w-5 h-5 text-emerald-400" />
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} className="text-slate-400 hover:text-white">
              <X className="w-4 h-4" />
            </Button>
          </div>

          <h3 className="text-xl font-bold text-emerald-500 mb-1">{event.title}</h3>
          <div className="flex items-center gap-2 text-xs text-slate-400 mb-4">
            <Calendar className="w-3 h-3" />
            {event.date}
          </div>

          <p className="text-sm text-slate-300 leading-relaxed mb-6">
            {event.description}
          </p>

          <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-xl border border-slate-700/50">
            <span className="text-xs font-medium text-slate-400">Impact Metric</span>
            <span className="text-sm font-bold text-emerald-400">{event.impactMetric}</span>
          </div>

          <Button 
            className="w-full mt-6 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-6 group"
            onClick={onNext}
          >
            Continue Journey
            <ChevronRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
          </Button>
        </Card>
      </motion.div>
    </AnimatePresence>
  );
};
