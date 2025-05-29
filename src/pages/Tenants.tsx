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
  const [isCreatingTenant, setIsCreatingTenant] = useState(false);
  
  // State for the edit tenant dialog
  const [isEditTenantDialogOpen, setIsEditTenantDialogOpen] = useState(false);
  const [editTenantId, setEditTenantId] = useState("");
  const [editTenantName, setEditTenantName] = useState("");
  const [editTenantDescription, setEditTenantDescription] = useState("");
  const [isUpdatingTenant, setIsUpdatingTenant] = useState(false);
  
  // State for the delete tenant dialog
  const [isDeleteTenantDialogOpen, setIsDeleteTenantDialogOpen] = useState(false);
  const [deleteTenantId, setDeleteTenantId] = useState("");
  const [deleteTenantName, setDeleteTenantName] = useState("");
  const [isDeletingTenant, setIsDeletingTenant] = useState(false);
  
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
  
  const handleCreateTenant = async () => {
    if (!newTenantName.trim()) {
      toast.error("Tenant name is required");
      return;
    }
    
    setIsCreatingTenant(true);
    
    try {
      const newTenant = await cmpService.createTenant({
        name: newTenantName.trim(),
        description: newTenantDescription.trim() || undefined
      });
      
      setTenants([...tenants, newTenant]);
      setFilteredTenants([...filteredTenants, newTenant]);
      setNewTenantName("");
      setNewTenantDescription("");
      setIsNewTenantDialogOpen(false);
      toast.success(`Tenant "${newTenant.name}" created successfully`);
    } catch (error) {
      console.error("Error creating tenant:", error);
      if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error("Failed to create tenant");
      }
    } finally {
      setIsCreatingTenant(false);
    }
  };
  
  const handleEditTenant = async () => {
    if (!editTenantName.trim()) {
      toast.error("Tenant name is required");
      return;
    }
    
    setIsUpdatingTenant(true);
    
    try {
      const updatedTenant = await cmpService.updateTenant(editTenantId, {
        name: editTenantName.trim(),
        description: editTenantDescription.trim() || undefined
      });
      
      setTenants(tenants.map(tenant => 
        tenant.tenant_id === editTenantId ? updatedTenant : tenant
      ));
      setFilteredTenants(filteredTenants.map(tenant => 
        tenant.tenant_id === editTenantId ? updatedTenant : tenant
      ));
      setEditTenantName("");
      setEditTenantDescription("");
      setIsEditTenantDialogOpen(false);
      toast.success(`Tenant "${updatedTenant.name}" updated successfully`);
    } catch (error) {
      console.error("Error updating tenant:", error);
      if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error("Failed to update tenant");
      }
    } finally {
      setIsUpdatingTenant(false);
    }
  };
  
  const handleDeleteTenant = async () => {
    if (!deleteTenantId) {
      toast.error("No tenant selected for deletion");
      return;
    }
    
    setIsDeletingTenant(true);
    
    try {
      await cmpService.deleteTenant(deleteTenantId);
      
      setTenants(tenants.filter(tenant => tenant.tenant_id !== deleteTenantId));
      setFilteredTenants(filteredTenants.filter(tenant => tenant.tenant_id !== deleteTenantId));
      setDeleteTenantId("");
      setDeleteTenantName("");
      setIsDeleteTenantDialogOpen(false);
      toast.success(`Tenant "${deleteTenantName}" deleted successfully`);
    } catch (error) {
      console.error("Error deleting tenant:", error);
      if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error("Failed to delete tenant");
      }
    } finally {
      setIsDeletingTenant(false);
    }
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
                  <Button variant="outline" onClick={() => setIsNewTenantDialogOpen(false)} disabled={isCreatingTenant}>Cancel</Button>
                  <Button onClick={handleCreateTenant} disabled={isCreatingTenant}>
                    {isCreatingTenant ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      "Create Tenant"
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
          
          {canManageTenants && (
            <Dialog open={isEditTenantDialogOpen} onOpenChange={setIsEditTenantDialogOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Edit Tenant</DialogTitle>
                  <DialogDescription>
                    Update the details of an existing tenant organization
                  </DialogDescription>
                </DialogHeader>
                
                <div className="grid gap-4 py-4">
                  <div className="space-y-2">
                    <label htmlFor="name" className="text-sm font-medium">Tenant Name</label>
                    <Input
                      id="name"
                      value={editTenantName}
                      onChange={(e) => setEditTenantName(e.target.value)}
                      placeholder="e.g., Acme Corporation"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <label htmlFor="description" className="text-sm font-medium">Description</label>
                    <Input
                      id="description"
                      value={editTenantDescription}
                      onChange={(e) => setEditTenantDescription(e.target.value)}
                      placeholder="Describe this tenant"
                    />
                  </div>
                </div>
                
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsEditTenantDialogOpen(false)} disabled={isUpdatingTenant}>Cancel</Button>
                  <Button onClick={handleEditTenant} disabled={isUpdatingTenant}>
                    {isUpdatingTenant ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Updating...
                      </>
                    ) : (
                      "Update Tenant"
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
          
          {canManageTenants && (
            <Dialog open={isDeleteTenantDialogOpen} onOpenChange={setIsDeleteTenantDialogOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Delete Tenant</DialogTitle>
                  <DialogDescription>
                    Are you sure you want to delete this tenant organization?
                  </DialogDescription>
                </DialogHeader>
                
                <div className="grid gap-4 py-4">
                  <div className="space-y-2">
                    <label htmlFor="name" className="text-sm font-medium">Tenant Name</label>
                    <Input
                      id="name"
                      value={deleteTenantName}
                      readOnly
                      className="bg-muted"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <p className="text-sm">
                      Are you sure you want to delete the tenant <strong>"{deleteTenantName}"</strong>?
                      This action cannot be undone.
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Note: Tenants with associated users, cloud accounts, environments, templates, or deployments cannot be deleted.
                    </p>
                  </div>
                </div>
                
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsDeleteTenantDialogOpen(false)} disabled={isDeletingTenant}>Cancel</Button>
                  <Button onClick={handleDeleteTenant} disabled={isDeletingTenant}>
                    {isDeletingTenant ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Deleting...
                      </>
                    ) : (
                      "Delete Tenant"
                    )}
                  </Button>
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
                  <TableRow key={tenant.tenant_id}>
                    <TableCell className="font-medium">{tenant.name}</TableCell>
                    <TableCell>{tenant.description || "No description"}</TableCell>
                    <TableCell>{tenant.date_created ? new Date(tenant.date_created).toLocaleDateString() : "N/A"}</TableCell>
                    {canManageTenants && (
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => {
                          setDeleteTenantId(tenant.tenant_id);
                          setDeleteTenantName(tenant.name);
                          setIsDeleteTenantDialogOpen(true);
                        }}>
                          <Trash className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => {
                          setEditTenantId(tenant.tenant_id);
                          setEditTenantName(tenant.name);
                          setEditTenantDescription(tenant.description || "");
                          setIsEditTenantDialogOpen(true);
                        }}>
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
