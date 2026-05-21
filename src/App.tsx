import React, { useState } from 'react';
import { Play, Pause, Upload } from 'lucide-react';
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
  onScratchStart: () => void;
  onScratchMove: (rate: number) => void;
  onScratchEnd: () => void;
  onSeekTo: (time: number) => void;
  getVisualizerData: () => any;
  getFreqData?: () => any;
  accentColor?: string;
}

export const Deck: React.FC<DeckProps> = ({
  id, state, onLoad, onTogglePlay, onRateChange, onFilterChange,
  onFXChange, onEQChange, onScratchStart, onScratchMove, onScratchEnd,
  onSeekTo, getVisualizerData, getFreqData, accentColor = '#6366f1'
}) => {
  const [eq, setEq] = useState({ low: 0, mid: 0, high: 0 });
  const [hotcues, setHotcues] = useState<(number | null)[]>([null, null, null, null]);
  const [loopActive, setLoopActive] = useState(false);
  const [echoOn, setEchoOn] = useState(false);
  const [spaceOn, setSpaceOn] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) onLoad(e.target.files[0]);
  };

  const fmt = (s: number) => `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`;

  const handleEQ = (band: 'low' | 'mid' | 'high', value: number) => {
    const next = { ...eq, [band]: value };
    setEq(next);
    onEQChange(id, next.low, next.mid, next.high);
  };

  const toggleEcho = () => { const n = !echoOn; setEchoOn(n); onFXChange('delay', n ? 0.65 : 0); };
  const toggleSpace = () => { const n = !spaceOn; setSpaceOn(n); onFXChange('reverb', n ? 0.7 : 0); };

  const hotcueColors = ['bg-pink-500', 'bg-yellow-400', 'bg-cyan-500', 'bg-green-500'];
  const hotcueGlow = ['#ec4899', '#eab308', '#06b6d4', '#22c55e'];

  return (
    <div className="flex flex-col h-full w-full rounded-xl overflow-hidden"
      style={{ background: 'rgba(8,8,18,0.92)', border: `1px solid ${accentColor}30` }}>

      {/* Header */}
      <div className="flex items-center justify-between px-2 py-0.5 shrink-0 border-b border-white/5">
        <span className="font-mono text-[7px] tracking-widest uppercase font-black text-slate-500">Ch.{id}</span>
        <div className="flex items-center gap-2">
          {state.isLoaded && <span className="text-[6px] font-mono font-bold" style={{ color: accentColor }}>{state.bpm} BPM</span>}
          <span className="text-[7px] font-black font-mono" style={{ color: state.isPlaying ? accentColor : '#374151' }}>
            {state.isPlaying ? '▶ PLAY' : '■ STOP'}
          </span>
        </div>
      </div>

      {/* Freq bars */}
      <div className="h-6 mx-1.5 mt-0.5 rounded overflow-hidden bg-black/40 border border-white/5 shrink-0">
        <Visualizer getData={getVisualizerData} freqData={getFreqData} mode="bars" />
      </div>

      {/* Main: turntable + controls */}
      <div className="flex-1 flex flex-row min-h-0 p-1 gap-1.5">

        {/* Turntable — fixed size */}
        <div className="shrink-0 flex items-center justify-center" style={{ width: 112 }}>
          <Turntable
            isPlaying={state.isPlaying}
            progress={state.progress}
            duration={state.duration}
            playbackRate={state.playbackRate}
            onScratchStart={onScratchStart}
            onScratchMove={onScratchMove}
            onScratchEnd={onScratchEnd}
          />
        </div>

        {/* Controls */}
        <div className="flex-1 min-w-0 flex flex-col justify-between gap-0.5">

          {/* Track name + time */}
          <div className="flex items-center justify-between bg-black/30 px-1.5 py-0.5 rounded border border-white/5 shrink-0">
            <p className="text-[6px] text-white font-semibold truncate uppercase flex-1 mr-1">
              {state.fileName === 'No Track Loaded' ? 'Sin pista' : state.fileName}
            </p>
            <div className="flex items-center gap-1 shrink-0">
              <span className="text-[5px] text-slate-500 font-mono">{fmt(state.progress)}</span>
              {state.key && <span className="text-[5px] font-black px-0.5 rounded"
                style={{ color: accentColor, background: `${accentColor}20` }}>{state.key}</span>}
            </div>
          </div>

          {/* Load + Play */}
          <div className="grid grid-cols-2 gap-1 shrink-0">
            <label className="flex items-center justify-center gap-1 bg-white/5 border border-white/10 py-1 rounded cursor-pointer active:scale-95">
              <Upload size={8} className="text-slate-400 shrink-0" />
              <span className="text-[6px] text-slate-300 font-black uppercase">Load</span>
              <input type="file" accept="audio/*" className="hidden" onChange={handleFileChange} />
            </label>
            <button onClick={onTogglePlay} disabled={!state.isLoaded}
              className="flex items-center justify-center gap-1 py-1 rounded border active:scale-95 disabled:opacity-40 transition-all"
              style={state.isPlaying
                ? { background: accentColor, borderColor: accentColor, boxShadow: `0 0 6px ${accentColor}60` }
                : { background: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)' }}>
              {state.isPlaying
                ? <Pause size={8} fill="white" className="text-white shrink-0" />
                : <Play size={8} fill="#94a3b8" className="text-slate-400 shrink-0" />}
              <span className="text-[6px] font-black uppercase" style={{ color: state.isPlaying ? 'white' : '#94a3b8' }}>
                {state.isPlaying ? 'Stop' : 'Play'}
              </span>
            </button>
          </div>

          {/* FX */}
          <div className="grid grid-cols-2 gap-1 shrink-0">
            <button onClick={toggleEcho} className="py-0.5 rounded border text-[6px] font-black uppercase transition-all active:scale-95"
              style={echoOn
                ? { background: 'rgba(99,102,241,0.25)', borderColor: '#6366f1', color: '#818cf8', boxShadow: '0 0 6px rgba(99,102,241,0.4)' }
                : { background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.08)', color: '#475569' }}>
              🔁 Echo
            </button>
            <button onClick={toggleSpace} className="py-0.5 rounded border text-[6px] font-black uppercase transition-all active:scale-95"
              style={spaceOn
                ? { background: 'rgba(168,85,247,0.25)', borderColor: '#a855f7', color: '#c084fc', boxShadow: '0 0 6px rgba(168,85,247,0.4)' }
                : { background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.08)', color: '#475569' }}>
              🌌 Space
            </button>
          </div>

          {/* EQ */}
          <div className="shrink-0">
            <div className="flex justify-between mb-0.5">
              <span className="text-[5px] text-slate-600 uppercase font-black">EQ</span>
              <button onClick={() => { setEq({ low: 0, mid: 0, high: 0 }); onEQChange(id, 0, 0, 0); }}
                className="text-[4px] text-slate-700 hover:text-slate-400 uppercase">Reset</button>
            </div>
            <div className="grid grid-cols-3 gap-0.5">
              {(['low', 'mid', 'high'] as const).map((band, i) => (
                <div key={band} className="flex flex-col gap-px">
                  <span className="text-[4px] text-slate-600 font-mono text-center">{['Lo', 'Mid', 'Hi'][i]}</span>
                  <input type="range" min="-15" max="15" step="1" value={eq[band]}
                    onChange={(e) => handleEQ(band, parseFloat(e.target.value))}
                    className={`w-full h-1 bg-white/10 rounded appearance-none cursor-pointer ${['accent-orange-400','accent-yellow-400','accent-cyan-400'][i]}`} />
                </div>
              ))}
            </div>
          </div>

          {/* Hotcues */}
          <div className="shrink-0">
            <span className="text-[4px] text-slate-600 uppercase font-black block mb-0.5">Hotcues</span>
            <div className="grid grid-cols-4 gap-0.5">
              {[0,1,2,3].map((i) => (
                <button key={i}
                  onClick={() => hotcues[i] !== null ? onSeekTo(hotcues[i]!) : (() => { const n=[...hotcues]; n[i]=state.progress; setHotcues(n); })()}
                  className={`py-0.5 rounded text-[4px] font-black uppercase transition-all active:scale-95 ${
                    hotcues[i] !== null ? `${hotcueColors[i]} text-white` : 'bg-white/5 text-slate-700 border border-white/5'
                  }`}
                  style={hotcues[i] !== null ? { boxShadow: `0 0 4px ${hotcueGlow[i]}60` } : {}}>
                  {hotcues[i] !== null ? fmt(hotcues[i]!) : `C${i+1}`}
                </button>
              ))}
            </div>
          </div>

          {/* Pitch + Loop */}
          <div className="flex gap-1 items-center shrink-0">
            <div className="flex-1">
              <div className="flex justify-between mb-px">
                <span className="text-[4px] text-slate-600 uppercase font-black">Pitch</span>
                <span className="text-[4px] font-mono" style={{ color: accentColor }}>{(state.playbackRate * 100).toFixed(0)}%</span>
              </div>
              <input type="range" min="0.5" max="1.5" step="0.01" value={state.playbackRate}
                onChange={(e) => onRateChange(parseFloat(e.target.value))}
                className="w-full h-1 bg-white/10 rounded appearance-none cursor-pointer accent-indigo-500" />
            </div>
            <button onClick={() => setLoopActive(!loopActive)}
              className="shrink-0 px-1 py-0.5 rounded text-[4px] font-black uppercase border transition-all"
              style={loopActive
                ? { background: `${accentColor}25`, color: accentColor, borderColor: `${accentColor}50` }
                : { background: 'rgba(255,255,255,0.03)', color: '#374151', borderColor: 'rgba(255,255,255,0.06)' }}>
              ⟳ Loop
            </button>
          </div>

        </div>
      </div>
    </div>
  );
};
