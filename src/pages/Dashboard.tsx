
import { useEffect, useState } from "react";
import { useAuth } from "@/context/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { mockCloudAccounts, mockDeployments } from "@/data/mock-data";
import { CloudProvider, DeploymentStatus } from "@/types/cloud";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from "recharts";
import { CloudAccount } from "@/types/auth";
import { Activity, Database } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface ProviderStats {
  name: CloudProvider;
  value: number;
}

interface StatusStats {
  name: DeploymentStatus;
  value: number;
}

interface CloudProviderDistribution {
  name: CloudProvider;
  deployments: number;
}

const Dashboard = () => {
  const { currentTenant } = useAuth();
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState<CloudAccount[]>([]);
  const [deployments, setDeployments] = useState(mockDeployments);
  const [providerStats, setProviderStats] = useState<ProviderStats[]>([]);
  const [statusStats, setStatusStats] = useState<StatusStats[]>([]);
  const [providerDistribution, setProviderDistribution] = useState<CloudProviderDistribution[]>([]);
  
  // Colors for the charts
  const providerColors = {
    azure: "#0078D4",
    aws: "#FF9900",
    gcp: "#4285F4"
  };
  
  const statusColors = {
    running: "#10B981",
    pending: "#F59E0B",
    failed: "#EF4444",
    stopped: "#6B7280",
    deploying: "#6366F1"
  };
  
  useEffect(() => {
    if (currentTenant) {
      // Filter accounts and deployments by tenant
      const tenantAccounts = mockCloudAccounts.filter(
        account => account.tenantId === currentTenant.id
      );
      setAccounts(tenantAccounts);
      
      const tenantDeployments = mockDeployments.filter(
        deployment => deployment.tenantId === currentTenant.id
      );
      setDeployments(tenantDeployments);
      
      // Calculate provider stats
      const providers = tenantAccounts.reduce<Record<CloudProvider, number>>((acc, account) => {
        acc[account.provider] = (acc[account.provider] || 0) + 1;
        return acc;
      }, {} as Record<CloudProvider, number>);
      
      setProviderStats(
        Object.entries(providers).map(([name, value]) => ({
          name: name as CloudProvider,
          value
        }))
      );
      
      // Calculate status stats
      const statuses = tenantDeployments.reduce<Record<DeploymentStatus, number>>((acc, deployment) => {
        acc[deployment.status] = (acc[deployment.status] || 0) + 1;
        return acc;
      }, {} as Record<DeploymentStatus, number>);
      
      setStatusStats(
        Object.entries(statuses).map(([name, value]) => ({
          name: name as DeploymentStatus,
          value
        }))
      );
      
      // Calculate provider distribution for deployments
      const distribution = tenantDeployments.reduce<Record<CloudProvider, number>>((acc, deployment) => {
        acc[deployment.provider] = (acc[deployment.provider] || 0) + 1;
        return acc;
      }, {} as Record<CloudProvider, number>);
      
      setProviderDistribution(
        Object.entries(distribution).map(([name, deployments]) => ({
          name: name as CloudProvider,
          deployments
        }))
      );
    }
  }, [currentTenant]);
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
      </div>
      
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Deployments</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{deployments.length}</div>
            <p className="text-xs text-muted-foreground">
              across all environments
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Connected Clouds</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{accounts.length}</div>
            <p className="text-xs text-muted-foreground">
              cloud accounts connected
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Healthy</CardTitle>
            <div className="status-dot status-healthy" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {deployments.filter(d => d.status === "running").length}
            </div>
            <p className="text-xs text-muted-foreground">
              deployments running normally
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Issues</CardTitle>
            <div className="status-dot status-error" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {deployments.filter(d => d.status === "failed").length}
            </div>
            <p className="text-xs text-muted-foreground">
              deployments with errors
            </p>
          </CardContent>
        </Card>
      </div>
      
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
        <Card className="md:col-span-4">
          <CardHeader>
            <CardTitle>Deployment Status</CardTitle>
            <CardDescription>
              Current status of all deployments
            </CardDescription>
          </CardHeader>
          <CardContent className="px-2">
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={providerDistribution}
                  margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                >
                  <XAxis dataKey="name" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="deployments" name="Deployments">
                    {providerDistribution.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={providerColors[entry.name]} 
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
        
        <Card className="md:col-span-3">
          <CardHeader>
            <CardTitle>Cloud Providers</CardTitle>
            <CardDescription>
              Distribution of connected cloud services
            </CardDescription>
          </CardHeader>
          <CardContent className="px-2">
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusStats}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {statusStats.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={statusColors[entry.name]} 
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
      
      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Connected Cloud Accounts</CardTitle>
            <CardDescription>
              Status of your cloud provider integrations
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6">
              {accounts.length > 0 ? accounts.map((account) => (
                <div key={account.id} className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className={`h-2.5 w-2.5 rounded-full bg-cloud-${account.provider}`} />
                    <div>
                      <p className="text-sm font-medium">{account.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {account.provider.toUpperCase()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center">
                    <div className="status-indicator mr-4">
                      <div className={`status-dot status-${account.status}`} />
                      <span className="text-xs capitalize">{account.status}</span>
                    </div>
                    <Button variant="outline" size="sm">
                      Details
                    </Button>
                  </div>
                </div>
              )) : (
                <p className="text-muted-foreground text-center py-4">
                  No cloud accounts connected yet.
                </p>
              )}
            </div>
          </CardContent>
          <CardFooter>
            <Button variant="outline" className="w-full">
              Manage Cloud Accounts
            </Button>
          </CardFooter>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Recent Deployments</CardTitle>
              <CardDescription>
                Most recent deployment activities
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => navigate('/deployments')}>
              View All
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {deployments.length > 0 ? deployments.slice(0, 5).map((deployment) => (
                <div key={deployment.id} className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className={`h-2.5 w-2.5 rounded-full bg-cloud-${deployment.provider}`} />
                    <div>
                      <p className="text-sm font-medium">{deployment.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {deployment.environment} · {new Date(deployment.updatedAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center">
                    <div className="status-indicator mr-4">
                      <div className={`status-dot status-${deployment.status === "running" ? "healthy" : deployment.status === "pending" || deployment.status === "deploying" ? "warning" : "error"}`} />
                      <span className="text-xs capitalize">{deployment.status}</span>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => navigate(`/deployments/${deployment.id}`)}>
                      View
                    </Button>
                  </div>
                </div>
              )) : (
                <p className="text-muted-foreground text-center py-4">
                  No deployments found.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
