import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/auth-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
  Building, 
  Shield,
  Activity,
  TrendingUp,
  BarChart3
} from 'lucide-react';
import { toast } from 'sonner';

interface PlatformAnalytics {
  total_tenants: number;
  total_users: number;
  total_msp_users: number;
  role_distribution: Record<string, number>;
  tenant_stats: Array<{
    tenant_id: string;
    tenant_name: string;
    user_count: number;
  }>;
}

export function MSPAnalytics() {
  const { user, hasPermission } = useAuth();
  const [analytics, setAnalytics] = useState<PlatformAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  // Check if user has permission to view platform analytics
  if (!user?.isMspUser || !hasPermission('view:platform-analytics')) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <h2 className="text-lg font-semibold text-gray-900">Access Denied</h2>
          <p className="text-gray-600">You don't have permission to view platform analytics.</p>
        </div>
      </div>
    );
  }

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      const response = await fetch('http://localhost:8000/api/msp/analytics/platform', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch platform analytics');
      }

      const data = await response.json();
      setAnalytics(data);
    } catch (error) {
      console.error('Error fetching analytics:', error);
      toast.error('Failed to load platform analytics');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading analytics...</p>
        </div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <h2 className="text-lg font-semibold text-gray-900">No Data Available</h2>
          <p className="text-gray-600">Unable to load platform analytics.</p>
        </div>
      </div>
    );
  }

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'msp':
        return 'default';
      case 'admin':
        return 'secondary';
      case 'user':
        return 'outline';
      default:
        return 'outline';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Platform Analytics</h1>
        <p className="text-gray-600">Overview of platform usage and user distribution</p>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Tenants</CardTitle>
            <Building className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.total_tenants}</div>
            <p className="text-xs text-muted-foreground">
              Active tenants on platform
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.total_users}</div>
            <p className="text-xs text-muted-foreground">
              Regular tenant users
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">MSP Users</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.total_msp_users}</div>
            <p className="text-xs text-muted-foreground">
              Users with global access
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Users/Tenant</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {analytics.total_tenants > 0 ? Math.round(analytics.total_users / analytics.total_tenants) : 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Average users per tenant
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Role Distribution */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <BarChart3 className="h-5 w-5 mr-2" />
            User Role Distribution
          </CardTitle>
          <CardDescription>
            Breakdown of users by role across all tenants
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Object.entries(analytics.role_distribution).map(([role, count]) => (
              <div key={role} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className="flex-shrink-0">
                    {role === 'msp' ? (
                      <Shield className="h-5 w-5 text-purple-600" />
                    ) : role === 'admin' ? (
                      <Users className="h-5 w-5 text-blue-600" />
                    ) : (
                      <Users className="h-5 w-5 text-gray-600" />
                    )}
                  </div>
                  <div>
                    <Badge variant={getRoleBadgeVariant(role)}>
                      {role.toUpperCase()}
                    </Badge>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold">{count}</div>
                  <div className="text-xs text-muted-foreground">users</div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Tenant Statistics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Activity className="h-5 w-5 mr-2" />
            Tenant User Statistics
          </CardTitle>
          <CardDescription>
            User count breakdown by tenant
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tenant</TableHead>
                  <TableHead>Tenant ID</TableHead>
                  <TableHead className="text-right">User Count</TableHead>
                  <TableHead className="text-right">Percentage</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {analytics.tenant_stats
                  .sort((a, b) => b.user_count - a.user_count)
                  .map((tenant) => {
                    const percentage = analytics.total_users > 0 
                      ? ((tenant.user_count / analytics.total_users) * 100).toFixed(1)
                      : '0.0';
                    
                    return (
                      <TableRow key={tenant.tenant_id}>
                        <TableCell>
                          <div className="font-medium">{tenant.tenant_name}</div>
                        </TableCell>
                        <TableCell>
                          <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                            {tenant.tenant_id}
                          </code>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end">
                            <Users className="h-4 w-4 mr-1 text-muted-foreground" />
                            {tenant.user_count}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant="outline">
                            {percentage}%
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
              </TableBody>
            </Table>
          </div>

          {analytics.tenant_stats.length === 0 && (
            <div className="text-center py-8">
              <Building className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No tenant data</h3>
              <p className="text-gray-600">No tenant statistics available.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

