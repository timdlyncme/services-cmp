import { useState, useEffect } from "react";
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
import { CloudAccount } from "@/types/cloud";
import { cmpService } from "@/services/cmp-service";

// Mock data for discovered cloud accounts - this would come from an API in a real implementation
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

const CloudAccounts = () => {
  const { currentTenant } = useAuth();
  const [activeTab, setActiveTab] = useState("connected");
  const [searchQuery, setSearchQuery] = useState("");
  const [cloudAccounts, setCloudAccounts] = useState<CloudAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // State for the new account dialog
  const [isNewAccountDialogOpen, setIsNewAccountDialogOpen] = useState(false);
  const [newAccountName, setNewAccountName] = useState("");
  const [newAccountDescription, setNewAccountDescription] = useState("");
  const [newAccountProvider, setNewAccountProvider] = useState("azure");
  const [selectedDiscoveredAccounts, setSelectedDiscoveredAccounts] = useState<string[]>([]);
  const [tagKey, setTagKey] = useState("");
  const [tagValue, setTagValue] = useState("");
  const [accountTags, setAccountTags] = useState<Record<string, string>>({});
  
  // Fetch cloud accounts from API
  const fetchCloudAccounts = async () => {
    if (!currentTenant) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const accounts = await cmpService.getCloudAccounts(currentTenant.id);
      setCloudAccounts(accounts);
    } catch (error) {
      console.error("Error fetching cloud accounts:", error);
      setError("Failed to load cloud accounts. Please try again.");
      
      if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error("Failed to load cloud accounts");
      }
    } finally {
      setIsLoading(false);
    }
  };
  
  useEffect(() => {
    if (currentTenant) {
      fetchCloudAccounts();
    }
  }, [currentTenant]);
  
  // Helper functions
  const getStatusIcon = (status: string) => {
    switch (status) {
      case "connected":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "warning":
        return <AlertCircle className="h-4 w-4 text-amber-500" />;
      case "error":
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return null;
    }
  };
  
  const handleCreateCloudAccount = async () => {
    if (!newAccountName) {
      toast.error("Cloud account name is required");
      return;
    }
    
    if (!newAccountProvider) {
      toast.error("Cloud provider is required");
      return;
    }
    
    try {
      setIsLoading(true);
      
      // Create the new cloud account
      const newAccount = {
        name: newAccountName,
        provider: newAccountProvider as any,
        status: "connected",
        description: newAccountDescription
      };
      
      await cmpService.createCloudAccount(newAccount, currentTenant!.id);
      
      // Refresh the list
      await fetchCloudAccounts();
      
      // Reset form and close dialog
      setNewAccountName("");
      setNewAccountDescription("");
      setNewAccountProvider("azure");
      setSelectedDiscoveredAccounts([]);
      setAccountTags({});
      setIsNewAccountDialogOpen(false);
      
      toast.success("Cloud account created successfully");
    } catch (error) {
      console.error("Error creating cloud account:", error);
      
      if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error("Failed to create cloud account");
      }
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleDeleteAccount = async (accountId: string) => {
    try {
      setIsLoading(true);
      
      // Delete the cloud account
      await cmpService.deleteCloudAccount(accountId);
      
      // Refresh the list
      await fetchCloudAccounts();
      
      toast.success("Cloud account deleted successfully");
    } catch (error) {
      console.error("Error deleting cloud account:", error);
      
      if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error("Failed to delete cloud account");
      }
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleRefresh = () => {
    fetchCloudAccounts();
    toast.success("Refreshing cloud accounts...");
  };
  
  // Tag management functions
  const addTag = () => {
    if (!tagKey.trim()) {
      toast.error("Tag key is required");
      return;
    }
    
    setAccountTags({
      ...accountTags,
      [tagKey]: tagValue
    });
    
    toast.success(`Tag ${tagKey} added successfully`);
    setTagKey("");
    setTagValue("");
  };
  
  const removeTag = (key: string) => {
    const updatedTags = { ...accountTags };
    delete updatedTags[key];
    setAccountTags(updatedTags);
    
    toast.success(`Tag ${key} removed successfully`);
  };
  
  // Filter cloud accounts based on search query
  const filteredCloudAccounts = cloudAccounts.filter(account =>
    account.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    account.provider.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Cloud Accounts</h1>
          <p className="text-muted-foreground">
            Manage and organize your cloud provider accounts
          </p>
        </div>
        
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          
          <Dialog open={isNewAccountDialogOpen} onOpenChange={setIsNewAccountDialogOpen}>
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
                      value={newAccountName}
                      onChange={(e) => setNewAccountName(e.target.value)}
                      placeholder="e.g., Production Infrastructure"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <label htmlFor="description" className="text-sm font-medium">Description</label>
                    <Input
                      id="description"
                      value={newAccountDescription}
                      onChange={(e) => setNewAccountDescription(e.target.value)}
                      placeholder="Describe this cloud account"
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium">Select Cloud Provider</label>
                  <Tabs defaultValue="azure" onValueChange={setNewAccountProvider}>
                    <TabsList className="grid grid-cols-3 mb-2">
                      <TabsTrigger value="azure">Azure</TabsTrigger>
                      <TabsTrigger value="aws">AWS</TabsTrigger>
                      <TabsTrigger value="gcp">GCP</TabsTrigger>
                    </TabsList>
                  </Tabs>
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
                          {mockDiscoveredAccounts.filter(a => a.provider === activeTab).length > 0 ? (
                            mockDiscoveredAccounts.filter(a => a.provider === activeTab).map((account) => (
                              <TableRow key={account.id}>
                                <TableCell>
                                  <Checkbox
                                    checked={selectedDiscoveredAccounts.includes(account.id)}
                                    onCheckedChange={(checked) => {
                                      if (checked) {
                                        setSelectedDiscoveredAccounts([...selectedDiscoveredAccounts, account.id]);
                                      } else {
                                        setSelectedDiscoveredAccounts(
                                          selectedDiscoveredAccounts.filter(id => id !== account.id)
                                        );
                                      }
                                    }}
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
                  
                  {Object.keys(accountTags).length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {Object.entries(accountTags).map(([key, value]) => (
                        <Badge key={key} variant="secondary" className="flex gap-1 items-center">
                          {key}: {value}
                          <button 
                            onClick={() => removeTag(key)}
                            className="ml-1 hover:bg-primary-foreground rounded-full"
                          >
                            <XCircle className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsNewAccountDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleCreateCloudAccount}>Create Account</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
      
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search cloud accounts..."
          className="pl-8 mb-4"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>
      
      <div className="mt-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
            <span className="ml-2 text-muted-foreground">Loading cloud accounts...</span>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-64">
            <AlertCircle className="h-12 w-12 text-red-500" />
            <h2 className="mt-4 text-xl font-semibold">Error Loading Cloud Accounts</h2>
            <p className="text-muted-foreground mt-2">{error}</p>
            <Button className="mt-4" onClick={fetchCloudAccounts}>
              Try Again
            </Button>
          </div>
        ) : filteredCloudAccounts.length > 0 ? (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCloudAccounts.map((account) => (
                  <TableRow key={account.id}>
                    <TableCell className="font-medium">{account.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {account.provider}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center">
                        {getStatusIcon(account.status)}
                        <span className="ml-2 capitalize">{account.status}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => handleDeleteAccount(account.id)}>
                        <Trash className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon">
                        <Edit className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-64 border rounded-md p-8">
            <Cloud className="h-12 w-12 mx-auto text-muted-foreground" />
            <h2 className="mt-4 text-xl font-semibold">No Cloud Accounts Found</h2>
            <p className="text-muted-foreground mt-2">
              {searchQuery 
                ? "No cloud accounts match your search criteria" 
                : "Create your first cloud account to start organizing your resources"}
            </p>
            <Button className="mt-4" onClick={() => setIsNewAccountDialogOpen(true)}>
              Create Cloud Account
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default CloudAccounts;
