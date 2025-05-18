import { useState, useEffect } from "react";
import { useAuth } from "@/context/auth-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { CloudDeployment, CloudAccount } from "@/types/cloud";
import { deploymentService } from "@/services/deployment-service";
import { toast } from "sonner";
import { 
  Activity, 
  Server, 
  Database, 
  CloudCog, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  RefreshCw 
} from "lucide-react";

export default function Dashboard() {
  const { user, currentTenant } = useAuth();
  const [deployments, setDeployments] = useState<CloudDeployment[]>([]);
  const [cloudAccounts, setCloudAccounts] = useState<CloudAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboardData = async () => {
    if (!currentTenant) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      // Fetch deployments and cloud accounts in parallel
      const [deploymentsData, cloudAccountsData] = await Promise.all([
        deploymentService.getDeployments(currentTenant.id),
        deploymentService.getCloudAccounts(currentTenant.id)
      ]);
      
      setDeployments(deploymentsData);
      setCloudAccounts(cloudAccountsData);
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
      setError("Failed to load dashboard data. Please try again.");
      
      if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error("Failed to load dashboard data");
      }
      
      // Fallback to mock data for development
      try {
        const { mockDeployments, mockCloudAccounts } = await import("@/data/mock-data");
        
        const tenantDeployments = mockDeployments.filter(
          deployment => deployment.tenantId === currentTenant.id
        );
        const tenantCloudAccounts = mockCloudAccounts.filter(
          account => account.tenantId === currentTenant.id
        );
        
        setDeployments(tenantDeployments);
        setCloudAccounts(tenantCloudAccounts);
      } catch (mockError) {
        console.error("Error loading mock data:", mockError);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (currentTenant) {
      fetchDashboardData();
    }
  }, [currentTenant]);

  const handleRefresh = () => {
    fetchDashboardData();
    toast.success("Refreshing dashboard data...");
  };

  // Calculate deployment statistics
  const runningDeployments = deployments.filter(d => d.status === "running").length;
  const failedDeployments = deployments.filter(d => d.status === "failed").length;
  const pendingDeployments = deployments.filter(d => d.status === "pending").length;
  
  // Calculate cloud account statistics
  const connectedAccounts = cloudAccounts.filter(a => a.status === "connected").length;
  const warningAccounts = cloudAccounts.filter(a => a.status === "warning").length;
  const errorAccounts = cloudAccounts.filter(a => a.status === "error").length;
  
  // Group deployments by provider
  const deploymentsByProvider = deployments.reduce((acc, deployment) => {
    acc[deployment.provider] = (acc[deployment.provider] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  // Get recent deployments (last 5)
  const recentDeployments = [...deployments]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome back, {user?.name}
          </p>
        </div>
        <Button variant="outline" size="icon" onClick={handleRefresh}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-10">
            <AlertCircle className="h-10 w-10 text-destructive mb-2" />
            <h3 className="text-lg font-medium">Error loading dashboard</h3>
            <p className="text-muted-foreground">{error}</p>
            <Button variant="outline" className="mt-4" onClick={fetchDashboardData}>
              Try Again
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Deployments
                </CardTitle>
                <Database className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{deployments.length}</div>
                <p className="text-xs text-muted-foreground">
                  Across {Object.keys(deploymentsByProvider).length} cloud providers
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Running Deployments
                </CardTitle>
                <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{runningDeployments}</div>
                <p className="text-xs text-muted-foreground">
                  {Math.round((runningDeployments / deployments.length) * 100) || 0}% of total deployments
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Cloud Accounts
                </CardTitle>
                <CloudCog className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{cloudAccounts.length}</div>
                <p className="text-xs text-muted-foreground">
                  {connectedAccounts} connected, {warningAccounts + errorAccounts} with issues
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Failed Deployments
                </CardTitle>
                <AlertCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{failedDeployments}</div>
                <p className="text-xs text-muted-foreground">
                  {pendingDeployments} pending resolution
                </p>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="recent" className="space-y-4">
            <TabsList>
              <TabsTrigger value="recent">Recent Deployments</TabsTrigger>
              <TabsTrigger value="providers">Cloud Providers</TabsTrigger>
            </TabsList>
            <TabsContent value="recent" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Recent Deployments</CardTitle>
                  <CardDescription>
                    Your most recent infrastructure deployments
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {recentDeployments.length > 0 ? (
                      recentDeployments.map((deployment) => (
                        <div
                          key={deployment.id}
                          className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0"
                        >
                          <div className="flex items-center gap-4">
                            <div className={`p-2 rounded-full ${
                              deployment.status === "running" ? "bg-green-100" :
                              deployment.status === "failed" ? "bg-red-100" :
                              "bg-gray-100"
                            }`}>
                              {deployment.status === "running" ? (
                                <Activity className="h-4 w-4 text-green-600" />
                              ) : deployment.status === "failed" ? (
                                <AlertCircle className="h-4 w-4 text-red-600" />
                              ) : (
                                <Clock className="h-4 w-4 text-gray-600" />
                              )}
                            </div>
                            <div>
                              <p className="text-sm font-medium">{deployment.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {deployment.templateName} • {deployment.environment}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className={`px-2 py-1 rounded-full text-xs ${
                              deployment.provider === "azure" ? "bg-blue-100 text-blue-800" :
                              deployment.provider === "aws" ? "bg-yellow-100 text-yellow-800" :
                              "bg-green-100 text-green-800"
                            }`}>
                              {deployment.provider.toUpperCase()}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {new Date(deployment.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="flex flex-col items-center justify-center py-6">
                        <Server className="h-8 w-8 text-muted-foreground mb-2" />
                        <h3 className="text-lg font-medium">No deployments yet</h3>
                        <p className="text-sm text-muted-foreground">
                          Start by creating a new deployment from the template catalog
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="providers" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Cloud Providers</CardTitle>
                  <CardDescription>
                    Your connected cloud provider accounts
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {cloudAccounts.length > 0 ? (
                      cloudAccounts.map((account) => (
                        <div
                          key={account.id}
                          className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0"
                        >
                          <div className="flex items-center gap-4">
                            <div className={`p-2 rounded-full ${
                              account.status === "connected" ? "bg-green-100" :
                              account.status === "warning" ? "bg-yellow-100" :
                              "bg-red-100"
                            }`}>
                              <CloudCog className={`h-4 w-4 ${
                                account.status === "connected" ? "text-green-600" :
                                account.status === "warning" ? "text-yellow-600" :
                                "text-red-600"
                              }`} />
                            </div>
                            <div>
                              <p className="text-sm font-medium">{account.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {account.provider.toUpperCase()}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className={`px-2 py-1 rounded-full text-xs ${
                              account.status === "connected" ? "bg-green-100 text-green-800" :
                              account.status === "warning" ? "bg-yellow-100 text-yellow-800" :
                              "bg-red-100 text-red-800"
                            }`}>
                              {account.status.toUpperCase()}
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="flex flex-col items-center justify-center py-6">
                        <CloudCog className="h-8 w-8 text-muted-foreground mb-2" />
                        <h3 className="text-lg font-medium">No cloud accounts connected</h3>
                        <p className="text-sm text-muted-foreground">
                          Connect your cloud provider accounts to start deploying
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
