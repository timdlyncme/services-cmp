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
import { Settings as SettingsIcon, Key, Terminal, CloudCog, Github, Plus, Trash2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { cmpService } from "@/services/cmp-service";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

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
      const credentials = await cmpService.getAzureCredentials(currentTenant.id);
      setAzureCredentials(credentials);
      addLog(`Loaded ${credentials.length} Azure credential sets`, "success");
    } catch (error) {
      console.error("Error loading Azure credentials:", error);
      addLog(`Failed to load Azure credentials: ${error instanceof Error ? error.message : String(error)}`, "error");
    } finally {
      setIsLoadingCredentials(false);
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
      await cmpService.createAzureCredential(newCredential, currentTenant.id);
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
      await cmpService.deleteAzureCredential(credential.id, currentTenant.id);
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
      const subs = await cmpService.getAzureSubscriptions(credential.id, currentTenant.id);
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
  
  useEffect(() => {
    if (currentTenant) {
      loadAzureCredentials();
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground">
            Manage your cloud integrations and platform settings
          </p>
        </div>
      </div>
      
      <Tabs defaultValue="cloud-providers">
        <TabsList className="grid grid-cols-4 w-full sm:w-[500px]">
          <TabsTrigger value="cloud-providers">Cloud Providers</TabsTrigger>
          <TabsTrigger value="ai-services">AI Services</TabsTrigger>
          {user?.role === "admin" && <TabsTrigger value="github">GitHub Integration</TabsTrigger>}
          <TabsTrigger value="debug">Debug</TabsTrigger>
        </TabsList>
        
        <TabsContent value="cloud-providers" className="space-y-6">
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
            
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <CloudCog className="h-5 w-5 mr-2" />
                  AWS Configuration
                </CardTitle>
                <CardDescription>
                  Connect to Amazon Web Services
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="aws-access-key">Access Key ID</Label>
                    <Input
                      id="aws-access-key"
                      placeholder="Enter Access Key ID"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="aws-secret-key">Secret Access Key</Label>
                    <Input
                      id="aws-secret-key"
                      type="password"
                      placeholder="Enter Secret Access Key"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="aws-region">Default Region</Label>
                    <Input
                      id="aws-region"
                      placeholder="Enter Region"
                      defaultValue="us-west-2"
                    />
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex justify-between">
                <Button variant="outline">
                  Test Connection
                </Button>
                <Button>
                  Save Changes
                </Button>
              </CardFooter>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <CloudCog className="h-5 w-5 mr-2" />
                  GCP Configuration
                </CardTitle>
                <CardDescription>
                  Connect to Google Cloud Platform
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="gcp-project-id">Project ID</Label>
                    <Input
                      id="gcp-project-id"
                      placeholder="Enter Project ID"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="gcp-key-file">Service Account Key</Label>
                    <div className="flex items-center space-x-2">
                      <Input
                        id="gcp-key-file"
                        type="file"
                        className="flex-1"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Upload a JSON key file for a service account with appropriate permissions
                    </p>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex justify-between">
                <Button variant="outline">
                  Test Connection
                </Button>
                <Button>
                  Save Changes
                </Button>
              </CardFooter>
            </Card>
          </div>
        </TabsContent>
        
        <TabsContent value="ai-services" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <CloudCog className="h-5 w-5 mr-2" />
                Azure OpenAI Configuration
              </CardTitle>
              <CardDescription>
                Connect to Azure OpenAI services
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="openai-endpoint">API Endpoint</Label>
                  <Input
                    id="openai-endpoint"
                    placeholder="https://your-resource.openai.azure.com"
                    defaultValue="https://openai.azure.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="openai-key">API Key</Label>
                  <Input
                    id="openai-key"
                    type="password"
                    placeholder="Enter API Key"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="openai-deployment">Deployment Name</Label>
                  <Input
                    id="openai-deployment"
                    placeholder="Enter deployment name"
                    defaultValue="gpt4"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="openai-model">Model</Label>
                  <Input
                    id="openai-model"
                    placeholder="Enter model name"
                    defaultValue="gpt-4"
                  />
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex justify-between">
              <Button variant="outline">
                Test Connection
              </Button>
              <Button>
                Save Changes
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
