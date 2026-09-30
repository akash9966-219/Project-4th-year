/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { SimulationMetrics, Station } from '../types/wlan';
import { EDCA_DEFAULTS } from '../simulation/constants';
import {
  TrendingUp,
  AlertOctagon,
  Timer,
  Gauge,
  Share2,
  AlertTriangle,
  BarChart3,
  Layers,
  Percent,
  Hash,
  Activity,
  Flame,
  TrendingDown,
  ArrowUpRight,
  CheckCircle2,
  ShieldAlert,
  Sparkles,
  Clock,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  ReferenceLine,
} from 'recharts';

interface MetricsDashboardProps {
  metrics: SimulationMetrics;
  history: SimulationMetrics[];
  stations?: Station[];
  starvationThresholdMbps?: number;
  isStarvationActive?: boolean;
  onOpenAlertSettings?: () => void;
}

export const MetricsDashboard: React.FC<MetricsDashboardProps> = ({
  metrics,
  history,
  stations,
  starvationThresholdMbps = 15,
  isStarvationActive = false,
  onOpenAlertSettings,
}) => {
  const [displayMode, setDisplayMode] = useState<'STACKED' | 'AGGREGATE'>('STACKED');
  const [unitMode, setUnitMode] = useState<'COUNT' | 'PERCENT'>('COUNT');

  // Collision rate chart interactive controls
  const [maWindowSize, setMaWindowSize] = useState<number>(5);
  const [showForecast, setShowForecast] = useState<boolean>(true);
  const [showTrendLine, setShowTrendLine] = useState<boolean>(true);

  // Compute Moving Average & Contention Collapse Predictive Forecast from history
  const collisionTrendData = useMemo(() => {
    const rawHistory = history.length > 0 ? history : [metrics];
    // Keep last 35 snapshots for high-fidelity live tracking (~1.75s history window)
    const recent = rawHistory.slice(-35);

    // 1. Calculate Simple Moving Average for each point
    const points = recent.map((item, idx) => {
      const windowStart = Math.max(0, idx - maWindowSize + 1);
      const windowItems = recent.slice(windowStart, idx + 1);
      const sum = windowItems.reduce((acc, curr) => acc + curr.collisionRatePct, 0);
      const movingAvg = sum / windowItems.length;

      const timeOffsetMs = Math.round((item.timestampUs - recent[0].timestampUs) / 1000);

      return {
        index: idx,
        timeLabel: `${timeOffsetMs}ms`,
        collisionRate: Math.round(item.collisionRatePct * 10) / 10,
        movingAvg: Math.round(movingAvg * 10) / 10,
        forecast: null as number | null,
        isForecast: false,
      };
    });

    // 2. Linear Regression Slope on recent Moving Average values
    const evalWindow = Math.min(8, points.length);
    const evalPoints = points.slice(-evalWindow);

    let slope = 0;
    if (evalPoints.length >= 2) {
      const n = evalPoints.length;
      let sumX = 0;
      let sumY = 0;
      let sumXY = 0;
      let sumXX = 0;
      for (let i = 0; i < n; i++) {
        const x = i;
        const y = evalPoints[i].movingAvg;
        sumX += x;
        sumY += y;
        sumXY += x * y;
        sumXX += x * x;
      }
      slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX || 1);
    }

    const latestPoint = points[points.length - 1];
    const latestMA = latestPoint?.movingAvg ?? metrics.collisionRatePct;

    // Connect boundary point so line renders continuously
    if (latestPoint) {
      latestPoint.forecast = latestMA;
    }

    // 3. Extrapolate 6 future forecast steps (~300ms projected window)
    const forecastSteps = 6;
    const futurePoints: typeof points = [];
    let projectedCollapseStep: number | null = null;
    let maxProjectedRate = latestMA;

    for (let k = 1; k <= forecastSteps; k++) {
      // Apply slight momentum decay so projection doesn't blow up infinitely
      const projectedRate = Math.max(0, Math.min(100, latestMA + slope * k * 0.9));
      maxProjectedRate = Math.max(maxProjectedRate, projectedRate);

      if (projectedRate >= 35 && projectedCollapseStep === null) {
        projectedCollapseStep = k;
      }

      futurePoints.push({
        index: points.length + k - 1,
        timeLabel: `+${k * 50}ms (est)`,
        collisionRate: null as any,
        movingAvg: null as any,
        forecast: Math.round(projectedRate * 10) / 10,
        isForecast: true,
      });
    }

    // Contention Collapse Risk Evaluation
    let collapseRisk: 'CRITICAL' | 'WARNING' | 'STABLE' = 'STABLE';
    let riskMessage = 'Channel contention operating within stable bounds.';

    if (maxProjectedRate >= 35 || latestMA >= 30) {
      collapseRisk = 'CRITICAL';
      riskMessage = projectedCollapseStep !== null
        ? `Contention Collapse predicted in ~${projectedCollapseStep * 50}ms (Saturating at ${maxProjectedRate.toFixed(1)}%). CW expansion advised!`
        : `Critical Contention Saturation (${latestMA.toFixed(1)}% Collision). Collision multiplication occurring!`;
    } else if (maxProjectedRate >= 20 || latestMA >= 18 || slope > 1.0) {
      collapseRisk = 'WARNING';
      riskMessage = slope > 0.8
        ? `Contention Surging (+${(slope * 20).toFixed(1)}%/s drift). Backoff degradation detected.`
        : `Elevated Collision Overhead (${latestMA.toFixed(1)}%). Consider Idle Sense or Q-Learning.`;
    }

    return {
      chartData: showForecast ? [...points, ...futurePoints] : points,
      currentRate: metrics.collisionRatePct,
      latestMA: Math.round(latestMA * 10) / 10,
      slopePerSec: Math.round(slope * 20 * 10) / 10, // ~20 ticks/sec (50ms interval)
      maxProjectedRate: Math.round(maxProjectedRate * 10) / 10,
      projectedCollapseStep,
      collapseRisk,
      riskMessage,
    };
  }, [history, metrics, maWindowSize, showForecast]);

  // Sparkline generator
  const renderSparkline = (
    dataExtractor: (m: SimulationMetrics) => number,
    color: string,
    minVal: number = 0,
    maxVal?: number
  ) => {
    if (history.length < 2) return null;
    const values = history.map(dataExtractor);
    const calculatedMax = maxVal !== undefined ? maxVal : Math.max(1, ...values);
    const calculatedMin = minVal;
    const range = Math.max(0.001, calculatedMax - calculatedMin);

    const width = 120;
    const height = 32;

    const points = values.map((val, idx) => {
      const x = (idx / (values.length - 1)) * width;
      const normalized = Math.max(0, Math.min(1, (val - calculatedMin) / range));
      const y = height - normalized * (height - 4) - 2;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');

    return (
      <svg width={width} height={height} className="overflow-visible">
        <polyline
          fill="none"
          stroke={color}
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={points}
        />
      </svg>
    );
  };

  const statCards = [
    {
      title: 'Aggregate Throughput',
      value: metrics.totalThroughputMbps.toFixed(2),
      unit: 'Mbps',
      color: '#38bdf8',
      icon: TrendingUp,
      sparkline: renderSparkline((m) => m.totalThroughputMbps, '#38bdf8', 0),
      subtitle: `Channel Utilization: ${metrics.channelUtilizationPct.toFixed(1)}%`,
    },
    {
      title: 'Packet Collision Rate',
      value: metrics.collisionRatePct.toFixed(1),
      unit: '%',
      color: metrics.collisionRatePct > 20 ? '#ef4444' : metrics.collisionRatePct > 10 ? '#f59e0b' : '#10b981',
      icon: AlertOctagon,
      sparkline: renderSparkline((m) => m.collisionRatePct, '#ef4444', 0, 100),
      subtitle: collisionTrendData.collapseRisk === 'CRITICAL'
        ? `⚠️ Collapse Risk (+${collisionTrendData.slopePerSec}%/s)`
        : collisionTrendData.collapseRisk === 'WARNING'
        ? `⚡ Elevated (${collisionTrendData.latestMA}% Trend)`
        : `Stable Trend (${collisionTrendData.latestMA}% MA)`,
    },
    {
      title: 'Mean MAC Queuing Delay',
      value: metrics.averageDelayMs.toFixed(1),
      unit: 'ms',
      color: metrics.averageDelayMs > 40 ? '#f59e0b' : '#38bdf8',
      icon: Timer,
      sparkline: renderSparkline((m) => m.averageDelayMs, '#818cf8', 0),
      subtitle: `Jitter: ${metrics.jitterMs.toFixed(1)} ms`,
    },
    {
      title: "Jain's Fairness Index",
      value: metrics.jainsFairnessIndex.toFixed(3),
      unit: 'ratio',
      color: metrics.jainsFairnessIndex > 0.85 ? '#10b981' : '#f59e0b',
      icon: Gauge,
      sparkline: renderSparkline((m) => m.jainsFairnessIndex, '#10b981', 0, 1),
      subtitle: metrics.jainsFairnessIndex > 0.85 ? 'Equitable Bandwidth Allocation' : 'Airtime Starvation Warning',
    },
  ];

  // Process live delay distribution histogram data
  const defaultHistogram = [
    { binLabel: '< 5ms', minMs: 0, maxMs: 5, totalCount: 0, percentage: 0, AC_VO: 0, AC_VI: 0, AC_BE: 0, AC_BK: 0 },
    { binLabel: '5–15ms', minMs: 5, maxMs: 15, totalCount: 0, percentage: 0, AC_VO: 0, AC_VI: 0, AC_BE: 0, AC_BK: 0 },
    { binLabel: '15–30ms', minMs: 15, maxMs: 30, totalCount: 0, percentage: 0, AC_VO: 0, AC_VI: 0, AC_BE: 0, AC_BK: 0 },
    { binLabel: '30–50ms', minMs: 30, maxMs: 50, totalCount: 0, percentage: 0, AC_VO: 0, AC_VI: 0, AC_BE: 0, AC_BK: 0 },
    { binLabel: '50–80ms', minMs: 50, maxMs: 80, totalCount: 0, percentage: 0, AC_VO: 0, AC_VI: 0, AC_BE: 0, AC_BK: 0 },
    { binLabel: '> 80ms', minMs: 80, maxMs: Infinity, totalCount: 0, percentage: 0, AC_VO: 0, AC_VI: 0, AC_BE: 0, AC_BK: 0 },
  ];

  const rawBins = metrics.delayHistogram && metrics.delayHistogram.length > 0
    ? metrics.delayHistogram
    : defaultHistogram;

  const totalHistogramPackets = rawBins.reduce((sum, b) => sum + b.totalCount, 0);

  // Progressive colors for Aggregate mode from ultra-low latency to high bufferbloat
  const BIN_SEVERITY_COLORS = [
    '#10b981', // < 5ms: emerald (VoIP / ultra low)
    '#06b6d4', // 5-15ms: cyan (Video conferencing)
    '#38bdf8', // 15-30ms: sky (healthy Best Effort)
    '#f59e0b', // 30-50ms: amber (moderate queueing)
    '#f97316', // 50-80ms: orange (elevated contention)
    '#ef4444', // > 80ms: red (severe bufferbloat)
  ];

  const chartData = rawBins.map((bin, idx) => {
    if (unitMode === 'PERCENT') {
      const denom = Math.max(1, totalHistogramPackets);
      return {
        binLabel: bin.binLabel,
        totalCount: bin.totalCount,
        percentage: bin.percentage,
        displayTotal: Math.round((bin.totalCount / denom) * 1000) / 10,
        AC_VO: Math.round((bin.AC_VO / denom) * 1000) / 10,
        AC_VI: Math.round((bin.AC_VI / denom) * 1000) / 10,
        AC_BE: Math.round((bin.AC_BE / denom) * 1000) / 10,
        AC_BK: Math.round((bin.AC_BK / denom) * 1000) / 10,
        color: BIN_SEVERITY_COLORS[idx % BIN_SEVERITY_COLORS.length],
      };
    }

    return {
      binLabel: bin.binLabel,
      totalCount: bin.totalCount,
      percentage: bin.percentage,
      displayTotal: bin.totalCount,
      AC_VO: bin.AC_VO,
      AC_VI: bin.AC_VI,
      AC_BE: bin.AC_BE,
      AC_BK: bin.AC_BK,
      color: BIN_SEVERITY_COLORS[idx % BIN_SEVERITY_COLORS.length],
    };
  });

  const p95Delay = metrics.p95DelayMs ?? (metrics.averageDelayMs * 1.5);

  const CustomHistogramTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null;
    const data = payload[0].payload;
    return (
      <div className="bg-slate-900/95 backdrop-blur-md border border-slate-700/80 p-3 rounded-xl shadow-2xl text-xs text-slate-200 min-w-[200px]">
        <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-slate-800">
          <span className="font-semibold text-white">Delay Bin: {data.binLabel}</span>
          <span className="font-mono text-sky-400 font-bold">{data.totalCount} pkts</span>
        </div>
        <div className="flex items-center justify-between text-slate-400 text-[11px] mb-2 font-mono">
          <span>Traffic Frequency:</span>
          <span className="text-white font-semibold">{data.percentage.toFixed(1)}%</span>
        </div>
        <div className="space-y-1.5 text-[11px] font-mono border-t border-slate-800/80 pt-1.5">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-slate-300">
              <span className="w-2 h-2 rounded-full bg-red-500" />
              VO (Voice):
            </span>
            <span className="text-white font-bold">{unitMode === 'PERCENT' ? `${data.AC_VO}%` : data.AC_VO}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-slate-300">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              VI (Video):
            </span>
            <span className="text-white font-bold">{unitMode === 'PERCENT' ? `${data.AC_VI}%` : data.AC_VI}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-slate-300">
              <span className="w-2 h-2 rounded-full bg-cyan-400" />
              BE (Best Effort):
            </span>
            <span className="text-white font-bold">{unitMode === 'PERCENT' ? `${data.AC_BE}%` : data.AC_BE}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-slate-300">
              <span className="w-2 h-2 rounded-full bg-purple-500" />
              BK (Background):
            </span>
            <span className="text-white font-bold">{unitMode === 'PERCENT' ? `${data.AC_BK}%` : data.AC_BK}</span>
          </div>
        </div>
      </div>
    );
  };

  const CustomCollisionTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null;
    const p = payload[0]?.payload;
    if (!p) return null;
    const isProj = p.isForecast;

    return (
      <div className="bg-slate-900/95 backdrop-blur-md border border-slate-700/80 p-3 rounded-xl shadow-2xl text-xs text-slate-200 min-w-[210px] font-mono">
        <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-slate-800">
          <span className="font-semibold text-white font-sans flex items-center gap-1.5">
            {isProj ? <Clock className="w-3.5 h-3.5 text-pink-400" /> : <Flame className="w-3.5 h-3.5 text-red-400" />}
            <span>{isProj ? 'Forecast Projection' : 'Historical Sample'}</span>
          </span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
            isProj ? 'bg-pink-500/20 text-pink-300 border border-pink-500/40' : 'bg-slate-800 text-slate-300'
          }`}>
            {p.timeLabel}
          </span>
        </div>

        <div className="space-y-1.5 text-[11px]">
          {!isProj && p.collisionRate !== null && p.collisionRate !== undefined && (
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-slate-300">
                <span className="w-2 h-2 rounded-full bg-red-500" />
                Instant Collision:
              </span>
              <span className="text-white font-bold">{p.collisionRate.toFixed(1)}%</span>
            </div>
          )}

          {p.movingAvg !== null && p.movingAvg !== undefined && (
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-slate-300">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                Moving Avg ({maWindowSize}-SMA):
              </span>
              <span className="text-amber-300 font-bold">{p.movingAvg.toFixed(1)}%</span>
            </div>
          )}

          {p.forecast !== null && p.forecast !== undefined && (
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-slate-300">
                <span className="w-2 h-2 rounded-full bg-pink-400" />
                Predicted Trend:
              </span>
              <span className="text-pink-300 font-bold">{p.forecast.toFixed(1)}%</span>
            </div>
          )}
        </div>

        <div className="mt-2 pt-1.5 border-t border-slate-800/80 text-[10px] text-slate-400 flex items-center justify-between font-sans">
          <span>Contention Collapse:</span>
          <span className={((p.forecast ?? p.collisionRate) >= 35) ? 'text-red-400 font-bold' : 'text-slate-500'}>
            35% Saturation
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Starvation State Alert Banner (if active) */}
      {isStarvationActive && (
        <div className="bg-red-950/60 border border-red-500/50 rounded-xl p-3.5 flex items-center justify-between text-xs text-red-200 shadow-lg shadow-red-950/40 animate-pulse">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-red-500/20 text-red-400 shrink-0">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <span className="font-semibold text-red-300">Throughput Starvation Alert</span>
              <p className="text-[11px] text-red-300/80">
                Aggregate network throughput ({metrics.totalThroughputMbps.toFixed(1)} Mbps) has dropped below threshold ({starvationThresholdMbps} Mbps).
              </p>
            </div>
          </div>
          {onOpenAlertSettings && (
            <button
              onClick={onOpenAlertSettings}
              className="px-2.5 py-1 rounded bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-200 text-[11px] font-medium transition-colors cursor-pointer shrink-0"
            >
              Adjust Threshold
            </button>
          )}
        </div>
      )}

      {/* 4 Primary Top Metrics (Balanced 2x2 Grid) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {statCards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <div
              key={idx}
              className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-3.5 flex flex-col justify-between transition-all hover:border-slate-700/80"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-400">{card.title}</span>
                <Icon className="w-4 h-4 text-slate-500" />
              </div>

              <div className="flex items-baseline justify-between mt-2 mb-1">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-xl sm:text-2xl font-bold font-mono tracking-tight text-white tabular-nums">
                    {card.value}
                  </span>
                  <span className="text-xs text-slate-400 font-medium">{card.unit}</span>
                </div>
                {card.sparkline}
              </div>

              <div className="text-[11px] text-slate-500 pt-1 border-t border-slate-800/60 truncate">
                {card.subtitle}
              </div>
            </div>
          );
        })}
      </div>

      {/* LIVE COLLISION RATE & CONTENTION COLLAPSE FORECAST (Recharts ComposedChart) */}
      <div className="bg-slate-900/50 border border-slate-800/80 rounded-xl p-3.5 sm:p-4 flex flex-col gap-3 shadow-lg shadow-slate-950/40">
        {/* Card Header with Moving Average Controls & Risk Status Badge */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div
              className={`w-7 h-7 rounded-lg border flex items-center justify-center shrink-0 ${
                collisionTrendData.collapseRisk === 'CRITICAL'
                  ? 'bg-red-500/15 border-red-500/40 text-red-400 animate-pulse'
                  : collisionTrendData.collapseRisk === 'WARNING'
                  ? 'bg-amber-500/15 border-amber-500/40 text-amber-400'
                  : 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
              }`}
            >
              <Flame className="w-3.5 h-3.5" />
            </div>
            <div>
              <h4 className="text-xs font-semibold text-white flex items-center gap-1.5">
                <span>Collision Rate &amp; Collapse Forecast</span>
                <span
                  className={`px-1.5 py-0.2 rounded text-[10px] font-mono border font-semibold ${
                    collisionTrendData.collapseRisk === 'CRITICAL'
                      ? 'bg-red-500/20 border-red-500/40 text-red-300 animate-pulse'
                      : collisionTrendData.collapseRisk === 'WARNING'
                      ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                      : 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                  }`}
                >
                  {collisionTrendData.collapseRisk === 'CRITICAL'
                    ? 'COLLAPSE IMMINENT'
                    : collisionTrendData.collapseRisk === 'WARNING'
                    ? 'CONTENTION SURGE'
                    : 'STABLE CSMA/CA'}
                </span>
              </h4>
              <p className="text-[10px] text-slate-400 hidden sm:block">
                Moving average trend line with forward extrapolation to predict saturation collapse
              </p>
            </div>
          </div>

          {/* Interactive Controls: SMA window & Forecast toggle */}
          <div className="flex items-center gap-1.5 ml-auto">
            {/* SMA Window selector */}
            <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg p-0.5 text-[11px]">
              <span className="px-1.5 text-[10px] text-slate-500 font-mono hidden xs:inline">SMA:</span>
              <button
                onClick={() => setMaWindowSize(5)}
                className={`px-1.5 py-0.5 rounded font-mono font-medium transition-colors cursor-pointer ${
                  maWindowSize === 5
                    ? 'bg-amber-500/20 text-amber-300 font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="5-sample Simple Moving Average window"
              >
                5
              </button>
              <button
                onClick={() => setMaWindowSize(10)}
                className={`px-1.5 py-0.5 rounded font-mono font-medium transition-colors cursor-pointer ${
                  maWindowSize === 10
                    ? 'bg-amber-500/20 text-amber-300 font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="10-sample Simple Moving Average window"
              >
                10
              </button>
            </div>

            {/* Trend Line Toggle */}
            <button
              onClick={() => setShowTrendLine((prev) => !prev)}
              className={`px-2 py-1 rounded-lg border text-[11px] font-mono font-medium transition-colors cursor-pointer ${
                showTrendLine
                  ? 'bg-amber-500/20 border-amber-500/40 text-amber-300 font-semibold'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
              title="Toggle moving average trend line overlay"
            >
              <span>Trend</span>
            </button>

            {/* Forecast Projection toggle */}
            <button
              onClick={() => setShowForecast((prev) => !prev)}
              className={`px-2 py-1 rounded-lg border text-[11px] font-mono font-medium transition-colors cursor-pointer flex items-center gap-1 ${
                showForecast
                  ? 'bg-pink-500/20 border-pink-500/40 text-pink-300 font-semibold'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
              title="Toggle forward moving average projection trend line"
            >
              <ArrowUpRight className="w-3 h-3" />
              <span>Forecast</span>
            </button>
          </div>
        </div>

        {/* Statistical Summary Ribbon */}
        <div className="grid grid-cols-4 gap-2 bg-slate-950/70 border border-slate-800/80 rounded-lg px-2.5 py-1.5 text-[11px] font-mono">
          <div className="flex flex-col">
            <span className="text-[10px] text-slate-500">Current:</span>
            <span className={`font-semibold ${metrics.collisionRatePct > 20 ? 'text-red-400' : 'text-white'}`}>
              {metrics.collisionRatePct.toFixed(1)}%
            </span>
          </div>
          <div className="flex flex-col border-l border-slate-800/80 pl-2">
            <span className="text-[10px] text-slate-500">Trend (SMA):</span>
            <span className="font-semibold text-amber-400">
              {collisionTrendData.latestMA.toFixed(1)}%
            </span>
          </div>
          <div className="flex flex-col border-l border-slate-800/80 pl-2">
            <span className="text-[10px] text-slate-500">Drift Rate:</span>
            <span
              className={`font-semibold ${
                collisionTrendData.slopePerSec > 1.0
                  ? 'text-red-400'
                  : collisionTrendData.slopePerSec > 0
                  ? 'text-amber-400'
                  : 'text-emerald-400'
              }`}
            >
              {collisionTrendData.slopePerSec > 0 ? '+' : ''}{collisionTrendData.slopePerSec.toFixed(1)}%/s
            </span>
          </div>
          <div className="flex flex-col border-l border-slate-800/80 pl-2">
            <span className="text-[10px] text-slate-500">Projected Peak:</span>
            <span
              className={`font-semibold ${
                collisionTrendData.maxProjectedRate >= 35
                  ? 'text-pink-400 font-bold'
                  : collisionTrendData.maxProjectedRate >= 20
                  ? 'text-amber-400'
                  : 'text-slate-300'
              }`}
            >
              {collisionTrendData.maxProjectedRate.toFixed(1)}%
            </span>
          </div>
        </div>

        {/* Early Warning Contention Collapse Banner (if risk is high) */}
        {collisionTrendData.collapseRisk !== 'STABLE' && (
          <div
            className={`p-2.5 rounded-lg border text-xs flex items-center justify-between gap-2 shadow-sm ${
              collisionTrendData.collapseRisk === 'CRITICAL'
                ? 'bg-red-950/50 border-red-500/50 text-red-200 animate-pulse'
                : 'bg-amber-950/40 border-amber-500/40 text-amber-200'
            }`}
          >
            <div className="flex items-center gap-2">
              <AlertOctagon
                className={`w-4 h-4 shrink-0 ${
                  collisionTrendData.collapseRisk === 'CRITICAL' ? 'text-red-400' : 'text-amber-400'
                }`}
              />
              <span className="text-[11px] leading-tight font-medium">
                {collisionTrendData.riskMessage}
              </span>
            </div>
            <span className="text-[10px] font-mono text-slate-400 shrink-0 hidden sm:inline">
              Limit: 35% Saturation
            </span>
          </div>
        )}

        {/* Recharts ComposedChart: Area + Moving Average Line + Forecast Projection Line */}
        <div className="w-full h-[180px] sm:h-[195px] relative">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={collisionTrendData.chartData}
              margin={{ top: 12, right: 10, left: -22, bottom: 0 }}
            >
              <defs>
                <linearGradient id="colRateGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0.0} />
                </linearGradient>
              </defs>

              <XAxis
                dataKey="timeLabel"
                tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'monospace' }}
                tickLine={{ stroke: '#334155' }}
                axisLine={{ stroke: '#334155' }}
                interval="preserveStartEnd"
              />
              <YAxis
                domain={[0, (dataMax: number) => Math.min(100, Math.max(50, Math.ceil(dataMax / 10) * 10))]}
                unit="%"
                tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'monospace' }}
                tickLine={{ stroke: '#334155' }}
                axisLine={{ stroke: '#334155' }}
                allowDecimals={false}
              />
              <Tooltip content={<CustomCollisionTooltip />} />

              {/* 35% Collapse Threshold Reference Line */}
              <ReferenceLine
                y={35}
                stroke="#ef4444"
                strokeDasharray="3 3"
                strokeWidth={1.5}
                label={{
                  value: '35% Collapse Limit',
                  fill: '#f87171',
                  fontSize: 9,
                  position: 'insideTopRight',
                  fontFamily: 'monospace',
                }}
              />

              {/* 20% Warning Reference Line */}
              <ReferenceLine
                y={20}
                stroke="#f59e0b"
                strokeDasharray="2 2"
                strokeWidth={1}
                label={{
                  value: '20% Warning',
                  fill: '#fbbf24',
                  fontSize: 9,
                  position: 'insideTopRight',
                  fontFamily: 'monospace',
                }}
              />

              {/* Raw Instant Collision Rate Area */}
              <Area
                type="monotone"
                dataKey="collisionRate"
                name="Instant Collision Rate"
                fill="url(#colRateGradient)"
                stroke="#ef4444"
                strokeWidth={1.5}
                dot={false}
                isAnimationActive={false}
              />

              {/* Moving Average Trend Line Overlay */}
              {showTrendLine && (
                <Line
                  type="monotone"
                  dataKey="movingAvg"
                  name={`${maWindowSize}-Sample Moving Average`}
                  stroke="#f59e0b"
                  strokeWidth={2.5}
                  dot={false}
                  isAnimationActive={false}
                />
              )}

              {/* Contention Collapse Forecast Projection Line */}
              {showForecast && (
                <Line
                  type="monotone"
                  dataKey="forecast"
                  name="Projected Contention Trend"
                  stroke="#f43f5e"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  dot={{ r: 2.5, fill: '#f43f5e', strokeWidth: 0 }}
                  isAnimationActive={false}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Legend & Theoretical Guidance */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/80 text-[10px] text-slate-400">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 font-medium text-slate-300">
              <span className="w-2.5 h-1 bg-red-500 rounded-sm" />
              Instant Rate
            </span>
            <span className="flex items-center gap-1 font-medium text-amber-300">
              <span className="w-2.5 h-1 bg-amber-400 rounded-sm" />
              Moving Avg ({maWindowSize}-SMA)
            </span>
            {showForecast && (
              <span className="flex items-center gap-1 font-medium text-pink-300">
                <span className="w-2.5 h-0.5 border-t border-pink-400 border-dashed" />
                Forecast Extrapolation
              </span>
            )}
          </div>

          <span className="text-slate-500 font-mono hidden xs:inline">
            Predicts saturation collapse before backoff resets fail
          </span>
        </div>
      </div>

      {/* LIVE PACKET DELAY DISTRIBUTION HISTOGRAM (Recharts Visualization) */}
      <div className="bg-slate-900/50 border border-slate-800/80 rounded-xl p-3.5 sm:p-4 flex flex-col gap-3 shadow-lg shadow-slate-950/40">
        {/* Histogram Card Header with Toggles */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 shrink-0">
              <BarChart3 className="w-3.5 h-3.5" />
            </div>
            <div>
              <h4 className="text-xs font-semibold text-white flex items-center gap-1.5">
                <span>Packet Delay Distribution</span>
                <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-sky-500/10 text-sky-400 border border-sky-500/20">
                  Live Histogram
                </span>
              </h4>
              <p className="text-[10px] text-slate-400 hidden sm:block">
                Queuing sojourn &amp; MAC backoff contention latency across network
              </p>
            </div>
          </div>

          {/* Interactive Controls: Stacked/Aggregate & Count/% */}
          <div className="flex items-center gap-1.5 ml-auto">
            {/* Display Mode: Stacked QoS vs Aggregate */}
            <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg p-0.5 text-[11px]">
              <button
                onClick={() => setDisplayMode('STACKED')}
                className={`px-2 py-0.5 rounded font-medium transition-colors cursor-pointer flex items-center gap-1 ${
                  displayMode === 'STACKED'
                    ? 'bg-sky-500/20 text-sky-300 font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Stack delay bins by EDCA Quality of Service (VO, VI, BE, BK)"
              >
                <Layers className="w-3 h-3" />
                <span className="hidden xs:inline">Stacked</span>
              </button>
              <button
                onClick={() => setDisplayMode('AGGREGATE')}
                className={`px-2 py-0.5 rounded font-medium transition-colors cursor-pointer ${
                  displayMode === 'AGGREGATE'
                    ? 'bg-sky-500/20 text-sky-300 font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="View aggregate packet latency distribution"
              >
                Aggregate
              </button>
            </div>

            {/* Units: Count vs Percentage */}
            <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg p-0.5 text-[11px]">
              <button
                onClick={() => setUnitMode('COUNT')}
                className={`px-1.5 py-0.5 rounded font-medium transition-colors cursor-pointer ${
                  unitMode === 'COUNT'
                    ? 'bg-sky-500/20 text-sky-300 font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Display absolute packet counts"
              >
                <Hash className="w-3 h-3" />
              </button>
              <button
                onClick={() => setUnitMode('PERCENT')}
                className={`px-1.5 py-0.5 rounded font-medium transition-colors cursor-pointer ${
                  unitMode === 'PERCENT'
                    ? 'bg-sky-500/20 text-sky-300 font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Display relative frequency percentage (%)"
              >
                <Percent className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>

        {/* Statistical Summary Ribbon */}
        <div className="grid grid-cols-4 gap-2 bg-slate-950/70 border border-slate-800/80 rounded-lg px-2.5 py-1.5 text-[11px] font-mono">
          <div className="flex flex-col">
            <span className="text-[10px] text-slate-500">Mean (μ):</span>
            <span className="font-semibold text-white">{metrics.averageDelayMs.toFixed(1)} ms</span>
          </div>
          <div className="flex flex-col border-l border-slate-800/80 pl-2">
            <span className="text-[10px] text-slate-500">P95 SLA:</span>
            <span className={`font-semibold ${p95Delay > 40 ? 'text-amber-400' : 'text-emerald-400'}`}>
              {p95Delay.toFixed(1)} ms
            </span>
          </div>
          <div className="flex flex-col border-l border-slate-800/80 pl-2">
            <span className="text-[10px] text-slate-500">Jitter (σ):</span>
            <span className="font-semibold text-sky-400">{metrics.jitterMs.toFixed(1)} ms</span>
          </div>
          <div className="flex flex-col border-l border-slate-800/80 pl-2">
            <span className="text-[10px] text-slate-500">Buffer:</span>
            <span className="font-semibold text-slate-300">{totalHistogramPackets} pkts</span>
          </div>
        </div>

        {/* Recharts BarChart Visualization */}
        <div className="w-full h-[180px] sm:h-[195px] relative">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 8, right: 10, left: -22, bottom: 0 }}
            >
              <XAxis
                dataKey="binLabel"
                tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'monospace' }}
                tickLine={{ stroke: '#334155' }}
                axisLine={{ stroke: '#334155' }}
              />
              <YAxis
                tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'monospace' }}
                tickLine={{ stroke: '#334155' }}
                axisLine={{ stroke: '#334155' }}
                unit={unitMode === 'PERCENT' ? '%' : ''}
                allowDecimals={false}
              />
              <Tooltip content={<CustomHistogramTooltip />} />

              {displayMode === 'STACKED' ? (
                <>
                  <Bar
                    dataKey="AC_VO"
                    name="Voice (VO)"
                    stackId="qos"
                    fill="#ef4444"
                    radius={[0, 0, 0, 0]}
                    isAnimationActive={false}
                  />
                  <Bar
                    dataKey="AC_VI"
                    name="Video (VI)"
                    stackId="qos"
                    fill="#f59e0b"
                    radius={[0, 0, 0, 0]}
                    isAnimationActive={false}
                  />
                  <Bar
                    dataKey="AC_BE"
                    name="Best Effort (BE)"
                    stackId="qos"
                    fill="#06b6d4"
                    radius={[0, 0, 0, 0]}
                    isAnimationActive={false}
                  />
                  <Bar
                    dataKey="AC_BK"
                    name="Background (BK)"
                    stackId="qos"
                    fill="#a855f7"
                    radius={[3, 3, 0, 0]}
                    isAnimationActive={false}
                  />
                </>
              ) : (
                <Bar
                  dataKey="displayTotal"
                  name="Packets"
                  radius={[3, 3, 0, 0]}
                  isAnimationActive={false}
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              )}
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Legend & Access Category indicators */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/80 text-[10px] text-slate-400">
          {displayMode === 'STACKED' ? (
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1 font-medium text-slate-300">
                <span className="w-2 h-2 rounded-full bg-red-500" />
                VO
              </span>
              <span className="flex items-center gap-1 font-medium text-slate-300">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                VI
              </span>
              <span className="flex items-center gap-1 font-medium text-slate-300">
                <span className="w-2 h-2 rounded-full bg-cyan-400" />
                BE
              </span>
              <span className="flex items-center gap-1 font-medium text-slate-300">
                <span className="w-2 h-2 rounded-full bg-purple-500" />
                BK
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1 text-slate-400">
              <Activity className="w-3 h-3 text-sky-400" />
              <span>Delay Severity: Green (&lt;5ms) → Red (&gt;80ms)</span>
            </div>
          )}

          <span className="text-slate-500 font-mono hidden xs:inline">
            Target SLA: CoDel 5ms / Interactive &lt;30ms
          </span>
        </div>
      </div>

      {/* 4 EDCA Quality of Service (QoS) Categories Breakdown */}
      <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-3.5 sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-1 mb-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
            <Share2 className="w-3.5 h-3.5 text-sky-400" />
            <span>EDCA Access Category Breakdown</span>
          </div>
          <span className="text-[11px] text-slate-500 font-mono">
            AIFSN &amp; CW Parameters
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          {(['AC_VO', 'AC_VI', 'AC_BE', 'AC_BK'] as const).map((cat) => {
            const def = EDCA_DEFAULTS[cat];
            const tput = metrics.perCategoryThroughputMbps[cat] || 0;
            const delay = metrics.perCategoryDelayMs[cat] || 0;

            return (
              <div
                key={cat}
                className="bg-slate-950/70 border border-slate-800/80 rounded-lg p-3 flex flex-col justify-between"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: def.color }}
                    />
                    <span className="text-xs font-semibold text-slate-200">{cat}</span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-500">
                    AIFSN:{def.aifsn}
                  </span>
                </div>

                <div className="space-y-1 text-xs">
                  <div className="flex items-center justify-between text-slate-400">
                    <span>Goodput:</span>
                    <span className="font-mono text-slate-200 tabular-nums">
                      {tput.toFixed(2)} Mbps
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-slate-400">
                    <span>Latency:</span>
                    <span className="font-mono text-slate-200 tabular-nums">
                      {delay.toFixed(1)} ms
                    </span>
                  </div>
                </div>

                <div className="mt-2 text-[10px] text-slate-500 truncate" title={def.description}>
                  CW: {def.cwMin}–{def.cwMax}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
