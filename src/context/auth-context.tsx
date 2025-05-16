
import React, { createContext, useContext, useState, useEffect } from "react";
import { User, Tenant, UserRole } from "@/types/auth";

interface AuthContextType {
  user: User | null;
  tenants: Tenant[];
  currentTenant: Tenant | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  switchTenant: (tenantId: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

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
        // In a real app, this would verify a token with your backend
        const savedUser = localStorage.getItem("user");
        const savedTenantId = localStorage.getItem("currentTenantId");
        
        if (savedUser) {
          const parsedUser = JSON.parse(savedUser) as User;
          setUser(parsedUser);
          setTenants(mockTenants);
          
          const tenant = mockTenants.find(t => 
            savedTenantId ? t.id === savedTenantId : t.id === parsedUser.tenantId
          );
          setCurrentTenant(tenant || null);
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
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Find user (in a real app, this would be a backend call)
      const matchedUser = mockUsers.find(u => u.email === email);
      
      if (!matchedUser) {
        throw new Error("Invalid credentials");
      }
      
      // Set user in state and localStorage
      setUser(matchedUser);
      localStorage.setItem("user", JSON.stringify(matchedUser));
      
      // Set tenants the user has access to
      setTenants(mockTenants);
      
      // Set current tenant to user's default tenant
      const defaultTenant = mockTenants.find(t => t.id === matchedUser.tenantId) || null;
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
    localStorage.removeItem("user");
    localStorage.removeItem("currentTenantId");
  };

  const switchTenant = (tenantId: string) => {
    const tenant = tenants.find(t => t.id === tenantId);
    if (tenant) {
      setCurrentTenant(tenant);
      localStorage.setItem("currentTenantId", tenantId);
    }
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
