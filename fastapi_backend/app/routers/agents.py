from fastapi import APIRouter
from app.agents.orchestrator import orchestrator

router = APIRouter()


@router.get("/")
async def get_agents():
    return orchestrator.status()


@router.get("/metrics")
async def get_metrics():
    return orchestrator.status().get("metrics", {})


@router.post("/start")
async def start_agents():
    orchestrator.start()
    return {"message": "Agent fleet started", "status": orchestrator.status()}


@router.post("/stop")
async def stop_agents():
    orchestrator.stop()
    return {"message": "Agent fleet stopped"}
