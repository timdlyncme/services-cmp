
import { useState, useEffect } from "react";
import { useAuth } from "@/context/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Search, MoreVertical, Users, Plus } from "lucide-react";
import { Tenant } from "@/types/auth";
import { toast } from "sonner";

const Tenants = () => {
  const { user } = useAuth();
  const [tenants, setTenants] = useState<Tenant[]>([
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
      name: "Marketing",
      description: "Marketing department",
      createdAt: "2023-03-10T14:45:00Z",
    },
    {
      id: "tenant-4",
      name: "Finance",
      description: "Finance department",
      createdAt: "2023-04-05T11:20:00Z",
    }
  ]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredTenants, setFilteredTenants] = useState<Tenant[]>([]);
  const [newTenantName, setNewTenantName] = useState("");
  const [newTenantDesc, setNewTenantDesc] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  
  // Ensure only MSP users can access this page
  useEffect(() => {
    if (user && user.role !== "msp") {
      toast.error("You don't have permission to access this page");
    }
  }, [user]);
  
  useEffect(() => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const filtered = tenants.filter(
        tenant =>
          tenant.name.toLowerCase().includes(query) ||
          (tenant.description && tenant.description.toLowerCase().includes(query))
      );
      setFilteredTenants(filtered);
    } else {
      setFilteredTenants(tenants);
    }
  }, [searchQuery, tenants]);
  
  const handleCreateTenant = () => {
    if (!newTenantName.trim()) {
      toast.error("Tenant name is required");
      return;
    }
    
    // Create new tenant
    const newTenant: Tenant = {
      id: `tenant-${Date.now()}`,
      name: newTenantName,
      description: newTenantDesc,
      createdAt: new Date().toISOString(),
    };
    
    setTenants([...tenants, newTenant]);
    setNewTenantName("");
    setNewTenantDesc("");
    setDialogOpen(false);
    toast.success(`Tenant "${newTenantName}" created successfully`);
  };
  
  const handleImpersonateTenant = (tenantId: string) => {
    toast.success(`Switching to tenant ${tenantId}`);
    // In a real app, this would switch the current tenant
  };
  
  const handleDeleteTenant = (tenantId: string, tenantName: string) => {
    setTenants(tenants.filter(t => t.id !== tenantId));
    toast.success(`Tenant "${tenantName}" deleted successfully`);
  };
  
  // Return early if not an MSP user
  if (user && user.role !== "msp") {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <div className="text-center">
          <h2 className="text-xl font-semibold">Access Denied</h2>
          <p className="text-muted-foreground">
            You don't have permission to access this page
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Tenants</h1>
          <p className="text-muted-foreground">
            Manage and access customer tenants
          </p>
        </div>
        
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Tenant
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Tenant</DialogTitle>
              <DialogDescription>
                Add a new customer tenant to the platform
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="tenantName">Tenant Name</Label>
                <Input
                  id="tenantName"
                  placeholder="Enter tenant name"
                  value={newTenantName}
                  onChange={(e) => setNewTenantName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  placeholder="Enter a description"
                  value={newTenantDesc}
                  onChange={(e) => setNewTenantDesc(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateTenant}>
                Create Tenant
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      
      <div className="flex items-center">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search tenants..."
            className="pl-8"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Users className="mr-2 h-5 w-5" />
            Customer Tenants
          </CardTitle>
          <CardDescription>
            Access and manage customer tenants
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTenants.length > 0 ? (
                filteredTenants.map((tenant) => (
                  <TableRow key={tenant.id}>
                    <TableCell className="font-medium">{tenant.name}</TableCell>
                    <TableCell>{tenant.description}</TableCell>
                    <TableCell>
                      {new Date(tenant.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem 
                            onClick={() => handleImpersonateTenant(tenant.id)}
                          >
                            Access Tenant
                          </DropdownMenuItem>
                          <DropdownMenuItem>Edit Details</DropdownMenuItem>
                          <DropdownMenuItem 
                            className="text-destructive focus:text-destructive"
                            onClick={() => handleDeleteTenant(tenant.id, tenant.name)}
                          >
                            Delete Tenant
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center">
                    <div className="flex flex-col items-center justify-center text-muted-foreground">
                      <Users className="h-8 w-8 mb-2" />
                      <p>No tenants found</p>
                      {searchQuery && (
                        <p className="text-sm">
                          Try adjusting your search query
                        </p>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
        <CardFooter>
          <p className="text-sm text-muted-foreground">
            Total tenants: {filteredTenants.length}
          </p>
        </CardFooter>
      </Card>
    </div>
  );
};

export default Tenants;
