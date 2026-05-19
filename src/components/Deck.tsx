import React, { useState } from 'react';
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
  onFXChange: (type: 'delay' | 'reverb', value: number) => void;
  onEQChange: (deck: 'A' | 'B', low: number, mid: number, high: number) => void;
  onScratch: (timeOffset: number) => void;
  getVisualizerData: () => any;
  getFreqData?: () => any;
  accentColor?: string;
}

export const Deck: React.FC<DeckProps> = ({
  id, state, onLoad, onTogglePlay, onRateChange, onFilterChange, onFXChange, onEQChange, onScratch, getVisualizerData, getFreqData, accentColor = '#6366f1'
}) => {
  const [eq, setEq] = useState({ low: 0, mid: 0, high: 0 });
  const [hotcues, setHotcues] = useState<number[]>([]);
  const [loopActive, setLoopActive] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) onLoad(e.target.files[0]);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleEQ = (band: 'low' | 'mid' | 'high', value: number) => {
    const next = { ...eq, [band]: value };
    setEq(next);
    onEQChange(id, next.low, next.mid, next.high);
  };

  const addHotcue = () => {
    if (hotcues.length < 4) setHotcues([...hotcues, state.progress]);
  };

  const eqBands = [
    { label: 'Low', band: 'low' as const, color: 'accent-orange-400' },
    { label: 'Mid', band: 'mid' as const, color: 'accent-yellow-400' },
    { label: 'Hi',  band: 'high' as const, color: 'accent-cyan-400' },
  ];

  const hotcueColors = ['bg-pink-500', 'bg-yellow-500', 'bg-cyan-500', 'bg-green-500'];

  return (
    <div
      className="flex flex-col h-full w-full backdrop-blur-xl rounded-xl overflow-hidden relative p-1.5 gap-1 transition-all duration-300"
      style={{
        background: `rgba(255,255,255,0.04)`,
        border: `1px solid ${accentColor}30`,
        boxShadow: `0 0 20px ${accentColor}10`,
      }}
    >
      {/* Marca de agua */}
      <div className="absolute top-1 left-2 font-black italic opacity-10 text-2xl pointer-events-none select-none transition-all duration-300"
        style={{ color: accentColor }}>
        {id}
      </div>

      {/* Sugerencia IA */}
      <AnimatePresenceWrapper show={!!state.suggestedNext}>
        {state.suggestedNext && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute top-8 left-1/2 -translate-x-1/2 backdrop-blur-xl px-3 py-1 rounded-xl z-20 flex items-center gap-1 w-[85%] shadow-lg"
            style={{ background: `${accentColor}e0`, border: `1px solid ${accentColor}80` }}
          >
            <Sparkles size={10} className="text-white animate-pulse shrink-0" />
            <p className="text-[8px] text-white font-bold truncate">{state.suggestedNext.suggestion}</p>
          </motion.div>
        )}
      </AnimatePresenceWrapper>

      {/* Header */}
      <div className="flex justify-between items-center px-1 shrink-0">
        <span className="text-slate-500 font-mono text-[8px] tracking-widest uppercase font-bold">Ch. {id}</span>
        <div className="flex items-center gap-1.5">
          {state.bpm > 0 && state.isLoaded && (
            <span className="text-[6px] font-mono font-bold transition-all duration-300" style={{ color: accentColor }}>{state.bpm} BPM</span>
          )}
          <span className="font-mono text-[8px] font-bold uppercase transition-all duration-300"
            style={{ color: state.isPlaying ? accentColor : '#475569' }}>
            {state.isPlaying ? '● PLAY' : '● STOP'}
          </span>
        </div>
      </div>

      {/* Visualizador de frecuencias */}
      <div className="shrink-0 h-10 w-full rounded-lg overflow-hidden bg-black/30 border border-white/5">
        <Visualizer getData={getVisualizerData} freqData={getFreqData} mode="bars" />
      </div>

      {/* Plato */}
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
            <div className="px-1 py-0.5 rounded border transition-all duration-300"
              style={{ background: `${accentColor}20`, borderColor: `${accentColor}40` }}>
              <span className="text-[7px] font-black transition-all duration-300" style={{ color: accentColor }}>{state.key}</span>
            </div>
          )}
        </div>
      </div>

      {/* Controles principales */}
      <div className="grid grid-cols-4 gap-1 shrink-0">
        <label className="flex flex-col items-center justify-center gap-0.5 bg-white/5 hover:bg-white/10 text-slate-300 py-1.5 rounded-lg cursor-pointer transition-all border border-white/10 active:scale-95">
          <Upload size={10} />
          <span className="text-[6px] font-black uppercase">Load</span>
          <input type="file" accept="audio/*" className="hidden" onChange={handleFileChange} />
        </label>

        <button
          onClick={onTogglePlay}
          disabled={!state.isLoaded}
          className="flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-lg transition-all border active:scale-95 disabled:opacity-50"
          style={state.isPlaying ? {
            background: accentColor,
            borderColor: accentColor,
            boxShadow: `0 0 10px ${accentColor}60`,
            color: 'white',
          } : {
            background: 'rgba(255,255,255,0.05)',
            borderColor: 'rgba(255,255,255,0.1)',
            color: '#94a3b8',
          }}
        >
          {state.isPlaying ? <Pause size={10} fill="currentColor" /> : <Play size={10} fill="currentColor" />}
          <span className="text-[6px] font-black uppercase">{state.isPlaying ? 'Stop' : 'Play'}</span>
        </button>

        <button
          onMouseDown={() => onFXChange('delay', 0.6)}
          onMouseUp={() => onFXChange('delay', 0)}
          onTouchStart={() => onFXChange('delay', 0.6)}
          onTouchEnd={() => onFXChange('delay', 0)}
          className="flex flex-col items-center justify-center gap-0.5 bg-white/5 border border-white/10 py-1.5 rounded-lg text-slate-400 active:bg-indigo-500/20 active:border-indigo-500/50 transition-all"
        >
          <span className="text-[6px] font-bold uppercase">Echo</span>
        </button>

        <button
          onMouseDown={() => onFXChange('reverb', 0.7)}
          onMouseUp={() => onFXChange('reverb', 0)}
          onTouchStart={() => onFXChange('reverb', 0.7)}
          onTouchEnd={() => onFXChange('reverb', 0)}
          className="flex flex-col items-center justify-center gap-0.5 bg-white/5 border border-white/10 py-1.5 rounded-lg text-slate-400 active:bg-orange-500/20 active:border-orange-500/50 transition-all"
        >
          <span className="text-[6px] font-bold uppercase">Space</span>
        </button>
      </div>

      {/* EQ 3 bandas */}
      <div className="shrink-0 px-1">
        <div className="flex justify-between items-center mb-0.5">
          <span className="text-[6px] text-slate-500 uppercase font-black">EQ</span>
          <button onClick={() => { setEq({ low: 0, mid: 0, high: 0 }); onEQChange(id, 0, 0, 0); }}
            className="text-[5px] text-slate-600 hover:text-slate-400 uppercase font-bold">Reset</button>
        </div>
        <div className="grid grid-cols-3 gap-1">
          {eqBands.map(({ label, band, color }) => (
            <div key={band} className="flex flex-col items-center gap-0.5">
              <div className="flex justify-between w-full">
                <span className="text-[5px] text-slate-500 font-mono">{label}</span>
                <span className="text-[5px] text-slate-500 font-mono">{eq[band] > 0 ? `+${eq[band]}` : eq[band]}dB</span>
              </div>
              <input type="range" min="-15" max="15" step="1" value={eq[band]}
                onChange={(e) => handleEQ(band, parseFloat(e.target.value))}
                className={`w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer ${color}`} />
            </div>
          ))}
        </div>
      </div>

      {/* Hotcues */}
      <div className="shrink-0 px-1">
        <div className="flex justify-between items-center mb-0.5">
          <span className="text-[6px] text-slate-500 uppercase font-black">Hotcues</span>
          {hotcues.length < 4 && (
            <button onClick={addHotcue} className="text-[5px] uppercase font-bold border px-1 rounded transition-all duration-300"
              style={{ color: accentColor, borderColor: `${accentColor}40` }}>
              + Marcar
            </button>
          )}
        </div>
        <div className="grid grid-cols-4 gap-1">
          {[0,1,2,3].map((i) => (
            <button key={i}
              onClick={() => hotcues[i] !== undefined && onScratch(hotcues[i] - state.progress)}
              className={`py-1 rounded text-[6px] font-black uppercase transition-all active:scale-95 ${
                hotcues[i] !== undefined ? `${hotcueColors[i]} text-white shadow-sm` : 'bg-white/5 text-slate-700 border border-white/5'}`}>
              {hotcues[i] !== undefined ? formatTime(hotcues[i]) : `CUE ${i+1}`}
            </button>
          ))}
        </div>
      </div>

      {/* Pitch + Loop */}
      <div className="shrink-0 px-1 flex gap-2 items-end">
        <div className="flex-1">
          <div className="flex justify-between items-center mb-0.5">
            <span className="text-[6px] text-slate-500 uppercase font-black">Pitch</span>
            <span className="text-[7px] font-mono transition-all duration-300" style={{ color: accentColor }}>
              {(state.playbackRate * 100).toFixed(0)}%
            </span>
          </div>
          <input type="range" min="0.8" max="1.2" step="0.01" value={state.playbackRate}
            onChange={(e) => onRateChange(parseFloat(e.target.value))}
            className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-indigo-500" />
        </div>
        <button onClick={() => setLoopActive(!loopActive)}
          className="shrink-0 px-2 py-1 rounded text-[6px] font-black uppercase border transition-all active:scale-95"
          style={loopActive ? {
            background: `${accentColor}20`,
            color: accentColor,
            borderColor: `${accentColor}50`,
            boxShadow: `0 0 6px ${accentColor}40`,
          } : {
            background: 'rgba(255,255,255,0.03)',
            color: '#475569',
            borderColor: 'rgba(255,255,255,0.08)',
          }}>
          {loopActive ? '⟳ Loop ON' : '⟳ Loop'}
        </button>
      </div>

      {/* Waveform de fondo */}
      <div className="absolute inset-x-0 bottom-0 h-[15%] opacity-10 pointer-events-none -z-0">
        <Visualizer getData={getVisualizerData} mode="waveform" />
      </div>
    </div>
  );
};

function AnimatePresenceWrapper({ show, children }: { show: boolean; children: React.ReactNode }) {
  if (!show) return null;
  return <>{children}</>;
}
