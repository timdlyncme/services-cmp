import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/auth-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Users, 
  UserPlus, 
  Search,
  Plus,
  Settings,
  Eye,
  Mail,
  Shield
} from 'lucide-react';
import { toast } from 'sonner';

interface MSPUser {
  id: string;
  user_id: string;
  username: string;
  full_name: string;
  email: string;
  is_active: boolean;
  role: string;
  tenant_id: string;
  is_msp_user: boolean;
}

export function MSPUsers() {
  const { user, hasPermission } = useAuth();
  const [mspUsers, setMspUsers] = useState<MSPUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Check if user has permission to view MSP users
  if (!user?.isMspUser || !hasPermission('view:msp-users')) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <h2 className="text-lg font-semibold text-gray-900">Access Denied</h2>
          <p className="text-gray-600">You don't have permission to view MSP users.</p>
        </div>
      </div>
    );
  }

  useEffect(() => {
    fetchMSPUsers();
  }, []);

  const fetchMSPUsers = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      const response = await fetch('http://localhost:8000/api/msp/users', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch MSP users');
      }

      const data = await response.json();
      setMspUsers(data);
    } catch (error) {
      console.error('Error fetching MSP users:', error);
      toast.error('Failed to load MSP users');
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = mspUsers.filter(mspUser =>
    mspUser.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    mspUser.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    mspUser.username.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading MSP users...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">MSP Users</h1>
          <p className="text-gray-600">Manage MSP users with global platform access</p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Create MSP User
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total MSP Users</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{mspUsers.length}</div>
            <p className="text-xs text-muted-foreground">
              Users with global access
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {mspUsers.filter(u => u.is_active).length}
            </div>
            <p className="text-xs text-muted-foreground">
              Currently active MSP users
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Inactive Users</CardTitle>
            <UserPlus className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {mspUsers.filter(u => !u.is_active).length}
            </div>
            <p className="text-xs text-muted-foreground">
              Inactive MSP users
            </p>
          </CardContent>
        </Card>
      </div>

      {/* MSP Users Management */}
      <Card>
        <CardHeader>
          <CardTitle>MSP User Management</CardTitle>
          <CardDescription>
            Manage users with global platform access and MSP privileges
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-2 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search MSP users..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>

          {/* Users Table */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((mspUser) => (
                  <TableRow key={mspUser.id}>
                    <TableCell>
                      <div className="flex items-center space-x-3">
                        <div className="flex-shrink-0">
                          <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center">
                            <Users className="h-4 w-4 text-gray-600" />
                          </div>
                        </div>
                        <div>
                          <div className="font-medium">{mspUser.full_name}</div>
                          <div className="text-sm text-muted-foreground">
                            @{mspUser.username}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center">
                        <Mail className="h-4 w-4 mr-2 text-muted-foreground" />
                        {mspUser.email}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="default" className="bg-purple-100 text-purple-800">
                        <Shield className="h-3 w-3 mr-1" />
                        {mspUser.role.toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={mspUser.is_active ? "default" : "secondary"}>
                        {mspUser.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <Button variant="ghost" size="sm">
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm">
                          <Settings className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {filteredUsers.length === 0 && (
            <div className="text-center py-8">
              <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No MSP users found</h3>
              <p className="text-gray-600">
                {searchTerm ? 'No MSP users match your search criteria.' : 'No MSP users have been created yet.'}
              </p>
              {!searchTerm && (
                <Button className="mt-4">
                  <Plus className="h-4 w-4 mr-2" />
                  Create First MSP User
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

