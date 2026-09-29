import React, { useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  Search,
  Filter,
  ArrowRight,
  Server,
  Variable,
  Key,
  Activity,
  Layers,
  Sparkles,
  Wrench,
} from 'lucide-react';
import { EnvironmentState, DriftCategory } from '../types';
import { INITIAL_ENVIRONMENTS } from '../services/store';

interface ConfigComparisonViewProps {
  environment?: EnvironmentState;
  environments?: EnvironmentState[];
  selectedEnv?: EnvironmentState;
  onReconcileKey?: (domain: DriftCategory, key: string, targetValue: any) => void;
  onReconcileSingle?: (drift: any) => void;
  onReconcileAll?: () => void;
  onPromoteBaseline?: (drift: any) => void;
}

interface ComparisonRow {
  domain: DriftCategory;
  key: string;
  expectedValue: any;
  actualValue: any;
  isMatch: boolean;
  severity?: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
}

export const ConfigComparisonView: React.FC<ConfigComparisonViewProps> = ({
  environment,
  environments,
  selectedEnv,
  onReconcileKey,
  onReconcileSingle,
  onReconcileAll,
  onPromoteBaseline,
}) => {
  const envList = environments || (environment ? [environment] : []);
  const [activeEnvName, setActiveEnvName] = useState<string>(() => {
    return (
      environment?.name ||
      selectedEnv?.name ||
      (environments && environments[0]?.name) ||
      'production'
    );
  });

  const activeEnvironment: EnvironmentState =
    (envList.length > 0
      ? envList.find((e) => e.name === activeEnvName) || envList[0]
      : null) ||
    environment ||
    selectedEnv ||
    INITIAL_ENVIRONMENTS[0];

  const handleSyncRow = (row: ComparisonRow) => {
    if (onReconcileKey) {
      onReconcileKey(row.domain, row.key, row.expectedValue);
    } else if (onReconcileSingle) {
      onReconcileSingle({
        id: `drift-${row.key}`,
        environmentId: activeEnvironment.id,
        environmentName: activeEnvironment.name,
        category: row.domain,
        key: row.key,
        expectedValue: row.expectedValue,
        actualValue: row.actualValue,
        severity: row.severity || 'MEDIUM',
        detectedAt: new Date().toISOString(),
        impactSummary: `Reconcile ${row.key} to baseline`,
      });
    }
  };

  const [selectedDomain, setSelectedDomain] = useState<string>('all');
  const [filterMismatchOnly, setFilterMismatchOnly] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Flatten all expected vs actual configuration into comparison rows
  const rows: ComparisonRow[] = [];

  // 1. Env Variables
  const expEnv = activeEnvironment.expected?.envVars || {};
  const actEnv = activeEnvironment.actual?.envVars || {};
  const allEnvKeys = Array.from(
    new Set([
      ...Object.keys(expEnv),
      ...Object.keys(actEnv),
    ])
  );
  allEnvKeys.forEach((key) => {
    const exp = expEnv[key];
    const act = actEnv[key];
    const isMatch = exp === act;
    let severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' = 'MEDIUM';
    if (key.includes('PAYMENT') || key.includes('GATEWAY') || key.includes('LIMITER')) {
      severity = 'CRITICAL';
    } else if (key.includes('TTL') || key.includes('CACHE') || key.includes('API_URL')) {
      severity = 'HIGH';
    } else if (key.includes('LOG_LEVEL')) {
      severity = 'LOW';
    }
    rows.push({
      domain: 'env_variable',
      key,
      expectedValue: exp ?? '<undefined>',
      actualValue: act ?? '<undefined>',
      isMatch,
      severity,
    });
  });

  // 2. Infrastructure
  const expInfra = (activeEnvironment.expected?.infrastructure || {}) as any;
  const actInfra = (activeEnvironment.actual?.infrastructure || {}) as any;
  const allInfraKeys = Array.from(
    new Set([
      ...Object.keys(expInfra),
      ...Object.keys(actInfra),
    ])
  );
  allInfraKeys.forEach((key) => {
    const exp = expInfra[key];
    const act = actInfra[key];
    const isMatch = exp === act;
    let severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' = 'MEDIUM';
    if (key === 'replicas' || key === 'maxDbConnections') {
      severity = 'CRITICAL';
    } else if (key === 'readReplicaEnabled') {
      severity = 'HIGH';
    }
    rows.push({
      domain: 'infrastructure',
      key,
      expectedValue: exp !== undefined ? String(exp) : '<undefined>',
      actualValue: act !== undefined ? String(act) : '<undefined>',
      isMatch,
      severity,
    });
  });

  // 3. Secrets Metadata
  const expSec = activeEnvironment.expected?.secrets || {};
  const actSec = activeEnvironment.actual?.secrets || {};
  const allSecretKeys = Array.from(
    new Set([
      ...Object.keys(expSec),
      ...Object.keys(actSec),
    ])
  );
  allSecretKeys.forEach((key) => {
    const exp = expSec[key];
    const act = actSec[key];
    const isMatch = exp?.version === act?.version && exp?.status === act?.status;
    rows.push({
      domain: 'secret_metadata',
      key,
      expectedValue: exp ? `v${exp.version} (${exp.status})` : '<deleted>',
      actualValue: act ? `v${act.version} (${act.status})` : '<missing>',
      isMatch,
      severity: 'CRITICAL',
    });
  });

  // 4. Runtime
  const expRun = (activeEnvironment.expected?.runtime || {}) as any;
  const actRun = (activeEnvironment.actual?.runtime || {}) as any;
  const allRuntimeKeys = Array.from(
    new Set([
      ...Object.keys(expRun),
      ...Object.keys(actRun),
    ])
  );
  allRuntimeKeys.forEach((key) => {
    const exp = expRun[key];
    const act = actRun[key];
    const isMatch = exp === act;
    rows.push({
      domain: 'runtime',
      key,
      expectedValue: exp !== undefined ? String(exp) : '<undefined>',
      actualValue: act !== undefined ? String(act) : '<undefined>',
      isMatch,
      severity: key === 'paymentMode' || key === 'rateLimiterEnabled' ? 'CRITICAL' : 'MEDIUM',
    });
  });

  // Filter rows
  const filteredRows = rows.filter((row) => {
    if (selectedDomain !== 'all' && row.domain !== selectedDomain) return false;
    if (filterMismatchOnly && row.isMatch) return false;
    if (searchTerm.trim() !== '') {
      const q = searchTerm.toLowerCase();
      return (
        row.key.toLowerCase().includes(q) ||
        String(row.expectedValue).toLowerCase().includes(q) ||
        String(row.actualValue).toLowerCase().includes(q)
      );
    }
    return true;
  });

  const totalMismatches = rows.filter((r) => !r.isMatch).length;
  const totalMatches = rows.filter((r) => r.isMatch).length;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
      {/* Top Banner */}
      <div className="p-4 sm:px-6 border-b border-slate-200 bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-slate-900">
              Side-by-Side Configuration Comparison
            </h2>
            {envList.length > 1 ? (
              <select
                value={activeEnvironment.name}
                onChange={(e) => setActiveEnvName(e.target.value)}
                className="text-xs font-mono font-bold bg-white border border-slate-300 rounded px-2 py-1 text-slate-800"
              >
                {envList.map((e) => (
                  <option key={e.name} value={e.name}>
                    {e.displayName}
                  </option>
                ))}
              </select>
            ) : (
              <span className="text-xs font-mono font-bold bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full">
                {activeEnvironment.displayName}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Explicit matrix verification: Expected GitOps baseline vs live running configuration
          </p>
        </div>

        <div className="flex items-center gap-2">
          {totalMismatches > 0 && onReconcileAll && (
            <button
              onClick={onReconcileAll}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition-colors"
            >
              <Wrench className="w-3.5 h-3.5" />
              <span>Reconcile All Mismatches ({totalMismatches})</span>
            </button>
          )}
        </div>
      </div>

      {/* Summary KPI Badges */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 border-b border-slate-100 bg-slate-50/30">
        <div className="bg-white p-3 rounded-lg border border-slate-200/80">
          <div className="text-[11px] font-semibold text-slate-500 uppercase">Total Keys</div>
          <div className="text-lg font-bold font-mono text-slate-900">{rows.length}</div>
        </div>
        <div className="bg-white p-3 rounded-lg border border-emerald-200">
          <div className="text-[11px] font-semibold text-emerald-700 uppercase flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            Matched Keys ✅
          </div>
          <div className="text-lg font-bold font-mono text-emerald-700">{totalMatches}</div>
        </div>
        <div className="bg-white p-3 rounded-lg border border-rose-200">
          <div className="text-[11px] font-semibold text-rose-700 uppercase flex items-center gap-1">
            <XCircle className="w-3 h-3 text-rose-600" />
            Mismatches ❌
          </div>
          <div className="text-lg font-bold font-mono text-rose-700">{totalMismatches}</div>
        </div>
        <div className="bg-white p-3 rounded-lg border border-slate-200/80">
          <div className="text-[11px] font-semibold text-slate-500 uppercase">Consistency</div>
          <div className="text-lg font-bold font-mono text-slate-900">
            {Math.round((totalMatches / (rows.length || 1)) * 100)}%
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Domain selector tabs */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 md:pb-0">
          {[
            { id: 'all', label: 'All Domains' },
            { id: 'env_variable', label: 'Env Variables' },
            { id: 'infrastructure', label: 'Infrastructure' },
            { id: 'secret_metadata', label: 'Secrets' },
            { id: 'runtime', label: 'Runtime' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedDomain(tab.id)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
                selectedDomain === tab.id
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Right filters */}
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={filterMismatchOnly}
              onChange={(e) => setFilterMismatchOnly(e.target.checked)}
              className="rounded text-indigo-600 focus:ring-indigo-500"
            />
            <span className="font-medium text-rose-600">Show Mismatches Only (❌)</span>
          </label>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search key or value..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg w-44 sm:w-52 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>
      </div>

      {/* Explicit Side-by-Side Comparison Matrix */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse font-sans">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-100/70 text-[11px] font-bold text-slate-700 uppercase tracking-wider">
              <th className="py-3 px-4 w-1/4">CONFIGURATION KEY</th>
              <th className="py-3 px-4 w-1/3">
                <span className="text-emerald-700">EXPECTED (Golden Baseline)</span>
              </th>
              <th className="py-3 px-4 w-1/3">
                <span className="text-slate-700">ACTUAL (Live Running)</span>
              </th>
              <th className="py-3 px-4 text-center w-24">STATUS</th>
              <th className="py-3 px-4 text-right w-24">ACTION</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs">
            {filteredRows.map((row) => (
              <tr
                key={`${row.domain}-${row.key}`}
                className={`transition-colors ${
                  !row.isMatch
                    ? 'bg-rose-50/40 hover:bg-rose-50/70'
                    : 'hover:bg-slate-50/60'
                }`}
              >
                {/* Configuration Key */}
                <td className="py-3 px-4">
                  <div className="font-mono font-bold text-slate-900 text-xs">
                    {row.key}
                  </div>
                  <div className="text-[10px] text-slate-500 capitalize">
                    {row.domain.replace('_', ' ')}
                  </div>
                </td>

                {/* Expected Value */}
                <td className="py-3 px-4">
                  <div className="inline-block font-mono text-[11px] bg-emerald-50 text-emerald-900 border border-emerald-200 px-2 py-1 rounded max-w-sm break-all font-semibold">
                    {row.expectedValue}
                  </div>
                </td>

                {/* Actual Value */}
                <td className="py-3 px-4">
                  <div
                    className={`inline-block font-mono text-[11px] px-2 py-1 rounded max-w-sm break-all font-semibold ${
                      row.isMatch
                        ? 'bg-slate-100 text-slate-800 border border-slate-200'
                        : 'bg-rose-100 text-rose-900 border border-rose-300'
                    }`}
                  >
                    {row.actualValue}
                  </div>
                </td>

                {/* Status Indicator */}
                <td className="py-3 px-4 text-center whitespace-nowrap">
                  {row.isMatch ? (
                    <span className="inline-flex items-center gap-1 font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded text-xs">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      ✅
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 font-bold text-rose-600 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded text-xs">
                      <XCircle className="w-3.5 h-3.5" />
                      ❌
                    </span>
                  )}
                </td>

                {/* Action button */}
                <td className="py-3 px-4 text-right whitespace-nowrap">
                  {!row.isMatch ? (
                    <button
                      onClick={() => handleSyncRow(row)}
                      className="text-[11px] bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold px-2.5 py-1 rounded border border-indigo-200 transition-colors"
                      title="Sync live actual value to expected golden baseline"
                    >
                      Sync
                    </button>
                  ) : (
                    <span className="text-[11px] text-slate-400 font-mono">OK</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
