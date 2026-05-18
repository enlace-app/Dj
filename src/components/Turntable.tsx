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
  isPlaying, progress, duration, playbackRate, onTogglePlay, onScratch
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isScratching, setIsScratching] = useState(false);
  const rotation = useMotionValue(0);
  const autoRotation = useRef(0);
  const lastAngle = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  // Auto-rotate vinyl
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
  }, [isPlaying, isScratching, playbackRate]);

  // Needle angle based on progress
  const needleAngle = duration > 0 ? (progress / duration) * 180 - 90 : -90;

  const getAngle = (x: number, y: number): number => {
    if (!containerRef.current) return 0;
    const rect = containerRef.current.getBoundingClientRect();
    return Math.atan2(y - (rect.top + rect.height / 2), x - (rect.left + rect.width / 2)) * (180 / Math.PI);
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsScratching(true);
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
    
    // Lightweight scratch: smaller time offset
    onScratch((delta / 360) * 0.15);
    lastAngle.current = angle;
  };

  const handlePointerUp = () => {
    setIsScratching(false);
    lastAngle.current = null;
  };

  return (
    <div className="relative flex items-center justify-center select-none">
      {/* Outer plinth */}
      <div className="relative w-36 h-36 rounded-full"
        style={{
          background: 'radial-gradient(circle at 35% 35%, #2a2a3a, #0a0a0f)',
          boxShadow: '0 0 0 3px #1a1a2a, 0 0 0 5px #0a0a12, 0 8px 32px rgba(0,0,0,0.9), inset 0 1px 0 rgba(255,255,255,0.05)',
        }}
      >
        {/* Vinyl disc — rotates */}
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

        {/* Moving needle arm — sigue el progreso */}
        <div className="absolute pointer-events-none z-20"
          style={{
            top: '50%',
            left: '50%',
            width: '50%',
            height: '2px',
            transformOrigin: '0% 50%',
            transform: `translate(-50%, -50%) rotate(${needleAngle}deg)`,
            transition: isScratching ? 'none' : 'transform 0.1s linear',
          }}>
          {/* Needle rod */}
          <div className="w-full h-full bg-gradient-to-r from-slate-400 to-slate-300 rounded-full"
            style={{ boxShadow: '0 0 4px rgba(148,163,184,0.6)' }} />
          {/* Needle head */}
          <div className="absolute right-0 -top-1.5 w-4 h-4 rounded-full bg-slate-500 border border-white/30"
            style={{ boxShadow: '0 0 6px rgba(100,116,139,0.8)' }} />
        </div>

        {/* Tonearm pivot */}
        <div className="absolute pointer-events-none z-20 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full"
          style={{ background: 'radial-gradient(circle, #666, #333)', boxShadow: '0 0 4px rgba(0,0,0,0.8)' }} />
      </div>

      {/* Scratch indicator */}
      {isScratching && (
        <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 flex items-center gap-1">
          <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
          <span className="text-[6px] text-red-400 font-black uppercase tracking-widest">Scratch</span>
        </div>
      )}
    </div>
  );
};
