import React from 'react';
import {
  X,
  Zap,
  RotateCcw,
  Flame,
  AlertOctagon,
  AlertTriangle,
  Server,
  Variable,
  Key,
  Activity,
  ArrowRight,
} from 'lucide-react';
import { InjectedScenario, DriftCategory, EnvironmentState } from '../types';
import { PRESET_SCENARIOS } from '../services/store';

interface SimulatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  environments?: EnvironmentState[];
  onInjectScenario: (scenario: InjectedScenario) => void;
  onResetCleanState?: () => void;
}

export const SimulatorModal: React.FC<SimulatorModalProps> = ({
  isOpen,
  onClose,
  onInjectScenario,
  onResetCleanState = () => {},
}) => {
  if (!isOpen) return null;

  const getCategoryIcon = (cat: DriftCategory) => {
    switch (cat) {
      case 'infrastructure':
        return <Server className="w-4 h-4 text-blue-500" />;
      case 'env_variable':
        return <Variable className="w-4 h-4 text-purple-500" />;
      case 'secret_metadata':
        return <Key className="w-4 h-4 text-amber-500" />;
      case 'runtime':
        return <Activity className="w-4 h-4 text-emerald-500" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-amber-100 text-amber-800">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Drift Injection & Flash-Sale Failure Scenarios
              </h2>
              <p className="text-xs text-slate-500">
                Simulate real-world configuration drifts to test the automated Gatekeeper's response
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

        {/* Scenarios List */}
        <div className="p-6 overflow-y-auto space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Pre-Configured Real-World Failure Scenarios
            </span>
            <button
              onClick={() => {
                onResetCleanState();
                onClose();
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-xs transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
              <span>Reset All to Pristine State</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {PRESET_SCENARIOS.map((scen) => (
              <div
                key={scen.id}
                className="border border-slate-200 rounded-xl p-4 bg-white hover:border-amber-300 hover:shadow-xs transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="flex items-center gap-1 text-[11px] font-medium text-slate-500 capitalize">
                      {getCategoryIcon(scen.category)}
                      {scen.category.replace('_', ' ')}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        scen.severity === 'CRITICAL'
                          ? 'bg-rose-100 text-rose-700 border border-rose-200'
                          : 'bg-amber-100 text-amber-800 border border-amber-200'
                      }`}
                    >
                      {scen.severity}
                    </span>
                  </div>

                  <h3 className="text-sm font-bold text-slate-900 mb-1">
                    {scen.title}
                  </h3>
                  <p className="text-xs text-slate-600 mb-2.5 leading-relaxed">
                    {scen.description}
                  </p>

                  <div className="bg-rose-50/70 border border-rose-100 rounded-lg p-2.5 text-[11px] text-rose-900 mb-3 flex items-start gap-1.5">
                    <Flame className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
                    <div>
                      <strong className="font-semibold">Flash Sale Hazard:</strong>{' '}
                      {scen.flashSaleRisk}
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => {
                    onInjectScenario(scen);
                    onClose();
                  }}
                  className="w-full inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-xs transition-colors"
                >
                  <span>Inject This Drift into Production</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-100 bg-slate-50/80 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
