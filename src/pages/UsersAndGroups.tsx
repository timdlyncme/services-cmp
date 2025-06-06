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
import { Search, Plus, Edit, Trash, RefreshCw, AlertCircle, Users, UserPlus, UserCog } from "lucide-react";
import { User } from "@/types/auth";
import { cmpService } from "@/services/cmp-service";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { API_BASE_URL } from "@/config/api";

const UsersAndGroups = () => {
  const { currentTenant, user } = useAuth();
  const [activeTab, setActiveTab] = useState("users");
  const [searchQuery, setSearchQuery] = useState("");
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // State for the new user dialog
  const [isNewUserDialogOpen, setIsNewUserDialogOpen] = useState(false);
  const [newUserName, setNewUserName] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserRole, setNewUserRole] = useState("user");
  
  // State for permissions and SSO
  const [availablePermissions, setAvailablePermissions] = useState<any[]>([]);
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [isLoadingPermissions, setIsLoadingPermissions] = useState(false);
  const [ssoProviders, setSsoProviders] = useState<any[]>([]);
  const [selectedSsoProvider, setSelectedSsoProvider] = useState("none");
  const [ssoUserId, setSsoUserId] = useState("");
  const [ssoEmail, setSsoEmail] = useState("");
  const [isEditingUser, setIsEditingUser] = useState(false);
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  
  // Check if user is admin or msp
  const canManageUsers = user?.role === "admin" || user?.role === "msp";
  
  // Fetch users from API
  const fetchUsers = async () => {
    if (!currentTenant) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const users = await cmpService.getUsers(currentTenant.tenant_id);
      setUsers(users);
      setFilteredUsers(users);
    } catch (error) {
      console.error("Error fetching users:", error);
      setError("Failed to load users. Please try again.");
      
      if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error("An unexpected error occurred");
      }
    } finally {
      setIsLoading(false);
    }
  };
  
  // Fetch available permissions
  const fetchPermissions = async () => {
    if (!currentTenant) return;
    
    setIsLoadingPermissions(true);
    
    try {
      const response = await fetch(`${API_BASE_URL}/permissions/?tenant_id=${currentTenant.tenant_id}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch permissions');
      }
      
      const permissions = await response.json();
      setAvailablePermissions(permissions);
    } catch (error) {
      console.error("Error fetching permissions:", error);
      toast.error("Failed to load permissions");
    } finally {
      setIsLoadingPermissions(false);
    }
  };
  
  // Fetch SSO providers
  const fetchSsoProviders = async () => {
    if (!currentTenant) return;
    
    try {
      const response = await fetch(`${API_BASE_URL}/sso/providers?tenant_id=${currentTenant.tenant_id}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch SSO providers');
      }
      
      const providers = await response.json();
      setSsoProviders(providers);
    } catch (error) {
      console.error("Error fetching SSO providers:", error);
      toast.error("Failed to load SSO providers");
    }
  };
  
  useEffect(() => {
    if (currentTenant) {
      fetchUsers();
      fetchPermissions();
      fetchSsoProviders();
    }
  }, [currentTenant]);
  
  useEffect(() => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const filtered = users.filter(user => 
        user.name.toLowerCase().includes(query) || 
        user.email.toLowerCase().includes(query) ||
        user.role.toLowerCase().includes(query)
      );
      setFilteredUsers(filtered);
    } else {
      setFilteredUsers(users);
    }
  }, [searchQuery, users]);
  
  const handleRefresh = () => {
    fetchUsers();
    toast.success("Refreshing users...");
  };
  
  const getRoleBadge = (role: string) => {
    switch (role) {
      case "admin":
        return <Badge className="bg-red-500 text-white">Admin</Badge>;
      case "msp":
        return <Badge className="bg-purple-500 text-white">MSP</Badge>;
      default:
        return <Badge variant="outline">User</Badge>;
    }
  };
  
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Users & Groups</h1>
          <p className="text-muted-foreground">
            Manage users and groups in your organization
          </p>
        </div>
        
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          
          {canManageUsers && (
            <Dialog open={isNewUserDialogOpen} onOpenChange={setIsNewUserDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <UserPlus className="h-4 w-4 mr-2" />
                  New User
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Create User</DialogTitle>
                  <DialogDescription>
                    Add a new user to your organization with specific role and permissions
                  </DialogDescription>
                </DialogHeader>
                
                <div className="grid gap-6 py-4">
                  {/* Basic User Information */}
                  <div className="space-y-4">
                    <h4 className="text-sm font-medium">Basic Information</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label htmlFor="name" className="text-sm font-medium">Name</label>
                        <Input
                          id="name"
                          value={newUserName}
                          onChange={(e) => setNewUserName(e.target.value)}
                          placeholder="e.g., John Doe"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <label htmlFor="email" className="text-sm font-medium">Email</label>
                        <Input
                          id="email"
                          type="email"
                          value={newUserEmail}
                          onChange={(e) => setNewUserEmail(e.target.value)}
                          placeholder="e.g., john.doe@example.com"
                        />
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Role Selection */}
                  <div className="space-y-4">
                    <h4 className="text-sm font-medium">Role Assignment</h4>
                    <div className="space-y-2">
                      <label htmlFor="role" className="text-sm font-medium">Primary Role</label>
                      <Select value={newUserRole} onValueChange={setNewUserRole}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a role" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="user">User</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                          {user?.role === "msp" && <SelectItem value="msp">MSP</SelectItem>}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <Separator />

                  {/* Individual Permissions */}
                  <div className="space-y-4">
                    <h4 className="text-sm font-medium">Individual Permissions</h4>
                    <p className="text-sm text-muted-foreground">
                      Select additional permissions beyond the base role permissions
                    </p>
                    {isLoadingPermissions ? (
                      <div className="flex items-center space-x-2">
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        <span className="text-sm">Loading permissions...</span>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-40 overflow-y-auto border rounded-md p-3">
                        {availablePermissions.map((permission) => (
                          <div key={permission.name} className="flex items-center space-x-2">
                            <Checkbox
                              id={`perm-${permission.name}`}
                              checked={selectedPermissions.includes(permission.name)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setSelectedPermissions([...selectedPermissions, permission.name]);
                                } else {
                                  setSelectedPermissions(selectedPermissions.filter(p => p !== permission.name));
                                }
                              }}
                            />
                            <Label htmlFor={`perm-${permission.name}`} className="text-sm">
                              {permission.description || permission.name}
                            </Label>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <Separator />

                  {/* SSO Configuration */}
                  <div className="space-y-4">
                    <h4 className="text-sm font-medium">SSO Configuration (Optional)</h4>
                    <p className="text-sm text-muted-foreground">
                      Link this user to an SSO provider for single sign-on access
                    </p>
                    
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label htmlFor="sso-provider" className="text-sm font-medium">SSO Provider</label>
                        <Select value={selectedSsoProvider} onValueChange={setSelectedSsoProvider}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select SSO provider (optional)" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">No SSO Provider</SelectItem>
                            {ssoProviders.map((provider) => (
                              <SelectItem key={provider.id} value={provider.id.toString()}>
                                {provider.name} ({provider.provider_type})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {selectedSsoProvider && selectedSsoProvider !== "none" && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <label htmlFor="sso-user-id" className="text-sm font-medium">SSO User ID</label>
                            <Input
                              id="sso-user-id"
                              value={ssoUserId}
                              onChange={(e) => setSsoUserId(e.target.value)}
                              placeholder="e.g., user@domain.com"
                            />
                          </div>
                          
                          <div className="space-y-2">
                            <label htmlFor="sso-email" className="text-sm font-medium">SSO Email</label>
                            <Input
                              id="sso-email"
                              type="email"
                              value={ssoEmail}
                              onChange={(e) => setSsoEmail(e.target.value)}
                              placeholder="e.g., user@domain.com"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                
                <DialogFooter>
                  <Button variant="outline" onClick={() => {
                    setIsNewUserDialogOpen(false);
                    // Reset form
                    setNewUserName("");
                    setNewUserEmail("");
                    setNewUserRole("user");
                    setSelectedPermissions([]);
                    setSelectedSsoProvider("none");
                    setSsoUserId("");
                    setSsoEmail("");
                  }}>Cancel</Button>
                  <Button onClick={() => {
                    toast.success("User creation functionality would be implemented here with the selected permissions and SSO settings");
                    setIsNewUserDialogOpen(false);
                  }}>Create User</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>
      
      <Tabs defaultValue="users" onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="groups">Groups</TabsTrigger>
        </TabsList>
        
        <TabsContent value="users" className="mt-6">
          <div className="relative mb-4">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search users..."
              className="pl-8"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">Loading users...</span>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-64">
              <AlertCircle className="h-12 w-12 text-red-500" />
              <h2 className="mt-4 text-xl font-semibold">Error Loading Users</h2>
              <p className="text-muted-foreground mt-2">{error}</p>
              <Button className="mt-4" onClick={fetchUsers}>
                Try Again
              </Button>
            </div>
          ) : filteredUsers.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    {canManageUsers && <TableHead className="text-right">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.name}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>{getRoleBadge(user.role)}</TableCell>
                      {canManageUsers && (
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" onClick={() => toast.info("Delete user functionality would be implemented here")}>
                            <Trash className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => toast.info("Edit user functionality would be implemented here")}>
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
              <Users className="h-12 w-12 mx-auto text-muted-foreground" />
              <h2 className="mt-4 text-xl font-semibold">No Users Found</h2>
              <p className="text-muted-foreground mt-2">
                {searchQuery 
                  ? "No users match your search criteria" 
                  : canManageUsers 
                    ? "Create your first user to start managing your organization" 
                    : "No users are available for your account"}
              </p>
              {canManageUsers && (
                <Button className="mt-4" onClick={() => setIsNewUserDialogOpen(true)}>
                  Create User
                </Button>
              )}
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="groups" className="mt-6">
          <div className="flex flex-col items-center justify-center h-64 border rounded-md p-8">
            <UserCog className="h-12 w-12 mx-auto text-muted-foreground" />
            <h2 className="mt-4 text-xl font-semibold">Groups Management</h2>
            <p className="text-muted-foreground mt-2">
              Group management functionality will be implemented in a future update
            </p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default UsersAndGroups;
