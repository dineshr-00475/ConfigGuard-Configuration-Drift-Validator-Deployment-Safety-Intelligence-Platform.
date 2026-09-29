# ConfigGuard — Configuration Drift Validator & Deployment Safety Intelligence Platform

**ConfigGuard** is an enterprise-grade pre-deployment configuration drift detection, risk scoring, and deployment gatekeeping platform built for high-concurrency flash-sale e-commerce environments. It continuously validates expected (GitOps/declarative) vs. actual (live cluster/runtime) states across **Development**, **Staging**, and **Production** to prevent catastrophic production outages before traffic surges.

---

## Key Features

### 1. Multi-Layer Configuration Drift Detection
- **4-Layer Deep Inspection:** Compares declarative baselines against live states across:
  - **Infrastructure (`infrastructure`):** CPU cores, memory limits, database instance classes, replica counts, max database connections, and read-replica status.
  - **Environment Variables (`env_variable`):** `PAYMENT_MODE`, `PAYMENT_GATEWAY_URL`, `FLASH_SALE_RATE_LIMITER_ENABLED`, `INVENTORY_CACHE_TTL_SEC`, `ORDER_QUEUE_CONCURRENCY`, `LOG_LEVEL`, etc.
  - **Secret Metadata (`secret_metadata`):** KMS/Vault secret versions and active/deprecated status (`STRIPE_API_SECRET`, `DB_MASTER_CREDENTIALS`, `JWT_SIGNING_KEY`).
  - **Runtime Snapshots (`runtime`):** Live container API endpoints, active payment mode, running replica counts, and connection pools.
- **Deterministic SHA-256 Fingerprinting:** Cryptographic comparison between expected and actual environment snapshots.

### 2. Risk Scoring & Automated Deployment Gatekeeper
- **Weighted Risk Calculation:** Evaluates drift severity (`CRITICAL`, `HIGH`, `MEDIUM`, `LOW`) with environment multipliers (`development: 0.7x`, `staging: 0.85x`, `production: 1.0x`).
- **Production Safety Score:** Real-time 0–100 breakdown across Infrastructure, Env Vars, Secrets, Runtime, and Service Dependencies.
- **Automated Gatekeeper Decisions:**
  - `APPROVED` — Zero drifts; safe for immediate progression.
  - `WARNING` — Minor low-severity drift; proceeds with observability alert.
  - `MANUAL_REVIEW` — Medium/High risk; requires Release Manager sign-off.
  - `BLOCKED` — Critical drift or risk threshold exceeded; halts pipeline progression automatically.

### 3. 7-Stage Pre-Deployment Safety Pipeline
- Executes sequential gates:
  1. **Configuration Snapshot**
  2. **Drift Detection**
  3. **Secret Verification**
  4. **Risk Assessment**
  5. **Policy Evaluation**
  6. **Deployment Gate Decision**
  7. **Post-Check Verification**
- Enforces environment promotion order (`Development → Staging → Production`) and blocks promotion to Production if Staging is unhealthy or unvalidated.

### 4. Root Cause Analysis (RCA) & Dependency Impact Graph
- **Automated Root Cause Analysis:** Pinpoints the exact misconfiguration, evidence trail, blast radius, confidence level, and recommended remediation.
- **Service Dependency Impact Graph:** Visualizes upstream/downstream impact across `Checkout Service`, `Payment Gateway`, `Inventory Engine`, `Order Queue`, `Redis Cache`, and `PostgreSQL Primary/Replica`.

### 5. Chaos & Failure Scenario Simulator + What-If Analysis
- **8 Flash-Sale Failure Scenarios:** Inject real-world production faults (`PAYMENT_SANDBOX_LEAK`, `REPLICA_UNDERPROVISIONED`, `RATE_LIMITER_DISABLED`, `WRONG_SECRET_VERSION`, `DB_CONN_POOL_THROTTLED`, `HIGH_CACHE_TTL`, `READ_REPLICA_DISABLED`, `DEBUG_LOGGING_PROD`).
- **One-Click Auto-Remediation:** Reconcile individual drift keys or recover an entire environment back to its golden baseline.
- **What-If Simulator:** Preview how proposed configuration changes will impact drift counts, risk scores, and gatekeeper decisions without mutating live state.

### 6. Incident Management & Change Request Governance
- **Auto-Generated Incidents:** Critical drifts and blocked deployments automatically open deduplicated incidents (`INC-xxxx`) with full lifecycle tracking (`OPEN → INVESTIGATING → MITIGATED → RESOLVED`).
- **Change Request Workflow:** Submit, review, approve/reject, and apply configuration changes with automatic re-validation and rollback protection.

### 7. Research Benchmark Lab, Performance Telemetry & Guided Demo
- **100-Scenario Research Benchmark:** Compares **Traditional CI/CD Baseline** vs. **ConfigGuard** across detection accuracy, false negatives, and validation latency.
- **Performance Analytics & SLA Monitoring:** Tracks validation latency (`P50`/`P95`/`P99`), API throughput, drift resolution time, and recovery speed.
- **10-Step Interactive Guided Demo:** Isolated sandbox walkthrough demonstrating normal configuration, drift injection, root cause analysis, blocked deployment, auto-remediation, and safe promotion without mutating real production data.
- **Compliance & Report Exports:** Export `validation`, `drift-history`, `benchmark`, and `audit-logs` reports in **CSV** or **JSON** with SHA-256 integrity hashes.

---

## Tech Stack

| Layer | Technology |
| :--- | :--- |
| **Frontend** | React 19, TypeScript, Tailwind CSS 4, Recharts, Lucide Icons, Vite 6 |
| **Backend** | Python 3.10+, FastAPI, SQLAlchemy ORM, Pydantic, Uvicorn |
| **Database** | SQLite (`drift_validator.db`, auto-seeded on startup) / PostgreSQL compatible |
| **Security & Auth** | PBKDF2-HMAC-SHA256 password hashing, signed Bearer tokens, Role-Based Access Control (RBAC) |
| **Testing** | Pytest + FastAPI `TestClient` (65 automated integration, safety, and chaos tests) |

---

## Project Structure

```text
├── backend/
│   ├── app/
│   │   ├── config.py                 # Application settings & token configuration
│   │   ├── main.py                   # FastAPI app entrypoint, middleware & router registration
│   │   ├── database/
│   │   │   ├── session.py            # SQLAlchemy engine & session management
│   │   │   └── seed_data.py          # Multi-environment baseline & drift seeding
│   │   ├── models/
│   │   │   └── models.py             # SQLAlchemy models (Environments, Drifts, Pipelines, Incidents, etc.)
│   │   ├── routes/
│   │   │   ├── auth.py               # Authentication, session tokens & RBAC dependencies
│   │   │   ├── dashboard.py          # Fleet metrics & executive safety overview
│   │   │   ├── environments.py       # Environment CRUD & status endpoints
│   │   │   ├── configurations.py     # Golden baseline versions & diffs
│   │   │   ├── validation.py         # Drift detection, RCA, safety score & reconciliation
│   │   │   ├── simulation.py         # Chaos scenario injection, recovery & What-If engine
│   │   │   ├── deployments.py        # Deployment history & live deployment monitor
│   │   │   ├── dependencies.py       # Service dependency graph & blast radius
│   │   │   ├── events.py             # Idempotent & version-ordered event ingestion
│   │   │   ├── experiments.py        # 100-scenario baseline vs. ConfigGuard benchmark
│   │   │   ├── operations.py         # Pipelines, Incidents, Change Requests, Telemetry, Exports & Demo
│   │   │   ├── audit.py              # Immutable audit trail
│   │   │   ├── notifications.py      # Real-time alert notifications
│   │   │   ├── settings.py           # System, validation & deployment policy configuration
│   │   │   ├── users.py              # User & role administration
│   │   │   └── health.py             # Live subsystem probes (DB, validation engine, gatekeeper)
│   │   ├── schemas/
│   │   │   └── schemas.py            # Pydantic request/response schemas
│   │   └── services/
│   │       ├── drift_engine.py       # Core 4-layer drift detector, risk scorer & gatekeeper
│   │       ├── simulation_service.py # Fault injection & baseline reconciliation service
│   │       ├── dependency_service.py # Topological service dependency & impact analyzer
│   │       ├── event_engine.py       # Event idempotency & out-of-order protection
│   │       ├── benchmark_service.py  # Synthetic benchmark evaluation engine
│   │       └── audit_service.py      # Centralized audit logging helper
│   └── tests/                        # 65 automated Pytest test cases
├── src/
│   ├── components/                   # Modular React views (Pipeline, Incidents, Analytics, Demo, etc.)
│   ├── pages/                        # Top-level page containers & modals
│   ├── services/                     # API client (`apiClient.ts`) & reactive store (`store.ts`)
│   ├── types.ts                      # TypeScript interfaces
│   └── App.tsx                       # Main application shell & navigation
├── package.json
└── vite.config.ts                    # Vite dev server (port 3000) + auto-spawned FastAPI proxy (port 8088)
```

---

## Getting Started

### Prerequisites
- **Node.js** 18+ and `npm`
- **Python** 3.10+ and `pip`

### 1. Install Dependencies

```bash
# Install frontend dependencies
npm install

# Install backend Python dependencies
pip install fastapi uvicorn sqlalchemy pydantic pytest httpx
```

### 2. Run the Application (Development Mode)

Starting the Vite server on port `3000` automatically spawns the FastAPI backend on port `8088` and proxies `/api/*` requests:

```bash
npm run dev
```

- **Frontend UI:** `http://localhost:3000`
- **Backend API:** `http://localhost:8088`
- **Interactive Swagger Docs:** `http://localhost:8088/docs`

*(Optional) To run the FastAPI backend standalone:*
```bash
python3 -m uvicorn backend.app.main:app --host 0.0.0.0 --port 8088 --reload
```

---

## Demo Accounts & RBAC Roles

The database automatically seeds 4 role-based accounts on startup:

| Role | Email | Password | Permissions |
| :--- | :--- | :--- | :--- |
| **Admin** | `admin@configguard.io` | `admin123` | Full access: user management, system policies, drift remediation, pipeline overrides |
| **Release Manager** | `release@configguard.io` | `release123` | Approve/reject change requests, run deployment pipelines, export compliance reports |
| **DevOps Engineer** | `devops@configguard.io` | `devops123` | Trigger validations, inject/recover chaos simulations, manage incidents |
| **Developer** | `dev@configguard.io` | `dev123` | View environments, inspect drifts, run What-If simulations, submit change requests |

---

## Running Tests & Verification

```bash
# Run the full 65-test backend suite (unit, integration, chaos & concurrency tests)
python3 -m pytest backend/tests/ -v

# Run frontend TypeScript type-checking
npm run lint

# Build production frontend bundle
npm run build
```

---

## Core API Endpoints Overview

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/health` | Deep health check across DB, validation engine, simulator, and gatekeeper |
| `GET` | `/api/dashboard/metrics` | Fleet risk score, safety score, drift trends, and decision distribution |
| `GET` | `/api/environments` | List all environments with readiness, health, and drift counts |
| `POST` | `/api/validation/run/{env_name}` | Execute 4-layer drift validation and gatekeeper evaluation |
| `GET` | `/api/validation/rca/{env_name}` | Generate Root Cause Analysis for active environment drifts |
| `POST` | `/api/validation/reconcile-all/{env_name}` | Auto-remediate all drifts in an environment back to baseline |
| `POST` | `/api/simulation/inject` | Inject a flash-sale failure scenario into a target environment |
| `POST` | `/api/simulation/what-if` | Run non-destructive What-If configuration simulation |
| `POST` | `/api/pipelines/run/{env_name}` | Execute the 7-stage pre-deployment safety pipeline |
| `GET` | `/api/incidents` | List auto-created and active drift/deployment incidents |
| `GET` | `/api/change-requests` | List configuration change requests and governance status |
| `GET` | `/api/performance/metrics` | Real-time P50/P95/P99 validation latency and SLA telemetry |
| `GET` | `/api/reports/export/{report_type}` | Export `validation`, `drift-history`, `benchmark`, or `audit-logs` (`csv`/`json`) |
| `POST` | `/api/demo/step/{step_number}` | Execute steps 1–10 of the isolated Guided Demo walkthrough |
