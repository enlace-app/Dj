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
  energy: number;
}

async function detectBPM(audioBuffer: AudioBuffer): Promise<number> {
  try {
    const sampleRate = audioBuffer.sampleRate;
    const maxSamples = Math.min(audioBuffer.length, sampleRate * 60);
    const offlineCtx = new OfflineAudioContext(1, maxSamples, sampleRate);
    const shortBuffer = offlineCtx.createBuffer(1, maxSamples, sampleRate);
    shortBuffer.copyToChannel(audioBuffer.getChannelData(0).slice(0, maxSamples), 0);
    const source = offlineCtx.createBufferSource();
    source.buffer = shortBuffer;
    const filter = offlineCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 150;
    source.connect(filter);
    filter.connect(offlineCtx.destination);
    source.start(0);
    const rendered = await offlineCtx.startRendering();
    const data = rendered.getChannelData(0);
    const windowSize = Math.floor(sampleRate * 0.02);
    const energies: number[] = [];
    for (let i = 0; i < data.length - windowSize; i += windowSize) {
      let e = 0;
      for (let j = 0; j < windowSize; j++) e += data[i+j] * data[i+j];
      energies.push(e / windowSize);
    }
    const avg = energies.reduce((a,b) => a+b, 0) / energies.length;
    const threshold = avg * 1.5;
    const peaks: number[] = [];
    let lastPeak = -10;
    for (let i = 1; i < energies.length - 1; i++) {
      if (energies[i] > threshold && energies[i] > energies[i-1] && energies[i] > energies[i+1] && i - lastPeak > 10) {
        peaks.push(i * windowSize / sampleRate);
        lastPeak = i;
      }
    }
    if (peaks.length < 4) return 120;
    const intervals: number[] = [];
    for (let i = 1; i < Math.min(peaks.length, 50); i++) intervals.push(peaks[i] - peaks[i-1]);
    let bpm = Math.round(60 / (intervals.reduce((a,b) => a+b,0) / intervals.length));
    while (bpm < 80) bpm *= 2;
    while (bpm > 160) bpm /= 2;
    return bpm;
  } catch { return 120; }
}

export const useDJEngine = () => {
  const [deckA, setDeckA] = useState<DeckState>({
    isPlaying: false, bpm: 120, volume: 0, progress: 0, duration: 0,
    fileName: 'No Track Loaded', isSyncing: false, playbackRate: 1, isLoaded: false, key: '1A', energy: 0,
  });
  const [deckB, setDeckB] = useState<DeckState>({
    isPlaying: false, bpm: 120, volume: 0, progress: 0, duration: 0,
    fileName: 'No Track Loaded', isSyncing: false, playbackRate: 1, isLoaded: false, key: '2A', energy: 0,
  });
  const [crossfader, setCrossfader] = useState(0.5);
  const [isRecording, setIsRecording] = useState(false);
  const [masterEnergy, setMasterEnergy] = useState(0);

  const playerA = useRef<Tone.Player | null>(null);
  const playerB = useRef<Tone.Player | null>(null);
  const crossfaderNode = useRef<Tone.CrossFade | null>(null);
  const recorder = useRef<Tone.Recorder | null>(null);
  const analyserA = useRef<Tone.Analyser | null>(null);
  const analyserB = useRef<Tone.Analyser | null>(null);
  const freqAnalyserA = useRef<Tone.Analyser | null>(null);
  const freqAnalyserB = useRef<Tone.Analyser | null>(null);
  const masterAnalyser = useRef<Tone.Analyser | null>(null);
  const autoMixInterval = useRef<number | null>(null);
  
  // Effects
  const delayA = useRef<Tone.FeedbackDelay | null>(null);
  const delayB = useRef<Tone.FeedbackDelay | null>(null);
  const filterA = useRef<Tone.Filter | null>(null);
  const filterB = useRef<Tone.Filter | null>(null);
  const eqA = useRef<Tone.EQ3 | null>(null);
  const eqB = useRef<Tone.EQ3 | null>(null);
  const reverbA = useRef<Tone.Reverb | null>(null);
  const reverbB = useRef<Tone.Reverb | null>(null);
  
  // Master
  const masterLimiter = useRef<Tone.Limiter | null>(null);
  const masterCompressor = useRef<Tone.Compressor | null>(null);

  // Scratch smoothing
  const scratchTargetA = useRef(0);
  const scratchTargetB = useRef(0);
  const scratchInterpolationA = useRef<NodeJS.Timeout | null>(null);
  const scratchInterpolationB = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    masterLimiter.current = new Tone.Limiter(-1).toDestination();
    masterCompressor.current = new Tone.Compressor({
      threshold: -18, ratio: 3, attack: 0.003, release: 0.1, knee: 6,
    }).connect(masterLimiter.current);

    crossfaderNode.current = new Tone.CrossFade(0.5).connect(masterCompressor.current);

    analyserA.current = new Tone.Analyser("waveform", 256);
    analyserB.current = new Tone.Analyser("waveform", 256);
    freqAnalyserA.current = new Tone.Analyser("fft", 64);
    freqAnalyserB.current = new Tone.Analyser("fft", 64);
    masterAnalyser.current = new Tone.Analyser("fft", 32);
    masterCompressor.current.connect(masterAnalyser.current);

    // Powerful reverbs
    reverbA.current = new Tone.Reverb({ decay: 2, wet: 0 }).connect(crossfaderNode.current.a);
    reverbB.current = new Tone.Reverb({ decay: 2, wet: 0 }).connect(crossfaderNode.current.b);

    eqA.current = new Tone.EQ3(0, 0, 0).connect(reverbA.current);
    filterA.current = new Tone.Filter(20000, "lowpass").connect(eqA.current);
    filterA.current.connect(analyserA.current);
    filterA.current.connect(freqAnalyserA.current);

    eqB.current = new Tone.EQ3(0, 0, 0).connect(reverbB.current);
    filterB.current = new Tone.Filter(20000, "lowpass").connect(eqB.current);
    filterB.current.connect(analyserB.current);
    filterB.current.connect(freqAnalyserB.current);

    // Powerful delay/echo
    delayA.current = new Tone.FeedbackDelay({
      delayTime: '8n',
      feedback: 0.4,
      wet: 0,
    });
    delayB.current = new Tone.FeedbackDelay({
      delayTime: '8n',
      feedback: 0.4,
      wet: 0,
    });

    playerA.current = new Tone.Player().connect(filterA.current);
    playerB.current = new Tone.Player().connect(filterB.current);

    recorder.current = new Tone.Recorder();
    masterLimiter.current.connect(recorder.current);

    // Energy detection
    const energyInterval = setInterval(() => {
      if (masterAnalyser.current) {
        const data = masterAnalyser.current.getValue() as Float32Array;
        const avg = Array.from(data).reduce((a, b) => a + Math.max(0, (b as number + 100) / 100), 0) / data.length;
        setMasterEnergy(Math.min(1, avg * 2));
      }
    }, 50);

    return () => {
      clearInterval(energyInterval);
      if (scratchInterpolationA.current) clearInterval(scratchInterpolationA.current);
      if (scratchInterpolationB.current) clearInterval(scratchInterpolationB.current);
      playerA.current?.dispose();
      playerB.current?.dispose();
      crossfaderNode.current?.dispose();
      filterA.current?.dispose();
      filterB.current?.dispose();
      delayA.current?.dispose();
      delayB.current?.dispose();
      analyserA.current?.dispose();
      analyserB.current?.dispose();
      freqAnalyserA.current?.dispose();
      freqAnalyserB.current?.dispose();
      masterAnalyser.current?.dispose();
      masterCompressor.current?.dispose();
      masterLimiter.current?.dispose();
      reverbA.current?.dispose();
      reverbB.current?.dispose();
    };
  }, []);

  const loadTrack = useCallback(async (deck: 'A' | 'B', track: File | string) => {
    try {
      if (Tone.getContext().state !== 'running') await Tone.start();
      const url = typeof track === 'string' ? track : URL.createObjectURL(track);
      const fileName = typeof track === 'string' ? track.split('/').pop() || 'Track' : track.name;
      const player = deck === 'A' ? playerA.current : playerB.current;
      if (player) {
        player.stop();
        const arrayBuffer = typeof track === 'string'
          ? await (await fetch(url, { mode: 'cors' })).arrayBuffer()
          : await track.arrayBuffer();
        const audioBuffer = await Tone.getContext().decodeAudioData(arrayBuffer);
        player.buffer = new Tone.ToneAudioBuffer(audioBuffer);
        const update = { fileName, duration: audioBuffer.duration, progress: 0, isPlaying: false, isLoaded: true };
        if (deck === 'A') setDeckA(prev => ({ ...prev, ...update }));
        else setDeckB(prev => ({ ...prev, ...update }));
        detectBPM(audioBuffer).then(bpm => {
          if (deck === 'A') setDeckA(prev => ({ ...prev, bpm }));
          else setDeckB(prev => ({ ...prev, bpm }));
        });
        analyzeTrack(fileName).then(a => {
          if (deck === 'A') setDeckA(prev => ({ ...prev, key: a.key }));
          else setDeckB(prev => ({ ...prev, key: a.key }));
        }).catch(() => {});
        getDJAdvice(fileName).then(advice => {
          if (deck === 'A') setDeckA(prev => ({ ...prev, suggestedNext: advice }));
          else setDeckB(prev => ({ ...prev, suggestedNext: advice }));
        }).catch(() => {});
      }
    } catch (e) {
      console.error(e);
      const err = { fileName: 'Error', isLoaded: false };
      if (deck === 'A') setDeckA(prev => ({ ...prev, ...err }));
      else setDeckB(prev => ({ ...prev, ...err }));
    }
  }, []);

  const togglePlay = useCallback((deck: 'A' | 'B') => {
    const player = deck === 'A' ? playerA.current : playerB.current;
    if (player?.loaded) {
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
    if (crossfaderNode.current) crossfaderNode.current.fade.value = value;
  }, []);

  const setPlaybackRate = useCallback((deck: 'A' | 'B', rate: number) => {
    const player = deck === 'A' ? playerA.current : playerB.current;
    const clamped = Math.max(0.8, Math.min(1.2, rate));
    if (player) player.playbackRate = clamped;
    if (deck === 'A') setDeckA(prev => ({ ...prev, playbackRate: clamped }));
    else setDeckB(prev => ({ ...prev, playbackRate: clamped }));
  }, []);

  const seekTo = useCallback((deck: 'A' | 'B', time: number) => {
    const player = deck === 'A' ? playerA.current : playerB.current;
    if (!player?.loaded) return;

    const duration = player.buffer.duration;
    const safeTime = Math.max(0, Math.min(time, duration - 0.05));

    // Store target for smooth interpolation
    if (deck === 'A') scratchTargetA.current = safeTime;
    else scratchTargetB.current = safeTime;

    // Clear previous interpolation
    if (deck === 'A' && scratchInterpolationA.current) clearInterval(scratchInterpolationA.current);
    if (deck === 'B' && scratchInterpolationB.current) clearInterval(scratchInterpolationB.current);

    // Smooth seek without stopping playback
    const wasPlaying = player.state === 'started';
    if (wasPlaying) {
      player.stop();
      player.start(Tone.now() + 0.01, safeTime);
    } else {
      player.start(Tone.now() + 0.01, safeTime);
      player.stop('+0.05');
    }

    // Update UI position
    if (deck === 'A') setDeckA(prev => ({ ...prev, progress: safeTime }));
    else setDeckB(prev => ({ ...prev, progress: safeTime }));
  }, []);

  const syncDecks = useCallback(() => {
    if (deckA.bpm > 0 && deckB.bpm > 0) {
      const rate = Math.max(0.8, Math.min(1.2, deckA.bpm / deckB.bpm));
      if (playerB.current) playerB.current.playbackRate = rate;
      setDeckB(prev => ({ ...prev, playbackRate: rate }));
    }
  }, [deckA.bpm, deckB.bpm]);

  const startRecording = useCallback(async () => {
    if (recorder.current) { recorder.current.start(); setIsRecording(true); }
  }, []);

  const stopRecording = useCallback(async () => {
    if (recorder.current) {
      const blob = await recorder.current.stop();
      setIsRecording(false);
      const a = document.createElement('a');
      a.download = `mix-${Date.now()}.webm`;
      a.href = URL.createObjectURL(blob);
      a.click();
    }
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      if (playerA.current?.state === 'started')
        setDeckA(prev => ({ ...prev, progress: playerA.current?.seconds || 0 }));
      if (playerB.current?.state === 'started')
        setDeckB(prev => ({ ...prev, progress: playerB.current?.seconds || 0 }));
    }, 100);
    return () => clearInterval(interval);
  }, []);

  const startAutoMix = useCallback((toDeck: 'A' | 'B') => {
    if (autoMixInterval.current) clearInterval(autoMixInterval.current);
    const target = toDeck === 'A' ? 0 : 1;
    const start = crossfader;
    let step = 0;
    autoMixInterval.current = window.setInterval(() => {
      step++;
      handleCrossfade(start + (target - start) * (step / 50));
      if (step >= 50 && autoMixInterval.current) clearInterval(autoMixInterval.current);
    }, 100);
  }, [crossfader, handleCrossfade]);

  return {
    deckA, deckB, crossfader, isRecording, masterEnergy,
    analyserDataA: () => analyserA.current?.getValue(),
    analyserDataB: () => analyserB.current?.getValue(),
    freqDataA: () => freqAnalyserA.current?.getValue(),
    freqDataB: () => freqAnalyserB.current?.getValue(),
    loadTrack, togglePlay, seekTo, handleCrossfade, setPlaybackRate,
    syncDecks, startRecording, stopRecording, startAutoMix,
    setFilter: (deck: 'A' | 'B', freq: number) => {
      const f = deck === 'A' ? filterA.current : filterB.current;
      if (f) f.frequency.value = freq;
    },
    setEQ: (deck: 'A' | 'B', low: number, mid: number, high: number) => {
      const eq = deck === 'A' ? eqA.current : eqB.current;
      if (eq) { eq.low.value = low; eq.mid.value = mid; eq.high.value = high; }
    },
    setFX: (deck: 'A' | 'B', type: 'delay' | 'reverb', value: number) => {
      if (type === 'delay') {
        const fx = deck === 'A' ? delayA.current : delayB.current;
        if (fx) fx.wet.value = value;
      } else if (type === 'reverb') {
        const fx = deck === 'A' ? reverbA.current : reverbB.current;
        if (fx) fx.wet.value = value;
      }
    },
  };
};
