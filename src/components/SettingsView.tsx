import React, { useState } from 'react';
import {
  Settings,
  Palette,
  Shield,
  Bell,
  Sliders,
  Rocket,
  UserCheck,
  Save,
  CheckCircle2,
  Lock,
  RefreshCw,
  AlertTriangle,
  Key,
} from 'lucide-react';
import {
  AuthUser,
  SystemSettings,
  NotificationPreferences,
  ValidationPolicyConfig,
  DeploymentPolicyConfig,
} from '../types';
import {
  loadGeneralSettings,
  saveGeneralSettings,
  loadNotificationPrefs,
  saveNotificationPrefs,
  loadValidationPolicies,
  saveValidationPolicies,
  loadDeploymentPolicies,
  saveDeploymentPolicies,
} from '../services/settingsService';
import { changeUserPassword } from '../services/authService';

interface SettingsViewProps {
  currentUser: AuthUser;
  showToast: (msg: string, type?: 'success' | 'warning' | 'error' | 'info') => void;
}

type SettingsTab =
  | 'general'
  | 'appearance'
  | 'security'
  | 'notifications'
  | 'validation_policies'
  | 'deployment_policies'
  | 'account';

export function SettingsView({ currentUser, showToast }: SettingsViewProps) {
  const isAdmin = currentUser.role === 'ADMIN';
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');

  // General Settings State
  const [generalSettings, setGeneralSettings] = useState<SystemSettings>(() => loadGeneralSettings());

  // Appearance State
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>(generalSettings.theme);
  const [rememberSidebar, setRememberSidebar] = useState(generalSettings.rememberSidebarState);
  const [showEnvHealth, setShowEnvHealth] = useState(generalSettings.showEnvironmentHealth);
  const [showRiskScore, setShowRiskScore] = useState(generalSettings.showRiskScore);
  const [showDriftTrends, setShowDriftTrends] = useState(generalSettings.showDriftTrends);

  // Security State
  const [sessionTimeout, setSessionTimeout] = useState(generalSettings.sessionTimeoutMinutes);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(currentUser.twoFactorEnabled || false);
  const [loginNotifications, setLoginNotifications] = useState(generalSettings.loginNotifications);
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [currPassword, setCurrPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Notifications State
  const [notifPrefs, setNotifPrefs] = useState<NotificationPreferences>(() => loadNotificationPrefs());

  // Validation Policies State
  const [valPolicies, setValPolicies] = useState<ValidationPolicyConfig>(() => loadValidationPolicies());

  // Deployment Policies State
  const [depPolicies, setDepPolicies] = useState<DeploymentPolicyConfig>(() => loadDeploymentPolicies());

  // Save General
  const handleSaveGeneral = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      showToast('Admin role required to modify global system configuration.', 'error');
      return;
    }
    const updated: SystemSettings = {
      ...generalSettings,
      theme,
      rememberSidebarState: rememberSidebar,
      showEnvironmentHealth: showEnvHealth,
      showRiskScore: showRiskScore,
      showDriftTrends: showDriftTrends,
      sessionTimeoutMinutes: sessionTimeout,
      loginNotifications,
    };
    saveGeneralSettings(updated);
    setGeneralSettings(updated);
    showToast('✓ Settings saved successfully', 'success');
  };

  // Save Appearance
  const handleSaveAppearance = () => {
    const updated: SystemSettings = {
      ...generalSettings,
      theme,
      rememberSidebarState: rememberSidebar,
      showEnvironmentHealth: showEnvHealth,
      showRiskScore: showRiskScore,
      showDriftTrends: showDriftTrends,
    };
    saveGeneralSettings(updated);
    setGeneralSettings(updated);
    showToast('✓ Appearance settings saved successfully', 'success');
  };

  // Save Notifications
  const handleSaveNotifications = () => {
    saveNotificationPrefs(notifPrefs);
    showToast('✓ Notification preferences saved successfully', 'success');
  };

  // Save Validation Policies
  const handleSaveValidationPolicies = () => {
    if (!isAdmin) {
      showToast('Admin role required to modify validation policies.', 'error');
      return;
    }
    saveValidationPolicies(valPolicies);
    showToast('✓ Validation policies saved successfully', 'success');
  };

  // Save Deployment Policies
  const handleSaveDeploymentPolicies = () => {
    if (!isAdmin) {
      showToast('Admin role required to modify deployment safety policies.', 'error');
      return;
    }
    saveDeploymentPolicies(depPolicies);
    showToast('✓ Deployment policies saved successfully', 'success');
  };

  // Change Password
  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currPassword) {
      showToast('Please enter your current password', 'error');
      return;
    }
    if (newPassword.length < 6) {
      showToast('New password must be at least 6 characters', 'error');
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast('Passwords do not match', 'error');
      return;
    }

    const res = await changeUserPassword(currentUser.id, currPassword, newPassword);
    if (res.success) {
      showToast('✓ Password updated successfully', 'success');
      setShowChangePasswordModal(false);
      setCurrPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } else {
      showToast(res.error || 'Failed to update password', 'error');
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      {/* Settings Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <Settings className="w-5 h-5 text-indigo-400" />
            <span>Platform Governance & Settings</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Configure validation thresholds, deployment safety policies, notifications, and security.
          </p>
        </div>
        {!isAdmin && (
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-950/40 border border-amber-800/60 text-amber-300 text-xs font-mono font-medium">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span>Read-Only Policies ({currentUser.role.replace('_', ' ')})</span>
          </div>
        )}
      </div>

      {/* Tabs Bar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-slate-800 scrollbar-none">
        {[
          { id: 'general', label: 'General', icon: Settings },
          { id: 'appearance', label: 'Appearance', icon: Palette },
          { id: 'security', label: 'Security', icon: Shield },
          { id: 'notifications', label: 'Notifications', icon: Bell },
          { id: 'validation_policies', label: 'Validation Policies', icon: Sliders },
          { id: 'deployment_policies', label: 'Deployment Policies', icon: Rocket },
          { id: 'account', label: 'Account', icon: UserCheck },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as SettingsTab)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800/80'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: GENERAL SETTINGS */}
      {activeTab === 'general' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
          <div className="border-b border-slate-800 pb-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              General System Settings
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Global controls for drift evaluation and dashboard telemetry.
            </p>
          </div>

          <form onSubmit={handleSaveGeneral} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Application Name
                </label>
                <input
                  type="text"
                  value={generalSettings.applicationName}
                  onChange={(e) =>
                    setGeneralSettings({ ...generalSettings, applicationName: e.target.value })
                  }
                  disabled={!isAdmin}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 disabled:opacity-60 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Default Target Environment
                </label>
                <select
                  value={generalSettings.defaultEnvironment}
                  onChange={(e) =>
                    setGeneralSettings({
                      ...generalSettings,
                      defaultEnvironment: e.target.value as any,
                    })
                  }
                  disabled={!isAdmin}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500 disabled:opacity-60"
                >
                  <option value="production">Production</option>
                  <option value="staging">Staging</option>
                  <option value="development">Development</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Default Validation Mode
                </label>
                <select
                  value={generalSettings.defaultValidationMode}
                  onChange={(e) =>
                    setGeneralSettings({
                      ...generalSettings,
                      defaultValidationMode: e.target.value as any,
                    })
                  }
                  disabled={!isAdmin}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500 disabled:opacity-60"
                >
                  <option value="Strict">Strict (Block on any critical/high drift)</option>
                  <option value="Balanced">Balanced (Allow medium with warning)</option>
                  <option value="Lenient">Lenient (Warning only)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Default Risk Score Gate Threshold (0 - 100)
                </label>
                <input
                  type="number"
                  min={10}
                  max={100}
                  value={generalSettings.defaultRiskThreshold}
                  onChange={(e) =>
                    setGeneralSettings({
                      ...generalSettings,
                      defaultRiskThreshold: parseInt(e.target.value, 10) || 80,
                    })
                  }
                  disabled={!isAdmin}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500 disabled:opacity-60 font-mono"
                />
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={generalSettings.autoRevalidation}
                  onChange={(e) =>
                    setGeneralSettings({ ...generalSettings, autoRevalidation: e.target.checked })
                  }
                  disabled={!isAdmin}
                  className="w-4 h-4 rounded border-slate-700 bg-slate-950 text-indigo-600 focus:ring-indigo-500/40"
                />
                <div>
                  <span className="text-xs font-bold text-slate-200">Auto Revalidation</span>
                  <p className="text-[11px] text-slate-500">
                    Automatically re-evaluate drift rules whenever state changes or events occur.
                  </p>
                </div>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={generalSettings.autoRefreshDashboard}
                  onChange={(e) =>
                    setGeneralSettings({
                      ...generalSettings,
                      autoRefreshDashboard: e.target.checked,
                    })
                  }
                  disabled={!isAdmin}
                  className="w-4 h-4 rounded border-slate-700 bg-slate-950 text-indigo-600 focus:ring-indigo-500/40"
                />
                <div>
                  <span className="text-xs font-bold text-slate-200">Auto Refresh Dashboard</span>
                  <p className="text-[11px] text-slate-500">
                    Poll live cluster metrics every 15 seconds.
                  </p>
                </div>
              </label>
            </div>

            <div className="pt-3">
              <button
                type="submit"
                disabled={!isAdmin}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold shadow-md shadow-indigo-600/30 transition-all flex items-center gap-2"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save Changes</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 2: APPEARANCE */}
      {activeTab === 'appearance' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
          <div className="border-b border-slate-800 pb-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Appearance</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Personalize theme and visual telemetry visibility.
            </p>
          </div>

          <div className="space-y-5">
            {/* Theme Radios */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2">Theme Mode</label>
              <div className="grid grid-cols-3 gap-3 max-w-md">
                {(['light', 'dark', 'system'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setTheme(mode)}
                    className={`p-3 rounded-xl border text-center transition-all ${
                      theme === mode
                        ? 'bg-indigo-950/60 border-indigo-500 text-indigo-200 font-bold'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <span className="text-xs capitalize">{mode}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Sidebar toggle */}
            <div className="pt-2">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberSidebar}
                  onChange={(e) => setRememberSidebar(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-700 bg-slate-950 text-indigo-600 focus:ring-indigo-500/40"
                />
                <div>
                  <span className="text-xs font-bold text-slate-200">Remember sidebar state</span>
                  <p className="text-[11px] text-slate-500">
                    Keep sidebar collapsed or expanded across page visits.
                  </p>
                </div>
              </label>
            </div>

            {/* Dashboard Panels */}
            <div className="pt-2 space-y-3">
              <label className="block text-xs font-semibold text-slate-300">
                Dashboard Visibility
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showEnvHealth}
                  onChange={(e) => setShowEnvHealth(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-700 bg-slate-950 text-indigo-600 focus:ring-indigo-500/40"
                />
                <span className="text-xs text-slate-200 font-medium">Show environment health</span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showRiskScore}
                  onChange={(e) => setShowRiskScore(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-700 bg-slate-950 text-indigo-600 focus:ring-indigo-500/40"
                />
                <span className="text-xs text-slate-200 font-medium">Show risk score</span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showDriftTrends}
                  onChange={(e) => setShowDriftTrends(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-700 bg-slate-950 text-indigo-600 focus:ring-indigo-500/40"
                />
                <span className="text-xs text-slate-200 font-medium">Show drift trends</span>
              </label>
            </div>

            <div className="pt-3">
              <button
                type="button"
                onClick={handleSaveAppearance}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md shadow-indigo-600/30 transition-all flex items-center gap-2"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save Appearance Preferences</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: SECURITY */}
      {activeTab === 'security' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
          <div className="border-b border-slate-800 pb-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Security & Session Management
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Control session timeouts, authentication alerts, and credentials.
            </p>
          </div>

          <div className="space-y-5">
            {/* Session Timeout */}
            <div className="max-w-md">
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Session Timeout (Minutes)
              </label>
              <select
                value={sessionTimeout}
                onChange={(e) => setSessionTimeout(parseInt(e.target.value, 10))}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
              >
                <option value={15}>15 minutes</option>
                <option value={30}>30 minutes (Enterprise Default)</option>
                <option value={60}>60 minutes</option>
                <option value={120}>120 minutes (2 Hours)</option>
              </select>
            </div>

            {/* 2FA Toggle */}
            <div className="pt-2 flex items-center justify-between p-4 rounded-xl bg-slate-950 border border-slate-800 max-w-md">
              <div>
                <div className="text-xs font-bold text-white">Two-Factor Authentication (2FA)</div>
                <div className="text-[11px] text-slate-500">
                  Enforce hardware security key or TOTP code upon login.
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setTwoFactorEnabled(!twoFactorEnabled);
                  showToast(
                    !twoFactorEnabled ? '2FA enabled successfully' : '2FA disabled',
                    'info'
                  );
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  twoFactorEnabled
                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-700'
                    : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                }`}
              >
                {twoFactorEnabled ? 'Enabled ✓' : 'Enable'}
              </button>
            </div>

            {/* Login Notifications */}
            <div className="pt-2">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={loginNotifications}
                  onChange={(e) => setLoginNotifications(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-700 bg-slate-950 text-indigo-600 focus:ring-indigo-500/40"
                />
                <div>
                  <span className="text-xs font-bold text-slate-200">Login Notifications</span>
                  <p className="text-[11px] text-slate-500">
                    Broadcast security audit alert whenever an admin or SRE logs in.
                  </p>
                </div>
              </label>
            </div>

            {/* Password section */}
            <div className="pt-4 border-t border-slate-800">
              <div className="flex items-center justify-between max-w-md">
                <div>
                  <div className="text-xs font-bold text-white">Account Password</div>
                  <div className="text-[11px] text-slate-500">
                    Last updated recently &bull; PBKDF2 Salted Hash
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowChangePasswordModal(true)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold border border-slate-700 transition-colors flex items-center gap-1.5"
                >
                  <Lock className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Change Password</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: NOTIFICATIONS */}
      {activeTab === 'notifications' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
          <div className="border-b border-slate-800 pb-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Notification Preferences
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Select alert categories and dispatch channels for deployment events.
            </p>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { key: 'criticalDrift', label: 'Critical Drift' },
                { key: 'highRiskDeployment', label: 'High Risk Deployment' },
                { key: 'deploymentBlocked', label: 'Deployment Blocked' },
                { key: 'secretExpiry', label: 'Secret Expiry' },
                { key: 'runtimeDrift', label: 'Runtime Drift' },
                { key: 'infrastructureDrift', label: 'Infrastructure Drift' },
                { key: 'changeRequest', label: 'Change Request' },
                { key: 'approvalRequired', label: 'Approval Required' },
              ].map(({ key, label }) => (
                <label
                  key={key}
                  className="flex items-center gap-3 p-3 rounded-xl bg-slate-950 border border-slate-800/80 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={(notifPrefs as any)[key]}
                    onChange={(e) =>
                      setNotifPrefs({ ...notifPrefs, [key]: e.target.checked } as any)
                    }
                    className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-indigo-500/40"
                  />
                  <span className="text-xs text-slate-200 font-medium">{label}</span>
                </label>
              ))}
            </div>

            <div className="pt-4 border-t border-slate-800">
              <label className="block text-xs font-semibold text-slate-300 mb-2">
                Notification Channels (MVP Architecture)
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                <div className="p-3 rounded-xl bg-indigo-950/50 border border-indigo-800/60 text-indigo-200 font-bold flex items-center justify-between">
                  <span>In-App</span>
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                </div>
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-400 flex items-center justify-between opacity-70">
                  <span>Email</span>
                  <span className="text-[10px] text-slate-500 font-mono">Ready</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-400 flex items-center justify-between opacity-70">
                  <span>Slack</span>
                  <span className="text-[10px] text-slate-500 font-mono">Ready</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-400 flex items-center justify-between opacity-70">
                  <span>Teams</span>
                  <span className="text-[10px] text-slate-500 font-mono">Ready</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-400 flex items-center justify-between opacity-70">
                  <span>Webhook</span>
                  <span className="text-[10px] text-slate-500 font-mono">Ready</span>
                </div>
              </div>
            </div>

            <div className="pt-3">
              <button
                type="button"
                onClick={handleSaveNotifications}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md shadow-indigo-600/30 transition-all flex items-center gap-2"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save Notification Preferences</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: VALIDATION POLICIES */}
      {activeTab === 'validation_policies' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
          <div className="border-b border-slate-800 pb-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Validation Policies & Thresholds
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Specify automated actions and risk score cutoffs (Admin authorization required).
            </p>
          </div>

          <div className="space-y-5">
            {/* Actions per severity */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Critical Drift Action
                </label>
                <select
                  value={valPolicies.criticalDriftAction}
                  onChange={(e) =>
                    setValPolicies({ ...valPolicies, criticalDriftAction: e.target.value as any })
                  }
                  disabled={!isAdmin}
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-rose-400 font-bold focus:outline-none focus:border-indigo-500 disabled:opacity-60"
                >
                  <option value="BLOCK">BLOCK (Strict Deployment Stop)</option>
                  <option value="MANUAL_REVIEW">MANUAL REVIEW</option>
                  <option value="WARNING">WARNING</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  High Drift Action
                </label>
                <select
                  value={valPolicies.highDriftAction}
                  onChange={(e) =>
                    setValPolicies({ ...valPolicies, highDriftAction: e.target.value as any })
                  }
                  disabled={!isAdmin}
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-amber-400 font-bold focus:outline-none focus:border-indigo-500 disabled:opacity-60"
                >
                  <option value="MANUAL_REVIEW">MANUAL REVIEW (Gatekeeper Sign-off)</option>
                  <option value="BLOCK">BLOCK</option>
                  <option value="WARNING">WARNING</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Medium Drift Action
                </label>
                <select
                  value={valPolicies.mediumDriftAction}
                  onChange={(e) =>
                    setValPolicies({ ...valPolicies, mediumDriftAction: e.target.value as any })
                  }
                  disabled={!isAdmin}
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-indigo-400 font-bold focus:outline-none focus:border-indigo-500 disabled:opacity-60"
                >
                  <option value="WARNING">WARNING</option>
                  <option value="MANUAL_REVIEW">MANUAL REVIEW</option>
                  <option value="ALLOW">ALLOW</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Low Drift Action
                </label>
                <select
                  value={valPolicies.lowDriftAction}
                  onChange={(e) =>
                    setValPolicies({ ...valPolicies, lowDriftAction: e.target.value as any })
                  }
                  disabled={!isAdmin}
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-emerald-400 font-bold focus:outline-none focus:border-indigo-500 disabled:opacity-60"
                >
                  <option value="ALLOW">ALLOW (Log Only)</option>
                  <option value="WARNING">WARNING</option>
                </select>
              </div>
            </div>

            {/* Threshold sliders / numbers */}
            <div className="pt-3 border-t border-slate-800">
              <h4 className="text-xs font-bold text-slate-200 mb-3">Risk Score Thresholds</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-xs text-slate-400">Critical Risk Threshold</span>
                  <input
                    type="number"
                    value={valPolicies.criticalRiskThreshold}
                    onChange={(e) =>
                      setValPolicies({
                        ...valPolicies,
                        criticalRiskThreshold: parseInt(e.target.value, 10) || 90,
                      })
                    }
                    disabled={!isAdmin}
                    className="w-full mt-1 px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-rose-400 font-bold text-sm font-mono"
                  />
                </div>

                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-xs text-slate-400">High Risk Threshold</span>
                  <input
                    type="number"
                    value={valPolicies.highRiskThreshold}
                    onChange={(e) =>
                      setValPolicies({
                        ...valPolicies,
                        highRiskThreshold: parseInt(e.target.value, 10) || 70,
                      })
                    }
                    disabled={!isAdmin}
                    className="w-full mt-1 px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-amber-400 font-bold text-sm font-mono"
                  />
                </div>

                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-xs text-slate-400">Medium Risk Threshold</span>
                  <input
                    type="number"
                    value={valPolicies.mediumRiskThreshold}
                    onChange={(e) =>
                      setValPolicies({
                        ...valPolicies,
                        mediumRiskThreshold: parseInt(e.target.value, 10) || 40,
                      })
                    }
                    disabled={!isAdmin}
                    className="w-full mt-1 px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-indigo-400 font-bold text-sm font-mono"
                  />
                </div>
              </div>
            </div>

            <div className="pt-3">
              <button
                type="button"
                onClick={handleSaveValidationPolicies}
                disabled={!isAdmin}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold shadow-md shadow-indigo-600/30 transition-all flex items-center gap-2"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save Validation Policies</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 6: DEPLOYMENT POLICIES */}
      {activeTab === 'deployment_policies' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
          <div className="border-b border-slate-800 pb-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Deployment Policies & Gatekeeper Governance
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Production deployment guardrails enforced before flash-sale drops.
            </p>
          </div>

          <div className="space-y-5">
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="text-xs font-bold text-white">Target: Production Environment</span>
                <span className="text-[10px] text-emerald-400 font-mono font-semibold">
                  Zero-Tolerance Active
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="flex items-center justify-between p-2 rounded-lg bg-slate-900 border border-slate-800">
                  <span className="text-slate-400">Critical Drift:</span>
                  <span className="font-bold text-rose-400">BLOCK</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-slate-900 border border-slate-800">
                  <span className="text-slate-400">High Risk:</span>
                  <span className="font-bold text-amber-400">MANUAL REVIEW</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-slate-900 border border-slate-800">
                  <span className="text-slate-400">Medium Risk:</span>
                  <span className="font-bold text-indigo-400">MANUAL REVIEW</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-slate-900 border border-slate-800">
                  <span className="text-slate-400">No Drift:</span>
                  <span className="font-bold text-emerald-400">AUTO APPROVE</span>
                </div>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={depPolicies.requireReleaseManagerApproval}
                  onChange={(e) =>
                    setDepPolicies({
                      ...depPolicies,
                      requireReleaseManagerApproval: e.target.checked,
                    })
                  }
                  disabled={!isAdmin}
                  className="w-4 h-4 rounded border-slate-700 bg-slate-950 text-indigo-600 focus:ring-indigo-500/40"
                />
                <div>
                  <span className="text-xs font-bold text-slate-200">
                    Require Release Manager Approval
                  </span>
                  <p className="text-[11px] text-slate-500">
                    Mandate cryptographic signature from Release Manager before promotion.
                  </p>
                </div>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={depPolicies.requireRevalidationBeforeDeployment}
                  onChange={(e) =>
                    setDepPolicies({
                      ...depPolicies,
                      requireRevalidationBeforeDeployment: e.target.checked,
                    })
                  }
                  disabled={!isAdmin}
                  className="w-4 h-4 rounded border-slate-700 bg-slate-950 text-indigo-600 focus:ring-indigo-500/40"
                />
                <div>
                  <span className="text-xs font-bold text-slate-200">
                    Require Revalidation Before Deployment
                  </span>
                  <p className="text-[11px] text-slate-500">
                    Perform instant pre-flight scan 60 seconds before traffic switch.
                  </p>
                </div>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={depPolicies.requireAuditLog}
                  onChange={(e) =>
                    setDepPolicies({ ...depPolicies, requireAuditLog: e.target.checked })
                  }
                  disabled={!isAdmin}
                  className="w-4 h-4 rounded border-slate-700 bg-slate-950 text-indigo-600 focus:ring-indigo-500/40"
                />
                <div>
                  <span className="text-xs font-bold text-slate-200">Require Audit Log</span>
                  <p className="text-[11px] text-slate-500">
                    Append immutable signed audit record to event log.
                  </p>
                </div>
              </label>
            </div>

            <div className="pt-3">
              <button
                type="button"
                onClick={handleSaveDeploymentPolicies}
                disabled={!isAdmin}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold shadow-md shadow-indigo-600/30 transition-all flex items-center gap-2"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save Deployment Policies</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 7: ACCOUNT SUMMARY */}
      {activeTab === 'account' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
          <div className="border-b border-slate-800 pb-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Account Overview</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Active identity and access token properties.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
              <div className="text-slate-500">User Identity</div>
              <div className="text-white font-bold text-sm mt-1">{currentUser.name}</div>
              <div className="text-indigo-400">{currentUser.email}</div>
            </div>

            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
              <div className="text-slate-500">Privilege Level</div>
              <div className="text-white font-bold text-sm mt-1">{currentUser.role.replace('_', ' ')}</div>
              <div className="text-emerald-400">Active &bull; Verified</div>
            </div>
          </div>
        </div>
      )}

      {/* Change Password Modal */}
      {showChangePasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-sm w-full shadow-2xl text-slate-200">
            <h3 className="text-sm font-bold text-white mb-1">Change Password</h3>
            <p className="text-xs text-slate-400 mb-4">
              Enter your current password and choose a new one.
            </p>

            <form onSubmit={handlePasswordSubmit} className="space-y-3 font-mono text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Current Password</label>
                <input
                  type="password"
                  value={currPassword}
                  onChange={(e) => setCurrPassword(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Confirm New Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center gap-2 pt-3 font-sans">
                <button
                  type="button"
                  onClick={() => setShowChangePasswordModal(false)}
                  className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white transition-colors"
                >
                  Update Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
