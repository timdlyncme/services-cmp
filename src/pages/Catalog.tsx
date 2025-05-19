import { useState, useEffect } from "react";
import { useAuth } from "@/context/auth-context";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CloudTemplate, CloudProvider, TemplateType } from "@/types/cloud";
import { useNavigate } from "react-router-dom";
import { Search, FileCode } from "lucide-react";
import { deploymentService } from "@/services/deployment-service";
import { toast } from "sonner";

interface FilterOptions {
  provider: CloudProvider | "all";
  type: TemplateType | "all";
  search: string;
}

const Catalog = () => {
  const { currentTenant, hasPermission } = useAuth();
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<CloudTemplate[]>([]);
  const [filteredTemplates, setFilteredTemplates] = useState<CloudTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filters, setFilters] = useState<FilterOptions>({
    provider: "all",
    type: "all",
    search: ""
  });

  useEffect(() => {
    const fetchTemplates = async () => {
      if (!currentTenant) return;
      
      // Check if user has permission to view templates
      if (!hasPermission("view:catalog")) {
        toast.error("You don't have permission to view the template catalog");
        return;
      }
      
      setIsLoading(true);
      try {
        // Fetch templates from API
        const templatesData = await deploymentService.getTemplates(currentTenant.id);
        setTemplates(templatesData);
        setFilteredTemplates(templatesData);
      } catch (error) {
        console.error("Failed to fetch templates:", error);
        toast.error("Failed to load templates. Please try again later.");
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchTemplates();
  }, [currentTenant, hasPermission]);

  useEffect(() => {
    let result = templates;
    
    if (filters.provider !== "all") {
      result = result.filter(template => template.provider === filters.provider);
    }
    
    if (filters.type !== "all") {
      result = result.filter(template => template.type === filters.type);
    }
    
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      result = result.filter(
        template => 
          template.name.toLowerCase().includes(searchLower) ||
          template.description.toLowerCase().includes(searchLower) ||
          template.categories.some(cat => cat.toLowerCase().includes(searchLower))
      );
    }
    
    setFilteredTemplates(result);
  }, [filters, templates]);
  
  const providerColor = (provider: CloudProvider) => {
    switch (provider) {
      case "azure": return "bg-cloud-azure text-white";
      case "aws": return "bg-cloud-aws text-black";
      case "gcp": return "bg-cloud-gcp text-white";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const typeLabel = (type: TemplateType) => {
    switch (type) {
      case "terraform": return "Terraform";
      case "arm": return "ARM Template";
      case "cloudformation": return "CloudFormation";
      default: return type;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Template Catalog</h1>
          <p className="text-muted-foreground">
            Browse and deploy cloud infrastructure templates
          </p>
        </div>
      </div>
      
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search templates..."
            className="pl-8"
            value={filters.search}
            onChange={e => setFilters({...filters, search: e.target.value})}
          />
        </div>
        
        <Tabs 
          defaultValue="all" 
          className="w-full md:w-auto"
          onValueChange={(value) => setFilters({...filters, provider: value as CloudProvider | "all"})}
        >
          <TabsList className="grid grid-cols-4 w-full md:w-[400px]">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="azure">Azure</TabsTrigger>
            <TabsTrigger value="aws">AWS</TabsTrigger>
            <TabsTrigger value="gcp">GCP</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          <div className="col-span-3 py-8 text-center">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto"></div>
            <h3 className="mt-4 text-lg font-medium">Loading templates...</h3>
          </div>
        ) : filteredTemplates.length > 0 ? (
          filteredTemplates.map(template => (
            <Card key={template.id} className="overflow-hidden">
              <CardHeader className="pb-0">
                <div className="flex justify-between items-start mb-2">
                  <Badge className={`${providerColor(template.provider)}`}>
                    {template.provider.toUpperCase()}
                  </Badge>
                  <Badge variant="outline">{typeLabel(template.type)}</Badge>
                </div>
                <CardTitle className="line-clamp-1">{template.name}</CardTitle>
                <CardDescription className="line-clamp-2">
                  {template.description}
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="flex flex-wrap gap-2">
                  {template.categories.map(category => (
                    <Badge key={category} variant="secondary">
                      {category}
                    </Badge>
                  ))}
                </div>
                <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                  <div className="flex flex-col">
                    <span className="text-muted-foreground">Deployments</span>
                    <span className="font-medium">{template.deploymentCount}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-muted-foreground">Updated</span>
                    <span className="font-medium">
                      {new Date(template.updatedAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex justify-between">
                <Button 
                  variant="outline"
                  className="w-full"
                  onClick={() => navigate(`/catalog/${template.id}`)}
                >
                  <FileCode className="mr-2 h-4 w-4" />
                  View Template
                </Button>
              </CardFooter>
            </Card>
          ))
        ) : (
          <div className="col-span-3 py-8 text-center">
            <FileCode className="mx-auto h-8 w-8 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-medium">No templates found</h3>
            <p className="text-muted-foreground">
              Try adjusting your search or filters.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Catalog;
