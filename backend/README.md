# Cloud Management Platform API

This is the FastAPI backend for the Cloud Management Platform.

## Features

- User authentication with JWT
- Role-based access control
- Multi-tenant support
- PostgreSQL database integration

## Getting Started

### Running with Docker

The easiest way to run the API is with Docker Compose:

```bash
docker-compose up -d
```

This will start both the PostgreSQL database and the FastAPI API server.

### Running Locally

1. Install dependencies:

```bash
cd backend
pip install -r requirements.txt
```

2. Run the API server:

```bash
cd backend
uvicorn app.main:app --reload
```

## API Documentation

Once the API is running, you can access the auto-generated documentation at:

- Swagger UI: http://localhost:8000/api/docs
- ReDoc: http://localhost:8000/api/redoc

## Authentication

The API uses OAuth2 with JWT tokens for authentication. To authenticate:

1. Send a POST request to `/api/auth/login` with form data:
   - `username`: User's email
   - `password`: User's password

2. Use the returned token in the `Authorization` header for subsequent requests:
   - `Authorization: Bearer {token}`

## Database Schema

The API uses the following database schema:

- `tenants`: Stores tenant information
- `roles`: Defines user roles (user, admin, msp)
- `permissions`: Lists all available permissions
- `role_permissions`: Maps roles to permissions
- `users`: Stores user information including role and tenant
- `user_permissions`: Maps custom permissions to users

