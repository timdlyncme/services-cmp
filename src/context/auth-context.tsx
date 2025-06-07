import React, { createContext, useContext, useState, useEffect } from "react";
import { User, Tenant, UserRole, Permission } from "@/types/auth";
import { AuthService } from "@/services/auth-service";
import { toast } from "sonner";

interface AuthContextType {
  user: User | null;
  tenants: Tenant[];
  currentTenant: Tenant | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isServerConnected: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  switchTenant: (tenantId: string) => void;
  hasPermission: (permission: string) => boolean;
  checkServerConnection: () => Promise<boolean>;
  updateTenants: (updatedTenants: Tenant[]) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Initialize auth service
const authService = new AuthService();

// Default permissions for development
const defaultPermissions: Permission[] = [
  { name: "view:dashboard", description: "View dashboard" },
  { name: "view:deployments", description: "View deployments" },
  { name: "view:catalog", description: "View template catalog" },
  { name: "view:cloud-accounts", description: "View cloud accounts" },
  { name: "view:environments", description: "View environments" },
  { name: "view:templates", description: "View templates" },
  { name: "view:users", description: "View users and groups" },
  { name: "view:settings", description: "View settings" },
  { name: "view:tenants", description: "View tenants" },
  { name: "manage:templates", description: "Manage templates" },
  { name: "use:nexus-ai", description: "Use NexusAI" }
];

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [currentTenant, setCurrentTenant] = useState<Tenant | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isServerConnected, setIsServerConnected] = useState(false);

  const checkServerConnection = async (): Promise<boolean> => {
    try {
      const isConnected = await authService.checkHealth();
      setIsServerConnected(isConnected);
      return isConnected;
    } catch (error) {
      console.error("Server connection check failed:", error);
      setIsServerConnected(false);
      return false;
    }
  };

  useEffect(() => {
    // Check server connection and existing session
    const initAuth = async () => {
      try {
        // First check if the server is running
        const isConnected = await checkServerConnection();
        
        if (!isConnected) {
          console.error("Authentication server is not available");
          setIsLoading(false);
          return;
        }

        // Check for token in localStorage
        const token = localStorage.getItem("token");
        
        if (token) {
          // Verify token and get user data
          const authUser = await authService.verifyToken(token);
          
          if (authUser) {
            // Ensure user has permissions array
            if (!authUser.permissions || authUser.permissions.length === 0) {
              console.warn("User has no permissions, adding default permissions for development");
              authUser.permissions = defaultPermissions;
            }
            
            setUser(authUser);
            
            // Get user's tenants
            const userTenants = await authService.getUserTenants(authUser.id);
            
            if (userTenants && userTenants.length > 0) {
              setTenants(userTenants);
              
              // Set current tenant
              const savedTenantId = localStorage.getItem("currentTenantId");
              const tenant = userTenants.find(t => 
                savedTenantId ? t.tenant_id === savedTenantId : t.tenant_id === authUser.tenantId
              );
              setCurrentTenant(tenant || userTenants[0]);
            } else {
              console.warn("No tenants found for user, using default tenant");
              // Create a default tenant if none exists
              const defaultTenant = {
                id: authUser.tenantId || "default-tenant",
                tenant_id: authUser.tenantId || "default-tenant",
                name: "Default Tenant",
                description: "Default tenant for development",
                createdAt: new Date().toISOString()
              };
              setTenants([defaultTenant]);
              setCurrentTenant(defaultTenant);
            }
          } else {
            // Token is invalid, clear localStorage
            localStorage.removeItem("token");
            localStorage.removeItem("currentTenantId");
          }
        }
      } catch (error) {
        console.error("Auth initialization failed:", error);
      } finally {
        setIsLoading(false);
      }
    };
    
    initAuth();
  }, []);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    
    try {
      // Check server connection first
      const isConnected = await checkServerConnection();
      
      if (!isConnected) {
        toast.error("Authentication server is not available. Please try again later.");
        throw new Error("Authentication server is not available");
      }
      
      // Authenticate user
      const { user: authUser, token } = await authService.login(email, password);
      
      // Store token in localStorage
      localStorage.setItem("token", token);
      
      // Set user in state
      setUser(authUser);
      
      // Handle multi-tenant setup
      if (authUser.accessibleTenants && authUser.accessibleTenants.length > 0) {
        // Get full tenant details for accessible tenants
        const userTenants = await authService.getUserTenants(authUser.id);
        const accessibleTenantDetails = userTenants.filter(tenant => 
          authUser.accessibleTenants!.includes(tenant.tenant_id)
        );
        
        setTenants(accessibleTenantDetails);
        
        // Set current tenant to user's current tenant from login
        const currentTenant = accessibleTenantDetails.find(t => t.tenant_id === authUser.tenantId);
        if (currentTenant) {
          setCurrentTenant(currentTenant);
          localStorage.setItem("currentTenantId", currentTenant.tenant_id);
        } else if (accessibleTenantDetails.length > 0) {
          // Fallback to first accessible tenant
          setCurrentTenant(accessibleTenantDetails[0]);
          localStorage.setItem("currentTenantId", accessibleTenantDetails[0].tenant_id);
        }
      } else {
        // MSP users or users with no specific tenant assignments
        if (authUser.isMspUser) {
          // MSP users can see all tenants
          const allTenants = await authService.getUserTenants(authUser.id);
          setTenants(allTenants);
          
          if (allTenants.length > 0) {
            const currentTenant = allTenants.find(t => t.tenant_id === authUser.tenantId) || allTenants[0];
            setCurrentTenant(currentTenant);
            localStorage.setItem("currentTenantId", currentTenant.tenant_id);
          }
        } else {
          // Fallback for users without proper tenant assignments
          console.warn("User has no accessible tenants, creating default tenant");
          const defaultTenant = {
            id: authUser.tenantId || "default-tenant",
            tenant_id: authUser.tenantId || "default-tenant",
            name: "Default Tenant",
            description: "Default tenant for development",
            date_created: new Date().toISOString()
          };
          setTenants([defaultTenant]);
          setCurrentTenant(defaultTenant);
          localStorage.setItem("currentTenantId", defaultTenant.tenant_id);
        }
      }
      
      toast.success(`Welcome, ${authUser.name}!`);
    } catch (error) {
      console.error("Login failed:", error);
      
      // Show user-friendly error message
      if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error("Login failed. Please try again.");
      }
      
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    setCurrentTenant(null);
    setTenants([]);
    localStorage.removeItem("token");
    localStorage.removeItem("currentTenantId");
    toast.info("You have been logged out");
  };

  const switchTenant = async (tenantId: string) => {
    if (!user) return;
    
    try {
      // Call backend to switch tenant context
      const updatedUser = await authService.switchTenant(tenantId);
      
      if (updatedUser) {
        // Update user with new tenant context and permissions
        setUser(updatedUser);
        
        // Update current tenant
        const tenant = tenants.find(t => t.tenant_id === tenantId);
        if (tenant) {
          setCurrentTenant(tenant);
          localStorage.setItem("currentTenantId", tenantId);
          toast.success(`Switched to ${tenant.name}`);
        }
      } else {
        toast.error("Failed to switch tenant");
      }
    } catch (error) {
      console.error("Tenant switch failed:", error);
      toast.error("Failed to switch tenant");
    }
  };

  const hasPermission = (permission: string): boolean => {
    if (!user) return false;
    
    // Debug logging to understand what's happening
    console.log('hasPermission check:', {
      permission,
      userRole: user.role,
      userPermissions: user.permissions,
      isMspUser: user.isMspUser,
      hasPermissionsArray: !!user.permissions,
      permissionsLength: user.permissions?.length || 0
    });
    
    // MSP users have all permissions
    if (user.isMspUser && user.role === 'msp') {
      return true;
    }
    
    // For development, if user has no permissions, grant basic permissions
    if (!user.permissions || user.permissions.length === 0) {
      console.warn(`No permissions found for user, granting permission: ${permission}`);
      return true;
    }
    
    // Check if the user has the specific permission
    // Handle both string array (from backend) and Permission object array (for compatibility)
    const hasSpecificPermission = user.permissions.some(p => 
      typeof p === 'string' ? p === permission : p.name === permission
    );
    
    console.log('Permission check result:', {
      permission,
      hasSpecificPermission,
      userRole: user.role,
      isMspUser: user.isMspUser
    });
    
    return hasSpecificPermission;
  };

  const updateTenants = (updatedTenants: Tenant[]) => {
    setTenants(updatedTenants);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        tenants,
        currentTenant,
        isAuthenticated: !!user,
        isLoading,
        isServerConnected,
        login,
        logout,
        switchTenant,
        hasPermission,
        checkServerConnection,
        updateTenants,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
