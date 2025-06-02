import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Trash2, Plus, X, ChevronDown, ChevronRight, Send, Bot, User, Save } from "lucide-react";
import { toast } from "sonner";
import { CloudTemplate, CloudProvider, TemplateType, TemplateParameter, TemplateVariable } from "@/types/cloud";
import { cmpService } from "@/services/cmp-service";
import { useAuth } from "@/context/auth-context";

interface EditTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: CloudTemplate | null;
  onTemplateUpdated: () => void;
}

const TEMPLATE_CATEGORIES = [
  "Networking",
  "Storage", 
  "Compute",
  "Security",
  "Database",
  "AI/ML",
  "DevOps",
  "Containers",
  "Serverless",
  "IoT"
];

export const EditTemplateDialog: React.FC<EditTemplateDialogProps> = ({
  open,
  onOpenChange,
  template,
  onTemplateUpdated
}) => {
  const { currentTenant } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  
  // Template basic info
  const [templateName, setTemplateName] = useState("");
  const [templateDescription, setTemplateDescription] = useState("");
  const [templateProvider, setTemplateProvider] = useState<CloudProvider>("azure");
  const [templateType, setTemplateType] = useState<TemplateType>("terraform");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [isPublic, setIsPublic] = useState(false);
  
  // Template code
  const [templateCode, setTemplateCode] = useState("");
  
  // Parameters and Variables
  const [parameters, setParameters] = useState<Record<string, TemplateParameter>>({});
  const [variables, setVariables] = useState<Record<string, TemplateVariable>>({});
  
  // AI Chat state
  const [aiMessages, setAiMessages] = useState<Array<{ role: 'user' | 'assistant', content: string }>>([]);
  const [aiInput, setAiInput] = useState("");
  const [isAiLoading, setIsAiLoading] = useState(false);
  
  // Collapsible sections state
  const [parametersExpanded, setParametersExpanded] = useState(true);
  const [variablesExpanded, setVariablesExpanded] = useState(true);
  
  // Clear form data
  const clearFormData = () => {
    setTemplateName("");
    setTemplateDescription("");
    setTemplateProvider("azure");
    setTemplateType("terraform");
    setSelectedCategories([]);
    setIsPublic(false);
    setTemplateCode("");
    setParameters({});
    setVariables({});
    setAiMessages([]);
    setAiInput("");
  };
  
  // Handle dialog close
  const handleClose = () => {
    clearFormData();
    onOpenChange(false);
  };
  
  // Initialize form when template changes
  useEffect(() => {
    if (template) {
      setTemplateName(template.name);
      setTemplateDescription(template.description || "");
      setTemplateProvider(template.provider);
      setTemplateType(template.type);
      setSelectedCategories(template.categories || []);
      setIsPublic(template.isPublic || false);
      setTemplateCode(template.code || "");
      
      // Use unified schema directly - no conversion needed
      setParameters(template.parameters || {});
      setVariables(template.variables || {});
      setAiMessages([]);
      setAiInput("");
    }
  }, [template]);
  
  const handleCategoryToggle = (category: string) => {
    setSelectedCategories(prev => 
      prev.includes(category) 
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };
  
  const addParameter = () => {
    const newParamName = `param_${Date.now()}`;
    setParameters(prev => ({
      ...prev,
      [newParamName]: {
        value: "",
        type: "string",
        description: "",
        required: false
      }
    }));
  };
  
  const updateParameter = (paramName: string, field: keyof TemplateParameter, value: any) => {
    setParameters(prev => ({
      ...prev,
      [paramName]: {
        ...prev[paramName],
        [field]: value
      }
    }));
  };
  
  const renameParameter = (oldName: string, newName: string) => {
    if (oldName === newName || !newName.trim()) return;
    
    setParameters(prev => {
      const newParams = { ...prev };
      if (newParams[oldName]) {
        newParams[newName] = newParams[oldName];
        delete newParams[oldName];
      }
      return newParams;
    });
  };
  
  const removeParameter = (paramName: string) => {
    setParameters(prev => {
      const newParams = { ...prev };
      delete newParams[paramName];
      return newParams;
    });
  };
  
  const addVariable = () => {
    const newVarName = `var_${Date.now()}`;
    setVariables(prev => ({
      ...prev,
      [newVarName]: {
        value: "",
        description: "",
        sensitive: false
      }
    }));
  };
  
  const updateVariable = (varName: string, field: keyof TemplateVariable, value: any) => {
    setVariables(prev => ({
      ...prev,
      [varName]: {
        ...prev[varName],
        [field]: value
      }
    }));
  };
  
  const renameVariable = (oldName: string, newName: string) => {
    if (oldName === newName || !newName.trim()) return;
    
    setVariables(prev => {
      const newVars = { ...prev };
      if (newVars[oldName]) {
        newVars[newName] = newVars[oldName];
        delete newVars[oldName];
      }
      return newVars;
    });
  };
  
  const removeVariable = (varName: string) => {
    setVariables(prev => {
      const newVars = { ...prev };
      delete newVars[varName];
      return newVars;
    });
  };
  
  const handleAiChat = async () => {
    if (!aiInput.trim() || !currentTenant) return;
    
    setIsAiLoading(true);
    const userMessage = aiInput.trim();
    setAiInput("");
    
    // Add user message
    setAiMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    
    try {
      const response = await cmpService.chatWithAI({
        message: userMessage,
        context: `Template Code:\n${templateCode}\n\nTemplate Name: ${templateName}\nProvider: ${templateProvider}\nType: ${templateType}`,
        tenant_id: currentTenant.tenant_id
      });
      
      // Add AI response
      setAiMessages(prev => [...prev, { role: 'assistant', content: response.response }]);
      
      // If the AI suggests code changes, update the template code
      if (response.suggested_code) {
        setTemplateCode(response.suggested_code);
        toast.success("Code updated based on AI suggestion");
      }
    } catch (error) {
      console.error("Error chatting with AI:", error);
      toast.error("Failed to get AI response");
      setAiMessages(prev => [...prev, { role: 'assistant', content: "Sorry, I couldn't process your request. Please try again." }]);
    } finally {
      setIsAiLoading(false);
    }
  };
  
  const handleSave = async () => {
    if (!template || !currentTenant) return;
    
    if (!templateName.trim()) {
      toast.error("Template name is required");
      return;
    }
    
    setIsLoading(true);
    
    try {
      // Use unified schema directly - no conversion needed
      const updateData = {
        name: templateName,
        description: templateDescription,
        provider: templateProvider,
        type: templateType,
        category: selectedCategories.join(","),
        code: templateCode,
        is_public: isPublic,
        parameters: parameters,
        variables: variables
      };
      await cmpService.updateTemplate(template.id, updateData);
      
      toast.success("Template updated successfully");
      onTemplateUpdated();
      onOpenChange(false);
    } catch (error) {
      console.error("Error updating template:", error);
      toast.error("Failed to update template");
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent 
        className="max-w-7xl max-h-[95vh] overflow-hidden flex flex-col"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader className="flex-shrink-0"></DialogHeader>
        
        <Tabs defaultValue="defaults" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="defaults">Template Defaults</TabsTrigger>
            <TabsTrigger value="code">Edit Code</TabsTrigger>
            <TabsTrigger value="params">Parameters & Variables</TabsTrigger>
          </TabsList>
          
          <TabsContent value="defaults" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Template Name</Label>
                <Input
                  id="name"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="Enter template name"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="provider">Provider</Label>
                <Select value={templateProvider} onValueChange={(value: CloudProvider) => setTemplateProvider(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="azure">Azure</SelectItem>
                    <SelectItem value="aws">AWS</SelectItem>
                    <SelectItem value="gcp">GCP</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="type">Template Type</Label>
                <Select value={templateType} onValueChange={(value: TemplateType) => setTemplateType(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="terraform">Terraform</SelectItem>
                    <SelectItem value="arm">ARM Template</SelectItem>
                    <SelectItem value="bicep">Bicep</SelectItem>
                    <SelectItem value="cloudformation">CloudFormation</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>
                  <Checkbox 
                    checked={isPublic} 
                    onCheckedChange={setIsPublic}
                    className="mr-2"
                  />
                  Public Template
                </Label>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={templateDescription}
                onChange={(e) => setTemplateDescription(e.target.value)}
                placeholder="Describe what this template does"
                rows={3}
              />
            </div>
            
            <div className="space-y-2">
              <Label>Categories</Label>
              <div className="grid grid-cols-5 gap-2">
                {TEMPLATE_CATEGORIES.map((category) => (
                  <div key={category} className="flex items-center space-x-2">
                    <Checkbox
                      id={category}
                      checked={selectedCategories.includes(category)}
                      onCheckedChange={() => handleCategoryToggle(category)}
                    />
                    <Label htmlFor={category} className="text-sm">{category}</Label>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="code" className="space-y-4">
            <div className="grid grid-cols-2 gap-4 h-[600px]">
              <div className="space-y-2">
                <label className="text-sm font-medium">Template Code</label>
                <Textarea
                  value={templateCode}
                  onChange={(e) => setTemplateCode(e.target.value)}
                  className="font-mono h-[550px] resize-none"
                  placeholder="Enter your template code here..."
                />
              </div>
              
              <div className="space-y-2">
                <Label>AI Assistant</Label>
                <Card className="h-[550px] flex flex-col">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center">
                      <Bot className="h-4 w-4 mx-auto mb-2" />
                      Chat with AI about your code
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex-1 flex flex-col">
                    <div className="flex-1 overflow-y-auto space-y-2 mb-4">
                      {aiMessages.length === 0 ? (
                        <div className="text-center text-muted-foreground py-8">
                          <Bot className="h-8 w-8 mx-auto mb-2" />
                          <p>Ask me anything about your template code!</p>
                        </div>
                      ) : (
                        aiMessages.map((message, index) => (
                          <div key={index} className={`p-2 rounded ${message.role === 'user' ? 'bg-blue-100 ml-4' : 'bg-gray-100 mr-4'}`}>
                            <div className="text-xs font-medium mb-1">
                              {message.role === 'user' ? 'You' : 'AI Assistant'}
                            </div>
                            <div className="text-sm whitespace-pre-wrap">{message.content}</div>
                          </div>
                        ))
                      )}
                      {isAiLoading && (
                        <div className="bg-gray-100 mr-4 p-2 rounded">
                          <div className="text-xs font-medium mb-1">AI Assistant</div>
                          <div className="text-sm">Thinking...</div>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex gap-2">
                      <Input
                        value={aiInput}
                        onChange={(e) => setAiInput(e.target.value)}
                        placeholder="Ask about your code..."
                        onKeyPress={(e) => e.key === 'Enter' && handleAiChat()}
                        disabled={isAiLoading}
                      />
                      <Button onClick={handleAiChat} disabled={isAiLoading || !aiInput.trim()}>
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="params" className="space-y-4">
            <Collapsible open={parametersExpanded} onOpenChange={setParametersExpanded}>
              <div className="flex items-center justify-between">
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" className="flex items-center gap-2 p-0 h-auto">
                    {parametersExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    <h3 className="text-lg font-semibold">Template Parameters</h3>
                  </Button>
                </CollapsibleTrigger>
                <Button onClick={addParameter} size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Parameter
                </Button>
              </div>
              
              <CollapsibleContent>
                <ScrollArea className="max-h-[400px] w-full">
                  <div className="space-y-3 pr-4">
                    {Object.entries(parameters).map(([paramName, param]) => (
                      <Card key={paramName}>
                        <CardContent className="p-4 space-y-3">
                          <div className="flex justify-between items-start">
                            <div className="grid grid-cols-2 gap-2 flex-1">
                              <Input
                                placeholder="Parameter name"
                                value={paramName}
                                onChange={(e) => {
                                  const newName = e.target.value;
                                  if (newName !== paramName) {
                                    renameParameter(paramName, newName);
                                  }
                                }}
                                onBlur={(e) => {
                                  const newName = e.target.value.trim();
                                  if (newName && newName !== paramName) {
                                    renameParameter(paramName, newName);
                                  }
                                }}
                              />
                              <Select value={param.type} onValueChange={(value) => updateParameter(paramName, "type", value)}>
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
                            <Button variant="ghost" size="sm" onClick={() => removeParameter(paramName)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                          
                          <Input
                            placeholder="Description"
                            value={param.description}
                            onChange={(e) => updateParameter(paramName, "description", e.target.value)}
                          />
                          
                          <div className="grid grid-cols-2 gap-2">
                            <Input
                              placeholder="Default value"
                              value={param.value}
                              onChange={(e) => updateParameter(paramName, "value", e.target.value)}
                              type={param.type === "password" ? "password" : param.type === "int" ? "number" : "text"}
                            />
                            <div className="flex items-center space-x-2">
                              <Checkbox
                                id={`required-${paramName}`}
                                checked={param.required}
                                onCheckedChange={(checked) => updateParameter(paramName, "required", checked)}
                              />
                              <label htmlFor={`required-${paramName}`} className="text-sm">Required</label>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              </CollapsibleContent>
            </Collapsible>
            
            <Collapsible open={variablesExpanded} onOpenChange={setVariablesExpanded}>
              <div className="flex items-center justify-between">
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" className="flex items-center gap-2 p-0 h-auto">
                    {variablesExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    <h3 className="text-lg font-semibold">Template Variables</h3>
                  </Button>
                </CollapsibleTrigger>
                <Button onClick={addVariable} size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Variable
                </Button>
              </div>
              
              <CollapsibleContent>
                <ScrollArea className="max-h-[400px] w-full">
                  <div className="space-y-3 pr-4">
                    {Object.entries(variables).map(([varName, variable]) => (
                      <Card key={varName}>
                        <CardContent className="p-4 space-y-3">
                          <div className="flex justify-between items-start">
                            <div className="grid grid-cols-2 gap-2 flex-1">
                              <Input
                                placeholder="Variable name"
                                value={varName}
                                onChange={(e) => {
                                  const newName = e.target.value;
                                  if (newName !== varName) {
                                    renameVariable(varName, newName);
                                  }
                                }}
                                onBlur={(e) => {
                                  const newName = e.target.value.trim();
                                  if (newName && newName !== varName) {
                                    renameVariable(varName, newName);
                                  }
                                }}
                              />
                              <Input
                                placeholder="Value"
                                value={variable.value}
                                onChange={(e) => updateVariable(varName, "value", e.target.value)}
                                type={variable.sensitive ? "password" : "text"}
                              />
                            </div>
                            <Button variant="ghost" size="sm" onClick={() => removeVariable(varName)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                          
                          <Input
                            placeholder="Description"
                            value={variable.description}
                            onChange={(e) => updateVariable(varName, "description", e.target.value)}
                          />
                          
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id={`sensitive-${varName}`}
                              checked={variable.sensitive}
                              onCheckedChange={(checked) => updateVariable(varName, "sensitive", checked)}
                            />
                            <label htmlFor={`sensitive-${varName}`} className="text-sm">Sensitive</label>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              </CollapsibleContent>
            </Collapsible>
          </TabsContent>
        </Tabs>
        
        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isLoading}>
            <Save className="h-4 w-4 mr-2" />
            {isLoading ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
