# Cloud Management Platform

A modern web application for managing cloud resources across multiple providers.

## Features

- User authentication and role-based access control
- Multi-tenant support
- Dashboard with deployment statistics
- Cloud resource management
- Template catalog
- Environment management
- User and group management

## Tech Stack

- Frontend: React, TypeScript, Tailwind CSS, Shadcn UI
- Backend: Node.js, Express
- Database: PostgreSQL
- Authentication: JWT

## Prerequisites

- Node.js (v16+)
- PostgreSQL (v14+)
- npm or yarn

## Setup

### 1. Clone the repository

```bash
git clone https://github.com/yourusername/services-cmp.git
cd services-cmp
```

### 2. Install dependencies

```bash
npm install
# or
yarn install
```

### 3. Set up the database

Create a PostgreSQL database and user:

```sql
CREATE DATABASE cmpdb;
CREATE USER cmpuser WITH ENCRYPTED PASSWORD 'cmppassword';
GRANT ALL PRIVILEGES ON DATABASE cmpdb TO cmpuser;
```

### 4. Configure environment variables

Create a `.env` file in the root directory:

```
# API Server
API_PORT=8000
JWT_SECRET=your_jwt_secret_key_change_in_production

# Database
DB_HOST=localhost
DB_PORT=5432
DB_USER=cmpuser
DB_PASSWORD=cmppassword
DB_NAME=cmpdb
```

### 5. Initialize the database

Run the database initialization script:

```bash
node src/server/init-db.js
```

This will create the necessary tables and insert sample data.

### 6. Start the development server

```bash
# Start the API server
npm run server
# or
yarn server

# In a separate terminal, start the frontend
npm run dev
# or
yarn dev
```

## Usage

### Default Users

The initialization script creates the following users:

1. **Admin User**
   - Email: admin@example.com
   - Password: password
   - Role: admin
   - Tenant: Acme Corp

2. **Regular User**
   - Email: user@example.com
   - Password: password
   - Role: user
   - Tenant: Acme Corp

3. **MSP User**
   - Email: msp@example.com
   - Password: password
   - Role: msp
   - Tenant: Dev Team

### Permissions

The application uses role-based access control with the following permissions:

- **Core Permissions** (available to all users)
  - view:dashboard
  - view:deployments
  - view:catalog

- **Admin Permissions** (available to admin and msp roles)
  - view:cloud-accounts
  - view:environments
  - view:templates
  - view:users
  - view:settings

- **MSP Permissions** (available only to msp role)
  - view:tenants
  - manage:templates
  - use:nexus-ai

## Development

### Project Structure

```
services-cmp/
├── public/              # Static assets
├── src/
│   ├── components/      # React components
│   ├── context/         # React context providers
│   ├── data/            # Mock data for development
│   ├── hooks/           # Custom React hooks
│   ├── lib/             # Utility functions
│   ├── pages/           # Page components
│   ├── server/          # API server
│   ├── services/        # API services
│   ├── styles/          # CSS styles
│   ├── types/           # TypeScript type definitions
│   ├── App.tsx          # Main application component
│   └── main.tsx         # Application entry point
├── .env                 # Environment variables
├── package.json         # Project dependencies
└── README.md            # Project documentation
```

### API Documentation

The API documentation is available at http://localhost:8000/api/docs when the server is running.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

