import React from 'react';
import { motion } from 'motion/react';
import { Play, Pause, Upload, Disc, Sparkles } from 'lucide-react';
import { Turntable } from './Turntable';
import { Visualizer } from './Visualizer';
import { DeckState } from '../hooks/useDJEngine';

interface DeckProps {
  id: 'A' | 'B';
  state: DeckState;
  onLoad: (file: File) => void;
  onTogglePlay: () => void;
  onRateChange: (rate: number) => void;
  onFilterChange: (freq: number) => void;
  onFXChange: (type: 'delay' | 'dist', value: number) => void;
  onScratch: (timeOffset: number) => void;
  getVisualizerData: () => any;
}

export const Deck: React.FC<DeckProps> = ({ id, state, onLoad, onTogglePlay, onRateChange, onFilterChange, onFXChange, onScratch, getVisualizerData }) => {
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      onLoad(e.target.files[0]);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col items-center justify-between gap-1 sm:gap-4 p-1 sm:p-6 bg-white/5 backdrop-blur-xl rounded-xl border border-white/10 w-full h-full shadow-2xl relative overflow-hidden group">
      <div className="absolute top-2 left-4 text-indigo-400 font-black italic opacity-10 text-xl sm:text-4xl pointer-events-none select-none">DECK {id}</div>
      
      {state.suggestedNext && (
        <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute top-10 left-1/2 -translate-x-1/2 bg-indigo-600/90 backdrop-blur-xl border border-indigo-400/50 px-4 py-2 rounded-2xl z-20 flex flex-col items-center gap-1 w-[80%] shadow-[0_0_20px_rgba(79,70,229,0.5)]"
        >
            <div className="flex items-center gap-2">
              <Sparkles size={14} className="text-white animate-pulse" />
              <span className="text-[10px] text-white font-black uppercase tracking-[0.2em]">Next Best Mix</span>
              <Sparkles size={14} className="text-white animate-pulse" />
            </div>
            <p className="text-[11px] text-indigo-100 font-bold truncate w-full text-center">{state.suggestedNext.suggestion}</p>
            <p className="text-[9px] text-indigo-200/80 italic text-center leading-tight">"{state.suggestedNext.tip}"</p>
        </motion.div>
      )}

      {/* Waveform Visualization Overlay */}
      <div className="absolute inset-x-0 bottom-0 h-[30%] opacity-10 -z-1 pointer-events-none">
        <Visualizer getData={getVisualizerData} />
      </div>

      <div className="flex justify-between w-full mb-1 z-10 px-1">
        <span className="text-slate-500 font-mono text-[7px] sm:text-[10px] tracking-[0.2em] uppercase font-bold">Ch. {id}</span>
        <span className={`font-mono text-[7px] sm:text-[10px] font-bold uppercase tracking-widest ${state.isPlaying ? 'text-indigo-400 animate-pulse' : 'text-slate-600'}`}>
            {state.isPlaying ? '• ON' : '• OFF'}
        </span>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center w-full min-h-0">
        <Turntable 
          isPlaying={state.isPlaying} 
          progress={state.progress} 
          duration={state.duration} 
          playbackRate={state.playbackRate}
          onTogglePlay={onTogglePlay}
          onScratch={onScratch}
        />
      </div>

      <div className="w-full space-y-2 sm:space-y-4 z-10 shrink-0">
        {/* Track Info */}
        <div className="bg-black/20 backdrop-blur-md p-1.5 sm:p-3 rounded-lg border border-white/5 flex justify-between items-center">
          <p className="text-white text-[9px] sm:text-[12px] font-semibold truncate leading-tight uppercase tracking-tight max-w-[70%]">{state.fileName === 'No Track Loaded' ? 'Empty' : state.fileName}</p>
          {state.key && (
            <div className="bg-indigo-500/20 px-1 sm:px-2 py-0.5 rounded border border-indigo-500/40">
              <span className="text-indigo-400 text-[8px] sm:text-[10px] font-black">{state.key}</span>
            </div>
          )}
        </div>

        {/* Controls Grid */}
        <div className="grid grid-cols-2 gap-1.5 sm:gap-4">
          <label className="flex items-center justify-center gap-1 bg-white/5 hover:bg-white/10 text-slate-300 py-1.5 sm:py-3.5 rounded-lg sm:rounded-xl cursor-pointer transition-all border border-white/10 active:scale-95">
            <Upload size={12} className="sm:w-4 sm:h-4" />
            <span className="text-[7px] sm:text-[10px] font-black uppercase tracking-widest">Load</span>
            <input type="file" accept="audio/*" className="hidden" onChange={handleFileChange} />
          </label>

          <button 
            onClick={onTogglePlay}
            disabled={state.fileName === 'No Track Loaded'}
            className={`flex items-center justify-center gap-1 py-1.5 sm:py-3.5 rounded-lg sm:rounded-xl transition-all border active:scale-95 ${
              state.isPlaying 
              ? 'bg-indigo-600 text-white border-indigo-400 shadow-[0_0_10px_rgba(79,70,229,0.4)]' 
              : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10'
            } disabled:opacity-50`}
          >
            {state.isPlaying ? <Pause size={12} className="sm:w-4 sm:h-4" fill="currentColor" /> : <Play size={12} className="sm:w-4 sm:h-4" fill="currentColor" />}
            <span className="text-[7px] sm:text-[10px] font-black uppercase tracking-widest">{state.isPlaying ? 'Stop' : 'Play'}</span>
          </button>
        </div>

        {/* FX Controls */}
        <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
            <button 
                onMouseDown={() => onFXChange('delay', 0.5)}
                onMouseUp={() => onFXChange('delay', 0)}
                onTouchStart={() => onFXChange('delay', 0.5)}
                onTouchEnd={() => onFXChange('delay', 0)}
                className="bg-white/5 border border-white/10 p-1 rounded-md text-[6px] sm:text-[8px] font-bold text-slate-400 hover:text-indigo-400 active:bg-indigo-500/20 active:border-indigo-500/50 uppercase transition-all"
            >
                Echo Delay
            </button>
            <button 
                onMouseDown={() => onFXChange('dist', 1)}
                onMouseUp={() => onFXChange('dist', 0)}
                onTouchStart={() => onFXChange('dist', 1)}
                onTouchEnd={() => onFXChange('dist', 0)}
                className="bg-white/5 border border-white/10 p-1 rounded-md text-[6px] sm:text-[8px] font-bold text-slate-400 hover:text-orange-400 active:bg-orange-500/20 active:border-orange-500/50 uppercase transition-all"
            >
                Bit Crush
            </button>
        </div>

        {/* Pitch Control - Compact on mobile */}
        <div className="space-y-1 sm:space-y-5 pt-1">
          <div className="flex flex-col gap-0.5">
            <div className="flex justify-between items-center bg-black/10 px-1 rounded">
                <span className="text-[6px] sm:text-[9px] text-slate-500 uppercase font-black">Pitch</span>
                <span className="text-[7px] sm:text-[10px] text-indigo-400 font-mono">{(state.playbackRate * 100).toFixed(0)}%</span>
            </div>
            <input 
              type="range" 
              min="0.5" 
              max="2" 
              step="0.01" 
              value={state.playbackRate} 
              onChange={(e) => onRateChange(parseFloat(e.target.value))}
              className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-indigo-500"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
