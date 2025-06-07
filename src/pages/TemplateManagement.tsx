import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Search, Plus, Edit, Trash, RefreshCw, AlertCircle, FileCode, Upload, BarChart3, PieChart, TrendingUp } from "lucide-react";
import { CloudTemplate, CloudProvider, TemplateType } from "@/types/cloud";
import { cmpService } from "@/services/cmp-service";
import { useNavigate } from "react-router-dom";
import { UploadTemplateWizard } from "@/components/upload-template-wizard";
import { EditTemplateDialog } from "@/components/edit-template-dialog";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart as RechartsPieChart, Cell, Pie } from 'recharts';

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
  
  // State for the edit template dialog
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<CloudTemplate | null>(null);
  
  // State for delete confirmation dialog
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<CloudTemplate | null>(null);
  
  // Check if user has permission to manage templates
  const canCreateTemplates = hasPermission("create:templates");
  const canUpdateTemplates = hasPermission("update:templates");
  const canDeleteTemplates = hasPermission("delete:templates");
  const canManageTemplates = canCreateTemplates || canUpdateTemplates || canDeleteTemplates;
  
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
    if (!templateId || !currentTenant) return;
    
    try {
      await cmpService.deleteTemplate(templateId);
      setTemplates(templates.filter(t => t.id !== templateId));
      toast.success("Template deleted successfully");
      
      // Close the delete dialog
      setIsDeleteDialogOpen(false);
      setTemplateToDelete(null);
    } catch (error) {
      console.error("Error deleting template:", error);
      toast.error("Failed to delete template");
    }
  };
  
  const handleViewTemplate = (templateId: string) => {
    navigate(`/catalog/${templateId}`);
  };
  
  const handleEditTemplate = (template: CloudTemplate) => {
    setEditingTemplate(template);
    setIsEditDialogOpen(true);
  };
  
  const handleDeleteTemplateConfirm = (template: CloudTemplate) => {
    setTemplateToDelete(template);
    setIsDeleteDialogOpen(true);
  };
  
  // Calculate stats for dashboard
  const getTemplateStats = () => {
    const totalTemplates = templates.length;
    const publicTemplates = templates.filter(t => t.isPublic).length;
    const privateTemplates = totalTemplates - publicTemplates;
    
    // Group by provider
    const providerStats = templates.reduce((acc, template) => {
      acc[template.provider] = (acc[template.provider] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    // Group by type
    const typeStats = templates.reduce((acc, template) => {
      acc[template.type] = (acc[template.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    return {
      totalTemplates,
      publicTemplates,
      privateTemplates,
      providerStats,
      typeStats
    };
  };
  
  const stats = getTemplateStats();
  
  // Prepare chart data
  const providerChartData = Object.entries(stats.providerStats).map(([provider, count]) => ({
    name: provider.toUpperCase(),
    value: count,
    color: provider === 'azure' ? '#0078d4' : provider === 'aws' ? '#ff9900' : '#4285f4'
  }));
  
  const typeChartData = Object.entries(stats.typeStats).map(([type, count]) => ({
    name: type,
    count
  }));

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
          {canCreateTemplates && (
            <Button onClick={() => setIsUploadWizardOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Template
            </Button>
          )}
        </div>
      </div>
      
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Templates</CardTitle>
            <FileCode className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalTemplates}</div>
            <p className="text-xs text-muted-foreground">
              Infrastructure templates
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Public Templates</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.publicTemplates}</div>
            <p className="text-xs text-muted-foreground">
              Shared with organization
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Private Templates</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.privateTemplates}</div>
            <p className="text-xs text-muted-foreground">
              Personal templates
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Providers</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Object.keys(stats.providerStats).length}</div>
            <p className="text-xs text-muted-foreground">
              Cloud providers
            </p>
          </CardContent>
        </Card>
      </div>
      
      {/* Charts */}
      {templates.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Templates by Type</CardTitle>
              <CardDescription>Distribution of template types</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={typeChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="#8884d8" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Templates by Provider</CardTitle>
              <CardDescription>Distribution across cloud providers</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <RechartsPieChart>
                  <Tooltip />
                  <Pie data={providerChartData} cx="50%" cy="50%" outerRadius={80} fill="#8884d8" dataKey="value">
                    {providerChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                </RechartsPieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}
      
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
                    {canUpdateTemplates && (
                      <Button variant="ghost" size="icon" onClick={() => handleEditTemplate(template)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                    )}
                    {canDeleteTemplates && (
                      <Button variant="ghost" size="icon" onClick={() => handleDeleteTemplateConfirm(template)}>
                        <Trash className="h-4 w-4" />
                      </Button>
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
              : canCreateTemplates 
                ? "Upload your first template to start building your catalog" 
              : "No templates are available for your account"}
          </p>
          {canCreateTemplates && (
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
      
      <EditTemplateDialog
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        template={editingTemplate}
        onTemplateUpdated={fetchTemplates}
      />
      
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Delete</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the template "{templateToDelete?.name}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => handleDeleteTemplate(templateToDelete?.id)}
            >
              Delete Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TemplateManagement;
