import { useState, useEffect } from "react";
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
  LogOut,
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
  SidebarSection as BaseSidebarSection,
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
  const [hasAccess, setHasAccess] = useState(true);
  
  useEffect(() => {
    // Check if user has permission to see this item
    if (permission) {
      setHasAccess(hasPermission(permission));
    }
  }, [permission, hasPermission]);
  
  // If permission is required and user doesn't have it, don't render the item
  if (permission && !hasAccess) {
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

const SidebarSection = ({ title, collapsed, children }: SidebarSectionProps) => (
  <div className="py-2">
    {!collapsed && (
      <div className="px-4 py-2">
        <h3 className="text-xs font-semibold text-muted-foreground tracking-tight">
          {title}
        </h3>
      </div>
    )}
    <div className="space-y-1 px-2">
      {children}
    </div>
  </div>
);

export function AppSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const { user, hasPermission, logout } = useAuth();
  const [permissions, setPermissions] = useState<Record<string, boolean>>({});

  const toggleCollapse = () => setCollapsed(!collapsed);

  // Check if user has admin or msp role
  const isAdmin = user?.role === "admin" || user?.role === "msp";
  const isMSP = user?.role === "msp";
  
  useEffect(() => {
    // Pre-check all permissions to avoid re-renders
    if (user) {
      const allPermissions = [
        'view:dashboard',
        'view:catalog',
        'view:deployments',
        'view:cloud-accounts',
        'view:environments',
        'view:templates',
        'view:users',
        'view:settings',
        'view:tenants',
        'manage:templates',
        'use:nexus-ai'
      ];
      
      const permissionMap: Record<string, boolean> = {};
      
      allPermissions.forEach(permission => {
        permissionMap[permission] = hasPermission(permission);
      });
      
      setPermissions(permissionMap);
    }
  }, [user, hasPermission]);

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
          {/* Core Services Section */}
          <SidebarSection title="Core Services" collapsed={collapsed}>
            {permissions['view:dashboard'] && (
              <NavItem to="/" icon={Activity} label="Dashboard" collapsed={collapsed} />
            )}
            {permissions['view:catalog'] && (
              <NavItem to="/catalog" icon={FileCode} label="Template Catalog" collapsed={collapsed} />
            )}
            {permissions['view:deployments'] && (
              <NavItem to="/deployments" icon={Database} label="Deployments" collapsed={collapsed} />
            )}
          </SidebarSection>

          {/* Admin Settings Section - visible to admin and msp roles */}
          {isAdmin && (
            <>
              <SidebarSeparator />
              <SidebarSection title="Tenant Settings" collapsed={collapsed}>
                {permissions['view:cloud-accounts'] && (
                  <NavItem to="/cloud-accounts" icon={CloudCog} label="Cloud Accounts" collapsed={collapsed} />
                )}
                {permissions['view:environments'] && (
                  <NavItem to="/environments" icon={Server} label="Environments" collapsed={collapsed} />
                )}
                {permissions['view:templates'] && (
                  <NavItem to="/template-management" icon={NotebookText} label="Template Management" collapsed={collapsed} />
                )}
                {permissions['view:users'] && (
                  <NavItem to="/users-and-groups" icon={Shield} label="Users & Groups" collapsed={collapsed} />
                )}
                {permissions['view:settings'] && (
                  <NavItem to="/settings" icon={Settings} label="Settings" collapsed={collapsed} />
                )}
              </SidebarSection>
            </>
          )}

          {/* MSP Management Section - visible only to msp role */}
          {isMSP && (
            <>
              <SidebarSeparator />
              <SidebarSection title="MSP Management" collapsed={collapsed}>
                {permissions['view:tenants'] && (
                  <NavItem to="/tenants" icon={Users} label="Tenants" collapsed={collapsed} />
                )}
                {permissions['manage:templates'] && (
                  <NavItem to="/msp-template-foundry" icon={Pickaxe} label="Template Foundry" collapsed={collapsed} />
                )}
                {permissions['use:nexus-ai'] && (
                  <NavItem to="/nexus-ai" icon={Brain} label="NexusAI" collapsed={collapsed} />
                )}
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
            <div className="flex flex-col space-y-2">
              <button
                onClick={logout}
                className="w-full flex items-center justify-center p-2 rounded-md hover:bg-accent text-muted-foreground hover:text-accent-foreground"
              >
                <LogOut className="h-5 w-5" />
                {!collapsed && <span className="ml-2">Logout</span>}
              </button>
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
            </div>
          </SidebarFooter>
        </div>
      </div>
    </Sidebar>
  );
}
