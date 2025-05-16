
import { useState, useEffect } from "react";
import { useAuth } from "@/context/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { CloudDeployment } from "@/types/cloud";
import { mockDeployments } from "@/data/mock-data";
import { useNavigate } from "react-router-dom";
import { Search, MoreVertical, Database } from "lucide-react";

const Deployments = () => {
  const { currentTenant } = useAuth();
  const navigate = useNavigate();
  const [deployments, setDeployments] = useState<CloudDeployment[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredDeployments, setFilteredDeployments] = useState<CloudDeployment[]>([]);

  useEffect(() => {
    if (currentTenant) {
      const tenantDeployments = mockDeployments.filter(
        deployment => deployment.tenantId === currentTenant.id
      );
      setDeployments(tenantDeployments);
      setFilteredDeployments(tenantDeployments);
    }
  }, [currentTenant]);

  useEffect(() => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const filtered = deployments.filter(
        deployment =>
          deployment.name.toLowerCase().includes(query) ||
          deployment.templateName.toLowerCase().includes(query) ||
          deployment.provider.toLowerCase().includes(query) ||
          deployment.environment.toLowerCase().includes(query)
      );
      setFilteredDeployments(filtered);
    } else {
      setFilteredDeployments(deployments);
    }
  }, [searchQuery, deployments]);

  const providerColor = (provider: string) => {
    switch (provider) {
      case "azure": return "bg-cloud-azure text-white";
      case "aws": return "bg-cloud-aws text-black";
      case "gcp": return "bg-cloud-gcp text-white";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const statusVariant = (status: string) => {
    switch (status) {
      case "running": return "success";
      case "pending":
      case "deploying": return "warning";
      case "failed": return "destructive";
      default: return "secondary";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Deployments</h1>
          <p className="text-muted-foreground">
            Manage your cloud resource deployments
          </p>
        </div>
        <Button onClick={() => navigate("/catalog")}>
          New Deployment
        </Button>
      </div>

      <div className="flex items-center">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search deployments..."
            className="pl-8"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Provider</TableHead>
              <TableHead>Template</TableHead>
              <TableHead>Environment</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last Updated</TableHead>
              <TableHead className="w-[80px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredDeployments.length > 0 ? (
              filteredDeployments.map((deployment) => (
                <TableRow
                  key={deployment.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => navigate(`/deployments/${deployment.id}`)}
                >
                  <TableCell className="font-medium">{deployment.name}</TableCell>
                  <TableCell>
                    <Badge className={providerColor(deployment.provider)}>
                      {deployment.provider.toUpperCase()}
                    </Badge>
                  </TableCell>
                  <TableCell>{deployment.templateName}</TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {deployment.environment}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(deployment.status)}>
                      {deployment.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{new Date(deployment.updatedAt).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem 
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/deployments/${deployment.id}`);
                          }}
                        >
                          View details
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={(e) => {
                            e.stopPropagation();
                            // In a real app, this would restart the deployment
                          }}
                        >
                          Restart
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          className="text-destructive focus:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            // In a real app, this would delete the deployment
                          }}
                        >
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center">
                  <div className="flex flex-col items-center justify-center text-muted-foreground">
                    <Database className="h-8 w-8 mb-2" />
                    <p>No deployments found</p>
                    {searchQuery && (
                      <p className="text-sm">
                        Try adjusting your search query
                      </p>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default Deployments;
