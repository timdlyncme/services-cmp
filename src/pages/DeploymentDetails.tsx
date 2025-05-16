import React, { useState } from "react";
import { useParams } from "react-router-dom";
import { useAuth } from "@/context/auth-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { mockDeployments, mockTemplates } from "@/data/mock-data";
import { toast } from "sonner";
import {
  Activity,
  AlertCircle,
  CheckCircle,
  ChevronRight,
  Clock,
  CloudCog,
  Database,
  Download,
  FileText,
  GitBranch,
  History,
  Server,
  Settings,
  XCircle,
} from "lucide-react";

const DeploymentDetails = () => {
  const { deploymentId } = useParams();
  const { currentTenant } = useAuth();
  const [deployment, setDeployment] = useState<any>(null);
  const [template, setTemplate] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<string[]>([]);
  
  useEffect(() => {
    const fetchDeployment = async () => {
      try {
        // In a real app, this would be an API call
        const foundDeployment = mockDeployments.find(d => d.id === deploymentId);
        
        if (foundDeployment) {
          setDeployment(foundDeployment);
          
          // Find associated template
          const associatedTemplate = mockTemplates.find(t => t.id === foundDeployment.templateId);
          if (associatedTemplate) {
            setTemplate(associatedTemplate);
          }
          
          // Generate some mock logs
          const mockLogs = [
            "2023-04-01T10:00:00Z [INFO] Starting deployment...",
            "2023-04-01T10:00:05Z [INFO] Validating template...",
            "2023-04-01T10:00:10Z [INFO] Provisioning resources...",
            "2023-04-01T10:01:00Z [INFO] Creating virtual network...",
            "2023-04-01T10:02:00Z [INFO] Creating storage accounts...",
            "2023-04-01T10:03:00Z [INFO] Configuring security...",
            "2023-04-01T10:04:00Z [INFO] Deployment completed successfully."
          ];
          setLogs(mockLogs);
        }
      } catch (error) {
        console.error("Error fetching deployment:", error);
      } finally {
        setLoading(false);
      }
    };
    
    if (deploymentId && currentTenant) {
      fetchDeployment();
    }
  }, [deploymentId, currentTenant]);
  
  const handleAction = (action: string) => {
    toast.success(`${action} action initiated`);
    
    if (action === "restart") {
      setDeployment({
        ...deployment,
        status: "running"
      });
    } else if (action === "stop") {
      setDeployment({
        ...deployment,
        status: "stopped"
      });
    }
  };
  
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "running":
        return <Badge variant="secondary">{status}</Badge>;
      case "stopped":
        return <Badge variant="outline">{status}</Badge>;
      case "failed":
        return <Badge variant="destructive">{status}</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };
  
  if (loading) {
    return <div className="flex items-center justify-center h-64">Loading deployment details...</div>;
  }
  
  if (!deployment) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <AlertCircle className="h-10 w-10 text-muted-foreground mb-4" />
        <h2 className="text-xl font-medium">Deployment not found</h2>
        <p className="text-muted-foreground mt-2">
          The requested deployment could not be found.
        </p>
        <Button variant="outline" className="mt-4" asChild>
          <Link to="/deployments">Return to deployments</Link>
        </Button>
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" asChild>
          <Link to="/deployments">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{deployment.name}</h1>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>ID: {deployment.id}</span>
            <span>•</span>
            <span>Created {new Date(deployment.createdAt).toLocaleDateString()}</span>
            <span>•</span>
            {getStatusBadge(deployment.status)}
          </div>
        </div>
        <div className="ml-auto flex gap-2">
          {deployment.status === "running" && (
            <Button variant="outline" onClick={() => handleAction("stop")}>
              <Trash2 className="h-4 w-4 mr-2" />
              Stop
            </Button>
          )}
          {deployment.status === "stopped" && (
            <Button variant="outline" onClick={() => handleAction("restart")}>
              <Play className="h-4 w-4 mr-2" />
              Restart
            </Button>
          )}
          <Button onClick={() => handleAction("refresh")}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>
      
      <Tabs defaultValue="overview">
        <TabsList className="grid w-full grid-cols-4 lg:w-[600px]">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="template">Template</TabsTrigger>
          <TabsTrigger value="parameters">Parameters</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
        </TabsList>
        
        <TabsContent value="overview" className="space-y-6 pt-4">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Deployment Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="font-medium">Status</div>
                  <div>{getStatusBadge(deployment.status)}</div>
                  
                  <div className="font-medium">Environment</div>
                  <div>{deployment.environment}</div>
                  
                  <div className="font-medium">Region</div>
                  <div>{deployment.region}</div>
                  
                  <div className="font-medium">Cloud Provider</div>
                  <div>
                    <Badge className={
                      deployment.provider === "azure" ? "bg-cloud-azure text-white" :
                      deployment.provider === "aws" ? "bg-cloud-aws text-black" :
                      "bg-cloud-gcp text-white"
                    }>
                      {deployment.provider.toUpperCase()}
                    </Badge>
                  </div>
                  
                  <div className="font-medium">Created By</div>
                  <div>{deployment.createdBy}</div>
                  
                  <div className="font-medium">Creation Date</div>
                  <div>{new Date(deployment.createdAt).toLocaleString()}</div>
                  
                  <div className="font-medium">Last Updated</div>
                  <div>{new Date(deployment.updatedAt).toLocaleString()}</div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Template Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {template ? (
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="font-medium">Template Name</div>
                    <div>{template.name}</div>
                    
                    <div className="font-medium">Template Type</div>
                    <div>{template.type}</div>
                    
                    <div className="font-medium">Version</div>
                    <div>{template.version}</div>
                    
                    <div className="font-medium">Categories</div>
                    <div className="flex flex-wrap gap-1">
                      {template.categories.map(category => (
                        <Badge key={category} variant="secondary" className="text-xs">
                          {category}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-muted-foreground">Template not found</div>
                )}
              </CardContent>
            </Card>
          </div>
          
          <Card>
            <CardHeader>
              <CardTitle>Resources</CardTitle>
              <CardDescription>Resources provisioned by this deployment</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deployment.resources && deployment.resources.length > 0 ? (
                    deployment.resources.map((resource: any, index: number) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">{resource.name}</TableCell>
                        <TableCell>{resource.type}</TableCell>
                        <TableCell>
                          {resource.status === "deployed" ? (
                            <div className="flex items-center">
                              <CheckCircle className="h-4 w-4 text-green-500 mr-1" />
                              <span>Deployed</span>
                            </div>
                          ) : (
                            <div className="flex items-center">
                              <AlertCircle className="h-4 w-4 text-amber-500 mr-1" />
                              <span>{resource.status}</span>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-muted-foreground">
                        No resources found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="template" className="space-y-6 pt-4">
          <Card>
            <CardHeader>
              <CardTitle>Template Code</CardTitle>
              <CardDescription>
                The infrastructure as code template used for this deployment
              </CardDescription>
            </CardHeader>
            <CardContent>
              {template ? (
                <ScrollArea className="h-[400px] rounded-md border bg-muted">
                  <pre className="p-4 text-sm">
                    <code>{template.codeSnippet || "No code available"}</code>
                  </pre>
                </ScrollArea>
              ) : (
                <div className="text-muted-foreground">Template not found</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="parameters" className="space-y-6 pt-4">
          <Card>
            <CardHeader>
              <CardTitle>Deployment Parameters</CardTitle>
              <CardDescription>
                Parameters used when deploying this template
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Parameter</TableHead>
                    <TableHead>Value</TableHead>
                    <TableHead>Type</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deployment.parameters && Object.keys(deployment.parameters).length > 0 ? (
                    Object.entries(deployment.parameters).map(([key, value]: [string, any], index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">{key}</TableCell>
                        <TableCell>{typeof value === 'object' ? JSON.stringify(value) : value.toString()}</TableCell>
                        <TableCell>{typeof value}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-muted-foreground">
                        No parameters found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="logs" className="space-y-6 pt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Deployment Logs</CardTitle>
                <CardDescription>
                  Log output from the deployment process
                </CardDescription>
              </div>
              <Button variant="outline" size="sm">
                <Terminal className="h-4 w-4 mr-2" />
                Full Console
              </Button>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px] rounded-md border bg-black text-white font-mono">
                <div className="p-4">
                  {logs.map((log, index) => (
                    <div key={index} className="py-0.5">
                      <span className="opacity-70">{log.split(' [')[0]}</span>
                      <span className={
                        log.includes('[INFO]') ? " text-blue-400" :
                        log.includes('[ERROR]') ? " text-red-400" :
                        log.includes('[WARNING]') ? " text-yellow-400" :
                        " text-green-400"
                      }>
                        {` [${log.split('[')[1]}`}
                      </span>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default DeploymentDetails;
