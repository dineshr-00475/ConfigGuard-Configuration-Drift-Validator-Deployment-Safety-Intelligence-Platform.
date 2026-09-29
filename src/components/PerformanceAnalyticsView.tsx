import React, { useState, useEffect, useCallback } from 'react';
import {
  Activity,
  Clock,
  Database,
  Cpu,
  ShieldAlert,
  RefreshCw,
  FileDown,
  Zap,
  RotateCcw,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import {
  fetchPerformanceMetrics,
  runPerformanceProbe,
  downloadReportExport,
} from '../services/apiClient';

interface PerformanceAnalyticsViewProps {
  showToast?: (msg: string, type?: 'success' | 'warning' | 'error' | 'info') => void;
}

const REPORT_TYPES: Array<{
  id: 'validation' | 'drift-history' | 'benchmark' | 'audit-logs' | 'environment-health';
  label: string;
  description: string;
}> = [
  {
    id: 'validation',
    label: 'Validation Reports',
    description: 'Gatekeeper decisions, layer checks, and drift counts across environments.',
  },
  {
    id: 'drift-history',
    label: 'Drift History',
    description: 'Detected configuration mismatches, expected vs actual values, and severities.',
  },
  {
    id: 'benchmark',
    label: 'Benchmark Results',
    description: '112-scenario quantitative evaluation comparing Baseline vs ConfigGuard.',
  },
  {
    id: 'audit-logs',
    label: 'Deployment Audit Logs',
    description: 'Immutable cryptographic ledger of validations, overrides, and CR approvals.',
  },
  {
    id: 'environment-health',
    label: 'Environment Health Reports',
    description: 'Readiness scores, SHA-256 fingerprints, and cluster health summaries.',
  },
];

export function PerformanceAnalyticsView({ showToast }: PerformanceAnalyticsViewProps) {
  const [metrics, setMetrics] = useState<any | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [probing, setProbing] = useState<boolean>(false);
  const [exportingKey, setExportingKey] = useState<string | null>(null);

  const loadMetrics = useCallback(async () => {
    setLoading(true);
    const data = await fetchPerformanceMetrics();
    setMetrics(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadMetrics();
  }, [loadMetrics]);

  const handleRunMeasuredProbe = async () => {
    setProbing(true);
    const data = await runPerformanceProbe();
    setProbing(false);
    if (data) {
      setMetrics(data);
      showToast?.('Measured new live validation, DB, event, and recovery timings.', 'success');
    } else {
      showToast?.('Failed to run performance probe.', 'error');
    }
  };

  const handleExport = async (
    reportType: 'validation' | 'drift-history' | 'benchmark' | 'audit-logs' | 'environment-health',
    format: 'csv' | 'pdf'
  ) => {
    const key = `${reportType}:${format}`;
    setExportingKey(key);
    const ok = await downloadReportExport(reportType, format);
    setExportingKey(null);
    if (ok) {
      showToast?.(`Exported ${reportType} report (${format.toUpperCase()}).`, 'success');
    } else {
      showToast?.(`Failed to export ${reportType} report.`, 'error');
    }
  };

  const summary = metrics?.summary || {};
  const timelineSeries: any[] = metrics?.timeline_series || [];
  const breakdown = metrics?.breakdown || {};

  const categoryComparisonData = [
    {
      name: 'Validation Scan',
      avg_ms: summary.validation_duration_ms ?? 0,
      p95_ms: summary.validation_p95_ms ?? 0,
    },
    {
      name: 'API Response',
      avg_ms: summary.api_response_time_ms ?? 0,
      p95_ms: summary.api_p95_ms ?? 0,
    },
    {
      name: 'DB Query',
      avg_ms: summary.db_operation_time_ms ?? 0,
      p95_ms: breakdown?.db_operation?.p95_ms ?? 0,
    },
    {
      name: 'Event Engine',
      avg_ms: summary.event_processing_duration_ms ?? 0,
      p95_ms: breakdown?.event_processing?.p95_ms ?? 0,
    },
    {
      name: 'Recovery / Sync',
      avg_ms: summary.average_recovery_time_ms ?? 0,
      p95_ms: breakdown?.recovery?.p95_ms ?? summary.average_recovery_time_ms ?? 0,
    },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-white tracking-tight flex items-center gap-2.5">
            <Activity className="w-5 h-5 text-indigo-400" />
            <span>Performance Analytics & Report Export Center</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            High-resolution perf_counter measurements of validation duration, API latency, SQLite
            operations, event throughput, and recovery times.
          </p>
        </div>

        <button
          onClick={handleRunMeasuredProbe}
          disabled={probing}
          className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-2 whitespace-nowrap"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${probing ? 'animate-spin' : ''}`} />
          <span>{probing ? 'Measuring Live Timings...' : 'Run Live Timing Probe'}</span>
        </button>
      </div>

      {/* 7 Measured KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Validation Duration</span>
            <Clock className="w-3.5 h-3.5 text-indigo-400" />
          </div>
          <div className="text-xl font-semibold font-mono tabular-nums text-white">
            {summary.validation_duration_ms ?? 0} ms
          </div>
          <div className="text-[11px] font-mono text-slate-500">
            P95: {summary.validation_p95_ms ?? 0} ms ({breakdown?.validation?.count ?? 0} runs)
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>API Response Time</span>
            <Zap className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-xl font-semibold font-mono tabular-nums text-white">
            {summary.api_response_time_ms ?? 0} ms
          </div>
          <div className="text-[11px] font-mono text-slate-500">
            P95: {summary.api_p95_ms ?? 0} ms ({breakdown?.api_request?.count ?? 0} requests)
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Database Operation Time</span>
            <Database className="w-3.5 h-3.5 text-indigo-400" />
          </div>
          <div className="text-xl font-semibold font-mono tabular-nums text-white">
            {summary.db_operation_time_ms ?? 0} ms
          </div>
          <div className="text-[11px] font-mono text-slate-500">
            SQLite WAL Mode ({breakdown?.db_operation?.count ?? 0} queries)
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Event Processing Duration</span>
            <Cpu className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-xl font-semibold font-mono tabular-nums text-white">
            {summary.event_processing_duration_ms ?? 0} ms
          </div>
          <div className="text-[11px] font-mono text-slate-500">
            Throughput: {summary.events_processed_per_second ?? 0} events/sec
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Average Recovery Time</span>
            <RotateCcw className="w-3.5 h-3.5 text-indigo-400" />
          </div>
          <div className="text-xl font-semibold font-mono tabular-nums text-white">
            {summary.average_recovery_time_ms ?? 0} ms
          </div>
          <div className="text-[11px] font-mono text-slate-500">
            Measured reconciliation execution
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Failed Validation Count</span>
            <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
          </div>
          <div className="text-xl font-semibold font-mono tabular-nums text-rose-400">
            {summary.failed_validation_count ?? 0}
          </div>
          <div className="text-[11px] font-mono text-slate-500">
            Out of {summary.total_validation_runs ?? 0} recorded gate checks
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-1 sm:col-span-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Events Processed Per Second</span>
            <Activity className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-xl font-semibold font-mono tabular-nums text-emerald-400">
            {summary.events_processed_per_second ?? 0} events/sec
          </div>
          <div className="text-[11px] font-mono text-slate-500">
            Derived from measured idempotent event ingestion latency ({summary.total_events_processed ?? 0} total events stored)
          </div>
        </div>
      </div>

      {/* Measured Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Timeline Chart */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-white">
              Measured Latency Timeline (Validation vs API vs DB)
            </h2>
            <p className="text-xs text-slate-400">
              Actual recorded operation durations in milliseconds (ms) across recent execution
              samples.
            </p>
          </div>
          <div className="h-64 w-full">
            {loading && timelineSeries.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-500">
                Loading measured series...
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={timelineSeries}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="timestamp" stroke="#64748b" fontSize={11} />
                  <YAxis stroke="#64748b" fontSize={11} unit="ms" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderColor: '#1e293b',
                      fontSize: '12px',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  <Line
                    type="monotone"
                    dataKey="validation_ms"
                    name="Validation (ms)"
                    stroke="#6366f1"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="api_ms"
                    name="API Request (ms)"
                    stroke="#10b981"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="db_ms"
                    name="DB Query (ms)"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Mean vs P95 Bar Chart */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-white">
              Mean vs P95 Execution Latency by Subsystem
            </h2>
            <p className="text-xs text-slate-400">
              Comparison of average and 95th-percentile execution times across core operations.
            </p>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoryComparisonData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="name" stroke="#64748b" fontSize={11} />
                <YAxis stroke="#64748b" fontSize={11} unit="ms" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#1e293b',
                    fontSize: '12px',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Bar dataKey="avg_ms" name="Average (ms)" fill="#6366f1" radius={[4, 4, 0, 0]} />
                <Bar dataKey="p95_ms" name="P95 (ms)" fill="#14b8a6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Report Export Center (Section 6 Requirement) */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
        <div>
          <h2 className="text-base font-semibold text-white flex items-center gap-2">
            <FileDown className="w-4 h-4 text-indigo-400" />
            <span>Compliance & Telemetry Report Export Center (CSV & PDF)</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Generate and download verifiable CSV and PDF reports populated directly from stored
            SQLite records and UTC timestamps.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {REPORT_TYPES.map((rep) => (
            <div
              key={rep.id}
              className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 flex flex-col justify-between gap-3"
            >
              <div>
                <h3 className="text-xs font-semibold text-white">{rep.label}</h3>
                <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                  {rep.description}
                </p>
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-slate-800/80">
                <button
                  onClick={() => handleExport(rep.id, 'csv')}
                  disabled={exportingKey !== null}
                  aria-label={`Export ${rep.label} CSV`}
                  className="flex-1 py-1.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors flex items-center justify-center gap-1.5"
                >
                  <FileDown className="w-3.5 h-3.5 text-indigo-400" />
                  <span>{exportingKey === `${rep.id}:csv` ? 'Exporting...' : 'CSV'}</span>
                </button>
                <button
                  onClick={() => handleExport(rep.id, 'pdf')}
                  disabled={exportingKey !== null}
                  aria-label={`Export ${rep.label} PDF`}
                  className="flex-1 py-1.5 px-3 rounded-lg bg-indigo-600/90 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
                >
                  <FileDown className="w-3.5 h-3.5" />
                  <span>{exportingKey === `${rep.id}:pdf` ? 'Exporting...' : 'PDF'}</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
