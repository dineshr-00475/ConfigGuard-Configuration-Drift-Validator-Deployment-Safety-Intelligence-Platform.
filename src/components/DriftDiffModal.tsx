import React from 'react';
import { X, Wrench, AlertTriangle, AlertOctagon, Info, ArrowRight, ShieldAlert } from 'lucide-react';
import { DriftRecord, EnvironmentState } from '../types';

interface DriftDiffModalProps {
  isOpen: boolean;
  onClose: () => void;
  drift: DriftRecord | null;
  environment?: EnvironmentState;
  onReconcile: (drift: DriftRecord) => void;
  onPromoteBaseline?: (drift: DriftRecord) => void;
}

export const DriftDiffModal: React.FC<DriftDiffModalProps> = ({
  isOpen,
  onClose,
  drift,
  environment,
  onReconcile,
  onPromoteBaseline,
}) => {
  if (!isOpen || !drift) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-xl w-full flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-indigo-100 text-indigo-700 font-mono text-xs font-bold">
              DIFF
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Configuration Differential Inspection
              </h2>
              <span className="font-mono text-xs text-slate-500">
                {drift.category} / {drift.key}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Side-by-Side Diff */}
          <div className="grid grid-cols-2 gap-3">
            {/* Expected */}
            <div className="border border-emerald-200 rounded-xl p-3.5 bg-emerald-50/50">
              <div className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                <span>Expected (GitOps)</span>
                <span className="text-[10px] bg-emerald-100 px-1.5 py-0.5 rounded font-mono">
                  Golden Spec
                </span>
              </div>
              <pre className="text-xs font-mono font-bold text-emerald-950 bg-white p-2.5 rounded-lg border border-emerald-100 overflow-x-auto whitespace-pre-wrap break-all">
                {String(drift.expectedValue)}
              </pre>
            </div>

            {/* Actual */}
            <div className="border border-rose-200 rounded-xl p-3.5 bg-rose-50/50">
              <div className="text-[11px] font-bold text-rose-800 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                <span>Actual (Live Cluster)</span>
                <span className="text-[10px] bg-rose-100 px-1.5 py-0.5 rounded font-mono">
                  Runtime State
                </span>
              </div>
              <pre className="text-xs font-mono font-bold text-rose-950 bg-white p-2.5 rounded-lg border border-rose-100 overflow-x-auto whitespace-pre-wrap break-all">
                {String(drift.actualValue)}
              </pre>
            </div>
          </div>

          {/* Severity & Impact Breakdown */}
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-500 font-medium">Assigned Severity</span>
              <span
                className={`font-bold font-mono text-[11px] px-2 py-0.5 rounded-full ${
                  drift.severity === 'CRITICAL'
                    ? 'bg-rose-100 text-rose-700'
                    : drift.severity === 'HIGH'
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-slate-100 text-slate-700'
                }`}
              >
                {drift.severity}
              </span>
            </div>

            <div>
              <span className="text-slate-500 block mb-0.5 font-medium">Detection Cause:</span>
              <p className="text-slate-800 font-semibold">{drift.reason}</p>
            </div>

            <div>
              <span className="text-slate-500 block mb-0.5 font-medium">E-Commerce Flash Sale Impact:</span>
              <p className="text-slate-700 leading-relaxed">{drift.impact}</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-100 bg-slate-50/80 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onReconcile(drift);
              onClose();
            }}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs transition-colors"
          >
            <Wrench className="w-3.5 h-3.5" />
            <span>Reconcile to Expected Value</span>
          </button>
        </div>
      </div>
    </div>
  );
};
