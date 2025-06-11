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
          return prev + 8; // Increment progress
        });
      }, 200); // Adjust interval speed as needed

      return () => clearInterval(interval); // Cleanup on unmount or visibility change
    } else {
      setProgress(0); // Reset progress when overlay is hidden
    }
  }, [isVisible]);

  useEffect(() => {
    if (progress === 100) {
      const timeout = setTimeout(() => {
        setProgress(0); // Reset progress after a short delay
      }, 1000); // Adjust delay as needed (e.g., 1 second)

      return () => clearTimeout(timeout); // Cleanup timeout on unmount or progress change
    }
  }, [progress]);

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
              className="bg-primary h-2 rounded-full"
              style={{ width: `${progress}%`, transition: 'width 0.2s ease-in-out' }}
            ></div>
          </div>
          
          <p className="text-xs text-muted-foreground">
            {progress < 100 ? 'Please wait while we load your tenant data...' : 'Loading complete!'}
          </p>
        </div>
      </div>
    </div>
  );
}
