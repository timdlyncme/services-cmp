
import { CloudProvider, TemplateType } from "./cloud";

// Template interface
export interface Template {
  id: string;
  name: string;
  description: string;
  type: TemplateType;
  provider: CloudProvider;
  codeSnippet: string;
  tenantIds: string[];
  categories: string[];
  version: string;
  createdAt: string;
  updatedAt: string;
  deploymentCount: number;
  isPublished: boolean;
  author?: string;
  commitId?: string;
}

// Example template code snippets
export const codeExamples = {
  terraform: `
resource "azurerm_resource_group" "example" {
  name     = "example-resources"
  location = "West Europe"
}

resource "azurerm_virtual_network" "example" {
  name                = "example-network"
  address_space       = ["10.0.0.0/16"]
  location            = azurerm_resource_group.example.location
  resource_group_name = azurerm_resource_group.example.name
}
`,
  
  arm: `
{
  "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
  "contentVersion": "1.0.0.0",
  "parameters": {
    "storageAccountName": {
      "type": "string",
      "metadata": {
        "description": "Specifies the name of the Azure Storage account."
      }
    }
  },
  "resources": [
    {
      "type": "Microsoft.Storage/storageAccounts",
      "apiVersion": "2021-04-01",
      "name": "[parameters('storageAccountName')]",
      "location": "[resourceGroup().location]",
      "sku": {
        "name": "Standard_LRS"
      },
      "kind": "StorageV2"
    }
  ]
}
`,

  cloudFormation: `
AWSTemplateFormatVersion: '2010-09-09'
Resources:
  MyS3Bucket:
    Type: 'AWS::S3::Bucket'
    Properties:
      BucketName: my-example-bucket
      AccessControl: Private
      VersioningConfiguration:
        Status: Enabled
`,

  gcp: `
resource "google_compute_instance" "default" {
  name         = "test"
  machine_type = "e2-medium"
  zone         = "us-central1-a"

  boot_disk {
    initialize_params {
      image = "debian-cloud/debian-11"
    }
  }

  network_interface {
    network = "default"
    access_config {
      // Ephemeral public IP
    }
  }
}
`
};

export const availableCategories = [
  "Networking",
  "Storage",
  "Compute",
  "Security",
  "Database",
  "AI/ML",
  "DevOps",
  "Containers",
  "Serverless",
  "IoT",
];
