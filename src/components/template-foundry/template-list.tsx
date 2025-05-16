
import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, FileCode } from "lucide-react";
import { Template } from "@/types/template";

interface TemplateListProps {
  templates: Template[];
  activeTemplate: Template | null;
  setActiveTemplate: (template: Template | null) => void;
  filter?: string;
  setFilter?: (filter: string) => void;
}

export const TemplateList = ({ 
  templates, 
  activeTemplate, 
  setActiveTemplate,
  filter = "all",
  setFilter = () => {}
}: TemplateListProps) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [filteredTemplates, setFilteredTemplates] = useState<Template[]>(templates);

  useEffect(() => {
    let result = templates;
    
    if (filter !== "all") {
      if (filter === "published") {
        result = result.filter(template => template.isPublished);
      } else if (filter === "draft") {
        result = result.filter(template => !template.isPublished);
      } else {
        result = result.filter(template => template.provider === filter);
      }
    }
    
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        template => 
          template.name.toLowerCase().includes(term) ||
          template.description.toLowerCase().includes(term) ||
          template.categories.some(cat => cat.toLowerCase().includes(term))
      );
    }
    
    setFilteredTemplates(result);
  }, [searchTerm, filter, templates]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle>Template Library</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search templates..."
            className="pl-8"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <Tabs defaultValue={filter} onValueChange={setFilter}>
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="published">Published</TabsTrigger>
            <TabsTrigger value="draft">Drafts</TabsTrigger>
          </TabsList>
        </Tabs>
        
        <ScrollArea className="h-[500px] pr-3">
          <div className="space-y-2">
            {filteredTemplates.length > 0 ? (
              filteredTemplates.map((template) => (
                <div
                  key={template.id}
                  className={`p-3 rounded-md cursor-pointer hover:bg-accent ${
                    activeTemplate?.id === template.id ? "bg-accent" : ""
                  }`}
                  onClick={() => setActiveTemplate(template)}
                >
                  <div className="flex justify-between items-start">
                    <div className="font-medium truncate">{template.name}</div>
                    <Badge variant={template.isPublished ? "secondary" : "outline"}>
                      {template.isPublished ? "Published" : "Draft"}
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground truncate">
                    {template.description}
                  </div>
                  <div className="flex mt-2 justify-between items-center">
                    <div className="flex gap-2">
                      <Badge 
                        className={
                          template.provider === "azure" ? "bg-cloud-azure text-white" :
                          template.provider === "aws" ? "bg-cloud-aws text-black" :
                          "bg-cloud-gcp text-white"
                        }>
                        {template.provider.toUpperCase()}
                      </Badge>
                      <Badge variant="outline">{template.type}</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      v{template.version}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8">
                <FileCode className="h-8 w-8 mx-auto text-muted-foreground" />
                <p className="mt-2 text-muted-foreground">No templates found</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
