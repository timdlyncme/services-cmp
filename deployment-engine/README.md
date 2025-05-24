# Deployment Engine

This folder contains the implementation of the deployment container, which is responsible for interacting with cloud providers (Azure, AWS, GCP) and managing deployments.

## Overview

The deployment engine is a separate service that provides API endpoints for:

1. Managing cloud credentials
2. Fetching cloud resources
3. Creating and managing deployments
4. Monitoring deployment status

## API Endpoints

### Credentials Management

- `POST /credentials`: Set cloud provider credentials
- `GET /credentials/subscriptions`: Get available subscriptions for the current credentials
- `GET /credentials/resources`: Get available resources for the current credentials and specified subscriptions

### Deployments Management

- `POST /deployments`: Create a new deployment
- `GET /deployments`: List all deployments
- `GET /deployments/{deployment_id}`: Get deployment details
- `PUT /deployments/{deployment_id}`: Update a deployment
- `DELETE /deployments/{deployment_id}`: Delete a deployment

## Implementation Details

The deployment engine uses the cloud provider SDKs to interact with the cloud providers:

- Azure: Azure SDK for Python
- AWS: Boto3
- GCP: Google Cloud SDK

## Authentication

The deployment engine uses JWT tokens for authentication, which are passed from the backend API.

## Deployment

The deployment engine is containerized using Docker and can be deployed alongside the main application.

