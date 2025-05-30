import { useState, useEffect } from "react";
import { useAuth } from "@/context/auth-context";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Clock, XCircle, FileText } from "lucide-react";

interface Approval {
  id: string;
  deploymentName: string;
  templateName: string;
  requestedBy: string;
  requestedAt: string;
  status: "pending" | "approved" | "denied" | "cancelled";
  environment: string;
  tenantId: string;
}

const mockApprovals: Approval[] = [
  {
    id: "1",
    deploymentName: "Web App Production Deploy",
    templateName: "React Web Application",
    requestedBy: "John Doe",
    requestedAt: "2024-05-30T10:30:00Z",
    status: "pending",
    environment: "production",
    tenantId: "tenant-1"
  },
  {
    id: "2",
    deploymentName: "API Gateway Setup",
    templateName: "Azure API Gateway",
    requestedBy: "Jane Smith",
    requestedAt: "2024-05-29T14:20:00Z",
    status: "approved",
    environment: "staging",
    tenantId: "tenant-1"
  },
  {
    id: "3",
    deploymentName: "Database Migration",
    templateName: "PostgreSQL Database",
    requestedBy: "Bob Johnson",
    requestedAt: "2024-05-28T09:15:00Z",
    status: "denied",
    environment: "production",
    tenantId: "tenant-1"
  }
];

const Approvals = () => {
  const { currentTenant } = useAuth();
  const navigate = useNavigate();
  const [approvals, setApprovals] = useState<Approval[]>([]);

  useEffect(() => {
    if (currentTenant) {
      const tenantApprovals = mockApprovals.filter(
        approval => approval.tenantId === currentTenant.id
      );
      setApprovals(tenantApprovals);
    }
  }, [currentTenant]);

  const getStatusBadge = (status: string) => {
    const variants = {
      pending: "secondary",
      approved: "default",
      denied: "destructive",
      cancelled: "outline"
    } as const;
    
    return (
      <Badge variant={variants[status as keyof typeof variants]}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const totalApprovals = approvals.length;
  const pendingApprovals = approvals.filter(a => a.status === "pending").length;
  const approvedApprovals = approvals.filter(a => a.status === "approved").length;
  const cancelledApprovals = approvals.filter(a => a.status === "cancelled").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Approvals</h1>
      </div>

      {/* Status Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Approvals</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalApprovals}</div>
            <p className="text-xs text-muted-foreground">
              all approval requests
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingApprovals}</div>
            <p className="text-xs text-muted-foreground">
              awaiting approval
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Approved</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{approvedApprovals}</div>
            <p className="text-xs text-muted-foreground">
              approved deployments
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cancelled</CardTitle>
            <XCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{cancelledApprovals}</div>
            <p className="text-xs text-muted-foreground">
              cancelled requests
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Approvals Table */}
      <Card>
        <CardHeader>
          <CardTitle>Approval Requests</CardTitle>
          <CardDescription>
            Review and manage deployment approval requests
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Deployment</TableHead>
                <TableHead>Template</TableHead>
                <TableHead>Requested By</TableHead>
                <TableHead>Environment</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Requested At</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {approvals.map((approval) => (
                <TableRow key={approval.id}>
                  <TableCell className="font-medium">{approval.deploymentName}</TableCell>
                  <TableCell>{approval.templateName}</TableCell>
                  <TableCell>{approval.requestedBy}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{approval.environment}</Badge>
                  </TableCell>
                  <TableCell>{getStatusBadge(approval.status)}</TableCell>
                  <TableCell>{new Date(approval.requestedAt).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => navigate(`/approvals/${approval.id}`)}
                    >
                      View Details
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default Approvals;
