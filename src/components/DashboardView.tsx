import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  Zap,
  Activity,
  CheckCircle2,
  AlertTriangle,
  Flame,
  Clock,
  Radio,
  ArrowRight,
  GitCompare,
  SlidersHorizontal,
  Server,
  Database,
  Cpu,
  RefreshCw,
  FileSpreadsheet,
  Lock,
  ExternalLink,
  ChevronRight,
  TrendingDown,
  TrendingUp,
  Sparkles,
  Info,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
} from 'recharts';
import {
  EnvironmentState,
  DriftRecord,
  UserProfile,
  ActiveTab,
  AuditLog,
  DriftHistoryItem,
} from '../types';
import {
  checkBackendHealth,
  fetchDashboardMetrics,
  DashboardMetricsResponse,
  BackendHealth,
} from '../services/apiClient';

interface DashboardViewProps {
  environments: EnvironmentState[];
  selectedEnv: EnvironmentState;
  activeDrifts: DriftRecord[];
  allDriftsCount: number;
  currentUser: UserProfile | null;
  onNavigateTab: (tab: ActiveTab) => void;
  onSelectEnv: (envName: any) => void;
  onOpenGatekeeper: () => void;
  onOpenSimulator: () => void;
  onReconcileAll: () => void;
  onReconcileSingle: (drift: DriftRecord) => void;
  auditLogs: AuditLog[];
  driftHistory: DriftHistoryItem[];
  onOpenLoginModal: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  environments,
  selectedEnv,
  activeDrifts,
  allDriftsCount,
  currentUser,
  onNavigateTab,
  onSelectEnv,
  onOpenGatekeeper,
  onOpenSimulator,
  onReconcileAll,
  onReconcileSingle,
  auditLogs,
  driftHistory,
  onOpenLoginModal,
}) => {
  const prodEnv = environments.find((e) => e.name === 'production') || selectedEnv;
  const isProdBlocked = prodEnv.deploymentStatus === 'BLOCKED' || prodEnv.riskPoints > 30;

  // Backend connection and metrics state
  const [backendMetrics, setBackendMetrics] = useState<DashboardMetricsResponse | null>(null);
  const [backendHealth, setBackendHealth] = useState<BackendHealth | null>(null);
  const [backendLatency, setBackendLatency] = useState<number | null>(null);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  const loadBackendStatus = async () => {
    setIsSyncing(true);
    const start = performance.now();
    try {
      const [health, metrics] = await Promise.all([
        checkBackendHealth().catch(() => null),
        fetchDashboardMetrics().catch(() => null),
      ]);
      const latency = Math.round(performance.now() - start);
      setBackendLatency(latency);
      if (health) setBackendHealth(health);
      if (metrics) setBackendMetrics(metrics);
    } catch (err) {
      console.warn('Dashboard backend sync graceful fallback:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    loadBackendStatus();
  }, [activeDrifts.length, selectedEnv.name]);

  // Drift counts by severity
  const criticalCount = activeDrifts.filter((d) => d.severity === 'CRITICAL').length;
  const highCount = activeDrifts.filter((d) => d.severity === 'HIGH').length;
  const mediumCount = activeDrifts.filter((d) => d.severity === 'MEDIUM').length;
  const lowCount = activeDrifts.filter((d) => d.severity === 'LOW').length;

  // Time-series trend data: prioritize real backend safety trend if available
  const trendData = (backendMetrics?.safety_score_trend && backendMetrics.safety_score_trend.length > 0)
    ? backendMetrics.safety_score_trend.map((t) => ({
        time: t.date,
        detected: t.critical_drifts,
        reconciled: Math.max(0, 8 - t.critical_drifts),
        riskScore: Math.round(100 - t.score),
      }))
    : [
        { time: '02:00', detected: 1, reconciled: 1, riskScore: 25 },
        { time: '06:00', detected: 2, reconciled: 2, riskScore: 30 },
        { time: '10:00', detected: 4, reconciled: 3, riskScore: 65 },
        { time: '14:00', detected: 7, reconciled: 4, riskScore: 110 },
        { time: '18:00', detected: 8, reconciled: 5, riskScore: 140 },
        { time: '21:00', detected: 6, reconciled: 3, riskScore: 165 },
        { time: 'Now', detected: activeDrifts.length, reconciled: Math.max(0, 10 - activeDrifts.length), riskScore: prodEnv.riskPoints },
      ];

  // Category breakdown data: prioritize real backend category breakdown if available
  const categoryData = (backendMetrics?.drift_category_breakdown && backendMetrics.drift_category_breakdown.length > 0)
    ? backendMetrics.drift_category_breakdown.map((c) => ({
        name: c.category.toUpperCase().replace('_', ' '),
        drifts: c.count,
        risk: Math.round(c.percentage * 2),
      }))
    : [
        {
          name: 'Runtime Config',
          drifts: activeDrifts.filter((d) => d.category === 'runtime').length,
          risk: activeDrifts.filter((d) => d.category === 'runtime').reduce((acc, d) => acc + d.riskPoints, 0),
        },
        {
          name: 'Env Variables',
          drifts: activeDrifts.filter((d) => d.category === 'env_variable').length,
          risk: activeDrifts.filter((d) => d.category === 'env_variable').reduce((acc, d) => acc + d.riskPoints, 0),
        },
        {
          name: 'Infrastructure',
          drifts: activeDrifts.filter((d) => d.category === 'infrastructure').length,
          risk: activeDrifts.filter((d) => d.category === 'infrastructure').reduce((acc, d) => acc + d.riskPoints, 0),
        },
        {
          name: 'Secrets / KMS',
          drifts: activeDrifts.filter((d) => d.category === 'secret_metadata').length,
          risk: activeDrifts.filter((d) => d.category === 'secret_metadata').reduce((acc, d) => acc + d.riskPoints, 0),
        },
      ];

  // Flash sale mission-critical parameters
  const criticalParameters = [
    {
      key: 'PAYMENT_GATEWAY_URL',
      category: 'Runtime / Payment',
      expected: 'https://api.stripe.com/v1 (Production)',
      actual: String(selectedEnv.actual.runtime.apiUrl || 'https://sandbox.mock-payments.internal'),
      isDrifted: selectedEnv.actual.runtime.apiUrl !== selectedEnv.expected.runtime.apiUrl,
      impact: 'Checkouts fail with sandbox rejection at 60,000 req/sec',
      severity: 'CRITICAL',
    },
    {
      key: 'CLUSTER_REPLICAS',
      category: 'Infrastructure',
      expected: `${selectedEnv.expected.infrastructure.replicas} Pods`,
      actual: `${selectedEnv.actual.infrastructure.replicas} Pods`,
      isDrifted: selectedEnv.actual.infrastructure.replicas !== selectedEnv.expected.infrastructure.replicas,
      impact: 'CPU saturation and 504 gateway timeouts on surge load',
      severity: 'CRITICAL',
    },
    {
      key: 'MAX_DB_CONNECTIONS',
      category: 'Database Tier',
      expected: `${selectedEnv.expected.infrastructure.maxDbConnections} Connections`,
      actual: `${selectedEnv.actual.infrastructure.maxDbConnections} Connections`,
      isDrifted: selectedEnv.actual.infrastructure.maxDbConnections !== selectedEnv.expected.infrastructure.maxDbConnections,
      impact: 'PostgreSQL connection exhaustion leading to transaction rollbacks',
      severity: 'HIGH',
    },
    {
      key: 'READ_REPLICA_CLUSTER',
      category: 'Infrastructure',
      expected: selectedEnv.expected.infrastructure.readReplicaEnabled ? 'ENABLED (Multi-AZ)' : 'DISABLED',
      actual: selectedEnv.actual.infrastructure.readReplicaEnabled ? 'ENABLED (Multi-AZ)' : 'DISABLED (Single Node)',
      isDrifted: selectedEnv.actual.infrastructure.readReplicaEnabled !== selectedEnv.expected.infrastructure.readReplicaEnabled,
      impact: 'Read query lock contention on master node',
      severity: 'HIGH',
    },
  ];

  return (
    <div className="space-y-6">
      {/* 1. Google Operator Session & Flash Sale Mission Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-5 text-white shadow-md border border-slate-800">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="flex h-2.5 w-2.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
              </span>
              <span className="text-xs uppercase tracking-wider font-bold text-amber-400 flex items-center gap-1.5">
                <Flame className="w-4 h-4 text-amber-400" />
                Mission-Critical Flash Sale Dashboard
              </span>
              <span className="text-slate-500">|</span>
              <span className="text-xs text-slate-300 font-mono">Target: v2.4-flash-sale</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Executive Drift Command Center
            </h2>
            <p className="text-xs text-slate-300 mt-0.5">
              Continuous validation between GitOps declarative baselines and live running Kubernetes clusters.
            </p>
          </div>

          {/* User Profile Pill & Quick Reconcile */}
          <div className="flex flex-wrap items-center gap-3">
            {/* FastAPI Backend Live Status Indicator */}
            <div className="flex items-center gap-2 bg-slate-950/80 border border-slate-800 px-3 py-1.5 rounded-xl font-mono text-[11px] shadow-inner">
              <span className="flex h-2 w-2 relative">
                <span
                  className={`animate-ping absolute inline-flex h-full w-full rounded-full ${
                    backendHealth?.status === 'ok' ? 'bg-emerald-400' : 'bg-amber-400'
                  } opacity-75`}
                ></span>
                <span
                  className={`relative inline-flex rounded-full h-2 w-2 ${
                    backendHealth?.status === 'ok' ? 'bg-emerald-500' : 'bg-amber-500'
                  }`}
                ></span>
              </span>
              <span className="text-slate-200 font-semibold">
                {backendHealth
                  ? `FastAPI: ${backendHealth.status.toUpperCase()} (${backendHealth.database})`
                  : 'FastAPI: CONNECTING...'}
              </span>
              {backendLatency !== null && (
                <span className="text-indigo-400 hidden sm:inline">| {backendLatency}ms</span>
              )}
              <button
                onClick={loadBackendStatus}
                disabled={isSyncing}
                title="Synchronize backend metrics"
                className="ml-1 text-slate-400 hover:text-white transition-colors"
              >
                <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {currentUser ? (
              <div
                onClick={onOpenLoginModal}
                className="flex items-center gap-2.5 bg-white/10 hover:bg-white/15 px-3 py-1.5 rounded-xl border border-white/10 cursor-pointer transition-colors"
                title="Click to manage Google account & role"
              >
                <img
                  src={currentUser.avatar}
                  alt={currentUser.name}
                  className="w-7 h-7 rounded-full border border-indigo-400 object-cover"
                />
                <div className="text-left">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-white">{currentUser.name}</span>
                    <span className="text-[10px] bg-emerald-400/20 text-emerald-300 font-semibold px-1 rounded">
                      Google ID
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-300 block">{currentUser.email}</span>
                </div>
              </div>
            ) : (
              <button
                onClick={onOpenLoginModal}
                className="flex items-center gap-2 px-3 py-2 bg-white text-slate-900 text-xs font-bold rounded-xl shadow-xs hover:bg-slate-100 transition-colors"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>Sign In with Google</span>
              </button>
            )}

            {/* Quick Reconcile All */}
            {activeDrifts.length > 0 && (
              <button
                onClick={onReconcileAll}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-xs transition-all active:scale-95"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Reconcile Fleet ({activeDrifts.length})</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 2. Primary KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Gatekeeper Verdict */}
        <div
          onClick={onOpenGatekeeper}
          className={`p-4 rounded-xl border transition-all cursor-pointer hover:shadow-md ${
            isProdBlocked
              ? 'bg-rose-50/70 border-rose-200 text-rose-950'
              : 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Pre-Flight Gatekeeper
            </span>
            {isProdBlocked ? (
              <ShieldAlert className="w-5 h-5 text-rose-600" />
            ) : (
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
            )}
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span
              className={`text-2xl font-extrabold ${
                isProdBlocked ? 'text-rose-700' : 'text-emerald-700'
              }`}
            >
              {isProdBlocked ? 'BLOCKED 🛑' : 'READY ✅'}
            </span>
          </div>
          <p className="text-xs text-slate-600 mt-1">
            {isProdBlocked
              ? `${criticalCount} Critical & ${highCount} High drifts prevent safe deployment.`
              : 'All mission-critical parameters conform to GitOps baseline.'}
          </p>
          <div className="mt-3 flex items-center text-xs font-semibold text-indigo-600 hover:text-indigo-800 gap-1">
            <span>Review Gate Decision</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </div>
        </div>

        {/* Card 2: Health & Readiness Score */}
        <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Fleet Health Score
            </span>
            <Activity className="w-5 h-5 text-indigo-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-slate-900">
              {selectedEnv.healthScore}%
            </span>
            <span
              className={`text-xs font-semibold ${
                selectedEnv.healthScore < 70 ? 'text-rose-600' : 'text-emerald-600'
              }`}
            >
              {selectedEnv.healthScore < 70 ? '⚠️ High Risk' : '✨ Resilient'}
            </span>
          </div>
          {/* Progress bar */}
          <div className="w-full bg-slate-100 rounded-full h-2 mt-2 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                selectedEnv.healthScore > 80
                  ? 'bg-emerald-500'
                  : selectedEnv.healthScore > 50
                  ? 'bg-amber-500'
                  : 'bg-rose-500'
              }`}
              style={{ width: `${selectedEnv.healthScore}%` }}
            />
          </div>
          <p className="text-[11px] text-slate-500 mt-2">
            Readiness: <strong className="text-slate-800">{selectedEnv.readinessScore}%</strong> | Risk Points:{' '}
            <strong className="text-slate-800">{selectedEnv.riskPoints} pts</strong>
          </p>
        </div>

        {/* Card 3: Active Drift Breakdown */}
        <div
          onClick={() => onNavigateTab('comparison')}
          className="p-4 rounded-xl border border-slate-200 bg-white shadow-2xs hover:shadow-md cursor-pointer transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Active Drifts
            </span>
            <GitCompare className="w-5 h-5 text-amber-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-slate-900">{activeDrifts.length}</span>
            <span className="text-xs text-slate-500 font-medium">mismatches</span>
          </div>
          <div className="mt-2 flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-800">
              {criticalCount} Critical
            </span>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
              {highCount} High
            </span>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-800">
              {mediumCount} Med
            </span>
          </div>
          <div className="mt-3 flex items-center text-xs font-semibold text-indigo-600 hover:text-indigo-800 gap-1">
            <span>Side-by-Side Comparison</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </div>
        </div>

        {/* Card 4: Flash Sale Benchmark Readiness */}
        <div
          onClick={() => onNavigateTab('benchmark')}
          className="p-4 rounded-xl border border-slate-200 bg-white shadow-2xs hover:shadow-md cursor-pointer transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              60k req/s Benchmark
            </span>
            <Zap className="w-5 h-5 text-indigo-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-slate-900">
              {criticalCount > 0 ? '94.2% Error' : '0.02% Error'}
            </span>
          </div>
          <p className="text-xs text-slate-600 mt-1">
            {criticalCount > 0
              ? 'Projected $2.45M checkout failure revenue loss under current drift.'
              : 'Benchmark passes with 38ms p99 latency under reconciled state.'}
          </p>
          <div className="mt-3 flex items-center text-xs font-semibold text-indigo-600 hover:text-indigo-800 gap-1">
            <span>Run Load Simulator</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </div>
        </div>
      </div>

      {/* 3. Analytics Charts Section (Recharts) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: 24h Drift Detection & Reconcile Velocity */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-5 shadow-2xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Activity className="w-4 h-4 text-indigo-600" />
                24-Hour Drift Velocity & Detection Trend
              </h3>
              <p className="text-xs text-slate-500">
                Continuous background scanning comparing GitOps repository revisions with live cluster nodes
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1 text-slate-600">
                <span className="h-2.5 w-2.5 rounded-full bg-rose-500"></span>
                Drifts Detected
              </span>
              <span className="flex items-center gap-1 text-slate-600">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
                Reconciled
              </span>
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorDetected" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorReconciled" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="time" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderRadius: '8px',
                    color: '#fff',
                    fontSize: '12px',
                    border: 'none',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="detected"
                  stroke="#f43f5e"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorDetected)"
                  name="Drifts Detected"
                />
                <Area
                  type="monotone"
                  dataKey="reconciled"
                  stroke="#10b981"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorReconciled)"
                  name="Reconciled"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right 1 Col: Severity Breakdown by Domain */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 mb-1 flex items-center gap-2">
              <Cpu className="w-4 h-4 text-indigo-600" />
              Risk Points by Domain
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Weighted penalty points allocated per infrastructure category
            </p>

            <div className="h-52 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categoryData} layout="vertical" margin={{ top: 5, right: 10, left: 15, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                  <XAxis type="number" tick={{ fontSize: 10, fill: '#64748b' }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} width={90} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderRadius: '8px',
                      color: '#fff',
                      fontSize: '12px',
                    }}
                  />
                  <Bar dataKey="risk" fill="#6366f1" radius={[0, 4, 4, 0]} name="Risk Penalty Pts" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Total Risk Weight:</span>
            <strong className="text-slate-900 font-bold">{selectedEnv.riskPoints} pts</strong>
          </div>
        </div>
      </div>

      {/* 4. Flash Sale Mission-Critical Parameters Verification Matrix */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-rose-500"></span>
              <h3 className="text-sm font-bold text-slate-900">
                Flash-Sale Critical Parameters (Live vs GitOps)
              </h3>
            </div>
            <p className="text-xs text-slate-500">
              High-consequence settings verified against the deployment gatekeeper rule engine
            </p>
          </div>

          <button
            onClick={() => onNavigateTab('comparison')}
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
          >
            <span>View All 142 Parameters in Side-by-Side View</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-bold">
                <th className="py-2.5 px-3">Parameter Key</th>
                <th className="py-2.5 px-3">Domain</th>
                <th className="py-2.5 px-3 text-emerald-800">Expected (GitOps Baseline ✅)</th>
                <th className="py-2.5 px-3 text-rose-800">Actual (Live Running ❌)</th>
                <th className="py-2.5 px-3">Flash-Sale Impact</th>
                <th className="py-2.5 px-3 text-right">Remediation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {criticalParameters.map((param) => {
                const correspondingDrift = activeDrifts.find(
                  (d) => d.key.toLowerCase() === param.key.toLowerCase()
                );

                return (
                  <tr key={param.key} className={param.isDrifted ? 'bg-rose-50/30' : 'bg-white'}>
                    <td className="py-3 px-3 font-mono font-bold text-slate-900 flex items-center gap-1.5">
                      {param.isDrifted ? (
                        <span className="text-rose-500 font-bold">❌</span>
                      ) : (
                        <span className="text-emerald-500 font-bold">✅</span>
                      )}
                      <span>{param.key}</span>
                    </td>
                    <td className="py-3 px-3 text-slate-600">{param.category}</td>
                    <td className="py-3 px-3 font-mono text-emerald-700 font-semibold">
                      {param.expected}
                    </td>
                    <td
                      className={`py-3 px-3 font-mono font-semibold ${
                        param.isDrifted ? 'text-rose-600' : 'text-slate-700'
                      }`}
                    >
                      {param.actual}
                    </td>
                    <td className="py-3 px-3 text-slate-500 max-w-xs">{param.impact}</td>
                    <td className="py-3 px-3 text-right">
                      {param.isDrifted && correspondingDrift ? (
                        <button
                          onClick={() => onReconcileSingle(correspondingDrift)}
                          className="px-2.5 py-1 text-[11px] font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors shadow-2xs"
                        >
                          Sync Baseline
                        </button>
                      ) : param.isDrifted ? (
                        <button
                          onClick={onReconcileAll}
                          className="px-2.5 py-1 text-[11px] font-bold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-colors"
                        >
                          Fix in Overview
                        </button>
                      ) : (
                        <span className="text-emerald-600 font-bold flex items-center justify-end gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Synced</span>
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. Environment Fleet Health Cards */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Server className="w-4 h-4 text-indigo-600" />
            <span>Multi-Environment Fleet Clusters</span>
          </h3>
          <span className="text-xs text-slate-500">
            Active target: <strong className="text-slate-900">{selectedEnv.displayName}</strong>
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {environments.map((env) => {
            const isCurrent = env.id === selectedEnv.id;
            const isBlocked = env.status === 'BLOCKED' || env.deploymentStatus === 'BLOCKED';

            return (
              <div
                key={env.id}
                onClick={() => onSelectEnv(env.name)}
                className={`p-4 rounded-xl border transition-all cursor-pointer ${
                  isCurrent
                    ? 'border-indigo-600 ring-2 ring-indigo-500/20 bg-white shadow-md'
                    : 'border-slate-200 bg-white hover:border-slate-300 shadow-2xs'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`h-2.5 w-2.5 rounded-full ${
                        isBlocked ? 'bg-rose-500 animate-pulse' : 'bg-emerald-500'
                      }`}
                    />
                    <h4 className="font-bold text-slate-900 text-sm">{env.displayName}</h4>
                  </div>
                  <span
                    className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                      isBlocked ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'
                    }`}
                  >
                    {isBlocked ? 'BLOCKED' : 'APPROVED'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 my-3 text-xs bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                  <div>
                    <span className="text-slate-400 block text-[10px]">Health Score</span>
                    <strong className="text-slate-800 font-bold text-sm">
                      {env.healthScore}%
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Risk Points</span>
                    <strong
                      className={`font-bold text-sm ${
                        env.riskPoints > 30 ? 'text-rose-600' : 'text-slate-800'
                      }`}
                    >
                      {env.riskPoints} pts
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Replicas</span>
                    <strong className="text-slate-800 font-semibold">
                      {env.actual.infrastructure.replicas} / {env.expected.infrastructure.replicas}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Version</span>
                    <strong className="text-slate-800 font-mono">v{env.configVersion}</strong>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs pt-1">
                  <span className="text-indigo-600 font-semibold">
                    {isCurrent ? '● Active in Dashboard' : 'Select Cluster →'}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectEnv(env.name);
                      onNavigateTab('comparison');
                    }}
                    className="text-slate-500 hover:text-slate-800 underline text-[11px]"
                  >
                    Compare Diff
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 6. Quick Action Launcher & Real-Time Audit Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Action Launcher */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs">
          <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-600" />
            <span>SRE Operational Quick Actions</span>
          </h3>

          <div className="space-y-2.5">
            <button
              onClick={() => onNavigateTab('comparison')}
              className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-indigo-50 hover:border-indigo-200 text-slate-800 text-xs font-semibold transition-all text-left"
            >
              <div className="flex items-center gap-2.5">
                <GitCompare className="w-4 h-4 text-indigo-600" />
                <div>
                  <span className="block text-slate-900">Side-by-Side Comparison</span>
                  <span className="text-[10px] text-slate-500 font-normal">
                    Inspect all 142 keys with 1-click reconcile
                  </span>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </button>

            <button
              onClick={() => onNavigateTab('versions')}
              className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-indigo-50 hover:border-indigo-200 text-slate-800 text-xs font-semibold transition-all text-left"
            >
              <div className="flex items-center gap-2.5">
                <SlidersHorizontal className="w-4 h-4 text-indigo-600" />
                <div>
                  <span className="block text-slate-900">Emergency Rollback Engine</span>
                  <span className="text-[10px] text-slate-500 font-normal">
                    Instant revert to safe snapshot v9
                  </span>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </button>

            <button
              onClick={onOpenSimulator}
              className="w-full flex items-center justify-between p-3 rounded-xl border border-amber-200 bg-amber-50/60 hover:bg-amber-100 text-amber-900 text-xs font-semibold transition-all text-left"
            >
              <div className="flex items-center gap-2.5">
                <Flame className="w-4 h-4 text-amber-600" />
                <div>
                  <span className="block text-amber-950 font-bold">Inject 8 Failure Scenarios</span>
                  <span className="text-[10px] text-amber-800 font-normal">
                    Simulate wrong secrets, payment url drift & test gatekeeper
                  </span>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-amber-600" />
            </button>

            <button
              onClick={() => onNavigateTab('benchmark')}
              className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-indigo-50 hover:border-indigo-200 text-slate-800 text-xs font-semibold transition-all text-left"
            >
              <div className="flex items-center gap-2.5">
                <Activity className="w-4 h-4 text-indigo-600" />
                <div>
                  <span className="block text-slate-900">60,000 req/s Stress Benchmark</span>
                  <span className="text-[10px] text-slate-500 font-normal">
                    Real-time error rate & latency projection
                  </span>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </button>
          </div>
        </div>

        {/* Real-Time Immutable Audit Stream */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-5 shadow-2xs">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-indigo-600" />
              <span>Real-Time Audit Ledger Stream</span>
            </h3>
            <button
              onClick={() => onNavigateTab('audit')}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
            >
              View Full Ledger →
            </button>
          </div>

          <div className="space-y-2.5">
            {auditLogs.slice(0, 4).map((log) => (
              <div
                key={log.id}
                className="p-2.5 rounded-lg border border-slate-100 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-slate-900 uppercase">
                      {log.action}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                        log.decision === 'BLOCKED'
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {log.decision || 'LOG'}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {log.environmentName}
                    </span>
                  </div>
                  <p className="text-slate-600 text-[11px] mt-0.5 line-clamp-1">{log.details}</p>
                </div>
                <div className="text-[10px] text-slate-400 sm:text-right whitespace-nowrap">
                  <div>{log.user}</div>
                  <div>{new Date(log.timestamp).toLocaleTimeString()}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
