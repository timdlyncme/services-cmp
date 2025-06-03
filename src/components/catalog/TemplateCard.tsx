import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CloudTemplate } from "@/types/cloud";
import { useNavigate } from "react-router-dom";
import { FileCode } from "lucide-react";

interface TemplateCardProps {
  template: CloudTemplate;
}

export default function TemplateCard({ template }: TemplateCardProps) {
  const navigate = useNavigate();

  const providerColor = (provider: string) => {
    switch (provider) {
      case "aws":
        return "bg-orange-500 text-white";
      case "azure":
        return "bg-blue-500 text-white";
      case "gcp":
        return "bg-green-500 text-white";
      default:
        return "bg-gray-500 text-white";
    }
  };

  const typeLabel = (type: string) => {
    switch (type) {
      case "terraform":
        return "Terraform";
      case "cloudformation":
        return "CloudFormation";
      case "arm":
        return "ARM Template";
      case "bicep":
        return "Bicep";
      default:
        return type;
    }
  };

  return (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow">
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
        <div className="flex flex-wrap gap-2 mb-4">
          {template.categories && template.categories.length > 0 ? (
            template.categories.map(category => (
              <Badge key={category} variant="secondary">
                {category}
              </Badge>
            ))
          ) : (
            <Badge variant="outline">Uncategorized</Badge>
          )}
        </div>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="flex flex-col">
            <span className="text-muted-foreground">Deployments</span>
            <span className="font-medium">{template.deploymentCount || 0}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-muted-foreground">Updated</span>
            <span className="font-medium">
              {template.updatedAt 
                ? new Date(template.updatedAt).toLocaleDateString()
                : 'N/A'
              }
            </span>
          </div>
        </div>
      </CardContent>
      <CardFooter>
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
  );
}

