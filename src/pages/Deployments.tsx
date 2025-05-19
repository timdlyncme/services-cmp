import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from "@/components/ui/card";
import { Search, ArrowUpDown, AlertCircle, RefreshCw, Database } from "lucide-react";
import axios from "axios";
import { toast } from "sonner";

// Import types but not the mock data
import { CloudDeployment } from "@/types/cloud";

interface DeploymentFilters {
  status: string;
  provider: string;
  environment: string;
  search: string;
}

const API_URL = 'http://localhost:8000/api';

const Deployments = () => {
  const navigate = useNavigate();
  const { currentTenant, user } = useAuth();
  const [deployments, setDeployments] = useState<CloudDeployment[]>([]);
  const [filteredDeployments, setFilteredDeployments] = useState<CloudDeployment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<DeploymentFilters>({
    status: "all",
    provider: "all",
    environment: "all",
    search: ""
  });

  const fetchDeployments = async () => {
    if (!currentTenant) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        throw new Error("Authentication token not found");
      }
      
      // Fetch deployments from API
      const deployments = await deploymentService.getDeployments(currentTenant.id);
      setDeployments(deployments);
      setFilteredDeployments(deployments);
      setIsLoading(false);
    } catch (error) {
      console.error("Error fetching deployments:", error);
      setError("Failed to load deployments. Please try again.");
      setIsLoading(false);
      
      if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error("Failed to load deployments");
      }
    }
  };

  useEffect(() => {
    if (currentTenant) {
      fetchDeployments();
    }
  }, [currentTenant]);

  useEffect(() => {
    let results = deployments;
    
    if (filters.status !== "all") {
      results = results.filter(dep => dep.status === filters.status);
    }
    
    if (filters.provider !== "all") {
      results = results.filter(dep => dep.provider === filters.provider);
    }
    
    if (filters.environment !== "all") {
      results = results.filter(dep => dep.environment === filters.environment);
    }
    
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      results = results.filter(dep => 
        dep.name.toLowerCase().includes(searchLower) ||
        dep.id.toLowerCase().includes(searchLower)
      );
    }
    
    setFilteredDeployments(results);
  }, [filters, deployments]);

  const handleRowClick = (deploymentId: string) => {
    navigate(`/deployments/${deploymentId}`);
  };

  const handleRefresh = () => {
    fetchDeployments();
    toast.success("Refreshing deployments...");
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "running":
        return <Badge variant="secondary">{status}</Badge>;
      case "stopped":
        return <Badge variant="outline">{status}</Badge>;
      case "failed":
        return <Badge variant="destructive">{status}</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const getProviderBadge = (provider: string) => {
    switch (provider) {
      case "azure":
        return <Badge className="bg-cloud-azure text-white">{provider.toUpperCase()}</Badge>;
      case "aws":
        return <Badge className="bg-cloud-aws text-black">{provider.toUpperCase()}</Badge>;
      case "gcp":
        return <Badge className="bg-cloud-gcp text-white">{provider.toUpperCase()}</Badge>;
      default:
        return <Badge>{provider}</Badge>;
    }
  };

  const environments = Array.from(new Set(deployments.map(d => d.environment)));
  
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Deployments</h1>
          <p className="text-muted-foreground">
            View and manage your infrastructure deployments
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search deployments..."
                className="pl-8"
                value={filters.search}
                onChange={(e) => setFilters({...filters, search: e.target.value})}
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              <Select
                value={filters.status}
                onValueChange={(value) => setFilters({...filters, status: value})}
              >
                <SelectTrigger className="w-[130px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="running">Running</SelectItem>
                  <SelectItem value="stopped">Stopped</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>
              
              <Select
                value={filters.provider}
                onValueChange={(value) => setFilters({...filters, provider: value})}
              >
                <SelectTrigger className="w-[130px]">
                  <SelectValue placeholder="Provider" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Providers</SelectItem>
                  <SelectItem value="azure">Azure</SelectItem>
                  <SelectItem value="aws">AWS</SelectItem>
                  <SelectItem value="gcp">GCP</SelectItem>
                </SelectContent>
              </Select>
              
              <Select
                value={filters.environment}
                onValueChange={(value) => setFilters({...filters, environment: value})}
              >
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Environment" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Environments</SelectItem>
                  {environments.map(env => (
                    <SelectItem key={env} value={env}>{env}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-10">
              <RefreshCw className="h-10 w-10 text-muted-foreground mb-2 animate-spin" />
              <h3 className="text-lg font-medium">Loading deployments...</h3>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-10">
              <AlertCircle className="h-10 w-10 text-destructive mb-2" />
              <h3 className="text-lg font-medium">Error loading deployments</h3>
              <p className="text-muted-foreground">{error}</p>
              <Button variant="outline" className="mt-4" onClick={fetchDeployments}>
                Try Again
              </Button>
            </div>
          ) : filteredDeployments.length > 0 ? (
            <div className="border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[250px]">Name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Provider</TableHead>
                    <TableHead>Environment</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Resources</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDeployments.map((deployment) => (
                    <TableRow 
                      key={deployment.id} 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleRowClick(deployment.id)}
                    >
                      <TableCell className="font-medium">{deployment.name}</TableCell>
                      <TableCell>{getStatusBadge(deployment.status)}</TableCell>
                      <TableCell>{getProviderBadge(deployment.provider)}</TableCell>
                      <TableCell>{deployment.environment}</TableCell>
                      <TableCell>{new Date(deployment.createdAt).toLocaleDateString()}</TableCell>
                      <TableCell>{deployment.resources ? deployment.resources.length : 0}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-10">
              <Database className="h-10 w-10 text-muted-foreground mb-2" />
              <h3 className="text-lg font-medium">No deployments found</h3>
              <p className="text-muted-foreground">
                No deployments match your criteria
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Deployments;
