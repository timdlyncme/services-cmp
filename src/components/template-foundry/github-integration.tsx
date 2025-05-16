
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Github, Plus, GitBranch, FileCode, AlertCircle } from "lucide-react";

interface Repository {
  id: string;
  name: string;
  owner: string;
  url: string;
  connected: boolean;
  lastSynced?: string;
}

export const GithubIntegration = () => {
  const [repositories, setRepositories] = useState<Repository[]>([
    {
      id: "repo-1",
      name: "terraform-modules",
      owner: "acme-cloud",
      url: "https://github.com/acme-cloud/terraform-modules",
      connected: true,
      lastSynced: "2023-06-15T10:30:00Z",
    },
    {
      id: "repo-2",
      name: "cloud-templates",
      owner: "acme-cloud",
      url: "https://github.com/acme-cloud/cloud-templates",
      connected: false,
    }
  ]);
  
  const [repoUrl, setRepoUrl] = useState("");
  
  const handleAddRepository = () => {
    if (!repoUrl) {
      toast.error("Please enter a GitHub repository URL");
      return;
    }
    
    try {
      const url = new URL(repoUrl);
      const pathParts = url.pathname.split('/').filter(Boolean);
      
      if (pathParts.length < 2 || url.hostname !== 'github.com') {
        throw new Error("Invalid GitHub URL");
      }
      
      const owner = pathParts[0];
      const name = pathParts[1];
      
      const newRepo: Repository = {
        id: `repo-${Date.now()}`,
        name,
        owner,
        url: repoUrl,
        connected: true,
        lastSynced: new Date().toISOString(),
      };
      
      setRepositories([...repositories, newRepo]);
      setRepoUrl("");
      toast.success("Repository added successfully");
    } catch (error) {
      toast.error("Invalid GitHub repository URL");
    }
  };
  
  const handleToggleConnection = (id: string) => {
    setRepositories(
      repositories.map(repo => 
        repo.id === id 
          ? { 
              ...repo, 
              connected: !repo.connected,
              lastSynced: repo.connected ? undefined : new Date().toISOString()
            } 
          : repo
      )
    );
    
    const repo = repositories.find(r => r.id === id);
    if (repo) {
      toast.success(`Repository ${repo.connected ? 'disconnected' : 'connected'} successfully`);
    }
  };
  
  const handleSyncRepository = (id: string) => {
    setRepositories(
      repositories.map(repo => 
        repo.id === id 
          ? { ...repo, lastSynced: new Date().toISOString() } 
          : repo
      )
    );
    
    const repo = repositories.find(r => r.id === id);
    if (repo) {
      toast.success(`Synced repository: ${repo.name}`);
    }
  };
  
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Github className="h-5 w-5" />
            GitHub Integration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Input
              placeholder="GitHub repository URL"
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              className="flex-1"
            />
            <Button onClick={handleAddRepository}>
              <Plus className="h-4 w-4 mr-2" />
              Add Repository
            </Button>
          </div>
          
          <ScrollArea className="h-[300px] rounded-md border">
            <div className="p-4 space-y-4">
              {repositories.length > 0 ? (
                repositories.map(repo => (
                  <div key={repo.id} className="flex justify-between items-center border rounded-lg p-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Github className="h-4 w-4" />
                        <span className="font-medium">{repo.owner}/{repo.name}</span>
                        <Badge variant={repo.connected ? "default" : "outline"}>
                          {repo.connected ? "Connected" : "Disconnected"}
                        </Badge>
                      </div>
                      {repo.lastSynced && (
                        <div className="text-sm text-muted-foreground">
                          Last synced: {new Date(repo.lastSynced).toLocaleString()}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      {repo.connected && (
                        <Button size="sm" variant="outline" onClick={() => handleSyncRepository(repo.id)}>
                          <GitBranch className="h-4 w-4 mr-2" />
                          Sync
                        </Button>
                      )}
                      <Button 
                        size="sm" 
                        variant={repo.connected ? "destructive" : "default"}
                        onClick={() => handleToggleConnection(repo.id)}
                      >
                        {repo.connected ? "Disconnect" : "Connect"}
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8">
                  <AlertCircle className="h-8 w-8 mx-auto text-muted-foreground" />
                  <p className="mt-2 text-muted-foreground">No repositories added</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>Available Template Files</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="p-3 border rounded-md flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileCode className="h-5 w-5 text-blue-500" />
                <div>
                  <div className="font-medium">network-security.tf</div>
                  <div className="text-sm text-muted-foreground">terraform-modules/security</div>
                </div>
              </div>
              <Button size="sm">Import</Button>
            </div>
            
            <div className="p-3 border rounded-md flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileCode className="h-5 w-5 text-blue-500" />
                <div>
                  <div className="font-medium">storage-account.json</div>
                  <div className="text-sm text-muted-foreground">cloud-templates/arm</div>
                </div>
              </div>
              <Button size="sm">Import</Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
