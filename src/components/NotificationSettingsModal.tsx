/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { ToastSettings, ToastNotification } from '../types/wlan';
import { Bell, Volume2, VolumeX, X, Trash2, Sliders, History } from 'lucide-react';

interface NotificationSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: ToastSettings;
  onChangeSettings: (settings: Partial<ToastSettings>) => void;
  history: ToastNotification[];
  onClearHistory: () => void;
  onTriggerTestToast: () => void;
}

export const NotificationSettingsModal: React.FC<NotificationSettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onChangeSettings,
  history,
  onClearHistory,
  onTriggerTestToast,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-slate-950 border border-slate-800 rounded-xl w-full max-w-xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white tracking-tight">
                Throughput &amp; Starvation Notification System
              </h3>
              <p className="text-xs text-slate-400">
                Configure threshold triggers, audible cues, and inspect incident logs
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
        <div className="p-6 overflow-y-auto space-y-6 text-xs text-slate-300">
          {/* Main Switches: Enable & Audio */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="bg-slate-900/60 border border-slate-800/80 rounded-lg p-3 flex items-center justify-between">
              <div>
                <span className="font-semibold text-white block">Starvation Alerts</span>
                <span className="text-[11px] text-slate-400">Active monitoring toast alerts</span>
              </div>
              <button
                onClick={() => onChangeSettings({ enabled: !settings.enabled })}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  settings.enabled
                    ? 'bg-sky-500 text-white shadow-sm'
                    : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                {settings.enabled ? 'Enabled' : 'Muted'}
              </button>
            </div>

            <div className="bg-slate-900/60 border border-slate-800/80 rounded-lg p-3 flex items-center justify-between">
              <div>
                <span className="font-semibold text-white block">Audible Tone</span>
                <span className="text-[11px] text-slate-400">Subtle synthesized alert ping</span>
              </div>
              <button
                onClick={() => onChangeSettings({ soundEnabled: !settings.soundEnabled })}
                className={`p-2 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-medium ${
                  settings.soundEnabled
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                {settings.soundEnabled ? (
                  <>
                    <Volume2 className="w-4 h-4 text-emerald-400" />
                    <span>On</span>
                  </>
                ) : (
                  <>
                    <VolumeX className="w-4 h-4 text-slate-500" />
                    <span>Muted</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Threshold Sliders */}
          <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-4 space-y-4">
            <div className="flex items-center gap-1.5 font-semibold text-white">
              <Sliders className="w-3.5 h-3.5 text-sky-400" />
              <span>Detection Triggers &amp; Thresholds</span>
            </div>

            {/* Throughput threshold slider */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-300">Throughput Drop Alert Threshold:</span>
                <span className="font-mono text-sky-400 font-semibold tabular-nums">
                  &lt; {settings.throughputThresholdMbps} Mbps
                </span>
              </div>
              <input
                type="range"
                min="4"
                max="35"
                step="1"
                value={settings.throughputThresholdMbps}
                onChange={(e) => onChangeSettings({ throughputThresholdMbps: Number(e.target.value) })}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-400"
              />
              <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                <span>4 Mbps (Severe Starvation)</span>
                <span>15 Mbps (Standard)</span>
                <span>35 Mbps (High Sensitivity)</span>
              </div>
            </div>

            {/* Jain's Fairness threshold slider */}
            <div className="space-y-1.5 pt-2 border-t border-slate-800/60">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-300">Fairness Starvation Threshold:</span>
                <span className="font-mono text-amber-400 font-semibold tabular-nums">
                  Jain's &lt; {settings.starvationFairnessThreshold.toFixed(2)}
                </span>
              </div>
              <input
                type="range"
                min="0.30"
                max="0.80"
                step="0.05"
                value={settings.starvationFairnessThreshold}
                onChange={(e) => onChangeSettings({ starvationFairnessThreshold: Number(e.target.value) })}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
              />
              <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                <span>0.30 (Extreme Starvation)</span>
                <span>0.50 (Default)</span>
                <span>0.80 (Strict Fairness)</span>
              </div>
            </div>

            {/* Collision rate surge threshold */}
            <div className="space-y-1.5 pt-2 border-t border-slate-800/60">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-300">Collision Collapse Threshold:</span>
                <span className="font-mono text-red-400 font-semibold tabular-nums">
                  &gt; {settings.collisionThresholdPct}%
                </span>
              </div>
              <input
                type="range"
                min="15"
                max="50"
                step="5"
                value={settings.collisionThresholdPct}
                onChange={(e) => onChangeSettings({ collisionThresholdPct: Number(e.target.value) })}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-red-400"
              />
              <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                <span>15%</span>
                <span>30% (Contention Collapse)</span>
                <span>50%</span>
              </div>
            </div>
          </div>

          {/* Test Toast Trigger */}
          <div className="flex items-center justify-between bg-slate-900/50 p-3 rounded-lg border border-slate-800">
            <span className="text-slate-400 text-xs">Test Notification Preview:</span>
            <button
              onClick={onTriggerTestToast}
              className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors cursor-pointer"
            >
              Trigger Test Starvation Alert
            </button>
          </div>

          {/* Notification Incident History */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-semibold text-white">
                <History className="w-3.5 h-3.5 text-sky-400" />
                <span>Incident Log History ({history.length})</span>
              </div>
              {history.length > 0 && (
                <button
                  onClick={onClearHistory}
                  className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-red-400 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Clear Log</span>
                </button>
              )}
            </div>

            <div className="bg-slate-900/30 border border-slate-800/80 rounded-lg max-h-48 overflow-y-auto divide-y divide-slate-800/60">
              {history.length === 0 ? (
                <div className="p-4 text-center text-slate-500 italic text-xs">
                  No starvation or throughput drop incidents recorded yet.
                </div>
              ) : (
                history.map((item) => (
                  <div key={item.id} className="p-3 text-xs flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className={`w-2 h-2 rounded-full ${
                          item.type === 'critical' ? 'bg-red-400' : item.type === 'warning' ? 'bg-amber-400' : 'bg-emerald-400'
                        }`} />
                        <span className="font-semibold text-slate-200">{item.title}</span>
                      </div>
                      <p className="text-slate-400 text-[11px]">{item.message}</p>
                    </div>
                    <span className="font-mono text-[10px] text-slate-500 tabular-nums shrink-0">
                      t: {item.simTimeMs.toFixed(0)}ms
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-900/40 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-sky-500 text-white hover:bg-sky-400 text-xs font-semibold transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
