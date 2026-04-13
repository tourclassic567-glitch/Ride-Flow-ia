"""Agent management endpoints."""
from fastapi import APIRouter, Depends, HTTPException, Header
from app.api.schemas import AgentsStatusResponse
from app.agents.orchestrator import orchestrator
from app.config import get_settings

router = APIRouter(prefix="/agents", tags=["Agents"])


def _require_admin(x_admin_key: str = Header(...)):
    if x_admin_key != get_settings().admin_api_key:
        raise HTTPException(status_code=401, detail="Invalid admin API key")


@router.get(
    "/status",
    response_model=AgentsStatusResponse,
    summary="Get all agents status",
)
async def get_agents_status():
    """Returns live status and metrics for all autonomous agents."""
    return orchestrator.status()


@router.post(
    "/start",
    summary="Start all agents",
    dependencies=[Depends(_require_admin)],
)
async def start_agents():
    """Start the agent fleet (admin only)."""
    await orchestrator.start()
    return {"message": "Agents started", "agent_count": len(orchestrator._agents)}


@router.post(
    "/stop",
    summary="Stop all agents",
    dependencies=[Depends(_require_admin)],
)
async def stop_agents():
    """Stop the agent fleet gracefully (admin only)."""
    await orchestrator.stop()
    return {"message": "Agents stopped"}
