/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  SimulationConfig,
  CongestionControlAlgorithm,
  TrafficSchedulerAlgorithm,
  AQMType,
  QLearningAgentState,
  ToastSettings,
} from '../types/wlan';
import { Sliders, Cpu, Settings2, ShieldCheck, Zap, Bell, Route } from 'lucide-react';

interface SimulationControlsProps {
  config: SimulationConfig;
  onChangeConfig: (newConfig: Partial<SimulationConfig>) => void;
  qAgent: QLearningAgentState;
  toastSettings: ToastSettings;
  onOpenNotificationSettings: () => void;
}

export const SimulationControls: React.FC<SimulationControlsProps> = ({
  config,
  onChangeConfig,
  qAgent,
  toastSettings,
  onOpenNotificationSettings,
}) => {
  return (
    <div className="bg-slate-950 rounded-xl border border-slate-800/80 p-5 flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
        <div className="flex items-center gap-2 text-sm font-semibold text-white">
          <Settings2 className="w-4 h-4 text-sky-400" />
          <span>MAC &amp; Congestion Control Parameters</span>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <button
            onClick={onOpenNotificationSettings}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-300 hover:text-white hover:border-slate-700 transition-colors cursor-pointer"
          >
            <Bell className="w-3.5 h-3.5 text-sky-400" />
            <span className="hidden xs:inline">Throughput Alert Threshold:</span>
            <span className="xs:hidden">Alert:</span>
            <span className="font-mono text-sky-400 font-semibold">
              &lt; {toastSettings.throughputThresholdMbps} Mbps
            </span>
          </button>
          <span className="text-xs text-slate-500 font-mono hidden sm:inline">
            Dynamic Runtime Tuning
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Congestion Control Algorithm */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-300 flex items-center justify-between">
            <span>Congestion Control</span>
            <span className="text-[10px] text-sky-400 font-mono">CW Adaptation</span>
          </label>
          <select
            value={config.congestionAlgorithm}
            onChange={(e) => onChangeConfig({ congestionAlgorithm: e.target.value as CongestionControlAlgorithm })}
            className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-sky-500 transition-colors cursor-pointer"
          >
            <option value="STANDARD_BEB">Standard BEB (Binary Exponential Backoff)</option>
            <option value="IDLE_SENSE">Idle Sense (Optimal n_target=5.68)</option>
            <option value="AIMD_CW">AIMD-CW (Additive Inc / Mult Dec)</option>
            <option value="Q_LEARNING_RL">Q-Learning RL (Adaptive Contention)</option>
          </select>
          <span className="text-[10px] text-slate-500 block">
            {config.congestionAlgorithm === 'STANDARD_BEB'
              ? 'Binary backoff resets to CWmin on success'
              : config.congestionAlgorithm === 'IDLE_SENSE'
              ? 'Adapts CW to match target idle slots'
              : config.congestionAlgorithm === 'AIMD_CW'
              ? 'Gentle multiplicative backoff decrease'
              : 'Q-Learning agent dynamically tunes CW'}
          </span>
        </div>

        {/* 2. Traffic Scheduler */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-300 flex items-center justify-between">
            <span>AP Traffic Scheduler</span>
            <span className="text-[10px] text-sky-400 font-mono">Airtime QoS</span>
          </label>
          <select
            value={config.trafficScheduler}
            onChange={(e) => onChangeConfig({ trafficScheduler: e.target.value as TrafficSchedulerAlgorithm })}
            className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-sky-500 transition-colors cursor-pointer"
          >
            <option value="PROPORTIONAL_FAIR">Proportional Fair (PF)</option>
            <option value="ROUND_ROBIN">Round Robin (RR)</option>
            <option value="DEFICIT_ROUND_ROBIN">Deficit Round Robin (DRR)</option>
            <option value="EARLIEST_DEADLINE">Earliest Deadline First (EDF)</option>
            <option value="OFDMA_MULTI_USER">802.11ax OFDMA Multi-User</option>
          </select>
          <span className="text-[10px] text-slate-500 block">
            {config.trafficScheduler === 'OFDMA_MULTI_USER'
              ? 'Parallel multi-user Trigger Frame transmission'
              : config.trafficScheduler === 'PROPORTIONAL_FAIR'
              ? 'Maximizes throughput with airtime fairness'
              : 'Sequential queuing discipline'}
          </span>
        </div>

        {/* 3. Active Queue Management (AQM) */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-300 flex items-center justify-between">
            <span>Bufferbloat &amp; AQM</span>
            <span className="text-[10px] text-sky-400 font-mono">Queue Discipline</span>
          </label>
          <select
            value={config.aqmMode}
            onChange={(e) => onChangeConfig({ aqmMode: e.target.value as AQMType })}
            className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-sky-500 transition-colors cursor-pointer"
          >
            <option value="FIFO_DROP_TAIL">FIFO DropTail (Legacy Bufferbloat)</option>
            <option value="CODEL">CoDel (Controlled Delay 5ms)</option>
            <option value="FQ_CODEL">FQ-CoDel (Fair Queuing CoDel)</option>
          </select>
          <span className="text-[10px] text-slate-500 block">
            {config.aqmMode === 'FIFO_DROP_TAIL'
              ? 'Tail drop causes massive standing queues'
              : 'Sojourn time tracking eliminates bufferbloat'}
          </span>
        </div>

        {/* 4. Station Count Slider */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-slate-300">Contending Stations (N)</span>
            <span className="font-mono text-sky-400 font-semibold">{config.stationCount}</span>
          </div>
          <input
            type="range"
            min="2"
            max="36"
            step="1"
            value={config.stationCount}
            onChange={(e) => onChangeConfig({ stationCount: Number(e.target.value) })}
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-400 mt-2"
          />
          <div className="flex justify-between text-[10px] text-slate-500 font-mono">
            <span>2 STA</span>
            <span>20 STA (Dense)</span>
            <span>36 STA (Extreme)</span>
          </div>
        </div>
      </div>

      {/* Secondary Row: Wi-Fi standard, Channel Bandwidth, RTS/CTS, and Q-learning display */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 pt-3 border-t border-slate-800/60 text-xs">
        {/* Wi-Fi Standard selector */}
        <div className="flex flex-wrap items-center justify-between gap-1.5 bg-slate-900/50 p-2.5 rounded-lg border border-slate-800/80">
          <span className="text-slate-400">Wi-Fi Protocol:</span>
          <div className="flex items-center gap-1">
            {(['802.11ax', '802.11ac', '802.11n'] as const).map((std) => (
              <button
                key={std}
                onClick={() => onChangeConfig({ wifiStandard: std })}
                className={`px-2 py-1 rounded text-[11px] font-mono transition-colors cursor-pointer ${
                  config.wifiStandard === std
                    ? 'bg-sky-500/20 text-sky-300 font-semibold border border-sky-500/30'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                {std}
              </button>
            ))}
          </div>
        </div>

        {/* Channel Bandwidth */}
        <div className="flex flex-wrap items-center justify-between gap-1.5 bg-slate-900/50 p-2.5 rounded-lg border border-slate-800/80">
          <span className="text-slate-400">Channel Width:</span>
          <div className="flex items-center gap-1 font-mono">
            {([20, 40, 80] as const).map((bw) => (
              <button
                key={bw}
                onClick={() => onChangeConfig({ channelBandwidthMhz: bw })}
                className={`px-2 py-1 rounded text-[11px] transition-colors cursor-pointer ${
                  config.channelBandwidthMhz === bw
                    ? 'bg-sky-500/20 text-sky-300 font-semibold border border-sky-500/30'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                {bw}M
              </button>
            ))}
          </div>
        </div>

        {/* RTS/CTS Handshake toggle */}
        <div className="flex flex-wrap items-center justify-between gap-1.5 bg-slate-900/50 p-2.5 rounded-lg border border-slate-800/80">
          <span className="text-slate-400">RTS/CTS Handshake:</span>
          <button
            onClick={() => onChangeConfig({ rtsCtsEnabled: !config.rtsCtsEnabled })}
            className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer ${
              config.rtsCtsEnabled
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                : 'bg-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            {config.rtsCtsEnabled ? 'Enabled' : 'Disabled'}
          </button>
        </div>

        {/* Dynamic Topology Mobility toggle */}
        <div className="flex flex-wrap items-center justify-between gap-1.5 bg-slate-900/50 p-2.5 rounded-lg border border-slate-800/80">
          <span className="text-slate-400 flex items-center gap-1.5">
            <Route className="w-3.5 h-3.5 text-purple-400" />
            <span>Predefined Paths:</span>
          </span>
          <button
            onClick={() => onChangeConfig({ dynamicMobilityEnabled: !config.dynamicMobilityEnabled })}
            className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer ${
              config.dynamicMobilityEnabled
                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                : 'bg-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            {config.dynamicMobilityEnabled ? 'Mobile Active' : 'Static BSS'}
          </button>
        </div>

        {/* Q-Learning Agent Status */}
        <div className="flex flex-wrap items-center justify-between gap-1.5 bg-slate-900/50 p-2.5 rounded-lg border border-slate-800/80 font-mono text-[11px]">
          <span className="text-slate-400">RL Reward:</span>
          <span className={`font-semibold tabular-nums ${
            qAgent.lastReward >= 0 ? 'text-emerald-400' : 'text-red-400'
          }`}>
            {qAgent.lastReward.toFixed(2)} (Total: {qAgent.totalRewardAccumulated.toFixed(1)})
          </span>
        </div>
      </div>
    </div>
  );
};
