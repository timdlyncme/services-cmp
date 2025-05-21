import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tenant } from "@/types/auth";
import { Template } from "@/types/template";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Check,
  GitBranch,
  History,
  Pencil,
  Trash,
  CloudCog,
  X,
  ChevronDown,
  ChevronUp,
  Edit
} from "lucide-react";
import { cmpService } from "@/services/cmp-service";

interface TemplateDetailsProps {
  template: Template;
  onUpdate: (template: Template) => void;
  onDelete: (templateId: string) => void;
  onPublish: (template: Template) => void;
  onUnpublish: (template: Template) => void;
  isMSP: boolean;
  availableTenants: Tenant[];
}

interface TemplateVersion {
  id: number;
  version: string;
  changes: string;
  created_at: string;
  created_by?: {
    username: string;
  };
}

export const TemplateDetails = ({
  template,
  onUpdate,
  onDelete,
  onPublish,
  onUnpublish,
  isMSP,
  availableTenants,
}: TemplateDetailsProps) => {
  const [aiMessage, setAiMessage] = useState("");
  const [editedCode, setEditedCode] = useState(template.codeSnippet);
  const [detailsExpanded, setDetailsExpanded] = useState(true);
  const [codeExpanded, setCodeExpanded] = useState(true);
  const [historyExpanded, setHistoryExpanded] = useState(true);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editedTemplate, setEditedTemplate] = useState<Template>({...template});
  const [versionHistory, setVersionHistory] = useState<TemplateVersion[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  
  // Load version history when template changes
  useEffect(() => {
    const loadVersionHistory = async () => {
      if (!template.id) return;
      
      setIsLoadingHistory(true);
      try {
        // Get template versions from API
        const templateData = await cmpService.getTemplateFoundryItem(template.id);
        if (templateData && templateData.versions) {
          setVersionHistory(templateData.versions);
        } else {
          // If no versions available, create a default history entry
          setVersionHistory([
            {
              id: 1,
              version: template.version,
              changes: "Initial version",
              created_at: template.createdAt,
              created_by: {
                username: template.author || "System"
              }
            }
          ]);
        }
      } catch (error) {
        console.error("Error loading version history:", error);
        // Set default history if API fails
        setVersionHistory([
          {
            id: 1,
            version: template.version,
            changes: "Initial version",
            created_at: template.createdAt,
            created_by: {
              username: template.author || "System"
            }
          }
        ]);
      } finally {
        setIsLoadingHistory(false);
      }
    };
    
    // Reset edited code when template changes
    setEditedCode(template.codeSnippet);
    
    loadVersionHistory();
  }, [template.id, template.codeSnippet]);

  const handleCodeChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setEditedCode(e.target.value);
  };
  
  const handleSaveChanges = () => {
    onUpdate({ ...template, codeSnippet: editedCode, updatedAt: new Date().toISOString() });
  };
  
  const handleAskAI = () => {
    if (!aiMessage.trim()) return;
    
    // In a real app, this would call an AI service
    // For now, we'll just append the AI message to the code with a comment
    setEditedCode(prev => `${prev}\n\n# AI Comment: ${aiMessage}`);
    setAiMessage("");
  };

  const handleEditTemplate = () => {
    setEditedTemplate({...template});
    setIsEditDialogOpen(true);
  };

  const handleSaveEdit = () => {
    const now = new Date().toISOString();
    const updatedTemplate = {
      ...editedTemplate,
      updatedAt: now,
      // Increment version number (assuming semantic versioning)
      version: incrementVersion(template.version),
      // Add a new commit ID
      commitId: generateCommitId(),
    };
    
    onUpdate(updatedTemplate);
    setIsEditDialogOpen(false);
  };

  const incrementVersion = (version: string) => {
    const parts = version.split('.');
    if (parts.length === 3) {
      // Increment the patch version
      const patch = parseInt(parts[2]) + 1;
      return `${parts[0]}.${parts[1]}.${patch}`;
    }
    return version;
  };

  const generateCommitId = () => {
    return Math.random().toString(16).substring(2, 10);
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEditedTemplate({...editedTemplate, name: e.target.value});
  };

  const handleDescriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setEditedTemplate({...editedTemplate, description: e.target.value});
  };

  const handleCategoryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (e.target.checked) {
      setEditedTemplate({
        ...editedTemplate, 
        categories: [...editedTemplate.categories, value]
      });
    } else {
      setEditedTemplate({
        ...editedTemplate, 
        categories: editedTemplate.categories.filter(cat => cat !== value)
      });
    }
  };

  const handleTenantChange = (tenantId: string, checked: boolean) => {
    if (checked) {
      setEditedTemplate({
        ...editedTemplate, 
        tenantIds: [...editedTemplate.tenantIds, tenantId]
      });
    } else {
      setEditedTemplate({
        ...editedTemplate, 
        tenantIds: editedTemplate.tenantIds.filter(id => id !== tenantId)
      });
    }
  };

  // Common categories for templates
  const availableCategories = [
    "Networking", "Security", "Storage", "Compute", "Database", 
    "Containers", "DevOps", "Monitoring", "Analytics", "AI/ML"
  ];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-2">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setDetailsExpanded(!detailsExpanded)}
                className="h-7 w-7"
              >
                {detailsExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
              <CardTitle>{template.name}</CardTitle>
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm"
                className="gap-1"
                onClick={handleEditTemplate}
              >
                <Edit className="h-4 w-4" />
                Edit
              </Button>
              {template.isPublished ? (
                <Button 
                  variant="outline" 
                  size="sm"
                  className="gap-1"
                  onClick={() => onUnpublish(template)}
                >
                  <X className="h-4 w-4" />
                  Unpublish
                </Button>
              ) : (
                <Button 
                  variant="outline" 
                  size="sm"
                  className="gap-1"
                  onClick={() => onPublish(template)}
                >
                  <Check className="h-4 w-4" />
                  Publish
                </Button>
              )}
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => onDelete(template.id)}
              >
                <Trash className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          </div>
          {!detailsExpanded && (
            <p className="text-sm text-muted-foreground mt-1">
              {template.description}
            </p>
          )}
        </CardHeader>
        {detailsExpanded && (
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {template.description}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div>
                <div className="text-sm font-medium">Type</div>
                <div className="text-sm">{template.type}</div>
              </div>
              <div>
                <div className="text-sm font-medium">Provider</div>
                <div className="text-sm">{template.provider.toUpperCase()}</div>
              </div>
              <div>
                <div className="text-sm font-medium">Version</div>
                <div className="text-sm">v{template.version}</div>
              </div>
              <div>
                <div className="text-sm font-medium">Created</div>
                <div className="text-sm">{new Date(template.createdAt).toLocaleDateString()}</div>
              </div>
              <div>
                <div className="text-sm font-medium">Updated</div>
                <div className="text-sm">{new Date(template.updatedAt).toLocaleDateString()}</div>
              </div>
              <div>
                <div className="text-sm font-medium">Deployments</div>
                <div className="text-sm">{template.deploymentCount}</div>
              </div>
            </div>
            
            <div>
              <h3 className="text-sm font-medium mb-2">Categories</h3>
              <div className="flex flex-wrap gap-2">
                {template.categories.map((category) => (
                  <Badge key={category} variant="secondary">
                    {category}
                  </Badge>
                ))}
              </div>
            </div>
            
            {isMSP && (
              <div>
                <h3 className="text-sm font-medium mb-2">Assigned Tenants</h3>
                <div className="flex flex-wrap gap-2">
                  {template.tenantIds.map((tenantId) => {
                    const tenant = availableTenants.find(t => t.tenant_id === tenantId);
                    return tenant ? (
                      <Badge key={tenantId} variant="outline">
                        {tenant.name}
                      </Badge>
                    ) : null;
                  })}
                </div>
              </div>
            )}
          </CardContent>
        )}
      </Card>
      
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setCodeExpanded(!codeExpanded)}
              className="h-7 w-7"
            >
              {codeExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
            <CardTitle>Template Code</CardTitle>
          </div>
          <Button size="sm" onClick={handleSaveChanges}>
            <Pencil className="h-4 w-4 mr-2" />
            Save Changes
          </Button>
        </CardHeader>
        {codeExpanded && (
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <ScrollArea className="h-[400px] border rounded-md">
                  <Textarea
                    value={editedCode}
                    onChange={handleCodeChange}
                    className="font-mono h-full border-0 focus-visible:ring-0"
                    rows={20}
                  />
                </ScrollArea>
              </div>
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center">
                    <CloudCog className="h-5 w-5 mr-2 text-primary" />
                    <h3 className="font-medium">AI Assistant</h3>
                  </div>
                  <Textarea
                    placeholder="Ask AI for help with this template..."
                    value={aiMessage}
                    onChange={(e) => setAiMessage(e.target.value)}
                    rows={4}
                    className="resize-none"
                  />
                  <Button onClick={handleAskAI} className="w-full">
                    Ask AI
                  </Button>
                </div>
                <div className="border rounded-md p-3">
                  <h4 className="text-sm font-medium mb-2">AI Suggestions</h4>
                  <p className="text-sm text-muted-foreground">
                    Ask me to analyze your template, suggest optimizations, or help with syntax issues.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        )}
      </Card>
      
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setHistoryExpanded(!historyExpanded)}
              className="h-7 w-7"
            >
              {historyExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
            <CardTitle>Version History</CardTitle>
          </div>
        </CardHeader>
        {historyExpanded && (
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Version</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Author</TableHead>
                  <TableHead>Commit ID</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoadingHistory ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-4">
                      <div className="flex justify-center items-center">
                        <svg className="animate-spin h-5 w-5 mr-3 text-primary" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Loading version history...
                      </div>
                    </TableCell>
                  </TableRow>
                ) : versionHistory.length > 0 ? (
                  versionHistory.map((version) => (
                    <TableRow key={version.id}>
                      <TableCell className="font-medium">v{version.version}</TableCell>
                      <TableCell>{new Date(version.created_at).toLocaleDateString()}</TableCell>
                      <TableCell>{version.created_by?.username || template.author || "System"}</TableCell>
                      <TableCell className="font-mono text-xs">{template.commitId || "a2f391d"}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon">
                          <History className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-4">
                      No version history available
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        )}
      </Card>

      {/* Edit Template Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Template</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Template Name</Label>
              <Input 
                id="name" 
                value={editedTemplate.name} 
                onChange={handleNameChange}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea 
                id="description" 
                value={editedTemplate.description} 
                onChange={handleDescriptionChange}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>Categories</Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {availableCategories.map(category => (
                  <div key={category} className="flex items-center space-x-2">
                    <Checkbox 
                      id={`category-${category}`} 
                      value={category}
                      checked={editedTemplate.categories.includes(category)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setEditedTemplate({
                            ...editedTemplate, 
                            categories: [...editedTemplate.categories, category]
                          });
                        } else {
                          setEditedTemplate({
                            ...editedTemplate, 
                            categories: editedTemplate.categories.filter(cat => cat !== category)
                          });
                        }
                      }}
                    />
                    <Label htmlFor={`category-${category}`}>{category}</Label>
                  </div>
                ))}
              </div>
            </div>
            {isMSP && (
              <div className="space-y-2">
                <Label>Assigned Tenants</Label>
                <div className="grid grid-cols-2 gap-2 border rounded-md p-3">
                  {availableTenants.map(tenant => (
                    <div key={tenant.tenant_id} className="flex items-center space-x-2">
                      <Checkbox 
                        id={`tenant-${tenant.tenant_id}`} 
                        checked={editedTemplate.tenantIds.includes(tenant.tenant_id)}
                        onCheckedChange={(checked) => {
                          handleTenantChange(tenant.tenant_id, checked === true);
                        }}
                      />
                      <Label htmlFor={`tenant-${tenant.tenant_id}`}>{tenant.name}</Label>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveEdit}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

