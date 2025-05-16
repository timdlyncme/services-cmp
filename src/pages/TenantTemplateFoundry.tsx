
import { useState, useEffect } from "react";
import { useAuth } from "@/context/auth-context";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, FileCode } from "lucide-react";
import { toast } from "sonner";

import { TemplateForm } from "@/components/template-foundry/template-form";
import { TemplateList } from "@/components/template-foundry/template-list";
import { TemplateDetails } from "@/components/template-foundry/template-details";
import { Template, codeExamples } from "@/types/template";
import { mockTemplates } from "@/data/mock-data";

const TenantTemplateFoundry = () => {
  const { user, currentTenant } = useAuth();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [activeTemplate, setActiveTemplate] = useState<Template | null>(null);
  const [filter, setFilter] = useState("all");
  const [isCreating, setIsCreating] = useState(false);
  
  // Only the current tenant's templates are relevant
  const availableTenants = currentTenant ? [currentTenant] : [];
  const isAdmin = user?.role === "admin";

  useEffect(() => {
    // In a real app, this would be an API call specific to the tenant
    const relevantTemplates = mockTemplates
      .filter(template => template.tenantId === currentTenant?.id)
      .map(template => ({
        id: template.id,
        name: template.name,
        description: template.description,
        type: template.type,
        provider: template.provider,
        codeSnippet: template.code,
        tenantIds: [template.tenantId],
        categories: template.categories,
        version: "1.0.0",
        createdAt: template.uploadedAt,
        updatedAt: template.updatedAt,
        deploymentCount: template.deploymentCount,
        isPublished: true,
        author: "Tenant Admin",
        commitId: "tenant-" + Math.random().toString(16).substring(2, 8)
      })) as Template[];
    
    // Add some draft templates
    const draftTemplates: Template[] = [
      {
        id: "draft-1",
        name: "Network Security Group Draft",
        description: "Draft template for network security configuration",
        type: "terraform",
        provider: "azure",
        codeSnippet: codeExamples.terraform,
        tenantIds: [currentTenant?.id || ""],
        categories: ["Security", "Networking"],
        version: "0.1.0",
        createdAt: "2023-04-10T09:00:00Z",
        updatedAt: "2023-04-10T09:00:00Z",
        deploymentCount: 0,
        isPublished: false,
        author: user?.name || "System",
        commitId: "draft-" + Math.random().toString(16).substring(2, 8)
      },
      {
        id: "draft-2",
        name: "Container Registry Draft",
        description: "Draft template for container registry",
        type: "arm",
        provider: "azure",
        codeSnippet: codeExamples.arm,
        tenantIds: [currentTenant?.id || ""],
        categories: ["Containers", "DevOps"],
        version: "0.2.0",
        createdAt: "2023-04-15T14:30:00Z",
        updatedAt: "2023-04-15T14:30:00Z",
        deploymentCount: 0,
        isPublished: false,
        author: user?.name || "System",
        commitId: "draft-" + Math.random().toString(16).substring(2, 8)
      },
    ];
    
    setTemplates([...relevantTemplates, ...draftTemplates]);
  }, [currentTenant, user]);

  const handleCreateTemplate = (templateData: Partial<Template>) => {
    // Validate form
    if (!templateData.name || !templateData.description || !templateData.codeSnippet) {
      toast.error("Please fill in all required fields");
      return;
    }
    
    // Create new template
    const newTemplate: Template = {
      id: `template-${Date.now()}`,
      name: templateData.name || "",
      description: templateData.description || "",
      type: templateData.type || "terraform",
      provider: templateData.provider || "azure",
      codeSnippet: templateData.codeSnippet || "",
      tenantIds: [currentTenant?.id || ""],
      categories: templateData.categories || [],
      version: "1.0.0",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      deploymentCount: 0,
      isPublished: false,
      author: user?.name || "System",
      commitId: Math.random().toString(16).substring(2, 10),
    };
    
    setTemplates([...templates, newTemplate]);
    setIsCreating(false);
    toast.success("Template created successfully");
  };

  const handleUpdateTemplate = (updatedTemplate: Template) => {
    const updatedTemplates = templates.map(t => 
      t.id === updatedTemplate.id ? updatedTemplate : t
    );
    
    setTemplates(updatedTemplates);
    setActiveTemplate(updatedTemplate);
    toast.success("Template updated successfully");
  };

  const handlePublishTemplate = (template: Template) => {
    const updatedTemplates = templates.map(t => 
      t.id === template.id ? { ...t, isPublished: true } : t
    );
    setTemplates(updatedTemplates);
    setActiveTemplate(prev => prev && { ...prev, isPublished: true });
    toast.success("Template published successfully");
  };

  const handleUnpublishTemplate = (template: Template) => {
    const updatedTemplates = templates.map(t => 
      t.id === template.id ? { ...t, isPublished: false } : t
    );
    setTemplates(updatedTemplates);
    setActiveTemplate(prev => prev && { ...prev, isPublished: false });
    toast.success("Template unpublished successfully");
  };

  const handleDeleteTemplate = (templateId: string) => {
    setTemplates(templates.filter(t => t.id !== templateId));
    setActiveTemplate(null);
    toast.success("Template deleted successfully");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Template Foundry</h1>
          <p className="text-muted-foreground">
            Create, manage and publish cloud infrastructure templates for your tenant
          </p>
        </div>
        <div className="flex gap-2">
          <Dialog open={isCreating} onOpenChange={setIsCreating}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New Template
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create New Template</DialogTitle>
                <DialogDescription>
                  Create a new infrastructure template to deploy cloud resources
                </DialogDescription>
              </DialogHeader>
              
              <TemplateForm 
                onSubmit={handleCreateTemplate} 
                onCancel={() => setIsCreating(false)}
                isMSP={false}
                availableTenants={availableTenants}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>
      
      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-1">
          <TemplateList
            templates={templates}
            activeTemplate={activeTemplate}
            setActiveTemplate={setActiveTemplate}
            filter={filter}
            setFilter={setFilter}
          />
        </div>
        
        <div className="md:col-span-2">
          {activeTemplate ? (
            <TemplateDetails
              template={activeTemplate}
              onUpdate={handleUpdateTemplate}
              onDelete={handleDeleteTemplate}
              onPublish={handlePublishTemplate}
              onUnpublish={handleUnpublishTemplate}
              isMSP={false}
              availableTenants={availableTenants}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full py-16">
              <FileCode className="h-12 w-12 text-muted-foreground" />
              <h2 className="mt-4 text-xl font-semibold">No Template Selected</h2>
              <p className="text-center text-muted-foreground mt-2 max-w-md">
                Select a template from the library to view and edit, or create a new template to get started.
              </p>
              <Button 
                className="mt-4" 
                variant="outline"
                onClick={() => setIsCreating(true)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Create New Template
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TenantTemplateFoundry;
