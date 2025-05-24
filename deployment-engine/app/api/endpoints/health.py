from fastapi import APIRouter, Depends, HTTPException, status
from typing import Dict, Any

router = APIRouter()

@router.get("/")
def health_check() -> Dict[str, Any]:
    """
    Health check endpoint
    """
    return {
        "status": "healthy",
        "version": "0.1.0",
        "service": "deployment-engine"
    }

