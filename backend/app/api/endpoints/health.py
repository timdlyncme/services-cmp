from typing import Any

from fastapi import APIRouter

router = APIRouter()


@router.get("/")
def health_check() -> Any:
    """
    Health check endpoint
    """
    return {
        "status": "ok",
        "message": "API is running"
    }

