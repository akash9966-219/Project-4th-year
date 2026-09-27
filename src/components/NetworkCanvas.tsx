/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef } from 'react';
import { Station, ChannelState } from '../types/wlan';
import { EDCA_DEFAULTS } from '../simulation/constants';
import { Wifi, Radio, AlertTriangle, Flame } from 'lucide-react';

interface NetworkCanvasProps {
  stations: Station[];
  apStation: Station;
  channel: ChannelState;
  selectedStationId: string | null;
  onSelectStation: (stationId: string) => void;
  showCarrierSenseRange: boolean;
  onToggleRange: () => void;
  showInterferenceHeatmap: boolean;
  onToggleHeatmap: () => void;
}

export const NetworkCanvas: React.FC<NetworkCanvasProps> = ({
  stations,
  apStation,
  channel,
  selectedStationId,
  onSelectStation,
  showCarrierSenseRange,
  onToggleRange,
  showInterferenceHeatmap,
  onToggleHeatmap,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const shockwavesRef = useRef<Array<{ x: number; y: number; radius: number; maxRadius: number; opacity: number }>>([]);
  const packetParticlesRef = useRef<Array<{ fromX: number; fromY: number; toX: number; toY: number; progress: number; color: string }>>([]);
  const heatmapCanvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Handle high-DPI
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    if (!rect || rect.width <= 1 || rect.height <= 1) {
      return;
    }

    canvas.width = Math.floor(rect.width * dpr);
    canvas.height = Math.floor(rect.height * dpr);
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;
    const centerX = width / 2;
    const centerY = height / 2;
    const scaleFactor = Math.min(width, height) / 80; // 80 meters diameter view
    if (!Number.isFinite(scaleFactor) || scaleFactor <= 0) {
      return;
    }

    // Trigger shockwave if collision just happened
    if (channel.status === 'COLLISION' && channel.activeTransmitters.length > 0) {
      if (Math.random() < 0.25) {
        shockwavesRef.current.push({
          x: centerX,
          y: centerY,
          radius: 10,
          maxRadius: Math.min(width, height) * 0.45,
          opacity: 0.8,
        });
      }
    }

    // Trigger packet particles for active transmitters
    for (const sta of stations) {
      if (sta.isTransmitting && Math.random() < 0.3) {
        const staX = centerX + sta.x * scaleFactor;
        const staY = centerY + sta.y * scaleFactor;
        packetParticlesRef.current.push({
          fromX: staX,
          fromY: staY,
          toX: centerX,
          toY: centerY,
          progress: 0,
          color: EDCA_DEFAULTS[sta.activeCategory]?.color || '#38bdf8',
        });
      }
    }

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // 0. Interference Heatmap Layer (Collision Zones from density and overlapping carrier sense domains)
      if (showInterferenceHeatmap) {
        // Prepare low-res offscreen canvas for smooth blurred blending
        const heatW = Math.max(120, Math.floor(width / 3));
        const heatH = Math.max(120, Math.floor(height / 3));
        if (!heatmapCanvasRef.current) {
          heatmapCanvasRef.current = document.createElement('canvas');
        }
        const hCanvas = heatmapCanvasRef.current;
        if (hCanvas.width !== heatW || hCanvas.height !== heatH) {
          hCanvas.width = heatW;
          hCanvas.height = heatH;
        }
        const hCtx = hCanvas.getContext('2d');
        if (hCtx) {
          hCtx.clearRect(0, 0, heatW, heatH);
          const heatScaleX = heatW / width;
          const heatScaleY = heatH / height;

          // Compute station transmission density and collision likelihoods
          for (const sta of stations) {
            const staX = Number.isFinite(sta.x) ? sta.x : 0;
            const staY = Number.isFinite(sta.y) ? sta.y : 0;
            const sx = (centerX + staX * scaleFactor) * heatScaleX;
            const sy = (centerY + staY * scaleFactor) * heatScaleY;

            // Interference radius proportional to station's transmission power/range
            const isAp = sta.role === 'AP';
            const radius = Math.max(1, (isAp ? 24 : 16) * scaleFactor * heatScaleX);

            // Double check all numeric values for createRadialGradient
            if (!Number.isFinite(sx) || !Number.isFinite(sy) || !Number.isFinite(radius) || radius <= 0) {
              continue;
            }

            // Intensity factored by packet arrival rate, active collisions, and queue backlog
            const queueBacklog = sta.queues?.[sta.activeCategory]?.packets?.length || 0;
            const collisionWeight = Math.min(1.0, (sta.collisionCount || 0) * 0.08);
            const txWeight = sta.isTransmitting ? 0.9 : 0.35;
            const pps = Number.isFinite(sta.packetRatePps) ? sta.packetRatePps : 150;
            const densityWeight = Math.min(1.0, (pps / 400) * 0.5 + queueBacklog * 0.04 + collisionWeight);
            const rawAlpha = densityWeight * 0.5 + txWeight * 0.5;
            const totalAlpha = Number.isFinite(rawAlpha) ? Math.max(0.05, Math.min(0.85, rawAlpha)) : 0.4;

            try {
              // Radial gradient for smooth interference field
              const radGrad = hCtx.createRadialGradient(sx, sy, 0, sx, sy, radius);
              if (sta.isTransmitting || (channel.status === 'COLLISION' && channel.activeTransmitters.includes(sta.id))) {
                // High collision surge zone (fiery red-orange)
                radGrad.addColorStop(0, `rgba(239, 68, 68, ${totalAlpha.toFixed(2)})`);
                radGrad.addColorStop(0.45, `rgba(249, 115, 22, ${(totalAlpha * 0.65).toFixed(2)})`);
                radGrad.addColorStop(0.8, `rgba(234, 179, 8, ${(totalAlpha * 0.25).toFixed(2)})`);
                radGrad.addColorStop(1, 'rgba(234, 179, 8, 0)');
              } else {
                // Ambient contention overlap zone (warm amber to subtle cyan)
                radGrad.addColorStop(0, `rgba(245, 158, 11, ${(totalAlpha * 0.6).toFixed(2)})`);
                radGrad.addColorStop(0.5, `rgba(56, 189, 248, ${(totalAlpha * 0.3).toFixed(2)})`);
                radGrad.addColorStop(1, 'rgba(56, 189, 248, 0)');
              }

              hCtx.fillStyle = radGrad;
              hCtx.beginPath();
              hCtx.arc(sx, sy, radius, 0, 2 * Math.PI);
              hCtx.fill();
            } catch {
              // Gracefully handle any browser canvas gradient exceptions
            }
          }

          // Composite the interference heatmap smoothly over the main canvas
          ctx.save();
          ctx.globalAlpha = 0.85;
          ctx.globalCompositeOperation = 'screen';
          ctx.drawImage(hCanvas, 0, 0, width, height);
          ctx.restore();
        }
      }

      // 1. Background Grid & Range Rings
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1;
      const ringDistances = [10, 20, 30]; // in meters
      ringDistances.forEach((d) => {
        const r = d * scaleFactor;
        ctx.beginPath();
        ctx.arc(centerX, centerY, r, 0, 2 * Math.PI);
        ctx.stroke();

        ctx.fillStyle = '#475569';
        ctx.font = '10px "JetBrains Mono", monospace';
        ctx.fillText(`${d}m`, centerX + r - 22, centerY - 4);
      });

      // Optional Carrier Sense Range ring (40m)
      if (showCarrierSenseRange) {
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.2)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.arc(centerX, centerY, 36 * scaleFactor, 0, 2 * Math.PI);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = '#38bdf8';
        ctx.font = '10px "Plus Jakarta Sans", sans-serif';
        ctx.fillText('Carrier Sensing Range (CCA Threshold)', centerX - 100, centerY - 36 * scaleFactor - 8);
      }

      // 2. Animate and draw Collision Shockwaves
      for (let i = shockwavesRef.current.length - 1; i >= 0; i--) {
        const sw = shockwavesRef.current[i];
        sw.radius += 2.5;
        sw.opacity *= 0.95;

        ctx.strokeStyle = `rgba(239, 68, 68, ${sw.opacity})`;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(sw.x, sw.y, sw.radius, 0, 2 * Math.PI);
        ctx.stroke();

        if (sw.radius >= sw.maxRadius || sw.opacity < 0.05) {
          shockwavesRef.current.splice(i, 1);
        }
      }

      // 3. Draw Transmission Beams / Connecting Links
      for (const sta of stations) {
        if (sta.role === 'AP') continue;
        const staX = centerX + sta.x * scaleFactor;
        const staY = centerY + sta.y * scaleFactor;

        const isTransmitting = sta.isTransmitting;
        const isCollided = channel.status === 'COLLISION' && channel.activeTransmitters.includes(sta.id);
        const isSelected = selectedStationId === sta.id;

        // Base link wire
        ctx.strokeStyle = isCollided
          ? 'rgba(239, 68, 68, 0.5)'
          : isTransmitting
          ? 'rgba(56, 189, 248, 0.6)'
          : isSelected
          ? 'rgba(255, 255, 255, 0.4)'
          : 'rgba(51, 65, 85, 0.3)';
        ctx.lineWidth = isTransmitting || isCollided ? 2 : 1;
        ctx.beginPath();
        ctx.moveTo(staX, staY);
        ctx.lineTo(centerX, centerY);
        ctx.stroke();

        // If station is actively transmitting, draw radiant glow
        if (isTransmitting) {
          const catColor = EDCA_DEFAULTS[sta.activeCategory]?.color || '#38bdf8';
          ctx.strokeStyle = isCollided ? '#ef4444' : catColor;
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(staX, staY);
          ctx.lineTo(centerX, centerY);
          ctx.stroke();
        }
      }

      // 4. Moving Airtime Packet Particles
      for (let i = packetParticlesRef.current.length - 1; i >= 0; i--) {
        const p = packetParticlesRef.current[i];
        p.progress += 0.04;
        const curX = p.fromX + (p.toX - p.fromX) * p.progress;
        const curY = p.fromY + (p.toY - p.fromY) * p.progress;

        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(curX, curY, 3, 0, 2 * Math.PI);
        ctx.fill();

        if (p.progress >= 1.0) {
          packetParticlesRef.current.splice(i, 1);
        }
      }

      // 5. Draw Central Access Point (AP)
      ctx.fillStyle = '#0f172a';
      ctx.strokeStyle = channel.status === 'COLLISION'
        ? '#ef4444'
        : channel.status === 'BUSY_TX'
        ? '#38bdf8'
        : '#64748b';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(centerX, centerY, 20, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();

      // AP Icon center
      ctx.fillStyle = channel.status === 'COLLISION' ? '#ef4444' : '#38bdf8';
      ctx.font = '11px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('AP', centerX, centerY);

      // AP Label
      ctx.fillStyle = '#94a3b8';
      ctx.font = '11px "Plus Jakarta Sans", sans-serif';
      ctx.fillText('AP Coordinator', centerX, centerY + 28);

      // 6. Draw Client Stations
      for (const sta of stations) {
        if (sta.role === 'AP') continue;
        const staX = centerX + sta.x * scaleFactor;
        const staY = centerY + sta.y * scaleFactor;
        const isSelected = selectedStationId === sta.id;
        const isTx = sta.isTransmitting;
        const isCol = channel.status === 'COLLISION' && channel.activeTransmitters.includes(sta.id);

        const catDef = EDCA_DEFAULTS[sta.activeCategory];
        const statusColor = isCol
          ? '#ef4444'
          : isTx
          ? catDef.color
          : sta.macState === 'BACKING_OFF'
          ? '#38bdf8'
          : sta.macState === 'DEFERRING_AIFS'
          ? '#818cf8'
          : '#475569';

        // Station outer ring & selection glow
        if (isSelected) {
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(staX, staY, 18, 0, 2 * Math.PI);
          ctx.stroke();
        }

        // Station node body
        ctx.fillStyle = '#0b0f19';
        ctx.strokeStyle = statusColor;
        ctx.lineWidth = isTx || isCol ? 2.5 : 1.5;
        ctx.beginPath();
        ctx.arc(staX, staY, 14, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();

        // Node ID / Text
        ctx.fillStyle = '#f1f5f9';
        ctx.font = '9px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(sta.id.replace('STA-', 'S'), staX, staY);

        // Top mini status badge: Backoff countdown or Category
        ctx.fillStyle = '#94a3b8';
        ctx.font = '9px "JetBrains Mono", monospace';
        if (isTx) {
          ctx.fillStyle = catDef.color;
          ctx.fillText('TX', staX, staY - 20);
        } else if (isCol) {
          ctx.fillStyle = '#ef4444';
          ctx.fillText('COLL', staX, staY - 20);
        } else if (sta.macState === 'BACKING_OFF') {
          ctx.fillText(`b:${sta.currentBackoff}`, staX, staY - 20);
        } else {
          ctx.fillText(`cw:${sta.currentCw}`, staX, staY - 20);
        }

        // Subtext: Category & Queue depth
        const queueDepth = sta.queues[sta.activeCategory].packets.length;
        ctx.fillStyle = '#64748b';
        ctx.font = '8px "JetBrains Mono", monospace';
        ctx.fillText(`q:${queueDepth}`, staX, staY + 22);
      }
    };

    render();
  }, [stations, apStation, channel, selectedStationId, showCarrierSenseRange, showInterferenceHeatmap]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (!rect || rect.width <= 1 || rect.height <= 1) return;
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const width = rect.width;
    const height = rect.height;
    const centerX = width / 2;
    const centerY = height / 2;
    const scaleFactor = Math.min(width, height) / 80;
    if (!Number.isFinite(scaleFactor) || scaleFactor <= 0) return;

    // Check hit radius on stations
    for (const sta of stations) {
      if (sta.role === 'AP') continue;
      const staX = centerX + (sta.x || 0) * scaleFactor;
      const staY = centerY + (sta.y || 0) * scaleFactor;
      const dist = Math.hypot(clickX - staX, clickY - staY);
      if (dist <= 20) {
        onSelectStation(sta.id);
        return;
      }
    }
  };

  return (
    <div className="relative w-full h-[380px] sm:h-[460px] compact-canvas-height bg-slate-950 rounded-xl border border-slate-800/80 overflow-hidden flex flex-col">
      {/* Canvas Header overlay */}
      <div className="absolute top-2.5 sm:top-3 left-3 sm:left-4 right-3 sm:right-4 z-10 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        <div className="flex items-center gap-2 sm:gap-3 bg-slate-900/90 backdrop-blur-md px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-lg border border-slate-800 text-xs text-slate-300 pointer-events-auto">
          <div className="flex items-center gap-1.5 font-medium text-white">
            <Radio className="w-3.5 h-3.5 text-sky-400" />
            <span className="hidden xs:inline">2D Wireless BSS Topology</span>
            <span className="xs:hidden">2D Topology</span>
          </div>
          <span className="text-slate-600 hidden sm:inline">·</span>
          <span className="text-slate-400 hidden sm:inline">Radius: 35m</span>
          <span className="text-slate-600">·</span>
          <span className="font-mono text-slate-400">{stations.length - 1} STAs</span>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 pointer-events-auto">
          {/* Channel state indicator */}
          <div className={`px-2 sm:px-2.5 py-1 rounded-lg border text-[11px] sm:text-xs font-mono flex items-center gap-1.5 ${
            channel.status === 'COLLISION'
              ? 'bg-red-500/10 border-red-500/30 text-red-400'
              : channel.status === 'BUSY_TX'
              ? 'bg-sky-500/10 border-sky-500/30 text-sky-400'
              : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
          }`}>
            <span className={`w-1.5 sm:w-2 h-1.5 sm:h-2 rounded-full ${
              channel.status === 'COLLISION' ? 'bg-red-500 animate-ping' : channel.status === 'BUSY_TX' ? 'bg-sky-400' : 'bg-emerald-400'
            }`} />
            <span>{channel.status}</span>
          </div>

          {/* Toggle carrier sensing range */}
          <button
            onClick={onToggleRange}
            className={`px-2 sm:px-2.5 py-1 rounded-lg border text-[11px] sm:text-xs font-medium transition-colors cursor-pointer ${
              showCarrierSenseRange
                ? 'bg-sky-500/20 border-sky-500/40 text-sky-300'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
            title="Toggle carrier sensing range circle"
          >
            <span className="hidden sm:inline">CCA Range</span>
            <span className="sm:hidden">CCA</span>
          </button>

          {/* Interference Heatmap toggle */}
          <button
            onClick={onToggleHeatmap}
            className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 rounded-lg border text-[11px] sm:text-xs font-medium transition-colors cursor-pointer ${
              showInterferenceHeatmap
                ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 shadow-sm shadow-amber-950/40'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
            title="Toggle interference collision heatmap overlay"
          >
            <Flame className={`w-3.5 h-3.5 ${showInterferenceHeatmap ? 'text-amber-400' : 'text-slate-400'}`} />
            <span className="hidden sm:inline">Interference Heatmap</span>
            <span className="sm:hidden">Heatmap</span>
          </button>
        </div>
      </div>

      {/* Main interactive HTML5 Canvas */}
      <canvas
        ref={canvasRef}
        onClick={handleCanvasClick}
        className="w-full h-full cursor-crosshair block"
      />

      {/* Canvas Footer Legend */}
      <div className="absolute bottom-2 left-2 sm:left-4 right-2 sm:right-4 z-10 flex flex-wrap items-center justify-between gap-1 text-[11px] sm:text-xs text-slate-400 bg-slate-950/85 backdrop-blur-sm px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg border border-slate-800/80">
        <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-[11px] sm:text-xs">
          <div className="flex items-center gap-1 sm:gap-1.5">
            <span className="w-2 h-2 rounded-full bg-red-500" />
            <span>VO</span>
          </div>
          <div className="flex items-center gap-1 sm:gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            <span>VI</span>
          </div>
          <div className="flex items-center gap-1 sm:gap-1.5">
            <span className="w-2 h-2 rounded-full bg-cyan-400" />
            <span>BE</span>
          </div>
          <div className="flex items-center gap-1 sm:gap-1.5">
            <span className="w-2 h-2 rounded-full bg-purple-500" />
            <span>BK</span>
          </div>

          {showInterferenceHeatmap && (
            <div className="flex items-center gap-1.5 pl-1.5 sm:pl-2 border-l border-slate-800 text-[10px] sm:text-[11px]">
              <span className="text-amber-300 font-medium flex items-center gap-1">
                <Flame className="w-3 h-3 text-amber-400" />
                <span className="hidden xs:inline">Collisions:</span>
              </span>
              <div className="w-12 sm:w-16 h-1.5 sm:h-2 rounded bg-gradient-to-r from-sky-400 via-amber-400 to-red-500 border border-slate-700" />
              <span className="text-[10px] text-slate-400 hidden xs:inline">Low→Severe</span>
            </div>
          )}
        </div>

        <span className="text-slate-500 text-[10px] sm:text-xs hidden md:inline">
          Tap any station node to inspect internal EDCA queues &amp; backoff
        </span>
      </div>
    </div>
  );
};

