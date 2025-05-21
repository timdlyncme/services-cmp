import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { useAzureOpenAI } from '@/contexts/AzureOpenAIContext';
import { NexusAIService } from '@/services/nexus-ai-service';
import { Settings } from 'lucide-react';

interface ConfigDialogProps {
  onConfigUpdate?: () => void;
}

export function ConfigDialog({ onConfigUpdate }: ConfigDialogProps) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const { 
    config, 
    updateConfig, 
    testConnection, 
    connectionStatus, 
    addLog 
  } = useAzureOpenAI();
  
  const [formValues, setFormValues] = useState({
    apiKey: '',
    endpoint: '',
    deploymentName: '',
    apiVersion: '2023-05-15',
  });
  
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      // Load current config values into form
      setFormValues({
        apiKey: config.apiKey || '',
        endpoint: config.endpoint || '',
        deploymentName: config.deploymentName || '',
        apiVersion: config.apiVersion || '2023-05-15',
      });
    }
  }, [open, config]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormValues((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      
      // Update the configuration
      updateConfig({
        apiKey: formValues.apiKey,
        endpoint: formValues.endpoint,
        deploymentName: formValues.deploymentName,
        apiVersion: formValues.apiVersion,
      });
      
      addLog('Configuration updated', 'success');
      
      // Update the backend configuration
      const nexusAIService = new NexusAIService();
      await nexusAIService.updateConfig({
        api_key: formValues.apiKey,
        endpoint: formValues.endpoint,
        deployment_name: formValues.deploymentName,
        api_version: formValues.apiVersion,
      });
      
      addLog('Backend configuration updated', 'success');
      
      // Test the connection
      const success = await testConnection();
      
      if (success) {
        toast({
          title: 'Success',
          description: 'Configuration updated and connection tested successfully',
        });
        
        if (onConfigUpdate) {
          onConfigUpdate();
        }
        
        setOpen(false);
      }
    } catch (error) {
      console.error('Failed to update config:', error);
      addLog(`Failed to update configuration: ${error instanceof Error ? error.message : String(error)}`, 'error');
      
      toast({
        title: 'Error',
        description: 'Failed to update configuration',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Settings className="h-4 w-4 mr-2" />
          Configure
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Azure OpenAI Configuration</DialogTitle>
          <DialogDescription>
            Configure your Azure OpenAI settings for NexusAI.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="apiKey" className="text-right">
                API Key
              </Label>
              <Input
                id="apiKey"
                name="apiKey"
                value={formValues.apiKey}
                onChange={handleChange}
                className="col-span-3"
                required
                type="password"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="endpoint" className="text-right">
                Endpoint
              </Label>
              <Input
                id="endpoint"
                name="endpoint"
                value={formValues.endpoint}
                onChange={handleChange}
                className="col-span-3"
                required
                placeholder="https://your-resource.openai.azure.com"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="deploymentName" className="text-right">
                Deployment
              </Label>
              <Input
                id="deploymentName"
                name="deploymentName"
                value={formValues.deploymentName}
                onChange={handleChange}
                className="col-span-3"
                required
                placeholder="gpt-35-turbo"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="apiVersion" className="text-right">
                API Version
              </Label>
              <Input
                id="apiVersion"
                name="apiVersion"
                value={formValues.apiVersion}
                onChange={handleChange}
                className="col-span-3"
                required
                placeholder="2023-05-15"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={loading || connectionStatus === 'connecting'}>
              {loading || connectionStatus === 'connecting' ? 'Saving...' : 'Save changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

