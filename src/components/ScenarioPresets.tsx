/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { SimulationConfig } from '../types/wlan';
import { Sparkles, Users, Video, Database, Radio, Route } from 'lucide-react';

interface ScenarioPreset {
  id: string;
  name: string;
  badge: string;
  description: string;
  icon: React.ElementType;
  config: Partial<SimulationConfig>;
}

interface ScenarioPresetsProps {
  onApplyScenario: (config: Partial<SimulationConfig>) => void;
  currentConfig: SimulationConfig;
}

export const ScenarioPresets: React.FC<ScenarioPresetsProps> = ({
  onApplyScenario,
  currentConfig,
}) => {
  const presets: ScenarioPreset[] = [
    {
      id: 'auditorium',
      name: 'Dense Auditorium (Contention Collapse)',
      badge: 'Contention Benchmark',
      description: '30 stations contending simultaneously. Demonstrates standard BEB collision saturation collapse and how Q-Learning & Idle Sense prevent degradation.',
      icon: Users,
      config: {
        stationCount: 30,
        congestionAlgorithm: 'STANDARD_BEB',
        trafficScheduler: 'PROPORTIONAL_FAIR',
        aqmMode: 'FIFO_DROP_TAIL',
        wifiStandard: '802.11ax',
      },
    },
    {
      id: 'multimedia',
      name: 'Mixed Multimedia QoS Starvation',
      badge: 'EDCA QoS',
      description: 'Simultaneous VoIP, 4K video conferencing, and background bulk downloads. Demonstrates EDCA priority queueing and AIFSN timing advantage.',
      icon: Video,
      config: {
        stationCount: 12,
        congestionAlgorithm: 'AIMD_CW',
        trafficScheduler: 'EARLIEST_DEADLINE',
        aqmMode: 'FIFO_DROP_TAIL',
      },
    },
    {
      id: 'bufferbloat',
      name: 'Bufferbloat & CoDel AQM Testbench',
      badge: 'Active Queue Management',
      description: 'Massive TCP packet backlog. Shows how DropTail FIFO induces severe queuing delay, while CoDel & FQ-CoDel maintain 5ms sojourn time.',
      icon: Database,
      config: {
        stationCount: 8,
        maxQueueCapacity: 128,
        aqmMode: 'CODEL',
        congestionAlgorithm: 'IDLE_SENSE',
      },
    },
    {
      id: 'wifi6_ofdma',
      name: '802.11ax OFDMA Parallel Scheduling',
      badge: 'Wi-Fi 6 Trigger Multi-User',
      description: 'Multi-User Trigger Frames allocating 26-tone Resource Units (RUs) across up to 9 stations in parallel, eliminating contention backoff collisions.',
      icon: Radio,
      config: {
        stationCount: 16,
        wifiStandard: '802.11ax',
        trafficScheduler: 'OFDMA_MULTI_USER',
        congestionAlgorithm: 'Q_LEARNING_RL',
        dynamicMobilityEnabled: false,
      },
    },
    {
      id: 'dynamic_mobility',
      name: 'Dynamic Mobility & Topology Shift',
      badge: 'Mobile Trajectory',
      description: 'Stations orbit and converge along orbital and lemniscate paths. Evaluates how changing distances, SNR, and PHY rate adaptation stress contention control.',
      icon: Route,
      config: {
        stationCount: 14,
        wifiStandard: '802.11ax',
        congestionAlgorithm: 'IDLE_SENSE',
        trafficScheduler: 'PROPORTIONAL_FAIR',
        dynamicMobilityEnabled: true,
      },
    },
  ];

  return (
    <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
          <Sparkles className="w-4 h-4 text-sky-400" />
          <span>Quick Scenario Benchmark Presets</span>
        </div>
        <span className="text-xs text-slate-500">
          One-click evaluation profiles for research &amp; classroom study
        </span>
      </div>

      <div className="flex overflow-x-auto pb-1 gap-3 sm:grid sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 scrollbar-none">
        {presets.map((preset) => {
          const Icon = preset.icon;
          return (
            <button
              key={preset.id}
              onClick={() => onApplyScenario(preset.config)}
              className="w-[230px] shrink-0 sm:w-auto p-3.5 rounded-lg border border-slate-800/80 bg-slate-950/60 hover:bg-slate-900 hover:border-slate-700/80 transition-all text-left flex flex-col justify-between group cursor-pointer"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="w-7 h-7 rounded-md bg-slate-900 border border-slate-800 flex items-center justify-center text-sky-400 group-hover:text-white transition-colors">
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-[10px] font-mono text-slate-500">
                    {preset.badge}
                  </span>
                </div>

                <div className="text-xs font-semibold text-slate-200 group-hover:text-sky-300 transition-colors mb-1">
                  {preset.name}
                </div>

                <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                  {preset.description}
                </p>
              </div>

              <div className="mt-3 pt-2 border-t border-slate-800/60 flex items-center justify-between text-[10px] text-slate-500">
                <span>Load Profile</span>
                <span className="text-sky-400 group-hover:translate-x-0.5 transition-transform">
                  Apply →
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
