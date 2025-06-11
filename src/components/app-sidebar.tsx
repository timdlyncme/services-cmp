import React, { useState, useEffect } from "react";
import { Link, useLocation, NavLink } from "react-router-dom";
import { useAuth } from "@/context/auth-context";
import { cn } from "@/lib/utils";
import {
  Activity,
  FileCode,
  Database,
  CloudCog,
  Server,
  NotebookText,
  Shield,
  Settings,
  Users,
  Pickaxe,
  Brain,
  ChevronLeft,
  ChevronRight,
  CheckSquare,
  User,
  type LucideIcon,
} from "lucide-react";
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { TenantSwitcher } from "@/components/tenant-switcher";

interface NavItemProps {
  to: string;
  icon: LucideIcon;
  label: string;
  collapsed: boolean;
  permission?: string;
}

interface SidebarSectionProps {
  title: string;
  collapsed: boolean;
  children: React.ReactNode;
}

const NavItem = ({ to, icon: Icon, label, collapsed, permission }: NavItemProps) => {
  const { hasPermission } = useAuth();
  
  // If permission is required and user doesn't have it, don't render the item
  if (permission && !hasPermission(permission)) {
    return null;
  }
  
  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild>
        <NavLink
          to={to}
          className={({ isActive }) => 
            `flex items-center space-x-2 py-2 px-3 rounded-md transition-colors w-full
             ${isActive 
               ? "bg-sidebar-accent text-sidebar-accent-foreground" 
               : "hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"}`
          }
        >
          <Icon className="h-5 w-5" />
          {!collapsed && <span>{label}</span>}
        </NavLink>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
};

const SidebarSection = ({ title, collapsed, children }: SidebarSectionProps) => {
  // Filter out null children (from NavItems that don't have permission)
  const validChildren = React.Children.toArray(children).filter(child => child !== null);
  
  // If there are no valid children, don't render the section
  if (validChildren.length === 0) {
    return null;
  }
  
  return (
    <div className="py-2">
      {!collapsed && (
        <div className="px-4 py-2">
          <h3 className="text-xs font-semibold text-muted-foreground tracking-tight">
            {title}
          </h3>
        </div>
      )}
      <div className="space-y-1 px-2">
        {validChildren}
      </div>
    </div>
  );
};

export function AppSidebar() {
  const { user, currentTenant, hasPermission } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();

  useEffect(() => {
    if (!user) {
      console.log("No user found in AppSidebar");
    }
  }, [user]);

  const toggleCollapse = () => setCollapsed(!collapsed);

  // Get role from tenant assignments based on current tenant (same logic as app-header)
  const getCurrentTenantRole = () => {
    // If no current tenant or no tenant assignments, fall back to user.role or default
    if (!currentTenant || !user?.tenant_assignments || !Array.isArray(user.tenant_assignments)) {
      console.log('Sidebar: No current tenant or tenant assignments', {
        currentTenant: currentTenant?.name,
        currentTenantId: currentTenant?.tenant_id,
        hasUser: !!user,
        hasTenantAssignments: !!user?.tenant_assignments,
        tenantAssignmentsLength: user?.tenant_assignments?.length || 0,
        fallbackRole: user?.role || "user"
      });
      return user?.role || "user";
    }
    
    // Find the assignment for the current tenant
    const currentAssignment = user.tenant_assignments.find(
      assignment => assignment && assignment.tenant_id === currentTenant.tenant_id
    );
    
    console.log('Sidebar: Current tenant role lookup', {
      currentTenantId: currentTenant.tenant_id,
      currentTenantName: currentTenant.name,
      foundAssignment: !!currentAssignment,
      assignmentRole: currentAssignment?.role_name,
      fallbackRole: user?.role || "user",
      allAssignments: user.tenant_assignments.map(a => ({
        tenantId: a.tenant_id,
        roleName: a.role_name
      }))
    });
    
    // Return the role from the assignment, or fall back to user.role, or default to "user"
    return currentAssignment?.role_name || user?.role || "user";
  };

  const userRole = getCurrentTenantRole();
  console.log('Sidebar: Final role determination', {
    userRole,
    isAdmin: userRole === "admin",
    isMSP: user?.isMspUser && userRole === "msp",
    isRegularUser: userRole === "user"
  });
  
  const isAdmin = userRole === "admin";
  const isMSP = user?.isMspUser && userRole === "msp";
  const isRegularUser = userRole === "user";

  return (
    <Sidebar
      className={`border-r transition-all duration-300 ${
        collapsed ? "w-[70px]" : "w-[250px]"
      }`}
    >
      <SidebarHeader className="flex h-14 items-center border-b px-4">
        <div className="flex items-center">
          <div className="mr-2">
            <img 
              src="/new-logo-transparent.png" 
              alt="Company Logo" 
              className="h-6 w-auto" 
            />
          </div>
          {!collapsed && (
            <span className="font-medium">Cloud Management</span>
          )}
        </div>
      </SidebarHeader>
      <div className="flex flex-col h-full">
        <SidebarContent>
          {/* Core Services Section - Available to all users */}
          <SidebarSection title="Core Services" collapsed={collapsed}>
            <div className="list-none">
              <NavItem to="/" icon={Activity} label="Dashboard" collapsed={collapsed} />
              <NavItem to="/catalog" icon={FileCode} label="Template Catalog" collapsed={collapsed} permission="view:catalog" />
              <NavItem to="/deployments" icon={Database} label="Deployments" collapsed={collapsed} permission="view:deployments" />
              <NavItem to="/approvals" icon={CheckSquare} label="Approvals" collapsed={collapsed} />
            </div>
          </SidebarSection>

          {/* Tenant Management Section - visible to admin and MSP roles only */}
          {(isAdmin || isMSP) && (
            <>
              <SidebarSeparator />
              <SidebarSection title="Tenant Management" collapsed={collapsed}>
                <div className="list-none">
                  <NavItem to="/cloud-accounts" icon={CloudCog} label="Cloud Accounts" collapsed={collapsed} permission="view:cloud-accounts" />
                  <NavItem to="/environments" icon={Server} label="Environments" collapsed={collapsed} permission="view:environments" />
                  <NavItem to="/template-management" icon={NotebookText} label="Template Management" collapsed={collapsed} permission="view:templates" />
                  <NavItem to="/users-and-groups" icon={Shield} label="Users & Groups" collapsed={collapsed} permission="view:users" />
                  <NavItem to="/settings" icon={Settings} label="Settings" collapsed={collapsed} permission="view:settings" />
                </div>
              </SidebarSection>
            </>
          )}

          {/* MSP Management Section - visible only to MSP users */}
          {isMSP && (
            <>
              <SidebarSeparator />
              <SidebarSection title="MSP Management" collapsed={collapsed}>
                <div className="list-none">
                  <NavItem to="/msp/tenants" icon={Users} label="All Tenants" collapsed={collapsed} permission="view:all-tenants" />
                  <NavItem to="/msp/users" icon={Shield} label="MSP Users" collapsed={collapsed} permission="view:msp-users" />
                  <NavItem to="/msp/analytics" icon={Activity} label="Platform Analytics" collapsed={collapsed} permission="view:platform-analytics" />
                  <NavItem to="/msp-template-foundry" icon={Pickaxe} label="Template Foundry" collapsed={collapsed} permission="view:templates" />
                  <NavItem to="/nexus-ai" icon={Brain} label="NexusAI" collapsed={collapsed} permission="use:nexus_ai" />
                </div>
              </SidebarSection>
            </>
          )}
        </SidebarContent>
        
        <div className="mt-auto">
          <SidebarSeparator />
          <div className="p-2">
            {!collapsed && <TenantSwitcher />}
          </div>
          <SidebarFooter className="p-2">
            <button
              onClick={toggleCollapse}
              className="w-full flex items-center justify-center p-2 rounded-md hover:bg-accent"
            >
              {collapsed ? (
                <ChevronRight className="h-5 w-5" />
              ) : (
                <ChevronLeft className="h-5 w-5" />
              )}
            </button>
          </SidebarFooter>
        </div>
      </div>
    </Sidebar>
  );
}
