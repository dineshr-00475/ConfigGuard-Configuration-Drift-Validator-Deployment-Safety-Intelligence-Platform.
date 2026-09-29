import React, { useState } from 'react';
import {
  AlertOctagon,
  AlertTriangle,
  Info,
  CheckCircle2,
  Wrench,
  Eye,
  CheckCheck,
  Search,
  Filter,
  Layers,
  Sparkles,
  Server,
  Variable,
  Key,
  Activity,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import {
  DriftRecord,
  DriftCategory,
  DriftSeverity,
  EnvironmentState,
} from '../types';

interface DriftTableProps {
  environment: EnvironmentState;
  drifts: DriftRecord[];
  onReconcileAll: () => void;
  onReconcileItem: (drift: DriftRecord) => void;
  onPromoteBaseline: (drift?: any) => void;
  onViewDiff: (drift: DriftRecord) => void;
}

export const DriftTable: React.FC<DriftTableProps> = ({
  environment,
  drifts,
  onReconcileAll,
  onReconcileItem,
  onPromoteBaseline,
  onViewDiff,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedSeverity, setSelectedSeverity] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

  const toggleRow = (id: string) => {
    setExpandedRows((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const filteredDrifts = drifts.filter((d) => {
    if (selectedCategory !== 'all' && d.category !== selectedCategory) return false;
    if (selectedSeverity !== 'all' && d.severity !== selectedSeverity) return false;
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      return (
        d.key.toLowerCase().includes(q) ||
        d.reason.toLowerCase().includes(q) ||
        d.impact.toLowerCase().includes(q) ||
        String(d.expectedValue).toLowerCase().includes(q) ||
        String(d.actualValue).toLowerCase().includes(q)
      );
    }
    return true;
  });

  const getCategoryIcon = (category: DriftCategory) => {
    switch (category) {
      case 'infrastructure':
        return <Server className="w-3.5 h-3.5 text-blue-500" />;
      case 'env_variable':
        return <Variable className="w-3.5 h-3.5 text-purple-500" />;
      case 'secret_metadata':
        return <Key className="w-3.5 h-3.5 text-amber-500" />;
      case 'runtime':
        return <Activity className="w-3.5 h-3.5 text-emerald-500" />;
    }
  };

  const getSeverityBadge = (sev: DriftSeverity) => {
    switch (sev) {
      case 'CRITICAL':
        return (
          <span className="inline-flex items-center gap-1 bg-rose-50 text-rose-700 border border-rose-200 text-[11px] font-bold px-2 py-0.5 rounded-full">
            <AlertOctagon className="w-3 h-3 text-rose-600" />
            CRITICAL
          </span>
        );
      case 'HIGH':
        return (
          <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 border border-amber-200 text-[11px] font-bold px-2 py-0.5 rounded-full">
            <AlertTriangle className="w-3 h-3 text-amber-600" />
            HIGH
          </span>
        );
      case 'MEDIUM':
        return (
          <span className="inline-flex items-center gap-1 bg-yellow-50 text-yellow-800 border border-yellow-200 text-[11px] font-semibold px-2 py-0.5 rounded-full">
            <Info className="w-3 h-3 text-yellow-600" />
            MEDIUM
          </span>
        );
      case 'LOW':
        return (
          <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 border border-blue-200 text-[11px] font-medium px-2 py-0.5 rounded-full">
            <Info className="w-3 h-3 text-blue-600" />
            LOW
          </span>
        );
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
      {/* Header bar */}
      <div className="p-4 sm:px-6 border-b border-slate-200 flex flex-col md:flex-row md:items-center md:justify-between gap-3 bg-slate-50/50">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-slate-900">
              Active Drift Detections for {environment.displayName}
            </h2>
            <span className="text-xs font-mono bg-slate-200/80 text-slate-700 px-2 py-0.5 rounded-full">
              {drifts.length} {drifts.length === 1 ? 'drift' : 'drifts'} total
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time differential comparison between GitOps expected baseline and live environment
          </p>
        </div>

        {/* Global Action buttons */}
        <div className="flex items-center gap-2">
          {drifts.length > 0 && (
            <>
              <button
                onClick={onReconcileAll}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition-colors"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>Reconcile All to Golden State</span>
              </button>
              <button
                onClick={onPromoteBaseline}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium shadow-xs transition-colors"
                title="Accept all current actual values as the new expected baseline"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>Accept Live as Baseline</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Filter and Search controls */}
      <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Category Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          {[
            { id: 'all', label: 'All Domains', count: drifts.length },
            {
              id: 'infrastructure',
              label: 'Infrastructure',
              count: drifts.filter((d) => d.category === 'infrastructure').length,
            },
            {
              id: 'env_variable',
              label: 'Env Variables',
              count: drifts.filter((d) => d.category === 'env_variable').length,
            },
            {
              id: 'secret_metadata',
              label: 'Secrets',
              count: drifts.filter((d) => d.category === 'secret_metadata').length,
            },
            {
              id: 'runtime',
              label: 'Runtime',
              count: drifts.filter((d) => d.category === 'runtime').length,
            },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                selectedCategory === cat.id
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <span>{cat.label}</span>
              <span
                className={`text-[10px] px-1 rounded-full ${
                  selectedCategory === cat.id
                    ? 'bg-slate-700 text-white'
                    : 'bg-slate-200 text-slate-700'
                }`}
              >
                {cat.count}
              </span>
            </button>
          ))}
        </div>

        {/* Severity and Search */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          {/* Severity selector */}
          <select
            value={selectedSeverity}
            onChange={(e) => setSelectedSeverity(e.target.value)}
            className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="all">All Severities</option>
            <option value="CRITICAL">Critical Only</option>
            <option value="HIGH">High Only</option>
            <option value="MEDIUM">Medium Only</option>
            <option value="LOW">Low Only</option>
          </select>

          {/* Search bar */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search drift key or reason..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg w-48 sm:w-56 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>
      </div>

      {/* Table Content */}
      {filteredDrifts.length === 0 ? (
        <div className="py-16 text-center px-4">
          <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-3">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900 mb-1">
            {drifts.length === 0
              ? 'Zero Configuration Drift'
              : 'No Drifts Match Current Filter'}
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto mb-4">
            {drifts.length === 0
              ? `All configurations in ${environment.displayName} strictly match the golden GitOps baseline. Gatekeeper status is APPROVED for release.`
              : 'Try clearing your search query or selecting "All Severities" to view active records.'}
          </p>
          {drifts.length === 0 && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-emerald-50 text-emerald-800 text-xs font-semibold border border-emerald-200">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Gatekeeper Green Light: 100% Synchronized</span>
            </div>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                <th className="py-3 px-4">Severity</th>
                <th className="py-3 px-4">Domain / Key</th>
                <th className="py-3 px-4">Expected (GitOps)</th>
                <th className="py-3 px-4">Actual (Live)</th>
                <th className="py-3 px-4">Flash-Sale Risk & Impact</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
              {filteredDrifts.map((drift) => {
                const isExpanded = !!expandedRows[drift.id];
                return (
                  <React.Fragment key={drift.id}>
                    <tr
                      className={`hover:bg-slate-50/80 transition-colors group ${
                        isExpanded ? 'bg-indigo-50/20' : ''
                      }`}
                    >
                      {/* Severity & Risk Points */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex flex-col gap-1 items-start">
                          {getSeverityBadge(drift.severity)}
                          <span className="text-[10px] font-mono font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                            +{drift.riskPoints ?? 10} risk pts
                          </span>
                        </div>
                      </td>

                      {/* Domain and Key */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          {getCategoryIcon(drift.category)}
                          <span className="text-[11px] text-slate-500 capitalize font-medium">
                            {drift.category.replace('_', ' ')}
                          </span>
                        </div>
                        <div className="font-mono font-bold text-slate-900 text-xs">
                          {drift.key}
                        </div>
                      </td>

                      {/* Expected Value */}
                      <td className="py-3 px-4">
                        <div className="inline-block font-mono text-[11px] bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-1 rounded max-w-xs break-all">
                          {String(drift.expectedValue)}
                        </div>
                      </td>

                      {/* Actual Value */}
                      <td className="py-3 px-4">
                        <div className="inline-block font-mono text-[11px] bg-rose-50 text-rose-800 border border-rose-200 px-2 py-1 rounded max-w-xs break-all">
                          {String(drift.actualValue)}
                        </div>
                      </td>

                      {/* Impact & Reason */}
                      <td className="py-3 px-4 max-w-md">
                        <div className="font-medium text-slate-800 mb-0.5">
                          {drift.reason}
                        </div>
                        <div className="text-[11px] text-slate-500 line-clamp-2">
                          {drift.impact}
                        </div>
                        <button
                          onClick={() => toggleRow(drift.id)}
                          className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 hover:text-indigo-800"
                        >
                          <Sparkles className="w-3 h-3" />
                          <span>{isExpanded ? 'Hide Root Cause & Fix' : 'Auto Root-Cause & Fix'}</span>
                        </button>
                      </td>

                      {/* Action buttons */}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => onViewDiff(drift)}
                            title="View side-by-side comparison"
                            className="p-1.5 rounded-md hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition-colors"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => onReconcileItem(drift)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold text-[11px] border border-indigo-200 transition-colors"
                          >
                            <Wrench className="w-3 h-3" />
                            <span>Reconcile</span>
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* Diagnostic Collapsible Row: Auto Root-Cause & Recommended Fix */}
                    {isExpanded && (
                      <tr className="bg-slate-50/70 border-b border-indigo-100">
                        <td colSpan={6} className="px-6 py-3.5">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-white p-3.5 rounded-lg border border-indigo-100 shadow-2xs">
                            <div>
                              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 mb-1">
                                <AlertOctagon className="w-3.5 h-3.5 text-amber-600" />
                                <span>Auto Root-Cause Analysis</span>
                              </div>
                              <p className="text-xs text-slate-600 leading-relaxed bg-amber-50/50 p-2.5 rounded border border-amber-100/70">
                                {drift.rootCause || 'Manual or unmanaged change detected outside GitOps continuous delivery pipeline.'}
                              </p>
                            </div>
                            <div>
                              <div className="flex items-center justify-between text-xs font-bold text-slate-800 mb-1">
                                <div className="flex items-center gap-1.5">
                                  <Wrench className="w-3.5 h-3.5 text-indigo-600" />
                                  <span>Recommended Fix</span>
                                </div>
                                <button
                                  onClick={() => onReconcileItem(drift)}
                                  className="text-[11px] bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-2 py-0.5 rounded shadow-2xs transition-colors"
                                >
                                  Apply Fix Now
                                </button>
                              </div>
                              <p className="text-xs text-slate-600 leading-relaxed bg-indigo-50/50 p-2.5 rounded border border-indigo-100/70">
                                {drift.recommendedFix || 'Reconcile live runtime values to match expected GitOps baseline repository.'}
                              </p>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
