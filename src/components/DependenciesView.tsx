import React, { useState, useEffect } from 'react';
import { Network, CheckCircle2, AlertTriangle, Activity, RefreshCw, ShieldAlert, Zap, Layers } from 'lucide-react';
import { AuthUser, DependencyItem } from '../types';
import { INITIAL_DEPENDENCIES } from '../services/settingsService';
import { fetchDependencyGraph, DependencyGraphResponse } from '../services/apiClient';

interface DependenciesViewProps {
  currentUser: AuthUser;
}

export function DependenciesView({ currentUser }: DependenciesViewProps) {
  const [selectedEnv, setSelectedEnv] = useState<string>('production');
  const [graphData, setGraphData] = useState<DependencyGraphResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [fallbackDependencies, setFallbackDependencies] = useState<DependencyItem[]>(INITIAL_DEPENDENCIES);

  const loadGraph = async (env: string) => {
    setLoading(true);
    try {
      const res = await fetchDependencyGraph(env);
      if (res) {
        setGraphData(res);
      }
    } catch {
      // Keep fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGraph(selectedEnv);
  }, [selectedEnv]);

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2.5">
              <Network className="w-5 h-5 text-indigo-400" />
              <span>Microservice Dependency Graph & Version Health</span>
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Live dependency topology, blast radius analysis, and contract version invariants evaluated by FastAPI backend.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={selectedEnv}
              onChange={(e) => setSelectedEnv(e.target.value)}
              className="bg-slate-950 border border-slate-800 text-xs text-slate-200 rounded-xl px-3 py-2 font-mono"
            >
              <option value="production">production (US-East)</option>
              <option value="staging">staging (EU-West)</option>
              <option value="development">development (Local)</option>
            </select>
            <button
              onClick={() => loadGraph(selectedEnv)}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
              title="Refresh Graph"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Blast Radius Summary Cards */}
        {graphData && (() => {
          const totalNodes = graphData.blast_radius_summary?.total_services ?? (graphData as any).total_nodes ?? (graphData.nodes?.length || 0);
          const criticalDeps = graphData.blast_radius_summary?.critical_dependencies ?? ((graphData as any).edges?.length || graphData.links?.length || 0);
          const driftedServices = graphData.blast_radius_summary?.drifted_services ?? (graphData as any).impacted_nodes ?? (graphData.nodes?.filter((n: any) => n.has_drift || n.is_drifted).length || 0);
          const impactLevel = graphData.blast_radius_summary?.impact_level ?? (driftedServices > 0 ? 'CRITICAL' : 'LOW');
          return (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-4 border-t border-slate-800/80 text-xs">
              <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                <span className="text-slate-400 block text-[10px]">Total Nodes</span>
                <strong className="text-white text-base font-mono">{totalNodes}</strong>
              </div>
              <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                <span className="text-slate-400 block text-[10px]">Critical Paths</span>
                <strong className="text-indigo-400 text-base font-mono">{criticalDeps}</strong>
              </div>
              <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                <span className="text-slate-400 block text-[10px]">Drifted Services</span>
                <strong className={`text-base font-mono ${driftedServices > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                  {driftedServices}
                </strong>
              </div>
              <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                <span className="text-slate-400 block text-[10px]">Blast Radius</span>
                <strong className={`text-base font-bold ${impactLevel === 'CRITICAL' ? 'text-rose-400' : 'text-emerald-400'}`}>
                  {impactLevel}
                </strong>
              </div>
            </div>
          );
        })()}
      </div>

      {/* Nodes Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between">
          <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
            <Layers className="w-3.5 h-3.5 text-indigo-400" />
            <span>Topological Service Nodes ({graphData?.nodes ? graphData.nodes.length : fallbackDependencies.length})</span>
          </span>
          <span className="text-[10px] text-slate-500 font-mono">
            {graphData ? 'Source: FastAPI /api/dependencies/graph' : 'Source: Local Baseline'}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 uppercase tracking-wider font-semibold text-[10px]">
              <tr>
                <th className="px-5 py-3.5">Service Name</th>
                <th className="px-5 py-3.5">Type</th>
                <th className="px-5 py-3.5">Live Version</th>
                <th className="px-5 py-3.5">Expected Version</th>
                <th className="px-5 py-3.5">Latency</th>
                <th className="px-5 py-3.5">Health State</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 text-slate-300">
              {graphData?.nodes
                ? graphData.nodes.map((node: any) => {
                    const hasDrift = Boolean(node.has_drift ?? node.is_drifted ?? (node.status && node.status !== 'HEALTHY'));
                    const nodeName = node.name || node.label || node.id;
                    const liveVer = node.version || (hasDrift ? 'v2.3.1-drifted' : 'v2.4.0');
                    const expectedVer = node.expected_version || 'v2.4.0';
                    return (
                      <tr key={node.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="px-5 py-3.5 font-sans">
                          <div className="font-bold text-white">{nodeName}</div>
                          <div className="text-[10px] text-slate-500 font-mono truncate">{node.id}</div>
                        </td>

                        <td className="px-5 py-3.5 uppercase text-slate-400">{node.type || node.category}</td>

                        <td className="px-5 py-3.5 font-bold text-white">{liveVer}</td>

                        <td className="px-5 py-3.5">
                          <span className={hasDrift ? 'text-amber-400 font-bold' : 'text-slate-400'}>
                            {expectedVer}
                          </span>
                        </td>

                        <td className="px-5 py-3.5">
                          <span className="flex items-center gap-1.5 text-slate-300">
                            <Activity className="w-3 h-3 text-indigo-400" />
                            {node.latency_ms ?? 14}ms
                          </span>
                        </td>

                        <td className="px-5 py-3.5">
                          {hasDrift ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-950/80 text-amber-400 border border-amber-800">
                              <AlertTriangle className="w-3 h-3" />
                              VERSION DRIFT
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-400 border border-emerald-800">
                              <CheckCircle2 className="w-3 h-3" />
                              HEALTHY
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                : fallbackDependencies.map((dep) => {
                    const isDrifted = dep.status === 'DRIFTED';
                    return (
                      <tr key={dep.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="px-5 py-3.5 font-sans">
                          <div className="font-bold text-white">{dep.service}</div>
                          <div className="text-[10px] text-slate-500 font-mono truncate">{dep.endpoint}</div>
                        </td>

                        <td className="px-5 py-3.5 uppercase text-slate-400">{dep.environment}</td>

                        <td className="px-5 py-3.5 font-bold text-white">{dep.version}</td>

                        <td className="px-5 py-3.5">
                          <span className={isDrifted ? 'text-amber-400 font-bold' : 'text-slate-400'}>
                            {dep.expectedVersion}
                          </span>
                        </td>

                        <td className="px-5 py-3.5">
                          <span className="flex items-center gap-1.5 text-slate-300">
                            <Activity className="w-3 h-3 text-indigo-400" />
                            {dep.latencyMs}ms
                          </span>
                        </td>

                        <td className="px-5 py-3.5">
                          {isDrifted ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-950/80 text-amber-400 border border-amber-800">
                              <AlertTriangle className="w-3 h-3" />
                              VERSION DRIFT
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-400 border border-emerald-800">
                              <CheckCircle2 className="w-3 h-3" />
                              HEALTHY
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
    </div>
  );
}

