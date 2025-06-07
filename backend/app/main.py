from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

from app.api.api import api_router
from app.core.config import settings
from app.core.middleware import APIAccessControlMiddleware


app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json"
)

# Add CORS middleware first - this is the main CORS handler
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8080", "http://localhost:3000", "*"],  # Allow frontend origins
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# Add API access control middleware after CORS
app.add_middleware(APIAccessControlMiddleware)

# Include API router
app.include_router(api_router, prefix=settings.API_V1_STR)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """
    Custom handler for Pydantic validation errors to simplify error messages
    """
    error_messages = []
    for error in exc.errors():
        error_messages.append(error.get('msg', 'Validation error'))
    
    # Join multiple error messages with semicolons for clarity
    simplified_error = "; ".join(error_messages)
    
    return JSONResponse(
        status_code=422,
        content={"detail": simplified_error}
    )

@app.get("/")
def root():
    return {"message": "Welcome to CMP API"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
