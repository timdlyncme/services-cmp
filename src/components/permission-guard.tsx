import React, { useEffect } from 'react';
import { useAuth } from '@/context/auth-context';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';

interface PermissionGuardProps {
  permission: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  showToast?: boolean;
}

/**
 * A component that conditionally renders its children based on user permissions
 */
export const PermissionGuard: React.FC<PermissionGuardProps> = ({
  permission,
  children,
  fallback,
  showToast = false
}) => {
  const { hasPermission, user } = useAuth();
  const userHasPermission = hasPermission(permission);
  
  // Show toast notification for permission denied if requested
  useEffect(() => {
    if (showToast && !userHasPermission && user) {
      toast.error(`Access denied: You don't have the required permission (${permission})`);
    }
  }, [showToast, userHasPermission, permission, user]);
  
  if (userHasPermission) {
    return <>{children}</>;
  }
  
  // Return fallback if provided, otherwise show default access denied message
  return (
    <>
      {fallback || (
        <Alert variant="destructive" className="my-4">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>Access Denied</AlertTitle>
          <AlertDescription>
            You don't have permission to access this feature.
            Required permission: {permission}
          </AlertDescription>
        </Alert>
      )}
    </>
  );
};

export default PermissionGuard;
