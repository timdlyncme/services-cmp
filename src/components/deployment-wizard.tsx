import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { StepWizard } from "@/components/ui/step-wizard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Combobox } from "@/components/ui/combobox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Play, Eye, EyeOff, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import { TemplateParameter } from "@/types/cloud";

interface Environment {
  id: string;
  name: string;
  description: string;
  provider: string;
  tenantId: string;
  internal_id: number;
  cloud_accounts: Array<{
    id: string;
    name: string;
    provider: string;
    status: string;
    settings_id?: string;
    cloud_ids?: string[];
  }>;
}

interface DeploymentWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeploy: () => void;
  deploymentInProgress: boolean;
  
  // Step 1 - Environment & Cloud Selection
  environments: Environment[];
  selectedEnvironment: string;
  onEnvironmentChange: (value: string) => void;
  availableCloudAccounts: any[];
  selectedCloudAccount: string;
  onCloudAccountChange: (value: string) => void;
  availableSubscriptions: string[];
  selectedSubscription: string;
  onSubscriptionChange: (value: string) => void;
  
  // Step 2 - Resource Configuration
  useExistingResourceGroup: boolean;
  onUseExistingResourceGroupChange: (value: boolean) => void;
  resourceGroups: any[];
  selectedResourceGroup: string;
  onResourceGroupChange: (value: string) => void;
  resourceGroup: string;
  onResourceGroupNameChange: (value: string) => void;
  loadingResourceGroups: boolean;
  onRefreshResourceGroups: () => void;
  locations: any[];
  location: string;
  onLocationChange: (value: string) => void;
  loadingLocations: boolean;
  parameters: Record<string, TemplateParameter>;
  onParameterChange: (key: string, field: string, value: string) => void;
  showPasswordValues: Record<string, boolean>;
  onTogglePasswordVisibility: (key: string) => void;
  
  // Step 3 - Approval Details
  deployName: string;
  onDeployNameChange: (value: string) => void;
}

const steps = [
  {
    id: 1,
    title: "Environment",
    description: "Select environment, cloud account, and subscription"
  },
  {
    id: 2,
    title: "Configuration",
    description: "Configure resource group, location, and parameters"
  },
  {
    id: 3,
    title: "Approval",
    description: "Provide approval details and notes"
  },
  {
    id: 4,
    title: "Review",
    description: "Review and confirm deployment"
  }
];

export const DeploymentWizard: React.FC<DeploymentWizardProps> = ({
  open,
  onOpenChange,
  onDeploy,
  deploymentInProgress,
  environments,
  selectedEnvironment,
  onEnvironmentChange,
  availableCloudAccounts,
  selectedCloudAccount,
  onCloudAccountChange,
  availableSubscriptions,
  selectedSubscription,
  onSubscriptionChange,
  useExistingResourceGroup,
  onUseExistingResourceGroupChange,
  resourceGroups,
  selectedResourceGroup,
  onResourceGroupChange,
  resourceGroup,
  onResourceGroupNameChange,
  loadingResourceGroups,
  onRefreshResourceGroups,
  locations,
  location,
  onLocationChange,
  loadingLocations,
  parameters,
  onParameterChange,
  showPasswordValues,
  onTogglePasswordVisibility,
  deployName,
  onDeployNameChange,
}) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [approvalNotes, setApprovalNotes] = useState("");
  const [ticketNumber, setTicketNumber] = useState("");

  // Reset wizard when dialog opens
  useEffect(() => {
    if (open) {
      setCurrentStep(1);
      setApprovalNotes("");
      setTicketNumber("");
    }
  }, [open]);

  const canProceedToStep2 = selectedEnvironment && selectedCloudAccount && selectedSubscription;
  const canProceedToStep3 = canProceedToStep2 && 
    (useExistingResourceGroup ? selectedResourceGroup : resourceGroup) && 
    location &&
    // Check that all parameters have values
    Object.entries(parameters).every(([key, param]) => param.value && param.value.trim() !== "");
  const canProceedToStep4 = canProceedToStep3 && deployName;

  const handleNext = () => {
    if (currentStep < 4) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleClose = () => {
    if (!deploymentInProgress) {
      onOpenChange(false);
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="deployEnv">Environment</Label>
              <Select 
                value={selectedEnvironment} 
                onValueChange={onEnvironmentChange}
                disabled={deploymentInProgress}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select an environment" />
                </SelectTrigger>
                <SelectContent>
                  {environments.map((env) => (
                    <SelectItem key={env.id} value={env.id}>
                      {env.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {selectedEnvironment && (
              <div className="space-y-2">
                <Label htmlFor="cloudAccount">Cloud Account</Label>
                <Select 
                  value={selectedCloudAccount} 
                  onValueChange={onCloudAccountChange}
                  disabled={deploymentInProgress || availableCloudAccounts.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={
                      availableCloudAccounts.length === 0 
                        ? "No cloud accounts available" 
                        : "Select a cloud account"
                    } />
                  </SelectTrigger>
                  <SelectContent>
                    {availableCloudAccounts.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.name} ({account.provider})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            
            {selectedCloudAccount && (
              <div className="space-y-2">
                <Label htmlFor="subscription">Subscription</Label>
                <Select 
                  value={selectedSubscription} 
                  onValueChange={onSubscriptionChange}
                  disabled={deploymentInProgress || availableSubscriptions.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={
                      availableSubscriptions.length === 0 
                        ? "No subscriptions available" 
                        : "Select a subscription"
                    } />
                  </SelectTrigger>
                  <SelectContent>
                    {availableSubscriptions.map((subscription) => (
                      <SelectItem key={subscription} value={subscription}>
                        {subscription}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        );

      case 2:
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="resourceGroup">Resource Group</Label>
              
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="useExistingResourceGroup"
                    checked={useExistingResourceGroup}
                    onCheckedChange={onUseExistingResourceGroupChange}
                  />
                  <Label htmlFor="useExistingResourceGroup">Use Existing Resource Group</Label>
                </div>
                
                {useExistingResourceGroup ? (
                  <div className="flex items-center space-x-2">
                    <div className="flex-1">
                      <Combobox
                        options={resourceGroups.map((rg) => ({
                          value: rg.name,
                          label: `${rg.name} (${rg.location})`
                        }))}
                        value={selectedResourceGroup}
                        onValueChange={onResourceGroupChange}
                        placeholder={loadingResourceGroups ? "Loading resource groups..." : "Select a resource group"}
                        searchPlaceholder="Search resource groups..."
                        emptyText="No resource groups found."
                        disabled={deploymentInProgress || loadingResourceGroups}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={onRefreshResourceGroups}
                      disabled={deploymentInProgress || loadingResourceGroups}
                      title="Refresh resource groups"
                    >
                      <RefreshCw className={`h-4 w-4 ${loadingResourceGroups ? 'animate-spin' : ''}`} />
                    </Button>
                  </div>
                ) : (
                  <Input 
                    id="resourceGroup" 
                    value={resourceGroup} 
                    onChange={(e) => onResourceGroupNameChange(e.target.value)}
                    placeholder="Enter new resource group name"
                  />
                )}
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              {useExistingResourceGroup ? (
                <Input 
                  id="location" 
                  value={location} 
                  disabled={true}
                  placeholder="Location will be set based on selected resource group"
                />
              ) : (
                <Select 
                  value={location} 
                  onValueChange={onLocationChange}
                  disabled={deploymentInProgress || loadingLocations}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={loadingLocations ? "Loading locations..." : "Select a location"} />
                  </SelectTrigger>
                  <SelectContent>
                    {locations.map((loc) => (
                      <SelectItem key={loc.name} value={loc.name}>
                        {loc.display_name || loc.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            
            {Object.keys(parameters).length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-medium">Parameters</h3>
                <div className="space-y-2">
                  {Object.entries(parameters).map(([key, param]) => {
                    const isEmpty = !param.value || param.value.trim() === "";
                    return (
                      <div key={key} className="grid grid-cols-12 gap-2 items-start">
                        <div className="col-span-3">
                          <Label>Name</Label>
                          <Input 
                            value={key}
                            disabled={true}
                          />
                        </div>
                        <div className="col-span-3">
                          <Label>Type</Label>
                          <Input
                            value={param.type}
                            disabled={true}
                          />
                        </div>
                        <div className="col-span-6">
                          <Label>Value {isEmpty && <span className="text-red-500 text-xs">(required)</span>}</Label>
                          {param.type === "password" ? (
                            <div className="relative">
                              <Input 
                                type={showPasswordValues[key] ? "text" : "password"}
                                value={param.value}
                                onChange={(e) => onParameterChange(key, "value", e.target.value)}
                                className={`pr-8 ${isEmpty ? 'border-red-500' : ''}`}
                                placeholder="Enter value"
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="absolute right-0 top-0 h-full"
                                onClick={() => onTogglePasswordVisibility(key)}
                              >
                                {showPasswordValues[key] ? (
                                  <EyeOff className="h-4 w-4" />
                                ) : (
                                  <Eye className="h-4 w-4" />
                                )}
                              </Button>
                            </div>
                          ) : (
                            <Input 
                              type={param.type === "int" ? "number" : "text"}
                              value={param.value}
                              onChange={(e) => onParameterChange(key, "value", e.target.value)}
                              className={isEmpty ? 'border-red-500' : ''}
                              placeholder="Enter value"
                            />
                          )}
                          {isEmpty && (
                            <p className="text-red-500 text-xs mt-1">This parameter is required</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );

      case 3:
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="deployName">Deployment Name</Label>
              <Input 
                id="deployName" 
                value={deployName} 
                onChange={(e) => onDeployNameChange(e.target.value)}
                placeholder="Enter deployment name"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="ticketNumber">Ticket Number (Optional)</Label>
              <Input 
                id="ticketNumber" 
                value={ticketNumber} 
                onChange={(e) => setTicketNumber(e.target.value)}
                placeholder="Enter ticket or reference number"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="approvalNotes">Approval Notes (Optional)</Label>
              <Textarea 
                id="approvalNotes" 
                value={approvalNotes} 
                onChange={(e) => setApprovalNotes(e.target.value)}
                placeholder="Enter any approval notes or justification for this deployment"
                rows={4}
              />
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Review Deployment Configuration</h3>
            
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Environment & Cloud</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Environment:</span>
                  <Badge variant="outline">
                    {environments.find(env => env.id === selectedEnvironment)?.name}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Cloud Account:</span>
                  <Badge variant="outline">
                    {availableCloudAccounts.find(acc => acc.id === selectedCloudAccount)?.name}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Subscription:</span>
                  <Badge variant="outline">{selectedSubscription}</Badge>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Resource Configuration</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Resource Group:</span>
                  <Badge variant="outline">
                    {useExistingResourceGroup ? selectedResourceGroup : resourceGroup} 
                    {useExistingResourceGroup ? " (existing)" : " (new)"}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Location:</span>
                  <Badge variant="outline">{location}</Badge>
                </div>
                {Object.keys(parameters).length > 0 && (
                  <div>
                    <span className="text-sm text-gray-600">Parameters:</span>
                    <div className="mt-1 space-y-1">
                      {Object.entries(parameters).map(([key, param]) => (
                        <div key={key} className="flex justify-between text-xs">
                          <span>{key}:</span>
                          <span className="font-mono">
                            {param.type === "password" ? "••••••••" : param.value || "(empty)"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Deployment Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Deployment Name:</span>
                  <Badge variant="outline">{deployName}</Badge>
                </div>
                {ticketNumber && (
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Ticket Number:</span>
                    <Badge variant="outline">{ticketNumber}</Badge>
                  </div>
                )}
                {approvalNotes && (
                  <div>
                    <span className="text-sm text-gray-600">Approval Notes:</span>
                    <p className="text-xs mt-1 p-2 bg-gray-50 rounded">{approvalNotes}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent 
        className="max-w-4xl max-h-[90vh] flex flex-col"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>Deploy Template</DialogTitle>
          <div className="mt-4">
            <StepWizard steps={steps} currentStep={currentStep} />
          </div>
        </DialogHeader>
        
        <div className="flex-1 overflow-hidden">
          {currentStep === 4 ? (
            <ScrollArea className="h-full py-6">
              {renderStepContent()}
            </ScrollArea>
          ) : (
            <div className="py-6">
              {renderStepContent()}
            </div>
          )}
        </div>
        
        <div className="flex justify-between flex-shrink-0 pt-4 border-t">
          <div>
            {currentStep > 1 && (
              <Button 
                variant="outline" 
                onClick={handlePrevious}
                disabled={deploymentInProgress}
              >
                <ChevronLeft className="mr-2 h-4 w-4" />
                Previous
              </Button>
            )}
          </div>
          
          <div className="space-x-2">
            <Button 
              variant="outline" 
              onClick={handleClose}
              disabled={deploymentInProgress}
            >
              Cancel
            </Button>
            
            {currentStep < 4 ? (
              <Button 
                onClick={handleNext}
                disabled={
                  deploymentInProgress ||
                  (currentStep === 1 && !canProceedToStep2) ||
                  (currentStep === 2 && !canProceedToStep3) ||
                  (currentStep === 3 && !canProceedToStep4)
                }
              >
                Next
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <Button onClick={onDeploy} disabled={deploymentInProgress}>
                {deploymentInProgress ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Deploying...
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-4 w-4" />
                    Deploy
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
