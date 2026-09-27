/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { SimulationMetrics } from '../types/wlan';
import { EDCA_DEFAULTS } from '../simulation/constants';
import { TrendingUp, AlertOctagon, Timer, Gauge, Share2, AlertTriangle } from 'lucide-react';

interface MetricsDashboardProps {
  metrics: SimulationMetrics;
  history: SimulationMetrics[];
  starvationThresholdMbps?: number;
  isStarvationActive?: boolean;
  onOpenAlertSettings?: () => void;
}

export const MetricsDashboard: React.FC<MetricsDashboardProps> = ({
  metrics,
  history,
  starvationThresholdMbps = 15,
  isStarvationActive = false,
  onOpenAlertSettings,
}) => {
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
      subtitle: metrics.collisionRatePct > 25 ? 'High Contention Collapse' : 'Stable CSMA/CA',
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

      {/* 4 Primary Top Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {statCards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <div
              key={idx}
              className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-4 flex flex-col justify-between transition-all hover:border-slate-700/80"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-400">{card.title}</span>
                <Icon className="w-4 h-4 text-slate-500" />
              </div>

              <div className="flex items-baseline justify-between mt-2.5 mb-1">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-bold font-mono tracking-tight text-white tabular-nums">
                    {card.value}
                  </span>
                  <span className="text-xs text-slate-400 font-medium">{card.unit}</span>
                </div>
                {card.sparkline}
              </div>

              <div className="text-[11px] text-slate-500 pt-1 border-t border-slate-800/60">
                {card.subtitle}
              </div>
            </div>
          );
        })}
      </div>

      {/* 4 EDCA Quality of Service (QoS) Categories Breakdown */}
      <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
            <Share2 className="w-3.5 h-3.5 text-sky-400" />
            <span>IEEE 802.11e/ax EDCA Access Category Breakdown</span>
          </div>
          <span className="text-xs text-slate-500">
            Differentiated contention parameters (AIFSN &amp; CWmin/max)
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
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
