import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/auth-context';
import { toast } from 'sonner';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredPermission?: string;
}

/**
 * A wrapper component that protects routes based on authentication and permissions
 */
export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredPermission
}) => {
  const { isAuthenticated, isLoading, hasPermission, user } = useAuth();
  const location = useLocation();
  const [permissionChecked, setPermissionChecked] = useState(!requiredPermission);
  
  useEffect(() => {
    // Check permission when component mounts or when user changes
    if (requiredPermission && user) {
      const hasAccess = hasPermission(requiredPermission);
      setPermissionChecked(true);
      
      if (!hasAccess) {
        toast.error(`You don't have permission to access this page`);
      }
    }
  }, [requiredPermission, user, hasPermission]);
  
  // Show loading state
  if (isLoading || (requiredPermission && !permissionChecked)) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="flex flex-col items-center space-y-4">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary"></div>
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }
  
  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  
  // Check permission if required
  if (requiredPermission && !hasPermission(requiredPermission)) {
    return <Navigate to="/" replace />;
  }
  
  return <>{children}</>;
};

export default ProtectedRoute;
