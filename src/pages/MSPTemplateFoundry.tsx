import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/auth-context";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, FileCode } from "lucide-react";
import { toast } from "sonner";

import { TemplateForm } from "@/components/template-foundry/template-form";
import { TemplateList } from "@/components/template-foundry/template-list";
import { TemplateDetails } from "@/components/template-foundry/template-details";
import { GithubIntegration } from "@/components/template-foundry/github-integration";
import { Template, codeExamples } from "@/types/template";
import { Tenant } from "@/types/auth";
import { cmpService } from "@/services/cmp-service";

const MSPTemplateFoundry = () => {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [activeTemplate, setActiveTemplate] = useState<Template | null>(null);
  const [filter, setFilter] = useState("all");
  const [isCreating, setIsCreating] = useState(false);
  const [activeTab, setActiveTab] = useState("templates");
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Load tenants
  useEffect(() => {
    const fetchTenants = async () => {
      try {
        const tenantsData = await cmpService.getTenants();
        setTenants(tenantsData);
      } catch (error) {
        console.error("Error fetching tenants:", error);
        toast.error("Failed to load tenants");
      }
    };
    
    fetchTenants();
  }, []);

  const loadTemplates = useCallback(async () => {
    setIsLoading(true);
    try {
      // For MSP role, we need to fetch templates from all tenants
      // We'll fetch templates for each tenant and combine them
      const allTemplates: Template[] = [];
      
      // If no tenants loaded yet, return
      if (tenants.length === 0) {
        setIsLoading(false);
        return;
      }
      
      // Fetch templates for each tenant
      for (const tenant of tenants) {
        try {
          const templateFoundryItems = await cmpService.getTemplateFoundry(tenant.tenant_id);
          
          // Convert API response to Template format
          const formattedTemplates = templateFoundryItems.map(item => ({
            id: item.template_id,
            name: item.name,
            description: item.description,
            type: item.type,
            provider: item.provider,
            codeSnippet: item.code,
            tenantIds: [tenant.tenant_id],
            categories: item.categories || [],
            version: item.version,
            createdAt: item.created_at,
            updatedAt: item.updated_at,
            deploymentCount: 0, // This info might not be available from API
            isPublished: item.is_published,
            author: item.author,
            commitId: item.commit_id
          }));
          
          allTemplates.push(...formattedTemplates);
        } catch (error) {
          console.error(`Error fetching templates for tenant ${tenant.tenant_id}:`, error);
        }
      }
      
      setTemplates(allTemplates);
    } catch (error) {
      console.error("Error loading templates:", error);
      toast.error("Failed to load templates");
    } finally {
      setIsLoading(false);
    }
  }, [tenants]);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  const handleCreateTemplate = async (templateData: Partial<Template>) => {
    // Validate form
    if (!templateData.name || !templateData.description || !templateData.codeSnippet) {
      toast.error("Please fill in all required fields");
      return;
    }
    
    if (!templateData.tenantIds || templateData.tenantIds.length === 0) {
      toast.error("Please select at least one tenant");
      return;
    }
    
    try {
      // Create template for each selected tenant
      for (const tenantId of templateData.tenantIds) {
        await cmpService.createTemplateFoundryItem({
          name: templateData.name,
          description: templateData.description,
          type: templateData.type || "terraform",
          provider: templateData.provider || "azure",
          code: templateData.codeSnippet,
          version: "1.0.0",
          categories: templateData.categories || [],
          is_published: false,
          author: user?.username || "MSP Admin",
          commit_id: Math.random().toString(16).substring(2, 10)
        }, tenantId);
      }
      
      setIsCreating(false);
      toast.success("Template created successfully");
      
      // Reload templates
      loadTemplates();
    } catch (error) {
      console.error("Error creating template:", error);
      toast.error("Failed to create template");
    }
  };

  const handleUpdateTemplate = async (updatedTemplate: Template) => {
    try {
      // Get the tenant ID from the template
      const tenantId = updatedTemplate.tenantIds?.[0];
      if (!tenantId) {
        toast.error("Template has no associated tenant");
        return;
      }
      
      // Update the template in the API
      await cmpService.updateTemplateFoundryItem(updatedTemplate.id, {
        name: updatedTemplate.name,
        description: updatedTemplate.description,
        type: updatedTemplate.type,
        provider: updatedTemplate.provider,
        code: updatedTemplate.codeSnippet,
        version: updatedTemplate.version,
        categories: updatedTemplate.categories,
        is_published: updatedTemplate.isPublished
      });
      
      // Update local state
      const updatedTemplates = templates.map(t => 
        t.id === updatedTemplate.id ? updatedTemplate : t
      );
      
      setTemplates(updatedTemplates);
      setActiveTemplate(updatedTemplate);
      toast.success("Template updated successfully");
    } catch (error) {
      console.error("Error updating template:", error);
      toast.error("Failed to update template");
    }
  };

  const handlePublishTemplate = async (template: Template) => {
    try {
      // Get the tenant ID from the template
      const tenantId = template.tenantIds?.[0];
      if (!tenantId) {
        toast.error("Template has no associated tenant");
        return;
      }
      
      // Update the template in the API
      await cmpService.updateTemplateFoundryItem(template.id, {
        ...template,
        is_published: true
      });
      
      // Update local state
      const updatedTemplates = templates.map(t => 
        t.id === template.id ? { ...t, isPublished: true } : t
      );
      setTemplates(updatedTemplates);
      setActiveTemplate(prev => prev && { ...prev, isPublished: true });
      toast.success("Template published successfully");
    } catch (error) {
      console.error("Error publishing template:", error);
      toast.error("Failed to publish template");
    }
  };

  const handleUnpublishTemplate = async (template: Template) => {
    try {
      // Get the tenant ID from the template
      const tenantId = template.tenantIds?.[0];
      if (!tenantId) {
        toast.error("Template has no associated tenant");
        return;
      }
      
      // Update the template in the API
      await cmpService.updateTemplateFoundryItem(template.id, {
        ...template,
        is_published: false
      });
      
      // Update local state
      const updatedTemplates = templates.map(t => 
        t.id === template.id ? { ...t, isPublished: false } : t
      );
      setTemplates(updatedTemplates);
      setActiveTemplate(prev => prev && { ...prev, isPublished: false });
      toast.success("Template unpublished successfully");
    } catch (error) {
      console.error("Error unpublishing template:", error);
      toast.error("Failed to unpublish template");
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    try {
      // Find the template to get its tenant
      const template = templates.find(t => t.id === templateId);
      if (!template) {
        toast.error("Template not found");
        return;
      }
      
      // Delete the template from the API
      await cmpService.deleteTemplateFoundryItem(templateId);
      
      // Update local state
      setTemplates(templates.filter(t => t.id !== templateId));
      setActiveTemplate(null);
      toast.success("Template deleted successfully");
    } catch (error) {
      console.error("Error deleting template:", error);
      toast.error("Failed to delete template");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Template Foundry</h1>
          <p className="text-muted-foreground">
            Create and manage cloud infrastructure templates across all tenants
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
                <DialogTitle>Create Multi-Tenant Template</DialogTitle>
                <DialogDescription>
                  Create a template and assign it to one or more tenants
                </DialogDescription>
              </DialogHeader>
              
              <TemplateForm 
                onSubmit={handleCreateTemplate} 
                onCancel={() => setIsCreating(false)}
                isMSP={true}
                availableTenants={tenants}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="github">GitHub Integration</TabsTrigger>
        </TabsList>
        
        <TabsContent value="templates" className="mt-4">
          <div className="grid md:grid-cols-3 gap-6">
            <div className="md:col-span-1">
              <TemplateList
                templates={templates}
                activeTemplate={activeTemplate}
                setActiveTemplate={setActiveTemplate}
                filter={filter}
                setFilter={setFilter}
                isLoading={isLoading}
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
                  isMSP={true}
                  availableTenants={tenants}
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
        </TabsContent>
        
        <TabsContent value="github" className="mt-4">
          <GithubIntegration />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default MSPTemplateFoundry;

