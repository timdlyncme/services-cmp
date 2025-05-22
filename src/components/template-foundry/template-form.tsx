import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tenant } from "@/types/auth";
import { Template, availableCategories, codeExamples } from "@/types/template";
import { CloudProvider, TemplateType } from "@/types/cloud";

interface TemplateFormProps {
  onSubmit: (templateData: Partial<Template>) => void;
  onCancel: () => void;
  isMSP: boolean;
  availableTenants: Tenant[];
  initialData?: Partial<Template>;
}

export const TemplateForm = ({ 
  onSubmit, 
  onCancel, 
  isMSP, 
  availableTenants,
  initialData = {}
}: TemplateFormProps) => {
  const [templateFormData, setTemplateFormData] = useState<Partial<Template>>({
    name: "",
    description: "",
    type: "terraform" as TemplateType,
    provider: "azure" as CloudProvider,
    categories: [],
    codeSnippet: codeExamples.terraform,
    tenantIds: [],
    ...initialData
  });

  const handleTypeOrProviderChange = (field: "type" | "provider", value: any) => {
    if (field === "type") {
      const newType = value as TemplateType;
      setTemplateFormData({
        ...templateFormData,
        type: newType,
        codeSnippet: getTemplateTypeExample(newType, templateFormData.provider as CloudProvider),
      });
    } else {
      const newProvider = value as CloudProvider;
      setTemplateFormData({
        ...templateFormData,
        provider: newProvider,
        codeSnippet: getTemplateTypeExample(templateFormData.type as TemplateType, newProvider),
      });
    }
  };

  const getTemplateTypeExample = (type: TemplateType, provider: CloudProvider) => {
    if (type === "terraform") {
      if (provider === "azure") return codeExamples.terraform;
      if (provider === "gcp") return codeExamples.gcp;
      return codeExamples.terraform; // Default to Azure example
    } else if (type === "arm") {
      return codeExamples.arm;
    } else if (type === "cloudformation") {
      return codeExamples.cloudFormation;
    }
    return "";
  };

  const toggleCategory = (category: string) => {
    const categories = templateFormData.categories || [];
    if (categories.includes(category)) {
      setTemplateFormData({
        ...templateFormData,
        categories: categories.filter(c => c !== category),
      });
    } else {
      setTemplateFormData({
        ...templateFormData,
        categories: [...categories, category],
      });
    }
  };

  const toggleTenant = (tenantId: string) => {
    const tenantIds = templateFormData.tenantIds || [];
    if (tenantIds.includes(tenantId)) {
      setTemplateFormData({
        ...templateFormData,
        tenantIds: tenantIds.filter(id => id !== tenantId),
      });
    } else {
      setTemplateFormData({
        ...templateFormData,
        tenantIds: [...tenantIds, tenantId],
      });
    }
  };

  const handleSubmit = () => {
    onSubmit(templateFormData);
  };

  return (
    <div className="grid gap-4 py-4">
      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label htmlFor="name" className="text-sm font-medium">Name</label>
          <Input
            id="name"
            value={templateFormData.name}
            onChange={(e) => setTemplateFormData({ ...templateFormData, name: e.target.value })}
            placeholder="Template name"
          />
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Type</label>
            <Select
              value={templateFormData.type as string}
              onValueChange={(value) => handleTypeOrProviderChange("type", value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="terraform">Terraform</SelectItem>
                <SelectItem value="arm">ARM Template</SelectItem>
                <SelectItem value="cloudformation">CloudFormation</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium">Provider</label>
            <Select
              value={templateFormData.provider as string}
              onValueChange={(value) => handleTypeOrProviderChange("provider", value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select provider" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="azure">Azure</SelectItem>
                <SelectItem value="aws">AWS</SelectItem>
                <SelectItem value="gcp">GCP</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
      
      <div className="space-y-2">
        <label htmlFor="description" className="text-sm font-medium">Description</label>
        <Textarea
          id="description"
          value={templateFormData.description}
          onChange={(e) => setTemplateFormData({ ...templateFormData, description: e.target.value })}
          placeholder="Describe what this template does"
          rows={3}
        />
      </div>
      
      <div className="space-y-2">
        <label className="text-sm font-medium">Categories</label>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          {availableCategories.map((category) => (
            <div key={category} className="flex items-center space-x-2">
              <Checkbox
                id={`category-${category}`}
                checked={(templateFormData.categories || []).includes(category)}
                onCheckedChange={() => toggleCategory(category)}
              />
              <label
                htmlFor={`category-${category}`}
                className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                {category}
              </label>
            </div>
          ))}
        </div>
      </div>
      
      {isMSP && (
        <div className="space-y-2">
          <label className="text-sm font-medium">Assign to Tenants</label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            {availableTenants.map((tenant) => (
              <div key={tenant.tenant_id} className="flex items-center space-x-2">
                <Checkbox
                  id={`tenant-${tenant.tenant_id}`}
                  checked={(templateFormData.tenantIds || []).includes(tenant.tenant_id)}
                  onCheckedChange={() => toggleTenant(tenant.tenant_id)}
                />
                <label
                  htmlFor={`tenant-${tenant.tenant_id}`}
                  className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  {tenant.name}
                </label>
              </div>
            ))}
          </div>
        </div>
      )}
      
      <div className="space-y-2">
        <label htmlFor="code" className="text-sm font-medium">Template Code</label>
        <ScrollArea className="h-[300px] border rounded-md">
          <Textarea
            id="code"
            value={templateFormData.codeSnippet}
            onChange={(e) => setTemplateFormData({ ...templateFormData, codeSnippet: e.target.value })}
            className="font-mono h-full border-0 focus-visible:ring-0"
            placeholder="Enter your infrastructure as code here"
            rows={15}
          />
        </ScrollArea>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button onClick={handleSubmit}>
          {initialData.id ? "Update Template" : "Create Template"}
        </Button>
      </DialogFooter>
    </div>
  );
};
