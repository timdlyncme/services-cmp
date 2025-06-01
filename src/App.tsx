import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/context/auth-context";
import { AzureOpenAIProvider } from "@/contexts/AzureOpenAIContext";

import { AppLayout } from "@/components/app-layout";
import { ProtectedRoute } from "@/components/protected-route";
import EnhancedDashboard from "@/pages/EnhancedDashboard";
import Catalog from "@/pages/Catalog";
import TemplateDetails from "@/pages/TemplateDetails";
import Approvals from "@/pages/Approvals";
import ApprovalDetails from "@/pages/ApprovalDetails";
import Deployments from "@/pages/Deployments";
import DeploymentDetails from "@/pages/DeploymentDetails";
import ResourceDetails from "@/pages/ResourceDetails";
import Settings from "@/pages/Settings";
import Tenants from "@/pages/Tenants";
import TemplateManagement from "@/pages/TemplateManagement";
import MSPTemplateFoundry from "@/pages/MSPTemplateFoundry";
import Environments from "@/pages/Environments";
import EnvironmentDetails from "@/pages/EnvironmentDetails";
import UsersAndGroups from "@/pages/UsersAndGroups";
import CloudAccounts from "@/pages/CloudAccounts";
import NexusAI from "@/pages/NexusAI";
import Login from "@/pages/Login";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <AzureOpenAIProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<Login />} />
              
              <Route element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }>
                <Route path="/" element={<EnhancedDashboard />} />
                <Route path="/catalog" element={<Catalog />} />
                <Route path="/catalog/:templateId" element={<TemplateDetails />} />
                <Route path="/approvals" element={<Approvals />} />
                <Route path="/approvals/:approvalId" element={<ApprovalDetails />} />
                <Route path="/deployments" element={<Deployments />} />
                <Route path="/deployments/:deploymentId" element={<DeploymentDetails />} />
                <Route path="/deployments/:deploymentId/resources/:resourceId" element={<ResourceDetails />} />
                <Route path="/settings" element={
                  <ProtectedRoute requiredPermission="view:settings">
                    <Settings />
                  </ProtectedRoute>
                } />
                <Route path="/tenants" element={
                  <ProtectedRoute requiredPermission="view:tenants">
                    <Tenants />
                  </ProtectedRoute>
                } />
                <Route path="/template-management" element={
                  <ProtectedRoute requiredPermission="view:templates">
                    <TemplateManagement />
                  </ProtectedRoute>
                } />
                <Route path="/msp-template-foundry" element={
                  <ProtectedRoute requiredPermission="manage:templates">
                    <MSPTemplateFoundry />
                  </ProtectedRoute>
                } />
                <Route path="/environments" element={
                  <ProtectedRoute requiredPermission="view:environments">
                    <Environments />
                  </ProtectedRoute>
                } />
                <Route path="/environments/:environmentId" element={
                  <ProtectedRoute requiredPermission="view:environments">
                    <EnvironmentDetails />
                  </ProtectedRoute>
                } />
                <Route path="/users-and-groups" element={
                  <ProtectedRoute requiredPermission="view:users">
                    <UsersAndGroups />
                  </ProtectedRoute>
                } />
                <Route path="/cloud-accounts" element={
                  <ProtectedRoute requiredPermission="view:cloud-accounts">
                    <CloudAccounts />
                  </ProtectedRoute>
                } />
                <Route path="/nexus-ai" element={
                  <ProtectedRoute requiredPermission="use:nexus-ai">
                    <NexusAI />
                  </ProtectedRoute>
                } />
              </Route>
              
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AzureOpenAIProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
