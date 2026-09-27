/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { ToastNotification } from '../types/wlan';
import {
  AlertTriangle,
  AlertOctagon,
  CheckCircle2,
  Info,
  X,
  ArrowRight,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';

interface ToastContainerProps {
  toasts: ToastNotification[];
  onDismiss: (id: string) => void;
  onExecuteAction?: (actionType: ToastNotification['actionType']) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({
  toasts,
  onDismiss,
  onExecuteAction,
}) => {
  if (toasts.length === 0) return null;

  return (
    <aside
      aria-label="Network Notifications"
      className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-md w-full pointer-events-none px-3 sm:px-0"
    >
      {toasts.map((toast) => {
        const isCritical = toast.type === 'critical';
        const isWarning = toast.type === 'warning';
        const isRecovery = toast.type === 'recovery';

        let borderColor = 'border-slate-800';
        let bgGradient = 'bg-slate-950/95';
        let iconBg = 'bg-slate-800 text-slate-300';
        let titleColor = 'text-white';
        let badgeBg = 'bg-slate-800 text-slate-300';

        if (isCritical) {
          borderColor = 'border-red-500/70 shadow-lg shadow-red-950/50';
          bgGradient = 'bg-gradient-to-br from-red-950/95 via-slate-950/95 to-slate-950/95';
          iconBg = 'bg-red-500/20 text-red-400 border border-red-500/30';
          titleColor = 'text-red-300';
          badgeBg = 'bg-red-500/10 text-red-400 border border-red-500/20';
        } else if (isWarning) {
          borderColor = 'border-amber-500/60 shadow-lg shadow-amber-950/40';
          bgGradient = 'bg-gradient-to-br from-amber-950/90 via-slate-950/95 to-slate-950/95';
          iconBg = 'bg-amber-500/20 text-amber-400 border border-amber-500/30';
          titleColor = 'text-amber-200';
          badgeBg = 'bg-amber-500/10 text-amber-300 border border-amber-500/20';
        } else if (isRecovery) {
          borderColor = 'border-emerald-500/60 shadow-lg shadow-emerald-950/40';
          bgGradient = 'bg-gradient-to-br from-emerald-950/90 via-slate-950/95 to-slate-950/95';
          iconBg = 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30';
          titleColor = 'text-emerald-200';
          badgeBg = 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20';
        }

        const Icon = isCritical
          ? AlertOctagon
          : isWarning
          ? AlertTriangle
          : isRecovery
          ? CheckCircle2
          : Info;

        return (
          <div
            key={toast.id}
            role="alert"
            className={`pointer-events-auto rounded-xl border p-4 backdrop-blur-md transition-all duration-300 animate-in fade-in slide-in-from-bottom-3 ${borderColor} ${bgGradient}`}
          >
            <div className="flex items-start gap-3">
              {/* Icon */}
              <div className={`p-2 rounded-lg shrink-0 ${iconBg}`}>
                <Icon className="w-4 h-4" />
              </div>

              {/* Message Details */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className={`text-xs font-semibold tracking-tight ${titleColor}`}>
                    {toast.title}
                  </span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {toast.throughputMbps !== undefined && (
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono tabular-nums flex items-center gap-1 ${badgeBg}`}>
                        {isRecovery ? (
                          <TrendingUp className="w-2.5 h-2.5" />
                        ) : (
                          <TrendingDown className="w-2.5 h-2.5" />
                        )}
                        <span>{toast.throughputMbps.toFixed(1)} Mbps</span>
                      </span>
                    )}
                    <button
                      onClick={() => onDismiss(toast.id)}
                      className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                      title="Dismiss"
                      aria-label="Dismiss notification"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed">
                  {toast.message}
                </p>

                {/* Optional Action / Quick Fix Button */}
                {toast.actionLabel && toast.actionType && (
                  <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center justify-between">
                    <span className="text-[10px] text-slate-400">
                      Recommended Mitigation:
                    </span>
                    <button
                      onClick={() => {
                        if (onExecuteAction) onExecuteAction(toast.actionType);
                        onDismiss(toast.id);
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-sky-500/20 text-sky-300 hover:bg-sky-500/30 border border-sky-500/40 text-[11px] font-medium transition-colors cursor-pointer"
                    >
                      <span>{toast.actionLabel}</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </aside>
  );
};
