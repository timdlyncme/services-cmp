
import { 
  CloudAccount, 
  CloudTemplate, 
  CloudDeployment, 
  IntegrationConfig 
} from "@/types/cloud";

export const mockCloudAccounts: CloudAccount[] = [
  {
    id: "account-1",
    name: "Production Azure",
    provider: "azure",
    status: "connected",
    tenantId: "tenant-1",
  },
  {
    id: "account-2",
    name: "Development AWS",
    provider: "aws",
    status: "connected",
    tenantId: "tenant-1",
  },
  {
    id: "account-3",
    name: "GCP Research",
    provider: "gcp",
    status: "warning",
    tenantId: "tenant-1",
  },
  {
    id: "account-4",
    name: "Dev Team Azure",
    provider: "azure",
    status: "connected",
    tenantId: "tenant-2",
  },
];

export const mockTemplates: CloudTemplate[] = [
  {
    id: "template-1",
    name: "Basic Web Application",
    description: "Deploys a simple web application with supporting infrastructure",
    type: "terraform",
    provider: "azure",
    code: `provider "azurerm" {
  features {}
}

resource "azurerm_resource_group" "main" {
  name     = "web-app-resources"
  location = "East US"
}

resource "azurerm_app_service_plan" "main" {
  name                = "webapp-asp"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  kind                = "Linux"
  reserved            = true

  sku {
    tier = "Basic"
    size = "B1"
  }
}

resource "azurerm_app_service" "main" {
  name                = "webapp-basic-service"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  app_service_plan_id = azurerm_app_service_plan.main.id

  site_config {
    linux_fx_version = "DOCKER|nginx:latest"
  }
}`,
    deploymentCount: 5,
    uploadedAt: "2023-03-15T09:12:00Z",
    updatedAt: "2023-05-22T13:45:00Z",
    categories: ["web", "basic"],
    tenantId: "tenant-1",
  },
  {
    id: "template-2",
    name: "Containerized Microservices",
    description: "Kubernetes cluster for microservices deployment",
    type: "terraform",
    provider: "aws",
    code: `provider "aws" {
  region = "us-west-2"
}

resource "aws_eks_cluster" "main" {
  name     = "microservices-cluster"
  role_arn = aws_iam_role.eks_cluster.arn

  vpc_config {
    subnet_ids = ["subnet-12345", "subnet-67890"]
  }
}

resource "aws_iam_role" "eks_cluster" {
  name = "eks-cluster-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "eks.amazonaws.com"
        }
      },
    ]
  })
}

resource "aws_iam_role_policy_attachment" "eks_cluster_policy" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSClusterPolicy"
  role       = aws_iam_role.eks_cluster.name
}`,
    deploymentCount: 3,
    uploadedAt: "2023-04-02T11:30:00Z",
    updatedAt: "2023-06-10T09:15:00Z",
    categories: ["kubernetes", "microservices", "containers"],
    tenantId: "tenant-1",
  },
  {
    id: "template-3",
    name: "Google Cloud Storage with CDN",
    description: "Static website hosting with CDN",
    type: "terraform",
    provider: "gcp",
    code: `provider "google" {
  project = "my-project-id"
  region  = "us-central1"
}

resource "google_storage_bucket" "static_site" {
  name          = "static-website-bucket"
  location      = "US"
  storage_class = "STANDARD"

  website {
    main_page_suffix = "index.html"
    not_found_page   = "404.html"
  }
}

resource "google_storage_bucket_iam_member" "public_read" {
  bucket = google_storage_bucket.static_site.name
  role   = "roles/storage.objectViewer"
  member = "allUsers"
}

resource "google_compute_backend_bucket" "cdn_backend" {
  name        = "cdn-backend-bucket"
  description = "Backend bucket for CDN"
  bucket_name = google_storage_bucket.static_site.name
  enable_cdn  = true
}`,
    deploymentCount: 2,
    uploadedAt: "2023-05-05T14:20:00Z",
    updatedAt: "2023-06-18T16:40:00Z",
    categories: ["storage", "cdn", "static-site"],
    tenantId: "tenant-1",
  },
  {
    id: "template-4",
    name: "Virtual Machine Scale Set",
    description: "Autoscaling VMs for high availability",
    type: "arm",
    provider: "azure",
    code: `{
  "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
  "contentVersion": "1.0.0.0",
  "parameters": {
    "vmSku": {
      "type": "string",
      "defaultValue": "Standard_DS2_v2",
      "metadata": {
        "description": "Size of VMs in the VM Scale Set."
      }
    },
    "vmssName": {
      "type": "string",
      "metadata": {
        "description": "Name of the VM Scale Set."
      }
    }
  },
  "resources": [
    {
      "type": "Microsoft.Compute/virtualMachineScaleSets",
      "name": "[parameters('vmssName')]",
      "location": "[resourceGroup().location]",
      "apiVersion": "2021-03-01",
      "sku": {
        "name": "[parameters('vmSku')]",
        "tier": "Standard",
        "capacity": 2
      },
      "properties": {
        "overprovision": true,
        "upgradePolicy": {
          "mode": "Automatic"
        },
        "virtualMachineProfile": {
          "storageProfile": {
            "osDisk": {
              "createOption": "FromImage",
              "caching": "ReadWrite"
            },
            "imageReference": {
              "publisher": "Canonical",
              "offer": "UbuntuServer",
              "sku": "18.04-LTS",
              "version": "latest"
            }
          },
          "osProfile": {
            "computerNamePrefix": "vmss",
            "adminUsername": "azureuser",
            "adminPassword": "P@ssword1234!"
          }
        }
      }
    }
  ]
}`,
    deploymentCount: 1,
    uploadedAt: "2023-02-20T10:05:00Z",
    updatedAt: "2023-05-30T11:22:00Z",
    categories: ["virtual-machines", "autoscaling", "high-availability"],
    tenantId: "tenant-1",
  },
  {
    id: "template-5",
    name: "S3 Static Website",
    description: "Simple S3 bucket configured for website hosting",
    type: "cloudformation",
    provider: "aws",
    code: `{
  "AWSTemplateFormatVersion": "2010-09-09",
  "Description": "CloudFormation template for S3 static website",
  "Resources": {
    "S3Bucket": {
      "Type": "AWS::S3::Bucket",
      "Properties": {
        "AccessControl": "PublicRead",
        "WebsiteConfiguration": {
          "IndexDocument": "index.html",
          "ErrorDocument": "error.html"
        }
      }
    },
    "BucketPolicy": {
      "Type": "AWS::S3::BucketPolicy",
      "Properties": {
        "Bucket": { "Ref": "S3Bucket" },
        "PolicyDocument": {
          "Statement": [
            {
              "Action": ["s3:GetObject"],
              "Effect": "Allow",
              "Resource": { "Fn::Join": ["", ["arn:aws:s3:::", { "Ref": "S3Bucket" }, "/*"]] },
              "Principal": "*"
            }
          ]
        }
      }
    }
  },
  "Outputs": {
    "WebsiteURL": {
      "Description": "URL for the website",
      "Value": { "Fn::GetAtt": ["S3Bucket", "WebsiteURL"] }
    }
  }
}`,
    deploymentCount: 8,
    uploadedAt: "2023-01-10T08:45:00Z",
    updatedAt: "2023-05-15T15:30:00Z",
    categories: ["storage", "static-site", "web"],
    tenantId: "tenant-1",
  },
  {
    id: "template-6",
    name: "Cloud SQL Database",
    description: "Managed PostgreSQL database on GCP",
    type: "terraform",
    provider: "gcp",
    code: `provider "google" {
  project = "my-project-id"
  region  = "us-central1"
}

resource "google_sql_database_instance" "main" {
  name             = "postgres-instance"
  database_version = "POSTGRES_13"
  region           = "us-central1"

  settings {
    tier = "db-f1-micro"
    
    backup_configuration {
      enabled = true
      start_time = "02:00"
    }
    
    ip_configuration {
      ipv4_enabled = true
      authorized_networks {
        name = "all"
        value = "0.0.0.0/0"
      }
    }
  }
}

resource "google_sql_database" "database" {
  name     = "my-database"
  instance = google_sql_database_instance.main.name
}

resource "google_sql_user" "users" {
  name     = "my-user"
  instance = google_sql_database_instance.main.name
  password = "changeme"
}`,
    deploymentCount: 3,
    uploadedAt: "2023-03-25T13:10:00Z",
    updatedAt: "2023-06-05T10:35:00Z",
    categories: ["database", "postgresql"],
    tenantId: "tenant-2",
  }
];

export const mockDeployments: CloudDeployment[] = [
  {
    id: "deployment-1",
    name: "Production Web App",
    templateId: "template-1",
    templateName: "Basic Web Application",
    provider: "azure",
    status: "running",
    environment: "production",
    createdAt: "2023-05-10T08:30:00Z",
    updatedAt: "2023-05-10T09:15:00Z",
    parameters: {
      location: "eastus",
      appServicePlanTier: "Basic",
      appServicePlanSize: "B1"
    },
    resources: [
      "Resource Group: web-app-resources",
      "App Service Plan: webapp-asp",
      "App Service: webapp-basic-service"
    ],
    tenantId: "tenant-1"
  },
  {
    id: "deployment-2",
    name: "Dev Microservices",
    templateId: "template-2",
    templateName: "Containerized Microservices",
    provider: "aws",
    status: "running",
    environment: "development",
    createdAt: "2023-05-15T11:20:00Z",
    updatedAt: "2023-05-15T12:45:00Z",
    parameters: {
      region: "us-west-2",
      clusterName: "microservices-dev"
    },
    resources: [
      "EKS Cluster: microservices-dev",
      "IAM Role: eks-cluster-role",
      "VPC: vpc-12345"
    ],
    tenantId: "tenant-1"
  },
  {
    id: "deployment-3",
    name: "Marketing Website",
    templateId: "template-3",
    templateName: "Google Cloud Storage with CDN",
    provider: "gcp",
    status: "running",
    environment: "production",
    createdAt: "2023-06-01T09:00:00Z",
    updatedAt: "2023-06-01T09:45:00Z",
    parameters: {
      bucketName: "marketing-website",
      region: "us-central1"
    },
    resources: [
      "Storage Bucket: marketing-website",
      "Backend Bucket: cdn-backend-bucket",
      "IAM Binding: allUsers:objectViewer"
    ],
    tenantId: "tenant-1"
  },
  {
    id: "deployment-4",
    name: "API Backend VMs",
    templateId: "template-4",
    templateName: "Virtual Machine Scale Set",
    provider: "azure",
    status: "failed",
    environment: "staging",
    createdAt: "2023-06-10T14:10:00Z",
    updatedAt: "2023-06-10T14:55:00Z",
    parameters: {
      vmSku: "Standard_DS2_v2",
      vmssName: "api-vmss",
      capacity: "3"
    },
    resources: [
      "VM Scale Set: api-vmss (Failed)"
    ],
    tenantId: "tenant-1"
  },
  {
    id: "deployment-5",
    name: "Documentation Site",
    templateId: "template-5",
    templateName: "S3 Static Website",
    provider: "aws",
    status: "pending",
    environment: "production",
    createdAt: "2023-06-15T10:30:00Z",
    updatedAt: "2023-06-15T10:40:00Z",
    parameters: {
      bucketName: "docs-website"
    },
    resources: [
      "S3 Bucket: Pending...",
      "Bucket Policy: Pending..."
    ],
    tenantId: "tenant-1"
  },
  {
    id: "deployment-6",
    name: "Analytics Database",
    templateId: "template-6",
    templateName: "Cloud SQL Database",
    provider: "gcp",
    status: "stopped",
    environment: "development",
    createdAt: "2023-05-25T13:45:00Z",
    updatedAt: "2023-06-14T09:20:00Z",
    parameters: {
      instanceName: "analytics-db",
      databaseName: "analytics",
      tier: "db-f1-micro"
    },
    resources: [
      "SQL Instance: analytics-db",
      "Database: analytics",
      "User: my-user"
    ],
    tenantId: "tenant-2"
  }
];

export const mockIntegrationConfigs: IntegrationConfig[] = [
  {
    id: "integration-1",
    name: "Azure Cloud",
    type: "cloud",
    provider: "azure",
    status: "connected",
    lastChecked: "2023-06-20T15:30:00Z",
    tenantId: "tenant-1",
    settings: {
      clientId: "azure-client-id",
      tenantId: "azure-tenant-id",
      subscriptionId: "azure-subscription-id"
    }
  },
  {
    id: "integration-2",
    name: "AWS Cloud",
    type: "cloud",
    provider: "aws",
    status: "connected",
    lastChecked: "2023-06-20T15:35:00Z",
    tenantId: "tenant-1",
    settings: {
      accessKey: "aws-access-key",
      region: "us-west-2"
    }
  },
  {
    id: "integration-3",
    name: "Google Cloud",
    type: "cloud",
    provider: "gcp",
    status: "warning",
    lastChecked: "2023-06-20T15:40:00Z",
    tenantId: "tenant-1",
    settings: {
      projectId: "gcp-project-id",
      keyFilePath: "/path/to/key.json"
    }
  },
  {
    id: "integration-4",
    name: "Azure OpenAI",
    type: "ai",
    provider: "openai",
    status: "connected",
    lastChecked: "2023-06-20T15:45:00Z",
    tenantId: "tenant-1",
    settings: {
      endpoint: "https://openai.azure.com",
      apiKey: "openai-api-key",
      deploymentName: "gpt4"
    }
  }
];
