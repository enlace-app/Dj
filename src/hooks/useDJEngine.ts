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

// Real BPM detection using Web Audio API
async function detectBPM(audioBuffer: AudioBuffer): Promise<number> {
  try {
    const offlineCtx = new OfflineAudioContext(1, audioBuffer.length, audioBuffer.sampleRate);
    const source = offlineCtx.createBufferSource();
    source.buffer = audioBuffer;

    // High-pass filter to isolate beats
    const filter = offlineCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 150;

    source.connect(filter);
    filter.connect(offlineCtx.destination);
    source.start(0);

    const rendered = await offlineCtx.startRendering();
    const data = rendered.getChannelData(0);
    const sampleRate = rendered.sampleRate;

    // Energy detection
    const windowSize = Math.floor(sampleRate * 0.02); // 20ms windows
    const energies: number[] = [];

    for (let i = 0; i < data.length - windowSize; i += windowSize) {
      let energy = 0;
      for (let j = 0; j < windowSize; j++) {
        energy += data[i + j] * data[i + j];
      }
      energies.push(energy / windowSize);
    }

    // Find peaks (beats)
    const avg = energies.reduce((a, b) => a + b, 0) / energies.length;
    const threshold = avg * 1.5;
    const peaks: number[] = [];
    let lastPeak = -10;

    for (let i = 1; i < energies.length - 1; i++) {
      if (energies[i] > threshold && energies[i] > energies[i - 1] && energies[i] > energies[i + 1]) {
        if (i - lastPeak > 10) { // Minimum distance between beats
          peaks.push(i * windowSize / sampleRate);
          lastPeak = i;
        }
      }
    }

    if (peaks.length < 4) return 128; // Default if not enough peaks

    // Calculate intervals between peaks
    const intervals: number[] = [];
    for (let i = 1; i < Math.min(peaks.length, 50); i++) {
      intervals.push(peaks[i] - peaks[i - 1]);
    }

    // Average interval → BPM
    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    let bpm = Math.round(60 / avgInterval);

    // Normalize to reasonable range (60-180 BPM)
    while (bpm < 60) bpm *= 2;
    while (bpm > 180) bpm /= 2;

    return bpm;
  } catch {
    return 128;
  }
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
  const distA = useRef<Tone.Compressor | null>(null);
  const distB = useRef<Tone.Compressor | null>(null);
  const filterA = useRef<Tone.Filter | null>(null);
  const filterB = useRef<Tone.Filter | null>(null);
  const eqA = useRef<Tone.EQ3 | null>(null);
  const eqB = useRef<Tone.EQ3 | null>(null);

  // Store raw AudioBuffers for BPM detection
  const rawBufferA = useRef<AudioBuffer | null>(null);
  const rawBufferB = useRef<AudioBuffer | null>(null);

  useEffect(() => {
    crossfaderNode.current = new Tone.CrossFade(0.5).toDestination();
    analyserA.current = new Tone.Analyser("waveform", 256);
    analyserB.current = new Tone.Analyser("waveform", 256);

    eqA.current = new Tone.EQ3(0, 0, 0).connect(crossfaderNode.current.a);
    filterA.current = new Tone.Filter(20000, "lowpass").connect(eqA.current);
    filterA.current.connect(analyserA.current);

    eqB.current = new Tone.EQ3(0, 0, 0).connect(crossfaderNode.current.b);
    filterB.current = new Tone.Filter(20000, "lowpass").connect(eqB.current);
    filterB.current.connect(analyserB.current);

    delayA.current = new Tone.FeedbackDelay("8n", 0.3);
    delayB.current = new Tone.FeedbackDelay("8n", 0.3);
    delayA.current.wet.value = 0;
    delayB.current.wet.value = 0;

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
      if (Tone.getContext().state !== 'running') {
        await Tone.start();
      }
      
      const url = typeof track === 'string' ? track : URL.createObjectURL(track);
      const fileName = typeof track === 'string' ? track.split('/').pop() || 'Sample Track' : track.name;
      const player = deck === 'A' ? playerA.current : playerB.current;
      
      if (player) {
        player.stop();
        
        let audioBuffer: AudioBuffer;

        if (typeof track === 'string') {
          const response = await fetch(url, { mode: 'cors' });
          const arrayBuffer = await response.arrayBuffer();
          audioBuffer = await Tone.getContext().decodeAudioData(arrayBuffer);
        } else {
          const arrayBuffer = await track.arrayBuffer();
          audioBuffer = await Tone.getContext().decodeAudioData(arrayBuffer);
        }

        // Store raw buffer for BPM detection
        if (deck === 'A') rawBufferA.current = audioBuffer;
        else rawBufferB.current = audioBuffer;

        const toneBuffer = new Tone.ToneAudioBuffer(audioBuffer);
        player.buffer = toneBuffer;
        
        const stateUpdate = {
          fileName,
          duration: audioBuffer.duration,
          progress: 0,
          isPlaying: false,
          isLoaded: true,
        };

        if (deck === 'A') setDeckA(prev => ({ ...prev, ...stateUpdate }));
        else setDeckB(prev => ({ ...prev, ...stateUpdate }));

        // Real BPM detection
        detectBPM(audioBuffer).then(bpm => {
          console.log(`Detected BPM for Deck ${deck}: ${bpm}`);
          if (deck === 'A') setDeckA(prev => ({ ...prev, bpm }));
          else setDeckB(prev => ({ ...prev, bpm }));
        });

        // AI Analysis
        analyzeTrack(fileName).then(analysis => {
          const analysisUpdate = { key: analysis.key };
          if (deck === 'A') setDeckA(prev => ({ ...prev, ...analysisUpdate }));
          else setDeckB(prev => ({ ...prev, ...analysisUpdate }));
        }).catch(err => console.error("AI Analysis failed:", err));

        getDJAdvice(fileName).then(advice => {
          setAISuggestion(deck, advice);
        }).catch(err => console.error("AI Advice failed:", err));
      }
    } catch (error) {
      console.error("Error loading track:", error);
      const errorUpdate = { fileName: 'Load Failed', isLoaded: false };
      if (deck === 'A') setDeckA(prev => ({ ...prev, ...errorUpdate }));
      else setDeckB(prev => ({ ...prev, ...errorUpdate }));
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
      const safeTime = Math.max(0, Math.min(time, player.buffer.duration));
      if (player.state === 'started') {
        player.stop();
        player.start(undefined, safeTime);
      } else {
        player.start(undefined, safeTime);
        player.stop(); 
      }
      if (deck === 'A') setDeckA(prev => ({ ...prev, progress: safeTime }));
      else setDeckB(prev => ({ ...prev, progress: safeTime }));
    }
  }, []);

  // Real BPM sync — adjusts playback rate to match BPMs
  const syncDecks = useCallback(() => {
    const bpmA = deckA.bpm;
    const bpmB = deckB.bpm;
    if (bpmA > 0 && bpmB > 0 && bpmA !== bpmB) {
      // Sync B to A's BPM
      const newRate = (bpmB / bpmA) * deckA.playbackRate;
      const clampedRate = Math.max(0.5, Math.min(2, newRate));
      setPlaybackRate('B', clampedRate);
    }
  }, [deckA.bpm, deckB.bpm, deckA.playbackRate, setPlaybackRate]);

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
    setEQ: (deck: 'A' | 'B', low: number, mid: number, high: number) => {
      const eq = deck === 'A' ? eqA.current : eqB.current;
      if (eq) {
        eq.low.value = low;
        eq.mid.value = mid;
        eq.high.value = high;
      }
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
