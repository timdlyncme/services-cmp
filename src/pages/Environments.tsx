import { useState, useEffect } from "react";
import { useAuth } from "@/context/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Search, Plus, Edit, Trash, RefreshCw, AlertCircle, Layers } from "lucide-react";
import { cmpService } from "@/services/cmp-service";

interface Environment {
  id: string;
  environment_id: string;
  name: string;
  description: string;
  tenant_id: string;  // Changed from number to string
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
  
  useEffect(() => {
    if (currentTenant) {
      fetchEnvironments();
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
  
  const handleCreateEnvironment = async () => {
    if (!newEnvironmentName) {
      toast.error("Environment name is required");
      return;
    }
    
    try {
      setIsLoading(true);
      
      // Create the new environment
      const newEnvironment = {
        name: newEnvironmentName,
        description: newEnvironmentDescription
      };
      
      await cmpService.createEnvironment(newEnvironment, currentTenant!.tenant_id);
      
      // Refresh the list
      await fetchEnvironments();
      
      // Reset form and close dialog
      setNewEnvironmentName("");
      setNewEnvironmentDescription("");
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
    toast.success("Refreshing environments...");
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
          
          <Dialog open={isNewEnvironmentDialogOpen} onOpenChange={setIsNewEnvironmentDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New Environment
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Environment</DialogTitle>
                <DialogDescription>
                  Add a new environment for your deployments
                </DialogDescription>
              </DialogHeader>
              
              <div className="grid gap-4 py-4">
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
              </div>
              
              <DialogFooter>
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
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEnvironments.map((environment) => (
                  <TableRow key={environment.environment_id}>
                    <TableCell className="font-medium">{environment.name}</TableCell>
                    <TableCell>{environment.description || "No description"}</TableCell>
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
