import React, { useRef, useState, useEffect } from 'react';
import { motion, useMotionValue } from 'motion/react';

interface TurntableProps {
  isPlaying: boolean;
  progress: number;
  duration: number;
  playbackRate: number;
  onTogglePlay: () => void;
  onScratch: (timeOffset: number) => void;
}

export const Turntable: React.FC<TurntableProps> = ({
  isPlaying, progress, duration, playbackRate, onTogglePlay, onScratch,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isScratching, setIsScratching] = useState(false);
  const [scratchGlow, setScratchGlow] = useState(false);
  const rotation = useMotionValue(0);
  const lastAngle = useRef<number | null>(null);
  const autoRotation = useRef(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const tick = () => {
      if (isPlaying && !isScratching) {
        autoRotation.current += (360 / 60) * (playbackRate * 0.5);
        rotation.set(autoRotation.current);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [isPlaying, isScratching, playbackRate, rotation]);

  const getAngle = (x: number, y: number): number => {
    if (!containerRef.current) return 0;
    const rect = containerRef.current.getBoundingClientRect();
    return Math.atan2(y - (rect.top + rect.height / 2), x - (rect.left + rect.width / 2)) * (180 / Math.PI);
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsScratching(true);
    setScratchGlow(true);
    lastAngle.current = getAngle(e.clientX, e.clientY);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isScratching || lastAngle.current === null) return;
    const angle = getAngle(e.clientX, e.clientY);
    let delta = angle - lastAngle.current;
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;
    autoRotation.current += delta;
    rotation.set(autoRotation.current);
    onScratch((delta / 360) * 0.3);
    lastAngle.current = angle;
  };

  const handlePointerUp = () => {
    setIsScratching(false);
    setScratchGlow(false);
    lastAngle.current = null;
  };

  const progressAngle = duration > 0 ? (progress / duration) * 360 : 0;
  const r = 54;
  const circ = 2 * Math.PI * r;
  const dash = (progressAngle / 360) * circ;

  return (
    <div className="relative flex items-center justify-center select-none">
      {/* Base */}
      <div className="relative w-36 h-36 rounded-full"
        style={{
          background: 'radial-gradient(circle at 35% 35%, #2a2a3a, #0a0a0f)',
          boxShadow: '0 0 0 3px #1a1a2a, 0 0 0 5px #0a0a12, 0 8px 32px rgba(0,0,0,0.9), inset 0 1px 0 rgba(255,255,255,0.05)',
        }}
      >
        {/* Progress ring */}
        <svg className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r={r} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="2" />
          <circle cx="60" cy="60" r={r} fill="none" stroke="rgba(99,102,241,0.6)" strokeWidth="2"
            strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" />
        </svg>

        {/* Scratch glow */}
        {scratchGlow && (
          <div className="absolute inset-0 rounded-full pointer-events-none"
            style={{ boxShadow: '0 0 24px rgba(239,68,68,0.6), inset 0 0 20px rgba(239,68,68,0.1)' }} />
        )}

        {/* Vinyl disc */}
        <motion.div
          ref={containerRef}
          className="absolute inset-2 rounded-full cursor-grab active:cursor-grabbing touch-none"
          style={{
            rotate: rotation,
            background: 'radial-gradient(circle at 40% 35%, #1c1c1c, #050505)',
            boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.9)',
          }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onClick={() => { if (!isScratching) onTogglePlay(); }}
        >
          {/* Vinyl grooves */}
          {[8,13,18,23,28,33,37,41,44,47].map((inset, i) => (
            <div key={i} className="absolute rounded-full border"
              style={{ inset: `${inset}%`, borderColor: `rgba(255,255,255,${0.025 + i * 0.007})`, borderWidth: '0.5px' }} />
          ))}

          {/* Sheen */}
          <div className="absolute inset-0 rounded-full pointer-events-none"
            style={{ background: 'conic-gradient(from 0deg, transparent 0%, rgba(255,255,255,0.04) 15%, transparent 30%, rgba(255,255,255,0.02) 50%, transparent 65%, rgba(255,255,255,0.05) 80%, transparent 100%)' }} />

          {/* Center label */}
          <div className="absolute inset-[30%] rounded-full flex items-center justify-center"
            style={{ background: 'radial-gradient(circle at 40% 40%, #312e81, #1e1b4b)', boxShadow: '0 0 12px rgba(99,102,241,0.5)' }}>
            <div className="absolute inset-[15%] rounded-full border border-indigo-400/20" />
            <div className="absolute inset-[35%] rounded-full border border-indigo-400/10" />
            <div className="w-2 h-2 rounded-full bg-black border border-indigo-500/50" />
          </div>

          {/* Beat marker */}
          <div className="absolute top-[8%] left-1/2 -translate-x-1/2 w-0.5 h-[10%] rounded-full"
            style={{ background: 'linear-gradient(to bottom, rgba(239,68,68,0.9), transparent)', boxShadow: '0 0 4px rgba(239,68,68,0.7)' }} />
        </motion.div>

        {/* Tonearm */}
        <div className="absolute pointer-events-none z-20"
          style={{ top: '-2%', right: '-8%', width: '28%', height: '70%', transformOrigin: '80% 8%', transform: `rotate(${isPlaying ? 18 : 10}deg)`, transition: 'transform 0.6s ease' }}>
          <div className="absolute top-0 right-0 w-3 h-3 rounded-full"
            style={{ background: 'radial-gradient(circle, #999, #444)', boxShadow: '0 0 4px rgba(0,0,0,0.8)' }} />
          <div className="absolute" style={{ top: '8%', right: '28%', width: '14%', height: '78%', background: 'linear-gradient(to bottom, #bbb, #888, #666)', borderRadius: '2px', boxShadow: '1px 1px 4px rgba(0,0,0,0.6)', transform: 'rotate(-4deg)' }} />
          <div className="absolute bottom-0 right-[20%] w-[22%] h-[16%] rounded-sm"
            style={{ background: 'linear-gradient(135deg, #888, #555)', boxShadow: '1px 1px 3px rgba(0,0,0,0.6)' }} />
          <div className="absolute bottom-[-3%] right-[24%] w-[10%] h-[8%] rounded-full"
            style={{ background: '#c0392b', boxShadow: '0 0 4px rgba(192,57,43,0.9)' }} />
        </div>
      </div>

      {/* Scratch indicator */}
      {isScratching && (
        <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 flex items-center gap-1">
          <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
          <span className="text-[6px] text-red-400 font-black uppercase tracking-widest">Scratch</span>
        </div>
      )}
    </div>
  );
};
