import React from 'react';
import { motion } from 'motion/react';
import { Play, Pause, Upload, Sparkles } from 'lucide-react';
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

export const Deck: React.FC<DeckProps> = ({
  id, state, onLoad, onTogglePlay, onRateChange, onFilterChange, onFXChange, onScratch, getVisualizerData
}) => {
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) onLoad(e.target.files[0]);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col h-full w-full bg-white/5 backdrop-blur-xl rounded-xl border border-white/10 overflow-hidden relative p-1.5 gap-1">

      {/* Marca de agua DECK */}
      <div className="absolute top-1 left-2 text-indigo-400 font-black italic opacity-10 text-2xl pointer-events-none select-none">
        {id}
      </div>

      {/* Sugerencia IA */}
      <AnimatePresenceWrapper show={!!state.suggestedNext}>
        {state.suggestedNext && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute top-8 left-1/2 -translate-x-1/2 bg-indigo-600/90 backdrop-blur-xl border border-indigo-400/50 px-3 py-1 rounded-xl z-20 flex items-center gap-1 w-[85%] shadow-lg"
          >
            <Sparkles size={10} className="text-white animate-pulse shrink-0" />
            <p className="text-[8px] text-indigo-100 font-bold truncate">{state.suggestedNext.suggestion}</p>
          </motion.div>
        )}
      </AnimatePresenceWrapper>

      {/* Header del deck */}
      <div className="flex justify-between items-center px-1 shrink-0">
        <span className="text-slate-500 font-mono text-[8px] tracking-widest uppercase font-bold">Ch. {id}</span>
        <span className={`font-mono text-[8px] font-bold uppercase ${state.isPlaying ? 'text-indigo-400 animate-pulse' : 'text-slate-600'}`}>
          {state.isPlaying ? '● PLAY' : '● STOP'}
        </span>
      </div>

      {/* Plato — ocupa el espacio central */}
      <div className="flex-1 flex items-center justify-center min-h-0 w-full">
        <Turntable
          isPlaying={state.isPlaying}
          progress={state.progress}
          duration={state.duration}
          playbackRate={state.playbackRate}
          onTogglePlay={onTogglePlay}
          onScratch={onScratch}
        />
      </div>

      {/* Info de pista */}
      <div className="bg-black/20 px-2 py-1 rounded-lg border border-white/5 flex justify-between items-center shrink-0">
        <p className="text-white text-[8px] font-semibold truncate uppercase max-w-[65%]">
          {state.fileName === 'No Track Loaded' ? 'Sin pista' : state.fileName}
        </p>
        <div className="flex items-center gap-1">
          <span className="text-slate-400 font-mono text-[7px]">{formatTime(state.progress)}</span>
          {state.key && (
            <div className="bg-indigo-500/20 px-1 py-0.5 rounded border border-indigo-500/40">
              <span className="text-indigo-400 text-[7px] font-black">{state.key}</span>
            </div>
          )}
        </div>
      </div>

      {/* Controles — en fila horizontal */}
      <div className="grid grid-cols-4 gap-1 shrink-0">
        <label className="flex flex-col items-center justify-center gap-0.5 bg-white/5 hover:bg-white/10 text-slate-300 py-1.5 rounded-lg cursor-pointer transition-all border border-white/10 active:scale-95 col-span-1">
          <Upload size={10} />
          <span className="text-[6px] font-black uppercase">Load</span>
          <input type="file" accept="audio/*" className="hidden" onChange={handleFileChange} />
        </label>

        <button
          onClick={onTogglePlay}
          disabled={state.fileName === 'No Track Loaded'}
          className={`flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-lg transition-all border active:scale-95 col-span-1 ${
            state.isPlaying
              ? 'bg-indigo-600 text-white border-indigo-400 shadow-[0_0_8px_rgba(79,70,229,0.4)]'
              : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10'
          } disabled:opacity-50`}
        >
          {state.isPlaying
            ? <Pause size={10} fill="currentColor" />
            : <Play size={10} fill="currentColor" />}
          <span className="text-[6px] font-black uppercase">{state.isPlaying ? 'Stop' : 'Play'}</span>
        </button>

        <button
          onMouseDown={() => onFXChange('delay', 0.5)}
          onMouseUp={() => onFXChange('delay', 0)}
          onTouchStart={() => onFXChange('delay', 0.5)}
          onTouchEnd={() => onFXChange('delay', 0)}
          className="flex flex-col items-center justify-center gap-0.5 bg-white/5 border border-white/10 py-1.5 rounded-lg text-slate-400 active:bg-indigo-500/20 active:border-indigo-500/50 transition-all col-span-1"
        >
          <span className="text-[6px] font-bold uppercase">Echo</span>
        </button>

        <button
          onMouseDown={() => onFXChange('dist', 1)}
          onMouseUp={() => onFXChange('dist', 0)}
          onTouchStart={() => onFXChange('dist', 1)}
          onTouchEnd={() => onFXChange('dist', 0)}
          className="flex flex-col items-center justify-center gap-0.5 bg-white/5 border border-white/10 py-1.5 rounded-lg text-slate-400 active:bg-orange-500/20 active:border-orange-500/50 transition-all col-span-1"
        >
          <span className="text-[6px] font-bold uppercase">Crush</span>
        </button>
      </div>

      {/* Pitch slider */}
      <div className="shrink-0 px-1">
        <div className="flex justify-between items-center mb-0.5">
          <span className="text-[6px] text-slate-500 uppercase font-black">Pitch</span>
          <span className="text-[7px] text-indigo-400 font-mono">{(state.playbackRate * 100).toFixed(0)}%</span>
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

      {/* Visualizer sutil en fondo */}
      <div className="absolute inset-x-0 bottom-0 h-[25%] opacity-10 pointer-events-none -z-0">
        <Visualizer getData={getVisualizerData} />
      </div>
    </div>
  );
};

// Helper para animar sin importar AnimatePresence completo
function AnimatePresenceWrapper({ show, children }: { show: boolean; children: React.ReactNode }) {
  if (!show) return null;
  return <>{children}</>;
}
