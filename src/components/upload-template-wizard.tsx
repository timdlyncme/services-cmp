import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { StepWizard } from "@/components/ui/step-wizard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Upload, FileCode, Github, ChevronLeft, ChevronRight, Plus, Trash2, AlertCircle, ChevronDown, ChevronUp } from "lucide-react";
import { CloudProvider, TemplateType, TemplateParameter, TemplateVariable } from "@/types/cloud";
import { availableCategories } from "@/types/template";
import { toast } from "sonner";

interface UploadTemplateWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateTemplate: (templateData: any) => Promise<void>;
  isLoading: boolean;
}

const steps = [
  {
    id: 1,
    title: "Template Info",
    description: "Basic template information and categories"
  },
  {
    id: 2,
    title: "Template Code",
    description: "Upload or provide template code"
  },
  {
    id: 3,
    title: "Parameters",
    description: "Define template parameters and variables"
  },
  {
    id: 4,
    title: "Review",
    description: "Review and create template"
  }
];

export const UploadTemplateWizard: React.FC<UploadTemplateWizardProps> = ({
  open,
  onOpenChange,
  onCreateTemplate,
  isLoading,
}) => {
  const [currentStep, setCurrentStep] = useState(1);
  
  // Step 1: Template Info
  const [templateName, setTemplateName] = useState("");
  const [templateDescription, setTemplateDescription] = useState("");
  const [templateProvider, setTemplateProvider] = useState<CloudProvider | "">("");
  const [templateType, setTemplateType] = useState<TemplateType | "">("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  
  // Step 2: Template Code
  const [codeSource, setCodeSource] = useState<"manual" | "file" | "github">("manual");
  const [templateCode, setTemplateCode] = useState("");
  const [githubUrl, setGithubUrl] = useState("");
  const [isLoadingGithub, setIsLoadingGithub] = useState(false);
  
  // Step 3: Parameters and Variables
  const [parameters, setParameters] = useState<Record<string, TemplateParameter>>({});
  const [variables, setVariables] = useState<Record<string, TemplateVariable>>({});
  
  // Review stage expandable cards
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({
    info: true,
    code: true,
    params: true,
    vars: true
  });

  // Reset wizard when dialog opens
  useEffect(() => {
    if (open) {
      setCurrentStep(1);
      setTemplateName("");
      setTemplateDescription("");
      setTemplateProvider("");
      setTemplateType("");
      setSelectedCategories([]);
      setCodeSource("manual");
      setTemplateCode("");
      setGithubUrl("");
      setParameters({});
      setVariables({});
    }
  }, [open]);

  const canProceedToStep2 = templateName.trim() && templateDescription.trim() && templateProvider && templateType && selectedCategories.length > 0;
  const canProceedToStep3 = templateCode.trim();
  const canProceedToStep4 = true; // Parameters are optional

  const handleNext = () => {
    if (currentStep < 4) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      onOpenChange(false);
    }
  };

  const handleCategoryToggle = (category: string) => {
    setSelectedCategories(prev => 
      prev.includes(category) 
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

  const toggleCardExpansion = (cardId: string) => {
    setExpandedCards(prev => ({
      ...prev,
      [cardId]: !prev[cardId]
    }));
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const content = await readFileContent(file);
      setTemplateCode(content);
      toast.success("File uploaded successfully");
    } catch (error) {
      console.error("Error reading file:", error);
      toast.error("Failed to read file content");
    }
  };

  const readFileContent = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target && typeof event.target.result === 'string') {
          resolve(event.target.result);
        } else {
          reject(new Error("Failed to read file content"));
        }
      };
      reader.onerror = (error) => reject(error);
      reader.readAsText(file);
    });
  };

  const handleGithubUpload = async () => {
    if (!githubUrl.trim()) {
      toast.error("Please enter a GitHub URL");
      return;
    }

    setIsLoadingGithub(true);
    try {
      // Convert GitHub URL to raw content URL
      const rawUrl = convertToRawGithubUrl(githubUrl);
      const response = await fetch(rawUrl);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch file: ${response.statusText}`);
      }
      
      const content = await response.text();
      setTemplateCode(content);
      toast.success("Template loaded from GitHub successfully");
    } catch (error) {
      console.error("Error fetching from GitHub:", error);
      toast.error("Failed to load template from GitHub. Please check the URL.");
    } finally {
      setIsLoadingGithub(false);
    }
  };

  const convertToRawGithubUrl = (url: string): string => {
    try {
      const urlObj = new URL(url);
      if (urlObj.hostname !== 'github.com') {
        throw new Error("Not a GitHub URL");
      }
      
      const pathParts = urlObj.pathname.split('/').filter(Boolean);
      if (pathParts.length < 5 || pathParts[2] !== 'blob') {
        throw new Error("Invalid GitHub file URL");
      }
      
      const [owner, repo, , branch, ...filePath] = pathParts;
      return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${filePath.join('/')}`;
    } catch (error) {
      throw new Error("Invalid GitHub URL format");
    }
  };

  const addParameter = () => {
    const newKey = `param_${Object.keys(parameters).length + 1}`;
    setParameters(prev => ({
      ...prev,
      [newKey]: {
        name: newKey,
        type: "string",
        description: "",
        defaultValue: "",
        value: "",
        required: false
      }
    }));
  };

  const removeParameter = (key: string) => {
    setParameters(prev => {
      const newParams = { ...prev };
      delete newParams[key];
      return newParams;
    });
  };

  const updateParameter = (key: string, field: keyof TemplateParameter, value: any) => {
    setParameters(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        [field]: value
      }
    }));
  };

  const addVariable = () => {
    const newKey = `var_${Object.keys(variables).length + 1}`;
    setVariables(prev => ({
      ...prev,
      [newKey]: {
        name: newKey,
        value: "",
        description: "",
        sensitive: false
      }
    }));
  };

  const removeVariable = (key: string) => {
    setVariables(prev => {
      const newVars = { ...prev };
      delete newVars[key];
      return newVars;
    });
  };

  const updateVariable = (key: string, field: keyof TemplateVariable, value: any) => {
    setVariables(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        [field]: value
      }
    }));
  };

  const handleCreateTemplate = async () => {
    try {
      // Transform parameters to unified schema: { [name]: { value: string, type: string, description: string, required: boolean } }
      const transformedParameters: Record<string, TemplateParameter> = {};
      Object.values(parameters).forEach(param => {
        if (param.name && param.name.trim()) {
          transformedParameters[param.name] = {
            value: param.defaultValue || param.value || "",
            type: param.type,
            description: param.description || "",
            required: param.required || false
          };
        }
      });

      // Transform variables to unified schema: { [name]: { value: string, description: string, sensitive: boolean } }
      const transformedVariables: Record<string, TemplateVariable> = {};
      Object.values(variables).forEach(variable => {
        if (variable.name && variable.name.trim()) {
          transformedVariables[variable.name] = {
            value: variable.value || "",
            description: variable.description || "",
            sensitive: variable.sensitive || false
          };
        }
      });

      const templateData = {
        name: templateName,
        description: templateDescription,
        provider: templateProvider,
        type: templateType,
        categories: selectedCategories,  // Send as array instead of comma-separated string
        code: templateCode,
        is_public: false,
        parameters: transformedParameters,
        variables: transformedVariables
      };
      await onCreateTemplate(templateData);
      onOpenChange(false);
    } catch (error) {
      console.error("Error creating template:", error);
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">Template Name *</Label>
              <Input
                id="name"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="e.g., Web App with Database"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="description">Description *</Label>
              <Textarea
                id="description"
                value={templateDescription}
                onChange={(e) => setTemplateDescription(e.target.value)}
                placeholder="Describe what this template does"
                rows={3}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="type">Template Type</Label>
                <Select value={templateType} onValueChange={(value) => setTemplateType(value as TemplateType)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a template type..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="terraform">Terraform</SelectItem>
                    <SelectItem value="arm">ARM Template</SelectItem>
                    <SelectItem value="cloudformation">CloudFormation</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="provider">Cloud Provider</Label>
                <Select value={templateProvider} onValueChange={(value) => setTemplateProvider(value as CloudProvider)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a cloud provider..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="azure">Azure</SelectItem>
                    <SelectItem value="aws">AWS</SelectItem>
                    <SelectItem value="gcp">GCP</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="space-y-3">
              <Label>Categories *</Label>
              <div className="grid grid-cols-2 gap-3">
                {availableCategories.map((category) => (
                  <div key={category} className="flex items-center space-x-2">
                    <Checkbox
                      id={category}
                      checked={selectedCategories.includes(category)}
                      onCheckedChange={() => handleCategoryToggle(category)}
                    />
                    <Label htmlFor={category} className="text-sm font-normal">
                      {category}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <Tabs value={codeSource} onValueChange={(value) => setCodeSource(value as any)}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="manual">Manual Entry</TabsTrigger>
                <TabsTrigger value="file">Upload File</TabsTrigger>
                <TabsTrigger value="github">GitHub URL</TabsTrigger>
              </TabsList>
              
              <TabsContent value="manual" className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="code">Template Code *</Label>
                  <Textarea
                    id="code"
                    value={templateCode}
                    onChange={(e) => setTemplateCode(e.target.value)}
                    placeholder="Paste your template code here..."
                    rows={15}
                    className="font-mono text-sm"
                  />
                </div>
              </TabsContent>
              
              <TabsContent value="file" className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="file">Upload Template File</Label>
                  <Input
                    id="file"
                    type="file"
                    accept=".tf,.json,.yaml,.yml,.template"
                    onChange={handleFileUpload}
                  />
                  <p className="text-xs text-muted-foreground">
                    Supported formats: .tf, .json, .yaml, .yml, .template
                  </p>
                </div>
                
                {templateCode && (
                  <div className="space-y-2">
                    <Label>Preview</Label>
                    <ScrollArea className="h-64 w-full rounded-md border">
                      <pre className="p-4 text-sm">
                        <code>{templateCode}</code>
                      </pre>
                    </ScrollArea>
                  </div>
                )}
              </TabsContent>
              
              <TabsContent value="github" className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="github-url">GitHub File URL</Label>
                  <div className="flex space-x-2">
                    <Input
                      id="github-url"
                      value={githubUrl}
                      onChange={(e) => setGithubUrl(e.target.value)}
                      placeholder="https://github.com/owner/repo/blob/main/template.tf"
                    />
                    <Button 
                      onClick={handleGithubUpload} 
                      disabled={isLoadingGithub || !githubUrl.trim()}
                    >
                      {isLoadingGithub ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Github className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Paste the full GitHub URL to the template file (must be a direct file link)
                  </p>
                </div>
                
                {templateCode && (
                  <div className="space-y-2">
                    <Label>Loaded Template</Label>
                    <ScrollArea className="h-64 w-full rounded-md border">
                      <pre className="p-4 text-sm">
                        <code>{templateCode}</code>
                      </pre>
                    </ScrollArea>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6 max-h-[500px] overflow-y-auto">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-medium">Template Parameters</h3>
                  <p className="text-sm text-muted-foreground">
                    Define parameters that users can customize when deploying this template
                  </p>
                </div>
                <Button onClick={addParameter} size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Parameter
                </Button>
              </div>
              
              {Object.keys(parameters).length === 0 ? (
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center text-muted-foreground">
                      <FileCode className="h-8 w-8 mx-auto mb-2" />
                      <p>No parameters defined</p>
                      <p className="text-xs">Parameters are optional but help users customize the template</p>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4 max-h-[200px] overflow-y-auto pr-2">
                  {Object.entries(parameters).map(([key, param]) => (
                    <Card key={key}>
                      <CardContent className="pt-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Parameter Name</Label>
                            <Input
                              value={param.name}
                              onChange={(e) => updateParameter(key, "name", e.target.value)}
                              placeholder="Parameter name"
                            />
                          </div>
                          <div className="space-y-2">
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
                                <SelectItem value="bool">Boolean</SelectItem>
                                <SelectItem value="password">Password</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>Description</Label>
                            <Input
                              value={param.description}
                              onChange={(e) => updateParameter(key, "description", e.target.value)}
                              placeholder="Parameter description"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Default Value</Label>
                            <Input
                              value={param.defaultValue}
                              onChange={(e) => updateParameter(key, "defaultValue", e.target.value)}
                              placeholder="Default value"
                            />
                          </div>
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              checked={param.required}
                              onCheckedChange={(checked) => updateParameter(key, "required", checked)}
                            />
                            <Label>Required</Label>
                          </div>
                          <div className="flex justify-end">
                            <Button 
                              variant="outline" 
                              size="sm" 
                              onClick={() => removeParameter(key)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-medium">Template Variables</h3>
                  <p className="text-sm text-muted-foreground">
                    Define variables that can be used within the template
                  </p>
                </div>
                <Button onClick={addVariable} size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Variable
                </Button>
              </div>
              
              {Object.keys(variables).length === 0 ? (
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center text-muted-foreground">
                      <FileCode className="h-8 w-8 mx-auto mb-2" />
                      <p>No variables defined</p>
                      <p className="text-xs">Variables are optional and can be used for template logic</p>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4 max-h-[200px] overflow-y-auto pr-2">
                  {Object.entries(variables).map(([key, variable]) => (
                    <Card key={key}>
                      <CardContent className="pt-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Variable Name</Label>
                            <Input
                              value={variable.name}
                              onChange={(e) => updateVariable(key, "name", e.target.value)}
                              placeholder="Variable name"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Value</Label>
                            <Input
                              value={variable.value}
                              onChange={(e) => updateVariable(key, "value", e.target.value)}
                              placeholder="Variable value"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Description</Label>
                            <Input
                              value={variable.description}
                              onChange={(e) => updateVariable(key, "description", e.target.value)}
                              placeholder="Variable description"
                            />
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <Checkbox
                                checked={variable.sensitive}
                                onCheckedChange={(checked) => updateVariable(key, "sensitive", checked)}
                              />
                              <Label>Sensitive</Label>
                            </div>
                            <Button 
                              variant="outline" 
                              size="sm" 
                              onClick={() => removeVariable(key)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-medium">Review Template Configuration</h3>
            
            <Card>
              <CardHeader className="cursor-pointer" onClick={() => toggleCardExpansion('info')}>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">Template Information</CardTitle>
                  {expandedCards.info ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </div>
              </CardHeader>
              {expandedCards.info && (
                <CardContent className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Name:</span>
                    <Badge variant="outline">{templateName}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Type:</span>
                    <Badge variant="outline">{templateType}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Provider:</span>
                    <Badge variant="outline">{templateProvider.toUpperCase()}</Badge>
                  </div>
                  <div className="flex justify-between items-start">
                    <span className="text-sm text-gray-600">Categories:</span>
                    <div className="flex flex-wrap gap-1">
                      {selectedCategories.map((category, index) => {
                        const colors = [
                          "bg-blue-100 text-blue-800",
                          "bg-green-100 text-green-800", 
                          "bg-purple-100 text-purple-800",
                          "bg-orange-100 text-orange-800",
                          "bg-pink-100 text-pink-800",
                          "bg-indigo-100 text-indigo-800",
                          "bg-yellow-100 text-yellow-800",
                          "bg-red-100 text-red-800",
                          "bg-teal-100 text-teal-800",
                          "bg-cyan-100 text-cyan-800"
                        ];
                        return (
                          <Badge 
                            key={category} 
                            className={`text-xs ${colors[index % colors.length]}`}
                          >
                            {category}
                          </Badge>
                        );
                      })}
                    </div>
                  </div>
                  <div>
                    <span className="text-sm text-gray-600">Description:</span>
                    <p className="text-xs mt-1 p-2 bg-gray-50 rounded">{templateDescription}</p>
                  </div>
                </CardContent>
              )}
            </Card>
            
            <Card>
              <CardHeader className="cursor-pointer" onClick={() => toggleCardExpansion('code')}>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">Template Code</CardTitle>
                  {expandedCards.code ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </div>
              </CardHeader>
              {expandedCards.code && (
                <CardContent>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-gray-600">Source:</span>
                    <Badge variant="outline">
                      {codeSource === "manual" ? "Manual Entry" : 
                       codeSource === "file" ? "File Upload" : "GitHub"}
                    </Badge>
                  </div>
                  <ScrollArea className={`w-full rounded-md border ${expandedCards.code ? 'h-64' : 'h-32'}`}>
                    <pre className="p-3 text-xs">
                      <code>{templateCode}</code>
                    </pre>
                  </ScrollArea>
                </CardContent>
              )}
            </Card>
            
            {Object.keys(parameters).length > 0 && (
              <Card>
                <CardHeader className="cursor-pointer" onClick={() => toggleCardExpansion('params')}>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">Parameters ({Object.keys(parameters).length})</CardTitle>
                    {expandedCards.params ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </div>
                </CardHeader>
                {expandedCards.params && (
                  <CardContent>
                    <div className="space-y-2">
                      {Object.entries(parameters).map(([key, param]) => (
                        <div key={key} className="flex justify-between text-xs">
                          <span className="font-medium">{param.name}</span>
                          <div className="flex gap-2">
                            <Badge variant="outline" className="text-xs">{param.type}</Badge>
                            {param.required && <Badge variant="destructive" className="text-xs">Required</Badge>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                )}
              </Card>
            )}
            
            {Object.keys(variables).length > 0 && (
              <Card>
                <CardHeader className="cursor-pointer" onClick={() => toggleCardExpansion('vars')}>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">Variables ({Object.keys(variables).length})</CardTitle>
                    {expandedCards.vars ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </div>
                </CardHeader>
                {expandedCards.vars && (
                  <CardContent>
                    <div className="space-y-2">
                      {Object.entries(variables).map(([key, variable]) => (
                        <div key={key} className="flex justify-between text-xs">
                          <span className="font-medium">{variable.name}</span>
                          <div className="flex gap-2">
                            <span className="text-muted-foreground">
                              {variable.sensitive ? "••••••••" : variable.value || "(empty)"}
                            </span>
                            {variable.sensitive && <Badge variant="outline" className="text-xs">Sensitive</Badge>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                )}
              </Card>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent 
        className="max-w-4xl max-h-[90vh] flex flex-col"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader className="flex-shrink-0">
          <div className="mt-4">
            <StepWizard steps={steps} currentStep={currentStep} />
          </div>
        </DialogHeader>
        
        <div className="flex-1 overflow-hidden">
          <ScrollArea className="h-full py-6">
            {renderStepContent()}
          </ScrollArea>
        </div>
        
        <div className="flex justify-between flex-shrink-0 pt-4 border-t">
          <div>
            {currentStep > 1 && (
              <Button 
                variant="outline" 
                onClick={handlePrevious}
                disabled={isLoading}
              >
                <ChevronLeft className="mr-2 h-4 w-4" />
                Previous
              </Button>
            )}
          </div>
          
          <div className="space-x-2">
            <Button 
              variant="outline" 
              onClick={handleClose}
              disabled={isLoading}
            >
              Cancel
            </Button>
            
            {currentStep < 4 ? (
              <Button 
                onClick={handleNext}
                disabled={
                  isLoading ||
                  (currentStep === 1 && !canProceedToStep2) ||
                  (currentStep === 2 && !canProceedToStep3) ||
                  (currentStep === 3 && !canProceedToStep4)
                }
              >
                Next
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <Button onClick={handleCreateTemplate} disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Create Template
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
