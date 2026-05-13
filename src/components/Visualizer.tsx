import React, { useRef, useEffect, useState } from 'react';

interface VisualizerProps {
  getData: () => any;
}

export const Visualizer: React.FC<VisualizerProps> = ({ getData }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 400, height: 100 });

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setDimensions({
          width: entry.contentRect.width,
          height: entry.contentRect.height
        });
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

    let animationFrameId: number;

    const render = () => {
      const data = getData();
      if (!data) {
        animationFrameId = requestAnimationFrame(render);
        return;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      ctx.beginPath();
      ctx.lineWidth = 3;
      
      const gradient = ctx.createLinearGradient(0, 0, canvas.width, 0);
      gradient.addColorStop(0, '#6366f1'); // indigo-500
      gradient.addColorStop(1, '#ec4899'); // pink-500
      ctx.strokeStyle = gradient;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';

      const sliceWidth = canvas.width / data.length;
      let x = 0;

      for (let i = 0; i < data.length; i++) {
        // Waveform values are between -1 and 1
        const v = typeof data[i] === 'number' ? data[i] : 0;
        const y = (v * canvas.height / 2) + canvas.height / 2;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }

        x += sliceWidth;
      }

      ctx.stroke();

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => cancelAnimationFrame(animationFrameId);
  }, [getData, dimensions]);

  return (
    <div ref={containerRef} className="w-full h-full">
      <canvas 
        ref={canvasRef} 
        width={dimensions.width} 
        height={dimensions.height} 
        className="w-full h-full opacity-40 pointer-events-none"
      />
    </div>
  );
};
