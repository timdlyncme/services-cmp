
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/context/auth-context";

import { AppLayout } from "@/components/app-layout";
import Dashboard from "@/pages/Dashboard";
import Catalog from "@/pages/Catalog";
import TemplateDetails from "@/pages/TemplateDetails";
import Deployments from "@/pages/Deployments";
import DeploymentDetails from "@/pages/DeploymentDetails";
import Settings from "@/pages/Settings";
import Tenants from "@/pages/Tenants";
import TenantTemplateFoundry from "@/pages/TenantTemplateFoundry";
import MSPTemplateFoundry from "@/pages/MSPTemplateFoundry";
import Environments from "@/pages/Environments";
import UsersAndGroups from "@/pages/UsersAndGroups";
import CloudAccounts from "@/pages/CloudAccounts";
import NexusAI from "@/pages/NexusAI";
import Login from "@/pages/Login";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            
            <Route element={<AppLayout />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/catalog" element={<Catalog />} />
              <Route path="/catalog/:templateId" element={<TemplateDetails />} />
              <Route path="/deployments" element={<Deployments />} />
              <Route path="/deployments/:deploymentId" element={<DeploymentDetails />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/tenants" element={<Tenants />} />
              <Route path="/template-foundry" element={<TenantTemplateFoundry />} />
              <Route path="/msp-template-foundry" element={<MSPTemplateFoundry />} />
              <Route path="/environments" element={<Environments />} />
              <Route path="/users-and-groups" element={<UsersAndGroups />} />
              <Route path="/cloud-accounts" element={<CloudAccounts />} />
              <Route path="/nexus-ai" element={<NexusAI />} />
            </Route>
            
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
