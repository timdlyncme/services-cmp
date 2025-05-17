from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from app.api.api import api_router
from app.core.config import settings
from app.db.init_db import init_db
from app.db.session import get_db

# Create FastAPI app
app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url=f"{settings.API_V1_STR}/docs",
    redoc_url=f"{settings.API_V1_STR}/redoc",
)

# Set up CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API router
app.include_router(api_router, prefix=settings.API_V1_STR)


# Health check endpoint
@app.get("/health")
def health_check():
    return {"status": "ok"}


# Initialize database on startup
@app.on_event("startup")
async def startup_event():
    db = next(get_db())
    init_db(db)


# Root endpoint
@app.get("/")
def root():
    return {
        "message": "Welcome to the Cloud Management Platform API",
        "docs": f"{settings.API_V1_STR}/docs",
    }

