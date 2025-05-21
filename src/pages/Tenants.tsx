import { useState, useEffect } from "react";
import { useAuth } from "@/context/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Search, Plus, Edit, Trash, RefreshCw, AlertCircle, Building } from "lucide-react";
import { Tenant } from "@/types/auth";
import { cmpService } from "@/services/cmp-service";

const Tenants = () => {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [filteredTenants, setFilteredTenants] = useState<Tenant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // State for the new tenant dialog
  const [isNewTenantDialogOpen, setIsNewTenantDialogOpen] = useState(false);
  const [newTenantName, setNewTenantName] = useState("");
  const [newTenantDescription, setNewTenantDescription] = useState("");
  
  // Check if user is MSP or admin
  const canManageTenants = user?.role === "msp" || user?.role === "admin";
  
  // Fetch tenants from API
  const fetchTenants = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const tenants = await cmpService.getTenants();
      setTenants(tenants);
      setFilteredTenants(tenants);
    } catch (error) {
      console.error("Error fetching tenants:", error);
      setError("Failed to load tenants. Please try again.");
      
      if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error("Failed to load tenants");
      }
    } finally {
      setIsLoading(false);
    }
  };
  
  useEffect(() => {
    fetchTenants();
  }, []);
  
  useEffect(() => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const filtered = tenants.filter(tenant => 
        tenant.name.toLowerCase().includes(query) || 
        (tenant.description && tenant.description.toLowerCase().includes(query))
      );
      setFilteredTenants(filtered);
    } else {
      setFilteredTenants(tenants);
    }
  }, [searchQuery, tenants]);
  
  const handleRefresh = () => {
    fetchTenants();
    toast.success("Refreshing tenants...");
  };
  
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Tenants</h1>
          <p className="text-muted-foreground">
            Manage tenant organizations in your cloud management platform
          </p>
        </div>
        
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          
          {canManageTenants && (
            <Dialog open={isNewTenantDialogOpen} onOpenChange={setIsNewTenantDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  New Tenant
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Tenant</DialogTitle>
                  <DialogDescription>
                    Add a new tenant organization to the platform
                  </DialogDescription>
                </DialogHeader>
                
                <div className="grid gap-4 py-4">
                  <div className="space-y-2">
                    <label htmlFor="name" className="text-sm font-medium">Tenant Name</label>
                    <Input
                      id="name"
                      value={newTenantName}
                      onChange={(e) => setNewTenantName(e.target.value)}
                      placeholder="e.g., Acme Corporation"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <label htmlFor="description" className="text-sm font-medium">Description</label>
                    <Input
                      id="description"
                      value={newTenantDescription}
                      onChange={(e) => setNewTenantDescription(e.target.value)}
                      placeholder="Describe this tenant"
                    />
                  </div>
                </div>
                
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsNewTenantDialogOpen(false)}>Cancel</Button>
                  <Button onClick={() => {
                    toast.success("This functionality would create a new tenant in a real implementation");
                    setIsNewTenantDialogOpen(false);
                  }}>Create Tenant</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>
      
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search tenants..."
          className="pl-8 mb-4"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>
      
      <div className="mt-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
            <span className="ml-2 text-muted-foreground">Loading tenants...</span>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-64">
            <AlertCircle className="h-12 w-12 text-red-500" />
            <h2 className="mt-4 text-xl font-semibold">Error Loading Tenants</h2>
            <p className="text-muted-foreground mt-2">{error}</p>
            <Button className="mt-4" onClick={fetchTenants}>
              Try Again
            </Button>
          </div>
        ) : filteredTenants.length > 0 ? (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Created</TableHead>
                  {canManageTenants && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTenants.map((tenant) => (
                  <TableRow key={tenant.id}>
                    <TableCell className="font-medium">{tenant.name}</TableCell>
                    <TableCell>{tenant.description || "No description"}</TableCell>
                    <TableCell>{new Date(tenant.createdAt).toLocaleDateString()}</TableCell>
                    {canManageTenants && (
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => toast.info("Delete tenant functionality would be implemented here")}>
                          <Trash className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => toast.info("Edit tenant functionality would be implemented here")}>
                          <Edit className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-64 border rounded-md p-8">
            <Building className="h-12 w-12 mx-auto text-muted-foreground" />
            <h2 className="mt-4 text-xl font-semibold">No Tenants Found</h2>
            <p className="text-muted-foreground mt-2">
              {searchQuery 
                ? "No tenants match your search criteria" 
                : canManageTenants 
                  ? "Create your first tenant to start organizing your resources" 
                  : "No tenants are available for your account"}
            </p>
            {canManageTenants && (
              <Button className="mt-4" onClick={() => setIsNewTenantDialogOpen(true)}>
                Create Tenant
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Tenants;
