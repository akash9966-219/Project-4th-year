/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { Station, TrafficSchedulerAlgorithm } from '../types/wlan';
import { EDCA_DEFAULTS } from '../simulation/constants';
import { Cpu, Check, BarChart2, ShieldAlert, ArrowUpDown, AlertTriangle } from 'lucide-react';

interface SchedulerComparisonProps {
  currentScheduler: TrafficSchedulerAlgorithm;
  onSelectScheduler: (scheduler: TrafficSchedulerAlgorithm) => void;
  stations: Station[];
}

export const SchedulerComparison: React.FC<SchedulerComparisonProps> = ({
  currentScheduler,
  onSelectScheduler,
  stations,
}) => {
  const [stationSortKey, setStationSortKey] = useState<'tput-desc' | 'tput-asc' | 'collision-desc' | 'delay-desc' | 'id-asc'>('tput-desc');
  const schedulers: Array<{
    id: TrafficSchedulerAlgorithm;
    name: string;
    type: string;
    efficiency: string;
    fairness: string;
    description: string;
    formula: string;
  }> = [
    {
      id: 'ROUND_ROBIN',
      name: 'Round Robin (RR)',
      type: 'Packet Cyclic',
      efficiency: 'Low (Suffers 802.11 Anomaly)',
      fairness: 'Packet-Count Equal',
      description: 'Cycles sequentially through active station queues. Slow stations transmitting at low PHY rates occupy excessive airtime, dragging down overall BSS throughput.',
      formula: 'StationIndex = (k + 1) mod N',
    },
    {
      id: 'PROPORTIONAL_FAIR',
      name: 'Proportional Fair (PF)',
      type: 'Channel-Aware',
      efficiency: 'High (Multi-user Diversity)',
      fairness: 'Logarithmic Airtime Balance',
      description: 'Schedules station with highest instantaneous rate relative to its historical average throughput. Maximizes aggregate capacity while guaranteeing long-term fairness.',
      formula: 'arg max_i [ R_i(t) / T_i(t)^α ]',
    },
    {
      id: 'DEFICIT_ROUND_ROBIN',
      name: 'Deficit Round Robin (DRR)',
      type: 'Byte Quantum',
      efficiency: 'Moderate',
      fairness: 'Byte-Volume Equal',
      description: 'Maintains a deficit counter per queue with a fixed byte quantum per round. Prevents large MTU (1500B) packets from starving short voice/control packets.',
      formula: 'Deficit_i += Quantum; while (Deficit_i >= PacketSize) transmit()',
    },
    {
      id: 'EARLIEST_DEADLINE',
      name: 'Earliest Deadline First (EDF)',
      type: 'Delay-Bounded',
      efficiency: 'QoS Optimized',
      fairness: 'Urgency Priority',
      description: 'Prioritizes packets whose playback deadline is closest to expiring. Drastically reduces packet drop rates for VoIP (AC_VO) and real-time interactive video (AC_VI).',
      formula: 'arg min_i [ t_deadline(p_i) - t_current ]',
    },
    {
      id: 'OFDMA_MULTI_USER',
      name: '802.11ax OFDMA Multi-User',
      type: 'Parallel Subcarrier RUs',
      efficiency: 'Maximum (Zero Contention)',
      fairness: 'Resource Unit Partitioned',
      description: 'The AP issues a Trigger Frame (TF) and allocates parallel Resource Units (e.g. 9 stations in 26-tone RUs) simultaneously, eliminating backoff collisions entirely.',
      formula: 'Channel Bandwidth = ∑ RU_k (26-tone, 52-tone, 106-tone)',
    },
  ];

  // Calculate per-station delivered bytes and packets
  const clientStations = stations.filter((s) => s.role === 'STATION');
  const maxBytes = Math.max(1, ...clientStations.map((s) => s.bytesTransmitted));

  // Sort client stations according to selected performance metric
  const sortedStations = useMemo(() => {
    const list = [...clientStations];
    list.sort((a, b) => {
      const aTput = a.bytesTransmitted;
      const bTput = b.bytesTransmitted;
      const aAtt = a.packetsTransmitted + a.collisionCount;
      const bAtt = b.packetsTransmitted + b.collisionCount;
      const aColRate = aAtt > 0 ? a.collisionCount / aAtt : 0;
      const bColRate = bAtt > 0 ? b.collisionCount / bAtt : 0;
      const aDelay = a.averageDelayMs || 0;
      const bDelay = b.averageDelayMs || 0;

      const aId = parseInt(a.id.replace(/\D/g, ''), 10) || 0;
      const bId = parseInt(b.id.replace(/\D/g, ''), 10) || 0;

      switch (stationSortKey) {
        case 'tput-asc':
          return aTput - bTput; // Lowest first (starved nodes)
        case 'tput-desc':
          return bTput - aTput; // Highest first
        case 'collision-desc':
          return bColRate - aColRate; // Highest collision rate first
        case 'delay-desc':
          return bDelay - aDelay; // Highest latency first
        case 'id-asc':
        default:
          return aId - bId;
      }
    });
    return list;
  }, [clientStations, stationSortKey]);

  return (
    <div className="bg-slate-950 rounded-xl border border-slate-800/80 p-5 flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800/80">
        <div>
          <h3 className="text-base font-semibold text-white tracking-tight">
            Traffic Scheduling &amp; Resource Allocation Lab
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Evaluate packet scheduling strategies and multi-user OFDMA airtime fairness
          </p>
        </div>
      </div>

      {/* Scheduler Selector Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {schedulers.map((sch) => {
          const isSelected = currentScheduler === sch.id;
          return (
            <button
              key={sch.id}
              onClick={() => onSelectScheduler(sch.id)}
              className={`p-4 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                isSelected
                  ? 'bg-sky-950/40 border-sky-500/80 shadow-md shadow-sky-950/50'
                  : 'bg-slate-900/40 border-slate-800/80 hover:border-slate-700/80'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-sm font-semibold ${isSelected ? 'text-sky-300' : 'text-slate-200'}`}>
                    {sch.name}
                  </span>
                  {isSelected && (
                    <span className="w-5 h-5 rounded-full bg-sky-500/20 text-sky-400 flex items-center justify-center">
                      <Check className="w-3 h-3" />
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 text-[11px] text-slate-400 mb-2">
                  <span>{sch.type}</span>
                  <span className="text-slate-600">·</span>
                  <span className={sch.efficiency.includes('Low') ? 'text-amber-400' : 'text-emerald-400'}>
                    {sch.efficiency}
                  </span>
                </div>

                <p className="text-xs text-slate-400 line-clamp-2 mb-3">
                  {sch.description}
                </p>
              </div>

              <div className="pt-2 border-t border-slate-800/60 font-mono text-[10px] text-slate-500 truncate">
                {sch.formula}
              </div>
            </button>
          );
        })}
      </div>

      {/* Per-Station Airtime Allocation Bar Chart with Sorting */}
      <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-4 flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
            <BarChart2 className="w-4 h-4 text-sky-400" />
            <span>Station Performance Distribution Under {schedulers.find(s => s.id === currentScheduler)?.name}</span>
          </div>

          {/* Performance Sorting Selector */}
          <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs">
            <ArrowUpDown className="w-3.5 h-3.5 text-sky-400" />
            <span className="text-slate-500 text-[11px]">Sort:</span>
            <select
              value={stationSortKey}
              onChange={(e) => setStationSortKey(e.target.value as any)}
              className="bg-transparent text-slate-200 text-xs font-medium focus:outline-none cursor-pointer"
            >
              <option value="tput-desc">Throughput (Highest First)</option>
              <option value="tput-asc">Throughput (Lowest / Starved First)</option>
              <option value="collision-desc">💥 Collision Rate (Highest First)</option>
              <option value="delay-desc">⏱️ Latency (Highest First)</option>
              <option value="id-asc">Station Number (1-N)</option>
            </select>
          </div>
        </div>

        <div className="space-y-2 mt-2">
          {sortedStations.map((sta) => {
            const pct = (sta.bytesTransmitted / maxBytes) * 100;
            const tputMb = (sta.bytesTransmitted * 8) / 1e6;
            const catDef = EDCA_DEFAULTS[sta.activeCategory];
            const attempts = sta.packetsTransmitted + sta.collisionCount;
            const collisionRatePct = attempts > 0 ? (sta.collisionCount / attempts) * 100 : 0;
            const isStruggling = collisionRatePct >= 20 || sta.averageDelayMs >= 35 || sta.packetsLost > 0;

            return (
              <div
                key={sta.id}
                className={`flex items-center gap-3 text-xs p-1.5 rounded-lg transition-colors ${
                  isStruggling ? 'bg-red-950/20 border border-red-500/20' : 'hover:bg-slate-900/60'
                }`}
              >
                <div className="flex items-center gap-1.5 w-20 shrink-0">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: sta.color }}
                  />
                  <span className="font-mono text-slate-200 font-bold">{sta.id}</span>
                  {isStruggling && (
                    <span title="Node struggling with high collision rate or delay">
                      <AlertTriangle className="w-3 h-3 text-red-400 shrink-0" />
                    </span>
                  )}
                </div>

                <span className="text-slate-500 text-[10px] w-28 shrink-0 truncate">
                  {sta.phyRateMbps} Mbps · {sta.trafficPattern.replace('_', ' ')}
                </span>

                {/* Progress Bar */}
                <div className="flex-1 h-3.5 bg-slate-950 rounded overflow-hidden border border-slate-800/80 relative">
                  <div
                    className="h-full rounded transition-all duration-300"
                    style={{
                      width: `${Math.max(2, pct)}%`,
                      backgroundColor: catDef?.color || '#38bdf8',
                    }}
                  />
                </div>

                <span className="font-mono text-slate-300 tabular-nums w-18 text-right shrink-0">
                  {tputMb.toFixed(2)} MB
                </span>

                <span
                  className={`font-mono text-[11px] tabular-nums w-14 text-right shrink-0 ${
                    collisionRatePct >= 20 ? 'text-red-400 font-bold' : 'text-slate-400'
                  }`}
                  title={`Collisions: ${sta.collisionCount} / ${attempts}`}
                >
                  {collisionRatePct.toFixed(0)}% col
                </span>

                <span
                  className={`font-mono text-[10px] tabular-nums w-14 text-right shrink-0 ${
                    sta.averageDelayMs >= 35 ? 'text-amber-400 font-bold' : 'text-slate-500'
                  }`}
                >
                  {sta.averageDelayMs.toFixed(1)}ms
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
