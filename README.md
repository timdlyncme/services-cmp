# Services Cloud Management Platform (CMP)

A comprehensive, multi-tenant cloud management platform designed for Managed Service Providers (MSPs) to efficiently manage cloud resources, templates, deployments, and client environments with AI-powered assistance.

## 🚀 Features

### Core Platform Features
- **Multi-Tenant Architecture**: Complete tenant isolation with role-based access control
- **User Authentication & Authorization**: JWT-based authentication with granular permissions
- **Cloud Account Management**: Integrated Azure cloud account management with credential handling
- **Template Management**: Create, version, and deploy infrastructure templates
- **Deployment Engine**: Automated cloud resource deployment and management
- **Environment Management**: Organize and manage multiple deployment environments
- **Approval Workflows**: Built-in approval processes for deployment requests

### AI-Powered Features
- **AI Assistant**: Azure OpenAI-powered chat assistant for platform guidance
- **NexusAI**: Advanced AI features for intelligent cloud management recommendations
- **Template Foundry**: AI-assisted template creation and optimization

### Dashboard & Analytics
- **Enhanced Dashboard**: Customizable widgets and real-time metrics
- **Deployment Tracking**: Comprehensive deployment status and history
- **Resource Monitoring**: Cloud resource utilization and cost tracking
- **Audit Logging**: Complete audit trail for all platform activities

### MSP-Specific Features
- **Client Management**: Multi-tenant client organization management
- **Template Foundry**: MSP template creation and sharing capabilities
- **Approval Workflows**: Client approval processes for deployments
- **Integration Hub**: Third-party service integrations

## 🏗️ Architecture

The platform consists of three main components:

### 1. Frontend (React/TypeScript)
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite for fast development and optimized builds
- **UI Framework**: shadcn/ui components with Radix UI primitives
- **Styling**: Tailwind CSS with custom design system
- **State Management**: React Query for server state, React Context for app state
- **Routing**: React Router v6 with protected routes
- **Charts**: Recharts for data visualization
- **Forms**: React Hook Form with Zod validation

### 2. Backend API (FastAPI)
- **Framework**: FastAPI with async/await support
- **Database**: PostgreSQL with SQLAlchemy ORM
- **Authentication**: JWT tokens with role-based permissions
- **Validation**: Pydantic models for request/response validation
- **Documentation**: Auto-generated OpenAPI/Swagger documentation
- **Security**: CORS, input validation, SQL injection prevention

### 3. Deployment Engine (Python Service)
- **Framework**: FastAPI microservice
- **Cloud Providers**: Azure Resource Manager integration
- **Credential Management**: Secure cloud credential storage and rotation
- **Template Processing**: Infrastructure template parsing and deployment
- **Status Tracking**: Real-time deployment status monitoring

## 📊 Database Schema

### Core Tables
- **tenants**: Tenant organization information and settings
- **users**: User accounts with tenant association and role assignment
- **roles**: User roles (admin, user, msp) with permission mappings
- **permissions**: Granular permission definitions
- **role_permissions**: Many-to-many role-permission associations

### Cloud Management Tables
- **cloud_accounts**: Cloud provider account configurations
- **cloud_settings**: Cloud-specific settings and credentials
- **environments**: Deployment environment definitions
- **deployments**: Deployment records and status tracking
- **deployment_details**: Detailed deployment execution logs

### Template Management Tables
- **template_foundry**: Template definitions and metadata
- **template_foundry_versions**: Template version control
- **templates**: Deployed template instances

### AI & Integration Tables
- **ai_assistant_config**: AI assistant configuration per tenant
- **ai_assistant_log**: AI interaction audit logs
- **nexus_ai**: NexusAI configuration and usage tracking
- **integrations**: Third-party service integration settings
- **dashboards**: Custom dashboard configurations

## 🚀 Getting Started

### Prerequisites
- **Node.js**: Version 16 or higher
- **Docker**: Docker Engine and Docker Compose
- **Package Manager**: npm, yarn, or bun
- **Database**: PostgreSQL 15+ (provided via Docker)

### Environment Setup

1. **Clone the repository**:
```bash
git clone <repository-url>
cd services-cmp
```

2. **Configure environment variables**:
```bash
cp .env.example .env
# Edit .env with your configuration
```

3. **Install frontend dependencies**:
```bash
npm install
# or
yarn install
# or
bun install
```

4. **Start the development environment**:
```bash
# Start all services (database, backend, deployment engine)
npm run docker:up

# Start frontend development server
npm run dev
```

5. **Access the application**:
- Frontend: http://localhost:5173
- Backend API: http://localhost:8000
- API Documentation: http://localhost:8000/docs
- Deployment Engine: http://localhost:5000

### Default Users
The platform comes with pre-configured users for testing:

| Role | Email | Password | Permissions |
|------|-------|----------|-------------|
| Admin | admin@example.com | password | Full platform access |
| User | user@example.com | password | Standard user permissions |
| MSP | msp@example.com | password | MSP-specific features |

## 🔧 Configuration

### Environment Variables

#### Database Configuration
```bash
POSTGRES_SERVER=localhost
POSTGRES_PORT=5432
POSTGRES_USER=cmpuser
POSTGRES_PASSWORD=cmppassword
POSTGRES_DB=cmpdb
```

#### JWT Configuration
```bash
JWT_SECRET=your_jwt_secret_key_change_in_production
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=1440
```

#### Azure OpenAI Configuration
```bash
AZURE_OPENAI_API_KEY=your_azure_openai_key
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/
AZURE_OPENAI_DEPLOYMENT_NAME=your_deployment_name
AZURE_OPENAI_API_VERSION=2023-05-15
```

### Docker Services

The platform uses Docker Compose with the following services:

- **db**: PostgreSQL 15 database with health checks
- **api**: FastAPI backend service
- **deployment-engine**: Cloud deployment microservice

## 📡 API Reference

### Authentication Endpoints
- `POST /api/auth/login` - User authentication
- `GET /api/auth/me` - Get current user profile
- `GET /api/auth/verify` - Verify JWT token

### User Management
- `GET /api/users` - List users (admin only)
- `POST /api/users` - Create new user
- `PUT /api/users/{user_id}` - Update user
- `DELETE /api/users/{user_id}` - Delete user

### Tenant Management
- `GET /api/tenants` - List tenants
- `POST /api/tenants` - Create tenant
- `PUT /api/tenants/{tenant_id}` - Update tenant

### Cloud Accounts
- `GET /api/cloud-accounts` - List cloud accounts
- `POST /api/cloud-accounts` - Add cloud account
- `PUT /api/cloud-accounts/{account_id}` - Update account
- `DELETE /api/cloud-accounts/{account_id}` - Remove account

### Deployments
- `GET /api/deployments` - List deployments
- `POST /api/deployments` - Create deployment
- `GET /api/deployments/{deployment_id}` - Get deployment details
- `PUT /api/deployments/{deployment_id}` - Update deployment

### Templates
- `GET /api/templates` - List templates
- `POST /api/templates` - Create template
- `GET /api/templates/{template_id}` - Get template details

### AI Features
- `POST /api/ai-assistant/chat` - Chat with AI assistant
- `POST /api/ai-assistant/chat/stream` - Streaming chat
- `GET /api/ai-assistant/config` - Get AI configuration
- `POST /api/ai-assistant/config` - Update AI configuration

### NexusAI
- `POST /api/nexus-ai/chat` - Advanced AI chat
- `GET /api/nexus-ai/status` - AI service status
- `GET /api/nexus-ai/logs` - AI interaction logs

## 🛠️ Development

### Project Structure
```
services-cmp/
├── src/                    # Frontend React application
│   ├── components/         # Reusable UI components
│   ├── pages/             # Page components
│   ├── hooks/             # Custom React hooks
│   ├── contexts/          # React contexts
│   ├── types/             # TypeScript type definitions
│   └── utils/             # Utility functions
├── backend/               # FastAPI backend
│   ├── app/
│   │   ├── api/           # API routes and endpoints
│   │   ├── core/          # Core functionality (auth, config)
│   │   ├── db/            # Database models and migrations
│   │   ├── models/        # SQLAlchemy models
│   │   ├── schemas/       # Pydantic schemas
│   │   └── services/      # Business logic services
│   └── requirements.txt   # Python dependencies
├── deployment_engine/     # Deployment microservice
│   ├── app.py            # Main application
│   ├── credential_manager.py # Cloud credential management
│   └── deploy/           # Cloud provider implementations
└── docker-compose.yml    # Container orchestration
```

### Adding New Features

#### 1. Adding New Permissions
```sql
-- Add to permissions table
INSERT INTO permissions (name, description) VALUES 
('new_feature_access', 'Access to new feature');

-- Assign to roles
INSERT INTO role_permissions (role_id, permission_id) VALUES 
(1, (SELECT id FROM permissions WHERE name = 'new_feature_access'));
```

#### 2. Creating New API Endpoints
```python
# backend/app/api/endpoints/new_feature.py
from fastapi import APIRouter, Depends
from app.api.deps import get_current_user

router = APIRouter()

@router.get("/")
async def get_feature_data(current_user = Depends(get_current_user)):
    # Implementation
    pass
```

#### 3. Adding Frontend Pages
```typescript
// src/pages/NewFeature.tsx
import { useAuth } from '@/hooks/useAuth';

export default function NewFeature() {
  const { hasPermission } = useAuth();
  
  if (!hasPermission('new_feature_access')) {
    return <div>Access Denied</div>;
  }
  
  return <div>New Feature Content</div>;
}
```

### Code Quality Standards

#### Backend (Python)
- Follow PEP 8 style guidelines
- Use type hints for all function parameters and return values
- Implement proper error handling with custom exceptions
- Write comprehensive docstrings for all public functions
- Use async/await for all database operations

#### Frontend (TypeScript)
- Use strict TypeScript configuration
- Implement proper error boundaries
- Follow React best practices (hooks, functional components)
- Use proper prop types and interfaces
- Implement loading and error states for all async operations

### Testing Guidelines

#### Backend Testing
```bash
# Run backend tests
cd backend
pytest tests/

# Run with coverage
pytest --cov=app tests/
```

#### Frontend Testing
```bash
# Run frontend tests
npm run test

# Run with coverage
npm run test:coverage
```

## 🔒 Security Considerations

### Authentication & Authorization
- JWT tokens with configurable expiration
- Role-based access control (RBAC) with granular permissions
- Secure password hashing using bcrypt
- Session management with token refresh capabilities

### Data Protection
- SQL injection prevention through parameterized queries
- Input validation using Pydantic models
- CORS configuration for cross-origin requests
- Sensitive data encryption at rest

### Cloud Security
- Secure credential storage for cloud providers
- Credential rotation capabilities
- Network isolation between services
- Audit logging for all administrative actions

### Recommended Security Practices
1. **Change default JWT secret** in production environments
2. **Use HTTPS** for all production deployments
3. **Implement rate limiting** for API endpoints
4. **Regular security audits** of dependencies
5. **Monitor and log** all authentication attempts
6. **Backup encryption keys** securely

## 🚀 Deployment

### Production Deployment

#### 1. Environment Preparation
```bash
# Create production environment file
cp .env .env.production

# Update production values
JWT_SECRET=<strong-random-secret>
POSTGRES_PASSWORD=<secure-password>
AZURE_OPENAI_API_KEY=<your-production-key>
```

#### 2. Database Setup
```bash
# Initialize production database
docker-compose -f docker-compose.prod.yml up -d db
docker-compose exec api python -m app.db.init_db
```

#### 3. Application Deployment
```bash
# Build and deploy all services
docker-compose -f docker-compose.prod.yml up -d

# Verify deployment
docker-compose ps
```

### Scaling Considerations
- **Database**: Consider PostgreSQL clustering for high availability
- **API**: Horizontal scaling with load balancer
- **Frontend**: CDN deployment for static assets
- **Deployment Engine**: Queue-based processing for concurrent deployments

## 🔧 Troubleshooting

### Common Issues

#### Database Connection Issues
```bash
# Check database status
docker-compose logs db

# Reset database
docker-compose down -v
docker-compose up -d db
```

#### API Authentication Problems
```bash
# Verify JWT configuration
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin@example.com","password":"password"}'
```

#### Frontend Build Issues
```bash
# Clear node modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Clear Vite cache
rm -rf node_modules/.vite
npm run dev
```

#### Deployment Engine Issues
```bash
# Check deployment engine logs
docker-compose logs deployment-engine

# Verify Azure credentials
curl http://localhost:5000/health
```

### Performance Optimization

#### Database Optimization
- Add indexes for frequently queried columns
- Implement connection pooling
- Use database query optimization
- Regular VACUUM and ANALYZE operations

#### API Performance
- Implement response caching
- Use database query optimization
- Add request rate limiting
- Monitor API response times

#### Frontend Performance
- Implement code splitting
- Use React.memo for expensive components
- Optimize bundle size with tree shaking
- Implement virtual scrolling for large lists

## 🔮 Implementation Suggestions

### Short-term Improvements (1-3 months)

#### 1. Enhanced Monitoring & Observability
- **Implement structured logging** with correlation IDs
- **Add application metrics** using Prometheus/Grafana
- **Health check endpoints** for all services
- **Error tracking** with Sentry or similar service

#### 2. API Improvements
- **Rate limiting** implementation for API endpoints
- **API versioning** strategy for backward compatibility
- **Request/response caching** for frequently accessed data
- **Pagination optimization** for large datasets

#### 3. Security Enhancements
- **Multi-factor authentication (MFA)** for admin users
- **API key management** for service-to-service communication
- **Audit logging** for all administrative actions
- **Vulnerability scanning** in CI/CD pipeline

#### 4. User Experience Improvements
- **Real-time notifications** using WebSockets
- **Bulk operations** for managing multiple resources
- **Advanced search and filtering** capabilities
- **Export functionality** for reports and data

### Medium-term Enhancements (3-6 months)

#### 1. Multi-Cloud Support
- **AWS integration** alongside Azure
- **Google Cloud Platform** support
- **Hybrid cloud** deployment strategies
- **Cloud cost optimization** recommendations

#### 2. Advanced AI Features
- **Predictive analytics** for resource usage
- **Automated cost optimization** suggestions
- **Intelligent template recommendations**
- **Natural language query** interface

#### 3. Integration Ecosystem
- **Webhook system** for external integrations
- **REST API client libraries** for popular languages
- **Terraform provider** for infrastructure as code
- **CI/CD pipeline integrations** (GitHub Actions, GitLab CI)

#### 4. Enterprise Features
- **Single Sign-On (SSO)** integration
- **Advanced RBAC** with custom roles
- **Compliance reporting** (SOC2, ISO27001)
- **Data retention policies** and archiving

### Long-term Vision (6+ months)

#### 1. Platform Evolution
- **Microservices architecture** migration
- **Event-driven architecture** with message queues
- **GraphQL API** alongside REST
- **Mobile application** development

#### 2. AI-Driven Automation
- **Autonomous deployment** recommendations
- **Predictive maintenance** for cloud resources
- **Intelligent resource scaling**
- **Automated security compliance** checking

#### 3. Marketplace & Ecosystem
- **Template marketplace** for community sharing
- **Plugin architecture** for third-party extensions
- **Partner integrations** with cloud providers
- **White-label solutions** for resellers

## ⚠️ Known Issues & Limitations

### Current Limitations

#### 1. Scalability Constraints
- **Single database instance** - no clustering support
- **Synchronous deployment processing** - no queue system
- **Limited concurrent users** - no horizontal scaling
- **Memory usage** - large template processing can be resource-intensive

#### 2. Feature Gaps
- **Limited cloud provider support** - Azure only
- **No backup/restore functionality** for configurations
- **Basic audit logging** - limited detail and retention
- **No API rate limiting** - potential for abuse

#### 3. Security Considerations
- **JWT tokens stored in localStorage** - XSS vulnerability
- **No session management** - tokens valid until expiration
- **Limited input sanitization** - potential for injection attacks
- **Credential storage** - needs encryption at rest

#### 4. User Experience Issues
- **No real-time updates** - manual refresh required
- **Limited error messaging** - generic error responses
- **No bulk operations** - individual resource management only
- **Basic search functionality** - no advanced filtering

### Bug Reports & Fixes Needed

#### High Priority
1. **Memory leak in deployment engine** - long-running deployments cause memory growth
2. **Race condition in template versioning** - concurrent updates can corrupt data
3. **Authentication token refresh** - users logged out unexpectedly
4. **Database connection pooling** - connections not properly released

#### Medium Priority
1. **UI responsiveness on mobile** - layout issues on small screens
2. **Error handling in AI assistant** - crashes on malformed responses
3. **Template validation** - insufficient validation of template syntax
4. **Deployment status updates** - delayed or missing status changes

#### Low Priority
1. **Console warnings** - React development warnings in production
2. **CSS specificity issues** - styling conflicts in some components
3. **Accessibility compliance** - missing ARIA labels and keyboard navigation
4. **Performance optimization** - unnecessary re-renders in dashboard

### Code Optimization Opportunities

#### Backend Optimizations
```python
# Example: Optimize database queries with eager loading
def get_user_with_permissions(user_id: int):
    return db.query(User).options(
        joinedload(User.role).joinedload(Role.permissions)
    ).filter(User.id == user_id).first()

# Example: Implement caching for frequently accessed data
from functools import lru_cache

@lru_cache(maxsize=100)
def get_tenant_settings(tenant_id: str):
    return db.query(TenantSettings).filter_by(tenant_id=tenant_id).first()
```

#### Frontend Optimizations
```typescript
// Example: Implement React.memo for expensive components
const DeploymentList = React.memo(({ deployments }) => {
  return (
    <div>
      {deployments.map(deployment => (
        <DeploymentCard key={deployment.id} deployment={deployment} />
      ))}
    </div>
  );
});

// Example: Use React Query for better caching
const useDeployments = () => {
  return useQuery({
    queryKey: ['deployments'],
    queryFn: fetchDeployments,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};
```

#### Database Optimizations
```sql
-- Add missing indexes for better query performance
CREATE INDEX idx_deployments_tenant_status ON deployments(tenant_id, status);
CREATE INDEX idx_users_email_active ON users(email) WHERE is_active = true;
CREATE INDEX idx_templates_created_at ON templates(created_at DESC);

-- Optimize frequently used queries
EXPLAIN ANALYZE SELECT * FROM deployments 
WHERE tenant_id = $1 AND status = 'running'
ORDER BY created_at DESC LIMIT 10;
```

## 📚 Additional Resources

### Documentation Links
- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [React Documentation](https://react.dev/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Azure Resource Manager](https://docs.microsoft.com/en-us/azure/azure-resource-manager/)

### Development Tools
- [Postman Collection](./docs/postman-collection.json) - API testing
- [Database Schema](./docs/database-schema.sql) - Complete schema
- [Environment Setup Guide](./docs/development-setup.md) - Detailed setup
- [Deployment Guide](./docs/deployment-guide.md) - Production deployment

### Community & Support
- [GitHub Issues](https://github.com/timdlyncme/services-cmp/issues) - Bug reports and feature requests
- [Discussions](https://github.com/timdlyncme/services-cmp/discussions) - Community discussions
- [Wiki](https://github.com/timdlyncme/services-cmp/wiki) - Additional documentation

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

---

**Built with ❤️ for the cloud management community**

