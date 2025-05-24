import { useState, useEffect } from "react";
import { useAuth } from "@/context/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Search, Plus, Edit, Trash, RefreshCw, AlertCircle, Layers, Server, Settings, Terminal, Activity } from "lucide-react";
import { cmpService } from "@/services/cmp-service";
import { CloudAccount } from "@/types/cloud";

interface Environment {
  id: string;
  environment_id: string;
  name: string;
  description: string;
  tenant_id: string;  // Changed from number to string
  update_strategy?: string;
  cloud_accounts: Array<{
    id: string;
    name: string;
    provider: string;
    status: string;
  }>;
  scaling_policies?: Record<string, any>;
  environment_variables?: Record<string, any>;
  logging_config?: Record<string, any>;
  monitoring_integration?: Record<string, any>;
}

const Environments = () => {
  const { currentTenant } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [filteredEnvironments, setFilteredEnvironments] = useState<Environment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // State for the new environment dialog
  const [isNewEnvironmentDialogOpen, setIsNewEnvironmentDialogOpen] = useState(false);
  const [newEnvironmentName, setNewEnvironmentName] = useState("");
  const [newEnvironmentDescription, setNewEnvironmentDescription] = useState("");
  const [updateStrategy, setUpdateStrategy] = useState<string>("");
  const [selectedCloudAccounts, setSelectedCloudAccounts] = useState<string[]>([]);
  const [cloudAccounts, setCloudAccounts] = useState<CloudAccount[]>([]);
  const [activeTab, setActiveTab] = useState("general");
  
  // State for environment configuration
  const [environmentVariables, setEnvironmentVariables] = useState<string>("{\n  \"KEY\": \"value\"\n}");
  const [scalingPolicies, setScalingPolicies] = useState<string>("{\n  \"min_instances\": 1,\n  \"max_instances\": 5,\n  \"cpu_threshold\": 70\n}");
  const [loggingConfig, setLoggingConfig] = useState<string>("{\n  \"log_level\": \"info\",\n  \"retention_days\": 30\n}");
  const [monitoringIntegration, setMonitoringIntegration] = useState<string>("{\n  \"metrics\": [\"cpu\", \"memory\", \"disk\"],\n  \"alert_threshold\": 80\n}");
  
  // Fetch environments from API
  const fetchEnvironments = async () => {
    if (!currentTenant) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const environments = await cmpService.getEnvironments(currentTenant.tenant_id);
      setEnvironments(environments);
      setFilteredEnvironments(environments);
    } catch (error) {
      console.error("Error fetching environments:", error);
      setError("Failed to load environments. Please try again.");
      
      if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error("Failed to load environments");
      }
    } finally {
      setIsLoading(false);
    }
  };
  
  // Fetch cloud accounts
  const fetchCloudAccounts = async () => {
    if (!currentTenant) return;
    
    try {
      const accounts = await cmpService.getCloudAccounts(currentTenant.tenant_id);
      setCloudAccounts(accounts);
    } catch (error) {
      console.error("Error fetching cloud accounts:", error);
      
      if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error("Failed to load cloud accounts");
      }
    }
  };
  
  useEffect(() => {
    if (currentTenant) {
      fetchEnvironments();
      fetchCloudAccounts();
    }
  }, [currentTenant]);
  
  useEffect(() => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const filtered = environments.filter(env => 
        env.name.toLowerCase().includes(query) || 
        (env.description && env.description.toLowerCase().includes(query))
      );
      setFilteredEnvironments(filtered);
    } else {
      setFilteredEnvironments(environments);
    }
  }, [searchQuery, environments]);
  
  const resetForm = () => {
    setNewEnvironmentName("");
    setNewEnvironmentDescription("");
    setUpdateStrategy("");
    setSelectedCloudAccounts([]);
    setEnvironmentVariables("{\n  \"KEY\": \"value\"\n}");
    setScalingPolicies("{\n  \"min_instances\": 1,\n  \"max_instances\": 5,\n  \"cpu_threshold\": 70\n}");
    setLoggingConfig("{\n  \"log_level\": \"info\",\n  \"retention_days\": 30\n}");
    setMonitoringIntegration("{\n  \"metrics\": [\"cpu\", \"memory\", \"disk\"],\n  \"alert_threshold\": 80\n}");
    setActiveTab("general");
  };
  
  const handleCreateEnvironment = async () => {
    if (!newEnvironmentName) {
      toast.error("Environment name is required");
      return;
    }
    
    // Make cloud account selection mandatory
    if (selectedCloudAccounts.length === 0) {
      toast.error("At least one cloud account must be selected");
      setActiveTab("cloud"); // Switch to cloud accounts tab
      return;
    }
    
    try {
      setIsLoading(true);
      
      // Parse JSON strings to objects
      let envVars, scaling, logging, monitoring;
      
      try {
        envVars = JSON.parse(environmentVariables);
        scaling = JSON.parse(scalingPolicies);
        logging = JSON.parse(loggingConfig);
        monitoring = JSON.parse(monitoringIntegration);
      } catch (e) {
        toast.error("Invalid JSON in one of the configuration fields");
        return;
      }
      
      // Get cloud account IDs from the selected accounts
      // Make sure we're using numeric IDs and filtering out any invalid values
      const cloudAccountIds = selectedCloudAccounts
        .map(id => {
          const account = cloudAccounts.find(acc => acc.id === id);
          if (!account) return null;
          
          // Try to parse the ID as an integer
          const numericId = parseInt(account.id);
          return isNaN(numericId) ? null : numericId;
        })
        .filter(id => id !== null) as number[];
      
      // Double-check that we have valid cloud account IDs
      if (cloudAccountIds.length === 0) {
        toast.error("No valid cloud accounts selected");
        setActiveTab("cloud");
        return;
      }
      
      // Create the new environment
      const newEnvironment = {
        name: newEnvironmentName,
        description: newEnvironmentDescription,
        update_strategy: updateStrategy,
        cloud_account_ids: cloudAccountIds,
        environment_variables: envVars,
        scaling_policies: scaling,
        logging_config: logging,
        monitoring_integration: monitoring
      };
      
      await cmpService.createEnvironment(newEnvironment, currentTenant!.tenant_id);
      
      // Refresh the list
      await fetchEnvironments();
      
      // Reset form and close dialog
      resetForm();
      setIsNewEnvironmentDialogOpen(false);
      
      toast.success("Environment created successfully");
    } catch (error) {
      console.error("Error creating environment:", error);
      
      if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error("Failed to create environment");
      }
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleDeleteEnvironment = async (environmentId: string) => {
    try {
      setIsLoading(true);
      
      // Delete the environment
      await cmpService.deleteEnvironment(environmentId);
      
      // Refresh the list
      await fetchEnvironments();
      
      toast.success("Environment deleted successfully");
    } catch (error) {
      console.error("Error deleting environment:", error);
      
      if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error("Failed to delete environment");
      }
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleRefresh = () => {
    fetchEnvironments();
    fetchCloudAccounts();
    toast.success("Refreshing environments...");
  };
  
  const toggleCloudAccount = (accountId: string) => {
    if (selectedCloudAccounts.includes(accountId)) {
      setSelectedCloudAccounts(selectedCloudAccounts.filter(id => id !== accountId));
    } else {
      setSelectedCloudAccounts([...selectedCloudAccounts, accountId]);
    }
  };
  
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Environments</h1>
          <p className="text-muted-foreground">
            Manage deployment environments for your infrastructure
          </p>
        </div>
        
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          
          <Dialog open={isNewEnvironmentDialogOpen} onOpenChange={(open) => {
            setIsNewEnvironmentDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New Environment
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px]">
              <DialogHeader>
                <DialogTitle>Create Environment</DialogTitle>
                <DialogDescription>
                  Add a new environment for your deployments
                </DialogDescription>
              </DialogHeader>
              
              <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
                <TabsList className="grid grid-cols-4 mb-4">
                  <TabsTrigger value="general">General</TabsTrigger>
                  <TabsTrigger value="cloud">Cloud Accounts *</TabsTrigger>
                  <TabsTrigger value="config">Configuration</TabsTrigger>
                  <TabsTrigger value="advanced">Advanced</TabsTrigger>
                </TabsList>
                
                <TabsContent value="general" className="space-y-4">
                  <div className="space-y-2">
                    <label htmlFor="name" className="text-sm font-medium">Environment Name</label>
                    <Input
                      id="name"
                      value={newEnvironmentName}
                      onChange={(e) => setNewEnvironmentName(e.target.value)}
                      placeholder="e.g., Production, Development, Testing"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <label htmlFor="description" className="text-sm font-medium">Description</label>
                    <Input
                      id="description"
                      value={newEnvironmentDescription}
                      onChange={(e) => setNewEnvironmentDescription(e.target.value)}
                      placeholder="Describe this environment"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <label htmlFor="update-strategy" className="text-sm font-medium">Update Strategy</label>
                    <Select value={updateStrategy} onValueChange={setUpdateStrategy}>
                      <SelectTrigger id="update-strategy">
                        <SelectValue placeholder="Select update strategy" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="rolling">Rolling Update</SelectItem>
                        <SelectItem value="blue-green">Blue-Green Deployment</SelectItem>
                        <SelectItem value="canary">Canary Deployment</SelectItem>
                        <SelectItem value="recreate">Recreate</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </TabsContent>
                
                <TabsContent value="cloud" className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Cloud Accounts <span className="text-red-500">*</span></label>
                    <p className="text-sm text-muted-foreground mb-2">
                      Select one or more cloud accounts to use with this environment. At least one cloud account is required.
                    </p>
                    
                    {cloudAccounts.length > 0 ? (
                      <div className="grid gap-2 max-h-[300px] overflow-y-auto">
                        {cloudAccounts.map((account) => (
                          <div 
                            key={account.id} 
                            className={`flex items-center justify-between p-3 rounded-md border cursor-pointer ${
                              selectedCloudAccounts.includes(account.id) ? 'bg-primary/10 border-primary' : ''
                            }`}
                            onClick={() => toggleCloudAccount(account.id)}
                          >
                            <div className="flex items-center gap-2">
                              <Server className="h-4 w-4" />
                              <div>
                                <p className="font-medium">{account.name}</p>
                                <p className="text-xs text-muted-foreground">{account.provider}</p>
                              </div>
                            </div>
                            <Badge variant={account.status === 'connected' ? 'success' : 'destructive'}>
                              {account.status}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-32 border rounded-md p-4">
                        <Server className="h-8 w-8 text-muted-foreground mb-2" />
                        <p className="text-sm text-muted-foreground">No cloud accounts available</p>
                        <p className="text-xs text-muted-foreground">Create a cloud account first</p>
                      </div>
                    )}
                  </div>
                </TabsContent>
                
                <TabsContent value="config" className="space-y-4">
                  <div className="space-y-2">
                    <label htmlFor="env-vars" className="text-sm font-medium">Environment Variables</label>
                    <p className="text-xs text-muted-foreground">Define environment variables as JSON</p>
                    <Textarea
                      id="env-vars"
                      value={environmentVariables}
                      onChange={(e) => setEnvironmentVariables(e.target.value)}
                      className="font-mono text-sm h-32"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <label htmlFor="scaling" className="text-sm font-medium">Scaling Policies</label>
                    <p className="text-xs text-muted-foreground">Define scaling rules as JSON</p>
                    <Textarea
                      id="scaling"
                      value={scalingPolicies}
                      onChange={(e) => setScalingPolicies(e.target.value)}
                      className="font-mono text-sm h-32"
                    />
                  </div>
                </TabsContent>
                
                <TabsContent value="advanced" className="space-y-4">
                  <div className="space-y-2">
                    <label htmlFor="logging" className="text-sm font-medium">Logging Configuration</label>
                    <p className="text-xs text-muted-foreground">Configure logging settings as JSON</p>
                    <Textarea
                      id="logging"
                      value={loggingConfig}
                      onChange={(e) => setLoggingConfig(e.target.value)}
                      className="font-mono text-sm h-32"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <label htmlFor="monitoring" className="text-sm font-medium">Monitoring Integration</label>
                    <p className="text-xs text-muted-foreground">Configure monitoring settings as JSON</p>
                    <Textarea
                      id="monitoring"
                      value={monitoringIntegration}
                      onChange={(e) => setMonitoringIntegration(e.target.value)}
                      className="font-mono text-sm h-32"
                    />
                  </div>
                </TabsContent>
              </Tabs>
              
              <DialogFooter className="mt-4">
                <Button variant="outline" onClick={() => setIsNewEnvironmentDialogOpen(false)}>Cancel</Button>
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
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>
      
      <div className="mt-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
            <span className="ml-2 text-muted-foreground">Loading environments...</span>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-64">
            <AlertCircle className="h-12 w-12 text-red-500" />
            <h2 className="mt-4 text-xl font-semibold">Error Loading Environments</h2>
            <p className="text-muted-foreground mt-2">{error}</p>
            <Button className="mt-4" onClick={fetchEnvironments}>
              Try Again
            </Button>
          </div>
        ) : filteredEnvironments.length > 0 ? (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Cloud Accounts</TableHead>
                  <TableHead>Update Strategy</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEnvironments.map((environment) => (
                  <TableRow key={environment.environment_id}>
                    <TableCell className="font-medium">{environment.name}</TableCell>
                    <TableCell>{environment.description || "No description"}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {environment.cloud_accounts.length > 0 ? (
                          environment.cloud_accounts.map((account, index) => (
                            <Badge key={index} variant="outline" className="mr-1">
                              {account.name}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-muted-foreground text-sm">None</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {environment.update_strategy ? (
                        <Badge variant="secondary">
                          {environment.update_strategy}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">Default</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => handleDeleteEnvironment(environment.environment_id)}>
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
            <Layers className="h-12 w-12 mx-auto text-muted-foreground" />
            <h2 className="mt-4 text-xl font-semibold">No Environments Found</h2>
            <p className="text-muted-foreground mt-2">
              {searchQuery 
                ? "No environments match your search criteria" 
                : "Create your first environment to start organizing your deployments"}
            </p>
            <Button className="mt-4" onClick={() => setIsNewEnvironmentDialogOpen(true)}>
              Create Environment
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Environments;
