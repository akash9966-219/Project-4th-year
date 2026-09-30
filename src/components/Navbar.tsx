/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Play, Pause, RotateCcw, Activity, FastForward, Bell, AlertTriangle, Menu, X, Sliders, Clock, Compass, Users, Sparkles } from 'lucide-react';
import { ToastSettings } from '../types/wlan';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isRunning: boolean;
  onTogglePlay: () => void;
  onReset: () => void;
  onStep: () => void;
  speed: number;
  onSpeedChange: (speed: number) => void;
  currentTimeMs: number;
  onOpenNotificationSettings: () => void;
  isStarvationActive: boolean;
  toastSettings: ToastSettings;
  unreadAlertCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  isRunning,
  onTogglePlay,
  onReset,
  onStep,
  speed,
  onSpeedChange,
  currentTimeMs,
  onOpenNotificationSettings,
  isStarvationActive,
  toastSettings,
  unreadAlertCount,
}) => {
  const navItems = [
    { id: 'stage', label: 'Live Simulation', icon: Activity },
    { id: 'ai-predictor', label: 'AI Predictor', icon: Sparkles },
    { id: 'stations', label: 'Station Management', icon: Users },
    { id: 'timeline', label: 'Airtime Timeline', icon: Clock },
    { id: 'bianchi', label: 'Bianchi Model', icon: Compass },
    { id: 'schedulers', label: 'Traffic Schedulers', icon: Sliders },
    { id: 'theory', label: 'Protocol Guide', icon: Activity },
  ];

  return (
    <header className="sticky top-0 z-50 bg-slate-950/95 backdrop-blur-md border-b border-slate-800/80 shadow-md shadow-slate-950/40">
      {/* Primary Top Bar */}
      <div className="max-w-7xl mx-auto px-3 sm:px-5 lg:px-6 h-14 sm:h-16 flex items-center justify-between gap-3">
        {/* Left: Branding & Protocol Badge */}
        <div className="flex items-center gap-2.5 shrink-0 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400 shrink-0">
            <Activity className="w-4 h-4" />
          </div>
          <div className="flex items-center gap-2 min-w-0">
            <a 
              href="/" 
              onClick={(e) => { e.preventDefault(); setActiveTab('stage'); }} 
              className="text-sm font-bold tracking-tight text-white hover:text-sky-300 transition-colors whitespace-nowrap"
            >
              IEEE 802.11 WLAN Lab
            </a>
            <span className="hidden sm:inline-block px-1.5 py-0.5 rounded text-[10px] font-mono bg-sky-500/10 text-sky-400 border border-sky-500/20 whitespace-nowrap">
              CSMA/CA &amp; EDCA
            </span>
          </div>
        </div>

        {/* Center: Desktop Navigation Tabs (Visible on lg and larger displays) */}
        <nav className="hidden lg:flex items-center gap-1 bg-slate-900/60 p-1 rounded-xl border border-slate-800/80 shrink-0">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap cursor-pointer ${
                  isActive 
                    ? 'bg-sky-500 text-white font-semibold shadow-sm shadow-sky-500/30' 
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Right: Simulation Controls & Status Cluster */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Notification Alert Status */}
          <button
            onClick={onOpenNotificationSettings}
            className={`relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer shrink-0 ${
              isStarvationActive
                ? 'bg-red-500/20 text-red-300 border-red-500/40 animate-pulse'
                : 'bg-slate-900 border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
            title="Configure Throughput & Starvation Alerts"
          >
            {isStarvationActive ? (
              <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />
            ) : (
              <Bell className="w-3.5 h-3.5 text-sky-400 shrink-0" />
            )}
            <span className="hidden xl:inline">
              {isStarvationActive ? 'Starvation Alert' : 'Alerts'}
            </span>
            {unreadAlertCount > 0 && (
              <span className="w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-mono flex items-center justify-center font-bold">
                {unreadAlertCount > 9 ? '9+' : unreadAlertCount}
              </span>
            )}
          </button>

          {/* Time & Speed Cluster (Desktop only) */}
          <div className="hidden lg:flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-xs font-mono text-slate-300 shrink-0">
            <span className="text-slate-500 text-[10px]">TIME:</span>
            <span className="tabular-nums font-semibold text-sky-400">{currentTimeMs.toFixed(1)}ms</span>
          </div>

          {/* Speed Selector (Desktop only) */}
          <div className="hidden lg:flex items-center bg-slate-900 border border-slate-800 rounded-lg p-0.5 text-xs font-mono shrink-0">
            {[1, 2, 5].map((s) => (
              <button
                key={s}
                onClick={() => onSpeedChange(s)}
                className={`px-2 py-1 rounded transition-colors cursor-pointer ${
                  speed === s
                    ? 'bg-sky-500/20 text-sky-300 font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title={`Simulation rate: ${s}x`}
              >
                {s}x
              </button>
            ))}
          </div>

          {/* Step Action */}
          <button
            onClick={onStep}
            disabled={isRunning}
            className="p-1.5 sm:p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer shrink-0"
            title="Step forward 100 µs"
          >
            <FastForward className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>

          {/* Reset Action */}
          <button
            onClick={onReset}
            className="p-1.5 sm:p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
            title="Reset simulation state"
          >
            <RotateCcw className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>

          {/* Run/Pause CTA */}
          <button
            onClick={onTogglePlay}
            className={`flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 sm:py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer shadow-sm shrink-0 ${
              isRunning
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30'
                : 'bg-sky-500 text-white hover:bg-sky-400 shadow-sky-500/20'
            }`}
          >
            {isRunning ? (
              <>
                <Pause className="w-3.5 h-3.5 fill-current" />
                <span>Pause</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Run</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Secondary Navigation & Speed Bar for Mobile and Tablet (< lg) */}
      <div className="lg:hidden border-t border-slate-800/80 bg-slate-950/95 px-3 sm:px-5 py-1.5 flex items-center justify-between gap-3 overflow-x-auto scrollbar-none">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 shrink-0">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors whitespace-nowrap cursor-pointer shrink-0 ${
                  isActive
                    ? 'bg-sky-500 text-white font-semibold shadow-sm shadow-sky-500/30'
                    : 'text-slate-400 hover:text-slate-200 bg-slate-900/60 hover:bg-slate-900'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Speed Selector & Sim Time Readout */}
        <div className="flex items-center gap-2 shrink-0 pl-2 border-l border-slate-800">
          <div className="flex items-center bg-slate-900 border border-slate-800 rounded-md p-0.5 text-[11px] font-mono shrink-0">
            {[1, 2, 5].map((s) => (
              <button
                key={s}
                onClick={() => onSpeedChange(s)}
                className={`px-1.5 py-0.5 rounded transition-colors cursor-pointer ${
                  speed === s
                    ? 'bg-sky-500/20 text-sky-300 font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {s}x
              </button>
            ))}
          </div>

          <div className="text-[11px] font-mono text-slate-400 shrink-0">
            <strong className="text-sky-400">{currentTimeMs.toFixed(1)}ms</strong>
          </div>
        </div>
      </div>
    </header>
  );
};


