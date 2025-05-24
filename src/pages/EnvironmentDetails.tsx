import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { 
  ArrowLeft, 
  RefreshCw, 
  AlertCircle, 
  Server, 
  Cloud, 
  Box, 
  Layers, 
  FileText, 
  Database, 
  FolderTree, 
  Activity, 
  BarChart4, 
  Settings,
  Eye
} from "lucide-react";
import { cmpService } from "@/services/cmp-service";

interface Environment {
  id: string;
  internal_id?: number;
  name: string;
  description: string;
  tenant_id: string;
  update_strategy?: string;
  cloud_accounts: Array<{
    id: string;
    name: string;
    provider: string;
    status: string;
    description?: string;
  }>;
  scaling_policies?: Record<string, any>;
  environment_variables?: Record<string, any>;
  logging_config?: Record<string, any>;
  monitoring_integration?: Record<string, any>;
}

interface Deployment {
  id: string;
  name: string;
  status: string;
  template_name: string;
  created_at: string;
  updated_at: string;
}

interface CloudResource {
  id: string;
  name: string;
  type: string;
  region: string;
  status: string;
  provider: string;
  created_at: string;
}

const EnvironmentDetails = () => {
  const { environmentId } = useParams<{ environmentId: string }>();
  const navigate = useNavigate();
  const { currentTenant } = useAuth();
  const [environment, setEnvironment] = useState<Environment | null>(null);
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [resources, setResources] = useState<CloudResource[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("dashboard");
  
  // Fetch environment details
  const fetchEnvironmentDetails = async () => {
    if (!environmentId || !currentTenant) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const environmentData = await cmpService.getEnvironment(environmentId);
      setEnvironment(environmentData);
      
      // Fetch real deployments from the API
      try {
        const deploymentsData = await cmpService.getDeployments(currentTenant.id);
        // Filter deployments for this environment
        const environmentDeployments = deploymentsData.filter(
          (dep) => dep.environment === environmentData.name
        );
        setDeployments(environmentDeployments.map(dep => ({
          id: dep.id,
          name: dep.name,
          status: dep.status,
          template_name: dep.templateName,
          created_at: dep.createdAt,
          updated_at: dep.updatedAt
        })));
      } catch (deployError) {
        console.error("Error fetching deployments:", deployError);
        setDeployments([]);
      }
      
      // Fetch real resources from the API
      try {
        const response = await fetch(`${import.meta.env.VITE_API_URL}/environments/${environmentId}/resources`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });
        
        if (!response.ok) {
          throw new Error(`Error fetching resources: ${response.statusText}`);
        }
        
        const resourcesData = await response.json();
        setResources(resourcesData);
      } catch (resourceError) {
        console.error("Error fetching resources:", resourceError);
        setResources([]);
      }
      
      setIsLoading(false);
    } catch (err) {
      console.error("Error fetching environment details:", err);
      setError("Failed to load environment details. Please try again.");
      setIsLoading(false);
    }
  };
  
  useEffect(() => {
    if (currentTenant) {
      fetchEnvironmentDetails();
    }
  }, [currentTenant, environmentId]);
  
  const handleRefresh = () => {
    fetchEnvironmentDetails();
    toast.success("Refreshing environment details...");
  };
  
  const handleBack = () => {
    navigate("/environments");
  };
  
  // Format JSON for display
  const formatJson = (json: Record<string, any> | undefined) => {
    if (!json) return "No data";
    return JSON.stringify(json, null, 2);
  };
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">Loading environment details...</span>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <AlertCircle className="h-12 w-12 text-red-500" />
        <h2 className="mt-4 text-xl font-semibold">Error Loading Environment</h2>
        <p className="text-muted-foreground mt-2">{error}</p>
        <div className="flex gap-2 mt-4">
          <Button onClick={handleBack}>Back to Environments</Button>
          <Button onClick={fetchEnvironmentDetails}>Try Again</Button>
        </div>
      </div>
    );
  }
  
  if (!environment) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <AlertCircle className="h-12 w-12 text-amber-500" />
        <h2 className="mt-4 text-xl font-semibold">Environment Not Found</h2>
        <p className="text-muted-foreground mt-2">The environment you're looking for doesn't exist or you don't have access to it.</p>
        <Button className="mt-4" onClick={handleBack}>Back to Environments</Button>
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={handleBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{environment.name}</h1>
            <p className="text-muted-foreground">{environment.description || "No description"}</p>
          </div>
        </div>
        
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={handleRefresh} title="Refresh">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      <Tabs defaultValue="dashboard" value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="dashboard" className="flex items-center gap-1">
            <BarChart4 className="h-4 w-4" />
            <span>Dashboard</span>
          </TabsTrigger>
          <TabsTrigger value="dependencies" className="flex items-center gap-1">
            <Layers className="h-4 w-4" />
            <span>Dependencies</span>
          </TabsTrigger>
          <TabsTrigger value="resources" className="flex items-center gap-1">
            <FolderTree className="h-4 w-4" />
            <span>Resource Explorer</span>
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-1">
            <Settings className="h-4 w-4" />
            <span>Settings</span>
          </TabsTrigger>
        </TabsList>
        
        {/* Dashboard Tab */}
        <TabsContent value="dashboard" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Cloud Accounts</CardTitle>
                <CardDescription>Connected cloud providers</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{environment.cloud_accounts.length}</div>
                <p className="text-xs text-muted-foreground">
                  {environment.cloud_accounts.map(acc => acc.provider).join(", ")}
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Deployments</CardTitle>
                <CardDescription>Active deployments</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{deployments.length}</div>
                <p className="text-xs text-muted-foreground">
                  Last updated {new Date().toLocaleDateString()}
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Resources</CardTitle>
                <CardDescription>Cloud resources</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{resources.length}</div>
                <p className="text-xs text-muted-foreground">
                  Across {environment.cloud_accounts.length} cloud accounts
                </p>
              </CardContent>
            </Card>
          </div>
          
          <div className="grid grid-cols-1 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Environment Overview</CardTitle>
                <CardDescription>Key metrics and status</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex justify-center items-center h-64 border rounded-md">
                  <div className="text-center">
                    <Activity className="h-12 w-12 mx-auto text-muted-foreground" />
                    <p className="mt-2 text-muted-foreground">Environment metrics will be displayed here</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        {/* Dependencies Tab */}
        <TabsContent value="dependencies" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Cloud className="h-5 w-5" />
                <span>Connected Cloud Accounts</span>
              </CardTitle>
              <CardDescription>Cloud provider accounts linked to this environment</CardDescription>
            </CardHeader>
            <CardContent>
              {environment.cloud_accounts.length > 0 ? (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Provider</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Description</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {environment.cloud_accounts.map((account) => (
                        <TableRow key={account.id}>
                          <TableCell className="font-medium">{account.name}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="capitalize">
                              {account.provider}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge 
                              variant={account.status === "connected" ? "success" : "destructive"}
                              className="capitalize"
                            >
                              {account.status}
                            </Badge>
                          </TableCell>
                          <TableCell>{account.description || "No description"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-32 border rounded-md">
                  <Cloud className="h-8 w-8 text-muted-foreground" />
                  <p className="mt-2 text-muted-foreground">No cloud accounts connected</p>
                </div>
              )}
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Box className="h-5 w-5" />
                <span>Linked Deployments</span>
              </CardTitle>
              <CardDescription>Deployments running in this environment</CardDescription>
            </CardHeader>
            <CardContent>
              {deployments.length > 0 ? (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Template</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead>Last Updated</TableHead>
                        <TableHead>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => navigate("/deployments")}
                            title="View all deployments"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {deployments.map((deployment) => (
                        <TableRow key={deployment.id}>
                          <TableCell className="font-medium">{deployment.name}</TableCell>
                          <TableCell>{deployment.template_name}</TableCell>
                          <TableCell>
                            <Badge 
                              variant={deployment.status === "running" ? "success" : "destructive"}
                              className="capitalize"
                            >
                              {deployment.status}
                            </Badge>
                          </TableCell>
                          <TableCell>{new Date(deployment.created_at).toLocaleString()}</TableCell>
                          <TableCell>{new Date(deployment.updated_at).toLocaleString()}</TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => navigate(`/deployments/${deployment.id}`)}
                              title="View deployment details"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-32 border rounded-md">
                  <Box className="h-8 w-8 text-muted-foreground" />
                  <p className="mt-2 text-muted-foreground">No deployments found</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Resource Explorer Tab */}
        <TabsContent value="resources" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FolderTree className="h-5 w-5" />
                <span>Resource Explorer</span>
              </CardTitle>
              <CardDescription>Browse cloud resources available in this environment</CardDescription>
            </CardHeader>
            <CardContent>
              {resources.length > 0 ? (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Provider</TableHead>
                        <TableHead>Region</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Created</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {resources.map((resource) => (
                        <TableRow key={resource.id}>
                          <TableCell className="font-medium">{resource.name}</TableCell>
                          <TableCell>{resource.type}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="capitalize">
                              {resource.provider}
                            </Badge>
                          </TableCell>
                          <TableCell>{resource.region}</TableCell>
                          <TableCell>
                            <Badge 
                              variant={resource.status === "running" ? "success" : "destructive"}
                              className="capitalize"
                            >
                              {resource.status}
                            </Badge>
                          </TableCell>
                          <TableCell>{new Date(resource.created_at).toLocaleString()}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-32 border rounded-md">
                  <Database className="h-8 w-8 text-muted-foreground" />
                  <p className="mt-2 text-muted-foreground">No resources found</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                <span>Environment Configuration</span>
              </CardTitle>
              <CardDescription>View environment configuration details</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <h3 className="text-sm font-medium">Update Strategy</h3>
                  <div className="p-2 rounded-md bg-muted">
                    <p>{environment.update_strategy || "Default"}</p>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <h3 className="text-sm font-medium">Environment ID</h3>
                  <div className="p-2 rounded-md bg-muted">
                    <p className="text-xs font-mono">{environment.id}</p>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <h3 className="text-sm font-medium">Environment Variables</h3>
                  <div className="p-2 rounded-md bg-muted overflow-auto max-h-40">
                    <pre className="text-xs font-mono whitespace-pre">
                      {formatJson(environment.environment_variables)}
                    </pre>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <h3 className="text-sm font-medium">Scaling Policies</h3>
                  <div className="p-2 rounded-md bg-muted overflow-auto max-h-40">
                    <pre className="text-xs font-mono whitespace-pre">
                      {formatJson(environment.scaling_policies)}
                    </pre>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <h3 className="text-sm font-medium">Logging Configuration</h3>
                  <div className="p-2 rounded-md bg-muted overflow-auto max-h-40">
                    <pre className="text-xs font-mono whitespace-pre">
                      {formatJson(environment.logging_config)}
                    </pre>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <h3 className="text-sm font-medium">Monitoring Integration</h3>
                  <div className="p-2 rounded-md bg-muted overflow-auto max-h-40">
                    <pre className="text-xs font-mono whitespace-pre">
                      {formatJson(environment.monitoring_integration)}
                    </pre>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default EnvironmentDetails;
