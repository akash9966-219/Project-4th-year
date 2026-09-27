/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { BianchiModel, BianchiResult } from '../simulation/bianchi';
import { SimulationMetrics } from '../types/wlan';
import { CheckCircle2, Info, BookOpen, Layers } from 'lucide-react';

interface BianchiValidationChartProps {
  currentStationCount: number;
  currentMetrics: SimulationMetrics;
  congestionAlgorithm: string;
}

export const BianchiValidationChart: React.FC<BianchiValidationChartProps> = ({
  currentStationCount,
  currentMetrics,
  congestionAlgorithm,
}) => {
  const [cwMin, setCwMin] = useState<number>(15);
  const [cwMax, setCwMax] = useState<number>(1023);
  const [packetSize, setPacketSize] = useState<number>(1500);
  const [phyRate, setPhyRate] = useState<number>(54);

  // Generate theoretical curve points
  const curvePoints = useMemo(() => {
    return BianchiModel.generateCurve(50, cwMin, cwMax, packetSize, phyRate);
  }, [cwMin, cwMax, packetSize, phyRate]);

  // Theoretical value at current station count
  const currentTheoretical = useMemo(() => {
    return BianchiModel.solve(currentStationCount, cwMin, cwMax, packetSize, phyRate);
  }, [currentStationCount, cwMin, cwMax, packetSize, phyRate]);

  // Chart dimensions
  const width = 640;
  const height = 260;
  const padding = { top: 20, right: 30, bottom: 40, left: 50 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;

  const maxN = 50;
  const maxThroughput = Math.max(50, ...curvePoints.map((p) => p.saturationThroughputMbps)) * 1.1;

  // Scale functions
  const scaleX = (n: number) => padding.left + (n / maxN) * plotWidth;
  const scaleY = (tput: number) => padding.top + plotHeight - (tput / maxThroughput) * plotHeight;

  // Generate SVG path for theoretical curve
  const pathData = curvePoints.reduce((acc, pt, idx) => {
    const x = scaleX(pt.n);
    const y = scaleY(pt.saturationThroughputMbps);
    return idx === 0 ? `M ${x.toFixed(1)} ${y.toFixed(1)}` : `${acc} L ${x.toFixed(1)} ${y.toFixed(1)}`;
  }, '');

  // Current simulation point
  const simTput = currentMetrics.totalThroughputMbps;
  const simX = scaleX(currentStationCount);
  const simY = scaleY(simTput);
  const theoY = scaleY(currentTheoretical.saturationThroughputMbps);

  // Error delta
  const diffPct = currentTheoretical.saturationThroughputMbps > 0
    ? Math.abs((simTput - currentTheoretical.saturationThroughputMbps) / currentTheoretical.saturationThroughputMbps) * 100
    : 0;

  return (
    <div className="bg-slate-950 rounded-xl border border-slate-800/80 p-5 flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800/80">
        <div>
          <h3 className="text-base font-semibold text-white tracking-tight">
            Bianchi Markov Chain Model Validation
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Analytic saturation throughput curve vs. real-time discrete-event MAC simulation
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
          <span className="text-sky-400 font-semibold">Active Alg:</span>
          <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-200">
            {congestionAlgorithm}
          </span>
        </div>
      </div>

      {/* Main Grid: Chart + Analytical Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* SVG Plot */}
        <div className="lg:col-span-2 bg-slate-900/40 rounded-xl border border-slate-800/80 p-3 sm:p-4 flex flex-col">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400 mb-2 px-1 sm:px-2">
            <span className="font-medium text-slate-300">Throughput S(n) vs Station Count (n)</span>
            <div className="flex items-center gap-2 sm:gap-3 text-[11px] sm:text-xs">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 bg-sky-400" />
                <span>Bianchi Analytic Curve</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                <span>Simulated Operating Point</span>
              </div>
            </div>
          </div>

          <div className="w-full overflow-x-auto">
            <svg
              viewBox={`0 0 ${width} ${height}`}
              className="w-full min-w-[320px] h-auto max-h-[300px] select-none"
            >
              {/* Grid Lines */}
              {[0, 10, 20, 30, 40, 50].map((tVal) => {
                if (tVal > maxThroughput) return null;
                const y = scaleY(tVal);
                return (
                  <g key={`y-${tVal}`}>
                    <line
                      x1={padding.left}
                      y1={y}
                      x2={width - padding.right}
                      y2={y}
                      stroke="#1e293b"
                      strokeDasharray="3 3"
                    />
                    <text
                      x={padding.left - 8}
                      y={y + 3}
                      fill="#64748b"
                      fontSize="9"
                      fontFamily="JetBrains Mono"
                      textAnchor="end"
                    >
                      {tVal}M
                    </text>
                  </g>
                );
              })}

              {[5, 10, 15, 20, 25, 30, 35, 40, 45, 50].map((nVal) => {
                const x = scaleX(nVal);
                return (
                  <g key={`x-${nVal}`}>
                    <line
                      x1={x}
                      y1={padding.top}
                      x2={x}
                      y2={height - padding.bottom}
                      stroke="#1e293b"
                      strokeDasharray="3 3"
                    />
                    <text
                      x={x}
                      y={height - padding.bottom + 16}
                      fill="#64748b"
                      fontSize="9"
                      fontFamily="JetBrains Mono"
                      textAnchor="middle"
                    >
                      {nVal}
                    </text>
                  </g>
                );
              })}

              {/* Axis lines */}
              <line
                x1={padding.left}
                y1={height - padding.bottom}
                x2={width - padding.right}
                y2={height - padding.bottom}
                stroke="#334155"
                strokeWidth="1.5"
              />
              <line
                x1={padding.left}
                y1={padding.top}
                x2={padding.left}
                y2={height - padding.bottom}
                stroke="#334155"
                strokeWidth="1.5"
              />

              {/* Bianchi Theoretical Curve */}
              <path
                d={pathData}
                fill="none"
                stroke="#38bdf8"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Theoretical marker at current station count */}
              <circle
                cx={simX}
                cy={theoY}
                r="4"
                fill="#0284c7"
                stroke="#38bdf8"
                strokeWidth="1.5"
              />

              {/* Vertical connecting line between simulation & theory */}
              <line
                x1={simX}
                y1={theoY}
                x2={simX}
                y2={simY}
                stroke="#94a3b8"
                strokeWidth="1.5"
                strokeDasharray="3 3"
              />

              {/* Real-time Simulated Point */}
              <circle
                cx={simX}
                cy={simY}
                r="6"
                fill="#10b981"
                stroke="#ffffff"
                strokeWidth="2"
                className="animate-pulse"
              />

              {/* Labels */}
              <text
                x={width / 2}
                y={height - 8}
                fill="#94a3b8"
                fontSize="11"
                fontFamily="Plus Jakarta Sans"
                textAnchor="middle"
              >
                Number of Contending Stations (n)
              </text>
              <text
                transform={`rotate(-90) translate(${-(height / 2)}, 16)`}
                fill="#94a3b8"
                fontSize="11"
                fontFamily="Plus Jakarta Sans"
                textAnchor="middle"
              >
                Throughput (Mbps)
              </text>
            </svg>
          </div>
        </div>

        {/* Analytical Verification Stats & Sliders */}
        <div className="flex flex-col gap-4">
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-4 flex flex-col gap-3">
            <span className="text-xs font-semibold text-slate-300">
              Live Model Comparison @ n = {currentStationCount}
            </span>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800/60">
                <span className="text-slate-400">Bianchi Saturation S(n):</span>
                <span className="font-mono text-sky-400 font-semibold tabular-nums">
                  {currentTheoretical.saturationThroughputMbps.toFixed(2)} Mbps
                </span>
              </div>

              <div className="flex items-center justify-between pb-2 border-b border-slate-800/60">
                <span className="text-slate-400">Simulation Measured:</span>
                <span className="font-mono text-emerald-400 font-semibold tabular-nums">
                  {simTput.toFixed(2)} Mbps
                </span>
              </div>

              <div className="flex items-center justify-between pb-2 border-b border-slate-800/60">
                <span className="text-slate-400">Slot Tx Prob (τ):</span>
                <span className="font-mono text-slate-200 tabular-nums">
                  {currentTheoretical.tau.toFixed(4)}
                </span>
              </div>

              <div className="flex items-center justify-between pb-2 border-b border-slate-800/60">
                <span className="text-slate-400">Theo. Collision Prob (p):</span>
                <span className="font-mono text-slate-200 tabular-nums">
                  {(currentTheoretical.pCollision * 100).toFixed(1)}%
                </span>
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-slate-400">Sim vs Analytic Delta:</span>
                <span className={`font-mono font-semibold tabular-nums ${
                  diffPct < 15 ? 'text-emerald-400' : diffPct < 30 ? 'text-amber-400' : 'text-slate-300'
                }`}>
                  Δ {diffPct.toFixed(1)}%
                </span>
              </div>
            </div>
          </div>

          {/* Model Parameter Sliders */}
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-4 flex flex-col gap-3">
            <span className="text-xs font-semibold text-slate-300">
              Analytic Model Parameters
            </span>

            <div className="space-y-3 text-xs">
              <div>
                <div className="flex items-center justify-between text-slate-400 mb-1">
                  <span>CWmin (Min Contention Window):</span>
                  <span className="font-mono text-white">{cwMin}</span>
                </div>
                <input
                  type="range"
                  min="7"
                  max="63"
                  step="8"
                  value={cwMin}
                  onChange={(e) => setCwMin(Number(e.target.value))}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-400"
                />
              </div>

              <div>
                <div className="flex items-center justify-between text-slate-400 mb-1">
                  <span>Packet Payload Size:</span>
                  <span className="font-mono text-white">{packetSize} bytes</span>
                </div>
                <input
                  type="range"
                  min="256"
                  max="2304"
                  step="256"
                  value={packetSize}
                  onChange={(e) => setPacketSize(Number(e.target.value))}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-400"
                />
              </div>

              <div>
                <div className="flex items-center justify-between text-slate-400 mb-1">
                  <span>PHY Channel Bitrate:</span>
                  <span className="font-mono text-white">{phyRate} Mbps</span>
                </div>
                <input
                  type="range"
                  min="12"
                  max="144"
                  step="6"
                  value={phyRate}
                  onChange={(e) => setPhyRate(Number(e.target.value))}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-400"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Theoretical Formula Reference Card */}
      <div className="bg-slate-900/30 border border-slate-800/80 rounded-xl p-4 text-xs text-slate-400">
        <div className="flex items-center gap-2 font-semibold text-slate-200 mb-2">
          <BookOpen className="w-4 h-4 text-sky-400" />
          <span>Bianchi 2D Markov Chain Mathematical Formulation</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono text-[11px] bg-slate-950/60 p-3 rounded-lg border border-slate-800/60">
          <div>
            <div className="text-sky-400 mb-1">1. Slot Transmission Probability τ(p):</div>
            <div className="text-slate-300">
              τ = 2(1 - 2p) / [ (1 - 2p)(W + 1) + pW(1 - (2p)^m) ]
            </div>
            <div className="text-slate-500 text-[10px] mt-0.5">
              where W = CWmin + 1, m = log2(CWmax/CWmin)
            </div>
          </div>

          <div>
            <div className="text-sky-400 mb-1">2. Conditional Collision Probability p(τ):</div>
            <div className="text-slate-300">
              p = 1 - (1 - τ)^(n - 1)
            </div>
            <div className="text-slate-500 text-[10px] mt-0.5">
              where n is the number of active contending stations
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
