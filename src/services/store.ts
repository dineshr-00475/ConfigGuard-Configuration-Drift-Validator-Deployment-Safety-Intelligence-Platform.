import {
  EnvironmentState,
  AuditLog,
  InjectedScenario,
  ConfigSnapshot,
  DriftHistoryItem,
  SystemAlert,
  UserProfile,
} from '../types';

export const INITIAL_ENVIRONMENTS: EnvironmentState[] = [
  {
    id: 'prod-01',
    name: 'production',
    displayName: 'Production (Flash Sale)',
    status: 'BLOCKED',
    configVersion: 10,
    lastValidationTime: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
    deploymentStatus: 'BLOCKED',
    readinessScore: 35,
    healthScore: 42,
    riskPoints: 165,
    expected: {
      infrastructure: {
        cpuCores: 8,
        memoryGb: 32,
        databaseTier: 'db.r6g.4xlarge',
        replicas: 16,
        maxDbConnections: 1200,
        autoScaleMin: 16,
        autoScaleMax: 64,
        readReplicaEnabled: true,
      },
      envVars: {
        APP_ENV: 'production',
        API_URL: 'https://checkout.flashstore.com/api',
        PAYMENT_GATEWAY_URL: 'https://live.api.stripe-gateway.internal/v1',
        PAYMENT_MODE: 'LIVE',
        INVENTORY_CACHE_TTL_SEC: '5',
        FLASH_SALE_RATE_LIMITER_ENABLED: 'true',
        ORDER_QUEUE_CONCURRENCY: '150',
        ENABLE_DYNAMIC_PRICING: 'true',
        LOG_LEVEL: 'warn',
        MAX_CONNECTIONS: '1200',
      },
      secrets: {
        STRIPE_API_SECRET: { version: 4, status: 'active', lastRotated: '2026-08-20' },
        DB_MASTER_CREDENTIALS: { version: 8, status: 'active', lastRotated: '2026-08-15' },
        JWT_SIGNING_KEY: { version: 3, status: 'active', lastRotated: '2026-08-01' },
      },
      runtime: {
        apiUrl: 'https://checkout.flashstore.com/api',
        paymentMode: 'production',
        activeReplicas: 16,
        connectionPoolUtilizationPct: 42,
        cacheTtlSeconds: 5,
        rateLimiterEnabled: true,
        deployedCommit: 'sha-98f2b1d',
      },
    },
    actual: {
      infrastructure: {
        cpuCores: 8,
        memoryGb: 32,
        databaseTier: 'db.r6g.4xlarge',
        replicas: 6, // DRIFT: 6 instead of 16!
        maxDbConnections: 350, // DRIFT: 350 instead of 1200!
        autoScaleMin: 4,
        autoScaleMax: 16,
        readReplicaEnabled: false, // DRIFT: Read replica disabled!
      },
      envVars: {
        APP_ENV: 'production',
        API_URL: 'https://staging-api.internal/api', // DRIFT: staging-api
        PAYMENT_GATEWAY_URL: 'https://sandbox.api.stripe-gateway.internal/v1', // DRIFT CRITICAL
        PAYMENT_MODE: 'TEST', // DRIFT CRITICAL: LIVE vs TEST
        INVENTORY_CACHE_TTL_SEC: '180', // DRIFT HIGH
        FLASH_SALE_RATE_LIMITER_ENABLED: 'false', // DRIFT CRITICAL
        ORDER_QUEUE_CONCURRENCY: '40', // DRIFT
        ENABLE_DYNAMIC_PRICING: 'true',
        LOG_LEVEL: 'debug', // DRIFT LOW
        MAX_CONNECTIONS: '350', // DRIFT
      },
      secrets: {
        STRIPE_API_SECRET: { version: 3, status: 'active', lastRotated: '2026-06-10' }, // DRIFT: v3 instead of v4
        DB_MASTER_CREDENTIALS: { version: 8, status: 'active', lastRotated: '2026-08-15' },
        JWT_SIGNING_KEY: { version: 3, status: 'active', lastRotated: '2026-08-01' },
      },
      runtime: {
        apiUrl: 'https://checkout.flashstore.com/api',
        paymentMode: 'sandbox', // DRIFT CRITICAL
        activeReplicas: 6,
        connectionPoolUtilizationPct: 88,
        cacheTtlSeconds: 180,
        rateLimiterEnabled: false,
        deployedCommit: 'sha-77a1c09',
      },
    },
  },
  {
    id: 'staging-01',
    name: 'staging',
    displayName: 'Staging (Pre-Prod)',
    status: 'WARNING',
    configVersion: 18,
    lastValidationTime: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    deploymentStatus: 'MANUAL_REVIEW',
    readinessScore: 78,
    healthScore: 82,
    riskPoints: 35,
    expected: {
      infrastructure: {
        cpuCores: 4,
        memoryGb: 16,
        databaseTier: 'db.t4g.xlarge',
        replicas: 6,
        maxDbConnections: 400,
        autoScaleMin: 4,
        autoScaleMax: 12,
        readReplicaEnabled: true,
      },
      envVars: {
        APP_ENV: 'staging',
        API_URL: 'https://staging-checkout.flashstore.com/api',
        PAYMENT_GATEWAY_URL: 'https://sandbox.api.stripe-gateway.internal/v1',
        PAYMENT_MODE: 'sandbox',
        INVENTORY_CACHE_TTL_SEC: '5',
        FLASH_SALE_RATE_LIMITER_ENABLED: 'true',
        ORDER_QUEUE_CONCURRENCY: '50',
        ENABLE_DYNAMIC_PRICING: 'true',
        LOG_LEVEL: 'info',
        MAX_CONNECTIONS: '400',
      },
      secrets: {
        STRIPE_API_SECRET: { version: 4, status: 'active', lastRotated: '2026-08-20' },
        DB_MASTER_CREDENTIALS: { version: 5, status: 'active', lastRotated: '2026-08-10' },
        JWT_SIGNING_KEY: { version: 2, status: 'active', lastRotated: '2026-07-28' },
      },
      runtime: {
        apiUrl: 'https://staging-checkout.flashstore.com/api',
        paymentMode: 'sandbox',
        activeReplicas: 6,
        connectionPoolUtilizationPct: 24,
        cacheTtlSeconds: 5,
        rateLimiterEnabled: true,
        deployedCommit: 'sha-98f2b1d',
      },
    },
    actual: {
      infrastructure: {
        cpuCores: 4,
        memoryGb: 16,
        databaseTier: 'db.t4g.xlarge',
        replicas: 4, // DRIFT
        maxDbConnections: 400,
        autoScaleMin: 4,
        autoScaleMax: 12,
        readReplicaEnabled: true,
      },
      envVars: {
        APP_ENV: 'staging',
        API_URL: 'https://staging-checkout.flashstore.com/api',
        PAYMENT_GATEWAY_URL: 'https://sandbox.api.stripe-gateway.internal/v1',
        PAYMENT_MODE: 'sandbox',
        INVENTORY_CACHE_TTL_SEC: '15', // DRIFT
        FLASH_SALE_RATE_LIMITER_ENABLED: 'true',
        ORDER_QUEUE_CONCURRENCY: '50',
        ENABLE_DYNAMIC_PRICING: 'true',
        LOG_LEVEL: 'info',
        MAX_CONNECTIONS: '400',
      },
      secrets: {
        STRIPE_API_SECRET: { version: 4, status: 'active', lastRotated: '2026-08-20' },
        DB_MASTER_CREDENTIALS: { version: 5, status: 'active', lastRotated: '2026-08-10' },
        JWT_SIGNING_KEY: { version: 2, status: 'active', lastRotated: '2026-07-28' },
      },
      runtime: {
        apiUrl: 'https://staging-checkout.flashstore.com/api',
        paymentMode: 'sandbox',
        activeReplicas: 4,
        connectionPoolUtilizationPct: 35,
        cacheTtlSeconds: 15,
        rateLimiterEnabled: true,
        deployedCommit: 'sha-98f2b1d',
      },
    },
  },
  {
    id: 'dev-01',
    name: 'development',
    displayName: 'Development (Local CI)',
    status: 'HEALTHY',
    configVersion: 24,
    lastValidationTime: new Date(Date.now() - 1000 * 60 * 2).toISOString(),
    deploymentStatus: 'APPROVED',
    readinessScore: 100,
    healthScore: 100,
    riskPoints: 0,
    expected: {
      infrastructure: {
        cpuCores: 2,
        memoryGb: 8,
        databaseTier: 'db.t4g.medium',
        replicas: 2,
        maxDbConnections: 100,
        autoScaleMin: 2,
        autoScaleMax: 4,
        readReplicaEnabled: false,
      },
      envVars: {
        APP_ENV: 'development',
        API_URL: 'http://localhost:8000/api',
        PAYMENT_GATEWAY_URL: 'https://mock.api.stripe-gateway.internal/v1',
        PAYMENT_MODE: 'mock',
        INVENTORY_CACHE_TTL_SEC: '0',
        FLASH_SALE_RATE_LIMITER_ENABLED: 'false',
        ORDER_QUEUE_CONCURRENCY: '10',
        ENABLE_DYNAMIC_PRICING: 'false',
        LOG_LEVEL: 'debug',
        MAX_CONNECTIONS: '100',
      },
      secrets: {
        STRIPE_API_SECRET: { version: 1, status: 'active', lastRotated: '2026-08-01' },
        DB_MASTER_CREDENTIALS: { version: 1, status: 'active', lastRotated: '2026-08-01' },
        JWT_SIGNING_KEY: { version: 1, status: 'active', lastRotated: '2026-08-01' },
      },
      runtime: {
        apiUrl: 'http://localhost:8000/api',
        paymentMode: 'mock',
        activeReplicas: 2,
        connectionPoolUtilizationPct: 15,
        cacheTtlSeconds: 0,
        rateLimiterEnabled: false,
        deployedCommit: 'sha-main-head',
      },
    },
    actual: {
      infrastructure: {
        cpuCores: 2,
        memoryGb: 8,
        databaseTier: 'db.t4g.medium',
        replicas: 2,
        maxDbConnections: 100,
        autoScaleMin: 2,
        autoScaleMax: 4,
        readReplicaEnabled: false,
      },
      envVars: {
        APP_ENV: 'development',
        API_URL: 'http://localhost:8000/api',
        PAYMENT_GATEWAY_URL: 'https://mock.api.stripe-gateway.internal/v1',
        PAYMENT_MODE: 'mock',
        INVENTORY_CACHE_TTL_SEC: '0',
        FLASH_SALE_RATE_LIMITER_ENABLED: 'false',
        ORDER_QUEUE_CONCURRENCY: '10',
        ENABLE_DYNAMIC_PRICING: 'false',
        LOG_LEVEL: 'debug',
        MAX_CONNECTIONS: '100',
      },
      secrets: {
        STRIPE_API_SECRET: { version: 1, status: 'active', lastRotated: '2026-08-01' },
        DB_MASTER_CREDENTIALS: { version: 1, status: 'active', lastRotated: '2026-08-01' },
        JWT_SIGNING_KEY: { version: 1, status: 'active', lastRotated: '2026-08-01' },
      },
      runtime: {
        apiUrl: 'http://localhost:8000/api',
        paymentMode: 'mock',
        activeReplicas: 2,
        connectionPoolUtilizationPct: 15,
        cacheTtlSeconds: 0,
        rateLimiterEnabled: false,
        deployedCommit: 'sha-main-head',
      },
    },
  },
];

// Initial Config Snapshots for Versioning & Rollback
export const INITIAL_CONFIG_VERSIONS: ConfigSnapshot[] = [
  {
    version: 10,
    environmentId: 'prod-01',
    environmentName: 'Production',
    createdAt: '2026-09-04 14:22:00',
    author: 'alex.devops@company.internal',
    comment: 'Emergency hotfix config applied before flash-sale dry run (FAILED GATEKEEPER ❌)',
    isSafe: false,
    config: {
      infrastructure: {
        cpuCores: 8,
        memoryGb: 32,
        databaseTier: 'db.r6g.4xlarge',
        replicas: 6,
        maxDbConnections: 350,
        autoScaleMin: 4,
        autoScaleMax: 16,
        readReplicaEnabled: false,
      },
      envVars: {
        APP_ENV: 'production',
        API_URL: 'https://staging-api.internal/api',
        PAYMENT_GATEWAY_URL: 'https://sandbox.api.stripe-gateway.internal/v1',
        PAYMENT_MODE: 'TEST',
        INVENTORY_CACHE_TTL_SEC: '180',
        FLASH_SALE_RATE_LIMITER_ENABLED: 'false',
        ORDER_QUEUE_CONCURRENCY: '40',
        ENABLE_DYNAMIC_PRICING: 'true',
        LOG_LEVEL: 'debug',
        MAX_CONNECTIONS: '350',
      },
      secrets: {
        STRIPE_API_SECRET: { version: 3, status: 'active', lastRotated: '2026-06-10' },
        DB_MASTER_CREDENTIALS: { version: 8, status: 'active', lastRotated: '2026-08-15' },
        JWT_SIGNING_KEY: { version: 3, status: 'active', lastRotated: '2026-08-01' },
      },
      runtime: {
        apiUrl: 'https://checkout.flashstore.com/api',
        paymentMode: 'sandbox',
        activeReplicas: 6,
        connectionPoolUtilizationPct: 88,
        cacheTtlSeconds: 180,
        rateLimiterEnabled: false,
        deployedCommit: 'sha-77a1c09',
      },
    },
  },
  {
    version: 9,
    environmentId: 'prod-01',
    environmentName: 'Production',
    createdAt: '2026-09-03 18:00:00',
    author: 'ci-bot@github-actions.internal',
    comment: 'Golden Baseline (Release Candidate v2.3-stable - 100% Gatekeeper Verified Safe ✅)',
    isSafe: true,
    config: {
      infrastructure: {
        cpuCores: 8,
        memoryGb: 32,
        databaseTier: 'db.r6g.4xlarge',
        replicas: 16,
        maxDbConnections: 1200,
        autoScaleMin: 16,
        autoScaleMax: 64,
        readReplicaEnabled: true,
      },
      envVars: {
        APP_ENV: 'production',
        API_URL: 'https://checkout.flashstore.com/api',
        PAYMENT_GATEWAY_URL: 'https://live.api.stripe-gateway.internal/v1',
        PAYMENT_MODE: 'LIVE',
        INVENTORY_CACHE_TTL_SEC: '5',
        FLASH_SALE_RATE_LIMITER_ENABLED: 'true',
        ORDER_QUEUE_CONCURRENCY: '150',
        ENABLE_DYNAMIC_PRICING: 'true',
        LOG_LEVEL: 'warn',
        MAX_CONNECTIONS: '1200',
      },
      secrets: {
        STRIPE_API_SECRET: { version: 4, status: 'active', lastRotated: '2026-08-20' },
        DB_MASTER_CREDENTIALS: { version: 8, status: 'active', lastRotated: '2026-08-15' },
        JWT_SIGNING_KEY: { version: 3, status: 'active', lastRotated: '2026-08-01' },
      },
      runtime: {
        apiUrl: 'https://checkout.flashstore.com/api',
        paymentMode: 'production',
        activeReplicas: 16,
        connectionPoolUtilizationPct: 42,
        cacheTtlSeconds: 5,
        rateLimiterEnabled: true,
        deployedCommit: 'sha-98f2b1d',
      },
    },
  },
  {
    version: 8,
    environmentId: 'prod-01',
    environmentName: 'Production',
    createdAt: '2026-09-02 10:15:00',
    author: 'sre.oncall@company.internal',
    comment: 'Infrastructure scaling release v2.2 - 1200 max db connections & 16 replicas',
    isSafe: true,
    config: {
      infrastructure: {
        cpuCores: 8,
        memoryGb: 32,
        databaseTier: 'db.r6g.4xlarge',
        replicas: 16,
        maxDbConnections: 1200,
        autoScaleMin: 16,
        autoScaleMax: 64,
        readReplicaEnabled: true,
      },
      envVars: {
        APP_ENV: 'production',
        API_URL: 'https://checkout.flashstore.com/api',
        PAYMENT_GATEWAY_URL: 'https://live.api.stripe-gateway.internal/v1',
        PAYMENT_MODE: 'LIVE',
        INVENTORY_CACHE_TTL_SEC: '10',
        FLASH_SALE_RATE_LIMITER_ENABLED: 'true',
        ORDER_QUEUE_CONCURRENCY: '100',
        ENABLE_DYNAMIC_PRICING: 'true',
        LOG_LEVEL: 'warn',
        MAX_CONNECTIONS: '1200',
      },
      secrets: {
        STRIPE_API_SECRET: { version: 4, status: 'active', lastRotated: '2026-08-20' },
        DB_MASTER_CREDENTIALS: { version: 8, status: 'active', lastRotated: '2026-08-15' },
        JWT_SIGNING_KEY: { version: 3, status: 'active', lastRotated: '2026-08-01' },
      },
      runtime: {
        apiUrl: 'https://checkout.flashstore.com/api',
        paymentMode: 'production',
        activeReplicas: 16,
        connectionPoolUtilizationPct: 38,
        cacheTtlSeconds: 10,
        rateLimiterEnabled: true,
        deployedCommit: 'sha-88c91a0',
      },
    },
  },
  {
    version: 7,
    environmentId: 'prod-01',
    environmentName: 'Production',
    createdAt: '2026-08-30 09:00:00',
    author: 'release.lead@company.internal',
    comment: 'Sprint 34 initial baseline rollout (v2.1)',
    isSafe: true,
    config: {
      infrastructure: {
        cpuCores: 8,
        memoryGb: 32,
        databaseTier: 'db.r6g.2xlarge',
        replicas: 12,
        maxDbConnections: 800,
        autoScaleMin: 8,
        autoScaleMax: 32,
        readReplicaEnabled: true,
      },
      envVars: {
        APP_ENV: 'production',
        API_URL: 'https://checkout.flashstore.com/api',
        PAYMENT_GATEWAY_URL: 'https://live.api.stripe-gateway.internal/v1',
        PAYMENT_MODE: 'LIVE',
        INVENTORY_CACHE_TTL_SEC: '15',
        FLASH_SALE_RATE_LIMITER_ENABLED: 'true',
        ORDER_QUEUE_CONCURRENCY: '80',
        ENABLE_DYNAMIC_PRICING: 'false',
        LOG_LEVEL: 'info',
        MAX_CONNECTIONS: '800',
      },
      secrets: {
        STRIPE_API_SECRET: { version: 3, status: 'active', lastRotated: '2026-06-10' },
        DB_MASTER_CREDENTIALS: { version: 7, status: 'active', lastRotated: '2026-07-15' },
        JWT_SIGNING_KEY: { version: 2, status: 'active', lastRotated: '2026-07-28' },
      },
      runtime: {
        apiUrl: 'https://checkout.flashstore.com/api',
        paymentMode: 'production',
        activeReplicas: 12,
        connectionPoolUtilizationPct: 45,
        cacheTtlSeconds: 15,
        rateLimiterEnabled: true,
        deployedCommit: 'sha-65f32b1',
      },
    },
  },
];

// Initial Historical Changes for Drift History Timeline
export const INITIAL_DRIFT_HISTORY: DriftHistoryItem[] = [
  {
    id: 'hist-01',
    environmentId: 'prod-01',
    environmentName: 'Production',
    dateStr: 'Sep 4',
    timestamp: '2026-09-04 14:22:15',
    key: 'PAYMENT_MODE',
    category: 'env_variable',
    fromValue: 'LIVE',
    toValue: 'TEST',
    severity: 'CRITICAL',
    author: 'developer (hotfix test)',
    reason: 'Manual edit in k8s configmap during payment webhook debug session',
  },
  {
    id: 'hist-02',
    environmentId: 'prod-01',
    environmentName: 'Production',
    dateStr: 'Sep 4',
    timestamp: '2026-09-04 13:45:00',
    key: 'PAYMENT_GATEWAY_URL',
    category: 'env_variable',
    fromValue: 'https://live.api.stripe-gateway.internal/v1',
    toValue: 'https://sandbox.api.stripe-gateway.internal/v1',
    severity: 'CRITICAL',
    author: 'ci/cd runner #4182',
    reason: 'Staging environment parameter mistakenly deployed with production tag',
  },
  {
    id: 'hist-03',
    environmentId: 'prod-01',
    environmentName: 'Production',
    dateStr: 'Sep 3',
    timestamp: '2026-09-03 23:10:00',
    key: 'replicas',
    category: 'infrastructure',
    fromValue: '16',
    toValue: '6',
    severity: 'CRITICAL',
    author: 'cron:nightly-cost-saver',
    reason: 'Off-peak scale-down job executed without flash sale lock override',
  },
  {
    id: 'hist-04',
    environmentId: 'prod-01',
    environmentName: 'Production',
    dateStr: 'Sep 3',
    timestamp: '2026-09-03 21:30:10',
    key: 'API_URL',
    category: 'env_variable',
    fromValue: 'https://checkout.flashstore.com/api',
    toValue: 'https://staging-api.internal/api',
    severity: 'HIGH',
    author: 'alex.devops',
    reason: 'Out-of-order ingress route mapping pushed during canary rollout',
  },
  {
    id: 'hist-05',
    environmentId: 'prod-01',
    environmentName: 'Production',
    dateStr: 'Sep 3',
    timestamp: '2026-09-03 19:15:00',
    key: 'INVENTORY_CACHE_TTL_SEC',
    category: 'env_variable',
    fromValue: '5',
    toValue: '180',
    severity: 'HIGH',
    author: 'redis-admin',
    reason: 'Cache TTL increased to decrease Redis memory usage during peak test',
  },
  {
    id: 'hist-06',
    environmentId: 'prod-01',
    environmentName: 'Production',
    dateStr: 'Sep 2',
    timestamp: '2026-09-02 16:40:00',
    key: 'MAX_CONNECTIONS',
    category: 'infrastructure',
    fromValue: '1200',
    toValue: '350',
    severity: 'CRITICAL',
    author: 'dba-team',
    reason: 'Postgres parameter group rollback accidentally reverted max connection pool',
  },
  {
    id: 'hist-07',
    environmentId: 'prod-01',
    environmentName: 'Production',
    dateStr: 'Sep 1',
    timestamp: '2026-09-01 11:20:00',
    key: 'readReplicaEnabled',
    category: 'infrastructure',
    fromValue: 'true',
    toValue: 'false',
    severity: 'HIGH',
    author: 'aws-maintenance',
    reason: 'Database replica unlinked during automated read-replica snapshot upgrade',
  },
];

// Initial System Alerts
export const INITIAL_SYSTEM_ALERTS: SystemAlert[] = [
  {
    id: 'alert-01',
    title: 'CRITICAL Drift in Production',
    severity: 'CRITICAL',
    environmentName: 'Production',
    issue: 'PAYMENT_MODE is TEST (Expected LIVE)',
    expected: 'LIVE',
    actual: 'TEST',
    timestamp: '2 mins ago',
    read: false,
  },
  {
    id: 'alert-02',
    title: 'Payment Gateway Mismatch',
    severity: 'CRITICAL',
    environmentName: 'Production',
    issue: 'PAYMENT_GATEWAY_URL points to sandbox in production environment',
    expected: 'https://live.api.stripe-gateway.internal/v1',
    actual: 'https://sandbox.api.stripe-gateway.internal/v1',
    timestamp: '14 mins ago',
    read: false,
  },
  {
    id: 'alert-03',
    title: 'Capacity Shortage: Underprovisioned Replicas',
    severity: 'CRITICAL',
    environmentName: 'Production',
    issue: '6 pods running vs 16 required for flash sale wave',
    expected: '16 replicas',
    actual: '6 replicas',
    timestamp: '35 mins ago',
    read: false,
  },
  {
    id: 'alert-04',
    title: 'Out-of-Order Event Detected',
    severity: 'HIGH',
    environmentName: 'Production',
    issue: 'Configuration v10 pushed ahead of database migration completion',
    expected: 'v9-safe',
    actual: 'v10-drifting',
    timestamp: '1 hour ago',
    read: true,
  },
];

// Comprehensive 8 Failure Scenarios
export const PRESET_SCENARIOS: InjectedScenario[] = [
  {
    id: 'scen-wrong-env-var',
    title: '1. Wrong Environment Variable (PAYMENT_MODE & API_URL)',
    targetEnv: 'production',
    category: 'env_variable',
    severity: 'CRITICAL',
    scenarioType: 'WRONG_ENV_VAR',
    description: 'A developer commit mistakenly set PAYMENT_MODE to "TEST" and API_URL to staging endpoint.',
    flashSaleRisk: '100% of customer credit card charges will either fail or generate dummy test tokens. Real revenue loss: $450k/minute.',
    applyChanges: (env) => {
      const cloned = JSON.parse(JSON.stringify(env)) as EnvironmentState;
      cloned.actual.envVars.PAYMENT_GATEWAY_URL = 'https://sandbox.api.stripe-gateway.internal/v1';
      cloned.actual.envVars.PAYMENT_MODE = 'TEST';
      cloned.actual.envVars.API_URL = 'https://staging-api.internal/api';
      cloned.actual.runtime.paymentMode = 'sandbox';
      cloned.configVersion += 1;
      return cloned;
    },
  },
  {
    id: 'scen-missing-secret',
    title: '2. Missing Secret (STRIPE_API_SECRET Missing from Vault)',
    targetEnv: 'production',
    category: 'secret_metadata',
    severity: 'CRITICAL',
    scenarioType: 'MISSING_SECRET',
    description: 'Vault access policy change removed access to STRIPE_API_SECRET key path.',
    flashSaleRisk: 'Application pods restart and crash in CrashLoopBackOff due to missing required credential secret on boot.',
    applyChanges: (env) => {
      const cloned = JSON.parse(JSON.stringify(env)) as EnvironmentState;
      delete (cloned.actual.secrets as any).STRIPE_API_SECRET;
      cloned.configVersion += 1;
      return cloned;
    },
  },
  {
    id: 'scen-wrong-secret-version',
    title: '3. Wrong Secret Version (Deprecated v2 vs Expected v4)',
    targetEnv: 'production',
    category: 'secret_metadata',
    severity: 'CRITICAL',
    scenarioType: 'WRONG_SECRET_VERSION',
    description: 'Vault key rotation completed, but production pods are running with outdated deprecated secret v2.',
    flashSaleRisk: 'Payment provider rejects all HMAC signatures. 100% checkout failure with 401 Unauthorized.',
    applyChanges: (env) => {
      const cloned = JSON.parse(JSON.stringify(env)) as EnvironmentState;
      cloned.actual.secrets.STRIPE_API_SECRET = {
        version: 2,
        status: 'deprecated',
        lastRotated: '2026-04-10',
      };
      cloned.configVersion += 1;
      return cloned;
    },
  },
  {
    id: 'scen-runtime-drift',
    title: '4. Runtime Drift (Rate Limiter OFF & Mock Mode)',
    targetEnv: 'production',
    category: 'runtime',
    severity: 'CRITICAL',
    scenarioType: 'RUNTIME_DRIFT',
    description: 'WAF and flash sale bot rate limiter flags were toggled OFF in memory during a manual curl test.',
    flashSaleRisk: 'Scalper bots exhaust all flash sale inventory in under 3 seconds with zero checkout throttling.',
    applyChanges: (env) => {
      const cloned = JSON.parse(JSON.stringify(env)) as EnvironmentState;
      cloned.actual.runtime.rateLimiterEnabled = false;
      cloned.actual.runtime.paymentMode = 'mock';
      cloned.actual.envVars.FLASH_SALE_RATE_LIMITER_ENABLED = 'false';
      cloned.configVersion += 1;
      return cloned;
    },
  },
  {
    id: 'scen-infrastructure-drift',
    title: '5. Infrastructure Drift (Replicas 4 vs 16, DB Pool 200 vs 1200)',
    targetEnv: 'production',
    category: 'infrastructure',
    severity: 'CRITICAL',
    scenarioType: 'INFRASTRUCTURE_DRIFT',
    description: 'Nightly cost-saving autoscaler reduced cluster size to 4 pods and PgBouncer dropped to 200 connections.',
    flashSaleRisk: 'Incoming 60,000 req/sec traffic surge will instantly exhaust DB connections, resulting in HTTP 502/504 errors.',
    applyChanges: (env) => {
      const cloned = JSON.parse(JSON.stringify(env)) as EnvironmentState;
      cloned.actual.infrastructure.replicas = 4;
      cloned.actual.infrastructure.maxDbConnections = 200;
      cloned.actual.runtime.activeReplicas = 4;
      cloned.configVersion += 1;
      return cloned;
    },
  },
  {
    id: 'scen-duplicate-event',
    title: '6. Duplicate Event (Duplicate Webhook Queue Worker)',
    targetEnv: 'production',
    category: 'runtime',
    severity: 'HIGH',
    scenarioType: 'DUPLICATE_EVENT',
    description: 'Duplicate consumer groups subscribed to checkout-events topic, processing orders twice.',
    flashSaleRisk: 'Customers get charged twice for a single click, and inventory is deducted double from warehouse stock.',
    applyChanges: (env) => {
      const cloned = JSON.parse(JSON.stringify(env)) as EnvironmentState;
      cloned.actual.envVars.ORDER_QUEUE_CONCURRENCY = '300';
      cloned.actual.runtime.connectionPoolUtilizationPct = 94;
      cloned.configVersion += 1;
      return cloned;
    },
  },
  {
    id: 'scen-delayed-event',
    title: '7. Delayed Event (Worker Queue Throttled - 45min Latency)',
    targetEnv: 'production',
    category: 'env_variable',
    severity: 'HIGH',
    scenarioType: 'DELAYED_EVENT',
    description: 'Worker concurrency choked to 5 threads, accumulating an order confirmation backlog of 25,000 requests.',
    flashSaleRisk: 'Buyers see payment pending spinning wheels for up to 45 minutes, creating panic and customer support collapse.',
    applyChanges: (env) => {
      const cloned = JSON.parse(JSON.stringify(env)) as EnvironmentState;
      cloned.actual.envVars.ORDER_QUEUE_CONCURRENCY = '5';
      cloned.actual.runtime.cacheTtlSeconds = 300;
      cloned.configVersion += 1;
      return cloned;
    },
  },
  {
    id: 'scen-out-of-order-event',
    title: '8. Out-of-Order Event (App v10 Deployed Before DB Migration)',
    targetEnv: 'production',
    category: 'runtime',
    severity: 'CRITICAL',
    scenarioType: 'OUT_OF_ORDER_EVENT',
    description: 'CI/CD runner applied app binary v10 before schema migration finished; discount column missing in DB.',
    flashSaleRisk: 'Every checkout API call throws SQL syntax error (column "discount_tier_v2" does not exist).',
    applyChanges: (env) => {
      const cloned = JSON.parse(JSON.stringify(env)) as EnvironmentState;
      cloned.actual.runtime.deployedCommit = 'sha-unmigrated-v10';
      cloned.actual.runtime.paymentMode = 'sandbox';
      cloned.actual.envVars.ENABLE_DYNAMIC_PRICING = 'false';
      cloned.configVersion = 10;
      return cloned;
    },
  },
];

const STORAGE_KEY = 'config_drift_validator_envs_v2';
const AUDIT_STORAGE_KEY = 'config_drift_validator_audits_v2';
const VERSIONS_STORAGE_KEY = 'config_drift_validator_versions_v2';
const HISTORY_STORAGE_KEY = 'config_drift_validator_history_v2';
const ALERTS_STORAGE_KEY = 'config_drift_validator_alerts_v2';

export function loadStoredEnvironments(): EnvironmentState[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('Failed to load from localStorage', e);
  }
  return INITIAL_ENVIRONMENTS;
}

export function saveEnvironments(envs: EnvironmentState[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(envs));
  } catch (e) {
    console.warn('Failed to save to localStorage', e);
  }
}

export function loadStoredVersions(): ConfigSnapshot[] {
  try {
    const raw = localStorage.getItem(VERSIONS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('Failed to load versions', e);
  }
  return INITIAL_CONFIG_VERSIONS;
}

export function saveVersions(versions: ConfigSnapshot[]): void {
  try {
    localStorage.setItem(VERSIONS_STORAGE_KEY, JSON.stringify(versions));
  } catch (e) {
    console.warn('Failed to save versions', e);
  }
}

export function loadStoredHistory(): DriftHistoryItem[] {
  try {
    const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('Failed to load history', e);
  }
  return INITIAL_DRIFT_HISTORY;
}

export function saveHistory(items: DriftHistoryItem[]): void {
  try {
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(items));
  } catch (e) {
    console.warn('Failed to save history', e);
  }
}

export function loadStoredAlerts(): SystemAlert[] {
  try {
    const raw = localStorage.getItem(ALERTS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('Failed to load alerts', e);
  }
  return INITIAL_SYSTEM_ALERTS;
}

export function saveAlerts(alerts: SystemAlert[]): void {
  try {
    localStorage.setItem(ALERTS_STORAGE_KEY, JSON.stringify(alerts));
  } catch (e) {
    console.warn('Failed to save alerts', e);
  }
}

// Storage aliases
export const loadVersionSnapshots = loadStoredVersions;
export const saveVersionSnapshots = saveVersions;
export const loadDriftHistory = loadStoredHistory;
export const saveDriftHistory = saveHistory;
export const loadSystemAlerts = loadStoredAlerts;
export const saveSystemAlerts = saveAlerts;

export function loadAuditLogs(): AuditLog[] {
  try {
    const raw = localStorage.getItem(AUDIT_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.warn('Failed to load audit logs', e);
  }
  return [
    {
      id: 'audit-01',
      environmentId: 'prod-01',
      environmentName: 'Production',
      action: 'PRE_DEPLOYMENT_GATE_CHECK',
      user: 'CI/CD Pipeline (GitHub Actions #4182)',
      decision: 'BLOCKED',
      driftCount: 5,
      details: 'Evaluated release v2.4-flash-sale. Gatekeeper BLOCKED deployment due to 3 CRITICAL drifts (Sandbox payment URL, 6/16 replicas, read-replica disabled). Risk Score: 165 pts.',
      timestamp: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
    },
    {
      id: 'audit-02',
      environmentId: 'staging-01',
      environmentName: 'Staging',
      action: 'CONFIGURATION_DRIFT_SCAN',
      user: 'Automated Cron Sensor',
      decision: 'MANUAL_REVIEW',
      driftCount: 2,
      details: 'Detected 2 non-critical drifts in Staging (replicas 4 vs 6, cache TTL 15s vs 5s). Risk Score: 35 pts.',
      timestamp: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    },
    {
      id: 'audit-03',
      environmentId: 'dev-01',
      environmentName: 'Development',
      action: 'AUTO_RECONCILIATION',
      user: 'sarah.devops@company.internal',
      decision: 'APPROVED',
      driftCount: 0,
      details: 'Synchronized development cluster with GitOps master baseline repository. Health Score: 100%.',
      timestamp: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
    },
  ];
}

export function saveAuditLogs(logs: AuditLog[]): void {
  try {
    localStorage.setItem(AUDIT_STORAGE_KEY, JSON.stringify(logs));
  } catch (e) {
    console.warn('Failed to save audit logs', e);
  }
}

export const USER_STORAGE_KEY = 'drift_validator_user_v1';

export const DEFAULT_GOOGLE_USER: UserProfile = {
  id: 'usr_g_dinesh',
  name: 'Dinesh R',
  email: 'dineshr00475@gmail.com',
  avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80',
  role: 'Admin',
  provider: 'google',
  googleId: '1098234871923847',
  token: 'ya29.a0AfH6SMDinesh-OAuthToken-Verified',
  lastLogin: new Date().toISOString(),
  verified: true,
};

export function loadUserProfile(): UserProfile | null {
  try {
    const raw = localStorage.getItem(USER_STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw) as UserProfile;
    }
  } catch (e) {
    console.warn('Failed to load user profile', e);
  }
  // Default to logged-in Google user so user immediately has full dashboard access
  return DEFAULT_GOOGLE_USER;
}

export function saveUserProfile(user: UserProfile | null): void {
  try {
    if (user) {
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(USER_STORAGE_KEY);
    }
  } catch (e) {
    console.warn('Failed to save user profile', e);
  }
}

