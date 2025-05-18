import React, { useEffect } from 'react';
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
  
  // Show loading state
  if (isLoading) {
    return <div>Loading...</div>;
  }
  
  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  
  // Check permission if required
  if (requiredPermission) {
    const hasRequiredPermission = hasPermission(requiredPermission);
    
    if (!hasRequiredPermission) {
      // Show toast notification for permission denied
      useEffect(() => {
        toast.error(`Access denied: You don't have the required permission (${requiredPermission})`);
      }, []);
      
      // Redirect to dashboard
      return <Navigate to="/" replace />;
    }
  }
  
  return <>{children}</>;
};

export default ProtectedRoute;
