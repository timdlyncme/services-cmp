
import { useState } from "react";
import { useAuth } from "@/context/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
  Plus,
  Server,
  Database,
  Cloud,
  Search,
  CloudCog,
  Trash,
  Edit,
  FileCode
} from "lucide-react";
import { CloudAccount } from "@/types/auth";

interface Environment {
  id: string;
  name: string;
  description: string;
  cloudAccounts: CloudAccount[];
  resourceTypes: string[];
  tags: Record<string, string>;
  createdAt: string;
  deploymentCount: number;
}

// Mock data for cloud accounts
const mockCloudAccounts: CloudAccount[] = [
  {
    id: "account-1",
    name: "Production Azure",
    provider: "azure",
    status: "connected",
    tenantId: "tenant-1"
  },
  {
    id: "account-2",
    name: "Development AWS",
    provider: "aws",
    status: "connected",
    tenantId: "tenant-1"
  },
  {
    id: "account-3",
    name: "Testing GCP",
    provider: "gcp",
    status: "connected",
    tenantId: "tenant-1"
  },
  {
    id: "account-4",
    name: "Staging Azure",
    provider: "azure",
    status: "warning",
    tenantId: "tenant-1"
  }
];

// Mock data for environments
const mockEnvironments: Environment[] = [
  {
    id: "env-1",
    name: "Production",
    description: "Main production environment with strict security policies",
    cloudAccounts: [mockCloudAccounts[0]],
    resourceTypes: ["Virtual Machines", "Storage Accounts", "Networking"],
    tags: {
      environment: "production",
      criticality: "high"
    },
    createdAt: "2023-05-10T08:30:00Z",
    deploymentCount: 12
  },
  {
    id: "env-2",
    name: "Development",
    description: "Development environment for testing new features",
    cloudAccounts: [mockCloudAccounts[1], mockCloudAccounts[2]],
    resourceTypes: ["Virtual Machines", "Storage Accounts", "Databases", "Containers"],
    tags: {
      environment: "development",
      team: "engineering"
    },
    createdAt: "2023-05-15T10:45:00Z",
    deploymentCount: 8
  },
  {
    id: "env-3",
    name: "Testing",
    description: "QA testing environment",
    cloudAccounts: [mockCloudAccounts[2]],
    resourceTypes: ["Virtual Machines", "Databases"],
    tags: {
      environment: "testing",
      team: "qa"
    },
    createdAt: "2023-05-20T14:15:00Z",
    deploymentCount: 5
  }
];

// Available resource types
const resourceTypes = [
  "Virtual Machines",
  "Storage Accounts",
  "Networking",
  "Databases",
  "Containers",
  "Serverless Functions",
  "Kubernetes Clusters",
  "Message Queues",
  "CDN",
  "API Management"
];

const Environments = () => {
  const { user } = useAuth();
  const isMSP = user?.role === "msp";
  
  const [environments, setEnvironments] = useState<Environment[]>(mockEnvironments);
  const [isCreating, setIsCreating] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  
  const [newEnvironment, setNewEnvironment] = useState<Partial<Environment>>({
    name: "",
    description: "",
    cloudAccounts: [],
    resourceTypes: [],
    tags: {}
  });
  
  const [tagKey, setTagKey] = useState("");
  const [tagValue, setTagValue] = useState("");
  
  // Filter environments based on search term
  const filteredEnvironments = environments.filter(env =>
    env.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    env.description.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  const handleCreateEnvironment = () => {
    // Validate form
    if (!newEnvironment.name) {
      toast.error("Environment name is required");
      return;
    }
    
    if ((newEnvironment.cloudAccounts || []).length === 0) {
      toast.error("Please select at least one cloud account");
      return;
    }
    
    // Create new environment
    const createdEnvironment: Environment = {
      id: `env-${Date.now()}`,
      name: newEnvironment.name || "",
      description: newEnvironment.description || "",
      cloudAccounts: newEnvironment.cloudAccounts || [],
      resourceTypes: newEnvironment.resourceTypes || [],
      tags: newEnvironment.tags || {},
      createdAt: new Date().toISOString(),
      deploymentCount: 0
    };
    
    setEnvironments([...environments, createdEnvironment]);
    setIsCreating(false);
    resetEnvironmentForm();
    toast.success("Environment created successfully");
  };
  
  const resetEnvironmentForm = () => {
    setNewEnvironment({
      name: "",
      description: "",
      cloudAccounts: [],
      resourceTypes: [],
      tags: {}
    });
    setTagKey("");
    setTagValue("");
  };
  
  const handleDeleteEnvironment = (environmentId: string) => {
    setEnvironments(environments.filter(env => env.id !== environmentId));
    toast.success("Environment deleted successfully");
  };
  
  const toggleCloudAccount = (account: CloudAccount) => {
    const cloudAccounts = newEnvironment.cloudAccounts || [];
    const accountExists = cloudAccounts.find(acc => acc.id === account.id);
    
    if (accountExists) {
      setNewEnvironment({
        ...newEnvironment,
        cloudAccounts: cloudAccounts.filter(acc => acc.id !== account.id)
      });
    } else {
      setNewEnvironment({
        ...newEnvironment,
        cloudAccounts: [...cloudAccounts, account]
      });
    }
  };
  
  const toggleResourceType = (type: string) => {
    const resourceTypes = newEnvironment.resourceTypes || [];
    
    if (resourceTypes.includes(type)) {
      setNewEnvironment({
        ...newEnvironment,
        resourceTypes: resourceTypes.filter(t => t !== type)
      });
    } else {
      setNewEnvironment({
        ...newEnvironment,
        resourceTypes: [...resourceTypes, type]
      });
    }
  };
  
  const addTag = () => {
    if (!tagKey.trim()) {
      toast.error("Tag key is required");
      return;
    }
    
    setNewEnvironment({
      ...newEnvironment,
      tags: {
        ...(newEnvironment.tags || {}),
        [tagKey]: tagValue
      }
    });
    
    setTagKey("");
    setTagValue("");
  };
  
  const removeTag = (key: string) => {
    const updatedTags = { ...(newEnvironment.tags || {}) };
    delete updatedTags[key];
    
    setNewEnvironment({
      ...newEnvironment,
      tags: updatedTags
    });
  };
  
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Environments</h1>
          <p className="text-muted-foreground">
            Create and manage deployment environments for your templates
          </p>
        </div>
        <div className="flex gap-2">
          <Dialog open={isCreating} onOpenChange={setIsCreating}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New Environment
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create Deployment Environment</DialogTitle>
                <DialogDescription>
                  Define an environment for deploying your cloud templates
                </DialogDescription>
              </DialogHeader>
              
              <div className="grid gap-4 py-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label htmlFor="name" className="text-sm font-medium">Environment Name</label>
                    <Input
                      id="name"
                      value={newEnvironment.name}
                      onChange={(e) => setNewEnvironment({ ...newEnvironment, name: e.target.value })}
                      placeholder="e.g., Production, Development, Testing"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <label htmlFor="description" className="text-sm font-medium">Description</label>
                    <Input
                      id="description"
                      value={newEnvironment.description}
                      onChange={(e) => setNewEnvironment({ ...newEnvironment, description: e.target.value })}
                      placeholder="Describe the environment's purpose"
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium">Cloud Accounts</label>
                  <div className="border rounded-md p-3">
                    <div className="grid gap-2">
                      {mockCloudAccounts.map((account) => (
                        <div key={account.id} className="flex items-center justify-between p-2 border rounded-md">
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id={`account-${account.id}`}
                              checked={(newEnvironment.cloudAccounts || []).some(acc => acc.id === account.id)}
                              onCheckedChange={() => toggleCloudAccount(account)}
                            />
                            <label htmlFor={`account-${account.id}`} className="flex items-center gap-2">
                              {account.provider === "azure" && <Cloud className="h-4 w-4 text-blue-500" />}
                              {account.provider === "aws" && <Cloud className="h-4 w-4 text-amber-500" />}
                              {account.provider === "gcp" && <Cloud className="h-4 w-4 text-red-500" />}
                              <span>{account.name}</span>
                            </label>
                          </div>
                          <Badge variant={account.status === "connected" ? "secondary" : "outline"}>
                            {account.status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium">Resource Types</label>
                  <div className="border rounded-md p-3">
                    <div className="grid grid-cols-2 gap-2">
                      {resourceTypes.map((type) => (
                        <div key={type} className="flex items-center space-x-2">
                          <Checkbox
                            id={`resource-${type}`}
                            checked={(newEnvironment.resourceTypes || []).includes(type)}
                            onCheckedChange={() => toggleResourceType(type)}
                          />
                          <label
                            htmlFor={`resource-${type}`}
                            className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                          >
                            {type}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium">Environment Tags</label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Tag key"
                      value={tagKey}
                      onChange={(e) => setTagKey(e.target.value)}
                      className="w-1/3"
                    />
                    <Input
                      placeholder="Tag value"
                      value={tagValue}
                      onChange={(e) => setTagValue(e.target.value)}
                      className="w-1/3"
                    />
                    <Button onClick={addTag} type="button" variant="secondary">Add Tag</Button>
                  </div>
                  
                  {Object.keys(newEnvironment.tags || {}).length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {Object.entries(newEnvironment.tags || {}).map(([key, value]) => (
                        <Badge key={key} variant="secondary" className="flex gap-1 items-center">
                          {key}: {value}
                          <button 
                            onClick={() => removeTag(key)}
                            className="ml-1 hover:bg-primary-foreground rounded-full"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreating(false)}>Cancel</Button>
                <Button onClick={handleCreateEnvironment}>Create Environment</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
      
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search environments..."
          className="pl-8 mb-4"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>
      
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {filteredEnvironments.map((environment) => (
          <Card key={environment.id}>
            <CardHeader className="pb-3 flex flex-row justify-between items-start">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Server className="h-5 w-5" />
                  {environment.name}
                </CardTitle>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" size="icon">
                  <Edit className="h-4 w-4" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={() => handleDeleteEnvironment(environment.id)}
                >
                  <Trash className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">
                  {environment.description}
                </p>
              </div>
              
              <div>
                <h3 className="text-sm font-medium mb-1">Cloud Accounts</h3>
                <div className="flex flex-wrap gap-2">
                  {environment.cloudAccounts.map((account) => (
                    <Badge key={account.id} variant="outline" className="flex items-center gap-1">
                      {account.provider === "azure" && <Cloud className="h-3 w-3 text-blue-500" />}
                      {account.provider === "aws" && <Cloud className="h-3 w-3 text-amber-500" />}
                      {account.provider === "gcp" && <Cloud className="h-3 w-3 text-red-500" />}
                      {account.name}
                    </Badge>
                  ))}
                </div>
              </div>
              
              <div>
                <h3 className="text-sm font-medium mb-1">Resource Types</h3>
                <div className="flex flex-wrap gap-1">
                  {environment.resourceTypes.map((type) => (
                    <Badge key={type} variant="secondary" className="text-xs">
                      {type}
                    </Badge>
                  ))}
                </div>
              </div>
              
              {Object.keys(environment.tags).length > 0 && (
                <div>
                  <h3 className="text-sm font-medium mb-1">Tags</h3>
                  <div className="flex flex-wrap gap-1">
                    {Object.entries(environment.tags).map(([key, value]) => (
                      <Badge key={key} variant="outline" className="text-xs">
                        {key}: {value}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              
              <div className="flex justify-between items-center text-sm text-muted-foreground pt-2">
                <span>Created: {new Date(environment.createdAt).toLocaleDateString()}</span>
                <span className="flex items-center gap-1">
                  <FileCode className="h-3 w-3" />
                  {environment.deploymentCount} deployments
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
        
        {filteredEnvironments.length === 0 && (
          <div className="col-span-full flex flex-col items-center justify-center py-12">
            <Server className="h-12 w-12 text-muted-foreground" />
            <h2 className="mt-4 text-xl font-semibold">No Environments Found</h2>
            <p className="text-center text-muted-foreground mt-2">
              {searchTerm 
                ? "No environments match your search criteria" 
                : "Create your first deployment environment to get started"}
            </p>
            <Button
              className="mt-4"
              onClick={() => setIsCreating(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Environment
            </Button>
          </div>
        )}
      </div>
      
      {filteredEnvironments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Environment Comparison</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Cloud Providers</TableHead>
                  <TableHead>Resource Types</TableHead>
                  <TableHead>Deployments</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEnvironments.map((environment) => (
                  <TableRow key={environment.id}>
                    <TableCell className="font-medium">{environment.name}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {Array.from(new Set(environment.cloudAccounts.map(acc => acc.provider))).map((provider) => (
                          <Badge key={provider} variant="outline" className="capitalize">
                            {provider}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>{environment.resourceTypes.length}</TableCell>
                    <TableCell>{environment.deploymentCount}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Environments;
