import React, { useState, useEffect } from 'react';
import { Loader2, Building } from 'lucide-react';

interface TenantLoadingOverlayProps {
  isVisible: boolean;
  tenantName: string | null;
}

export function TenantLoadingOverlay({ isVisible, tenantName }: TenantLoadingOverlayProps) {
  const [progress, setProgress] = useState(0);
  const [internalVisible, setInternalVisible] = useState(false);
  const [startTime, setStartTime] = useState<number | null>(null);
  
  const MIN_DISPLAY_DURATION = 3000; // 3 seconds minimum display time

  useEffect(() => {
    if (isVisible && !internalVisible) {
      // Starting to show the overlay
      setInternalVisible(true);
      setStartTime(Date.now());
      setProgress(0);
      
      // Start progress animation
      const interval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 100) {
            clearInterval(interval);
            return 100;
          }
          return prev + 8; // Increment progress
        });
      }, 200);

      return () => clearInterval(interval);
    } else if (!isVisible && internalVisible && startTime) {
      // Parent wants to hide overlay, but check minimum duration
      const elapsedTime = Date.now() - startTime;
      
      if (elapsedTime >= MIN_DISPLAY_DURATION) {
        // Minimum time has passed, hide immediately
        setInternalVisible(false);
        setStartTime(null);
        setProgress(0);
      } else {
        // Wait for remaining time before hiding
        const remainingTime = MIN_DISPLAY_DURATION - elapsedTime;
        const timeout = setTimeout(() => {
          setInternalVisible(false);
          setStartTime(null);
          setProgress(0);
        }, remainingTime);

        return () => clearTimeout(timeout);
      }
    }
  }, [isVisible, internalVisible, startTime]);

  // Don't render if not internally visible
  if (!internalVisible) return null;

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

