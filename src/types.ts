export type EnvironmentType = 'development' | 'staging' | 'production';

export type DriftSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export type DriftCategory = 'infrastructure' | 'env_variable' | 'secret_metadata' | 'runtime';

export type DriftStatus = 'OPEN' | 'RESOLVED' | 'ACKNOWLEDGED';

export type DeploymentDecision = 'APPROVED' | 'APPROVED_WITH_WARNING' | 'MANUAL_REVIEW' | 'BLOCKED';

export type UserRole =
  | 'ADMIN'
  | 'DEVELOPER'
  | 'DEVOPS'
  | 'RELEASE_MANAGER'
  | 'Admin'
  | 'SRE'
  | 'Developer'
  | 'Auditor'
  | 'DevOps'
  | 'Release Manager';

export type EnterpriseRole = 'ADMIN' | 'DEVELOPER' | 'DEVOPS' | 'RELEASE_MANAGER' | 'AUDITOR';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: EnterpriseRole;
  status: 'ACTIVE' | 'DISABLED';
  avatar?: string;
  lastLogin: string;
  token: string;
  twoFactorEnabled?: boolean;
}

export interface SystemSettings {
  applicationName: string;
  defaultEnvironment: EnvironmentType;
  defaultValidationMode: 'Strict' | 'Lenient' | 'Balanced';
  defaultRiskThreshold: number;
  autoRevalidation: boolean;
  autoRefreshDashboard: boolean;
  theme: 'light' | 'dark' | 'system';
  rememberSidebarState: boolean;
  showEnvironmentHealth: boolean;
  showRiskScore: boolean;
  showDriftTrends: boolean;
  sessionTimeoutMinutes: number;
  loginNotifications: boolean;
}

export interface NotificationPreferences {
  criticalDrift: boolean;
  highRiskDeployment: boolean;
  deploymentBlocked: boolean;
  secretExpiry: boolean;
  runtimeDrift: boolean;
  infrastructureDrift: boolean;
  changeRequest: boolean;
  approvalRequired: boolean;
  channelInApp: boolean;
  channelEmail: boolean;
  channelSlack: boolean;
  channelTeams: boolean;
  channelWebhook: boolean;
}

export interface ValidationPolicyConfig {
  criticalDriftAction: 'BLOCK' | 'MANUAL_REVIEW' | 'WARNING' | 'ALLOW';
  highDriftAction: 'BLOCK' | 'MANUAL_REVIEW' | 'WARNING' | 'ALLOW';
  mediumDriftAction: 'BLOCK' | 'MANUAL_REVIEW' | 'WARNING' | 'ALLOW';
  lowDriftAction: 'BLOCK' | 'MANUAL_REVIEW' | 'WARNING' | 'ALLOW';
  criticalRiskThreshold: number;
  highRiskThreshold: number;
  mediumRiskThreshold: number;
}

export interface DeploymentPolicyConfig {
  environment: EnvironmentType;
  criticalDriftAction: 'BLOCK' | 'MANUAL_REVIEW' | 'WARNING' | 'ALLOW';
  highRiskAction: 'BLOCK' | 'MANUAL_REVIEW' | 'WARNING' | 'ALLOW';
  mediumRiskAction: 'BLOCK' | 'MANUAL_REVIEW' | 'WARNING' | 'ALLOW';
  noDriftAction: 'AUTO_APPROVE' | 'MANUAL_REVIEW';
  requireReleaseManagerApproval: boolean;
  requireRevalidationBeforeDeployment: boolean;
  requireAuditLog: boolean;
}

export interface ChangeRequestItem {
  id: string;
  title: string;
  targetEnv: EnvironmentType;
  author: string;
  authorEmail: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'DEPLOYED';
  riskScore: number;
  proposedChanges: string;
  createdAt: string;
  reviewedBy?: string;
  reviewNote?: string;
}

export interface SecretMetadataItem {
  id: string;
  name: string;
  environment: EnvironmentType;
  currentVersion: number;
  expectedVersion: number;
  status: 'active' | 'expiring_soon' | 'deprecated' | 'missing';
  daysUntilExpiry: number;
  lastRotated: string;
  kmsKeyId: string;
}

export interface DependencyItem {
  id: string;
  service: string;
  environment: EnvironmentType;
  version: string;
  expectedVersion: string;
  status: 'HEALTHY' | 'DRIFTED' | 'DEGRADED';
  latencyMs: number;
  endpoint: string;
}

export interface ExperimentItem {
  id: string;
  name: string;
  environment: EnvironmentType;
  variantA: string;
  variantB: string;
  trafficSplitPct: number;
  status: 'RUNNING' | 'CONCLUDED' | 'DRAFT';
  impactOnDrift: 'NEUTRAL' | 'INCREASED_RISK' | 'IMPROVED';
}

export type ActiveTab =
  | 'dashboard'
  | 'comparison'
  | 'history'
  | 'versions'
  | 'heatmap'
  | 'benchmark'
  | 'audit';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatar: string;
  role: UserRole;
  provider: 'google' | 'guest';
  googleId?: string;
  token?: string;
  lastLogin: string;
  verified: boolean;
}

export interface InfrastructureConfig {
  cpuCores: number;
  memoryGb: number;
  databaseTier: string;
  replicas: number;
  maxDbConnections: number;
  autoScaleMin: number;
  autoScaleMax: number;
  readReplicaEnabled: boolean;
}

export interface EnvVarConfig {
  key: string;
  value: string;
  isSensitive?: boolean;
  isCriticalForFlashSale?: boolean;
  description?: string;
}

export interface SecretConfig {
  name: string;
  version: number;
  status: 'active' | 'deprecated' | 'expired' | 'missing';
  lastRotated: string;
  kmsKeyId: string;
}

export interface RuntimeConfig {
  apiUrl: string;
  paymentMode: 'production' | 'sandbox' | 'mock';
  activeReplicas: number;
  connectionPoolUtilizationPct: number;
  cacheTtlSeconds: number;
  rateLimiterEnabled: boolean;
  deployedCommit: string;
}

export interface EnvironmentState {
  id: string;
  name: EnvironmentType;
  displayName: string;
  status: 'HEALTHY' | 'DRIFT_DETECTED' | 'BLOCKED' | 'WARNING';
  configVersion: number;
  lastValidationTime: string | null;
  deploymentStatus: 'IDLE' | 'APPROVED' | 'BLOCKED' | 'MANUAL_REVIEW';
  readinessScore: number; // 0 - 100%
  healthScore: number; // 0 - 100%
  riskPoints: number; // Sum of severity weights
  expected: {
    infrastructure: InfrastructureConfig;
    envVars: Record<string, string>;
    secrets: Record<string, { version: number; status: string; lastRotated: string }>;
    runtime: RuntimeConfig;
  };
  actual: {
    infrastructure: InfrastructureConfig;
    envVars: Record<string, string>;
    secrets: Record<string, { version: number; status: string; lastRotated: string }>;
    runtime: RuntimeConfig;
  };
}

export interface DriftRecord {
  id: string;
  environmentId: string;
  category: DriftCategory;
  key: string;
  expectedValue: string | number | boolean;
  actualValue: string | number | boolean;
  severity: DriftSeverity;
  riskPoints: number; // Critical=40, High=25, Medium=10, Low=5
  reason: string;
  impact: string;
  rootCause: string;
  recommendedFix: string;
  status: DriftStatus;
  detectedAt: string;
}

export interface DriftHistoryItem {
  id: string;
  environmentId: string;
  environmentName: string;
  dateStr: string; // e.g. "Sep 4"
  timestamp: string;
  key: string;
  category: DriftCategory;
  fromValue: string;
  toValue: string;
  severity: DriftSeverity;
  author: string;
  reason: string;
  reverted?: boolean;
}

export interface ConfigSnapshot {
  version: number;
  environmentId: string;
  environmentName: string;
  createdAt: string;
  author: string;
  comment: string;
  isSafe: boolean;
  config: {
    infrastructure: InfrastructureConfig;
    envVars: Record<string, string>;
    secrets: Record<string, { version: number; status: string; lastRotated: string }>;
    runtime: RuntimeConfig;
  };
}

export interface SystemAlert {
  id: string;
  title: string;
  severity: DriftSeverity;
  environmentName: string;
  issue: string;
  expected: string;
  actual: string;
  timestamp: string;
  read: boolean;
}

export interface DeploymentGateCheck {
  id: string;
  environmentId: string;
  targetReleaseVersion: string;
  decision: DeploymentDecision;
  reason: string;
  driftCount: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  riskScore: number;
  healthScore: number;
  readinessScore: number;
  checks: {
    infrastructure: 'PASS' | 'WARNING' | 'FAIL';
    envVars: 'PASS' | 'WARNING' | 'FAIL';
    secrets: 'PASS' | 'WARNING' | 'FAIL';
    runtime: 'PASS' | 'WARNING' | 'FAIL';
  };
  validatedAt: string;
  overrideNote?: string;
  overriddenBy?: string;
  approvedBy?: string;
}

export interface AuditLog {
  id: string;
  environmentId: string;
  environmentName: string;
  action: string;
  user: string;
  decision?: DeploymentDecision;
  driftCount?: number;
  details: string;
  timestamp: string;
}

export interface InjectedScenario {
  id: string;
  title: string;
  targetEnv: EnvironmentType;
  category: DriftCategory;
  severity: DriftSeverity;
  scenarioType: string;
  description: string;
  flashSaleRisk: string;
  applyChanges: (env: EnvironmentState) => EnvironmentState;
}

