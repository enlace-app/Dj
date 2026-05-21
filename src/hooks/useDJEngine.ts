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
      for (let j = 0; j < windowSize; j++) e += data[i + j] * data[i + j];
      energies.push(e / windowSize);
    }
    const avg = energies.reduce((a, b) => a + b, 0) / energies.length;
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
    let bpm = Math.round(60 / (intervals.reduce((a, b) => a + b, 0) / intervals.length));
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

  const delayA = useRef<Tone.FeedbackDelay | null>(null);
  const delayB = useRef<Tone.FeedbackDelay | null>(null);
  const reverbA = useRef<Tone.Reverb | null>(null);
  const reverbB = useRef<Tone.Reverb | null>(null);
  const filterA = useRef<Tone.Filter | null>(null);
  const filterB = useRef<Tone.Filter | null>(null);
  const eqA = useRef<Tone.EQ3 | null>(null);
  const eqB = useRef<Tone.EQ3 | null>(null);
  const masterLimiter = useRef<Tone.Limiter | null>(null);
  const masterCompressor = useRef<Tone.Compressor | null>(null);

  // Stored playback rates (pitch slider values, not scratch rates)
  const rateA = useRef(1);
  const rateB = useRef(1);
  const posA = useRef(0);
  const posB = useRef(0);
  const isPlayingA = useRef(false);
  const isPlayingB = useRef(false);

  useEffect(() => {
    masterLimiter.current = new Tone.Limiter(-2).toDestination();
    masterCompressor.current = new Tone.Compressor({
      threshold: -20, ratio: 4, attack: 0.005, release: 0.15, knee: 8,
    }).connect(masterLimiter.current);

    crossfaderNode.current = new Tone.CrossFade(0.5).connect(masterCompressor.current);

    analyserA.current = new Tone.Analyser('waveform', 256);
    analyserB.current = new Tone.Analyser('waveform', 256);
    freqAnalyserA.current = new Tone.Analyser('fft', 64);
    freqAnalyserB.current = new Tone.Analyser('fft', 64);
    masterAnalyser.current = new Tone.Analyser('fft', 32);
    masterCompressor.current.connect(masterAnalyser.current);

    reverbA.current = new Tone.Reverb({ decay: 2.5, wet: 0 }).connect(crossfaderNode.current.a);
    reverbB.current = new Tone.Reverb({ decay: 2.5, wet: 0 }).connect(crossfaderNode.current.b);

    eqA.current = new Tone.EQ3(0, 0, 0).connect(reverbA.current);
    filterA.current = new Tone.Filter(20000, 'lowpass').connect(eqA.current);
    filterA.current.connect(analyserA.current);
    filterA.current.connect(freqAnalyserA.current);

    eqB.current = new Tone.EQ3(0, 0, 0).connect(reverbB.current);
    filterB.current = new Tone.Filter(20000, 'lowpass').connect(eqB.current);
    filterB.current.connect(analyserB.current);
    filterB.current.connect(freqAnalyserB.current);

    delayA.current = new Tone.FeedbackDelay({ delayTime: 0.25, feedback: 0.35, wet: 0 }).connect(crossfaderNode.current.a);
    delayB.current = new Tone.FeedbackDelay({ delayTime: 0.25, feedback: 0.35, wet: 0 }).connect(crossfaderNode.current.b);

    // fadeIn/fadeOut eliminates clicks
    playerA.current = new Tone.Player({ fadeIn: 0.005, fadeOut: 0.005 }).connect(filterA.current);
    playerB.current = new Tone.Player({ fadeIn: 0.005, fadeOut: 0.005 }).connect(filterB.current);
    playerA.current.connect(delayA.current);
    playerB.current.connect(delayB.current);

    recorder.current = new Tone.Recorder();
    masterLimiter.current.connect(recorder.current);

    const energyInterval = setInterval(() => {
      if (masterAnalyser.current) {
        const data = masterAnalyser.current.getValue() as Float32Array;
        const avg = Array.from(data).reduce((a, b) => a + Math.max(0, (b as number + 100) / 100), 0) / data.length;
        setMasterEnergy(Math.min(1, avg * 2));
      }
    }, 60);

    return () => {
      clearInterval(energyInterval);
      playerA.current?.dispose();
      playerB.current?.dispose();
      crossfaderNode.current?.dispose();
      filterA.current?.dispose();
      filterB.current?.dispose();
      eqA.current?.dispose();
      eqB.current?.dispose();
      delayA.current?.dispose();
      delayB.current?.dispose();
      reverbA.current?.dispose();
      reverbB.current?.dispose();
      analyserA.current?.dispose();
      analyserB.current?.dispose();
      freqAnalyserA.current?.dispose();
      freqAnalyserB.current?.dispose();
      masterAnalyser.current?.dispose();
      masterCompressor.current?.dispose();
      masterLimiter.current?.dispose();
    };
  }, []);

  const loadTrack = useCallback(async (deck: 'A' | 'B', track: File | string) => {
    try {
      if (Tone.getContext().state !== 'running') await Tone.start();
      const url = typeof track === 'string' ? track : URL.createObjectURL(track);
      const fileName = typeof track === 'string' ? track.split('/').pop() || 'Track' : track.name;
      const player = deck === 'A' ? playerA.current : playerB.current;
      if (player) {
        if (player.state === 'started') player.stop();
        const arrayBuffer = typeof track === 'string'
          ? await (await fetch(url, { mode: 'cors' })).arrayBuffer()
          : await track.arrayBuffer();
        const audioBuffer = await Tone.getContext().decodeAudioData(arrayBuffer);
        player.buffer = new Tone.ToneAudioBuffer(audioBuffer);
        if (deck === 'A') { posA.current = 0; isPlayingA.current = false; }
        else { posB.current = 0; isPlayingB.current = false; }
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
    } catch (e) { console.error(e); }
  }, []);

  const togglePlay = useCallback((deck: 'A' | 'B') => {
    const player = deck === 'A' ? playerA.current : playerB.current;
    const pos = deck === 'A' ? posA.current : posB.current;
    const rate = deck === 'A' ? rateA.current : rateB.current;
    if (!player?.loaded) return;
    if (player.state === 'started') {
      player.stop();
      if (deck === 'A') { isPlayingA.current = false; setDeckA(p => ({ ...p, isPlaying: false })); }
      else { isPlayingB.current = false; setDeckB(p => ({ ...p, isPlaying: false })); }
    } else {
      player.playbackRate = rate;
      player.start(Tone.now(), pos);
      if (deck === 'A') { isPlayingA.current = true; setDeckA(p => ({ ...p, isPlaying: true })); }
      else { isPlayingB.current = true; setDeckB(p => ({ ...p, isPlaying: true })); }
    }
  }, []);

  const handleCrossfade = useCallback((value: number) => {
    setCrossfader(value);
    if (crossfaderNode.current) crossfaderNode.current.fade.value = value;
  }, []);

  const setPlaybackRate = useCallback((deck: 'A' | 'B', rate: number) => {
    const player = deck === 'A' ? playerA.current : playerB.current;
    const clamped = Math.max(0.5, Math.min(1.5, rate));
    if (deck === 'A') rateA.current = clamped;
    else rateB.current = clamped;
    if (player && player.state === 'started') player.playbackRate = clamped;
    if (deck === 'A') setDeckA(p => ({ ...p, playbackRate: clamped }));
    else setDeckB(p => ({ ...p, playbackRate: clamped }));
  }, []);

  const seekTo = useCallback((deck: 'A' | 'B', time: number) => {
    const player = deck === 'A' ? playerA.current : playerB.current;
    const playing = deck === 'A' ? isPlayingA.current : isPlayingB.current;
    const rate = deck === 'A' ? rateA.current : rateB.current;
    if (!player?.loaded) return;
    const safeTime = Math.max(0, Math.min(time, player.buffer.duration - 0.05));
    if (deck === 'A') posA.current = safeTime;
    else posB.current = safeTime;
    if (player.state === 'started') player.stop();
    if (playing) {
      player.playbackRate = rate;
      player.start(Tone.now() + 0.01, safeTime);
    }
    if (deck === 'A') setDeckA(p => ({ ...p, progress: safeTime }));
    else setDeckB(p => ({ ...p, progress: safeTime }));
  }, []);

  // SCRATCH — uses playbackRate, NEVER stops the player
  // onScratchStart: ensure player is running
  const scratchStart = useCallback((deck: 'A' | 'B') => {
    const player = deck === 'A' ? playerA.current : playerB.current;
    const pos = deck === 'A' ? posA.current : posB.current;
    if (!player?.loaded) return;
    // If not playing, start at current position so scratch works
    if (player.state !== 'started') {
      player.playbackRate = 0.001; // near-zero = almost paused
      player.start(Tone.now(), pos);
    }
  }, []);

  // onScratchMove: change playbackRate based on disc velocity
  const scratchMove = useCallback((deck: 'A' | 'B', rate: number) => {
    const player = deck === 'A' ? playerA.current : playerB.current;
    if (!player?.loaded) return;
    // rate comes from Turntable angular velocity calculation
    // Clamp to safe range
    const scratchRate = Math.max(-2, Math.min(3, rate));
    if (player.state === 'started') {
      player.playbackRate = scratchRate === 0 ? 0.001 : scratchRate;
    }
  }, []);

  // onScratchEnd: restore normal playback rate or stop if wasn't playing
  const scratchEnd = useCallback((deck: 'A' | 'B') => {
    const player = deck === 'A' ? playerA.current : playerB.current;
    const playing = deck === 'A' ? isPlayingA.current : isPlayingB.current;
    const rate = deck === 'A' ? rateA.current : rateB.current;
    if (!player?.loaded) return;
    if (playing) {
      // Restore normal speed
      if (player.state === 'started') player.playbackRate = rate;
    } else {
      // Wasn't playing — stop after scratch
      if (player.state === 'started') player.stop();
    }
  }, []);

  const syncDecks = useCallback(() => {
    if (deckA.bpm > 0 && deckB.bpm > 0) {
      const rate = Math.max(0.8, Math.min(1.2, deckA.bpm / deckB.bpm));
      rateB.current = rate;
      if (playerB.current && playerB.current.state === 'started') playerB.current.playbackRate = rate;
      setDeckB(p => ({ ...p, playbackRate: rate }));
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
      if (playerA.current?.state === 'started') {
        const p = playerA.current.seconds;
        posA.current = p;
        setDeckA(prev => ({ ...prev, progress: p }));
      }
      if (playerB.current?.state === 'started') {
        const p = playerB.current.seconds;
        posB.current = p;
        setDeckB(prev => ({ ...prev, progress: p }));
      }
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
    loadTrack, togglePlay, seekTo,
    scratchStart, scratchMove, scratchEnd,
    handleCrossfade, setPlaybackRate,
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
      const fx = type === 'delay'
        ? (deck === 'A' ? delayA.current : delayB.current)
        : (deck === 'A' ? reverbA.current : reverbB.current);
      if (fx) fx.wet.value = value;
    },
  };
};
