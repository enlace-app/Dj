import { motion, AnimatePresence } from 'motion/react';
import * as Tone from 'tone';
import { useDJEngine } from './hooks/useDJEngine';
import { Deck } from './components/Deck';
import { Mixer } from './components/Mixer';
import { Headphones, Share2, Info, X, GraduationCap } from 'lucide-react';
import { useState, useMemo } from 'react';

// Reactive skin: color theme changes with music energy
function useReactiveSkin(energy: number) {
  return useMemo(() => {
    // Low energy: deep blue/slate (breakdown)
    // Mid energy: indigo/purple (build-up)
    // High energy: red/orange/pink (DROP!)
    if (energy < 0.25) {
      return {
        bg: 'bg-slate-950',
        glow: 'rgba(30,30,60,0)',
        accent: '#6366f1',
        label: 'Breakdown',
        headerBg: 'rgba(255,255,255,0.03)',
        borderColor: 'rgba(255,255,255,0.08)',
      };
    } else if (energy < 0.5) {
      return {
        bg: 'bg-slate-950',
        glow: `rgba(99,102,241,${(energy - 0.25) * 0.3})`,
        accent: '#818cf8',
        label: 'Build-up',
        headerBg: 'rgba(99,102,241,0.05)',
        borderColor: 'rgba(99,102,241,0.15)',
      };
    } else if (energy < 0.75) {
      return {
        bg: 'bg-slate-950',
        glow: `rgba(168,85,247,${(energy - 0.5) * 0.4})`,
        accent: '#c084fc',
        label: '⚡ Energy',
        headerBg: 'rgba(168,85,247,0.07)',
        borderColor: 'rgba(168,85,247,0.2)',
      };
    } else {
      return {
        bg: 'bg-slate-950',
        glow: `rgba(239,68,68,${(energy - 0.75) * 0.5})`,
        accent: '#f87171',
        label: '🔥 DROP!',
        headerBg: 'rgba(239,68,68,0.08)',
        borderColor: 'rgba(239,68,68,0.25)',
      };
    }
  }, [energy]);
}

export default function App() {
  const engine = useDJEngine();
  const [showInfo, setShowInfo] = useState(false);
  const [showAcademy, setShowAcademy] = useState(false);
  const [audioStatus, setAudioStatus] = useState(Tone.getContext().state);

  const skin = useReactiveSkin(engine.masterEnergy);

  const startAudio = async () => {
    await Tone.start();
    setAudioStatus(Tone.getContext().state);
  };

  return (
    <div className={`h-screen w-screen overflow-hidden text-slate-100 font-sans flex flex-col ${skin.bg} relative`}>

      {/* Reactive background glow — changes with music energy */}
      <div
        className="absolute inset-0 pointer-events-none transition-all duration-300 z-0"
        style={{
          background: `radial-gradient(ellipse at 50% 50%, ${skin.glow}, transparent 70%)`,
        }}
      />

      {/* Reactive border pulse on drop */}
      {engine.masterEnergy > 0.75 && (
        <div
          className="absolute inset-0 pointer-events-none z-0 rounded-none"
          style={{
            boxShadow: `inset 0 0 ${Math.round(engine.masterEnergy * 40)}px ${skin.glow}`,
            transition: 'box-shadow 0.1s',
          }}
        />
      )}

      {/* Header */}
      <header
        className="h-8 flex items-center justify-between px-3 shrink-0 z-50 border-b transition-all duration-300"
        style={{ background: skin.headerBg, borderColor: skin.borderColor }}
      >
        <div className="flex items-center gap-2">
          <div
            className="w-5 h-5 rounded flex items-center justify-center transition-all duration-300"
            style={{ background: skin.accent, boxShadow: `0 0 8px ${skin.accent}40` }}
          >
            <Headphones size={11} className="text-white" />
          </div>
          <span className="text-[10px] font-black tracking-tight uppercase text-white">VirtualDeck</span>
          {/* Energy label */}
          {engine.masterEnergy > 0.3 && (
            <motion.span
              key={skin.label}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-[6px] font-black uppercase px-1.5 py-0.5 rounded"
              style={{ color: skin.accent, background: `${skin.accent}20`, border: `1px solid ${skin.accent}40` }}
            >
              {skin.label}
            </motion.span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <button onClick={startAudio} className={`flex items-center gap-1 px-2 py-0.5 rounded text-[8px] font-bold border ${audioStatus === 'running' ? 'bg-emerald-600/20 text-emerald-400 border-emerald-500/30' : 'bg-amber-600/20 text-amber-400 border-amber-500/30 animate-pulse'}`}>
            <div className={`w-1.5 h-1.5 rounded-full ${audioStatus === 'running' ? 'bg-emerald-400' : 'bg-amber-400'}`} />
            {audioStatus === 'running' ? 'Live' : 'Activar Audio'}
          </button>
          <button onClick={() => setShowAcademy(true)} className="flex items-center gap-1 bg-pink-600/20 px-2 py-0.5 rounded text-[8px] font-bold text-pink-400 border border-pink-500/30">
            <GraduationCap size={10} />Academy
          </button>
          <button onClick={() => setShowInfo(true)} className="p-1 text-slate-400"><Info size={12} /></button>
          <button
            className="flex items-center gap-1 px-2 py-0.5 rounded text-[8px] font-bold transition-all duration-300"
            style={{ background: skin.accent, boxShadow: `0 0 8px ${skin.accent}40` }}
          >
            <Share2 size={9} className="text-white" />
            <span className="text-white">Share</span>
          </button>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 flex flex-row gap-1 p-1 overflow-hidden min-h-0 z-10">
        <motion.div initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} className="flex-1 min-w-0 min-h-0">
          <Deck
            id="A" state={engine.deckA}
            onLoad={(f) => engine.loadTrack('A', f)}
            onTogglePlay={() => engine.togglePlay('A')}
            onRateChange={(r) => engine.setPlaybackRate('A', r)}
            onFilterChange={(v) => engine.setFilter('A', v)}
            onFXChange={(type, val) => engine.setFX('A', type, val)}
            onEQChange={(deck, low, mid, high) => engine.setEQ(deck, low, mid, high)}
            onScratch={(offset) => engine.seekTo('A', engine.deckA.progress + offset)}
            getVisualizerData={engine.analyserDataA}
            getFreqData={engine.freqDataA}
            accentColor={skin.accent}
          />
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="shrink-0">
          <Mixer
            crossfade={engine.crossfader}
            onCrossfadeChange={engine.handleCrossfade}
            isRecording={engine.isRecording}
            onStartRecording={engine.startRecording}
            onStopRecording={engine.stopRecording}
            onSync={engine.syncDecks}
            onAutoMix={engine.startAutoMix}
            deckA={{ bpm: engine.deckA.bpm, progress: engine.deckA.progress, duration: engine.deckA.duration, isPlaying: engine.deckA.isPlaying, isLoaded: engine.deckA.isLoaded }}
            deckB={{ bpm: engine.deckB.bpm, progress: engine.deckB.progress, duration: engine.deckB.duration, isPlaying: engine.deckB.isPlaying, isLoaded: engine.deckB.isLoaded }}
            onTogglePlayA={() => engine.togglePlay('A')}
            onTogglePlayB={() => engine.togglePlay('B')}
            onSetRateA={(r) => engine.setPlaybackRate('A', r)}
            onSetRateB={(r) => engine.setPlaybackRate('B', r)}
            accentColor={skin.accent}
          />
        </motion.div>

        <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }} className="flex-1 min-w-0 min-h-0">
          <Deck
            id="B" state={engine.deckB}
            onLoad={(f) => engine.loadTrack('B', f)}
            onTogglePlay={() => engine.togglePlay('B')}
            onRateChange={(r) => engine.setPlaybackRate('B', r)}
            onFilterChange={(v) => engine.setFilter('B', v)}
            onFXChange={(type, val) => engine.setFX('B', type, val)}
            onEQChange={(deck, low, mid, high) => engine.setEQ(deck, low, mid, high)}
            onScratch={(offset) => engine.seekTo('B', engine.deckB.progress + offset)}
            getVisualizerData={engine.analyserDataB}
            getFreqData={engine.freqDataB}
            accentColor={skin.accent}
          />
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="h-5 shrink-0 border-t flex items-center justify-between px-3 z-40 transition-all duration-300"
        style={{ background: skin.headerBg, borderColor: skin.borderColor }}>
        <div className="flex gap-3">
          <div className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span className="text-[7px] text-slate-400 font-mono uppercase">Engine: Active</span>
          </div>
          <div className="flex items-center gap-1">
            <div className={`w-1.5 h-1.5 rounded-full ${engine.isRecording ? 'bg-red-500 animate-pulse' : 'bg-slate-700'}`} />
            <span className="text-[7px] text-slate-400 font-mono uppercase">{engine.isRecording ? 'REC' : 'Idle'}</span>
          </div>
          {/* Energy meter */}
          <div className="flex items-center gap-1">
            <div className="w-12 h-1 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-100"
                style={{ width: `${engine.masterEnergy * 100}%`, background: skin.accent }}
              />
            </div>
            <span className="text-[6px] font-mono" style={{ color: skin.accent }}>{skin.label}</span>
          </div>
        </div>
        <span className="text-[7px] text-slate-600 font-mono">v3.0.0</span>
      </footer>

      {/* Modals */}
      <AnimatePresence>
        {showInfo && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md">
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="bg-slate-900/90 backdrop-blur-2xl p-6 rounded-2xl border border-white/10 max-w-sm w-full relative">
              <button onClick={() => setShowInfo(false)} className="absolute top-4 right-4 text-slate-400"><X size={18} /></button>
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><Headphones style={{ color: skin.accent }} size={18} />Cómo usar VirtualDeck</h3>
              <ul className="space-y-2 text-slate-400 text-xs">
                <li className="flex gap-2"><span className="font-mono font-bold" style={{ color: skin.accent }}>01.</span><span>Pulsa <b>Load</b> para cargar una canción en cada plato.</span></li>
                <li className="flex gap-2"><span className="font-mono font-bold" style={{ color: skin.accent }}>02.</span><span><b>Crossfader</b> mezcla entre A y B.</span></li>
                <li className="flex gap-2"><span className="font-mono font-bold" style={{ color: skin.accent }}>03.</span><span><b>Sync</b> iguala BPMs. <b>AI Mix</b> hace la transición sola.</span></li>
                <li className="flex gap-2"><span className="font-mono font-bold" style={{ color: skin.accent }}>04.</span><span><b>✨ Magic</b> — mezcla épica con curva S profesional.</span></li>
                <li className="flex gap-2"><span className="font-mono font-bold" style={{ color: skin.accent }}>05.</span><span>La interfaz cambia de color según la energía de la música 🎨</span></li>
                <li className="flex gap-2"><span className="font-mono font-bold" style={{ color: skin.accent }}>06.</span><span><b>Rec</b> graba tu sesión completa.</span></li>
              </ul>
              <button onClick={() => setShowInfo(false)} className="w-full mt-5 font-bold py-2 rounded-xl border text-sm transition-all"
                style={{ background: `${skin.accent}20`, color: skin.accent, borderColor: `${skin.accent}40` }}>Cerrar</button>
            </motion.div>
          </motion.div>
        )}
        {showAcademy && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xl">
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="bg-slate-900 p-6 rounded-2xl border border-pink-500/20 max-w-sm w-full relative">
              <h3 className="text-xl font-black mb-4 flex items-center gap-3"><GraduationCap size={24} className="text-pink-500" />DJ Academy</h3>
              <div className="bg-white/5 p-4 rounded-xl border border-white/10 mb-4">
                <h4 className="text-pink-400 font-bold uppercase tracking-widest text-[9px] mb-1">Reto actual</h4>
                <p className="text-white font-medium text-sm">Scratch Transition</p>
                <p className="text-slate-400 text-xs mt-1">Mueve el disco del Plato A hacia atrás y adelante, luego cambia el crossfader al Plato B.</p>
              </div>
              <button onClick={() => setShowAcademy(false)} className="w-full bg-pink-600 hover:bg-pink-500 text-white font-black uppercase tracking-widest py-3 rounded-xl text-sm transition-all">Aceptar reto</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
