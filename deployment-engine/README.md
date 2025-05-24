# Deployment Engine

The Deployment Engine is a containerized service that handles cloud deployments for the Cloud Management Platform (CMP). It provides API endpoints for creating, managing, and monitoring deployments across multiple cloud providers (AWS, Azure, GCP).

## Features

- Support for multiple cloud providers (AWS, Azure, GCP)
- Support for multiple template types (Terraform, ARM, CloudFormation)
- Template deployment via URL, template ID, or raw template code
- Deployment status tracking and management
- Integration with the main CMP API for authentication and data persistence

## Architecture

The Deployment Engine is designed as a standalone container that communicates with the main CMP API. It uses the same authentication mechanism as the frontend, ensuring consistent security across the platform.

### Components

- **API Layer**: FastAPI-based REST API for deployment operations
- **Authentication**: JWT-based authentication integrated with the main CMP API
- **Deployment Services**: Provider-specific deployment services for AWS, Azure, and GCP
- **Template Processors**: Support for Terraform, ARM, and CloudFormation templates

## API Endpoints

The Deployment Engine exposes the following API endpoints:

- `POST /api/deployments`: Create a new deployment
- `GET /api/deployments/{deployment_id}`: Get deployment details
- `GET /api/deployments`: List deployments with optional filtering
- `PUT /api/deployments/{deployment_id}`: Update deployment status and details
- `DELETE /api/deployments/{deployment_id}`: Delete a deployment

## Deployment Flow

1. User initiates a deployment through the CMP frontend
2. Request is sent to the Deployment Engine API
3. Deployment Engine validates the request and creates a deployment record
4. Deployment process is started in the background
5. Deployment status is updated as the process progresses
6. Deployment details are sent back to the main CMP API for persistence
7. User can monitor deployment status through the CMP frontend

## Setup and Deployment

### Prerequisites

- Docker and Docker Compose
- Access to the main CMP API
- Cloud provider credentials

### Configuration

The Deployment Engine can be configured using environment variables:

- `MAIN_API_URL`: URL of the main CMP API
- `DATABASE_URL`: PostgreSQL connection string
- `JWT_SECRET_KEY`: Secret key for JWT authentication
- `TERRAFORM_BINARY_PATH`: Path to Terraform binary
- Cloud provider credentials (AWS, Azure, GCP)

### Running Locally

```bash
# Clone the repository
git clone <repository-url>
cd deployment-engine

# Build and start the container
docker-compose up -d

# Check logs
docker-compose logs -f
```

### Production Deployment

For production deployment, it's recommended to:

1. Use a container orchestration platform like Kubernetes
2. Set up proper secrets management for credentials
3. Configure health checks and monitoring
4. Set up proper logging and alerting

## Development

### Local Development Setup

```bash
# Create a virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run the application
uvicorn app.main:app --reload
```

### Testing

```bash
# Run tests
pytest
```

