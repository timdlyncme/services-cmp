import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { useAuth } from "@/context/auth-context";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

export function AppHeader() {
  const { user, logout, currentTenant } = useAuth();

  if (!user) return null;
  
  // Safely handle user.name - use email or default if name is not available
  const userName = user.name || user.full_name || user.email || "User";
  
  const initials = userName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase();

  // Get role from tenant assignments based on current tenant
  const getCurrentTenantRole = () => {
    // If no current tenant or no tenant assignments, fall back to user.role or default
    if (!currentTenant || !user.tenant_assignments || !Array.isArray(user.tenant_assignments)) {
      console.log('Header: No current tenant or tenant assignments', {
        currentTenant: currentTenant?.name,
        currentTenantId: currentTenant?.tenant_id,
        hasUser: !!user,
        hasTenantAssignments: !!user.tenant_assignments,
        tenantAssignmentsLength: user.tenant_assignments?.length || 0,
        fallbackRole: user.role || "user"
      });
      return user.role || "user";
    }
    
    // Find the assignment for the current tenant
    const currentAssignment = user.tenant_assignments.find(
      assignment => assignment && assignment.tenant_id === currentTenant.tenant_id
    );
    
    console.log('Header: Current tenant role lookup', {
      currentTenantId: currentTenant.tenant_id,
      currentTenantName: currentTenant.name,
      foundAssignment: !!currentAssignment,
      assignmentRole: currentAssignment?.role_name,
      fallbackRole: user.role || "user",
      allAssignments: user.tenant_assignments.map(a => ({
        tenantId: a.tenant_id,
        roleName: a.role_name
      }))
    });
    
    // Return the role from the assignment, or fall back to user.role, or default to "user"
    return currentAssignment?.role_name || user.role || "user";
  };

  const userRole = getCurrentTenantRole();
  console.log('Header: Final role determination', {
    userRole,
    safeUserRole: (userRole && typeof userRole === 'string') ? userRole : "user"
  });

  // Ensure userRole is never null/undefined to prevent toUpperCase() error
  const safeUserRole = (userRole && typeof userRole === 'string') ? userRole : "user";
  
  const roleBadgeVariant = 
    safeUserRole === "admin" ? "default" :
    safeUserRole === "msp" ? "destructive" : "outline";

  return (
    <header className="sticky top-0 z-30 h-16 border-b bg-background/95 backdrop-blur">
      <div className="flex h-16 items-center justify-between px-4">
        <div></div>
        <div className="flex items-center gap-4">
          <ThemeToggle />
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={user.avatar} alt={userName} />
                  <AvatarFallback>{initials}</AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">{userName}</p>
                  <p className="text-xs leading-none text-muted-foreground">
                    {user.email}
                  </p>
                  <Badge variant={roleBadgeVariant} className="mt-2 w-min">
                    {safeUserRole.toUpperCase()}
                  </Badge>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={() => logout()}
                className="cursor-pointer"
              >
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
