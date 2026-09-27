/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Station, TrafficSchedulerAlgorithm } from '../types/wlan';
import { EDCA_DEFAULTS } from '../simulation/constants';
import { Cpu, Check, BarChart2, ShieldAlert } from 'lucide-react';

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

      {/* Per-Station Airtime Allocation Bar Chart */}
      <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
            <BarChart2 className="w-4 h-4 text-sky-400" />
            <span>Station Throughput Distribution Under {schedulers.find(s => s.id === currentScheduler)?.name}</span>
          </div>
          <span className="text-xs text-slate-500">
            Airtime fairness vs 802.11 Performance Anomaly
          </span>
        </div>

        <div className="space-y-2 mt-2">
          {clientStations.map((sta) => {
            const pct = (sta.bytesTransmitted / maxBytes) * 100;
            const tputMb = (sta.bytesTransmitted * 8) / 1e6;
            const catDef = EDCA_DEFAULTS[sta.activeCategory];

            return (
              <div key={sta.id} className="flex items-center gap-3 text-xs">
                <span className="font-mono text-slate-300 w-16 shrink-0">{sta.id}</span>
                <span className="text-slate-500 text-[10px] w-20 shrink-0 truncate">
                  {sta.phyRateMbps} Mbps · {sta.trafficPattern}
                </span>

                {/* Bar */}
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
                <span className="font-mono text-slate-500 text-[10px] tabular-nums w-12 text-right shrink-0">
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
