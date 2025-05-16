
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tenant } from "@/types/auth";
import { Template } from "@/types/template";
import {
  Check,
  GitBranch,
  History,
  Pencil,
  Trash,
  CloudCog,
  X
} from "lucide-react";

interface TemplateDetailsProps {
  template: Template;
  onUpdate: (template: Template) => void;
  onDelete: (templateId: string) => void;
  onPublish: (template: Template) => void;
  onUnpublish: (template: Template) => void;
  isMSP: boolean;
  availableTenants: Tenant[];
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

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex justify-between items-start">
            <div>
              <CardTitle>{template.name}</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {template.description}
              </p>
            </div>
            <div className="flex gap-2">
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
        </CardHeader>
        <CardContent className="space-y-4">
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
                  const tenant = availableTenants.find(t => t.id === tenantId);
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
      </Card>
      
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle>Template Code</CardTitle>
          <Button size="sm" onClick={handleSaveChanges}>
            <Pencil className="h-4 w-4 mr-2" />
            Save Changes
          </Button>
        </CardHeader>
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
      </Card>
      
      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Version History</CardTitle>
        </CardHeader>
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
              <TableRow>
                <TableCell className="font-medium">v{template.version}</TableCell>
                <TableCell>{new Date(template.updatedAt).toLocaleDateString()}</TableCell>
                <TableCell>{template.author || "System"}</TableCell>
                <TableCell className="font-mono text-xs">{template.commitId || "a2f391d"}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon">
                    <History className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">v0.9.0</TableCell>
                <TableCell>{new Date(new Date(template.createdAt).getTime() - 7 * 24 * 60 * 60 * 1000).toLocaleDateString()}</TableCell>
                <TableCell>{template.author || "System"}</TableCell>
                <TableCell className="font-mono text-xs">9c72e5b</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon">
                    <History className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};
