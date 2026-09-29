from typing import Dict, Any, List
from sqlalchemy.orm import Session
from backend.app.models.models import Environment
from backend.app.services.drift_engine import DriftDetectionEngine

BASE_NODES = [
    {"id": "frontend-checkout", "label": "Storefront Web App", "category": "frontend", "type": "Micro Frontend"},
    {"id": "api-gateway", "label": "API Ingress Gateway", "category": "gateway", "type": "Envoy / NGINX"},
    {"id": "payment-service", "label": "Checkout Payment Service", "category": "service", "type": "Node.js Service"},
    {"id": "payment-db", "label": "PostgreSQL Master DB", "category": "database", "type": "db.r6g.4xlarge"},
    {"id": "inventory-service", "label": "Flash-Sale Inventory API", "category": "service", "type": "Go Service"},
    {"id": "redis-cache", "label": "Inventory Redis Cache", "category": "cache", "type": "ElastiCache Cluster"},
    {"id": "order-queue", "label": "Order Ingestion Queue", "category": "queue", "type": "Apache Kafka"},
    {"id": "order-worker", "label": "Fulfillment Worker Fleet", "category": "worker", "type": "Kubernetes Pods"}
]

BASE_EDGES = [
    {"source": "frontend-checkout", "target": "api-gateway", "relation": "HTTPS / TLS 1.3"},
    {"source": "api-gateway", "target": "payment-service", "relation": "gRPC / Internal Mesh"},
    {"source": "api-gateway", "target": "inventory-service", "relation": "gRPC / Internal Mesh"},
    {"source": "payment-service", "target": "payment-db", "relation": "Connection Pool (1200 Max)"},
    {"source": "inventory-service", "target": "redis-cache", "relation": "TTL Sync (5s)"},
    {"source": "payment-service", "target": "order-queue", "relation": "Event Stream"},
    {"source": "order-queue", "target": "order-worker", "relation": "Consumer Group (150 Concurrency)"}
]


class DependencyService:
    @staticmethod
    def get_dependency_graph(db: Session, env_name: str) -> Dict[str, Any]:
        """
        Dynamically generates the Dependency Impact Graph and calculates the
        blast radius and component statuses based on active configuration drifts.
        """
        env = db.query(Environment).filter(Environment.name == env_name).first()
        if not env:
            raise ValueError(f"Environment '{env_name}' not found")

        drifts, _ = DriftDetectionEngine.detect_drifts_for_environment(db, env_name)

        drift_keys = [d["key"] for d in drifts]
        crit_keys = [d["key"] for d in drifts if d["severity"] == "CRITICAL"]

        impacted_nodes = set()

        # Check impacts
        if any(k in drift_keys for k in ["PAYMENT_MODE", "PAYMENT_GATEWAY_URL", "STRIPE_API_SECRET", "runtime.payment_mode"]):
            impacted_nodes.add("payment-service")
            impacted_nodes.add("frontend-checkout")

        if any(k in drift_keys for k in ["replicas", "cpu", "memory", "runtime.active_replicas"]):
            impacted_nodes.add("api-gateway")
            impacted_nodes.add("frontend-checkout")

        if any(k in drift_keys for k in ["max_connections", "read_replica_enabled", "DB_MASTER_CREDENTIALS"]):
            impacted_nodes.add("payment-db")
            impacted_nodes.add("payment-service")

        if any(k in drift_keys for k in ["INVENTORY_CACHE_TTL_SEC"]):
            impacted_nodes.add("redis-cache")
            impacted_nodes.add("inventory-service")

        if any(k in drift_keys for k in ["ORDER_QUEUE_CONCURRENCY"]):
            impacted_nodes.add("order-queue")
            impacted_nodes.add("order-worker")

        if any(k in drift_keys for k in ["FLASH_SALE_RATE_LIMITER_ENABLED"]):
            impacted_nodes.add("api-gateway")
            impacted_nodes.add("payment-service")

        nodes = []
        for n in BASE_NODES:
            nid = n["id"]
            if nid in impacted_nodes:
                has_crit = any(
                    (k in crit_keys and (
                        ("PAYMENT" in k and "payment" in nid) or
                        ("replicas" in k and "api-gateway" in nid) or
                        ("RATE_LIMITER" in k and "gateway" in nid)
                    )) for k in crit_keys
                )
                status = "CRITICAL_DRIFT" if has_crit else "DEGRADED"
            else:
                status = "HEALTHY"

            is_drifted = nid in impacted_nodes
            nodes.append({
                **n,
                "name": n["label"],
                "status": status,
                "is_drifted": is_drifted,
                "has_drift": is_drifted,
                "version": "v2.3.1-drifted" if is_drifted else "v2.4.0",
                "expected_version": "v2.4.0",
                "latency_ms": 14 if status == "HEALTHY" else (145 if status == "DEGRADED" else 850)
            })

        return {
            "environment": env_name,
            "nodes": nodes,
            "edges": BASE_EDGES,
            "links": [
                {
                    "source": e["source"],
                    "target": e["target"],
                    "protocol": e["relation"],
                    "critical_path": True,
                }
                for e in BASE_EDGES
            ],
            "blast_radius": list(impacted_nodes),
            "total_nodes": len(nodes),
            "healthy_nodes": sum(1 for n in nodes if n["status"] == "HEALTHY"),
            "impacted_nodes": len(impacted_nodes),
            "blast_radius_summary": {
                "total_services": len(nodes),
                "critical_dependencies": len(BASE_EDGES),
                "drifted_services": len(impacted_nodes),
                "impact_level": "CRITICAL" if len(impacted_nodes) > 0 else "LOW",
            },
        }
