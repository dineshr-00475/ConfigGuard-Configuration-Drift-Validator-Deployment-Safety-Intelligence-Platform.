import React, { useState } from 'react';
import {
  Clock,
  Calendar,
  AlertOctagon,
  AlertTriangle,
  Info,
  ArrowRight,
  User,
  Search,
  Filter,
  History,
  CheckCircle2,
  FileCode,
} from 'lucide-react';
import { DriftHistoryItem, DriftSeverity } from '../types';

interface DriftHistoryViewProps {
  historyItems?: DriftHistoryItem[];
  history?: DriftHistoryItem[];
  selectedEnvName?: string;
  environments?: any[];
  onClearHistory?: () => void;
}

export const DriftHistoryView: React.FC<DriftHistoryViewProps> = ({
  historyItems,
  history,
  selectedEnvName = 'all',
  environments,
  onClearHistory,
}) => {
  const items = historyItems || history || [];
  const [envFilter, setEnvFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [severityFilter, setSeverityFilter] = useState<string>('all');

  const filteredHistory = items.filter((item) => {
    if (envFilter !== 'all' && item.environmentName && item.environmentName.toLowerCase() !== envFilter.toLowerCase()) {
      return false;
    }
    if (severityFilter !== 'all' && item.severity !== severityFilter) {
      return false;
    }
    if (searchTerm.trim() !== '') {
      const q = searchTerm.toLowerCase();
      return (
        (item.key && item.key.toLowerCase().includes(q)) ||
        (item.fromValue && String(item.fromValue).toLowerCase().includes(q)) ||
        (item.toValue && String(item.toValue).toLowerCase().includes(q)) ||
        (item.author && item.author.toLowerCase().includes(q)) ||
        (item.reason && item.reason.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const getSeverityBadge = (sev: DriftSeverity) => {
    switch (sev) {
      case 'CRITICAL':
        return (
          <span className="inline-flex items-center gap-1 bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-bold px-2 py-0.5 rounded-full">
            <AlertOctagon className="w-3 h-3 text-rose-600" />
            CRITICAL
          </span>
        );
      case 'HIGH':
        return (
          <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold px-2 py-0.5 rounded-full">
            <AlertTriangle className="w-3 h-3 text-amber-600" />
            HIGH
          </span>
        );
      case 'MEDIUM':
        return (
          <span className="inline-flex items-center gap-1 bg-yellow-50 text-yellow-800 border border-yellow-200 text-[10px] font-semibold px-2 py-0.5 rounded-full">
            <Info className="w-3 h-3 text-yellow-600" />
            MEDIUM
          </span>
        );
      case 'LOW':
        return (
          <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-medium px-2 py-0.5 rounded-full">
            <Info className="w-3 h-3 text-blue-600" />
            LOW
          </span>
        );
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
      {/* Header */}
      <div className="p-4 sm:px-6 border-b border-slate-200 bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-indigo-600" />
            <h2 className="text-base font-bold text-slate-900">
              Drift Event History & Timeline
            </h2>
            <span className="text-xs font-mono font-bold bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full">
              {filteredHistory.length} recorded events
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Audit trail of configuration modifications: trace exactly when, why, and how drift occurred
          </p>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={envFilter}
            onChange={(e) => setEnvFilter(e.target.value)}
            className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="all">All Environments</option>
            <option value="production">Production</option>
            <option value="staging">Staging</option>
            <option value="development">Development</option>
          </select>

          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="all">All Severities</option>
            <option value="CRITICAL">Critical Only</option>
            <option value="HIGH">High Only</option>
          </select>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search history..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg w-44 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>
      </div>

      {/* Timeline List */}
      <div className="p-4 sm:p-6 space-y-4">
        {filteredHistory.length === 0 ? (
          <div className="text-center py-12 text-slate-500 text-xs">
            No drift events matching your criteria.
          </div>
        ) : (
          filteredHistory.map((item, idx) => (
            <div
              key={item.id}
              className="relative pl-6 pb-4 border-l-2 border-slate-200 last:border-transparent last:pb-0"
            >
              {/* Timeline marker */}
              <div
                className={`absolute -left-[9px] top-0.5 w-4 h-4 rounded-full border-2 bg-white flex items-center justify-center ${
                  item.severity === 'CRITICAL'
                    ? 'border-rose-500 text-rose-500'
                    : item.severity === 'HIGH'
                    ? 'border-amber-500 text-amber-500'
                    : 'border-indigo-500 text-indigo-500'
                }`}
              >
                <div
                  className={`w-1.5 h-1.5 rounded-full ${
                    item.severity === 'CRITICAL'
                      ? 'bg-rose-500'
                      : item.severity === 'HIGH'
                      ? 'bg-amber-500'
                      : 'bg-indigo-500'
                  }`}
                />
              </div>

              {/* Card */}
              <div className="bg-slate-50/70 hover:bg-slate-50 p-3.5 rounded-lg border border-slate-200 transition-colors">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">
                      {item.dateStr}
                    </span>
                    <span className="text-xs font-mono font-semibold text-slate-700">
                      {item.environmentName}
                    </span>
                    {getSeverityBadge(item.severity)}
                  </div>
                  <div className="flex items-center gap-3 text-slate-500 text-[11px]">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-400" />
                      {item.timestamp}
                    </span>
                    <span className="flex items-center gap-1">
                      <User className="w-3 h-3 text-slate-400" />
                      {item.author}
                    </span>
                  </div>
                </div>

                {/* Diff Transformation Preview */}
                <div className="flex flex-wrap items-center gap-2 font-mono text-xs my-2 bg-white p-2.5 rounded border border-slate-200/80">
                  <span className="font-bold text-slate-900 px-1.5 py-0.5 bg-slate-100 rounded">
                    {item.key}
                  </span>
                  <span className="text-slate-400">:</span>
                  <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded line-through text-[11px]">
                    {item.fromValue}
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                  <span className="bg-rose-50 text-rose-800 border border-rose-200 px-2 py-0.5 rounded font-bold text-[11px]">
                    {item.toValue}
                  </span>
                </div>

                {/* Reason / Context */}
                <p className="text-xs text-slate-600 mt-1">
                  <span className="font-semibold text-slate-700">Root Trigger: </span>
                  {item.reason}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
