import React, { useState, useEffect, useCallback } from 'react';
import {
  Play,
  RotateCcw,
  CheckCircle2,
  ShieldAlert,
  ArrowRight,
  Lock,
  Sparkles,
  FileCheck2,
} from 'lucide-react';
import {
  fetchGuidedDemoState,
  executeGuidedDemoStep,
  resetGuidedDemo,
} from '../services/apiClient';

interface GuidedDemoViewProps {
  showToast?: (msg: string, type?: 'success' | 'warning' | 'error' | 'info') => void;
}

const DEMO_STEPS = [
  {
    step: 1,
    title: 'Select Production',
    description: 'Initialize an isolated sandbox clone of Production baseline (v10).',
  },
  {
    step: 2,
    title: 'Inject Controlled Mismatch',
    description: 'Inject PAYMENT_MODE=TEST, max_connections=200, and expired STRIPE_API_SECRET.',
  },
  {
    step: 3,
    title: 'Run Validation',
    description: 'Execute multi-layer configuration drift sensor against sandbox state.',
  },
  {
    step: 4,
    title: 'Display Detected Drift',
    description: 'Inspect the 3 detected mismatches across Env Vars, Infra, and KMS Secrets.',
  },
  {
    step: 5,
    title: 'Explain Risk Calculation',
    description: 'Review weighted formula R = min(100, sum(w_i * c_i)) yielding 100/100 Risk.',
  },
  {
    step: 6,
    title: 'Show Deployment Block',
    description: 'Verify Gatekeeper BLOCKED verdict halting pipeline progression.',
  },
  {
    step: 7,
    title: 'Apply Safe Correction',
    description: 'Reconcile sandbox parameters back to declared GitOps golden baseline.',
  },
  {
    step: 8,
    title: 'Revalidate',
    description: 'Re-run drift sensor and verify SHA-256 fingerprint synchronization.',
  },
  {
    step: 9,
    title: 'Show Updated Decision',
    description: 'Confirm Gatekeeper transitions from BLOCKED to APPROVED (100% Readiness).',
  },
  {
    step: 10,
    title: 'Display Audit History',
    description: 'Review complete cryptographic audit trail of the 10-step safety lifecycle.',
  },
];

export function GuidedDemoView({ showToast }: GuidedDemoViewProps) {
  const [demoState, setDemoState] = useState<any | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [runningStep, setRunningStep] = useState<boolean>(false);

  const loadState = useCallback(async () => {
    setLoading(true);
    const st = await fetchGuidedDemoState();
    setDemoState(st);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadState();
  }, [loadState]);

  const handleStep = async (stepNumber: number) => {
    setRunningStep(true);
    const updated = await executeGuidedDemoStep(stepNumber);
    setRunningStep(false);
    if (updated) {
      setDemoState(updated);
      const stepMeta = DEMO_STEPS.find((s) => s.step === stepNumber);
      showToast?.(`Guided Demo Step ${stepNumber}: ${stepMeta?.title} completed.`, 'info');
    }
  };

  const handleReset = async () => {
    setRunningStep(true);
    const reset = await resetGuidedDemo();
    setRunningStep(false);
    if (reset) {
      setDemoState(reset);
      showToast?.('Guided Demo Sandbox reset to Step 1.', 'success');
    }
  };

  const currentStep: number = demoState?.current_step || 1;
  const drifts: any[] = demoState?.drifts || [];
  const risk = demoState?.risk_calculation || {};
  const audits: any[] = demoState?.audit_history || [];

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <Sparkles className="w-5 h-5 text-indigo-400" />
            <h1 className="text-xl font-semibold text-white tracking-tight">
              Guided Deployment Safety Demonstration (10-Step Walkthrough)
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Interactive reviewer walkthrough executing in an isolated sandbox replica (
            <code className="text-indigo-300 font-mono">production-demo-sandbox</code>). Real
            Production database records are strictly untouched.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleReset}
            disabled={runningStep}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 flex items-center gap-1.5 whitespace-nowrap"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Demo</span>
          </button>

          <button
            onClick={() => handleStep(currentStep < 10 ? currentStep + 1 : 1)}
            disabled={runningStep}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-2 whitespace-nowrap"
          >
            <Play className="w-3.5 h-3.5" />
            <span>
              {currentStep < 10
                ? `Execute Next Step (${currentStep + 1}/10)`
                : 'Restart from Step 1'}
            </span>
          </button>
        </div>
      </div>

      {/* Isolation Verification Guarantee Banner */}
      <div className="bg-emerald-950/30 border border-emerald-800/60 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2 text-emerald-300">
          <Lock className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>
            <strong>Sandbox Isolation Verified:</strong> Operating on{' '}
            <code className="font-mono">{demoState?.environment || 'production-demo-sandbox'}</code>{' '}
            (Session: <code className="font-mono">{demoState?.session_id || 'DEMO-ACTIVE'}</code>).
            Real Production configuration remains 100% unmodified.
          </span>
        </div>
        <span className="font-mono text-slate-400">
          Step {currentStep} of 10 · Config v{demoState?.config_version || 10}
        </span>
      </div>

      {/* 10-Step Interactive Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {DEMO_STEPS.map((s) => {
          const isCurrent = s.step === currentStep;
          const isCompleted = s.step < currentStep;
          return (
            <button
              key={s.step}
              onClick={() => handleStep(s.step)}
              disabled={runningStep}
              className={`text-left p-3.5 rounded-xl border transition-all flex flex-col justify-between min-h-[110px] ${
                isCurrent
                  ? 'bg-indigo-950/60 border-indigo-500 text-white'
                  : isCompleted
                  ? 'bg-slate-900/90 border-emerald-800/60 text-slate-200'
                  : 'bg-slate-900/50 border-slate-800 text-slate-400 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono text-indigo-400 font-semibold">
                  Step {String(s.step).padStart(2, '0')}
                </span>
                {isCompleted ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                ) : isCurrent ? (
                  <ArrowRight className="w-3.5 h-3.5 text-indigo-400" />
                ) : null}
              </div>
              <div className="my-1.5">
                <div className="text-xs font-semibold text-white leading-snug">{s.title}</div>
                <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">{s.description}</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Live Step Stage Workspace */}
      {loading ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center text-xs text-slate-400 animate-pulse">
          Initializing isolated demo sandbox...
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left 2 Columns: Step Output & Drift / Risk Evidence */}
          <div className="lg:col-span-2 space-y-6">
            {/* Active Step Explanation Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div>
                  <span className="text-xs font-mono text-indigo-400">
                    ACTIVE STEP 0{currentStep}
                  </span>
                  <h2 className="text-base font-semibold text-white mt-0.5">
                    {DEMO_STEPS[currentStep - 1]?.title}
                  </h2>
                </div>
                <div className="text-right font-mono text-xs">
                  <div
                    className={
                      risk.decision === 'BLOCKED'
                        ? 'text-rose-400 font-semibold'
                        : 'text-emerald-400 font-semibold'
                    }
                  >
                    Gatekeeper: {risk.decision || 'APPROVED'}
                  </div>
                  <div className="text-slate-400 tabular-nums">
                    Readiness: {risk.readiness_score ?? 100}% · Risk: {risk.capped_risk_score ?? 0}
                    /100
                  </div>
                </div>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">
                {risk.decision_reason}
              </p>

              {/* Fingerprint comparison */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-950/70 border border-slate-800 rounded-xl p-3.5 text-xs font-mono">
                <div>
                  <span className="text-slate-500 block font-sans">
                    Declared GitOps Fingerprint (SHA-256)
                  </span>
                  <span className="text-emerald-400">{demoState?.expected_fingerprint}</span>
                </div>
                <div>
                  <span className="text-slate-500 block font-sans">
                    Live Sandbox Fingerprint (SHA-256)
                  </span>
                  <span
                    className={
                      demoState?.fingerprint_match ? 'text-emerald-400' : 'text-rose-400'
                    }
                  >
                    {demoState?.actual_fingerprint}{' '}
                    {demoState?.fingerprint_match ? '(MATCH)' : '(MISMATCH)'}
                  </span>
                </div>
              </div>
            </div>

            {/* Detected Drifts Table (Steps 2-6 highlight, Steps 7-10 show zero drift) */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
              <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                <h3 className="text-xs font-semibold text-white flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-indigo-400" />
                  <span>Detected Configuration Drifts in Sandbox ({drifts.length})</span>
                </h3>
                <span className="text-xs font-mono text-slate-400">
                  {drifts.length === 0 ? 'All Layers Synchronized' : 'Action Required'}
                </span>
              </div>

              {drifts.length === 0 ? (
                <div className="p-6 text-center space-y-1">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 mx-auto" />
                  <div className="text-xs font-semibold text-white">
                    Zero Configuration Drift Detected
                  </div>
                  <p className="text-xs text-slate-400">
                    All Infrastructure, Environment Variable, and KMS Secret parameters match the
                    declared Production baseline.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 bg-slate-950/50">
                        <th className="py-2.5 px-4 font-medium">Key</th>
                        <th className="py-2.5 px-4 font-medium">Category</th>
                        <th className="py-2.5 px-4 font-medium">Expected</th>
                        <th className="py-2.5 px-4 font-medium">Actual</th>
                        <th className="py-2.5 px-4 font-medium">Severity</th>
                        <th className="py-2.5 px-4 font-medium text-right">Risk Pts</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/70 font-mono tabular-nums">
                      {drifts.map((d) => (
                        <tr key={d.id}>
                          <td className="py-3 px-4 text-white font-semibold">{d.key}</td>
                          <td className="py-3 px-4 text-slate-400">{d.category}</td>
                          <td className="py-3 px-4 text-emerald-400">{d.expected_value}</td>
                          <td className="py-3 px-4 text-rose-400">{d.actual_value}</td>
                          <td className="py-3 px-4">
                            <span
                              className={
                                d.severity === 'CRITICAL'
                                  ? 'text-rose-400 font-semibold'
                                  : 'text-amber-400 font-semibold'
                              }
                            >
                              {d.severity}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right text-slate-200">+{d.risk_points}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Mathematical Risk Calculation Breakdown (Step 5 Focus) */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-white">
                  Risk Scoring Mathematical Formulation
                </h3>
                <code className="text-[11px] font-mono text-indigo-300">{risk.formula}</code>
              </div>
              <div className="grid grid-cols-3 gap-3 text-xs font-mono tabular-nums bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                <div>
                  <span className="text-slate-500 block font-sans">Raw Risk Sum</span>
                  <span className="text-white font-semibold">{risk.total_risk_points ?? 0} pts</span>
                </div>
                <div>
                  <span className="text-slate-500 block font-sans">Normalized Score</span>
                  <span className="text-amber-400 font-semibold">
                    {risk.capped_risk_score ?? 0} / 100
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block font-sans">Readiness Score</span>
                  <span className="text-emerald-400 font-semibold">
                    {risk.readiness_score ?? 100}%
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Isolated Sandbox Audit History (Step 10 Focus) */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-xs font-semibold text-white flex items-center gap-2">
                <FileCheck2 className="w-4 h-4 text-indigo-400" />
                <span>Sandbox Audit Trail ({audits.length})</span>
              </h3>
              <span className="text-[11px] font-mono text-slate-400">Isolated Log</span>
            </div>

            <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
              {audits.map((a, idx) => (
                <div
                  key={`${a.step}-${idx}`}
                  className="bg-slate-950/70 border border-slate-800 rounded-xl p-3 space-y-1 text-xs"
                >
                  <div className="flex items-center justify-between font-mono">
                    <span className="text-indigo-400 font-semibold">
                      Step {a.step}: {a.action}
                    </span>
                    <span
                      className={
                        a.decision === 'BLOCKED' || a.decision === 'CRITICAL_RISK'
                          ? 'text-rose-400'
                          : 'text-emerald-400'
                      }
                    >
                      {a.decision}
                    </span>
                  </div>
                  <p className="text-slate-300 leading-relaxed">{a.details}</p>
                  <div className="text-[10px] font-mono text-slate-500 flex justify-between pt-1">
                    <span>{a.actor}</span>
                    <span>{a.timestamp ? new Date(a.timestamp).toLocaleTimeString() : ''}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
