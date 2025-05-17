import React, { createContext, useContext, useState, useEffect } from "react";
import { User, Tenant, UserRole, Permission } from "@/types/auth";
import { AuthService } from "@/services/auth-service";

interface AuthContextType {
  user: User | null;
  tenants: Tenant[];
  currentTenant: Tenant | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  switchTenant: (tenantId: string) => void;
  hasPermission: (permission: string) => boolean;
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

  useEffect(() => {
    // Check for existing session
    const checkAuth = async () => {
      try {
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
        console.error("Auth check failed:", error);
      } finally {
        setIsLoading(false);
      }
    };
    
    checkAuth();
  }, []);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    
    try {
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
    } catch (error) {
      console.error("Login failed:", error);
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
  };

  const switchTenant = (tenantId: string) => {
    const tenant = tenants.find(t => t.id === tenantId);
    if (tenant) {
      setCurrentTenant(tenant);
      localStorage.setItem("currentTenantId", tenantId);
    }
  };

  const hasPermission = (permission: string): boolean => {
    if (!user || !user.permissions) return false;
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
        login,
        logout,
        switchTenant,
        hasPermission,
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
