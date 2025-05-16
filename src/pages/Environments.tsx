
import { useState, useEffect } from "react";
import { useAuth } from "@/context/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Trash, Edit, Check, X, Server } from "lucide-react";

interface Environment {
  id: string;
  name: string;
  description: string;
  cloudAccounts: CloudAccount[];
  resourceTypes: string[];
  tags: Record<string, string>;
  createdAt: string;
}

interface CloudAccount {
  id: string;
  name: string;
  provider: "azure" | "aws" | "gcp";
  region: string;
}

// Mock data
const mockCloudAccounts: CloudAccount[] = [
  { id: "ca1", name: "Production Azure", provider: "azure", region: "eastus" },
  { id: "ca2", name: "Dev AWS", provider: "aws", region: "us-west-2" },
  { id: "ca3", name: "Staging GCP", provider: "gcp", region: "us-central1" },
  { id: "ca4", name: "Test Azure", provider: "azure", region: "westeurope" },
];

const mockResourceTypes = [
  "Virtual Machines",
  "Storage Accounts",
  "Networking",
  "Containers",
  "Databases",
  "Serverless",
  "Security",
];

const initialEnvironments: Environment[] = [
  {
    id: "env1",
    name: "Production",
    description: "Production environment with strict access controls",
    cloudAccounts: [mockCloudAccounts[0]],
    resourceTypes: ["Virtual Machines", "Storage Accounts", "Networking"],
    tags: { environment: "production", owner: "ops-team" },
    createdAt: "2024-03-15T10:00:00Z",
  },
  {
    id: "env2",
    name: "Development",
    description: "Development environment for testing",
    cloudAccounts: [mockCloudAccounts[1], mockCloudAccounts[2]],
    resourceTypes: ["Virtual Machines", "Containers", "Databases"],
    tags: { environment: "development", owner: "dev-team" },
    createdAt: "2024-03-20T14:30:00Z",
  },
];

const Environments = () => {
  const { user, currentTenant } = useAuth();
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [newEnvironment, setNewEnvironment] = useState<Partial<Environment>>({
    name: "",
    description: "",
    cloudAccounts: [],
    resourceTypes: [],
    tags: {},
  });
  const [editingEnvironment, setEditingEnvironment] = useState<Environment | null>(null);
  
  useEffect(() => {
    // In a real app, this would fetch from an API
    setEnvironments(initialEnvironments);
  }, []);

  const handleCreateEnvironment = () => {
    if (!newEnvironment.name) {
      toast.error("Environment name is required");
      return;
    }

    const environment: Environment = {
      id: `env-${Date.now()}`,
      name: newEnvironment.name || "",
      description: newEnvironment.description || "",
      cloudAccounts: newEnvironment.cloudAccounts || [],
      resourceTypes: newEnvironment.resourceTypes || [],
      tags: newEnvironment.tags || {},
      createdAt: new Date().toISOString(),
    };

    setEnvironments([...environments, environment]);
    setNewEnvironment({
      name: "",
      description: "",
      cloudAccounts: [],
      resourceTypes: [],
      tags: {},
    });
    setIsCreateDialogOpen(false);
    toast.success("Environment created successfully");
  };

  const handleEditEnvironment = () => {
    if (!editingEnvironment) return;

    const updatedEnvironments = environments.map(env => 
      env.id === editingEnvironment.id ? editingEnvironment : env
    );
    
    setEnvironments(updatedEnvironments);
    setEditingEnvironment(null);
    setIsEditDialogOpen(false);
    toast.success("Environment updated successfully");
  };

  const handleDeleteEnvironment = (id: string) => {
    setEnvironments(environments.filter(env => env.id !== id));
    toast.success("Environment deleted");
  };

  const handleCloudAccountToggle = (accountId: string, isCreating: boolean = true) => {
    if (isCreating) {
      const cloudAccounts = newEnvironment.cloudAccounts || [];
      const isSelected = cloudAccounts.some(account => account.id === accountId);
      
      if (isSelected) {
        setNewEnvironment({
          ...newEnvironment,
          cloudAccounts: cloudAccounts.filter(account => account.id !== accountId),
        });
      } else {
        const accountToAdd = mockCloudAccounts.find(account => account.id === accountId);
        if (accountToAdd) {
          setNewEnvironment({
            ...newEnvironment,
            cloudAccounts: [...cloudAccounts, accountToAdd],
          });
        }
      }
    } else if (editingEnvironment) {
      const cloudAccounts = editingEnvironment.cloudAccounts || [];
      const isSelected = cloudAccounts.some(account => account.id === accountId);
      
      if (isSelected) {
        setEditingEnvironment({
          ...editingEnvironment,
          cloudAccounts: cloudAccounts.filter(account => account.id !== accountId),
        });
      } else {
        const accountToAdd = mockCloudAccounts.find(account => account.id === accountId);
        if (accountToAdd) {
          setEditingEnvironment({
            ...editingEnvironment,
            cloudAccounts: [...cloudAccounts, accountToAdd],
          });
        }
      }
    }
  };

  const handleResourceTypeToggle = (resourceType: string, isCreating: boolean = true) => {
    if (isCreating) {
      const resourceTypes = newEnvironment.resourceTypes || [];
      const isSelected = resourceTypes.includes(resourceType);
      
      if (isSelected) {
        setNewEnvironment({
          ...newEnvironment,
          resourceTypes: resourceTypes.filter(type => type !== resourceType),
        });
      } else {
        setNewEnvironment({
          ...newEnvironment,
          resourceTypes: [...resourceTypes, resourceType],
        });
      }
    } else if (editingEnvironment) {
      const resourceTypes = editingEnvironment.resourceTypes || [];
      const isSelected = resourceTypes.includes(resourceType);
      
      if (isSelected) {
        setEditingEnvironment({
          ...editingEnvironment,
          resourceTypes: resourceTypes.filter(type => type !== resourceType),
        });
      } else {
        setEditingEnvironment({
          ...editingEnvironment,
          resourceTypes: [...resourceTypes, resourceType],
        });
      }
    }
  };

  const providerColor = (provider: string) => {
    switch (provider) {
      case "azure": return "bg-cloud-azure text-white";
      case "aws": return "bg-cloud-aws text-black";
      case "gcp": return "bg-cloud-gcp text-white";
      default: return "bg-muted text-muted-foreground";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Environments</h1>
          <p className="text-muted-foreground">
            Create and manage deployment environments
          </p>
        </div>
        <div>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Create Environment
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create New Environment</DialogTitle>
                <DialogDescription>
                  Configure a new environment for deploying templates
                </DialogDescription>
              </DialogHeader>
              
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    placeholder="Production, Development, etc."
                    value={newEnvironment.name || ""}
                    onChange={(e) => setNewEnvironment({ ...newEnvironment, name: e.target.value })}
                  />
                </div>
                
                <div className="grid gap-2">
                  <Label htmlFor="description">Description</Label>
                  <Input
                    id="description"
                    placeholder="Describe this environment"
                    value={newEnvironment.description || ""}
                    onChange={(e) => setNewEnvironment({ ...newEnvironment, description: e.target.value })}
                  />
                </div>
                
                <div className="grid gap-2">
                  <Label>Cloud Accounts</Label>
                  <div className="border rounded-md p-3 space-y-2">
                    {mockCloudAccounts.map((account) => (
                      <div key={account.id} className="flex items-center space-x-2">
                        <Checkbox
                          checked={(newEnvironment.cloudAccounts || []).some(a => a.id === account.id)}
                          onCheckedChange={() => handleCloudAccountToggle(account.id)}
                          id={`account-${account.id}`}
                        />
                        <Label htmlFor={`account-${account.id}`} className="flex items-center gap-2 cursor-pointer">
                          <Badge className={providerColor(account.provider)}>
                            {account.provider.toUpperCase()}
                          </Badge>
                          {account.name} ({account.region})
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
                
                <div className="grid gap-2">
                  <Label>Resource Types</Label>
                  <div className="border rounded-md p-3 space-y-2">
                    {mockResourceTypes.map((resourceType) => (
                      <div key={resourceType} className="flex items-center space-x-2">
                        <Checkbox
                          checked={(newEnvironment.resourceTypes || []).includes(resourceType)}
                          onCheckedChange={() => handleResourceTypeToggle(resourceType)}
                          id={`resource-${resourceType}`}
                        />
                        <Label htmlFor={`resource-${resourceType}`} className="cursor-pointer">
                          {resourceType}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
                
                <div className="grid gap-2">
                  <Label htmlFor="tags">Tags (optional)</Label>
                  <div className="text-sm text-muted-foreground">
                    Tags will be automatically applied to all resources deployed in this environment
                  </div>
                </div>
              </div>
              
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateEnvironment}>Create Environment</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
      
      <div className="grid gap-6 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        {environments.map((environment) => (
          <Card key={environment.id}>
            <CardHeader>
              <div className="flex justify-between items-start">
                <CardTitle>{environment.name}</CardTitle>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setEditingEnvironment(environment);
                      setIsEditDialogOpen(true);
                    }}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDeleteEnvironment(environment.id)}
                  >
                    <Trash className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <CardDescription>{environment.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-medium mb-2">Cloud Accounts</h4>
                  <div className="flex flex-wrap gap-2">
                    {environment.cloudAccounts.map((account) => (
                      <Badge key={account.id} className={providerColor(account.provider)}>
                        {account.name}
                      </Badge>
                    ))}
                  </div>
                </div>
                
                <div>
                  <h4 className="text-sm font-medium mb-2">Resource Types</h4>
                  <div className="flex flex-wrap gap-2">
                    {environment.resourceTypes.map((type) => (
                      <Badge key={type} variant="secondary">
                        {type}
                      </Badge>
                    ))}
                  </div>
                </div>
                
                <div>
                  <h4 className="text-sm font-medium mb-2">Tags</h4>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(environment.tags).map(([key, value]) => (
                      <Badge key={key} variant="outline">
                        {key}: {value}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {environments.length === 0 && (
        <div className="text-center py-10">
          <Server className="mx-auto h-10 w-10 text-muted-foreground" />
          <h3 className="mt-4 text-lg font-medium">No environments created yet</h3>
          <p className="mt-2 text-muted-foreground">
            Create an environment to organize your deployments.
          </p>
        </div>
      )}
      
      {/* Edit Environment Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Environment</DialogTitle>
          </DialogHeader>
          
          {editingEnvironment && (
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-name">Name</Label>
                <Input
                  id="edit-name"
                  value={editingEnvironment.name}
                  onChange={(e) => setEditingEnvironment({
                    ...editingEnvironment,
                    name: e.target.value
                  })}
                />
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="edit-description">Description</Label>
                <Input
                  id="edit-description"
                  value={editingEnvironment.description}
                  onChange={(e) => setEditingEnvironment({
                    ...editingEnvironment,
                    description: e.target.value
                  })}
                />
              </div>
              
              <div className="grid gap-2">
                <Label>Cloud Accounts</Label>
                <div className="border rounded-md p-3 space-y-2">
                  {mockCloudAccounts.map((account) => (
                    <div key={account.id} className="flex items-center space-x-2">
                      <Checkbox
                        checked={editingEnvironment.cloudAccounts.some(a => a.id === account.id)}
                        onCheckedChange={() => handleCloudAccountToggle(account.id, false)}
                        id={`edit-account-${account.id}`}
                      />
                      <Label htmlFor={`edit-account-${account.id}`} className="flex items-center gap-2 cursor-pointer">
                        <Badge className={providerColor(account.provider)}>
                          {account.provider.toUpperCase()}
                        </Badge>
                        {account.name} ({account.region})
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="grid gap-2">
                <Label>Resource Types</Label>
                <div className="border rounded-md p-3 space-y-2">
                  {mockResourceTypes.map((resourceType) => (
                    <div key={resourceType} className="flex items-center space-x-2">
                      <Checkbox
                        checked={editingEnvironment.resourceTypes.includes(resourceType)}
                        onCheckedChange={() => handleResourceTypeToggle(resourceType, false)}
                        id={`edit-resource-${resourceType}`}
                      />
                      <Label htmlFor={`edit-resource-${resourceType}`} className="cursor-pointer">
                        {resourceType}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEditEnvironment}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Environments;
