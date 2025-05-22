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
import { cmpService } from "@/services/cmp-service";

interface TemplateVersion {
  id: number;
  version: string;
  changes: string;
  created_at: string;
  created_by: string;
  is_current: boolean;
}

const TemplateDetails = () => {
  const { templateId } = useParams();
  const { currentTenant } = useAuth();
  const navigate = useNavigate();
  const [template, setTemplate] = useState<CloudTemplate | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingVersions, setLoadingVersions] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [aiMessage, setAiMessage] = useState("");
  const [deployDialogOpen, setDeployDialogOpen] = useState(false);
  const [deployName, setDeployName] = useState("");
  const [deployEnv, setDeployEnv] = useState("development");
  const [versions, setVersions] = useState<TemplateVersion[]>([]);
  
  const fetchVersions = async (templateId: string) => {
    try {
      setLoadingVersions(true);
      const response = await fetch(`http://localhost:8000/api/templates/${templateId}/versions`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setVersions(data);
      } else {
        console.error("Failed to fetch template versions");
      }
    } catch (err) {
      console.error("Error fetching template versions:", err);
    } finally {
      setLoadingVersions(false);
    }
  };
  
  useEffect(() => {
    const fetchTemplate = async () => {
      if (!templateId) {
        setError("No template ID provided");
        setLoading(false);
        return;
      }
      
      try {
        setLoading(true);
        const templateData = await cmpService.getTemplate(templateId);
        
        if (templateData) {
          setTemplate(templateData);
          setCode(templateData.code || "");
          setDeployName(`${templateData.name}-${deployEnv}`);
          
          // Fetch template versions
          await fetchVersions(templateId);
        } else {
          setError("Template not found");
        }
      } catch (err) {
        console.error("Error fetching template:", err);
        setError("Failed to load template details");
      } finally {
        setLoading(false);
      }
    };
    
    fetchTemplate();
  }, [templateId]);
  
  const handleSaveTemplate = async () => {
    if (!template) return;
    
    try {
      const updatedTemplate = await cmpService.updateTemplate(template.id, {
        ...template,
        code: code
      });
      
      if (updatedTemplate) {
        setTemplate(updatedTemplate);
        toast.success("Template saved successfully");
        
        // Refresh versions after save
        if (templateId) {
          await fetchVersions(templateId);
        }
      }
    } catch (err) {
      console.error("Error saving template:", err);
      toast.error("Failed to save template");
    }
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
  
  const handleRestoreVersion = async (version: TemplateVersion) => {
    if (!template || !templateId) return;
    
    try {
      // Fetch the version's code
      const response = await fetch(`http://localhost:8000/api/templates/${templateId}/versions/${version.id}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        const versionData = await response.json();
        
        // Update the template with this version's code
        const updatedTemplate = await cmpService.updateTemplate(template.id, {
          ...template,
          code: versionData.code
        });
        
        if (updatedTemplate) {
          setTemplate(updatedTemplate);
          setCode(updatedTemplate.code || "");
          toast.success(`Restored to version ${version.version}`);
          
          // Refresh versions
          await fetchVersions(templateId);
        }
      } else {
        toast.error("Failed to restore version");
      }
    } catch (err) {
      console.error("Error restoring version:", err);
      toast.error("Failed to restore version");
    }
  };
  
  const providerColor = (provider: string) => {
    switch (provider) {
      case "azure": return "bg-cloud-azure text-white";
      case "aws": return "bg-cloud-aws text-black";
      case "gcp": return "bg-cloud-gcp text-white";
      default: return "bg-muted text-muted-foreground";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <div className="text-center">
          <h2 className="text-xl font-semibold">Loading template...</h2>
        </div>
      </div>
    );
  }

  if (error || !template) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <div className="text-center">
          <h2 className="text-xl font-semibold">Template not found</h2>
          <p className="text-muted-foreground">{error || "The requested template does not exist"}</p>
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
        
        {template.categories && template.categories.map(category => (
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
              {loadingVersions ? (
                <div className="text-center py-4">
                  <p>Loading versions...</p>
                </div>
              ) : versions.length === 0 ? (
                <div className="text-center py-4">
                  <p className="text-muted-foreground">No version history available</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {versions.map((version) => (
                    <div key={version.id} className="flex justify-between items-center">
                      <div>
                        <p className="text-sm font-medium">Version {version.version}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(version.created_at).toLocaleString()}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {version.changes}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          By: {version.created_by}
                        </p>
                      </div>
                      {version.is_current ? (
                        <Badge>Current</Badge>
                      ) : (
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleRestoreVersion(version)}
                        >
                          Restore
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default TemplateDetails;
