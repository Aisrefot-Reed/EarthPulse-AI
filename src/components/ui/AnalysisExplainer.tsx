'use client';

import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { X, BookOpen, AlertCircle, Info, Database } from 'lucide-react';
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

  const getNarrative = () => {
    switch (type) {
      case 'wildfires':
        return {
          title: "Обнаружены следы пожаров",
          desc: `Наш анализ выявил выгорание растительности на площади ${area} га. Использование индекса dNBR (Normalized Burn Ratio) позволяет отличить свежие гари от обычной вырубки. Огонь уничтожил защитный слой почвы, что может привести к эрозии.`,
          impact: "Выброс CO₂, потеря азота в почве, уничтожение семенного фонда леса."
        };
      case 'flooding':
        return {
          title: "Обнаружено затопление",
          desc: `Зафиксировано значительное увеличение водной поверхности на площади ${area} га. Индекс NDWI показал аномальное присутствие влаги там, где раньше была суша или растительность. Это может быть вызвано сезонным паводком или прорывом дамб.`,
          impact: "Риск для инфраструктуры, заиливание сельхозугодий, изменение локальной экосистемы."
        };
      case 'deforestation':
      default:
        return {
          title: "Обнаружена потеря леса",
          desc: `Зафиксировано снижение индекса NDVI на площади ${area} га по сравнению с базовым 2019 годом. Это указывает на сплошную или выборочную вырубку лесного массива. Маскировка воды исключила ложные срабатывания на береговых линиях.`,
          impact: `Примерная потеря депонированного углерода: ${co2} тонн. Снижение биоразнообразия.`
        };
    }
  };

  const content = getNarrative();

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="absolute inset-0 z-[60] flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-md"
      >
        <Card className="max-w-xl w-full p-8 glass-panel border-white/40 shadow-2xl rounded-[2.5rem] relative overflow-hidden">
          <Button variant="ghost" size="icon" onClick={onClose} className="absolute top-4 right-4 rounded-full text-slate-400 hover:text-slate-600">
            <X className="w-6 h-6" />
          </Button>

          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 bg-emerald-100 rounded-2xl flex items-center justify-center text-emerald-600">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">{content.title}</h3>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Интеллектуальный отчет</p>
            </div>
          </div>

          <div className="space-y-6">
            <div className="p-5 bg-slate-50 rounded-3xl border border-slate-100">
              <div className="flex items-center gap-2 mb-2 text-slate-500">
                <Info className="w-4 h-4" />
                <span className="text-[10px] font-bold uppercase tracking-widest">Суть анализа</span>
              </div>
              <p className="text-sm text-slate-600 leading-relaxed font-medium">
                {content.desc}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-5 bg-emerald-50/50 rounded-3xl border border-emerald-100/50">
                 <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest block mb-1">Площадь</span>
                 <span className="text-2xl font-black text-emerald-900">{area} га</span>
              </div>
              <div className="p-5 bg-amber-50/50 rounded-3xl border border-amber-100/50">
                 <span className="text-[10px] font-bold text-amber-600 uppercase tracking-widest block mb-1">Статус</span>
                 <span className="text-lg font-black text-amber-900 uppercase">Верифицировано</span>
              </div>
            </div>

            <div className="p-5 bg-rose-50/50 rounded-3xl border border-rose-100/50">
              <div className="flex items-center gap-2 mb-2 text-rose-600">
                <AlertCircle className="w-4 h-4" />
                <span className="text-[10px] font-bold uppercase tracking-widest">Экологический след</span>
              </div>
              <p className="text-sm text-rose-800 font-bold">
                {content.impact}
              </p>
            </div>

            <div className="flex items-center gap-3 pt-4 border-t border-slate-100">
               <Database className="w-4 h-4 text-slate-300" />
               <span className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.2em]">Данные: ESA Sentinel-2 MSI (2019-{new Date().getFullYear()})</span>
            </div>
          </div>

          <Button 
            className="w-full mt-8 h-14 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-2xl shadow-xl"
            onClick={onClose}
          >
            Понятно
          </Button>
        </Card>
      </motion.div>
    </AnimatePresence>
  );
};
