/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { WirelessSimulationEngine } from './simulation/engine';
import { SimulationConfig, Station, ToastNotification, ToastSettings } from './types/wlan';
import { Navbar } from './components/Navbar';
import { NetworkCanvas } from './components/NetworkCanvas';
import { AirtimeTimeline } from './components/AirtimeTimeline';
import { MetricsDashboard } from './components/MetricsDashboard';
import { BianchiValidationChart } from './components/BianchiValidationChart';
import { SchedulerComparison } from './components/SchedulerComparison';
import { AlgorithmExplainer } from './components/AlgorithmExplainer';
import { SimulationControls } from './components/SimulationControls';
import { ScenarioPresets } from './components/ScenarioPresets';
import { StationDetailModal } from './components/StationDetailModal';
import { ToastContainer } from './components/ToastContainer';
import { NotificationSettingsModal } from './components/NotificationSettingsModal';
import { playAlertSound } from './utils/audio';
import { Activity, Wifi, Radio, Cpu, BookOpen, AlertTriangle } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<string>('stage');
  const [isRunning, setIsRunning] = useState<boolean>(true);
  const [speed, setSpeed] = useState<number>(1);
  const [showCarrierSenseRange, setShowCarrierSenseRange] = useState<boolean>(true);
  const [showInterferenceHeatmap, setShowInterferenceHeatmap] = useState<boolean>(true);
  const [selectedStationId, setSelectedStationId] = useState<string | null>(null);
  const [isNotificationSettingsOpen, setIsNotificationSettingsOpen] = useState<boolean>(false);

  // Toast notification state
  const [toasts, setToasts] = useState<ToastNotification[]>([]);
  const [toastHistory, setToastHistory] = useState<ToastNotification[]>([]);
  const [toastSettings, setToastSettings] = useState<ToastSettings>({
    enabled: true,
    throughputThresholdMbps: 15,
    starvationFairnessThreshold: 0.50,
    collisionThresholdPct: 30,
    cooldownSeconds: 8,
    soundEnabled: true,
  });
  const [isStarvationActive, setIsStarvationActive] = useState<boolean>(false);
  const [unreadAlertCount, setUnreadAlertCount] = useState<number>(0);
  const lastAlertTimeRef = useRef<number>(0);

  // Simulation engine instance
  const engineRef = useRef<WirelessSimulationEngine | null>(null);
  if (!engineRef.current) {
    engineRef.current = new WirelessSimulationEngine();
  }
  const engine = engineRef.current;

  // React state for triggering UI updates
  const [, setTick] = useState<number>(0);
  const animFrameRef = useRef<number | null>(null);
  const lastWallTimeRef = useRef<number>(performance.now());

  // Add a toast notification helper
  const addToast = useCallback((toastData: Omit<ToastNotification, 'id' | 'timestamp' | 'simTimeMs'>) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    const simTimeMs = engineRef.current ? engineRef.current.currentTimeUs / 1000 : 0;
    const newToast: ToastNotification = {
      ...toastData,
      id,
      timestamp: Date.now(),
      simTimeMs,
    };

    setToasts((prev) => [newToast, ...prev.slice(0, 3)]);
    setToastHistory((prev) => [newToast, ...prev.slice(0, 49)]);
    setUnreadAlertCount((c) => c + 1);

    if (toastSettings.soundEnabled) {
      playAlertSound(newToast.type === 'critical' ? 'critical' : newToast.type === 'warning' ? 'warning' : 'recovery');
    }

    setTimeout(() => {
      setToasts((current) => current.filter((t) => t.id !== id));
    }, 6500);
  }, [toastSettings.soundEnabled]);

  const handleDismissToast = useCallback((id: string) => {
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  const handleExecuteToastAction = useCallback((actionType: ToastNotification['actionType']) => {
    if (!engineRef.current || !actionType) return;

    if (actionType === 'SWITCH_IDLE_SENSE') {
      engineRef.current.config.congestionAlgorithm = 'IDLE_SENSE';
      addToast({
        type: 'info',
        title: 'Mitigation Applied',
        message: 'Switched Congestion Control to Idle Sense (tracking optimal n_target=5.68).',
      });
    } else if (actionType === 'SWITCH_OFDMA') {
      engineRef.current.config.trafficScheduler = 'OFDMA_MULTI_USER';
      addToast({
        type: 'info',
        title: 'Mitigation Applied',
        message: 'Switched scheduler to 802.11ax OFDMA Multi-User parallel Trigger Frames.',
      });
    } else if (actionType === 'SWITCH_PF') {
      engineRef.current.config.trafficScheduler = 'PROPORTIONAL_FAIR';
      addToast({
        type: 'info',
        title: 'Mitigation Applied',
        message: 'Switched to Proportional Fair scheduling to eliminate station airtime starvation.',
      });
    } else if (actionType === 'ENABLE_CODEL') {
      engineRef.current.config.aqmMode = 'CODEL';
      addToast({
        type: 'info',
        title: 'Mitigation Applied',
        message: 'Enabled CoDel Active Queue Management (5ms sojourn target).',
      });
    } else if (actionType === 'REDUCE_STATIONS') {
      engineRef.current.config.stationCount = Math.max(6, Math.floor(engineRef.current.config.stationCount * 0.6));
      engineRef.current.resetSimulation();
      addToast({
        type: 'info',
        title: 'Mitigation Applied',
        message: `Reduced contending stations down to ${engineRef.current.config.stationCount} to relieve MAC saturation.`,
      });
    }
    setTick((t) => t + 1);
  }, [addToast]);

  // Periodic Throughput & Starvation Monitor
  useEffect(() => {
    if (!isRunning || !engineRef.current) return;

    const interval = setInterval(() => {
      const currentEngine = engineRef.current;
      if (!currentEngine || currentEngine.currentTimeUs < 100_000) return;

      const metrics = currentEngine.currentMetrics;
      const tput = metrics.totalThroughputMbps;
      const colRate = metrics.collisionRatePct;
      const fairness = metrics.jainsFairnessIndex;
      const threshold = toastSettings.throughputThresholdMbps;
      const now = performance.now();

      if (tput < threshold) {
        setIsStarvationActive(true);

        if (toastSettings.enabled && now - lastAlertTimeRef.current >= toastSettings.cooldownSeconds * 1000) {
          lastAlertTimeRef.current = now;

          if (colRate > toastSettings.collisionThresholdPct) {
            addToast({
              type: 'critical',
              title: 'Contention Collapse & Starvation',
              message: `Throughput plunged to ${tput.toFixed(1)} Mbps (< ${threshold} Mbps). Severe collisions (${colRate.toFixed(1)}%) are collapsing channel capacity.`,
              throughputMbps: tput,
              thresholdMbps: threshold,
              actionLabel: 'Switch to Idle Sense',
              actionType: 'SWITCH_IDLE_SENSE',
            });
          } else if (fairness < toastSettings.starvationFairnessThreshold) {
            addToast({
              type: 'critical',
              title: 'Airtime Starvation Warning',
              message: `Throughput is ${tput.toFixed(1)} Mbps with unfair airtime distribution (Jain's index: ${fairness.toFixed(3)}). Distant stations are starving.`,
              throughputMbps: tput,
              thresholdMbps: threshold,
              actionLabel: 'Use Proportional Fair',
              actionType: 'SWITCH_PF',
            });
          } else {
            addToast({
              type: 'warning',
              title: 'Low Throughput Warning',
              message: `Aggregate throughput has dropped to ${tput.toFixed(1)} Mbps below the configured ${threshold} Mbps threshold.`,
              throughputMbps: tput,
              thresholdMbps: threshold,
              actionLabel: 'Enable 802.11ax OFDMA',
              actionType: 'SWITCH_OFDMA',
            });
          }
        }
      } else if (tput >= threshold * 1.25) {
        if (isStarvationActive) {
          setIsStarvationActive(false);
          if (toastSettings.enabled) {
            addToast({
              type: 'recovery',
              title: 'Network Capacity Recovered',
              message: `Aggregate throughput returned to ${tput.toFixed(1)} Mbps, successfully clearing the starvation state.`,
              throughputMbps: tput,
              thresholdMbps: threshold,
            });
          }
        }
      }
    }, 600);

    return () => clearInterval(interval);
  }, [isRunning, toastSettings, isStarvationActive, addToast]);

  // Continuous discrete-event simulation loop
  useEffect(() => {
    const loop = (wallTime: number) => {
      const deltaWallMs = Math.min(100, wallTime - lastWallTimeRef.current);
      lastWallTimeRef.current = wallTime;

      if (isRunning && engineRef.current) {
        const timeAdvanceUs = deltaWallMs * 1000 * speed * 0.4;
        engineRef.current.step(timeAdvanceUs);
        setTick((t) => (t + 1) % 10000);
      }

      animFrameRef.current = requestAnimationFrame(loop);
    };

    animFrameRef.current = requestAnimationFrame(loop);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isRunning, speed]);

  const handleTogglePlay = useCallback(() => {
    setIsRunning((prev) => !prev);
  }, []);

  const handleReset = useCallback(() => {
    if (engineRef.current) {
      engineRef.current.resetSimulation();
      setTick((t) => t + 1);
    }
  }, []);

  const handleStep = useCallback(() => {
    if (engineRef.current) {
      engineRef.current.step(200); // Step 200 µs
      setTick((t) => t + 1);
    }
  }, []);

  const handleChangeConfig = useCallback((newConfig: Partial<SimulationConfig>) => {
    if (engineRef.current) {
      const prevStationCount = engineRef.current.config.stationCount;
      engineRef.current.config = { ...engineRef.current.config, ...newConfig };
      if (newConfig.stationCount !== undefined && newConfig.stationCount !== prevStationCount) {
        engineRef.current.resetSimulation();
      }
      setTick((t) => t + 1);
    }
  }, []);

  const handleApplyScenario = useCallback((scenarioConfig: Partial<SimulationConfig>) => {
    if (engineRef.current) {
      engineRef.current.config = { ...engineRef.current.config, ...scenarioConfig };
      engineRef.current.resetSimulation();
      setTick((t) => t + 1);
    }
  }, []);

  const selectedStation = selectedStationId
    ? engine.stations.find((s) => s.id === selectedStationId) || null
    : null;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-sky-500 selection:text-white">
      {/* Strict Top Bar Contract Header */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isRunning={isRunning}
        onTogglePlay={handleTogglePlay}
        onReset={handleReset}
        onStep={handleStep}
        speed={speed}
        onSpeedChange={setSpeed}
        currentTimeMs={engine.currentTimeUs / 1000}
        onOpenNotificationSettings={() => {
          setIsNotificationSettingsOpen(true);
          setUnreadAlertCount(0);
        }}
        isStarvationActive={isStarvationActive}
        toastSettings={toastSettings}
        unreadAlertCount={unreadAlertCount}
      />

      {/* Main Workspace Viewport */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-5 md:p-6 flex flex-col gap-5 sm:gap-6">
        {/* TAB 1: Live Simulation Stage */}
        {activeTab === 'stage' && (
          <div className="flex flex-col gap-5 sm:gap-6">
            {/* Quick Scenario Benchmark Presets */}
            <ScenarioPresets
              onApplyScenario={handleApplyScenario}
              currentConfig={engine.config}
            />

            {/* 2-Zone Layout: Interactive Stage + Real-Time Metrics */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 items-start">
              {/* Left Zone: 2D Wireless BSS Canvas (7 cols on desktop, full width on tablet/mobile portrait) */}
              <div className="lg:col-span-7 flex flex-col gap-4">
                <NetworkCanvas
                  stations={engine.stations}
                  apStation={engine.apStation}
                  channel={engine.channel}
                  selectedStationId={selectedStationId}
                  onSelectStation={setSelectedStationId}
                  showCarrierSenseRange={showCarrierSenseRange}
                  onToggleRange={() => setShowCarrierSenseRange((prev) => !prev)}
                  showInterferenceHeatmap={showInterferenceHeatmap}
                  onToggleHeatmap={() => setShowInterferenceHeatmap((prev) => !prev)}
                />

                {/* Compact MAC Airtime Timeline strip */}
                <AirtimeTimeline
                  events={engine.timelineEvents}
                  currentTimeUs={engine.currentTimeUs}
                />
              </div>

              {/* Right Zone: Live Real-Time Metrics & QoS Breakdown (5 cols on desktop) */}
              <div className="lg:col-span-5 flex flex-col gap-4">
                <MetricsDashboard
                  metrics={engine.currentMetrics}
                  history={engine.metricsHistory}
                  starvationThresholdMbps={toastSettings.throughputThresholdMbps}
                  isStarvationActive={isStarvationActive}
                  onOpenAlertSettings={() => setIsNotificationSettingsOpen(true)}
                />

                {/* Quick Info Box on Active Congestion Control */}
                <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-4 text-xs text-slate-400">
                  <div className="flex items-center justify-between text-slate-200 font-semibold mb-2">
                    <span className="flex items-center gap-1.5">
                      <Cpu className="w-3.5 h-3.5 text-sky-400" />
                      <span>Operating Contention Policy</span>
                    </span>
                    <span className="font-mono text-sky-400 text-[11px]">
                      {engine.config.congestionAlgorithm}
                    </span>
                  </div>
                  <p className="leading-relaxed">
                    {engine.config.congestionAlgorithm === 'STANDARD_BEB'
                      ? 'Legacy 802.11 Binary Exponential Backoff resets CW to CWmin upon every ACK. Susceptible to catastrophic collision multiplication when station density surges.'
                      : engine.config.congestionAlgorithm === 'IDLE_SENSE'
                      ? 'Idle Sense measures idle slots between airtime frames, additively increasing CW if idle slots fall below optimal target (5.68) and reducing CW multiplicatively.'
                      : engine.config.congestionAlgorithm === 'AIMD_CW'
                      ? 'Additive Increase Multiplicative Decrease moderates backoff jumps, preventing latency spikes and smoothing throughput variance.'
                      : 'Q-Learning RL Agent dynamically tracks channel collision ratios and queue backlogs to execute optimal contention actions online.'}
                  </p>
                </div>
              </div>
            </div>

            {/* Runtime MAC & Congestion Controls */}
            <SimulationControls
              config={engine.config}
              onChangeConfig={handleChangeConfig}
              qAgent={engine.qAgent}
              toastSettings={toastSettings}
              onOpenNotificationSettings={() => setIsNotificationSettingsOpen(true)}
            />
          </div>
        )}

        {/* TAB 2: Expanded MAC Airtime Gantt Timeline */}
        {activeTab === 'timeline' && (
          <div className="flex flex-col gap-6">
            <AirtimeTimeline
              events={engine.timelineEvents}
              currentTimeUs={engine.currentTimeUs}
            />

            <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-5 text-xs text-slate-300">
              <h4 className="text-sm font-semibold text-white mb-2">
                Discrete Event MAC Airtime Mechanics
              </h4>
              <p className="text-slate-400 leading-relaxed mb-4">
                In IEEE 802.11 WLANs, the physical wireless medium is shared. Every transmission consumes channel airtime composed of Distributed Inter-Frame Space (DIFS or AIFS), random backoff countdown slots, PLCP preamble/headers, MPDU payload data, Short Inter-Frame Space (SIFS), and Acknowledgement (ACK).
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono text-[11px]">
                <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800">
                  <div className="text-sky-400 font-semibold mb-1">DIFS Spacing (34 µs)</div>
                  <div className="text-slate-400">SIFS (16 µs) + 2 × Slot (9 µs). Channel must remain quiet for DIFS before decrementing backoff.</div>
                </div>
                <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800">
                  <div className="text-emerald-400 font-semibold mb-1">ACK Return (32 µs)</div>
                  <div className="text-slate-400">Receiver responds after SIFS with immediate BlockAck or ACK frame to confirm frame delivery.</div>
                </div>
                <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800">
                  <div className="text-red-400 font-semibold mb-1">Collision Window (Tc)</div>
                  <div className="text-slate-400">When multiple stations count down to 0 simultaneously, packets interfere and no ACK is received.</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: Bianchi Markov Chain Analytical Validation */}
        {activeTab === 'bianchi' && (
          <div className="flex flex-col gap-6">
            <BianchiValidationChart
              currentStationCount={engine.config.stationCount}
              currentMetrics={engine.currentMetrics}
              congestionAlgorithm={engine.config.congestionAlgorithm}
            />
          </div>
        )}

        {/* TAB 4: Traffic Scheduling & Resource Allocation Lab */}
        {activeTab === 'schedulers' && (
          <div className="flex flex-col gap-6">
            <SchedulerComparison
              currentScheduler={engine.config.trafficScheduler}
              onSelectScheduler={(sch) => handleChangeConfig({ trafficScheduler: sch })}
              stations={engine.stations}
            />
          </div>
        )}

        {/* TAB 5: Educational Protocol Guide */}
        {activeTab === 'theory' && (
          <div className="flex flex-col gap-6">
            <AlgorithmExplainer />
          </div>
        )}
      </main>

      {/* Station Deep Inspection Modal */}
      {selectedStation && (
        <StationDetailModal
          station={selectedStation}
          onClose={() => setSelectedStationId(null)}
          qAgent={engine.qAgent}
        />
      )}

      {/* Notification Configuration & Incident History Modal */}
      <NotificationSettingsModal
        isOpen={isNotificationSettingsOpen}
        onClose={() => setIsNotificationSettingsOpen(false)}
        settings={toastSettings}
        onChangeSettings={(newSettings) => setToastSettings((prev) => ({ ...prev, ...newSettings }))}
        history={toastHistory}
        onClearHistory={() => setToastHistory([])}
        onTriggerTestToast={() => {
          addToast({
            type: 'critical',
            title: 'Test Starvation Alert',
            message: `Simulated aggregate throughput dropped to 4.2 Mbps (< ${toastSettings.throughputThresholdMbps} Mbps threshold). Contention collapse active.`,
            throughputMbps: 4.2,
            thresholdMbps: toastSettings.throughputThresholdMbps,
            actionLabel: 'Switch to Idle Sense',
            actionType: 'SWITCH_IDLE_SENSE',
          });
        }}
      />

      {/* Floating Toast Notification Container */}
      <ToastContainer
        toasts={toasts}
        onDismiss={handleDismissToast}
        onExecuteAction={handleExecuteToastAction}
      />

      {/* Quiet, unpretentious footer adhering to section 1B */}
      <footer className="border-t border-slate-900 bg-slate-950/80 px-4 sm:px-6 py-4 mt-auto safe-area-bottom">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-2 text-center sm:text-left">
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-1.5 sm:gap-2">
            <span>IEEE 802.11 WLAN Congestion Control &amp; Scheduling Workbench</span>
            <span aria-hidden="true" className="hidden sm:inline">·</span>
            <span className="hidden sm:inline">CSMA/CA &amp; EDCA Discrete Event Engine</span>
          </div>
          <div className="flex items-center gap-3 sm:gap-4 text-[11px] sm:text-xs">
            <span>802.11e/ax Standards Compliant</span>
            <span aria-hidden="true">·</span>
            <span>Bianchi Analytical Model</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
