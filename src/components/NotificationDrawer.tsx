import React from 'react';
import {
  Bell,
  X,
  AlertTriangle,
  ShieldAlert,
  CheckCircle2,
  Info,
  Clock,
  Trash2,
  CheckCheck,
} from 'lucide-react';
import { SystemAlert } from '../types';

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
  timestamp: string;
  read: boolean;
  environment?: string;
}

interface NotificationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  alerts?: SystemAlert[];
  notifications?: NotificationItem[];
  onMarkAsRead?: (alertId: string) => void;
  onMarkAllRead?: () => void;
  onClearAll: () => void;
  onDismissOne?: (id: string) => void;
}

export function NotificationDrawer({
  isOpen,
  onClose,
  alerts = [],
  notifications = [],
  onMarkAsRead,
  onMarkAllRead,
  onClearAll,
  onDismissOne,
}: NotificationDrawerProps) {
  if (!isOpen) return null;

  // Normalize items to standard notification structure
  const items: NotificationItem[] = [
    ...notifications,
    ...alerts.map((a) => ({
      id: a.id,
      title: a.title,
      message: `${a.issue} (Expected: ${a.expected}, Actual: ${a.actual})`,
      severity: (a.severity as any) || 'CRITICAL',
      timestamp: a.timestamp,
      read: a.read,
      environment: a.environmentName,
    })),
  ];

  const unreadCount = items.filter((i) => !i.read).length;

  const handleMarkAll = () => {
    if (onMarkAllRead) {
      onMarkAllRead();
    } else if (onMarkAsRead) {
      items.forEach((item) => {
        if (!item.read) onMarkAsRead(item.id);
      });
    }
  };

  const handleDismiss = (id: string) => {
    if (onDismissOne) {
      onDismissOne(id);
    } else if (onMarkAsRead) {
      onMarkAsRead(id);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden select-none">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
          {/* Header */}
          <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-indigo-600/20 text-indigo-400 border border-indigo-600/30 flex items-center justify-center">
                <Bell className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-white tracking-tight">Notification Center</h2>
                <p className="text-[11px] text-slate-400 font-mono">
                  {unreadCount} unread fleet alert{unreadCount === 1 ? '' : 's'}
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Action Bar */}
          <div className="px-4 py-2 bg-slate-950/40 border-b border-slate-800/80 flex items-center justify-between text-xs">
            <button
              onClick={handleMarkAll}
              className="flex items-center gap-1.5 text-indigo-400 hover:text-indigo-300 transition-colors font-medium"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              <span>Mark all as read</span>
            </button>

            <button
              onClick={onClearAll}
              className="flex items-center gap-1.5 text-slate-500 hover:text-rose-400 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear all</span>
            </button>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
            {items.length === 0 ? (
              <div className="text-center py-16 text-slate-500">
                <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-slate-600" />
                <p className="text-xs">No active notifications.</p>
                <p className="text-[11px] text-slate-600 mt-1">
                  Fleet drift events will appear here in real-time.
                </p>
              </div>
            ) : (
              items.map((notif) => {
                const isCrit = notif.severity === 'CRITICAL';
                const isHigh = notif.severity === 'HIGH';

                return (
                  <div
                    key={notif.id}
                    className={`p-3.5 rounded-xl border transition-all relative group ${
                      !notif.read
                        ? isCrit
                          ? 'bg-rose-950/20 border-rose-800/70 hover:bg-rose-950/30'
                          : isHigh
                          ? 'bg-amber-950/20 border-amber-800/70 hover:bg-amber-950/30'
                          : 'bg-indigo-950/20 border-indigo-800/70 hover:bg-indigo-950/30'
                        : 'bg-slate-950/40 border-slate-800/80 hover:bg-slate-800/40 text-slate-400'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        {isCrit ? (
                          <ShieldAlert className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                        ) : isHigh ? (
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        ) : (
                          <Info className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                        )}
                        <span
                          className={`text-xs font-bold ${
                            !notif.read ? 'text-white' : 'text-slate-300'
                          }`}
                        >
                          {notif.title}
                        </span>
                      </div>

                      <button
                        onClick={() => handleDismiss(notif.id)}
                        className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-rose-400 transition-opacity p-0.5"
                        title="Dismiss"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>

                    <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                      {notif.message}
                    </p>

                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-800/60 text-[10px] text-slate-500 font-mono">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {notif.timestamp}
                      </span>
                      {notif.environment && (
                        <span className="uppercase tracking-wider font-semibold">
                          {notif.environment}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
