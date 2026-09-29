import React, { useState, useEffect, useCallback } from 'react';
import {
  GitPullRequest,
  Plus,
  CheckCircle2,
  XCircle,
  Clock,
  ShieldAlert,
  User,
  Search,
  RefreshCw,
  ArrowRight,
} from 'lucide-react';
import { AuthUser, EnvironmentType } from '../types';
import {
  fetchBackendChangeRequests,
  createBackendChangeRequest,
  reviewChangeRequestDevOpsApi,
  decideChangeRequestApprovalApi,
} from '../services/apiClient';

interface ChangeRequestsViewProps {
  currentUser: AuthUser;
  showToast: (msg: string, type?: 'success' | 'warning' | 'error' | 'info') => void;
  onAuditLog?: (action: string, details: string) => void;
}

export function ChangeRequestsView({
  currentUser,
  showToast,
  onAuditLog,
}: ChangeRequestsViewProps) {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);

  // Create form state
  const [title, setTitle] = useState<string>('');
  const [environment, setEnvironment] = useState<EnvironmentType>('production');
  const [category, setCategory] = useState<string>('env_variable');
  const [parameterKey, setParameterKey] = useState<string>('MAX_CONNECTIONS');
  const [previousValue, setPreviousValue] = useState<string>('800');
  const [proposedValue, setProposedValue] = useState<string>('1200');
  const [reason, setReason] = useState<string>('');

  // Filter & Search
  const [filterEnv, setFilterEnv] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [reviewNotesMap, setReviewNotesMap] = useState<Record<string, string>>({});

  // Simulated Active Role Switcher for testing RBAC policies seamlessly
  const [actingRole, setActingRole] = useState<string>(currentUser.role || 'DEVELOPER');
  const [actingEmail, setActingEmail] = useState<string>(currentUser.email);
  const [actingName, setActingName] = useState<string>(currentUser.name);

  const loadRequests = useCallback(async () => {
    setLoading(true);
    const data = await fetchBackendChangeRequests(
      filterEnv === 'ALL' ? undefined : filterEnv,
      filterStatus === 'ALL' ? undefined : filterStatus
    );
    setRequests(data);
    setLoading(false);
  }, [filterEnv, filterStatus]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const handleRolePresetChange = (role: string) => {
    setActingRole(role);
    if (role === 'DEVELOPER') {
      setActingName('Alex Rivera');
      setActingEmail('developer@driftguard.io');
    } else if (role === 'DEVOPS') {
      setActingName('Jordan Vance');
      setActingEmail('devops@driftguard.io');
    } else if (role === 'RELEASE_MANAGER') {
      setActingName('Elena Rostova');
      setActingEmail('release@driftguard.io');
    } else {
      setActingName(currentUser.name);
      setActingEmail(currentUser.email);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !parameterKey.trim() || !previousValue.trim() || !proposedValue.trim() || !reason.trim()) {
      showToast('Please complete all required Change Request fields.', 'error');
      return;
    }

    const res = await createBackendChangeRequest({
      title: title.trim(),
      environment,
      category,
      parameter_key: parameterKey.trim(),
      previous_value: previousValue.trim(),
      proposed_value: proposedValue.trim(),
      reason: reason.trim(),
      requester_name: actingName,
      requester_email: actingEmail,
      requester_role: actingRole,
    });

    if (res.ok && res.data) {
      setRequests((prev) => [res.data, ...prev]);
      setShowCreateModal(false);
      setTitle('');
      setReason('');
      onAuditLog?.(
        'CHANGE_REQUEST_SUBMITTED',
        `Submitted ${res.data.cr_id} (${res.data.requested_changes}) for ${res.data.environment}.`
      );
      showToast(`Change Request ${res.data.cr_id} submitted for DevOps review.`, 'success');
    } else {
      showToast(res.error || 'Failed to submit Change Request', 'error');
    }
  };

  const handleDevOpsReview = async (cr: any, decision: 'PASS' | 'REJECT') => {
    const notes =
      reviewNotesMap[cr.cr_id] ||
      (decision === 'PASS'
        ? 'Technical DevOps check passed: parameter bounds and cluster capacity verified.'
        : 'Rejected during DevOps technical review.');

    const res = await reviewChangeRequestDevOpsApi(cr.cr_id, {
      decision,
      review_notes: notes,
      reviewer_name: actingName,
      reviewer_email: actingEmail,
      reviewer_role: actingRole,
    });

    if (res.ok && res.data) {
      setRequests((prev) => prev.map((item) => (item.cr_id === cr.cr_id ? res.data : item)));
      onAuditLog?.(
        'CHANGE_REQUEST_DEVOPS_REVIEW',
        `DevOps reviewed ${cr.cr_id}: ${decision}. Status -> ${res.data.approval_status}`
      );
      showToast(`DevOps review recorded for ${cr.cr_id} (${res.data.approval_status}).`, 'info');
    } else {
      showToast(res.error || 'DevOps review rejected by RBAC policy', 'error');
    }
  };

  const handleFinalApproval = async (cr: any, decision: 'APPROVED' | 'REJECTED') => {
    const notes =
      reviewNotesMap[cr.cr_id] ||
      (decision === 'APPROVED'
        ? 'Release Manager sign-off granted under zero-drift governance policy.'
        : 'Release Manager rejected change request.');

    const res = await decideChangeRequestApprovalApi(cr.cr_id, {
      decision,
      approval_notes: notes,
      approver_name: actingName,
      approver_email: actingEmail,
      approver_role: actingRole,
    });

    if (res.ok && res.data) {
      setRequests((prev) => prev.map((item) => (item.cr_id === cr.cr_id ? res.data : item)));
      onAuditLog?.(
        `CHANGE_REQUEST_${decision}`,
        `Change Request ${cr.cr_id} ${decision.toLowerCase()} by ${actingName} (${actingRole}).`
      );
      showToast(`Change Request ${cr.cr_id} ${decision.toLowerCase()}.`, 'success');
    } else {
      showToast(res.error || 'Approval blocked by RBAC / Separation of Duties policy', 'error');
    }
  };

  const filtered = requests.filter((cr) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      cr.cr_id?.toLowerCase().includes(q) ||
      cr.title?.toLowerCase().includes(q) ||
      cr.parameter_key?.toLowerCase().includes(q) ||
      cr.requester_name?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-white tracking-tight flex items-center gap-2.5">
            <GitPullRequest className="w-5 h-5 text-indigo-400" />
            <span>Change Request Governance Workflow</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            3-tier change control: Developer submits request → DevOps performs technical review →
            Release Manager approves or rejects Production changes.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Role Switcher for reviewing RBAC separation of duties */}
          <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs">
            <span className="text-slate-400">Acting Role:</span>
            <select
              aria-label="Acting Governance Role"
              value={actingRole}
              onChange={(e) => handleRolePresetChange(e.target.value)}
              className="bg-transparent text-indigo-300 font-mono font-semibold focus:outline-none"
            >
              <option value="DEVELOPER" className="bg-slate-900">
                DEVELOPER (developer@driftguard.io)
              </option>
              <option value="DEVOPS" className="bg-slate-900">
                DEVOPS (devops@driftguard.io)
              </option>
              <option value="RELEASE_MANAGER" className="bg-slate-900">
                RELEASE_MANAGER (release@driftguard.io)
              </option>
              <option value="ADMIN" className="bg-slate-900">
                ADMIN ({currentUser.email})
              </option>
            </select>
          </div>

          <button
            onClick={loadRequests}
            aria-label="Refresh Change Requests"
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-2 whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>Submit Change Request</span>
          </button>
        </div>
      </div>

      {/* Separation of Duties Policy Banner */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2.5 text-slate-300">
          <ShieldAlert className="w-4 h-4 text-indigo-400 shrink-0" />
          <span>
            <strong>RBAC & Separation of Duties Policy:</strong> Restricted Production change
            requests require DevOps technical review followed by Release Manager approval. Users
            cannot self-approve their own restricted Production requests.
          </span>
        </div>
        <span className="font-mono text-slate-400 whitespace-nowrap">
          Active Operator: {actingName} ({actingRole})
        </span>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-400 font-medium">Env:</span>
          {['ALL', 'production', 'staging', 'development'].map((env) => (
            <button
              key={env}
              onClick={() => setFilterEnv(env)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${
                filterEnv === env
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              {env}
            </button>
          ))}

          <span className="text-xs text-slate-400 font-medium ml-2">Status:</span>
          {['ALL', 'PENDING_DEVOPS_REVIEW', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED'].map((st) => (
            <button
              key={st}
              onClick={() => setFilterStatus(st)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-mono transition-colors ${
                filterStatus === st
                  ? 'bg-slate-800 text-indigo-300 border border-indigo-500/40'
                  : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              {st.replace(/_/g, ' ')}
            </button>
          ))}
        </div>

        <div className="relative w-full lg:w-64">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            aria-label="Search Change Requests"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search CR ID, key, requester..."
            className="w-full pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
          />
        </div>
      </div>

      {/* Change Requests Cards */}
      <div className="space-y-4">
        {loading ? (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center text-xs text-slate-400 animate-pulse">
            Loading change requests...
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center text-xs text-slate-400">
            No change requests match the current filter.
          </div>
        ) : (
          filtered.map((cr) => {
            const status = cr.approval_status;
            const isSelfRequest =
              cr.requester_email?.toLowerCase() === actingEmail.toLowerCase() &&
              cr.environment === 'production';

            return (
              <div
                key={cr.cr_id}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4"
              >
                {/* Top Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs font-semibold text-indigo-400">
                      {cr.cr_id}
                    </span>
                    <span aria-hidden="true" className="text-slate-600">
                      ·
                    </span>
                    <h3 className="text-sm font-semibold text-white">{cr.title}</h3>
                  </div>

                  <div className="flex items-center gap-3 text-xs font-mono">
                    <span className="capitalize text-slate-300">{cr.environment}</span>
                    <span aria-hidden="true" className="text-slate-600">
                      ·
                    </span>
                    <span className="text-amber-400 tabular-nums">Risk: {cr.risk_score}/100</span>
                    <span aria-hidden="true" className="text-slate-600">
                      ·
                    </span>
                    <span
                      className={
                        status === 'APPROVED'
                          ? 'text-emerald-400 font-semibold'
                          : status === 'REJECTED'
                          ? 'text-rose-400 font-semibold'
                          : 'text-amber-400 font-semibold'
                      }
                    >
                      {status}
                    </span>
                  </div>
                </div>

                {/* Parameter Diff Box: Previous vs Proposed Value */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-slate-950/70 border border-slate-800 rounded-xl p-3.5 text-xs font-mono">
                  <div>
                    <div className="text-slate-500 font-sans text-[11px]">
                      Category & Parameter Key
                    </div>
                    <div className="text-indigo-300 font-semibold mt-0.5">
                      {cr.category} · {cr.parameter_key}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500 font-sans text-[11px]">Previous Value</div>
                    <div className="text-rose-300 mt-0.5 break-all">{cr.previous_value}</div>
                  </div>
                  <div>
                    <div className="text-slate-500 font-sans text-[11px]">Proposed Value</div>
                    <div className="text-emerald-300 mt-0.5 flex items-center gap-1.5 break-all">
                      <ArrowRight className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span>{cr.proposed_value}</span>
                    </div>
                  </div>
                </div>

                {/* Reason */}
                <div className="text-xs text-slate-300">
                  <span className="text-slate-400 font-medium">Business / Technical Reason: </span>
                  {cr.reason}
                </div>

                {/* 3-Stage Governance Trail */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-slate-800/80 text-xs">
                  <div className="space-y-0.5">
                    <div className="text-slate-500">01. Submitted By (Developer)</div>
                    <div className="text-slate-200 font-medium">
                      {cr.requester_name} ({cr.requester_email})
                    </div>
                    <div className="text-[11px] font-mono text-slate-500">
                      {cr.created_at ? new Date(cr.created_at).toLocaleString() : 'N/A'}
                    </div>
                  </div>

                  <div className="space-y-0.5">
                    <div className="text-slate-500">02. DevOps Technical Review</div>
                    <div className="text-slate-200 font-medium">
                      {cr.devops_reviewer || 'Pending DevOps Review'}
                    </div>
                    {cr.devops_review_notes && (
                      <div className="text-[11px] text-slate-400">{cr.devops_review_notes}</div>
                    )}
                  </div>

                  <div className="space-y-0.5">
                    <div className="text-slate-500">03. Release Manager Decision</div>
                    <div className="text-slate-200 font-medium">
                      {cr.approver_name
                        ? `${cr.approver_name} (${cr.approver_role})`
                        : 'Pending Final Approval'}
                    </div>
                    {cr.approval_notes && (
                      <div className="text-[11px] text-slate-400">{cr.approval_notes}</div>
                    )}
                  </div>
                </div>

                {/* Action Controls for Active Stage */}
                {(status === 'PENDING_DEVOPS_REVIEW' || status === 'PENDING_APPROVAL') && (
                  <div className="pt-3 border-t border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                    <input
                      type="text"
                      value={reviewNotesMap[cr.cr_id] || ''}
                      onChange={(e) =>
                        setReviewNotesMap((prev) => ({ ...prev, [cr.cr_id]: e.target.value }))
                      }
                      placeholder="Enter review or approval notes..."
                      className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white flex-1"
                    />

                    <div className="flex items-center gap-2">
                      {status === 'PENDING_DEVOPS_REVIEW' && (
                        <>
                          <button
                            onClick={() => handleDevOpsReview(cr, 'PASS')}
                            className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>DevOps Review: Pass</span>
                          </button>
                          <button
                            onClick={() => handleDevOpsReview(cr, 'REJECT')}
                            className="px-3 py-1.5 rounded-lg bg-rose-700 hover:bg-rose-600 text-white text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            <span>DevOps Reject</span>
                          </button>
                        </>
                      )}

                      {status === 'PENDING_APPROVAL' && (
                        <>
                          <button
                            onClick={() => handleFinalApproval(cr, 'APPROVED')}
                            title={
                              isSelfRequest
                                ? 'Separation of Duties: Cannot approve your own Production request'
                                : 'Release Manager Approve'
                            }
                            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Release Manager Approve</span>
                          </button>
                          <button
                            onClick={() => handleFinalApproval(cr, 'REJECTED')}
                            className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            <span>Reject Change</span>
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Create Change Request Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-lg w-full space-y-4">
            <h3 className="text-base font-semibold text-white">
              Submit Configuration Change Request
            </h3>
            <form onSubmit={handleCreate} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-300 mb-1">Request Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Scale Production PostgreSQL Connection Pool"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1">Target Environment</label>
                  <select
                    value={environment}
                    onChange={(e) => setEnvironment(e.target.value as EnvironmentType)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white"
                  >
                    <option value="production">Production</option>
                    <option value="staging">Staging</option>
                    <option value="development">Development</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-300 mb-1">Layer Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white"
                  >
                    <option value="env_variable">Environment Variable</option>
                    <option value="infrastructure">Infrastructure</option>
                    <option value="secret_metadata">Secret Metadata</option>
                    <option value="runtime">Runtime Parameter</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 mb-1">Parameter Key</label>
                <input
                  type="text"
                  value={parameterKey}
                  onChange={(e) => setParameterKey(e.target.value)}
                  placeholder="e.g. MAX_CONNECTIONS or PAYMENT_MODE"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1">Previous Value</label>
                  <input
                    type="text"
                    value={previousValue}
                    onChange={(e) => setPreviousValue(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1">Proposed Value</label>
                  <input
                    type="text"
                    value={proposedValue}
                    onChange={(e) => setProposedValue(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 mb-1">Reason & Justification</label>
                <textarea
                  rows={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Explain why this change is needed and how rollback safety is verified..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white"
                  required
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold"
                >
                  Submit Change Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
