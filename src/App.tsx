import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/context/auth-context";
import { AzureOpenAIProvider } from "@/contexts/AzureOpenAIContext";

import { AppLayout } from "@/components/app-layout";
import { ProtectedRoute } from "@/components/protected-route";
import Dashboard from "@/pages/Dashboard";
import EnhancedDashboard from "@/pages/EnhancedDashboard";
import Catalog from "@/pages/Catalog";
import Deployments from "@/pages/Deployments";
import Environments from "@/pages/Environments";
import Templates from "@/pages/Templates";
import TemplateFoundry from "@/pages/TemplateFoundry";
import Integrations from "@/pages/Integrations";
import Settings from "@/pages/Settings";
import Tenants from "@/pages/Tenants";
import Permissions from "@/pages/Permissions";
import Roles from "@/pages/Roles";
import Users from "@/pages/Users";
import UsersAndGroups from "@/pages/UsersAndGroups";
import CloudAccounts from "@/pages/CloudAccounts";
import NexusAI from "@/pages/NexusAI";
import Login from "@/pages/Login";
import SSOCallback from "@/pages/SSOCallback";
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
              <Route path="/sso/callback" element={<SSOCallback />} />
              
              <Route element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }>
                <Route path="/" element={<EnhancedDashboard />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/catalog" element={<Catalog />} />
                <Route path="/deployments" element={<Deployments />} />
                <Route path="/environments" element={<Environments />} />
                <Route path="/templates" element={<Templates />} />
                <Route path="/template-foundry" element={<TemplateFoundry />} />
                <Route path="/integrations" element={<Integrations />} />
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
                <Route path="/permissions" element={
                  <ProtectedRoute requiredPermission="view:permissions">
                    <Permissions />
                  </ProtectedRoute>
                } />
                <Route path="/roles" element={
                  <ProtectedRoute requiredPermission="view:roles">
                    <Roles />
                  </ProtectedRoute>
                } />
                <Route path="/users" element={
                  <ProtectedRoute requiredPermission="view:users">
                    <Users />
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
