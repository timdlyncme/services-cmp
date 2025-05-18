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
                savedTenantId ? t.id === savedTenantId : t.id === authUser.tenantId
              );
              setCurrentTenant(tenant || userTenants[0]);
            } else {
              console.warn("No tenants found for user, using default tenant");
              // Create a default tenant if none exists
              const defaultTenant = {
                id: authUser.tenantId || "default-tenant",
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
      
      // Ensure user has permissions array
      if (!authUser.permissions || authUser.permissions.length === 0) {
        console.warn("User has no permissions, adding default permissions for development");
        authUser.permissions = defaultPermissions;
      }
      
      // Store token in localStorage
      localStorage.setItem("token", token);
      
      // Set user in state
      setUser(authUser);
      
      // Get user's tenants
      const userTenants = await authService.getUserTenants(authUser.id);
      
      if (userTenants && userTenants.length > 0) {
        setTenants(userTenants);
        
        // Set current tenant to user's default tenant
        const defaultTenant = userTenants.find(t => t.id === authUser.tenantId) || userTenants[0];
        setCurrentTenant(defaultTenant);
        
        if (defaultTenant) {
          localStorage.setItem("currentTenantId", defaultTenant.id);
        }
      } else {
        console.warn("No tenants found for user, using default tenant");
        // Create a default tenant if none exists
        const defaultTenant = {
          id: authUser.tenantId || "default-tenant",
          name: "Default Tenant",
          description: "Default tenant for development",
          createdAt: new Date().toISOString()
        };
        setTenants([defaultTenant]);
        setCurrentTenant(defaultTenant);
        localStorage.setItem("currentTenantId", defaultTenant.id);
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
    localStorage.removeItem("token");
    localStorage.removeItem("currentTenantId");
    toast.info("You have been logged out");
  };

  const switchTenant = (tenantId: string) => {
    const tenant = tenants.find(t => t.id === tenantId);
    if (tenant) {
      setCurrentTenant(tenant);
      localStorage.setItem("currentTenantId", tenantId);
      toast.success(`Switched to ${tenant.name}`);
    }
  };

  const hasPermission = (permission: string): boolean => {
    if (!user) return false;
    
    // For development, if user has no permissions, grant all permissions
    if (!user.permissions || user.permissions.length === 0) {
      console.warn(`No permissions found for user, granting permission: ${permission}`);
      return true;
    }
    
    // Check if the user has the specific permission
    const hasSpecificPermission = user.permissions.some(p => p.name === permission);
    
    if (hasSpecificPermission) {
      return true;
    }
    
    // If user is admin or msp, grant all permissions
    if (user.role === 'admin' || user.role === 'msp') {
      return true;
    }
    
    return false;
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
