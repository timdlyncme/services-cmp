import React, { useState, useEffect } from "react";
import { useParams, Link, useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { deploymentService } from "@/services/deployment-service";
import { CloudResource } from "@/types/cloud";
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
  HardDrive,
  Plus,
  Minus,
  RotateCw,
  PowerOff,
  Maximize,
  Minimize,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

const ResourceDetails = () => {
  const { deploymentId, resourceId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [resource, setResource] = useState<CloudResource | null>(null);
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<string[]>([]);
  const [chatMessage, setChatMessage] = useState("");
  const [chatHistory, setChatHistory] = useState<{role: string, content: string}[]>([
    {role: "system", content: "I'm your Resource AI Assistant. I can help you understand and manage this resource."}
  ]);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isModifyDialogOpen, setIsModifyDialogOpen] = useState(false);
  const [selectedSku, setSelectedSku] = useState("Standard_DS2_v2");
  const [diskCount, setDiskCount] = useState(1);
  
  useEffect(() => {
    const fetchResource = async () => {
      try {
        // Get the resource ID from the URL
        let actualResourceId = resourceId;
        
        // If we're on the /resources/:resourceId route, the resourceId might be the full path
        // We'll use it as is since our backend should handle the full resource ID
        console.log("Current path:", location.pathname);
        console.log("Resource ID from params (encoded):", resourceId);
        
        if (!actualResourceId) {
          toast.error("Resource ID is missing");
          setLoading(false);
          return;
        }
        
        // Decode the resource ID if it's encoded
        try {
          actualResourceId = decodeURIComponent(actualResourceId);
          console.log("Decoded resource ID:", actualResourceId);
        } catch (e) {
          console.warn("Resource ID was not URL-encoded:", e);
          // Continue with the original ID if decoding fails
        }
        
        // Extract the resource name for display purposes
        const resourceName = actualResourceId.includes('/') 
          ? actualResourceId.split('/').pop() 
          : actualResourceId;
        
        console.log("Resource ID (decoded):", actualResourceId);
        console.log("Extracted resource name:", resourceName);
        
        // In a real app, we would fetch the resource from the API using the full resource ID
        // For now, we'll create a mock resource
        const mockResource: CloudResource = {
          id: actualResourceId, // Keep the full resource ID
          name: resourceName || "vm-app-server",
          type: "Microsoft.Compute/virtualMachines",
          location: "eastus",
          status: "Succeeded",
          properties: {
            vmSize: "Standard_DS2_v2",
            osType: "Linux",
            adminUsername: "adminuser",
            networkProfile: {
              networkInterfaces: [
                {
                  id: "/subscriptions/12345/resourceGroups/rg-test/providers/Microsoft.Network/networkInterfaces/nic-app-server"
                }
              ]
            },
            storageProfile: {
              osDisk: {
                name: "os-disk-app-server",
                createOption: "FromImage",
                diskSizeGB: 128
              },
              dataDisks: [
                {
                  name: "data-disk-app-server-1",
                  diskSizeGB: 256,
                  lun: 0
                }
              ]
            }
          },
          tags: {
            environment: "development",
            application: "web-app",
            owner: "devops-team"
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        
        setResource(mockResource);
        
        // Mock logs
        setLogs([
          `${new Date().toISOString()} [INFO] Resource provisioning started`,
          `${new Date().toISOString()} [INFO] Creating virtual machine`,
          `${new Date().toISOString()} [INFO] Configuring network interfaces`,
          `${new Date().toISOString()} [INFO] Attaching storage disks`,
          `${new Date().toISOString()} [INFO] VM provisioning completed successfully`
        ]);
        
        setLoading(false);
      } catch (error) {
        console.error("Error fetching resource:", error);
        toast.error("Failed to load resource details");
        setLoading(false);
      }
    };
    
    fetchResource();
  }, [deploymentId, resourceId, location.pathname]);
  
  const handleAction = (action: string) => {
    toast.success(`${action} action initiated`);
    
    if (action === "restart") {
      setResource({
        ...resource!,
        status: "Restarting"
      });
      
      // Simulate restart completion after 3 seconds
      setTimeout(() => {
        setResource({
          ...resource!,
          status: "Succeeded"
        });
        toast.success("Resource restarted successfully");
      }, 3000);
    } else if (action === "stop") {
      setResource({
        ...resource!,
        status: "Stopping"
      });
      
      // Simulate stop completion after 3 seconds
      setTimeout(() => {
        setResource({
          ...resource!,
          status: "Stopped"
        });
        toast.success("Resource stopped successfully");
      }, 3000);
    } else if (action === "delete") {
      setIsDeleteDialogOpen(false);
      
      setResource({
        ...resource!,
        status: "Deleting"
      });
      
      // Simulate deletion and navigate back after 3 seconds
      setTimeout(() => {
        toast.success("Resource deleted successfully");
        navigate(`/deployments/${deploymentId}`);
      }, 3000);
    } else if (action === "modify") {
      setIsModifyDialogOpen(false);
      
      setResource({
        ...resource!,
        status: "Updating",
        properties: {
          ...resource!.properties,
          vmSize: selectedSku,
          storageProfile: {
            ...resource!.properties.storageProfile,
            dataDisks: Array(diskCount).fill(0).map((_, i) => ({
              name: `data-disk-app-server-${i+1}`,
              diskSizeGB: 256,
              lun: i
            }))
          }
        }
      });
      
      // Simulate update completion after 3 seconds
      setTimeout(() => {
        setResource({
          ...resource!,
          status: "Succeeded"
        });
        toast.success("Resource updated successfully");
      }, 3000);
    }
  };
  
  const handleSendChatMessage = () => {
    if (!chatMessage.trim()) return;
    
    // Add user message to chat history
    setChatHistory([...chatHistory, { role: "user", content: chatMessage }]);
    
    // Simulate AI response
    setTimeout(() => {
      let aiResponse = "I'm analyzing this resource...";
      
      if (chatMessage.toLowerCase().includes("delete")) {
        aiResponse = "I can help you delete this resource. To confirm deletion, please click the Delete button in the top-right corner of this page.";
      } else if (chatMessage.toLowerCase().includes("restart")) {
        aiResponse = "I can help you restart this resource. Click the Restart button in the top-right corner to proceed.";
      } else if (chatMessage.toLowerCase().includes("stop")) {
        aiResponse = "I can help you stop this resource. Click the Stop button in the top-right corner to proceed.";
      } else if (chatMessage.toLowerCase().includes("disk") || chatMessage.toLowerCase().includes("storage")) {
        aiResponse = `This resource has ${resource?.properties.storageProfile.dataDisks.length} data disk(s) attached. The OS disk size is ${resource?.properties.storageProfile.osDisk.diskSizeGB} GB. You can modify storage by clicking the Modify button.`;
      } else if (chatMessage.toLowerCase().includes("size") || chatMessage.toLowerCase().includes("sku")) {
        aiResponse = `The current VM size is ${resource?.properties.vmSize}. You can change the size by clicking the Modify button.`;
      } else if (chatMessage.toLowerCase().includes("status")) {
        aiResponse = `The current status of this resource is "${resource?.status}".`;
      }
      
      setChatHistory([...chatHistory, { role: "user", content: chatMessage }, { role: "assistant", content: aiResponse }]);
      setChatMessage("");
    }, 1000);
  };
  
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Succeeded":
        return <Badge variant="success">{status}</Badge>;
      case "Failed":
        return <Badge variant="destructive">{status}</Badge>;
      case "Stopped":
        return <Badge variant="outline">{status}</Badge>;
      case "Restarting":
      case "Stopping":
      case "Updating":
      case "Deleting":
        return <Badge variant="secondary">{status}</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };
  
  if (loading) {
    return <div className="flex items-center justify-center h-64">Loading resource details...</div>;
  }
  
  if (!resource) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <AlertCircle className="h-10 w-10 text-muted-foreground mb-4" />
        <h2 className="text-xl font-medium">Resource not found</h2>
        <p className="text-muted-foreground mt-2">
          The requested resource could not be found.
        </p>
        <Button variant="outline" className="mt-4" asChild>
          <Link to={`/deployments/${deploymentId}`}>Return to deployment</Link>
        </Button>
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" asChild>
          <Link to={`/deployments/${deploymentId}`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{resource.name}</h1>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Type: {resource.type.split('/').pop()}</span>
            <span>•</span>
            <span>Location: {resource.location}</span>
            <span>•</span>
            {getStatusBadge(resource.status)}
          </div>
        </div>
        <div className="ml-auto flex gap-2">
          {resource.status === "Succeeded" && (
            <>
              <Button variant="outline" onClick={() => handleAction("stop")}>
                <PowerOff className="h-4 w-4 mr-2" />
                Stop
              </Button>
              <Button variant="outline" onClick={() => handleAction("restart")}>
                <RotateCw className="h-4 w-4 mr-2" />
                Restart
              </Button>
            </>
          )}
          
          {resource.status === "Stopped" && (
            <Button variant="outline" onClick={() => handleAction("restart")}>
              <Play className="h-4 w-4 mr-2" />
              Start
            </Button>
          )}
          
          <Button variant="outline" onClick={() => setIsModifyDialogOpen(true)}>
            <Settings className="h-4 w-4 mr-2" />
            Modify
          </Button>
          
          <Button variant="destructive" onClick={() => setIsDeleteDialogOpen(true)}>
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </Button>
        </div>
      </div>
      
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="properties">Properties</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
          <TabsTrigger value="chat">AI Chat</TabsTrigger>
        </TabsList>
        
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Collapsible className="w-full">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-xl font-bold">Resource Details</CardTitle>
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
                        <p className="text-sm font-medium text-muted-foreground">Resource ID</p>
                        <p className="text-sm font-medium">{resource.id}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Type</p>
                        <p className="text-sm font-medium">{resource.type}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Location</p>
                        <p className="text-sm font-medium">{resource.location}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Status</p>
                        <div className="flex items-center">
                          {getStatusBadge(resource.status)}
                          {resource.status === "Succeeded" && (
                            <p className="text-sm ml-2 text-green-600">Resource is healthy and operational</p>
                          )}
                        </div>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Created</p>
                        <p className="text-sm font-medium">{new Date(resource.createdAt).toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Last Updated</p>
                        <p className="text-sm font-medium">{new Date(resource.updatedAt).toLocaleString()}</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Collapsible>
            
            <Collapsible className="w-full">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-xl font-bold">Configuration</CardTitle>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm" className="w-9 p-0">
                      <Maximize className="h-4 w-4" />
                      <span className="sr-only">Toggle</span>
                    </Button>
                  </CollapsibleTrigger>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">VM Size</p>
                      <p className="text-sm font-medium">{resource.properties.vmSize}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">OS Type</p>
                      <p className="text-sm font-medium">{resource.properties.osType}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Admin Username</p>
                      <p className="text-sm font-medium">{resource.properties.adminUsername}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">OS Disk</p>
                      <p className="text-sm font-medium">
                        {resource.properties.storageProfile.osDisk.name} ({resource.properties.storageProfile.osDisk.diskSizeGB} GB)
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Data Disks</p>
                      <div className="space-y-2">
                        {resource.properties.storageProfile.dataDisks.map((disk, index) => (
                          <p key={index} className="text-sm font-medium">
                            {disk.name} ({disk.diskSizeGB} GB)
                          </p>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Collapsible>
            
            <Collapsible className="w-full">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-xl font-bold">Tags</CardTitle>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm" className="w-9 p-0">
                      <Maximize className="h-4 w-4" />
                      <span className="sr-only">Toggle</span>
                    </Button>
                  </CollapsibleTrigger>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {Object.entries(resource.tags).map(([key, value], index) => (
                      <div key={index}>
                        <p className="text-sm font-medium text-muted-foreground">{key}</p>
                        <p className="text-sm font-medium">{value}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </Collapsible>
            
            <Collapsible className="w-full">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-xl font-bold">Networking</CardTitle>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm" className="w-9 p-0">
                      <Maximize className="h-4 w-4" />
                      <span className="sr-only">Toggle</span>
                    </Button>
                  </CollapsibleTrigger>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Network Interfaces</p>
                      <div className="space-y-2">
                        {resource.properties.networkProfile.networkInterfaces.map((nic, index) => (
                          <p key={index} className="text-sm font-medium">
                            {nic.id.split('/').pop()}
                          </p>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Collapsible>
          </div>
        </TabsContent>
        
        <TabsContent value="properties" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Resource Properties</CardTitle>
              <CardDescription>
                Detailed properties of this resource
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <pre className="p-4 text-sm bg-muted rounded-md">
                  {JSON.stringify(resource.properties, null, 2)}
                </pre>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="logs" className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Resource Logs</CardTitle>
                <CardDescription>
                  Log output from the resource
                </CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={() => toast.success("Logs refreshed")}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
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
        
        <TabsContent value="chat" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Resource AI Chat</CardTitle>
              <CardDescription>
                Chat with the AI to learn more about this resource
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
                      Start chatting with the Resource AI to get help and insights
                    </div>
                  )}
                </div>
              </ScrollArea>
              
              <div className="flex gap-2">
                <Textarea 
                  placeholder="Ask a question about this resource..." 
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
                <Badge variant="outline" className="cursor-pointer hover:bg-accent" onClick={() => setChatMessage("What's the status of this resource?")}>
                  Check status
                </Badge>
                <Badge variant="outline" className="cursor-pointer hover:bg-accent" onClick={() => setChatMessage("Tell me about the storage configuration")}>
                  Storage info
                </Badge>
                <Badge variant="outline" className="cursor-pointer hover:bg-accent" onClick={() => setChatMessage("What size is this VM?")}>
                  VM size
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
            <DialogTitle>Delete Resource</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this resource? This action cannot be undone.
              All data associated with this resource will be permanently removed.
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
      
      {/* Modify Resource Dialog */}
      <Dialog open={isModifyDialogOpen} onOpenChange={setIsModifyDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modify Resource</DialogTitle>
            <DialogDescription>
              Update the configuration of this resource.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">VM Size</label>
              <Select value={selectedSku} onValueChange={setSelectedSku}>
                <SelectTrigger>
                  <SelectValue placeholder="Select VM size" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Standard_DS1_v2">Standard_DS1_v2 (1 vCPU, 3.5 GB)</SelectItem>
                  <SelectItem value="Standard_DS2_v2">Standard_DS2_v2 (2 vCPU, 7 GB)</SelectItem>
                  <SelectItem value="Standard_DS3_v2">Standard_DS3_v2 (4 vCPU, 14 GB)</SelectItem>
                  <SelectItem value="Standard_DS4_v2">Standard_DS4_v2 (8 vCPU, 28 GB)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Data Disks</label>
              <div className="flex items-center gap-4">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setDiskCount(Math.max(1, diskCount - 1))}
                  disabled={diskCount <= 1}
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <span>{diskCount} disk(s)</span>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setDiskCount(Math.min(8, diskCount + 1))}
                  disabled={diskCount >= 8}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsModifyDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => handleAction("modify")}>
              Apply Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ResourceDetails;
