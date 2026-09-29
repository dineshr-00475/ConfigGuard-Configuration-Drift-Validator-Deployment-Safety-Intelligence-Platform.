import React, { useState, useEffect, useCallback } from 'react';
import {
  Activity,
  Database,
  Server,
  ShieldCheck,
  Cpu,
  Clock,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  FileDown,
  XCircle,
} from 'lucide-react';
import {
  fetchDetailedSystemHealth,
  runHealthProbe,
  resolveSystemError,
  downloadReportExport,
} from '../services/apiClient';

interface SystemHealthViewProps {
  showToast?: (msg: string, type?: 'success' | 'warning' | 'error' | 'info') => void;
}

export function SystemHealthView({ showToast }: SystemHealthViewProps) {
  const [health, setHealth] = useState<any | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [probing, setProbing] = useState<boolean>(false);
  const [exporting, setExporting] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadHealth = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    const data = await fetchDetailedSystemHealth();
    if (data) {
      setHealth(data);
    } else {
      setErrorMsg('Unable to reach backend health endpoint (/api/health/detailed).');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadHealth();
  }, [loadHealth]);

  const handleRunProbe = async () => {
    setProbing(true);
    const data = await runHealthProbe();
    if (data) {
      setHealth(data);
      showToast?.('Live diagnostic health probe completed across all engines.', 'success');
    } else {
      showToast?.('Diagnostic probe failed to reach backend.', 'error');
    }
    setProbing(false);
  };

  const handleResolveError = async (id: number) => {
    const ok = await resolveSystemError(id);
    if (ok) {
      showToast?.(`System error #${id} marked resolved.`, 'info');
      loadHealth();
    }
  };

  const handleExport = async (format: 'csv' | 'pdf') => {
    setExporting(format);
    const ok = await downloadReportExport('environment-health', format);
    setExporting(null);
    if (ok) {
      showToast?.(`Exported Environment Health Report (${format.toUpperCase()})`, 'success');
    } else {
      showToast?.('Failed to export report', 'error');
    }
  };

  if (loading && !health) {
    return (
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 animate-pulse h-28" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((n) => (
            <div
              key={n}
              className="bg-slate-900 border border-slate-800 rounded-2xl p-5 animate-pulse h-40"
            />
          ))}
        </div>
      </div>
    );
  }

  const overallStatus = health?.overall_status || 'DEGRADED';
  const api = health?.backend_api || {};
  const db = health?.database || {};
  const valEngine = health?.validation_engine || {};
  const evEngine = health?.event_processor || {};
  const sysErrors: any[] = health?.system_errors || [];

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <Activity className="w-5 h-5 text-indigo-400" />
            <h1 className="text-xl font-semibold text-white tracking-tight">
              System Health Monitoring
            </h1>
            <span className="text-xs font-mono text-slate-400">
              · Status:{' '}
              <strong
                className={
                  overallStatus === 'HEALTHY'
                    ? 'text-emerald-400'
                    : overallStatus === 'WARNING'
                    ? 'text-amber-400'
                    : 'text-rose-400'
                }
              >
                {overallStatus}
              </strong>
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Live telemetry from the FastAPI safety engine, SQLite WAL storage layer, drift validation
            core, and idempotent event processor.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => handleExport('csv')}
            disabled={exporting !== null}
            aria-label="Export Health CSV"
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-colors flex items-center gap-1.5 whitespace-nowrap"
          >
            <FileDown className="w-3.5 h-3.5" />
            <span>{exporting === 'csv' ? 'Exporting...' : 'Export Health CSV'}</span>
          </button>
          <button
            onClick={() => handleExport('pdf')}
            disabled={exporting !== null}
            aria-label="Export Health PDF"
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-colors flex items-center gap-1.5 whitespace-nowrap"
          >
            <FileDown className="w-3.5 h-3.5" />
            <span>{exporting === 'pdf' ? 'Exporting...' : 'Export Health PDF'}</span>
          </button>
          <button
            onClick={handleRunProbe}
            disabled={probing}
            aria-label="Run Live Diagnostic Probe"
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold transition-colors flex items-center gap-2 whitespace-nowrap"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${probing ? 'animate-spin' : ''}`} />
            <span>{probing ? 'Probing Subsystems...' : 'Run Live Diagnostic Probe'}</span>
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="bg-rose-950/60 border border-rose-800 rounded-2xl p-4 flex items-center justify-between text-xs text-rose-200">
          <div className="flex items-center gap-2.5">
            <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button
            onClick={loadHealth}
            className="px-3 py-1 rounded-lg bg-rose-800 hover:bg-rose-700 text-white font-semibold"
          >
            Retry
          </button>
        </div>
      )}

      {/* 4 Core Subsystem Health Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Backend API Status */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Backend API Status</span>
            <Server className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-lg font-semibold text-emerald-400 font-mono">
              {api.status || 'ONLINE'}
            </span>
            <span className="text-xs font-mono tabular-nums text-slate-300">
              {api.avg_response_time_ms ?? 0} ms avg
            </span>
          </div>
          <div className="pt-2 border-t border-slate-800/80 space-y-1 text-xs text-slate-400 font-mono tabular-nums">
            <div className="flex justify-between">
              <span>Probe Latency:</span>
              <span className="text-slate-200">{api.current_probe_latency_ms ?? 0} ms</span>
            </div>
            <div className="flex justify-between">
              <span>P95 Latency:</span>
              <span className="text-slate-200">{api.p95_response_time_ms ?? 0} ms</span>
            </div>
            <div className="flex justify-between">
              <span>Sampled Calls:</span>
              <span className="text-slate-200">{api.sampled_requests ?? 0}</span>
            </div>
          </div>
        </div>

        {/* 2. Database Connection */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Database Connection</span>
            <Database className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="flex items-baseline justify-between">
            <span
              className={`text-lg font-semibold font-mono ${
                db.status === 'CONNECTED' ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {db.status || 'UNKNOWN'}
            </span>
            <span className="text-xs font-mono tabular-nums text-slate-300">
              {db.query_latency_ms ?? 0} ms query
            </span>
          </div>
          <div className="pt-2 border-t border-slate-800/80 space-y-1 text-xs text-slate-400 font-mono tabular-nums">
            <div className="flex justify-between">
              <span>Engine Mode:</span>
              <span className="text-slate-200">SQLite WAL + FK</span>
            </div>
            <div className="flex justify-between">
              <span>Environments:</span>
              <span className="text-slate-200">{db.environments_tracked ?? 3}</span>
            </div>
            <div className="flex justify-between">
              <span>Stored Drifts:</span>
              <span className="text-slate-200">{db.active_drift_records ?? 0}</span>
            </div>
          </div>
        </div>

        {/* 3. Validation Engine Status */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Validation Engine</span>
            <ShieldCheck className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="flex items-baseline justify-between">
            <span
              className={`text-lg font-semibold font-mono ${
                valEngine.status === 'OPERATIONAL' ? 'text-emerald-400' : 'text-amber-400'
              }`}
            >
              {valEngine.status || 'OPERATIONAL'}
            </span>
            <span className="text-xs font-mono tabular-nums text-slate-300">
              {valEngine.probe_duration_ms ?? 0} ms scan
            </span>
          </div>
          <div className="pt-2 border-t border-slate-800/80 space-y-1 text-xs text-slate-400 font-mono tabular-nums">
            <div className="flex justify-between">
              <span>Last Env:</span>
              <span className="text-slate-200 capitalize">
                {valEngine.last_validated_environment || 'production'}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Last Validated:</span>
              <span className="text-slate-200">
                {valEngine.last_successful_validation
                  ? new Date(valEngine.last_successful_validation).toLocaleTimeString()
                  : 'N/A'}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Sensor Layers:</span>
              <span className="text-slate-200">
                {(valEngine.supported_layers || []).length || 4} Active
              </span>
            </div>
          </div>
        </div>

        {/* 4. Event Processor Status */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Event Processor</span>
            <Cpu className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="flex items-baseline justify-between">
            <span
              className={`text-lg font-semibold font-mono ${
                evEngine.status === 'OPERATIONAL' ? 'text-emerald-400' : 'text-amber-400'
              }`}
            >
              {evEngine.status || 'OPERATIONAL'}
            </span>
            <span className="text-xs font-mono tabular-nums text-slate-300">
              {evEngine.total_events ?? 0} events
            </span>
          </div>
          <div className="pt-2 border-t border-slate-800/80 space-y-1 text-xs text-slate-400 font-mono tabular-nums">
            <div className="flex justify-between">
              <span>Processed OK:</span>
              <span className="text-emerald-400">{evEngine.processed_events ?? 0}</span>
            </div>
            <div className="flex justify-between">
              <span>Deduplicated:</span>
              <span className="text-amber-400">{evEngine.duplicate_events_blocked ?? 0}</span>
            </div>
            <div className="flex justify-between">
              <span>Stale Rejected:</span>
              <span className="text-rose-400">{evEngine.out_of_order_events_rejected ?? 0}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Last Successful Validation & Runtime Verification Summary */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
          <Clock className="w-4 h-4 text-indigo-400" />
          <span>Subsystem Verification & Last Successful Validation Details</span>
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs">
          <div className="space-y-1">
            <div className="text-slate-400">Last Successful Validation Timestamp</div>
            <div className="text-sm font-mono tabular-nums text-white">
              {valEngine.last_successful_validation
                ? new Date(valEngine.last_successful_validation).toLocaleString()
                : 'No validation recorded yet'}
            </div>
            <div className="text-slate-500">
              Target Cluster: {valEngine.last_validated_environment || 'production'}
            </div>
          </div>

          <div className="space-y-1">
            <div className="text-slate-400">Measured API & DB Round-Trip</div>
            <div className="text-sm font-mono tabular-nums text-white">
              API: {api.avg_response_time_ms ?? 0} ms · DB: {db.query_latency_ms ?? 0} ms
            </div>
            <div className="text-slate-500">
              Measured via high-resolution perf_counter instrumentation
            </div>
          </div>

          <div className="space-y-1">
            <div className="text-slate-400">Event Safety Barriers</div>
            <div className="text-sm font-mono text-emerald-400">
              Idempotency: {evEngine.idempotency_barrier || 'ACTIVE'} · Version Guard:{' '}
              {evEngine.out_of_order_guard || 'ACTIVE'}
            </div>
            <div className="text-slate-500">
              Prevents duplicate or out-of-order Kafka/Webhook state corruption
            </div>
          </div>
        </div>
      </div>

      {/* System Errors Log Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <span>System Errors & Exception Telemetry</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Captures unhandled backend exceptions, database connectivity warnings, and HTTP 5xx
              faults.
            </p>
          </div>
          <span className="text-xs font-mono tabular-nums text-slate-400">
            Unresolved: {health?.unresolved_error_count ?? 0}
          </span>
        </div>

        {sysErrors.length === 0 ? (
          <div className="p-8 text-center space-y-2">
            <CheckCircle2 className="w-6 h-6 text-emerald-400 mx-auto" />
            <div className="text-xs font-semibold text-white">Zero System Errors Recorded</div>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              All backend API routes, SQLite database transactions, and validation probes have
              executed cleanly with 0 unhandled exceptions.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 bg-slate-950/50">
                  <th className="py-3 px-4 font-medium">ID</th>
                  <th className="py-3 px-4 font-medium">Component</th>
                  <th className="py-3 px-4 font-medium">Endpoint</th>
                  <th className="py-3 px-4 font-medium">Error Type</th>
                  <th className="py-3 px-4 font-medium">Message</th>
                  <th className="py-3 px-4 font-medium">Occurred At</th>
                  <th className="py-3 px-4 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70 font-mono tabular-nums">
                {sysErrors.map((err) => (
                  <tr key={err.id} className="hover:bg-slate-800/40">
                    <td className="py-3 px-4 text-slate-400">#{err.id}</td>
                    <td className="py-3 px-4 text-white font-sans">{err.component}</td>
                    <td className="py-3 px-4 text-indigo-300">{err.endpoint || 'N/A'}</td>
                    <td className="py-3 px-4 text-rose-400">{err.error_type}</td>
                    <td className="py-3 px-4 text-slate-300 font-sans max-w-xs truncate">
                      {err.message}
                    </td>
                    <td className="py-3 px-4 text-slate-400">
                      {err.occurred_at ? new Date(err.occurred_at).toLocaleString() : 'N/A'}
                    </td>
                    <td className="py-3 px-4 text-right font-sans">
                      {err.resolved ? (
                        <span className="text-emerald-400">Resolved</span>
                      ) : (
                        <button
                          onClick={() => handleResolveError(err.id)}
                          className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium"
                        >
                          Resolve
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
