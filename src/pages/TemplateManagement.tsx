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
import { TenantSwitcher } from "@/components/tenant-switcher";

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
  
  const handleCreateTemplate = async () => {
    if (!newTemplateName) {
      toast.error("Template name is required");
      return;
    }
    
    try {
      setIsLoading(true);
      
      // Get the file input element
      const fileInput = document.getElementById('file') as HTMLInputElement;
      let fileContent = "";
      
      // Read the file content if a file was selected
      if (fileInput && fileInput.files && fileInput.files.length > 0) {
        const file = fileInput.files[0];
        fileContent = await readFileContent(file);
        console.log("File content read:", fileContent.substring(0, 100) + "...");
      } else {
        console.log("No file selected");
      }
      
      // Create the new template
      const categories = newTemplateCategories
        .split(",")
        .map(cat => cat.trim())
        .filter(cat => cat.length > 0);
      
      const newTemplate = {
        name: newTemplateName,
        description: newTemplateDescription,
        provider: newTemplateProvider,
        type: newTemplateType, // Make sure this is correctly set
        category: categories.length > 0 ? categories.join(',') : undefined,  // Convert array to comma-separated string
        code: fileContent || "",  // Include the file content, ensure it's not null
        is_public: false
      };
      
      console.log("Sending template data:", {
        ...newTemplate,
        code: newTemplate.code ? `${newTemplate.code.substring(0, 100)}...` : 'No code'
      });
      
      await cmpService.createTemplate(newTemplate, currentTenant!.tenant_id);
      
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
  
  // Helper function to read file content
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
  
  return (
    <div className="container mx-auto py-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Template Management</h1>
        <div className="flex items-center space-x-2">
          <div className="w-[200px]">
            <TenantSwitcher />
          </div>
          {hasPermission("create:templates") && (
            <Button onClick={() => setIsNewTemplateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              New Template
            </Button>
          )}
        </div>
      </div>

      {/* Search and filter */}
      <div className="flex justify-between items-center mb-6">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
          <Input
            type="search"
            placeholder="Search templates..."
            className="pl-8"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Button variant="outline" onClick={fetchTemplates} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>
      
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
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
