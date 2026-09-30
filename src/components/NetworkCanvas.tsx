/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Station, ChannelState, TopologyOrientationMode } from '../types/wlan';
import { EDCA_DEFAULTS } from '../simulation/constants';
import {
  Radio,
  Flame,
  Route,
  Zap,
  ShieldAlert,
  Sparkles,
  Activity,
  Layers,
  TrendingUp,
  AlertTriangle,
  ArrowRight,
  Gauge,
  CheckCircle2,
  ChevronRight,
  Compass,
  Grid,
} from 'lucide-react';

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
  dynamicMobilityEnabled?: boolean;
  onToggleMobility?: () => void;
  topologyMode?: TopologyOrientationMode;
  onChangeTopologyMode?: (mode: TopologyOrientationMode) => void;
  onReorientTopology?: (mode?: TopologyOrientationMode) => void;
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
  dynamicMobilityEnabled = false,
  onToggleMobility,
  topologyMode = 'CONCENTRIC_TIERS',
  onChangeTopologyMode,
  onReorientTopology,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const animOffsetRef = useRef<number>(0);
  const shockwavesRef = useRef<Array<{ x: number; y: number; radius: number; maxRadius: number; opacity: number }>>([]);
  const packetParticlesRef = useRef<Array<{ fromX: number; fromY: number; toX: number; toY: number; progress: number; color: string }>>([]);
  const heatmapCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Hover interaction state
  const [hoveredStationId, setHoveredStationId] = useState<string | null>(null);
  const hoveredStationIdRef = useRef<string | null>(null);

  // Keep ref in sync with state for instantaneous 60fps render access
  useEffect(() => {
    hoveredStationIdRef.current = hoveredStationId;
  }, [hoveredStationId]);

  // Determine active station (hover takes precedence, fallback to selected)
  const activeStationId = hoveredStationId || selectedStationId;
  const activeStation = useMemo(() => {
    if (!activeStationId) return null;
    return stations.find((s) => s.id === activeStationId) || null;
  }, [activeStationId, stations]);

  // Find neighbor stations falling within the 35m interference domain of active station
  const interferingNeighbors = useMemo(() => {
    if (!activeStation || activeStation.role === 'AP') return [];
    return stations.filter(
      (s) =>
        s.role === 'STATION' &&
        s.id !== activeStation.id &&
        Math.hypot(activeStation.x - s.x, activeStation.y - s.y) <= 35
    );
  }, [activeStation, stations]);

  // Compute live queue depth breakdown and throughput telemetry for active hovered station
  const staTelemetry = useMemo(() => {
    if (!activeStation || activeStation.role === 'AP') return null;
    const qVO = activeStation.queues?.AC_VO?.packets?.length || 0;
    const qVI = activeStation.queues?.AC_VI?.packets?.length || 0;
    const qBE = activeStation.queues?.AC_BE?.packets?.length || 0;
    const qBK = activeStation.queues?.AC_BK?.packets?.length || 0;
    const totalQueueDepth = qVO + qVI + qBE + qBK;

    const throughputMb = (activeStation.bytesTransmitted * 8) / 1e6;
    const totalAttempts = activeStation.packetsTransmitted + activeStation.collisionCount;
    const collisionRatePct = totalAttempts > 0 ? (activeStation.collisionCount / totalAttempts) * 100 : 0;

    // Azimuth degrees (0° North, 90° East, 180° South, 270° West)
    const azimuthDeg = Math.round((Math.atan2(activeStation.x, -activeStation.y) * 180 / Math.PI + 360) % 360);
    const cardinalHeading =
      azimuthDeg >= 337.5 || azimuthDeg < 22.5
        ? 'N'
        : azimuthDeg < 67.5
        ? 'NE'
        : azimuthDeg < 112.5
        ? 'E'
        : azimuthDeg < 157.5
        ? 'SE'
        : azimuthDeg < 202.5
        ? 'S'
        : azimuthDeg < 247.5
        ? 'SW'
        : azimuthDeg < 292.5
        ? 'W'
        : 'NW';

    return {
      qVO,
      qVI,
      qBE,
      qBK,
      totalQueueDepth,
      throughputMb,
      totalAttempts,
      collisionRatePct,
      azimuthDeg,
      cardinalHeading,
    };
  }, [activeStation]);

  // Unified scale factor helper ensuring 35m BSS polar radius has generous margin on all screens
  const getScaleFactor = (w: number, h: number) => {
    const maxRadiusMeters = 35;
    const margin = 48; // Generous 48px margin ensures stations, rings, and telemetry badges never clip edges
    return Math.max(
      0.1,
      Math.min((w - margin * 2) / (maxRadiusMeters * 2), (h - margin * 2) / (maxRadiusMeters * 2))
    );
  };

  // Calculate canvas pixel position for anchoring tooltip directly to station node
  const nodePixelPos = useMemo(() => {
    if (!activeStation || activeStation.role === 'AP' || !canvasRef.current) return null;
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    if (!width || !height) return null;

    const centerX = width / 2;
    const centerY = height / 2;
    const scaleFactor = getScaleFactor(width, height);

    const staX = centerX + (activeStation.x || 0) * scaleFactor;
    const staY = centerY + (activeStation.y || 0) * scaleFactor;

    const tooltipWidth = 265;
    const tooltipHeight = 280;

    // Anchor to the right of node if space permits, otherwise flip to left
    let left = staX + 22;
    let flipLeft = false;
    if (left + tooltipWidth > width - 12) {
      left = staX - tooltipWidth - 22;
      flipLeft = true;
    }
    // Safely clamp horizontally within viewport
    left = Math.max(12, Math.min(width - tooltipWidth - 12, left));

    // Clamp vertically within canvas viewport so tooltip is always fully visible
    let top = Math.max(12, Math.min(height - tooltipHeight - 12, staY - 45));

    return { left, top, staX, staY, flipLeft };
  }, [activeStation]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Trigger shockwave if collision just happened
    if (channel.status === 'COLLISION' && channel.activeTransmitters.length > 0) {
      if (Math.random() < 0.25) {
        const rect = canvas.getBoundingClientRect();
        const width = rect.width;
        const height = rect.height;
        shockwavesRef.current.push({
          x: width / 2,
          y: height / 2,
          radius: 10,
          maxRadius: Math.min(width, height) * 0.45,
          opacity: 0.8,
        });
      }
    }

    // Trigger packet particles for active transmitters
    for (const sta of stations) {
      if (sta.isTransmitting && Math.random() < 0.3) {
        const rect = canvas.getBoundingClientRect();
        const width = rect.width;
        const height = rect.height;
        const scaleFactor = getScaleFactor(width, height);
        const centerX = width / 2;
        const centerY = height / 2;
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
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      if (!rect || rect.width <= 1 || rect.height <= 1) return;

      if (canvas.width !== Math.floor(rect.width * dpr) || canvas.height !== Math.floor(rect.height * dpr)) {
        canvas.width = Math.floor(rect.width * dpr);
        canvas.height = Math.floor(rect.height * dpr);
      }

      ctx.save();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const width = rect.width;
      const height = rect.height;
      const centerX = width / 2;
      const centerY = height / 2;
      const scaleFactor = getScaleFactor(width, height);
      if (!Number.isFinite(scaleFactor) || scaleFactor <= 0) {
        ctx.restore();
        return;
      }

      ctx.clearRect(0, 0, width, height);

      // Increment dash offset for continuous radar/path flow animation
      animOffsetRef.current = (animOffsetRef.current + 0.35) % 40;

      // 0. Interference Heatmap Layer (if toggled)
      if (showInterferenceHeatmap) {
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

          for (const sta of stations) {
            const staX = Number.isFinite(sta.x) ? sta.x : 0;
            const staY = Number.isFinite(sta.y) ? sta.y : 0;
            const sx = (centerX + staX * scaleFactor) * heatScaleX;
            const sy = (centerY + staY * scaleFactor) * heatScaleY;
            const isAp = sta.role === 'AP';
            const radius = Math.max(1, (isAp ? 24 : 16) * scaleFactor * heatScaleX);

            if (!Number.isFinite(sx) || !Number.isFinite(sy) || !Number.isFinite(radius) || radius <= 0) {
              continue;
            }

            const queueBacklog = sta.queues?.[sta.activeCategory]?.packets?.length || 0;
            const collisionWeight = Math.min(1.0, (sta.collisionCount || 0) * 0.08);
            const txWeight = sta.isTransmitting ? 0.9 : 0.35;
            const pps = Number.isFinite(sta.packetRatePps) ? sta.packetRatePps : 150;
            const densityWeight = Math.min(1.0, (pps / 400) * 0.5 + queueBacklog * 0.04 + collisionWeight);
            const rawAlpha = densityWeight * 0.5 + txWeight * 0.5;
            const totalAlpha = Number.isFinite(rawAlpha) ? Math.max(0.05, Math.min(0.85, rawAlpha)) : 0.4;

            try {
              const radGrad = hCtx.createRadialGradient(sx, sy, 0, sx, sy, radius);
              if (sta.isTransmitting || (channel.status === 'COLLISION' && channel.activeTransmitters.includes(sta.id))) {
                radGrad.addColorStop(0, `rgba(239, 68, 68, ${totalAlpha.toFixed(2)})`);
                radGrad.addColorStop(0.45, `rgba(249, 115, 22, ${(totalAlpha * 0.65).toFixed(2)})`);
                radGrad.addColorStop(0.8, `rgba(234, 179, 8, ${(totalAlpha * 0.25).toFixed(2)})`);
                radGrad.addColorStop(1, 'rgba(234, 179, 8, 0)');
              } else {
                radGrad.addColorStop(0, `rgba(245, 158, 11, ${(totalAlpha * 0.6).toFixed(2)})`);
                radGrad.addColorStop(0.5, `rgba(56, 189, 248, ${(totalAlpha * 0.3).toFixed(2)})`);
                radGrad.addColorStop(1, 'rgba(56, 189, 248, 0)');
              }
              hCtx.fillStyle = radGrad;
              hCtx.beginPath();
              hCtx.arc(sx, sy, radius, 0, 2 * Math.PI);
              hCtx.fill();
            } catch {
              // Gracefully continue
            }
          }

          ctx.save();
          ctx.globalAlpha = 0.85;
          ctx.globalCompositeOperation = 'screen';
          ctx.drawImage(hCanvas, 0, 0, width, height);
          ctx.restore();
        }
      }

      // 1. Structured Polar Crosshairs & Cardinal Direction Axis Markers
      ctx.save();
      ctx.setLineDash([3, 4]);
      ctx.strokeStyle = 'rgba(51, 65, 85, 0.45)';
      ctx.lineWidth = 1;

      // Vertical Polar Axis (North - South)
      ctx.beginPath();
      ctx.moveTo(centerX, centerY - 35 * scaleFactor);
      ctx.lineTo(centerX, centerY + 35 * scaleFactor);
      ctx.stroke();

      // Horizontal Polar Axis (West - East)
      ctx.beginPath();
      ctx.moveTo(centerX - 35 * scaleFactor, centerY);
      ctx.lineTo(centerX + 35 * scaleFactor, centerY);
      ctx.stroke();
      ctx.setLineDash([]);

      // Cardinal Labels (N, E, S, W) safely clamped inside canvas bounds
      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // North (0° azimuth)
      ctx.fillStyle = '#38bdf8';
      const northY = Math.max(14, centerY - 35 * scaleFactor - 10);
      ctx.fillText('N · 0°', centerX, northY);

      // East (90° azimuth)
      ctx.fillStyle = '#94a3b8';
      const eastX = Math.min(width - 24, centerX + 35 * scaleFactor + 14);
      ctx.fillText('E · 90°', eastX, centerY);

      // South (180° azimuth)
      ctx.fillStyle = '#94a3b8';
      const southY = Math.min(height - 12, centerY + 35 * scaleFactor + 12);
      ctx.fillText('S · 180°', centerX, southY);

      // West (270° azimuth)
      ctx.fillStyle = '#94a3b8';
      const westX = Math.max(24, centerX - 35 * scaleFactor - 14);
      ctx.fillText('W · 270°', westX, centerY);

      // Concentric Distance Rings: 10m (Inner Tier), 20m (Mid Tier), 30m (Cell Edge)
      const ringTiers = [
        { d: 10, label: '10m Inner', color: '#1e293b' },
        { d: 20, label: '20m Mid', color: '#1e293b' },
        { d: 30, label: '30m Edge', color: '#1e293b' },
      ];

      ringTiers.forEach(({ d, label, color }) => {
        const r = d * scaleFactor;
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(centerX, centerY, r, 0, 2 * Math.PI);
        ctx.stroke();

        // Position distance labels along diagonal (45° azimuth) safely inside canvas
        const diagX = Math.min(width - 75, centerX + r * Math.SQRT1_2);
        const diagY = Math.max(20, centerY - r * Math.SQRT1_2);
        const textW = ctx.measureText(label).width;
        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
        ctx.fillRect(diagX - 2, diagY - 7, textW + 6, 14);
        ctx.fillStyle = '#64748b';
        ctx.font = '9px "JetBrains Mono", monospace';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, diagX + 1, diagY);
      });
      ctx.restore();

      // Global Carrier Sense Range ring around AP (if toggled)
      if (showCarrierSenseRange) {
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.2)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.arc(centerX, centerY, 35 * scaleFactor, 0, 2 * Math.PI);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = '#38bdf8';
        ctx.font = '10px "Plus Jakarta Sans", sans-serif';
        ctx.textAlign = 'center';
        const csY = Math.max(16, centerY - 35 * scaleFactor - 8);
        ctx.fillText('Global AP Carrier Sense (35m)', centerX, csY);
      }

      // Predefined Motion Path Guides (if mobility mode is active)
      if (dynamicMobilityEnabled) {
        ctx.save();
        ctx.setLineDash([3, 5]);
        ctx.lineWidth = 1;

        for (const sta of stations) {
          if (sta.role === 'AP') continue;
          const pathType = sta.mobilityPath || 'CIRCULAR';
          const baseRad = (sta.baseRadius || 18) * scaleFactor;
          const baseAng = sta.baseAngle || 0;

          if (pathType === 'CIRCULAR') {
            ctx.strokeStyle = 'rgba(56, 189, 248, 0.16)';
            ctx.beginPath();
            ctx.arc(centerX, centerY, baseRad, 0, 2 * Math.PI);
            ctx.stroke();
          } else if (pathType === 'FIGURE_EIGHT') {
            ctx.strokeStyle = 'rgba(168, 85, 247, 0.2)';
            ctx.beginPath();
            const steps = 40;
            for (let i = 0; i <= steps; i++) {
              const t = (i / steps) * 2 * Math.PI + baseAng;
              const scale = Math.max(12, sta.baseRadius || 18) * scaleFactor;
              const px = centerX + (scale * Math.cos(t)) / (1 + Math.sin(t) * Math.sin(t));
              const py = centerY + (scale * Math.sin(t) * Math.cos(t)) / (1 + Math.sin(t) * Math.sin(t));
              if (i === 0) ctx.moveTo(px, py);
              else ctx.lineTo(px, py);
            }
            ctx.stroke();
          } else if (pathType === 'RADIAL_CONVERGE') {
            ctx.strokeStyle = 'rgba(234, 179, 8, 0.18)';
            ctx.beginPath();
            const minR = 6 * scaleFactor;
            const maxR = baseRad;
            ctx.moveTo(centerX + Math.cos(baseAng) * minR, centerY + Math.sin(baseAng) * minR);
            ctx.lineTo(centerX + Math.cos(baseAng) * maxR, centerY + Math.sin(baseAng) * maxR);
            ctx.stroke();
          }
        }
        ctx.restore();
      }

      // 2. Collision Shockwaves
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

      // 3. TARGET STATION HOVER EFFECT: Highlight Individual Interference Range & Contention Domain
      const activeSta = stations.find((s) => s.id === (hoveredStationIdRef.current || selectedStationId));
      if (activeSta && activeSta.role === 'STATION') {
        const hX = centerX + activeSta.x * scaleFactor;
        const hY = centerY + activeSta.y * scaleFactor;

        ctx.save();

        // 3A. Outer 35m CCA Interference Domain
        const intRadius = 35 * scaleFactor;
        ctx.setLineDash([6, 5]);
        ctx.lineDashOffset = -animOffsetRef.current;
        ctx.strokeStyle = 'rgba(245, 158, 11, 0.75)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(hX, hY, intRadius, 0, 2 * Math.PI);
        ctx.stroke();

        // Radial gradient aura for interference domain
        const intGrad = ctx.createRadialGradient(hX, hY, 10, hX, hY, intRadius);
        intGrad.addColorStop(0, 'rgba(245, 158, 11, 0.02)');
        intGrad.addColorStop(0.7, 'rgba(245, 158, 11, 0.06)');
        intGrad.addColorStop(1, 'rgba(245, 158, 11, 0.16)');
        ctx.fillStyle = intGrad;
        ctx.beginPath();
        ctx.arc(hX, hY, intRadius, 0, 2 * Math.PI);
        ctx.fill();

        // 3B. Inner 22m Transmission Range
        const txRadius = 22 * scaleFactor;
        ctx.setLineDash([4, 4]);
        ctx.lineDashOffset = animOffsetRef.current;
        ctx.strokeStyle = 'rgba(6, 182, 212, 0.8)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(hX, hY, txRadius, 0, 2 * Math.PI);
        ctx.stroke();

        const txGrad = ctx.createRadialGradient(hX, hY, 4, hX, hY, txRadius);
        txGrad.addColorStop(0, 'rgba(6, 182, 212, 0.03)');
        txGrad.addColorStop(1, 'rgba(6, 182, 212, 0.12)');
        ctx.fillStyle = txGrad;
        ctx.beginPath();
        ctx.arc(hX, hY, txRadius, 0, 2 * Math.PI);
        ctx.fill();

        // Range boundary text labels safely oriented inside canvas
        ctx.setLineDash([]);
        ctx.fillStyle = '#f59e0b';
        ctx.font = '10px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        const intLabelY = hY - intRadius - 7 < 18 ? hY - intRadius + 16 : hY - intRadius - 7;
        const clampedIntX = Math.max(90, Math.min(width - 90, hX));
        ctx.fillText('35m CCA Interference Domain', clampedIntX, intLabelY);

        ctx.fillStyle = '#06b6d4';
        ctx.font = '9px "JetBrains Mono", monospace';
        const txLabelY = hY - txRadius - 5 < 16 ? hY - txRadius + 14 : hY - txRadius - 5;
        const clampedTxX = Math.max(60, Math.min(width - 60, hX));
        ctx.fillText('22m Tx Range', clampedTxX, txLabelY);

        // 3C. Highlight Neighboring Stations inside this 35m Interference Domain
        for (const other of stations) {
          if (other.id === activeSta.id || other.role === 'AP') continue;
          const distM = Math.hypot(activeSta.x - other.x, activeSta.y - other.y);
          if (distM <= 35) {
            const oX = centerX + other.x * scaleFactor;
            const oY = centerY + other.y * scaleFactor;

            // Dashed contention link line
            ctx.setLineDash([3, 4]);
            ctx.strokeStyle = 'rgba(245, 158, 11, 0.55)';
            ctx.lineWidth = 1.25;
            ctx.beginPath();
            ctx.moveTo(hX, hY);
            ctx.lineTo(oX, oY);
            ctx.stroke();

            // Distance tag midway between nodes safely inside canvas
            const midX = (hX + oX) / 2;
            const midY = (hY + oY) / 2;
            const clampedMidX = Math.max(20, Math.min(width - 20, midX));
            const clampedMidY = Math.max(10, Math.min(height - 10, midY));
            ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
            ctx.fillRect(clampedMidX - 16, clampedMidY - 7, 32, 14);
            ctx.strokeStyle = 'rgba(245, 158, 11, 0.6)';
            ctx.strokeRect(clampedMidX - 16, clampedMidY - 7, 32, 14);
            ctx.fillStyle = '#fde68a';
            ctx.font = '8px "JetBrains Mono", monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(`${distM.toFixed(1)}m`, clampedMidX, clampedMidY);

            // Contender warning aura around neighbor node
            ctx.setLineDash([]);
            ctx.strokeStyle = 'rgba(245, 158, 11, 0.85)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(oX, oY, 18, 0, 2 * Math.PI);
            ctx.stroke();
          }
        }

        ctx.restore();
      }

      // 4. Base Connection Lines from stations to AP
      for (const sta of stations) {
        if (sta.role === 'AP') continue;
        const staX = centerX + sta.x * scaleFactor;
        const staY = centerY + sta.y * scaleFactor;

        const isTransmitting = sta.isTransmitting;
        const isCollided = channel.status === 'COLLISION' && channel.activeTransmitters.includes(sta.id);
        const isSelected = selectedStationId === sta.id;
        const isHovered = hoveredStationIdRef.current === sta.id;

        // Base wire
        ctx.strokeStyle = isCollided
          ? 'rgba(239, 68, 68, 0.5)'
          : isTransmitting
          ? 'rgba(56, 189, 248, 0.6)'
          : isSelected || isHovered
          ? 'rgba(255, 255, 255, 0.4)'
          : 'rgba(51, 65, 85, 0.3)';
        ctx.lineWidth = isTransmitting || isCollided ? 2 : 1;
        ctx.beginPath();
        ctx.moveTo(staX, staY);
        ctx.lineTo(centerX, centerY);
        ctx.stroke();

        // Active transmitting beam glow
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

      // 5. TARGET STATION HOVER EFFECT: Highlight Individual AP Connectivity Path
      if (activeSta && activeSta.role === 'STATION') {
        const hX = centerX + activeSta.x * scaleFactor;
        const hY = centerY + activeSta.y * scaleFactor;

        ctx.save();
        // High-intensity outer radiant aura
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(hX, hY);
        ctx.lineTo(centerX, centerY);
        ctx.stroke();

        // Core bright connectivity beam
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(hX, hY);
        ctx.lineTo(centerX, centerY);
        ctx.stroke();

        // Traveling energy wavelets along connectivity path
        const numWavelets = 3;
        for (let w = 0; w < numWavelets; w++) {
          const progress = ((animOffsetRef.current * 0.04 + w / numWavelets) % 1);
          const wx = hX + (centerX - hX) * progress;
          const wy = hY + (centerY - hY) * progress;
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(wx, wy, 2.5, 0, 2 * Math.PI);
          ctx.fill();
        }

        // Midpoint Callout Badge on the connection path safely clamped inside viewport
        const linkMidX = (hX + centerX) / 2;
        const linkMidY = (hY + centerY) / 2;
        const calloutText = `${activeSta.distanceToAp.toFixed(1)}m · ${activeSta.snrDb}dB · ${activeSta.phyRateMbps}M`;
        ctx.font = '9px "JetBrains Mono", monospace';
        const txtWidth = ctx.measureText(calloutText).width;
        const boxW = txtWidth + 14;
        const boxH = 18;

        const clampedMidX = Math.max(boxW / 2 + 10, Math.min(width - boxW / 2 - 10, linkMidX));
        const clampedMidY = Math.max(boxH / 2 + 10, Math.min(height - boxH / 2 - 10, linkMidY));

        ctx.fillStyle = 'rgba(15, 23, 42, 0.94)';
        ctx.beginPath();
        ctx.roundRect(clampedMidX - boxW / 2, clampedMidY - boxH / 2, boxW, boxH, 4);
        ctx.fill();
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.7)';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.fillStyle = '#7dd3fc';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(calloutText, clampedMidX, clampedMidY);
        ctx.restore();
      }

      // 6. Moving Airtime Packet Particles
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

      // 7. Central Access Point (AP) Coordinator
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

      ctx.fillStyle = channel.status === 'COLLISION' ? '#ef4444' : '#38bdf8';
      ctx.font = '11px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('AP', centerX, centerY);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '11px "Plus Jakarta Sans", sans-serif';
      ctx.fillText('AP Coordinator', centerX, centerY + 28);

      // 8. Draw Client Stations
      for (const sta of stations) {
        if (sta.role === 'AP') continue;
        const staX = centerX + sta.x * scaleFactor;
        const staY = centerY + sta.y * scaleFactor;
        const isSelected = selectedStationId === sta.id;
        const isHovered = hoveredStationIdRef.current === sta.id;
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

        // Hover or Selection focus ring
        if (isHovered || isSelected) {
          ctx.strokeStyle = isHovered ? '#38bdf8' : '#ffffff';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.arc(staX, staY, 19, 0, 2 * Math.PI);
          ctx.stroke();
        }

        // Station node circle body
        ctx.fillStyle = '#0b0f19';
        ctx.strokeStyle = isHovered ? '#38bdf8' : statusColor;
        ctx.lineWidth = isTx || isCol || isHovered ? 2.5 : 1.5;
        ctx.beginPath();
        ctx.arc(staX, staY, 14, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();

        // Node ID Text
        ctx.fillStyle = isHovered ? '#38bdf8' : '#f1f5f9';
        ctx.font = '9px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(sta.id.replace('STA-', 'S'), staX, staY);

        // Status pill above station (oriented and clamped safely)
        ctx.fillStyle = '#94a3b8';
        ctx.font = '9px "JetBrains Mono", monospace';
        const pillY = staY - 20 < 12 ? staY + 22 : staY - 20;
        const subtextY = staY - 20 < 12 ? staY + 32 : staY + 22;

        if (isTx) {
          ctx.fillStyle = catDef.color;
          ctx.fillText('TX', staX, pillY);
        } else if (isCol) {
          ctx.fillStyle = '#ef4444';
          ctx.fillText('COLL', staX, pillY);
        } else if (sta.macState === 'BACKING_OFF') {
          ctx.fillText(`b:${sta.currentBackoff}`, staX, pillY);
        } else {
          ctx.fillText(`cw:${sta.currentCw}`, staX, pillY);
        }

        // Subtext: Category & Queue depth
        const queueDepth = sta.queues[sta.activeCategory]?.packets?.length || 0;
        ctx.fillStyle = '#64748b';
        ctx.font = '8px "JetBrains Mono", monospace';
        ctx.fillText(`q:${queueDepth}`, staX, subtextY);
      }

      ctx.restore();
    };

    // Continuous 60fps animation frame loop for glowing lines, traveling waves, and live hover
    let animId: number;
    const loop = () => {
      render();
      animId = requestAnimationFrame(loop);
    };
    animId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [
    stations,
    apStation,
    channel,
    selectedStationId,
    showCarrierSenseRange,
    showInterferenceHeatmap,
    dynamicMobilityEnabled,
  ]);

  // Mouse move handler for live hover detection
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (!rect || rect.width <= 1 || rect.height <= 1) return;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const width = rect.width;
    const height = rect.height;
    const centerX = width / 2;
    const centerY = height / 2;
    const scaleFactor = getScaleFactor(width, height);
    if (!Number.isFinite(scaleFactor) || scaleFactor <= 0) return;

    let foundId: string | null = null;
    for (const sta of stations) {
      if (sta.role === 'AP') continue;
      const staX = centerX + (sta.x || 0) * scaleFactor;
      const staY = centerY + (sta.y || 0) * scaleFactor;
      const dist = Math.hypot(mouseX - staX, mouseY - staY);
      if (dist <= 22) {
        foundId = sta.id;
        break;
      }
    }

    if (foundId !== hoveredStationId) {
      setHoveredStationId(foundId);
    }
    canvas.style.cursor = foundId ? 'pointer' : 'crosshair';
  };

  const handleMouseLeave = () => {
    setHoveredStationId(null);
    if (canvasRef.current) {
      canvasRef.current.style.cursor = 'crosshair';
    }
  };

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
    const scaleFactor = getScaleFactor(width, height);
    if (!Number.isFinite(scaleFactor) || scaleFactor <= 0) return;

    // Check hit radius on stations
    for (const sta of stations) {
      if (sta.role === 'AP') continue;
      const staX = centerX + (sta.x || 0) * scaleFactor;
      const staY = centerY + (sta.y || 0) * scaleFactor;
      const dist = Math.hypot(clickX - staX, clickY - staY);
      if (dist <= 22) {
        onSelectStation(sta.id);
        return;
      }
    }
  };

  return (
    <div className="w-full bg-slate-950 rounded-xl border border-slate-800/80 overflow-hidden flex flex-col shadow-lg shadow-slate-950/50">
      {/* 1. Structured Header Bar */}
      <div className="bg-slate-900/90 border-b border-slate-800/80 px-3 sm:px-4 py-2.5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 sm:gap-2.5 text-xs text-slate-300">
          <div className="flex items-center gap-1.5 font-semibold text-white">
            <Radio className="w-4 h-4 text-sky-400" />
            <span>Wireless BSS Topology</span>
          </div>
          <span className="text-slate-600 hidden sm:inline">·</span>
          <span className="font-mono text-slate-400 text-[11px] hidden sm:inline">35m Radius</span>
          <span className="text-slate-600">·</span>
          <span className="font-mono text-sky-400 text-[11px] font-semibold">{stations.length - 1} STAs</span>

          {/* Active Hover / Selection Indicator Chip */}
          {activeStation && (
            <span className="hidden md:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono bg-sky-500/15 text-sky-300 border border-sky-500/30 animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
              <span>Target: {activeStation.id} ({activeStation.distanceToAp.toFixed(1)}m)</span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 ml-auto">
          {/* Channel State Indicator */}
          <div
            className={`px-2.5 py-1 rounded-md border text-[11px] font-mono flex items-center gap-1.5 ${
              channel.status === 'COLLISION'
                ? 'bg-red-500/15 border-red-500/40 text-red-400'
                : channel.status === 'BUSY_TX'
                ? 'bg-sky-500/15 border-sky-500/40 text-sky-400'
                : 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                channel.status === 'COLLISION'
                  ? 'bg-red-500 animate-ping'
                  : channel.status === 'BUSY_TX'
                  ? 'bg-sky-400'
                  : 'bg-emerald-400'
              }`}
            />
            <span className="font-semibold">{channel.status}</span>
          </div>

          {/* Topology Orientation Layout Selector */}
          <div className="flex items-center gap-1 bg-slate-950/80 border border-slate-800 rounded-md px-2 py-0.5 text-xs">
            <Compass className="w-3.5 h-3.5 text-sky-400 shrink-0" />
            <select
              value={topologyMode || 'CONCENTRIC_TIERS'}
              onChange={(e) => {
                const mode = e.target.value as TopologyOrientationMode;
                onChangeTopologyMode?.(mode);
                onReorientTopology?.(mode);
              }}
              className="bg-transparent text-slate-200 text-xs font-medium focus:outline-none cursor-pointer py-0.5"
              title="Select spatial topology orientation pattern"
            >
              <option value="CONCENTRIC_TIERS" className="bg-slate-900 text-slate-200">Balanced Concentric Rings</option>
              <option value="RADIAL_STAR" className="bg-slate-900 text-slate-200">Radial Star Spokes</option>
              <option value="UNIFORM_HEXAGONAL" className="bg-slate-900 text-slate-200">Hexagonal Grid</option>
              <option value="PERIMETER_RING" className="bg-slate-900 text-slate-200">Perimeter Ring (21m)</option>
              <option value="HIDDEN_TERMINAL_PAIRS" className="bg-slate-900 text-slate-200">Hidden Node Testbed (46m)</option>
            </select>
          </div>

          {/* Re-orient Topology button */}
          {onReorientTopology && (
            <button
              onClick={() => onReorientTopology(topologyMode)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-md border border-slate-800 bg-slate-900 text-xs font-medium text-slate-300 hover:text-white hover:border-sky-500/50 hover:bg-sky-500/10 transition-colors cursor-pointer"
              title="Re-orient all stations into balanced RF coordinates"
            >
              <Compass className="w-3.5 h-3.5 text-sky-400" />
              <span className="hidden sm:inline">Re-orient</span>
            </button>
          )}

          {/* Toggle carrier sensing range */}
          <button
            onClick={onToggleRange}
            className={`px-2.5 py-1 rounded-md border text-xs font-medium transition-colors cursor-pointer ${
              showCarrierSenseRange
                ? 'bg-sky-500/20 border-sky-500/40 text-sky-300 font-semibold'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
            title="Toggle carrier sensing range circle"
          >
            <span>CCA Range</span>
          </button>

          {/* Interference Heatmap toggle */}
          <button
            onClick={onToggleHeatmap}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md border text-xs font-medium transition-colors cursor-pointer ${
              showInterferenceHeatmap
                ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 font-semibold'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
            title="Toggle interference collision heatmap overlay"
          >
            <Flame className={`w-3.5 h-3.5 ${showInterferenceHeatmap ? 'text-amber-400' : 'text-slate-400'}`} />
            <span>Heatmap</span>
          </button>

          {/* Dynamic Mobility Paths toggle */}
          {onToggleMobility && (
            <button
              onClick={onToggleMobility}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md border text-xs font-medium transition-colors cursor-pointer ${
                dynamicMobilityEnabled
                  ? 'bg-purple-500/20 border-purple-500/50 text-purple-300 font-semibold shadow-sm'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
              title="Simulate dynamic station motion along predefined trajectory paths"
            >
              <Route className={`w-3.5 h-3.5 ${dynamicMobilityEnabled ? 'text-purple-400 animate-pulse' : 'text-slate-400'}`} />
              <span>Mobility</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Pristine Canvas Viewport with Clean Station Hover HUD */}
      <div className="relative w-full h-[380px] sm:h-[440px] md:h-[490px] bg-slate-950 flex-1 overflow-hidden">
        {/* Real-time HTML5 Canvas */}
        <canvas
          ref={canvasRef}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          onClick={handleCanvasClick}
          className="w-full h-full block"
        />

        {/* Polar Orientation Rose (Top-Right of Viewport) */}
        <div className="absolute top-3 right-3 z-20 bg-slate-950/90 backdrop-blur-md border border-slate-800/90 rounded-xl px-2.5 py-1.5 shadow-lg text-[10px] font-mono text-slate-400 pointer-events-none flex items-center gap-2">
          <div className="w-5 h-5 rounded-full border border-sky-500/50 bg-sky-500/15 flex items-center justify-center relative shadow-sm">
            <span className="text-[9px] font-bold text-sky-400">N</span>
            <div className="absolute -top-1 w-1 h-1.5 bg-sky-400 rounded-full" />
          </div>
          <div className="flex flex-col leading-tight">
            <div className="flex items-center gap-1.5">
              <span className="text-white font-semibold">BSS Polar Grid</span>
              <span className="text-[9px] px-1 py-0.2 rounded bg-sky-500/20 text-sky-300 font-mono">
                {topologyMode === 'RADIAL_STAR'
                  ? 'Radial'
                  : topologyMode === 'UNIFORM_HEXAGONAL'
                  ? 'Hexagonal'
                  : topologyMode === 'PERIMETER_RING'
                  ? 'Perimeter'
                  : topologyMode === 'HIDDEN_TERMINAL_PAIRS'
                  ? 'Hidden Node'
                  : 'Concentric'}
              </span>
            </div>
            <span className="text-[9px] text-slate-500">True 0°–360° Azimuth</span>
          </div>
        </div>

        {/* Station-Anchored Live Telemetry Tooltip */}
        {activeStation && activeStation.role === 'STATION' && nodePixelPos && staTelemetry && (
          <div
            style={{
              left: `${nodePixelPos.left}px`,
              top: `${nodePixelPos.top}px`,
            }}
            className="absolute z-30 bg-slate-950/95 backdrop-blur-md border border-slate-700/90 rounded-xl p-3 shadow-2xl w-[265px] max-h-[calc(100%-24px)] overflow-y-auto pointer-events-none text-xs flex flex-col gap-2 animate-in fade-in zoom-in-95 duration-100"
          >
            {/* Header info */}
            <div className="flex items-center justify-between pb-1.5 border-b border-slate-800">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: activeStation.color }} />
                <span className="font-bold text-white font-mono">{activeStation.id}</span>
                <span className="text-[10px] text-slate-400 font-sans truncate">
                  ({activeStation.trafficPattern.replace('_', ' ')})
                </span>
              </div>
              <span
                className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold shrink-0 ${
                  activeStation.macState === 'COLLIDED'
                    ? 'bg-red-500/20 text-red-300 border border-red-500/40'
                    : activeStation.isTransmitting
                    ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40 animate-pulse'
                    : 'bg-slate-800 text-slate-300'
                }`}
              >
                {activeStation.macState}
              </span>
            </div>

            {/* LIVE TELEMETRY 1: Current Queue Depth Breakdown */}
            <div className="bg-slate-900/90 p-2 rounded-lg border border-slate-800/90 flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-[11px] font-mono">
                <span className="text-slate-400 flex items-center gap-1">
                  <Layers className="w-3 h-3 text-purple-400" />
                  <span>Queue Depth:</span>
                </span>
                <span className="font-bold text-white">
                  {staTelemetry.totalQueueDepth} pkts
                </span>
              </div>

              {/* 4 EDCA Queues Depth Badges */}
              <div className="grid grid-cols-4 gap-1 text-[9px] font-mono text-center">
                <div className="bg-slate-950/80 p-1 rounded border border-red-500/30">
                  <span className="text-red-400 font-semibold block">VO</span>
                  <span className="text-white font-bold">{staTelemetry.qVO}</span>
                </div>
                <div className="bg-slate-950/80 p-1 rounded border border-amber-500/30">
                  <span className="text-amber-400 font-semibold block">VI</span>
                  <span className="text-white font-bold">{staTelemetry.qVI}</span>
                </div>
                <div className="bg-slate-950/80 p-1 rounded border border-cyan-500/30">
                  <span className="text-cyan-400 font-semibold block">BE</span>
                  <span className="text-white font-bold">{staTelemetry.qBE}</span>
                </div>
                <div className="bg-slate-950/80 p-1 rounded border border-purple-500/30">
                  <span className="text-purple-400 font-semibold block">BK</span>
                  <span className="text-white font-bold">{staTelemetry.qBK}</span>
                </div>
              </div>
            </div>

            {/* LIVE TELEMETRY 2: Individual Throughput & Delivery Metrics */}
            <div className="bg-slate-900/90 p-2 rounded-lg border border-slate-800/90 flex flex-col gap-1">
              <div className="flex items-center justify-between text-[11px] font-mono">
                <span className="text-slate-400 flex items-center gap-1">
                  <TrendingUp className="w-3 h-3 text-sky-400" />
                  <span>Throughput:</span>
                </span>
                <span className="font-bold text-sky-300">
                  {staTelemetry.throughputMb.toFixed(2)} MB
                </span>
              </div>

              <div className="grid grid-cols-2 gap-1 text-[10px] font-mono text-slate-300 pt-1 border-t border-slate-800/60">
                <div className="flex justify-between">
                  <span className="text-slate-500">Delivered:</span>
                  <span className="text-white font-semibold">{activeStation.packetsTransmitted}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Collision:</span>
                  <span className={staTelemetry.collisionRatePct > 20 ? 'text-red-400 font-bold' : 'text-slate-300'}>
                    {staTelemetry.collisionRatePct.toFixed(0)}%
                  </span>
                </div>
              </div>
            </div>

            {/* Contention & Delay Telemetry */}
            <div className="grid grid-cols-3 gap-1 text-[10px] font-mono text-slate-400 bg-slate-900/50 px-2 py-1 rounded">
              <div>
                <span className="text-slate-500 block text-[9px]">CW</span>
                <span className="text-white font-semibold">{activeStation.currentCw}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[9px]">Backoff</span>
                <span className="text-amber-400 font-semibold">{activeStation.currentBackoff}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[9px]">Delay</span>
                <span className="text-emerald-400 font-semibold">{activeStation.averageDelayMs.toFixed(1)}ms</span>
              </div>
            </div>

            {/* Competing Contenders in 35m Interference Domain & Distance */}
            <div className="pt-1 border-t border-slate-800/80 text-[10px] text-slate-400 flex items-center justify-between font-mono">
              <span className="text-slate-400">
                Pos: <strong className="text-white font-mono">{activeStation.distanceToAp.toFixed(1)}m</strong> @ <strong className="text-sky-300 font-mono">{staTelemetry.azimuthDeg}° {staTelemetry.cardinalHeading}</strong>
              </span>
              <span className="text-amber-300 font-semibold">
                {interferingNeighbors.length} in CCA
              </span>
            </div>

            {/* Interactive Hint */}
            <div className="text-[9px] text-slate-500 font-sans text-center pt-0.5 border-t border-slate-800/50">
              Click node to open full EDCA queue inspector
            </div>
          </div>
        )}
      </div>

      {/* 3. Structured Footer Legend */}
      <div className="bg-slate-900/85 border-t border-slate-800/80 px-3 sm:px-4 py-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
        <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-[11px] sm:text-xs">
          {/* Hover Indicators Legend */}
          <div className="flex items-center gap-3 border-r border-slate-800 pr-3">
            <div className="flex items-center gap-1">
              <span className="w-2.5 h-0.5 bg-sky-400 rounded-full" />
              <span className="text-slate-300 font-medium">AP Link Path</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full border border-cyan-400 bg-cyan-400/20" />
              <span className="text-cyan-300 font-medium">22m Tx</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full border border-amber-400 bg-amber-400/20" />
              <span className="text-amber-300 font-medium">35m Interference</span>
            </div>
          </div>

          {/* EDCA Queues */}
          <div className="flex items-center gap-2.5">
            <span className="text-slate-500 font-semibold hidden md:inline">EDCA:</span>
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-red-500" />
              <span className="font-medium text-slate-300">VO</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span className="font-medium text-slate-300">VI</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-cyan-400" />
              <span className="font-medium text-slate-300">BE</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-purple-500" />
              <span className="font-medium text-slate-300">BK</span>
            </div>
          </div>

          {showInterferenceHeatmap && (
            <div className="flex items-center gap-1.5 pl-2 border-l border-slate-800">
              <span className="text-amber-300 font-medium flex items-center gap-1 text-[11px]">
                <Flame className="w-3 h-3 text-amber-400" />
                <span>Interference:</span>
              </span>
              <div className="w-12 h-1.5 rounded bg-gradient-to-r from-sky-400 via-amber-400 to-red-500 border border-slate-700" />
            </div>
          )}

          {dynamicMobilityEnabled && (
            <div className="flex items-center gap-1.5 pl-2 border-l border-slate-800 text-purple-300 text-[11px]">
              <Route className="w-3 h-3 text-purple-400" />
              <span>Trajectories</span>
            </div>
          )}
        </div>

        <span className="text-slate-500 text-[11px] hidden lg:inline font-mono">
          Point at any STA to inspect interference &amp; AP link · Click for queue modal
        </span>
      </div>
    </div>
  );
};
