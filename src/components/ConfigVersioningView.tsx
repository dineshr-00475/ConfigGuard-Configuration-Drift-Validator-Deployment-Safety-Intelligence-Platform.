import React, { useState } from 'react';
import {
  History,
  CheckCircle2,
  XCircle,
  RotateCcw,
  ArrowRight,
  GitCompare,
  ShieldCheck,
  ShieldAlert,
  Clock,
  User,
  AlertTriangle,
  Layers,
  Sparkles,
  FileCheck,
} from 'lucide-react';
import { ConfigSnapshot, EnvironmentState } from '../types';
import { INITIAL_ENVIRONMENTS } from '../services/store';

interface ConfigVersioningViewProps {
  versions?: ConfigSnapshot[];
  snapshots?: ConfigSnapshot[];
  currentEnvironment?: EnvironmentState;
  environments?: EnvironmentState[];
  onRollbackToVersion?: (targetVersion: ConfigSnapshot) => void;
  onRestoreSnapshot?: (targetVersion: ConfigSnapshot) => void;
  onCreateSnapshot?: () => void;
}

export const ConfigVersioningView: React.FC<ConfigVersioningViewProps> = ({
  versions,
  snapshots,
  currentEnvironment,
  environments,
  onRollbackToVersion,
  onRestoreSnapshot,
  onCreateSnapshot,
}) => {
  const versionsList = versions || snapshots || [];
  const activeEnv =
    currentEnvironment ||
    (environments && environments[0]) ||
    INITIAL_ENVIRONMENTS[0];
  const handleRollback = onRollbackToVersion || onRestoreSnapshot || (() => {});

  const [versionA, setVersionA] = useState<number>(() => versionsList[0]?.version || 10);
  const [versionB, setVersionB] = useState<number>(() => versionsList[1]?.version || versionsList[0]?.version || 9);
  const [rollbackConfirmTarget, setRollbackConfirmTarget] = useState<ConfigSnapshot | null>(null);

  const snapA = versionsList.find((v) => v.version === versionA) || versionsList[0] || null;
  const snapB = versionsList.find((v) => v.version === versionB) || versionsList[1] || versionsList[0] || null;

  // Compute differences between Version A and Version B
  const diffKeys: {
    key: string;
    domain: string;
    valA: any;
    valB: any;
    isDifferent: boolean;
  }[] = [];

  if (snapA && snapB && snapA.config && snapB.config) {
    // Env vars
    const envA = snapA.config.envVars || {};
    const envB = snapB.config.envVars || {};
    const allEnv = Array.from(
      new Set([
        ...Object.keys(envA),
        ...Object.keys(envB),
      ])
    );
    allEnv.forEach((k) => {
      const vA = envA[k];
      const vB = envB[k];
      diffKeys.push({
        key: k,
        domain: 'Env Variable',
        valA: vA ?? '<missing>',
        valB: vB ?? '<missing>',
        isDifferent: vA !== vB,
      });
    });

    // Infrastructure
    const infraA = (snapA.config.infrastructure || {}) as any;
    const infraB = (snapB.config.infrastructure || {}) as any;
    const allInfra = Array.from(
      new Set([
        ...Object.keys(infraA),
        ...Object.keys(infraB),
      ])
    );
    allInfra.forEach((k) => {
      const vA = infraA[k];
      const vB = infraB[k];
      diffKeys.push({
        key: k,
        domain: 'Infrastructure',
        valA: vA !== undefined ? String(vA) : '<missing>',
        valB: vB !== undefined ? String(vB) : '<missing>',
        isDifferent: vA !== vB,
      });
    });

    // Secrets
    const secA = (snapA.config.secrets || {}) as any;
    const secB = (snapB.config.secrets || {}) as any;
    const allSec = Array.from(
      new Set([
        ...Object.keys(secA),
        ...Object.keys(secB),
      ])
    );
    allSec.forEach((k) => {
      const vA = secA[k] ? `v${secA[k].version}` : '<missing>';
      const vB = secB[k] ? `v${secB[k].version}` : '<missing>';
      diffKeys.push({
        key: k,
        domain: 'Secrets',
        valA: vA,
        valB: vB,
        isDifferent: vA !== vB,
      });
    });

    // Runtime
    const runA = (snapA.config.runtime || {}) as any;
    const runB = (snapB.config.runtime || {}) as any;
    const allRun = Array.from(
      new Set([
        ...Object.keys(runA),
        ...Object.keys(runB),
      ])
    );
    allRun.forEach((k) => {
      const vA = runA[k];
      const vB = runB[k];
      diffKeys.push({
        key: k,
        domain: 'Runtime',
        valA: vA !== undefined ? String(vA) : '<missing>',
        valB: vB !== undefined ? String(vB) : '<missing>',
        isDifferent: vA !== vB,
      });
    });
  }

  const mismatchCount = diffKeys.filter((d) => d.isDifferent).length;

  return (
    <div className="space-y-6">
      {/* Version History Table Card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 sm:px-6 border-b border-slate-200 bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-600" />
              <h2 className="text-base font-bold text-slate-900">
                Configuration Version Registry ({activeEnv.displayName})
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Immutable version snapshots. Rollback to safe releases or compare changes between versions.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500 font-mono">
              Current Live: <strong className="text-slate-900">v{activeEnv.configVersion}</strong>
            </span>
            {onCreateSnapshot && (
              <button
                onClick={onCreateSnapshot}
                className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition-colors flex items-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Create Snapshot</span>
              </button>
            )}
          </div>
        </div>

        {/* Versions List */}
        <div className="divide-y divide-slate-100">
          {versionsList.map((snap) => {
            const isCurrent = snap.version === activeEnv.configVersion;
            return (
              <div
                key={snap.version}
                className={`p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 transition-colors ${
                  isCurrent
                    ? snap.isSafe
                      ? 'bg-emerald-50/30'
                      : 'bg-rose-50/30'
                    : 'hover:bg-slate-50'
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold font-mono text-slate-900">
                      Version {snap.version}
                    </span>
                    {isCurrent && (
                      <span className="text-[10px] font-bold uppercase tracking-wider bg-slate-900 text-white px-2 py-0.5 rounded-full">
                        Current Live
                      </span>
                    )}
                    {snap.isSafe ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                        <CheckCircle2 className="w-3 h-3" />
                        Safe Baseline ✅
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-full">
                        <XCircle className="w-3 h-3" />
                        Drifting / Unsafe ❌
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-slate-600 max-w-2xl">{snap.comment}</p>

                  <div className="flex items-center gap-4 text-[11px] text-slate-400">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {snap.createdAt}
                    </span>
                    <span className="flex items-center gap-1">
                      <User className="w-3 h-3" />
                      {snap.author}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 self-start md:self-center">
                  <button
                    onClick={() => {
                      setVersionA(activeEnv.configVersion);
                      setVersionB(snap.version);
                    }}
                    className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-2xs"
                  >
                    <GitCompare className="w-3 h-3 text-indigo-500" />
                    <span>Compare with Current</span>
                  </button>

                  {!isCurrent && (
                    <button
                      onClick={() => setRollbackConfirmTarget(snap)}
                      className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded text-white shadow-xs transition-colors ${
                        snap.isSafe
                          ? 'bg-emerald-600 hover:bg-emerald-700'
                          : 'bg-slate-700 hover:bg-slate-800'
                      }`}
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Rollback to v{snap.version}</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Version Comparison Section (e.g. Version 9 vs Version 10) */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 sm:px-6 border-b border-slate-200 bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <GitCompare className="w-4 h-4 text-indigo-600" />
              <h3 className="text-base font-bold text-slate-900">
                Version Differential Inspector
              </h3>
              <span className="text-xs font-mono font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-full">
                v{versionA} vs v{versionB} ({mismatchCount} difference{mismatchCount === 1 ? '' : 's'})
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Verify changes across revisions to detect regressions and out-of-order schema migrations
            </p>
          </div>

          {/* Selectors */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
              <span>Compare:</span>
              <select
                value={versionA}
                onChange={(e) => setVersionA(Number(e.target.value))}
                className="text-xs border border-slate-200 rounded px-2 py-1 bg-white font-mono font-bold"
              >
                {versionsList.map((v) => (
                  <option key={v.version} value={v.version}>
                    v{v.version} {v.isSafe ? '(Safe)' : '(Unsafe)'}
                  </option>
                ))}
              </select>
            </div>

            <span className="text-xs font-bold text-slate-400">vs</span>

            <div className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
              <select
                value={versionB}
                onChange={(e) => setVersionB(Number(e.target.value))}
                className="text-xs border border-slate-200 rounded px-2 py-1 bg-white font-mono font-bold"
              >
                {versionsList.map((v) => (
                  <option key={v.version} value={v.version}>
                    v{v.version} {v.isSafe ? '(Safe)' : '(Unsafe)'}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Diff Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse font-sans text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-100/70 text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                <th className="py-2.5 px-4 w-1/4">CONFIGURATION KEY</th>
                <th className="py-2.5 px-4 w-1/3 font-mono">
                  VERSION {versionA} {snapA?.isSafe ? '✅' : '❌'}
                </th>
                <th className="py-2.5 px-4 w-1/3 font-mono">
                  VERSION {versionB} {snapB?.isSafe ? '✅' : '❌'}
                </th>
                <th className="py-2.5 px-4 text-center">DIFF STATUS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {diffKeys.map((diff) => (
                <tr
                  key={`${diff.domain}-${diff.key}`}
                  className={diff.isDifferent ? 'bg-amber-50/40 hover:bg-amber-50/60' : 'hover:bg-slate-50'}
                >
                  <td className="py-2.5 px-4">
                    <div className="font-mono font-bold text-slate-900">{diff.key}</div>
                    <div className="text-[10px] text-slate-500">{diff.domain}</div>
                  </td>
                  <td className="py-2.5 px-4">
                    <span
                      className={`font-mono px-2 py-0.5 rounded text-[11px] ${
                        diff.isDifferent
                          ? 'bg-rose-100 text-rose-800 font-bold border border-rose-200'
                          : 'text-slate-700'
                      }`}
                    >
                      {diff.valA}
                    </span>
                  </td>
                  <td className="py-2.5 px-4">
                    <span
                      className={`font-mono px-2 py-0.5 rounded text-[11px] ${
                        diff.isDifferent
                          ? 'bg-emerald-100 text-emerald-800 font-bold border border-emerald-200'
                          : 'text-slate-700'
                      }`}
                    >
                      {diff.valB}
                    </span>
                  </td>
                  <td className="py-2.5 px-4 text-center whitespace-nowrap">
                    {diff.isDifferent ? (
                      <span className="text-[10px] font-bold font-mono text-amber-700 bg-amber-100 border border-amber-200 px-2 py-0.5 rounded">
                        MODIFIED
                      </span>
                    ) : (
                      <span className="text-[10px] font-mono text-slate-400">IDENTICAL</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Rollback Confirmation Modal */}
      {rollbackConfirmTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full border border-slate-200 overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <RotateCcw className="w-5 h-5 text-emerald-600" />
                <h3 className="text-base font-bold text-slate-900">
                  Confirm Emergency Rollback
                </h3>
              </div>
              <button
                onClick={() => setRollbackConfirmTarget(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs text-slate-600">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-amber-900">
                <div className="flex items-center gap-1.5 font-bold mb-1">
                  <AlertTriangle className="w-4 h-4 text-amber-700" />
                  <span>Automated Rollback Workflow Trigger</span>
                </div>
                You are about to roll back the live running configuration in{' '}
                <strong>{activeEnv.displayName}</strong>:
              </div>

              {/* Rollback Diagram */}
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-2 font-mono text-center">
                <div className="flex items-center justify-center gap-2 text-rose-700 font-bold bg-rose-50 p-1.5 rounded border border-rose-200">
                  <span>Current Version: v{activeEnv.configVersion} (Bad Configuration ❌)</span>
                </div>
                <div className="text-slate-400 font-bold">↓ Rollback Execution ↓</div>
                <div className="flex items-center justify-center gap-2 text-emerald-700 font-bold bg-emerald-50 p-1.5 rounded border border-emerald-200">
                  <span>Target Version: v{rollbackConfirmTarget.version} (Previous Safe Baseline ✅)</span>
                </div>
              </div>

              <p>
                Target Release Note: <em>"{rollbackConfirmTarget.comment}"</em>
              </p>
              <p className="text-slate-500">
                This will immediately synchronize all environment variables, connection pools, and container replicas to the verified golden snapshot.
              </p>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                onClick={() => setRollbackConfirmTarget(null)}
                className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  handleRollback(rollbackConfirmTarget);
                  setRollbackConfirmTarget(null);
                }}
                className="px-4 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded shadow-xs transition-colors flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Execute Rollback to v{rollbackConfirmTarget.version}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
