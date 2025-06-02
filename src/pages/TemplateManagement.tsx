import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Search, Plus, Edit, Trash, RefreshCw, AlertCircle, FileCode, Upload } from "lucide-react";
import { CloudTemplate, CloudProvider, TemplateType } from "@/types/cloud";
import { cmpService } from "@/services/cmp-service";
import { useNavigate } from "react-router-dom";
import { UploadTemplateWizard } from "@/components/upload-template-wizard";

const TemplateManagement = () => {
  const { currentTenant, hasPermission } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [templates, setTemplates] = useState<CloudTemplate[]>([]);
  const [filteredTemplates, setFilteredTemplates] = useState<CloudTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // State for the upload template wizard
  const [isUploadWizardOpen, setIsUploadWizardOpen] = useState(false);
  
  // Check if user has permission to manage templates
  const canManageTemplates = hasPermission("manage:templates");
  
  // Fetch templates from API
  const fetchTemplates = async () => {
    if (!currentTenant) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const templates = await cmpService.getTemplates(currentTenant.tenant_id);
      setTemplates(templates);
      setFilteredTemplates(templates);
    } catch (error) {
      console.error("Error fetching templates:", error);
      setError("Failed to load templates. Please try again.");
      
      if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error("Failed to load templates");
      }
    } finally {
      setIsLoading(false);
    }
  };
  
  useEffect(() => {
    if (currentTenant) {
      fetchTemplates();
    }
  }, [currentTenant]);
  
  useEffect(() => {
    let filtered = templates;
    
    // Filter by provider
    if (activeTab !== "all") {
      filtered = filtered.filter(template => template.provider === activeTab);
    }
    
    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(template => 
        template.name.toLowerCase().includes(query) || 
        template.description.toLowerCase().includes(query) ||
        template.categories.some(cat => cat.toLowerCase().includes(query))
      );
    }
    
    setFilteredTemplates(filtered);
  }, [searchQuery, activeTab, templates]);
  
  const handleRefresh = () => {
    fetchTemplates();
    toast.success("Refreshing templates...");
  };
  
  const handleCreateTemplate = async (templateData: any) => {
    try {
      setIsLoading(true);
      
      console.log("Creating template with data:", templateData);
      
      await cmpService.createTemplate(templateData, currentTenant!.tenant_id);
      
      // Refresh the list
      await fetchTemplates();
      
      toast.success("Template created successfully");
    } catch (error) {
      console.error("Error creating template:", error);
      
      if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error("Failed to create template");
      }
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleDeleteTemplate = async (templateId: string) => {
    try {
      setIsLoading(true);
      
      // Delete the template
      await cmpService.deleteTemplate(templateId);
      
      // Refresh the list
      await fetchTemplates();
      
      toast.success("Template deleted successfully");
    } catch (error) {
      console.error("Error deleting template:", error);
      
      if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error("Failed to delete template");
      }
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleViewTemplate = (templateId: string) => {
    navigate(`/templates/${templateId}`);
  };
  
  const providerColor = (provider: CloudProvider) => {
    switch (provider) {
      case "azure": return "bg-cloud-azure text-white";
      case "aws": return "bg-cloud-aws text-black";
      case "gcp": return "bg-cloud-gcp text-white";
      default: return "bg-muted text-muted-foreground";
    }
  };
  
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Template Management</h1>
          <p className="text-muted-foreground">
            Create and manage infrastructure templates
          </p>
        </div>
        
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          
        </div>
      </div>
      
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search templates..."
            className="pl-8"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        
        <Tabs 
          defaultValue="all" 
          className="w-full md:w-auto"
          value={activeTab}
          onValueChange={setActiveTab}
        >
          <TabsList className="grid grid-cols-4 w-full md:w-[400px]">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="azure">Azure</TabsTrigger>
            <TabsTrigger value="aws">AWS</TabsTrigger>
            <TabsTrigger value="gcp">GCP</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-10">
          <RefreshCw className="h-10 w-10 text-muted-foreground mb-2 animate-spin" />
          <h3 className="text-lg font-medium">Loading templates...</h3>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-10">
          <AlertCircle className="h-10 w-10 text-destructive mb-2" />
          <h3 className="text-lg font-medium">Error loading templates</h3>
          <p className="text-muted-foreground">{error}</p>
          <Button variant="outline" className="mt-4" onClick={fetchTemplates}>
            Try Again
          </Button>
        </div>
      ) : filteredTemplates.length > 0 ? (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Categories</TableHead>
                <TableHead>Deployments</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTemplates.map((template) => (
                <TableRow key={template.id}>
                  <TableCell className="font-medium">{template.name}</TableCell>
                  <TableCell>
                    <Badge className={providerColor(template.provider)}>
                      {template.provider.toUpperCase()}
                    </Badge>
                  </TableCell>
                  <TableCell>{template.type}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {template.categories.map((category, index) => (
                        <Badge key={index} variant="secondary">{category}</Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>{template.deploymentCount}</TableCell>
                  <TableCell>{new Date(template.updatedAt).toLocaleDateString()}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => handleViewTemplate(template.id)}>
                      <FileCode className="h-4 w-4" />
                    </Button>
                    {canManageTemplates && (
                      <>
                        <Button variant="ghost" size="icon" onClick={() => toast.info("Edit template functionality would be implemented here")}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteTemplate(template.id)}>
                          <Trash className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center h-64 border rounded-md p-8">
          <FileCode className="h-12 w-12 mx-auto text-muted-foreground" />
          <h2 className="mt-4 text-xl font-semibold">No Templates Found</h2>
          <p className="text-muted-foreground mt-2">
            {searchQuery 
              ? "No templates match your search criteria" 
              : canManageTemplates 
                ? "Upload your first template to start building your catalog" 
              : "No templates are available for your account"}
          </p>
          {canManageTemplates && (
            <Button className="mt-4" onClick={() => setIsUploadWizardOpen(true)}>
              <Upload className="h-4 w-4 mr-2" />
              Upload Template
            </Button>
          )}
        </div>
      )}
      
      <UploadTemplateWizard
        open={isUploadWizardOpen}
        onOpenChange={setIsUploadWizardOpen}
        onCreateTemplate={handleCreateTemplate}
        isLoading={isLoading}
      />
    </div>
  );
};

export default TemplateManagement;
