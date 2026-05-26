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
  deckA: { bpm: number; progress: number; duration: number; isPlaying: boolean; isLoaded: boolean; dropTime: number };
  deckB: { bpm: number; progress: number; duration: number; isPlaying: boolean; isLoaded: boolean; dropTime: number };
  onTogglePlayA: () => void;
  onTogglePlayB: () => void;
  onSetRateA: (r: number) => void;
  onSetRateB: (r: number) => void;
  onSeekA: (t: number) => void;
  onSeekB: (t: number) => void;
  magicEQRamp: (deck: 'A' | 'B', low: number, mid: number, high: number, ms: number) => void;
  accentColor?: string;
  freqDataA?: () => any;
  freqDataB?: () => any;
}

export const Mixer: React.FC<MixerProps> = ({
  crossfade, onCrossfadeChange, isRecording, onStartRecording, onStopRecording,
  onSync, onAutoMix, deckA, deckB, onTogglePlayA, onTogglePlayB, onSetRateA, onSetRateB,
  onSeekA, onSeekB, magicEQRamp, accentColor = '#6366f1', freqDataA, freqDataB,
}) => {
  const [aiMixActive, setAiMixActive] = useState(false);
  const [magicActive, setMagicActive] = useState(false);
  const [magicPhase, setMagicPhase] = useState('');
  const [status, setStatus] = useState('');
  const [countdown, setCountdown] = useState<number | null>(null);
  const aiInterval = useRef<number | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const magicInterval = useRef<number | null>(null);

  useEffect(() => () => {
    timers.current.forEach(clearTimeout);
    if (aiInterval.current) clearInterval(aiInterval.current);
    if (magicInterval.current) clearInterval(magicInterval.current);
  }, []);

  const mt = (fn: () => void, ms: number) => {
    const t = setTimeout(fn, ms);
    timers.current.push(t);
  };

  const cancelMagic = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    if (magicInterval.current) { clearInterval(magicInterval.current); magicInterval.current = null; }
    // Reset EQs
    magicEQRamp('A', 0, 0, 0, 500);
    magicEQRamp('B', 0, 0, 0, 500);
    setMagicActive(false);
    setMagicPhase('');
    setCountdown(null);
    setStatus('');
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
    setStatus('🎵 Sincronizando...');
    if (deckA.bpm > 0 && deckB.bpm > 0)
      onSetRateB(Math.max(0.9, Math.min(1.1, deckA.bpm / deckB.bpm)));
    onCrossfadeChange(0);
    if (!deckA.isPlaying) onTogglePlayA();
    setTimeout(() => {
      setStatus('▶️ Arrancando B...');
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
            setStatus('✅ ¡Listo!');
            setTimeout(() => { setAiMixActive(false); setStatus(''); }, 2000);
          }
        }, 100);
      }, 3000);
    }, 1500);
  };

  // ✨ MAGIC — el mejor DJ del mundo
  // 1. Detecta drop de A (ya calculado al cargar)
  // 2. Sincroniza BPMs
  // 3. Posiciona B justo antes de su drop
  // 4. Espera al drop de A
  // 5. Baja graves de A, sube B con graves altos
  // 6. Crossfader suave de 8s en el drop
  // 7. Sube graves de B, baja A completamente
  const startMagic = () => {
    if (!deckA.isLoaded || !deckB.isLoaded) {
      setStatus('⚠️ Necesitas canciones en ambos platos');
      setTimeout(() => setStatus(''), 2500);
      return;
    }
    if (magicActive) { cancelMagic(); return; }

    setMagicActive(true);
    setMagicPhase('prep');

    const goToB = crossfade <= 0.5;
    const activeDeck = goToB ? 'A' : 'B';
    const incomingDeck = goToB ? 'B' : 'A';
    const activeDeckState = goToB ? deckA : deckB;
    const incomingDeckState = goToB ? deckB : deckA;

    // PASO 1: Sincronizar BPMs
    setStatus('🎯 Sincronizando BPMs...');
    if (deckA.bpm > 0 && deckB.bpm > 0) {
      const rate = goToB
        ? Math.max(0.9, Math.min(1.1, deckA.bpm / deckB.bpm))
        : Math.max(0.9, Math.min(1.1, deckB.bpm / deckA.bpm));
      if (goToB) onSetRateB(rate); else onSetRateA(rate);
    }

    // PASO 2: Arrancar plato activo si no está
    if (!activeDeckState.isPlaying) {
      if (goToB) onTogglePlayA(); else onTogglePlayB();
    }

    mt(() => {
      // PASO 3: Calcular cuánto tiempo queda hasta el drop de la pista activa
      const dropA = activeDeckState.dropTime;
      const currentPos = activeDeckState.progress;
      const timeToDropA = dropA > currentPos ? dropA - currentPos : (activeDeckState.duration - currentPos) + dropA;

      // Posicionar pista B para que su drop coincida
      const dropB = incomingDeckState.dropTime;
      const prerollTime = 8; // empezar B 8 segundos antes de su drop
      const startPosB = Math.max(0, dropB - prerollTime);
      if (goToB) onSeekB(startPosB); else onSeekA(startPosB);

      setStatus(`🎵 Drop en ${Math.round(timeToDropA)}s — preparando B...`);
      setMagicPhase('waiting');

      // PASO 4: Esperar justo antes del drop (8s antes)
      const waitMs = Math.max(500, (timeToDropA - prerollTime) * 1000);

      mt(() => {
        // Arrancar pista incoming
        if (!incomingDeckState.isPlaying) {
          if (goToB) onTogglePlayB(); else onTogglePlayA();
        }

        // Inicio de cuenta atrás
        let cd = Math.min(8, Math.round(prerollTime));
        setCountdown(cd);
        setStatus('🔥 ¡Preparate para el drop!');
        setMagicPhase('countdown');

        const cdInt = window.setInterval(() => {
          cd--;
          setCountdown(cd > 0 ? cd : null);
          if (cd <= 0) {
            clearInterval(cdInt);
            executeDrop(goToB, activeDeck, incomingDeck);
          }
        }, 1000);
        timers.current.push(cdInt as unknown as ReturnType<typeof setTimeout>);

      }, waitMs);

    }, 800);
  };

  const executeDrop = (goToB: boolean, activeDeck: 'A' | 'B', incomingDeck: 'A' | 'B') => {
    setMagicPhase('drop');
    setCountdown(null);
    setStatus('🎚️ ¡DROP! Mezclando como un pro...');

    // Técnica de DJ profesional:
    // 1. Bajar graves de A (corte de bajos para crear tensión)
    magicEQRamp(activeDeck, -15, 0, 0, 2000);

    // 2. Subir B con graves potentes
    magicEQRamp(incomingDeck, 3, 0, 2, 2000);

    // 3. Crossfader curva S en 8 segundos
    const startCross = crossfade;
    const endCross = goToB ? 1 : 0;
    let step = 0;
    const totalSteps = 80; // 8 segundos

    if (magicInterval.current) clearInterval(magicInterval.current);
    magicInterval.current = window.setInterval(() => {
      step++;
      const t = step / totalSteps;
      // Curva S profesional
      const s = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      onCrossfadeChange(startCross + (endCross - startCross) * s);

      if (step >= totalSteps) {
        clearInterval(magicInterval.current!);
        magicInterval.current = null;

        // PASO FINAL: restaurar graves del nuevo track activo
        magicEQRamp(incomingDeck, 0, 0, 0, 3000);
        // Silenciar completamente el track anterior
        magicEQRamp(activeDeck, -15, -15, -15, 2000);

        setMagicPhase('done');
        setStatus('🎉 ¡Mezcla perfecta!');

        mt(() => {
          // Reset EQ del track que salió
          magicEQRamp(activeDeck, 0, 0, 0, 500);
          setMagicActive(false);
          setMagicPhase('');
          setStatus('');
        }, 4000);
      }
    }, 100);
  };

  const phaseColor = magicPhase === 'done' ? '#22c55e'
    : magicPhase === 'drop' ? '#ef4444'
    : magicPhase === 'countdown' ? '#f97316'
    : magicPhase === 'waiting' ? '#fbbf24'
    : accentColor;

  return (
    <div className="flex flex-col items-center justify-between h-full py-2 px-1 backdrop-blur-2xl rounded-2xl w-20 xs:w-28 sm:w-48 shadow-2xl relative overflow-hidden shrink-0 transition-all duration-300"
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: `1px solid ${magicActive ? phaseColor : accentColor}30`,
        boxShadow: magicActive ? `0 0 24px ${phaseColor}30` : `0 0 20px ${accentColor}15`,
      }}>

      <AnimatePresence>
        {magicActive && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 pointer-events-none rounded-2xl transition-all duration-1000"
            style={{ background: `linear-gradient(135deg, ${phaseColor}20, transparent)` }} />
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
              transition={{ repeat: Infinity, duration: 1.5, ease: 'linear' }}
              className="h-full w-4 blur-[2px]" style={{ background: accentColor }} />
          </div>
        </div>
      </div>

      {/* BPM + Drop info */}
      <div className="w-full px-1 z-10">
        <div className="rounded-lg p-1 border flex justify-between items-center"
          style={{ background: `${accentColor}10`, borderColor: `${accentColor}30` }}>
          <div className="text-center flex-1">
            <div className="text-[5px] text-slate-600 uppercase font-bold">A</div>
            <div className="text-[9px] font-mono font-bold" style={{ color: accentColor }}>{deckA.bpm}</div>
            <div className="text-[4px] text-slate-600">BPM</div>
            {deckA.dropTime > 0 && <div className="text-[4px] text-yellow-500">⚡{Math.round(deckA.dropTime)}s</div>}
          </div>
          <div className="w-px h-8" style={{ background: `${accentColor}40` }} />
          <div className="text-center flex-1">
            <div className="text-[5px] text-slate-600 uppercase font-bold">B</div>
            <div className="text-[9px] font-mono font-bold" style={{ color: accentColor }}>{deckB.bpm}</div>
            <div className="text-[4px] text-slate-600">BPM</div>
            {deckB.dropTime > 0 && <div className="text-[4px] text-yellow-500">⚡{Math.round(deckB.dropTime)}s</div>}
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
            ? { background: 'rgba(168,85,247,0.2)', borderColor: 'rgba(168,85,247,0.6)', color: '#c084fc' }
            : { background: 'rgba(168,85,247,0.08)', borderColor: 'rgba(168,85,247,0.3)', color: '#a78bfa' }}>
          <Zap size={10} className={aiMixActive ? 'animate-pulse' : ''} />
          <span className="text-[6px] font-black uppercase hidden xs:inline">{aiMixActive ? 'Stop' : 'AI Mix'}</span>
        </button>

        {/* ✨ MAGIC */}
        <motion.button onClick={startMagic} whileTap={{ scale: 0.93 }}
          className="flex items-center justify-center gap-1 p-2 rounded-lg border transition-all relative overflow-hidden"
          style={magicActive
            ? { background: `${phaseColor}25`, borderColor: `${phaseColor}70`, color: phaseColor, boxShadow: `0 0 16px ${phaseColor}40` }
            : { background: 'linear-gradient(135deg, rgba(250,204,21,0.12), rgba(251,146,60,0.08))', borderColor: 'rgba(250,204,21,0.4)', color: '#fbbf24' }}>
          {magicActive && (
            <motion.div className="absolute inset-0"
              animate={{ opacity: [0.1, 0.4, 0.1] }}
              transition={{ repeat: Infinity, duration: 0.8 }}
              style={{ background: `${phaseColor}30` }} />
          )}
          <Sparkles size={10} className={magicActive ? 'animate-spin' : ''} style={{ color: magicActive ? phaseColor : '#fbbf24' }} />
          <span className="text-[6px] font-black uppercase hidden xs:inline relative z-10"
            style={{ color: magicActive ? phaseColor : '#fbbf24' }}>
            {magicActive ? '⏹ Stop' : '✨ Magic'}
          </span>
        </motion.button>
      </div>

      {/* Status + countdown */}
      <AnimatePresence>
        {(status || countdown !== null) && (
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
            className="w-full px-1 z-10 space-y-1">
            {countdown !== null && (
              <motion.div className="text-center"
                animate={{ scale: countdown <= 3 ? [1, 1.4, 1] : [1, 1.1, 1] }}
                transition={{ repeat: Infinity, duration: countdown <= 3 ? 0.4 : 1 }}>
                <span className="font-black text-2xl" style={{ color: countdown <= 3 ? '#ef4444' : '#f97316' }}>
                  {countdown}
                </span>
              </motion.div>
            )}
            {status && (
              <div className="rounded-lg p-1 text-center border"
                style={{ background: `${phaseColor}15`, borderColor: `${phaseColor}40` }}>
                <p className="text-[5px] font-bold leading-tight" style={{ color: phaseColor }}>{status}</p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* VU Meters */}
      {!status && countdown === null && (
        <div className="flex gap-2 h-12 py-1 z-10">
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
          <motion.div animate={{ left: `${crossfade * 100}%` }} transition={{ type: 'spring', damping: 35, stiffness: 450 }}
            className="absolute -ml-3 w-6 h-5 rounded-md shadow-2xl flex items-center justify-center pointer-events-none border"
            style={magicActive
              ? { background: `${phaseColor}30`, borderColor: `${phaseColor}70` }
              : { background: 'rgba(30,30,30,0.8)', borderColor: 'rgba(255,255,255,0.1)' }}>
            <div className="h-3 w-0.5 rounded-full" style={{ background: magicActive ? phaseColor : accentColor }} />
          </motion.div>
        </div>
      </div>
    </div>
  );
};
