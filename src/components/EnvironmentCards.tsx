import React from 'react';
import {
  Server,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Database,
  Cpu,
  Lock,
  ArrowRight,
  ShieldCheck,
  ShieldAlert,
} from 'lucide-react';
import { EnvironmentState, EnvironmentType, DriftRecord } from '../types';

interface EnvironmentCardsProps {
  environments: EnvironmentState[];
  selectedEnv: EnvironmentType;
  onSelectEnv: (env: EnvironmentType) => void;
  getDriftsForEnv: (env: EnvironmentState) => DriftRecord[];
  onOpenGatekeeperForEnv: (env: EnvironmentState) => void;
}

export const EnvironmentCards: React.FC<EnvironmentCardsProps> = ({
  environments,
  selectedEnv,
  onSelectEnv,
  getDriftsForEnv,
  onOpenGatekeeperForEnv,
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      {environments.map((env) => {
        const isSelected = env.name === selectedEnv;
        const drifts = getDriftsForEnv(env);
        const criticals = drifts.filter((d) => d.severity === 'CRITICAL').length;
        const highs = drifts.filter((d) => d.severity === 'HIGH').length;
        const mediums = drifts.filter((d) => d.severity === 'MEDIUM').length;

        // Status styling
        const isBlocked = env.deploymentStatus === 'BLOCKED' || criticals > 0;
        const isWarning = env.deploymentStatus === 'MANUAL_REVIEW' || highs > 0 || mediums > 0;
        const isHealthy = !isBlocked && !isWarning;

        return (
          <div
            key={env.id}
            onClick={() => onSelectEnv(env.name)}
            className={`cursor-pointer rounded-xl border p-4.5 transition-all relative overflow-hidden ${
              isSelected
                ? 'border-indigo-600 ring-2 ring-indigo-500/20 bg-white shadow-md'
                : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-xs'
            }`}
          >
            {/* Top Indicator */}
            <div className="flex items-start justify-between gap-2 mb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Stage
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${
                      isBlocked
                        ? 'bg-rose-100 text-rose-700 border border-rose-200'
                        : isWarning
                        ? 'bg-amber-100 text-amber-800 border border-amber-200'
                        : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                    }`}
                  >
                    {isBlocked ? (
                      <>
                        <XCircle className="w-3 h-3" />
                        GATE: BLOCKED
                      </>
                    ) : isWarning ? (
                      <>
                        <AlertTriangle className="w-3 h-3" />
                        REVIEW REQ
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-3 h-3" />
                        APPROVED
                      </>
                    )}
                  </span>
                </div>
                <h3 className="text-base font-bold text-slate-900 mt-0.5">
                  {env.displayName}
                </h3>
              </div>

              {/* Version pill */}
              <span className="text-[11px] font-mono text-slate-500 bg-slate-100 px-2 py-1 rounded-md border border-slate-200">
                v{env.configVersion}
              </span>
            </div>

            {/* Health Score & Risk Points Banner */}
            <div className="mb-4 bg-slate-50/90 rounded-lg p-2.5 border border-slate-100">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="text-slate-600 font-medium">Health Score</span>
                <span
                  className={`font-bold font-mono text-sm ${
                    (env.healthScore ?? env.readinessScore) < 50
                      ? 'text-rose-600'
                      : (env.healthScore ?? env.readinessScore) < 85
                      ? 'text-amber-600'
                      : 'text-emerald-600'
                  }`}
                >
                  {env.healthScore ?? env.readinessScore}%
                </span>
              </div>
              <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden mb-2">
                <div
                  className={`h-full transition-all duration-500 ${
                    (env.healthScore ?? env.readinessScore) < 50
                      ? 'bg-rose-500'
                      : (env.healthScore ?? env.readinessScore) < 85
                      ? 'bg-amber-500'
                      : 'bg-emerald-500'
                  }`}
                  style={{ width: `${env.healthScore ?? env.readinessScore}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-200/60">
                <span>Risk Points:</span>
                <span
                  className={`font-mono font-bold px-1.5 py-0.2 rounded text-[11px] ${
                    (env.riskPoints ?? 0) >= 50
                      ? 'bg-rose-100 text-rose-800'
                      : (env.riskPoints ?? 0) > 0
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-emerald-100 text-emerald-800'
                  }`}
                >
                  {env.riskPoints ?? 0} pts
                </span>
              </div>
            </div>

            {/* Drift Summary Counts */}
            <div className="grid grid-cols-3 gap-2 bg-slate-50/80 rounded-lg p-2.5 border border-slate-100 mb-3 text-center">
              <div>
                <div className="text-[10px] uppercase font-semibold text-slate-500">Critical</div>
                <div
                  className={`text-sm font-bold font-mono ${
                    criticals > 0 ? 'text-rose-600' : 'text-slate-700'
                  }`}
                >
                  {criticals}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase font-semibold text-slate-500">High</div>
                <div
                  className={`text-sm font-bold font-mono ${
                    highs > 0 ? 'text-amber-600' : 'text-slate-700'
                  }`}
                >
                  {highs}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase font-semibold text-slate-500">Medium/Low</div>
                <div className="text-sm font-bold font-mono text-slate-700">
                  {mediums + drifts.filter((d) => d.severity === 'LOW').length}
                </div>
              </div>
            </div>

            {/* Quick Live Snapshot snippet */}
            <div className="space-y-1.5 text-xs text-slate-600 mb-3">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1 text-slate-500">
                  <Cpu className="w-3 h-3 text-slate-400" />
                  Pods / Replicas
                </span>
                <span className="font-mono text-slate-800">
                  {env.actual.infrastructure.replicas} / {env.expected.infrastructure.replicas} exp
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1 text-slate-500">
                  <Database className="w-3 h-3 text-slate-400" />
                  Max DB Pool
                </span>
                <span className="font-mono text-slate-800">
                  {env.actual.infrastructure.maxDbConnections} conn
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1 text-slate-500">
                  <Lock className="w-3 h-3 text-slate-400" />
                  Payment Mode
                </span>
                <span
                  className={`font-mono font-semibold px-1 rounded ${
                    env.actual.runtime.paymentMode === 'production'
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'bg-rose-50 text-rose-700'
                  }`}
                >
                  {env.actual.runtime.paymentMode}
                </span>
              </div>
            </div>

            {/* Footer action */}
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
              <span className="text-[11px] text-slate-400">
                {drifts.length === 0 ? 'Clean (0 drifts)' : `${drifts.length} active drift(s)`}
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenGatekeeperForEnv(env);
                }}
                className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800"
              >
                Inspect Gate
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};
