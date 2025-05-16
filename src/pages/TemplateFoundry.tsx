import { useState, useEffect } from "react";
import { useAuth } from "@/context/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { CloudTemplate, CloudProvider } from "@/types/cloud";
import { Tenant } from "@/types/auth";
import { toast } from "sonner";
import {
  FileCode,
  Plus,
  History,
  Check,
  RefreshCw,
  Edit,
  Trash,
  Copy,
  Upload,
  Download,
  Settings,
} from "lucide-react";

// Mock data for template versions
interface TemplateVersion {
  id: string;
  version: string;
  createdAt: string;
  author: string;
  changes: string;
}

const mockTemplates: CloudTemplate[] = [
  {
    id: "template-1",
    name: "Azure Web App",
    description: "Deploy an Azure Web App with App Service Plan",
    type: "arm",
    provider: "azure",
    code: `{
  "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
  "contentVersion": "1.0.0.0",
  "parameters": {
    "webAppName": {
      "type": "string",
      "metadata": {
        "description": "Name of the Web App"
      }
    },
    "location": {
      "type": "string",
      "defaultValue": "[resourceGroup().location]",
      "metadata": {
        "description": "Location for all resources"
      }
    },
    "sku": {
      "type": "string",
      "defaultValue": "F1",
      "allowedValues": ["F1", "D1", "B1", "B2", "B3", "S1", "S2", "S3", "P1", "P2", "P3", "P4"],
      "metadata": {
        "description": "The SKU of App Service Plan"
      }
    }
  },
  "resources": [
    {
      "type": "Microsoft.Web/serverfarms",
      "apiVersion": "2022-03-01",
      "name": "[concat(parameters('webAppName'), '-plan')]",
      "location": "[parameters('location')]",
      "sku": {
        "name": "[parameters('sku')]"
      },
      "properties": {}
    },
    {
      "type": "Microsoft.Web/sites",
      "apiVersion": "2022-03-01",
      "name": "[parameters('webAppName')]",
      "location": "[parameters('location')]",
      "dependsOn": [
        "[resourceId('Microsoft.Web/serverfarms', concat(parameters('webAppName'), '-plan'))]"
      ],
      "properties": {
        "serverFarmId": "[resourceId('Microsoft.Web/serverfarms', concat(parameters('webAppName'), '-plan'))]"
      }
    }
  ],
  "outputs": {
    "webAppUrl": {
      "type": "string",
      "value": "[concat('https://', reference(parameters('webAppName')).defaultHostName)]"
    }
  }
}`,
    deploymentCount: 12,
    uploadedAt: "2023-09-15T14:30:00Z",
    updatedAt: "2023-12-10T09:15:00Z",
    categories: ["Web", "Azure", "PaaS"],
    tenantId: "tenant-1",
  },
  {
    id: "template-2",
    name: "AWS EC2 Instance",
    description: "Launch an EC2 instance with security group",
    type: "cloudformation",
    provider: "aws",
    code: `{
  "AWSTemplateFormatVersion": "2010-09-09",
  "Description": "AWS CloudFormation Template EC2Instance",
  "Parameters": {
    "InstanceType": {
      "Description": "EC2 instance type",
      "Type": "String",
      "Default": "t2.micro",
      "AllowedValues": ["t2.micro", "t2.small", "t2.medium", "t3.micro", "t3.small", "t3.medium"],
      "ConstraintDescription": "must be a valid EC2 instance type."
    },
    "KeyName": {
      "Description": "EC2 Key Pair",
      "Type": "AWS::EC2::KeyPair::KeyName",
      "ConstraintDescription": "must be the name of an existing EC2 KeyPair."
    }
  },
  "Resources": {
    "SecurityGroup": {
      "Type": "AWS::EC2::SecurityGroup",
      "Properties": {
        "GroupDescription": "Enable SSH access",
        "SecurityGroupIngress": [
          {
            "IpProtocol": "tcp",
            "FromPort": "22",
            "ToPort": "22",
            "CidrIp": "0.0.0.0/0"
          }
        ]
      }
    },
    "EC2Instance": {
      "Type": "AWS::EC2::Instance",
      "Properties": {
        "InstanceType": { "Ref": "InstanceType" },
        "SecurityGroups": [{ "Ref": "SecurityGroup" }],
        "KeyName": { "Ref": "KeyName" },
        "ImageId": "ami-0c55b159cbfafe1f0"
      }
    }
  },
  "Outputs": {
    "InstanceId": {
      "Description": "Instance ID",
      "Value": { "Ref": "EC2Instance" }
    },
    "PublicIP": {
      "Description": "Public IP address",
      "Value": { "Fn::GetAtt": ["EC2Instance", "PublicIp"] }
    }
  }
}`,
    deploymentCount: 8,
    uploadedAt: "2023-10-20T11:45:00Z",
    updatedAt: "2024-01-05T16:22:00Z",
    categories: ["Compute", "AWS", "IaaS"],
    tenantId: "tenant-2",
  },
  {
    id: "template-3",
    name: "GCP Cloud Storage",
    description: "Create a Google Cloud Storage bucket with proper permissions",
    type: "terraform",
    provider: "gcp",
    code: `terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 4.0"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

resource "google_storage_bucket" "static_website" {
  name          = var.bucket_name
  location      = var.region
  force_destroy = true
  
  website {
    main_page_suffix = "index.html"
    not_found_page   = "404.html"
  }

  cors {
    origin          = ["*"]
    method          = ["GET", "HEAD", "PUT", "POST", "DELETE"]
    response_header = ["*"]
    max_age_seconds = 3600
  }
}

resource "google_storage_bucket_iam_binding" "public_read" {
  bucket = google_storage_bucket.static_website.name
  role   = "roles/storage.objectViewer"
  members = [
    "allUsers",
  ]
}

variable "project_id" {
  description = "GCP Project ID"
  type        = string
}

variable "region" {
  description = "GCP Region"
  type        = string
  default     = "us-central1"
}

variable "bucket_name" {
  description = "Name of the storage bucket"
  type        = string
}

output "bucket_url" {
  description = "The URL of the bucket"
  value       = "gs://\\${google_storage_bucket.static_website.name}"
}`,
    deploymentCount: 5,
  },
];

const mockVersions: TemplateVersion[] = [
  {
    id: "v1",
    version: "1.0.0",
    createdAt: "2023-11-05T08:20:00Z",
    author: "John Doe",
    changes: "Initial version",
  },
  {
    id: "v2",
    version: "1.1.0",
    createdAt: "2023-12-15T10:30:00Z",
    author: "Jane Smith",
    changes: "Added CORS configuration",
  },
  {
    id: "v3",
    version: "1.2.0",
    createdAt: "2024-02-12T13:45:00Z",
    author: "Mike Johnson",
    changes: "Updated IAM permissions and added output variables",
  },
];

const TemplateFoundry = () => {
  const { user, tenants } = useAuth();
  const [templates, setTemplates] = useState<CloudTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<CloudTemplate | null>(null);
  const [templateCode, setTemplateCode] = useState<string>("");
  const [selectedTenants, setSelectedTenants] = useState<string[]>([]);
  const [versions, setVersions] = useState<TemplateVersion[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [newTemplate, setNewTemplate] = useState({
    name: "",
    description: "",
    type: "terraform" as "terraform" | "arm" | "cloudformation",
    provider: "azure" as CloudProvider,
    code: "",
    categories: [] as string[],
  });
  const [searchQuery, setSearchQuery] = useState("");
  
  // Filter templates
  const filteredTemplates = templates.filter(template => 
    template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    template.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    template.categories.some(cat => cat.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  useEffect(() => {
    if (user?.role === "msp") {
      setTemplates(mockTemplates);
    }
  }, [user]);

  useEffect(() => {
    if (selectedTemplate) {
      setTemplateCode(selectedTemplate.code);
      setVersions(mockVersions);
    }
  }, [selectedTemplate]);

  const handleCreateTemplate = () => {
    const newId = `template-${templates.length + 1}`;
    const createdAt = new Date().toISOString();
    
    const template: CloudTemplate = {
      ...newTemplate,
      id: newId,
      deploymentCount: 0,
      uploadedAt: createdAt,
      updatedAt: createdAt,
      tenantId: user?.tenantId || "",
      code: newTemplate.code || "// Add your template code here",
    };
    
    setTemplates([...templates, template]);
    setIsCreating(false);
    setNewTemplate({
      name: "",
      description: "",
      type: "terraform",
      provider: "azure",
      code: "",
      categories: [],
    });
    
    toast.success("Template created successfully");
  };

  const handleUpdateTemplate = () => {
    if (!selectedTemplate) return;
    
    const updatedTemplates = templates.map(template => {
      if (template.id === selectedTemplate.id) {
        return {
          ...template,
          code: templateCode,
          updatedAt: new Date().toISOString(),
        };
      }
      return template;
    });
    
    setTemplates(updatedTemplates);
    toast.success("Template updated successfully");
  };

  const handleValidateTemplate = () => {
    toast.success("Template validated successfully");
  };

  const handleDeleteTemplate = (id: string) => {
    setTemplates(templates.filter(template => template.id !== id));
    if (selectedTemplate?.id === id) {
      setSelectedTemplate(null);
      setTemplateCode("");
    }
    toast.success("Template deleted successfully");
  };

  const handleCloneTemplate = (template: CloudTemplate) => {
    const newId = `template-${templates.length + 1}`;
    const createdAt = new Date().toISOString();
    
    const clonedTemplate: CloudTemplate = {
      ...template,
      id: newId,
      name: `${template.name} (Clone)`,
      deploymentCount: 0,
      uploadedAt: createdAt,
      updatedAt: createdAt,
    };
    
    setTemplates([...templates, clonedTemplate]);
    toast.success("Template cloned successfully");
  };

  const handleTenantSelection = (id: string) => {
    if (selectedTenants.includes(id)) {
      setSelectedTenants(selectedTenants.filter(t => t !== id));
    } else {
      setSelectedTenants([...selectedTenants, id]);
    }
  };

  const handleApplyToTenants = () => {
    if (!selectedTemplate || selectedTenants.length === 0) return;
    
    toast.success(`Template applied to ${selectedTenants.length} tenant(s)`);
    setSelectedTenants([]);
  };

  const getProviderBadgeColor = (provider: CloudProvider) => {
    switch (provider) {
      case "azure":
        return "bg-blue-100 text-blue-800 dark:bg-blue-800 dark:text-blue-100";
      case "aws":
        return "bg-orange-100 text-orange-800 dark:bg-orange-800 dark:text-orange-100";
      case "gcp":
        return "bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100";
    }
  };

  const getTemplateBadgeColor = (type: string) => {
    switch (type) {
      case "terraform":
        return "bg-purple-100 text-purple-800 dark:bg-purple-800 dark:text-purple-100";
      case "arm":
        return "bg-blue-100 text-blue-800 dark:bg-blue-800 dark:text-blue-100";
      case "cloudformation":
        return "bg-orange-100 text-orange-800 dark:bg-orange-800 dark:text-orange-100";
    }
  };

  if (user?.role !== "msp") {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center">
          <h2 className="text-2xl font-bold">Access Denied</h2>
          <p className="text-muted-foreground mt-2">
            Only MSP users can access the Template Foundry
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Template Foundry</h1>
          <p className="text-muted-foreground">
            Create, manage, and distribute templates across your tenants
          </p>
        </div>
        <div className="flex space-x-2">
          <Dialog open={isCreating} onOpenChange={setIsCreating}>
            <DialogTrigger asChild>
              <Button className="flex items-center">
                <Plus className="mr-2 h-4 w-4" />
                Create Template
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px]">
              <DialogHeader>
                <DialogTitle>Create New Template</DialogTitle>
                <DialogDescription>
                  Create a new cloud resource template to share with your tenants
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="name" className="text-right">
                    Name
                  </Label>
                  <Input
                    id="name"
                    value={newTemplate.name}
                    onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })}
                    className="col-span-3"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="description" className="text-right">
                    Description
                  </Label>
                  <Textarea
                    id="description"
                    value={newTemplate.description}
                    onChange={(e) => setNewTemplate({ ...newTemplate, description: e.target.value })}
                    className="col-span-3"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="type" className="text-right">
                    Type
                  </Label>
                  <Select
                    value={newTemplate.type}
                    onValueChange={(value: "terraform" | "arm" | "cloudformation") => 
                      setNewTemplate({ ...newTemplate, type: value })
                    }
                  >
                    <SelectTrigger className="col-span-3">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="terraform">Terraform</SelectItem>
                      <SelectItem value="arm">ARM Template</SelectItem>
                      <SelectItem value="cloudformation">CloudFormation</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="provider" className="text-right">
                    Provider
                  </Label>
                  <Select
                    value={newTemplate.provider}
                    onValueChange={(value: CloudProvider) => 
                      setNewTemplate({ ...newTemplate, provider: value })
                    }
                  >
                    <SelectTrigger className="col-span-3">
                      <SelectValue placeholder="Select provider" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="azure">Microsoft Azure</SelectItem>
                      <SelectItem value="aws">Amazon AWS</SelectItem>
                      <SelectItem value="gcp">Google Cloud Platform</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="categories" className="text-right">
                    Categories
                  </Label>
                  <Input
                    id="categories"
                    placeholder="Web, Compute, Storage (comma-separated)"
                    onChange={(e) => setNewTemplate({ 
                      ...newTemplate, 
                      categories: e.target.value.split(',').map(cat => cat.trim())
                    })}
                    className="col-span-3"
                  />
                </div>
                <div className="grid grid-cols-4 items-start gap-4">
                  <Label htmlFor="code" className="text-right pt-2">
                    Template Code
                  </Label>
                  <Textarea
                    id="code"
                    value={newTemplate.code}
                    onChange={(e) => setNewTemplate({ ...newTemplate, code: e.target.value })}
                    className="col-span-3 font-mono text-xs h-[200px]"
                    placeholder="Paste your template code here..."
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreating(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateTemplate}>Create Template</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="flex items-center">
        <Input
          placeholder="Search templates..."
          className="max-w-sm"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Template Library</CardTitle>
              <CardDescription>
                {filteredTemplates.length} templates available
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-[600px] overflow-y-auto">
                {filteredTemplates.map((template) => (
                  <div
                    key={template.id}
                    className={`p-3 border-b last:border-b-0 hover:bg-muted/50 cursor-pointer flex justify-between ${
                      selectedTemplate?.id === template.id ? "bg-muted" : ""
                    }`}
                    onClick={() => setSelectedTemplate(template)}
                  >
                    <div>
                      <p className="font-medium">{template.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {template.description}
                      </p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        <Badge
                          variant="outline"
                          className={getProviderBadgeColor(template.provider)}
                        >
                          {template.provider}
                        </Badge>
                        <Badge
                          variant="outline"
                          className={getTemplateBadgeColor(template.type)}
                        >
                          {template.type}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex flex-col space-y-2">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCloneTemplate(template);
                        }}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteTemplate(template.id);
                        }}
                      >
                        <Trash className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                {filteredTemplates.length === 0 && (
                  <div className="p-6 text-center">
                    <p className="text-muted-foreground">No templates found</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
          
          {selectedTemplate && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle>Tenant Assignment</CardTitle>
                <CardDescription>
                  Assign this template to specific tenants
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-[200px] overflow-y-auto">
                  {tenants.map((tenant) => (
                    <div key={tenant.id} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id={`tenant-${tenant.id}`}
                        checked={selectedTenants.includes(tenant.id)}
                        onChange={() => handleTenantSelection(tenant.id)}
                        className="h-4 w-4 rounded border-gray-300"
                      />
                      <label htmlFor={`tenant-${tenant.id}`}>{tenant.name}</label>
                    </div>
                  ))}
                </div>
              </CardContent>
              <CardFooter>
                <Button 
                  onClick={handleApplyToTenants} 
                  disabled={selectedTenants.length === 0}
                  className="w-full"
                >
                  Apply to Selected Tenants
                </Button>
              </CardFooter>
            </Card>
          )}
        </div>
        
        <div className="lg:col-span-2">
          {selectedTemplate ? (
            <Tabs defaultValue="editor">
              <TabsList className="grid grid-cols-3 w-full">
                <TabsTrigger value="editor">Template Editor</TabsTrigger>
                <TabsTrigger value="versions">Version History</TabsTrigger>
                <TabsTrigger value="assistant">AI Assistant</TabsTrigger>
              </TabsList>
              
              <TabsContent value="editor" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>{selectedTemplate.name}</CardTitle>
                    <CardDescription>
                      {selectedTemplate.description}
                    </CardDescription>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {selectedTemplate.categories.map((category, index) => (
                        <Badge key={index} variant="outline">{category}</Badge>
                      ))}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <Textarea
                      value={templateCode}
                      onChange={(e) => setTemplateCode(e.target.value)}
                      className="font-mono text-xs h-[400px]"
                    />
                  </CardContent>
                  <CardFooter className="flex justify-between">
                    <Button variant="outline" onClick={handleValidateTemplate}>
                      <Check className="mr-2 h-4 w-4" />
                      Validate
                    </Button>
                    <Button onClick={handleUpdateTemplate}>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Update Template
                    </Button>
                  </CardFooter>
                </Card>
              </TabsContent>
              
              <TabsContent value="versions" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Version History</CardTitle>
                    <CardDescription>
                      Track changes and restore previous versions
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Version</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Author</TableHead>
                          <TableHead>Changes</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {versions.map((version) => (
                          <TableRow key={version.id}>
                            <TableCell className="font-medium">{version.version}</TableCell>
                            <TableCell>
                              {new Date(version.createdAt).toLocaleDateString()}
                            </TableCell>
                            <TableCell>{version.author}</TableCell>
                            <TableCell>{version.changes}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end space-x-2">
                                <Button size="sm" variant="outline">
                                  <History className="h-4 w-4" />
                                </Button>
                                <Button size="sm" variant="outline">
                                  <Download className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                  <CardFooter>
                    <Button variant="outline" className="w-full">
                      <Upload className="mr-2 h-4 w-4" />
                      Create New Version
                    </Button>
                  </CardFooter>
                </Card>
              </TabsContent>
              
              <TabsContent value="assistant" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>AI Template Assistant</CardTitle>
                    <CardDescription>
                      Get help with writing, modifying or understanding templates
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="bg-muted p-4 rounded-md mb-4 h-[300px] overflow-y-auto">
                      <div className="flex flex-col space-y-4">
                        <div className="bg-primary/10 rounded p-3 max-w-[80%]">
                          <p className="text-sm">Hi there! I can help you with your {selectedTemplate.type} template for {selectedTemplate.provider}. What would you like to know or modify?</p>
                        </div>
                        <div className="bg-secondary/10 rounded p-3 ml-auto max-w-[80%]">
                          <p className="text-sm">Can you explain what this template does?</p>
                        </div>
                        <div className="bg-primary/10 rounded p-3 max-w-[80%]">
                          <p className="text-sm">
                            This template {
                              selectedTemplate.type === "terraform" ? 
                                "creates a Google Cloud Storage bucket with website hosting capabilities and public read access." : 
                              selectedTemplate.type === "arm" ? 
                                "deploys an Azure Web App with an App Service Plan, allowing you to host web applications." : 
                                "launches an EC2 instance in AWS with a security group that enables SSH access."
                            } It includes parameters for customization and outputs important information after deployment.
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      <Input placeholder="Ask the AI about this template..." className="flex-1" />
                      <Button>Send</Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          ) : (
            <div className="flex items-center justify-center h-[500px] bg-muted/20 border-2 border-dashed rounded-lg">
              <div className="text-center">
                <FileCode className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-2 text-lg font-medium">No Template Selected</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Select a template from the library or create a new one
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TemplateFoundry;