import React, { useRef, useState } from 'react';
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
  isPlaying, 
  playbackRate, 
  onTogglePlay,
  onScratch 
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isScratching, setIsScratching] = useState(false);
  const rotation = useMotionValue(0);
  const lastAngle = useRef(0);

  const getAngle = (x: number, y: number) => {
    if (!containerRef.current) return 0;
    const rect = containerRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    return Math.atan2(y - centerY, x - centerX) * (180 / Math.PI);
  };

  const handlePanStart = (event: any) => {
    setIsScratching(true);
    const point = event.touches ? event.touches[0] : event;
    lastAngle.current = getAngle(point.clientX, point.clientY);
  };

  const handlePan = (event: any, info: any) => {
    const angle = getAngle(info.point.x, info.point.y);
    let deltaAngle = angle - lastAngle.current;
    if (deltaAngle > 180) deltaAngle -= 360;
    if (deltaAngle < -180) deltaAngle += 360;
    const timeFactor = 0.005;
    onScratch(deltaAngle * timeFactor);
    rotation.set(rotation.get() + deltaAngle);
    lastAngle.current = angle;
  };

  const handlePanEnd = () => {
    setIsScratching(false);
  };

  return (
    <motion.div 
      ref={containerRef}
      className="relative w-28 h-28 rounded-full bg-[#0a0a0a] border-4 border-slate-900 shadow-[0_0_40px_rgba(0,0,0,0.8)] flex items-center justify-center overflow-hidden shrink-0 cursor-grab active:cursor-grabbing"
      onPanStart={handlePanStart}
      onPan={handlePan}
      onPanEnd={handlePanEnd}
      onTap={() => { if (!isScratching) onTogglePlay(); }}
    >
      {/* Vinyl Grooves */}
      <div className="absolute inset-1 rounded-full border border-[#222] opacity-50" />
      <div className="absolute inset-3 rounded-full border border-[#222] opacity-40" />
      <div className="absolute inset-5 rounded-full border border-[#222] opacity-30" />
      <div className="absolute inset-8 rounded-full border border-[#222] opacity-20" />
      
      {/* Rotating Platter */}
      <motion.div
        className="w-full h-full flex items-center justify-center"
        animate={isPlaying && !isScratching ? { rotate: 360 } : {}}
        style={{ rotate: isScratching ? rotation : undefined }}
        transition={isPlaying && !isScratching ? {
          repeat: Infinity,
          duration: 2 / playbackRate,
          ease: "linear"
        } : { duration: 0 }}
      >
        <div className="relative w-full h-full flex items-center justify-center">
          {/* Center Label */}
          <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center border-2 border-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.6)]">
            <div className="w-4 h-4 rounded-full bg-slate-950 border border-white/20 flex items-center justify-center">
              <div className="w-1 h-1 rounded-full bg-indigo-500" />
            </div>
          </div>
          {/* Vinyl Shine */}
          <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent opacity-30 rounded-full" />
          {/* Marker */}
          <div className="absolute top-2 left-1/2 -translate-x-1/2 w-0.5 h-4 bg-indigo-400 rounded-full shadow-[0_0_6px_rgba(129,140,248,0.8)]" />
        </div>
      </motion.div>

      {/* Stylus Arm */}
      <div className="absolute -right-1 top-0 w-5 h-20 origin-top transform rotate-12 pointer-events-none z-20">
        <div className="w-1 h-full bg-slate-300 rounded-full shadow-2xl border-x border-white/20" />
        <div className="absolute bottom-0 -left-0.5 w-2 h-3 bg-slate-400 rounded-sm shadow-lg" />
      </div>
    </motion.div>
  );
};
