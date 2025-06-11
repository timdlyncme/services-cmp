import { useState, useEffect } from "react";
import { useAuth } from "@/context/auth-context";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CloudTemplate, CloudProvider, TemplateType } from "@/types/cloud";
import { useNavigate } from "react-router-dom";
import { Search, FileCode, RefreshCw, AlertCircle, Grid, List } from "lucide-react";
import { cmpService } from "@/services/cmp-service";
import { toast } from "sonner";
import CategoryGroup from "@/components/catalog/CategoryGroup";
import CategoryFilter from "@/components/catalog/CategoryFilter";
import TemplateCard from "@/components/catalog/TemplateCard";

interface FilterOptions {
  provider: CloudProvider | "all";
  type: TemplateType | "all";
  search: string;
  categories: string[];
}

interface GroupedTemplates {
  [category: string]: CloudTemplate[];
}

const Catalog = () => {
  const navigate = useNavigate();
  const { user, currentTenant, isSwitchingTenant } = useAuth();
  const [templates, setTemplates] = useState<CloudTemplate[]>([]);
  const [filteredTemplates, setFilteredTemplates] = useState<CloudTemplate[]>([]);
  const [categories, setCategories] = useState<Record<string, number>>({});
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'grid' | 'category'>('category');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [filters, setFilters] = useState<FilterOptions>({
    provider: "all",
    type: "all",
    search: "",
    categories: []
  });

  const fetchTemplates = async () => {
    if (!currentTenant) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const [templatesData, categoriesData] = await Promise.all([
        cmpService.getTemplates(currentTenant.tenant_id),
        cmpService.getTemplateCategories(currentTenant.tenant_id)
      ]);
      
      setTemplates(templatesData);
      setFilteredTemplates(templatesData);
      setCategories(categoriesData);
      
      // Auto-expand categories with templates by default
      const categoriesWithTemplates = Object.keys(categoriesData);
      setExpandedCategories(new Set(categoriesWithTemplates.slice(0, 3))); // Expand first 3 categories
      
    } catch (error) {
      console.error('Error fetching templates:', error);
      setError('Failed to load templates. Please try again.');
      toast.error('Failed to load templates');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTemplatesAndCategories = async () => {
    if (!currentTenant) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const [templatesData, categoriesData] = await Promise.all([
        cmpService.getTemplates(currentTenant.tenant_id),
        cmpService.getTemplateCategories(currentTenant.tenant_id)
      ]);
      
      setTemplates(templatesData);
      setFilteredTemplates(templatesData);
      setCategories(categoriesData);
      
      // Auto-expand categories with templates by default
      const categoriesWithTemplates = Object.keys(categoriesData);
      setExpandedCategories(new Set(categoriesWithTemplates.slice(0, 3))); // Expand first 3 categories
      
    } catch (error) {
      console.error('Error fetching templates:', error);
      setError('Failed to load templates. Please try again.');
      toast.error('Failed to load templates');
    } finally {
      setIsLoading(false);
    }
  };

  // Category management functions
  const toggleCategory = (categoryName: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(categoryName)) {
      newExpanded.delete(categoryName);
    } else {
      newExpanded.add(categoryName);
    }
    setExpandedCategories(newExpanded);
  };

  const handleCategoryToggle = (category: string) => {
    const newCategories = filters.categories.includes(category)
      ? filters.categories.filter(c => c !== category)
      : [...filters.categories, category];
    
    setFilters({ ...filters, categories: newCategories });
  };

  const clearCategoryFilters = () => {
    setFilters({ ...filters, categories: [] });
  };

  const refreshTemplates = () => {
    fetchTemplates();
    toast.success("Refreshing templates...");
  };

  // Group templates by their primary category (first category in the array)
  const groupTemplatesByCategory = (templates: CloudTemplate[]): GroupedTemplates => {
    const grouped: GroupedTemplates = {};
    
    templates.forEach(template => {
      const primaryCategory = template.categories && template.categories.length > 0 
        ? template.categories[0] 
        : 'Uncategorized';
      
      if (!grouped[primaryCategory]) {
        grouped[primaryCategory] = [];
      }
      grouped[primaryCategory].push(template);
    });
    
    return grouped;
  };

  useEffect(() => {
    if (currentTenant) {
      fetchTemplates();
    }
  }, [currentTenant]);

  // Clear data immediately when tenant switching starts
  useEffect(() => {
    if (isSwitchingTenant) {
      setTemplates([]);
      setFilteredTemplates([]);
      setCategories({});
      setIsLoading(true);
      setError(null);
    }
  }, [isSwitchingTenant]);

  useEffect(() => {
    let result = templates;
    
    // Filter by provider
    if (filters.provider !== "all") {
      result = result.filter(template => template.provider === filters.provider);
    }
    
    // Filter by type
    if (filters.type !== "all") {
      result = result.filter(template => template.type === filters.type);
    }
    
    // Filter by search term
    if (filters.search) {
      result = result.filter(template =>
        template.name.toLowerCase().includes(filters.search.toLowerCase()) ||
        template.description.toLowerCase().includes(filters.search.toLowerCase()) ||
        template.categories.some(cat => cat.toLowerCase().includes(filters.search.toLowerCase()))
      );
    }
    
    // Filter by categories
    if (filters.categories.length > 0) {
      result = result.filter(template => 
        template.categories.some(category => filters.categories.includes(category))
      );
    }
    
    setFilteredTemplates(result);
  }, [filters, templates]);
  

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Template Catalog</h1>
          <p className="text-muted-foreground">
            Browse and deploy cloud infrastructure templates
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={refreshTemplates}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search templates..."
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            className="pl-8"
          />
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant={viewMode === 'grid' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('grid')}
          >
            <Grid className="h-4 w-4 mr-2" />
            Grid
          </Button>
          <Button
            variant={viewMode === 'category' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('category')}
          >
            <List className="h-4 w-4 mr-2" />
            Categories
          </Button>
        </div>
        
        <Tabs
          value={filters.provider}
          onValueChange={(value) => setFilters({ ...filters, provider: value as CloudProvider | "all" })}
        >
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="aws">AWS</TabsTrigger>
            <TabsTrigger value="azure">Azure</TabsTrigger>
            <TabsTrigger value="gcp">GCP</TabsTrigger>
          </TabsList>
        </Tabs>
        
        <CategoryFilter
          categories={categories}
          selectedCategories={filters.categories}
          onCategoryToggle={handleCategoryToggle}
          onClearFilters={clearCategoryFilters}
        />
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
      ) : viewMode === 'category' ? (
        <div className="space-y-4">
          {(() => {
            const groupedTemplates = groupTemplatesByCategory(filteredTemplates);
            const categoryNames = Object.keys(groupedTemplates).sort();
            
            if (categoryNames.length === 0) {
              return (
                <div className="flex flex-col items-center justify-center py-10">
                  <FileCode className="h-10 w-10 text-muted-foreground mb-2" />
                  <h3 className="text-lg font-medium">No templates found</h3>
                  <p className="text-muted-foreground">Try adjusting your filters</p>
                </div>
              );
            }
            
            return categoryNames.map(categoryName => {
              const categoryTemplates = groupedTemplates[categoryName];
              const isExpanded = expandedCategories.has(categoryName);
              const isFiltered = filters.categories.length > 0 && filters.categories.includes(categoryName);
              
              return (
                <CategoryGroup
                  key={categoryName}
                  categoryName={categoryName}
                  templateCount={categoryTemplates.length}
                  isExpanded={isExpanded}
                  onToggle={() => toggleCategory(categoryName)}
                  isFiltered={isFiltered}
                >
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {categoryTemplates.map(template => (
                      <TemplateCard key={template.id} template={template} />
                    ))}
                  </div>
                </CategoryGroup>
              );
            });
          })()}
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filteredTemplates.length > 0 ? (
            filteredTemplates.map(template => (
              <TemplateCard key={template.id} template={template} />
            ))
          ) : (
            <div className="col-span-full flex flex-col items-center justify-center py-10">
              <FileCode className="h-10 w-10 text-muted-foreground mb-2" />
              <h3 className="text-lg font-medium">No templates found</h3>
              <p className="text-muted-foreground">Try adjusting your filters</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Catalog;
