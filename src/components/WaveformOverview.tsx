import React, { useRef, useEffect, useCallback } from 'react';

interface WaveformOverviewProps {
  audioBuffer: AudioBuffer | null;
  progress: number;
  duration: number;
  hotcues: (number | null)[];
  dropTime: number;
  loopStart: number | null;
  loopEnd: number | null;
  accentColor: string;
  onSeek: (time: number) => void;
}

const hotcueColorMap = ['#ec4899', '#eab308', '#06b6d4', '#22c55e'];

export const WaveformOverview: React.FC<WaveformOverviewProps> = ({
  audioBuffer, progress, duration, hotcues, dropTime, loopStart, loopEnd, accentColor, onSeek,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const waveformCache = useRef<Float32Array | null>(null);

  useEffect(() => {
    if (!audioBuffer) { waveformCache.current = null; return; }
    const data = audioBuffer.getChannelData(0);
    const W = 400;
    const samplesPerPixel = Math.floor(data.length / W);
    const peaks = new Float32Array(W);
    for (let i = 0; i < W; i++) {
      let max = 0;
      const start = i * samplesPerPixel;
      for (let j = 0; j < samplesPerPixel; j++) {
        const abs = Math.abs(data[start + j] || 0);
        if (abs > max) max = abs;
      }
      peaks[i] = max;
    }
    waveformCache.current = peaks;
  }, [audioBuffer]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let rafId: number;

    const draw = () => {
      const W = canvas.width;
      const H = canvas.height;
      ctx.clearRect(0, 0, W, H);
      const peaks = waveformCache.current;

      if (!peaks) {
        ctx.fillStyle = 'rgba(255,255,255,0.03)';
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.font = `${H * 0.32}px monospace`;
        ctx.textAlign = 'center';
        ctx.fillText('Carga una canción', W / 2, H / 2 + H * 0.1);
        rafId = requestAnimationFrame(draw);
        return;
      }

      const playedX = duration > 0 ? (progress / duration) * W : 0;

      // Background
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(0, 0, W, H);

      // Loop region highlight
      if (loopStart !== null && loopEnd !== null && duration > 0) {
        const lx1 = (loopStart / duration) * W;
        const lx2 = (loopEnd / duration) * W;
        ctx.fillStyle = `${accentColor}25`;
        ctx.fillRect(lx1, 0, lx2 - lx1, H);
        ctx.strokeStyle = `${accentColor}80`;
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(lx1, 0); ctx.lineTo(lx1, H); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(lx2, 0); ctx.lineTo(lx2, H); ctx.stroke();
      }

      // Waveform bars
      const barW = W / peaks.length;
      for (let i = 0; i < peaks.length; i++) {
        const x = i * barW;
        const h = peaks[i] * H * 0.85;
        const isPlayed = x < playedX;
        const isInLoop = loopStart !== null && loopEnd !== null && duration > 0 &&
          (i / peaks.length) * duration >= loopStart &&
          (i / peaks.length) * duration <= loopEnd;

        if (isInLoop) {
          ctx.fillStyle = isPlayed ? accentColor : accentColor + '99';
        } else {
          ctx.fillStyle = isPlayed ? accentColor + 'cc' : 'rgba(100,116,139,0.45)';
        }
        ctx.fillRect(x, (H - h) / 2, Math.max(1, barW - 0.5), h);
      }

      // Drop marker
      if (dropTime > 0 && duration > 0) {
        const dropX = (dropTime / duration) * W;
        ctx.save();
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([2, 2]);
        ctx.beginPath(); ctx.moveTo(dropX, 0); ctx.lineTo(dropX, H); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = '#fbbf24';
        ctx.font = `bold ${H * 0.35}px monospace`;
        ctx.textAlign = dropX > W * 0.85 ? 'right' : 'left';
        ctx.fillText('⚡', dropX + (dropX > W * 0.85 ? -3 : 3), H * 0.4);
        ctx.restore();
      }

      // Hotcue markers
      hotcues.forEach((hc, i) => {
        if (hc === null || duration === 0) return;
        const hx = (hc / duration) * W;
        ctx.save();
        ctx.fillStyle = hotcueColorMap[i];
        ctx.beginPath();
        ctx.moveTo(hx, 0); ctx.lineTo(hx + 5, 0); ctx.lineTo(hx, H * 0.4);
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = hotcueColorMap[i];
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(hx, 0); ctx.lineTo(hx, H); ctx.stroke();
        ctx.restore();
      });

      // Playhead
      if (playedX > 0) {
        ctx.save();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.shadowBlur = 6; ctx.shadowColor = accentColor;
        ctx.beginPath(); ctx.moveTo(playedX, 0); ctx.lineTo(playedX, H); ctx.stroke();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(playedX - 4, 0); ctx.lineTo(playedX + 4, 0); ctx.lineTo(playedX, 6);
        ctx.closePath(); ctx.fill();
        ctx.restore();
      }

      // Time labels
      ctx.fillStyle = 'rgba(148,163,184,0.7)';
      ctx.font = `${Math.max(8, H * 0.28)}px monospace`;
      ctx.shadowBlur = 0;
      const elapsed = `${Math.floor(progress / 60)}:${Math.floor(progress % 60).toString().padStart(2, '0')}`;
      const remaining = duration > 0 ? `-${Math.floor((duration - progress) / 60)}:${Math.floor((duration - progress) % 60).toString().padStart(2, '0')}` : '';
      ctx.textAlign = 'left'; ctx.fillText(elapsed, 3, H - 2);
      ctx.textAlign = 'right'; ctx.fillText(remaining, W - 3, H - 2);

      rafId = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(rafId);
  }, [audioBuffer, progress, duration, hotcues, dropTime, loopStart, loopEnd, accentColor]);

  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || duration === 0) return;
    const rect = canvas.getBoundingClientRect();
    onSeek(((e.clientX - rect.left) / rect.width) * duration);
  }, [duration, onSeek]);

  return (
    <div className="w-full h-full">
      <canvas ref={canvasRef} width={400} height={40}
        className="w-full h-full cursor-pointer" onClick={handleClick}
        style={{ imageRendering: 'crisp-edges' }} />
    </div>
  );
};
