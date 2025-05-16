
import { useState, useEffect } from "react";
import { useAuth } from "@/context/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { mockIntegrationConfigs } from "@/data/mock-data";
import { IntegrationConfig, IntegrationStatus } from "@/types/cloud";
import { Settings as SettingsIcon, Key, Terminal, CloudCog, Github } from "lucide-react";
import { toast } from "sonner";

const Settings = () => {
  const { currentTenant, user } = useAuth();
  const [integrations, setIntegrations] = useState<IntegrationConfig[]>([]);
  const [terminalLogs, setTerminalLogs] = useState([
    "[INFO] Testing Azure connection...",
    "[SUCCESS] Azure connection successful",
    "[INFO] Testing AWS connection...",
    "[SUCCESS] AWS connection successful",
    "[INFO] Testing GCP connection...",
    "[WARNING] GCP connection issue: Permission denied for resource 'storage-buckets'"
  ]);
  
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
  
  useEffect(() => {
    if (currentTenant) {
      const tenantIntegrations = mockIntegrationConfigs.filter(
        config => config.tenantId === currentTenant.id
      );
      setIntegrations(tenantIntegrations);
    }
  }, [currentTenant]);
  
  const handleSaveIntegration = (id: string) => {
    toast.success("Integration settings saved");
    // In a real app, this would save to backend
  };
  
  const handleTestConnection = (id: string) => {
    toast.success("Testing connection...");
    // In a real app, this would test the connection
    
    // Add test log
    setTerminalLogs(prev => [
      ...prev,
      `[INFO] Testing connection for integration ${id}...`,
      `[SUCCESS] Connection test completed`
    ]);
  };
  
  const handleSaveGithubSettings = () => {
    toast.success("GitHub integration settings saved");
  };
  
  const handleTestGithubConnection = () => {
    toast.success("Testing GitHub connection...");
    setTerminalLogs(prev => [
      ...prev,
      `[INFO] Testing GitHub connection...`,
      `[INFO] Connecting to repository ${githubSettings.organizationName}/${githubSettings.repositoryName}...`,
      `[SUCCESS] GitHub connection successful`
    ]);
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
                <CardTitle className="flex items-center">
                  <CloudCog className="h-5 w-5 mr-2" />
                  Azure Configuration
                </CardTitle>
                <CardDescription>
                  Connect to Microsoft Azure services
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="azure-client-id">Client ID</Label>
                    <Input
                      id="azure-client-id"
                      placeholder="Enter Client ID"
                      value="azure-client-id"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="azure-tenant-id">Tenant ID</Label>
                    <Input
                      id="azure-tenant-id"
                      placeholder="Enter Tenant ID"
                      value="azure-tenant-id"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="azure-subscription-id">Subscription ID</Label>
                    <Input
                      id="azure-subscription-id"
                      placeholder="Enter Subscription ID"
                      value="azure-subscription-id"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="azure-client-secret">Client Secret</Label>
                    <Input
                      id="azure-client-secret"
                      type="password"
                      placeholder="Enter Client Secret"
                      value="●●●●●●●●●●●●"
                    />
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <div className={`status-dot status-healthy`} />
                  <span className="text-sm">Connected</span>
                  <span className="text-xs text-muted-foreground ml-2">
                    Last checked: {new Date().toLocaleString()}
                  </span>
                </div>
              </CardContent>
              <CardFooter className="flex justify-between">
                <Button variant="outline" onClick={() => handleTestConnection("azure")}>
                  Test Connection
                </Button>
                <Button onClick={() => handleSaveIntegration("azure")}>
                  Save Changes
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
                      value="aws-access-key"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="aws-secret-key">Secret Access Key</Label>
                    <Input
                      id="aws-secret-key"
                      type="password"
                      placeholder="Enter Secret Access Key"
                      value="●●●●●●●●●●●●"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="aws-region">Default Region</Label>
                    <Input
                      id="aws-region"
                      placeholder="Enter Region"
                      value="us-west-2"
                    />
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <div className={`status-dot status-healthy`} />
                  <span className="text-sm">Connected</span>
                  <span className="text-xs text-muted-foreground ml-2">
                    Last checked: {new Date().toLocaleString()}
                  </span>
                </div>
              </CardContent>
              <CardFooter className="flex justify-between">
                <Button variant="outline" onClick={() => handleTestConnection("aws")}>
                  Test Connection
                </Button>
                <Button onClick={() => handleSaveIntegration("aws")}>
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
                      value="gcp-project-id"
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="gcp-service-account">Service Account JSON</Label>
                    <Textarea
                      id="gcp-service-account"
                      placeholder="Paste Service Account JSON"
                      className="font-mono h-32"
                      value={`{
  "type": "service_account",
  "project_id": "gcp-project-id",
  "private_key_id": "key-id",
  "private_key": "-----BEGIN PRIVATE KEY-----\\n...\\n-----END PRIVATE KEY-----\\n",
  "client_email": "service-account@gcp-project-id.iam.gserviceaccount.com",
  "client_id": "client-id",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/service-account%40gcp-project-id.iam.gserviceaccount.com"
}`}
                    />
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <div className={`status-dot status-warning`} />
                  <span className="text-sm">Warning</span>
                  <span className="text-xs text-muted-foreground ml-2">
                    Limited permissions - storage access issue
                  </span>
                </div>
              </CardContent>
              <CardFooter className="flex justify-between">
                <Button variant="outline" onClick={() => handleTestConnection("gcp")}>
                  Test Connection
                </Button>
                <Button onClick={() => handleSaveIntegration("gcp")}>
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
                <Key className="h-5 w-5 mr-2" />
                Azure OpenAI Configuration
              </CardTitle>
              <CardDescription>
                Configure Azure OpenAI for template analysis and assistance
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="openai-endpoint">API Endpoint</Label>
                  <Input
                    id="openai-endpoint"
                    placeholder="https://your-resource.openai.azure.com"
                    value="https://openai.azure.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="openai-key">API Key</Label>
                  <Input
                    id="openai-key"
                    type="password"
                    placeholder="Enter API Key"
                    value="●●●●●●●●●●●●"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="openai-deployment">Deployment Name</Label>
                  <Input
                    id="openai-deployment"
                    placeholder="Enter deployment name"
                    value="gpt4"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="openai-model">Model</Label>
                  <Input
                    id="openai-model"
                    placeholder="Enter model name"
                    value="gpt-4"
                  />
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                <div className={`status-dot status-healthy`} />
                <span className="text-sm">Connected</span>
                <span className="text-xs text-muted-foreground ml-2">
                  Last checked: {new Date().toLocaleString()}
                </span>
              </div>
            </CardContent>
            <CardFooter className="flex justify-between">
              <Button variant="outline" onClick={() => handleTestConnection("openai")}>
                Test Connection
              </Button>
              <Button onClick={() => handleSaveIntegration("openai")}>
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
              <div className="font-mono text-sm bg-black text-white p-4 rounded-md h-[400px] overflow-auto">
                {terminalLogs.map((log, index) => (
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
                ))}
              </div>
            </CardContent>
            <CardFooter className="flex justify-between">
              <Button variant="outline" onClick={() => setTerminalLogs([])}>
                Clear Logs
              </Button>
              <Button onClick={() => handleTestConnection("all")}>
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
