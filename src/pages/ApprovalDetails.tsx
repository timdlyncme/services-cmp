import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ArrowLeft, CheckCircle, XCircle, MessageCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ApprovalDetail {
  id: string;
  deploymentName: string;
  templateName: string;
  templateDescription: string;
  requestedBy: string;
  requestedAt: string;
  status: "pending" | "approved" | "denied" | "cancelled";
  environment: string;
  parameters: { [key: string]: string };
  approvalNotes: string;
  deploymentDetails: {
    provider: string;
    region: string;
    resourceGroup: string;
  };
}

const mockApprovalDetail: ApprovalDetail = {
  id: "1",
  deploymentName: "Web App Production Deploy",
  templateName: "React Web Application",
  templateDescription: "A modern React web application with TypeScript, Tailwind CSS, and CI/CD pipeline",
  requestedBy: "John Doe",
  requestedAt: "2024-05-30T10:30:00Z",
  status: "pending",
  environment: "production",
  parameters: {
    "app-name": "my-web-app",
    "instance-size": "Standard_B2s",
    "auto-scaling": "enabled",
    "ssl-certificate": "managed"
  },
  approvalNotes: "This deployment is for the new product launch. Please review the production configuration carefully.",
  deploymentDetails: {
    provider: "azure",
    region: "East US 2",
    resourceGroup: "rg-production-webapps"
  }
};

const ApprovalDetails = () => {
  const { approvalId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [approval, setApproval] = useState<ApprovalDetail | null>(null);
  const [actionNotes, setActionNotes] = useState("");

  useEffect(() => {
    // In a real app, this would fetch the approval details from an API
    setApproval(mockApprovalDetail);
  }, [approvalId]);

  const handleApprove = () => {
    toast({
      title: "Approval Granted",
      description: "The deployment has been approved and will begin shortly.",
    });
    navigate("/approvals");
  };

  const handleDeny = () => {
    toast({
      title: "Approval Denied",
      description: "The deployment request has been denied.",
      variant: "destructive",
    });
    navigate("/approvals");
  };

  const handleRequestDetails = () => {
    toast({
      title: "Details Requested",
      description: "Additional details have been requested from the user.",
    });
  };

  if (!approval) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary"></div>
          <p className="text-sm text-muted-foreground">Loading approval details...</p>
        </div>
      </div>
    );
  }

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

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate("/approvals")}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Approvals
        </Button>
        <h1 className="text-3xl font-bold tracking-tight">Approval Details</h1>
        {getStatusBadge(approval.status)}
      </div>

      {/* Action Buttons */}
      {approval.status === "pending" && (
        <div className="flex space-x-4">
          <Button onClick={handleApprove} className="bg-green-600 hover:bg-green-700">
            <CheckCircle className="h-4 w-4 mr-2" />
            Approve
          </Button>
          <Button variant="destructive" onClick={handleDeny}>
            <XCircle className="h-4 w-4 mr-2" />
            Deny
          </Button>
          <Button variant="outline" onClick={handleRequestDetails}>
            <MessageCircle className="h-4 w-4 mr-2" />
            Request Details
          </Button>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {/* Deployment Information */}
        <Card>
          <CardHeader>
            <CardTitle>Deployment Information</CardTitle>
            <CardDescription>Details about the requested deployment</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-sm font-medium">Deployment Name</Label>
              <p className="text-sm text-muted-foreground">{approval.deploymentName}</p>
            </div>
            <div>
              <Label className="text-sm font-medium">Requested By</Label>
              <p className="text-sm text-muted-foreground">{approval.requestedBy}</p>
            </div>
            <div>
              <Label className="text-sm font-medium">Environment</Label>
              <Badge variant="outline">{approval.environment}</Badge>
            </div>
            <div>
              <Label className="text-sm font-medium">Requested At</Label>
              <p className="text-sm text-muted-foreground">
                {new Date(approval.requestedAt).toLocaleString()}
              </p>
            </div>
            <div>
              <Label className="text-sm font-medium">Cloud Provider</Label>
              <p className="text-sm text-muted-foreground capitalize">{approval.deploymentDetails.provider}</p>
            </div>
            <div>
              <Label className="text-sm font-medium">Region</Label>
              <p className="text-sm text-muted-foreground">{approval.deploymentDetails.region}</p>
            </div>
            <div>
              <Label className="text-sm font-medium">Resource Group</Label>
              <p className="text-sm text-muted-foreground">{approval.deploymentDetails.resourceGroup}</p>
            </div>
          </CardContent>
        </Card>

        {/* Template Information */}
        <Card>
          <CardHeader>
            <CardTitle>Template Information</CardTitle>
            <CardDescription>Details about the template being deployed</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-sm font-medium">Template Name</Label>
              <p className="text-sm text-muted-foreground">{approval.templateName}</p>
            </div>
            <div>
              <Label className="text-sm font-medium">Description</Label>
              <p className="text-sm text-muted-foreground">{approval.templateDescription}</p>
            </div>
            <div>
              <Label className="text-sm font-medium">Parameters</Label>
              <div className="space-y-2">
                {Object.entries(approval.parameters).map(([key, value]) => (
                  <div key={key} className="flex justify-between">
                    <span className="text-sm font-medium">{key}:</span>
                    <span className="text-sm text-muted-foreground">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Approval Notes */}
      <Card>
        <CardHeader>
          <CardTitle>Approval Notes</CardTitle>
          <CardDescription>Notes provided by the user requesting approval</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm">{approval.approvalNotes}</p>
        </CardContent>
      </Card>

      {/* Action Notes */}
      {approval.status === "pending" && (
        <Card>
          <CardHeader>
            <CardTitle>Action Notes</CardTitle>
            <CardDescription>Add notes for your approval decision</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Add any notes about your decision..."
              value={actionNotes}
              onChange={(e) => setActionNotes(e.target.value)}
              className="min-h-[100px]"
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ApprovalDetails;
