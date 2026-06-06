import React, { useState } from 'react';
import { Play, Pause, Upload } from 'lucide-react';
import { Turntable } from './Turntable';
import { Visualizer } from './Visualizer';
import { WaveformOverview } from './WaveformOverview';
import { DeckState } from '../hooks/useDJEngine';

interface DeckProps {
  id: 'A' | 'B';
  state: DeckState;
  audioBuffer: AudioBuffer | null;
  onLoad: (file: File) => void;
  onTogglePlay: () => void;
  onRateChange: (rate: number) => void;
  onFilterChange: (freq: number) => void;
  onFXChange: (type: 'delay' | 'reverb', value: number) => void;
  onEQChange: (deck: 'A' | 'B', low: number, mid: number, high: number) => void;
  onVolumeChange: (deck: 'A' | 'B', volume: number) => void;
  onScratchStart: () => void;
  onScratchMove: (rate: number) => void;
  onScratchEnd: () => void;
  onSeekTo: (time: number) => void;
  onSetLoop: (deck: 'A' | 'B', active: boolean, loopLength?: number) => void;
  onBrake: (deck: 'A' | 'B') => void;
  onBackspin: (deck: 'A' | 'B') => void;
  onFilterSweep: (deck: 'A' | 'B', active: boolean) => void;
  onFlanger: (deck: 'A' | 'B', active: boolean) => void;
  getVisualizerData: () => any;
  getFreqData?: () => any;
  accentColor?: string;
}

export const Deck: React.FC<DeckProps> = ({
  id, state, audioBuffer, onLoad, onTogglePlay, onRateChange, onFilterChange,
  onFXChange, onEQChange, onVolumeChange, onScratchStart, onScratchMove, onScratchEnd,
  onSeekTo, onSetLoop, onBrake, onBackspin, onFilterSweep, onFlanger,
  getVisualizerData, getFreqData, accentColor = '#6366f1'
}) => {
  const [eq, setEq] = useState({ low: 0, mid: 0, high: 0 });
  // Hotcues persisted per track in localStorage
  const hotcueKey = `vd-hotcues-${id}-${state.fileName}`;
  const [hotcues, setHotcuesState] = useState<(number | null)[]>(() => {
    try {
      const saved = localStorage.getItem(hotcueKey);
      return saved ? JSON.parse(saved) : [null, null, null, null];
    } catch { return [null, null, null, null]; }
  });

  const setHotcues = (next: (number | null)[]) => {
    setHotcuesState(next);
    try { localStorage.setItem(hotcueKey, JSON.stringify(next)); } catch {}
  };
  const [echoOn, setEchoOn] = useState(false);
  const [spaceOn, setSpaceOn] = useState(false);
  const [channelVolume, setChannelVolume] = useState(1);
  const [filterActive, setFilterActive] = useState(false);
  const [flangerActive, setFlangerActive] = useState(false);

  // Reload hotcues when a new track is loaded
  React.useEffect(() => {
    if (!state.fileName || state.fileName === 'No Track Loaded') {
      setHotcuesState([null, null, null, null]);
      return;
    }
    try {
      const key = `vd-hotcues-${id}-${state.fileName}`;
      const saved = localStorage.getItem(key);
      setHotcuesState(saved ? JSON.parse(saved) : [null, null, null, null]);
    } catch { setHotcuesState([null, null, null, null]); }
  }, [state.fileName, id]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) onLoad(e.target.files[0]);
  };

  const fmt = (s: number) => `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`;

  const handleEQ = (band: 'low' | 'mid' | 'high', value: number) => {
    const next = { ...eq, [band]: value };
    setEq(next);
    onEQChange(id, next.low, next.mid, next.high);
  };

  const handleVolume = (v: number) => {
    setChannelVolume(v);
    onVolumeChange(id, v);
  };

  const toggleEcho = () => { const n = !echoOn; setEchoOn(n); onFXChange('delay', n ? 0.65 : 0); };
  const toggleSpace = () => { const n = !spaceOn; setSpaceOn(n); onFXChange('reverb', n ? 0.7 : 0); };

  const longPressTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const markOrJumpHotcue = (i: number) => {
    if (hotcues[i] !== null) { onSeekTo(hotcues[i]!); }
    else { const n = [...hotcues]; n[i] = state.progress; setHotcues(n); }
  };

  const clearHotcue = (i: number) => {
    const n = [...hotcues]; n[i] = null; setHotcues(n);
  };

  const onHotcueDown = (i: number) => {
    longPressTimer.current = setTimeout(() => clearHotcue(i), 600);
  };

  const onHotcueUp = (i: number) => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const loopBeats = [1, 2, 4, 8];
  const beatLen = state.bpm > 0 ? 60 / state.bpm : 0.5;

  const toggleLoop = (beats: number) => {
    const loopLength = beatLen * beats;
    if (state.loopActive && Math.abs((state.loopEnd - state.loopStart) - loopLength) < 0.05) {
      onSetLoop(id, false);
    } else {
      onSetLoop(id, true, loopLength);
    }
  };

  const hotcueColors = ['bg-pink-500', 'bg-yellow-400', 'bg-cyan-500', 'bg-green-500'];
  const hotcueGlow = ['#ec4899', '#eab308', '#06b6d4', '#22c55e'];
  const currentLoopBeats = state.loopActive && state.bpm > 0
    ? Math.round((state.loopEnd - state.loopStart) / beatLen) : null;
  const vuColor = channelVolume > 0.85 ? '#ef4444' : channelVolume > 0.6 ? accentColor : accentColor + '99';

  // FX Pad handlers
  const handleFilterSweep = (active: boolean) => {
    setFilterActive(active);
    onFilterSweep(id, active);
  };

  const handleFlanger = (active: boolean) => {
    setFlangerActive(active);
    onFlanger(id, active);
  };

  const fxPad = [
    {
      label: '📼 Brake',
      color: '#f97316',
      onDown: () => onBrake(id),
      onUp: () => {},
      hold: false,
    },
    {
      label: '🔄 Spin',
      color: '#ec4899',
      onDown: () => onBackspin(id),
      onUp: () => {},
      hold: false,
    },
    {
      label: '🌀 Filter',
      color: '#06b6d4',
      onDown: () => handleFilterSweep(true),
      onUp: () => handleFilterSweep(false),
      hold: true,
      active: filterActive,
    },
    {
      label: '〰️ Flange',
      color: '#a855f7',
      onDown: () => handleFlanger(true),
      onUp: () => handleFlanger(false),
      hold: true,
      active: flangerActive,
    },
  ];

  return (
    <div className="flex flex-col h-full w-full rounded-xl overflow-hidden"
      style={{ background: 'rgba(8,8,18,0.92)', border: `1px solid ${accentColor}30` }}>

      {/* Header */}
      <div className="flex items-center justify-between px-2 py-0.5 shrink-0 border-b border-white/5">
        <span className="font-mono text-[7px] tracking-widest uppercase font-black text-slate-500">Ch.{id}</span>
        <div className="flex items-center gap-2">
          {state.isLoaded && <span className="text-[6px] font-mono font-bold" style={{ color: accentColor }}>{state.bpm} BPM</span>}
          {state.loopActive && (
            <span className="text-[5px] font-black px-1 py-px rounded animate-pulse"
              style={{ background: `${accentColor}30`, color: accentColor, border: `1px solid ${accentColor}60` }}>
              ⟳ {currentLoopBeats}B
            </span>
          )}
          <span className="text-[7px] font-black font-mono" style={{ color: state.isPlaying ? accentColor : '#374151' }}>
            {state.isPlaying ? '▶ PLAY' : '■ STOP'}
          </span>
        </div>
      </div>

      {/* Waveform overview */}
      <div className="h-10 mx-1.5 mt-0.5 rounded overflow-hidden bg-black/60 border border-white/5 shrink-0">
        <WaveformOverview
          audioBuffer={audioBuffer}
          progress={state.progress}
          duration={state.duration}
          hotcues={hotcues}
          dropTime={state.dropTime ?? 0}
          loopStart={state.loopActive ? state.loopStart : null}
          loopEnd={state.loopActive ? state.loopEnd : null}
          accentColor={accentColor}
          onSeek={onSeekTo}
        />
      </div>

      {/* Freq bars */}
      <div className="h-5 mx-1.5 mt-0.5 rounded overflow-hidden bg-black/40 border border-white/5 shrink-0">
        <Visualizer getData={getVisualizerData} freqData={getFreqData} mode="bars" />
      </div>

      {/* Main row */}
      <div className="flex-1 flex flex-row min-h-0 p-1 gap-1">

        {/* Channel volume fader */}
        <div className="shrink-0 flex flex-col items-center gap-0.5 w-5">
          <span className="text-[4px] text-slate-600 font-black uppercase">VOL</span>
          <div className="flex-1 w-2 bg-black/40 rounded-full border border-white/5 overflow-hidden flex flex-col-reverse">
            <div className="w-full rounded-full transition-all duration-100"
              style={{ height: `${channelVolume * 100}%`, background: `linear-gradient(to top, ${vuColor}, ${accentColor}88)` }} />
          </div>
          <div className="relative" style={{ height: 80, width: 20 }}>
            <input type="range" min="0" max="1" step="0.01" value={channelVolume}
              onChange={(e) => handleVolume(parseFloat(e.target.value))}
              className="absolute appearance-none bg-transparent cursor-pointer"
              style={{ width: 80, height: 20, left: '50%', top: '50%', transform: 'translate(-50%, -50%) rotate(-90deg)', accentColor }} />
          </div>
          <span className="text-[4px] font-mono" style={{ color: channelVolume < 0.05 ? '#ef4444' : '#475569' }}>
            {Math.round(channelVolume * 100)}
          </span>
        </div>

        {/* Turntable */}
        <div className="shrink-0 flex items-center justify-center" style={{ width: 108 }}>
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

          {/* Track info */}
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
              {state.isPlaying ? <Pause size={8} fill="white" className="text-white shrink-0" /> : <Play size={8} fill="#94a3b8" className="text-slate-400 shrink-0" />}
              <span className="text-[6px] font-black uppercase" style={{ color: state.isPlaying ? 'white' : '#94a3b8' }}>
                {state.isPlaying ? 'Stop' : 'Play'}
              </span>
            </button>
          </div>

          {/* FX Pad — Brake / Backspin / Filter / Flanger */}
          <div className="shrink-0">
            <span className="text-[4px] text-slate-600 uppercase font-black block mb-0.5">FX Pad</span>
            <div className="grid grid-cols-4 gap-0.5">
              {fxPad.map((fx) => (
                <button
                  key={fx.label}
                  onMouseDown={fx.onDown}
                  onMouseUp={fx.onUp}
                  onMouseLeave={fx.onUp}
                  onTouchStart={(e) => { e.preventDefault(); fx.onDown(); }}
                  onTouchEnd={fx.onUp}
                  className="py-1 rounded border text-[4px] font-black uppercase transition-all select-none"
                  style={fx.hold && fx.active ? {
                    background: `${fx.color}30`,
                    borderColor: fx.color,
                    color: fx.color,
                    boxShadow: `0 0 8px ${fx.color}60`,
                  } : {
                    background: 'rgba(255,255,255,0.04)',
                    borderColor: `${fx.color}40`,
                    color: fx.color,
                  }}
                >
                  {fx.label}
                </button>
              ))}
            </div>
          </div>

          {/* Echo + Space */}
          <div className="grid grid-cols-2 gap-1 shrink-0">
            <button onClick={toggleEcho} className="py-0.5 rounded border text-[6px] font-black uppercase transition-all active:scale-95"
              style={echoOn
                ? { background: 'rgba(99,102,241,0.25)', borderColor: '#6366f1', color: '#818cf8' }
                : { background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.08)', color: '#475569' }}>
              🔁 Echo
            </button>
            <button onClick={toggleSpace} className="py-0.5 rounded border text-[6px] font-black uppercase transition-all active:scale-95"
              style={spaceOn
                ? { background: 'rgba(168,85,247,0.25)', borderColor: '#a855f7', color: '#c084fc' }
                : { background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.08)', color: '#475569' }}>
              🌌 Space
            </button>
          </div>

          {/* EQ — knobs compactos horizontales */}
          <div className="shrink-0">
            <div className="flex justify-between mb-0.5">
              <span className="text-[5px] text-slate-600 uppercase font-black">EQ</span>
              <button onClick={() => { setEq({ low: 0, mid: 0, high: 0 }); onEQChange(id, 0, 0, 0); }}
                className="text-[4px] text-slate-700 hover:text-slate-400 uppercase">Reset</button>
            </div>
            <div className="flex gap-1">
              {(['low', 'mid', 'high'] as const).map((band, i) => {
                const colors = ['#f97316', '#eab308', '#06b6d4'];
                const labels = ['Lo', 'Mid', 'Hi'];
                const val = eq[band];
                return (
                  <div key={band} className="flex-1 flex flex-col items-center gap-px">
                    <span className="text-[4px] font-mono font-black"
                      style={{ color: val === 0 ? '#475569' : colors[i] }}>
                      {val > 0 ? `+${val}` : val}
                    </span>
                    <input type="range" min="-15" max="15" step="1" value={val}
                      onChange={(e) => handleEQ(band, parseFloat(e.target.value))}
                      className="w-full cursor-pointer appearance-none rounded"
                      style={{
                        height: 20,
                        accentColor: colors[i],
                        background: `linear-gradient(to right, ${colors[i]} ${((val+15)/30)*100}%, rgba(255,255,255,0.1) ${((val+15)/30)*100}%)`,
                      }} />
                    <span className="text-[4px] uppercase font-black" style={{ color: colors[i] }}>{labels[i]}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Hotcues */}
          <div className="shrink-0">
            <span className="text-[4px] text-slate-600 uppercase font-black block mb-0.5">Hotcues</span>
            <div className="grid grid-cols-4 gap-0.5">
              {[0,1,2,3].map((i) => (
                <button key={i}
                  onClick={() => markOrJumpHotcue(i)}
                  onMouseDown={() => onHotcueDown(i)}
                  onMouseUp={() => onHotcueUp(i)}
                  onMouseLeave={() => onHotcueUp(i)}
                  onTouchStart={() => onHotcueDown(i)}
                  onTouchEnd={() => onHotcueUp(i)}
                  className={`py-0.5 rounded text-[4px] font-black uppercase transition-all active:scale-95 ${
                    hotcues[i] !== null ? `${hotcueColors[i]} text-white` : 'bg-white/5 text-slate-700 border border-white/5'}`}
                  style={hotcues[i] !== null ? { boxShadow: `0 0 4px ${hotcueGlow[i]}60` } : {}}>
                  {hotcues[i] !== null ? fmt(hotcues[i]!) : `C${i+1}`}
                </button>
              ))}
            </div>
          </div>

          {/* Loop */}
          <div className="shrink-0">
            <span className="text-[4px] text-slate-600 uppercase font-black block mb-0.5">Loop</span>
            <div className="grid grid-cols-4 gap-0.5">
              {loopBeats.map((beats) => {
                const isActive = state.loopActive && currentLoopBeats === beats;
                return (
                  <button key={beats} onClick={() => toggleLoop(beats)} disabled={!state.isLoaded}
                    className="py-0.5 rounded text-[5px] font-black uppercase transition-all active:scale-95 disabled:opacity-30 border"
                    style={isActive
                      ? { background: `${accentColor}30`, borderColor: accentColor, color: accentColor, boxShadow: `0 0 6px ${accentColor}50` }
                      : { background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.1)', color: '#64748b' }}>
                    {beats}B
                  </button>
                );
              })}
            </div>
          </div>

          {/* Pitch */}
          <div className="shrink-0">
            <div className="flex justify-between mb-px">
              <span className="text-[4px] text-slate-600 uppercase font-black">Pitch</span>
              <span className="text-[4px] font-mono" style={{ color: accentColor }}>{(state.playbackRate * 100).toFixed(0)}%</span>
            </div>
            <input type="range" min="0.5" max="1.5" step="0.01" value={state.playbackRate}
              onChange={(e) => onRateChange(parseFloat(e.target.value))}
              className="w-full h-1 bg-white/10 rounded appearance-none cursor-pointer accent-indigo-500" />
          </div>

        </div>
      </div>
    </div>
  );
};
