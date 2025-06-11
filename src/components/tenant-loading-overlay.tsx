import React, { useState, useEffect } from 'react';
import { Loader2, Building } from 'lucide-react';

interface TenantLoadingOverlayProps {
  isVisible: boolean;
  tenantName: string | null;
}

export function TenantLoadingOverlay({ isVisible, tenantName }: TenantLoadingOverlayProps) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (isVisible) {
      setProgress(0); // Reset progress when overlay becomes visible
      const interval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 100) {
            clearInterval(interval); // Stop at 100%
            return 100;
          }
          return prev + 4; // Increment progress (slower for smoother animation)
        });
      }, 120); // Slower interval for smoother progress

      return () => clearInterval(interval); // Cleanup on unmount or visibility change
    } else {
      setProgress(0); // Reset progress when overlay is hidden
    }
  }, [isVisible]);

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-card border rounded-lg shadow-lg p-8 max-w-md w-full mx-4">
        <div className="flex flex-col items-center text-center space-y-4">
          {/* Animated Icon */}
          <div className="relative">
            <Building className="h-12 w-12 text-muted-foreground" />
          </div>
          
          {/* Loading Text */}
          <div className="space-y-2">
            <h3 className="text-lg font-semibold">
              Loading Tenant
            </h3>
            {tenantName && (
              <p className="text-sm text-muted-foreground">
                Switching to <span className="font-medium text-foreground">{tenantName}</span>
              </p>
            )}
          </div>
          
          {/* Dynamic Progress Indicator */}
          <div className="w-full bg-muted rounded-full h-2">
            <div
              className="bg-primary h-2 rounded-full transition-all duration-100 ease-out"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
          
          <p className="text-xs text-muted-foreground">
            Please wait while we load your tenant data...
          </p>
        </div>
      </div>
    </div>
  );
}

