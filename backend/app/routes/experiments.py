from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from backend.app.database.session import get_db
from backend.app.schemas.schemas import BenchmarkRequest, BenchmarkResultSchema
from backend.app.services.benchmark_engine import BenchmarkEngine
from backend.app.models.models import BenchmarkRun, BenchmarkRecord, ExperimentResult, User
from backend.app.routes.auth import get_optional_current_user

experiments_router = APIRouter(prefix="/api/experiments", tags=["Benchmark & Experimentation"])


@experiments_router.post("/benchmark/run", response_model=BenchmarkResultSchema)
def run_benchmark(
    req: BenchmarkRequest,
    user: Optional[User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db)
):
    """Execute live 100-scenario benchmark: Baseline Validator vs ConfigGuard Engine."""
    operator = user.email if user else "Chaos Engineering Team"
    result = BenchmarkEngine.run_benchmark(db, req.total_scenarios, operator)
    return BenchmarkResultSchema(**result)


@experiments_router.get("/benchmark/latest")
def get_latest_benchmark(db: Session = Depends(get_db)):
    """Retrieve the latest benchmark run with full scenarios and comparison metrics."""
    latest = BenchmarkEngine.get_latest_run(db)
    if not latest:
        # Run a default benchmark if none exists
        res = BenchmarkEngine.run_benchmark(db, total_scenarios=100, operator_name="Initial System Benchmark")
        return res
    return latest


@experiments_router.get("/benchmark/runs")
def list_benchmark_runs(db: Session = Depends(get_db)):
    """List all historical benchmark runs."""
    runs = db.query(BenchmarkRun).order_by(BenchmarkRun.id.desc()).limit(20).all()
    return [
        {
            "id": r.id,
            "run_name": r.run_name,
            "total_scenarios": r.total_scenarios,
            "healthy_scenarios": r.healthy_scenarios,
            "faulty_scenarios": r.faulty_scenarios,
            "baseline_detection_rate": r.baseline_detection_rate,
            "configguard_detection_rate": r.configguard_detection_rate,
            "detection_improvement_pct": r.detection_improvement_pct,
            "baseline_avg_time_ms": r.baseline_avg_time_ms,
            "configguard_avg_time_ms": r.configguard_avg_time_ms,
            "blocked_deployments": r.blocked_deployments,
            "executed_by": r.executed_by,
            "created_at": r.created_at.isoformat() if r.created_at else None
        }
        for r in runs
    ]


@experiments_router.get("/benchmark/runs/{run_id}")
def get_benchmark_run_details(run_id: int, db: Session = Depends(get_db)):
    """Get detailed results and all individual scenario evaluations for a specific run."""
    run_data = BenchmarkEngine.get_run_by_id(db, run_id)
    if not run_data:
        raise HTTPException(status_code=404, detail="Benchmark run not found")
    return run_data


@experiments_router.get("/results")
def get_experiment_results(db: Session = Depends(get_db)):
    """List historical experiment results."""
    results = db.query(ExperimentResult).order_by(ExperimentResult.id.desc()).limit(20).all()
    return [
        {
            "id": r.id,
            "experiment_name": r.experiment_name,
            "total_runs": r.total_runs,
            "status": r.status,
            "created_at": r.created_at.isoformat() if r.created_at else None
        }
        for r in results
    ]

