/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Play, Pause, RotateCcw, Activity, FastForward, Bell, AlertTriangle, Menu, X, Sliders, Clock, Compass } from 'lucide-react';
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { id: 'stage', label: 'Live Simulation', icon: Activity },
    { id: 'timeline', label: 'Airtime Timeline', icon: Clock },
    { id: 'bianchi', label: 'Bianchi Model', icon: Compass },
    { id: 'schedulers', label: 'Traffic Schedulers', icon: Sliders },
    { id: 'theory', label: 'Protocol Guide', icon: Activity },
  ];

  return (
    <header className="sticky top-0 z-50 bg-slate-950/95 backdrop-blur-md border-b border-slate-800/80 shadow-md shadow-slate-950/40">
      {/* Primary Top Bar */}
      <div className="max-w-7xl mx-auto px-3 sm:px-5 lg:px-6 h-14 sm:h-16 flex items-center justify-between gap-2 sm:gap-4">
        {/* Left: Branding & Tagline */}
        <div className="flex items-center gap-2.5 shrink-0 min-w-0">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400 shrink-0">
            <Activity className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
          </div>
          <div className="flex flex-col min-w-0">
            <a 
              href="/" 
              onClick={(e) => { e.preventDefault(); setActiveTab('stage'); setMobileMenuOpen(false); }} 
              className="text-xs sm:text-sm font-bold tracking-tight text-white hover:text-sky-300 transition-colors truncate flex items-center gap-1.5"
            >
              <span>IEEE 802.11 WLAN Lab</span>
              <span className="hidden md:inline px-1.5 py-0.5 rounded text-[10px] font-mono font-normal bg-sky-500/10 text-sky-400 border border-sky-500/20">
                CSMA/CA &amp; EDCA
              </span>
            </a>
            <span className="hidden sm:inline text-[11px] text-slate-400 truncate">
              Contention Congestion Control &amp; Scheduling
            </span>
          </div>
        </div>

        {/* Center: Desktop Navigation Tabs (Visible on lg and larger displays) */}
        <nav className="hidden lg:flex items-center gap-1 bg-slate-900/60 p-1 rounded-xl border border-slate-800/80">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap cursor-pointer ${
                  isActive 
                    ? 'bg-sky-500 text-white font-semibold shadow-sm shadow-sky-500/30' 
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Right: Simulation Controls & Status Cluster */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Notification Alert Status */}
          <button
            onClick={onOpenNotificationSettings}
            className={`relative flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer shrink-0 ${
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

          {/* Time & Speed Cluster (Desktop / Tablet Landscape) */}
          <div className="hidden sm:flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-xs font-mono text-slate-300">
            <span className="text-slate-500 text-[10px]">TIME:</span>
            <span className="tabular-nums font-semibold text-sky-400">{currentTimeMs.toFixed(1)}ms</span>
          </div>

          {/* Speed Selector */}
          <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-0.5 text-xs font-mono">
            {[1, 2, 5].map((s) => (
              <button
                key={s}
                onClick={() => onSpeedChange(s)}
                className={`px-1.5 sm:px-2 py-1 rounded transition-colors cursor-pointer ${
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

          {/* Simulation Step and Reset Actions */}
          <div className="flex items-center gap-1">
            <button
              onClick={onStep}
              disabled={isRunning}
              className="p-1.5 sm:p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
              title="Step forward 100 µs"
            >
              <FastForward className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>

            <button
              onClick={onReset}
              className="p-1.5 sm:p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              title="Reset simulation state"
            >
              <RotateCcw className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
          </div>

          {/* Run/Pause CTA */}
          <button
            onClick={onTogglePlay}
            className={`flex items-center gap-1.5 px-2.5 sm:px-3.5 py-1.5 sm:py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer shadow-sm ${
              isRunning
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30'
                : 'bg-sky-500 text-white hover:bg-sky-400 shadow-sky-500/20'
            }`}
          >
            {isRunning ? (
              <>
                <Pause className="w-3.5 h-3.5 fill-current" />
                <span className="hidden xs:inline">Pause</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span className="hidden xs:inline">Run</span>
              </>
            )}
          </button>

          {/* Mobile Menu Drawer Toggle */}
          <button
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            className="lg:hidden p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer ml-0.5"
            aria-label="Toggle navigation drawer"
          >
            {mobileMenuOpen ? <X className="w-4 h-4 text-sky-400" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Secondary Horizontal Nav Strip for Tablet Portrait (md to lg) */}
      <div className="hidden md:flex lg:hidden px-4 py-2 border-t border-slate-800/60 bg-slate-950/80 items-center justify-between overflow-x-auto gap-2">
        <div className="flex items-center gap-1.5">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                  isActive
                    ? 'bg-sky-500 text-white font-semibold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        <div className="text-[11px] font-mono text-slate-400 shrink-0">
          <span>Time: <strong className="text-sky-400">{currentTimeMs.toFixed(1)} ms</strong></span>
        </div>
      </div>

      {/* Mobile Portrait Dropdown Drawer (xs & sm) */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-800/80 bg-slate-950/98 px-4 py-3 flex flex-col gap-3 shadow-xl">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800/60 text-xs font-mono text-slate-400">
            <span className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-sky-400" />
              <span>Sim Time: <strong className="text-white">{currentTimeMs.toFixed(1)} ms</strong></span>
            </span>
            <span className="text-sky-400">Speed: {speed}x</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-left transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-sky-500 text-white font-semibold shadow-sm shadow-sky-500/30'
                      : 'bg-slate-900/60 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-sky-400'}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </header>
  );
};


