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
}

export const Mixer: React.FC<MixerProps> = ({ 
  crossfade, onCrossfadeChange, isRecording, onStartRecording, onStopRecording,
  onSync, onAutoMix, deckA, deckB, onTogglePlayA, onTogglePlayB, onSetRateA, onSetRateB,
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

    // Clamp rate to ±10% for natural sound
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

    // FASE 1: Sync BPM — máximo ±10% para no distorsionar
    setStatus('✨ Analizando pistas...');
    if (deckA.bpm > 0 && deckB.bpm > 0) {
      const rawRate = goToB ? deckA.bpm / deckB.bpm : deckB.bpm / deckA.bpm;
      const safeRate = Math.max(0.9, Math.min(1.1, rawRate));
      if (goToB) onSetRateB(safeRate);
      else onSetRateA(safeRate);
    }
    if (!deckA.isPlaying) onTogglePlayA();

    // FASE 2: Arrancar plato destino
    mt(() => {
      setMagicPhase(2);
      setStatus('🎵 Preparando entrada...');
      if (goToB && !deckB.isPlaying) onTogglePlayB();
      if (!goToB && !deckA.isPlaying) onTogglePlayA();
    }, 1200);

    // FASE 3: Efectos
    mt(() => {
      setMagicPhase(3);
      setStatus('🌊 Aplicando efectos...');
    }, 2400);

    // FASE 4: Transición curva S
    mt(() => {
      setMagicPhase(4);
      setStatus('🎚️ Transición mágica...');
      let step = 0;
      const totalSteps = 100;
      const startCross = crossfade;
      const endCross = goToB ? 1 : 0;

      const interval = window.setInterval(() => {
        step++;
        // Curva S natural
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

  const phaseGradients = ['', 
    'from-yellow-600/20 to-orange-600/10',
    'from-orange-600/20 to-pink-600/10',
    'from-pink-600/20 to-purple-600/10',
    'from-purple-600/20 to-indigo-600/10',
    'from-indigo-600/20 to-cyan-600/10',
  ];

  return (
    <div className="flex flex-col items-center justify-between h-full py-2 px-1 bg-white/5 backdrop-blur-2xl border border-white/10 rounded-2xl w-20 xs:w-28 sm:w-48 shadow-2xl relative overflow-hidden shrink-0">
      
      <AnimatePresence>
        {magicActive && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className={`absolute inset-0 bg-gradient-to-b ${phaseGradients[magicPhase]} pointer-events-none transition-all duration-1000`} />
        )}
      </AnimatePresence>

      <div className="absolute top-0 right-0 p-2 opacity-5 pointer-events-none">
        <Radio size={40} className="text-white" />
      </div>

      {/* Branding */}
      <div className="text-center z-10 w-full mb-1 hidden xs:block">
        <h2 className="text-slate-500 font-mono text-[6px] tracking-[0.3em] uppercase font-black mb-1">Master</h2>
        <div className="flex items-center justify-center gap-1">
          <Radio size={8} className={isRecording ? 'text-red-500 animate-pulse' : 'text-slate-700'} />
          <div className="h-1 w-8 bg-white/5 rounded-full overflow-hidden border border-white/5">
            <motion.div animate={{ x: isRecording ? [-15, 15] : 0 }}
              transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
              className="h-full w-4 bg-indigo-500 blur-[2px]" />
          </div>
        </div>
      </div>

      {/* BPM display */}
      <div className="w-full px-1 z-10">
        <div className="bg-black/20 rounded-lg p-1 border border-white/5 flex justify-between items-center">
          <div className="text-center flex-1">
            <div className="text-[5px] text-slate-600 uppercase font-bold">A</div>
            <div className="text-[9px] text-indigo-400 font-mono font-bold">{deckA.bpm}</div>
            <div className="text-[4px] text-slate-600">BPM</div>
          </div>
          <div className="w-px h-6 bg-white/10" />
          <div className="text-center flex-1">
            <div className="text-[5px] text-slate-600 uppercase font-bold">B</div>
            <div className="text-[9px] text-indigo-400 font-mono font-bold">{deckB.bpm}</div>
            <div className="text-[4px] text-slate-600">BPM</div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-col gap-1.5 w-full px-0.5 z-10">
        <button onClick={isRecording ? onStopRecording : onStartRecording}
          className={`flex items-center justify-center gap-1 p-2 rounded-lg border transition-all active:scale-95 ${
            isRecording ? 'bg-red-950/40 border-red-500 text-red-500' : 'bg-white/5 border-white/10 text-slate-400'}`}>
          {isRecording ? <Square size={10} fill="currentColor" /> : <Mic size={10} />}
          <span className="text-[6px] font-black uppercase hidden xs:inline">{isRecording ? 'Stop' : 'Rec'}</span>
        </button>

        <button onClick={onSync} className="flex items-center justify-center gap-1 p-2 bg-white/5 border border-white/10 rounded-lg text-slate-400 hover:text-indigo-400 transition-all active:scale-95">
          <Download size={10} />
          <span className="text-[6px] font-black uppercase hidden xs:inline">Sync</span>
        </button>

        <button onClick={aiMixActive ? stopAiMix : startAiMix}
          className={`flex items-center justify-center gap-1 p-2 rounded-lg border transition-all active:scale-95 ${
            aiMixActive ? 'bg-purple-600/30 border-purple-500/50 text-purple-300' : 'bg-indigo-600/10 border-indigo-500/20 text-indigo-400'}`}>
          <Zap size={10} className={aiMixActive ? 'animate-pulse' : ''} />
          <span className="text-[6px] font-black uppercase hidden xs:inline">{aiMixActive ? 'Stop' : 'AI Mix'}</span>
        </button>

        {/* ✨ MAGIC */}
        <motion.button onClick={startMagicMix} disabled={magicActive} whileTap={{ scale: 0.93 }}
          className={`flex items-center justify-center gap-1 p-2 rounded-lg border transition-all ${
            magicActive ? 'border-yellow-400/60 text-yellow-300 shadow-[0_0_16px_rgba(250,204,21,0.4)]'
            : 'bg-gradient-to-r from-yellow-600/20 to-orange-600/20 border-yellow-500/40 text-yellow-400 hover:from-yellow-600/30'}`}>
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
            <div className={`rounded-lg p-1 text-center border ${magicActive ? 'bg-yellow-600/20 border-yellow-500/30' : 'bg-purple-600/20 border-purple-500/30'}`}>
              <p className={`text-[5px] font-bold leading-tight ${magicActive ? 'text-yellow-300' : 'text-purple-300'}`}>{status}</p>
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
                <div key={j} className={`w-full flex-1 rounded-[0.5px] ${j > 6 ? 'bg-red-500/40' : j > 4 ? 'bg-indigo-400/40' : 'bg-slate-800'}`} />
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
            className={`absolute -ml-3 w-6 h-5 rounded-md shadow-2xl flex items-center justify-center pointer-events-none border ${
              magicActive ? 'bg-yellow-900/60 border-yellow-500/40' : 'bg-slate-800 border-white/10'}`}>
            <div className={`h-3 w-0.5 rounded-full ${magicActive ? 'bg-yellow-400' : 'bg-indigo-500'}`} />
          </motion.div>
        </div>
      </div>
    </div>
  );
};
