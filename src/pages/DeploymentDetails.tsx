import React, { useState, useEffect, useRef } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/auth-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { deploymentService } from "@/services/deployment-service";
import { CloudDeployment, CloudTemplate, DeploymentLog } from "@/types/cloud";
import {
  Activity,
  AlertCircle,
  ArrowLeft,
  CheckCircle,
  ChevronRight,
  Clock,
  CloudCog,
  Database,
  Download,
  FileText,
  GitBranch,
  History,
  Play,
  RefreshCw,
  Server,
  Settings,
  Terminal,
  Trash2,
  XCircle,
  Network,
  MessageSquare,
  GitCompare,
  Maximize,
  Minimize,
  Code,
  ExternalLink
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

const DeploymentDetails = () => {
  const { deploymentId } = useParams();
  const { currentTenant } = useAuth();
  const navigate = useNavigate();
  const [deployment, setDeployment] = useState<CloudDeployment | null>(null);
  const [template, setTemplate] = useState<CloudTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<string[]>([]);
  const [deploymentLogs, setDeploymentLogs] = useState<DeploymentLog[]>([]);
  const [refreshInterval, setRefreshInterval] = useState<number>(10); // Default 10 seconds
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [chatMessage, setChatMessage] = useState("");
  const [chatHistory, setChatHistory] = useState<{role: string, content: string}[]>([
    {role: "system", content: "I'm your Deployment AI Assistant. I can help you understand and manage your deployment."}
  ]);
  const [newTemplateVersionAvailable, setNewTemplateVersionAvailable] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>("");
  
  // Function to fetch deployment logs
  const fetchDeploymentLogs = async () => {
    if (!deploymentId) return;
    
    try {
      const logsData = await deploymentService.getDeploymentLogs(deploymentId);
      setDeploymentLogs(logsData);
      
      // Format logs for display
      const formattedLogs = logsData.map(log => 
        `${new Date(log.timestamp).toLocaleString()} - ${log.status}: ${log.message}`
      );
      setLogs(formattedLogs);
      
      // Set the latest status message
      if (logsData.length > 0) {
        const latestLog = logsData[logsData.length - 1];
        setStatusMessage(latestLog.message);
      }
    } catch (error) {
      console.error("Error fetching deployment logs:", error);
    }
  };
  
  useEffect(() => {
    const fetchDeployment = async () => {
      try {
        if (!deploymentId) return;
        
        // Fetch deployment from API
        const deploymentData = await deploymentService.getDeployment(deploymentId);
        
        if (deploymentData) {
          console.log("Deployment data received:", deploymentData);
          console.log("Resources:", deploymentData.resources);
          
          setDeployment(deploymentData);
          
          // Set status message based on deployment status
          if (deploymentData.status === "succeeded") {
            setStatusMessage("Deployment completed successfully");
          } else if (deploymentData.status === "failed") {
            setStatusMessage("Deployment failed. Check logs for details.");
          } else if (deploymentData.status === "in_progress") {
            setStatusMessage("Deployment is in progress...");
          }
          
          // Fetch template data
          if (deploymentData.templateId) {
            try {
              // In a real app, we would fetch the template from the API
              const templates = await deploymentService.getTemplates(currentTenant?.tenant_id || "");
              const associatedTemplate = templates.find(t => t.id === deploymentData.templateId);
              
              if (associatedTemplate) {
                // Add the template version from the deployment data if available
                if (deploymentData.templateVersion) {
                  associatedTemplate.version = deploymentData.templateVersion;
                } else if (associatedTemplate.current_version) {
                  // If the deployment doesn't have the version but the template has current_version
                  associatedTemplate.version = associatedTemplate.current_version;
                }
                
                setTemplate(associatedTemplate);
              }
            } catch (error) {
              console.error("Error fetching template:", error);
            }
          }
          
          // Fetch deployment logs
          await fetchDeploymentLogs();
        }
      } catch (error) {
        console.error("Error fetching deployment:", error);
        toast.error("Failed to load deployment details");
      } finally {
        setLoading(false);
      }
    };
    
    // Initial fetch
    fetchDeployment();
    
    // Set up polling for deployment status updates every 10 seconds
    const pollingInterval = setInterval(fetchDeployment, 10000);
    
    // Clean up interval on component unmount
    return () => clearInterval(pollingInterval);
  }, [deploymentId, currentTenant]);
  
  // Set up logs refresh interval
  useEffect(() => {
    // Clear any existing interval
    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current);
    }
    
    // Set new interval
    refreshIntervalRef.current = setInterval(fetchDeploymentLogs, refreshInterval * 1000);
    
    // Clean up on unmount
    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [refreshInterval, deploymentId]);
  
  const handleAction = (action: string) => {
    toast.success(`${action} action initiated`);
    
    if (action === "restart") {
      setDeployment({
        ...deployment!,
        status: "running"
      });
      
      // Add to logs
      const newLog = `${new Date().toISOString()} [INFO] Deployment restart initiated`;
      setLogs([...logs, newLog]);
      setStatusMessage("Deployment restart initiated");
    } else if (action === "stop") {
      setDeployment({
        ...deployment!,
        status: "stopped"
      });
      
      // Add to logs
      const newLog = `${new Date().toISOString()} [INFO] Deployment stopped`;
      setLogs([...logs, newLog]);
      setStatusMessage("Deployment stopped");
    } else if (action === "upgrade") {
      const newLogs = [
        `${new Date().toISOString()} [INFO] Starting template upgrade...`,
        `${new Date().toISOString()} [INFO] Validating new template version...`,
        `${new Date().toISOString()} [INFO] Initiating rolling update...`
      ];
      
      setLogs([...logs, ...newLogs]);
      setStatusMessage("Template upgrade in progress");
      
      toast.success("Deployment upgrade started");
      setNewTemplateVersionAvailable(false);
    } else if (action === "refresh") {
      // Manually refresh logs
      fetchDeploymentLogs();
      toast.success("Logs refreshed");
    } else if (action === "delete") {
      setIsDeleteDialogOpen(false);
      
      // Add to logs
      const newLog = `${new Date().toISOString()} [INFO] Deployment deletion initiated`;
      setLogs([...logs, newLog]);
      
      setDeployment({
        ...deployment!,
        status: "deleting"
      });
      
      setStatusMessage("Deployment deletion in progress");
      
      // Simulate deletion and navigate back after 3 seconds
      setTimeout(() => {
        toast.success("Deployment deleted successfully");
        navigate("/deployments");
      }, 3000);
    }
  };
  
  const handleSendChatMessage = () => {
    if (!chatMessage.trim()) return;
    
    // Add user message to chat history
    setChatHistory([...chatHistory, { role: "user", content: chatMessage }]);
    
    // Simulate AI response
    setTimeout(() => {
      let aiResponse = "I'm analyzing your deployment...";
      
      if (chatMessage.toLowerCase().includes("delete")) {
        aiResponse = "I can help you delete this deployment. To confirm deletion, please click the Delete button in the top-right corner of this page.";
      } else if (chatMessage.toLowerCase().includes("redeploy") || chatMessage.toLowerCase().includes("restart")) {
        aiResponse = "I can help you restart this deployment. Click the Restart button in the top-right corner to proceed.";
      } else if (chatMessage.toLowerCase().includes("resource") || chatMessage.toLowerCase().includes("vm") || chatMessage.toLowerCase().includes("database")) {
        aiResponse = "This deployment contains several resources including virtual networks, storage accounts, and compute instances. You can see all resources in the Resources section of the Overview tab.";
      } else if (chatMessage.toLowerCase().includes("status")) {
        aiResponse = `The current status of this deployment is "${deployment?.status}". All resources are functioning normally.`;
      } else if (chatMessage.toLowerCase().includes("template")) {
        aiResponse = `This deployment was created using the "${template?.name}" template, version ${template?.version}.` + 
          (newTemplateVersionAvailable ? " There is a newer version of this template available. You can upgrade to the latest version using the Upgrade button." : "");
      }
      
      setChatHistory([...chatHistory, { role: "user", content: chatMessage }, { role: "assistant", content: aiResponse }]);
      setChatMessage("");
    }, 1000);
  };
  
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "running":
        return <Badge variant="default">{status}</Badge>;
      case "stopped":
        return <Badge variant="outline">{status}</Badge>;
      case "failed":
        return <Badge variant="destructive">{status}</Badge>;
      case "succeeded":
        return <Badge variant="success">{status}</Badge>;
      case "deleting":
        return <Badge variant="secondary">{status}</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };
  
  const handleExportOutputs = () => {
    if (!deployment?.details?.outputs) {
      toast.error("No outputs available to export");
      return;
    }
    
    try {
      // Create a JSON string from the outputs
      const outputsJson = JSON.stringify(deployment.details.outputs, null, 2);
      
      // Create a blob from the JSON string
      const blob = new Blob([outputsJson], { type: 'application/json' });
      
      // Create a URL for the blob
      const url = URL.createObjectURL(blob);
      
      // Create a temporary anchor element to trigger the download
      const a = document.createElement('a');
      a.href = url;
      a.download = `${deployment.name}-outputs.json`;
      
      // Append the anchor to the body, click it, and then remove it
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      // Release the blob URL
      URL.revokeObjectURL(url);
      
      toast.success("Outputs exported successfully");
    } catch (error) {
      console.error("Error exporting outputs:", error);
      toast.error("Failed to export outputs");
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
    <div className="container mx-auto py-6 space-y-6">
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
          {newTemplateVersionAvailable && (
            <Button variant="secondary" onClick={() => handleAction("upgrade")}>
              <GitCompare className="h-4 w-4 mr-2" />
              Upgrade
            </Button>
          )}
          
          {deployment.status === "running" && (
            <Button variant="outline" onClick={() => handleAction("stop")}>
              <Activity className="h-4 w-4 mr-2" />
              Stop
            </Button>
          )}
          
          {deployment.status === "stopped" && (
            <Button variant="outline" onClick={() => handleAction("restart")}>
              <Play className="h-4 w-4 mr-2" />
              Restart
            </Button>
          )}
          
          <Button variant="destructive" onClick={() => setIsDeleteDialogOpen(true)}>
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </Button>
        </div>
      </div>
      
      {/* Main tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="grid grid-cols-7 w-full">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="outputs">Outputs</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
          <TabsTrigger value="template">Template</TabsTrigger>
          <TabsTrigger value="parameters">Parameters</TabsTrigger>
          <TabsTrigger value="diagram">Diagram</TabsTrigger>
          <TabsTrigger value="chat">AI Assistant</TabsTrigger>
        </TabsList>
        
        {/* Overview tab */}
        <TabsContent value="overview" className="space-y-6 pt-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Deployment Status</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      {deployment.status === "running" || deployment.status === "deploying" ? (
                        <Badge className="bg-blue-500">
                          <Activity className="h-3 w-3 mr-1" />
                          In Progress
                        </Badge>
                      ) : deployment.status === "failed" ? (
                        <Badge variant="destructive">
                          <XCircle className="h-3 w-3 mr-1" />
                          Failed
                        </Badge>
                      ) : deployment.status === "stopped" ? (
                        <Badge variant="outline">
                          <Clock className="h-3 w-3 mr-1" />
                          Stopped
                        </Badge>
                      ) : (
                        <Badge variant="success">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Succeeded
                        </Badge>
                      )}
                      
                      <span className="text-sm text-muted-foreground">
                        Last updated: {new Date(deployment.updatedAt).toLocaleString()}
                      </span>
                    </div>
                    
                    <div className="text-sm">
                      {statusMessage}
                    </div>
                    
                    {deployment.status === "failed" && (
                      <div className="bg-destructive/10 border border-destructive/20 rounded-md p-4 text-sm">
                        <div className="flex items-start gap-2">
                          <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                          <div>
                            <h4 className="font-medium text-destructive">Deployment Failed</h4>
                            <p className="mt-1">
                              The deployment process encountered an error. Check the logs for more details.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle>Resources</CardTitle>
                  <CardDescription>
                    Cloud resources created by this deployment
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[300px]">
                    <div className="space-y-4">
                      {deployment.resources && deployment.resources.length > 0 ? (
                        deployment.resources.map((resource, index) => (
                          <Collapsible key={index}>
                            <div className="flex items-center justify-between rounded-lg border p-4">
                              <div className="flex items-center gap-4">
                                {resource.type.includes("virtualMachine") ? (
                                  <Server className="h-8 w-8 text-primary" />
                                ) : resource.type.includes("storage") ? (
                                  <Database className="h-8 w-8 text-primary" />
                                ) : resource.type.includes("network") ? (
                                  <Network className="h-8 w-8 text-primary" />
                                ) : (
                                  <CloudCog className="h-8 w-8 text-primary" />
                                )}
                                
                                <div>
                                  <h4 className="text-sm font-semibold">{resource.name}</h4>
                                  <p className="text-xs text-muted-foreground">{resource.type}</p>
                                </div>
                              </div>
                              
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-xs">
                                  {resource.location}
                                </Badge>
                                
                                <CollapsibleTrigger asChild>
                                  <Button variant="ghost" size="sm">
                                    <ChevronRight className="h-4 w-4" />
                                  </Button>
                                </CollapsibleTrigger>
                              </div>
                            </div>
                            
                            <CollapsibleContent>
                              <div className="rounded-b-lg border border-t-0 p-4 text-sm">
                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <h5 className="font-medium">Properties</h5>
                                    <ul className="mt-2 space-y-1">
                                      {resource.properties.vmSize && (
                                        <li>Size: {resource.properties.vmSize}</li>
                                      )}
                                      {resource.properties.osType && (
                                        <li>OS: {resource.properties.osType}</li>
                                      )}
                                      {resource.properties.adminUsername && (
                                        <li>Admin: {resource.properties.adminUsername}</li>
                                      )}
                                    </ul>
                                  </div>
                                  
                                  <div>
                                    <h5 className="font-medium">Tags</h5>
                                    <div className="mt-2 flex flex-wrap gap-1">
                                      {resource.tags && Object.entries(resource.tags).map(([key, value], i) => (
                                        <Badge key={i} variant="secondary" className="text-xs">
                                          {key}: {value}
                                        </Badge>
                                      ))}
                                      {(!resource.tags || Object.keys(resource.tags).length === 0) && (
                                        <span className="text-xs text-muted-foreground">No tags</span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                
                                <div className="mt-4">
                                  <h5 className="font-medium">Resource ID</h5>
                                  <code className="mt-1 block rounded bg-muted p-2 text-xs">
                                    {resource.id}
                                  </code>
                                </div>
                              </div>
                            </CollapsibleContent>
                          </Collapsible>
                        ))
                      ) : (
                        <div className="text-center py-8 text-muted-foreground">
                          <CloudCog className="h-12 w-12 mx-auto mb-4 opacity-50" />
                          <h3 className="text-lg font-medium mb-2">No resources available</h3>
                          <p className="max-w-md mx-auto">
                            This deployment doesn't have any resources defined or they haven't been generated yet.
                          </p>
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
            
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Deployment Information</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-sm font-medium">Name</h3>
                      <p>{deployment.name}</p>
                    </div>
                    
                    <div>
                      <h3 className="text-sm font-medium">Environment</h3>
                      <p>{deployment.environment}</p>
                    </div>
                    
                    <div>
                      <h3 className="text-sm font-medium">Provider</h3>
                      <p>{deployment.provider.toUpperCase()}</p>
                    </div>
                    
                    <div>
                      <h3 className="text-sm font-medium">Region</h3>
                      <p>{deployment.region || "Not specified"}</p>
                    </div>
                    
                    <div>
                      <h3 className="text-sm font-medium">Created</h3>
                      <p>{new Date(deployment.createdAt).toLocaleString()}</p>
                    </div>
                    
                    <Separator />
                    
                    <div>
                      <h3 className="text-sm font-medium">Template</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <Link to={`/catalog/${deployment.templateId}`} className="text-primary hover:underline">
                          {deployment.templateName}
                        </Link>
                        {deployment.templateVersion && (
                          <Badge variant="outline" className="text-xs">
                            v{deployment.templateVersion}
                          </Badge>
                        )}
                      </div>
                    </div>
                    
                    {newTemplateVersionAvailable && (
                      <div className="bg-primary/10 border border-primary/20 rounded-md p-3 text-sm">
                        <div className="flex items-start gap-2">
                          <GitCompare className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                          <div>
                            <h4 className="font-medium text-primary">New version available</h4>
                            <p className="mt-1 text-xs">
                              A newer version of this template is available. Consider upgrading to get the latest features and fixes.
                            </p>
                            <Button variant="outline" size="sm" className="mt-2" onClick={() => handleAction("upgrade")}>
                              <GitBranch className="h-3 w-3 mr-1" />
                              Upgrade Template
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle>Quick Actions</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="outline" className="justify-start" onClick={() => handleAction("restart")}>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Restart
                    </Button>
                    
                    <Button variant="outline" className="justify-start" onClick={() => handleAction("stop")}>
                      <Play className="h-4 w-4 mr-2" />
                      Stop
                    </Button>
                    
                    <Button variant="outline" className="justify-start" asChild>
                      <Link to={`/catalog/${deployment.templateId}`}>
                        <FileText className="h-4 w-4 mr-2" />
                        View Template
                      </Link>
                    </Button>
                    
                    <Button variant="outline" className="justify-start" onClick={() => setIsDeleteDialogOpen(true)}>
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
        
        
        {/* Outputs tab */}
        <TabsContent value="outputs" className="space-y-6 pt-4">
          <Card>
            <CardHeader>
              <CardTitle>Deployment Outputs</CardTitle>
              <CardDescription>
                Values and resources produced by this deployment
              </CardDescription>
            </CardHeader>
            <CardContent>
              {deployment?.details?.outputs && Object.keys(deployment.details.outputs).length > 0 ? (
                <div className="space-y-6">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Output Name</TableHead>
                        <TableHead>Value</TableHead>
                        <TableHead>Type</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Object.entries(deployment.details.outputs).map(([key, value], index) => (
                        <TableRow key={index}>
                          <TableCell className="font-medium">{key}</TableCell>
                          <TableCell>
                            {typeof value === 'object' ? (
                              <pre className="bg-muted p-2 rounded text-xs overflow-auto max-h-20">
                                {JSON.stringify(value, null, 2)}
                              </pre>
                            ) : (
                              <span>{String(value)}</span>
                            )}
                          </TableCell>
                          <TableCell>{typeof value}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  
                  <div className="flex justify-end">
                    <Button variant="outline" size="sm" onClick={handleExportOutputs}>
                      <Download className="h-4 w-4 mr-2" />
                      Export Outputs
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Code className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <h3 className="text-lg font-medium mb-2">No outputs available</h3>
                  <p className="max-w-md mx-auto">
                    This deployment doesn't have any outputs defined or they haven't been generated yet.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Logs tab */}
        <TabsContent value="logs" className="space-y-6 pt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Deployment Logs</CardTitle>
                <CardDescription>
                  Log output from the deployment process
                </CardDescription>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Refresh:</span>
                  <Select
                    value={refreshInterval.toString()}
                    onValueChange={(value) => setRefreshInterval(parseInt(value))}
                  >
                    <SelectTrigger className="w-[120px]">
                      <SelectValue placeholder="Select interval" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5">5 seconds</SelectItem>
                      <SelectItem value="10">10 seconds</SelectItem>
                      <SelectItem value="30">30 seconds</SelectItem>
                      <SelectItem value="60">1 minute</SelectItem>
                      <SelectItem value="300">5 minutes</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button variant="outline" size="sm" onClick={() => handleAction("refresh")}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh Now
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px] rounded-md border bg-black text-white font-mono">
                <div className="p-4">
                  {logs.length > 0 ? (
                    logs.map((log, index) => (
                      <div key={index} className="py-0.5">
                        {log}
                      </div>
                    ))
                  ) : (
                    <div className="py-2 text-gray-400">No logs available</div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Template tab */}
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
                    <code>{template.code || "No code available"}</code>
                  </pre>
                </ScrollArea>
              ) : (
                <div className="text-muted-foreground">Template not found</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Parameters tab */}
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
                    Object.entries(deployment.parameters).map(([key, value], index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">{key}</TableCell>
                        <TableCell>{typeof value === 'object' ? JSON.stringify(value) : String(value)}</TableCell>
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
        
        {/* Diagram tab */}
        <TabsContent value="diagram" className="space-y-6 pt-4">
          <Card>
            <CardHeader>
              <CardTitle>Deployment Topology</CardTitle>
              <CardDescription>
                Visual representation of deployed resources and their relationships
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[500px] border rounded-md bg-muted flex flex-col items-center justify-center">
                <Network className="h-16 w-16 text-muted-foreground mb-4" />
                <h3 className="text-xl font-medium">Resource Topology Diagram</h3>
                <p className="text-sm text-muted-foreground mt-2 max-w-md text-center">
                  This diagram shows the deployed resources and their connections.
                  In a production environment, this would be an interactive diagram of your architecture.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* AI Assistant tab */}
        <TabsContent value="chat" className="space-y-6 pt-4">
          <Card>
            <CardHeader>
              <CardTitle>Deployment AI Chat</CardTitle>
              <CardDescription>
                Chat with the Deployment AI for help and insights
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px] rounded-md border bg-black text-white font-mono">
                <div className="p-4">
                  <div className="space-y-4">
                    {chatHistory.filter(msg => msg.role !== "system").map((message, index) => (
                      <div key={index} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[80%] rounded-lg p-3 ${
                          message.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"
                        }`}>
                          {message.content}
                        </div>
                      </div>
                    ))}
                    {chatHistory.length === 1 && (
                      <div className="text-center text-muted-foreground">
                        Start chatting with the Deployment AI to get help and insights
                      </div>
                    )}
                  </div>
                </div>
              </ScrollArea>
              
              <div className="flex gap-2">
                <Textarea 
                  placeholder="Ask a question about your deployment..." 
                  value={chatMessage}
                  onChange={(e) => setChatMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSendChatMessage();
                    }
                  }}
                  className="min-h-[60px]"
                />
                <Button onClick={handleSendChatMessage} className="self-end">
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Send
                </Button>
              </div>
              
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="cursor-pointer hover:bg-accent" onClick={() => setChatMessage("What resources are in this deployment?")}>
                  Show resources
                </Badge>
                <Badge variant="outline" className="cursor-pointer hover:bg-accent" onClick={() => setChatMessage("What's the status of this deployment?")}>
                  Check status
                </Badge>
                <Badge variant="outline" className="cursor-pointer hover:bg-accent" onClick={() => setChatMessage("Tell me about the template used")}>
                  Template info
                </Badge>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      
      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Deployment</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this deployment? This action cannot be undone.
              All cloud resources associated with this deployment will be permanently removed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => handleAction("delete")}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DeploymentDetails;
