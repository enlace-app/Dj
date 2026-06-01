import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Mic, Download, Square, Radio, Zap, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface MixerProps {
  crossfade: number;
  onCrossfadeChange: (val: number) => void;
  isRecording: boolean;
  recordingTime?: number;
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

// Helper: calculate bar length in seconds from BPM
const barLength = (bpm: number) => (60 / bpm) * 4;

// Helper: find best loop point (nearest bar boundary)
const snapToBar = (time: number, bpm: number) => {
  const bar = barLength(bpm);
  return Math.round(time / bar) * bar;
};

export const Mixer: React.FC<MixerProps> = ({
  crossfade, onCrossfadeChange, isRecording, recordingTime = 0, onStartRecording, onStopRecording,
  onSync, onAutoMix, deckA, deckB, onTogglePlayA, onTogglePlayB, onSetRateA, onSetRateB,
  onSeekA, onSeekB, magicEQRamp, accentColor = '#6366f1',
}) => {
  const [aiMixActive, setAiMixActive] = useState(false);
  const [magicActive, setMagicActive] = useState(false);
  const [magicPhase, setMagicPhase] = useState('');
  const [status, setStatus] = useState('');
  const [countdown, setCountdown] = useState<number | null>(null);
  const [mixProgress, setMixProgress] = useState(0); // 0-100
  const aiInterval = useRef<number | null>(null);
  const timers = useRef<number[]>([]);
  const magicInterval = useRef<number | null>(null);
  const cdInterval = useRef<number | null>(null);

  useEffect(() => () => {
    timers.current.forEach(clearTimeout);
    if (aiInterval.current) clearInterval(aiInterval.current);
    if (magicInterval.current) clearInterval(magicInterval.current);
    if (cdInterval.current) clearInterval(cdInterval.current);
  }, []);

  const mt = useCallback((fn: () => void, ms: number) => {
    const t = window.setTimeout(fn, ms);
    timers.current.push(t);
  }, []);

  const cancelMagic = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    if (magicInterval.current) { clearInterval(magicInterval.current); magicInterval.current = null; }
    if (cdInterval.current) { clearInterval(cdInterval.current); cdInterval.current = null; }
    magicEQRamp('A', 0, 0, 0, 800);
    magicEQRamp('B', 0, 0, 0, 800);
    setMagicActive(false);
    setMagicPhase('');
    setCountdown(null);
    setStatus('');
    setMixProgress(0);
  }, [magicEQRamp]);

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

  // ══════════════════════════════════════════════════════════════════════════
  // ✨ MAGIC MIX — Técnica de DJ profesional real
  //
  // Un DJ profesional mezcla así:
  // 1. Escucha el track que va a entrar con auriculares (cue)
  // 2. Iguala el BPM exactamente (beatmatch)
  // 3. Busca el outro de la canción actual (últimos 32 compases)
  // 4. Posiciona el nuevo track en su intro (primeros 8 compases = sin graves)
  // 5. Arranca el nuevo track en el primer beat del outro
  // 6. Durante 16-32 compases: quita graves de A, sube graves de B
  // 7. En el punto medio: crossfader al 50%
  // 8. Al final del outro: crossfader al 100%, quita A completamente
  // ══════════════════════════════════════════════════════════════════════════
  const startMagic = useCallback(() => {
    if (!deckA.isLoaded || !deckB.isLoaded) {
      setStatus('⚠️ Necesitas canciones en ambos platos');
      setTimeout(() => setStatus(''), 2500);
      return;
    }
    if (magicActive) { cancelMagic(); return; }

    setMagicActive(true);
    setMagicPhase('analyzing');
    setMixProgress(0);

    const goToB = crossfade <= 0.5;
    const activeDeck = goToB ? 'A' : 'B';
    const incomingDeck = goToB ? 'B' : 'A';
    const active = goToB ? deckA : deckB;
    const incoming = goToB ? deckB : deckA;

    // ── PASO 1: BEATMATCH ─────────────────────────────────────────────────
    setStatus('🎯 Beatmatch...');
    const bpmActive = active.bpm || 120;
    const bpmIncoming = incoming.bpm || 120;

    // Adjust incoming to match active BPM (max ±8% for natural sound)
    const rateRaw = bpmActive / bpmIncoming;
    const rate = Math.max(0.92, Math.min(1.08, rateRaw));
    if (goToB) onSetRateB(rate); else onSetRateA(rate);
    const syncedBPM = bpmIncoming * rate;

    // ── PASO 2: CALCULAR TIEMPOS ──────────────────────────────────────────
    const bar = barLength(syncedBPM);           // 1 bar duration in seconds
    const outroLength = bar * 16;               // 16 bars = outro
    const transitionLength = bar * 16;          // 16 bars to cross
    const introLength = bar * 8;                // 8 bars = intro (no bass)

    // Find outro start of active track
    const currentPos = active.progress;
    const activeRemaining = active.duration - currentPos;

    // If less than outro+8bars left, use now; else wait for outro
    const timeToOutro = activeRemaining > outroLength + bar * 8
      ? activeRemaining - outroLength
      : 0;

    // Incoming track: start at beginning (bar 1, intro)
    const incomingStartPos = snapToBar(Math.max(0, incoming.duration * 0.02), syncedBPM);

    setStatus(`📐 Outro en ${Math.round(timeToOutro)}s — preparando B...`);
    setMagicPhase('waiting');

    // Start active if not playing
    if (!active.isPlaying) {
      if (goToB) onTogglePlayA(); else onTogglePlayB();
    }

    // Position incoming at its intro start
    if (goToB) onSeekB(incomingStartPos); else onSeekA(incomingStartPos);

    // Wait until outro starts
    const waitMs = Math.max(500, timeToOutro * 1000);

    mt(() => {
      // ── PASO 3: ARRANCAR INCOMING EN EL BEAT ─────────────────────────
      setMagicPhase('cueing');
      setStatus('🎵 Arrancando en el beat...');

      // Start incoming track
      if (!incoming.isPlaying) {
        if (goToB) onTogglePlayB(); else onTogglePlayA();
      }

      // EQ setup: incoming has NO bass yet (DJ technique — avoid bass clash)
      magicEQRamp(incomingDeck, -15, 0, 2, 500);
      // Active: slightly boost treble for presence
      magicEQRamp(activeDeck, 0, 0, 2, 1000);

      // Countdown 8 bars before transition
      let cd = Math.round(bar * 8);
      setCountdown(cd);
      if (cdInterval.current) clearInterval(cdInterval.current);
      cdInterval.current = window.setInterval(() => {
        cd--;
        setCountdown(cd > 0 ? cd : null);
        if (cd <= 0 && cdInterval.current) {
          clearInterval(cdInterval.current);
          cdInterval.current = null;
        }
      }, 1000);

      mt(() => {
        // ── PASO 4: INICIO DE TRANSICIÓN (16 compases) ───────────────────
        setMagicPhase('mixing');
        setStatus('🎚️ Mezclando en el groove...');
        setCountdown(null);

        const totalMs = transitionLength * 1000;
        const steps = 200;
        const stepMs = totalMs / steps;
        const startCross = crossfade;
        const endCross = goToB ? 1 : 0;

        let step = 0;
        if (magicInterval.current) clearInterval(magicInterval.current);
        magicInterval.current = window.setInterval(() => {
          step++;
          const t = step / steps;

          // ── CROSSFADER: curva S profesional ──
          // Stays mostly on active until 50%, then moves to incoming
          // This is how DJs actually move the crossfader
          const sCurve = t < 0.5
            ? 2 * t * t
            : -1 + (4 - 2 * t) * t;
          onCrossfadeChange(startCross + (endCross - startCross) * sCurve);
          setMixProgress(Math.round(t * 100));

          // ── EQ SWAP: el momento más importante ──
          // At 25%: start killing active bass
          if (t > 0.25 && t < 0.5) {
            const eqT = (t - 0.25) / 0.25;
            magicEQRamp(activeDeck, -15 * eqT, 0, 0, stepMs * 5);
          }
          // At 40%: introduce incoming bass (the DROP moment)
          if (t > 0.40 && t < 0.65) {
            const eqT = (t - 0.40) / 0.25;
            magicEQRamp(incomingDeck, -15 + 15 * eqT, 0, 2 - 2 * eqT, stepMs * 5);
          }
          // At 65%: fully restore incoming EQ
          if (t > 0.65 && t < 0.70) {
            magicEQRamp(incomingDeck, 0, 0, 0, 500);
          }
          // At 80%: kill active mid too for clean exit
          if (t > 0.80 && t < 0.85) {
            magicEQRamp(activeDeck, -15, -6, 0, 500);
          }

          if (step >= steps) {
            clearInterval(magicInterval.current!);
            magicInterval.current = null;

            // ── PASO 5: LIMPIEZA ────────────────────────────────────────
            setMagicPhase('done');
            setStatus('🎉 ¡Mezcla profesional completada!');
            setMixProgress(100);

            // Reset active EQ (it's out now)
            magicEQRamp(activeDeck, 0, 0, 0, 300);
            // Restore incoming fully
            magicEQRamp(incomingDeck, 0, 0, 0, 1000);

            mt(() => {
              cancelMagic();
            }, 3000);
          }
        }, stepMs);

      }, bar * 8 * 1000); // Wait 8 bars before starting crossfade

    }, waitMs);

  }, [magicActive, crossfade, deckA, deckB, cancelMagic, magicEQRamp,
      onSetRateA, onSetRateB, onSeekA, onSeekB, onTogglePlayA, onTogglePlayB,
      onCrossfadeChange, mt]);

  const phaseColor = magicPhase === 'done' ? '#22c55e'
    : magicPhase === 'mixing' ? '#ef4444'
    : magicPhase === 'cueing' ? '#f97316'
    : magicPhase === 'waiting' ? '#fbbf24'
    : accentColor;

  const recFmt = `${Math.floor(recordingTime / 60)}:${String(recordingTime % 60).padStart(2, '0')}`;

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
            className="absolute inset-0 pointer-events-none rounded-2xl"
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

      {/* BPM display */}
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

      {/* Mix progress bar (during magic) */}
      {magicActive && magicPhase === 'mixing' && (
        <div className="w-full px-1 z-10">
          <div className="flex justify-between mb-0.5">
            <span className="text-[4px] font-mono text-slate-600">A</span>
            <span className="text-[4px] font-mono" style={{ color: phaseColor }}>{mixProgress}%</span>
            <span className="text-[4px] font-mono text-slate-600">B</span>
          </div>
          <div className="h-1 bg-black/40 rounded-full overflow-hidden border border-white/5">
            <motion.div
              animate={{ width: `${mixProgress}%` }}
              transition={{ duration: 0.1 }}
              className="h-full rounded-full"
              style={{ background: `linear-gradient(to right, ${accentColor}, ${phaseColor})` }}
            />
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="flex flex-col gap-1.5 w-full px-0.5 z-10">
        <button onClick={isRecording ? onStopRecording : onStartRecording}
          className="flex items-center justify-center gap-1 p-2 rounded-lg border transition-all active:scale-95"
          style={isRecording
            ? { background: 'rgba(239,68,68,0.2)', borderColor: 'rgba(239,68,68,0.5)', color: '#ef4444' }
            : { background: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)', color: '#94a3b8' }}>
          {isRecording ? <Square size={10} fill="currentColor" /> : <Mic size={10} />}
          <span className="text-[6px] font-black uppercase hidden xs:inline">
            {isRecording ? recFmt : 'Rec'}
          </span>
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
              animate={{ opacity: [0.1, 0.35, 0.1] }}
              transition={{ repeat: Infinity, duration: 0.9 }}
              style={{ background: `${phaseColor}30` }} />
          )}
          <Sparkles size={10} className={magicActive ? 'animate-spin' : ''}
            style={{ color: magicActive ? phaseColor : '#fbbf24' }} />
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
                animate={{ scale: countdown <= 4 ? [1, 1.3, 1] : 1 }}
                transition={{ repeat: Infinity, duration: 0.5 }}>
                <span className="font-black text-xl" style={{ color: countdown <= 4 ? '#ef4444' : '#f97316' }}>
                  {countdown}s
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
