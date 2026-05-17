import React, { useRef, useEffect, useState } from 'react';

interface VisualizerProps {
  getData: () => any;
  freqData?: () => any;
  mode?: 'waveform' | 'bars' | 'both';
}

export const Visualizer: React.FC<VisualizerProps> = ({ getData, freqData, mode = 'both' }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 300, height: 80 });

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(entries => {
      for (const e of entries) {
        setDimensions({ width: e.contentRect.width, height: e.contentRect.height });
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let rafId: number;

    const render = () => {
      const W = canvas.width;
      const H = canvas.height;
      ctx.clearRect(0, 0, W, H);

      const waveData = getData();
      const freq = freqData ? freqData() : null;

      // ---- FREQUENCY BARS (bottom half) ----
      if (freq && Array.from(freq).some((v: any) => v > -100)) {
        const barCount = Math.min(32, freq.length);
        const barW = W / barCount;
        const halfH = mode === 'both' ? H * 0.55 : H;

        for (let i = 0; i < barCount; i++) {
          // FFT values are in dB (-100 to 0)
          const db = typeof freq[i] === 'number' ? freq[i] : -100;
          const normalized = Math.max(0, (db + 100) / 100); // 0 to 1
          const barH = normalized * halfH;

          // Color: blue → indigo → pink → red based on intensity
          const hue = 240 - normalized * 180; // 240=blue, 60=yellow, 0=red
          const sat = 70 + normalized * 30;
          const light = 40 + normalized * 25;

          // Glow for high energy (drops!)
          if (normalized > 0.7) {
            ctx.shadowBlur = 8;
            ctx.shadowColor = `hsl(${hue}, ${sat}%, ${light}%)`;
          } else {
            ctx.shadowBlur = 0;
          }

          const grad = ctx.createLinearGradient(0, H, 0, H - barH);
          grad.addColorStop(0, `hsla(${hue}, ${sat}%, ${light}%, 0.9)`);
          grad.addColorStop(1, `hsla(${hue - 20}, ${sat}%, ${light + 20}%, 0.6)`);
          ctx.fillStyle = grad;

          const x = i * barW;
          const gap = 1;
          ctx.beginPath();
          ctx.roundRect(x + gap, H - barH, barW - gap * 2, barH, 2);
          ctx.fill();

          // Peak dot
          if (normalized > 0.05) {
            ctx.shadowBlur = 4;
            ctx.fillStyle = `hsla(${hue - 30}, 100%, 80%, 0.8)`;
            ctx.beginPath();
            ctx.arc(x + barW / 2, H - barH - 1, 1, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        ctx.shadowBlur = 0;
      }

      // ---- WAVEFORM (top area) ----
      if (waveData && mode !== 'bars') {
        const topH = mode === 'both' ? H * 0.4 : H;
        const midY = mode === 'both' ? topH / 2 : H / 2;

        ctx.beginPath();
        ctx.lineWidth = 1.5;
        const grad = ctx.createLinearGradient(0, 0, W, 0);
        grad.addColorStop(0, 'rgba(99,102,241,0.7)');
        grad.addColorStop(0.5, 'rgba(236,72,153,0.7)');
        grad.addColorStop(1, 'rgba(99,102,241,0.7)');
        ctx.strokeStyle = grad;
        ctx.lineJoin = 'round';

        const step = W / waveData.length;
        for (let i = 0; i < waveData.length; i++) {
          const v = typeof waveData[i] === 'number' ? waveData[i] : 0;
          const y = midY + v * (topH / 2) * 0.8;
          i === 0 ? ctx.moveTo(0, y) : ctx.lineTo(i * step, y);
        }
        ctx.stroke();
      }

      rafId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(rafId);
  }, [getData, freqData, mode, dimensions]);

  return (
    <div ref={containerRef} className="w-full h-full">
      <canvas
        ref={canvasRef}
        width={dimensions.width}
        height={dimensions.height}
        className="w-full h-full pointer-events-none"
      />
    </div>
  );
};
