
import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle, 
  AlertDialogTrigger 
} from "@/components/ui/alert-dialog";
import { ChevronLeft, RefreshCw, Play, Square, Trash2, FileCode, Terminal } from "lucide-react";
import { CloudDeployment } from "@/types/cloud";
import { mockDeployments, mockTemplates } from "@/data/mock-data";
import { toast } from "sonner";

const DeploymentDetails = () => {
  const { deploymentId } = useParams();
  const { currentTenant } = useAuth();
  const navigate = useNavigate();
  const [deployment, setDeployment] = useState<CloudDeployment | null>(null);
  const [templateCode, setTemplateCode] = useState("");
  const [logs, setLogs] = useState<string[]>([
    "[2023-06-10 14:10:05] Initializing deployment...",
    "[2023-06-10 14:10:10] Validating template...",
    "[2023-06-10 14:10:15] Preparing resources...",
    "[2023-06-10 14:10:30] Creating resource group...",
    "[2023-06-10 14:11:00] Deploying virtual machine scale set...",
    "[2023-06-10 14:14:30] Deployment completed with 0 errors."
  ]);
  
  useEffect(() => {
    if (deploymentId && currentTenant) {
      const found = mockDeployments.find(
        d => d.id === deploymentId && d.tenantId === currentTenant.id
      );
      
      if (found) {
        setDeployment(found);
        
        // Find template code
        const template = mockTemplates.find(t => t.id === found.templateId);
        if (template) {
          setTemplateCode(template.code);
        }
      }
    }
  }, [deploymentId, currentTenant]);
  
  const handleRestart = () => {
    toast.success("Deployment is restarting...");
    // In a real app, this would trigger a restart
  };
  
  const handleStop = () => {
    toast.success("Deployment is stopping...");
    // In a real app, this would trigger a stop
  };
  
  const handleDelete = () => {
    toast.success("Deployment has been deleted");
    navigate("/deployments");
    // In a real app, this would delete the deployment
  };

  const providerColor = (provider: string) => {
    switch (provider) {
      case "azure": return "bg-cloud-azure text-white";
      case "aws": return "bg-cloud-aws text-black";
      case "gcp": return "bg-cloud-gcp text-white";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const statusVariant = (status: string) => {
    switch (status) {
      case "running": return "success";
      case "pending":
      case "deploying": return "warning";
      case "failed": return "destructive";
      default: return "secondary";
    }
  };

  if (!deployment) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <div className="text-center">
          <h2 className="text-xl font-semibold">Deployment not found</h2>
          <p className="text-muted-foreground">The requested deployment does not exist</p>
          <Button 
            variant="outline" 
            className="mt-4"
            onClick={() => navigate("/deployments")}
          >
            <ChevronLeft className="mr-2 h-4 w-4" />
            Back to Deployments
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button 
            variant="outline" 
            size="icon"
            onClick={() => navigate("/deployments")}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-3xl font-bold tracking-tight">{deployment.name}</h1>
              <Badge variant={statusVariant(deployment.status)} className="ml-2">
                {deployment.status}
              </Badge>
            </div>
            <div className="flex space-x-2 mt-1">
              <Badge className={providerColor(deployment.provider)}>
                {deployment.provider.toUpperCase()}
              </Badge>
              <Badge variant="outline">{deployment.environment}</Badge>
            </div>
          </div>
        </div>
        
        <div className="flex space-x-2">
          <Button 
            variant="outline" 
            onClick={handleRestart}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Restart
          </Button>
          
          {deployment.status === "running" ? (
            <Button 
              variant="secondary"
              onClick={handleStop}
            >
              <Square className="mr-2 h-4 w-4" />
              Stop
            </Button>
          ) : (
            <Button 
              variant="secondary"
              onClick={() => toast.success("Deployment is starting...")}
            >
              <Play className="mr-2 h-4 w-4" />
              Start
            </Button>
          )}
          
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive">
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete the deployment "{deployment.name}" and all associated resources. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete}>
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
      
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="template">Template</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
          <TabsTrigger value="resources">Resources</TabsTrigger>
        </TabsList>
        
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Deployment Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Created</p>
                    <p className="font-medium">{new Date(deployment.createdAt).toLocaleDateString()}</p>
                  </div>
                  
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Last Updated</p>
                    <p className="font-medium">{new Date(deployment.updatedAt).toLocaleDateString()}</p>
                  </div>
                  
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Template</p>
                    <p className="font-medium">{deployment.templateName}</p>
                  </div>
                  
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Environment</p>
                    <p className="font-medium">{deployment.environment}</p>
                  </div>
                  
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Provider</p>
                    <p className="font-medium">{deployment.provider.toUpperCase()}</p>
                  </div>
                </div>
              </CardContent>
              <CardFooter>
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={() => navigate(`/catalog/${deployment.templateId}`)}
                >
                  View Template
                </Button>
              </CardFooter>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Parameters</CardTitle>
                <CardDescription>
                  Configuration values used in this deployment
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(deployment.parameters).map(([key, value]) => (
                    <div key={key} className="grid grid-cols-2 gap-2">
                      <div className="font-medium text-sm">{key}</div>
                      <div className="text-sm truncate">{value}</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Status</CardTitle>
                <CardDescription>
                  Current state of the deployment
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <div className={`status-dot status-${
                      deployment.status === "running" ? "healthy" : 
                      deployment.status === "pending" || deployment.status === "deploying" ? "warning" : 
                      "error"
                    }`} />
                    <span className="capitalize">{deployment.status}</span>
                  </div>
                  
                  <div className="text-sm">
                    {deployment.status === "running" ? (
                      <p>All resources are healthy and operating normally.</p>
                    ) : deployment.status === "pending" ? (
                      <p>Deployment is waiting to be processed.</p>
                    ) : deployment.status === "deploying" ? (
                      <p>Resources are currently being deployed.</p>
                    ) : deployment.status === "failed" ? (
                      <p>Deployment failed. Check logs for details.</p>
                    ) : (
                      <p>Deployment is stopped. Resources are not active.</p>
                    )}
                  </div>
                  
                  <div className="text-xs text-muted-foreground">
                    Last updated: {new Date(deployment.updatedAt).toLocaleString()}
                  </div>
                </div>
              </CardContent>
              <CardFooter>
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={handleRestart}
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Refresh Status
                </Button>
              </CardFooter>
            </Card>
          </div>
        </TabsContent>
        
        <TabsContent value="template">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center">
                    <FileCode className="mr-2 h-5 w-5" />
                    Template Code
                  </CardTitle>
                  <CardDescription>
                    Template used to create this deployment
                  </CardDescription>
                </div>
                <Button 
                  variant="outline"
                  onClick={() => navigate(`/catalog/${deployment.templateId}`)}
                >
                  Edit Template
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Textarea
                className="font-mono h-[500px] overflow-auto"
                value={templateCode}
                readOnly
              />
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="logs">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center">
                    <Terminal className="mr-2 h-5 w-5" />
                    Deployment Logs
                  </CardTitle>
                  <CardDescription>
                    Activity logs for this deployment
                  </CardDescription>
                </div>
                <Button 
                  variant="outline"
                  onClick={() => toast.success("Logs refreshed")}
                >
                  Refresh Logs
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="font-mono text-sm bg-black text-white p-4 rounded-md h-[500px] overflow-auto">
                {logs.map((log, index) => (
                  <div key={index} className="pb-1">
                    {log}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="resources">
          <Card>
            <CardHeader>
              <CardTitle>Deployed Resources</CardTitle>
              <CardDescription>
                Cloud resources created by this deployment
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {deployment.resources.map((resource, index) => (
                  <div 
                    key={index}
                    className="p-4 border rounded-lg flex justify-between items-center"
                  >
                    <div>
                      <p className="font-medium">{resource}</p>
                      <p className="text-xs text-muted-foreground">
                        {deployment.provider.toUpperCase()} · {deployment.environment}
                      </p>
                    </div>
                    <Button variant="outline" size="sm">
                      View Details
                    </Button>
                  </div>
                ))}
                
                {deployment.resources.length === 0 && (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">No resources found</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default DeploymentDetails;
