import React, { useState, useEffect, useCallback } from 'react';
import {
  Rocket,
  Play,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Lock,
  Clock,
  ArrowRight,
  ShieldAlert,
  Wrench,
  RefreshCw,
} from 'lucide-react';
import {
  executeDeploymentPipeline,
  fetchPipelineHistory,
  approvePendingPipeline,
} from '../services/apiClient';
import { AuthUser, EnvironmentType } from '../types';

interface DeploymentPipelineViewProps {
  selectedEnv: EnvironmentType;
  onSelectEnv: (env: EnvironmentType) => void;
  currentUser: AuthUser | null;
  onReconcileAll?: () => Promise<void>;
  onOpenGatekeeper?: () => void;
  showToast?: (msg: string, type?: 'success' | 'warning' | 'error' | 'info') => void;
}

export function DeploymentPipelineView({
  selectedEnv,
  onSelectEnv,
  currentUser,
  onReconcileAll,
  onOpenGatekeeper,
  showToast,
}: DeploymentPipelineViewProps) {
  const [history, setHistory] = useState<any[]>([]);
  const [activePipeline, setActivePipeline] = useState<any | null>(null);
  const [selectedStageIndex, setSelectedStageIndex] = useState<number>(2);
  const [versionTag, setVersionTag] = useState<string>('v2.4.0-flash-sale');
  const [executing, setExecuting] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [filterEnv, setFilterEnv] = useState<string>('ALL');
  const [approvalNotes, setApprovalNotes] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const pageSize = 6;

  const loadHistory = useCallback(async () => {
    setLoading(true);
    const items = await fetchPipelineHistory(filterEnv === 'ALL' ? undefined : filterEnv, 40);
    setHistory(items);
    if (items.length > 0 && !activePipeline) {
      const matching = items.find((i) => i.environment === selectedEnv) || items[0];
      setActivePipeline(matching);
      const blockedIdx = (matching.stages || []).findIndex(
        (s: any) => s.status === 'FAILED' || s.status === 'BLOCKED' || s.status === 'PENDING'
      );
      setSelectedStageIndex(blockedIdx >= 0 ? blockedIdx : 2);
    }
    setLoading(false);
  }, [filterEnv, selectedEnv, activePipeline]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const handleRunPipeline = async () => {
    setExecuting(true);
    const res = await executeDeploymentPipeline(selectedEnv, versionTag);
    setExecuting(false);
    if (res) {
      setActivePipeline(res);
      setHistory((prev) => [res, ...prev.filter((p) => p.pipeline_id !== res.pipeline_id)]);
      const failedIdx = (res.stages || []).findIndex(
        (s: any) => s.status === 'FAILED' || s.status === 'BLOCKED' || s.status === 'PENDING'
      );
      setSelectedStageIndex(failedIdx >= 0 ? failedIdx : 5);
      if (res.overall_status === 'BLOCKED') {
        showToast?.(
          `Pipeline ${res.pipeline_id} halted at ${res.blocked_stage}: unsafe progression prevented.`,
          'error'
        );
      } else {
        showToast?.(
          `Pipeline ${res.pipeline_id} (${res.overall_status}) recorded in execution history.`,
          'success'
        );
      }
    } else {
      showToast?.('Failed to execute deployment pipeline.', 'error');
    }
  };

  const handleApproveDecision = async (decision: 'APPROVE' | 'REJECT') => {
    if (!activePipeline) return;
    const res = await approvePendingPipeline(
      activePipeline.pipeline_id,
      decision,
      approvalNotes || `${decision} via Deployment Pipeline Gate`
    );
    if (res.ok && res.data) {
      setActivePipeline(res.data);
      setHistory((prev) =>
        prev.map((p) => (p.pipeline_id === res.data.pipeline_id ? res.data : p))
      );
      setApprovalNotes('');
      showToast?.(`Pipeline ${activePipeline.pipeline_id} ${decision.toLowerCase()}d.`, 'success');
    } else {
      showToast?.(res.error || 'Approval action failed', 'error');
    }
  };

  const handleAutoHealAndRerun = async () => {
    if (onReconcileAll) {
      await onReconcileAll();
    }
    await handleRunPipeline();
  };

  const stages: any[] = activePipeline?.stages || [
    { stage: 'Code', order: 1, status: 'PASSED', duration_ms: 0.5, summary: 'Git commit verified' },
    { stage: 'Build', order: 2, status: 'PASSED', duration_ms: 0.8, summary: 'Image signed' },
    {
      stage: 'Configuration Validation',
      order: 3,
      status: 'PASSED',
      duration_ms: 1.4,
      summary: 'Multi-layer drift check',
    },
    {
      stage: 'Risk Assessment',
      order: 4,
      status: 'PASSED',
      duration_ms: 0.6,
      summary: 'Weighted risk evaluation',
    },
    { stage: 'Approval', order: 5, status: 'PASSED', duration_ms: 0.3, summary: 'Policy gate' },
    { stage: 'Deployment', order: 6, status: 'PASSED', duration_ms: 1.1, summary: 'Cluster rollout' },
  ];

  const selectedStage = stages[selectedStageIndex] || stages[0];
  const totalPages = Math.max(1, Math.ceil(history.length / pageSize));
  const pagedHistory = history.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="space-y-6">
      {/* Top Pipeline Execution Controls */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-white tracking-tight flex items-center gap-2.5">
            <Rocket className="w-5 h-5 text-indigo-400" />
            <span>Deployment Pipeline & Safety Gatekeeper</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            End-to-end 6-stage pipeline enforcing configuration drift validation and risk gating
            before release progression.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <select
            aria-label="Select Pipeline Environment"
            value={selectedEnv}
            onChange={(e) => onSelectEnv(e.target.value as EnvironmentType)}
            className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white font-medium focus:outline-none focus:border-indigo-500"
          >
            <option value="production">Production</option>
            <option value="staging">Staging</option>
            <option value="development">Development</option>
          </select>

          <input
            type="text"
            aria-label="Release Version Tag"
            value={versionTag}
            onChange={(e) => setVersionTag(e.target.value)}
            placeholder="v2.4.0-flash-sale"
            className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white font-mono w-40 focus:outline-none focus:border-indigo-500"
          />

          <button
            onClick={handleRunPipeline}
            disabled={executing}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold transition-colors flex items-center gap-2 whitespace-nowrap"
          >
            <Play className="w-3.5 h-3.5" />
            <span>{executing ? 'Executing Pipeline...' : 'Execute Pipeline'}</span>
          </button>

          {onOpenGatekeeper && (
            <button
              onClick={onOpenGatekeeper}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-colors whitespace-nowrap"
            >
              Gatekeeper Matrix
            </button>
          )}
        </div>
      </div>

      {/* Visual 6-Stage Pipeline Stepper */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3 text-xs">
            <span className="font-mono text-indigo-400 font-semibold">
              {activePipeline?.pipeline_id || 'PIPE-READY'}
            </span>
            <span aria-hidden="true" className="text-slate-600">
              ·
            </span>
            <span className="capitalize text-slate-200 font-medium">
              Target: {activePipeline?.environment || selectedEnv}
            </span>
            <span aria-hidden="true" className="text-slate-600">
              ·
            </span>
            <span className="font-mono text-slate-400">
              Tag: {activePipeline?.version_tag || versionTag}
            </span>
          </div>

          <div className="flex items-center gap-3 text-xs font-mono tabular-nums">
            <span className="text-slate-400">
              Risk Score:{' '}
              <strong
                className={
                  (activePipeline?.risk_score ?? 0) >= 70 ? 'text-rose-400' : 'text-emerald-400'
                }
              >
                {activePipeline?.risk_score ?? 0}/100
              </strong>
            </span>
            <span aria-hidden="true" className="text-slate-600">
              ·
            </span>
            <span
              className={
                activePipeline?.overall_status === 'COMPLETED'
                  ? 'text-emerald-400 font-semibold'
                  : activePipeline?.overall_status === 'BLOCKED' ||
                    activePipeline?.overall_status === 'FAILED'
                  ? 'text-rose-400 font-semibold'
                  : 'text-amber-400 font-semibold'
              }
            >
              Status: {activePipeline?.overall_status || 'READY'}
            </span>
          </div>
        </div>

        {/* 6 Stages Row */}
        <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
          {stages.map((st, idx) => {
            const isSelected = idx === selectedStageIndex;
            const status = st.status;
            const isPassed = status === 'PASSED';
            const isFailed = status === 'FAILED';
            const isBlocked = status === 'BLOCKED';
            const isWarning = status === 'WARNING' || status === 'PENDING';

            return (
              <button
                key={st.stage}
                onClick={() => setSelectedStageIndex(idx)}
                className={`text-left p-4 rounded-xl border transition-all flex flex-col justify-between min-h-[124px] ${
                  isSelected
                    ? 'bg-slate-800/90 border-indigo-500'
                    : isFailed || isBlocked
                    ? 'bg-rose-950/25 border-rose-800/70 hover:border-rose-700'
                    : isWarning
                    ? 'bg-amber-950/20 border-amber-800/70 hover:border-amber-700'
                    : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-mono text-slate-400">0{idx + 1}</span>
                  {isPassed && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
                  {isFailed && <XCircle className="w-4 h-4 text-rose-400 shrink-0" />}
                  {isBlocked && <Lock className="w-4 h-4 text-rose-400 shrink-0" />}
                  {isWarning && <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />}
                </div>

                <div className="my-2">
                  <div className="text-xs font-semibold text-white leading-snug">{st.stage}</div>
                  <div
                    className={`text-[11px] font-mono mt-1 ${
                      isPassed
                        ? 'text-emerald-400'
                        : isFailed || isBlocked
                        ? 'text-rose-400'
                        : 'text-amber-400'
                    }`}
                  >
                    {status}
                  </div>
                </div>

                <div className="text-[11px] font-mono tabular-nums text-slate-400 flex items-center justify-between pt-2 border-t border-slate-800/80">
                  <span>{st.duration_ms ?? 0} ms</span>
                  {idx < 5 && <ArrowRight className="w-3 h-3 text-slate-600" />}
                </div>
              </button>
            );
          })}
        </div>

        {/* Unsafe Progression Block Alert when Pipeline is BLOCKED */}
        {activePipeline?.overall_status === 'BLOCKED' && (
          <div className="rounded-xl border border-rose-800/80 bg-rose-950/30 p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs font-semibold text-rose-300">
                <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
                <span>
                  Unsafe Progression Prevented at Stage: {activePipeline.blocked_stage}
                </span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                {activePipeline.failure_reason}
              </p>
            </div>
            {onReconcileAll && (
              <button
                onClick={handleAutoHealAndRerun}
                className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold flex items-center gap-2 shrink-0 whitespace-nowrap"
              >
                <Wrench className="w-3.5 h-3.5" />
                <span>Reconcile Drifts & Re-Run Pipeline</span>
              </button>
            )}
          </div>
        )}

        {/* Manual Approval Action Panel if AWAITING_APPROVAL */}
        {activePipeline?.overall_status === 'AWAITING_APPROVAL' && (
          <div className="rounded-xl border border-amber-800/80 bg-amber-950/30 p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="text-xs font-semibold text-amber-300">
                Manual Release Manager Sign-Off Required
              </div>
              <p className="text-xs text-slate-300">{activePipeline.failure_reason}</p>
            </div>
            <div className="flex items-center gap-2 w-full md:w-auto">
              <input
                type="text"
                value={approvalNotes}
                onChange={(e) => setApprovalNotes(e.target.value)}
                placeholder="Approval justification..."
                className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white flex-1 md:w-56"
              />
              <button
                onClick={() => handleApproveDecision('APPROVE')}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold whitespace-nowrap"
              >
                Approve
              </button>
              <button
                onClick={() => handleApproveDecision('REJECT')}
                className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold whitespace-nowrap"
              >
                Reject
              </button>
            </div>
          </div>
        )}

        {/* Selected Stage Inspector */}
        {selectedStage && (
          <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-white">
                Stage 0{selectedStage.order}: {selectedStage.stage} — Diagnostic Output
              </span>
              <span className="font-mono tabular-nums text-slate-400">
                Execution Time: {selectedStage.duration_ms ?? 0} ms
              </span>
            </div>
            <p className="text-slate-300">{selectedStage.summary}</p>
            {selectedStage.failure_reason && (
              <div className="text-rose-300 font-mono bg-rose-950/40 border border-rose-900/60 rounded-lg p-2.5">
                Failure Reason: {selectedStage.failure_reason}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Persisted Pipeline Execution History Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="p-5 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-indigo-400" />
              <span>Persisted Pipeline Execution History</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Click any historical pipeline run to inspect its 6-stage execution trace above.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {['ALL', 'production', 'staging', 'development'].map((env) => (
              <button
                key={env}
                onClick={() => {
                  setFilterEnv(env);
                  setPage(1);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${
                  filterEnv === env
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
              >
                {env}
              </button>
            ))}
            <button
              onClick={loadHistory}
              aria-label="Refresh Pipeline History"
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {pagedHistory.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400">
            No pipeline executions recorded for this filter. Click "Execute Pipeline" above to run a
            6-stage deployment verification.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 bg-slate-950/50">
                  <th className="py-3 px-4 font-medium">Pipeline ID</th>
                  <th className="py-3 px-4 font-medium">Environment</th>
                  <th className="py-3 px-4 font-medium">Version / Commit</th>
                  <th className="py-3 px-4 font-medium">Status</th>
                  <th className="py-3 px-4 font-medium">Halted / Active Stage</th>
                  <th className="py-3 px-4 font-medium text-right">Drifts</th>
                  <th className="py-3 px-4 font-medium text-right">Risk Score</th>
                  <th className="py-3 px-4 font-medium text-right">Executed At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70 font-mono tabular-nums">
                {pagedHistory.map((item) => {
                  const isCurrent = activePipeline?.pipeline_id === item.pipeline_id;
                  return (
                    <tr
                      key={item.pipeline_id}
                      onClick={() => setActivePipeline(item)}
                      className={`cursor-pointer transition-colors ${
                        isCurrent ? 'bg-indigo-950/30' : 'hover:bg-slate-800/40'
                      }`}
                    >
                      <td className="py-3 px-4 text-indigo-300 font-semibold">
                        {item.pipeline_id}
                      </td>
                      <td className="py-3 px-4 capitalize text-slate-200 font-sans">
                        {item.environment}
                      </td>
                      <td className="py-3 px-4 text-slate-300">
                        {item.version_tag} · {item.commit_sha}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={
                            item.overall_status === 'COMPLETED'
                              ? 'text-emerald-400 font-semibold'
                              : item.overall_status === 'BLOCKED' ||
                                item.overall_status === 'FAILED'
                              ? 'text-rose-400 font-semibold'
                              : 'text-amber-400 font-semibold'
                          }
                        >
                          {item.overall_status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-300 font-sans">
                        {item.blocked_stage || item.current_stage}
                      </td>
                      <td className="py-3 px-4 text-right text-slate-300">
                        {item.drift_count} ({item.critical_drift_count} crit)
                      </td>
                      <td className="py-3 px-4 text-right text-slate-200">{item.risk_score}/100</td>
                      <td className="py-3 px-4 text-right text-slate-400">
                        {item.created_at ? new Date(item.created_at).toLocaleTimeString() : 'N/A'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="p-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <span>
              Page {page} of {totalPages} ({history.length} runs)
            </span>
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-2.5 py-1 rounded bg-slate-800 disabled:opacity-40 text-slate-200"
              >
                Previous
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="px-2.5 py-1 rounded bg-slate-800 disabled:opacity-40 text-slate-200"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
