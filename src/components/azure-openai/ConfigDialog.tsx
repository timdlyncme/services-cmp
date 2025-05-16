import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Settings, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { useAzureOpenAI } from "@/contexts/AzureOpenAIContext";

interface ConfigDialogProps {
  children?: React.ReactNode;
}

const ConfigDialog: React.FC<ConfigDialogProps> = ({ children }) => {
  const {
    config,
    updateConfig,
    isConfigured,
    connectionStatus,
    testConnection,
    logs,
    clearLogs,
  } = useAzureOpenAI();

  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleTestConnection = async () => {
    setIsLoading(true);
    await testConnection();
    setIsLoading(false);
  };

  const getStatusIcon = () => {
    switch (connectionStatus) {
      case "connected":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "connecting":
        return <Loader2 className="h-4 w-4 animate-spin text-yellow-500" />;
      case "error":
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusText = () => {
    switch (connectionStatus) {
      case "connected":
        return "Connected";
      case "connecting":
        return "Connecting...";
      case "error":
        return "Connection Error";
      default:
        return "Not Connected";
    }
  };

  const getStatusColor = () => {
    switch (connectionStatus) {
      case "connected":
        return "text-green-500";
      case "connecting":
        return "text-yellow-500";
      case "error":
        return "text-red-500";
      default:
        return "text-gray-400";
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button variant="outline" size="sm" className="gap-2">
            <Settings className="h-4 w-4" />
            Configure Azure OpenAI
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Azure OpenAI Configuration</DialogTitle>
          <DialogDescription>
            Configure your Azure OpenAI service connection settings.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="settings" className="mt-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="settings">Settings</TabsTrigger>
            <TabsTrigger value="logs">Logs</TabsTrigger>
          </TabsList>

          <TabsContent value="settings" className="space-y-4 py-4">
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="endpoint">Azure OpenAI Endpoint</Label>
                <Input
                  id="endpoint"
                  placeholder="https://your-resource-name.openai.azure.com"
                  value={config.endpoint}
                  onChange={(e) => updateConfig({ endpoint: e.target.value })}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="apiKey">API Key</Label>
                <Input
                  id="apiKey"
                  type="password"
                  placeholder="Your Azure OpenAI API key"
                  value={config.apiKey}
                  onChange={(e) => updateConfig({ apiKey: e.target.value })}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="deploymentName">Deployment Name</Label>
                <Input
                  id="deploymentName"
                  placeholder="Your model deployment name"
                  value={config.deploymentName}
                  onChange={(e) => updateConfig({ deploymentName: e.target.value })}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="apiVersion">API Version</Label>
                <Input
                  id="apiVersion"
                  placeholder="2023-05-15"
                  value={config.apiVersion}
                  onChange={(e) => updateConfig({ apiVersion: e.target.value })}
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2">
                <span>Status:</span>
                <span className={`flex items-center gap-1 ${getStatusColor()}`}>
                  {getStatusIcon()}
                  {getStatusText()}
                </span>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="logs" className="py-4">
            <ScrollArea className="h-[300px] rounded-md border p-4">
              {logs.length > 0 ? (
                <div className="space-y-1 font-mono text-sm">
                  {logs.map((log, index) => (
                    <div key={index} className="break-all">
                      {log}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  No logs available
                </div>
              )}
            </ScrollArea>
            <Button
              variant="outline"
              size="sm"
              onClick={clearLogs}
              className="mt-2"
              disabled={logs.length === 0}
            >
              Clear Logs
            </Button>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
          >
            Close
          </Button>
          <Button
            onClick={handleTestConnection}
            disabled={!isConfigured || isLoading}
            className="gap-2"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Test Connection"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ConfigDialog;

