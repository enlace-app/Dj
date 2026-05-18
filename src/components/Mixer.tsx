import React, { useState, useRef, useEffect } from 'react';
import { Mic, Download, Square, Radio, Zap, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface MixerProps {
  crossfade: number;
  onCrossfadeChange: (val: number) => void;
  isRecording: boolean;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onSync: () => void;
  onAutoMix: (toDeck: 'A' | 'B') => void;
  deckA: { bpm: number; progress: number; duration: number; isPlaying: boolean; isLoaded: boolean };
  deckB: { bpm: number; progress: number; duration: number; isPlaying: boolean; isLoaded: boolean };
  onTogglePlayA: () => void;
  onTogglePlayB: () => void;
  onSetRateA: (r: number) => void;
  onSetRateB: (r: number) => void;
  accentColor?: string;
}

export const Mixer: React.FC<MixerProps> = ({ 
  crossfade, onCrossfadeChange, isRecording, onStartRecording, onStopRecording,
  onSync, onAutoMix, deckA, deckB, onTogglePlayA, onTogglePlayB, onSetRateA, onSetRateB, accentColor = '#6366f1'
}) => {
  const [aiMixActive, setAiMixActive] = useState(false);
  const [magicActive, setMagicActive] = useState(false);
  const [status, setStatus] = useState('');
  const [magicPhase, setMagicPhase] = useState(0);
  const aiInterval = useRef<number | null>(null);
  const magicTimers = useRef<number[]>([]);

  useEffect(() => {
    return () => {
      if (aiInterval.current) clearInterval(aiInterval.current);
      magicTimers.current.forEach(t => clearTimeout(t));
    };
  }, []);

  const mt = (fn: () => void, ms: number) => {
    const t = window.setTimeout(fn, ms);
    magicTimers.current.push(t);
  };

  const stopAiMix = () => {
    if (aiInterval.current) clearInterval(aiInterval.current);
    setAiMixActive(false);
    setStatus('');
  };

  const startAiMix = () => {
    if (!deckA.isLoaded || !deckB.isLoaded) {
      setStatus('⚠️ Carga canciones en ambos platos');
      setTimeout(() => setStatus(''), 2500);
      return;
    }
    setAiMixActive(true);
    setStatus('🎵 Sincronizando BPMs...');
    if (deckA.bpm > 0 && deckB.bpm > 0) {
      const rate = Math.max(0.9, Math.min(1.1, deckA.bpm / deckB.bpm));
      onSetRateB(rate);
    }
    onCrossfadeChange(0);
    if (!deckA.isPlaying) onTogglePlayA();
    setTimeout(() => {
      setStatus('▶️ Arrancando plato B...');
      if (!deckB.isPlaying) onTogglePlayB();
      setTimeout(() => {
        setStatus('🎚️ Mezclando...');
        let step = 0;
        if (aiInterval.current) clearInterval(aiInterval.current);
        aiInterval.current = window.setInterval(() => {
          step++;
          onCrossfadeChange(step / 80);
          if (step >= 80) {
            clearInterval(aiInterval.current!);
            setStatus('✅ ¡Transición completa!');
            setTimeout(() => { setAiMixActive(false); setStatus(''); }, 2000);
          }
        }, 100);
      }, 3000);
    }, 1500);
  };

  const startMagicMix = () => {
    if (!deckA.isLoaded || !deckB.isLoaded) {
      setStatus('⚠️ Necesitas canciones en ambos platos');
      setTimeout(() => setStatus(''), 2500);
      return;
    }
    if (magicActive) return;
    magicTimers.current.forEach(t => clearTimeout(t));
    magicTimers.current = [];
    setMagicActive(true);
    setMagicPhase(1);
    const goToB = crossfade <= 0.5;
    setStatus('✨ Analizando pistas...');
    if (deckA.bpm > 0 && deckB.bpm > 0) {
      const rawRate = goToB ? deckA.bpm / deckB.bpm : deckB.bpm / deckA.bpm;
      const safeRate = Math.max(0.9, Math.min(1.1, rawRate));
      if (goToB) onSetRateB(safeRate);
      else onSetRateA(safeRate);
    }
    if (!deckA.isPlaying) onTogglePlayA();
    mt(() => {
      setMagicPhase(2);
      setStatus('🎵 Preparando entrada...');
      if (goToB && !deckB.isPlaying) onTogglePlayB();
      if (!goToB && !deckA.isPlaying) onTogglePlayA();
    }, 1200);
    mt(() => {
      setMagicPhase(3);
      setStatus('🌊 Aplicando efectos...');
    }, 2400);
    mt(() => {
      setMagicPhase(4);
      setStatus('🎚️ Transición mágica...');
      let step = 0;
      const totalSteps = 100;
      const startCross = crossfade;
      const endCross = goToB ? 1 : 0;
      const interval = window.setInterval(() => {
        step++;
        const t = step / totalSteps;
        const s = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
        onCrossfadeChange(startCross + (endCross - startCross) * s);
        if (step >= totalSteps) {
          clearInterval(interval);
          setMagicPhase(5);
          setStatus('🎉 ¡Magic completado!');
          mt(() => { setMagicActive(false); setMagicPhase(0); setStatus(''); }, 2500);
        }
      }, 80);
      magicTimers.current.push(interval as unknown as number);
    }, 3500);
  };

  return (
    <div
      className="flex flex-col items-center justify-between h-full py-2 px-1 backdrop-blur-2xl rounded-2xl w-20 xs:w-28 sm:w-48 shadow-2xl relative overflow-hidden shrink-0 transition-all duration-300"
      style={{
        background: `rgba(255,255,255,0.03)`,
        border: `1px solid ${accentColor}30`,
        boxShadow: `0 0 20px ${accentColor}15, inset 0 0 10px ${accentColor}05`,
      }}
    >
      
      <AnimatePresence>
        {magicActive && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 pointer-events-none transition-all duration-1000 rounded-2xl"
            style={{
              background: `linear-gradient(135deg, ${accentColor}20, transparent)`,
            }} />
        )}
      </AnimatePresence>

      <div className="absolute top-0 right-0 p-2 opacity-5 pointer-events-none transition-all duration-300"
        style={{ color: accentColor }}>
        <Radio size={40} />
      </div>

      {/* Branding */}
      <div className="text-center z-10 w-full mb-1 hidden xs:block">
        <h2 className="font-mono text-[6px] tracking-[0.3em] uppercase font-black mb-1 transition-all duration-300"
          style={{ color: accentColor }}>Master</h2>
        <div className="flex items-center justify-center gap-1">
          <Radio size={8} className={isRecording ? 'text-red-500 animate-pulse' : 'text-slate-700'} />
          <div className="h-1 w-8 bg-white/5 rounded-full overflow-hidden border border-white/5">
            <motion.div animate={{ x: isRecording ? [-15, 15] : 0 }}
              transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
              className="h-full w-4 blur-[2px]"
              style={{ background: accentColor }} />
          </div>
        </div>
      </div>

      {/* BPM display */}
      <div className="w-full px-1 z-10">
        <div
          className="rounded-lg p-1 border flex justify-between items-center transition-all duration-300"
          style={{
            background: `${accentColor}10`,
            borderColor: `${accentColor}30`,
          }}
        >
          <div className="text-center flex-1">
            <div className="text-[5px] text-slate-600 uppercase font-bold">A</div>
            <div className="text-[9px] font-mono font-bold transition-all duration-300" style={{ color: accentColor }}>{deckA.bpm}</div>
            <div className="text-[4px] text-slate-600">BPM</div>
          </div>
          <div className="w-px h-6 transition-all duration-300" style={{ background: `${accentColor}40` }} />
          <div className="text-center flex-1">
            <div className="text-[5px] text-slate-600 uppercase font-bold">B</div>
            <div className="text-[9px] font-mono font-bold transition-all duration-300" style={{ color: accentColor }}>{deckB.bpm}</div>
            <div className="text-[4px] text-slate-600">BPM</div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-col gap-1.5 w-full px-0.5 z-10">
        <button onClick={isRecording ? onStopRecording : onStartRecording}
          className="flex items-center justify-center gap-1 p-2 rounded-lg border transition-all active:scale-95"
          style={isRecording ? {
            background: 'rgba(239,68,68,0.2)',
            borderColor: 'rgba(239,68,68,0.5)',
            color: '#ef4444',
          } : {
            background: 'rgba(255,255,255,0.05)',
            borderColor: 'rgba(255,255,255,0.1)',
            color: '#94a3b8',
          }}>
          {isRecording ? <Square size={10} fill="currentColor" /> : <Mic size={10} />}
          <span className="text-[6px] font-black uppercase hidden xs:inline">{isRecording ? 'Stop' : 'Rec'}</span>
        </button>

        <button onClick={onSync}
          className="flex items-center justify-center gap-1 p-2 rounded-lg border transition-all active:scale-95"
          style={{
            background: `${accentColor}10`,
            borderColor: `${accentColor}30`,
            color: accentColor,
          }}>
          <Download size={10} />
          <span className="text-[6px] font-black uppercase hidden xs:inline">Sync</span>
        </button>

        <button onClick={aiMixActive ? stopAiMix : startAiMix}
          className="flex items-center justify-center gap-1 p-2 rounded-lg border transition-all active:scale-95"
          style={aiMixActive ? {
            background: `rgba(168,85,247,0.2)`,
            borderColor: 'rgba(168,85,247,0.6)',
            color: '#c084fc',
            boxShadow: `0 0 12px rgba(168,85,247,0.4)`,
          } : {
            background: `rgba(168,85,247,0.08)`,
            borderColor: `rgba(168,85,247,0.3)`,
            color: '#a78bfa',
          }}>
          <Zap size={10} className={aiMixActive ? 'animate-pulse' : ''} />
          <span className="text-[6px] font-black uppercase hidden xs:inline">{aiMixActive ? 'Stop' : 'AI Mix'}</span>
        </button>

        {/* ✨ MAGIC */}
        <motion.button onClick={startMagicMix} disabled={magicActive} whileTap={{ scale: 0.93 }}
          className="flex items-center justify-center gap-1 p-2 rounded-lg border transition-all"
          style={magicActive ? {
            background: `rgba(250,204,21,0.2)`,
            borderColor: 'rgba(250,204,21,0.6)',
            color: '#fde047',
            boxShadow: `0 0 16px rgba(250,204,21,0.5)`,
          } : {
            background: `linear-gradient(135deg, rgba(250,204,21,0.1), rgba(251,146,60,0.08))`,
            borderColor: 'rgba(250,204,21,0.4)',
            color: '#fbbf24',
          }}>
          <Sparkles size={10} className={magicActive ? 'animate-spin' : ''} />
          <span className="text-[6px] font-black uppercase hidden xs:inline">
            {magicActive ? '✨ Magic...' : '✨ Magic'}
          </span>
        </motion.button>
      </div>

      {/* Status */}
      <AnimatePresence>
        {status && (
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="w-full px-1 z-10">
            <div
              className="rounded-lg p-1 text-center border transition-all duration-300"
              style={{
                background: magicActive ? `rgba(250,204,21,0.15)` : `${accentColor}15`,
                borderColor: magicActive ? `rgba(250,204,21,0.3)` : `${accentColor}40`,
              }}
            >
              <p
                className="text-[5px] font-bold leading-tight transition-all duration-300"
                style={{ color: magicActive ? '#fde047' : accentColor }}
              >
                {status}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* VU Meters */}
      {!status && (
        <div className="flex gap-2 h-14 py-1 z-10">
          {[1,2].map(i => (
            <div key={i} className="w-1.5 h-full bg-black/40 rounded-full p-0.5 flex flex-col-reverse gap-0.5 border border-white/5">
              {[...Array(8)].map((_, j) => (
                <div key={j}
                  className="w-full flex-1 rounded-[0.5px] transition-all duration-300"
                  style={{
                    background: j > 6 ? 'rgba(239,68,68,0.5)' : j > 4 ? `${accentColor}50` : 'rgba(71,85,105,0.8)',
                  }} />
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Crossfader */}
      <div className="w-full space-y-1 px-1 z-10 pb-1">
        <div className="flex justify-between px-1">
          <span className="text-[6px] text-slate-500 font-black">A</span>
          <span className="text-[6px] text-slate-500 font-black">B</span>
        </div>
        <div className="relative h-8 flex items-center">
          <div className="absolute w-full h-1 bg-black/40 rounded-full border border-white/5" />
          <input type="range" min="0" max="1" step="0.01" value={crossfade}
            onChange={(e) => onCrossfadeChange(parseFloat(e.target.value))}
            className="absolute w-full h-full opacity-0 cursor-pointer z-10" />
          <motion.div animate={{ left: `${crossfade * 100}%` }} transition={{ type: "spring", damping: 35, stiffness: 450 }}
            className="absolute -ml-3 w-6 h-5 rounded-md shadow-2xl flex items-center justify-center pointer-events-none border transition-all duration-300"
            style={magicActive ? {
              background: 'rgba(250,204,21,0.3)',
              borderColor: 'rgba(250,204,21,0.6)',
            } : {
              background: 'rgba(30,30,30,0.8)',
              borderColor: 'rgba(255,255,255,0.1)',
            }}>
            <div className="h-3 w-0.5 rounded-full transition-all duration-300"
              style={{ background: magicActive ? '#fde047' : accentColor }} />
          </motion.div>
        </div>
      </div>
    </div>
  );
};
