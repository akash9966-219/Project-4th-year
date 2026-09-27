/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { BookOpen, Cpu, Zap, Wifi, ShieldCheck, Database } from 'lucide-react';

export const AlgorithmExplainer: React.FC = () => {
  const [activeSection, setActiveSection] = useState<'csmaca' | 'edca' | 'idlesense' | 'qlearning' | 'codel' | 'ofdma'>('csmaca');

  const sections = [
    { id: 'csmaca', title: '1. CSMA/CA & BEB', icon: Wifi },
    { id: 'edca', title: '2. IEEE 802.11e EDCA', icon: Zap },
    { id: 'idlesense', title: '3. Idle Sense CW', icon: ShieldCheck },
    { id: 'qlearning', title: '4. Q-Learning Contention', icon: Cpu },
    { id: 'codel', title: '5. Bufferbloat & CoDel', icon: Database },
    { id: 'ofdma', title: '6. 802.11ax OFDMA RUs', icon: BookOpen },
  ] as const;

  return (
    <div className="bg-slate-950 rounded-xl border border-slate-800/80 p-5 flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800/80">
        <div>
          <h3 className="text-base font-semibold text-white tracking-tight">
            IEEE 802.11 Congestion Control &amp; Traffic Scheduling Guide
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Mathematical formulations, state machine protocols, and cross-layer mechanics
          </p>
        </div>
      </div>

      {/* Segmented Section Tabs */}
      <div className="flex items-center gap-1.5 p-1 bg-slate-900/80 rounded-lg border border-slate-800 overflow-x-auto">
        {sections.map((sec) => {
          const Icon = sec.icon;
          const isActive = activeSection === sec.id;
          return (
            <button
              key={sec.id}
              onClick={() => setActiveSection(sec.id)}
              className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors cursor-pointer ${
                isActive
                  ? 'bg-sky-500 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{sec.title}</span>
            </button>
          );
        })}
      </div>

      {/* Section Content */}
      <div className="bg-slate-900/40 rounded-xl border border-slate-800/80 p-5 text-sm text-slate-300">
        {activeSection === 'csmaca' && (
          <div className="space-y-4">
            <h4 className="text-base font-semibold text-white">Carrier Sense Multiple Access with Collision Avoidance (CSMA/CA)</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Wireless transceivers are half-duplex and cannot transmit and detect collisions simultaneously (unlike Ethernet CSMA/CD).
              Therefore, 802.11 uses Collision Avoidance with random backoff counters drawn uniformly from a Contention Window <code className="text-sky-300">[0, CW]</code>.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-slate-950/70 p-4 rounded-lg border border-slate-800/80">
                <div className="text-xs font-semibold text-sky-400 mb-2">Binary Exponential Backoff (BEB) Rule</div>
                <div className="font-mono text-xs text-slate-300 space-y-1.5">
                  <p>• On Transmission Success: <span className="text-emerald-400">CW ← CWmin</span></p>
                  <p>• On Collision (No ACK): <span className="text-red-400">CW ← min(2 × (CW + 1) - 1, CWmax)</span></p>
                  <p>• Backoff Counter: <span className="text-cyan-400">BC ~ Uniform(0, CW)</span></p>
                </div>
              </div>

              <div className="bg-slate-950/70 p-4 rounded-lg border border-slate-800/80">
                <div className="text-xs font-semibold text-amber-400 mb-2">The Contention Collapse Vulnerability</div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  As the number of contending stations <code className="text-slate-300">n</code> grows beyond 20, resetting <code className="text-slate-300">CW ← CWmin</code> on every success leads to repeated immediate collisions, collapsing channel goodput from ~80% down to under 18%.
                </p>
              </div>
            </div>
          </div>
        )}

        {activeSection === 'edca' && (
          <div className="space-y-4">
            <h4 className="text-base font-semibold text-white">IEEE 802.11e/ax Enhanced Distributed Channel Access (EDCA)</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              EDCA replaces legacy DCF with 4 prioritized Access Categories (ACs). Each AC operates an independent virtual MAC backoff engine inside the same physical station, resolved via Internal Contention.
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-mono">
                    <th className="py-2 px-3">Access Category</th>
                    <th className="py-2 px-3">AIFSN</th>
                    <th className="py-2 px-3">CWmin</th>
                    <th className="py-2 px-3">CWmax</th>
                    <th className="py-2 px-3">TXOP Limit</th>
                    <th className="py-2 px-3">Target Traffic</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono text-slate-300">
                  <tr>
                    <td className="py-2 px-3 text-red-400 font-semibold">AC_VO (Voice)</td>
                    <td className="py-2 px-3">2</td>
                    <td className="py-2 px-3">3</td>
                    <td className="py-2 px-3">7</td>
                    <td className="py-2 px-3">1.504 ms</td>
                    <td className="py-2 px-3 text-slate-400">VoIP, Gaming telemetry (&lt;20ms)</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 text-amber-400 font-semibold">AC_VI (Video)</td>
                    <td className="py-2 px-3">2</td>
                    <td className="py-2 px-3">7</td>
                    <td className="py-2 px-3">15</td>
                    <td className="py-2 px-3">3.008 ms</td>
                    <td className="py-2 px-3 text-slate-400">Video streaming, H.265 frames</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 text-cyan-400 font-semibold">AC_BE (Best Effort)</td>
                    <td className="py-2 px-3">3</td>
                    <td className="py-2 px-3">15</td>
                    <td className="py-2 px-3">1023</td>
                    <td className="py-2 px-3">0</td>
                    <td className="py-2 px-3 text-slate-400">Web traffic, TCP bulk</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 text-purple-400 font-semibold">AC_BK (Background)</td>
                    <td className="py-2 px-3">7</td>
                    <td className="py-2 px-3">15</td>
                    <td className="py-2 px-3">1023</td>
                    <td className="py-2 px-3">0</td>
                    <td className="py-2 px-3 text-slate-400">Downloads, Cloud sync</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <p className="text-xs text-slate-400 italic">
              Formula: AIFS[AC] = SIFS + AIFSN[AC] × SlotTime (9 µs). Lower AIFSN allows voice packets to start counting down before best-effort queues.
            </p>
          </div>
        )}

        {activeSection === 'idlesense' && (
          <div className="space-y-4">
            <h4 className="text-base font-semibold text-white">Idle Sense Dynamic Contention Window Control</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Proposed by Martin Heusse et al., Idle Sense replaces BEB by observing the number of consecutive idle slots between transmissions.
              Mathematical analysis proves that for any number of contending stations <code className="text-slate-300">n</code>, channel efficiency is maximized when the average number of idle slots equals <code className="text-sky-300">n_target ≈ 5.68 slots</code>.
            </p>

            <div className="bg-slate-950/70 p-4 rounded-lg border border-slate-800/80 font-mono text-xs space-y-2">
              <div className="text-sky-400 font-semibold">Idle Sense Adaptation Law:</div>
              <p className="text-slate-300">
                • If n_idle &lt; 5.68: Channel is congested → <span className="text-amber-400">CW ← min(CWmax, CW + Δ_add)</span>
              </p>
              <p className="text-slate-300">
                • If n_idle &gt; 5.68: Channel is underutilized → <span className="text-emerald-400">CW ← max(CWmin, CW × γ_mult)</span>
              </p>
              <p className="text-slate-400 text-[11px] pt-1 border-t border-slate-800">
                Result: Prevents contention collapse and delivers near-optimal Jain's fairness (&gt; 0.98).
              </p>
            </div>
          </div>
        )}

        {activeSection === 'qlearning' && (
          <div className="space-y-4">
            <h4 className="text-base font-semibold text-white">Reinforcement Learning (Q-Learning) Contention Control</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              A dynamic Reinforcement Learning agent optimizes the MAC contention policy online without requiring prior knowledge of network density or channel fading.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 font-mono text-xs">
              <div className="bg-slate-950/70 p-3 rounded-lg border border-slate-800/80">
                <div className="text-sky-400 font-semibold mb-1">State Space S:</div>
                <div className="text-slate-300 text-[11px]">
                  (CollisionRate_bin, QueueBacklog_bin)
                </div>
              </div>
              <div className="bg-slate-950/70 p-3 rounded-lg border border-slate-800/80">
                <div className="text-sky-400 font-semibold mb-1">Action Space A:</div>
                <div className="text-slate-300 text-[11px]">
                  {`{ 0: 0.75×CW, 1: Hold, 2: 1.5×CW, 3: 2.5×CW }`}
                </div>
              </div>
              <div className="bg-slate-950/70 p-3 rounded-lg border border-slate-800/80">
                <div className="text-sky-400 font-semibold mb-1">Reward Function R:</div>
                <div className="text-slate-300 text-[11px]">
                  R = Goodput - 2.5·p_col - 0.5·Delay
                </div>
              </div>
            </div>

            <div className="bg-slate-950/70 p-4 rounded-lg border border-slate-800/80 font-mono text-xs">
              <div className="text-emerald-400 font-semibold mb-1">Temporal Difference Bellman Update:</div>
              <div className="text-slate-200">
                Q(s, a) ← Q(s, a) + α · [ R + γ · max_a' Q(s', a') - Q(s, a) ]
              </div>
              <div className="text-slate-500 text-[10px] mt-1">
                Learning rate α = 0.15, Discount factor γ = 0.85, Epsilon ε = 0.10
              </div>
            </div>
          </div>
        )}

        {activeSection === 'codel' && (
          <div className="space-y-4">
            <h4 className="text-base font-semibold text-white">Bufferbloat &amp; Active Queue Management (CoDel / FQ-CoDel)</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Standard DropTail (FIFO) queues in Wi-Fi access points buffer hundreds of megabytes of TCP frames, leading to &quot;bufferbloat&quot; where VoIP pings spike to 800ms+ during file downloads.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-slate-950/70 p-4 rounded-lg border border-slate-800/80 text-xs">
                <div className="font-semibold text-sky-400 mb-2">CoDel (Controlled Delay)</div>
                <p className="text-slate-300 leading-relaxed">
                  Monitors packet <em>sojourn time</em> (queuing delay). If the minimum delay observed over a 100ms window exceeds the 5ms target, CoDel drops packets at intervals spaced by <code className="text-cyan-300">interval / √count</code> to force TCP sender backoff without persistent standing queues.
                </p>
              </div>

              <div className="bg-slate-950/70 p-4 rounded-lg border border-slate-800/80 text-xs">
                <div className="font-semibold text-emerald-400 mb-2">FQ-CoDel (Fair Queuing CoDel)</div>
                <p className="text-slate-300 leading-relaxed">
                  Hashes flows into 1024 subqueues, applies Deficit Round Robin (DRR) scheduling between active queues, and runs CoDel inside each flow queue. This guarantees that small interactive packets (DNS, VoIP) are served immediately ahead of bulk TCP streams.
                </p>
              </div>
            </div>
          </div>
        )}

        {activeSection === 'ofdma' && (
          <div className="space-y-4">
            <h4 className="text-base font-semibold text-white">IEEE 802.11ax/be Multi-User OFDMA Resource Units (RUs)</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Wi-Fi 6 (802.11ax) and Wi-Fi 7 (802.11be) revolutionize wireless transmission by replacing serial single-user CSMA/CA with multi-user Orthogonal Frequency Division Multiple Access (OFDMA).
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-xs">
              <div className="bg-slate-950/70 p-3 rounded-lg border border-slate-800/80">
                <div className="text-sky-400 font-semibold">26-tone RU</div>
                <div className="text-slate-300 text-[11px] mt-1">Up to 9 Users</div>
                <div className="text-slate-500 text-[10px]">2 MHz bandwidth</div>
              </div>
              <div className="bg-slate-950/70 p-3 rounded-lg border border-slate-800/80">
                <div className="text-emerald-400 font-semibold">52-tone RU</div>
                <div className="text-slate-300 text-[11px] mt-1">Up to 4 Users</div>
                <div className="text-slate-500 text-[10px]">4 MHz bandwidth</div>
              </div>
              <div className="bg-slate-950/70 p-3 rounded-lg border border-slate-800/80">
                <div className="text-amber-400 font-semibold">106-tone RU</div>
                <div className="text-slate-300 text-[11px] mt-1">Up to 2 Users</div>
                <div className="text-slate-500 text-[10px]">8 MHz bandwidth</div>
              </div>
              <div className="bg-slate-950/70 p-3 rounded-lg border border-slate-800/80">
                <div className="text-purple-400 font-semibold">242-tone RU</div>
                <div className="text-slate-300 text-[11px] mt-1">Single User</div>
                <div className="text-slate-500 text-[10px]">20 MHz channel</div>
              </div>
            </div>

            <p className="text-xs text-slate-400">
              The AP transmits a <strong>Trigger Frame (TF)</strong> containing synchronization preambles and assigned RU indices. Stations respond simultaneously in the uplink direction, eliminating contention backoff collisions completely!
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
