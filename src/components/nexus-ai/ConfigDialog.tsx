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
import { NexusAIService, AzureOpenAIConfig } from '@/services/nexus-ai-service';

interface ConfigDialogProps {
  onConfigUpdate: () => void;
}

export function ConfigDialog({ onConfigUpdate }: ConfigDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState<AzureOpenAIConfig>({
    api_key: '',
    endpoint: '',
    deployment_name: '',
    api_version: '2023-05-15',
  });
  const { toast } = useToast();
  const nexusAIService = new NexusAIService();

  useEffect(() => {
    if (open) {
      loadConfig();
    }
  }, [open]);

  const loadConfig = async () => {
    try {
      setLoading(true);
      const config = await nexusAIService.getConfig();
      setConfig(config);
    } catch (error) {
      console.error('Failed to load config:', error);
      toast({
        title: 'Error',
        description: 'Failed to load configuration',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setConfig((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      await nexusAIService.updateConfig(config);
      toast({
        title: 'Success',
        description: 'Configuration updated successfully',
      });
      onConfigUpdate();
      setOpen(false);
    } catch (error) {
      console.error('Failed to update config:', error);
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
        <Button variant="outline">Configure</Button>
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
              <Label htmlFor="api_key" className="text-right">
                API Key
              </Label>
              <Input
                id="api_key"
                name="api_key"
                value={config.api_key}
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
                value={config.endpoint}
                onChange={handleChange}
                className="col-span-3"
                required
                placeholder="https://your-resource.openai.azure.com"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="deployment_name" className="text-right">
                Deployment
              </Label>
              <Input
                id="deployment_name"
                name="deployment_name"
                value={config.deployment_name}
                onChange={handleChange}
                className="col-span-3"
                required
                placeholder="gpt-35-turbo"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="api_version" className="text-right">
                API Version
              </Label>
              <Input
                id="api_version"
                name="api_version"
                value={config.api_version}
                onChange={handleChange}
                className="col-span-3"
                required
                placeholder="2023-05-15"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={loading}>
              {loading ? 'Saving...' : 'Save changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

