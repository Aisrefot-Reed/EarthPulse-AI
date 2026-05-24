'use client';

import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ShieldCheck, Mail, Loader2, MapPin } from 'lucide-react';
import { toast } from 'sonner';

interface AdoptFormProps {
  bbox: number[];
  regionName: string;
}

export const AdoptForm = ({ bbox, regionName }: AdoptFormProps) => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleAdopt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return toast.error('Please enter your email.');
    
    setIsLoading(true);
    try {
      const res = await fetch('/api/community/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, regionName, bbox })
      });
      
      const data = await res.json();
      
      if (data.success) {
        toast.success(data.message);
        setEmail('');
      } else {
        toast.error(data.error);
      }
    } catch (err) {
      toast.error('Failed to connect to server.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="p-5 bg-slate-900/90 border-emerald-500/30 backdrop-blur-2xl text-white">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-emerald-500/20 rounded-lg">
          <ShieldCheck className="w-5 h-5 text-emerald-400" />
        </div>
        <div>
          <h3 className="text-lg font-bold">Adopt this Region</h3>
          <p className="text-xs text-slate-400">Become a guardian of {regionName}</p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-2 p-3 bg-slate-800/50 rounded-lg border border-slate-700">
          <MapPin className="w-4 h-4 text-slate-500" />
          <span className="text-xs text-slate-300 truncate">BBox: {bbox.join(', ')}</span>
        </div>

        <form onSubmit={handleAdopt} className="space-y-3">
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input 
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg py-2 pl-10 pr-4 text-sm focus:outline-none focus:border-emerald-500 transition-colors"
              required
            />
          </div>
          <Button 
            type="submit" 
            disabled={isLoading}
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold h-11"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : 'Confirm Adoption'}
          </Button>
        </form>

        <p className="text-[10px] text-slate-500 text-center leading-relaxed">
          By adopting, you agree to receive automated email alerts when our AI detects significant landscape changes (&gt;5%). Max 3 regions per user.
        </p>
      </div>
    </Card>
  );
};
