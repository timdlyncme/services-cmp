import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/context/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { IntegrationConfig, IntegrationStatus } from "@/types/cloud";
import { 
  Settings as SettingsIcon, 
  Key, 
  Terminal, 
  CloudCog, 
  Github, 
  Plus, 
  Trash2, 
  RefreshCw, 
  Loader2,
  BrainCircuit,
  CheckCircle2,
  AlertCircle,
  Info
} from "lucide-react";
import { toast } from "sonner";
import { cmpService } from "@/services/cmp-service";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { AIAssistantService } from "@/services/ai-assistant-service";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

// Interface for Azure credentials
interface AzureCredential {
  id: string;
  name: string;
  client_id: string;
  tenant_id: string;
  configured?: boolean;
  message?: string;
}

// Interface for Azure subscriptions
interface AzureSubscription {
  id: string;
  name: string;
  state: string;
}

const Settings = () => {
  const { currentTenant, user } = useAuth();
  const [integrations, setIntegrations] = useState<IntegrationConfig[]>([]);
  const [azureCredentials, setAzureCredentials] = useState<AzureCredential[]>([]);
  const [isLoadingCredentials, setIsLoadingCredentials] = useState(false);
  const [terminalLogs, setTerminalLogs] = useState<string[]>([]);
  const terminalRef = useRef<HTMLDivElement>(null);
  
  // New credential form state
  const [newCredential, setNewCredential] = useState({
    name: "",
    client_id: "",
    client_secret: "",
    tenant_id: ""
  });
  const [isAddingCredential, setIsAddingCredential] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  // Subscription test state
  const [subscriptions, setSubscriptions] = useState<Record<string, AzureSubscription[]>>({});
  const [isTestingConnection, setIsTestingConnection] = useState<Record<string, boolean>>({});
  
  const [githubSettings, setGithubSettings] = useState({
    enabled: false,
    personalAccessToken: "",
    organizationName: "",
    repositoryName: "",
    branch: "main",
    syncEnabled: false,
    webhookUrl: "https://cloudflow.example.com/api/webhooks/github",
    autoDeployEnabled: false,
  });
  
  // Azure OpenAI settings
  const [azureOpenAISettings, setAzureOpenAISettings] = useState({
    enabled: false,
    endpoint: "",
    apiKey: "",
    deploymentName: "",
    model: "gpt-4",
    apiVersion: "2023-05-15"
  });
  const [isTestingAIConnection, setIsTestingAIConnection] = useState(false);
  const [isSavingAISettings, setIsSavingAISettings] = useState(false);
  const [aiConnectionStatus, setAIConnectionStatus] = useState<{
    status: 'connected' | 'not_configured' | 'error';
    message: string;
    lastChecked?: string;
  }>({
    status: 'not_configured',
    message: 'Azure OpenAI is not configured'
  });
  const aiAssistantService = new AIAssistantService();
  
  // Add log with timestamp
  const addLog = (message: string, type: "info" | "success" | "warning" | "error" = "info") => {
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
    const prefix = type === "info" ? "[INFO]" : 
                  type === "success" ? "[SUCCESS]" : 
                  type === "warning" ? "[WARNING]" : "[ERROR]";
    
    setTerminalLogs(prev => [...prev, `${timestamp} ${prefix} ${message}`]);
    
    // Auto-scroll to bottom
    setTimeout(() => {
      if (terminalRef.current) {
        terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
      }
    }, 100);
  };
  
  // Load Azure credentials
  const loadAzureCredentials = async () => {
    if (!currentTenant) return;
    
    setIsLoadingCredentials(true);
    addLog("Loading Azure credentials...");
    
    try {
      const credentials = await cmpService.getAzureCredentials(currentTenant.tenant_id);
      setAzureCredentials(credentials);
      addLog(`Loaded ${credentials.length} Azure credential sets`, "success");
    } catch (error) {
      console.error("Error loading Azure credentials:", error);
      addLog(`Failed to load Azure credentials: ${error instanceof Error ? error.message : String(error)}`, "error");
    } finally {
      setIsLoadingCredentials(false);
    }
  };
  
  // Load Azure OpenAI settings
  const loadAzureOpenAISettings = async () => {
    addLog("Loading Azure OpenAI settings...");
    
    try {
      const config = await aiAssistantService.getConfig();
      
      setAzureOpenAISettings({
        enabled: Boolean(config.api_key && config.endpoint && config.deployment_name),
        endpoint: config.endpoint || "",
        apiKey: config.api_key === "********" ? "" : (config.api_key || ""),
        deploymentName: config.deployment_name || "",
        model: config.model || "gpt-4",
        apiVersion: config.api_version || "2023-05-15"
      });
      
      // Also check the connection status
      const status = await aiAssistantService.checkStatus();
      setAIConnectionStatus({
        status: status.status,
        message: status.message,
        lastChecked: new Date().toISOString()
      });
      
      addLog("Azure OpenAI settings loaded successfully", "success");
    } catch (error) {
      console.error("Error loading Azure OpenAI settings:", error);
      addLog(`Failed to load Azure OpenAI settings: ${error instanceof Error ? error.message : String(error)}`, "error");
      // Don't show a toast error here, as this might be the first time the user is setting up Azure OpenAI
    }
  };
  
  // Create new Azure credential
  const handleCreateCredential = async () => {
    if (!currentTenant) return;
    
    // Validate form
    if (!newCredential.name || !newCredential.client_id || !newCredential.client_secret || !newCredential.tenant_id) {
      toast.error("Please fill in all fields");
      return;
    }
    
    setIsAddingCredential(true);
    addLog(`Creating new Azure credential: ${newCredential.name}...`);
    
    try {
      await cmpService.createAzureCredential(newCredential, currentTenant.tenant_id);
      addLog(`Created Azure credential: ${newCredential.name}`, "success");
      toast.success("Azure credential created successfully");
      
      // Reset form and close dialog
      setNewCredential({
        name: "",
        client_id: "",
        client_secret: "",
        tenant_id: ""
      });
      setIsDialogOpen(false);
      
      // Reload credentials
      await loadAzureCredentials();
    } catch (error) {
      console.error("Error creating Azure credential:", error);
      addLog(`Failed to create Azure credential: ${error instanceof Error ? error.message : String(error)}`, "error");
      toast.error(`Failed to create Azure credential: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setIsAddingCredential(false);
    }
  };
  
  // Delete Azure credential
  const handleDeleteCredential = async (credential: AzureCredential) => {
    if (!currentTenant) return;
    
    if (!confirm(`Are you sure you want to delete the credential "${credential.name}"?`)) {
      return;
    }
    
    addLog(`Deleting Azure credential: ${credential.name}...`);
    
    try {
      await cmpService.deleteAzureCredential(credential.id, currentTenant.tenant_id);
      addLog(`Deleted Azure credential: ${credential.name}`, "success");
      toast.success("Azure credential deleted successfully");
      
      // Reload credentials
      await loadAzureCredentials();
    } catch (error) {
      console.error("Error deleting Azure credential:", error);
      addLog(`Failed to delete Azure credential: ${error instanceof Error ? error.message : String(error)}`, "error");
      toast.error(`Failed to delete Azure credential: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  };
  
  // Test Azure connection
  const handleTestConnection = async (credential: AzureCredential) => {
    if (!currentTenant) return;
    
    // Update testing state
    setIsTestingConnection(prev => ({ ...prev, [credential.id]: true }));
    addLog(`Testing Azure connection for ${credential.name}...`);
    
    try {
      const subs = await cmpService.getAzureSubscriptions(credential.id, currentTenant.tenant_id);
      setSubscriptions(prev => ({ ...prev, [credential.id]: subs }));
      
      addLog(`Connection test successful for ${credential.name}`, "success");
      addLog(`Found ${subs.length} subscriptions for ${credential.name}`, "info");
      subs.forEach(sub => {
        addLog(`Subscription: ${sub.name} (${sub.id})`, "info");
      });
      
      toast.success(`Connection test successful. Found ${subs.length} subscriptions.`);
    } catch (error) {
      console.error("Error testing Azure connection:", error);
      addLog(`Connection test failed for ${credential.name}: ${error instanceof Error ? error.message : String(error)}`, "error");
      toast.error(`Connection test failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setIsTestingConnection(prev => ({ ...prev, [credential.id]: false }));
    }
  };
  
  // Test all connections
  const handleTestAllConnections = async () => {
    if (!currentTenant || azureCredentials.length === 0) return;
    
    addLog("Testing all Azure connections...");
    
    for (const credential of azureCredentials) {
      await handleTestConnection(credential);
    }
    
    addLog("Completed testing all connections", "info");
  };
  
  // Handle Azure OpenAI settings change
  const handleAzureOpenAISettingChange = (field: string, value: string | boolean) => {
    setAzureOpenAISettings(prev => ({
      ...prev,
      [field]: value
    }));
  };
  
  // Test Azure OpenAI connection
  const handleTestAIConnection = async () => {
    setIsTestingAIConnection(true);
    addLog("Testing Azure OpenAI connection...");
    
    try {
      // First, save the current settings
      await handleSaveAISettings(false);
      
      // Then test the connection
      const status = await aiAssistantService.checkStatus();
      
      setAIConnectionStatus({
        status: status.status,
        message: status.message,
        lastChecked: new Date().toISOString()
      });
      
      if (status.status === 'connected') {
        addLog("Azure OpenAI connection test successful", "success");
        toast.success("Azure OpenAI connection test successful");
      } else {
        addLog(`Azure OpenAI connection test failed: ${status.message}`, "error");
        toast.error(`Connection test failed: ${status.message}`);
      }
    } catch (error) {
      console.error("Error testing Azure OpenAI connection:", error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      addLog(`Error testing Azure OpenAI connection: ${errorMessage}`, "error");
      toast.error(`Connection test failed: ${errorMessage}`);
      
      setAIConnectionStatus({
        status: 'error',
        message: errorMessage,
        lastChecked: new Date().toISOString()
      });
    } finally {
      setIsTestingAIConnection(false);
    }
  };
  
  // Save Azure OpenAI settings
  const handleSaveAISettings = async (showToast: boolean = true) => {
    if (!azureOpenAISettings.enabled) {
      // If disabled, just save empty settings
      setIsSavingAISettings(true);
      addLog("Disabling Azure OpenAI integration...");
      
      try {
        await aiAssistantService.updateConfig({
          api_key: "",
          endpoint: "",
          deployment_name: "",
          model: azureOpenAISettings.model,
          api_version: azureOpenAISettings.apiVersion
        });
        
        addLog("Azure OpenAI integration disabled", "success");
        if (showToast) {
          toast.success("Azure OpenAI integration disabled");
        }
        
        // Update connection status
        setAIConnectionStatus({
          status: 'not_configured',
          message: 'Azure OpenAI is not configured',
          lastChecked: new Date().toISOString()
        });
      } catch (error) {
        console.error("Error disabling Azure OpenAI:", error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        addLog(`Error disabling Azure OpenAI: ${errorMessage}`, "error");
        if (showToast) {
          toast.error(`Failed to disable Azure OpenAI: ${errorMessage}`);
        }
      } finally {
        setIsSavingAISettings(false);
      }
      return;
    }
    
    // Validate required fields
    if (!azureOpenAISettings.endpoint || !azureOpenAISettings.apiKey || !azureOpenAISettings.deploymentName) {
      toast.error("Please fill in all required fields");
      return;
    }
    
    setIsSavingAISettings(true);
    addLog("Saving Azure OpenAI settings...");
    
    try {
      await aiAssistantService.updateConfig({
        api_key: azureOpenAISettings.apiKey,
        endpoint: azureOpenAISettings.endpoint,
        deployment_name: azureOpenAISettings.deploymentName,
        model: azureOpenAISettings.model,
        api_version: azureOpenAISettings.apiVersion
      });
      
      addLog("Azure OpenAI settings saved successfully", "success");
      if (showToast) {
        toast.success("Azure OpenAI settings saved successfully");
      }
    } catch (error) {
      console.error("Error saving Azure OpenAI settings:", error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      addLog(`Error saving Azure OpenAI settings: ${errorMessage}`, "error");
      if (showToast) {
        toast.error(`Failed to save Azure OpenAI settings: ${errorMessage}`);
      }
    } finally {
      setIsSavingAISettings(false);
    }
  };
  
  useEffect(() => {
    if (currentTenant) {
      loadAzureCredentials();
      loadAzureOpenAISettings();
      addLog("Settings page initialized", "info");
    }
  }, [currentTenant]);
  
  const handleSaveGithubSettings = () => {
    toast.success("GitHub integration settings saved");
    addLog("GitHub integration settings saved", "success");
  };
  
  const handleTestGithubConnection = () => {
    toast.success("Testing GitHub connection...");
    addLog("Testing GitHub connection...", "info");
    addLog(`Connecting to repository ${githubSettings.organizationName}/${githubSettings.repositoryName}...`, "info");
    addLog("GitHub connection successful", "success");
  };
  
  const statusBadgeVariant = (status: IntegrationStatus) => {
    switch (status) {
      case "connected": return "success";
      case "warning": return "warning";
      case "error": return "destructive";
      default: return "secondary";
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground">
            Configure integrations and platform settings
          </p>
        </div>
      </div>
      
      <Tabs defaultValue="azure" className="space-y-4">
        <TabsList className="grid grid-cols-4 md:w-[600px]">
          <TabsTrigger value="azure" className="flex items-center">
            <CloudCog className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Azure</span>
            <span className="sm:hidden">Azure</span>
          </TabsTrigger>
          <TabsTrigger value="ai" className="flex items-center">
            <BrainCircuit className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">AI Services</span>
            <span className="sm:hidden">AI</span>
          </TabsTrigger>
          <TabsTrigger value="github" className="flex items-center">
            <Github className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">GitHub</span>
            <span className="sm:hidden">GitHub</span>
          </TabsTrigger>
          <TabsTrigger value="debug" className="flex items-center">
            <Terminal className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Debug</span>
            <span className="sm:hidden">Debug</span>
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="azure" className="space-y-6">
          <div className="grid grid-cols-1 gap-6">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle className="flex items-center">
                      <CloudCog className="h-5 w-5 mr-2" />
                      Azure Configuration
                    </CardTitle>
                    <CardDescription>
                      Manage Microsoft Azure credentials
                    </CardDescription>
                  </div>
                  <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm">
                        <Plus className="h-4 w-4 mr-2" />
                        Add Credential
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Add Azure Credential</DialogTitle>
                        <DialogDescription>
                          Add a new set of Azure credentials to connect to Microsoft Azure services.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label htmlFor="credential-name">Credential Name</Label>
                          <Input
                            id="credential-name"
                            placeholder="Enter a name for this credential set"
                            value={newCredential.name}
                            onChange={(e) => setNewCredential({ ...newCredential, name: e.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="client-id">Client ID</Label>
                          <Input
                            id="client-id"
                            placeholder="Enter Azure Client ID"
                            value={newCredential.client_id}
                            onChange={(e) => setNewCredential({ ...newCredential, client_id: e.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="tenant-id">Tenant ID</Label>
                          <Input
                            id="tenant-id"
                            placeholder="Enter Azure Tenant ID"
                            value={newCredential.tenant_id}
                            onChange={(e) => setNewCredential({ ...newCredential, tenant_id: e.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="client-secret">Client Secret</Label>
                          <Input
                            id="client-secret"
                            type="password"
                            placeholder="Enter Azure Client Secret"
                            value={newCredential.client_secret}
                            onChange={(e) => setNewCredential({ ...newCredential, client_secret: e.target.value })}
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handleCreateCredential} disabled={isAddingCredential}>
                          {isAddingCredential ? "Adding..." : "Add Credential"}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {isLoadingCredentials ? (
                  <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                  </div>
                ) : azureCredentials.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>No Azure credentials configured.</p>
                    <p className="text-sm mt-2">Click "Add Credential" to configure Azure access.</p>
                  </div>
                ) : (
                  <Accordion type="multiple" className="w-full">
                    {azureCredentials.map((credential) => (
                      <AccordionItem key={credential.id} value={credential.id}>
                        <AccordionTrigger className="hover:no-underline">
                          <div className="flex items-center justify-between w-full pr-4">
                            <div className="flex items-center">
                              <span className="font-medium">{credential.name}</span>
                              <Badge 
                                variant={credential.configured ? "success" : "destructive"}
                                className="ml-2"
                              >
                                {credential.configured ? "Connected" : "Not Connected"}
                              </Badge>
                            </div>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent>
                          <div className="space-y-4 pt-2">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label>Client ID</Label>
                                <div className="flex items-center space-x-2">
                                  <Input
                                    value={credential.client_id}
                                    readOnly
                                  />
                                </div>
                              </div>
                              <div className="space-y-2">
                                <Label>Tenant ID</Label>
                                <div className="flex items-center space-x-2">
                                  <Input
                                    value={credential.tenant_id}
                                    readOnly
                                  />
                                </div>
                              </div>
                            </div>
                            
                            {subscriptions[credential.id] && subscriptions[credential.id].length > 0 && (
                              <div className="space-y-2 mt-4">
                                <Label>Available Subscriptions</Label>
                                <ScrollArea className="h-[120px] rounded-md border p-2">
                                  {subscriptions[credential.id].map((sub) => (
                                    <div key={sub.id} className="py-1">
                                      <div className="font-medium">{sub.name}</div>
                                      <div className="text-xs text-muted-foreground">{sub.id}</div>
                                    </div>
                                  ))}
                                </ScrollArea>
                              </div>
                            )}
                            
                            <div className="flex justify-between pt-2">
                              <Button 
                                variant="destructive" 
                                size="sm"
                                onClick={() => handleDeleteCredential(credential)}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </Button>
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => handleTestConnection(credential)}
                                disabled={isTestingConnection[credential.id]}
                              >
                                {isTestingConnection[credential.id] ? (
                                  <>
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                                    Testing...
                                  </>
                                ) : (
                                  <>
                                    <RefreshCw className="h-4 w-4 mr-2" />
                                    Test Connection
                                  </>
                                )}
                              </Button>
                            </div>
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                )}
              </CardContent>
              <CardFooter className="flex justify-between">
                <Button variant="outline" onClick={loadAzureCredentials}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
                <Button onClick={handleTestAllConnections} disabled={azureCredentials.length === 0}>
                  Test All Connections
                </Button>
              </CardFooter>
            </Card>            
          </div>
        </TabsContent>
        
        <TabsContent value="ai" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <BrainCircuit className="h-5 w-5 mr-2" />
                AI Services Configuration
              </CardTitle>
              <CardDescription>
                Configure Azure OpenAI for AI Assistant and other AI features
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center space-x-4">
                <Switch
                  id="ai-enable"
                  checked={azureOpenAISettings.enabled}
                  onCheckedChange={(checked) => handleAzureOpenAISettingChange("enabled", checked)}
                />
                <div>
                  <Label htmlFor="ai-enable">Enable Azure OpenAI Integration</Label>
                  <p className="text-xs text-muted-foreground">
                    Connect to Azure OpenAI to enable AI Assistant and other AI features
                  </p>
                </div>
              </div>
              
              {aiConnectionStatus.status === 'connected' && (
                <Alert className="bg-green-50 border-green-200">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <AlertTitle className="text-green-800">Connected to Azure OpenAI</AlertTitle>
                  <AlertDescription className="text-green-700">
                    Your Azure OpenAI integration is working correctly.
                    {aiConnectionStatus.lastChecked && (
                      <span className="text-xs block mt-1">
                        Last checked: {new Date(aiConnectionStatus.lastChecked).toLocaleString()}
                      </span>
                    )}
                  </AlertDescription>
                </Alert>
              )}
              
              {aiConnectionStatus.status === 'error' && (
                <Alert className="bg-red-50 border-red-200">
                  <AlertCircle className="h-4 w-4 text-red-600" />
                  <AlertTitle className="text-red-800">Connection Error</AlertTitle>
                  <AlertDescription className="text-red-700">
                    {aiConnectionStatus.message}
                    {aiConnectionStatus.lastChecked && (
                      <span className="text-xs block mt-1">
                        Last checked: {new Date(aiConnectionStatus.lastChecked).toLocaleString()}
                      </span>
                    )}
                  </AlertDescription>
                </Alert>
              )}
              
              {azureOpenAISettings.enabled && (
                <div className="space-y-4">
                  <Alert className="bg-blue-50 border-blue-200">
                    <Info className="h-4 w-4 text-blue-600" />
                    <AlertTitle className="text-blue-800">Azure OpenAI Setup Guide</AlertTitle>
                    <AlertDescription className="text-blue-700">
                      <p className="mb-2">To set up Azure OpenAI, you'll need:</p>
                      <ol className="list-decimal list-inside space-y-1">
                        <li>An Azure OpenAI resource in your Azure portal</li>
                        <li>A deployed model (e.g., GPT-4 or GPT-3.5-Turbo)</li>
                        <li>The API key, endpoint URL, and deployment name</li>
                      </ol>
                    </AlertDescription>
                  </Alert>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="openai-endpoint">
                        Azure OpenAI Endpoint <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="openai-endpoint"
                        placeholder="https://your-resource-name.openai.azure.com"
                        value={azureOpenAISettings.endpoint}
                        onChange={(e) => handleAzureOpenAISettingChange("endpoint", e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">
                        The endpoint URL for your Azure OpenAI resource
                      </p>
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="openai-api-key">
                        API Key <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="openai-api-key"
                        type="password"
                        placeholder="Enter your Azure OpenAI API key"
                        value={azureOpenAISettings.apiKey}
                        onChange={(e) => handleAzureOpenAISettingChange("apiKey", e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">
                        The API key for your Azure OpenAI resource
                      </p>
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="openai-deployment">
                        Deployment Name <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="openai-deployment"
                        placeholder="Enter your model deployment name"
                        value={azureOpenAISettings.deploymentName}
                        onChange={(e) => handleAzureOpenAISettingChange("deploymentName", e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">
                        The name of your deployed model in Azure OpenAI
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="openai-model">Model</Label>
                      <Select
                        value={azureOpenAISettings.model}
                        onValueChange={(value) => handleAzureOpenAISettingChange("model", value)}
                      >
                        <SelectTrigger id="openai-model">
                          <SelectValue placeholder="Select model" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="gpt-4">GPT-4</SelectItem>
                          <SelectItem value="gpt-4-turbo">GPT-4 Turbo</SelectItem>
                          <SelectItem value="gpt-4-32k">GPT-4 32k</SelectItem>
                          <SelectItem value="gpt-35-turbo">GPT-3.5 Turbo</SelectItem>
                          <SelectItem value="gpt-35-turbo-16k">GPT-3.5 Turbo 16k</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="openai-api-version">API Version</Label>
                      <Select
                        value={azureOpenAISettings.apiVersion}
                        onValueChange={(value) => handleAzureOpenAISettingChange("apiVersion", value)}
                      >
                        <SelectTrigger id="openai-api-version">
                          <SelectValue placeholder="Select API version" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="2023-05-15">2023-05-15</SelectItem>
                          <SelectItem value="2023-06-01-preview">2023-06-01-preview</SelectItem>
                          <SelectItem value="2023-07-01-preview">2023-07-01-preview</SelectItem>
                          <SelectItem value="2023-08-01-preview">2023-08-01-preview</SelectItem>
                          <SelectItem value="2023-09-01-preview">2023-09-01-preview</SelectItem>
                          <SelectItem value="2023-12-01-preview">2023-12-01-preview</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
            <CardFooter className="flex justify-between">
              <Button 
                variant="outline"
                onClick={handleTestAIConnection}
                disabled={!azureOpenAISettings.enabled || isTestingAIConnection || isSavingAISettings}
              >
                {isTestingAIConnection ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Testing...
                  </>
                ) : (
                  <>Test Connection</>
                )}
              </Button>
              <Button 
                onClick={() => handleSaveAISettings(true)}
                disabled={isSavingAISettings}
              >
                {isSavingAISettings ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>Save Changes</>
                )}
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
        
        {user?.role === "admin" && (
          <TabsContent value="github" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Github className="h-5 w-5 mr-2" />
                  GitHub Integration
                </CardTitle>
                <CardDescription>
                  Connect with GitHub to manage templates from repositories
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center space-x-4">
                  <Switch
                    id="github-enable"
                    checked={githubSettings.enabled}
                    onCheckedChange={(checked) => setGithubSettings({...githubSettings, enabled: checked})}
                  />
                  <Label htmlFor="github-enable">Enable GitHub Integration</Label>
                </div>
                
                {githubSettings.enabled && (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2 md:col-span-2">
                        <Label htmlFor="github-token">Personal Access Token</Label>
                        <Input
                          id="github-token"
                          type="password"
                          placeholder="Enter GitHub Personal Access Token"
                          value={githubSettings.personalAccessToken}
                          onChange={(e) => setGithubSettings({...githubSettings, personalAccessToken: e.target.value})}
                        />
                        <p className="text-xs text-muted-foreground">
                          Token requires repo, read:packages, and webhook scopes
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="github-org">Organization Name</Label>
                        <Input
                          id="github-org"
                          placeholder="Enter GitHub Organization"
                          value={githubSettings.organizationName}
                          onChange={(e) => setGithubSettings({...githubSettings, organizationName: e.target.value})}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="github-repo">Repository Name</Label>
                        <Input
                          id="github-repo"
                          placeholder="Enter Repository Name"
                          value={githubSettings.repositoryName}
                          onChange={(e) => setGithubSettings({...githubSettings, repositoryName: e.target.value})}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="github-branch">Default Branch</Label>
                        <Input
                          id="github-branch"
                          placeholder="main"
                          value={githubSettings.branch}
                          onChange={(e) => setGithubSettings({...githubSettings, branch: e.target.value})}
                        />
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <Label htmlFor="github-webhook">Webhook URL</Label>
                        <div className="flex space-x-2">
                          <Input
                            id="github-webhook"
                            readOnly
                            value={githubSettings.webhookUrl}
                          />
                          <Button variant="outline" onClick={() => {
                            navigator.clipboard.writeText(githubSettings.webhookUrl);
                            toast.success("Webhook URL copied to clipboard");
                          }}>
                            Copy
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Add this URL to your GitHub repository webhooks with content type: application/json
                        </p>
                      </div>
                    </div>
                    
                    <div className="space-y-4">
                      <div className="flex items-center space-x-4">
                        <Switch
                          id="github-sync"
                          checked={githubSettings.syncEnabled}
                          onCheckedChange={(checked) => setGithubSettings({...githubSettings, syncEnabled: checked})}
                        />
                        <div>
                          <Label htmlFor="github-sync">Enable Template Synchronization</Label>
                          <p className="text-xs text-muted-foreground">
                            Automatically sync templates when changes are pushed to the repository
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-4">
                        <Switch
                          id="github-autodeploy"
                          checked={githubSettings.autoDeployEnabled}
                          onCheckedChange={(checked) => setGithubSettings({...githubSettings, autoDeployEnabled: checked})}
                        />
                        <div>
                          <Label htmlFor="github-autodeploy">Enable Auto-Deployment</Label>
                          <p className="text-xs text-muted-foreground">
                            Automatically deploy template changes to connected environments
                          </p>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
              <CardFooter className="flex justify-between">
                <Button variant="outline" onClick={handleTestGithubConnection} disabled={!githubSettings.enabled}>
                  Test Connection
                </Button>
                <Button onClick={handleSaveGithubSettings}>Save Changes</Button>
              </CardFooter>
            </Card>
          </TabsContent>
        )}
        
        <TabsContent value="debug">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Terminal className="h-5 w-5 mr-2" />
                Debug Terminal
              </CardTitle>
              <CardDescription>
                View integration logs and connection diagnostics
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div 
                ref={terminalRef}
                className="font-mono text-sm bg-black text-white p-4 rounded-md h-[400px] overflow-auto"
              >
                {terminalLogs.length === 0 ? (
                  <div className="text-gray-500">No logs available. Test connections to see logs.</div>
                ) : (
                  terminalLogs.map((log, index) => (
                    <div 
                      key={index} 
                      className={`pb-1 ${
                        log.includes("[SUCCESS]") ? "text-green-400" :
                        log.includes("[WARNING]") ? "text-yellow-400" :
                        log.includes("[ERROR]") ? "text-red-400" :
                        "text-white"
                      }`}
                    >
                      {log}
                    </div>
                  ))
                )}
              </div>
            </CardContent>
            <CardFooter className="flex justify-between">
              <Button variant="outline" onClick={() => setTerminalLogs([])}>
                Clear Logs
              </Button>
              <Button onClick={handleTestAllConnections} disabled={azureCredentials.length === 0}>
                Test All Connections
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Settings;
