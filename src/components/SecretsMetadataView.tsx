import React, { useState } from 'react';
import {
  KeyRound,
  ShieldCheck,
  AlertTriangle,
  RotateCw,
  Clock,
  CheckCircle2,
  Lock,
} from 'lucide-react';
import { AuthUser, SecretMetadataItem } from '../types';
import { INITIAL_SECRETS_METADATA } from '../services/settingsService';
import { canUser } from '../services/authService';

interface SecretsMetadataViewProps {
  currentUser: AuthUser;
  showToast: (msg: string, type?: 'success' | 'warning' | 'error' | 'info') => void;
}

export function SecretsMetadataView({ currentUser, showToast }: SecretsMetadataViewProps) {
  const [secrets, setSecrets] = useState<SecretMetadataItem[]>(INITIAL_SECRETS_METADATA);
  const canRotate = canUser(currentUser.role, 'FIX_CONFIGURATION');

  const handleRotate = (id: string) => {
    if (!canRotate) {
      showToast('Only DevOps or Admin can rotate KMS secrets', 'error');
      return;
    }

    setSecrets((prev) =>
      prev.map((s) => {
        if (s.id === id) {
          return {
            ...s,
            currentVersion: s.expectedVersion,
            status: 'active',
            daysUntilExpiry: 90,
            lastRotated: new Date().toISOString().split('T')[0],
          };
        }
        return s;
      })
    );
    showToast('Secret rotated and synchronized to latest KMS version', 'success');
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2.5">
          <KeyRound className="w-5 h-5 text-indigo-400" />
          <span>KMS Secrets Metadata & Version Governance</span>
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Zero-plaintext metadata catalog. Track cryptographic version drift, expiration windows, and KMS key ARNs.
        </p>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 uppercase tracking-wider font-semibold font-mono text-[10px]">
              <tr>
                <th className="px-5 py-3.5">Secret Key Name</th>
                <th className="px-5 py-3.5">Environment</th>
                <th className="px-5 py-3.5">Active Ver</th>
                <th className="px-5 py-3.5">Expected Ver</th>
                <th className="px-5 py-3.5">Expiry Window</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 text-slate-300 font-mono">
              {secrets.map((sec) => {
                const isDrifted = sec.currentVersion !== sec.expectedVersion;
                const isExpiring = sec.daysUntilExpiry <= 7;

                return (
                  <tr key={sec.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="font-bold text-white flex items-center gap-2">
                        <Lock className="w-3.5 h-3.5 text-indigo-400" />
                        <span>{sec.name}</span>
                      </div>
                      <div className="text-[10px] text-slate-500 truncate max-w-xs">{sec.kmsKeyId}</div>
                    </td>

                    <td className="px-5 py-3.5 uppercase text-slate-400">{sec.environment}</td>

                    <td className="px-5 py-3.5 font-bold text-white">v{sec.currentVersion}</td>

                    <td className="px-5 py-3.5">
                      <span className={isDrifted ? 'text-amber-400 font-bold' : 'text-slate-400'}>
                        v{sec.expectedVersion}
                      </span>
                    </td>

                    <td className="px-5 py-3.5">
                      <span
                        className={`inline-flex items-center gap-1 font-semibold ${
                          isExpiring ? 'text-rose-400' : 'text-slate-300'
                        }`}
                      >
                        <Clock className="w-3 h-3" />
                        {sec.daysUntilExpiry} days left
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
                          SYNCHRONIZED
                        </span>
                      )}
                    </td>

                    <td className="px-5 py-3.5 text-right">
                      {isDrifted && canRotate && (
                        <button
                          onClick={() => handleRotate(sec.id)}
                          className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-sans font-bold flex items-center gap-1 ml-auto shadow-sm"
                        >
                          <RotateCw className="w-3 h-3" />
                          <span>Reconcile to v{sec.expectedVersion}</span>
                        </button>
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
