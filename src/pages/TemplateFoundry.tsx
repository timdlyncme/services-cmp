
import { useState, useEffect } from "react";
import { useAuth } from "@/context/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import {
  FileCode,
  Plus,
  Upload,
  Search,
  Trash,
  Check,
  X,
  Pencil,
  History,
  Github,
  CloudCog,
  GitBranch
} from "lucide-react";
import { mockTemplates } from "@/data/mock-data";
import { Tenant } from "@/types/auth";
import { CloudTemplate, TemplateType, CloudProvider } from "@/types/cloud";

// Example template code snippets
const terraformExample = `
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
`;

const armExample = `
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
`;

const cloudFormationExample = `
AWSTemplateFormatVersion: '2010-09-09'
Resources:
  MyS3Bucket:
    Type: 'AWS::S3::Bucket'
    Properties:
      BucketName: my-example-bucket
      AccessControl: Private
      VersioningConfiguration:
        Status: Enabled
`;

const gcpExample = `
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
`;

// Mock tenants for MSP role
const mockAllTenants: Tenant[] = [
  {
    id: "tenant-1",
    name: "Acme Corp",
    description: "Main corporate tenant",
    createdAt: "2023-01-15T12:00:00Z",
  },
  {
    id: "tenant-2",
    name: "Dev Team",
    description: "Development team workspace",
    createdAt: "2023-02-20T09:30:00Z",
  },
  {
    id: "tenant-3",
    name: "Cloud Ops",
    description: "Cloud operations team",
    createdAt: "2023-03-10T15:45:00Z",
  },
];

interface Template {
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
}

const TemplateFoundry = () => {
  const { user, currentTenant } = useAuth();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [filteredTemplates, setFilteredTemplates] = useState<Template[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filter, setFilter] = useState("all");
  const [activeTemplate, setActiveTemplate] = useState<Template | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isAiDialogOpen, setIsAiDialogOpen] = useState(false);
  const [aiMessage, setAiMessage] = useState("");
  const [templateFormData, setTemplateFormData] = useState({
    name: "",
    description: "",
    type: "terraform" as TemplateType,
    provider: "azure" as CloudProvider,
    categories: [] as string[],
    codeSnippet: "",
    tenantIds: [] as string[],
  });
  
  const [availableCategories] = useState([
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
  ]);
  
  // MSP can see all tenants, but admin can only see their own tenant
  const isMSP = user?.role === "msp";
  const availableTenants = isMSP ? mockAllTenants : (currentTenant ? [currentTenant] : []);

  useEffect(() => {
    // In a real app, this would be an API call
    // For MSP, show all templates; for admin, show only their tenant's templates
    const relevantTemplates = isMSP 
      ? mockTemplates.map(template => ({
          ...template,
          tenantIds: [template.tenantId], // Convert tenantId to tenantIds array for consistency
          isPublished: true,
        })) as Template[]
      : mockTemplates
          .filter(template => template.tenantId === currentTenant?.id)
          .map(template => ({
            ...template,
            tenantIds: [template.tenantId],
            isPublished: true,
          })) as Template[];
    
    // Add some draft templates
    const draftTemplates: Template[] = [
      {
        id: "draft-1",
        name: "Network Security Group Draft",
        description: "Draft template for network security configuration",
        type: "terraform",
        provider: "azure",
        codeSnippet: terraformExample,
        tenantIds: isMSP ? ["tenant-1", "tenant-2"] : [currentTenant?.id || ""],
        categories: ["Security", "Networking"],
        version: "0.1.0",
        createdAt: "2023-04-10T09:00:00Z",
        updatedAt: "2023-04-10T09:00:00Z",
        deploymentCount: 0,
        isPublished: false,
      },
      {
        id: "draft-2",
        name: "Container Registry Draft",
        description: "Draft template for container registry",
        type: "arm",
        provider: "azure",
        codeSnippet: armExample,
        tenantIds: isMSP ? ["tenant-3"] : [currentTenant?.id || ""],
        categories: ["Containers", "DevOps"],
        version: "0.2.0",
        createdAt: "2023-04-15T14:30:00Z",
        updatedAt: "2023-04-15T14:30:00Z",
        deploymentCount: 0,
        isPublished: false,
      },
    ];
    
    setTemplates([...relevantTemplates, ...draftTemplates]);
    setFilteredTemplates([...relevantTemplates, ...draftTemplates]);
  }, [currentTenant, isMSP, user]);

  useEffect(() => {
    let result = templates;
    
    if (filter !== "all") {
      if (filter === "published") {
        result = result.filter(template => template.isPublished);
      } else if (filter === "draft") {
        result = result.filter(template => !template.isPublished);
      } else {
        result = result.filter(template => template.provider === filter);
      }
    }
    
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        template => 
          template.name.toLowerCase().includes(term) ||
          template.description.toLowerCase().includes(term) ||
          template.categories.some(cat => cat.toLowerCase().includes(term))
      );
    }
    
    setFilteredTemplates(result);
  }, [searchTerm, filter, templates]);

  const handleCreateTemplate = () => {
    // Validate form
    if (!templateFormData.name || !templateFormData.description || !templateFormData.codeSnippet) {
      toast.error("Please fill in all required fields");
      return;
    }
    
    if (isMSP && templateFormData.tenantIds.length === 0) {
      toast.error("Please select at least one tenant");
      return;
    }
    
    // Create new template
    const newTemplate: Template = {
      id: `template-${Date.now()}`,
      name: templateFormData.name,
      description: templateFormData.description,
      type: templateFormData.type,
      provider: templateFormData.provider,
      codeSnippet: templateFormData.codeSnippet,
      tenantIds: isMSP ? templateFormData.tenantIds : [currentTenant?.id || ""],
      categories: templateFormData.categories,
      version: "1.0.0",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      deploymentCount: 0,
      isPublished: false,
    };
    
    setTemplates([...templates, newTemplate]);
    setIsCreating(false);
    resetTemplateForm();
    toast.success("Template created successfully");
  };

  const handlePublishTemplate = (template: Template) => {
    const updatedTemplates = templates.map(t => 
      t.id === template.id ? { ...t, isPublished: true } : t
    );
    setTemplates(updatedTemplates);
    setActiveTemplate(prev => prev && { ...prev, isPublished: true });
    toast.success("Template published successfully");
  };

  const handleDeleteTemplate = (templateId: string) => {
    setTemplates(templates.filter(t => t.id !== templateId));
    setActiveTemplate(null);
    toast.success("Template deleted successfully");
  };

  const handleUpdateTemplate = () => {
    if (!activeTemplate) return;
    
    const updatedTemplates = templates.map(t => 
      t.id === activeTemplate.id ? { ...activeTemplate, updatedAt: new Date().toISOString() } : t
    );
    
    setTemplates(updatedTemplates);
    toast.success("Template updated successfully");
  };

  const handleAskAI = () => {
    if (!aiMessage.trim()) {
      toast.error("Please enter a message for the AI assistant");
      return;
    }
    
    // Simulate AI response
    toast.success("Processing your request...");
    setTimeout(() => {
      const responses = [
        "I've analyzed the template and everything looks valid. The resources are correctly defined and the dependencies are properly managed.",
        "There might be a potential security issue with the network configuration. Consider adding more restrictive access rules to improve security posture.",
        "The template uses deprecated resource types. I recommend updating to the latest version of the provider to use the newer resource definitions.",
        "The configuration looks good for production use. All required resources are properly defined and security best practices are followed.",
        "I've optimized your template for cost-efficiency. The changes reduce resource usage while maintaining the same functionality."
      ];
      
      const randomResponse = responses[Math.floor(Math.random() * responses.length)];
      setActiveTemplate(prev => prev ? {
        ...prev, 
        codeSnippet: prev.codeSnippet + "\n\n# AI Suggestion: Updated for best practices"
      } : null);
      
      toast.success("AI assistant has provided feedback");
      setAiMessage("");
      setIsAiDialogOpen(false);
    }, 1500);
  };

  const resetTemplateForm = () => {
    setTemplateFormData({
      name: "",
      description: "",
      type: "terraform",
      provider: "azure",
      categories: [],
      codeSnippet: "",
      tenantIds: [],
    });
  };

  const getTemplateTypeExample = (type: TemplateType, provider: CloudProvider) => {
    if (type === "terraform") {
      if (provider === "azure") return terraformExample;
      if (provider === "gcp") return gcpExample;
      return terraformExample; // Default to Azure example
    } else if (type === "arm") {
      return armExample;
    } else if (type === "cloudformation") {
      return cloudFormationExample;
    }
    return "";
  };

  const handleTypeOrProviderChange = (field: "type" | "provider", value: any) => {
    if (field === "type") {
      setTemplateFormData({
        ...templateFormData,
        type: value,
        codeSnippet: getTemplateTypeExample(value, templateFormData.provider),
      });
    } else {
      setTemplateFormData({
        ...templateFormData,
        provider: value,
        codeSnippet: getTemplateTypeExample(templateFormData.type, value),
      });
    }
  };

  const toggleCategory = (category: string) => {
    if (templateFormData.categories.includes(category)) {
      setTemplateFormData({
        ...templateFormData,
        categories: templateFormData.categories.filter(c => c !== category),
      });
    } else {
      setTemplateFormData({
        ...templateFormData,
        categories: [...templateFormData.categories, category],
      });
    }
  };

  const toggleTenant = (tenantId: string) => {
    if (templateFormData.tenantIds.includes(tenantId)) {
      setTemplateFormData({
        ...templateFormData,
        tenantIds: templateFormData.tenantIds.filter(id => id !== tenantId),
      });
    } else {
      setTemplateFormData({
        ...templateFormData,
        tenantIds: [...templateFormData.tenantIds, tenantId],
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Template Foundry</h1>
          <p className="text-muted-foreground">
            Create, manage and publish cloud infrastructure templates
          </p>
        </div>
        <div className="flex gap-2">
          <Dialog open={isCreating} onOpenChange={setIsCreating}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New Template
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create New Template</DialogTitle>
                <DialogDescription>
                  Create a new infrastructure template to deploy cloud resources
                </DialogDescription>
              </DialogHeader>
              
              <div className="grid gap-4 py-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label htmlFor="name" className="text-sm font-medium">Name</label>
                    <Input
                      id="name"
                      value={templateFormData.name}
                      onChange={(e) => setTemplateFormData({ ...templateFormData, name: e.target.value })}
                      placeholder="Template name"
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Type</label>
                      <Select
                        value={templateFormData.type}
                        onValueChange={(value) => handleTypeOrProviderChange("type", value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="terraform">Terraform</SelectItem>
                          <SelectItem value="arm">ARM Template</SelectItem>
                          <SelectItem value="cloudformation">CloudFormation</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Provider</label>
                      <Select
                        value={templateFormData.provider}
                        onValueChange={(value) => handleTypeOrProviderChange("provider", value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select provider" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="azure">Azure</SelectItem>
                          <SelectItem value="aws">AWS</SelectItem>
                          <SelectItem value="gcp">GCP</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <label htmlFor="description" className="text-sm font-medium">Description</label>
                  <Textarea
                    id="description"
                    value={templateFormData.description}
                    onChange={(e) => setTemplateFormData({ ...templateFormData, description: e.target.value })}
                    placeholder="Describe what this template does"
                    rows={3}
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium">Categories</label>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                    {availableCategories.map((category) => (
                      <div key={category} className="flex items-center space-x-2">
                        <Checkbox
                          id={`category-${category}`}
                          checked={templateFormData.categories.includes(category)}
                          onCheckedChange={() => toggleCategory(category)}
                        />
                        <label
                          htmlFor={`category-${category}`}
                          className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                          {category}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
                
                {isMSP && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Assign to Tenants</label>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                      {availableTenants.map((tenant) => (
                        <div key={tenant.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`tenant-${tenant.id}`}
                            checked={templateFormData.tenantIds.includes(tenant.id)}
                            onCheckedChange={() => toggleTenant(tenant.id)}
                          />
                          <label
                            htmlFor={`tenant-${tenant.id}`}
                            className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                          >
                            {tenant.name}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                <div className="space-y-2">
                  <label htmlFor="code" className="text-sm font-medium">Template Code</label>
                  <ScrollArea className="h-[300px] border rounded-md">
                    <Textarea
                      id="code"
                      value={templateFormData.codeSnippet}
                      onChange={(e) => setTemplateFormData({ ...templateFormData, codeSnippet: e.target.value })}
                      className="font-mono h-full border-0 focus-visible:ring-0"
                      placeholder="Enter your infrastructure as code here"
                      rows={15}
                    />
                  </ScrollArea>
                </div>
              </div>
              
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreating(false)}>Cancel</Button>
                <Button onClick={handleCreateTemplate}>Create Template</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
      
      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-1 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Template Library</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search templates..."
                  className="pl-8"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              
              <Tabs defaultValue="all" onValueChange={setFilter}>
                <TabsList className="grid grid-cols-4 w-full">
                  <TabsTrigger value="all">All</TabsTrigger>
                  <TabsTrigger value="published">Published</TabsTrigger>
                  <TabsTrigger value="draft">Drafts</TabsTrigger>
                </TabsList>
              </Tabs>
              
              <ScrollArea className="h-[500px] pr-3">
                <div className="space-y-2">
                  {filteredTemplates.length > 0 ? (
                    filteredTemplates.map((template) => (
                      <div
                        key={template.id}
                        className={`p-3 rounded-md cursor-pointer hover:bg-accent ${
                          activeTemplate?.id === template.id ? "bg-accent" : ""
                        }`}
                        onClick={() => setActiveTemplate(template)}
                      >
                        <div className="flex justify-between items-start">
                          <div className="font-medium truncate">{template.name}</div>
                          <Badge variant={template.isPublished ? "secondary" : "outline"}>
                            {template.isPublished ? "Published" : "Draft"}
                          </Badge>
                        </div>
                        <div className="text-sm text-muted-foreground truncate">
                          {template.description}
                        </div>
                        <div className="flex mt-2 justify-between items-center">
                          <div className="flex gap-2">
                            <Badge 
                              className={
                                template.provider === "azure" ? "bg-cloud-azure text-white" :
                                template.provider === "aws" ? "bg-cloud-aws text-black" :
                                "bg-cloud-gcp text-white"
                              }>
                              {template.provider.toUpperCase()}
                            </Badge>
                            <Badge variant="outline">{template.type}</Badge>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            v{template.version}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8">
                      <FileCode className="h-8 w-8 mx-auto text-muted-foreground" />
                      <p className="mt-2 text-muted-foreground">No templates found</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
        
        <div className="md:col-span-2">
          {activeTemplate ? (
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle>{activeTemplate.name}</CardTitle>
                      <p className="text-sm text-muted-foreground mt-1">
                        {activeTemplate.description}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {!activeTemplate.isPublished ? (
                        <Button 
                          variant="outline" 
                          size="sm"
                          className="gap-1"
                          onClick={() => handlePublishTemplate(activeTemplate)}
                        >
                          <Check className="h-4 w-4" />
                          Publish
                        </Button>
                      ) : (
                        <Badge variant="secondary">Published</Badge>
                      )}
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => handleDeleteTemplate(activeTemplate.id)}
                      >
                        <Trash className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    <div>
                      <div className="text-sm font-medium">Type</div>
                      <div className="text-sm">{activeTemplate.type}</div>
                    </div>
                    <div>
                      <div className="text-sm font-medium">Provider</div>
                      <div className="text-sm">{activeTemplate.provider.toUpperCase()}</div>
                    </div>
                    <div>
                      <div className="text-sm font-medium">Version</div>
                      <div className="text-sm">v{activeTemplate.version}</div>
                    </div>
                    <div>
                      <div className="text-sm font-medium">Created</div>
                      <div className="text-sm">{new Date(activeTemplate.createdAt).toLocaleDateString()}</div>
                    </div>
                    <div>
                      <div className="text-sm font-medium">Updated</div>
                      <div className="text-sm">{new Date(activeTemplate.updatedAt).toLocaleDateString()}</div>
                    </div>
                    <div>
                      <div className="text-sm font-medium">Deployments</div>
                      <div className="text-sm">{activeTemplate.deploymentCount}</div>
                    </div>
                  </div>
                  
                  <div>
                    <h3 className="text-sm font-medium mb-2">Categories</h3>
                    <div className="flex flex-wrap gap-2">
                      {activeTemplate.categories.map((category) => (
                        <Badge key={category} variant="secondary">
                          {category}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  
                  {isMSP && (
                    <div>
                      <h3 className="text-sm font-medium mb-2">Assigned Tenants</h3>
                      <div className="flex flex-wrap gap-2">
                        {activeTemplate.tenantIds.map((tenantId) => {
                          const tenant = availableTenants.find(t => t.id === tenantId);
                          return tenant ? (
                            <Badge key={tenantId} variant="outline">
                              {tenant.name}
                            </Badge>
                          ) : null;
                        })}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="pb-3 flex flex-row items-center justify-between">
                  <CardTitle>Template Code</CardTitle>
                  <div className="flex gap-2">
                    <Dialog open={isAiDialogOpen} onOpenChange={setIsAiDialogOpen}>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm">
                          <CloudCog className="h-4 w-4 mr-2" />
                          AI Assistant
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>AI Template Assistant</DialogTitle>
                          <DialogDescription>
                            Get help with creating or optimizing your template
                          </DialogDescription>
                        </DialogHeader>
                        
                        <div className="space-y-4 py-4">
                          <div className="space-y-2">
                            <label className="text-sm font-medium">Ask the AI</label>
                            <Textarea
                              placeholder="Ask for help, e.g., 'Check this template for security issues' or 'Optimize this for cost efficiency'"
                              value={aiMessage}
                              onChange={(e) => setAiMessage(e.target.value)}
                              rows={4}
                            />
                          </div>
                        </div>
                        
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setIsAiDialogOpen(false)}>Cancel</Button>
                          <Button onClick={handleAskAI}>Ask AI</Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                    
                    <Button size="sm" onClick={handleUpdateTemplate}>
                      <Pencil className="h-4 w-4 mr-2" />
                      Save Changes
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[400px] border rounded-md">
                    <Textarea
                      value={activeTemplate.codeSnippet}
                      onChange={(e) => setActiveTemplate({ ...activeTemplate, codeSnippet: e.target.value })}
                      className="font-mono h-full border-0 focus-visible:ring-0"
                      rows={20}
                    />
                  </ScrollArea>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle>Version History</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Version</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Changes</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow>
                        <TableCell className="font-medium">v{activeTemplate.version}</TableCell>
                        <TableCell>{new Date(activeTemplate.updatedAt).toLocaleDateString()}</TableCell>
                        <TableCell>Current version</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon">
                            <History className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium">v0.9.0</TableCell>
                        <TableCell>{new Date(new Date(activeTemplate.createdAt).getTime() - 7 * 24 * 60 * 60 * 1000).toLocaleDateString()}</TableCell>
                        <TableCell>Initial draft</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon">
                            <History className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full py-16">
              <FileCode className="h-12 w-12 text-muted-foreground" />
              <h2 className="mt-4 text-xl font-semibold">No Template Selected</h2>
              <p className="text-center text-muted-foreground mt-2 max-w-md">
                Select a template from the library to view and edit, or create a new template to get started.
              </p>
              <Button 
                className="mt-4" 
                variant="outline"
                onClick={() => setIsCreating(true)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Create New Template
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TemplateFoundry;
