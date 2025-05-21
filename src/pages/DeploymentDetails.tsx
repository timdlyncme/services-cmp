import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
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
import { CloudDeployment, CloudTemplate } from "@/types/cloud";
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
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

const DeploymentDetails = () => {
  const { deploymentId } = useParams();
  const { currentTenant } = useAuth();
  const [deployment, setDeployment] = useState<CloudDeployment | null>(null);
  const [template, setTemplate] = useState<CloudTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<string[]>([]);
  const [chatMessage, setChatMessage] = useState("");
  const [chatHistory, setChatHistory] = useState<{role: string, content: string}[]>([
    {role: "system", content: "I'm your Deployment AI Assistant. I can help you understand and manage your deployment."}
  ]);
  const [newTemplateVersionAvailable, setNewTemplateVersionAvailable] = useState(false);
  
  useEffect(() => {
    const fetchDeployment = async () => {
      try {
        if (!deploymentId) return;
        
        // Fetch deployment from API
        const deploymentData = await deploymentService.getDeployment(deploymentId);
        
        if (deploymentData) {
          setDeployment(deploymentData);
          
          // Fetch template data
          if (deploymentData.templateId) {
            try {
              // In a real app, we would fetch the template from the API
              const templates = await deploymentService.getTemplates(currentTenant?.tenant_id || "");
              const associatedTemplate = templates.find(t => t.id === deploymentData.templateId);
              
              if (associatedTemplate) {
                setTemplate(associatedTemplate);
                
                // In a real scenario, we would check for newer template versions
                // For demo purposes, we'll simulate a newer version available
                setNewTemplateVersionAvailable(Math.random() > 0.5);
              }
            } catch (error) {
              console.error("Error fetching template:", error);
            }
          }
          
          // Generate some mock logs (in a real app, these would come from the API)
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
        toast.error("Failed to load deployment details");
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
        ...deployment!,
        status: "running"
      });
    } else if (action === "stop") {
      setDeployment({
        ...deployment!,
        status: "stopped"
      });
    } else if (action === "upgrade") {
      setLogs([
        ...logs,
        `${new Date().toISOString()} [INFO] Starting template upgrade...`,
        `${new Date().toISOString()} [INFO] Validating new template version...`,
        `${new Date().toISOString()} [INFO] Initiating rolling update...`
      ]);
      
      toast.success("Deployment upgrade started");
      setNewTemplateVersionAvailable(false);
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
          {newTemplateVersionAvailable && (
            <Button variant="secondary" onClick={() => handleAction("upgrade")}>
              <GitCompare className="h-4 w-4 mr-2" />
              Upgrade
            </Button>
          )}
          
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
        <TabsList className="grid w-full grid-cols-5 lg:w-[600px]">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="template">Template</TabsTrigger>
          <TabsTrigger value="parameters">Parameters</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
          <TabsTrigger value="diagram">Diagram</TabsTrigger>
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
                  <div>{deployment.region || "Not specified"}</div>
                  
                  <div className="font-medium">Provider</div>
                  <div>{deployment.provider}</div>
                  
                  <div className="font-medium">Template</div>
                  <div>{deployment.templateName}</div>
                  
                  <div className="font-medium">Created</div>
                  <div>{new Date(deployment.createdAt).toLocaleString()}</div>
                  
                  <div className="font-medium">Last Updated</div>
                  <div>{new Date(deployment.updatedAt).toLocaleString()}</div>
                </div>
              </CardContent>
            </Card>
            
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
                      <TableHead>Details</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {deployment.resources && deployment.resources.length > 0 ? (
                      deployment.resources.map((resource, index) => (
                        <TableRow key={index}>
                          <TableCell className="font-medium">
                            {typeof resource === 'string' 
                              ? resource.split(':')[1]?.trim() || resource 
                              : resource.name || 'Unknown'}
                          </TableCell>
                          <TableCell>
                            {typeof resource === 'string'
                              ? resource.split(':')[0]?.trim() || 'Resource'
                              : resource.type || 'Unknown'}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center">
                              <CheckCircle className="h-4 w-4 text-green-500 mr-1" />
                              <span>Deployed</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="sm">View Details</Button>
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
              </CardContent>
            </Card>
          </div>
          
          <Card>
            <CardHeader>
              <CardTitle>Deployment AI Chat</CardTitle>
              <CardDescription>
                Chat with the AI to learn more about your deployment
              </CardDescription>
            </CardHeader>
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
    </div>
  );
};

export default DeploymentDetails;
