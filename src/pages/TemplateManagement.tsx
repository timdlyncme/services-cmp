import { useState, useEffect } from "react";
import { useAuth } from "@/context/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Search, Plus, Edit, Trash, RefreshCw, AlertCircle, FileCode, Upload } from "lucide-react";
import { CloudTemplate, CloudProvider, TemplateType } from "@/types/cloud";
import { cmpService } from "@/services/cmp-service";
import { useNavigate } from "react-router-dom";

const TemplateManagement = () => {
  const { currentTenant, hasPermission } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [templates, setTemplates] = useState<CloudTemplate[]>([]);
  const [filteredTemplates, setFilteredTemplates] = useState<CloudTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // State for the new template dialog
  const [isNewTemplateDialogOpen, setIsNewTemplateDialogOpen] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState("");
  const [newTemplateDescription, setNewTemplateDescription] = useState("");
  const [newTemplateProvider, setNewTemplateProvider] = useState<CloudProvider>("azure");
  const [newTemplateType, setNewTemplateType] = useState<TemplateType>("terraform");
  const [newTemplateCategories, setNewTemplateCategories] = useState("");
  
  // Check if user has permission to manage templates
  const canManageTemplates = hasPermission("manage:templates");
  
  // Fetch templates from API
  const fetchTemplates = async () => {
    if (!currentTenant) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const templates = await cmpService.getTemplates(currentTenant.id);
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
  
  const handleCreateTemplate = async () => {
    if (!newTemplateName) {
      toast.error("Template name is required");
      return;
    }
    
    try {
      setIsLoading(true);
      
      // Create the new template
      const categories = newTemplateCategories
        .split(",")
        .map(cat => cat.trim())
        .filter(cat => cat.length > 0);
      
      const newTemplate = {
        name: newTemplateName,
        description: newTemplateDescription,
        provider: newTemplateProvider,
        type: newTemplateType,
        categories: categories,
        code: ""
      };
      
      await cmpService.createTemplate(newTemplate, currentTenant!.id);
      
      // Refresh the list
      await fetchTemplates();
      
      // Reset form and close dialog
      setNewTemplateName("");
      setNewTemplateDescription("");
      setNewTemplateProvider("azure");
      setNewTemplateType("terraform");
      setNewTemplateCategories("");
      setIsNewTemplateDialogOpen(false);
      
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
          
          {canManageTemplates && (
            <Dialog open={isNewTemplateDialogOpen} onOpenChange={setIsNewTemplateDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Template
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Upload New Template</DialogTitle>
                  <DialogDescription>
                    Add a new infrastructure template to your catalog
                  </DialogDescription>
                </DialogHeader>
                
                <div className="grid gap-4 py-4">
                  <div className="space-y-2">
                    <label htmlFor="name" className="text-sm font-medium">Template Name</label>
                    <Input
                      id="name"
                      value={newTemplateName}
                      onChange={(e) => setNewTemplateName(e.target.value)}
                      placeholder="e.g., Web App with Database"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <label htmlFor="description" className="text-sm font-medium">Description</label>
                    <Input
                      id="description"
                      value={newTemplateDescription}
                      onChange={(e) => setNewTemplateDescription(e.target.value)}
                      placeholder="Describe this template"
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label htmlFor="provider" className="text-sm font-medium">Cloud Provider</label>
                      <select
                        id="provider"
                        value={newTemplateProvider}
                        onChange={(e) => setNewTemplateProvider(e.target.value as CloudProvider)}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <option value="azure">Azure</option>
                        <option value="aws">AWS</option>
                        <option value="gcp">GCP</option>
                      </select>
                    </div>
                    
                    <div className="space-y-2">
                      <label htmlFor="type" className="text-sm font-medium">Template Type</label>
                      <select
                        id="type"
                        value={newTemplateType}
                        onChange={(e) => setNewTemplateType(e.target.value as TemplateType)}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <option value="terraform">Terraform</option>
                        <option value="arm">ARM Template</option>
                        <option value="cloudformation">CloudFormation</option>
                      </select>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <label htmlFor="categories" className="text-sm font-medium">Categories</label>
                    <Input
                      id="categories"
                      value={newTemplateCategories}
                      onChange={(e) => setNewTemplateCategories(e.target.value)}
                      placeholder="e.g., web, database, networking (comma separated)"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <label htmlFor="file" className="text-sm font-medium">Template File</label>
                    <Input
                      id="file"
                      type="file"
                      accept=".tf,.json,.yaml,.yml"
                    />
                    <p className="text-xs text-muted-foreground">
                      Upload a Terraform, ARM, or CloudFormation template file
                    </p>
                  </div>
                </div>
                
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsNewTemplateDialogOpen(false)}>Cancel</Button>
                  <Button onClick={handleCreateTemplate}>Upload Template</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
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
            <Button className="mt-4" onClick={() => setIsNewTemplateDialogOpen(true)}>
              Upload Template
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

export default TemplateManagement;

