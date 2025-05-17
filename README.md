# Cloud Management Platform

A modern cloud management platform for managing cloud resources, templates, and deployments.

## Features

- User authentication with PostgreSQL database
- Role-based access control with permissions
- Template management
- Deployment tracking
- Multi-tenant support
- NexusAI integration with Azure OpenAI

## Architecture

The application consists of two main components:

1. **Frontend**: React/TypeScript application with Vite
2. **Backend**: FastAPI application with PostgreSQL database

### Frontend

- React with TypeScript
- Vite for build and development
- shadcn/ui for UI components
- Tailwind CSS for styling
- React Router for routing
- React Query for data fetching

### Backend

- FastAPI for API endpoints
- SQLAlchemy for database ORM
- PostgreSQL for data storage
- JWT for authentication
- Pydantic for data validation

## Getting Started

### Prerequisites

- Node.js 16+
- Docker and Docker Compose
- npm or yarn

### Setup

1. Clone the repository:

```bash
git clone <repository-url>
cd services-cmp
```

2. Install dependencies:

```bash
npm install
```

3. Start the services with Docker Compose:

```bash
npm run docker:up
```

This will start:
- PostgreSQL database
- FastAPI backend

4. Start the frontend development server:

```bash
npm run dev
```

5. Open your browser and navigate to `http://localhost:5173`

### Default Users

The application comes with three default users:

- **Admin User**: admin@example.com / password
- **Regular User**: user@example.com / password
- **MSP User**: msp@example.com / password

## Database Schema

The application uses PostgreSQL with the following schema:

- **tenants**: Stores tenant information
- **roles**: Defines user roles (user, admin, msp)
- **permissions**: Lists all available permissions
- **role_permissions**: Maps roles to permissions
- **users**: Stores user information including role and tenant
- **user_permissions**: Maps custom permissions to users

## Authentication Flow

1. User enters email and password
2. The system verifies credentials against the database
3. If valid, a JWT token is generated and stored in localStorage
4. The token is used for subsequent API requests
5. Permissions are checked for each protected route and UI element

## Development

### Adding New Permissions

1. Add the permission to the `permissions` table
2. Assign the permission to roles in the `role_permissions` table
3. Use the `hasPermission` function to check permissions in components
4. Add the permission check to protected routes

### Adding New Roles

1. Add the role to the `roles` table
2. Assign permissions to the role in the `role_permissions` table
3. Update the `UserRole` type in `src/types/auth.ts`

## NexusAI Integration

The NexusAI feature integrates with Azure OpenAI to provide AI-powered assistance. Configuration options include:

- API Key
- Endpoint URL
- Deployment Name
- Model Version
