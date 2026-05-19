import React, { useState } from 'react';
import { Play, Pause, Upload, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';
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
  onScratch: (deltaTime: number) => void;
  onSeekTo: (time: number) => void;
  getVisualizerData: () => any;
  getFreqData?: () => any;
  accentColor?: string;
}

export const Deck: React.FC<DeckProps> = ({
  id, state, onLoad, onTogglePlay, onRateChange, onFilterChange,
  onFXChange, onEQChange, onScratch, onSeekTo, getVisualizerData, getFreqData,
  accentColor = '#6366f1'
}) => {
  const [eq, setEq] = useState({ low: 0, mid: 0, high: 0 });
  const [hotcues, setHotcues] = useState<(number | null)[]>([null, null, null, null]);
  const [loopActive, setLoopActive] = useState(false);
  const [echoOn, setEchoOn] = useState(false);
  const [spaceOn, setSpaceOn] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) onLoad(e.target.files[0]);
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const handleEQ = (band: 'low' | 'mid' | 'high', value: number) => {
    const next = { ...eq, [band]: value };
    setEq(next);
    onEQChange(id, next.low, next.mid, next.high);
  };

  const toggleEcho = () => {
    const next = !echoOn;
    setEchoOn(next);
    onFXChange('delay', next ? 0.65 : 0);
  };

  const toggleSpace = () => {
    const next = !spaceOn;
    setSpaceOn(next);
    onFXChange('reverb', next ? 0.7 : 0);
  };

  const markHotcue = (i: number) => {
    const next = [...hotcues];
    next[i] = state.progress;
    setHotcues(next);
  };

  const jumpHotcue = (i: number) => {
    if (hotcues[i] !== null) onSeekTo(hotcues[i]!);
  };

  const hotcueColors = [
    { bg: 'bg-pink-500', glow: '#ec4899' },
    { bg: 'bg-yellow-500', glow: '#eab308' },
    { bg: 'bg-cyan-500', glow: '#06b6d4' },
    { bg: 'bg-green-500', glow: '#22c55e' },
  ];

  return (
    <div
      className="flex flex-col h-full w-full rounded-xl overflow-hidden relative transition-all duration-300"
      style={{
        background: 'rgba(10,10,20,0.85)',
        border: `1px solid ${accentColor}35`,
        boxShadow: `0 0 24px ${accentColor}12`,
      }}
    >
      {/* TOP ROW: header + visualizer */}
      <div className="shrink-0 px-2 pt-1.5 pb-0.5 flex items-center justify-between">
        <span className="font-mono text-[8px] tracking-widest uppercase font-black text-slate-500">Ch.{id}</span>
        <div className="flex items-center gap-2">
          {state.isLoaded && (
            <span className="text-[6px] font-mono font-bold" style={{ color: accentColor }}>{state.bpm} BPM</span>
          )}
          <span className="text-[7px] font-black font-mono uppercase"
            style={{ color: state.isPlaying ? accentColor : '#374151' }}>
            {state.isPlaying ? '▶ PLAY' : '■ STOP'}
          </span>
        </div>
      </div>

      {/* Freq bars */}
      <div className="shrink-0 h-8 mx-2 rounded overflow-hidden bg-black/40 border border-white/5">
        <Visualizer getData={getVisualizerData} freqData={getFreqData} mode="bars" />
      </div>

      {/* MIDDLE ROW: turntable + controls side by side */}
      <div className="flex-1 flex flex-row gap-1 px-1 py-1 min-h-0 items-center">

        {/* Turntable — lado izquierdo */}
        <div className="flex items-center justify-center shrink-0">
          <Turntable
            isPlaying={state.isPlaying}
            progress={state.progress}
            duration={state.duration}
            playbackRate={state.playbackRate}
            onTogglePlay={onTogglePlay}
            onSeekTo={onSeekTo}
            onScratch={onScratch}
          />
        </div>

        {/* Controles — lado derecho del plato */}
        <div className="flex-1 flex flex-col gap-1 min-h-0 justify-between">

          {/* Nombre de pista */}
          <div className="bg-black/30 px-1.5 py-0.5 rounded border border-white/5 flex justify-between items-center">
            <p className="text-white text-[7px] font-semibold truncate uppercase max-w-[70%]">
              {state.fileName === 'No Track Loaded' ? 'Sin pista' : state.fileName}
            </p>
            <div className="flex items-center gap-1">
              <span className="text-slate-500 font-mono text-[6px]">{formatTime(state.progress)}</span>
              {state.key && (
                <span className="text-[6px] font-black px-0.5 rounded"
                  style={{ color: accentColor, background: `${accentColor}20` }}>{state.key}</span>
              )}
            </div>
          </div>

          {/* Botones principales: Load + Play */}
          <div className="grid grid-cols-2 gap-1">
            <label className="flex items-center justify-center gap-1 bg-white/5 border border-white/10 py-1 rounded-lg cursor-pointer active:scale-95 transition-all">
              <Upload size={9} className="text-slate-400" />
              <span className="text-[6px] text-slate-300 font-black uppercase">Load</span>
              <input type="file" accept="audio/*" className="hidden" onChange={handleFileChange} />
            </label>
            <button
              onClick={onTogglePlay}
              disabled={!state.isLoaded}
              className="flex items-center justify-center gap-1 py-1 rounded-lg transition-all border active:scale-95 disabled:opacity-40"
              style={state.isPlaying ? {
                background: accentColor,
                borderColor: accentColor,
                boxShadow: `0 0 8px ${accentColor}60`,
              } : {
                background: 'rgba(255,255,255,0.05)',
                borderColor: 'rgba(255,255,255,0.1)',
              }}
            >
              {state.isPlaying
                ? <Pause size={9} fill="white" className="text-white" />
                : <Play size={9} fill="#94a3b8" className="text-slate-400" />}
              <span className="text-[6px] font-black uppercase"
                style={{ color: state.isPlaying ? 'white' : '#94a3b8' }}>
                {state.isPlaying ? 'Stop' : 'Play'}
              </span>
            </button>
          </div>

          {/* FX: Echo + Space — toggle on/off */}
          <div className="grid grid-cols-2 gap-1">
            <button
              onClick={toggleEcho}
              className="flex items-center justify-center gap-1 py-1 rounded-lg border transition-all active:scale-95"
              style={echoOn ? {
                background: 'rgba(99,102,241,0.25)',
                borderColor: 'rgba(99,102,241,0.6)',
                color: '#818cf8',
                boxShadow: '0 0 8px rgba(99,102,241,0.4)',
              } : {
                background: 'rgba(255,255,255,0.04)',
                borderColor: 'rgba(255,255,255,0.08)',
                color: '#64748b',
              }}
            >
              <span className="text-[6px] font-black uppercase">🔁 Echo</span>
            </button>
            <button
              onClick={toggleSpace}
              className="flex items-center justify-center gap-1 py-1 rounded-lg border transition-all active:scale-95"
              style={spaceOn ? {
                background: 'rgba(168,85,247,0.25)',
                borderColor: 'rgba(168,85,247,0.6)',
                color: '#c084fc',
                boxShadow: '0 0 8px rgba(168,85,247,0.4)',
              } : {
                background: 'rgba(255,255,255,0.04)',
                borderColor: 'rgba(255,255,255,0.08)',
                color: '#64748b',
              }}
            >
              <span className="text-[6px] font-black uppercase">🌌 Space</span>
            </button>
          </div>

          {/* EQ compacto */}
          <div>
            <div className="flex justify-between items-center mb-0.5">
              <span className="text-[5px] text-slate-600 uppercase font-black">EQ</span>
              <button onClick={() => { setEq({ low: 0, mid: 0, high: 0 }); onEQChange(id, 0, 0, 0); }}
                className="text-[5px] text-slate-700 hover:text-slate-400 uppercase">Reset</button>
            </div>
            <div className="grid grid-cols-3 gap-0.5">
              {(['low', 'mid', 'high'] as const).map((band, i) => (
                <div key={band} className="flex flex-col gap-0.5">
                  <span className="text-[4px] text-slate-600 font-mono text-center">
                    {['Lo', 'Mid', 'Hi'][i]}
                  </span>
                  <input type="range" min="-15" max="15" step="1" value={eq[band]}
                    onChange={(e) => handleEQ(band, parseFloat(e.target.value))}
                    className={`w-full h-1 bg-white/10 rounded appearance-none cursor-pointer ${
                      ['accent-orange-400', 'accent-yellow-400', 'accent-cyan-400'][i]
                    }`} />
                </div>
              ))}
            </div>
          </div>

          {/* Hotcues */}
          <div>
            <span className="text-[5px] text-slate-600 uppercase font-black block mb-0.5">Hotcues</span>
            <div className="grid grid-cols-4 gap-0.5">
              {[0,1,2,3].map((i) => (
                <div key={i} className="flex flex-col gap-0.5">
                  <button
                    onClick={() => hotcues[i] !== null ? jumpHotcue(i) : markHotcue(i)}
                    className={`py-0.5 rounded text-[5px] font-black uppercase transition-all active:scale-95 ${
                      hotcues[i] !== null
                        ? `${hotcueColors[i].bg} text-white`
                        : 'bg-white/5 text-slate-700 border border-white/5'
                    }`}
                    style={hotcues[i] !== null ? { boxShadow: `0 0 4px ${hotcueColors[i].glow}60` } : {}}
                  >
                    {hotcues[i] !== null ? formatTime(hotcues[i]!) : `C${i+1}`}
                  </button>
                  {hotcues[i] !== null && (
                    <button
                      onClick={() => { const n = [...hotcues]; n[i] = null; setHotcues(n); }}
                      className="text-[4px] text-slate-700 hover:text-red-400 text-center"
                    >✕</button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Pitch + Loop */}
          <div className="flex gap-1 items-center">
            <div className="flex-1">
              <div className="flex justify-between">
                <span className="text-[5px] text-slate-600 uppercase font-black">Pitch</span>
                <span className="text-[5px] font-mono" style={{ color: accentColor }}>
                  {(state.playbackRate * 100).toFixed(0)}%
                </span>
              </div>
              <input type="range" min="0.8" max="1.2" step="0.01" value={state.playbackRate}
                onChange={(e) => onRateChange(parseFloat(e.target.value))}
                className="w-full h-1 bg-white/10 rounded appearance-none cursor-pointer accent-indigo-500" />
            </div>
            <button
              onClick={() => setLoopActive(!loopActive)}
              className="shrink-0 px-1.5 py-0.5 rounded text-[5px] font-black uppercase border transition-all"
              style={loopActive ? {
                background: `${accentColor}25`,
                color: accentColor,
                borderColor: `${accentColor}50`,
                boxShadow: `0 0 6px ${accentColor}40`,
              } : {
                background: 'rgba(255,255,255,0.03)',
                color: '#374151',
                borderColor: 'rgba(255,255,255,0.06)',
              }}
            >
              ⟳ Loop
            </button>
          </div>

        </div>
      </div>

      {/* Waveform sutil de fondo */}
      <div className="absolute inset-x-0 bottom-0 h-8 opacity-10 pointer-events-none">
        <Visualizer getData={getVisualizerData} mode="waveform" />
      </div>
    </div>
  );
};
