# Cloud Management Platform

A modern cloud management platform for managing cloud resources, templates, and deployments.

## Features

- User authentication with PostgreSQL database
- Role-based access control with permissions
- Template management
- Deployment tracking
- Multi-tenant support
- NexusAI integration

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

3. Start the PostgreSQL database:

```bash
docker-compose up -d
```

4. Create a `.env` file in the root directory with the following content:

```
DB_HOST=localhost
DB_PORT=5432
DB_USER=cmpuser
DB_PASSWORD=cmppassword
DB_NAME=cmpdb
JWT_SECRET=your_jwt_secret_key_change_in_production
```

5. Start the development server:

```bash
npm run dev
```

6. Open your browser and navigate to `http://localhost:5173`

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

