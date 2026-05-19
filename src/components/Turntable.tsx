import React, { useRef, useState, useEffect } from 'react';
import { motion, useMotionValue } from 'motion/react';

interface TurntableProps {
  isPlaying: boolean;
  progress: number;
  duration: number;
  playbackRate: number;
  onTogglePlay: () => void;
  onSeekTo: (time: number) => void; // click en vinilo = posición absoluta
  onScratch: (deltaTime: number) => void; // scratch = delta relativo
}

export const Turntable: React.FC<TurntableProps> = ({
  isPlaying, progress, duration, playbackRate, onTogglePlay, onSeekTo, onScratch
}) => {
  const discRef = useRef<HTMLDivElement>(null);
  const [isScratching, setIsScratching] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const rotation = useMotionValue(0);
  const autoRotation = useRef(0);
  const lastAngle = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const pointerDownTime = useRef(0);
  const pointerMoved = useRef(false);

  // Auto-rotate when playing
  useEffect(() => {
    let last = performance.now();
    const tick = (now: number) => {
      if (isPlaying && !isScratching) {
        const dt = (now - last) / 1000;
        autoRotation.current += 360 * 0.5 * playbackRate * dt;
        rotation.set(autoRotation.current);
      }
      last = now;
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [isPlaying, isScratching, playbackRate]);

  // Needle angle: sweeps from -60° to +60° across full track
  const needleAngle = duration > 0 ? -60 + (progress / duration) * 120 : -60;

  const getAngle = (clientX: number, clientY: number): number => {
    if (!discRef.current) return 0;
    const rect = discRef.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    return Math.atan2(clientY - cy, clientX - cx) * (180 / Math.PI);
  };

  const getTimeFromClick = (clientX: number, clientY: number): number => {
    if (!discRef.current || duration === 0) return 0;
    const rect = discRef.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = clientX - cx;
    const dy = clientY - cy;
    const distFromCenter = Math.sqrt(dx * dx + dy * dy);
    const radius = rect.width / 2;
    // Map distance from center to time (inner = start, outer = end)
    const ratio = Math.min(1, Math.max(0, distFromCenter / radius));
    return ratio * duration;
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    pointerDownTime.current = Date.now();
    pointerMoved.current = false;
    setIsDragging(true);
    lastAngle.current = getAngle(e.clientX, e.clientY);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging || lastAngle.current === null) return;
    pointerMoved.current = true;
    setIsScratching(true);

    const angle = getAngle(e.clientX, e.clientY);
    let delta = angle - lastAngle.current;
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;

    autoRotation.current += delta;
    rotation.set(autoRotation.current);

    // Scratch: delta de tiempo proporcional al giro
    onScratch((delta / 360) * 0.2);
    lastAngle.current = angle;
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsDragging(false);
    setIsScratching(false);
    lastAngle.current = null;

    const elapsed = Date.now() - pointerDownTime.current;

    if (!pointerMoved.current && elapsed < 300) {
      // Tap rápido sin mover = play/pause
      onTogglePlay();
    } else if (pointerMoved.current && elapsed < 200) {
      // Movimiento rápido = scratch (ya enviado en move)
    } else if (elapsed >= 300 && !pointerMoved.current) {
      // Tap largo = seek a esa posición
      const t = getTimeFromClick(e.clientX, e.clientY);
      onSeekTo(t);
    }
  };

  return (
    <div className="relative flex items-center justify-center select-none">
      {/* Plinto exterior */}
      <div className="relative w-36 h-36 rounded-full"
        style={{
          background: 'radial-gradient(circle at 35% 35%, #2a2a3a, #0a0a0f)',
          boxShadow: '0 0 0 3px #1a1a2a, 0 0 0 5px #0a0a12, 0 8px 32px rgba(0,0,0,0.9)',
        }}
      >
        {/* Disco de vinilo — rota */}
        <motion.div
          ref={discRef}
          className="absolute inset-2 rounded-full touch-none"
          style={{
            rotate: rotation,
            background: 'radial-gradient(circle at 40% 35%, #1c1c1c, #050505)',
            boxShadow: isScratching
              ? 'inset 0 2px 8px rgba(0,0,0,0.9), 0 0 16px rgba(239,68,68,0.4)'
              : 'inset 0 2px 8px rgba(0,0,0,0.9)',
            cursor: isScratching ? 'grabbing' : 'grab',
          }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          {/* Surcos de vinilo */}
          {[8,13,18,23,28,33,37,41,44,47].map((inset, i) => (
            <div key={i} className="absolute rounded-full border"
              style={{
                inset: `${inset}%`,
                borderColor: `rgba(255,255,255,${0.025 + i * 0.007})`,
                borderWidth: '0.5px',
              }} />
          ))}

          {/* Brillo */}
          <div className="absolute inset-0 rounded-full pointer-events-none"
            style={{ background: 'conic-gradient(from 0deg, transparent 0%, rgba(255,255,255,0.04) 15%, transparent 30%, rgba(255,255,255,0.02) 50%, transparent 65%, rgba(255,255,255,0.05) 80%, transparent 100%)' }} />

          {/* Etiqueta central */}
          <div className="absolute inset-[30%] rounded-full flex items-center justify-center pointer-events-none"
            style={{ background: 'radial-gradient(circle at 40% 40%, #312e81, #1e1b4b)', boxShadow: '0 0 12px rgba(99,102,241,0.5)' }}>
            <div className="absolute inset-[15%] rounded-full border border-indigo-400/20" />
            <div className="absolute inset-[35%] rounded-full border border-indigo-400/10" />
            <div className="w-2 h-2 rounded-full bg-black border border-indigo-500/50" />
          </div>

          {/* Marcador de beat */}
          <div className="absolute top-[8%] left-1/2 -translate-x-1/2 w-0.5 h-[10%] rounded-full pointer-events-none"
            style={{ background: 'linear-gradient(to bottom, rgba(239,68,68,0.9), transparent)', boxShadow: '0 0 4px rgba(239,68,68,0.7)' }} />
        </motion.div>

        {/* Brazo tonearm — se mueve con el progreso */}
        <div
          className="absolute pointer-events-none z-20"
          style={{
            top: '10%',
            right: '-5%',
            width: '45%',
            height: '55%',
            transformOrigin: '90% 5%',
            transform: `rotate(${needleAngle}deg)`,
            transition: isScratching ? 'none' : 'transform 0.3s ease',
          }}
        >
          {/* Pivot */}
          <div className="absolute top-0 right-0 w-3 h-3 rounded-full z-10"
            style={{ background: 'radial-gradient(circle, #aaa, #555)', boxShadow: '0 0 4px rgba(0,0,0,0.8)' }} />
          {/* Brazo */}
          <div className="absolute"
            style={{
              top: '8%', right: '35%',
              width: '12%', height: '82%',
              background: 'linear-gradient(to bottom, #ccc, #999, #777)',
              borderRadius: '2px',
              boxShadow: '1px 1px 4px rgba(0,0,0,0.6)',
              transform: 'rotate(-2deg)',
            }} />
          {/* Cabezal */}
          <div className="absolute bottom-[8%] right-[28%] w-[18%] h-[14%] rounded-sm"
            style={{ background: 'linear-gradient(135deg, #888, #555)', boxShadow: '1px 1px 3px rgba(0,0,0,0.6)' }} />
          {/* Aguja */}
          <div className="absolute bottom-[2%] right-[32%] w-[8%] h-[8%] rounded-full"
            style={{ background: '#c0392b', boxShadow: '0 0 4px rgba(192,57,43,0.9)' }} />
        </div>
      </div>

      {/* Indicador scratch */}
      {isScratching && (
        <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 flex items-center gap-1">
          <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
          <span className="text-[6px] text-red-400 font-black uppercase tracking-widest">Scratch</span>
        </div>
      )}

      {/* Indicador play */}
      {!isScratching && isPlaying && (
        <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 flex items-center gap-1">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[6px] text-emerald-400 font-black uppercase tracking-widest">Playing</span>
        </div>
      )}
    </div>
  );
};
