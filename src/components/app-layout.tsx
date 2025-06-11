import { Outlet } from "react-router-dom";
import { AppHeader } from "@/components/app-header";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TenantLoadingOverlay } from "@/components/tenant-loading-overlay";
import { useAuth } from "@/context/auth-context";
import { Navigate } from "react-router-dom";

export function AppLayout() {
  const { isAuthenticated, isLoading, isSwitchingTenant, switchingToTenant } = useAuth();
  
  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary"></div>
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  return (
    <SidebarProvider>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex-1 overflow-auto">
          <AppHeader />
          <main className="container py-6">
            <Outlet />
          </main>
        </div>
        <Toaster />
        <Sonner />
        
        {/* Tenant Loading Overlay */}
        <TenantLoadingOverlay 
          isVisible={isSwitchingTenant} 
          tenantName={switchingToTenant} 
        />
      </div>
    </SidebarProvider>
  );
}
