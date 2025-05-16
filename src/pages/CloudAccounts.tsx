
import { useState } from "react";
import { useAuth } from "@/context/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Search, Cloud, Plus, Users, Tag, Shield, CheckCircle, AlertCircle, XCircle, Edit, Trash, RefreshCw } from "lucide-react";
import { mockCloudAccounts } from "@/data/mock-data";
import { CloudAccount } from "@/types/auth";

// Mock data for discovered cloud accounts
const mockDiscoveredAccounts = [
  // Azure Subscriptions
  { id: "azure-sub-1", name: "Production", type: "subscription", provider: "azure", status: "active" },
  { id: "azure-sub-2", name: "Development", type: "subscription", provider: "azure", status: "active" },
  { id: "azure-sub-3", name: "Testing", type: "subscription", provider: "azure", status: "active" },
  { id: "azure-sub-4", name: "Staging", type: "subscription", provider: "azure", status: "inactive" },
  
  // AWS Accounts
  { id: "aws-acc-1", name: "Main Account", type: "account", provider: "aws", status: "active" },
  { id: "aws-acc-2", name: "Dev Account", type: "account", provider: "aws", status: "active" },
  
  // GCP Projects
  { id: "gcp-proj-1", name: "Analytics", type: "project", provider: "gcp", status: "active" },
  { id: "gcp-proj-2", name: "ML Platform", type: "project", provider: "gcp", status: "active" },
  { id: "gcp-proj-3", name: "Infrastructure", type: "project", provider: "gcp", status: "inactive" }
];

// Mock data for created cloud accounts
const mockCreatedCloudAccounts = [
  {
    id: "acc-1",
    name: "Production Infrastructure",
    description: "All production infrastructure across cloud providers",
    cloudAccounts: ["azure-sub-1", "aws-acc-1", "gcp-proj-1"],
    tags: { environment: "production", criticality: "high" },
    createdAt: "2023-06-15T08:30:00Z",
    status: "healthy"
  },
  {
    id: "acc-2",
    name: "Development Environment",
    description: "Resources for development and testing",
    cloudAccounts: ["azure-sub-2", "azure-sub-3", "aws-acc-2", "gcp-proj-2"],
    tags: { environment: "development", team: "engineering" },
    createdAt: "2023-06-16T10:45:00Z",
    status: "warning"
  }
];

const CloudAccounts = () => {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [activeTab, setActiveTab] = useState("azure");
  
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [newCloudAccount, setNewCloudAccount] = useState({
    name: "",
    description: "",
    cloudAccounts: [] as string[],
    tags: {} as Record<string, string>
  });
  
  const [cloudAccounts, setCloudAccounts] = useState(mockCreatedCloudAccounts);
  const [tagKey, setTagKey] = useState("");
  const [tagValue, setTagValue] = useState("");
  
  const filteredCloudAccounts = cloudAccounts.filter(account =>
    account.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    account.description.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  const filteredDiscoveredAccounts = mockDiscoveredAccounts.filter(account =>
    account.provider === activeTab &&
    (account.name.toLowerCase().includes(searchTerm.toLowerCase()))
  );
  
  const toggleAccountSelection = (accountId: string) => {
    if (selectedAccounts.includes(accountId)) {
      setSelectedAccounts(selectedAccounts.filter(id => id !== accountId));
    } else {
      setSelectedAccounts([...selectedAccounts, accountId]);
    }
  };
  
  const handleCreateCloudAccount = () => {
    if (!newCloudAccount.name) {
      toast.error("Cloud account name is required");
      return;
    }
    
    if (newCloudAccount.cloudAccounts.length === 0) {
      toast.error("Please select at least one cloud account");
      return;
    }
    
    const createdAccount = {
      id: `acc-${Date.now()}`,
      name: newCloudAccount.name,
      description: newCloudAccount.description,
      cloudAccounts: newCloudAccount.cloudAccounts,
      tags: newCloudAccount.tags,
      createdAt: new Date().toISOString(),
      status: "healthy"
    };
    
    setCloudAccounts([...cloudAccounts, createdAccount]);
    setIsCreating(false);
    resetForm();
    toast.success("Cloud account created successfully");
  };
  
  const resetForm = () => {
    setNewCloudAccount({
      name: "",
      description: "",
      cloudAccounts: [],
      tags: {}
    });
    setSelectedAccounts([]);
    setTagKey("");
    setTagValue("");
  };
  
  const addTag = () => {
    if (!tagKey.trim()) {
      toast.error("Tag key is required");
      return;
    }
    
    setNewCloudAccount({
      ...newCloudAccount,
      tags: {
        ...newCloudAccount.tags,
        [tagKey]: tagValue
      }
    });
    
    setTagKey("");
    setTagValue("");
  };
  
  const removeTag = (key: string) => {
    const updatedTags = { ...newCloudAccount.tags };
    delete updatedTags[key];
    
    setNewCloudAccount({
      ...newCloudAccount,
      tags: updatedTags
    });
  };
  
  const handleDeleteAccount = (accountId: string) => {
    setCloudAccounts(cloudAccounts.filter(account => account.id !== accountId));
    toast.success("Cloud account deleted successfully");
  };
  
  const getStatusIcon = (status: string) => {
    switch (status) {
      case "healthy":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "warning":
        return <AlertCircle className="h-4 w-4 text-amber-500" />;
      case "error":
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return null;
    }
  };
  
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Cloud Accounts</h1>
          <p className="text-muted-foreground">
            Manage and organize your cloud provider accounts
          </p>
        </div>
        
        <Dialog open={isCreating} onOpenChange={setIsCreating}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Cloud Account
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Cloud Account</DialogTitle>
              <DialogDescription>
                Group your cloud provider resources into a managed account
              </DialogDescription>
            </DialogHeader>
            
            <div className="grid gap-4 py-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label htmlFor="name" className="text-sm font-medium">Account Name</label>
                  <Input
                    id="name"
                    value={newCloudAccount.name}
                    onChange={(e) => setNewCloudAccount({ ...newCloudAccount, name: e.target.value })}
                    placeholder="e.g., Production Infrastructure"
                  />
                </div>
                
                <div className="space-y-2">
                  <label htmlFor="description" className="text-sm font-medium">Description</label>
                  <Input
                    id="description"
                    value={newCloudAccount.description}
                    onChange={(e) => setNewCloudAccount({ ...newCloudAccount, description: e.target.value })}
                    placeholder="Describe this cloud account"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">Select Cloud Resources</label>
                <Tabs defaultValue="azure" onValueChange={setActiveTab}>
                  <TabsList className="grid grid-cols-3 mb-2">
                    <TabsTrigger value="azure">Azure</TabsTrigger>
                    <TabsTrigger value="aws">AWS</TabsTrigger>
                    <TabsTrigger value="gcp">GCP</TabsTrigger>
                  </TabsList>
                  
                  <div className="border rounded-md">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[50px]"></TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredDiscoveredAccounts.length > 0 ? (
                          filteredDiscoveredAccounts.map((account) => (
                            <TableRow key={account.id}>
                              <TableCell>
                                <Checkbox
                                  checked={selectedAccounts.includes(account.id)}
                                  onCheckedChange={() => toggleAccountSelection(account.id)}
                                />
                              </TableCell>
                              <TableCell className="font-medium">{account.name}</TableCell>
                              <TableCell className="capitalize">{account.type}</TableCell>
                              <TableCell>
                                <Badge variant={account.status === "active" ? "secondary" : "outline"}>
                                  {account.status}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={4} className="text-center text-muted-foreground py-4">
                              No {activeTab.toUpperCase()} accounts found
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </Tabs>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">Account Tags</label>
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
                
                {Object.keys(newCloudAccount.tags).length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {Object.entries(newCloudAccount.tags).map(([key, value]) => (
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
              <Button onClick={handleCreateCloudAccount}>Create Account</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search cloud accounts..."
          className="pl-8 mb-4"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>
      
      {filteredCloudAccounts.length > 0 ? (
        <div className="grid gap-6">
          {filteredCloudAccounts.map((account) => (
            <Card key={account.id}>
              <CardHeader className="pb-3 flex flex-row justify-between items-start">
                <div>
                  <div className="flex items-center gap-2">
                    <CardTitle>{account.name}</CardTitle>
                    <Badge variant={account.status === "healthy" ? "secondary" : "outline"} className="flex items-center gap-1">
                      {getStatusIcon(account.status)}
                      <span className="capitalize">{account.status}</span>
                    </Badge>
                  </div>
                  <CardDescription>{account.description}</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="icon">
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon"
                    onClick={() => handleDeleteAccount(account.id)}
                  >
                    <Trash className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h3 className="text-sm font-medium mb-2">Linked Cloud Resources</h3>
                  <div className="flex flex-wrap gap-2">
                    {account.cloudAccounts.map((accountId) => {
                      const discoveredAccount = mockDiscoveredAccounts.find(a => a.id === accountId);
                      if (!discoveredAccount) return null;
                      
                      return (
                        <Badge key={accountId} variant="outline" className="flex items-center gap-1">
                          <Cloud className={
                            discoveredAccount.provider === "azure" ? "h-3 w-3 text-blue-500" :
                            discoveredAccount.provider === "aws" ? "h-3 w-3 text-amber-500" :
                            "h-3 w-3 text-red-500"
                          } />
                          {discoveredAccount.name}
                        </Badge>
                      );
                    })}
                  </div>
                </div>
                
                {Object.keys(account.tags).length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium mb-2">Tags</h3>
                    <div className="flex flex-wrap gap-1">
                      {Object.entries(account.tags).map(([key, value]) => (
                        <Badge key={key} variant="secondary" className="text-xs">
                          {key}: {value}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                
                <div className="flex justify-between items-center text-sm text-muted-foreground pt-2 border-t">
                  <span>Created: {new Date(account.createdAt).toLocaleDateString()}</span>
                  <Button size="sm" variant="ghost" className="flex items-center gap-1 h-8">
                    <RefreshCw className="h-3 w-3" />
                    Run Health Check
                  </Button>
                </div>
              </CardContent>
              <CardFooter className="flex justify-between">
                <Button variant="outline" size="sm" className="flex items-center gap-1">
                  <Users className="h-4 w-4" />
                  Manage Access
                </Button>
                <Button variant="outline" size="sm" className="flex items-center gap-1">
                  <Shield className="h-4 w-4" />
                  Security Settings
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <Cloud className="h-12 w-12 mx-auto text-muted-foreground" />
          <h2 className="mt-4 text-xl font-semibold">No Cloud Accounts Found</h2>
          <p className="text-muted-foreground mt-2">
            {searchTerm 
              ? "No cloud accounts match your search criteria" 
              : "Create your first cloud account to start organizing your resources"}
          </p>
          <Button className="mt-4" onClick={() => setIsCreating(true)}>
            Create Cloud Account
          </Button>
        </div>
      )}
    </div>
  );
};

export default CloudAccounts;
