/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Station, AccessCategory, QLearningAgentState } from '../types/wlan';
import { EDCA_DEFAULTS } from '../simulation/constants';
import { X, Radio, Layers, AlertTriangle, ShieldCheck, ArrowRight } from 'lucide-react';

interface StationDetailModalProps {
  station: Station | null;
  onClose: () => void;
  qAgent: QLearningAgentState;
}

export const StationDetailModal: React.FC<StationDetailModalProps> = ({
  station,
  onClose,
  qAgent,
}) => {
  if (!station) return null;

  const categories: AccessCategory[] = ['AC_VO', 'AC_VI', 'AC_BE', 'AC_BK'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-slate-950 border border-slate-800 rounded-xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div
              className="w-3.5 h-3.5 rounded-full"
              style={{ backgroundColor: station.color }}
            />
            <div>
              <h3 className="text-sm font-semibold text-white tracking-tight flex items-center gap-2">
                <span>{station.name} ({station.id})</span>
                <span className="text-xs font-mono text-slate-400">· {station.role}</span>
              </h3>
              <p className="text-xs text-slate-400 font-mono">
                Distance: {station.distanceToAp.toFixed(1)}m · SNR: {station.snrDb} dB · PHY: {station.phyRateMbps} Mbps
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs text-slate-300">
          {/* MAC State Card */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800/80">
              <span className="text-slate-400 text-[11px]">MAC State</span>
              <div className="text-sm font-mono font-semibold text-sky-400 mt-1">
                {station.macState}
              </div>
            </div>
            <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800/80">
              <span className="text-slate-400 text-[11px]">Contention Window (CW)</span>
              <div className="text-sm font-mono font-semibold text-white mt-1 tabular-nums">
                {station.currentCw}
              </div>
            </div>
            <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800/80">
              <span className="text-slate-400 text-[11px]">Backoff Slots</span>
              <div className="text-sm font-mono font-semibold text-amber-400 mt-1 tabular-nums">
                {station.currentBackoff} slots
              </div>
            </div>
            <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800/80">
              <span className="text-slate-400 text-[11px]">Mean Latency</span>
              <div className="text-sm font-mono font-semibold text-emerald-400 mt-1 tabular-nums">
                {station.averageDelayMs.toFixed(1)} ms
              </div>
            </div>
          </div>

          {/* 4 EDCA Queues Detailed Table */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 font-semibold text-white">
              <Layers className="w-3.5 h-3.5 text-sky-400" />
              <span>Internal 4-Queue EDCA Architecture</span>
            </div>

            <div className="overflow-x-auto border border-slate-800/80 rounded-lg bg-slate-900/30">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-mono text-[11px] bg-slate-900/60">
                    <th className="py-2 px-3">Queue</th>
                    <th className="py-2 px-3">Buffered</th>
                    <th className="py-2 px-3">CW Bounds</th>
                    <th className="py-2 px-3">AIFSN</th>
                    <th className="py-2 px-3">Delivered</th>
                    <th className="py-2 px-3">Collisions</th>
                    <th className="py-2 px-3">Dropped</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono text-xs">
                  {categories.map((cat) => {
                    const q = station.queues[cat];
                    const def = EDCA_DEFAULTS[cat];
                    const isQueueActive = station.activeCategory === cat;

                    return (
                      <tr
                        key={cat}
                        className={isQueueActive ? 'bg-sky-500/10' : ''}
                      >
                        <td className="py-2.5 px-3 flex items-center gap-2">
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: def.color }}
                          />
                          <span className="font-semibold text-slate-200">{cat}</span>
                          {isQueueActive && (
                            <span className="text-[10px] text-sky-400 font-sans">Active</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-slate-300 tabular-nums">
                          {q.packets.length} pkts
                        </td>
                        <td className="py-2.5 px-3 text-slate-400 tabular-nums">
                          {q.cwMin}–{q.cwMax}
                        </td>
                        <td className="py-2.5 px-3 text-slate-400 tabular-nums">
                          {q.aifsn}
                        </td>
                        <td className="py-2.5 px-3 text-emerald-400 font-medium tabular-nums">
                          {q.totalDelivered}
                        </td>
                        <td className="py-2.5 px-3 text-red-400 tabular-nums">
                          {q.totalCollisions}
                        </td>
                        <td className="py-2.5 px-3 text-amber-400 tabular-nums">
                          {q.totalDropped}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Q-Learning Policy / RL State for this Station */}
          <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-800/80 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-200">
                Reinforcement Learning Contention Policy Matrix
              </span>
              <span className="text-[10px] font-mono text-slate-500">
                α={qAgent.alpha} · γ={qAgent.gamma} · ε={qAgent.epsilon}
              </span>
            </div>

            <div className="grid grid-cols-4 gap-2 font-mono text-[11px] text-center pt-1">
              {['0: 0.75×CW', '1: Hold CW', '2: 1.5×CW', '3: 2.5×CW'].map((actionName, aIdx) => {
                const isSelected = qAgent.lastAction === aIdx;
                return (
                  <div
                    key={aIdx}
                    className={`p-2 rounded border ${
                      isSelected
                        ? 'bg-sky-500/20 border-sky-500 text-sky-300 font-semibold'
                        : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    <div>{actionName}</div>
                    <div className="text-[10px] text-slate-500 mt-1">
                      {isSelected ? 'Last Action' : 'Action Space'}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
