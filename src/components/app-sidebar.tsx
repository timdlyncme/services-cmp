
import { useState } from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "@/context/auth-context";
import { Button } from "@/components/ui/button";
import { 
  Activity, 
  Settings, 
  Database, 
  Server, 
  FileCode, 
  ChevronLeft, 
  ChevronRight,
  Users
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarTrigger,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar";
import { TenantSwitcher } from "@/components/tenant-switcher";

interface NavItemProps {
  to: string;
  icon: React.ElementType;
  label: string;
  collapsed: boolean;
}

const NavItem = ({ to, icon: Icon, label, collapsed }: NavItemProps) => (
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

export function AppSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const { user } = useAuth();

  const toggleCollapse = () => setCollapsed(!collapsed);

  return (
    <Sidebar
      className={`border-r transition-all duration-300 ${
        collapsed ? "w-[70px]" : "w-[250px]"
      }`}
    >
      <SidebarHeader className="flex h-14 items-center border-b px-4">
        <div className="flex items-center">
          <div className="text-primary mr-2">
            <Server className="h-6 w-6" />
          </div>
          {!collapsed && (
            <span className="font-medium">CloudFlow</span>
          )}
        </div>
      </SidebarHeader>
      <div className="flex flex-col h-full">
        <SidebarContent>
          <div className="py-2">
            <SidebarMenu>
              <NavItem to="/" icon={Activity} label="Dashboard" collapsed={collapsed} />
              <NavItem to="/catalog" icon={FileCode} label="Template Catalog" collapsed={collapsed} />
              <NavItem to="/deployments" icon={Database} label="Deployments" collapsed={collapsed} />
              {(user?.role === "admin" || user?.role === "msp") && (
                <NavItem to="/settings" icon={Settings} label="Settings" collapsed={collapsed} />
              )}
              {user?.role === "msp" && (
                <NavItem to="/tenants" icon={Users} label="Tenants" collapsed={collapsed} />
              )}
            </SidebarMenu>
          </div>
        </SidebarContent>
        
        <div className="mt-auto">
          {!collapsed && (
            <div className="px-3 py-2">
              <TenantSwitcher />
            </div>
          )}
          <SidebarFooter className="border-t p-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleCollapse}
              className="w-full flex justify-center"
            >
              {collapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
            </Button>
          </SidebarFooter>
        </div>
      </div>
    </Sidebar>
  );
}
