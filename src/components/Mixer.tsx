import React from 'react';
import { Mic, Download, Square, Radio } from 'lucide-react';
import { motion } from 'motion/react';

interface MixerProps {
  crossfade: number;
  onCrossfadeChange: (val: number) => void;
  isRecording: boolean;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onSync: () => void;
  onAutoMix: (toDeck: 'A' | 'B') => void;
}

export const Mixer: React.FC<MixerProps> = ({ 
  crossfade, 
  onCrossfadeChange, 
  isRecording, 
  onStartRecording, 
  onStopRecording,
  onSync,
  onAutoMix
}) => {
  return (
    <div className="flex flex-col items-center justify-between h-full py-2 sm:py-6 px-1 sm:px-3 bg-white/5 backdrop-blur-2xl border border-white/10 rounded-2xl w-20 xs:w-28 sm:w-56 lg:w-48 shadow-2xl relative overflow-hidden shrink-0">
      <div className="absolute top-0 right-0 p-2 opacity-5">
        <Radio size={40} className="text-white sm:w-20 sm:h-20" />
      </div>

      {/* Branding - Hidden on very small screens */}
      <div className="text-center z-10 w-full mb-2 sm:mb-8 hidden xs:block">
        <h2 className="text-slate-500 font-mono text-[6px] sm:text-[9px] tracking-[0.2em] sm:tracking-[0.4em] uppercase font-black mb-1 sm:mb-4">Master</h2>
        <div className="flex items-center justify-center gap-1 sm:gap-3">
            <Radio size={8} className={isRecording ? 'text-red-500 animate-pulse' : 'text-slate-700 sm:w-3 sm:h-3'} />
            <div className="h-1 sm:h-1.5 w-8 sm:w-16 bg-white/5 rounded-full overflow-hidden border border-white/5">
                <motion.div 
                    animate={{ x: isRecording ? [-15, 15] : 0 }}
                    transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
                    className="h-full w-4 sm:w-8 bg-indigo-500 blur-[2px]"
                />
            </div>
        </div>
      </div>

      {/* recording Controls */}
      <div className="flex flex-col gap-2 w-full px-0.5 sm:px-2 z-10">
        <button 
          onClick={isRecording ? onStopRecording : onStartRecording}
          className={`group flex items-center justify-center sm:justify-between p-2 sm:p-4 rounded-lg sm:rounded-2xl border transition-all active:scale-95 ${
            isRecording 
            ? 'bg-red-950/40 border-red-500 text-red-500 shadow-[0_0_10px_rgba(239,68,68,0.2)]' 
            : 'bg-white/5 border-white/10 text-slate-400 hover:text-white hover:border-white/20'
          }`}
        >
          <div className="flex items-center gap-1 sm:gap-3">
            {isRecording ? <Square size={10} className="sm:w-3.5 sm:h-3.5" fill="currentColor" /> : <Mic size={10} className="sm:w-3.5 sm:h-3.5" />}
            <span className="text-[6px] sm:text-[10px] font-black uppercase tracking-widest leading-none hidden xs:inline">{isRecording ? 'Stop' : 'Rec'}</span>
          </div>
        </button>

        <button 
          onClick={onSync}
          className="flex items-center justify-center gap-1 sm:gap-2 p-2 sm:p-4 bg-white/5 border border-white/10 rounded-lg sm:rounded-2xl text-slate-400 hover:text-indigo-400 hover:border-indigo-500/30 transition-all group active:scale-95 shadow-sm"
        >
          <Download size={10} className="sm:w-3.5 sm:h-3.5 group-hover:translate-y-0.5 transition-transform" />
          <span className="text-[6px] sm:text-[10px] font-black uppercase tracking-widest leading-none hidden xs:inline">Sync</span>
        </button>

        <button 
          onClick={() => onAutoMix(crossfade > 0.5 ? 'A' : 'B')}
          className="flex items-center justify-center gap-1 sm:gap-2 p-2 sm:p-4 bg-indigo-600/10 border border-indigo-500/20 rounded-lg sm:rounded-2xl text-indigo-400 hover:bg-indigo-600/20 transition-all active:scale-95 shadow-sm"
        >
          <Radio size={10} className="sm:w-3.5 sm:h-3.5" />
          <span className="text-[6px] sm:text-[10px] font-black uppercase tracking-widest leading-none hidden xs:inline">Auto-Mix</span>
        </button>
      </div>

      {/* VU Meters - Scaled down for mobile */}
      <div className="flex gap-2 sm:gap-6 h-20 sm:h-40 py-2 sm:py-6 z-10">
          {[1,2].map(i => (
              <div key={i} className="w-1.5 sm:w-2.5 h-full bg-black/40 rounded-full p-0.5 sm:p-1 flex flex-col-reverse gap-0.5 sm:gap-1 border border-white/5">
                  {[...Array(8)].map((_, j) => (
                      <div 
                        key={j} 
                        className={`w-full flex-1 rounded-[0.5px] sm:rounded-[1px] transition-all duration-300 ${
                            j > 6 ? 'bg-red-500/40' : 
                            j > 4 ? 'bg-indigo-400/40' : 
                            'bg-slate-800'
                        }`}
                      />
                  ))}
              </div>
          ))}
      </div>

      {/* Crossfader section */}
      <div className="w-full space-y-2 sm:space-y-6 px-1 z-10 pb-2">
        <div className="flex justify-between px-1">
            <span className="text-[6px] sm:text-[10px] text-slate-500 font-black tracking-widest">A</span>
            <span className="text-[6px] sm:text-[10px] text-slate-500 font-black tracking-widest">B</span>
        </div>
        <div className="relative h-8 sm:h-14 flex items-center group">
            <div className="absolute w-full h-1 sm:h-1.5 bg-black/40 rounded-full border border-white/5" />
            <input 
              type="range" 
              min="0" 
              max="1" 
              step="0.01" 
              value={crossfade} 
              onChange={(e) => onCrossfadeChange(parseFloat(e.target.value))}
              className="absolute w-full h-full opacity-0 cursor-pointer z-10"
            />
            {/* Custom Crossfader UI */}
            <motion.div 
               animate={{ left: `${crossfade * 100}%` }}
               transition={{ type: "spring", damping: 35, stiffness: 450 }}
               className="absolute -ml-3 sm:-ml-6 w-6 sm:w-12 h-5 sm:h-10 bg-slate-800 border sm:border-2 border-white/10 rounded-md sm:rounded-xl shadow-2xl flex items-center justify-center pointer-events-none transition-transform"
            >
                <div className="h-3 sm:h-5 w-0.5 bg-indigo-500 rounded-full" />
            </motion.div>
        </div>
      </div>
    </div>
  );
};
