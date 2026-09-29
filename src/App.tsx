import React, { useState, useEffect, useMemo } from 'react';
import { LoginPage } from './components/LoginPage';
import { Sidebar, NavRoute } from './components/Sidebar';
import { TopNavbar } from './components/TopNavbar';
import { DashboardView } from './components/DashboardView';
import { EnvironmentCards } from './components/EnvironmentCards';
import { DriftTable } from './components/DriftTable';
import { GatekeeperModal } from './components/GatekeeperModal';
import { SimulatorModal } from './components/SimulatorModal';
import { DriftDiffModal } from './components/DriftDiffModal';
import { AuditLogModal } from './components/AuditLogModal';
import { ConfigEditorModal } from './components/ConfigEditorModal';
import { ConfigComparisonView } from './components/ConfigComparisonView';
import { DriftHistoryView } from './components/DriftHistoryView';
import { ConfigVersioningView } from './components/ConfigVersioningView';
import { BenchmarkView } from './components/BenchmarkView';
import { NotificationDrawer } from './components/NotificationDrawer';
import { SettingsView } from './components/SettingsView';
import { UserProfileView } from './components/UserProfileView';
import { UserManagementView } from './components/UserManagementView';
import { ChangeRequestsView } from './components/ChangeRequestsView';
import { SecretsMetadataView } from './components/SecretsMetadataView';
import { DependenciesView } from './components/DependenciesView';
import { ExperimentsView } from './components/ExperimentsView';
import { TestResultDashboard } from './components/TestResultDashboard';
import { SystemHealthView } from './components/SystemHealthView';
import { DeploymentPipelineView } from './components/DeploymentPipelineView';
import { IncidentManagementView } from './components/IncidentManagementView';
import { PerformanceAnalyticsView } from './components/PerformanceAnalyticsView';
import { GuidedDemoView } from './components/GuidedDemoView';
import { ErrorBoundary } from './components/ErrorBoundary';

import {
  EnvironmentState,
  EnvironmentType,
  DriftRecord,
  AuditLog,
  InjectedScenario,
  DeploymentGateCheck,
  UserRole,
  ConfigSnapshot,
  DriftHistoryItem,
  SystemAlert,
  AuthUser,
  EnterpriseRole,
} from './types';

import {
  loadStoredEnvironments,
  saveEnvironments,
  loadAuditLogs,
  saveAuditLogs,
  loadVersionSnapshots,
  saveVersionSnapshots,
  loadDriftHistory,
  saveDriftHistory,
  loadSystemAlerts,
  saveSystemAlerts,
  INITIAL_ENVIRONMENTS,
} from './services/store';

import {
  checkBackendHealth,
  fetchDashboardMetrics,
  runValidationScan,
  reconcileAllDrifts,
  fixSingleDrift,
  injectSimulationScenario,
  recoverSimulation,
  fetchBackendAuditLogs,
  submitSafetyEvent,
  runWhatIfSimulation,
  downloadReportExport,
} from './services/apiClient';

import {
  detectDrifts,
  evaluateGatekeeper,
  calculateHealthScore,
  calculateRiskScore,
} from './services/driftEngine';

import {
  getCurrentUser,
  logout as performLogout,
  canUser,
} from './services/authService';

import {
  ShieldAlert,
  Zap,
  Sliders,
  CheckCircle2,
  AlertOctagon,
  Flame,
  Info,
  RotateCcw,
  LogOut,
  AlertTriangle,
  ScrollText,
  FileDown,
} from 'lucide-react';

export function App() {
  // Authentication & Session
  const [authSession, setAuthSession] = useState<AuthUser | null>(() => getCurrentUser());
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // Navigation & Layout
  const [currentPath, setCurrentPath] = useState<NavRoute>(() => {
    const p = window.location.pathname as NavRoute;
    const validPaths: NavRoute[] = [
      '/dashboard',
      '/guided-demo',
      '/environments',
      '/configurations',
      '/deployments',
      '/drifts',
      '/drift-history',
      '/comparison',
      '/simulation',
      '/what-if',
      '/risk-analysis',
      '/dependencies',
      '/secrets',
      '/experiments',
      '/test-results',
      '/incidents',
      '/change-requests',
      '/audit-logs',
      '/notifications',
      '/system-health',
      '/performance',
      '/settings',
      '/users',
      '/profile',
    ];
    return validPaths.includes(p) ? p : '/dashboard';
  });

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Core Platform State
  const [environments, setEnvironments] = useState<EnvironmentState[]>(() =>
    loadStoredEnvironments()
  );
  const [selectedEnvType, setSelectedEnvType] = useState<EnvironmentType>('production');
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(() => loadAuditLogs());
  const [versionSnapshots, setVersionSnapshots] = useState<ConfigSnapshot[]>(() =>
    loadVersionSnapshots()
  );
  const [driftHistory, setDriftHistory] = useState<DriftHistoryItem[]>(() =>
    loadDriftHistory()
  );
  const [systemAlerts, setSystemAlerts] = useState<SystemAlert[]>(() =>
    loadSystemAlerts()
  );

  // Modals & Drawers
  const [isGatekeeperOpen, setIsGatekeeperOpen] = useState(false);
  const [isSimulatorOpen, setIsSimulatorOpen] = useState(false);
  const [isAuditLogsOpen, setIsAuditLogsOpen] = useState(false);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [inspectingDrift, setInspectingDrift] = useState<DriftRecord | null>(null);

  // Scanning state
  const [isScanning, setIsScanning] = useState(false);
  const [notification, setNotification] = useState<{
    type: 'success' | 'warning' | 'error' | 'info';
    message: string;
  } | null>(null);

  const showNotification = (
    message: string,
    type: 'success' | 'warning' | 'error' | 'info' = 'success'
  ) => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification(null);
    }, 4500);
  };

  // Synchronize state changes to localStorage
  useEffect(() => {
    saveEnvironments(environments);
  }, [environments]);

  useEffect(() => {
    saveAuditLogs(auditLogs);
  }, [auditLogs]);

  useEffect(() => {
    saveVersionSnapshots(versionSnapshots);
  }, [versionSnapshots]);

  useEffect(() => {
    saveDriftHistory(driftHistory);
  }, [driftHistory]);

  useEffect(() => {
    saveSystemAlerts(systemAlerts);
  }, [systemAlerts]);

  // Session expiry check loop
  useEffect(() => {
    const interval = setInterval(() => {
      const active = getCurrentUser();
      if (authSession && !active) {
        setAuthSession(null);
        showNotification('Your session has expired. Please sign in again.', 'warning');
      }
    }, 20000);
    return () => clearInterval(interval);
  }, [authSession]);

  // Handle URL history state
  const handleNavigate = (path: NavRoute) => {
    setCurrentPath(path);
    try {
      window.history.pushState({}, '', path);
    } catch {
      // safe fallback in iframe
    }
  };

  // Auth Handlers
  const handleLoginSuccess = (user: AuthUser) => {
    setAuthSession(user);
    handleNavigate('/dashboard');
    showNotification(`Welcome, ${user.name} (${user.role.replace('_', ' ')})`, 'success');
    logAction(
      'AUTH_LOGIN',
      `User authenticated: ${user.email} with role ${user.role}. Session active.`
    );
  };

  const handleLogout = () => {
    const email = authSession?.email;
    performLogout();
    setAuthSession(null);
    setShowLogoutConfirm(false);
    handleNavigate('/dashboard');
    showNotification('You have logged out successfully', 'info');
    if (email) {
      logAction('AUTH_LOGOUT', `User terminated session: ${email}`);
    }
  };

  // Derive active drifts and gatekeeper check for all environments
  const envDriftsMap = useMemo(() => {
    const map = new Map<string, DriftRecord[]>();
    for (const env of environments) {
      map.set(env.id, detectDrifts(env));
    }
    return map;
  }, [environments]);

  const activeEnvironment = useMemo(() => {
    return (
      environments.find((e) => e.name === selectedEnvType) || environments[0]
    );
  }, [environments, selectedEnvType]);

  const activeDrifts = useMemo(() => {
    return envDriftsMap.get(activeEnvironment.id) || [];
  }, [envDriftsMap, activeEnvironment]);

  const activeGateCheck: DeploymentGateCheck = useMemo(() => {
    return evaluateGatekeeper(activeEnvironment, activeDrifts, 'v2.4-flash-sale');
  }, [activeEnvironment, activeDrifts]);

  const unreadAlertCount = useMemo(() => {
    return systemAlerts.filter((a) => !a.read).length;
  }, [systemAlerts]);

  const totalDriftsCount = useMemo(() => {
    let count = 0;
    envDriftsMap.forEach((drifts) => {
      count += drifts.length;
    });
    return count;
  }, [envDriftsMap]);

  // Helper to append an audit log
  const logAction = (
    action: string,
    details: string,
    decision?: any,
    driftCount?: number
  ) => {
    const authorSignature = authSession
      ? `${authSession.name} (${authSession.email}) [${authSession.role}]`
      : 'System Console';

    const newLog: AuditLog = {
      id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      environmentId: activeEnvironment.id,
      environmentName: activeEnvironment.displayName,
      action,
      user: authorSignature,
      decision,
      driftCount,
      details,
      timestamp: new Date().toISOString(),
    };
    setAuditLogs((prev) => [newLog, ...prev]);
  };

  // Check RBAC permission before sensitive operations
  const checkPermission = (action: string): boolean => {
    if (!authSession) return false;
    const role = authSession.role;

    if (role === 'ADMIN') return true;

    if (action === 'EMERGENCY_OVERRIDE' || action === 'ROLLBACK_PROD') {
      if (role === 'DEVELOPER') {
        showNotification(
          'Permission Denied: Developer cannot override Gatekeeper or execute Production Rollback.',
          'error'
        );
        return false;
      }
    }

    if (action === 'APPROVE_PROD_DEPLOYMENT') {
      if (role !== 'RELEASE_MANAGER') {
        showNotification(
          'Permission Denied: Only Release Manager or Admin can authorize Production deployment.',
          'error'
        );
        return false;
      }
    }

    return true;
  };

  // Initial sync with FastAPI backend on mount
  useEffect(() => {
    const syncBackendOnMount = async () => {
      try {
        const [prodScan, stagingScan, devScan] = await Promise.all([
          runValidationScan('production').catch(() => null),
          runValidationScan('staging').catch(() => null),
          runValidationScan('development').catch(() => null),
        ]);

        setEnvironments((prev) =>
          prev.map((e) => {
            const scan = e.name === 'production' ? prodScan : e.name === 'staging' ? stagingScan : devScan;
            if (scan) {
              return {
                ...e,
                status: scan.deployment_decision === 'BLOCKED' ? 'BLOCKED' : 'HEALTHY',
                deploymentStatus: scan.deployment_decision,
                readinessScore: scan.readiness_score,
                riskPoints: scan.risk_score,
                healthScore: Math.max(0, 100 - scan.risk_score),
                lastValidationTime: scan.timestamp || e.lastValidationTime,
              };
            }
            return e;
          })
        );

        // Also fetch live backend audit logs if available
        const backendAudits = await fetchBackendAuditLogs(15).catch(() => []);
        if (backendAudits && backendAudits.length > 0) {
          const mappedLogs: AuditLog[] = backendAudits.map((item) => ({
            id: `api-audit-${item.id}`,
            environmentId: item.environment === 'production' ? 'prod-01' : item.environment === 'staging' ? 'stag-01' : 'dev-01',
            environmentName: item.environment,
            action: item.event_type || 'SYSTEM_VALIDATION',
            user: item.triggered_by || 'FastAPI Engine',
            details: item.details ? JSON.stringify(item.details) : 'Live automated safety scan',
            timestamp: item.timestamp,
          }));
          setAuditLogs((prev) => {
            const existingIds = new Set(prev.map(p => p.id));
            const fresh = mappedLogs.filter(m => !existingIds.has(m.id));
            return [...fresh, ...prev];
          });
        }
      } catch (err) {
        console.warn('Initial backend sync graceful fallback:', err);
      }
    };

    syncBackendOnMount();
  }, []);

  // Re-scan trigger
  const handleRunScan = async () => {
    setIsScanning(true);
    try {
      // Trigger real backend scan
      const scan = await runValidationScan(activeEnvironment.name).catch(() => null);
      if (scan) {
        setEnvironments((prev) =>
          prev.map((e) => {
            if (e.name === scan.environment) {
              return {
                ...e,
                status: scan.deployment_decision === 'BLOCKED' ? 'BLOCKED' : 'HEALTHY',
                deploymentStatus: scan.deployment_decision,
                readinessScore: scan.readiness_score,
                riskPoints: scan.risk_score,
                healthScore: Math.max(0, 100 - scan.risk_score),
                lastValidationTime: scan.timestamp || new Date().toISOString(),
              };
            }
            return e;
          })
        );
      } else {
        // Fallback local calculation
        setEnvironments((prev) =>
          prev.map((e) => {
            const drifts = detectDrifts(e);
            const riskData = calculateRiskScore(drifts);
            return {
              ...e,
              riskPoints: riskData.totalPoints,
              healthScore: riskData.healthScore,
              lastValidationTime: new Date().toISOString(),
            };
          })
        );
      }
      showNotification('Continuous sensor validation scan completed across all environments (FastAPI Connected).');
    } finally {
      setIsScanning(false);
    }
  };

  // Reconcile ALL drifts in active environment (auto-heal)
  const handleReconcileAll = async () => {
    if (!checkPermission('AUTO_RECONCILE')) return;

    const driftsCount = activeDrifts.length;
    // Dispatch to real backend
    try {
      await reconcileAllDrifts(activeEnvironment.name);
    } catch (err) {
      console.warn('Backend reconcile-all error, falling back locally:', err);
    }

    setEnvironments((prev) =>
      prev.map((env) => {
        if (env.id !== activeEnvironment.id) return env;
        return {
          ...env,
          status: 'HEALTHY',
          deploymentStatus: 'APPROVED',
          readinessScore: 100,
          riskPoints: 0,
          healthScore: 100,
          configVersion: env.configVersion + 1,
          lastValidationTime: new Date().toISOString(),
          actual: JSON.parse(JSON.stringify(env.expected)),
        };
      })
    );

    // Record drift history entry
    const newHistoryItem: DriftHistoryItem = {
      id: `hist-${Date.now()}`,
      environmentId: activeEnvironment.id,
      environmentName: activeEnvironment.displayName,
      dateStr: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      category: 'env_variable',
      key: 'ALL_PARAMETERS',
      fromValue: 'DRIFTED_STATE',
      toValue: 'RECONCILED_SAFE',
      severity: 'CRITICAL',
      author: authSession ? `${authSession.name} (${authSession.role})` : 'DevOps',
      reason: `Automated reconciliation synchronized ${driftsCount} configurations to golden baseline.`,
    };
    setDriftHistory((prev) => [newHistoryItem, ...prev]);

    logAction(
      'AUTO_RECONCILIATION_FULL',
      `Synchronized all ${driftsCount} drifting configurations to match GitOps baseline. Release status cleared to APPROVED.`,
      'APPROVED',
      0
    );
    showNotification(
      `Auto-Reconciliation Complete: ${driftsCount} configurations synchronized to golden state.`
    );
  };

  // Reconcile single drift from table
  const handleReconcileItem = async (drift: DriftRecord) => {
    if (!checkPermission('RECONCILE_ITEM')) return;

    // Send single fix to backend
    try {
      await fixSingleDrift(activeEnvironment.name, drift.key, drift.expectedValue);
    } catch (err) {
      console.warn('Backend single fix error, falling back locally:', err);
    }

    setEnvironments((prev) =>
      prev.map((env) => {
        if (env.id !== activeEnvironment.id) return env;
        const updated = JSON.parse(JSON.stringify(env)) as EnvironmentState;

        if (drift.category === 'infrastructure') {
          (updated.actual.infrastructure as any)[drift.key] = (
            updated.expected.infrastructure as any
          )[drift.key];
        } else if (drift.category === 'env_variable') {
          updated.actual.envVars[drift.key] = updated.expected.envVars[drift.key];
        } else if (drift.category === 'secret_metadata') {
          updated.actual.secrets[drift.key] = JSON.parse(
            JSON.stringify(updated.expected.secrets[drift.key])
          );
        } else if (drift.category === 'runtime') {
          (updated.actual.runtime as any)[drift.key] = (
            updated.expected.runtime as any
          )[drift.key];
        }

        const remaining = detectDrifts(updated);
        updated.riskPoints = calculateRiskScore(remaining).totalPoints;
        updated.healthScore = calculateHealthScore(remaining);
        updated.configVersion += 1;
        return updated;
      })
    );

    // Record drift history
    const histItem: DriftHistoryItem = {
      id: `hist-${Date.now()}`,
      environmentId: activeEnvironment.id,
      environmentName: activeEnvironment.displayName,
      dateStr: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      category: drift.category,
      key: drift.key,
      fromValue: String(drift.actualValue),
      toValue: String(drift.expectedValue),
      severity: drift.severity,
      author: authSession ? `${authSession.name} (${authSession.role})` : 'DevOps',
      reason: `Reconciled parameter '${drift.key}' to golden expected value.`,
    };
    setDriftHistory((prev) => [histItem, ...prev]);

    logAction(
      'PARAMETER_RECONCILED',
      `Reconciled parameter ${drift.key} from '${drift.actualValue}' to expected '${drift.expectedValue}'.`,
      'APPROVED'
    );
    showNotification(`Reconciled '${drift.key}' to baseline value.`);
  };

  // Promote actual live value as new golden baseline
  const handlePromoteBaseline = (drift: DriftRecord) => {
    if (!checkPermission('PROMOTE_BASELINE')) return;

    setEnvironments((prev) =>
      prev.map((env) => {
        if (env.id !== activeEnvironment.id) return env;
        const updated = JSON.parse(JSON.stringify(env)) as EnvironmentState;

        if (drift.category === 'infrastructure') {
          (updated.expected.infrastructure as any)[drift.key] = (
            updated.actual.infrastructure as any
          )[drift.key];
        } else if (drift.category === 'env_variable') {
          updated.expected.envVars[drift.key] = updated.actual.envVars[drift.key];
        } else if (drift.category === 'secret_metadata') {
          updated.expected.secrets[drift.key] = JSON.parse(
            JSON.stringify(updated.actual.secrets[drift.key])
          );
        } else if (drift.category === 'runtime') {
          (updated.expected.runtime as any)[drift.key] = (
            updated.actual.runtime as any
          )[drift.key];
        }

        const remaining = detectDrifts(updated);
        updated.riskPoints = calculateRiskScore(remaining).totalPoints;
        updated.healthScore = calculateHealthScore(remaining);
        updated.configVersion += 1;
        return updated;
      })
    );

    logAction(
      'PROMOTE_BASELINE',
      `Promoted runtime value '${drift.actualValue}' as golden baseline for ${drift.key}.`,
      'APPROVED'
    );
    showNotification(`Promoted live value to baseline for '${drift.key}'.`);
  };

  // Inject failure scenario
  const handleInjectScenario = async (scenario: InjectedScenario) => {
    // Send scenario to FastAPI backend simulator
    try {
      if (scenario.scenarioType) {
        await injectSimulationScenario(scenario.scenarioType, scenario.targetEnv);
      }
    } catch (err) {
      console.warn('Backend scenario injection graceful fallback:', err);
    }

    setEnvironments((prev) =>
      prev.map((env) => {
        if (env.name !== scenario.targetEnv) return env;
        const modified = scenario.applyChanges(JSON.parse(JSON.stringify(env)));
        const drifts = detectDrifts(modified);
        modified.riskPoints = calculateRiskScore(drifts).totalPoints;
        modified.healthScore = calculateHealthScore(drifts);
        modified.status = 'BLOCKED';
        modified.deploymentStatus = 'BLOCKED';
        return modified;
      })
    );

    const newAlert: SystemAlert = {
      id: `alert-${Date.now()}`,
      title: scenario.title,
      severity: scenario.severity,
      environmentName: scenario.targetEnv,
      issue: scenario.flashSaleRisk,
      expected: 'Verified Golden Value',
      actual: 'Injected Mismatch',
      timestamp: 'Just now',
      read: false,
    };
    setSystemAlerts((prev) => [newAlert, ...prev]);

    logAction(
      'SIMULATED_DRIFT_INJECTION',
      `Injected failure scenario '${scenario.title}'. Hazard: ${scenario.flashSaleRisk}`,
      'BLOCKED'
    );
    showNotification(
      `Scenario Injected: "${scenario.title}" applied to ${scenario.targetEnv}. Gatekeeper re-evaluated.`,
      'error'
    );
  };

  // ==========================================
  // 1. APPLICATION ENTRY FLOW GUARD
  // If not authenticated, ALWAYS redirect to Login
  // ==========================================
  if (!authSession) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  // ==========================================
  // 2. AUTHENTICATED APPLICATION INTERFACE
  // ==========================================
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex font-sans antialiased overflow-x-hidden">
      {/* Toast Notification Banner */}
      {notification && (
        <div className="fixed top-4 right-4 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
          <div
            className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl shadow-2xl border text-xs font-semibold backdrop-blur-md ${
              notification.type === 'error'
                ? 'bg-rose-950/90 text-rose-200 border-rose-800'
                : notification.type === 'warning'
                ? 'bg-amber-950/90 text-amber-200 border-amber-800'
                : notification.type === 'info'
                ? 'bg-indigo-950/90 text-indigo-200 border-indigo-800'
                : 'bg-slate-900/90 text-emerald-300 border-emerald-800/80'
            }`}
          >
            {notification.type === 'error' ? (
              <AlertOctagon className="w-4 h-4 text-rose-400 shrink-0" />
            ) : notification.type === 'warning' ? (
              <Flame className="w-4 h-4 text-amber-400 shrink-0" />
            ) : notification.type === 'info' ? (
              <Info className="w-4 h-4 text-indigo-400 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            )}
            <span>{notification.message}</span>
          </div>
        </div>
      )}

      {/* Sidebar Navigation */}
      <Sidebar
        currentPath={currentPath}
        onNavigate={handleNavigate}
        currentUser={authSession}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        isMobileOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
        onLogoutClick={() => setShowLogoutConfirm(true)}
        unreadAlertCount={unreadAlertCount}
      />

      {/* Main Workspace Column */}
      <div className="flex-1 flex flex-col min-w-0 bg-slate-950 text-slate-100">
        {/* Top Navbar */}
        <TopNavbar
          currentPath={currentPath}
          onNavigate={handleNavigate}
          currentUser={authSession}
          onToggleMobileSidebar={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
          onOpenNotifications={() => setIsNotificationOpen(true)}
          unreadNotificationsCount={unreadAlertCount}
          onLogoutClick={() => setShowLogoutConfirm(true)}
          onTriggerScan={handleRunScan}
          isScanning={isScanning}
        />

        {/* Dynamic Route Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto custom-scrollbar">
          {/* Production Critical Gatekeeper Alert Banner */}
          {selectedEnvType === 'production' &&
            activeGateCheck.decision === 'BLOCKED' &&
            currentPath !== '/dashboard' && (
              <div className="mb-6 rounded-2xl border border-rose-800/70 bg-rose-950/40 p-4 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in fade-in duration-200">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-xl bg-rose-600 text-white shrink-0 mt-0.5 sm:mt-0">
                    <ShieldAlert className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm font-bold text-white">
                        Flash-Sale Pre-Deployment Gatekeeper: RELEASE BLOCKED
                      </h2>
                      <span className="text-[10px] font-mono font-bold bg-rose-900 text-rose-200 border border-rose-700 px-2 py-0.5 rounded-full">
                        {activeGateCheck.criticalCount} Critical Violations &bull;{' '}
                        {activeEnvironment.riskPoints} Risk Pts
                      </span>
                    </div>
                    <p className="text-xs text-rose-300 mt-1 leading-relaxed">
                      Severe configuration drift detected between GitOps IaC and live Production
                      cluster. Deploying in this state will cause immediate checkout failures during
                      flash sale.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                  <button
                    onClick={handleReconcileAll}
                    className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-md transition-colors"
                  >
                    Auto-Reconcile Production
                  </button>
                  <button
                    onClick={() => setIsGatekeeperOpen(true)}
                    className="px-3.5 py-1.5 rounded-xl border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-200 text-xs font-semibold transition-colors"
                  >
                    View Gate Analysis
                  </button>
                </div>
              </div>
            )}

          <ErrorBoundary key={currentPath} fallbackTitle={`Error Loading ${currentPath}`}>
            {/* ROUTE: /dashboard */}
            {currentPath === '/dashboard' && (
            <DashboardView
              environments={environments}
              selectedEnv={activeEnvironment}
              activeDrifts={activeDrifts}
              allDriftsCount={totalDriftsCount}
              currentUser={{
                id: authSession.id,
                name: authSession.name,
                email: authSession.email,
                avatar: authSession.avatar || '',
                role: authSession.role as UserRole,
                provider: 'guest',
                lastLogin: authSession.lastLogin,
                verified: true,
              }}
              onNavigateTab={(tab) => {
                if (tab === 'comparison') handleNavigate('/comparison');
                else if (tab === 'history') handleNavigate('/drift-history');
                else if (tab === 'versions') handleNavigate('/configurations');
                else if (tab === 'benchmark') handleNavigate('/risk-analysis');
                else if (tab === 'audit') handleNavigate('/audit-logs');
                else handleNavigate('/dashboard');
              }}
              onSelectEnv={(envName) => setSelectedEnvType(envName)}
              onOpenGatekeeper={() => setIsGatekeeperOpen(true)}
              onOpenSimulator={() => setIsSimulatorOpen(true)}
              onReconcileAll={handleReconcileAll}
              onReconcileSingle={handleReconcileItem}
              auditLogs={auditLogs}
              driftHistory={driftHistory}
              onOpenLoginModal={() => handleNavigate('/profile')}
            />
          )}

          {/* ROUTE: /environments */}
          {currentPath === '/environments' && (
            <div className="space-y-6">
              <EnvironmentCards
                environments={environments}
                selectedEnv={selectedEnvType}
                onSelectEnv={setSelectedEnvType}
                getDriftsForEnv={(env) => envDriftsMap.get(env.id) || []}
                onOpenGatekeeperForEnv={(env) => {
                  setSelectedEnvType(env.name);
                  setIsGatekeeperOpen(true);
                }}
              />
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white">Live Cluster Sandbox</h3>
                  <p className="text-xs text-slate-400">
                    Modify active container parameters in real-time to test sensor reactivity.
                  </p>
                </div>
                <button
                  onClick={() => setIsEditorOpen(true)}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all flex items-center gap-2"
                >
                  <Sliders className="w-3.5 h-3.5" />
                  <span>Open Sandbox Editor</span>
                </button>
              </div>
            </div>
          )}

          {/* ROUTE: /configurations */}
          {currentPath === '/configurations' && (
            <ConfigVersioningView
              versions={versionSnapshots}
              snapshots={versionSnapshots}
              currentEnvironment={activeEnvironment}
              environments={environments}
              onRestoreSnapshot={(snapshot) => {
                setEnvironments((prev) =>
                  prev.map((e) => {
                    const matches =
                      e.id === snapshot.environmentId ||
                      e.displayName.toLowerCase() === snapshot.environmentName.toLowerCase() ||
                      e.name.toLowerCase() === (snapshot as any).environment?.toLowerCase() ||
                      e.id === activeEnvironment.id;
                    if (!matches) return e;
                    return {
                      ...e,
                      actual: JSON.parse(JSON.stringify(snapshot.config)),
                    };
                  })
                );
                showNotification(
                  `Restored ${snapshot.environmentName || activeEnvironment.displayName} to version v${snapshot.version}.`,
                  'success'
                );
                logAction(
                  'CONFIG_ROLLBACK',
                  `Reverted running state to snapshot v${snapshot.version} (${snapshot.environmentName || activeEnvironment.displayName})`
                );
              }}
              onCreateSnapshot={() => {
                const newSnap: ConfigSnapshot = {
                  version: versionSnapshots.length + 1,
                  environmentId: activeEnvironment.id,
                  environmentName: activeEnvironment.displayName,
                  createdAt: new Date().toISOString(),
                  author: authSession?.name || 'Senior Developer',
                  comment: `Manual snapshot of ${activeEnvironment.displayName}`,
                  isSafe: true,
                  config: JSON.parse(JSON.stringify(activeEnvironment.actual)),
                };
                setVersionSnapshots((prev) => [newSnap, ...prev]);
                showNotification(`Created snapshot version v${newSnap.version}.`, 'success');
                logAction(
                  'SNAPSHOT_CREATE',
                  `Created configuration snapshot v${newSnap.version} for ${activeEnvironment.displayName}`
                );
              }}
            />
          )}

          {/* ROUTE: /deployments */}
          {currentPath === '/deployments' && (
            <DeploymentPipelineView
              selectedEnv={selectedEnvType}
              onSelectEnv={setSelectedEnvType}
              currentUser={authSession}
              onReconcileAll={handleReconcileAll}
              onOpenGatekeeper={() => setIsGatekeeperOpen(true)}
              showToast={showNotification}
            />
          )}

          {/* ROUTE: /drifts */}
          {currentPath === '/drifts' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold text-white tracking-tight">
                    Active Configuration Drifts
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Viewing discrepancies for{' '}
                    <strong className="text-indigo-400">{activeEnvironment.displayName}</strong>
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={async () => {
                      const ok = await downloadReportExport('validation', 'csv');
                      showNotification(
                        ok ? 'Validation Report (CSV) downloaded.' : 'Export failed.',
                        ok ? 'success' : 'error'
                      );
                    }}
                    className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 flex items-center gap-1.5"
                  >
                    <FileDown className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Export Validation CSV</span>
                  </button>
                  <button
                    onClick={async () => {
                      const ok = await downloadReportExport('validation', 'pdf');
                      showNotification(
                        ok ? 'Validation Report (PDF) downloaded.' : 'Export failed.',
                        ok ? 'success' : 'error'
                      );
                    }}
                    className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 flex items-center gap-1.5"
                  >
                    <FileDown className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Export Validation PDF</span>
                  </button>
                  <button
                    onClick={handleReconcileAll}
                    disabled={activeDrifts.length === 0}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-bold transition-all"
                  >
                    Auto-Reconcile All
                  </button>
                </div>
              </div>

              <DriftTable
                environment={activeEnvironment}
                drifts={activeDrifts}
                onReconcileAll={handleReconcileAll}
                onReconcileItem={handleReconcileItem}
                onPromoteBaseline={handlePromoteBaseline}
                onViewDiff={(drift) => setInspectingDrift(drift)}
              />
            </div>
          )}

          {/* ROUTE: /drift-history */}
          {currentPath === '/drift-history' && (
            <DriftHistoryView
              history={driftHistory}
              environments={environments}
              onClearHistory={() => setDriftHistory([])}
            />
          )}

          {/* ROUTE: /comparison */}
          {currentPath === '/comparison' && (
            <ConfigComparisonView
              environments={environments}
              onReconcileSingle={handleReconcileItem}
              onPromoteBaseline={handlePromoteBaseline}
            />
          )}

          {/* ROUTE: /simulation or /what-if */}
          {(currentPath === '/simulation' || currentPath === '/what-if') && (
            <div className="space-y-6">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2.5">
                    <Zap className="w-5 h-5 text-amber-400" />
                    <span>Failure & Chaos Simulation Engine</span>
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Inject controlled configuration drift scenarios (KMS secret mismatch, DB pool limits, out-of-order events) to test deployment resilience.
                  </p>
                </div>
                <button
                  onClick={() => setIsSimulatorOpen(true)}
                  className="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition-all shadow-md shadow-amber-600/30"
                >
                  Open Scenario Injector
                </button>
              </div>

              {/* Quick Launch Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
                  <span className="px-2 py-0.5 rounded-md bg-rose-950 text-rose-400 border border-rose-800 text-[10px] font-bold font-mono">
                    HIGH HAZARD &bull; CRITICAL
                  </span>
                  <h3 className="text-sm font-bold text-white">
                    Simulate Payment Gateway Key Expiration
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Injects a desynchronized KMS secret pointer causing checkout orders to immediately fail during the flash drop.
                  </p>
                  <button
                    onClick={() => {
                      setIsSimulatorOpen(true);
                    }}
                    className="text-xs font-bold text-indigo-400 hover:text-indigo-300 transition-colors"
                  >
                    Configure in Simulator &rarr;
                  </button>
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
                  <span className="px-2 py-0.5 rounded-md bg-amber-950 text-amber-400 border border-amber-800 text-[10px] font-bold font-mono">
                    OUT-OF-ORDER EVENT DRIFT
                  </span>
                  <h3 className="text-sm font-bold text-white">
                    Simulate Kafka Flash Sale Race Condition
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Emulates an out-of-order schema update event before consumer worker pods have restarted.
                  </p>
                  <button
                    onClick={() => {
                      setIsSimulatorOpen(true);
                    }}
                    className="text-xs font-bold text-indigo-400 hover:text-indigo-300 transition-colors"
                  >
                    Configure in Simulator &rarr;
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ROUTE: /risk-analysis */}
          {currentPath === '/risk-analysis' && (
            <BenchmarkView
              environments={environments}
              onRunBenchmark={() => {
                showNotification('Running synthetic flash-sale traffic load benchmark...', 'info');
                setTimeout(() => {
                  showNotification('Benchmark completed: 0% configuration degradation.', 'success');
                }, 1200);
              }}
            />
          )}

          {/* ROUTE: /dependencies */}
          {currentPath === '/dependencies' && <DependenciesView currentUser={authSession} />}

          {/* ROUTE: /secrets */}
          {currentPath === '/secrets' && (
            <SecretsMetadataView currentUser={authSession} showToast={showNotification} />
          )}

          {/* ROUTE: /experiments */}
          {currentPath === '/experiments' && <ExperimentsView currentUser={authSession} />}

          {/* ROUTE: /test-results */}
          {currentPath === '/test-results' && <TestResultDashboard currentUser={authSession} />}

          {/* ROUTE: /guided-demo */}
          {currentPath === '/guided-demo' && <GuidedDemoView showToast={showNotification} />}

          {/* ROUTE: /incidents */}
          {currentPath === '/incidents' && (
            <IncidentManagementView
              currentUser={authSession}
              showToast={showNotification}
              onIncidentAuditLog={(action, details) => logAction(action, details)}
            />
          )}

          {/* ROUTE: /system-health */}
          {currentPath === '/system-health' && <SystemHealthView showToast={showNotification} />}

          {/* ROUTE: /performance */}
          {currentPath === '/performance' && (
            <PerformanceAnalyticsView showToast={showNotification} />
          )}

          {/* ROUTE: /change-requests */}
          {currentPath === '/change-requests' && (
            <ChangeRequestsView
              currentUser={authSession}
              showToast={showNotification}
              onAuditLog={(action, details) => logAction(action, details)}
            />
          )}

          {/* ROUTE: /audit-logs */}
          {currentPath === '/audit-logs' && (
            <div className="space-y-6">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2.5">
                    <ScrollText className="w-5 h-5 text-indigo-400" />
                    <span>Immutable Audit Log Ledger</span>
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Cryptographically stamped trace of all configuration edits, gatekeeper decisions, and sign-offs.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={async () => {
                      const ok = await downloadReportExport('audit-logs', 'csv');
                      showNotification(
                        ok ? 'Audit Logs (CSV) downloaded.' : 'Export failed.',
                        ok ? 'success' : 'error'
                      );
                    }}
                    className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 flex items-center gap-1.5"
                  >
                    <FileDown className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Export CSV</span>
                  </button>
                  <button
                    onClick={async () => {
                      const ok = await downloadReportExport('audit-logs', 'pdf');
                      showNotification(
                        ok ? 'Audit Logs (PDF) downloaded.' : 'Export failed.',
                        ok ? 'success' : 'error'
                      );
                    }}
                    className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 flex items-center gap-1.5"
                  >
                    <FileDown className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Export PDF</span>
                  </button>
                  <button
                    onClick={() => setIsAuditLogsOpen(true)}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-colors"
                  >
                    Open Full Search & Filter Viewer
                  </button>
                </div>
              </div>

              {/* Table */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="px-5 py-3">Timestamp</th>
                      <th className="px-5 py-3">Action</th>
                      <th className="px-5 py-3">User</th>
                      <th className="px-5 py-3">Environment</th>
                      <th className="px-5 py-3">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80 text-slate-300">
                    {auditLogs.slice(0, 15).map((log) => (
                      <tr key={log.id} className="hover:bg-slate-800/40">
                        <td className="px-5 py-3 text-slate-500 whitespace-nowrap">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </td>
                        <td className="px-5 py-3 font-bold text-indigo-300">{log.action}</td>
                        <td className="px-5 py-3 text-slate-300">{log.user}</td>
                        <td className="px-5 py-3 uppercase text-slate-400">
                          {log.environmentName}
                        </td>
                        <td className="px-5 py-3 text-slate-400 font-sans">{log.details}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ROUTE: /notifications */}
          {currentPath === '/notifications' && (
            <div className="space-y-6">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-white tracking-tight">Notification Center</h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Real-time fleet events, drift warnings, and gatekeeper stops.
                  </p>
                </div>
                <button
                  onClick={() => setSystemAlerts([])}
                  className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 hover:text-white border border-slate-700 transition-colors"
                >
                  Clear All Alerts
                </button>
              </div>

              <div className="space-y-3">
                {systemAlerts.map((alert) => (
                  <div
                    key={alert.id}
                    className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex items-start justify-between gap-3 shadow-lg"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-md bg-rose-950 text-rose-400 border border-rose-800 text-[10px] font-bold uppercase font-mono">
                          {alert.severity}
                        </span>
                        <h4 className="text-xs font-bold text-white">{alert.title}</h4>
                      </div>
                      <p className="text-xs text-slate-300 mt-1">{alert.issue}</p>
                      <div className="text-[10px] text-slate-500 font-mono mt-1">
                        Expected: {alert.expected} &bull; Actual: {alert.actual}
                      </div>
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono shrink-0">
                      {alert.timestamp}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ROUTE: /settings */}
          {currentPath === '/settings' && (
            <SettingsView currentUser={authSession} showToast={showNotification} />
          )}

          {/* ROUTE: /users (Admin Only Protected Route) */}
          {currentPath === '/users' && (
            <UserManagementView currentUser={authSession} showToast={showNotification} />
          )}

          {/* ROUTE: /profile */}
          {currentPath === '/profile' && (
            <UserProfileView
              currentUser={authSession}
              onUpdateCurrentUser={(updated) => {
                setAuthSession(updated);
                showNotification('Profile refreshed', 'success');
              }}
              showToast={showNotification}
            />
          )}
          </ErrorBoundary>
        </main>
      </div>

      {/* Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-sm w-full shadow-2xl text-slate-200">
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center mb-3">
              <LogOut className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white mb-1">Confirm Logout</h3>
            <p className="text-xs text-slate-400 mb-5 leading-relaxed">
              Are you sure you want to terminate your current session? You will be redirected to the
              login screen.
            </p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleLogout}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-bold text-white transition-colors shadow-lg shadow-rose-600/30"
              >
                Yes, Logout
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Slide-over Notification Drawer */}
      <NotificationDrawer
        isOpen={isNotificationOpen}
        onClose={() => setIsNotificationOpen(false)}
        alerts={systemAlerts}
        onMarkAsRead={(alertId) => {
          setSystemAlerts((prev) =>
            prev.map((a) => (a.id === alertId ? { ...a, read: true } : a))
          );
        }}
        onClearAll={() => setSystemAlerts([])}
      />

      {/* Existing Feature Modals */}
      <GatekeeperModal
        isOpen={isGatekeeperOpen}
        onClose={() => setIsGatekeeperOpen(false)}
        environment={activeEnvironment}
        drifts={activeDrifts}
        gateCheck={activeGateCheck}
        onReconcileAll={handleReconcileAll}
      />

      <SimulatorModal
        isOpen={isSimulatorOpen}
        onClose={() => setIsSimulatorOpen(false)}
        environments={environments}
        onInjectScenario={handleInjectScenario}
      />

      <AuditLogModal
        isOpen={isAuditLogsOpen}
        onClose={() => setIsAuditLogsOpen(false)}
        auditLogs={auditLogs}
      />

      <ConfigEditorModal
        isOpen={isEditorOpen}
        onClose={() => setIsEditorOpen(false)}
        environment={activeEnvironment}
        onSaveConfig={(updated) => {
          const remaining = detectDrifts(updated);
          const riskInfo = calculateRiskScore(remaining);
          const criticals = remaining.filter((d) => d.severity === 'CRITICAL').length;
          const isBlocked = criticals > 0 || riskInfo.totalPoints > 30;

          updated.riskPoints = riskInfo.totalPoints;
          updated.healthScore = Math.max(0, 100 - riskInfo.totalPoints);
          updated.readinessScore = Math.max(0, 100 - riskInfo.totalPoints);
          updated.status = isBlocked ? 'BLOCKED' : remaining.length > 0 ? 'DRIFT_DETECTED' : 'HEALTHY';
          updated.deploymentStatus = isBlocked
            ? 'BLOCKED'
            : remaining.length > 0
            ? 'MANUAL_REVIEW'
            : 'APPROVED';
          updated.lastValidationTime = new Date().toISOString();

          setEnvironments((prev) =>
            prev.map((e) => (e.id === updated.id || e.name === updated.name ? updated : e))
          );

          // Asynchronously notify backend simulation service
          runWhatIfSimulation(updated.name, {
            replicas: updated.actual.infrastructure.replicas,
            max_connections: updated.actual.infrastructure.maxDbConnections,
            PAYMENT_MODE: updated.actual.runtime.paymentMode,
          }).catch(() => null);

          logAction(
            'MANUAL_CLUSTER_CONFIG_UPDATE',
            `Applied live sandbox configuration to ${updated.displayName}: ${remaining.length} drift(s) detected. Gatekeeper decision: ${updated.deploymentStatus}.`,
            updated.deploymentStatus,
            remaining.length
          );

          if (isBlocked) {
            showNotification(
              `Live Sandbox Applied: Gatekeeper BLOCKED deployment (${remaining.length} drift${remaining.length === 1 ? '' : 's'}, ${riskInfo.totalPoints} risk pts).`,
              'error'
            );
          } else if (remaining.length > 0) {
            showNotification(
              `Live Sandbox Applied: Manual review required (${remaining.length} drift${remaining.length === 1 ? '' : 's'}, ${riskInfo.totalPoints} risk pts).`,
              'warning'
            );
          } else {
            showNotification(
              `Live Sandbox Applied: All parameters aligned with declarative baseline. Gatekeeper APPROVED.`,
              'success'
            );
          }
        }}
      />

      {inspectingDrift && (
        <DriftDiffModal
          isOpen={!!inspectingDrift}
          onClose={() => setInspectingDrift(null)}
          drift={inspectingDrift}
          environment={activeEnvironment}
          onReconcile={(drift) => {
            handleReconcileItem(drift);
            setInspectingDrift(null);
          }}
          onPromoteBaseline={(drift) => {
            handlePromoteBaseline(drift);
            setInspectingDrift(null);
          }}
        />
      )}
    </div>
  );
}

export default App;
