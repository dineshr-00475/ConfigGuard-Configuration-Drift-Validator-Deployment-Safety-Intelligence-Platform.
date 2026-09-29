import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Save,
  Edit3,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  ShieldCheck,
  RotateCcw,
  Zap,
  Flame,
  Info,
  Server,
  Database,
  Cpu,
  RefreshCw,
} from 'lucide-react';
import { EnvironmentState, DriftRecord } from '../types';
import { detectDrifts, calculateRiskScore } from '../services/driftEngine';

interface ConfigEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  environment: EnvironmentState;
  onSaveConfig: (updatedEnv: EnvironmentState) => void;
}

export const ConfigEditorModal: React.FC<ConfigEditorModalProps> = ({
  isOpen,
  onClose,
  environment,
  onSaveConfig,
}) => {
  const [activeTab, setActiveTab] = useState<'infrastructure' | 'envVars' | 'runtime'>('infrastructure');
  const [infraActual, setInfraActual] = useState({ ...environment.actual.infrastructure });
  const [envVarsActual, setEnvVarsActual] = useState({ ...environment.actual.envVars });
  const [runtimeActual, setRuntimeActual] = useState({ ...environment.actual.runtime });

  // Synchronize state whenever environment or modal open status changes
  useEffect(() => {
    if (environment && isOpen) {
      setInfraActual({ ...environment.actual.infrastructure });
      setEnvVarsActual({ ...environment.actual.envVars });
      setRuntimeActual({ ...environment.actual.runtime });
    }
  }, [environment, isOpen]);

  // Construct hypothetical environment to calculate real-time drift impact
  const simulatedEnv: EnvironmentState = useMemo(() => {
    return {
      ...environment,
      actual: {
        ...environment.actual,
        infrastructure: infraActual,
        envVars: envVarsActual,
        runtime: runtimeActual,
      },
    };
  }, [environment, infraActual, envVarsActual, runtimeActual]);

  const simulatedDrifts: DriftRecord[] = useMemo(() => {
    return detectDrifts(simulatedEnv);
  }, [simulatedEnv]);

  const simulatedRisk = useMemo(() => {
    return calculateRiskScore(simulatedDrifts);
  }, [simulatedDrifts]);

  const criticalDriftsCount = simulatedDrifts.filter((d) => d.severity === 'CRITICAL').length;
  const isSimulatedBlocked = criticalDriftsCount > 0 || simulatedRisk.totalPoints > 30;

  if (!isOpen) return null;

  // Preset Handlers
  const handleApplyPreset = (presetName: string) => {
    switch (presetName) {
      case 'severe_scaledown':
        setInfraActual((prev) => ({ ...prev, replicas: 4 }));
        setActiveTab('infrastructure');
        break;
      case 'db_exhaustion':
        setInfraActual((prev) => ({ ...prev, maxDbConnections: 200 }));
        setActiveTab('infrastructure');
        break;
      case 'sandbox_leak':
        setRuntimeActual((prev) => ({
          ...prev,
          paymentMode: 'sandbox',
          apiUrl: 'https://sandbox.api.stripe-gateway.internal/v1',
        }));
        setEnvVarsActual((prev) => ({
          ...prev,
          PAYMENT_GATEWAY_URL: 'https://sandbox.api.stripe-gateway.internal/v1',
          PAYMENT_MODE: 'TEST',
        }));
        setActiveTab('runtime');
        break;
      case 'disable_limiter':
        setRuntimeActual((prev) => ({ ...prev, rateLimiterEnabled: false }));
        setEnvVarsActual((prev) => ({ ...prev, FLASH_SALE_RATE_LIMITER_ENABLED: 'false' }));
        setActiveTab('runtime');
        break;
      case 'reset_baseline':
        setInfraActual({ ...environment.expected.infrastructure });
        setEnvVarsActual({ ...environment.expected.envVars });
        setRuntimeActual({ ...environment.expected.runtime });
        break;
      default:
        break;
    }
  };

  const handleSave = () => {
    const updated: EnvironmentState = {
      ...simulatedEnv,
      configVersion: environment.configVersion + 1,
      riskPoints: simulatedRisk.totalPoints,
      healthScore: Math.max(0, 100 - simulatedRisk.totalPoints),
      readinessScore: Math.max(0, 100 - simulatedRisk.totalPoints),
      status: isSimulatedBlocked ? 'BLOCKED' : simulatedDrifts.length > 0 ? 'DRIFT_DETECTED' : 'HEALTHY',
      deploymentStatus: isSimulatedBlocked
        ? 'BLOCKED'
        : simulatedDrifts.length > 0
        ? 'MANUAL_REVIEW'
        : 'APPROVED',
      lastValidationTime: new Date().toISOString(),
    };
    onSaveConfig(updated);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs">
      <div className="bg-white text-slate-900 rounded-2xl shadow-2xl border border-slate-200 max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-600 text-white shadow-xs">
              <Edit3 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900">
                  Live Configuration Sandbox ({environment.displayName})
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-indigo-100 text-indigo-700">
                  Target: v2.4-flash-sale
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Simulate Kubernetes and container parameter overrides to observe pre-deployment Gatekeeper reactivity.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Simulation Injection Presets Bar */}
        <div className="px-6 py-2.5 bg-indigo-50/60 border-b border-indigo-100 flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-bold text-indigo-900 flex items-center gap-1">
            <Zap className="w-3.5 h-3.5 text-amber-500" />
            Quick Presets:
          </span>
          <button
            type="button"
            onClick={() => handleApplyPreset('severe_scaledown')}
            className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-white border border-rose-200 text-rose-700 hover:bg-rose-50 transition-colors"
          >
            🔥 Scaledown: 4 Pods
          </button>
          <button
            type="button"
            onClick={() => handleApplyPreset('db_exhaustion')}
            className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-white border border-amber-200 text-amber-800 hover:bg-amber-50 transition-colors"
          >
            ⚡ DB Pool: 200 Conns
          </button>
          <button
            type="button"
            onClick={() => handleApplyPreset('sandbox_leak')}
            className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-white border border-purple-200 text-purple-700 hover:bg-purple-50 transition-colors"
          >
            💳 Sandbox Payment Leak
          </button>
          <button
            type="button"
            onClick={() => handleApplyPreset('disable_limiter')}
            className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 transition-colors"
          >
            🛡️ Disable Bot Limiter
          </button>
          <button
            type="button"
            onClick={() => handleApplyPreset('reset_baseline')}
            className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-100 border border-emerald-300 text-emerald-800 hover:bg-emerald-200 transition-colors flex items-center gap-1 ml-auto"
          >
            <RotateCcw className="w-3 h-3" />
            Reset to GitOps Baseline
          </button>
        </div>

        {/* Tabs */}
        <div className="px-6 pt-3 border-b border-slate-200 flex gap-4 bg-white">
          {(['infrastructure', 'envVars', 'runtime'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-3 px-2 text-xs font-bold capitalize border-b-2 transition-colors flex items-center gap-1.5 ${
                activeTab === tab
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              {tab === 'infrastructure' && <Server className="w-3.5 h-3.5" />}
              {tab === 'envVars' && <Cpu className="w-3.5 h-3.5" />}
              {tab === 'runtime' && <Database className="w-3.5 h-3.5" />}
              <span>{tab === 'envVars' ? 'Environment Variables' : tab}</span>
            </button>
          ))}
        </div>

        {/* Tab Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-slate-900 text-xs max-h-[50vh]">
          {activeTab === 'infrastructure' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Pod Replicas Input */}
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-slate-800 font-bold">Live Pod Replicas</label>
                    <span className="text-[11px] font-mono text-slate-500">
                      Baseline: <strong className="text-slate-800">{environment.expected.infrastructure.replicas}</strong>
                    </span>
                  </div>
                  <input
                    type="number"
                    min="1"
                    max="128"
                    value={infraActual.replicas}
                    onChange={(e) =>
                      setInfraActual({ ...infraActual, replicas: parseInt(e.target.value, 10) || 0 })
                    }
                    className="w-full bg-white text-slate-900 border border-slate-300 rounded-lg px-3 py-2 font-mono text-sm font-semibold focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                  <div className="mt-2 text-[11px]">
                    {infraActual.replicas === environment.expected.infrastructure.replicas ? (
                      <span className="text-emerald-700 font-semibold flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Matches GitOps target (16 pods)
                      </span>
                    ) : infraActual.replicas < environment.expected.infrastructure.replicas ? (
                      <span className="text-rose-700 font-bold flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3 text-rose-600" /> Underprovisioned by{' '}
                        {environment.expected.infrastructure.replicas - infraActual.replicas} pods (Outage Hazard)
                      </span>
                    ) : (
                      <span className="text-amber-700 font-medium">Overprovisioned (+{infraActual.replicas - environment.expected.infrastructure.replicas} pods)</span>
                    )}
                  </div>
                </div>

                {/* Max DB Pool Connections */}
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-slate-800 font-bold">Max DB Pool Limit</label>
                    <span className="text-[11px] font-mono text-slate-500">
                      Baseline: <strong className="text-slate-800">{environment.expected.infrastructure.maxDbConnections}</strong>
                    </span>
                  </div>
                  <input
                    type="number"
                    min="50"
                    max="5000"
                    step="50"
                    value={infraActual.maxDbConnections}
                    onChange={(e) =>
                      setInfraActual({
                        ...infraActual,
                        maxDbConnections: parseInt(e.target.value, 10) || 0,
                      })
                    }
                    className="w-full bg-white text-slate-900 border border-slate-300 rounded-lg px-3 py-2 font-mono text-sm font-semibold focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                  <div className="mt-2 text-[11px]">
                    {infraActual.maxDbConnections === environment.expected.infrastructure.maxDbConnections ? (
                      <span className="text-emerald-700 font-semibold flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Matches IaC capacity (1200 connections)
                      </span>
                    ) : (
                      <span className="text-rose-700 font-bold flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3 text-rose-600" /> Drift from IaC baseline (Expected: 1200, Actual: {infraActual.maxDbConnections})
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Read Replica Toggle */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-slate-800 font-bold">Multi-AZ Database Read Replica Cluster</label>
                  <span className="text-[11px] font-mono text-slate-500">
                    Baseline: <strong className="text-slate-800">{String(environment.expected.infrastructure.readReplicaEnabled)}</strong>
                  </span>
                </div>
                <select
                  value={String(infraActual.readReplicaEnabled)}
                  onChange={(e) =>
                    setInfraActual({
                      ...infraActual,
                      readReplicaEnabled: e.target.value === 'true',
                    })
                  }
                  className="w-full bg-white text-slate-900 border border-slate-300 rounded-lg px-3 py-2 font-semibold focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="true">true (Enabled - Multi-AZ Cluster Active)</option>
                  <option value="false">false (Disabled - Single Primary Bottleneck Hazard)</option>
                </select>
                <p className="mt-1.5 text-[11px] text-slate-500">
                  Disabling read replicas forces all catalogue browsing queries onto the master node during flash-sale bursts.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'envVars' && (
            <div className="space-y-3">
              <p className="text-[11px] text-slate-500 mb-2">
                Override active container environment variables. Inconsistencies are flagged instantly by the Drift Engine.
              </p>
              {Object.keys(envVarsActual).map((key) => {
                const expVal = environment.expected.envVars[key];
                const actVal = envVarsActual[key];
                const isDrifted = expVal !== undefined && actVal !== expVal;
                return (
                  <div
                    key={key}
                    className={`p-3 rounded-xl border transition-colors ${
                      isDrifted ? 'bg-amber-50/70 border-amber-300' : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="font-mono font-bold text-slate-900 text-xs flex items-center gap-1.5">
                        {key}
                        {isDrifted && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-sans font-bold bg-amber-200 text-amber-900">
                            Drifted
                          </span>
                        )}
                      </label>
                      <span className="text-[11px] text-slate-500 font-mono">
                        Expected: <span className="text-slate-800 font-bold">{expVal ?? '<none>'}</span>
                      </span>
                    </div>
                    <input
                      type="text"
                      value={actVal ?? ''}
                      onChange={(e) =>
                        setEnvVarsActual({ ...envVarsActual, [key]: e.target.value })
                      }
                      className="w-full bg-white text-slate-900 border border-slate-300 rounded-lg px-3 py-2 font-mono text-xs focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                );
              })}
            </div>
          )}

          {activeTab === 'runtime' && (
            <div className="space-y-4">
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-slate-800 font-bold">Payment Gateway Mode</label>
                  <span className="text-[11px] font-mono text-slate-500">
                    Baseline: <strong className="text-slate-800">{environment.expected.runtime.paymentMode}</strong>
                  </span>
                </div>
                <select
                  value={runtimeActual.paymentMode}
                  onChange={(e) =>
                    setRuntimeActual({
                      ...runtimeActual,
                      paymentMode: e.target.value as any,
                    })
                  }
                  className="w-full bg-white text-slate-900 border border-slate-300 rounded-lg px-3 py-2 font-mono font-semibold focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="production">production (Live Stripe/Mastercard Integration)</option>
                  <option value="sandbox">sandbox (Staging Sandbox - CRITICAL OUTAGE RISK)</option>
                  <option value="mock">mock (Mock dummy)</option>
                </select>
                {runtimeActual.paymentMode !== 'production' && (
                  <p className="mt-2 text-[11px] text-rose-700 font-bold flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                    CRITICAL: Test/Sandbox mode in production causes 100% real payment failures during flash sale!
                  </p>
                )}
              </div>

              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-slate-800 font-bold">Flash Sale Bot Rate Limiter</label>
                  <span className="text-[11px] font-mono text-slate-500">
                    Baseline: <strong className="text-slate-800">{String(environment.expected.runtime.rateLimiterEnabled)}</strong>
                  </span>
                </div>
                <select
                  value={String(runtimeActual.rateLimiterEnabled)}
                  onChange={(e) =>
                    setRuntimeActual({
                      ...runtimeActual,
                      rateLimiterEnabled: e.target.value === 'true',
                    })
                  }
                  className="w-full bg-white text-slate-900 border border-slate-300 rounded-lg px-3 py-2 font-semibold focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="true">Enabled (Token bucket active at 500 req/sec/IP)</option>
                  <option value="false">Disabled (Vulnerable to bot scalper scripts)</option>
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Real-time Simulated Gatekeeper Feedback Bar */}
        <div
          className={`px-6 py-3 border-t flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
            isSimulatedBlocked
              ? 'bg-rose-50 border-rose-200 text-rose-950'
              : simulatedDrifts.length > 0
              ? 'bg-amber-50 border-amber-200 text-amber-950'
              : 'bg-emerald-50 border-emerald-200 text-emerald-950'
          }`}
        >
          <div className="flex items-center gap-3">
            {isSimulatedBlocked ? (
              <ShieldAlert className="w-6 h-6 text-rose-600 shrink-0" />
            ) : simulatedDrifts.length > 0 ? (
              <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0" />
            ) : (
              <ShieldCheck className="w-6 h-6 text-emerald-600 shrink-0" />
            )}
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-extrabold uppercase tracking-wide">
                  Simulated Gatekeeper Verdict:
                </span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                    isSimulatedBlocked
                      ? 'bg-rose-200 text-rose-900'
                      : simulatedDrifts.length > 0
                      ? 'bg-amber-200 text-amber-900'
                      : 'bg-emerald-200 text-emerald-900'
                  }`}
                >
                  {isSimulatedBlocked
                    ? 'GATE: BLOCKED'
                    : simulatedDrifts.length > 0
                    ? 'GATE: MANUAL REVIEW'
                    : 'GATE: APPROVED'}
                </span>
              </div>
              <p className="text-[11px] text-slate-600 mt-0.5">
                {simulatedDrifts.length === 0
                  ? 'All parameters aligned with declarative baseline. 100% deployment safe.'
                  : `${simulatedDrifts.length} drift(s) detected • ${criticalDriftsCount} Critical • Risk Score: ${simulatedRisk.totalPoints} pts`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md hover:shadow-lg transition-all active:scale-95"
            >
              <Save className="w-4 h-4" />
              <span>Apply Changes & Re-Scan</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
