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
  // Freq data to detect drops
  freqDataA?: () => any;
  freqDataB?: () => any;
}

export const Mixer: React.FC<MixerProps> = ({ 
  crossfade, onCrossfadeChange, isRecording, onStartRecording, onStopRecording,
  onSync, onAutoMix, deckA, deckB, onTogglePlayA, onTogglePlayB, onSetRateA, onSetRateB,
  accentColor = '#6366f1', freqDataA, freqDataB,
}) => {
  const [aiMixActive, setAiMixActive] = useState(false);
  const [magicActive, setMagicActive] = useState(false);
  const [magicReady, setMagicReady] = useState(false); // IA preparó todo, esperando al usuario
  const [status, setStatus] = useState('');
  const [dropCountdown, setDropCountdown] = useState<number | null>(null);
  const aiInterval = useRef<number | null>(null);
  const magicTimers = useRef<number[]>([]);
  const dropMonitor = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (aiInterval.current) clearInterval(aiInterval.current);
      if (dropMonitor.current) clearInterval(dropMonitor.current);
      magicTimers.current.forEach(t => clearTimeout(t));
    };
  }, []);

  const mt = (fn: () => void, ms: number) => {
    const t = window.setTimeout(fn, ms);
    magicTimers.current.push(t);
    return t;
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

  // ✨ MAGIC CON IA REAL
  // La IA detecta el subidón, sincroniza BPMs y arranca B en el momento correcto.
  // El crossfader NO se mueve — lo decide el usuario.
  const startMagicMix = () => {
    if (!deckA.isLoaded || !deckB.isLoaded) {
      setStatus('⚠️ Necesitas canciones en ambos platos');
      setTimeout(() => setStatus(''), 2500);
      return;
    }
    if (magicActive) {
      // Cancelar
      magicTimers.current.forEach(t => clearTimeout(t));
      magicTimers.current = [];
      if (dropMonitor.current) clearInterval(dropMonitor.current);
      setMagicActive(false);
      setMagicReady(false);
      setDropCountdown(null);
      setStatus('');
      return;
    }

    setMagicActive(true);
    setStatus('🧠 Analizando subidón...');

    // Paso 1: Sincronizar BPMs — máximo ±10%
    const goToB = crossfade <= 0.5;
    if (deckA.bpm > 0 && deckB.bpm > 0) {
      const rawRate = goToB ? deckA.bpm / deckB.bpm : deckB.bpm / deckA.bpm;
      const safeRate = Math.max(0.9, Math.min(1.1, rawRate));
      if (goToB) onSetRateB(safeRate);
      else onSetRateA(safeRate);
    }

    // Paso 2: Monitorizar energía de la pista activa para detectar el subidón
    // Detecta cuando la energía sube bruscamente (drop inminente)
    let energyHistory: number[] = [];
    let dropDetected = false;
    let countdown = 8; // segundos de preparación

    mt(() => {
      setStatus('🎵 BPMs sincronizados. Monitorizando...');
    }, 800);

    // Monitor de energía — cada 500ms mide la energía de freq
    dropMonitor.current = window.setInterval(() => {
      const freqFn = goToB ? freqDataA : freqDataB;
      if (!freqFn) return;
      const data = freqFn();
      if (!data) return;

      // Calcular energía media (bass frequencies = primeros 8 bins)
      const bassEnergy = Array.from(data as Float32Array)
        .slice(0, 8)
        .reduce((a: number, b: any) => a + Math.max(0, (b + 100) / 100), 0) / 8;

      energyHistory.push(bassEnergy);
      if (energyHistory.length > 6) energyHistory.shift();

      if (energyHistory.length < 4) return;

      // Detectar build-up: energía subiendo progresivamente
      const avg = energyHistory.reduce((a, b) => a + b, 0) / energyHistory.length;
      const recent = energyHistory.slice(-2).reduce((a, b) => a + b, 0) / 2;
      const isBuildUp = recent > avg * 1.15;

      if (isBuildUp && !dropDetected) {
        dropDetected = true;
        if (dropMonitor.current) clearInterval(dropMonitor.current);

        // Arrancar plato B/A listo para entrar
        setStatus('🔥 ¡Subidón detectado! Preparando entrada...');
        if (goToB && !deckB.isPlaying) onTogglePlayB();
        if (!goToB && !deckA.isPlaying) onTogglePlayA();

        // Cuenta atrás visual — el usuario sabe cuándo mover el crossfader
        let cd = countdown;
        setDropCountdown(cd);
        const cdInterval = window.setInterval(() => {
          cd--;
          setDropCountdown(cd);
          if (cd <= 0) {
            clearInterval(cdInterval);
            setDropCountdown(null);
            setMagicReady(true);
            setStatus('🎚️ ¡Ahora! Mueve el crossfader tú');
            // Parpadeo visual para llamar la atención
            mt(() => {
              setMagicActive(false);
              setMagicReady(false);
              setStatus('');
            }, 8000);
          }
        }, 1000);
        magicTimers.current.push(cdInterval as unknown as number);
      } else if (!dropDetected) {
        // Mientras espera, mostrar que está escuchando
        const bar = '▓'.repeat(Math.round(energyHistory[energyHistory.length-1] * 10));
        setStatus(`👂 Escuchando... ${bar}`);
      }
    }, 500);

    // Timeout de seguridad — si no detecta subidón en 30s, arrancar igualmente
    mt(() => {
      if (!dropDetected) {
        if (dropMonitor.current) clearInterval(dropMonitor.current);
        setStatus('⏱️ Plato B listo. Mueve el crossfader tú');
        if (goToB && !deckB.isPlaying) onTogglePlayB();
        if (!goToB && !deckA.isPlaying) onTogglePlayA();
        setMagicReady(true);
        mt(() => { setMagicActive(false); setMagicReady(false); setStatus(''); }, 10000);
      }
    }, 30000);
  };

  return (
    <div
      className="flex flex-col items-center justify-between h-full py-2 px-1 backdrop-blur-2xl rounded-2xl w-20 xs:w-28 sm:w-48 shadow-2xl relative overflow-hidden shrink-0 transition-all duration-300"
      style={{
        background: `rgba(255,255,255,0.03)`,
        border: `1px solid ${accentColor}30`,
        boxShadow: magicReady
          ? `0 0 20px rgba(250,204,21,0.4), inset 0 0 10px rgba(250,204,21,0.1)`
          : `0 0 20px ${accentColor}15`,
      }}
    >
      <AnimatePresence>
        {magicActive && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 pointer-events-none rounded-2xl"
            style={{ background: `linear-gradient(135deg, ${accentColor}15, transparent)` }} />
        )}
      </AnimatePresence>

      <div className="absolute top-0 right-0 p-2 opacity-5 pointer-events-none" style={{ color: accentColor }}>
        <Radio size={40} />
      </div>

      {/* Branding */}
      <div className="text-center z-10 w-full mb-1 hidden xs:block">
        <h2 className="font-mono text-[6px] tracking-[0.3em] uppercase font-black mb-1" style={{ color: accentColor }}>Master</h2>
        <div className="flex items-center justify-center gap-1">
          <Radio size={8} className={isRecording ? 'text-red-500 animate-pulse' : 'text-slate-700'} />
          <div className="h-1 w-8 bg-white/5 rounded-full overflow-hidden border border-white/5">
            <motion.div animate={{ x: isRecording ? [-15, 15] : 0 }}
              transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
              className="h-full w-4 blur-[2px]" style={{ background: accentColor }} />
          </div>
        </div>
      </div>

      {/* BPM display */}
      <div className="w-full px-1 z-10">
        <div className="rounded-lg p-1 border flex justify-between items-center"
          style={{ background: `${accentColor}10`, borderColor: `${accentColor}30` }}>
          <div className="text-center flex-1">
            <div className="text-[5px] text-slate-600 uppercase font-bold">A</div>
            <div className="text-[9px] font-mono font-bold" style={{ color: accentColor }}>{deckA.bpm}</div>
            <div className="text-[4px] text-slate-600">BPM</div>
          </div>
          <div className="w-px h-6" style={{ background: `${accentColor}40` }} />
          <div className="text-center flex-1">
            <div className="text-[5px] text-slate-600 uppercase font-bold">B</div>
            <div className="text-[9px] font-mono font-bold" style={{ color: accentColor }}>{deckB.bpm}</div>
            <div className="text-[4px] text-slate-600">BPM</div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-col gap-1.5 w-full px-0.5 z-10">
        <button onClick={isRecording ? onStopRecording : onStartRecording}
          className="flex items-center justify-center gap-1 p-2 rounded-lg border transition-all active:scale-95"
          style={isRecording
            ? { background: 'rgba(239,68,68,0.2)', borderColor: 'rgba(239,68,68,0.5)', color: '#ef4444' }
            : { background: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)', color: '#94a3b8' }}>
          {isRecording ? <Square size={10} fill="currentColor" /> : <Mic size={10} />}
          <span className="text-[6px] font-black uppercase hidden xs:inline">{isRecording ? 'Stop' : 'Rec'}</span>
        </button>

        <button onClick={onSync}
          className="flex items-center justify-center gap-1 p-2 rounded-lg border transition-all active:scale-95"
          style={{ background: `${accentColor}10`, borderColor: `${accentColor}30`, color: accentColor }}>
          <Download size={10} />
          <span className="text-[6px] font-black uppercase hidden xs:inline">Sync</span>
        </button>

        <button onClick={aiMixActive ? stopAiMix : startAiMix}
          className="flex items-center justify-center gap-1 p-2 rounded-lg border transition-all active:scale-95"
          style={aiMixActive
            ? { background: `rgba(168,85,247,0.2)`, borderColor: 'rgba(168,85,247,0.6)', color: '#c084fc', boxShadow: '0 0 12px rgba(168,85,247,0.4)' }
            : { background: `rgba(168,85,247,0.08)`, borderColor: `rgba(168,85,247,0.3)`, color: '#a78bfa' }}>
          <Zap size={10} className={aiMixActive ? 'animate-pulse' : ''} />
          <span className="text-[6px] font-black uppercase hidden xs:inline">{aiMixActive ? 'Stop' : 'AI Mix'}</span>
        </button>

        {/* ✨ MAGIC — IA detecta subidón, usuario mueve crossfader */}
        <motion.button
          onClick={startMagicMix}
          whileTap={{ scale: 0.93 }}
          className="flex items-center justify-center gap-1 p-2 rounded-lg border transition-all relative overflow-hidden"
          style={magicReady ? {
            background: 'rgba(250,204,21,0.3)',
            borderColor: 'rgba(250,204,21,0.8)',
            color: '#fde047',
            boxShadow: '0 0 20px rgba(250,204,21,0.6)',
          } : magicActive ? {
            background: 'rgba(250,204,21,0.15)',
            borderColor: 'rgba(250,204,21,0.5)',
            color: '#fbbf24',
          } : {
            background: 'linear-gradient(135deg, rgba(250,204,21,0.1), rgba(251,146,60,0.08))',
            borderColor: 'rgba(250,204,21,0.4)',
            color: '#fbbf24',
          }}
        >
          {magicReady && (
            <motion.div
              className="absolute inset-0 rounded-lg"
              animate={{ opacity: [0.3, 0.7, 0.3] }}
              transition={{ repeat: Infinity, duration: 0.6 }}
              style={{ background: 'rgba(250,204,21,0.2)' }}
            />
          )}
          <Sparkles size={10} className={magicActive ? 'animate-spin' : ''} />
          <span className="text-[6px] font-black uppercase hidden xs:inline relative z-10">
            {magicReady ? '🎚️ ¡AHORA!' : magicActive ? '✨ Magic...' : '✨ Magic'}
          </span>
        </motion.button>
      </div>

      {/* Countdown + Status */}
      <AnimatePresence>
        {(status || dropCountdown !== null) && (
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="w-full px-1 z-10">
            {dropCountdown !== null && (
              <motion.div
                className="text-center mb-1"
                animate={{ scale: dropCountdown <= 3 ? [1, 1.2, 1] : 1 }}
                transition={{ repeat: dropCountdown <= 3 ? Infinity : 0, duration: 0.5 }}
              >
                <span className="font-black text-[18px]" style={{ color: dropCountdown <= 3 ? '#ef4444' : '#fbbf24' }}>
                  {dropCountdown}
                </span>
              </motion.div>
            )}
            {status && (
              <div className="rounded-lg p-1 text-center border"
                style={{
                  background: magicReady ? 'rgba(250,204,21,0.2)' : magicActive ? 'rgba(250,204,21,0.1)' : `${accentColor}15`,
                  borderColor: magicActive ? 'rgba(250,204,21,0.4)' : `${accentColor}40`,
                }}>
                <p className="text-[5px] font-bold leading-tight"
                  style={{ color: magicActive ? '#fde047' : accentColor }}>
                  {status}
                </p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* VU Meters */}
      {!status && dropCountdown === null && (
        <div className="flex gap-2 h-14 py-1 z-10">
          {[1,2].map(i => (
            <div key={i} className="w-1.5 h-full bg-black/40 rounded-full p-0.5 flex flex-col-reverse gap-0.5 border border-white/5">
              {[...Array(8)].map((_, j) => (
                <div key={j} className="w-full flex-1 rounded-[0.5px]"
                  style={{ background: j > 6 ? 'rgba(239,68,68,0.5)' : j > 4 ? `${accentColor}50` : 'rgba(71,85,105,0.8)' }} />
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
          <motion.div
            animate={{ left: `${crossfade * 100}%` }}
            transition={{ type: "spring", damping: 35, stiffness: 450 }}
            className="absolute -ml-3 w-6 h-5 rounded-md shadow-2xl flex items-center justify-center pointer-events-none border"
            style={magicReady
              ? { background: 'rgba(250,204,21,0.4)', borderColor: 'rgba(250,204,21,0.8)', boxShadow: '0 0 8px rgba(250,204,21,0.6)' }
              : { background: 'rgba(30,30,30,0.8)', borderColor: 'rgba(255,255,255,0.1)' }}>
            <div className="h-3 w-0.5 rounded-full"
              style={{ background: magicReady ? '#fde047' : accentColor }} />
          </motion.div>
        </div>
      </div>
    </div>
  );
};
