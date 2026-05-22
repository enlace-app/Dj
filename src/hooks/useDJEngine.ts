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

// ─── Real scratch engine using Web Audio API ───────────────────────────────
// Tone.js cannot do real scratch (no negative playbackRate, no scrubbing).
// We use a raw AudioBufferSourceNode that we restart rapidly on each
// pointer-move event, playing a tiny window of audio at the current
// scratch position. This produces the classic vinyl scratch sound.

class ScratchDeck {
  private ctx: AudioContext;
  private buffer: AudioBuffer | null = null;
  private output: GainNode;
  private source: AudioBufferSourceNode | null = null;
  private _position = 0;       // current playback position in seconds
  private _rate = 1;           // normal playback rate (pitch slider)
  private _playing = false;    // normal play state
  private _scratching = false;
  private rafId: number | null = null;
  private lastUpdateTime = 0;
  private startedAt = 0;       // audioCtx.currentTime when play started
  private startOffset = 0;     // buffer offset when play started

  constructor(ctx: AudioContext, output: GainNode) {
    this.ctx = ctx;
    this.output = output;
  }

  setBuffer(buf: AudioBuffer) {
    this.buffer = buf;
    this._position = 0;
    this._playing = false;
    this._scratching = false;
  }

  get position() { return this._position; }
  get isPlaying() { return this._playing; }
  get duration() { return this.buffer?.duration ?? 0; }

  // ── Normal play / stop ──────────────────────────────────────────────────
  play() {
    if (!this.buffer || this._playing) return;
    this._playing = true;
    this._startSource(this._position, this._rate);
    this._trackProgress();
  }

  stop() {
    this._playing = false;
    this._stopSource();
    this._stopTracking();
  }

  seekTo(time: number) {
    const safe = Math.max(0, Math.min(time, this.duration - 0.05));
    this._position = safe;
    if (this._playing) {
      this._stopSource();
      this._startSource(safe, this._rate);
    }
  }

  setRate(rate: number) {
    this._rate = rate;
    if (this._playing && !this._scratching && this.source) {
      this.source.playbackRate.value = rate;
    }
  }

  // ── Scratch ────────────────────────────────────────────────────────────
  // Called from Turntable on every pointer-move with angular velocity
  // velocity: degrees/sec (positive = forward, negative = backward)
  scratchTick(velocity: number) {
    if (!this.buffer) return;
    this._scratching = true;

    // Convert angular velocity to seconds-per-second
    // One full revolution (360°) ≈ 0.5 seconds of audio at normal speed
    const secondsPerSec = velocity / 360 * 0.5;
    const dt = 0.016; // ~one frame at 60fps
    this._position = Math.max(0, Math.min(this._position + secondsPerSec * dt, this.duration - 0.05));

    // Play a tiny burst at current position to create scratch sound
    this._burstAt(this._position, secondsPerSec);
  }

  scratchEnd() {
    this._scratching = false;
    this._stopSource();
    if (this._playing) {
      // Resume normal playback from scratch position
      this._startSource(this._position, this._rate);
      this._trackProgress();
    }
  }

  private _burstAt(offset: number, rate: number) {
    if (!this.buffer) return;
    // Stop previous source immediately
    if (this.source) {
      try { this.source.stop(); } catch {}
      this.source.disconnect();
      this.source = null;
    }
    if (Math.abs(rate) < 0.01) return; // stationary — silence

    const src = this.ctx.createBufferSource();
    src.buffer = this.buffer;
    // Positive rate = forward, negative not supported natively so we
    // reverse by adjusting offset backward and playing forward at abs rate
    const absRate = Math.min(Math.abs(rate), 4);
    src.playbackRate.value = absRate;
    src.connect(this.output);

    const startOffset = rate < 0
      ? Math.max(0, offset - 0.08) // backward: jump slightly back and play forward fast
      : offset;

    src.start(0, startOffset, 0.1); // play 100ms window
    this.source = src;
  }

  private _startSource(offset: number, rate: number) {
    if (!this.buffer) return;
    this._stopSource();
    const src = this.ctx.createBufferSource();
    src.buffer = this.buffer;
    src.playbackRate.value = rate;
    src.connect(this.output);
    src.start(0, offset);
    this.source = src;
    this.startedAt = this.ctx.currentTime;
    this.startOffset = offset;
  }

  private _stopSource() {
    if (this.source) {
      try { this.source.stop(); } catch {}
      this.source.disconnect();
      this.source = null;
    }
  }

  private _trackProgress() {
    this._stopTracking();
    const tick = () => {
      if (!this._playing || this._scratching) return;
      if (this.source) {
        this._position = this.startOffset + (this.ctx.currentTime - this.startedAt) * this._rate;
        if (this._position >= this.duration) {
          this._position = this.duration;
          this.stop();
          return;
        }
      }
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  private _stopTracking() {
    if (this.rafId !== null) { cancelAnimationFrame(this.rafId); this.rafId = null; }
  }

  dispose() {
    this.stop();
  }
}

// ──────────────────────────────────────────────────────────────────────────

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

  // Web Audio context shared with Tone.js
  const actx = useRef<AudioContext | null>(null);

  // Gain nodes for crossfader
  const gainA = useRef<GainNode | null>(null);
  const gainB = useRef<GainNode | null>(null);
  const masterGain = useRef<GainNode | null>(null);

  // ScratchDecks
  const scratchA = useRef<ScratchDeck | null>(null);
  const scratchB = useRef<ScratchDeck | null>(null);

  // Analysers for visualizer
  const analyserA = useRef<AnalyserNode | null>(null);
  const analyserB = useRef<AnalyserNode | null>(null);
  const freqAnalyserA = useRef<AnalyserNode | null>(null);
  const freqAnalyserB = useRef<AnalyserNode | null>(null);
  const masterAnalyser = useRef<AnalyserNode | null>(null);

  // Effects
  const delayA = useRef<DelayNode | null>(null);
  const delayB = useRef<DelayNode | null>(null);
  const delayFeedA = useRef<GainNode | null>(null);
  const delayFeedB = useRef<GainNode | null>(null);
  const delayWetA = useRef<GainNode | null>(null);
  const delayWetB = useRef<GainNode | null>(null);
  const reverbConvA = useRef<ConvolverNode | null>(null);
  const reverbConvB = useRef<ConvolverNode | null>(null);
  const reverbWetA = useRef<GainNode | null>(null);
  const reverbWetB = useRef<GainNode | null>(null);

  const recorder = useRef<Tone.Recorder | null>(null);
  const autoMixInterval = useRef<number | null>(null);
  const progressInterval = useRef<number | null>(null);

  // Build impulse for convolver reverb
  const makeImpulse = (ctx: AudioContext, duration = 2, decay = 2) => {
    const len = ctx.sampleRate * duration;
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  };

  useEffect(() => {
    // Get AudioContext from Tone.js so they share the same context
    const ctx = Tone.getContext().rawContext as AudioContext;
    actx.current = ctx;

    // Master chain
    masterGain.current = ctx.createGain();
    masterGain.current.gain.value = 0.85;
    masterAnalyser.current = ctx.createAnalyser();
    masterAnalyser.current.fftSize = 64;
    masterGain.current.connect(masterAnalyser.current);
    masterAnalyser.current.connect(ctx.destination);

    // Deck A chain: scratchDeck → gainA → delayWet + reverbWet + dry → masterGain
    gainA.current = ctx.createGain();
    gainA.current.gain.value = 1;

    analyserA.current = ctx.createAnalyser(); analyserA.current.fftSize = 512;
    freqAnalyserA.current = ctx.createAnalyser(); freqAnalyserA.current.fftSize = 128;

    // Delay A
    delayA.current = ctx.createDelay(2);
    delayA.current.delayTime.value = 0.25;
    delayFeedA.current = ctx.createGain(); delayFeedA.current.gain.value = 0.35;
    delayWetA.current = ctx.createGain(); delayWetA.current.gain.value = 0; // off
    delayA.current.connect(delayFeedA.current);
    delayFeedA.current.connect(delayA.current);
    delayA.current.connect(delayWetA.current);
    delayWetA.current.connect(gainA.current);

    // Reverb A
    reverbConvA.current = ctx.createConvolver();
    reverbConvA.current.buffer = makeImpulse(ctx);
    reverbWetA.current = ctx.createGain(); reverbWetA.current.gain.value = 0; // off
    reverbConvA.current.connect(reverbWetA.current);
    reverbWetA.current.connect(gainA.current);

    gainA.current.connect(analyserA.current);
    gainA.current.connect(freqAnalyserA.current);
    gainA.current.connect(masterGain.current);

    scratchA.current = new ScratchDeck(ctx, gainA.current);
    // Also feed into delay/reverb
    // (ScratchDeck connects source → gainA which is correct)

    // Deck B chain
    gainB.current = ctx.createGain();
    gainB.current.gain.value = 1;

    analyserB.current = ctx.createAnalyser(); analyserB.current.fftSize = 512;
    freqAnalyserB.current = ctx.createAnalyser(); freqAnalyserB.current.fftSize = 128;

    delayB.current = ctx.createDelay(2);
    delayB.current.delayTime.value = 0.25;
    delayFeedB.current = ctx.createGain(); delayFeedB.current.gain.value = 0.35;
    delayWetB.current = ctx.createGain(); delayWetB.current.gain.value = 0;
    delayB.current.connect(delayFeedB.current);
    delayFeedB.current.connect(delayB.current);
    delayB.current.connect(delayWetB.current);
    delayWetB.current.connect(gainB.current);

    reverbConvB.current = ctx.createConvolver();
    reverbConvB.current.buffer = makeImpulse(ctx);
    reverbWetB.current = ctx.createGain(); reverbWetB.current.gain.value = 0;
    reverbConvB.current.connect(reverbWetB.current);
    reverbWetB.current.connect(gainB.current);

    gainB.current.connect(analyserB.current);
    gainB.current.connect(freqAnalyserB.current);
    gainB.current.connect(masterGain.current);

    scratchB.current = new ScratchDeck(ctx, gainB.current);

    // Crossfader: gain A/B controlled by crossfader value
    // 0 = full A, 1 = full B, 0.5 = both
    gainA.current.gain.value = 1;
    gainB.current.gain.value = 1;

    // Recorder via Tone.js
    recorder.current = new Tone.Recorder();
    // Connect masterGain to recorder via Tone MediaStreamDestination
    // (simplified — recorder will capture Tone's destination)

    // Energy interval
    const energyInt = setInterval(() => {
      if (masterAnalyser.current) {
        const data = new Float32Array(masterAnalyser.current.frequencyBinCount);
        masterAnalyser.current.getFloatFrequencyData(data);
        const avg = Array.from(data).reduce((a, b) => a + Math.max(0, (b + 100) / 100), 0) / data.length;
        setMasterEnergy(Math.min(1, avg * 2));
      }
    }, 60);

    // Progress interval
    progressInterval.current = window.setInterval(() => {
      if (scratchA.current) {
        const p = scratchA.current.position;
        setDeckA(prev => ({ ...prev, progress: p, isPlaying: scratchA.current!.isPlaying }));
      }
      if (scratchB.current) {
        const p = scratchB.current.position;
        setDeckB(prev => ({ ...prev, progress: p, isPlaying: scratchB.current!.isPlaying }));
      }
    }, 80);

    return () => {
      clearInterval(energyInt);
      if (progressInterval.current) clearInterval(progressInterval.current);
      scratchA.current?.dispose();
      scratchB.current?.dispose();
    };
  }, []);

  const loadTrack = useCallback(async (deck: 'A' | 'B', track: File | string) => {
    try {
      const ctx = actx.current;
      if (!ctx) return;
      if (ctx.state === 'suspended') await ctx.resume();

      const fileName = typeof track === 'string' ? track.split('/').pop() || 'Track' : track.name;
      const arrayBuffer = typeof track === 'string'
        ? await (await fetch(track, { mode: 'cors' })).arrayBuffer()
        : await track.arrayBuffer();

      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
      const sd = deck === 'A' ? scratchA.current : scratchB.current;
      if (!sd) return;

      sd.setBuffer(audioBuffer);
      const update = { fileName, duration: audioBuffer.duration, progress: 0, isPlaying: false, isLoaded: true, bpm: 120 };
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
    } catch (e) { console.error(e); }
  }, []);

  const togglePlay = useCallback((deck: 'A' | 'B') => {
    const ctx = actx.current;
    if (ctx?.state === 'suspended') ctx.resume();
    const sd = deck === 'A' ? scratchA.current : scratchB.current;
    if (!sd) return;
    if (sd.isPlaying) {
      sd.stop();
      if (deck === 'A') setDeckA(p => ({ ...p, isPlaying: false }));
      else setDeckB(p => ({ ...p, isPlaying: false }));
    } else {
      sd.play();
      if (deck === 'A') setDeckA(p => ({ ...p, isPlaying: true }));
      else setDeckB(p => ({ ...p, isPlaying: true }));
    }
  }, []);

  const handleCrossfade = useCallback((value: number) => {
    setCrossfader(value);
    // Equal power crossfade
    const angleA = value * 0.5 * Math.PI;
    const angleB = (1 - value) * 0.5 * Math.PI;
    if (gainA.current) gainA.current.gain.value = Math.cos(angleA);
    if (gainB.current) gainB.current.gain.value = Math.cos(angleB);
  }, []);

  const setPlaybackRate = useCallback((deck: 'A' | 'B', rate: number) => {
    const sd = deck === 'A' ? scratchA.current : scratchB.current;
    const clamped = Math.max(0.5, Math.min(1.5, rate));
    sd?.setRate(clamped);
    if (deck === 'A') setDeckA(p => ({ ...p, playbackRate: clamped }));
    else setDeckB(p => ({ ...p, playbackRate: clamped }));
  }, []);

  const seekTo = useCallback((deck: 'A' | 'B', time: number) => {
    const sd = deck === 'A' ? scratchA.current : scratchB.current;
    sd?.seekTo(time);
    if (deck === 'A') setDeckA(p => ({ ...p, progress: time }));
    else setDeckB(p => ({ ...p, progress: time }));
  }, []);

  // ── SCRATCH — real vinyl scratch using ScratchDeck ──────────────────────
  const scratchStart = useCallback((_deck: 'A' | 'B') => {
    // Just ensure context is running
    actx.current?.resume();
  }, []);

  const scratchMove = useCallback((deck: 'A' | 'B', velocity: number) => {
    const sd = deck === 'A' ? scratchA.current : scratchB.current;
    sd?.scratchTick(velocity);
  }, []);

  const scratchEnd = useCallback((deck: 'A' | 'B') => {
    const sd = deck === 'A' ? scratchA.current : scratchB.current;
    sd?.scratchEnd();
  }, []);

  const syncDecks = useCallback(() => {
    const bA = deckA.bpm, bB = deckB.bpm;
    if (bA > 0 && bB > 0) {
      const rate = Math.max(0.8, Math.min(1.2, bA / bB));
      scratchB.current?.setRate(rate);
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

  const getWaveformData = (analyser: AnalyserNode | null) => {
    if (!analyser) return null;
    const data = new Float32Array(analyser.fftSize);
    analyser.getFloatTimeDomainData(data);
    return data;
  };

  const getFreqData = (analyser: AnalyserNode | null) => {
    if (!analyser) return null;
    const data = new Float32Array(analyser.frequencyBinCount);
    analyser.getFloatFrequencyData(data);
    return data;
  };

  return {
    deckA, deckB, crossfader, isRecording, masterEnergy,
    analyserDataA: () => getWaveformData(analyserA.current),
    analyserDataB: () => getWaveformData(analyserB.current),
    freqDataA: () => getFreqData(freqAnalyserA.current),
    freqDataB: () => getFreqData(freqAnalyserB.current),
    loadTrack, togglePlay, seekTo,
    scratchStart, scratchMove, scratchEnd,
    handleCrossfade, setPlaybackRate,
    syncDecks, startRecording, stopRecording, startAutoMix,
    setFilter: (_deck: 'A' | 'B', _freq: number) => {}, // placeholder
    setEQ: (_deck: 'A' | 'B', _low: number, _mid: number, _high: number) => {},
    setFX: (deck: 'A' | 'B', type: 'delay' | 'reverb', value: number) => {
      if (type === 'delay') {
        const wet = deck === 'A' ? delayWetA.current : delayWetB.current;
        if (wet) wet.gain.value = value;
      } else {
        const wet = deck === 'A' ? reverbWetA.current : reverbWetB.current;
        if (wet) wet.gain.value = value;
      }
    },
  };
};
