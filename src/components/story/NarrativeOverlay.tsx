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
        <Card className="p-5 bg-white/80 border-white/60 backdrop-blur-2xl text-slate-800 shadow-[0_8px_30px_rgb(0,0,0,0.08)] rounded-2xl">
          <div className="flex justify-between items-start mb-4">
            <div className="p-2 bg-emerald-100 rounded-xl">
              <Activity className="w-5 h-5 text-emerald-600" />
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} className="text-slate-400 hover:text-slate-600 hover:bg-slate-100/50 rounded-full">
              <X className="w-4 h-4" />
            </Button>
          </div>

          <h3 className="text-xl font-bold text-slate-900 mb-1">{event.title}</h3>
          <div className="flex items-center gap-2 text-xs font-medium text-slate-500 mb-4">
            <Calendar className="w-3 h-3" />
            {event.date}
          </div>

          <p className="text-sm text-slate-600 leading-relaxed mb-6">
            {event.description}
          </p>

          <div className="flex items-center justify-between p-3 bg-slate-50/80 rounded-xl border border-slate-200/50">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Impact Metric</span>
            <span className="text-sm font-bold text-emerald-600">{event.impactMetric}</span>
          </div>

          <Button 
            className="w-full mt-6 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-6 group rounded-xl shadow-md hover:shadow-lg transition-all"
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
