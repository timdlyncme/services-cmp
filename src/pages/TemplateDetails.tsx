import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/auth-context";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { CloudTemplate, TemplateParameter, TemplateVariable } from "@/types/cloud";
import { ChevronLeft, Save, Play, MessagesSquare, History, FileEdit, Plus, Trash2, ChevronDown, ChevronUp, Eye, EyeOff, Loader2, Maximize2, Minimize2 } from "lucide-react";
import { toast } from "sonner";
import { cmpService } from "@/services/cmp-service";
import { deploymentService } from "@/services/deployment-service";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useAzureOpenAI } from "@/contexts/AzureOpenAIContext";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AIAssistantService, ChatMessage as AIChatMessage } from "@/services/ai-assistant-service";
import { DeploymentWizard } from "@/components/deployment-wizard";
import ReactMarkdown from "react-markdown";

interface TemplateVersion {
  id: number;
  version: string;
  changes: string;
  created_at: string;
  created_by: string;
  is_current: boolean;
}

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
    cloud_ids?: string[]; // Array of subscription IDs
  }>;
}

const TemplateDetails = () => {
  const { templateId } = useParams();
  const { currentTenant } = useAuth();
  const navigate = useNavigate();
  const [template, setTemplate] = useState<CloudTemplate | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingVersions, setLoadingVersions] = useState<boolean>(false);
  const [loadingEnvironments, setLoadingEnvironments] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [deployDialogOpen, setDeployDialogOpen] = useState(false);
  const [deployName, setDeployName] = useState("");
  const [deployEnv, setDeployEnv] = useState("");
  const [resourceGroup, setResourceGroup] = useState("");
  const [location, setLocation] = useState("eastus");
  const [versions, setVersions] = useState<TemplateVersion[]>([]);
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [parameters, setParameters] = useState<Record<string, TemplateParameter>>({});
  const [variables, setVariables] = useState<Record<string, TemplateVariable>>({});
  const [codeExpanded, setCodeExpanded] = useState(true);
  const [paramsExpanded, setParamsExpanded] = useState(true);
  const [showPasswordValues, setShowPasswordValues] = useState<Record<string, boolean>>({});
  const [deploymentInProgress, setDeploymentInProgress] = useState(false);
  
  // New state for dynamic dropdowns
  const [locations, setLocations] = useState<any[]>([]);
  const [resourceGroups, setResourceGroups] = useState<any[]>([]);
  const [useExistingResourceGroup, setUseExistingResourceGroup] = useState(false);
  const [selectedResourceGroup, setSelectedResourceGroup] = useState("");
  const [loadingLocations, setLoadingLocations] = useState(false);
  const [loadingResourceGroups, setLoadingResourceGroups] = useState(false);
  const [cloudAccounts, setCloudAccounts] = useState<any[]>([]);
  const [selectedEnvironment, setSelectedEnvironment] = useState<string>("");
  const [selectedCloudAccount, setSelectedCloudAccount] = useState<string>("");
  const [availableCloudAccounts, setAvailableCloudAccounts] = useState<any[]>([]);
  const [selectedSubscription, setSelectedSubscription] = useState<string>("");
  const [availableSubscriptions, setAvailableSubscriptions] = useState<string[]>([]);
  
  // AI Assistant state
  const [aiChatMessages, setAiChatMessages] = useState<AIChatMessage[]>([
    { role: "system", content: "You are an AI assistant that helps with understanding and modifying cloud templates. You have knowledge about Azure, AWS, and GCP resources and infrastructure as code." },
    { role: "assistant", content: "Hello! I can help you understand and modify this template. What would you like to know?" }
  ]);
  const [aiMessage, setAiMessage] = useState("");
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiExpanded, setAiExpanded] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const { isConfigured, config } = useAzureOpenAI();
  const aiAssistantService = new AIAssistantService();
  
  const fetchCloudAccounts = async () => {
    try {
      if (currentTenant?.tenant_id) {
        const accounts = await deploymentService.getCloudAccounts(currentTenant.tenant_id);
        setCloudAccounts(accounts);
      }
    } catch (err) {
      console.error("Error fetching cloud accounts:", err);
    }
  };
  
  const handleEnvironmentChange = (environmentId: string) => {
    console.log("handleEnvironmentChange - environmentId:", environmentId);
    
    setSelectedEnvironment(environmentId);
    setSelectedCloudAccount(""); // Reset cloud account selection
    setSelectedResourceGroup(""); // Reset resource group selection
    setLocation(""); // Reset location
    setSelectedSubscription(""); // Reset subscription selection
    setAvailableSubscriptions([]); // Reset available subscriptions
    
    // Find the environment and set available cloud accounts
    const environment = environments.find(env => env.id === environmentId);
    console.log("handleEnvironmentChange - environment:", environment);
    
    if (environment && environment.cloud_accounts) {
      console.log("handleEnvironmentChange - cloud_accounts:", environment.cloud_accounts);
      setAvailableCloudAccounts(environment.cloud_accounts);
      
      // If there's only one cloud account, auto-select it
      if (environment.cloud_accounts.length === 1) {
        console.log("handleEnvironmentChange - auto-selecting single cloud account:", environment.cloud_accounts[0]);
        const accountId = environment.cloud_accounts[0].id;
        setSelectedCloudAccount(accountId);
        
        // Also trigger the cloud account change logic
        const account = environment.cloud_accounts[0];
        if (account && account.cloud_ids) {
          console.log("handleEnvironmentChange - auto-selected account cloud_ids:", account.cloud_ids);
          setAvailableSubscriptions(account.cloud_ids);
          
          // If there's only one subscription, auto-select it too
          if (account.cloud_ids.length === 1) {
            const subscriptionId = account.cloud_ids[0];
            setSelectedSubscription(subscriptionId);
            // Fetch data for the auto-selected subscription
            fetchLocationsForAccount(accountId, subscriptionId);
            fetchResourceGroupsForAccount(accountId, subscriptionId);
          }
        }
      }
    } else {
      console.log("handleEnvironmentChange - no cloud accounts found");
      setAvailableCloudAccounts([]);
    }
  };
  
  const handleCloudAccountChange = (accountId: string) => {
    console.log("handleCloudAccountChange - accountId:", accountId);
    console.log("handleCloudAccountChange - availableCloudAccounts:", availableCloudAccounts);
    
    setSelectedCloudAccount(accountId);
    setSelectedResourceGroup(""); // Reset resource group selection
    setLocation(""); // Reset location
    setSelectedSubscription(""); // Reset subscription selection
    
    // Find the selected cloud account and set available subscriptions
    const account = availableCloudAccounts.find(acc => acc.id === accountId);
    console.log("handleCloudAccountChange - found account:", account);
    
    if (account && account.cloud_ids) {
      console.log("handleCloudAccountChange - cloud_ids:", account.cloud_ids);
      setAvailableSubscriptions(account.cloud_ids);
      
      // If there's only one subscription, auto-select it and fetch data
      if (account.cloud_ids.length === 1) {
        const subscriptionId = account.cloud_ids[0];
        setSelectedSubscription(subscriptionId);
        // Fetch data for the auto-selected subscription
        fetchLocationsForAccount(accountId, subscriptionId);
        fetchResourceGroupsForAccount(accountId, subscriptionId);
      }
    } else {
      console.log("handleCloudAccountChange - no cloud_ids found, setting empty array");
      setAvailableSubscriptions([]);
    }
  };
  
  const handleSubscriptionChange = (subscriptionId: string) => {
    setSelectedSubscription(subscriptionId);
    setSelectedResourceGroup(""); // Reset resource group selection
    setLocation(""); // Reset location
    
    // Fetch locations and resource groups for this subscription
    if (selectedCloudAccount) {
      fetchLocationsForAccount(selectedCloudAccount, subscriptionId);
      fetchResourceGroupsForAccount(selectedCloudAccount, subscriptionId);
    }
  };
  
  const fetchLocationsForAccount = async (accountId: string, subscriptionId?: string) => {
    try {
      setLoadingLocations(true);
      // Find the settings_id for the selected cloud account
      const account = availableCloudAccounts.find(acc => acc.id === accountId);
      const settingsId = account?.settings_id;
      
      console.log("fetchLocationsForAccount - accountId:", accountId);
      console.log("fetchLocationsForAccount - account:", account);
      console.log("fetchLocationsForAccount - settingsId:", settingsId);
      console.log("fetchLocationsForAccount - subscriptionId:", subscriptionId);
      console.log("fetchLocationsForAccount - tenantId:", currentTenant?.tenant_id);
      
      const response = await deploymentService.getSubscriptionLocations(currentTenant?.tenant_id, settingsId, subscriptionId);
      if (response && response.locations) {
        setLocations(response.locations);
      }
    } catch (err) {
      console.error("Error fetching locations:", err);
      toast.error("Failed to load locations");
    } finally {
      setLoadingLocations(false);
    }
  };
  
  const fetchResourceGroupsForAccount = async (accountId: string, subscriptionId?: string) => {
    try {
      setLoadingResourceGroups(true);
      // Find the settings_id for the selected cloud account
      const account = availableCloudAccounts.find(acc => acc.id === accountId);
      const settingsId = account?.settings_id;
      
      console.log("fetchResourceGroupsForAccount - accountId:", accountId);
      console.log("fetchResourceGroupsForAccount - account:", account);
      console.log("fetchResourceGroupsForAccount - settingsId:", settingsId);
      console.log("fetchResourceGroupsForAccount - subscriptionId:", subscriptionId);
      console.log("fetchResourceGroupsForAccount - tenantId:", currentTenant?.tenant_id);
      
      const query = "resourcecontainers | where type =~ 'microsoft.resources/subscriptions/resourcegroups' | project name, resourceGroup, location";
      const response = await deploymentService.queryResourceGraph(query, currentTenant?.tenant_id, settingsId, subscriptionId);
      if (response && response.data) {
        // Map location names to display names using the locations data
        const enrichedResourceGroups = response.data.map((rg: any) => {
          const locationInfo = locations.find(loc => loc.name === rg.location);
          return {
            ...rg,
            locationDisplayName: locationInfo?.display_name || rg.location
          };
        });
        console.log("fetchResourceGroupsForAccount - locations available:", locations.length);
        console.log("fetchResourceGroupsForAccount - sample enriched RG:", enrichedResourceGroups[0]);
        setResourceGroups(enrichedResourceGroups);
      }
    } catch (err) {
      console.error("Error fetching resource groups:", err);
      toast.error("Failed to load resource groups");
    } finally {
      setLoadingResourceGroups(false);
    }
  };
  
  const handleResourceGroupChange = (resourceGroupName: string) => {
    setSelectedResourceGroup(resourceGroupName);
    
    // Find the selected resource group and update location
    const selectedRG = resourceGroups.find(rg => rg.name === resourceGroupName);
    if (selectedRG) {
      console.log("Setting location from resource group:", selectedRG.location);
      console.log("Available locations:", locations.map(loc => loc.name));
      setLocation(selectedRG.location);
    }
  };
  
  const fetchVersions = async (templateId: string) => {
    try {
      setLoadingVersions(true);
      const response = await fetch(`http://localhost:8000/api/templates/${templateId}/versions`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setVersions(data);
      } else {
        console.error("Failed to fetch template versions");
      }
    } catch (err) {
      console.error("Error fetching template versions:", err);
    } finally {
      setLoadingVersions(false);
    }
  };
  
  const fetchEnvironments = async () => {
    try {
      setLoadingEnvironments(true);
      const response = await fetch(`http://localhost:8000/api/environments/?tenant_id=${currentTenant?.tenant_id || ''}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log("fetchEnvironments - API response:", data);
        setEnvironments(data);
      } else {
        console.error("Failed to fetch environments");
      }
    } catch (err) {
      console.error("Error fetching environments:", err);
    } finally {
      setLoadingEnvironments(false);
    }
  };
  
  useEffect(() => {
    if (templateId) {
      fetchTemplate(templateId);
      fetchVersions(templateId);
      fetchEnvironments();
    }
  }, [templateId]);
  
  useEffect(() => {
    if (deployDialogOpen) {
      fetchCloudAccounts();
    }
  }, [deployDialogOpen]);
  
  useEffect(() => {
    if (selectedCloudAccount && selectedSubscription) {
      fetchLocationsForAccount(selectedCloudAccount, selectedSubscription);
      fetchResourceGroupsForAccount(selectedCloudAccount, selectedSubscription);
    }
  }, [selectedCloudAccount, selectedSubscription]);
  
  // Re-enrich resource groups when locations are loaded
  useEffect(() => {
    if (locations.length > 0 && resourceGroups.length > 0) {
      // Check if resource groups need enrichment (either no locationDisplayName or it equals the raw location)
      const needsEnrichment = resourceGroups.some((rg: any) => 
        !rg.locationDisplayName || rg.locationDisplayName === rg.location
      );
      console.log("Re-enrichment check - locations:", locations.length, "resourceGroups:", resourceGroups.length, "needsEnrichment:", needsEnrichment);
      if (needsEnrichment) {
        const enrichedResourceGroups = resourceGroups.map((rg: any) => {
          const locationInfo = locations.find(loc => loc.name === rg.location);
          return {
            ...rg,
            locationDisplayName: locationInfo?.display_name || rg.location
          };
        });
        console.log("Re-enriching resource groups - sample:", enrichedResourceGroups[0]);
        setResourceGroups(enrichedResourceGroups);
      }
    }
  }, [locations]);

  const fetchTemplate = async (templateId: string) => {
    try {
      setLoading(true);
      const templateData = await cmpService.getTemplate(templateId);
      
      if (templateData) {
        setTemplate(templateData);
        setCode(templateData.code || "");
        
        // Initialize parameters and variables from template data
        if (templateData.parameters) {
          console.log("Loading parameters from template:", templateData.parameters);
          setParameters(templateData.parameters);
        } else {
          console.log("No parameters found in template data");
          setParameters({});
        }
        
        if (templateData.variables) {
          console.log("Loading variables from template:", templateData.variables);
          setVariables(templateData.variables);
        } else {
          console.log("No variables found in template data");
          setVariables({});
        }
        
        // Fetch template versions
        await fetchVersions(templateId);
        
        // Fetch environments
        await fetchEnvironments();
        
        // Set default deployment name
        if (templateData.name) {
          setDeployName(`${templateData.name}-deployment`);
        }
      } else {
        setError("Template not found");
      }
    } catch (err) {
      console.error("Error fetching template:", err);
      setError("Failed to load template details");
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [aiChatMessages]);

  
  const handleSaveTemplate = async () => {
    if (!template) return;
    
    try {
      // Check if the code has changed - only create a new version if code has changed
      const codeHasChanged = code !== template.code;
      
      const updatedTemplate = await cmpService.updateTemplate(template.id, {
        ...template,
        code: code,
        parameters: parameters,
        variables: variables,
        // Add a flag to indicate if this should create a new version
        create_new_version: codeHasChanged
      });
      
      if (updatedTemplate) {
        setTemplate(updatedTemplate);
        
        if (codeHasChanged) {
          toast.success("Template saved successfully and new version created");
        } else {
          toast.success("Template parameters and variables saved successfully");
        }
        
        // Refresh versions after save if code has changed
        if (templateId && codeHasChanged) {
          await fetchVersions(templateId);
        }
      }
    } catch (err) {
      console.error("Error saving template:", err);
      toast.error("Failed to save template");
    }
  };

  const handleSaveCodeWithNewVersion = async () => {
    if (!template) return;
    
    try {
      const updatedTemplate = await cmpService.updateTemplate(template.id, {
        ...template,
        code: code,
        // Always create a new version when using this function
        create_new_version: true
      });
      
      if (updatedTemplate) {
        setTemplate(updatedTemplate);
        toast.success("New template version created successfully");
        
        // Refresh versions
        if (templateId) {
          await fetchVersions(templateId);
        }
      }
    } catch (error) {
      console.error("Error creating new template version:", error);
      toast.error("Failed to create new template version");
    }
  };

  const handleSaveParamsAndVariables = async () => {
    if (!template) return;
    
    try {
      const updatedTemplate = await cmpService.updateTemplate(template.id, {
        ...template,
        parameters: parameters,
        variables: variables,
        // Never create a new version when using this function
        create_new_version: false
      });
      
      if (updatedTemplate) {
        setTemplate(updatedTemplate);
        toast.success("Template parameters and variables saved successfully");
      }
    } catch (err) {
      console.error("Error saving template parameters and variables:", err);
      toast.error("Failed to save template parameters and variables");
    }
  };
  
  const handleDeployTemplate = async () => {
    if (!template || !selectedEnvironment || !selectedCloudAccount || !selectedSubscription || !deployName) {
      toast.error("Please provide all required deployment information");
      return;
    }
    
    // Validate resource group and location based on selection
    if (useExistingResourceGroup && !selectedResourceGroup) {
      toast.error("Please select a resource group");
      return;
    }
    
    if (!useExistingResourceGroup && (!resourceGroup || !location)) {
      toast.error("Please provide resource group name and location");
      return;
    }
    
    try {
      setDeploymentInProgress(true);
      
      // Find the selected environment to get its name and environment_id
      const environment = environments.find(env => env.id === selectedEnvironment);
      if (!environment) {
        toast.error("Selected environment not found");
        setDeploymentInProgress(false);
        return;
      }
      
      // Map ARM template type to 'native' for the backend
      const backendDeploymentType = template.type === 'arm' ? 'native' : template.type;
      
      // Ensure template code is a string, not undefined or null
      const templateCode = template.code || "";
      
      // Prepare the deployment data
      const deploymentData = {
        name: deployName,
        description: `Deployment of ${template.name}`,
        template_id: template.id, // Use the GUID template_id instead of the numeric id
        environment_id: environment.internal_id, // Use the internal_id from the environment
        environment_name: environment.name,
        cloud_account_id: selectedCloudAccount, // Add the selected cloud account
        subscription_id: selectedSubscription, // Add the selected subscription
        provider: template.provider,
        deployment_type: backendDeploymentType,
        template_source: "code",
        template_code: templateCode,
        parameters: parameters || {},
        template_version: template.currentVersion, // Add the template version to the deployment data
        resource_group: useExistingResourceGroup ? selectedResourceGroup : resourceGroup, // Use selected or new resource group
        location: location || undefined // Add location if provided
      };
      
      console.log("Deployment data:", JSON.stringify(deploymentData));
      
      // Use the deployment service to create the deployment
      const deploymentResponse = await deploymentService.createDeployment(deploymentData, currentTenant?.tenant_id || "");
      
      toast.success(`Deployment "${deployName}" has been submitted successfully`, {
        description: "You will be redirected to the deployments page to monitor progress.",
        action: {
          label: "View Deployments",
          onClick: () => navigate("/deployments")
        },
        duration: 5000
      });
      
      // Keep the dialog open for a moment to show the success state
      setTimeout(() => {
        setDeployDialogOpen(false);
        setDeploymentInProgress(false);
        navigate("/deployments");
      }, 2000);
    } catch (error) {
      console.error("Error deploying template:", error);
      setDeploymentInProgress(false);
      
      if (error instanceof Error) {
        toast.error(`Deployment failed: ${error.message}`);
      } else {
        toast.error("Failed to deploy template");
      }
    }
  };
  
  const handleAiSend = async () => {
    if (!aiMessage.trim()) return;
    
    // Add user message to chat
    const userMessage: AIChatMessage = { role: "user", content: aiMessage };
    setAiChatMessages(prev => [...prev, userMessage]);
    setAiMessage("");
    setIsAiLoading(true);
    
    try {
      // Prepare template data for context
      const templateData = template ? {
        id: template.id,
        name: template.name,
        description: template.description,
        type: template.type,
        provider: template.provider,
        code: code,
        parameters: parameters,
        variables: variables
      } : null;
      
      // Use streaming API for better user experience
      const abortController = aiAssistantService.streamChat(
        {
          messages: [...aiChatMessages.filter(msg => msg.role !== "system"), userMessage],
          template_data: templateData,
          temperature: 0.7
        },
        (content) => {
          // Update the streaming message
          setAiChatMessages(prev => {
            const newMessages = [...prev];
            const lastMessage = newMessages[newMessages.length - 1];
            
            // If the last message is from the assistant and is streaming, update it
            if (lastMessage && lastMessage.role === "assistant") {
              newMessages[newMessages.length - 1] = {
                ...lastMessage,
                content: lastMessage.content + content
              };
            } else {
              // Otherwise, add a new message
              newMessages.push({
                role: "assistant",
                content: content
              });
            }
            
            return newMessages;
          });
        },
        (error) => {
          console.error("Error in AI streaming:", error);
          toast.error("Error getting AI response");
          
          // Add error message to chat
          setAiChatMessages(prev => [...prev, { 
            role: "assistant", 
            content: "I'm sorry, I encountered an error while processing your request. Please try again later." 
          }]);
          
          setIsAiLoading(false);
        },
        () => {
          // Streaming completed
          setIsAiLoading(false);
        }
      );
      
      // Store the abort controller for cleanup
      return () => {
        if (abortController) {
          abortController();
        }
      };
    } catch (error) {
      console.error("Error getting AI response:", error);
      toast.error("Failed to get AI response");
      
      // Add error message to chat
      setAiChatMessages(prev => [...prev, { 
        role: "assistant", 
        content: "I'm sorry, I encountered an error while processing your request. Please try again later." 
      }]);
      
      setIsAiLoading(false);
    }
  };
  
  const handleRestoreVersion = async (version: TemplateVersion) => {
    if (!template || !templateId) return;
    
    try {
      // Fetch the version's code
      const response = await fetch(`http://localhost:8000/api/templates/${templateId}/versions/${version.id}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        const versionData = await response.json();
        
        // Update the template with this version's code
        const updatedTemplate = await cmpService.updateTemplate(template.id, {
          ...template,
          code: versionData.code
        });
        
        if (updatedTemplate) {
          setTemplate(updatedTemplate);
          setCode(updatedTemplate.code || "");
          toast.success(`Restored to version ${version.version}`);
          
          // Refresh versions
          await fetchVersions(templateId);
        }
      } else {
        toast.error("Failed to restore version");
      }
    } catch (err) {
      console.error("Error restoring version:", err);
      toast.error("Failed to restore version");
    }
  };
  
  const addParameter = () => {
    const newKey = `param${Object.keys(parameters).length + 1}`;
    setParameters({
      ...parameters,
      [newKey]: {
        value: "",
        type: "string"
      }
    });
  };
  
  const removeParameter = (key: string) => {
    const newParams = { ...parameters };
    delete newParams[key];
    setParameters(newParams);
  };
  
  const updateParameter = (key: string, field: keyof TemplateParameter, value: string) => {
    setParameters({
      ...parameters,
      [key]: {
        ...parameters[key],
        [field]: value
      }
    });
  };
  
  const renameParameter = (oldKey: string, newKey: string) => {
    if (oldKey === newKey) return;
    
    // Check if the new key already exists
    if (parameters[newKey]) {
      toast.error(`Parameter with name "${newKey}" already exists`);
      return;
    }
    
    const newParams = { ...parameters };
    newParams[newKey] = newParams[oldKey];
    delete newParams[oldKey];
    setParameters(newParams);
  };
  
  const addVariable = () => {
    const newKey = `var${Object.keys(variables).length + 1}`;
    setVariables({
      ...variables,
      [newKey]: {
        value: "",
        type: "string"
      }
    });
  };
  
  const removeVariable = (key: string) => {
    const newVars = { ...variables };
    delete newVars[key];
    setVariables(newVars);
  };
  
  const updateVariable = (key: string, field: keyof TemplateVariable, value: string) => {
    setVariables({
      ...variables,
      [key]: {
        ...variables[key],
        [field]: value
      }
    });
  };
  
  const renameVariable = (oldKey: string, newKey: string) => {
    if (oldKey === newKey) return;
    
    // Check if the new key already exists
    if (variables[newKey]) {
      toast.error(`Variable with name "${newKey}" already exists`);
      return;
    }
    
    const newVars = { ...variables };
    newVars[newKey] = newVars[oldKey];
    delete newVars[oldKey];
    setVariables(newVars);
  };
  
  const togglePasswordVisibility = (key: string) => {
    setShowPasswordValues({
      ...showPasswordValues,
      [key]: !showPasswordValues[key]
    });
  };
  
  const providerColor = (provider: string) => {
    switch (provider) {
      case "azure": return "bg-cloud-azure text-white";
      case "aws": return "bg-cloud-aws text-black";
      case "gcp": return "bg-cloud-gcp text-white";
      default: return "bg-muted text-muted-foreground";
    }
  };
  
  if (loading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <div className="text-center">
          <h2 className="text-xl font-semibold">Loading template...</h2>
        </div>
      </div>
    );
  }

  if (error || !template) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <div className="text-center">
          <h2 className="text-xl font-semibold">Template not found</h2>
          <p className="text-muted-foreground">{error || "The requested template does not exist"}</p>
          <Button 
            variant="outline" 
            className="mt-4"
            onClick={() => navigate("/catalog")}
          >
            <ChevronLeft className="mr-2 h-4 w-4" />
            Back to Catalog
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <Button style={{ backgroundColor: "#FF5100" }} onClick={() => navigate(-1)}>
          <ChevronLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <div className="space-x-2">
          <Button style={{ backgroundColor: "#FF5100" }} onClick={() => setDeployDialogOpen(true)}>
            <Play className="mr-2 h-4 w-4" />
            Deploy Template
          </Button>
        </div>
      </div>
      
      {/* Add back the Dialog component for deployment */}
      <DeploymentWizard
        open={deployDialogOpen}
        onOpenChange={setDeployDialogOpen}
        onDeploy={handleDeployTemplate}
        deploymentInProgress={deploymentInProgress}
        
        // Step 1 - Environment & Cloud Selection
        environments={environments}
        selectedEnvironment={selectedEnvironment}
        onEnvironmentChange={handleEnvironmentChange}
        availableCloudAccounts={availableCloudAccounts}
        selectedCloudAccount={selectedCloudAccount}
        onCloudAccountChange={handleCloudAccountChange}
        availableSubscriptions={availableSubscriptions}
        selectedSubscription={selectedSubscription}
        onSubscriptionChange={handleSubscriptionChange}
        
        // Step 2 - Resource Configuration
        useExistingResourceGroup={useExistingResourceGroup}
        onUseExistingResourceGroupChange={setUseExistingResourceGroup}
        resourceGroups={resourceGroups}
        selectedResourceGroup={selectedResourceGroup}
        onResourceGroupChange={handleResourceGroupChange}
        resourceGroup={resourceGroup}
        onResourceGroupNameChange={setResourceGroup}
        loadingResourceGroups={loadingResourceGroups}
        onRefreshResourceGroups={() => fetchResourceGroupsForAccount(selectedCloudAccount, selectedSubscription)}
        locations={locations}
        location={location}
        onLocationChange={setLocation}
        loadingLocations={loadingLocations}
        parameters={parameters}
        onParameterChange={updateParameter}
        showPasswordValues={showPasswordValues}
        onTogglePasswordVisibility={togglePasswordVisibility}
        
        // Step 3 - Approval Details
        deployName={deployName}
        onDeployNameChange={setDeployName}
      />
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <Collapsible open={codeExpanded} onOpenChange={setCodeExpanded}>
            <Card>
              <CardHeader className="pb-3">
                <div className="flex justify-between items-center">
                  <CardTitle className="flex items-center">
                    <FileEdit className="mr-2 h-5 w-5" />
                    Template Code
                  </CardTitle>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm">
                      {codeExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>
                  </CollapsibleTrigger>
                </div>
              </CardHeader>
              <CollapsibleContent>
                <CardContent>
                  <div className="space-y-4">
                    <div className="relative">
                      <Textarea
                        value={code}
                        onChange={(e) => setCode(e.target.value)}
                        className="font-mono h-[400px] resize-none"
                      />
                    </div>
                    <div className="flex justify-end">
                      <Button onClick={handleSaveCodeWithNewVersion}>
                        <Save className="mr-2 h-4 w-4" />
                        Create New Version
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
          
          <Collapsible open={paramsExpanded} onOpenChange={setParamsExpanded}>
            <Card>
              <CardHeader className="pb-3">
                <div className="flex justify-between items-center">
                  <CardTitle className="flex items-center">
                    <FileEdit className="mr-2 h-5 w-5" />
                    Parameters & Variables
                  </CardTitle>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm">
                      {paramsExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>
                  </CollapsibleTrigger>
                </div>
              </CardHeader>
              <CollapsibleContent>
                <CardContent>
                  <div className="space-y-6">
                    {/* Parameters section */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-medium">Parameters</h3>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={addParameter}
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          Add Parameter
                        </Button>
                      </div>
                      
                      {Object.keys(parameters).length === 0 ? (
                        <div className="text-sm text-muted-foreground">
                          No parameters defined. Click "Add Parameter" to create one.
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {Object.entries(parameters).map(([key, param]) => (
                            <div key={key} className="grid grid-cols-12 gap-2 items-start">
                              <div className="col-span-3">
                                <Label>Name</Label>
                                <Input 
                                  value={key}
                                  onChange={(e) => renameParameter(key, e.target.value)}
                                />
                              </div>
                              <div className="col-span-3">
                                <Label>Type</Label>
                                <Select 
                                  value={param.type} 
                                  onValueChange={(value) => updateParameter(key, "type", value)}
                                >
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="string">String</SelectItem>
                                    <SelectItem value="int">Integer</SelectItem>
                                    <SelectItem value="password">Password</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="col-span-4">
                                <Label>Value</Label>
                                {param.type === "password" ? (
                                  <div className="relative">
                                    <Input 
                                      type={showPasswordValues[key] ? "text" : "password"}
                                      value={param.value}
                                      onChange={(e) => updateParameter(key, "value", e.target.value)}
                                      className="pr-8"
                                    />
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="absolute right-0 top-0 h-full"
                                      onClick={() => togglePasswordVisibility(key)}
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
                                    onChange={(e) => updateParameter(key, "value", e.target.value)}
                                  />
                                )}
                              </div>
                              <div className="col-span-1 pt-6">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => removeParameter(key)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    
                    {/* Variables section */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-medium">Variables</h3>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={addVariable}
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          Add Variable
                        </Button>
                      </div>
                      
                      {Object.keys(variables).length === 0 ? (
                        <div className="text-sm text-muted-foreground">
                          No variables defined. Click "Add Variable" to create one.
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {Object.entries(variables).map(([key, variable]) => (
                            <div key={key} className="grid grid-cols-12 gap-2 items-start">
                              <div className="col-span-3">
                                <Label>Name</Label>
                                <Input 
                                  value={key}
                                  onChange={(e) => renameVariable(key, e.target.value)}
                                />
                              </div>
                              <div className="col-span-3">
                                <Label>Type</Label>
                                <Select 
                                  value={variable.type} 
                                  onValueChange={(value) => updateVariable(key, "type", value)}
                                >
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="string">String</SelectItem>
                                    <SelectItem value="int">Integer</SelectItem>
                                    <SelectItem value="password">Password</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="col-span-4">
                                <Label>Value</Label>
                                {variable.type === "password" ? (
                                  <div className="relative">
                                    <Input 
                                      type={showPasswordValues[key] ? "text" : "password"}
                                      value={variable.value}
                                      onChange={(e) => updateVariable(key, "value", e.target.value)}
                                      className="pr-8"
                                    />
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="absolute right-0 top-0 h-full"
                                      onClick={() => togglePasswordVisibility(key)}
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
                                    type={variable.type === "int" ? "number" : "text"}
                                    value={variable.value}
                                    onChange={(e) => updateVariable(key, "value", e.target.value)}
                                  />
                                )}
                              </div>
                              <div className="col-span-1 pt-6">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => removeVariable(key)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    
                    {/* At the end of the parameters and variables section, add a save button */}
                    <div className="flex justify-end">
                      <Button onClick={handleSaveParamsAndVariables}>
                        <Save className="mr-2 h-4 w-4" />
                        Save Parameters & Variables
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        </div>
        
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Template Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Provider</p>
                  <p className="font-medium">{template.provider.toUpperCase()}</p>
                </div>
                
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Type</p>
                  <p className="font-medium">
                    {template.type === "terraform" ? "Terraform" : 
                     template.type === "arm" ? "ARM Template" : "CloudFormation"}
                  </p>
                </div>
                
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Deployments</p>
                  <p className="font-medium">{template.deploymentCount}</p>
                </div>
                
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Created</p>
                  <p className="font-medium">
                    {new Date(template.uploadedAt).toLocaleDateString()}
                  </p>
                </div>
                
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Last Updated</p>
                  <p className="font-medium">
                    {new Date(template.updatedAt).toLocaleDateString()}
                  </p>
                </div>
                
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Last Updated By</p>
                  <p className="font-medium">
                    {template.lastUpdatedBy || "Unknown"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <History className="mr-2 h-5 w-5" />
                Version History
              </CardTitle>
            </CardHeader>
            <CardContent className="p-2 pt-0">
              <div className="h-[200px] overflow-auto">
              {loadingVersions ? (
                <div className="text-center py-4">
                  <p>Loading versions...</p>
                </div>
              ) : versions.length === 0 ? (
                <div className="text-center py-4">
                  <p className="text-muted-foreground">No version history available</p>
                </div>
              ) : (
                <div className="space-y-4" style={{ padding: "0px 20px 0px 0px"}}>
                  {versions.map((version) => (
                    <div key={version.id} className="flex justify-between items-center">
                      <div>
                        <p className="text-sm font-medium">Version {version.version}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(version.created_at).toLocaleString()}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {version.changes}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          By: {version.created_by}
                        </p>
                      </div>
                      {version.is_current ? (
                        <Badge>Current</Badge>
                      ) : (
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleRestoreVersion(version)}
                        >
                          Restore
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
              </div>
            </CardContent>
          </Card>
          
          <Card className={`${aiExpanded ? "fixed inset-4 z-50 overflow-hidden flex flex-col" : ""}`}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center">
                  <MessagesSquare className="mr-2 h-5 w-5" />
                  AI Assistant
                </CardTitle>
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={() => setAiExpanded(!aiExpanded)}
                >
                  {aiExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                </Button>
              </div>
              <CardDescription>
                Ask questions about this template, request explanations, or suggest modifications.
              </CardDescription>
            </CardHeader>
            <CardContent className={`space-y-4 ${aiExpanded ? "flex-grow overflow-hidden flex flex-col" : ""}`}>
              <ScrollArea className={`rounded-md ${aiExpanded ? "flex-grow" : "h-[300px]"}`}>
                <div className="space-y-4 p-1">
                  {aiChatMessages.filter(msg => msg.role !== "system").map((message, index) => (
                    <div 
                      key={index} 
                      className={`${
                        message.role === "assistant" 
                          ? "bg-primary/10 p-3 rounded-lg rounded-tl-none max-w-[80%]" 
                          : "flex justify-end"
                      }`}
                    >
                      {message.role === "assistant" ? (
                        <div className="text-sm prose prose-sm max-w-none dark:prose-invert">
                          <ReactMarkdown
                            components={{
                              // Customize code blocks
                              code: ({ node, inline, className, children, ...props }) => {
                                if (inline) {
                                  return (
                                    <code className="bg-muted px-1 py-0.5 rounded text-sm font-mono" {...props}>
                                      {children}
                                    </code>
                                  );
                                }
                                return (
                                  <pre className="bg-muted p-3 rounded-md overflow-x-auto">
                                    <code className={className} {...props}>
                                      {children}
                                    </code>
                                  </pre>
                                );
                              },
                              // Customize links
                              a: ({ href, children, ...props }) => (
                                <a 
                                  href={href} 
                                  target="_blank" 
                                  rel="noopener noreferrer" 
                                  className="text-primary hover:underline"
                                  {...props}
                                >
                                  {children}
                                </a>
                              ),
                              // Customize paragraphs to remove default margins
                              p: ({ children, ...props }) => (
                                <p className="mb-2 last:mb-0" {...props}>
                                  {children}
                                </p>
                              ),
                              // Customize lists
                              ul: ({ children, ...props }) => (
                                <ul className="list-disc pl-4 mb-2" {...props}>
                                  {children}
                                </ul>
                              ),
                              ol: ({ children, ...props }) => (
                                <ol className="list-decimal pl-4 mb-2" {...props}>
                                  {children}
                                </ol>
                              ),
                            }}
                          >
                            {message.content}
                          </ReactMarkdown>
                        </div>
                      ) : (
                        <div className="bg-primary text-primary-foreground p-3 rounded-lg rounded-tr-none max-w-[80%]">
                          <p className="text-sm">{message.content}</p>
                        </div>
                      )}
                    </div>
                  ))}
                  {isAiLoading && (
                    <div className="bg-primary/10 p-3 rounded-lg rounded-tl-none max-w-[80%]">
                      <div className="flex items-center space-x-2">
                        <div className="h-2 w-2 bg-primary/50 rounded-full animate-bounce"></div>
                        <div className="h-2 w-2 bg-primary/50 rounded-full animate-bounce delay-100"></div>
                        <div className="h-2 w-2 bg-primary/50 rounded-full animate-bounce delay-200"></div>
                      </div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>
              </ScrollArea>
              
              <div className="flex space-x-2">
                <Input 
                  placeholder="Ask a question about this template..."
                  value={aiMessage}
                  onChange={(e) => setAiMessage(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAiSend()}
                  disabled={isAiLoading}
                />
                <Button 
                  onClick={handleAiSend}
                  disabled={isAiLoading || !aiMessage.trim()}
                >
                  {isAiLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send"}
                </Button>
              </div>
              
              <p className="text-xs text-muted-foreground">
                {!isConfigured ? 
                  "Note: Azure OpenAI is not configured. Configure it in Settings for enhanced AI capabilities." :
                  "Ask questions about this template, request explanations, or suggest modifications."}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default TemplateDetails;
