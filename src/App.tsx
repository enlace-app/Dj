import { motion, AnimatePresence } from 'motion/react';
import * as Tone from 'tone';
import { useDJEngine } from './hooks/useDJEngine';
import { Deck } from './components/Deck';
import { Mixer } from './components/Mixer';
import { Visualizer } from './components/Visualizer';
import { Headphones, Share2, Menu, Info, X, GraduationCap } from 'lucide-react';
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
    <div className="min-h-screen text-slate-100 font-sans selection:bg-indigo-500/30">
      {/* Header */}
      <header className="h-12 sm:h-20 flex items-center justify-between px-4 sm:px-8 bg-white/5 backdrop-blur-xl border-b border-white/10 sticky top-0 z-50">
        <div className="flex items-center gap-2 sm:gap-4">
          <div className="w-6 h-6 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Headphones size={14} className="text-white sm:w-5 sm:h-5" />
          </div>
          <div>
            <h1 className="text-[10px] sm:text-lg font-black tracking-tight uppercase leading-none text-white">VirtualDeck</h1>
            <p className="text-[6px] sm:text-[10px] text-slate-400 font-mono tracking-[0.1em] sm:tracking-[0.2em] uppercase mt-0.5">Frosted Edition</p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
          <button 
            key="audio-status"
            onClick={startAudio}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg font-bold text-[10px] transition-all border ${audioStatus === 'running' ? 'bg-emerald-600/20 text-emerald-400 border-emerald-500/30' : 'bg-amber-600/20 text-amber-400 border-amber-500/30 animate-pulse'}`}
          >
            <div className={`w-2 h-2 rounded-full ${audioStatus === 'running' ? 'bg-emerald-400' : 'bg-amber-400'}`} />
            <span className="uppercase tracking-wider hidden sm:inline">{audioStatus === 'running' ? 'Audio Engine Live' : 'Enable Audio'}</span>
          </button>
          <button 
            onClick={() => setShowAcademy(true)}
            className="flex items-center gap-2 bg-pink-600/20 px-3 py-1.5 rounded-lg font-bold text-[10px] text-pink-400 hover:bg-pink-600/30 transition-all border border-pink-500/30"
          >
            <GraduationCap size={16} />
            <span className="uppercase tracking-wider hidden sm:inline">Academy</span>
          </button>
          <button 
            onClick={() => setShowInfo(true)}
            className="p-1 text-slate-400 hover:text-white transition-colors"
          >
            <Info size={16} className="sm:w-5 sm:h-5" />
          </button>
          <button className="flex items-center gap-1 sm:gap-2 bg-indigo-600 px-2 sm:px-6 py-1 sm:py-2 rounded-md sm:rounded-lg font-bold text-[8px] sm:text-sm hover:bg-indigo-500 shadow-lg shadow-indigo-500/20 transition-all">
            <Share2 size={10} className="text-white sm:w-4 sm:h-4" />
            <span className="uppercase tracking-wider hidden xs:inline">Share</span>
          </button>
        </div>
      </header>

      <main className="flex-1 w-full p-1 sm:p-4 flex flex-row items-stretch justify-center gap-1 sm:gap-4 overflow-hidden select-none">
        {/* Left Deck */}
        <motion.div 
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex-1 min-w-0"
        >
          <Deck 
            id="A" 
            state={engine.deckA} 
            onLoad={(f) => engine.loadTrack('A', f)}
            onTogglePlay={() => engine.togglePlay('A')}
            onRateChange={(r) => engine.setPlaybackRate('A', r)}
            onFilterChange={(v) => engine.setFilter('A', v)}
            onFXChange={(type, val) => engine.setFX('A', type, val)}
            onScratch={(offset) => engine.seekTo('A', engine.deckA.progress + offset)}
            getVisualizerData={engine.analyserDataA}
          />
        </motion.div>

        {/* Mixer */}
        <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="shrink-0 h-full"
        >
          <Mixer 
            crossfade={engine.crossfader}
            onCrossfadeChange={engine.handleCrossfade}
            isRecording={engine.isRecording}
            onStartRecording={engine.startRecording}
            onStopRecording={engine.stopRecording}
            onSync={engine.syncDecks}
            onAutoMix={engine.startAutoMix}
          />
        </motion.div>

        {/* Right Deck */}
        <motion.div
             initial={{ opacity: 0, x: 50 }}
             animate={{ opacity: 1, x: 0 }}
             transition={{ delay: 0.2 }}
             className="flex-1 min-w-0"
        >
          <Deck 
            id="B" 
            state={engine.deckB} 
            onLoad={(f) => engine.loadTrack('B', f)}
            onTogglePlay={() => engine.togglePlay('B')}
            onRateChange={(r) => engine.setPlaybackRate('B', r)}
            onFilterChange={(v) => engine.setFilter('B', v)}
            onFXChange={(type, val) => engine.setFX('B', type, val)}
            onScratch={(offset) => engine.seekTo('B', engine.deckB.progress + offset)}
            getVisualizerData={engine.analyserDataB}
          />
        </motion.div>
      </main>

      {/* Info Modal */}
      <AnimatePresence>
        {showInfo && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md"
          >
            <motion.div 
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                className="bg-slate-900/40 backdrop-blur-2xl p-10 rounded-[2rem] border border-white/10 max-w-md w-full relative overflow-hidden shadow-2xl"
            >
                <button 
                  onClick={() => setShowInfo(false)}
                  className="absolute top-6 right-6 p-2 text-slate-400 hover:text-white transition-colors"
                >
                    <X size={24} />
                </button>
                <div className="absolute -top-10 -left-10 w-40 h-40 bg-indigo-500/20 blur-[100px] rounded-full" />
                
                <h3 className="text-2xl font-bold mb-6 flex items-center gap-3">
                    <Headphones className="text-indigo-400" />
                    How to DJ
                </h3>
                <ul className="space-y-4 text-slate-400 text-sm">
                    <li className="flex gap-3">
                        <span className="text-indigo-400 font-mono font-bold">01.</span>
                        <span>Click <b>LOAD</b> on each deck to choose music files from your device.</span>
                    </li>
                    <li className="flex gap-3">
                        <span className="text-indigo-400 font-mono font-bold">02.</span>
                        <span>Use the <b>CROSSFADER</b> in the center to blend audio between Deck A and B.</span>
                    </li>
                    <li className="flex gap-3">
                        <span className="text-indigo-400 font-mono font-bold">03.</span>
                        <span>Adjust the <b>PITCH</b> slider to change track speed. Use <b>SYNC</b> to match tempos.</span>
                    </li>
                    <li className="flex gap-3">
                        <span className="text-indigo-400 font-mono font-bold">04.</span>
                        <span>Hit the <b>REC</b> button to record your session. Your mix will be downloaded once finished.</span>
                    </li>
                </ul>
                <button 
                  onClick={() => setShowInfo(false)}
                  className="w-full mt-8 bg-black/40 hover:bg-black/60 text-indigo-400 font-bold py-3 rounded-xl border border-indigo-500/30 transition-all shadow-lg"
                >
                    Dismiss
                </button>
            </motion.div>
          </motion.div>
        )}

        {showAcademy && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xl"
          >
            <motion.div 
                initial={{ scale: 0.9, rotateX: 20 }}
                animate={{ scale: 1, rotateX: 0 }}
                className="bg-slate-900 shadow-[0_0_100px_rgba(236,72,153,0.3)] p-12 rounded-[3rem] border border-pink-500/20 max-w-2xl w-full relative overflow-hidden"
            >
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-pink-500 to-indigo-500 animate-pulse" />
                
                <h3 className="text-3xl font-black mb-8 flex items-center gap-4 text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-400">
                    <GraduationCap size={32} className="text-pink-500" />
                    DJ Academy: Quest 1
                </h3>

                <div className="space-y-6">
                    <div className="bg-white/5 p-6 rounded-2xl border border-white/10">
                        <h4 className="text-pink-400 font-bold uppercase tracking-widest text-[10px] mb-2">Current Challenge</h4>
                        <p className="text-lg text-white font-medium">Perform a "Scratch Transition"</p>
                        <p className="text-slate-400 text-sm mt-2">Grip the record on Deck A while it's playing, move it back and forth, then snap the crossfader to Deck B.</p>
                    </div>

                    <div className="flex gap-4">
                        <div className="flex-1 bg-black/20 p-4 rounded-xl border border-white/5 text-center">
                            <p className="text-slate-500 uppercase text-[8px] font-black">Success Rate</p>
                            <p className="text-2xl font-black text-white">0%</p>
                        </div>
                        <div className="flex-1 bg-black/20 p-4 rounded-xl border border-white/5 text-center">
                            <p className="text-slate-500 uppercase text-[8px] font-black">Global Rank</p>
                            <p className="text-2xl font-black text-white">#12,401</p>
                        </div>
                    </div>
                </div>

                <button 
                  onClick={() => setShowAcademy(false)}
                  className="w-full mt-10 bg-pink-600 hover:bg-pink-500 text-white font-black uppercase tracking-[0.2em] py-4 rounded-2xl transition-all shadow-xl shadow-pink-500/20 transform hover:scale-[1.02] active:scale-95"
                >
                    Accept Challenge
                </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer / Status */}
      <footer className="fixed bottom-0 left-0 right-0 h-6 sm:h-10 bg-white/5 backdrop-blur-xl border-t border-white/10 flex items-center justify-between px-4 sm:px-8 z-40">
        <div className="flex gap-2 sm:gap-6">
             <div className="flex items-center gap-1 sm:gap-2">
                <div className="w-1 h-1 sm:w-2 sm:h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]" />
                <span className="text-[6px] sm:text-[10px] text-slate-400 font-mono uppercase font-bold hidden xs:inline">Engine: Active</span>
             </div>
             <div className="flex items-center gap-1 sm:gap-2">
                <div className={`w-1 h-1 sm:w-2 sm:h-2 rounded-full ${engine.isRecording ? 'bg-red-500 animate-pulse' : 'bg-slate-700'}`} />
                <span className="text-[6px] sm:text-[10px] text-slate-400 font-mono uppercase font-bold">{engine.isRecording ? 'Rec' : 'Idle'}</span>
             </div>
        </div>
        <span className="text-[6px] sm:text-[10px] text-slate-600 font-mono font-bold">v1.3.1</span>
      </footer>
    </div>
  );
}
