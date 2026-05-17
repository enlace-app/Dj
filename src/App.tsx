import { motion, AnimatePresence } from 'motion/react';
import * as Tone from 'tone';
import { useDJEngine } from './hooks/useDJEngine';
import { Deck } from './components/Deck';
import { Mixer } from './components/Mixer';
import { Headphones, Share2, Info, X, GraduationCap } from 'lucide-react';
import { useState } from 'react';

export default function App() {
  const engine = useDJEngine();
  const [showInfo, setShowInfo] = useState(false);
  const [showAcademy, setShowAcademy] = useState(false);
  const [audioStatus, setAudioStatus] = useState(Tone.getContext().state);

  const startAudio = async () => {
    await Tone.start();
    setAudioStatus(Tone.getContext().state);
  };

  return (
    <div className="h-screen w-screen overflow-hidden text-slate-100 font-sans flex flex-col bg-slate-950">
      <header className="h-8 flex items-center justify-between px-3 bg-white/5 border-b border-white/10 shrink-0 z-50">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded bg-indigo-600 flex items-center justify-center">
            <Headphones size={11} className="text-white" />
          </div>
          <span className="text-[10px] font-black tracking-tight uppercase text-white">VirtualDeck</span>
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
          <button className="flex items-center gap-1 bg-indigo-600 px-2 py-0.5 rounded text-[8px] font-bold">
            <Share2 size={9} className="text-white" />Share
          </button>
        </div>
      </header>

      <main className="flex-1 flex flex-row gap-1 p-1 overflow-hidden min-h-0">
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
          />
        </motion.div>
      </main>

      <footer className="h-5 shrink-0 bg-white/5 border-t border-white/10 flex items-center justify-between px-3 z-40">
        <div className="flex gap-3">
          <div className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span className="text-[7px] text-slate-400 font-mono uppercase">Engine: Active</span>
          </div>
          <div className="flex items-center gap-1">
            <div className={`w-1.5 h-1.5 rounded-full ${engine.isRecording ? 'bg-red-500 animate-pulse' : 'bg-slate-700'}`} />
            <span className="text-[7px] text-slate-400 font-mono uppercase">{engine.isRecording ? 'REC' : 'Idle'}</span>
          </div>
        </div>
        <span className="text-[7px] text-slate-600 font-mono">v2.1.0</span>
      </footer>

      <AnimatePresence>
        {showInfo && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md">
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="bg-slate-900/90 backdrop-blur-2xl p-6 rounded-2xl border border-white/10 max-w-sm w-full relative">
              <button onClick={() => setShowInfo(false)} className="absolute top-4 right-4 text-slate-400"><X size={18} /></button>
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><Headphones className="text-indigo-400" size={18} />Cómo usar VirtualDeck</h3>
              <ul className="space-y-3 text-slate-400 text-xs">
                <li className="flex gap-2"><span className="text-indigo-400 font-mono font-bold">01.</span><span>Pulsa <b>Load</b> en cada plato para cargar una canción.</span></li>
                <li className="flex gap-2"><span className="text-indigo-400 font-mono font-bold">02.</span><span>Usa el <b>Crossfader</b> del centro para mezclar entre A y B.</span></li>
                <li className="flex gap-2"><span className="text-indigo-400 font-mono font-bold">03.</span><span><b>Sync</b> iguala los BPMs automáticamente.</span></li>
                <li className="flex gap-2"><span className="text-indigo-400 font-mono font-bold">04.</span><span><b>AI Mix</b> hace la transición completa — sincroniza, arranca B y mezcla suavemente.</span></li>
                <li className="flex gap-2"><span className="text-indigo-400 font-mono font-bold">05.</span><span><b>✨ Magic</b> hace una mezcla épica con curva S profesional.</span></li>
                <li className="flex gap-2"><span className="text-indigo-400 font-mono font-bold">06.</span><span>Pulsa <b>Rec</b> para grabar tu sesión.</span></li>
              </ul>
              <button onClick={() => setShowInfo(false)} className="w-full mt-5 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-400 font-bold py-2 rounded-xl border border-indigo-500/30 text-sm transition-all">Cerrar</button>
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
