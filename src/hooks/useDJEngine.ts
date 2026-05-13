import { useState, useCallback, useRef, useEffect } from 'react';
import * as Tone from 'tone';
import { getDJAdvice, analyzeTrack } from '../services/aiService';

export interface DeckState {
  isPlaying: boolean;
  bpm: number;
  volume: number;
  progress: number;
  duration: number;
  fileName: string;
  isSyncing: boolean;
  playbackRate: number;
  isLoaded: boolean;
  key?: string;
  suggestedNext?: { suggestion: string; tip: string };
}

export const useDJEngine = () => {
  const [deckA, setDeckA] = useState<DeckState>({
    isPlaying: false,
    bpm: 128,
    volume: 0,
    progress: 0,
    duration: 0,
    fileName: 'No Track Loaded',
    isSyncing: false,
    playbackRate: 1,
    isLoaded: false,
    key: '1A',
  });

  const [deckB, setDeckB] = useState<DeckState>({
    isPlaying: false,
    bpm: 128,
    volume: 0,
    progress: 0,
    duration: 0,
    fileName: 'No Track Loaded',
    isSyncing: false,
    playbackRate: 1,
    isLoaded: false,
    key: '2A',
  });

  const [crossfader, setCrossfader] = useState(0.5);
  const [isRecording, setIsRecording] = useState(false);

  // Audio References
  const playerA = useRef<Tone.Player | null>(null);
  const playerB = useRef<Tone.Player | null>(null);
  const crossfaderNode = useRef<Tone.CrossFade | null>(null);
  const recorder = useRef<Tone.Recorder | null>(null);
  const analyserA = useRef<Tone.Analyser | null>(null);
  const analyserB = useRef<Tone.Analyser | null>(null);
  const autoMixInterval = useRef<number | null>(null);
  
  // Effects
  const reverb = useRef<Tone.Reverb | null>(null);
  const delayA = useRef<Tone.FeedbackDelay | null>(null);
  const delayB = useRef<Tone.FeedbackDelay | null>(null);
  const distA = useRef<Tone.BitCrusher | null>(null);
  const distB = useRef<Tone.BitCrusher | null>(null);
  const filterA = useRef<Tone.Filter | null>(null);
  const filterB = useRef<Tone.Filter | null>(null);

  useEffect(() => {
    // Initialize Tone.js nodes
    crossfaderNode.current = new Tone.CrossFade(0.5).toDestination();
    
    // Analyzers for each deck
    analyserA.current = new Tone.Analyser("waveform", 256);
    analyserB.current = new Tone.Analyser("waveform", 256);

    // FX Chains
    delayA.current = new Tone.FeedbackDelay("8n", 0.5).connect(crossfaderNode.current.a);
    distA.current = new Tone.BitCrusher(4).connect(delayA.current);
    filterA.current = new Tone.Filter(20000, "lowpass").connect(distA.current);
    filterA.current.connect(analyserA.current);
    
    delayB.current = new Tone.FeedbackDelay("8n", 0.5).connect(crossfaderNode.current.b);
    distB.current = new Tone.BitCrusher(4).connect(delayB.current);
    filterB.current = new Tone.Filter(20000, "lowpass").connect(distB.current);
    filterB.current.connect(analyserB.current);

    // Initial bypass
    delayA.current.wet.value = 0;
    delayB.current.wet.value = 0;
    distA.current.wet.value = 0;
    distB.current.wet.value = 0;

    playerA.current = new Tone.Player().connect(filterA.current);
    playerB.current = new Tone.Player().connect(filterB.current);
    
    reverb.current = new Tone.Reverb(2).toDestination();
    recorder.current = new Tone.Recorder();
    Tone.Destination.connect(recorder.current);

    return () => {
      playerA.current?.dispose();
      playerB.current?.dispose();
      crossfaderNode.current?.dispose();
      reverb.current?.dispose();
      filterA.current?.dispose();
      filterB.current?.dispose();
      delayA.current?.dispose();
      delayB.current?.dispose();
      distA.current?.dispose();
      distB.current?.dispose();
      analyserA.current?.dispose();
      analyserB.current?.dispose();
    };
  }, []);

  const loadTrack = useCallback(async (deck: 'A' | 'B', track: File | string) => {
    try {
      console.log(`Loading track for Deck ${deck}...`);
      if (Tone.getContext().state !== 'running') {
        await Tone.start();
        console.log("Tone.js started");
      }
      
      const url = typeof track === 'string' ? track : URL.createObjectURL(track);
      const fileName = typeof track === 'string' ? track.split('/').pop() || 'Sample Track' : track.name;
      
      const player = deck === 'A' ? playerA.current : playerB.current;
      
      if (player) {
        player.stop();
        
        let buffer: Tone.ToneAudioBuffer;

        if (typeof track === 'string') {
          console.log(`Loading external sample: ${url}`);
          try {
            const response = await fetch(url, { mode: 'cors' });
            if (!response.ok) {
              if (response.status === 404) throw new Error(`Track not found (404). The sample link might be broken.`);
              throw new Error(`HTTP Error ${response.status}: ${response.statusText}`);
            }
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await Tone.getContext().decodeAudioData(arrayBuffer);
            buffer = new Tone.ToneAudioBuffer(audioBuffer);
          } catch (e) {
            console.warn("Fetch failed, attempting Tone.Buffer fallback", e);
            // Fallback to Tone's own loader which handles some edge cases differently
            buffer = await new Tone.ToneAudioBuffer().load(url);
          }
        } else {
          // It's a local file
          const arrayBuffer = await track.arrayBuffer();
          const audioBuffer = await Tone.getContext().decodeAudioData(arrayBuffer);
          buffer = new Tone.ToneAudioBuffer(audioBuffer);
        }

        player.buffer = buffer;
        console.log(`Buffer loaded: ${buffer.duration} seconds`);
        
        const stateUpdate = {
          fileName: fileName,
          duration: buffer.duration,
          progress: 0,
          isPlaying: false,
          isLoaded: true,
        };

        if (deck === 'A') setDeckA(prev => ({ ...prev, ...stateUpdate }));
        else setDeckB(prev => ({ ...prev, ...stateUpdate }));

        // Trigger AI Analysis and Suggestion after load
        analyzeTrack(fileName).then(analysis => {
          const analysisUpdate = { key: analysis.key, bpm: analysis.bpm };
          if (deck === 'A') setDeckA(prev => ({ ...prev, ...analysisUpdate }));
          else setDeckB(prev => ({ ...prev, ...analysisUpdate }));
        }).catch(err => console.error("AI Analysis failed:", err));

        getDJAdvice(fileName).then(advice => {
          setAISuggestion(deck, advice);
        }).catch(err => console.error("AI Auto-Advice failed:", err));
      }
    } catch (error) {
      console.error("Error loading track:", error);
      const errorMsg = error instanceof Error ? error.message : "Network error or invalid audio format";
      
      const errorUpdate = { fileName: 'Load Failed', isLoaded: false };
      if (deck === 'A') setDeckA(prev => ({ ...prev, ...errorUpdate }));
      else setDeckB(prev => ({ ...prev, ...errorUpdate }));
      
      throw new Error(errorMsg);
    }
  }, []);

  const togglePlay = useCallback((deck: 'A' | 'B') => {
    const player = deck === 'A' ? playerA.current : playerB.current;
    if (player && player.loaded) {
      if (player.state === 'started') {
        player.stop();
        if (deck === 'A') setDeckA(prev => ({ ...prev, isPlaying: false }));
        else setDeckB(prev => ({ ...prev, isPlaying: false }));
      } else {
        player.start();
        if (deck === 'A') setDeckA(prev => ({ ...prev, isPlaying: true }));
        else setDeckB(prev => ({ ...prev, isPlaying: true }));
      }
    }
  }, []);

  const handleCrossfade = useCallback((value: number) => {
    setCrossfader(value);
    if (crossfaderNode.current) {
      crossfaderNode.current.fade.value = value;
    }
  }, []);

  const setPlaybackRate = useCallback((deck: 'A' | 'B', rate: number) => {
    const player = deck === 'A' ? playerA.current : playerB.current;
    if (player) {
      player.playbackRate = rate;
      if (deck === 'A') setDeckA(prev => ({ ...prev, playbackRate: rate }));
      else setDeckB(prev => ({ ...prev, playbackRate: rate }));
    }
  }, []);

  const seekTo = useCallback((deck: 'A' | 'B', time: number) => {
    const player = deck === 'A' ? playerA.current : playerB.current;
    if (player && player.loaded) {
      // Ensure time is within bounds
      const safeTime = Math.max(0, Math.min(time, player.buffer.duration));
      
      if (player.state === 'started') {
        player.stop();
        player.start(undefined, safeTime);
      } else {
        // Just update internal seconds if stopped (though Tone.Player might not reflect this immediately)
        // We'll manage it via state if needed, but start() with offset is key
        player.start(undefined, safeTime);
        player.stop(); 
      }
      
      if (deck === 'A') setDeckA(prev => ({ ...prev, progress: safeTime }));
      else setDeckB(prev => ({ ...prev, progress: safeTime }));
    }
  }, []);

  const syncDecks = useCallback(() => {
    // Simple implementation: sync playback rate of B to A or A to B
    // Usually requires BPM detection, here we just match playback rates
    if (deckA.playbackRate !== deckB.playbackRate) {
      setPlaybackRate('B', deckA.playbackRate);
    }
  }, [deckA.playbackRate, deckB.playbackRate, setPlaybackRate]);

  const startRecording = useCallback(async () => {
    if (recorder.current) {
      recorder.current.start();
      setIsRecording(true);
    }
  }, []);

  const stopRecording = useCallback(async () => {
    if (recorder.current) {
      const recording = await recorder.current.stop();
      setIsRecording(false);
      const url = URL.createObjectURL(recording);
      const anchor = document.createElement('a');
      anchor.download = `mix-${new Date().toISOString()}.webm`;
      anchor.href = url;
      anchor.click();
    }
  }, []);

  // Update progress
  useEffect(() => {
    const interval = setInterval(() => {
      if (playerA.current?.state === 'started') {
        setDeckA(prev => ({ ...prev, progress: playerA.current?.seconds || 0 }));
      }
      if (playerB.current?.state === 'started') {
        setDeckB(prev => ({ ...prev, progress: playerB.current?.seconds || 0 }));
      }
    }, 100);
    return () => clearInterval(interval);
  }, []);

  const startAutoMix = useCallback((toDeck: 'A' | 'B') => {
    if (autoMixInterval.current) clearInterval(autoMixInterval.current);
    
    const targetValue = toDeck === 'A' ? 0 : 1;
    const step = (targetValue - crossfader) / 50; 
    let count = 0;

    autoMixInterval.current = window.setInterval(() => {
      handleCrossfade(crossfader + step * count);
      count++;
      if (count >= 50) {
        if (autoMixInterval.current) clearInterval(autoMixInterval.current);
        // Fade complete
      }
    }, 100);
  }, [crossfader, handleCrossfade]);

  const setAISuggestion = useCallback((deck: 'A' | 'B', suggestion: { suggestion: string; tip: string }) => {
    if (deck === 'A') setDeckA(prev => ({ ...prev, suggestedNext: suggestion }));
    else setDeckB(prev => ({ ...prev, suggestedNext: suggestion }));
  }, []);

  return {
    deckA,
    deckB,
    crossfader,
    isRecording,
    analyserDataA: () => analyserA.current?.getValue(),
    analyserDataB: () => analyserB.current?.getValue(),
    loadTrack,
    togglePlay,
    seekTo,
    handleCrossfade,
    setPlaybackRate,
    syncDecks,
    startRecording,
    stopRecording,
    startAutoMix,
    setAISuggestion,
    setFilter: (deck: 'A' | 'B', freq: number) => {
        const filter = deck === 'A' ? filterA.current : filterB.current;
        if (filter) filter.frequency.value = freq;
    },
    setFX: (deck: 'A' | 'B', type: 'delay' | 'dist', value: number) => {
        if (type === 'delay') {
            const fx = deck === 'A' ? delayA.current : delayB.current;
            if (fx) fx.wet.value = value;
        } else {
            const fx = deck === 'A' ? distA.current : distB.current;
            if (fx) fx.wet.value = value;
        }
    }
  };
};
