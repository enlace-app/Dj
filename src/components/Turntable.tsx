import React, { useRef, useState, useEffect } from 'react';
import { motion, useMotionValue } from 'motion/react';

interface TurntableProps {
  isPlaying: boolean;
  progress: number;
  duration: number;
  playbackRate: number;
  onScratch: (deltaTime: number) => void;
}

export const Turntable: React.FC<TurntableProps> = ({
  isPlaying, progress, duration, playbackRate, onScratch
}) => {
  const discRef = useRef<HTMLDivElement>(null);
  const [isScratching, setIsScratching] = useState(false);
  const rotation = useMotionValue(0);
  const autoRotation = useRef(0);
  const lastAngle = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  // Auto-rotate when playing
  useEffect(() => {
    let last = performance.now();
    const tick = (now: number) => {
      if (isPlaying && !isScratching) {
        const dt = (now - last) / 1000;
        autoRotation.current += 360 * 0.42 * playbackRate * dt;
        rotation.set(autoRotation.current);
      }
      last = now;
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [isPlaying, isScratching, playbackRate]);

  // Needle angle: -55° to +55° across full track
  const needleAngle = duration > 0 ? -55 + (progress / duration) * 110 : -55;

  const getAngle = (clientX: number, clientY: number): number => {
    if (!discRef.current) return 0;
    const rect = discRef.current.getBoundingClientRect();
    return Math.atan2(
      clientY - (rect.top + rect.height / 2),
      clientX - (rect.left + rect.width / 2)
    ) * (180 / Math.PI);
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
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
    // Map rotation to time — smooth and proportional
    onScratch((delta / 360) * 0.18);
    lastAngle.current = angle;
  };

  const handlePointerUp = () => {
    setIsScratching(false);
    lastAngle.current = null;
  };

  return (
    <div className="relative flex items-center justify-center select-none">
      {/* Base */}
      <div className="relative w-28 h-28 rounded-full flex-shrink-0"
        style={{
          background: 'radial-gradient(circle at 35% 35%, #2a2a3a, #0a0a0f)',
          boxShadow: isScratching
            ? '0 0 0 2px #1a1a2a, 0 0 0 4px rgba(239,68,68,0.5), 0 6px 24px rgba(0,0,0,0.9)'
            : '0 0 0 2px #1a1a2a, 0 0 0 4px #0a0a12, 0 6px 24px rgba(0,0,0,0.9)',
          transition: 'box-shadow 0.15s',
        }}
      >
        {/* Vinyl */}
        <motion.div
          ref={discRef}
          className="absolute inset-1.5 rounded-full touch-none select-none"
          style={{
            rotate: rotation,
            background: 'radial-gradient(circle at 40% 35%, #1c1c1c, #050505)',
            cursor: isScratching ? 'grabbing' : 'grab',
          }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          {/* Grooves */}
          {[8,13,18,23,28,33,37,41,45,48].map((inset, i) => (
            <div key={i} className="absolute rounded-full border"
              style={{ inset: `${inset}%`, borderColor: `rgba(255,255,255,${0.02 + i * 0.006})`, borderWidth: '0.5px' }} />
          ))}
          {/* Sheen */}
          <div className="absolute inset-0 rounded-full pointer-events-none"
            style={{ background: 'conic-gradient(from 0deg, transparent 0%, rgba(255,255,255,0.04) 15%, transparent 30%, rgba(255,255,255,0.02) 50%, transparent 65%, rgba(255,255,255,0.04) 80%, transparent 100%)' }} />
          {/* Label */}
          <div className="absolute inset-[30%] rounded-full flex items-center justify-center pointer-events-none"
            style={{ background: 'radial-gradient(circle at 40% 40%, #312e81, #1e1b4b)', boxShadow: '0 0 10px rgba(99,102,241,0.5)' }}>
            <div className="absolute inset-[15%] rounded-full border border-indigo-400/20" />
            <div className="w-1.5 h-1.5 rounded-full bg-black border border-indigo-500/40" />
          </div>
          {/* Beat marker */}
          <div className="absolute top-[7%] left-1/2 -translate-x-1/2 w-px h-[9%] rounded-full pointer-events-none"
            style={{ background: 'linear-gradient(to bottom, rgba(239,68,68,0.9), transparent)' }} />
        </motion.div>

        {/* Tonearm — moves with progress */}
        <div className="absolute pointer-events-none z-20"
          style={{
            top: '8%', right: '-4%',
            width: '42%', height: '52%',
            transformOrigin: '88% 6%',
            transform: `rotate(${needleAngle}deg)`,
            transition: isScratching ? 'none' : 'transform 0.25s linear',
          }}
        >
          <div className="absolute top-0 right-0 w-2.5 h-2.5 rounded-full"
            style={{ background: 'radial-gradient(circle, #aaa, #555)', boxShadow: '0 0 3px rgba(0,0,0,0.8)' }} />
          <div className="absolute" style={{ top: '9%', right: '32%', width: '11%', height: '80%', background: 'linear-gradient(to bottom, #ccc, #999, #777)', borderRadius: '2px', transform: 'rotate(-2deg)' }} />
          <div className="absolute bottom-[10%] right-[25%] w-[16%] h-[13%] rounded-sm"
            style={{ background: 'linear-gradient(135deg, #888, #555)' }} />
          <div className="absolute bottom-[3%] right-[29%] w-[8%] h-[7%] rounded-full"
            style={{ background: '#c0392b', boxShadow: '0 0 3px rgba(192,57,43,0.9)' }} />
        </div>
      </div>

      {/* Status */}
      <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1">
        {isScratching ? (
          <>
            <div className="w-1 h-1 rounded-full bg-red-500 animate-ping" />
            <span className="text-[5px] text-red-400 font-black uppercase">Scratch</span>
          </>
        ) : isPlaying ? (
          <>
            <div className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[5px] text-emerald-400 font-black uppercase">Playing</span>
          </>
        ) : null}
      </div>
    </div>
  );
};
