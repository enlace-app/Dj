import React, { useRef, useState, useEffect, useCallback } from 'react';
import { motion, useMotionValue } from 'motion/react';

interface TurntableProps {
  isPlaying: boolean;
  progress: number;
  duration: number;
  playbackRate: number;
  onScratchStart: () => void;
  onScratchMove: (rate: number) => void;
  onScratchEnd: () => void;
}

export const Turntable: React.FC<TurntableProps> = ({
  isPlaying, progress, duration, playbackRate,
  onScratchStart, onScratchMove, onScratchEnd,
}) => {
  const discRef = useRef<HTMLDivElement>(null);
  const [isScratching, setIsScratching] = useState(false);
  const rotation = useMotionValue(0);
  const autoRotation = useRef(0);
  const lastAngle = useRef<number | null>(null);
  const lastAngleTime = useRef(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    let last = performance.now();
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      if (isPlaying && !isScratching) {
        autoRotation.current += 360 * 0.42 * playbackRate * dt;
        rotation.set(autoRotation.current);
      }
      last = now;
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [isPlaying, isScratching, playbackRate]);

  // Needle sweeps from -50° to +50° over the full track duration
  // Pivot is top-right of the disc
  const needleAngle = duration > 0 ? -50 + (progress / duration) * 100 : -50;

  const getAngle = useCallback((clientX: number, clientY: number): number => {
    if (!discRef.current) return 0;
    const rect = discRef.current.getBoundingClientRect();
    return Math.atan2(
      clientY - (rect.top + rect.height / 2),
      clientX - (rect.left + rect.width / 2)
    ) * (180 / Math.PI);
  }, []);

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsScratching(true);
    lastAngle.current = getAngle(e.clientX, e.clientY);
    lastAngleTime.current = performance.now();
    onScratchStart();
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isScratching || lastAngle.current === null) return;
    const now = performance.now();
    const dt = (now - lastAngleTime.current) / 1000;
    const angle = getAngle(e.clientX, e.clientY);
    let delta = angle - lastAngle.current;
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;

    // Rotate disc visually
    autoRotation.current += delta;
    rotation.set(autoRotation.current);

    // Calculate angular velocity → playback rate
    // 1 full revolution/sec = normal speed
    const degreesPerSec = dt > 0 ? delta / dt : 0;
    const scratchRate = degreesPerSec / (360 * 0.42);
    // Clamp to reasonable range
    const clampedRate = Math.max(-3, Math.min(3, scratchRate));
    onScratchMove(clampedRate);

    lastAngle.current = angle;
    lastAngleTime.current = now;
  };

  const handlePointerUp = () => {
    setIsScratching(false);
    lastAngle.current = null;
    onScratchEnd();
  };

  return (
    <div className="relative flex items-center justify-center select-none">
      <div
        className="relative rounded-full flex-shrink-0"
        style={{
          width: 112, height: 112,
          background: 'radial-gradient(circle at 35% 35%, #2a2a3a, #0a0a0f)',
          boxShadow: isScratching
            ? '0 0 0 2px #1a1a2a, 0 0 0 4px rgba(239,68,68,0.5), 0 6px 24px rgba(0,0,0,0.9)'
            : '0 0 0 2px #1a1a2a, 0 0 0 4px #0a0a12, 0 6px 24px rgba(0,0,0,0.9)',
          transition: 'box-shadow 0.15s',
        }}
      >
        {/* Vinyl disc */}
        <motion.div
          ref={discRef}
          className="absolute rounded-full touch-none select-none"
          style={{
            inset: 6,
            rotate: rotation,
            background: 'radial-gradient(circle at 40% 35%, #1c1c1c, #050505)',
            cursor: isScratching ? 'grabbing' : 'grab',
          }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          {[8,13,18,23,28,33,37,41,45,48].map((inset, i) => (
            <div key={i} className="absolute rounded-full border"
              style={{ inset: `${inset}%`, borderColor: `rgba(255,255,255,${0.02 + i * 0.006})`, borderWidth: '0.5px' }} />
          ))}
          <div className="absolute inset-0 rounded-full pointer-events-none"
            style={{ background: 'conic-gradient(from 0deg, transparent 0%, rgba(255,255,255,0.04) 15%, transparent 30%, rgba(255,255,255,0.02) 50%, transparent 65%, rgba(255,255,255,0.04) 80%, transparent 100%)' }} />
          <div className="absolute inset-[30%] rounded-full flex items-center justify-center pointer-events-none"
            style={{ background: 'radial-gradient(circle at 40% 40%, #312e81, #1e1b4b)', boxShadow: '0 0 10px rgba(99,102,241,0.5)' }}>
            <div className="absolute inset-[15%] rounded-full border border-indigo-400/20" />
            <div className="w-1.5 h-1.5 rounded-full bg-black border border-indigo-500/40" />
          </div>
          <div className="absolute top-[7%] left-1/2 -translate-x-1/2 w-px h-[9%] rounded-full pointer-events-none"
            style={{ background: 'linear-gradient(to bottom, rgba(239,68,68,0.9), transparent)' }} />
        </motion.div>

        {/* Tonearm — pivot fixed at top-right corner of disc */}
        {/* The arm rotates around the pivot point in top-right */}
        <div
          className="absolute pointer-events-none z-20"
          style={{
            // Pivot sits at top-right of the disc
            top: 0,
            right: -8,
            width: 50,
            height: 70,
            transformOrigin: 'calc(100% - 6px) 6px',
            transform: `rotate(${needleAngle}deg)`,
            transition: isScratching ? 'none' : 'transform 0.2s linear',
          }}
        >
          {/* Pivot dot */}
          <div className="absolute top-0 right-0 w-3 h-3 rounded-full"
            style={{ background: 'radial-gradient(circle, #bbb, #555)', boxShadow: '0 0 4px rgba(0,0,0,0.9)' }} />
          {/* Arm rod */}
          <div className="absolute"
            style={{
              top: 10, right: 7,
              width: 3, height: 52,
              background: 'linear-gradient(to bottom, #ccc, #999, #777)',
              borderRadius: 2,
              boxShadow: '1px 1px 3px rgba(0,0,0,0.6)',
            }} />
          {/* Headshell */}
          <div className="absolute"
            style={{
              bottom: 4, right: 2,
              width: 10, height: 9,
              background: 'linear-gradient(135deg, #888, #555)',
              borderRadius: 2,
            }} />
          {/* Stylus tip */}
          <div className="absolute"
            style={{
              bottom: 0, right: 5,
              width: 5, height: 5,
              background: '#c0392b',
              borderRadius: '50%',
              boxShadow: '0 0 3px rgba(192,57,43,0.9)',
            }} />
        </div>
      </div>

      {/* Status indicator */}
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
