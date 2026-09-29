import React from 'react';
import { FlaskConical, CheckCircle2, AlertTriangle, Play, Pause } from 'lucide-react';
import { AuthUser, ExperimentItem } from '../types';
import { INITIAL_EXPERIMENTS } from '../services/settingsService';

interface ExperimentsViewProps {
  currentUser: AuthUser;
}

export function ExperimentsView({ currentUser }: ExperimentsViewProps) {
  const experiments: ExperimentItem[] = INITIAL_EXPERIMENTS;

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2.5">
          <FlaskConical className="w-5 h-5 text-indigo-400" />
          <span>Canary Experiments & Feature Flags</span>
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Safely route subset traffic across configuration variants during flash sale ramp-ups.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {experiments.map((exp) => (
          <div
            key={exp.id}
            className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="px-2 py-0.5 rounded-md bg-indigo-950 text-indigo-300 border border-indigo-800 font-mono text-[10px] font-bold">
                  {exp.id} &bull; {exp.environment.toUpperCase()}
                </span>
                <h3 className="text-sm font-bold text-white mt-1.5">{exp.name}</h3>
              </div>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase font-mono ${
                  exp.status === 'RUNNING'
                    ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                    : 'bg-slate-800 text-slate-400 border border-slate-700'
                }`}
              >
                {exp.status}
              </span>
            </div>

            <div className="space-y-2 text-xs font-mono bg-slate-950/60 p-3 rounded-xl border border-slate-800">
              <div className="text-slate-400">
                <strong className="text-slate-200">Variant A:</strong> {exp.variantA}
              </div>
              <div className="text-indigo-300">
                <strong className="text-white">Variant B ({exp.trafficSplitPct}% Traffic):</strong>{' '}
                {exp.variantB}
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs text-slate-400">
              <span>
                Drift Impact:{' '}
                <strong className="text-emerald-400 font-mono">{exp.impactOnDrift}</strong>
              </span>
              <span className="font-mono text-slate-500">Auto-rollback on &gt;1% 5xx</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
