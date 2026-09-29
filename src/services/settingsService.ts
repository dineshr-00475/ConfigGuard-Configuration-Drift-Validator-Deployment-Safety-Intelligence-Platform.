import {
  SystemSettings,
  NotificationPreferences,
  ValidationPolicyConfig,
  DeploymentPolicyConfig,
  ChangeRequestItem,
  DependencyItem,
  SecretMetadataItem,
  ExperimentItem,
} from '../types';

const SETTINGS_GENERAL_KEY = 'cdv_settings_general';
const SETTINGS_NOTIFS_KEY = 'cdv_settings_notifications';
const SETTINGS_VAL_POLICIES_KEY = 'cdv_settings_val_policies';
const SETTINGS_DEP_POLICIES_KEY = 'cdv_settings_dep_policies';
const CHANGE_REQUESTS_KEY = 'cdv_change_requests';

export const DEFAULT_GENERAL_SETTINGS: SystemSettings = {
  applicationName: 'Configuration Drift Validator',
  defaultEnvironment: 'production',
  defaultValidationMode: 'Strict',
  defaultRiskThreshold: 80,
  autoRevalidation: true,
  autoRefreshDashboard: true,
  theme: 'light',
  rememberSidebarState: true,
  showEnvironmentHealth: true,
  showRiskScore: true,
  showDriftTrends: true,
  sessionTimeoutMinutes: 30,
  loginNotifications: true,
};

export const DEFAULT_NOTIFICATION_PREFS: NotificationPreferences = {
  criticalDrift: true,
  highRiskDeployment: true,
  deploymentBlocked: true,
  secretExpiry: true,
  runtimeDrift: true,
  infrastructureDrift: true,
  changeRequest: true,
  approvalRequired: true,
  channelInApp: true,
  channelEmail: false,
  channelSlack: false,
  channelTeams: false,
  channelWebhook: false,
};

export const DEFAULT_VALIDATION_POLICIES: ValidationPolicyConfig = {
  criticalDriftAction: 'BLOCK',
  highDriftAction: 'MANUAL_REVIEW',
  mediumDriftAction: 'WARNING',
  lowDriftAction: 'ALLOW',
  criticalRiskThreshold: 90,
  highRiskThreshold: 70,
  mediumRiskThreshold: 40,
};

export const DEFAULT_DEPLOYMENT_POLICIES: DeploymentPolicyConfig = {
  environment: 'production',
  criticalDriftAction: 'BLOCK',
  highRiskAction: 'MANUAL_REVIEW',
  mediumRiskAction: 'MANUAL_REVIEW',
  noDriftAction: 'AUTO_APPROVE',
  requireReleaseManagerApproval: true,
  requireRevalidationBeforeDeployment: true,
  requireAuditLog: true,
};

export function loadGeneralSettings(): SystemSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_GENERAL_KEY);
    return raw ? { ...DEFAULT_GENERAL_SETTINGS, ...JSON.parse(raw) } : DEFAULT_GENERAL_SETTINGS;
  } catch {
    return DEFAULT_GENERAL_SETTINGS;
  }
}

export function saveGeneralSettings(settings: SystemSettings): void {
  try {
    localStorage.setItem(SETTINGS_GENERAL_KEY, JSON.stringify(settings));
    // Apply theme globally
    if (settings.theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else if (settings.theme === 'light') {
      document.documentElement.classList.remove('dark');
    }
  } catch (err) {
    console.error('Error saving general settings:', err);
  }
}

export function loadNotificationPrefs(): NotificationPreferences {
  try {
    const raw = localStorage.getItem(SETTINGS_NOTIFS_KEY);
    return raw ? { ...DEFAULT_NOTIFICATION_PREFS, ...JSON.parse(raw) } : DEFAULT_NOTIFICATION_PREFS;
  } catch {
    return DEFAULT_NOTIFICATION_PREFS;
  }
}

export function saveNotificationPrefs(prefs: NotificationPreferences): void {
  try {
    localStorage.setItem(SETTINGS_NOTIFS_KEY, JSON.stringify(prefs));
  } catch (err) {
    console.error('Error saving notification preferences:', err);
  }
}

export function loadValidationPolicies(): ValidationPolicyConfig {
  try {
    const raw = localStorage.getItem(SETTINGS_VAL_POLICIES_KEY);
    return raw ? { ...DEFAULT_VALIDATION_POLICIES, ...JSON.parse(raw) } : DEFAULT_VALIDATION_POLICIES;
  } catch {
    return DEFAULT_VALIDATION_POLICIES;
  }
}

export function saveValidationPolicies(policies: ValidationPolicyConfig): void {
  try {
    localStorage.setItem(SETTINGS_VAL_POLICIES_KEY, JSON.stringify(policies));
  } catch (err) {
    console.error('Error saving validation policies:', err);
  }
}

export function loadDeploymentPolicies(): DeploymentPolicyConfig {
  try {
    const raw = localStorage.getItem(SETTINGS_DEP_POLICIES_KEY);
    return raw ? { ...DEFAULT_DEPLOYMENT_POLICIES, ...JSON.parse(raw) } : DEFAULT_DEPLOYMENT_POLICIES;
  } catch {
    return DEFAULT_DEPLOYMENT_POLICIES;
  }
}

export function saveDeploymentPolicies(policies: DeploymentPolicyConfig): void {
  try {
    localStorage.setItem(SETTINGS_DEP_POLICIES_KEY, JSON.stringify(policies));
  } catch (err) {
    console.error('Error saving deployment policies:', err);
  }
}

// Initial sample data for enterprise features
export const INITIAL_CHANGE_REQUESTS: ChangeRequestItem[] = [
  {
    id: 'CR-104',
    title: 'Scale Production DB Connection Pool to 400 for Black Friday drop',
    targetEnv: 'production',
    author: 'Senior Developer',
    authorEmail: 'developer@example.com',
    status: 'PENDING',
    riskScore: 68,
    proposedChanges: 'Update MAX_CONNECTIONS: 200 -> 400; Pool Timeout: 3000ms -> 1500ms.',
    createdAt: '2026-09-04T10:15:00Z',
  },
  {
    id: 'CR-103',
    title: 'Rotate PAYMENT_GATEWAY_KEY KMS secret to v3',
    targetEnv: 'production',
    author: 'Lead SRE / DevOps',
    authorEmail: 'devops@example.com',
    status: 'APPROVED',
    riskScore: 24,
    proposedChanges: 'Switch live secret pointer from v2 to v3 after KMS key re-encryption.',
    createdAt: '2026-09-03T16:30:00Z',
    reviewedBy: 'Release Manager',
    reviewNote: 'Pre-flight verified on Staging. Auto-reconciliation test passed.',
  },
  {
    id: 'CR-102',
    title: 'Enable Staging Redis Distributed Rate Limiter',
    targetEnv: 'staging',
    author: 'Senior Developer',
    authorEmail: 'developer@example.com',
    status: 'DEPLOYED',
    riskScore: 12,
    proposedChanges: 'RATE_LIMITER_ENABLED: false -> true; RPS: 15,000.',
    createdAt: '2026-09-02T11:00:00Z',
    reviewedBy: 'Admin User',
    reviewNote: 'Load tests show 0% checkout throttling.',
  },
];

export function loadChangeRequests(): ChangeRequestItem[] {
  try {
    const raw = localStorage.getItem(CHANGE_REQUESTS_KEY);
    return raw ? JSON.parse(raw) : INITIAL_CHANGE_REQUESTS;
  } catch {
    return INITIAL_CHANGE_REQUESTS;
  }
}

export function saveChangeRequests(items: ChangeRequestItem[]): void {
  try {
    localStorage.setItem(CHANGE_REQUESTS_KEY, JSON.stringify(items));
  } catch (err) {
    console.error('Error saving change requests:', err);
  }
}

export const INITIAL_SECRETS_METADATA: SecretMetadataItem[] = [
  {
    id: 'sec-1',
    name: 'PAYMENT_GATEWAY_SECRET',
    environment: 'production',
    currentVersion: 2,
    expectedVersion: 3,
    status: 'expiring_soon',
    daysUntilExpiry: 4,
    lastRotated: '2026-06-01',
    kmsKeyId: 'arn:aws:kms:us-east-1:182217:key/pay-prod-99',
  },
  {
    id: 'sec-2',
    name: 'DATABASE_MASTER_PASSWORD',
    environment: 'production',
    currentVersion: 5,
    expectedVersion: 5,
    status: 'active',
    daysUntilExpiry: 82,
    lastRotated: '2026-08-20',
    kmsKeyId: 'arn:aws:kms:us-east-1:182217:key/db-prod-01',
  },
  {
    id: 'sec-3',
    name: 'JWT_SIGNING_PRIVATE_KEY',
    environment: 'production',
    currentVersion: 1,
    expectedVersion: 1,
    status: 'active',
    daysUntilExpiry: 180,
    lastRotated: '2026-07-15',
    kmsKeyId: 'arn:aws:kms:us-east-1:182217:key/jwt-auth-04',
  },
  {
    id: 'sec-4',
    name: 'REDIS_CLUSTER_AUTH_TOKEN',
    environment: 'staging',
    currentVersion: 2,
    expectedVersion: 2,
    status: 'active',
    daysUntilExpiry: 45,
    lastRotated: '2026-08-10',
    kmsKeyId: 'arn:aws:kms:us-east-1:182217:key/cache-stg-12',
  },
];

export const INITIAL_DEPENDENCIES: DependencyItem[] = [
  {
    id: 'dep-1',
    service: 'Cart & Inventory Microservice',
    environment: 'production',
    version: 'v2.3.9',
    expectedVersion: 'v2.4.0',
    status: 'DRIFTED',
    latencyMs: 38,
    endpoint: 'https://cart.internal.ecommerce.com/health',
  },
  {
    id: 'dep-2',
    service: 'Stripe Payment Processor Gateway',
    environment: 'production',
    version: '2024-06-15',
    expectedVersion: '2024-06-15',
    status: 'HEALTHY',
    latencyMs: 82,
    endpoint: 'https://api.stripe.com/v1/charges',
  },
  {
    id: 'dep-3',
    service: 'Prometheus & AlertManager Telemetry',
    environment: 'production',
    version: 'v2.48.0',
    expectedVersion: 'v2.48.0',
    status: 'HEALTHY',
    latencyMs: 14,
    endpoint: 'http://prometheus.monitoring:9090/-/healthy',
  },
  {
    id: 'dep-4',
    service: 'Elasticsearch Order Search Cluster',
    environment: 'production',
    version: '8.12.0',
    expectedVersion: '8.12.0',
    status: 'HEALTHY',
    latencyMs: 22,
    endpoint: 'http://es-cluster.internal:9200',
  },
];

export const INITIAL_EXPERIMENTS: ExperimentItem[] = [
  {
    id: 'exp-1',
    name: 'Checkout Connection Pool Throttle Guard',
    environment: 'production',
    variantA: 'Baseline: 200 Max Connections, Strict Timeout',
    variantB: 'Dynamic Burst Pool (Up to 450 with spillover queue)',
    trafficSplitPct: 10,
    status: 'RUNNING',
    impactOnDrift: 'IMPROVED',
  },
  {
    id: 'exp-2',
    name: 'Staging Edge Cache TTL Tuning (60s vs 300s)',
    environment: 'staging',
    variantA: 'Standard TTL 60 seconds',
    variantB: 'Extended Flash TTL 300 seconds',
    trafficSplitPct: 50,
    status: 'CONCLUDED',
    impactOnDrift: 'NEUTRAL',
  },
];
