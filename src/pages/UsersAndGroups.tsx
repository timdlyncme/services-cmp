
import React, { useState } from "react";
import { useAuth } from "@/context/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Search, Plus, User, Users, Edit, Trash, Check, X, Shield } from "lucide-react";
import { UserRole } from "@/types/auth";

interface AppUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  tenantIds: string[];
  permissions: string[];
  lastActive?: string;
  status: "active" | "inactive" | "pending";
  avatar?: string;
}

interface UserGroup {
  id: string;
  name: string;
  description: string;
  permissions: string[];
  userCount: number;
  tenantIds: string[];
}

// Sample permissions
const availablePermissions = [
  "view:catalog",
  "deploy:templates",
  "create:templates",
  "edit:templates",
  "delete:templates",
  "view:deployments",
  "manage:deployments",
  "view:settings",
  "manage:settings",
  "view:environments",
  "manage:environments",
];

// Mock data for users
const mockUsers: AppUser[] = [
  {
    id: "user-1",
    name: "Alex Johnson",
    email: "alex@example.com",
    role: "admin",
    tenantIds: ["tenant-1"],
    permissions: availablePermissions,
    lastActive: "2023-06-15T10:30:00Z",
    status: "active",
  },
  {
    id: "user-2",
    name: "Sam Taylor",
    email: "sam@example.com",
    role: "user",
    tenantIds: ["tenant-1"],
    permissions: ["view:catalog", "view:deployments", "deploy:templates"],
    lastActive: "2023-06-10T08:15:00Z",
    status: "active",
  },
  {
    id: "user-3",
    name: "Jamie Smith",
    email: "jamie@example.com",
    role: "user",
    tenantIds: ["tenant-1"],
    permissions: ["view:catalog", "view:deployments"],
    status: "pending",
  }
];

// Mock data for MSP users
const mockMSPUsers: AppUser[] = [
  {
    id: "msp-user-1",
    name: "Morgan Lee",
    email: "morgan@msp.com",
    role: "msp",
    tenantIds: ["tenant-1", "tenant-2", "tenant-3"],
    permissions: availablePermissions,
    lastActive: "2023-06-15T10:30:00Z",
    status: "active",
  },
  {
    id: "msp-user-2",
    name: "Taylor Reed",
    email: "taylor@msp.com",
    role: "msp",
    tenantIds: ["tenant-1", "tenant-2"],
    permissions: ["view:catalog", "view:deployments", "deploy:templates", "view:settings", "view:environments"],
    lastActive: "2023-06-14T09:20:00Z",
    status: "active",
  },
];

// Mock data for groups
const mockGroups: UserGroup[] = [
  {
    id: "group-1",
    name: "Administrators",
    description: "Full access to all tenant resources",
    permissions: availablePermissions,
    userCount: 1,
    tenantIds: ["tenant-1"]
  },
  {
    id: "group-2",
    name: "Developers",
    description: "Deploy and view resources",
    permissions: ["view:catalog", "deploy:templates", "view:deployments", "manage:deployments"],
    userCount: 2,
    tenantIds: ["tenant-1"]
  },
  {
    id: "group-3",
    name: "Viewers",
    description: "Read-only access",
    permissions: ["view:catalog", "view:deployments"],
    userCount: 3,
    tenantIds: ["tenant-1"]
  }
];

// Mock data for MSP groups
const mockMSPGroups: UserGroup[] = [
  {
    id: "msp-group-1",
    name: "MSP Administrators",
    description: "Full access across all tenants",
    permissions: availablePermissions,
    userCount: 1,
    tenantIds: ["tenant-1", "tenant-2", "tenant-3"]
  },
  {
    id: "msp-group-2",
    name: "Tenant Managers",
    description: "Manage specific tenants",
    permissions: ["view:catalog", "deploy:templates", "view:deployments", "manage:deployments", "view:settings"],
    userCount: 2,
    tenantIds: ["tenant-1", "tenant-2"]
  },
];

const UsersAndGroups = () => {
  const { user, tenants, currentTenant } = useAuth();
  const [activeTab, setActiveTab] = useState("users");
  const [searchTerm, setSearchTerm] = useState("");
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [isAddingGroup, setIsAddingGroup] = useState(false);
  
  // Use different data based on user role
  const isMSP = user?.role === "msp";
  const userData = isMSP ? mockMSPUsers : mockUsers;
  const groupData = isMSP ? mockMSPGroups : mockGroups;
  
  // Available tenants
  const availableTenants = isMSP ? tenants : (currentTenant ? [currentTenant] : []);
  
  // State for new user form
  const [newUser, setNewUser] = useState<Partial<AppUser>>({
    name: "",
    email: "",
    role: isMSP ? "msp" : "user",
    tenantIds: [],
    permissions: [],
    status: "pending",
  });
  
  // State for new group form
  const [newGroup, setNewGroup] = useState<Partial<UserGroup>>({
    name: "",
    description: "",
    permissions: [],
    tenantIds: [],
  });
  
  // Filter users/groups based on search term
  const filteredUsers = userData.filter(u => 
    u.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.email.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  const filteredGroups = groupData.filter(g => 
    g.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    g.description.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  // Toggle permission selection
  const togglePermission = (permission: string, target: "user" | "group") => {
    if (target === "user") {
      const permissions = newUser.permissions || [];
      if (permissions.includes(permission)) {
        setNewUser({
          ...newUser,
          permissions: permissions.filter(p => p !== permission)
        });
      } else {
        setNewUser({
          ...newUser,
          permissions: [...permissions, permission]
        });
      }
    } else {
      const permissions = newGroup.permissions || [];
      if (permissions.includes(permission)) {
        setNewGroup({
          ...newGroup,
          permissions: permissions.filter(p => p !== permission)
        });
      } else {
        setNewGroup({
          ...newGroup,
          permissions: [...permissions, permission]
        });
      }
    }
  };
  
  // Toggle tenant selection
  const toggleTenant = (tenantId: string, target: "user" | "group") => {
    if (target === "user") {
      const tenantIds = newUser.tenantIds || [];
      if (tenantIds.includes(tenantId)) {
        setNewUser({
          ...newUser,
          tenantIds: tenantIds.filter(id => id !== tenantId)
        });
      } else {
        setNewUser({
          ...newUser,
          tenantIds: [...tenantIds, tenantId]
        });
      }
    } else {
      const tenantIds = newGroup.tenantIds || [];
      if (tenantIds.includes(tenantId)) {
        setNewGroup({
          ...newGroup,
          tenantIds: tenantIds.filter(id => id !== tenantId)
        });
      } else {
        setNewGroup({
          ...newGroup,
          tenantIds: [...tenantIds, tenantId]
        });
      }
    }
  };
  
  // Submit handlers
  const handleAddUser = () => {
    // Validate form
    if (!newUser.name || !newUser.email || !newUser.role) {
      toast.error("Please fill in all required fields");
      return;
    }
    
    if (isMSP && (newUser.tenantIds || []).length === 0) {
      toast.error("Please select at least one tenant");
      return;
    }
    
    toast.success(`User ${newUser.name} added successfully`);
    setIsAddingUser(false);
    setNewUser({
      name: "",
      email: "",
      role: isMSP ? "msp" : "user",
      tenantIds: [],
      permissions: [],
      status: "pending",
    });
  };
  
  const handleAddGroup = () => {
    // Validate form
    if (!newGroup.name) {
      toast.error("Please provide a group name");
      return;
    }
    
    if (isMSP && (newGroup.tenantIds || []).length === 0) {
      toast.error("Please select at least one tenant");
      return;
    }
    
    toast.success(`Group ${newGroup.name} created successfully`);
    setIsAddingGroup(false);
    setNewGroup({
      name: "",
      description: "",
      permissions: [],
      tenantIds: [],
    });
  };
  
  // Delete handlers
  const handleDeleteUser = (userId: string) => {
    const user = userData.find(u => u.id === userId);
    if (user) {
      toast.success(`User ${user.name} deleted successfully`);
    }
  };
  
  const handleDeleteGroup = (groupId: string) => {
    const group = groupData.find(g => g.id === groupId);
    if (group) {
      toast.success(`Group ${group.name} deleted successfully`);
    }
  };
  
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{isMSP ? "MSP Users & Groups" : "Users & Groups"}</h1>
        <p className="text-muted-foreground">
          {isMSP 
            ? "Manage MSP users and groups across all tenants" 
            : "Manage users and groups for your tenant"}
        </p>
      </div>
      
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex justify-between items-center">
          <TabsList>
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="groups">Groups</TabsTrigger>
          </TabsList>
          
          <div className="flex gap-2">
            {activeTab === "users" ? (
              <Dialog open={isAddingUser} onOpenChange={setIsAddingUser}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Add User
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Add New User</DialogTitle>
                    <DialogDescription>
                      Create a new user and set their permissions
                    </DialogDescription>
                  </DialogHeader>
                  
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <label htmlFor="name" className="text-sm font-medium">Name</label>
                        <Input
                          id="name"
                          value={newUser.name}
                          onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                          placeholder="Full name"
                        />
                      </div>
                      <div className="space-y-2">
                        <label htmlFor="email" className="text-sm font-medium">Email</label>
                        <Input
                          id="email"
                          type="email"
                          value={newUser.email}
                          onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                          placeholder="Email address"
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Role</label>
                      <Select
                        value={newUser.role}
                        onValueChange={(value: UserRole) => setNewUser({ ...newUser, role: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select role" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="user">Regular User</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                          {isMSP && <SelectItem value="msp">MSP User</SelectItem>}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    {isMSP && (
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Assign to Tenants</label>
                        <div className="grid grid-cols-2 gap-2 border p-2 rounded-md">
                          {availableTenants.map((tenant) => (
                            <div key={tenant.id} className="flex items-center space-x-2">
                              <Checkbox
                                id={`tenant-${tenant.id}`}
                                checked={(newUser.tenantIds || []).includes(tenant.id)}
                                onCheckedChange={() => toggleTenant(tenant.id, "user")}
                              />
                              <label
                                htmlFor={`tenant-${tenant.id}`}
                                className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                              >
                                {tenant.name}
                              </label>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Permissions</label>
                      <ScrollArea className="h-[200px] border rounded-md p-2">
                        <div className="grid grid-cols-2 gap-2">
                          {availablePermissions.map((permission) => (
                            <div key={permission} className="flex items-center space-x-2">
                              <Checkbox
                                id={`permission-${permission}`}
                                checked={(newUser.permissions || []).includes(permission)}
                                onCheckedChange={() => togglePermission(permission, "user")}
                              />
                              <label
                                htmlFor={`permission-${permission}`}
                                className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                              >
                                {permission.replace(":", ": ")}
                              </label>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </div>
                  </div>
                  
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsAddingUser(false)}>Cancel</Button>
                    <Button onClick={handleAddUser}>Add User</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            ) : (
              <Dialog open={isAddingGroup} onOpenChange={setIsAddingGroup}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Group
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Create User Group</DialogTitle>
                    <DialogDescription>
                      Create a new group with defined permissions
                    </DialogDescription>
                  </DialogHeader>
                  
                  <div className="grid gap-4 py-4">
                    <div className="space-y-2">
                      <label htmlFor="group-name" className="text-sm font-medium">Group Name</label>
                      <Input
                        id="group-name"
                        value={newGroup.name}
                        onChange={(e) => setNewGroup({ ...newGroup, name: e.target.value })}
                        placeholder="Group name"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <label htmlFor="group-description" className="text-sm font-medium">Description</label>
                      <Input
                        id="group-description"
                        value={newGroup.description}
                        onChange={(e) => setNewGroup({ ...newGroup, description: e.target.value })}
                        placeholder="Describe the group's purpose"
                      />
                    </div>
                    
                    {isMSP && (
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Assign to Tenants</label>
                        <div className="grid grid-cols-2 gap-2 border p-2 rounded-md">
                          {availableTenants.map((tenant) => (
                            <div key={tenant.id} className="flex items-center space-x-2">
                              <Checkbox
                                id={`group-tenant-${tenant.id}`}
                                checked={(newGroup.tenantIds || []).includes(tenant.id)}
                                onCheckedChange={() => toggleTenant(tenant.id, "group")}
                              />
                              <label
                                htmlFor={`group-tenant-${tenant.id}`}
                                className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                              >
                                {tenant.name}
                              </label>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Group Permissions</label>
                      <ScrollArea className="h-[200px] border rounded-md p-2">
                        <div className="grid grid-cols-2 gap-2">
                          {availablePermissions.map((permission) => (
                            <div key={`group-${permission}`} className="flex items-center space-x-2">
                              <Checkbox
                                id={`group-permission-${permission}`}
                                checked={(newGroup.permissions || []).includes(permission)}
                                onCheckedChange={() => togglePermission(permission, "group")}
                              />
                              <label
                                htmlFor={`group-permission-${permission}`}
                                className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                              >
                                {permission.replace(":", ": ")}
                              </label>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </div>
                  </div>
                  
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsAddingGroup(false)}>Cancel</Button>
                    <Button onClick={handleAddGroup}>Create Group</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>
        
        <div className="mt-4 relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={`Search ${activeTab}...`}
            className="pl-8 mb-4"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <TabsContent value="users" className="mt-0">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    {isMSP && <TableHead>Tenants</TableHead>}
                    <TableHead>Permissions</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.length > 0 ? (
                    filteredUsers.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">{user.name}</TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>
                          <Badge variant={user.role === "admin" || user.role === "msp" ? "default" : "outline"}>
                            {user.role === "msp" ? "MSP" : user.role === "admin" ? "Admin" : "User"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant={
                              user.status === "active" ? "secondary" : 
                              user.status === "pending" ? "outline" : "destructive"
                            }
                          >
                            {user.status}
                          </Badge>
                        </TableCell>
                        {isMSP && (
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {user.tenantIds.length > 0 ? (
                                user.tenantIds.map((tenantId) => {
                                  const tenant = availableTenants.find(t => t.id === tenantId);
                                  return tenant ? (
                                    <Badge key={tenantId} variant="outline" className="text-xs">
                                      {tenant.name}
                                    </Badge>
                                  ) : null;
                                })
                              ) : (
                                <span className="text-muted-foreground text-sm">None</span>
                              )}
                            </div>
                          </TableCell>
                        )}
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {user.permissions.length > 3 ? (
                              <>
                                <Badge variant="outline" className="text-xs">
                                  {user.permissions.length} permissions
                                </Badge>
                              </>
                            ) : user.permissions.map((permission, idx) => (
                              <Badge key={idx} variant="outline" className="text-xs">
                                {permission}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button variant="ghost" size="icon">
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDeleteUser(user.id)}>
                              <Trash className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={isMSP ? 7 : 6} className="text-center h-24">
                        <User className="h-8 w-8 mx-auto text-muted-foreground" />
                        <p className="text-muted-foreground mt-2">No users found</p>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="groups" className="mt-0">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Group Name</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Users</TableHead>
                    {isMSP && <TableHead>Tenants</TableHead>}
                    <TableHead>Permissions</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredGroups.length > 0 ? (
                    filteredGroups.map((group) => (
                      <TableRow key={group.id}>
                        <TableCell className="font-medium">{group.name}</TableCell>
                        <TableCell>{group.description}</TableCell>
                        <TableCell>{group.userCount}</TableCell>
                        {isMSP && (
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {group.tenantIds.map((tenantId) => {
                                const tenant = availableTenants.find(t => t.id === tenantId);
                                return tenant ? (
                                  <Badge key={tenantId} variant="outline" className="text-xs">
                                    {tenant.name}
                                  </Badge>
                                ) : null;
                              })}
                            </div>
                          </TableCell>
                        )}
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {group.permissions.length} permissions
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button variant="ghost" size="icon">
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDeleteGroup(group.id)}>
                              <Trash className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={isMSP ? 6 : 5} className="text-center h-24">
                        <Users className="h-8 w-8 mx-auto text-muted-foreground" />
                        <p className="text-muted-foreground mt-2">No groups found</p>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default UsersAndGroups;
