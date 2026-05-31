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
  dropTime: number;
  loopActive: boolean;
  loopStart: number;
  loopEnd: number;
}

async function detectDrop(audioBuffer: AudioBuffer): Promise<number> {
  try {
    const data = audioBuffer.getChannelData(0);
    const sr = audioBuffer.sampleRate;
    const windowSize = sr * 2;
    const duration = audioBuffer.duration;
    const startSample = Math.floor(sr * duration * 0.30);
    const endSample = Math.floor(sr * duration * 0.80);
    let maxEnergy = 0;
    let dropSample = Math.floor(sr * duration * 0.50);
    for (let i = startSample; i < endSample - windowSize; i += windowSize / 2) {
      let energy = 0;
      for (let j = 0; j < windowSize; j++) energy += data[i + j] * data[i + j];
      if (energy > maxEnergy) { maxEnergy = energy; dropSample = i; }
    }
    return dropSample / sr;
  } catch { return 0; }
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
    filter.type = 'lowpass'; filter.frequency.value = 150;
    source.connect(filter); filter.connect(offlineCtx.destination); source.start(0);
    const rendered = await offlineCtx.startRendering();
    const d = rendered.getChannelData(0);
    const ws = Math.floor(sampleRate * 0.02);
    const energies: number[] = [];
    for (let i = 0; i < d.length - ws; i += ws) {
      let e = 0;
      for (let j = 0; j < ws; j++) e += d[i + j] * d[i + j];
      energies.push(e / ws);
    }
    const avg = energies.reduce((a, b) => a + b, 0) / energies.length;
    const threshold = avg * 1.5;
    const peaks: number[] = [];
    let lastPeak = -10;
    for (let i = 1; i < energies.length - 1; i++) {
      if (energies[i] > threshold && energies[i] > energies[i-1] && energies[i] > energies[i+1] && i - lastPeak > 10) {
        peaks.push(i * ws / sampleRate); lastPeak = i;
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

class ScratchDeck {
  private ctx: AudioContext;
  private buffer: AudioBuffer | null = null;
  readonly inputNode: GainNode;
  private source: AudioBufferSourceNode | null = null;
  private _position = 0;
  private _rate = 1;
  private _playing = false;
  private _scratching = false;
  private _loopActive = false;
  private _loopStart = 0;
  private _loopEnd = 0;
  private rafId: number | null = null;
  private startedAt = 0;
  private startOffset = 0;

  constructor(ctx: AudioContext) {
    this.ctx = ctx;
    this.inputNode = ctx.createGain();
    this.inputNode.gain.value = 1;
  }

  setBuffer(buf: AudioBuffer) {
    this.stop();
    this.buffer = buf;
    this._position = 0;
    this._playing = false;
    this._scratching = false;
    this._loopActive = false;
  }

  get position() { return this._position; }
  get isPlaying() { return this._playing; }
  get duration() { return this.buffer?.duration ?? 0; }

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
    if (this._playing && !this._scratching && this.source)
      this.source.playbackRate.value = rate;
  }

  setLoop(active: boolean, start?: number, end?: number) {
    this._loopActive = active;
    if (start !== undefined) this._loopStart = start;
    if (end !== undefined) this._loopEnd = end;
    if (this._playing && !this._scratching) {
      this._stopSource();
      this._startSource(active ? this._loopStart : this._position, this._rate);
      if (!active) this._trackProgress();
    }
  }

  scratchTick(velocity: number) {
    if (!this.buffer) return;
    this._scratching = true;
    const secondsPerSec = velocity / 360 * 0.5;
    const dt = 0.016;
    this._position = Math.max(0, Math.min(this._position + secondsPerSec * dt, this.duration - 0.05));
    this._burstAt(this._position, secondsPerSec);
  }

  scratchEnd() {
    this._scratching = false;
    this._stopSource();
    if (this._playing) {
      this._startSource(this._position, this._rate);
      if (!this._loopActive) this._trackProgress();
    }
  }

  private _burstAt(offset: number, rate: number) {
    if (!this.buffer) return;
    if (this.source) { try { this.source.stop(); } catch {} this.source.disconnect(); this.source = null; }
    if (Math.abs(rate) < 0.01) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.buffer;
    src.playbackRate.value = Math.min(Math.abs(rate), 4);
    src.connect(this.inputNode);
    src.start(0, rate < 0 ? Math.max(0, offset - 0.08) : offset, 0.1);
    this.source = src;
  }

  private _startSource(offset: number, rate: number) {
    if (!this.buffer) return;
    this._stopSource();
    const src = this.ctx.createBufferSource();
    src.buffer = this.buffer;
    src.playbackRate.value = rate;
    if (this._loopActive && this._loopEnd > this._loopStart) {
      src.loop = true;
      src.loopStart = this._loopStart;
      src.loopEnd = this._loopEnd;
    }
    src.connect(this.inputNode);
    src.start(0, offset);
    this.source = src;
    this.startedAt = this.ctx.currentTime;
    this.startOffset = offset;
  }

  private _stopSource() {
    if (this.source) { try { this.source.stop(); } catch {} this.source.disconnect(); this.source = null; }
  }

  private _trackProgress() {
    this._stopTracking();
    const tick = () => {
      if (!this._playing || this._scratching) return;
      if (this.source) {
        let pos = this.startOffset + (this.ctx.currentTime - this.startedAt) * this._rate;
        if (this._loopActive && this._loopEnd > this._loopStart) {
          const loopLen = this._loopEnd - this._loopStart;
          if (pos >= this._loopEnd) pos = this._loopStart + ((pos - this._loopStart) % loopLen);
        }
        this._position = pos;
        if (!this._loopActive && pos >= this.duration) { this._position = this.duration; this.stop(); return; }
      }
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  private _stopTracking() {
    if (this.rafId !== null) { cancelAnimationFrame(this.rafId); this.rafId = null; }
  }

  dispose() { this.stop(); }
}

function makeImpulse(ctx: AudioContext, duration = 2.5, decay = 2) {
  const len = ctx.sampleRate * duration;
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
  }
  return buf;
}

function makeEQ(ctx: AudioContext) {
  const low = ctx.createBiquadFilter();
  low.type = 'lowshelf'; low.frequency.value = 320; low.gain.value = 0;
  const mid = ctx.createBiquadFilter();
  mid.type = 'peaking'; mid.frequency.value = 1000; mid.Q.value = 1; mid.gain.value = 0;
  const high = ctx.createBiquadFilter();
  high.type = 'highshelf'; high.frequency.value = 3200; high.gain.value = 0;
  low.connect(mid); mid.connect(high);
  return { low, mid, high, input: low, output: high };
}

export const useDJEngine = () => {
  const defaultDeck = (key: string): DeckState => ({
    isPlaying: false, bpm: 120, volume: 0, progress: 0, duration: 0,
    fileName: 'No Track Loaded', isSyncing: false, playbackRate: 1, isLoaded: false,
    key, energy: 0, dropTime: 0, loopActive: false, loopStart: 0, loopEnd: 0,
  });

  const [deckA, setDeckA] = useState<DeckState>(defaultDeck('1A'));
  const [deckB, setDeckB] = useState<DeckState>(defaultDeck('2A'));
  const [crossfader, setCrossfader] = useState(0.5);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [masterEnergy, setMasterEnergy] = useState(0);

  const actx = useRef<AudioContext | null>(null);
  const scratchA = useRef<ScratchDeck | null>(null);
  const scratchB = useRef<ScratchDeck | null>(null);
  const audioBufferA = useRef<AudioBuffer | null>(null);
  const audioBufferB = useRef<AudioBuffer | null>(null);
  const gainA = useRef<GainNode | null>(null);
  const gainB = useRef<GainNode | null>(null);
  const channelGainA = useRef<GainNode | null>(null);
  const channelGainB = useRef<GainNode | null>(null);
  const masterGain = useRef<GainNode | null>(null);
  const analyserA = useRef<AnalyserNode | null>(null);
  const analyserB = useRef<AnalyserNode | null>(null);
  const freqAnalyserA = useRef<AnalyserNode | null>(null);
  const freqAnalyserB = useRef<AnalyserNode | null>(null);
  const masterAnalyser = useRef<AnalyserNode | null>(null);
  const delayWetA = useRef<GainNode | null>(null);
  const delayWetB = useRef<GainNode | null>(null);
  const reverbWetA = useRef<GainNode | null>(null);
  const reverbWetB = useRef<GainNode | null>(null);
  const eqALow = useRef<BiquadFilterNode | null>(null);
  const eqAMid = useRef<BiquadFilterNode | null>(null);
  const eqAHigh = useRef<BiquadFilterNode | null>(null);
  const eqBLow = useRef<BiquadFilterNode | null>(null);
  const eqBMid = useRef<BiquadFilterNode | null>(null);
  const eqBHigh = useRef<BiquadFilterNode | null>(null);

  // Real recording — MediaRecorder + MediaStreamDestinationNode
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const recordedChunks = useRef<Blob[]>([]);
  const recordingTimer = useRef<number | null>(null);
  const streamDest = useRef<MediaStreamAudioDestinationNode | null>(null);

  const autoMixInterval = useRef<number | null>(null);
  const progressInterval = useRef<number | null>(null);

  useEffect(() => {
    const ctx = Tone.getContext().rawContext as AudioContext;
    actx.current = ctx;

    // Master chain
    masterGain.current = ctx.createGain(); masterGain.current.gain.value = 0.85;
    masterAnalyser.current = ctx.createAnalyser(); masterAnalyser.current.fftSize = 64;
    masterGain.current.connect(masterAnalyser.current);
    masterAnalyser.current.connect(ctx.destination);

    // MediaStreamDestinationNode — captures the master output for recording
    streamDest.current = ctx.createMediaStreamDestination();
    masterGain.current.connect(streamDest.current);

    // Deck A
    scratchA.current = new ScratchDeck(ctx);
    gainA.current = ctx.createGain(); gainA.current.gain.value = 1;
    channelGainA.current = ctx.createGain(); channelGainA.current.gain.value = 1;
    analyserA.current = ctx.createAnalyser(); analyserA.current.fftSize = 512;
    freqAnalyserA.current = ctx.createAnalyser(); freqAnalyserA.current.fftSize = 128;
    const eqA = makeEQ(ctx);
    eqALow.current = eqA.low; eqAMid.current = eqA.mid; eqAHigh.current = eqA.high;
    scratchA.current.inputNode.connect(eqA.input); eqA.output.connect(gainA.current);
    const delayNodeA = ctx.createDelay(2); delayNodeA.delayTime.value = 0.3;
    const delayFeedA = ctx.createGain(); delayFeedA.gain.value = 0.4;
    delayWetA.current = ctx.createGain(); delayWetA.current.gain.value = 0;
    scratchA.current.inputNode.connect(delayNodeA);
    delayNodeA.connect(delayFeedA); delayFeedA.connect(delayNodeA);
    delayNodeA.connect(delayWetA.current); delayWetA.current.connect(gainA.current);
    const convA = ctx.createConvolver(); convA.buffer = makeImpulse(ctx);
    reverbWetA.current = ctx.createGain(); reverbWetA.current.gain.value = 0;
    scratchA.current.inputNode.connect(convA); convA.connect(reverbWetA.current); reverbWetA.current.connect(gainA.current);
    gainA.current.connect(channelGainA.current);
    channelGainA.current.connect(analyserA.current);
    channelGainA.current.connect(freqAnalyserA.current);
    channelGainA.current.connect(masterGain.current);

    // Deck B
    scratchB.current = new ScratchDeck(ctx);
    gainB.current = ctx.createGain(); gainB.current.gain.value = 1;
    channelGainB.current = ctx.createGain(); channelGainB.current.gain.value = 1;
    analyserB.current = ctx.createAnalyser(); analyserB.current.fftSize = 512;
    freqAnalyserB.current = ctx.createAnalyser(); freqAnalyserB.current.fftSize = 128;
    const eqB = makeEQ(ctx);
    eqBLow.current = eqB.low; eqBMid.current = eqB.mid; eqBHigh.current = eqB.high;
    scratchB.current.inputNode.connect(eqB.input); eqB.output.connect(gainB.current);
    const delayNodeB = ctx.createDelay(2); delayNodeB.delayTime.value = 0.3;
    const delayFeedB = ctx.createGain(); delayFeedB.gain.value = 0.4;
    delayWetB.current = ctx.createGain(); delayWetB.current.gain.value = 0;
    scratchB.current.inputNode.connect(delayNodeB);
    delayNodeB.connect(delayFeedB); delayFeedB.connect(delayNodeB);
    delayNodeB.connect(delayWetB.current); delayWetB.current.connect(gainB.current);
    const convB = ctx.createConvolver(); convB.buffer = makeImpulse(ctx);
    reverbWetB.current = ctx.createGain(); reverbWetB.current.gain.value = 0;
    scratchB.current.inputNode.connect(convB); convB.connect(reverbWetB.current); reverbWetB.current.connect(gainB.current);
    gainB.current.connect(channelGainB.current);
    channelGainB.current.connect(analyserB.current);
    channelGainB.current.connect(freqAnalyserB.current);
    channelGainB.current.connect(masterGain.current);

    // Energy
    const energyInt = setInterval(() => {
      if (masterAnalyser.current) {
        const data = new Float32Array(masterAnalyser.current.frequencyBinCount);
        masterAnalyser.current.getFloatFrequencyData(data);
        const avg = Array.from(data).reduce((a, b) => a + Math.max(0, (b + 100) / 100), 0) / data.length;
        setMasterEnergy(Math.min(1, avg * 2));
      }
    }, 60);

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
      if (recordingTimer.current) clearInterval(recordingTimer.current);
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
      if (deck === 'A') audioBufferA.current = audioBuffer;
      else audioBufferB.current = audioBuffer;
      sd.setBuffer(audioBuffer);
      const update: Partial<DeckState> = {
        fileName, duration: audioBuffer.duration, progress: 0,
        isPlaying: false, isLoaded: true, bpm: 120,
        dropTime: audioBuffer.duration * 0.5,
        loopActive: false, loopStart: 0, loopEnd: 0,
      };
      if (deck === 'A') setDeckA(prev => ({ ...prev, ...update }));
      else setDeckB(prev => ({ ...prev, ...update }));
      Promise.all([detectBPM(audioBuffer), detectDrop(audioBuffer)]).then(([bpm, dropTime]) => {
        if (deck === 'A') setDeckA(prev => ({ ...prev, bpm, dropTime }));
        else setDeckB(prev => ({ ...prev, bpm, dropTime }));
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

  const setLoop = useCallback((deck: 'A' | 'B', active: boolean, loopLength?: number) => {
    const sd = deck === 'A' ? scratchA.current : scratchB.current;
    const deckState = deck === 'A' ? deckA : deckB;
    if (!sd) return;
    if (!active) {
      sd.setLoop(false);
      if (deck === 'A') setDeckA(p => ({ ...p, loopActive: false }));
      else setDeckB(p => ({ ...p, loopActive: false }));
      return;
    }
    const beatLen = deckState.bpm > 0 ? 60 / deckState.bpm : 0.5;
    const len = loopLength ?? beatLen * 4;
    const start = deckState.progress;
    const end = Math.min(start + len, deckState.duration - 0.01);
    sd.setLoop(true, start, end);
    if (deck === 'A') setDeckA(p => ({ ...p, loopActive: true, loopStart: start, loopEnd: end }));
    else setDeckB(p => ({ ...p, loopActive: true, loopStart: start, loopEnd: end }));
  }, [deckA, deckB]);

  const scratchStart = useCallback((_deck: 'A' | 'B') => { actx.current?.resume(); }, []);
  const scratchMove = useCallback((deck: 'A' | 'B', velocity: number) => {
    (deck === 'A' ? scratchA.current : scratchB.current)?.scratchTick(velocity);
  }, []);
  const scratchEnd = useCallback((deck: 'A' | 'B') => {
    (deck === 'A' ? scratchA.current : scratchB.current)?.scratchEnd();
  }, []);

  const syncDecks = useCallback(() => {
    if (deckA.bpm > 0 && deckB.bpm > 0) {
      const rate = Math.max(0.8, Math.min(1.2, deckA.bpm / deckB.bpm));
      scratchB.current?.setRate(rate);
      setDeckB(p => ({ ...p, playbackRate: rate }));
    }
  }, [deckA.bpm, deckB.bpm]);

  // ── REAL RECORDING using MediaRecorder + MediaStreamDestinationNode ────────
  const startRecording = useCallback(async () => {
    const ctx = actx.current;
    if (!ctx || !streamDest.current) return;
    if (ctx.state === 'suspended') await ctx.resume();

    recordedChunks.current = [];

    // Pick best supported format
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : MediaRecorder.isTypeSupported('audio/webm')
      ? 'audio/webm'
      : 'audio/ogg';

    const mr = new MediaRecorder(streamDest.current.stream, { mimeType });
    mr.ondataavailable = (e) => { if (e.data.size > 0) recordedChunks.current.push(e.data); };
    mr.start(100); // collect chunks every 100ms
    mediaRecorder.current = mr;
    setIsRecording(true);
    setRecordingTime(0);

    // Timer
    if (recordingTimer.current) clearInterval(recordingTimer.current);
    recordingTimer.current = window.setInterval(() => {
      setRecordingTime(t => t + 1);
    }, 1000);
  }, []);

  const stopRecording = useCallback(async () => {
    if (!mediaRecorder.current) return;
    if (recordingTimer.current) { clearInterval(recordingTimer.current); recordingTimer.current = null; }

    mediaRecorder.current.stop();
    setIsRecording(false);
    setRecordingTime(0);

    // Wait for final chunk then download
    mediaRecorder.current.onstop = () => {
      const blob = new Blob(recordedChunks.current, { type: mediaRecorder.current?.mimeType || 'audio/webm' });
      const ext = blob.type.includes('ogg') ? 'ogg' : 'webm';
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.download = `VirtualDeck-Mix-${new Date().toISOString().slice(0,19).replace(/:/g,'-')}.${ext}`;
      a.href = url;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    };
    mediaRecorder.current = null;
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

  const rampEQ = (node: BiquadFilterNode | null, target: number, durationMs: number) => {
    if (!node || !actx.current) return;
    const ctx = actx.current;
    node.gain.setValueAtTime(node.gain.value, ctx.currentTime);
    node.gain.linearRampToValueAtTime(target, ctx.currentTime + durationMs / 1000);
  };

  return {
    deckA, deckB, crossfader, isRecording, recordingTime, masterEnergy,
    audioBufferA: audioBufferA.current,
    audioBufferB: audioBufferB.current,
    analyserDataA: () => { if (!analyserA.current) return null; const d = new Float32Array(analyserA.current.fftSize); analyserA.current.getFloatTimeDomainData(d); return d; },
    analyserDataB: () => { if (!analyserB.current) return null; const d = new Float32Array(analyserB.current.fftSize); analyserB.current.getFloatTimeDomainData(d); return d; },
    freqDataA: () => { if (!freqAnalyserA.current) return null; const d = new Float32Array(freqAnalyserA.current.frequencyBinCount); freqAnalyserA.current.getFloatFrequencyData(d); return d; },
    freqDataB: () => { if (!freqAnalyserB.current) return null; const d = new Float32Array(freqAnalyserB.current.frequencyBinCount); freqAnalyserB.current.getFloatFrequencyData(d); return d; },
    loadTrack, togglePlay, seekTo, setLoop,
    scratchStart, scratchMove, scratchEnd,
    handleCrossfade, setPlaybackRate,
    syncDecks, startRecording, stopRecording, startAutoMix,
    setFilter: (_deck: 'A' | 'B', _freq: number) => {},
    setEQ: (deck: 'A' | 'B', low: number, mid: number, high: number) => {
      const l = deck === 'A' ? eqALow.current : eqBLow.current;
      const m = deck === 'A' ? eqAMid.current : eqBMid.current;
      const h = deck === 'A' ? eqAHigh.current : eqBHigh.current;
      if (l) l.gain.value = low;
      if (m) m.gain.value = mid;
      if (h) h.gain.value = high;
    },
    setFX: (deck: 'A' | 'B', type: 'delay' | 'reverb', value: number) => {
      const wet = type === 'delay'
        ? (deck === 'A' ? delayWetA.current : delayWetB.current)
        : (deck === 'A' ? reverbWetA.current : reverbWetB.current);
      if (wet) wet.gain.value = value;
    },
    setChannelVolume: (deck: 'A' | 'B', vol: number) => {
      const g = deck === 'A' ? channelGainA.current : channelGainB.current;
      if (g) g.gain.value = Math.max(0, Math.min(1.5, vol));
    },
    magicEQRamp: (deck: 'A' | 'B', low: number, mid: number, high: number, durationMs: number) => {
      rampEQ(deck === 'A' ? eqALow.current : eqBLow.current, low, durationMs);
      rampEQ(deck === 'A' ? eqAMid.current : eqBMid.current, mid, durationMs);
      rampEQ(deck === 'A' ? eqAHigh.current : eqBHigh.current, high, durationMs);
    },

    // ── FX PAD ─────────────────────────────────────────────────────────────
    // Brake: gradually slow down then stop over 2s
    brake: (deck: 'A' | 'B') => {
      const sd = deck === 'A' ? scratchA.current : scratchB.current;
      if (!sd || !sd.isPlaying) return;
      const steps = 40;
      let i = 0;
      const interval = window.setInterval(() => {
        i++;
        const rate = Math.max(0.001, 1 - (i / steps));
        sd.setRate(rate);
        if (i >= steps) {
          clearInterval(interval);
          sd.stop();
          sd.setRate(1);
          if (deck === 'A') setDeckA(p => ({ ...p, isPlaying: false, playbackRate: 1 }));
          else setDeckB(p => ({ ...p, isPlaying: false, playbackRate: 1 }));
        }
      }, 50);
    },

    // Backspin: reverse rapidly then restart from current position
    backspin: (deck: 'A' | 'B') => {
      const sd = deck === 'A' ? scratchA.current : scratchB.current;
      if (!sd) return;
      const wasPlaying = sd.isPlaying;
      const pos = sd.position;
      // Spin back 2 seconds rapidly
      const target = Math.max(0, pos - 2);
      sd.seekTo(target);
      if (wasPlaying) sd.play();
    },

    // Filter Sweep: open/close hi-pass filter while held
    filterSweep: (deck: 'A' | 'B', active: boolean) => {
      const ctx = actx.current;
      const low = deck === 'A' ? eqALow.current : eqBLow.current;
      if (!low || !ctx) return;
      if (active) {
        // Kill bass (sweep up)
        low.gain.setValueAtTime(low.gain.value, ctx.currentTime);
        low.gain.linearRampToValueAtTime(-15, ctx.currentTime + 0.3);
      } else {
        // Restore bass
        low.gain.setValueAtTime(low.gain.value, ctx.currentTime);
        low.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.5);
      }
    },

    // Flanger: pitch modulation while held
    flanger: (deck: 'A' | 'B', active: boolean) => {
      const sd = deck === 'A' ? scratchA.current : scratchB.current;
      if (!sd) return;
      if (active) {
        // Wobble rate for flanger feel
        let t = 0;
        const flangerInterval = window.setInterval(() => {
          t += 0.1;
          const wobble = 1 + Math.sin(t * 8) * 0.015;
          sd.setRate(wobble);
        }, 16);
        (sd as any)._flangerInterval = flangerInterval;
      } else {
        if ((sd as any)._flangerInterval) {
          clearInterval((sd as any)._flangerInterval);
          (sd as any)._flangerInterval = null;
        }
        sd.setRate(deck === 'A' ? deckA.playbackRate : deckB.playbackRate);
      }
    },
  };
};
