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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const CloudAccounts = () => {
  const { currentTenant } = useAuth();
  const [activeTab, setActiveTab] = useState("azure");
  const [searchQuery, setSearchQuery] = useState("");
  const [cloudAccounts, setCloudAccounts] = useState<CloudAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // State for the account dialog
  const [isAccountDialogOpen, setIsAccountDialogOpen] = useState(false);
  const [newAccountName, setNewAccountName] = useState("");
  const [newAccountDescription, setNewAccountDescription] = useState("");
  const [selectedSubscriptions, setSelectedSubscriptions] = useState<string[]>([]);
  const [tagKey, setTagKey] = useState("");
  const [tagValue, setTagValue] = useState("");
  const [accountTags, setAccountTags] = useState<Record<string, string>>({});
  
  // State for Azure credentials and subscriptions
  const [azureCredentials, setAzureCredentials] = useState<any[]>([]);
  const [selectedCredential, setSelectedCredential] = useState<string | null>(null);
  const [availableSubscriptions, setAvailableSubscriptions] = useState<any[]>([]);
  const [isLoadingSubscriptions, setIsLoadingSubscriptions] = useState(false);
  
  // State for edit mode
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingAccount, setEditingAccount] = useState<CloudAccount | null>(null);
  
  // Fetch cloud accounts from API
  const fetchCloudAccounts = async () => {
    if (!currentTenant) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const accounts = await cmpService.getCloudAccounts(currentTenant.tenant_id);
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
  
  // Fetch Azure credentials
  const fetchAzureCredentials = async () => {
    if (!currentTenant) return;
    
    try {
      const credentials = await cmpService.getAzureCredentials(currentTenant.tenant_id);
      setAzureCredentials(credentials);
    } catch (error) {
      console.error("Error fetching Azure credentials:", error);
      
      if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error("Failed to load Azure credentials");
      }
    }
  };
  
  // Fetch Azure subscriptions for a selected credential
  const fetchAzureSubscriptions = async (credentialId: string) => {
    setIsLoadingSubscriptions(true);
    setAvailableSubscriptions([]);
    
    try {
      const subscriptions = await cmpService.getAzureSubscriptions(credentialId);
      setAvailableSubscriptions(subscriptions);
    } catch (error) {
      console.error("Error fetching Azure subscriptions:", error);
      
      if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error("Failed to load Azure subscriptions");
      }
    } finally {
      setIsLoadingSubscriptions(false);
    }
  };
  
  useEffect(() => {
    if (currentTenant) {
      fetchCloudAccounts();
      fetchAzureCredentials();
    }
  }, [currentTenant]);
  
  // When a credential is selected, fetch its subscriptions
  useEffect(() => {
    if (selectedCredential) {
      fetchAzureSubscriptions(selectedCredential);
    } else {
      setAvailableSubscriptions([]);
    }
  }, [selectedCredential]);
  
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
    
    if (!selectedCredential) {
      toast.error("Please select cloud credentials");
      return;
    }
    
    if (selectedSubscriptions.length === 0) {
      toast.error("Please select at least one subscription");
      return;
    }
    
    try {
      setIsLoading(true);
      
      // Create the new cloud account
      const newAccount = {
        name: newAccountName,
        provider: "azure", // Default to azure since that's all we support for now
        status: "connected",
        description: newAccountDescription,
        settings_id: selectedCredential, // Pass as string, not number
        subscription_ids: selectedSubscriptions
      };
      
      if (isEditMode && editingAccount) {
        // Update existing account
        await cmpService.updateCloudAccount(editingAccount.id, newAccount);
        toast.success("Cloud account updated successfully");
      } else {
        // Create new account
        await cmpService.createCloudAccount(newAccount, currentTenant!.tenant_id);
        toast.success("Cloud account created successfully");
      }
      
      // Refresh the list
      await fetchCloudAccounts();
      
      // Reset form and close dialog
      resetForm();
      setIsAccountDialogOpen(false);
      
    } catch (error) {
      console.error(isEditMode ? "Error updating cloud account:" : "Error creating cloud account:", error);
      
      if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error(isEditMode ? "Failed to update cloud account" : "Failed to create cloud account");
      }
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleEditAccount = (account: CloudAccount) => {
    setIsEditMode(true);
    setEditingAccount(account);
    
    // Populate form with account data
    setNewAccountName(account.name);
    setNewAccountDescription(account.description || "");
    setSelectedCredential(account.settings_id);
    setSelectedSubscriptions(account.subscription_ids || []);
    
    // Open dialog
    setIsAccountDialogOpen(true);
    
    // Fetch subscriptions for this account
    if (account.settings_id) {
      fetchAzureSubscriptions(account.settings_id);
    }
  };
  
  const resetForm = () => {
    setNewAccountName("");
    setNewAccountDescription("");
    setSelectedCredential(null);
    setSelectedSubscriptions([]);
    setAccountTags({});
    setIsEditMode(false);
    setEditingAccount(null);
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
    fetchAzureCredentials();
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
          
          <Dialog open={isAccountDialogOpen} onOpenChange={(open) => {
            setIsAccountDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New Cloud Account
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{isEditMode ? "Edit Cloud Account" : "Create Cloud Account"}</DialogTitle>
                <DialogDescription>
                  {isEditMode 
                    ? "Update your cloud provider account settings" 
                    : "Group your cloud provider resources into a managed account"}
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
                  <label className="text-sm font-medium">Select Cloud Credentials</label>
                  <Select
                    value={selectedCredential || ""}
                    onValueChange={(value) => setSelectedCredential(value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select credentials" />
                    </SelectTrigger>
                    <SelectContent>
                      {azureCredentials.length > 0 ? (
                        azureCredentials.map((cred) => (
                          <SelectItem key={cred.settings_id} value={cred.settings_id}>
                            {cred.name}
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="" disabled>
                          No credentials available
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium">Select Cloud Resources</label>
                  <Tabs defaultValue="azure" onValueChange={setActiveTab}>
                    <TabsList className="grid grid-cols-3 mb-2">
                      <TabsTrigger value="azure">Azure</TabsTrigger>
                      <TabsTrigger value="aws" disabled>AWS (Not Implemented)</TabsTrigger>
                      <TabsTrigger value="gcp" disabled>GCP (Not Implemented)</TabsTrigger>
                    </TabsList>
                    
                    <div className="border rounded-md">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[50px]"></TableHead>
                            <TableHead>Name</TableHead>
                            <TableHead>State</TableHead>
                            <TableHead>ID</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {activeTab === "azure" ? (
                            isLoadingSubscriptions ? (
                              <TableRow>
                                <TableCell colSpan={4} className="text-center py-4">
                                  <RefreshCw className="h-4 w-4 animate-spin mx-auto" />
                                  <span className="mt-2 text-sm text-muted-foreground">Loading subscriptions...</span>
                                </TableCell>
                              </TableRow>
                            ) : !selectedCredential ? (
                              <TableRow>
                                <TableCell colSpan={4} className="text-center text-muted-foreground py-4">
                                  Please select credentials to view available subscriptions
                                </TableCell>
                              </TableRow>
                            ) : availableSubscriptions.length > 0 ? (
                              availableSubscriptions.map((subscription) => (
                                <TableRow key={subscription.id}>
                                  <TableCell>
                                    <Checkbox
                                      checked={selectedSubscriptions.includes(subscription.id)}
                                      onCheckedChange={(checked) => {
                                        if (checked) {
                                          setSelectedSubscriptions([...selectedSubscriptions, subscription.id]);
                                        } else {
                                          setSelectedSubscriptions(
                                            selectedSubscriptions.filter(id => id !== subscription.id)
                                          );
                                        }
                                      }}
                                    />
                                  </TableCell>
                                  <TableCell className="font-medium">{subscription.name}</TableCell>
                                  <TableCell>
                                    <Badge variant={subscription.state === "Enabled" ? "secondary" : "outline"}>
                                      {subscription.state}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-xs text-muted-foreground">{subscription.id}</TableCell>
                                </TableRow>
                              ))
                            ) : (
                              <TableRow>
                                <TableCell colSpan={4} className="text-center text-muted-foreground py-4">
                                  No subscriptions found for the selected credentials
                                </TableCell>
                              </TableRow>
                            )
                          ) : (
                            <TableRow>
                              <TableCell colSpan={4} className="text-center text-muted-foreground py-4">
                                {activeTab.toUpperCase()} is not implemented yet
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
                <Button variant="outline" onClick={() => setIsAccountDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleCreateCloudAccount}>
                  {isEditMode ? "Update Account" : "Create Account"}
                </Button>
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
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => handleDeleteAccount(account.id)}
                        title="Delete account"
                      >
                        <Trash className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => handleEditAccount(account)}
                        title="Edit account"
                      >
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
            <Button className="mt-4" onClick={() => setIsAccountDialogOpen(true)}>
              Create Cloud Account
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default CloudAccounts;
