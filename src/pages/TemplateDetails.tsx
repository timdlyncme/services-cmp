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
import { CloudTemplate, TemplateParameter, TemplateVariable } from "@/types/cloud";
import { ChevronLeft, Save, Play, MessagesSquare, History, FileEdit, Plus, Trash2, ChevronDown, ChevronUp, Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cmpService } from "@/services/cmp-service";
import { deploymentService } from "@/services/deployment-service";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface TemplateVersion {
  id: number;
  version: string;
  changes: string;
  created_at: string;
  created_by: string;
  is_current: boolean;
}

interface Environment {
  id: string;
  name: string;
  description: string;
  provider: string;
  tenantId: string;
  internal_id: number; // Add internal_id to the environment
}

const TemplateDetails = () => {
  const { templateId } = useParams();
  const { currentTenant } = useAuth();
  const navigate = useNavigate();
  const [template, setTemplate] = useState<CloudTemplate | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingVersions, setLoadingVersions] = useState<boolean>(false);
  const [loadingEnvironments, setLoadingEnvironments] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [aiMessage, setAiMessage] = useState("");
  const [deployDialogOpen, setDeployDialogOpen] = useState(false);
  const [deployName, setDeployName] = useState("");
  const [deployEnv, setDeployEnv] = useState("");
  const [versions, setVersions] = useState<TemplateVersion[]>([]);
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [parameters, setParameters] = useState<Record<string, TemplateParameter>>({});
  const [variables, setVariables] = useState<Record<string, TemplateVariable>>({});
  const [deploymentParameters, setDeploymentParameters] = useState<Record<string, TemplateParameter>>({});
  const [deploymentVariables, setDeploymentVariables] = useState<Record<string, TemplateVariable>>({});
  const [codeExpanded, setCodeExpanded] = useState(true);
  const [paramsExpanded, setParamsExpanded] = useState(true);
  const [showPasswordValues, setShowPasswordValues] = useState<Record<string, boolean>>({});
  const [deploymentInProgress, setDeploymentInProgress] = useState(false);
  
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
  
  const fetchEnvironments = async () => {
    try {
      setLoadingEnvironments(true);
      const response = await fetch(`http://localhost:8000/api/environments/?tenant_id=${currentTenant?.tenant_id || ''}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setEnvironments(data);
        
        // Set default environment if available
        if (data.length > 0) {
          setDeployEnv(data[0].id);
        }
      } else {
        console.error("Failed to fetch environments");
        toast.error("Failed to load environments");
      }
    } catch (err) {
      console.error("Error fetching environments:", err);
      toast.error("Error loading environments");
    } finally {
      setLoadingEnvironments(false);
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
          
          // Initialize parameters and variables from template data
          if (templateData.parameters) {
            console.log("Loading parameters from template:", templateData.parameters);
            setParameters(templateData.parameters);
          } else {
            console.log("No parameters found in template data");
            setParameters({});
          }
          
          if (templateData.variables) {
            console.log("Loading variables from template:", templateData.variables);
            setVariables(templateData.variables);
          } else {
            console.log("No variables found in template data");
            setVariables({});
          }
          
          // Fetch template versions
          await fetchVersions(templateId);
          
          // Fetch environments
          await fetchEnvironments();
          
          // Set default deployment name
          if (templateData.name) {
            setDeployName(`${templateData.name}-deployment`);
          }
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
      // Check if the code has changed - only create a new version if code has changed
      const codeHasChanged = code !== template.code;
      
      const updatedTemplate = await cmpService.updateTemplate(template.id, {
        ...template,
        code: code,
        parameters: parameters,
        variables: variables,
        // Add a flag to indicate if this should create a new version
        create_new_version: codeHasChanged
      });
      
      if (updatedTemplate) {
        setTemplate(updatedTemplate);
        
        if (codeHasChanged) {
          toast.success("Template saved successfully and new version created");
        } else {
          toast.success("Template parameters and variables saved successfully");
        }
        
        // Refresh versions after save if code has changed
        if (templateId && codeHasChanged) {
          await fetchVersions(templateId);
        }
      }
    } catch (err) {
      console.error("Error saving template:", err);
      toast.error("Failed to save template");
    }
  };

  const handleSaveCodeWithNewVersion = async () => {
    if (!template) return;
    
    try {
      const updatedTemplate = await cmpService.updateTemplate(template.id, {
        ...template,
        code: code,
        // Always create a new version when using this function
        create_new_version: true
      });
      
      if (updatedTemplate) {
        setTemplate(updatedTemplate);
        toast.success("New template version created successfully");
        
        // Refresh versions
        if (templateId) {
          await fetchVersions(templateId);
        }
      }
    } catch (err) {
      console.error("Error creating new template version:", err);
      toast.error("Failed to create new template version");
    }
  };

  const handleSaveParamsAndVariables = async () => {
    if (!template) return;
    
    try {
      const updatedTemplate = await cmpService.updateTemplate(template.id, {
        ...template,
        parameters: parameters,
        variables: variables,
        // Never create a new version when using this function
        create_new_version: false
      });
      
      if (updatedTemplate) {
        setTemplate(updatedTemplate);
        toast.success("Template parameters and variables saved successfully");
      }
    } catch (err) {
      console.error("Error saving template parameters and variables:", err);
      toast.error("Failed to save template parameters and variables");
    }
  };
  
  const handleOpenDeployDialog = () => {
    // Initialize deployment parameters and variables with current values
    setDeploymentParameters(JSON.parse(JSON.stringify(parameters)));
    setDeploymentVariables(JSON.parse(JSON.stringify(variables)));
    setDeployDialogOpen(true);
  };
  
  const handleDeployTemplate = async () => {
    if (!template || !deployEnv || !deployName) {
      toast.error("Please provide all required deployment information");
      return;
    }
    
    try {
      setDeploymentInProgress(true);
      
      // Find the selected environment to get its name and environment_id
      const selectedEnvironment = environments.find(env => env.id === deployEnv);
      if (!selectedEnvironment) {
        toast.error("Selected environment not found");
        setDeploymentInProgress(false);
        return;
      }
      
      // Map ARM template type to 'native' for the backend
      const backendDeploymentType = template.type === 'arm' ? 'native' : template.type;
      
      // Ensure template code is a string, not undefined or null
      const templateCode = template.code || "";
      
      // Prepare the deployment data - use deploymentParameters and deploymentVariables instead
      const deploymentData = {
        name: deployName,
        description: `Deployment of ${template.name}`,
        template_id: template.id,
        environment_id: selectedEnvironment.internal_id,
        environment_name: selectedEnvironment.name,
        provider: template.provider,
        deployment_type: backendDeploymentType,
        template_source: "code",
        template_code: templateCode,
        parameters: deploymentParameters || {}, // Use deployment-specific parameters
        variables: deploymentVariables || {}, // Add variables to deployment data
        template_version: template.currentVersion
      };
      
      console.log("Deployment data:", JSON.stringify(deploymentData));
      
      // Use the deployment service to create the deployment
      const deploymentResponse = await deploymentService.createDeployment(deploymentData, currentTenant?.tenant_id || "");
      
      toast.success(`Deployment "${deployName}" has been submitted successfully`, {
        description: "You will be redirected to the deployments page to monitor progress.",
        action: {
          label: "View Deployments",
          onClick: () => navigate("/deployments")
        },
        duration: 5000
      });
      
      // Close the dialog and navigate to deployments page
      setDeployDialogOpen(false);
      navigate("/deployments");
    } catch (err) {
      console.error("Error creating deployment:", err);
      toast.error("Failed to create deployment");
    } finally {
      setDeploymentInProgress(false);
    }
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
  
  const addParameter = () => {
    const newKey = `param${Object.keys(parameters).length + 1}`;
    setParameters({
      ...parameters,
      [newKey]: {
        value: "",
        type: "string"
      }
    });
  };
  
  const removeParameter = (key: string) => {
    const newParams = { ...parameters };
    delete newParams[key];
    setParameters(newParams);
  };
  
  const updateParameter = (key: string, field: keyof TemplateParameter, value: string) => {
    setParameters({
      ...parameters,
      [key]: {
        ...parameters[key],
        [field]: value
      }
    });
  };
  
  const renameParameter = (oldKey: string, newKey: string) => {
    if (oldKey === newKey) return;
    
    // Check if the new key already exists
    if (parameters[newKey]) {
      toast.error(`Parameter with name "${newKey}" already exists`);
      return;
    }
    
    const newParams = { ...parameters };
    newParams[newKey] = newParams[oldKey];
    delete newParams[oldKey];
    setParameters(newParams);
  };
  
  const addVariable = () => {
    const newKey = `var${Object.keys(variables).length + 1}`;
    setVariables({
      ...variables,
      [newKey]: {
        value: "",
        type: "string"
      }
    });
  };
  
  const removeVariable = (key: string) => {
    const newVars = { ...variables };
    delete newVars[key];
    setVariables(newVars);
  };
  
  const updateVariable = (key: string, field: keyof TemplateVariable, value: string) => {
    setVariables({
      ...variables,
      [key]: {
        ...variables[key],
        [field]: value
      }
    });
  };
  
  const renameVariable = (oldKey: string, newKey: string) => {
    if (oldKey === newKey) return;
    
    // Check if the new key already exists
    if (variables[newKey]) {
      toast.error(`Variable with name "${newKey}" already exists`);
      return;
    }
    
    const newVars = { ...variables };
    newVars[newKey] = newVars[oldKey];
    delete newVars[oldKey];
    setVariables(newVars);
  };
  
  const togglePasswordVisibility = (key: string) => {
    setShowPasswordValues({
      ...showPasswordValues,
      [key]: !showPasswordValues[key]
    });
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
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex justify-between items-center">
        <Button variant="outline" onClick={() => navigate(-1)}>
          <ChevronLeft className="mr-2 h-4 w-4" />
          Back to Templates
        </Button>
        <div className="space-x-2">
          <Button style={{ backgroundColor: "darkorange" }} onClick={handleOpenDeployDialog}>
            <Play className="mr-2 h-4 w-4" />
            Deploy Template
          </Button>
        </div>
      </div>
      
      {/* Add back the Dialog component for deployment */}
      <Dialog open={deployDialogOpen} onOpenChange={setDeployDialogOpen}>
        <DialogContent className="sm:max-w-[700px]"> {/* Increased width from default */}
          <DialogHeader>
            <DialogTitle>Deploy Template</DialogTitle>
            <DialogDescription>
              Configure deployment settings for this template.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="deployName">Deployment Name</Label>
              <Input 
                id="deployName" 
                value={deployName} 
                onChange={(e) => setDeployName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="deployEnv">Environment</Label>
              <Select 
                value={deployEnv} 
                onValueChange={setDeployEnv}
                disabled={deploymentInProgress}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select an environment" />
                </SelectTrigger>
                <SelectContent>
                  {environments.map((env) => (
                    <SelectItem key={env.id} value={env.id}>
                      {env.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {/* Parameters section - updated to use deploymentParameters */}
            {Object.keys(deploymentParameters).length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-medium">Parameters</h3>
                <div className="space-y-2">
                  {Object.entries(deploymentParameters).map(([key, param]) => (
                    <div key={key} className="grid grid-cols-12 gap-2 items-start">
                      <div className="col-span-3">
                        <Label>Name</Label>
                        <Input 
                          value={key}
                          disabled={true}
                        />
                      </div>
                      <div className="col-span-3">
                        <Label>Type</Label>
                        <Input
                          value={param.type}
                          disabled={true}
                        />
                      </div>
                      <div className="col-span-6">
                        <Label>Value</Label>
                        {param.type === "password" ? (
                          <div className="relative">
                            <Input 
                              type={showPasswordValues[key] ? "text" : "password"}
                              value={param.value}
                              onChange={(e) => updateDeploymentParameter(key, "value", e.target.value)}
                              className="pr-8"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="absolute right-0 top-0 h-full"
                              onClick={() => togglePasswordVisibility(key)}
                            >
                              {showPasswordValues[key] ? (
                                <EyeOff className="h-4 w-4" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        ) : (
                          <Input 
                            type={param.type === "int" ? "number" : "text"}
                            value={param.value}
                            onChange={(e) => updateDeploymentParameter(key, "value", e.target.value)}
                          />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Variables section - updated to use deploymentVariables */}
            {Object.keys(deploymentVariables).length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-medium">Variables</h3>
                <div className="space-y-2">
                  {Object.entries(deploymentVariables).map(([key, variable]) => (
                    <div key={key} className="grid grid-cols-12 gap-2 items-start">
                      <div className="col-span-3">
                        <Label>Name</Label>
                        <Input 
                          value={key}
                          disabled={true}
                        />
                      </div>
                      <div className="col-span-3">
                        <Label>Type</Label>
                        <Input
                          value={variable.type}
                          disabled={true}
                        />
                      </div>
                      <div className="col-span-6">
                        <Label>Value</Label>
                        {variable.type === "password" ? (
                          <div className="relative">
                            <Input 
                              type={showPasswordValues[key] ? "text" : "password"}
                              value={variable.value}
                              onChange={(e) => updateDeploymentVariable(key, "value", e.target.value)}
                              className="pr-8"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="absolute right-0 top-0 h-full"
                              onClick={() => togglePasswordVisibility(key)}
                            >
                              {showPasswordValues[key] ? (
                                <EyeOff className="h-4 w-4" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        ) : (
                          <Input 
                            type={variable.type === "int" ? "number" : "text"}
                            value={variable.value}
                            onChange={(e) => updateDeploymentVariable(key, "value", e.target.value)}
                          />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeployDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleDeployTemplate}>
              {deploymentInProgress ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deploying...
                </>
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  Deploy
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <Collapsible open={codeExpanded} onOpenChange={setCodeExpanded}>
            <Card>
              <CardHeader className="pb-3">
                <div className="flex justify-between items-center">
                  <CardTitle className="flex items-center">
                    <FileEdit className="mr-2 h-5 w-5" />
                    Template Code
                  </CardTitle>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm">
                      {codeExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>
                  </CollapsibleTrigger>
                </div>
              </CardHeader>
              <CollapsibleContent>
                <CardContent>
                  <div className="space-y-4">
                    <div className="relative">
                      <Textarea
                        value={code}
                        onChange={(e) => setCode(e.target.value)}
                        className="font-mono h-[400px] resize-none"
                      />
                    </div>
                    <div className="flex justify-end">
                      <Button onClick={handleSaveCodeWithNewVersion}>
                        <Save className="mr-2 h-4 w-4" />
                        Create New Version
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
          
          <Collapsible open={paramsExpanded} onOpenChange={setParamsExpanded}>
            <Card>
              <CardHeader className="pb-3">
                <div className="flex justify-between items-center">
                  <CardTitle className="flex items-center">
                    <FileEdit className="mr-2 h-5 w-5" />
                    Parameters & Variables
                  </CardTitle>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm">
                      {paramsExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>
                  </CollapsibleTrigger>
                </div>
              </CardHeader>
              <CollapsibleContent>
                <CardContent>
                  <div className="space-y-6">
                    {/* Parameters section */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-medium">Parameters</h3>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={addParameter}
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          Add Parameter
                        </Button>
                      </div>
                      
                      {Object.keys(parameters).length === 0 ? (
                        <div className="text-sm text-muted-foreground">
                          No parameters defined. Click "Add Parameter" to create one.
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {Object.entries(parameters).map(([key, param]) => (
                            <div key={key} className="grid grid-cols-12 gap-2 items-start">
                              <div className="col-span-3">
                                <Label>Name</Label>
                                <Input 
                                  value={key}
                                  onChange={(e) => renameParameter(key, e.target.value)}
                                />
                              </div>
                              <div className="col-span-3">
                                <Label>Type</Label>
                                <Select 
                                  value={param.type} 
                                  onValueChange={(value) => updateParameter(key, "type", value)}
                                >
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="string">String</SelectItem>
                                    <SelectItem value="int">Integer</SelectItem>
                                    <SelectItem value="password">Password</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="col-span-4">
                                <Label>Value</Label>
                                {param.type === "password" ? (
                                  <div className="relative">
                                    <Input 
                                      type={showPasswordValues[key] ? "text" : "password"}
                                      value={param.value}
                                      onChange={(e) => updateParameter(key, "value", e.target.value)}
                                      className="pr-8"
                                    />
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="absolute right-0 top-0 h-full"
                                      onClick={() => togglePasswordVisibility(key)}
                                    >
                                      {showPasswordValues[key] ? (
                                        <EyeOff className="h-4 w-4" />
                                      ) : (
                                        <Eye className="h-4 w-4" />
                                      )}
                                    </Button>
                                  </div>
                                ) : (
                                  <Input 
                                    type={param.type === "int" ? "number" : "text"}
                                    value={param.value}
                                    onChange={(e) => updateParameter(key, "value", e.target.value)}
                                  />
                                )}
                              </div>
                              <div className="col-span-1 pt-6">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => removeParameter(key)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    
                    {/* Variables section */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-medium">Variables</h3>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={addVariable}
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          Add Variable
                        </Button>
                      </div>
                      
                      {Object.keys(variables).length === 0 ? (
                        <div className="text-sm text-muted-foreground">
                          No variables defined. Click "Add Variable" to create one.
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {Object.entries(variables).map(([key, variable]) => (
                            <div key={key} className="grid grid-cols-12 gap-2 items-start">
                              <div className="col-span-3">
                                <Label>Name</Label>
                                <Input 
                                  value={key}
                                  onChange={(e) => renameVariable(key, e.target.value)}
                                />
                              </div>
                              <div className="col-span-3">
                                <Label>Type</Label>
                                <Select 
                                  value={variable.type} 
                                  onValueChange={(value) => updateVariable(key, "type", value)}
                                >
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="string">String</SelectItem>
                                    <SelectItem value="int">Integer</SelectItem>
                                    <SelectItem value="password">Password</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="col-span-4">
                                <Label>Value</Label>
                                {variable.type === "password" ? (
                                  <div className="relative">
                                    <Input 
                                      type={showPasswordValues[key] ? "text" : "password"}
                                      value={variable.value}
                                      onChange={(e) => updateVariable(key, "value", e.target.value)}
                                      className="pr-8"
                                    />
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="absolute right-0 top-0 h-full"
                                      onClick={() => togglePasswordVisibility(key)}
                                    >
                                      {showPasswordValues[key] ? (
                                        <EyeOff className="h-4 w-4" />
                                      ) : (
                                        <Eye className="h-4 w-4" />
                                      )}
                                    </Button>
                                  </div>
                                ) : (
                                  <Input 
                                    type={variable.type === "int" ? "number" : "text"}
                                    value={variable.value}
                                    onChange={(e) => updateVariable(key, "value", e.target.value)}
                                  />
                                )}
                              </div>
                              <div className="col-span-1 pt-6">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => removeVariable(key)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    
                    {/* At the end of the parameters and variables section, add a save button */}
                    <div className="flex justify-end">
                      <Button onClick={handleSaveParamsAndVariables}>
                        <Save className="mr-2 h-4 w-4" />
                        Save Parameters & Variables
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        </div>
        
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
                
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Last Updated By</p>
                  <p className="font-medium">
                    {template.lastUpdatedBy || "Unknown"}
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
            <CardContent className="p-2 pt-0">
              <div className="h-[200px] overflow-auto">
              {loadingVersions ? (
                <div className="text-center py-4">
                  <p>Loading versions...</p>
                </div>
              ) : versions.length === 0 ? (
                <div className="text-center py-4">
                  <p className="text-muted-foreground">No version history available</p>
                </div>
              ) : (
                <div className="space-y-4" style={{ padding: "0px 20px 0px 0px"}}>
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
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default TemplateDetails;
