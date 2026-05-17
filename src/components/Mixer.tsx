import React, { useState, useRef, useEffect } from 'react';
import { Mic, Download, Square, Radio, Zap } from 'lucide-react';
import { motion } from 'motion/react';

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
  const [aiStatus, setAiStatus] = useState('');
  const aiInterval = useRef<number | null>(null);

  useEffect(() => {
    return () => { if (aiInterval.current) clearInterval(aiInterval.current); };
  }, []);

  const stopAiMix = () => {
    if (aiInterval.current) clearInterval(aiInterval.current);
    setAiMixActive(false);
    setAiStatus('');
  };

  const startAiMix = () => {
    if (!deckA.isLoaded || !deckB.isLoaded) {
      setAiStatus('⚠️ Carga canciones en ambos platos');
      setTimeout(() => setAiStatus(''), 2500);
      return;
    }

    setAiMixActive(true);

    // FASE 1: Sincronizar BPMs
    setAiStatus('🎵 Sincronizando BPMs...');
    if (deckA.bpm > 0 && deckB.bpm > 0) {
      const rate = deckA.bpm / deckB.bpm;
      onSetRateB(Math.max(0.5, Math.min(2, rate)));
    }

    // Crossfader al 100% A
    onCrossfadeChange(0);
    if (!deckA.isPlaying) onTogglePlayA();

    // FASE 2: Arrancar B tras 1.5s
    setTimeout(() => {
      setAiStatus('▶️ Arrancando plato B...');
      if (!deckB.isPlaying) onTogglePlayB();

      // FASE 3: Mezcla suave tras 3s
      setTimeout(() => {
        setAiStatus('🎚️ Mezclando...');
        let step = 0;
        const totalSteps = 80;

        if (aiInterval.current) clearInterval(aiInterval.current);
        aiInterval.current = window.setInterval(() => {
          step++;
          onCrossfadeChange(step / totalSteps);

          if (step >= totalSteps) {
            clearInterval(aiInterval.current!);
            setAiStatus('✅ ¡Transición completa!');
            setTimeout(() => {
              setAiMixActive(false);
              setAiStatus('');
            }, 2000);
          }
        }, 100);
      }, 3000);
    }, 1500);
  };

  return (
    <div className="flex flex-col items-center justify-between h-full py-2 px-1 bg-white/5 backdrop-blur-2xl border border-white/10 rounded-2xl w-20 xs:w-28 sm:w-48 shadow-2xl relative overflow-hidden shrink-0">
      
      <div className="absolute top-0 right-0 p-2 opacity-5 pointer-events-none">
        <Radio size={40} className="text-white" />
      </div>

      {/* Branding */}
      <div className="text-center z-10 w-full mb-1 hidden xs:block">
        <h2 className="text-slate-500 font-mono text-[6px] tracking-[0.3em] uppercase font-black mb-1">Master</h2>
        <div className="flex items-center justify-center gap-1">
          <Radio size={8} className={isRecording ? 'text-red-500 animate-pulse' : 'text-slate-700'} />
          <div className="h-1 w-8 bg-white/5 rounded-full overflow-hidden border border-white/5">
            <motion.div 
              animate={{ x: isRecording ? [-15, 15] : 0 }}
              transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
              className="h-full w-4 bg-indigo-500 blur-[2px]"
            />
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
        <button 
          onClick={isRecording ? onStopRecording : onStartRecording}
          className={`flex items-center justify-center gap-1 p-2 rounded-lg border transition-all active:scale-95 ${
            isRecording ? 'bg-red-950/40 border-red-500 text-red-500 shadow-[0_0_10px_rgba(239,68,68,0.2)]' 
            : 'bg-white/5 border-white/10 text-slate-400'
          }`}
        >
          {isRecording ? <Square size={10} fill="currentColor" /> : <Mic size={10} />}
          <span className="text-[6px] font-black uppercase hidden xs:inline">{isRecording ? 'Stop' : 'Rec'}</span>
        </button>

        <button onClick={onSync} className="flex items-center justify-center gap-1 p-2 bg-white/5 border border-white/10 rounded-lg text-slate-400 hover:text-indigo-400 hover:border-indigo-500/30 transition-all active:scale-95">
          <Download size={10} />
          <span className="text-[6px] font-black uppercase hidden xs:inline">Sync</span>
        </button>

        {/* AI Mix — el botón estrella */}
        <button 
          onClick={aiMixActive ? stopAiMix : startAiMix}
          className={`flex items-center justify-center gap-1 p-2 rounded-lg border transition-all active:scale-95 ${
            aiMixActive
              ? 'bg-purple-600/30 border-purple-500/50 text-purple-300 shadow-[0_0_12px_rgba(147,51,234,0.4)]'
              : 'bg-indigo-600/10 border-indigo-500/20 text-indigo-400 hover:bg-indigo-600/20'
          }`}
        >
          <Zap size={10} className={aiMixActive ? 'animate-pulse' : ''} />
          <span className="text-[6px] font-black uppercase hidden xs:inline">
            {aiMixActive ? 'Stop AI' : 'AI Mix'}
          </span>
        </button>

        <button onClick={() => onAutoMix(crossfade > 0.5 ? 'A' : 'B')} className="flex items-center justify-center gap-1 p-2 bg-white/5 border border-white/10 rounded-lg text-slate-500 hover:text-slate-300 transition-all active:scale-95">
          <Radio size={10} />
          <span className="text-[6px] font-black uppercase hidden xs:inline">Auto</span>
        </button>
      </div>

      {/* AI Status */}
      {aiStatus ? (
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="w-full px-1 z-10">
          <div className="bg-purple-600/20 border border-purple-500/30 rounded-lg p-1 text-center">
            <p className="text-[5px] text-purple-300 font-bold leading-tight">{aiStatus}</p>
          </div>
        </motion.div>
      ) : (
        /* VU Meters */
        <div className="flex gap-2 h-14 py-1 z-10">
          {[1,2].map(i => (
            <div key={i} className="w-1.5 h-full bg-black/40 rounded-full p-0.5 flex flex-col-reverse gap-0.5 border border-white/5">
              {[...Array(8)].map((_, j) => (
                <div key={j} className={`w-full flex-1 rounded-[0.5px] transition-all duration-300 ${j > 6 ? 'bg-red-500/40' : j > 4 ? 'bg-indigo-400/40' : 'bg-slate-800'}`} />
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
          <input type="range" min="0" max="1" step="0.01" value={crossfade} onChange={(e) => onCrossfadeChange(parseFloat(e.target.value))} className="absolute w-full h-full opacity-0 cursor-pointer z-10" />
          <motion.div animate={{ left: `${crossfade * 100}%` }} transition={{ type: "spring", damping: 35, stiffness: 450 }} className="absolute -ml-3 w-6 h-5 bg-slate-800 border border-white/10 rounded-md shadow-2xl flex items-center justify-center pointer-events-none">
            <div className="h-3 w-0.5 bg-indigo-500 rounded-full" />
          </motion.div>
        </div>
      </div>
    </div>
  );
};
