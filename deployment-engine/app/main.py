from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
import os
from typing import Dict, Any, List, Optional

from app.api.api import api_router
from app.core.config import settings

app = FastAPI(
    title="Deployment Engine API",
    description="API for deploying cloud resources",
    version="0.1.0",
)

# Set up CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)

# Include API router
app.include_router(api_router, prefix="/api")

@app.get("/health")
def health_check():
    """
    Health check endpoint
    """
    return {"status": "healthy"}

@app.get("/")
def root():
    """
    Root endpoint
    """
    return {
        "message": "Welcome to the Deployment Engine API",
        "docs_url": "/docs",
        "redoc_url": "/redoc",
    }

