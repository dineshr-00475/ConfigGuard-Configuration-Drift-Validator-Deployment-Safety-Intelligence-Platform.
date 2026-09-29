import {
  EnvironmentState,
  DriftRecord,
  DeploymentGateCheck,
  DriftSeverity,
  DeploymentDecision,
} from '../types';

export const SEVERITY_POINTS: Record<DriftSeverity, number> = {
  CRITICAL: 40,
  HIGH: 25,
  MEDIUM: 10,
  LOW: 5,
};

export function detectDrifts(env: EnvironmentState): DriftRecord[] {
  const drifts: DriftRecord[] = [];
  const envName = env.name;
  const isProd = envName === 'production';
  const isStaging = envName === 'staging';

  // 1. Infrastructure Checks
  const expInfra = env.expected.infrastructure;
  const actInfra = env.actual.infrastructure;

  if (actInfra.replicas !== expInfra.replicas) {
    const isUnderprovisioned = actInfra.replicas < expInfra.replicas;
    const severity: DriftSeverity = isProd && isUnderprovisioned ? 'CRITICAL' : isStaging ? 'HIGH' : 'MEDIUM';
    const riskPoints = SEVERITY_POINTS[severity];
    drifts.push({
      id: `drift-infra-replicas-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      environmentId: env.id,
      category: 'infrastructure',
      key: 'replicas',
      expectedValue: expInfra.replicas,
      actualValue: actInfra.replicas,
      severity,
      riskPoints,
      reason: `Expected ${expInfra.replicas} active instances, but live cluster running ${actInfra.replicas}`,
      impact: isUnderprovisioned
        ? 'Severe capacity risk: insufficient pods to handle flash-sale traffic spike (50k+ req/sec).'
        : 'Overprovisioned capacity: increased cluster cost.',
      rootCause: 'Autoscaler minimum replicas configuration was scaled down by off-peak cron job without resetting for flash sale launch window.',
      recommendedFix: `kubectl scale deployment/checkout-service --replicas=${expInfra.replicas} -n ecommerce-prod`,
      status: 'OPEN',
      detectedAt: new Date().toISOString(),
    });
  }

  if (actInfra.maxDbConnections !== expInfra.maxDbConnections) {
    const isDeficit = actInfra.maxDbConnections < expInfra.maxDbConnections;
    const severity: DriftSeverity = isProd && isDeficit ? 'CRITICAL' : 'HIGH';
    const riskPoints = SEVERITY_POINTS[severity];
    drifts.push({
      id: `drift-infra-dbconn-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      environmentId: env.id,
      category: 'infrastructure',
      key: 'maxDbConnections',
      expectedValue: expInfra.maxDbConnections,
      actualValue: actInfra.maxDbConnections,
      severity,
      riskPoints,
      reason: `Database connection pool configured for ${actInfra.maxDbConnections}, expected ${expInfra.maxDbConnections}`,
      impact: isDeficit
        ? 'Database connection exhaustion hazard. Simultaneous checkout requests will timeout with 500 errors.'
        : 'Excessive connections may stress DB RAM.',
      rootCause: 'Database connection pooler proxy (PgBouncer) configuration file applied with staging limits instead of production IaC baseline.',
      recommendedFix: `aws rds modify-db-parameter-group --db-parameter-group-name flash-pg-prod --parameters "ParameterName=max_connections,ParameterValue=${expInfra.maxDbConnections},ApplyMethod=immediate"`,
      status: 'OPEN',
      detectedAt: new Date().toISOString(),
    });
  }

  if (actInfra.cpuCores !== expInfra.cpuCores || actInfra.memoryGb !== expInfra.memoryGb) {
    const severity: DriftSeverity = isProd ? 'HIGH' : 'MEDIUM';
    const riskPoints = SEVERITY_POINTS[severity];
    drifts.push({
      id: `drift-infra-sizing-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      environmentId: env.id,
      category: 'infrastructure',
      key: 'compute_sizing',
      expectedValue: `${expInfra.cpuCores} vCPU / ${expInfra.memoryGb}GB RAM`,
      actualValue: `${actInfra.cpuCores} vCPU / ${actInfra.memoryGb}GB RAM`,
      severity,
      riskPoints,
      reason: 'Container compute limits diverge from Infrastructure-as-Code Terraform definition',
      impact: 'Risk of CPU throttling or OOM (Out Of Memory) kills during high-throughput sale events.',
      rootCause: 'Manual Helm values override applied during emergency hotfix testing was not committed back to Git repository.',
      recommendedFix: `terraform apply -target=module.kubernetes_workloads.helm_release.checkout -auto-approve`,
      status: 'OPEN',
      detectedAt: new Date().toISOString(),
    });
  }

  if (actInfra.readReplicaEnabled !== expInfra.readReplicaEnabled) {
    const severity: DriftSeverity = isProd ? 'CRITICAL' : 'HIGH';
    const riskPoints = SEVERITY_POINTS[severity];
    drifts.push({
      id: `drift-infra-readreplica-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      environmentId: env.id,
      category: 'infrastructure',
      key: 'readReplicaEnabled',
      expectedValue: expInfra.readReplicaEnabled,
      actualValue: actInfra.readReplicaEnabled,
      severity,
      riskPoints,
      reason: `Read replicas are ${actInfra.readReplicaEnabled ? 'ENABLED' : 'DISABLED'} in live environment, expected ${expInfra.readReplicaEnabled ? 'ENABLED' : 'DISABLED'}`,
      impact: 'Catalog browsing load will hit primary master database directly, causing lockups.',
      rootCause: 'Database failover drill last week disconnected the read replica endpoint from cluster load balancer.',
      recommendedFix: `aws rds create-db-instance-read-replica --db-instance-identifier flash-store-replica-01 --source-db-instance-identifier flash-store-primary`,
      status: 'OPEN',
      detectedAt: new Date().toISOString(),
    });
  }

  // 2. Environment Variables Checks
  const expEnv = env.expected.envVars;
  const actEnv = env.actual.envVars;

  const allEnvKeys = Array.from(new Set([...Object.keys(expEnv), ...Object.keys(actEnv)]));
  for (const key of allEnvKeys) {
    const expVal = expEnv[key];
    const actVal = actEnv[key];

    if (expVal !== actVal) {
      let severity: DriftSeverity = 'MEDIUM';
      let reason = `Variable ${key} has drifted from GitOps specification`;
      let impact = 'Potential behavioral discrepancy between stages.';
      let rootCause = 'ConfigMap synchronization failed or was manually edited in production namespace.';
      let recommendedFix = `kubectl set env deployment/checkout-service ${key}="${expVal}" -n ecommerce-prod`;

      if (key === 'PAYMENT_GATEWAY_URL') {
        if (isProd && (actVal?.includes('sandbox') || actVal?.includes('test'))) {
          severity = 'CRITICAL';
          reason = 'CRITICAL ERROR: Production pointing to SANDBOX payment gateway URL!';
          impact = 'REAL CUSTOMERS CANNOT COMPLETE TRANSACTIONS. Flash sale will suffer 100% checkout failure.';
          rootCause = 'Developer hotfix commit #8a12 accidentally hardcoded sandbox URL in test environment and promoted manifest without staging gate.';
          recommendedFix = `aws ssm put-parameter --name "/prod/ecommerce/PAYMENT_GATEWAY_URL" --type "String" --value "${expVal}" --overwrite && kubectl rollout restart deployment/checkout-service`;
        } else {
          severity = isProd ? 'CRITICAL' : 'HIGH';
          rootCause = 'URL points to unapproved endpoint variant.';
          recommendedFix = `kubectl set env deployment/checkout-service PAYMENT_GATEWAY_URL="${expVal}"`;
        }
      } else if (key === 'PAYMENT_MODE') {
        if (isProd && actVal !== 'production') {
          severity = 'CRITICAL';
          reason = `PAYMENT_MODE is '${actVal}' in production cluster, expected '${expVal}'`;
          impact = 'Orders will not charge real payment cards. Fraud risk and revenue disruption.';
          rootCause = 'Feature flag toggled during local integration testing and accidentally pushed to config repository.';
          recommendedFix = `aws ssm put-parameter --name "/prod/ecommerce/PAYMENT_MODE" --value "production" --overwrite`;
        }
      } else if (key === 'INVENTORY_CACHE_TTL_SEC') {
        const actNum = Number(actVal);
        const expNum = Number(expVal);
        if (actNum > expNum) {
          severity = isProd ? 'HIGH' : 'MEDIUM';
          reason = `Inventory cache TTL set to ${actVal}s instead of expected ${expVal}s`;
          impact = 'Severe overselling risk: cached inventory numbers will show in-stock items already sold out.';
          rootCause = 'Cache TTL extended to relieve Redis CPU load during peak test, but not restored for flash sale.';
          recommendedFix = `redis-cli -h cache-prod.internal CONFIG SET default-ttl ${expVal} && kubectl set env deploy/inventory-service INVENTORY_CACHE_TTL_SEC=${expVal}`;
        }
      } else if (key === 'FLASH_SALE_RATE_LIMITER_ENABLED') {
        if (actVal === 'false' && expVal === 'true') {
          severity = isProd ? 'CRITICAL' : 'HIGH';
          reason = 'Bot protection & Flash Sale Rate Limiter is DISABLED in actual environment';
          impact = 'Scalpers and automated bots will bypass queue and overwhelm checkout APIs.';
          rootCause = 'Security rate limiter was bypassed for load-testing script and never re-armed before gate check.';
          recommendedFix = `kubectl set env deployment/gateway-service FLASH_SALE_RATE_LIMITER_ENABLED=true -n ecommerce-prod`;
        }
      } else if (key === 'ORDER_QUEUE_CONCURRENCY') {
        severity = isProd ? 'HIGH' : 'MEDIUM';
        reason = `Order processing worker concurrency is ${actVal}, expected ${expVal}`;
        impact = 'Order confirmation backlog will accumulate rapidly.';
        rootCause = 'Worker concurrency reduced to prevent downstream database strain during migration.';
        recommendedFix = `kubectl set env deploy/order-worker ORDER_QUEUE_CONCURRENCY=${expVal}`;
      } else if (key === 'LOG_LEVEL') {
        severity = 'LOW';
        reason = `Log level is set to '${actVal}', expected '${expVal}'`;
        impact = 'Excessive disk I/O and log ingestion cost from debug telemetry in production.';
        rootCause = 'Debug logging enabled during incident triage and not rolled back.';
        recommendedFix = `kubectl set env deploy/checkout-service LOG_LEVEL=warn`;
      }

      drifts.push({
        id: `drift-env-${key}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        environmentId: env.id,
        category: 'env_variable',
        key,
        expectedValue: expVal ?? '<UNDEFINED>',
        actualValue: actVal ?? '<MISSING>',
        severity,
        riskPoints: SEVERITY_POINTS[severity],
        reason,
        impact,
        rootCause,
        recommendedFix,
        status: 'OPEN',
        detectedAt: new Date().toISOString(),
      });
    }
  }

  // 3. Secrets Metadata Checks
  const expSec = env.expected.secrets;
  const actSec = env.actual.secrets;
  const allSecKeys = Array.from(new Set([...Object.keys(expSec), ...Object.keys(actSec)]));

  for (const sKey of allSecKeys) {
    const expS = expSec[sKey];
    const actS = actSec[sKey];

    if (!actS) {
      drifts.push({
        id: `drift-sec-${sKey}-missing-${Date.now()}`,
        environmentId: env.id,
        category: 'secret_metadata',
        key: sKey,
        expectedValue: `Version ${expS.version} (${expS.status})`,
        actualValue: 'MISSING IN VAULT',
        severity: 'CRITICAL',
        riskPoints: SEVERITY_POINTS.CRITICAL,
        reason: `Required secret ${sKey} is missing from live secret store / Vault`,
        impact: 'Application service startup crash / auth rejection.',
        rootCause: 'Secret path misconfigured in Kubernetes ExternalSecrets CRD operator.',
        recommendedFix: `vault kv put secret/ecommerce/${sKey} version=${expS.version} status=active && kubectl rollout restart deploy/checkout-service`,
        status: 'OPEN',
        detectedAt: new Date().toISOString(),
      });
    } else if (expS && (actS.version !== expS.version || actS.status !== expS.status)) {
      const isVersionMismatch = actS.version !== expS.version;
      const severity: DriftSeverity = isProd ? (isVersionMismatch ? 'CRITICAL' : 'HIGH') : 'MEDIUM';

      drifts.push({
        id: `drift-sec-${sKey}-ver-${Date.now()}`,
        environmentId: env.id,
        category: 'secret_metadata',
        key: sKey,
        expectedValue: `v${expS.version} [${expS.status}]`,
        actualValue: `v${actS.version} [${actS.status}]`,
        severity,
        riskPoints: SEVERITY_POINTS[severity],
        reason: isVersionMismatch
          ? `Secret version mismatch: running v${actS.version}, expected v${expS.version}`
          : `Secret status is ${actS.status}, expected ${expS.status}`,
        impact: isVersionMismatch
          ? 'Encryption key mismatch: previous version may have been rotated or compromised.'
          : 'Expired secrets will cause 401 Unauthorized errors from payment/auth upstream.',
        rootCause: 'Key rotation completed in HashiCorp Vault, but worker pods did not reload mounted secret volume.',
        recommendedFix: `kubectl rollout restart deployment/checkout-service -n ecommerce-prod`,
        status: 'OPEN',
        detectedAt: new Date().toISOString(),
      });
    }
  }

  // 4. Runtime Live Checks
  const expRun = env.expected.runtime;
  const actRun = env.actual.runtime;

  if (actRun.paymentMode !== expRun.paymentMode) {
    drifts.push({
      id: `drift-runtime-paymode-${Date.now()}`,
      environmentId: env.id,
      category: 'runtime',
      key: 'paymentMode',
      expectedValue: expRun.paymentMode,
      actualValue: actRun.paymentMode,
      severity: isProd ? 'CRITICAL' : 'HIGH',
      riskPoints: isProd ? SEVERITY_POINTS.CRITICAL : SEVERITY_POINTS.HIGH,
      reason: `Live payment service running in '${actRun.paymentMode}' mode, expected '${expRun.paymentMode}'`,
      impact: 'Critical payment pipeline fault.',
      rootCause: 'Runtime application instance started with test profile flags.',
      recommendedFix: `curl -X POST https://checkout.flashstore.com/internal/config/reload -H "Authorization: Bearer $(vault token create)"`,
      status: 'OPEN',
      detectedAt: new Date().toISOString(),
    });
  }

  if (actRun.rateLimiterEnabled !== expRun.rateLimiterEnabled) {
    drifts.push({
      id: `drift-runtime-ratelimit-${Date.now()}`,
      environmentId: env.id,
      category: 'runtime',
      key: 'rateLimiterEnabled',
      expectedValue: expRun.rateLimiterEnabled,
      actualValue: actRun.rateLimiterEnabled,
      severity: isProd ? 'CRITICAL' : 'HIGH',
      riskPoints: isProd ? SEVERITY_POINTS.CRITICAL : SEVERITY_POINTS.HIGH,
      reason: `Runtime rate limiter status is ${actRun.rateLimiterEnabled ? 'ON' : 'OFF'}`,
      impact: 'Unprotected API endpoints vulnerable to DDOS during flash sale drop.',
      rootCause: 'Circuit breaker opened during ingress health check and remained tripped.',
      recommendedFix: `curl -X POST https://checkout.flashstore.com/internal/ratelimit/enable -d '{"windowMs":60000,"max":100}'`,
      status: 'OPEN',
      detectedAt: new Date().toISOString(),
    });
  }

  return drifts;
}

export const ENV_MULTIPLIERS: Record<string, number> = {
  development: 0.7,
  staging: 0.85,
  production: 1.0,
};

export function calculateRiskScore(
  drifts: DriftRecord[],
  envName: string = 'production'
): {
  rawPoints: number;
  totalPoints: number;
  multiplier: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  healthScore: number;
  riskLevel: DriftSeverity;
  hardBlockTriggered: boolean;
  hardBlockReason?: string;
  formulaBreakdown: {
    criticalContribution: number;
    highContribution: number;
    mediumContribution: number;
    lowContribution: number;
    rawSum: number;
    normalizedRaw: number;
    environmentMultiplier: number;
    finalScore: number;
    classification: string;
  };
} {
  const criticalCount = drifts.filter((d) => d.severity === 'CRITICAL').length;
  const highCount = drifts.filter((d) => d.severity === 'HIGH').length;
  const mediumCount = drifts.filter((d) => d.severity === 'MEDIUM').length;
  const lowCount = drifts.filter((d) => d.severity === 'LOW').length;

  const rawSum =
    criticalCount * SEVERITY_POINTS.CRITICAL +
    highCount * SEVERITY_POINTS.HIGH +
    mediumCount * SEVERITY_POINTS.MEDIUM +
    lowCount * SEVERITY_POINTS.LOW;

  const normalizedRaw = Math.min(100, rawSum);
  const normEnv = (envName || 'production').toLowerCase();
  const multiplier = ENV_MULTIPLIERS[normEnv] ?? 1.0;

  const finalRisk = drifts.length === 0 ? 0 : Math.min(100, Math.round(normalizedRaw * multiplier));

  let riskLevel: DriftSeverity = 'LOW';
  if (finalRisk > 75) {
    riskLevel = 'CRITICAL';
  } else if (finalRisk > 50) {
    riskLevel = 'HIGH';
  } else if (finalRisk > 20) {
    riskLevel = 'MEDIUM';
  } else {
    riskLevel = 'LOW';
  }

  // Hard block invariant in production
  let hardBlockTriggered = false;
  let hardBlockReason: string | undefined = undefined;
  if (normEnv === 'production') {
    for (const d of drifts) {
      if (d.severity === 'CRITICAL') {
        const keyUpper = (d.key || '').toUpperCase();
        const catUpper = (d.category || '').toUpperCase();
        const isPayment = keyUpper.includes('PAYMENT') || keyUpper.includes('STRIPE') || keyUpper.includes('GATEWAY');
        const isDb = keyUpper.includes('DATABASE') || keyUpper.includes('DB') || keyUpper.includes('CONNECTION') || keyUpper.includes('REPLICA');
        const isAuthSec = keyUpper.includes('AUTH') || keyUpper.includes('JWT') || keyUpper.includes('SECRET') || keyUpper.includes('KEY') || catUpper.includes('SECRET');
        if (isPayment || isDb || isAuthSec) {
          hardBlockTriggered = true;
          const domain = isPayment ? 'Payment' : isDb ? 'Database' : 'Security/Auth';
          hardBlockReason = `HARD SAFETY INVARIANT: Critical ${domain} drift ('${d.key}') detected in Production. Release unconditionally BLOCKED.`;
          break;
        }
      }
    }
  }

  const healthScore = Math.max(0, 100 - finalRisk);

  return {
    rawPoints: normalizedRaw,
    totalPoints: finalRisk,
    multiplier,
    criticalCount,
    highCount,
    mediumCount,
    lowCount,
    healthScore,
    riskLevel,
    hardBlockTriggered,
    hardBlockReason,
    formulaBreakdown: {
      criticalContribution: criticalCount * SEVERITY_POINTS.CRITICAL,
      highContribution: highCount * SEVERITY_POINTS.HIGH,
      mediumContribution: mediumCount * SEVERITY_POINTS.MEDIUM,
      lowContribution: lowCount * SEVERITY_POINTS.LOW,
      rawSum,
      normalizedRaw,
      environmentMultiplier: multiplier,
      finalScore: finalRisk,
      classification: riskLevel,
    },
  };
}

export function calculateHealthScore(drifts: DriftRecord[], envName: string = 'production'): number {
  return calculateRiskScore(drifts, envName).healthScore;
}

export function evaluateGatekeeper(
  env: EnvironmentState,
  drifts: DriftRecord[],
  targetReleaseVersion: string = 'v2.4-flash-sale'
): DeploymentGateCheck {
  const risk = calculateRiskScore(drifts, env.name);

  const infraDrifts = drifts.filter((d) => d.category === 'infrastructure');
  const envDrifts = drifts.filter((d) => d.category === 'env_variable');
  const secDrifts = drifts.filter((d) => d.category === 'secret_metadata');
  const runDrifts = drifts.filter((d) => d.category === 'runtime');

  const getCheckStatus = (catDrifts: DriftRecord[]): 'PASS' | 'WARNING' | 'FAIL' => {
    if (catDrifts.some((d) => d.severity === 'CRITICAL')) return 'FAIL';
    if (catDrifts.some((d) => d.severity === 'HIGH')) return 'WARNING';
    if (catDrifts.length > 0) return 'WARNING';
    return 'PASS';
  };

  const infraCheck = getCheckStatus(infraDrifts);
  const envCheck = getCheckStatus(envDrifts);
  const secCheck = getCheckStatus(secDrifts);
  const runCheck = getCheckStatus(runDrifts);

  let decision: DeploymentDecision = 'APPROVED';
  let reason = 'All expected configurations match live runtime environment. Green light for release.';

  if (drifts.length === 0) {
    decision = 'APPROVED';
    reason = 'Zero configuration drift detected. All declarative invariants verified.';
  } else if (risk.hardBlockTriggered && risk.hardBlockReason) {
    decision = 'BLOCKED';
    reason = risk.hardBlockReason;
  } else if (risk.totalPoints > 75) {
    decision = 'BLOCKED';
    reason = `PRE-DEPLOYMENT GATEKEEPER TRIGGERED: CRITICAL risk (${risk.totalPoints}/100). Severe failure hazard detected.`;
  } else if (risk.totalPoints > 50) {
    decision = 'BLOCKED';
    reason = `PRE-DEPLOYMENT GATEKEEPER TRIGGERED: HIGH risk (${risk.totalPoints}/100). Significant configuration mismatch poses severe release hazard.`;
  } else if (risk.totalPoints > 20) {
    decision = 'MANUAL_REVIEW';
    reason = `Manual review required: MEDIUM risk (${risk.totalPoints}/100). Non-breaking configuration differences require approval from Release Lead.`;
  } else {
    decision = 'APPROVED_WITH_WARNING';
    reason = `Approved with warnings. LOW risk (${risk.totalPoints}/100). Non-breaking cosmetic or logging differences detected.`;
  }

  const readinessScore = drifts.length === 0 ? 100 : Math.max(0, 100 - Math.round(risk.totalPoints * 1.1));

  return {
    id: `gate-check-${Date.now()}`,
    environmentId: env.id,
    targetReleaseVersion,
    decision,
    reason,
    driftCount: drifts.length,
    criticalCount: risk.criticalCount,
    highCount: risk.highCount,
    mediumCount: risk.mediumCount,
    lowCount: risk.lowCount,
    riskScore: risk.totalPoints,
    healthScore: risk.healthScore,
    readinessScore,
    checks: {
      infrastructure: infraCheck,
      envVars: envCheck,
      secrets: secCheck,
      runtime: runCheck,
    },
    validatedAt: new Date().toISOString(),
  };
}

