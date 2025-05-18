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

// Mock data for demo purposes
const mockTenants: Tenant[] = [
  {
    id: "tenant-1",
    name: "Acme Corp",
    description: "Main corporate tenant",
    createdAt: "2023-01-15T12:00:00Z",
  },
  {
    id: "tenant-2",
    name: "Dev Team",
    description: "Development team workspace",
    createdAt: "2023-02-20T09:30:00Z",
  },
];

const mockUsers: User[] = [
  {
    id: "user-1",
    name: "Admin User",
    email: "admin@example.com",
    role: "admin",
    tenantId: "tenant-1",
  },
  {
    id: "user-2",
    name: "Regular User",
    email: "user@example.com",
    role: "user",
    tenantId: "tenant-1",
  },
  {
    id: "user-3",
    name: "MSP User",
    email: "msp@example.com",
    role: "msp",
    tenantId: "tenant-2",
  },
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
            setUser(authUser);
            
            // Get user's tenants
            const userTenants = await authService.getUserTenants(authUser.id);
            setTenants(userTenants);
            
            // Set current tenant
            const savedTenantId = localStorage.getItem("currentTenantId");
            const tenant = userTenants.find(t => 
              savedTenantId ? t.id === savedTenantId : t.id === authUser.tenantId
            );
            setCurrentTenant(tenant || null);
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
      
      // Get user's tenants
      const userTenants = await authService.getUserTenants(authUser.id);
      setTenants(userTenants);
      
      // Set current tenant to user's default tenant
      const defaultTenant = userTenants.find(t => t.id === authUser.tenantId) || null;
      setCurrentTenant(defaultTenant);
      
      if (defaultTenant) {
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
    if (!user || !user.permissions) return false;
    
    // Check if the user has the specific permission
    return user.permissions.some(p => p.name === permission);
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
