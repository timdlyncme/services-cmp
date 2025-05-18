# Cloud Management Platform API

This is the backend API server for the Cloud Management Platform. It provides authentication, authorization, and data access for the frontend application.

## Setup

1. Install dependencies:
   ```
   npm install
   ```

2. Create a `.env` file with the following variables:
   ```
   DB_HOST=localhost
   DB_PORT=5432
   DB_USER=cmpuser
   DB_PASSWORD=cmppassword
   DB_NAME=cmpdb
   JWT_SECRET=your-secret-key
   PORT=8000
   ```

3. Start the development server:
   ```
   npm run dev
   ```

## API Endpoints

### Authentication

- `POST /api/auth/login` - Authenticate a user with email and password
- `GET /api/auth/verify` - Verify a JWT token
- `GET /api/auth/me` - Get the current user's data
- `GET /api/auth/permission/:name` - Check if the current user has a specific permission

### Data

- `GET /api/tenants` - Get tenants the current user has access to
- `GET /api/cloud-accounts` - Get cloud accounts for a tenant
- `GET /api/deployments` - Get deployments for a tenant
- `GET /api/deployments/:id` - Get a specific deployment
- `GET /api/templates` - Get templates for a tenant
- `GET /api/environments` - Get environments for a tenant
- `GET /api/users` - Get users for a tenant

## Database Schema

The application uses PostgreSQL with the following tables:

- `tenants` - Stores tenant information
- `roles` - Defines user roles (user, admin, msp)
- `permissions` - Stores available permissions
- `role_permissions` - Maps roles to permissions
- `users` - Stores user information with role and tenant associations
- `user_permissions` - Stores custom user permissions

## Authentication Flow

1. User submits login credentials
2. Backend verifies credentials against database
3. Backend retrieves user's role and permissions
4. JWT token is generated with user information
5. Frontend stores token and user data
6. Frontend loads appropriate navigation items based on permissions
7. Data requests include JWT token for authorization

