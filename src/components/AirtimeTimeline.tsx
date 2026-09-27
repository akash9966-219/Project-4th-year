/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useEffect } from 'react';
import { TimelineSlotEvent } from '../types/wlan';
import { EDCA_DEFAULTS } from '../simulation/constants';
import { Clock, Layers } from 'lucide-react';

interface AirtimeTimelineProps {
  events: TimelineSlotEvent[];
  currentTimeUs: number;
}

export const AirtimeTimeline: React.FC<AirtimeTimelineProps> = ({ events, currentTimeUs }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll timeline to the right as time progresses
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollLeft = containerRef.current.scrollWidth;
    }
  }, [events]);

  const recentEvents = events.slice(-40);

  return (
    <div className="w-full bg-slate-950 rounded-xl border border-slate-800/80 p-4 flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold text-white">
          <Clock className="w-4 h-4 text-sky-400" />
          <span>MAC Airtime Channel Timeline (Discrete Events)</span>
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-400">
          <span className="font-mono tabular-nums text-slate-300">
            t: {(currentTimeUs / 1000).toFixed(2)} ms
          </span>
          <span className="text-slate-600">·</span>
          <span>Slot Duration: 9 µs</span>
        </div>
      </div>

      {/* Gantt Strip Container */}
      <div 
        ref={containerRef}
        className="w-full overflow-x-auto overflow-y-hidden py-2 bg-slate-900/60 rounded-lg border border-slate-800/80 scroll-smooth"
      >
        <div className="flex items-center gap-1.5 px-3 min-w-max h-20">
          {recentEvents.length === 0 ? (
            <div className="flex items-center justify-center w-full text-xs text-slate-500 italic">
              Channel idle. Start simulation or click Step to generate airtime transmissions.
            </div>
          ) : (
            recentEvents.map((evt, idx) => {
              const widthPx = Math.max(36, Math.min(220, Math.round(evt.durationUs * 0.35)));
              const isCol = evt.type === 'COLLISION';
              const isOFDMA = evt.type === 'OFDMA_TF';
              const catDef = evt.category ? EDCA_DEFAULTS[evt.category] : null;

              let bgClass = 'bg-slate-800 border-slate-700 text-slate-300';
              if (isCol) {
                bgClass = 'bg-red-950/80 border-red-500/50 text-red-300 shadow-sm shadow-red-950';
              } else if (isOFDMA) {
                bgClass = 'bg-emerald-950/80 border-emerald-500/50 text-emerald-300';
              } else if (catDef) {
                if (evt.category === 'AC_VO') bgClass = 'bg-red-900/40 border-red-500/50 text-red-200';
                else if (evt.category === 'AC_VI') bgClass = 'bg-amber-900/40 border-amber-500/50 text-amber-200';
                else if (evt.category === 'AC_BE') bgClass = 'bg-cyan-900/40 border-cyan-500/50 text-cyan-200';
                else if (evt.category === 'AC_BK') bgClass = 'bg-purple-900/40 border-purple-500/50 text-purple-200';
              }

              return (
                <div
                  key={`${evt.startUs}-${idx}`}
                  style={{ width: `${widthPx}px` }}
                  className={`h-16 rounded-md border flex flex-col justify-between p-1.5 transition-all text-left shrink-0 ${bgClass}`}
                >
                  <div className="flex items-center justify-between text-[10px] font-mono leading-none">
                    <span className="font-semibold truncate">
                      {isCol
                        ? 'COLLISION'
                        : isOFDMA
                        ? 'OFDMA TF + RUs'
                        : evt.category || 'DATA'}
                    </span>
                    <span className="opacity-75 tabular-nums">{evt.durationUs}µs</span>
                  </div>

                  <div className="text-[10px] truncate font-mono text-slate-300">
                    {evt.transmitters.join(', ')}
                  </div>

                  <div className="flex items-center justify-between text-[9px] text-slate-400 font-mono">
                    <span>@{(evt.startUs / 1000).toFixed(1)}ms</span>
                    <span className={evt.success ? 'text-emerald-400 font-medium' : 'text-red-400 font-medium'}>
                      {evt.success ? 'ACK OK' : 'NO ACK'}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Legend & Timing notes */}
      <div className="flex flex-wrap items-center justify-between text-xs text-slate-400 pt-1">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded bg-cyan-900/60 border border-cyan-500/40" />
            <span>Successful DATA + SIFS + ACK</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded bg-red-950/80 border border-red-500/50" />
            <span>Collision (Concurrent Transmitters)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded bg-emerald-950/80 border border-emerald-500/50" />
            <span>OFDMA Multi-User Trigger Frame</span>
          </div>
        </div>

        <div className="text-slate-500 text-xs">
          SIFS: 16 µs · DIFS: 34 µs · ACK: 32 µs
        </div>
      </div>
    </div>
  );
};
