import React, { useRef, useState, useEffect } from 'react';
import { motion, useMotionValue } from 'motion/react';

interface TurntableProps {
  isPlaying: boolean;
  progress: number;
  duration: number;
  playbackRate: number;
  onScratchStart: () => void;
  onScratchMove: (velocity: number) => void; // degrees/sec
  onScratchEnd: () => void;
}

export const Turntable: React.FC<TurntableProps> = ({
  isPlaying, progress, duration, playbackRate,
  onScratchStart, onScratchMove, onScratchEnd,
}) => {
  const discRef = useRef<HTMLDivElement>(null);
  const [isScratching, setIsScratching] = useState(false);
  const rotation = useMotionValue(0);
  const autoRot = useRef(0);
  const lastAngle = useRef<number | null>(null);
  const lastAngleTime = useRef(0);
  const rafRef = useRef<number | null>(null);
  const scratchingRef = useRef(false);

  // Auto-rotate when playing
  useEffect(() => {
    let last = performance.now();
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      if (isPlaying && !scratchingRef.current) {
        autoRot.current += 360 * 0.42 * playbackRate * dt;
        rotation.set(autoRot.current);
      }
      last = now;
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [isPlaying, playbackRate]);

  // Needle: pivot at top-right, sweeps from -45° (start) to +45° (end)
  const needleAngle = duration > 0 ? -45 + (progress / duration) * 90 : -45;

  const getAngle = (x: number, y: number) => {
    if (!discRef.current) return 0;
    const r = discRef.current.getBoundingClientRect();
    return Math.atan2(y - (r.top + r.height / 2), x - (r.left + r.width / 2)) * 180 / Math.PI;
  };

  const onDown = (e: React.PointerEvent) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    scratchingRef.current = true;
    setIsScratching(true);
    lastAngle.current = getAngle(e.clientX, e.clientY);
    lastAngleTime.current = performance.now();
    onScratchStart();
  };

  const onMove = (e: React.PointerEvent) => {
    if (!scratchingRef.current || lastAngle.current === null) return;
    const now = performance.now();
    const dt = Math.max(1, now - lastAngleTime.current) / 1000;
    const angle = getAngle(e.clientX, e.clientY);
    let delta = angle - lastAngle.current;
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;

    // Rotate disc visually
    autoRot.current += delta;
    rotation.set(autoRot.current);

    // Velocity in degrees/sec
    const velocity = delta / dt;
    onScratchMove(velocity);

    lastAngle.current = angle;
    lastAngleTime.current = now;
  };

  const onUp = () => {
    scratchingRef.current = false;
    setIsScratching(false);
    lastAngle.current = null;
    onScratchEnd();
  };

  return (
    <div className="relative flex items-center justify-center select-none">
      {/* Base plinth */}
      <div className="relative rounded-full flex-shrink-0"
        style={{
          width: 112, height: 112,
          background: 'radial-gradient(circle at 35% 35%, #2a2a3a, #0a0a0f)',
          boxShadow: isScratching
            ? '0 0 0 2px #300, 0 0 0 4px rgba(239,68,68,0.6), 0 6px 24px rgba(0,0,0,0.9)'
            : '0 0 0 2px #1a1a2a, 0 0 0 4px #0a0a12, 0 6px 24px rgba(0,0,0,0.9)',
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
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
        >
          {[8,13,18,23,28,33,37,41,45,48].map((s, i) => (
            <div key={i} className="absolute rounded-full border"
              style={{ inset: `${s}%`, borderColor: `rgba(255,255,255,${0.02 + i * 0.006})`, borderWidth: '0.5px' }} />
          ))}
          <div className="absolute inset-0 rounded-full pointer-events-none"
            style={{ background: 'conic-gradient(from 0deg, transparent 0%, rgba(255,255,255,0.04) 15%, transparent 30%, rgba(255,255,255,0.02) 50%, transparent 65%, rgba(255,255,255,0.04) 80%, transparent 100%)' }} />
          {/* Center label */}
          <div className="absolute inset-[30%] rounded-full flex items-center justify-center pointer-events-none"
            style={{ background: 'radial-gradient(circle at 40% 40%, #312e81, #1e1b4b)', boxShadow: '0 0 10px rgba(99,102,241,0.5)' }}>
            <div className="absolute inset-[15%] rounded-full border border-indigo-400/20" />
            <div className="w-1.5 h-1.5 rounded-full bg-black border border-indigo-500/40" />
          </div>
          {/* Beat marker */}
          <div className="absolute top-[7%] left-1/2 -translate-x-1/2 w-px h-[9%] rounded-full pointer-events-none"
            style={{ background: 'linear-gradient(to bottom, rgba(239,68,68,0.9), transparent)' }} />
        </motion.div>

        {/* Tonearm — pivot at top-right corner, arm hangs down-left */}
        {/* The pivot dot sits just outside the top-right of the disc */}
        {/* Transform origin = the pivot dot position */}
        <div
          className="absolute pointer-events-none z-20"
          style={{
            // Position pivot at top-right of disc
            top: -4,
            right: -4,
            width: 16,
            height: 16,
          }}
        >
          {/* Pivot dot */}
          <div className="w-4 h-4 rounded-full"
            style={{ background: 'radial-gradient(circle, #ccc, #666)', boxShadow: '0 0 4px rgba(0,0,0,0.9)', zIndex: 30 }} />
        </div>

        {/* Arm — rotates around the pivot */}
        <div
          className="absolute pointer-events-none z-10"
          style={{
            top: 4,
            right: 4,
            width: 8,
            height: 80,
            transformOrigin: '50% 0%', // top of arm = pivot
            transform: `rotate(${needleAngle}deg)`,
            transition: isScratching ? 'none' : 'transform 0.25s linear',
          }}
        >
          {/* Rod */}
          <div className="absolute left-1/2 -translate-x-1/2"
            style={{ top: 6, width: 3, height: 55, background: 'linear-gradient(to bottom, #ddd, #aaa, #888)', borderRadius: 2 }} />
          {/* Headshell */}
          <div className="absolute left-1/2 -translate-x-1/2"
            style={{ bottom: 8, width: 10, height: 8, background: 'linear-gradient(135deg, #999, #666)', borderRadius: 2 }} />
          {/* Stylus */}
          <div className="absolute left-1/2 -translate-x-1/2"
            style={{ bottom: 2, width: 4, height: 4, background: '#c0392b', borderRadius: '50%', boxShadow: '0 0 3px rgba(192,57,43,0.9)' }} />
        </div>
      </div>

      {/* Status */}
      <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1">
        {isScratching ? (
          <><div className="w-1 h-1 rounded-full bg-red-500 animate-ping" />
          <span className="text-[5px] text-red-400 font-black uppercase">Scratch</span></>
        ) : isPlaying ? (
          <><div className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[5px] text-emerald-400 font-black uppercase">Playing</span></>
        ) : null}
      </div>
    </div>
  );
};
