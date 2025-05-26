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
      
      // Call the deployment engine to delete the resources
      const deleteResources = async () => {
        try {
          console.log("Starting resource deletion process");
          
          // In a real app, we would call the API to delete the deployment resources
          if (deployment && deployment.deployment_id) {
            console.log(`Calling deleteDeploymentResources for deployment: ${deployment.deployment_id}`);
            
            // Call the deployment service to delete the resources
            const result = await deploymentService.deleteDeploymentResources(deployment.deployment_id);
            console.log("Delete resources result:", result);
            
            // Update the deployment status to "archived"
            const updatedDeployment = {
              ...deployment,
              status: "archived"
            };
            setDeployment(updatedDeployment);
            
            // Update the resources status to "Deleted"
            if (updatedDeployment.resources) {
              console.log(`Updating status for ${updatedDeployment.resources.length} resources`);
              const updatedResources = updatedDeployment.resources.map(resource => ({
                ...resource,
                status: "Deleted"
              }));
              updatedDeployment.resources = updatedResources;
            }
            
            // Add to logs
            const newLog = `${new Date().toISOString()} [INFO] Deployment resources deleted successfully`;
            const archiveLog = `${new Date().toISOString()} [INFO] Deployment marked as archived`;
            setLogs([...logs, newLog, archiveLog]);
            
            setStatusMessage("Deployment resources deleted and marked as archived");
            toast.success("Deployment resources deleted successfully");
          } else {
            console.error("Deployment or deployment_id is missing");
            toast.error("Failed to delete deployment resources: Missing deployment information");
          }
        } catch (error) {
          console.error("Error deleting deployment resources:", error);
          toast.error("Failed to delete deployment resources");
          
          // Add to logs
          const newLog = `${new Date().toISOString()} [ERROR] Failed to delete deployment resources: ${error}`;
          setLogs([...logs, newLog]);
          
          setStatusMessage("Failed to delete deployment resources");
          
          // Revert deployment status
          setDeployment({
            ...deployment!,
            status: "failed"
          });
        }
      };
      
      // Execute the deletion
      deleteResources();
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
      
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="template">Template</TabsTrigger>
          <TabsTrigger value="parameters">Parameters</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
          <TabsTrigger value="diagram">Diagram</TabsTrigger>
        </TabsList>
        
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Collapsible className="w-full">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle>Deployment Details</CardTitle>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm" className="w-9 p-0">
                      <Maximize className="h-4 w-4" />
                      <span className="sr-only">Toggle</span>
                    </Button>
                  </CollapsibleTrigger>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Status</p>
                        <div className="flex items-center">
                          {getStatusBadge(deployment.status)}
                        </div>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Status Message</p>
                        <p className="text-sm font-medium">{statusMessage || "No status message available"}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Deployment ID</p>
                        <p className="text-sm font-medium">{deployment.id}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Created</p>
                        <p className="text-sm font-medium">{new Date(deployment.createdAt).toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Last Updated</p>
                        <p className="text-sm font-medium">{new Date(deployment.updatedAt || deployment.createdAt).toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Template</p>
                        <p className="text-sm font-medium">{template?.name || "Unknown"}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Template Version</p>
                        <p className="text-sm font-medium">{template?.version || "Unknown"}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Environment</p>
                        <p className="text-sm font-medium">{deployment.environment || "Default"}</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Collapsible>
            
            <Collapsible className="w-full">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle>Resources</CardTitle>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm" className="w-9 p-0">
                      <Maximize className="h-4 w-4" />
                      <span className="sr-only">Toggle</span>
                    </Button>
                  </CollapsibleTrigger>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[300px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {deployment.resources && deployment.resources.length > 0 ? (
                          deployment.resources.map((resource, index) => (
                            <TableRow key={index}>
                              <TableCell className="font-medium">{resource.name}</TableCell>
                              <TableCell>{resource.type}</TableCell>
                              <TableCell>
                                <div className="flex items-center">
                                  {resource.status === 'Succeeded' ? (
                                    <CheckCircle className="h-4 w-4 text-green-500 mr-1" />
                                  ) : resource.status === 'Failed' ? (
                                    <XCircle className="h-4 w-4 text-red-500 mr-1" />
                                  ) : (
                                    <Clock className="h-4 w-4 text-yellow-500 mr-1" />
                                  )}
                                  <span>{resource.status || 'Unknown'}</span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Button variant="ghost" size="sm" asChild>
                                  <Link to={`/resources/${resource.id}`}>
                                    <ChevronRight className="h-4 w-4" />
                                  </Link>
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={4} className="text-center text-muted-foreground">
                              No resources found
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </CardContent>
              </Card>
            </Collapsible>
          </div>
          
          <Collapsible className="w-full">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle>Deployment AI Chat</CardTitle>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="w-9 p-0">
                    <Maximize className="h-4 w-4" />
                    <span className="sr-only">Toggle</span>
                  </Button>
                </CollapsibleTrigger>
              </CardHeader>
              <CollapsibleContent>
                <CardContent className="space-y-4">
                  <ScrollArea className="h-[300px] rounded-md border p-4">
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
              </CollapsibleContent>
            </Card>
          </Collapsible>
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
                    <code>{template.code || "No code available"}</code>
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
