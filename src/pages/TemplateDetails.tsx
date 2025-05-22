import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/auth-context";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { CloudTemplate } from "@/types/cloud";
import { mockTemplates } from "@/data/mock-data";
import { ChevronLeft, Save, Play, MessagesSquare, History, FileEdit } from "lucide-react";
import { toast } from "sonner";

const TemplateDetails = () => {
  const { templateId } = useParams();
  const { currentTenant } = useAuth();
  const navigate = useNavigate();
  const [template, setTemplate] = useState<CloudTemplate | null>(null);
  const [code, setCode] = useState("");
  const [aiMessage, setAiMessage] = useState("");
  const [deployDialogOpen, setDeployDialogOpen] = useState(false);
  const [deployName, setDeployName] = useState("");
  const [deployEnv, setDeployEnv] = useState("development");
  
  useEffect(() => {
    if (templateId && currentTenant) {
      const found = mockTemplates.find(
        t => t.id === templateId && t.tenantId === currentTenant.tenant_id
      );
      
      if (found) {
        setTemplate(found);
        setCode(found.code);
        setDeployName(`${found.name}-${deployEnv}`);
      }
    }
  }, [templateId, currentTenant]);
  
  const handleSaveTemplate = () => {
    if (!template) return;
    
    // In a real app, this would save to backend
    setTemplate({
      ...template,
      code: code,
      updatedAt: new Date().toISOString()
    });
    
    toast.success("Template saved successfully");
  };
  
  const handleDeployTemplate = () => {
    // In a real app, this would trigger deployment
    toast.success(`Deploying ${deployName} to ${deployEnv}`);
    setDeployDialogOpen(false);
    navigate("/deployments");
  };
  
  const handleAiSend = () => {
    if (!aiMessage.trim()) return;
    
    // In a real app, this would call an AI service
    toast.success("Message sent to AI assistant");
    setAiMessage("");
  };
  
  const providerColor = (provider: string) => {
    switch (provider) {
      case "azure": return "bg-cloud-azure text-white";
      case "aws": return "bg-cloud-aws text-black";
      case "gcp": return "bg-cloud-gcp text-white";
      default: return "bg-muted text-muted-foreground";
    }
  };

  if (!template) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <div className="text-center">
          <h2 className="text-xl font-semibold">Template not found</h2>
          <p className="text-muted-foreground">The requested template does not exist</p>
          <Button 
            variant="outline" 
            className="mt-4"
            onClick={() => navigate("/catalog")}
          >
            <ChevronLeft className="mr-2 h-4 w-4" />
            Back to Catalog
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
            onClick={() => navigate("/catalog")}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{template.name}</h1>
            <p className="text-muted-foreground">{template.description}</p>
          </div>
        </div>
      </div>
      
      <div className="flex flex-wrap gap-2">
        <Badge className={providerColor(template.provider)}>
          {template.provider.toUpperCase()}
        </Badge>
        
        <Badge variant="outline">
          {template.type === "terraform" ? "Terraform" : 
           template.type === "arm" ? "ARM Template" : "CloudFormation"}
        </Badge>
        
        {template.categories.map(category => (
          <Badge key={category} variant="secondary">
            {category}
          </Badge>
        ))}
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center">
                <FileEdit className="mr-2 h-5 w-5" />
                Template Code
              </CardTitle>
              <div className="flex space-x-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleSaveTemplate}
                >
                  <Save className="mr-2 h-4 w-4" />
                  Save
                </Button>
                
                <Dialog open={deployDialogOpen} onOpenChange={setDeployDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <Play className="mr-2 h-4 w-4" />
                      Deploy
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Deploy Template</DialogTitle>
                      <DialogDescription>
                        Configure deployment settings for this template.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="name">Deployment Name</Label>
                        <Input 
                          id="name" 
                          value={deployName} 
                          onChange={(e) => setDeployName(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Environment</Label>
                        <div className="flex space-x-2">
                          {["development", "staging", "production"].map(env => (
                            <Button
                              key={env}
                              variant={deployEnv === env ? "default" : "outline"}
                              onClick={() => {
                                setDeployEnv(env);
                                setDeployName(`${template.name}-${env}`);
                              }}
                            >
                              {env.charAt(0).toUpperCase() + env.slice(1)}
                            </Button>
                          ))}
                        </div>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setDeployDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleDeployTemplate}>
                        Deploy
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
            <CardDescription>
              Edit the template code below. Click Save to update changes.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              className="font-mono h-[500px] overflow-auto"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </CardContent>
        </Card>
        
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Template Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Provider</p>
                  <p className="font-medium">{template.provider.toUpperCase()}</p>
                </div>
                
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Type</p>
                  <p className="font-medium">
                    {template.type === "terraform" ? "Terraform" : 
                     template.type === "arm" ? "ARM Template" : "CloudFormation"}
                  </p>
                </div>
                
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Deployments</p>
                  <p className="font-medium">{template.deploymentCount}</p>
                </div>
                
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Created</p>
                  <p className="font-medium">
                    {new Date(template.uploadedAt).toLocaleDateString()}
                  </p>
                </div>
                
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Last Updated</p>
                  <p className="font-medium">
                    {new Date(template.updatedAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <MessagesSquare className="mr-2 h-5 w-5" />
                AI Assistant
              </CardTitle>
              <CardDescription>
                Ask questions about this template or request changes
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-muted/50 p-4 rounded-md h-[200px] overflow-auto">
                <div className="space-y-4">
                  <div className="bg-primary/10 p-3 rounded-lg rounded-tl-none max-w-[80%]">
                    <p className="text-sm">
                      Hello! I can help you understand and modify this template. What would you like to know?
                    </p>
                  </div>
                  <div className="flex justify-end">
                    <div className="bg-primary text-primary-foreground p-3 rounded-lg rounded-tr-none max-w-[80%]">
                      <p className="text-sm">
                        Can you explain what this template does?
                      </p>
                    </div>
                  </div>
                  <div className="bg-primary/10 p-3 rounded-lg rounded-tl-none max-w-[80%]">
                    <p className="text-sm">
                      This template creates {
                        template.provider === "azure" ? "Azure resources including a Resource Group, App Service Plan, and App Service for hosting a web application." :
                        template.provider === "aws" ? "AWS resources including an EKS cluster for deploying containerized microservices." :
                        "Google Cloud resources including a Storage Bucket configured for hosting a static website with CDN."
                      }
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="flex space-x-2">
                <Input 
                  placeholder="Ask a question about this template..."
                  value={aiMessage}
                  onChange={(e) => setAiMessage(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAiSend()}
                />
                <Button onClick={handleAiSend}>
                  Send
                </Button>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <History className="mr-2 h-5 w-5" />
                Version History
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm font-medium">Current version</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(template.updatedAt).toLocaleString()}
                    </p>
                  </div>
                  <Badge>Latest</Badge>
                </div>
                
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm font-medium">Initial upload</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(template.uploadedAt).toLocaleString()}
                    </p>
                  </div>
                  <Button variant="outline" size="sm">
                    Restore
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default TemplateDetails;
