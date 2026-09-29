import React, { useState } from 'react';
import {
  X,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  FileText,
  Wrench,
  Flame,
  Lock,
  Server,
  Variable,
  Activity,
  Key,
  Download,
  AlertOctagon,
} from 'lucide-react';
import {
  EnvironmentState,
  DeploymentGateCheck,
  DriftRecord,
} from '../types';

interface GatekeeperModalProps {
  isOpen: boolean;
  onClose: () => void;
  environment: EnvironmentState;
  drifts: DriftRecord[];
  gateCheck: DeploymentGateCheck;
  onReconcileAll: () => void;
  onOverride?: (note: string) => void;
}

export const GatekeeperModal: React.FC<GatekeeperModalProps> = ({
  isOpen,
  onClose,
  environment,
  drifts,
  gateCheck,
  onReconcileAll,
  onOverride,
}) => {
  const [showOverrideForm, setShowOverrideForm] = useState(false);
  const [overrideNote, setOverrideNote] = useState('');

  if (!isOpen) return null;

  const isBlocked = gateCheck.decision === 'BLOCKED';
  const isReview = gateCheck.decision === 'MANUAL_REVIEW';
  const isApprovedWarning = gateCheck.decision === 'APPROVED_WITH_WARNING';
  const isApproved = gateCheck.decision === 'APPROVED';

  const handleExportReport = () => {
    const reportData = {
      title: 'Pre-Deployment Configuration Drift Gatekeeper Audit Report',
      environment: environment.displayName,
      targetRelease: gateCheck.targetReleaseVersion,
      decision: gateCheck.decision,
      readinessScore: `${gateCheck.readinessScore}%`,
      validatedAt: gateCheck.validatedAt,
      summary: {
        totalDrifts: gateCheck.driftCount,
        critical: gateCheck.criticalCount,
        high: gateCheck.highCount,
        medium: gateCheck.mediumCount,
        low: gateCheck.lowCount,
      },
      domainChecks: gateCheck.checks,
      drifts: drifts.map((d) => ({
        category: d.category,
        key: d.key,
        severity: d.severity,
        expected: d.expectedValue,
        actual: d.actualValue,
        reason: d.reason,
        impact: d.impact,
      })),
    };

    const blob = new Blob([JSON.stringify(reportData, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gatekeeper-report-${environment.name}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const submitOverride = (e: React.FormEvent) => {
    e.preventDefault();
    if (!overrideNote.trim()) return;
    if (onOverride) {
      onOverride(overrideNote);
    }
    setShowOverrideForm(false);
    setOverrideNote('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div
              className={`p-2 rounded-lg ${
                isBlocked
                  ? 'bg-rose-100 text-rose-700'
                  : isReview
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-emerald-100 text-emerald-800'
              }`}
            >
              {isBlocked ? (
                <ShieldAlert className="w-5 h-5" />
              ) : isReview ? (
                <AlertTriangle className="w-5 h-5" />
              ) : (
                <ShieldCheck className="w-5 h-5" />
              )}
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Pre-Deployment Gatekeeper Evaluation
              </h2>
              <p className="text-xs text-slate-500">
                Target: {environment.displayName} &bull; Release Candidate:{' '}
                <span className="font-mono font-semibold text-slate-700">
                  {gateCheck.targetReleaseVersion}
                </span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* Big Decision Banner */}
          <div
            className={`p-4 rounded-xl border flex items-start gap-3.5 ${
              isBlocked
                ? 'bg-rose-50 border-rose-200 text-rose-950'
                : isReview
                ? 'bg-amber-50 border-amber-200 text-amber-950'
                : isApprovedWarning
                ? 'bg-yellow-50 border-yellow-200 text-yellow-950'
                : 'bg-emerald-50 border-emerald-200 text-emerald-950'
            }`}
          >
            <div className="mt-0.5">
              {isBlocked ? (
                <XCircle className="w-6 h-6 text-rose-600" />
              ) : isReview ? (
                <AlertTriangle className="w-6 h-6 text-amber-600" />
              ) : (
                <CheckCircle2 className="w-6 h-6 text-emerald-600" />
              )}
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs uppercase font-bold tracking-wider opacity-80">
                  Deployment Decision
                </span>
                <span className="text-xs font-mono font-bold bg-white/70 px-2 py-0.5 rounded">
                  Score: {gateCheck.readinessScore}%
                </span>
              </div>
              <h3 className="text-lg font-black tracking-tight mt-0.5">
                {gateCheck.decision.replace(/_/g, ' ')}
              </h3>
              <p className="text-xs mt-1 leading-relaxed opacity-90">
                {gateCheck.reason}
              </p>
            </div>
          </div>

          {/* Domain Verification Checklist */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2.5">
              Domain Verification Checklist
            </h4>
            <div className="grid grid-cols-2 gap-2.5">
              {/* Infrastructure */}
              <div className="border border-slate-200 rounded-lg p-3 bg-slate-50/50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Server className="w-4 h-4 text-blue-600" />
                  <div>
                    <div className="text-xs font-bold text-slate-800">
                      Infrastructure
                    </div>
                    <div className="text-[10px] text-slate-500">
                      Sizing, replicas & DB pool
                    </div>
                  </div>
                </div>
                <span
                  className={`text-[11px] font-bold px-2 py-0.5 rounded ${
                    gateCheck.checks.infrastructure === 'PASS'
                      ? 'bg-emerald-100 text-emerald-800'
                      : gateCheck.checks.infrastructure === 'WARNING'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-rose-100 text-rose-800'
                  }`}
                >
                  {gateCheck.checks.infrastructure}
                </span>
              </div>

              {/* Env Vars */}
              <div className="border border-slate-200 rounded-lg p-3 bg-slate-50/50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Variable className="w-4 h-4 text-purple-600" />
                  <div>
                    <div className="text-xs font-bold text-slate-800">
                      Environment Variables
                    </div>
                    <div className="text-[10px] text-slate-500">
                      Gateways, TTL & flags
                    </div>
                  </div>
                </div>
                <span
                  className={`text-[11px] font-bold px-2 py-0.5 rounded ${
                    gateCheck.checks.envVars === 'PASS'
                      ? 'bg-emerald-100 text-emerald-800'
                      : gateCheck.checks.envVars === 'WARNING'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-rose-100 text-rose-800'
                  }`}
                >
                  {gateCheck.checks.envVars}
                </span>
              </div>

              {/* Secrets */}
              <div className="border border-slate-200 rounded-lg p-3 bg-slate-50/50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Key className="w-4 h-4 text-amber-600" />
                  <div>
                    <div className="text-xs font-bold text-slate-800">
                      Secrets & Keys
                    </div>
                    <div className="text-[10px] text-slate-500">
                      Vault versions & rotation
                    </div>
                  </div>
                </div>
                <span
                  className={`text-[11px] font-bold px-2 py-0.5 rounded ${
                    gateCheck.checks.secrets === 'PASS'
                      ? 'bg-emerald-100 text-emerald-800'
                      : gateCheck.checks.secrets === 'WARNING'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-rose-100 text-rose-800'
                  }`}
                >
                  {gateCheck.checks.secrets}
                </span>
              </div>

              {/* Runtime */}
              <div className="border border-slate-200 rounded-lg p-3 bg-slate-50/50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-emerald-600" />
                  <div>
                    <div className="text-xs font-bold text-slate-800">
                      Runtime Health
                    </div>
                    <div className="text-[10px] text-slate-500">
                      Live state & rate limiters
                    </div>
                  </div>
                </div>
                <span
                  className={`text-[11px] font-bold px-2 py-0.5 rounded ${
                    gateCheck.checks.runtime === 'PASS'
                      ? 'bg-emerald-100 text-emerald-800'
                      : gateCheck.checks.runtime === 'WARNING'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-rose-100 text-rose-800'
                  }`}
                >
                  {gateCheck.checks.runtime}
                </span>
              </div>
            </div>
          </div>

          {/* Flash Sale Risk Warnings */}
          {drifts.length > 0 && (
            <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-2.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                <Flame className="w-4 h-4 text-rose-500" />
                <span>Detected Violations Impacting Flash Sale:</span>
              </div>
              <ul className="space-y-1.5 text-xs text-slate-700 max-h-40 overflow-y-auto pr-1">
                {drifts.map((d) => (
                  <li
                    key={d.id}
                    className="flex items-start gap-2 bg-white p-2 rounded-md border border-slate-200"
                  >
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded font-mono ${
                        d.severity === 'CRITICAL'
                          ? 'bg-rose-100 text-rose-700'
                          : d.severity === 'HIGH'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {d.severity}
                    </span>
                    <div>
                      <strong className="text-slate-900 font-mono text-[11px]">
                        {d.key}
                      </strong>
                      : {d.reason}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Emergency Override Form */}
          {showOverrideForm ? (
            <form
              onSubmit={submitOverride}
              className="border border-amber-300 bg-amber-50/70 rounded-xl p-4 space-y-3 animate-in fade-in duration-200"
            >
              <div className="flex items-center gap-2 text-xs font-bold text-amber-900">
                <AlertOctagon className="w-4 h-4 text-amber-600" />
                <span>Emergency Gatekeeper Override (DevOps / SRE Lead)</span>
              </div>
              <p className="text-xs text-amber-800">
                Warning: Overriding a BLOCKED release carries immediate risk of
                payment or infrastructure outage during the flash sale. A formal
                justification will be recorded to the permanent audit log.
              </p>
              <textarea
                required
                rows={2}
                placeholder="Enter mandatory justification and ticket ID (e.g., 'Approved by VP Eng under INC-8912 due to downstream mitigation')..."
                value={overrideNote}
                onChange={(e) => setOverrideNote(e.target.value)}
                className="w-full text-xs p-2 rounded-lg border border-amber-300 bg-white focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowOverrideForm(false)}
                  className="px-3 py-1.5 rounded-lg text-xs text-slate-600 hover:bg-amber-100 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-xs"
                >
                  Confirm Override & Authorize Release
                </button>
              </div>
            </form>
          ) : null}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-slate-100 bg-slate-50/80 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportReport}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Audit JSON</span>
            </button>
            {isBlocked && !showOverrideForm && (
              <button
                onClick={() => setShowOverrideForm(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-amber-700 hover:bg-amber-100/60 text-xs font-semibold transition-colors"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Emergency Override</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {drifts.length > 0 && (
              <button
                onClick={() => {
                  onReconcileAll();
                  onClose();
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs transition-colors"
              >
                <Wrench className="w-3.5 h-3.5" />
                <span>Auto-Reconcile & Clear Gate</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
