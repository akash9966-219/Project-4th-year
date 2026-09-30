/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useEffect, useState } from 'react';
import { TimelineSlotEvent } from '../types/wlan';
import { EDCA_DEFAULTS } from '../simulation/constants';
import { Clock, Layers, AlertOctagon, CheckCircle2, Radio, Info } from 'lucide-react';

interface AirtimeTimelineProps {
  events: TimelineSlotEvent[];
  currentTimeUs: number;
}

export const AirtimeTimeline: React.FC<AirtimeTimelineProps> = ({ events, currentTimeUs }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [hoveredEvent, setHoveredEvent] = useState<TimelineSlotEvent | null>(null);

  // Auto-scroll timeline to the right as time progresses
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollLeft = containerRef.current.scrollWidth;
    }
  }, [events]);

  const recentEvents = events.slice(-45);

  return (
    <div className="w-full bg-slate-950 rounded-xl border border-slate-800/80 p-4 flex flex-col gap-3 shadow-lg shadow-slate-950/40">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-1 border-b border-slate-800/60">
        <div className="flex items-center gap-2 text-xs font-semibold text-white">
          <Clock className="w-4 h-4 text-sky-400" />
          <span>MAC Airtime Channel Timeline</span>
          <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-sky-500/10 text-sky-400 border border-sky-500/20 hidden sm:inline">
            Discrete Events
          </span>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 text-xs text-slate-400 font-mono">
          <span className="text-slate-300 bg-slate-900 px-2 py-0.5 rounded border border-slate-800 text-[11px] tabular-nums">
            t: {(currentTimeUs / 1000).toFixed(2)} ms
          </span>
          <span className="text-slate-600 hidden xs:inline">·</span>
          <span className="text-[11px] text-slate-400 hidden xs:inline">Slot: 9 µs</span>
        </div>
      </div>

      {/* Gantt Strip Container with Horizontal Scroll */}
      <div className="relative">
        <div
          ref={containerRef}
          className="w-full overflow-x-auto overflow-y-hidden py-2 bg-slate-900/60 rounded-xl border border-slate-800/80 scroll-smooth"
        >
          <div className="flex items-center gap-2 px-3 min-w-max h-[78px]">
            {recentEvents.length === 0 ? (
              <div className="flex items-center justify-center w-full text-xs text-slate-500 italic py-6">
                Channel idle. Start simulation or click Step to generate airtime transmissions.
              </div>
            ) : (
              recentEvents.map((evt, idx) => {
                // Ensure sufficient minimum width so text never exceeds out of bounds
                const widthPx = Math.max(92, Math.min(260, Math.round(evt.durationUs * 0.45)));
                const isCol = evt.type === 'COLLISION';
                const isOFDMA = evt.type === 'OFDMA_TF';
                const catDef = evt.category ? EDCA_DEFAULTS[evt.category] : null;

                let bgClass = 'bg-slate-800/80 border-slate-700 text-slate-300';
                if (isCol) {
                  bgClass = 'bg-red-950/80 border-red-500/60 text-red-200 shadow-sm shadow-red-950/50';
                } else if (isOFDMA) {
                  bgClass = 'bg-emerald-950/80 border-emerald-500/60 text-emerald-200';
                } else if (catDef) {
                  if (evt.category === 'AC_VO') bgClass = 'bg-red-900/40 border-red-500/50 text-red-200';
                  else if (evt.category === 'AC_VI') bgClass = 'bg-amber-900/40 border-amber-500/50 text-amber-200';
                  else if (evt.category === 'AC_BE') bgClass = 'bg-cyan-900/40 border-cyan-500/50 text-cyan-200';
                  else if (evt.category === 'AC_BK') bgClass = 'bg-purple-900/40 border-purple-500/50 text-purple-200';
                }

                const label = isCol
                  ? (widthPx < 110 ? 'COLLISION' : 'COLLISION')
                  : isOFDMA
                  ? (widthPx < 115 ? 'OFDMA' : 'OFDMA MU-TF')
                  : evt.category || 'DATA';

                const outcomeText = evt.success ? 'ACK OK' : 'NO ACK';

                return (
                  <div
                    key={`${evt.startUs}-${idx}`}
                    style={{ width: `${widthPx}px` }}
                    onMouseEnter={() => setHoveredEvent(evt)}
                    onMouseLeave={() => setHoveredEvent(null)}
                    className={`h-[68px] rounded-lg border flex flex-col justify-between p-2 transition-all cursor-pointer shrink-0 overflow-hidden relative group hover:ring-2 hover:ring-sky-400/50 ${bgClass}`}
                  >
                    {/* Row 1: Type / Category + Duration */}
                    <div className="flex items-center justify-between text-[10px] font-mono leading-tight gap-1 min-w-0">
                      <span className="font-bold truncate shrink min-w-0" title={label}>
                        {label}
                      </span>
                      <span className="opacity-80 tabular-nums shrink-0 text-[9px] font-semibold">
                        {evt.durationUs}µs
                      </span>
                    </div>

                    {/* Row 2: Transmitters */}
                    <div
                      className="text-[10px] font-mono text-slate-200 truncate leading-tight my-0.5"
                      title={evt.transmitters.join(', ')}
                    >
                      {evt.transmitters.join(', ')}
                    </div>

                    {/* Row 3: Timestamp & ACK status */}
                    <div className="flex items-center justify-between text-[9px] text-slate-400 font-mono leading-none gap-1">
                      <span className="tabular-nums truncate">
                        @{(evt.startUs / 1000).toFixed(1)}ms
                      </span>
                      <span
                        className={`font-semibold shrink-0 ${
                          evt.success ? 'text-emerald-400' : 'text-red-400'
                        }`}
                      >
                        {outcomeText}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Hover Popover Detail for timeline events */}
        {hoveredEvent && (
          <div className="absolute -top-12 left-4 z-30 bg-slate-900/95 backdrop-blur-md border border-slate-700 rounded-lg px-3 py-1.5 shadow-xl text-xs text-slate-200 pointer-events-none flex items-center gap-3 font-mono animate-in fade-in duration-100">
            <div className="flex items-center gap-1.5 font-sans font-semibold text-white">
              {hoveredEvent.type === 'COLLISION' ? (
                <AlertOctagon className="w-3.5 h-3.5 text-red-400" />
              ) : (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              )}
              <span>{hoveredEvent.type === 'COLLISION' ? 'Packet Collision' : 'Successful Transmission'}</span>
            </div>
            <span className="text-slate-500">|</span>
            <span>STAs: <strong className="text-sky-300">{hoveredEvent.transmitters.join(', ')}</strong></span>
            <span className="text-slate-500">|</span>
            <span>Duration: <strong className="text-white">{hoveredEvent.durationUs} µs</strong></span>
            <span className="text-slate-500">|</span>
            <span>Time: <strong className="text-slate-300">@{(hoveredEvent.startUs / 1000).toFixed(2)} ms</strong></span>
          </div>
        )}
      </div>

      {/* Legend & Timing notes */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400 pt-1 text-[11px] sm:text-xs">
        <div className="flex flex-wrap items-center gap-3 sm:gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded bg-cyan-900/60 border border-cyan-500/40" />
            <span className="text-slate-300">DATA + SIFS + ACK</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded bg-red-950/80 border border-red-500/50" />
            <span className="text-red-300">Collision (Concurrent TX)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded bg-emerald-950/80 border border-emerald-500/50" />
            <span className="text-emerald-300">OFDMA Multi-User TF</span>
          </div>
        </div>

        <div className="text-slate-500 font-mono text-[10px] sm:text-[11px]">
          SIFS: 16 µs · DIFS: 34 µs · ACK: 32 µs · Slot: 9 µs
        </div>
      </div>
    </div>
  );
};
