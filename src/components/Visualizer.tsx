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
    const obs = new ResizeObserver(entries => {
      for (const e of entries)
        setDimensions({ width: e.contentRect.width, height: e.contentRect.height });
    });
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let rafId: number;

    // Peak hold for bars
    const peaks: number[] = new Array(32).fill(0);
    const peakDecay = 0.98;

    const render = () => {
      const W = canvas.width;
      const H = canvas.height;
      ctx.clearRect(0, 0, W, H);

      const waveData = getData();
      const freq = freqData ? freqData() : null;

      // ── FREQUENCY BARS ──────────────────────────────────────────────
      if (freq && mode !== 'waveform') {
        const barCount = Math.min(32, freq.length);
        const barW = W / barCount;
        const barsH = mode === 'both' ? H * 0.6 : H;
        const barsY = mode === 'both' ? H * 0.4 : 0;

        // Band color zones: Sub(0-3) Bass(4-8) Low-mid(9-14) Mid(15-20) High(21-31)
        const getBandColor = (i: number, norm: number) => {
          if (i < 4)  return `hsla(280, 80%, ${40 + norm * 30}%, 0.9)`;  // Sub — purple
          if (i < 9)  return `hsla(240, 80%, ${45 + norm * 30}%, 0.9)`;  // Bass — blue
          if (i < 15) return `hsla(180, 80%, ${40 + norm * 30}%, 0.9)`;  // Lo-mid — cyan
          if (i < 21) return `hsla(120, 70%, ${40 + norm * 30}%, 0.9)`;  // Mid — green
          return `hsla(${60 - norm * 60}, 80%, ${45 + norm * 30}%, 0.9)`; // High — yellow→red
        };

        for (let i = 0; i < barCount; i++) {
          const db = typeof freq[i] === 'number' ? freq[i] : -100;
          const norm = Math.max(0, Math.min(1, (db + 90) / 90));
          const barH = norm * barsH;

          // Update peak
          if (norm > peaks[i]) peaks[i] = norm;
          else peaks[i] *= peakDecay;

          const x = i * barW;
          const gap = barW > 4 ? 1 : 0.5;

          // Glow on high energy
          if (norm > 0.75) {
            ctx.shadowBlur = 6;
            ctx.shadowColor = getBandColor(i, norm);
          } else {
            ctx.shadowBlur = 0;
          }

          // Bar
          const grad = ctx.createLinearGradient(0, barsY + barsH, 0, barsY + barsH - barH);
          grad.addColorStop(0, getBandColor(i, norm));
          grad.addColorStop(1, getBandColor(i, norm).replace('0.9', '0.4'));
          ctx.fillStyle = grad;
          if (barH > 1) {
            ctx.beginPath();
            ctx.roundRect(x + gap, barsY + barsH - barH, barW - gap * 2, barH, 1);
            ctx.fill();
          }

          // Peak dot
          ctx.shadowBlur = 0;
          if (peaks[i] > 0.05) {
            const peakY = barsY + barsH - peaks[i] * barsH;
            ctx.fillStyle = getBandColor(i, peaks[i]).replace('0.9', '1');
            ctx.fillRect(x + gap, peakY - 1, barW - gap * 2, 1.5);
          }
        }
        ctx.shadowBlur = 0;
      }

      // ── WAVEFORM ────────────────────────────────────────────────────
      if (waveData && mode !== 'bars') {
        const topH = mode === 'both' ? H * 0.38 : H;
        const midY = topH / 2;

        ctx.beginPath();
        ctx.lineWidth = 1.2;
        const grad = ctx.createLinearGradient(0, 0, W, 0);
        grad.addColorStop(0, 'rgba(99,102,241,0.8)');
        grad.addColorStop(0.5, 'rgba(236,72,153,0.8)');
        grad.addColorStop(1, 'rgba(99,102,241,0.8)');
        ctx.strokeStyle = grad;
        ctx.lineJoin = 'round';

        const step = W / waveData.length;
        for (let i = 0; i < waveData.length; i++) {
          const v = typeof waveData[i] === 'number' ? waveData[i] : 0;
          const y = midY + v * topH * 0.45;
          i === 0 ? ctx.moveTo(0, y) : ctx.lineTo(i * step, y);
        }
        ctx.stroke();

        // Mirror below
        ctx.beginPath();
        ctx.globalAlpha = 0.3;
        for (let i = 0; i < waveData.length; i++) {
          const v = typeof waveData[i] === 'number' ? waveData[i] : 0;
          const y = midY - v * topH * 0.45;
          i === 0 ? ctx.moveTo(0, y) : ctx.lineTo(i * step, y);
        }
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      rafId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(rafId);
  }, [getData, freqData, mode, dimensions]);

  return (
    <div ref={containerRef} className="w-full h-full">
      <canvas ref={canvasRef} width={dimensions.width} height={dimensions.height}
        className="w-full h-full pointer-events-none" />
    </div>
  );
};
