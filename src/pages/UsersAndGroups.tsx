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

// Data mapping utilities
const mapBackendUserToFrontend = (backendUser: any): User => {
  return {
    id: backendUser.user_id || backendUser.id,
    full_name: backendUser.full_name || backendUser.name || '',
    email: backendUser.email,
    role: backendUser.role,
    tenantId: backendUser.tenant_id,
    avatar: undefined,
    permissions: undefined
  };
};

const mapFrontendUserToBackend = (frontendUser: any) => {
  return {
    username: frontendUser.username || frontendUser.email?.split('@')[0] || '',
    full_name: frontendUser.full_name || frontendUser.name || '',
    email: frontendUser.email,
    role: frontendUser.role,
    password: frontendUser.password,
    is_active: frontendUser.is_active !== undefined ? frontendUser.is_active : true
  };
};

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
  const [newUserPassword, setNewUserPassword] = useState("");
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  
  // State for the edit user dialog
  const [isEditUserDialogOpen, setIsEditUserDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editUserName, setEditUserName] = useState("");
  const [editUserEmail, setEditUserEmail] = useState("");
  const [editUserRole, setEditUserRole] = useState("user");
  const [editUserActive, setEditUserActive] = useState(true);
  const [isUpdatingUser, setIsUpdatingUser] = useState(false);
  
  // State for delete confirmation
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [isDeletingUser, setIsDeletingUser] = useState(false);
  
  // Check if user is admin or msp
  const canManageUsers = user?.role === "admin" || user?.role === "msp";
  
  // Fetch users from API
  const fetchUsers = async () => {
    if (!currentTenant) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const backendUsers = await cmpService.getUsers(currentTenant.tenant_id);
      const mappedUsers = backendUsers.map(mapBackendUserToFrontend);
      setUsers(mappedUsers);
      setFilteredUsers(mappedUsers);
    } catch (error) {
      console.error("Error fetching users:", error);
      setError("Failed to load users. Please try again.");
      
      if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error("Failed to load users");
      }
    } finally {
      setIsLoading(false);
    }
  };
  
  useEffect(() => {
    if (currentTenant) {
      fetchUsers();
    }
  }, [currentTenant]);
  
  useEffect(() => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const filtered = users.filter(user => 
        user.full_name.toLowerCase().includes(query) || 
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
  
  const handleCreateUser = async () => {
    if (!currentTenant) return;
    
    // Validation
    if (!newUserName.trim() || !newUserEmail.trim() || !newUserPassword.trim()) {
      toast.error("Please fill in all required fields");
      return;
    }
    
    setIsCreatingUser(true);
    
    try {
      const userData = mapFrontendUserToBackend({
        full_name: newUserName,
        email: newUserEmail,
        role: newUserRole,
        password: newUserPassword
      });
      
      await cmpService.createUser(userData, currentTenant.tenant_id);
      
      // Reset form
      setNewUserName("");
      setNewUserEmail("");
      setNewUserRole("user");
      setNewUserPassword("");
      setIsNewUserDialogOpen(false);
      
      // Refresh users list
      await fetchUsers();
      
      toast.success("User created successfully");
    } catch (error) {
      console.error("Error creating user:", error);
      if (error instanceof Error) {
        toast.error(`Failed to create user: ${error.message}`);
      } else {
        toast.error("Failed to create user");
      }
    } finally {
      setIsCreatingUser(false);
    }
  };
  
  const handleEditUser = (userToEdit: User) => {
    setEditingUser(userToEdit);
    setEditUserName(userToEdit.full_name);
    setEditUserEmail(userToEdit.email);
    setEditUserRole(userToEdit.role);
    setEditUserActive(true); // Default to active since we don't have this field in the current User type
    setIsEditUserDialogOpen(true);
  };
  
  const handleUpdateUser = async () => {
    if (!editingUser) return;
    
    // Validation
    if (!editUserName.trim() || !editUserEmail.trim()) {
      toast.error("Please fill in all required fields");
      return;
    }
    
    setIsUpdatingUser(true);
    
    try {
      const updateData = {
        full_name: editUserName,
        email: editUserEmail,
        role: editUserRole,
        is_active: editUserActive
      };
      
      await cmpService.updateUser(editingUser.id, updateData);
      
      // Reset form
      setEditingUser(null);
      setEditUserName("");
      setEditUserEmail("");
      setEditUserRole("user");
      setEditUserActive(true);
      setIsEditUserDialogOpen(false);
      
      // Refresh users list
      await fetchUsers();
      
      toast.success("User updated successfully");
    } catch (error) {
      console.error("Error updating user:", error);
      if (error instanceof Error) {
        toast.error(`Failed to update user: ${error.message}`);
      } else {
        toast.error("Failed to update user");
      }
    } finally {
      setIsUpdatingUser(false);
    }
  };
  
  const handleDeleteUser = (userToDelete: User) => {
    setUserToDelete(userToDelete);
    setIsDeleteDialogOpen(true);
  };
  
  const confirmDeleteUser = async () => {
    if (!userToDelete) return;
    
    setIsDeletingUser(true);
    
    try {
      await cmpService.deleteUser(userToDelete.id);
      
      // Reset state
      setUserToDelete(null);
      setIsDeleteDialogOpen(false);
      
      // Refresh users list
      await fetchUsers();
      
      toast.success("User deleted successfully");
    } catch (error) {
      console.error("Error deleting user:", error);
      if (error instanceof Error) {
        toast.error(`Failed to delete user: ${error.message}`);
      } else {
        toast.error("Failed to delete user");
      }
    } finally {
      setIsDeletingUser(false);
    }
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
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create User</DialogTitle>
                  <DialogDescription>
                    Add a new user to your organization
                  </DialogDescription>
                </DialogHeader>
                
                <div className="grid gap-4 py-4">
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
                  
                  <div className="space-y-2">
                    <label htmlFor="role" className="text-sm font-medium">Role</label>
                    <select
                      id="role"
                      value={newUserRole}
                      onChange={(e) => setNewUserRole(e.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <option value="user">User</option>
                      <option value="admin">Admin</option>
                      {user?.role === "msp" && <option value="msp">MSP</option>}
                    </select>
                  </div>
                  
                  <div className="space-y-2">
                    <label htmlFor="password" className="text-sm font-medium">Password</label>
                    <Input
                      id="password"
                      type="password"
                      value={newUserPassword}
                      onChange={(e) => setNewUserPassword(e.target.value)}
                      placeholder="Enter a password"
                    />
                  </div>
                </div>
                
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsNewUserDialogOpen(false)}>Cancel</Button>
                  <Button onClick={handleCreateUser} disabled={isCreatingUser}>
                    {isCreatingUser ? "Creating..." : "Create User"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>
      
      {/* Edit User Dialog */}
      <Dialog open={isEditUserDialogOpen} onOpenChange={setIsEditUserDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>
              Update user information
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <label htmlFor="edit-name" className="text-sm font-medium">Name</label>
              <Input
                id="edit-name"
                value={editUserName}
                onChange={(e) => setEditUserName(e.target.value)}
                placeholder="e.g., John Doe"
              />
            </div>
            
            <div className="space-y-2">
              <label htmlFor="edit-email" className="text-sm font-medium">Email</label>
              <Input
                id="edit-email"
                type="email"
                value={editUserEmail}
                onChange={(e) => setEditUserEmail(e.target.value)}
                placeholder="e.g., john.doe@example.com"
              />
            </div>
            
            <div className="space-y-2">
              <label htmlFor="edit-role" className="text-sm font-medium">Role</label>
              <select
                id="edit-role"
                value={editUserRole}
                onChange={(e) => setEditUserRole(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="user">User</option>
                <option value="admin">Admin</option>
                {user?.role === "msp" && <option value="msp">MSP</option>}
              </select>
            </div>
            
            <div className="flex items-center space-x-2">
              <input
                id="edit-active"
                type="checkbox"
                checked={editUserActive}
                onChange={(e) => setEditUserActive(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300"
              />
              <label htmlFor="edit-active" className="text-sm font-medium">Active</label>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditUserDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleUpdateUser} disabled={isUpdatingUser}>
              {isUpdatingUser ? "Updating..." : "Update User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete User</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {userToDelete?.full_name}? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDeleteUser} disabled={isDeletingUser}>
              {isDeletingUser ? "Deleting..." : "Delete User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
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
                      <TableCell className="font-medium">{user.full_name}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>{getRoleBadge(user.role)}</TableCell>
                      {canManageUsers && (
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" onClick={() => handleDeleteUser(user)}>
                            <Trash className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleEditUser(user)}>
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
