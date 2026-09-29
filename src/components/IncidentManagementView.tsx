import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldAlert,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  RefreshCw,
  Edit3,
} from 'lucide-react';
import {
  fetchIncidents,
  createIncidentApi,
  updateIncidentApi,
} from '../services/apiClient';
import { AuthUser } from '../types';

interface IncidentManagementViewProps {
  currentUser: AuthUser | null;
  showToast?: (msg: string, type?: 'success' | 'warning' | 'error' | 'info') => void;
  onIncidentAuditLog?: (action: string, details: string) => void;
}

const VALID_STATUSES = ['Open', 'Investigating', 'Resolved', 'Closed'] as const;

export function IncidentManagementView({
  currentUser,
  showToast,
  onIncidentAuditLog,
}: IncidentManagementViewProps) {
  const [incidents, setIncidents] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [filterEnv, setFilterEnv] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedIncident, setSelectedIncident] = useState<any | null>(null);
  const [editStatus, setEditStatus] = useState<string>('Investigating');
  const [editAssignee, setEditAssignee] = useState<string>('');
  const [editNotes, setEditNotes] = useState<string>('');
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [newEnv, setNewEnv] = useState<string>('production');
  const [newSeverity, setNewSeverity] = useState<string>('CRITICAL');
  const [newComponent, setNewComponent] = useState<string>('');
  const [newRootCause, setNewRootCause] = useState<string>('');
  const [newAssignee, setNewAssignee] = useState<string>('devops@driftguard.io');
  const [page, setPage] = useState<number>(1);
  const pageSize = 8;

  const loadData = useCallback(async () => {
    setLoading(true);
    const list = await fetchIncidents(
      filterEnv === 'ALL' ? undefined : filterEnv,
      filterStatus === 'ALL' ? undefined : filterStatus
    );
    setIncidents(list);
    setLoading(false);
  }, [filterEnv, filterStatus]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleOpenEdit = (inc: any) => {
    setSelectedIncident(inc);
    setEditStatus(inc.status);
    setEditAssignee(inc.assigned_user);
    setEditNotes(inc.resolution_notes || '');
  };

  const handleSaveIncidentUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedIncident) return;
    const updated = await updateIncidentApi(selectedIncident.incident_id, {
      status: editStatus,
      assigned_user: editAssignee,
      resolution_notes: editNotes,
    });
    if (updated) {
      setIncidents((prev) =>
        prev.map((i) => (i.incident_id === updated.incident_id ? updated : i))
      );
      onIncidentAuditLog?.(
        'INCIDENT_UPDATED',
        `Incident ${updated.incident_id} updated to status '${updated.status}' (Assigned: ${updated.assigned_user}). Notes: ${updated.resolution_notes}`
      );
      showToast?.(`Incident ${updated.incident_id} updated to ${updated.status}.`, 'success');
      setSelectedIncident(null);
    } else {
      showToast?.('Failed to update incident.', 'error');
    }
  };

  const handleQuickStatusChange = async (inc: any, nextStatus: string) => {
    const updated = await updateIncidentApi(inc.incident_id, {
      status: nextStatus,
      resolution_notes:
        inc.resolution_notes ||
        `Status transitioned from ${inc.status} to ${nextStatus} by ${currentUser?.email || 'operator'}.`,
    });
    if (updated) {
      setIncidents((prev) =>
        prev.map((i) => (i.incident_id === updated.incident_id ? updated : i))
      );
      onIncidentAuditLog?.(
        'INCIDENT_STATUS_CHANGE',
        `Incident ${updated.incident_id} transitioned to ${nextStatus}.`
      );
      showToast?.(`Incident ${updated.incident_id} marked ${nextStatus}.`, 'info');
    }
  };

  const handleCreateIncident = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComponent.trim() || !newRootCause.trim()) {
      showToast?.('Affected component and root cause are required.', 'error');
      return;
    }
    const created = await createIncidentApi({
      environment: newEnv,
      severity: newSeverity,
      affected_component: newComponent.trim(),
      root_cause: newRootCause.trim(),
      assigned_user: newAssignee.trim() || 'devops@driftguard.io',
    });
    if (created) {
      setIncidents((prev) => [created, ...prev]);
      setShowCreateModal(false);
      setNewComponent('');
      setNewRootCause('');
      onIncidentAuditLog?.(
        'INCIDENT_CREATED',
        `Created incident ${created.incident_id} [${created.severity}] for ${created.affected_component}.`
      );
      showToast?.(`Incident ${created.incident_id} created and logged.`, 'success');
    } else {
      showToast?.('Failed to create incident.', 'error');
    }
  };

  const filtered = incidents.filter((inc) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      inc.incident_id?.toLowerCase().includes(q) ||
      inc.affected_component?.toLowerCase().includes(q) ||
      inc.root_cause?.toLowerCase().includes(q) ||
      inc.assigned_user?.toLowerCase().includes(q)
    );
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

  const openCount = incidents.filter((i) => i.status === 'Open').length;
  const investigatingCount = incidents.filter((i) => i.status === 'Investigating').length;
  const resolvedCount = incidents.filter(
    (i) => i.status === 'Resolved' || i.status === 'Closed'
  ).length;

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-white tracking-tight flex items-center gap-2.5">
            <ShieldAlert className="w-5 h-5 text-rose-400" />
            <span>Incident Management & Drift Response</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Critical drift events automatically generate tracked incidents with root-cause diagnosis
            and full audit trail persistence.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={loadData}
            aria-label="Refresh Incidents"
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-2 whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>Create Incident</span>
          </button>
        </div>
      </div>

      {/* Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-400">Open Incidents</div>
            <div className="text-xl font-semibold font-mono tabular-nums text-rose-400 mt-1">
              {openCount}
            </div>
          </div>
          <span className="text-xs font-mono text-slate-500">Immediate Triage</span>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-400">Investigating</div>
            <div className="text-xl font-semibold font-mono tabular-nums text-amber-400 mt-1">
              {investigatingCount}
            </div>
          </div>
          <span className="text-xs font-mono text-slate-500">Active Root-Cause</span>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-400">Resolved & Closed</div>
            <div className="text-xl font-semibold font-mono tabular-nums text-emerald-400 mt-1">
              {resolvedCount}
            </div>
          </div>
          <span className="text-xs font-mono text-slate-500">Verified Safe</span>
        </div>
      </div>

      {/* Filters & Search Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-400 font-medium mr-1">Status:</span>
          {['ALL', ...VALID_STATUSES].map((st) => (
            <button
              key={st}
              onClick={() => {
                setFilterStatus(st);
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filterStatus === st
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              {st}
            </button>
          ))}

          <span className="text-xs text-slate-400 font-medium ml-3 mr-1">Env:</span>
          {['ALL', 'production', 'staging', 'development'].map((env) => (
            <button
              key={env}
              onClick={() => {
                setFilterEnv(env);
                setPage(1);
              }}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${
                filterEnv === env
                  ? 'bg-slate-800 text-indigo-300 border border-indigo-500/40'
                  : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              {env}
            </button>
          ))}
        </div>

        <div className="relative w-full lg:w-72">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            aria-label="Search Incidents"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            placeholder="Search ID, component, assignee..."
            className="w-full pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
          />
        </div>
      </div>

      {/* Incidents Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-xs text-slate-400 animate-pulse">
            Loading incidents from database...
          </div>
        ) : paged.length === 0 ? (
          <div className="p-10 text-center space-y-2">
            <CheckCircle2 className="w-6 h-6 text-emerald-400 mx-auto" />
            <div className="text-xs font-semibold text-white">No Matching Incidents</div>
            <p className="text-xs text-slate-400">
              No incidents match the current filter criteria. Critical drifts will automatically
              populate new incidents here.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 bg-slate-950/50">
                  <th className="py-3.5 px-4 font-medium">Incident ID</th>
                  <th className="py-3.5 px-4 font-medium">Environment</th>
                  <th className="py-3.5 px-4 font-medium">Severity</th>
                  <th className="py-3.5 px-4 font-medium">Affected Component</th>
                  <th className="py-3.5 px-4 font-medium">Root Cause & Notes</th>
                  <th className="py-3.5 px-4 font-medium">Assigned User</th>
                  <th className="py-3.5 px-4 font-medium">Status</th>
                  <th className="py-3.5 px-4 font-medium">Created</th>
                  <th className="py-3.5 px-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {paged.map((inc) => (
                  <tr key={inc.incident_id} className="hover:bg-slate-800/40 align-top">
                    <td className="py-3.5 px-4 font-mono font-semibold text-indigo-300 whitespace-nowrap">
                      {inc.incident_id}
                    </td>
                    <td className="py-3.5 px-4 capitalize text-slate-200 whitespace-nowrap">
                      {inc.environment}
                    </td>
                    <td className="py-3.5 px-4 font-mono whitespace-nowrap">
                      <span
                        className={
                          inc.severity === 'CRITICAL'
                            ? 'text-rose-400 font-semibold'
                            : inc.severity === 'HIGH'
                            ? 'text-amber-400 font-semibold'
                            : 'text-slate-300'
                        }
                      >
                        {inc.severity}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-white font-medium max-w-[200px]">
                      {inc.affected_component}
                    </td>
                    <td className="py-3.5 px-4 text-slate-300 max-w-xs space-y-1">
                      <div>{inc.root_cause}</div>
                      {inc.resolution_notes && (
                        <div className="text-[11px] text-slate-400 font-mono">
                          Notes: {inc.resolution_notes}
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-300 whitespace-nowrap">
                      {inc.assigned_user}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap font-mono">
                      <span
                        className={
                          inc.status === 'Open'
                            ? 'text-rose-400 font-semibold'
                            : inc.status === 'Investigating'
                            ? 'text-amber-400 font-semibold'
                            : inc.status === 'Resolved'
                            ? 'text-emerald-400 font-semibold'
                            : 'text-slate-400 font-semibold'
                        }
                      >
                        {inc.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-mono tabular-nums text-slate-400 whitespace-nowrap">
                      {inc.created_at ? new Date(inc.created_at).toLocaleString() : 'N/A'}
                    </td>
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        {inc.status === 'Open' && (
                          <button
                            onClick={() => handleQuickStatusChange(inc, 'Investigating')}
                            className="px-2 py-1 rounded bg-amber-950/80 hover:bg-amber-900 text-amber-300 border border-amber-800 text-[11px] font-medium"
                          >
                            Investigate
                          </button>
                        )}
                        {(inc.status === 'Open' || inc.status === 'Investigating') && (
                          <button
                            onClick={() => handleQuickStatusChange(inc, 'Resolved')}
                            className="px-2 py-1 rounded bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border border-emerald-800 text-[11px] font-medium"
                          >
                            Resolve
                          </button>
                        )}
                        {inc.status === 'Resolved' && (
                          <button
                            onClick={() => handleQuickStatusChange(inc, 'Closed')}
                            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-medium"
                          >
                            Close
                          </button>
                        )}
                        <button
                          onClick={() => handleOpenEdit(inc)}
                          aria-label={`Edit ${inc.incident_id}`}
                          className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="p-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <span>
              Page {page} of {totalPages} ({filtered.length} incidents)
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

      {/* Edit Incident Modal */}
      {selectedIncident && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-lg w-full space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-white">
                Update Incident {selectedIncident.incident_id}
              </h3>
              <span className="text-xs font-mono text-slate-400">
                {selectedIncident.affected_component}
              </span>
            </div>

            <form onSubmit={handleSaveIncidentUpdate} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 mb-1">Resolution Status</label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white"
                >
                  {VALID_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 mb-1">Assigned User</label>
                <input
                  type="text"
                  value={editAssignee}
                  onChange={(e) => setEditAssignee(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1">Resolution Notes</label>
                <textarea
                  rows={3}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="Document remediation steps, root cause verification, or rollback details..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedIncident(null)}
                  className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold"
                >
                  Save & Record Audit Log
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Incident Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-lg w-full space-y-4">
            <h3 className="text-base font-semibold text-white">Create Configuration Incident</h3>
            <form onSubmit={handleCreateIncident} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1">Environment</label>
                  <select
                    value={newEnv}
                    onChange={(e) => setNewEnv(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white"
                  >
                    <option value="production">Production</option>
                    <option value="staging">Staging</option>
                    <option value="development">Development</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-300 mb-1">Severity</label>
                  <select
                    value={newSeverity}
                    onChange={(e) => setNewSeverity(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white"
                  >
                    <option value="CRITICAL">CRITICAL</option>
                    <option value="HIGH">HIGH</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="LOW">LOW</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 mb-1">Affected Component</label>
                <input
                  type="text"
                  value={newComponent}
                  onChange={(e) => setNewComponent(e.target.value)}
                  placeholder="e.g. Environment Variable (PAYMENT_MODE)"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1">Root Cause</label>
                <textarea
                  rows={3}
                  value={newRootCause}
                  onChange={(e) => setNewRootCause(e.target.value)}
                  placeholder="Describe the configuration mismatch and impact..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1">Assigned User</label>
                <input
                  type="text"
                  value={newAssignee}
                  onChange={(e) => setNewAssignee(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono"
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
                  Create Incident
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
