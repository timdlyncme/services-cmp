import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Save, Plus, Trash2, MessageSquare, Send, Bot } from "lucide-react";
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
  
  // AI Assistant
  const [aiMessages, setAiMessages] = useState<Array<{role: 'user' | 'assistant', content: string}>>([]);
  const [aiInput, setAiInput] = useState("");
  const [isAiLoading, setIsAiLoading] = useState(false);
  
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
    const newId = `param_${Date.now()}`;
    setParameters(prev => ({
      ...prev,
      [newId]: {
        name: "",
        type: "string",
        description: "",
        defaultValue: "",
        required: false
      }
    }));
  };
  
  const updateParameter = (id: string, field: keyof TemplateParameter, value: any) => {
    setParameters(prev => ({
      ...prev,
      [id]: {
        ...prev[id],
        [field]: value
      }
    }));
  };
  
  const removeParameter = (id: string) => {
    setParameters(prev => {
      const newParams = { ...prev };
      delete newParams[id];
      return newParams;
    });
  };
  
  const addVariable = () => {
    const newId = `var_${Date.now()}`;
    setVariables(prev => ({
      ...prev,
      [newId]: {
        name: "",
        value: "",
        description: "",
        sensitive: false
      }
    }));
  };
  
  const updateVariable = (id: string, field: keyof TemplateVariable, value: any) => {
    setVariables(prev => ({
      ...prev,
      [id]: {
        ...prev[id],
        [field]: value
      }
    }));
  };
  
  const removeVariable = (id: string) => {
    setVariables(prev => {
      const newVars = { ...prev };
      delete newVars[id];
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
      const updateData = {
        name: templateName,
        description: templateDescription,
        provider: templateProvider,
        type: templateType,
        category: selectedCategories.join(','),
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Template</DialogTitle>
          <DialogDescription>
            Modify template settings, code, parameters, and variables
          </DialogDescription>
        </DialogHeader>
        
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
                <Label>Template Code</Label>
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
                      <Bot className="h-4 w-4 mr-2" />
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
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-medium">Parameters</Label>
                  <Button onClick={addParameter} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Parameter
                  </Button>
                </div>
                
                <div className="space-y-3 max-h-[400px] overflow-y-auto">
                  {Object.entries(parameters).map(([id, param]) => (
                    <Card key={id}>
                      <CardContent className="p-4 space-y-3">
                        <div className="flex justify-between items-start">
                          <div className="grid grid-cols-2 gap-2 flex-1">
                            <Input
                              placeholder="Parameter name"
                              value={param.name}
                              onChange={(e) => updateParameter(id, 'name', e.target.value)}
                            />
                            <Select value={param.type} onValueChange={(value) => updateParameter(id, 'type', value)}>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="string">String</SelectItem>
                                <SelectItem value="number">Number</SelectItem>
                                <SelectItem value="boolean">Boolean</SelectItem>
                                <SelectItem value="array">Array</SelectItem>
                                <SelectItem value="object">Object</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <Button variant="ghost" size="sm" onClick={() => removeParameter(id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        
                        <Input
                          placeholder="Description"
                          value={param.description}
                          onChange={(e) => updateParameter(id, 'description', e.target.value)}
                        />
                        
                        <div className="grid grid-cols-2 gap-2">
                          <Input
                            placeholder="Default value"
                            value={param.defaultValue}
                            onChange={(e) => updateParameter(id, 'defaultValue', e.target.value)}
                          />
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              checked={param.required}
                              onCheckedChange={(checked) => updateParameter(id, 'required', checked)}
                            />
                            <Label className="text-sm">Required</Label>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-medium">Variables</Label>
                  <Button onClick={addVariable} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Variable
                  </Button>
                </div>
                
                <div className="space-y-3 max-h-[400px] overflow-y-auto">
                  {Object.entries(variables).map(([id, variable]) => (
                    <Card key={id}>
                      <CardContent className="p-4 space-y-3">
                        <div className="flex justify-between items-start">
                          <div className="grid grid-cols-2 gap-2 flex-1">
                            <Input
                              placeholder="Variable name"
                              value={variable.name}
                              onChange={(e) => updateVariable(id, 'name', e.target.value)}
                            />
                            <Input
                              placeholder="Value"
                              value={variable.value}
                              onChange={(e) => updateVariable(id, 'value', e.target.value)}
                              type={variable.sensitive ? "password" : "text"}
                            />
                          </div>
                          <Button variant="ghost" size="sm" onClick={() => removeVariable(id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        
                        <Input
                          placeholder="Description"
                          value={variable.description}
                          onChange={(e) => updateVariable(id, 'description', e.target.value)}
                        />
                        
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            checked={variable.sensitive}
                            onCheckedChange={(checked) => updateVariable(id, 'sensitive', checked)}
                          />
                          <Label className="text-sm">Sensitive</Label>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
        
        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
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
